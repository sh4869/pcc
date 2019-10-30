import { PackageDependenciesInfo } from "../type";

/**
 * Packageの情報を取得します(Repositoryじゃない気がするけどまあいいや)
 */
export interface PackageRepository {
  /**
   * 渡された引数からパッケージを取得します
   * @names 取得したいPackageの情報
   */
  get: (names: string[]) => Promise<Map<string, PackageDependenciesInfo>>;
}
