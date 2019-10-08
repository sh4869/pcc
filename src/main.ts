import { uniq } from "underscore";
import semver, { SemVer } from "semver";
import {
  Dependencies,
  LogicalTree,
  SimplePackageInfo,
  ConflictInfo,
  DependencyRootInfo,
  PackageDepndecyList
} from "./type";
import { getPackageDependencies } from "./get_package_info";
import { getLogicTree } from "./logic_tree";

/**
 * 依存関係から依存関係の衝突を探す
 * @param dependencis 依存関係
 */
const getConfilct = (dependencis: Map<string, LogicalTree>): ConflictInfo => {
  const deps: ConflictInfo = {};
  const check = new Set<string>();
  const addVersion = (
    logicalTree: LogicalTree,
    parentArray: SimplePackageInfo[],
    bigParent: SimplePackageInfo
  ): void => {
    const key =
      Buffer.from(logicalTree.name, "utf-8").toString("base64") +
      Buffer.from(logicalTree.version, "utf-8").toString("base64");
    if (!check.has(key)) {
      check.add(key);
      const dep = {
        name: logicalTree.name,
        version: logicalTree.version,
        parentArray,
        bigParent
      };
      if (!deps[logicalTree.name]) {
        deps[logicalTree.name] = [dep];
      } else {
        deps[logicalTree.name].push(dep);
      }
      parentArray.push({
        name: logicalTree.name,
        version: logicalTree.version
      });
      logicalTree.dependencies.forEach(v => {
        const newBigParent =
          bigParent.name === "#ROOT" ? { name: logicalTree.name, version: logicalTree.version } : bigParent;
        addVersion(v, parentArray, newBigParent);
      });
    }
  };
  dependencis.forEach(v => addVersion(v, [], { name: "#ROOT", version: "" }));
  // すべてのバージョンが同じバージョンであれば無視
  for (const i in deps) {
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
  for (const x in conflictinfo) {
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
  const dependecyList: Set<SimplePackageInfo> = new Set();
  const dependecyMap: Map<string, SimplePackageInfo> = new Map();
  const addDependency = async (
    packageInfo: SimplePackageInfo,
    dependecy: Map<semver.SemVer, Dependencies>
  ): Promise<void> => {
    if (!dependecyMap.has(JSON.stringify(packageInfo))) {
      dependecyMap.set(JSON.stringify(packageInfo), packageInfo);
      dependecyList.add(packageInfo);
      // 当てはまるバージョンの依存関係を取得する
      const version = semver.parse(packageInfo.version);
      if (!version) return;
      const verisonDependecy = dependecy.get(version);
      if (verisonDependecy) {
        const dependecyNames = Array.from(Object.keys(verisonDependecy));
        const packageDependecyInfo = await getPackageDependencies(dependecyNames);
        for (const name in verisonDependecy) {
          const versions = packageDependecyInfo.get(name);
          if (versions) {
            const targetVersion = getValidLatestVersion(verisonDependecy[name], Array.from(versions.keys()));
            await addDependency({ name: name, version: targetVersion.version }, versions);
          }
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

const isSolvedConfilicts = (target: string, gathering: PackageDepndecyList[]): boolean => {
  const packages: { [name: string]: Array<string> } = {};
  gathering.forEach(v =>
    Array.from(v.depndecies.values()).forEach(d => {
      if (packages[d.name]) {
        packages[d.name].push(d.version);
      } else {
        packages[d.name] = [d.version];
      }
    })
  );
  for (const x in packages) {
    packages[x] = uniq(packages[x]);
  }
  if (packages[target].length == 1) {
    return true;
  } else {
    return false;
  }
};

/**
 * 依存関係の衝突が解決出来るバージョンの組み合わせを探索する
 * @see https://scrapbox.io/sh4869/%E3%83%91%E3%83%83%E3%82%B1%E3%83%BC%E3%82%B8%E3%81%AE%E4%BE%9D%E5%AD%98%E9%96%A2%E4%BF%82%E3%81%AE%E8%A1%9D%E7%AA%81%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6
 *
 * @param name package name that conflicts in project
 * @param dependencyRootInfos package requiremnets root infos.
 * @param allowDowngrade allow donwgrade package
 */
const searchNonConfilictVersion = async (
  name: string,
  dependencyRootInfoList: DependencyRootInfo[],
  allowDowngrade = false
): Promise<void> => {
  const packageDepndencyMap: {
    [name: string]: Map<semver.SemVer, PackageDepndecyList>;
  } = {};
  // 衝突の原因になっているパッケージの上のバージョン（donwgradeが許されているならすべてのバージョン）の依存関係を取得する
  for (const x in dependencyRootInfoList) {
    // もしプロジェクトから直接依存されているパッケージならそのパッケージ自体のバージョンのリストが
    // もし直接依存のパッケージの依存として取得されたパッケージならその大本のパッケージのバージョンのリストが必要になるので
    const targetPackage =
      dependencyRootInfoList[x].bigParent.name === "#ROOT"
        ? {
            name: dependencyRootInfoList[x].name,
            version: dependencyRootInfoList[x].version
          }
        : dependencyRootInfoList[x].bigParent;

    const currentVersion = semver.parse(targetPackage.version);
    if (!currentVersion) throw new Error("Package info does not found");
    const packageVersions = (await getPackageDependencies([targetPackage.name])).get(targetPackage.name);
    if (!packageVersions) throw new Error("failed get package version info");

    const checkVersions = allowDowngrade
      ? Array.from(packageVersions.keys())
      : Array.from(packageVersions.keys()).filter(v => semver.gte(v, currentVersion));
    const versionDependecyMap = new Map<semver.SemVer, PackageDepndecyList>();
    for (const v of checkVersions) {
      const depndecyList = await getDependecies(targetPackage.name, v);
      versionDependecyMap.set(v, depndecyList);
    }
    packageDepndencyMap[targetPackage.name] = versionDependecyMap;
  }

  const conflictCauseNames: Array<string> = Array.from(Object.keys(packageDepndencyMap));
  const checkVersion = (
    potentiality: { [name: string]: Map<semver.SemVer, PackageDepndecyList> },
    dependencyListArray: PackageDepndecyList[]
  ): void => {
    // すべての衝突の原因のパッケージが入っていればどうにかなる
    if (dependencyListArray.length === conflictCauseNames.length) {
      isSolvedConfilicts(name, dependencyListArray);
      // 総当りをするために再帰する
    } else {
      const t = potentiality[conflictCauseNames[dependencyListArray.length]];
      Array.from(t.values()).forEach(v => {
        checkVersion(potentiality, [...dependencyListArray, v]);
      });
    }
  };
  checkVersion(packageDepndencyMap, []);
};

/* eslint-disable */
(async () => {
  const solvableConfilts = getSolvableConflicts(getConfilct(getLogicTree(process.argv[2] || "")));
  for (const x in solvableConfilts) {
    await searchNonConfilictVersion(x, solvableConfilts[x]);
  }
})();
/* eslint-enable */
