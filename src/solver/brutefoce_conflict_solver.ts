import { ConflictSolver, ConflictPackage, NoConflictSituation, Package, PackageUpdateInfo } from "../misc/type";
import semver, { SemVer } from "semver";
import { PackageRepository } from "../misc/npm/package_repository";

type PackageDepndecyList = {
  package: Package;
  depndecies: Set<Package>;
};

const getValidLatestVersion = (condition: string, versions: semver.SemVer[]): semver.SemVer => {
  return versions.filter(v => semver.satisfies(v.version, condition)).sort((a, b) => (semver.gt(a, b) ? -1 : 1))[0];
};

export class BruteforceConflictSolver implements ConflictSolver {
  private packageRepository: PackageRepository;
  constructor(repository: PackageRepository) {
    this.packageRepository = repository;
  }

  private async getDependencies(pack: Package): Promise<PackageDepndecyList> {
    const dependecyList: Set<Package> = new Set();
    const dependecyMap: Map<string, Package> = new Map();
    const addDependency = async (
      packageInfo: Package,
      dependecy: Map<semver.SemVer, { [name: string]: string }>
    ): Promise<void> => {
      if (!dependecyMap.has(JSON.stringify(packageInfo))) {
        dependecyMap.set(JSON.stringify(packageInfo), packageInfo);
        dependecyList.add(packageInfo);
        // 当てはまるバージョンの依存関係を取得する(Objectなので適当にgetすると失敗するため)
        const verisonDependecy = dependecy.get(
          Array.from(dependecy.keys()).filter(v => v.version === packageInfo.version.version)[0]
        );
        if (verisonDependecy) {
          const dependecyNames = Array.from(Object.keys(verisonDependecy));
          const packageDependecyInfo = await this.packageRepository.getMultiDependencies(dependecyNames);
          for (const name in verisonDependecy) {
            const versions = packageDependecyInfo.get(name);
            if (versions) {
              const targetVersion = getValidLatestVersion(verisonDependecy[name], Array.from(versions.keys()));
              await addDependency({ name: name, version: targetVersion }, versions);
            }
          }
        }
      }
    };
    await addDependency(pack, await this.packageRepository.getDependencies(pack.name));
    return { package: pack, depndecies: dependecyList };
  }

  private isSolvedConfilicts(targets: string[], gathering: PackageDepndecyList[]): false | Package[] {
    //const versions: Array<SemVer[]> = new Array(targets.length);
    const packs: Package[] = [];
    gathering.forEach(v => {
      Array.from(v.depndecies.values()).forEach(d => {
        if (targets.includes(d.name)) {
          if (packs.find(v => v.name === d.name)) {
            return false;
          } else {
            packs.push({ name: d.name, version: d.version });
          }
        }
      });
    });
    return packs;
  }

  async solveConflict(
    conflictCausePackages: Package[],
    targetPackage: string[],
    solveOption: { searchInRange: boolean }
  ): Promise<NoConflictSituation[]> {
    if (solveOption.searchInRange) {
      console.error("bruteforce conflit solver not supported search in range.");
    }
    const beforeVersions: { [name: string]: Package } = {};
    const packageDepndencyMap: {
      [name: string]: Map<SemVer, PackageDepndecyList>;
    } = {};
    for (const targetPackage of conflictCausePackages) {
      // どうアップデートするべきかを表示するために必要
      beforeVersions[targetPackage.name] = targetPackage;
      const packageVersions = await this.packageRepository.getDependencies(targetPackage.name);
      const checkVersions = Array.from(packageVersions.keys()).filter(v => semver.gte(v, targetPackage.version));
      const versionDependecyMap = new Map<semver.SemVer, PackageDepndecyList>();
      for (const v of checkVersions) {
        const depndecyList = await this.getDependencies({ name: targetPackage.name, version: v });
        versionDependecyMap.set(v, depndecyList);
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
        Array.from(t.values()).forEach(async last => {
          const result = this.isSolvedConfilicts(targetPackage, [...dependencyListArray, last]);
          if (result) {
            const updateTarget: PackageUpdateInfo[] = [];
            dependencyListArray.forEach(v =>
              updateTarget.push({ before: beforeVersions[v.package.name], after: v.package })
            );
            updateTarget.push({ before: beforeVersions[last.package.name], after: last.package });
            noConflictSituation.push({
              targetPackages: result,
              updateTargets: updateTarget
            });
          }
        });
        // 総当りをするために再帰する
      } else {
        const t = potentiality[conflictCauseNames[dependencyListArray.length]];
        Array.from(t.values()).forEach(v => {
          checkVersion(potentiality, [...dependencyListArray, v]);
        });
      }
    };
    checkVersion(packageDepndencyMap, []);
    return noConflictSituation;
  }
}
