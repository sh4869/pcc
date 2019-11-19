import { Expression, OR, AND, AMO, ALO, NOT, EMPTY, And, Or, Variable, Not } from "./logic_expression";
import { ConflictPackage } from "../type";
import { NpmPackageRepository } from "../npm/npm_package_repository";
import semver, { SemVer } from "semver";

const vName = (name: string, version: SemVer): string => `${name}@${version.version}`;

const packV = (name: string, version: SemVer): Expression => ({
  kind: "Variable",
  v: vName(name, version)
});

const packageRepository = new NpmPackageRepository();
const cache: string[] = [];
const depToLogicExpression = async (name: string, version: SemVer): Promise<Expression> => {
  if (!cache.includes(vName(name, version))) {
    cache.push(vName(name, version));
    const pack = packV(name, version);
    const v = await packageRepository.getDependencies(name);
    const dep = v.get(Array.from(v.keys()).filter(v => semver.eq(v, version))[0]);
    if (!dep) throw new Error("aaa");
    const dependecyNames = Array.from(Object.keys(dep));
    const packageDependecyInfo = await packageRepository.getMultiDependencies(dependecyNames);
    const depExpression: Expression[] = [];
    for (const name in dep) {
      const versions = packageDependecyInfo.get(name);
      if (versions) {
        const targetVersion = Array.from(versions.keys()).filter(v => semver.satisfies(v.version, dep[name]));
        // ¬A_x ∨ (A_x AND ALO(D_1,D_2....D_x))
        depExpression.push(OR(AND(ALO(targetVersion.map(v => packV(name, v))), pack), NOT(pack)));
        for (const x of targetVersion) {
          const ex = await depToLogicExpression(name, x);
          depExpression.push(ex);
        }
      }
    }
    return AND(...depExpression);
  } else {
    return EMPTY;
  }
};

const depentsToLogicalExpression = async (name: string, lowest: SemVer): Promise<Expression> => {
  const target = (await packageRepository.getVersions(name)).filter(v => semver.gte(v, lowest));
  const eArray: Expression[] = [];
  for (const x of target) {
    eArray.push(await depToLogicExpression(name, x));
  }
  return OR(...eArray);
};

const tseitinTransformation = (ex: Expression): Expression => {
  if (ex.kind === "Variable") {
    return ex;
  } else if (ex.kind === "And") {
    return { kind: "And", v: ex.v.map(v => tseitinTransformation(v)) };
  } else if (ex.kind === "Or") {
  }
  return ex;
};

export const createLogicalExpresison = async (
  conflictCauses: ConflictPackage,
  targetPackages: string[]
): Promise<Expression> => {
  /// targetPackageのすべてのバージョンについての論理式を作成
  const tExpression: Expression[] = [];
  for (const t of targetPackages) {
    const versions = await packageRepository.getVersions(t);
    tExpression.push(AMO(versions.map(v => packV(t, v))));
  }
  /// conflictCauseへのやつを作る
  for (const v of conflictCauses.versions) {
    const cause = v.depenedecyRoot[0];
    tExpression.push(await depentsToLogicalExpression(cause.name, cause.version));
  }
  return AND(...tExpression);
};
