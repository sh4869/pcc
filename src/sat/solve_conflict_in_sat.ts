import { Clause, Variable, OR, NOT, ALO, AMO, CNF } from "./cnf";
import { ConflictPackage, ConflictSolver, Package, NoConflictSituation, PackageDependenciesInfo } from "../type";
import { NpmPackageRepository } from "../npm/npm_package_repository";
import semver, { SemVer } from "semver";
import { solveCNF } from "./minisolver";
import { PackageRepository } from "../npm/package_repository";

const vName = (name: string, version: SemVer): string => `${name}#${version.version}`;

const packV = (name: string, version: SemVer): Variable => ({
  kind: "Variable",
  v: vName(name, version)
});

const vNameToPackage = (vName: string): Package => {
  const t = vName.split("#");
  return { name: t[0], version: new SemVer(t[1]) };
};

export class SatConflictSolver implements ConflictSolver {
  private packageRepository: PackageRepository;
  constructor() {
    this.packageRepository = new NpmPackageRepository();
  }

  // これは範囲内すべてを探索するやつ
  private async depToLogicExpressionInRange(name: string, version: SemVer, cache: string[]): Promise<Clause[] | null> {
    if (!cache.includes(vName(name, version))) {
      cache.push(vName(name, version));
      const pack = packV(name, version);
      const v = await this.packageRepository.getDependencies(name);
      const dep = v.get(Array.from(v.keys()).filter(v => semver.eq(v, version))[0]);
      if (!dep) throw new Error("cant get dep");
      const dependecyNames = Array.from(Object.keys(dep));
      const packageDependecyInfo = await this.packageRepository.getMultiDependencies(dependecyNames).catch(_ => null);
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
  private async depToLogicExpressionInLatest(name: string, version: SemVer, cache: string[]): Promise<Clause[]> {
    if (!cache.includes(vName(name, version))) {
      cache.push(vName(name, version));
      const pack = packV(name, version);
      const v = await this.packageRepository.getDependencies(name);
      const dep = v.get(Array.from(v.keys()).filter(v => semver.eq(v, version))[0]);
      if (!dep) throw new Error("cant get dep");
      const dependecyNames = Array.from(Object.keys(dep));
      const packageDependecyInfo = await this.packageRepository.getMultiDependencies(dependecyNames).catch(v => {
        throw new Error("Cant solve dependencies");
      });
      let depClause: Clause[] = [];
      for (const name in dep) {
        const versions = packageDependecyInfo.get(name);
        if (versions) {
          const targetVersion = Array.from(versions.keys())
            .filter(v => semver.satisfies(v.version, dep[name]))
            .sort((a, b) => (semver.gt(a, b) ? -1 : 1))[0];
          const v = OR(packV(name, targetVersion), NOT(pack));
          depClause.push(v);
          const ex = await this.depToLogicExpressionInLatest(name, targetVersion, cache);
          depClause = depClause.concat(ex);
        }
      }
      return depClause;
    } else {
      return [];
    }
  }

  private async depentsToLogicalExpression(
    name: string,
    lowest: SemVer,
    method: "range" | "latest" = "latest"
  ): Promise<Clause[]> {
    const target = (await this.packageRepository.getVersions(name)).filter(v => semver.gte(v, lowest));
    const vs = target.map(v => packV(name, v));
    let eArray: Clause[] = [...AMO(vs), ALO(vs)];
    for (const version of target) {
      const clause =
        method === "latest"
          ? await this.depToLogicExpressionInLatest(name, version, [])
          : await this.depToLogicExpressionInRange(name, version, []);
      if (clause === null) {
        // if depLogicExpression return null, solve the package's dependencies is impossible
        eArray.push({ kind: "Clause", v: [NOT(packV(name, version))] });
      } else {
        eArray = eArray.concat(clause);
      }
    }
    return eArray;
  }

  private async createLogicalExpresison(conflictCauses: ConflictPackage, targetPackages: string[]): Promise<CNF> {
    /// targetPackageのすべてのバージョンについての論理式を作成
    let tExpression: Clause[] = [];
    for (const t of targetPackages) {
      const versions = await this.packageRepository.getVersions(t);
      tExpression = tExpression.concat(AMO(versions.map(v => packV(t, v))));
    }
    const already: string[] = [];
    /// conflictCauseへのやつを作る
    for (const v of conflictCauses.versions) {
      const cause = v.depenedecyRoot[0];
      if (already.includes(cause.name)) continue;
      already.push(cause.name);
      tExpression = tExpression.concat(await this.depentsToLogicalExpression(cause.name, cause.version));
    }
    return { kind: "CNF", v: tExpression };
  }

  public async solveConflict(conflict: ConflictPackage): Promise<NoConflictSituation[]> {
    const cnf = await this.createLogicalExpresison(conflict, [conflict.packageName]);
    const result = solveCNF(cnf);
    if (result.kind === "SAT") {
      const packs = result.v.filter(v => v.v).map(v => vNameToPackage(v.name));
      const target = packs.filter(p => p.name === conflict.packageName)[0];
      const upgradeTarget = conflict.versions
        .map(v => v.depenedecyRoot[0])
        .map(d => ({ before: d, after: packs.filter(v => v.name === d.name)[0] }));
      return [{ updateTargets: upgradeTarget, finalVersion: target.version, targetPackage: target.name }];
    } else {
      return [];
    }
  }
}
