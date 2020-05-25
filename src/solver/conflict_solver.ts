import { Package } from "../misc/type";

export interface PackageUpdateInfo {
  before: Package;
  // もし更新がない場合はundefinedになる
  after: Package;
}

export interface NoConflictSituation {
  targetPackages: Package[];
  updateTargets: PackageUpdateInfo[];
}

/**
 * Conflictを解決できないかを探す機構
 */
export interface ConflictSolver {
  /**
   * conflict -> NoConflictSisutation
   */
  solveConflict: (conflictCausePackages: Package[], targetPackages: string[]) => Promise<NoConflictSituation[]>;
}
