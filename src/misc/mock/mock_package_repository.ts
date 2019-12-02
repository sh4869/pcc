import { PackageRepository } from "../npm/package_repository";
import { PackageDependenciesInfo, Dependencies } from "../type";
import { SemVer } from "semver";

const createDep = (): { [key: string]: PackageDependenciesInfo } => {
  const versions = [
    new SemVer("1.0.0"),
    new SemVer("2.0.0"),
    new SemVer("3.0.0"),
    new SemVer("4.0.0"),
    new SemVer("5.0.0"),
    new SemVer("6.0.0")
  ];
  const depMap = new Map<SemVer, Dependencies>();
  versions.forEach(v => depMap.set(v, {}));
  const d: { [key: string]: PackageDependenciesInfo } = {};
  new Array(6)
    .fill(0)
    .map((v, i) => `dep${i}`)
    .forEach(v => {
      d[v] = depMap;
    });
  return d;
};

export class MockPackageRepository implements PackageRepository {
  private dep: { [key: string]: PackageDependenciesInfo };
  constructor(packnum: number, versionnum: number) {
    const ranges = new Array(versionnum).fill(0).map((_, i) => `${i + 1}.0.0`);
    const versions = ranges.map(v => new SemVer(v));
    const depMap = new Map<SemVer, Dependencies>();
    versions.forEach(v => depMap.set(v, {}));
    this.dep = { dep: depMap };
    new Array(packnum)
      .fill(0)
      .map((v, i) => i.toString())
      .map(v => ({ key: v, versions: new Map<SemVer, Dependencies>() }))
      .forEach(x => {
        const random = Math.floor(Math.random() * ranges.length);
        versions.forEach((v, i) => {
          const index = i + random > ranges.length - 1 ? random + i - ranges.length : i + random;
          x.versions.set(v, { dep: ranges[index] });
          this.dep[x.key] = x.versions;
        });
      });
  }
  public async getMultiDependencies(names: string[]): Promise<Map<string, PackageDependenciesInfo>> {
    const map = new Map<string, PackageDependenciesInfo>();
    for (const name of names) {
      map.set(name, this.dep[name]);
    }
    return map;
  }
  public async getDependencies(name: string): Promise<PackageDependenciesInfo> {
    return this.dep[name];
  }
  public async getVersions(name: string): Promise<Array<SemVer>> {
    return Array.from(this.dep[name].keys());
  }
}
