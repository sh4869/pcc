import { ConflictSolver, ConflictPackage, NoConflictSituation, Package, PackageUpdateInfo } from "../type";
import semver, { SemVer } from "semver";
import { PackageRepository } from "../package_repository";

type PackageDepndecyList = {
  package: Package;
  depndecies: Set<Package>;
};

const getValidLatestVersion = (condition: string, versions: semver.SemVer[]): semver.SemVer => {
  return versions.filter(v => semver.satisfies(v.version, condition)).sort((a, b) => (semver.gt(a, b) ? -1 : 1))[0];
};

export class NpmConflictSolver implements ConflictSolver {
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
          const packageDependecyInfo = await this.packageRepository.get(dependecyNames);
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
    const packageDependecy = (await this.packageRepository.get([pack.name])).get(pack.name);
    if (packageDependecy) await addDependency(pack, packageDependecy);
    return { package: pack, depndecies: dependecyList };
  }

  private isSolvedConfilicts(
    target: string,
    gathering: PackageDepndecyList[]
  ): { result: boolean; versions: SemVer[] } {
    const versionsString: string[] = [];
    const versions: SemVer[] = [];
    gathering.forEach(v => {
      Array.from(v.depndecies.values()).forEach(d => {
        if (d.name === target) {
          if (!versionsString.find(v => v === d.version.version)) {
            versions.push(d.version);
            versionsString.push(d.version.version);
          }
        }
      });
    });
    return { result: versions.length === 1, versions: versions };
  }

  async solveConflict(conflict: ConflictPackage): Promise<NoConflictSituation[]> {
    const beforeVersions: { [name: string]: Package } = {};
    const packageDepndencyMap: {
      [name: string]: Map<SemVer, PackageDepndecyList>;
    } = {};
    for (const causePackage of conflict.versions) {
      const targetPackage = causePackage.depenedecyRoot[1];
      // どうアップデートするべきかを表示するために必要
      beforeVersions[targetPackage.name] = targetPackage;
      const packageVersions = (await this.packageRepository.get([targetPackage.name])).get(targetPackage.name);
      if (!packageVersions) throw new Error("failed get package version info");
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
      if (dependencyListArray.length === conflictCauseNames.length) {
        const result = this.isSolvedConfilicts(conflict.packageName, dependencyListArray);
        if (result.result) {
          const updateTarget: PackageUpdateInfo[] = [];
          dependencyListArray.forEach(v =>
            updateTarget.push({ before: beforeVersions[v.package.name], after: v.package })
          );
          noConflictSituation.push({
            targetPackage: conflict.packageName,
            finalVersion: result.versions[0],
            updateTargets: updateTarget
          });
        }
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
