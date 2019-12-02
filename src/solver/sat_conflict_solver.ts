import { Clause, Variable, OR, NOT, ALO, AMO, CNF } from "../misc/sat/cnf";
import { ConflictSolver, Package, NoConflictSituation, Dependencies } from "../misc/type";
import semver, { SemVer } from "semver";
import { solveCNF } from "../misc/sat/minisolver";
import { PackageRepository } from "../misc/npm/package_repository";
import * as progress from "progress";

const vName = (name: string, version: SemVer): string => `${name}#${version.version}`;

const packV = (name: string, version: SemVer): Variable => ({
  kind: "Variable",
  v: vName(name, version)
});

const vNameToPackage = (vName: string): Package => {
  const t = vName.split("#");
  return { name: t[0], version: new SemVer(t[1]) };
};

function notNull<T>(item: T | null): item is T {
  return item !== null;
}

export class SatConflictSolver implements ConflictSolver {
  private packageRepository: PackageRepository;
  private clauseCache: { [key: string]: Clause[] };
  constructor(repository: PackageRepository) {
    this.packageRepository = repository;
    this.clauseCache = {};
  }

  private getValidLatestVersion = (condition: string, versions: semver.SemVer[]): semver.SemVer =>
    versions.filter(v => semver.satisfies(v.version, condition)).sort((a, b) => (semver.gt(a, b) ? -1 : 1))[0];

  // TODO: Fix
  private async depToLogicExpressionInRange(name: string, version: SemVer, cache: string[]): Promise<Clause[] | null> {
    if (!cache.includes(vName(name, version))) {
      cache.push(vName(name, version));
      const pack = packV(name, version);
      const v = await this.packageRepository.getDependencies(name);
      const dep = v.get(Array.from(v.keys()).filter(v => semver.eq(v, version))[0]);
      if (!dep) throw new Error("cant get dep");
      const dependecyNames = Array.from(Object.keys(dep));
      /* eslint-disable @typescript-eslint/no-unused-vars */
      const packageDependecyInfo = await this.packageRepository.getMultiDependencies(dependecyNames).catch(_ => null);
      /* eslint-enable @typescript-eslint/no-unused-vars */
      if (packageDependecyInfo === null) return null;
      let depClause: Clause[] = [];
      for (const name in dep) {
        const versions = packageDependecyInfo.get(name);
        if (versions) {
          const targetVersions = Array.from(versions.keys()).filter(v => semver.satisfies(v.version, dep[name]));
          // ¬A_x ∨ (A_x AND ALO(D_1,D_2....D_x)) => (¬A_x ∨A_x) ∧ (ALO(D_1,D_2....D_x) ∨ ¬A_x) => (ALO(D_1,D_2....D_x) ∨ ¬A_x)
          const v = OR(ALO(targetVersions.map(v => packV(name, v))), NOT(pack));
          depClause.push(v);
          for (const version of targetVersions) {
            const ex = await this.depToLogicExpressionInRange(name, version, cache);
            if (ex === null) {
              // if depLogicExpression return null, solve the package's dependencies is impossible
              depClause.push({ kind: "Clause", v: [NOT(packV(name, version))] });
            } else {
              depClause = depClause.concat(ex);
            }
          }
        }
      }
      return depClause;
    } else {
      return [];
    }
  }

