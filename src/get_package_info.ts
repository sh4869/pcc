import pkginfo = require("npm-registry-package-info");

import util = require("util");
import semver, { SemVer } from "semver";
import { PackageDependenciesInfo, Dependencies } from "./type";

import packagejson = require("package-json");
import { PackageRepository } from "./package_repository";

interface PkgData {
  versions: { [key: string]: packagejson.AbbreviatedVersion };
}
/* eslint-disable @typescript-eslint/explicit-function-return-type */
const sleep: (number: number) => Promise<void> = msec => new Promise<void>(resolve => setTimeout(resolve, msec));
/* eslint-enable @typescript-eslint/explicit-function-return-type */

type PkgDataInfo = { [key: string]: PkgData };

/**
 * Npm PackageRepository Implements
 */
export class NpmPackageRepository implements PackageRepository {
  private cache: PkgDataInfo;
  constructor() {
    this.cache = {};
  }

  private async fetchPackageInfo(opts: pkginfo.Options): Promise<PkgDataInfo> {
    const newOpts = {
      packages: opts.packages.filter(v => !Object.keys(this.cache).includes(v))
    };
    if (newOpts.packages.length > 0) {
      try {
        const pkginfoPromise = util.promisify(pkginfo);
        const newData = (await pkginfoPromise(newOpts)).data as PkgDataInfo;
        // キャッシュを保存
        for (const i in newData) {
          this.cache[i] = newData[i];
        }
      } catch {
        // 1秒待ってからやり直す
        await sleep(1000);
        return this.fetchPackageInfo(opts);
      }
    }
    const result = {};
    // キャッシュからデータを取り出し
    // 非効率的だけど大した数にはならないので
    opts.packages.forEach(v => {
      result[v] = this.cache[v];
    });
    return result as PkgDataInfo;
  }

  public async get(names: string[]): Promise<Map<string, PackageDependenciesInfo>> {
    const pkgdatainfo = await this.fetchPackageInfo({ packages: names });
    const map = new Map<string, PackageDependenciesInfo>();
    for (const name in pkgdatainfo) {
      const xmap = new Map<SemVer, Dependencies>();
      for (const ver in pkgdatainfo[name].versions) {
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
  }
}
