import pkginfo = require("npm-registry-package-info");

import util = require("util");
import semver, { SemVer } from "semver";
import { PkgDataInfo, PackageDependenciesInfo, Dependencies, PkgData } from "./type";

// キャッシュを持つ
let cache: PkgDataInfo = {};

// npm-registory-package-infoを使ってPkgDataInfoを取得する
const getPackageInfo = async (opts: pkginfo.Options) => {
  const newOpts = { packages: opts.packages.filter(v => !Object.keys(cache).includes(v)) };
  if (newOpts.packages.length > 0) {
    const pkginfoPromise = util.promisify(pkginfo);
    const newData = (await pkginfoPromise(newOpts)).data as PkgDataInfo;
    // キャッシュを保存
    for (let i in newData) {
      cache[i] = newData[i];
    }
  }
  let result = {};
  // キャッシュからデータを取り出し
  // 非効率的だけど大した数にはならないので
  opts.packages.forEach(v => {
    result[v] = cache[v];
  });
  return result as PkgDataInfo;
};

/**
 * 与えられたパッケージの依存関係を返す
 * TODO: キャッシュを残す
 * @param packages パッケージ名の配列
 */
export const getPackageDependencies = async (packages: string[]): Promise<Map<string, PackageDependenciesInfo>> => {
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
