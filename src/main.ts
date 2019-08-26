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
  DependencyRootInfo,
  PackageDepndecyList
} from "./type";
import packageJson = require("package-json");
import { readFileSync } from "fs";
import { getPackageDependencies } from "./get_package_info";
/**
 * Jsonファイルを読み込んでparseする
 * @param path パス
 */
const getJsondata = (path: string): any => {
  return JSON.parse(readFileSync(path).toString());
};

const getLogicTree = (): LogicalTree => {
  return logicTree(getJsondata("package.json"), getJsondata("package-lock.json")) as LogicalTree;
};

/**
 * 依存関係から必要なものだけを取り出す（dev onlyとかはいらないので）
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

/**
 * 依存関係から依存関係の衝突を探す
 * @param dependencis 依存関係
 */
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
    // すべてのバージョンが同じバージョンであれば無視
    const firstVersion = deps[i][0].version;
    if (deps[i].every(v => v.version === firstVersion)) {
      delete deps[i];
    }
  }
  return deps;
};

/**
 * 依存関係の衝突から解決出来る依存関係の衝突を選ぶ
 * @param conflictinfo 依存関係の衝突に関する情報
 */
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

// 条件式とバージョンの配列からその条件式に当てはまる最新のバージョンを取得する
const getValidLatestVersion = (condition: string, versions: semver.SemVer[]): semver.SemVer => {
  return versions.filter(v => semver.satisfies(v.version, condition)).sort((a, b) => (semver.gt(a, b) ? -1 : 1))[0];
};

/**
 * あるパッケージの名前とバージョンからそのパッケージが必要とするパッケージの配列(自分を含める)を返す
 * @param name パッケージ名
 * @param version バージョン番号
 */
const getDependecies = async (name: string, version: semver.SemVer): Promise<PackageDepndecyList> => {
  const dependecyList: SimplePackageInfo[] = [];
  const addDependency = async (
    packageInfo: SimplePackageInfo,
    dependecy: Map<semver.SemVer, Dependencies>
  ): Promise<void> => {
    dependecyList.push(packageInfo);
    // 当てはまるバージョンの依存関係を取得する
    const verisonDependecy = dependecy.get(
      Array.from(dependecy.keys()).filter(v => v.version === packageInfo.version)[0]
    );
    if (verisonDependecy) {
      const dependecyNames = Array.from(Object.keys(verisonDependecy));
      const packageDependecyInfo = await getPackageDependencies(dependecyNames);
      for (let name in verisonDependecy) {
        const versions = packageDependecyInfo.get(name);
        if (versions) {
          const targetVersion = getValidLatestVersion(verisonDependecy[name], Array.from(versions.keys()));
          await addDependency({ name: name, version: targetVersion.version }, versions);
        }
      }
    }
  };
  const packageDependecy = (await getPackageDependencies([name])).get(name);
  if (packageDependecy) {
    await addDependency({ name: name, version: version.version }, packageDependecy);
  }
  return {
    package: { name: name, version: version.version },
    depndecies: dependecyList
  };
};

/**
 * 依存関係の衝突が解決出来るバージョンの組み合わせを探索する
 * @see https://scrapbox.io/sh4869/%E3%83%91%E3%83%83%E3%82%B1%E3%83%BC%E3%82%B8%E3%81%AE%E4%BE%9D%E5%AD%98%E9%96%A2%E4%BF%82%E3%81%AE%E8%A1%9D%E7%AA%81%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6
 *
 * @param name 依存関係が衝突しているパッケージ
 * @param dependencyRootInfo パッケージがどのような流れで必要とされているかを表示する
 * @param allowDowngrade バージョンを下げて解決することを許すかどうか
 */
const searchNonConfilictVersion = async (
  name: string,
  dependencyRootInfo: DependencyRootInfo[],
  allowDowngrade: boolean = false
) => {
  let conflictCausesVersions: { [name: string]: Map<semver.SemVer, PackageDepndecyList> } = {};
  for (let x in dependencyRootInfo) {
    // チェックするべきバージョンと
    const versionDependecyMap = new Map<semver.SemVer, PackageDepndecyList>();
    // 確認するパッケージ
    // プロジェクトから直接参照されている場合，パッケージそのもの．そうでない場合，ルートのパッケージを確認．
    const checkPackage =
      dependencyRootInfo[x].bigParent.name === "#ROOT"
        ? { name: dependencyRootInfo[x].name, version: dependencyRootInfo[x].version }
        : dependencyRootInfo[x].bigParent;
    const currentVersion = semver.parse(checkPackage.version);
    const packageVersions = (await getPackageDependencies([checkPackage.name])).get(checkPackage.name);
    if (!packageVersions || !currentVersion) {
      throw new Error("Package info does not found");
    }
    // 現在のバージョンの依存関係グラフを取得する
    const currentVersionDepndecyList = await getDependecies(checkPackage.name, currentVersion);
    versionDependecyMap.set(currentVersion, currentVersionDepndecyList);
    const toCheckVersion = allowDowngrade
      ? Array.from(packageVersions.keys())
      : Array.from(packageVersions.keys()).filter(v => semver.gt(v, currentVersion));
    // バージョンが上げられる場合にどういう依存関係のグラフを辿るかを保存する
    for (let v of toCheckVersion) {
      const depndecyList = await getDependecies(checkPackage.name, v);
      versionDependecyMap.set(v, depndecyList);
    }
    conflictCausesVersions[checkPackage.name] = versionDependecyMap;
  }
  // conflictCausesVersionsからそれぞれ全部の組み合わせを試す
};

const solvableConfilts = getSolvableConflicts(getConfilct(getRealLogicalTree(getLogicTree())));

// console.log(solvableConfilts);
//console.log(util.inspect(solvableConfilts, false, null));

for (let x in solvableConfilts) {
  searchNonConfilictVersion(x, solvableConfilts[x]);
}

//console.log(util.inspect(getSolvableConflicts(getConfilct(getRealLogicalTree(getLogicTree()))), false, null));
