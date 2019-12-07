import { Package, Dependencies } from "../misc/type";
import { ConflictSolver, NoConflictSituation, PackageUpdateInfo } from "./conflict_solver";
import semver, { SemVer } from "semver";
import * as progress from "progress";
import { PackageRepository } from "../misc/npm/package_repository";

type PackageDepndecyList = {
  package: Package;
  depndecies: Array<Package>;
};

const getValidLatestVersion = (condition: string, versions: semver.SemVer[]): semver.SemVer => {
  return versions.filter(v => semver.satisfies(v.version, condition)).sort((a, b) => (semver.gt(a, b) ? -1 : 1))[0];
};

export class BruteforceConflictSolver implements ConflictSolver {
  private packageRepository: PackageRepository;
  private depCache: { [key: string]: Package[] };
  constructor(repository: PackageRepository) {
    this.packageRepository = repository;
    this.depCache = {};
  }

  private async getDependenciesS(
    pack: Package,
    cache: Map<string, Package>,
    dep: Dependencies | undefined
  ): Promise<Array<Package>> {
    if (!cache.has(JSON.stringify(pack))) {
      cache.set(JSON.stringify(pack), pack);
      if (this.depCache[JSON.stringify(pack)]) return this.depCache[JSON.stringify(pack)];
      if (dep) {
        const dependecyNames = Array.from(Object.keys(dep));
        return this.packageRepository.getMultiDependencies(dependecyNames).then(async v => {
          const promieses: Promise<Array<Package>>[] = [];
          const x: Package[] = [];
          const depPackages: Package[] = [];
          for (const name in dep) {
            const versions = v.get(name);
            if (versions) {
              const targetVersion = getValidLatestVersion(dep[name], Array.from(versions.keys()));
              const target = { name: name, version: targetVersion };
              x.push(target);
              promieses.push(this.getDependenciesS(target, cache, versions.get(targetVersion)));
              depPackages.push(target);
            }
          }
          const d = await Promise.all(promieses);
          depPackages.forEach((v, i) => (this.depCache[JSON.stringify(v)] = d[i]));
          return d.reduce((r, l) => r.concat(l), []).concat(x);
        });
      } else {
        return [];
      }
    } else {
      return [];
    }
  }

  private async getDependencies(pack: Package): Promise<Array<Package>> {
    const x = await this.packageRepository.getDependencies(pack.name);
    if (!x) throw new Error("x");
    const dep = x.get(Array.from(x.keys()).filter(v => semver.eq(v, pack.version))[0]);
    return [...(await this.getDependenciesS(pack, new Map(), dep)), pack];
  }

  private isSolvedConfilicts(targets: string[], gathering: PackageDepndecyList[]): false | Package[] {
    const packs: Package[] = [];
    gathering.forEach(v => {
      packs.push(v.package);
      v.depndecies.forEach(d => {
        if (targets.includes(d.name)) {
          packs.push(d);
        }
      });
    });
    const devVersion: { [key: string]: SemVer } = {};
    const result: Package[] = [];
    for (const pack of packs) {
      if (!devVersion[pack.name]) {
        devVersion[pack.name] = pack.version;
        result.push(pack);
      } else if (devVersion[pack.name] && !semver.eq(devVersion[pack.name], pack.version)) {
        return false;
      }
    }
    return result;
  }

  async solveConflict(conflictCausePackages: Package[], targetPackage: string[]): Promise<NoConflictSituation[]> {
    const packageDepndencyMap: {
      [name: string]: Map<SemVer, PackageDepndecyList>;
    } = {};
    const cache: string[] = [];
    for (const targetPackage of conflictCausePackages) {
      if (cache.includes(targetPackage.name)) continue;
      cache.push(targetPackage.name);
      // どうアップデートするべきかを表示するために必要
      const packageVersions = await this.packageRepository.getDependencies(targetPackage.name);
      const checkVersions = Array.from(packageVersions.keys()).filter(v => semver.gte(v, targetPackage.version));
      const bar = new progress.default(`get ${targetPackage.name} dependencies :current/:total`, checkVersions.length);
      const versionDependecyMap = new Map<semver.SemVer, PackageDepndecyList>();
      for (const v of checkVersions) {
        bar.tick();
        const depndecyList = await this.getDependencies({ name: targetPackage.name, version: v });
        versionDependecyMap.set(v, { package: { name: targetPackage.name, version: v }, depndecies: depndecyList });
      }
      packageDepndencyMap[targetPackage.name] = versionDependecyMap;
    }

    const conflictCauseNames: Array<string> = Array.from(Object.keys(packageDepndencyMap));
    const noConflictSituation: NoConflictSituation[] = [];
    const checkVersion = (
      potentiality: { [name: string]: Map<semver.SemVer, PackageDepndecyList> },
      dependencyListArray: PackageDepndecyList[]
    ): void => {
      if (dependencyListArray.length === conflictCauseNames.length - 1) {
        const t = potentiality[conflictCauseNames[dependencyListArray.length]];
        for (const last of t.values()) {
          const result = this.isSolvedConfilicts(targetPackage, [...dependencyListArray, last]);
          if (result) {
            const updateTarget: PackageUpdateInfo[] = [];
            dependencyListArray.forEach(v =>
              updateTarget.push({
                before: conflictCausePackages.filter(d => d.name === v.package.name)[0],
                after: v.package
              })
            );
            updateTarget.push({
              before: conflictCausePackages.filter(d => d.name === last.package.name)[0],
              after: last.package
            });
            noConflictSituation.push({
              targetPackages: result.filter(d => targetPackage.includes(d.name)),
              updateTargets: updateTarget
            });
          }
        }
        // 総当りをするために再帰する
      } else {
        const t = potentiality[conflictCauseNames[dependencyListArray.length]];
        for (const v of t.values()) {
          const x = dependencyListArray.concat(v);
          if (this.isSolvedConfilicts(targetPackage, x)) checkVersion(potentiality, x);
        }
      }
    };
    checkVersion(packageDepndencyMap, []);
    return noConflictSituation;
  }
}
