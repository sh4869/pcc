import pkginfo = require("npm-registry-package-info");

import util = require("util");
import semver, { SemVer } from "semver";
import { PackageDependenciesInfo, Dependencies } from "../type";

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
  private verCache: { [key: string]: Map<SemVer, Dependencies> };
  constructor() {
    this.cache = {};
    this.verCache = {};
  }

  private async fetchPackageInfo(opts: pkginfo.Options): Promise<PkgDataInfo> {
    const newOpts = {
      packages: opts.packages.filter(v => !Object.keys(this.cache).includes(v))
    };
    if (newOpts.packages.length > 0) {
      try {
        const pkginfoPromise = util.promisify(pkginfo);
        const newData = (await pkginfoPromise(newOpts)).data as PkgDataInfo;
        // save in cache
        for (const i in newData) {
          this.cache[i] = newData[i];
        }
      } catch {
        // retry
        await sleep(300);
        return this.fetchPackageInfo(opts);
      }
    }
    return this.cache;
  }

  public async getVersions(name: string): Promise<Array<SemVer>> {
    const pkdata = await this.fetchPackageInfo({ packages: [name] });
    const d = pkdata[name];
    return Object.keys(d.versions).map(v => new SemVer(v));
  }

  public async getMultiDependencies(names: string[]): Promise<Map<string, PackageDependenciesInfo>> {
    const pkgdatainfo = await this.fetchPackageInfo({ packages: names });
    const map = new Map<string, PackageDependenciesInfo>();
    for (const name of names) {
      if (this.verCache[name]) {
        map.set(name, this.verCache[name]);
      } else {
        const xmap = new Map<SemVer, Dependencies>();
        if (pkgdatainfo[name] === undefined) throw new Error("not found in npm registory");
        for (const ver in pkgdatainfo[name].versions) {
          const version = semver.parse(ver);
          if (version) {
            const deps = pkgdatainfo[name].versions[ver].dependencies;
            xmap.set(version, deps || {});
          } else {
            throw new Error(`Semantic Version Parse Error: ${name} - ${ver}`);
          }
        }
        map.set(name, xmap);
        this.verCache[name] = xmap;
      }
    }
    return map;
  }

  public async getDependencies(name: string): Promise<PackageDependenciesInfo> {
    if (this.verCache[name]) {
      return this.verCache[name];
    } else {
      const pkgdatainfo = (await this.fetchPackageInfo({ packages: [name] }))[name];
      const xmap = new Map<SemVer, Dependencies>();
      for (const ver in pkgdatainfo.versions) {
        const version = semver.parse(ver);
        if (version) {
          xmap.set(version, pkgdatainfo.versions[ver].dependencies || {});
        } else {
          throw new Error(`Semantic Version Parse Error: ${name} - ${ver}`);
        }
      }
      return xmap;
    }
  }
}
