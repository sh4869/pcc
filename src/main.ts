import pkginfo = require("npm-registry-package-info");

import packagejson from "package-json";

const opts: pkginfo.Options = {
  packages: ["npm-api","jest"]
};

interface PkgData {
  versions: { [key: string]: packagejson.FullMetadata };
}
type PkgDataInfo = { [key: string]: PkgData };

pkginfo(opts, (error, data) => {
  const pkgdatainfo = data.data as PkgDataInfo;
  for (let x in pkgdatainfo) {
    for (let y in pkgdatainfo[x].versions) {
      console.log(pkgdatainfo[x].versions[y].dependencies);
    }
  }
});

interface Dependency {
  name: string;
  // TODO: 複雑な依存条件の設定が可能にする
  version: string;
  depndencies: Dependency[];
}

interface DependencyGraphNode {
  parent: Symbol;
  self: Symbol;
  // 内容
  dependency: Dependency;
  // 深さ
  depth: number;
}

interface DependencyGraph {
  // package.jsonに明記されているDependenciesを書く。
  dependencies: DependencyGraphNode[];
}

const getAllDepndencies = (dependencies: Dependency[]) => {};
