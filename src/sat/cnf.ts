export interface Variable {
  kind: "Variable";
  v: string;
}

export interface NotVariable {
  kind: "Not";
  v: string;
}

/**
 * リテラル => 変数かその否定
 */
export type Literal = NotVariable | Variable;

/**
 * 節 => リテラルを OR で結んだもの
 */
export type Clause = {
  kind: "Clause";
  v: Literal[];
};

/**
 * CNF: 節をANDで結んだもの
 */
export type CNF = {
  kind: "CNF";
  v: Clause[];
};

export const NOT = (v: Variable): NotVariable => ({ kind: "Not", v: v.v });

export const OR = (a: Literal | Clause, b: Literal | Clause): Clause => {
  if (a.kind === "Clause") {
    if (b.kind === "Clause") {
      return { kind: "Clause", v: a.v.concat(b.v) };
    } else {
      return { kind: "Clause", v: a.v.concat(b) };
    }
  } else if (b.kind === "Clause") {
    return { kind: "Clause", v: b.v.concat(a) };
  } else {
    return { kind: "Clause", v: [a, b] };
  }
};

/**
 * At Most one
 * @param variables
 */
export const AMO = (variables: Variable[]): Clause[] => {
  const x: Clause[] = [];
  for (let i = 0; i < variables.length; i++) {
    for (let j = i + 1; j < variables.length; j++) {
      x.push({ kind: "Clause", v: [NOT(variables[i]), NOT(variables[j])] });
    }
  }
  return x;
};

export const ALO = (variables: Variable[]): Clause => ({ kind: "Clause", v: variables });
