import pkginfo = require("npm-registry-package-info");
import readJson = require("read-package-json");
import logicTree = require("npm-logical-tree");

import util = require("util");
import semver, { SemVer } from "semver";
import {
  PkgDataInfo,
  PackageDependenciesInfo,
  Dependencies,
  LogicalTree,
  SimplePackageInfo,
  ConflictInfo,
  DependencyRootInfo
} from "./type";
import packagejson from "package-json";
import packageJson = require("package-json");
import { readFileSync } from "fs";
import { createHash } from "crypto";

// npm-registory-package-infoを使ってPkgDataInfoを取得する
const getPackageInfo = async (opts: pkginfo.Options) => {
  const pkginfoPromise = util.promisify(pkginfo);
  const result = await pkginfoPromise(opts);
  return result.data as PkgDataInfo;
};

/**
 * 与えられたパッケージの依存関係を返す
 * TODO: キャッシュを残す
 * @param packages パッケージ名の配列
 */
const getPackageDependencies = async (packages: string[]): Promise<Map<string, PackageDependenciesInfo>> => {
  const pkgdatainfo = await getPackageInfo({ packages: packages });
  const map = new Map<string, PackageDependenciesInfo>();
  for (let name in pkgdatainfo) {
    const xmap = new Map<SemVer, Dependencies>();
    for (let ver in pkgdatainfo[name].versions) {
      const version = semver.parse(ver);
      if (version) {
        xmap.set(version, pkgdatainfo[name].versions[ver].dependencies || {});
      } else {
        throw new Error(`Semantic Version Parse Error: ${name} - ${ver}`);
      }
    }
    map.set(name, xmap);
  }
  return map;
};

const getJsondata = (path: string): any => {
  const result = readFileSync(path).toString();
  return JSON.parse(result);
};

const getLogicTree = () => {
  return logicTree(getJsondata("package.json"), getJsondata("package-lock.json")) as LogicalTree;
};

/**
 * 依存関係のtreeを取り除く
 * @param logicalTree 依存関係のtree
 */
const getRealLogicalTree = (logicalTree: LogicalTree): Map<string, LogicalTree> => {
  const depens = logicalTree.dependencies;
  // optional と devなdependenciesを除く
  const realDep = new Map<string, LogicalTree>();
  depens.forEach((target, x) => {
    if (target && (!target.dev && !target.optional && !target.bundled)) {
      realDep.set(x, target);
    }
  });
  return realDep;
};

const getConfilct = (dependencis: Map<string, LogicalTree>): ConflictInfo => {
  let deps: ConflictInfo = {};
  let check = new Set<string>();
  const addVersion = (logicalTree: LogicalTree, parentArray: SimplePackageInfo[], bigParent: SimplePackageInfo) => {
    const key =
      Buffer.from(logicalTree.name, "utf-8").toString("base64") +
      Buffer.from(logicalTree.version, "utf-8").toString("base64");
    if (!check.has(key)) {
      check.add(key);
      if (!deps[logicalTree.name]) {
        deps[logicalTree.name] = [{ name: logicalTree.name, version: logicalTree.version, parentArray, bigParent }];
      } else {
        deps[logicalTree.name].push({ name: logicalTree.name, version: logicalTree.version, parentArray, bigParent });
      }
      parentArray.push({ name: logicalTree.name, version: logicalTree.version });
      logicalTree.dependencies.forEach(v => {
        const newBigParent =
          bigParent.name === "#ROOT" ? { name: logicalTree.name, version: logicalTree.version } : bigParent;
        addVersion(v, parentArray, newBigParent);
      });
    }
  };
  dependencis.forEach(v => addVersion(v, [], { name: "#ROOT", version: "" }));
  for (let i in deps) {
    if (deps[i].length == 1) {
      delete deps[i];
      continue;
    }
    const firstVersion = deps[i][0].version;
    if (deps[i].every(v => v.version === firstVersion)) {
      delete deps[i];
    }
  }
  return deps;
};

const getSolvableConflicts = (conflictinfo: ConflictInfo): ConflictInfo => {
  const solvableConfilts = {};
  for (let x in conflictinfo) {
    const depends = conflictinfo[x];
    // 依存の衝突の大元が同じパッケージの場合ユーザーには解決出来ない
    const bigParents = depends.map(d => d.bigParent.name);
    const uniqueBigParents = bigParents.filter((e, i, s) => s.indexOf(e) === i);
    if (bigParents.length === uniqueBigParents.length) {
      solvableConfilts[x] = conflictinfo[x];
    }
  }
  return solvableConfilts;
};

const searchNonConfilictVersion = async (
  name: string,
  dependencyRootInfo: DependencyRootInfo[],
  allowDowngrade: boolean = false
) => {
  let result = false;
  for (let x in dependencyRootInfo) {
    // プロジェクトから直接参照されている場合はそのパッケージのバージョンの候補を探す
    // プロジェクト以外から参照されている場合はそのパッケージの一番親のパッケージのバージョンの候補を探す
    const requiredpackage =
      dependencyRootInfo[x].bigParent.name === "#ROOT"
        ? { name: dependencyRootInfo[x].name, version: dependencyRootInfo[x].version }
        : dependencyRootInfo[x].bigParent;
    const packageVersions = (await getPackageDependencies([requiredpackage.name])).get(requiredpackage.name);
    const currentVersion = semver.parse(requiredpackage.version);
    if (!packageVersions || !currentVersion) {
      throw new Error("Package info does not found");
    }
    const toCheckVersion = allowDowngrade
      ? Array.from(packageVersions.keys())
      : Array.from(packageVersions.keys()).filter(v => semver.gt(v, currentVersion));
    if (toCheckVersion.length === 0) {
      continue;
    }
    toCheckVersion.forEach(v => {
      const dependencyInfo = packageVersions.get(v);
      if (dependencyInfo !== undefined) {
        dependencyInfo;
      }
    });
  }
  console.log(result);
};

const solvableConfilts = getSolvableConflicts(getConfilct(getRealLogicalTree(getLogicTree())));

// console.log(solvableConfilts);
//console.log(util.inspect(solvableConfilts, false, null));

for (let x in solvableConfilts) {
  searchNonConfilictVersion(x, solvableConfilts[x]);
}

//console.log(util.inspect(getSolvableConflicts(getConfilct(getRealLogicalTree(getLogicTree()))), false, null));
