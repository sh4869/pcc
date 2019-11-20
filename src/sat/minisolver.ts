import { CNF } from "./cnf";
import { MinisatSolver } from "minisolvers";

interface UNSAT {
  kind: "UNSAT";
}

interface VResult {
  name: string;
  v: boolean;
}

interface Answer {
  v: VResult[];
}

interface SAT {
  kind: "SAT";
  v: Answer[];
}

type SatResult = SAT | UNSAT;

const modelToVResult = (result: number[], variableCache: string[]): VResult[] =>
  variableCache.map((v, i) => ({ name: v, v: result[i] === 1 }));

export const solveCNF = (cnf: CNF, all = false): SatResult => {
  const solver = new MinisatSolver();
  const variableCache: string[] = [];
  cnf.v.forEach(v => {
    const clause: number[] = [];
    v.v.forEach(x => {
      const not = x.kind === "Not" ? -1 : 1;
      const pos = variableCache.indexOf(x.v);
      if (pos === -1) {
        solver.new_var();
        clause.push(not * variableCache.push(x.v));
      } else {
        clause.push(not * (pos + 1));
      }
    });
    if (clause.length > 0) {
      solver.add_clause(clause);
    }
  });
  if (solver.solve() as boolean) {
    const answers: Answer[] = [];
    answers.push({ v: modelToVResult(solver.get_model() as number[], variableCache) });
    while (all) {
      const model = solver.get_model() as number[];
      // (1  * -2) + 1 = -1, (0 * -2) + 1 = 1
      solver.add_clause(
        Array(model.length)
          .fill(0)
          .map((v, i) => (model[i] * -2 + 1) * (i + 1))
      );
      if (!solver.solve()) break;
      answers.push({ v: modelToVResult(solver.get_model() as number[], variableCache) });
    }
    return { kind: "SAT", v: answers };
  } else {
    return { kind: "UNSAT" };
  }
};
