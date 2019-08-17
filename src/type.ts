import { SemVer } from "semver";
import packagejson from "package-json";

export interface PkgData {
  versions: { [key: string]: packagejson.AbbreviatedVersion };
}

export type PkgDataInfo = { [key: string]: PkgData };

/**
 * パッケージの依存関係
 */
export type Dependencies = { [name: string]: string };

/**
 * あるパッケージにおけるバージョンとそのバージョンの依存関係
 */
export type PackageDependenciesInfo = Map<SemVer, Dependencies>;

export type SimplePackageInfo = { name: string; version: string };

/**
 * あるパッケージのあるバージョンがどういう依存関係によって存在しているか
 */
export type DependencyRootInfo = {
  name: string;
  version: string;
  parentArray: SimplePackageInfo[];
  bigParent: SimplePackageInfo;
};

/**
 * 依存関係が重複しているパッケージの情報
 */
export type ConflictInfo = { [name: string]: DependencyRootInfo[] };

export interface LogicalTree {
  name: string;
  version: string;
  address: string;
  optional: boolean;
  dev: boolean;
  bundled: boolean;
  resolved: any;
  integrity: any;
  dependencies: Map<string, LogicalTree>;
  requiredBy?: Set<LogicalTree>;
}
