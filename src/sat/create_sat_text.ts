import { Expression, EMPTY } from "./logic_expression";
import { ConflictPackages } from "../type";

const solveSat = (conflictCauses: ConflictPackages, targetPackage: string[]) => {
  // 論理式の作成
  // CNFへの変換
  // 食わせる
  // decode
};

const AMO = (variables: Expression[]): Expression => {
  const x: Expression = EMPTY;
  for (let i = 0; i < variables.length; i++) {
    for (let j = i + 1; j < variables.length; j++) {}
  }
};

const createLogicalExpresison = (conflictCauses: ConflictPackages, targetPackage: string[]): Expression => {
  /// targetPackageのすべてのバージョンについての論理式を作成

  /// conflictCauseへのやつを作る

  return "";
};

const TestyinTransformation = () => {};
