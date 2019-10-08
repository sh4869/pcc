import { ConflictChecker, LogicalTree, ConflictPackages, Package, ROOT_PROJECT } from "../type";
import { SemVer } from "semver";

type VersionList = {
  [key: string]: { name: string; version: SemVer; dependency: Package[] }[];
};

export class NpmConflictChecker implements ConflictChecker {
  private addVersion(logicalTree: LogicalTree, dependency: Package[], list: VersionList, check: Set<string>): void {
    const key =
      Buffer.from(logicalTree.name, "utf-8").toString("base64") +
      Buffer.from(logicalTree.version, "utf-8").toString("base64");
    if (!check.has(key)) {
      check.add(key);
      dependency.push({
        name: logicalTree.name,
        version: new SemVer(logicalTree.version)
      });
      const dep = {
        name: logicalTree.name,
        version: new SemVer(logicalTree.version),
        dependency
      };
      if (!list[logicalTree.name]) list[logicalTree.name] = [dep];
      else list[logicalTree.name].push(dep);
      logicalTree.dependencies.forEach(v => {
        this.addVersion(v, dependency, list, check);
      });
    }
  }

  private filterConflitPackage(list: VersionList): VersionList {
    for (const x in list) {
      const targetPackage = list[x];
      const firstVerson = targetPackage[0].version;
      if (!targetPackage.every(v => v.version === firstVerson)) break;
      delete list[x];
    }
    return list;
  }

  checkConflict(logicalTree: Map<string, LogicalTree>): ConflictPackages {
    const deps: VersionList = {};
    const check = new Set<string>();
    logicalTree.forEach(v => this.addVersion(v, [ROOT_PROJECT], deps, check));
    // すべてのバージョンが同じバージョンであれば無視
    const result: ConflictPackages = [];
    const list = this.filterConflitPackage(deps);
    for (const x in list) {
      const versions: { version: SemVer; depenedecyRoot: Package[] }[] = [];
      deps[x].forEach(v => versions.push({ version: v.version, depenedecyRoot: v.dependency }));
      result.push({ packageName: x, versions: versions });
    }
    return result;
  }
}
