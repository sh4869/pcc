import { SemVer } from "semver";
import { PackageDependenciesInfo } from "../type";

/**
 * Get Package Info about dependency and version
 */
export interface PackageRepository {
  /**
   * get multiple package dependecy info for each versions
   * @names package name array
   */
  getMultiDependencies: (names: string[]) => Promise<Map<string, PackageDependenciesInfo>>;

  /**
   * get package dependecy info for each versions
   * @name package name
   */
  getDependencies: (name: string) => Promise<PackageDependenciesInfo>;

  /**
   * get package All Version
   * @name package name
   */
  getVersions: (name: string) => Promise<Array<SemVer>>;
}
