import pkginfo = require("npm-registry-package-info");

import packagejson from "package-json";

import util = require("util");

const opts: pkginfo.Options = {
  packages: ["npm-api", "jest"]
};

interface PkgData {
  versions: { [key: string]: packagejson.AbbreviatedVersion };
}

type PkgDataInfo = { [key: string]: PkgData };

type Dependencies = {[name: string]: string };

const getPackageDependencies = async (packages: string[]) => {
  const opts: pkginfo.Options = {
    packages: packages
  };
  const pkginfoPromise = util.promisify(pkginfo);
  const result = await pkginfoPromise(opts);
  const pkgdatainfo = result.data as PkgDataInfo;
  let map = new Map<string, Map<string, Dependencies>>()
  for (let x in pkgdatainfo) {
    const xmap = new Map<string, Dependencies>();
    for (let y in pkgdatainfo[x].versions) {
      console.log(pkgdatainfo[x].versions[y].dependencies);
      xmap.set(y, pkgdatainfo[x].versions[y].dependencies as {[name: string]: string })
    }
    map.set(x,xmap);
  }
  return map;
};

getPackageDependencies(["npm-api"]).then(v => console.log(v));

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