  // 依存関係の中での最新版を取得する
  private async depToLogicExpressionInLatest(
    name: string,
    version: SemVer,
    cache: string[],
    dependencies: Dependencies | undefined
  ): Promise<Clause[] | null> {
    if (!cache.includes(vName(name, version))) {
      cache.push(vName(name, version));
      if (this.clauseCache[vName(name, version)]) return this.clauseCache[vName(name, version)];
      const pack = packV(name, version);
      const dep =
        dependencies ||
        (await this.packageRepository
          .getDependencies(name)
          .then(v => v.get(Array.from(v.keys()).filter(v => semver.eq(v, version))[0])));
      if (!dep) throw new Error("not found");
      const dependecyNames = Array.from(Object.keys(dep));
      return this.packageRepository.getMultiDependencies(dependecyNames).then(async v => {
        const depClause: Clause[] = [];
        const promisies: Promise<Clause[] | null>[] = [];
        const vNameList: string[] = [];
        dependecyNames.forEach(packName => {
          const versions = v.get(packName);
          if (!versions) throw new Error("error: can't get dependencies");
          const targetVersion = this.getValidLatestVersion(dep[packName], Array.from(versions.keys()));
          if (!targetVersion) throw new Error("error: can't get dependencies");
          depClause.push(OR(packV(packName, targetVersion), NOT(pack)));
          promisies.push(
            this.depToLogicExpressionInLatest(packName, targetVersion, cache, versions.get(targetVersion))
          );
          vNameList.push(vName(packName, targetVersion));
        });
        const d = await Promise.all(promisies);
        const x = d.filter(notNull);
        if (x.length > d.length) return null;
        vNameList.forEach((v, i) => (this.clauseCache[v] = x[i]));
        return x.reduce((v, z) => v.concat(z), []).concat(depClause);
      });
    } else {
      return [];
    }
  }

  private async depentsToLogicalExpression(
    name: string,
    lowest: SemVer,
    method: "range" | "latest" = "latest"
  ): Promise<Clause[]> {
    const targets = (await this.packageRepository.getVersions(name)).filter(v => semver.gte(v, lowest));
    const vs = targets.map(v => packV(name, v));
    let eArray: Clause[] = [...AMO(vs), ALO(vs)];
    const bar = new progress.default(`get ${name} dependencies :current/:total`, targets.length);
    for (const version of targets) {
      bar.tick();
      const clauses =
        method === "latest"
          ? await this.depToLogicExpressionInLatest(name, version, [], undefined)
          : await this.depToLogicExpressionInRange(name, version, []);
      if (clauses === null) {
        // if depLogicExpression return null, solve the package's dependencies is impossible
        eArray.push({ kind: "Clause", v: [NOT(packV(name, version))] });
      } else {
        eArray = eArray.concat(clauses);
      }
    }
    return eArray;
  }

  private async createLogicalExpresison(
    conflictCauses: Package[],
    targetPackages: string[],
    solveOption: { searchInRange: boolean }
  ): Promise<CNF> {
    /// targetPackageのすべてのバージョンについての論理式を作成
    let tExpression: Clause[] = [];
    for (const t of targetPackages) {
      const versions = await this.packageRepository.getVersions(t);
      tExpression = tExpression.concat(AMO(versions.map(v => packV(t, v))));
    }
    const already: string[] = [];
    /// conflictCauseへのやつを作る
    for (const cause of conflictCauses) {
      if (already.includes(cause.name)) continue;
      already.push(cause.name);
      tExpression = tExpression.concat(
        await this.depentsToLogicalExpression(cause.name, cause.version, solveOption.searchInRange ? "range" : "latest")
      );
    }
    return { kind: "CNF", v: tExpression };
  }

  public async solveConflict(
    conflictCausePackages: Package[],
    targetPackage: string[],
    solveOption: { searchInRange: boolean }
  ): Promise<NoConflictSituation[]> {
    const cnf = await this.createLogicalExpresison(conflictCausePackages, targetPackage, solveOption);
    const result = solveCNF(cnf);
    if (result.kind === "SAT") {
      const packs = result.v.filter(v => v.v).map(v => vNameToPackage(v.name));
      const target = packs.filter(p => targetPackage.includes(p.name));
      const upgradeTarget = conflictCausePackages.map(d => ({
        before: d,
        after: packs.filter(v => v.name === d.name)[0]
      }));
      return [{ updateTargets: upgradeTarget, targetPackages: target }];
    } else {
      return [];
    }
  }
}
