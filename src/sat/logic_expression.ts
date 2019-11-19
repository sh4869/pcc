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
  v: Expression[];
}

export interface And {
  kind: "And";
  v: Expression[];
}

export const EMPTY: Variable = { kind: "Variable", v: "" };

export const AND = (...v: Expression[]): Expression => {
  const n: Expression[] = [];
  for (const x of v) {
    if (x !== EMPTY) n.push(x);
  }
  if (n.length === 0) return EMPTY;
  if (n.length === 1) return n[0];
  return { kind: "And", v: n };
};

export const OR = (...v: Expression[]): Expression => {
  const n: Expression[] = [];
  for (const x of v) {
    if (x !== EMPTY) n.push(x);
  }
  if (n.length === 0) return EMPTY;
  if (n.length === 1) return n[0];
  return { kind: "Or", v: n };
};

export const NOT = (v: Expression): Expression => {
  return v === EMPTY ? v : { v: v, kind: "Not" };
};

/**
 * At Most one
 * @param variables
 */
export const AMO = (variables: Expression[]): Expression => {
  const x: Expression[] = [];
  for (let i = 0; i < variables.length; i++) {
    for (let j = i + 1; j < variables.length; j++) {
      const v = OR(NOT(variables[i]), NOT(variables[j]));
      x.push(v);
    }
  }
  return AND(...x);
};
/**
 * At Least One
 * @param variables
 */
export const ALO = (variables: Expression[]): Expression => {
  return OR(...variables);
};
