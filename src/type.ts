import { SemVer } from "semver";

export type DependecyRange = string;

/**
 * パッケージの依存関係
 */
export type Dependencies = { [name: string]: DependecyRange };

/**
 * あるパッケージにおけるバージョンとそのバージョンの依存関係
 */
export type PackageDependenciesInfo = Map<SemVer, Dependencies>;

export type SimplePackageInfo = { name: string; version: string };

/**
 * パッケージの依存関係リスト
 */
export interface PackageDepndecyList {
  package: SimplePackageInfo;
  depndecies: Set<SimplePackageInfo>;
}

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

export interface ConflictPackageInfo {
  name: string;
  conflictVersions: string[];
  conflictInfo: DependencyRootInfo[];
}

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
