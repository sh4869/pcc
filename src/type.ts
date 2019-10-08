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

export interface Package {
  name: string;
  version: SemVer;
}

export const ROOT_PROJECT: Package = {
  name: "#ROOT_PROJECT",
  version: new SemVer("0.0.0")
};

export interface DependencyRoot {
  // プロジェクトから見て上から下に下がっていく
  root: Package[];
}

/**
 * 衝突したパッケージとその原因
 */
export interface ConflictPackage {
  packageName: string;
  versions: { version: SemVer; depenedecyRoot: Package[] }[];
}
/**
 * Conflictの存在をチェックしたあとのデータ
 */
export type ConflictPackages = ConflictPackage[];

/**
 * Conflictをチェックする機構
 */
export interface ConflictChecker {
  checkConflict: (logicalTree: Map<string, LogicalTree>) => ConflictPackages;
}

export interface PackageUpdateInfo {
  before: Package;
  // もし更新がない場合はundefinedになる
  after?: Package;
}

export interface NoConflictSituation {
  targetPackage: string;
  finalVersion: SemVer;
  updateTargets: PackageUpdateInfo[];
}

/**
 * Conflictを解決できないかを探す機構
 */
export interface ConflictSolver {
  /**
   * conflict -> NoConflictSisutation
   */
  solveConflict: (conflict: ConflictPackage) => Promise<NoConflictSituation[]>;
}

interface UpdateableCheckResult {
  updateable: boolean;
  result: string;
}

export interface SituatuionInspectionResult {
  target_package: string;
  final_version: SemVer;
  // 全体として更新して解決が可能か
  updateable: boolean;
  // それぞれの可否
  update_targets_check_result: UpdateableCheckResult[];
}

export interface ConflictSolverInspector {
  inspectSolver: (solver: NoConflictSituation) => SituatuionInspectionResult;
}
