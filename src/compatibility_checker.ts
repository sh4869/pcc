/**
 * Check Package Compatibilty
 */
export interface CompatibilityChecker {
  check: (packageName: string, oldversion: string, newVersion: string) => boolean;
  checkAll: (packages: { packageName: string; oldversion: string; newVersion: string }[]) => boolean;
}
