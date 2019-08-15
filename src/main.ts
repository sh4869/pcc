import pkginfo = require("npm-registry-package-info");
import readJson = require("read-package-json");
import logicTree = require("npm-logical-tree");

import util = require("util");
import semver, { SemVer } from "semver";
import { PkgDataInfo, PackageDependenciesInfo, Dependencies } from "./type";
import packagejson from "package-json";
import packageJson = require("package-json");

// npm-registory-package-infoを使ってPkgDataInfoを取得する
const getPackageInfo = async (opts: pkginfo.Options) => {
  const pkginfoPromise = util.promisify(pkginfo);
  const result = await pkginfoPromise(opts);
  return result.data as PkgDataInfo;
};

/**
 * 与えられたパッケージの依存関係を返す
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

const getPackageJsonInfo = async (path: string): Promise<packageJson.FullVersion> => {
  const readJosnPromise = util.promisify(readJson);
  return (await readJosnPromise(path)) as packagejson.FullVersion;
};

getPackageJsonInfo("package.json").then(v => console.log(v));

//getPackageDependencies(["npm-api"]).then(v => console.log(v));
