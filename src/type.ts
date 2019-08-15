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
