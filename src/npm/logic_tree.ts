import { join } from "path";
import { readFileSync } from "fs";
import logicTree = require("npm-logical-tree");
import { LogicalTree } from "../type";

/**
 * Jsonファイルを読み込んでparseする
 * @param path パス
 */
/* eslint-disable */
const getJsondata = (path: string): any => {
  return JSON.parse(readFileSync(path).toString());
};
/* eslint-enable */

/**
 * 依存関係から必要なものだけを取り出す（dev onlyとかはいらないので）
 * @param logicalTree 依存関係のtree
 */
const getRealLogicalTree = (logicalTree: LogicalTree): Map<string, LogicalTree> => {
  const depens = logicalTree.dependencies;
  // optional と devなdependenciesを除く
  const realDep = new Map<string, LogicalTree>();
  depens.forEach((target, x) => {
    if (target && (!target.dev && !target.optional && !target.bundled)) {
      realDep.set(x, target);
    }
  });
  return realDep;
};

export const getLogicTree = (path: string): Map<string, LogicalTree> => {
  return getRealLogicalTree(logicTree(
    getJsondata(join(path, "package.json")),
    getJsondata(join(path, "package-lock.json"))
  ) as LogicalTree);
};
