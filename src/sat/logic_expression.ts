export type Expression = Variable | Not | Or | And;

export interface Variable {
  kind: "Variable";
  v: string;
}

export interface Not {
  kind: "Not";
  v: Expression;
}

export interface Or {
  kind: "Or";
  a: Expression;
  b: Expression;
}

export interface And {
  kind: "And";
  a: Expression;
  b: Expression;
}

export const EMPTY: Variable = { kind: "Variable", v: "" };

export const ADD = (a: Expression, b: Expression): Expression => {
  if (a === EMPTY) return b;
  if (b === EMPTY) return a;
  return { a: a, b: b, kind: "And" };
};

export const OR = (a: Expression, b: Expression): Expression => {
  if (a === EMPTY) return b;
  if (b === EMPTY) return a;
  return { a: a, b: b, kind: "Or" };
};

export const NOT = (v: Expression): Expression => {
  return v === EMPTY ? v : { v: v, kind: "Not" };
};
