import { Clause, Variable, OR, NOT, ALO, AMO, CNF } from "./logic_expression";
import { ConflictPackage } from "../type";
import { NpmPackageRepository } from "../npm/npm_package_repository";
import semver, { SemVer } from "semver";

const vName = (name: string, version: SemVer): string => `${name}@${version.version}`;

const packV = (name: string, version: SemVer): Variable => ({
  kind: "Variable",
  v: vName(name, version)
});

const packageRepository = new NpmPackageRepository();
const cache: string[] = [];

const depToLogicExpression = async (name: string, version: SemVer): Promise<Clause[]> => {
  if (!cache.includes(vName(name, version))) {
    cache.push(vName(name, version));
    const pack = packV(name, version);
    const v = await packageRepository.getDependencies(name);
    const dep = v.get(Array.from(v.keys()).filter(v => semver.eq(v, version))[0]);
    if (!dep) throw new Error("aaa");
    const dependecyNames = Array.from(Object.keys(dep));
    const packageDependecyInfo = await packageRepository.getMultiDependencies(dependecyNames);
    let depClause: Clause[] = [];
    for (const name in dep) {
      const versions = packageDependecyInfo.get(name);
      if (versions) {
        const targetVersion = Array.from(versions.keys()).filter(v => semver.satisfies(v.version, dep[name]));
        // ¬A_x ∨ (A_x AND ALO(D_1,D_2....D_x)) => (¬A_x ∨A_x) ∧ (ALO(D_1,D_2....D_x) ∨ ¬A_x) => (ALO(D_1,D_2....D_x) ∨ ¬A_x)
        const v = OR(ALO(targetVersion.map(v => packV(name, v))), NOT(pack));
        depClause.push(v);
        for (const x of targetVersion) {
          const ex = await depToLogicExpression(name, x);
          depClause = depClause.concat(ex);
        }
      }
    }
    return depClause;
  } else {
    return [];
  }
};

const depentsToLogicalExpression = async (name: string, lowest: SemVer): Promise<Clause[]> => {
  const target = (await packageRepository.getVersions(name)).filter(v => semver.gte(v, lowest));
  const vs = target.map(v => packV(name, v));
  let eArray: Clause[] = [...AMO(vs), ALO(vs)];
  for (const x of target) {
    eArray = eArray.concat(await depToLogicExpression(name, x));
  }
  return eArray;
};

export const createLogicalExpresison = async (
  conflictCauses: ConflictPackage,
  targetPackages: string[]
): Promise<CNF> => {
  /// targetPackageのすべてのバージョンについての論理式を作成
  let tExpression: Clause[] = [];
  for (const t of targetPackages) {
    const versions = await packageRepository.getVersions(t);
    tExpression = tExpression.concat(AMO(versions.map(v => packV(t, v))));
  }
  /// conflictCauseへのやつを作る
  for (const v of conflictCauses.versions) {
    const cause = v.depenedecyRoot[0];
    tExpression = tExpression.concat(await depentsToLogicalExpression(cause.name, cause.version));
  }
  return { kind: "CNF", v: tExpression };
};

const createCNFFile = (cnf: CNF): string => {
  const variableCache: string[] = [];
  const x: string[] = [];
  cnf.v.forEach(v => {
    let text = "";
    v.v.forEach(x => {
      const prefix = x.kind === "Not" ? "-" : "";
      const name = x.kind === "Not" ? x.v.v : x.v;
      if (variableCache.indexOf(name) === -1) {
        const num = variableCache.push(name);
        text += `${prefix}${num} `;
      } else {
        text += `${prefix}${variableCache.indexOf(name) + 1} `;
      }
    });
    x.push(text + "0");
  });
  const result = `
p cnf ${variableCache.length} ${cnf.v.length}
${x.join("\n")}`;
  console.log(result);
  return result;
};

export const createCNF = async (conflictCauses: ConflictPackage, targetPackages: string[]): Promise<string> => {
  const cnf = await createLogicalExpresison(conflictCauses, targetPackages);
  return createCNFFile(cnf);
};
