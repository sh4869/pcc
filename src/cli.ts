import { Command } from "commander";
import { NpmConflictChecker } from "./checker/npm_conflict_checker";
import { getLogicTree } from "./misc/npm/logic_tree";
import { NpmPackageRepository } from "./misc/npm/npm_package_repository";
import { BruteforceConflictSolver } from "./solver/brutefoce_conflict_solver";
import { SatConflictSolver } from "./solver/sat_conflict_solver";
import { printConflitResult, printNoConflictSituation } from "./misc/printer";

const pcs = new Command("pcs").version("0.0.1");

pcs
  .command("check")
  .description("check conflict in package")
  /* eslint-disable */
  .action((dir, _) => {
    const result = new NpmConflictChecker().checkConflict(getLogicTree(dir as string));
    printConflitResult(result);
  });
/* eslint-enable */

pcs
  .command("solve")
  .option("--bruteforce", "use Brute-force solver")
  .description("find slove conflict situatuion")
  .action(async (dir, ...args) => {
    const cmdObj = args[args.length - 1] as { bruteforce: boolean };
    const target = args[0] as string;
    const result = new NpmConflictChecker().checkConflict(getLogicTree(dir as string));
    const solver = cmdObj.bruteforce
      ? new BruteforceConflictSolver(new NpmPackageRepository())
      : new SatConflictSolver();
    result.forEach(async v => {
      if (typeof target === "object" || (typeof target === "string" && target === v.packageName)) {
        printNoConflictSituation(v, await solver.solveConflict(v));
      }
    });
  });

pcs.parse(process.argv);
