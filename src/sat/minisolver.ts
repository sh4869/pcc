import { CNF } from "./cnf";
import { MinisatSolver } from "minisolvers";

interface UNSAT {
  kind: "UNSAT";
}

interface VResult {
  name: string;
  v: boolean;
}

type Answer = VResult[];

interface SAT {
  kind: "SAT";
  v: Answer;
}

type SatResult = SAT | UNSAT;

const modelToVResult = (result: number[], variableCache: string[]): VResult[] =>
  variableCache.map((v, i) => ({ name: v, v: result[i] === 1 }));

export const solveCNF = (cnf: CNF): SatResult => {
  const solver = new MinisatSolver();
  const variableCache: string[] = [];
  cnf.v.forEach(v => {
    const clause: number[] = [];
    v.v.forEach(x => {
      const not = x.kind === "Not" ? -1 : 1;
      const pos = variableCache.indexOf(x.v);
      clause.push((pos === -1 ? variableCache.push(x.v) : variableCache.indexOf(x.v) + 1) * not);
      if (pos === -1) solver.new_var();
    });
    solver.add_clause(clause);
  });
  if (solver.solve() as boolean) {
    return { kind: "SAT", v: modelToVResult(solver.get_model() as number[], variableCache) };
  } else {
    return { kind: "UNSAT" };
  }
};
