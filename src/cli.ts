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
  .option("--search_in_range", "search solution in range mode (enable only when sat solver mode)")
  .description("find slove conflict situatuion, use sat-solve solver (default)")
  .action(async (dir, ...args) => {
    const cmdObj = args[args.length - 1] as { bruteforce: true | undefined; search_in_range: true | undefined };
    const target = args[0] as string;
    const result = new NpmConflictChecker().checkConflict(getLogicTree(dir as string));
    const solver = cmdObj.bruteforce
      ? new BruteforceConflictSolver(new NpmPackageRepository())
      : new SatConflictSolver(new NpmPackageRepository());
    result.forEach(async v => {
      const causes = v.versions.map(x => x.depenedecyRoot[0]);
      if (args.length === 1) {
        printNoConflictSituation(
          [v.packageName],
          await solver.solveConflict(causes, [v.packageName], {
            searchInRange: !!cmdObj.search_in_range
          })
        );
      } else if (target === v.packageName) {
        printNoConflictSituation(
          args.slice(0, args.length - 1),
          await solver.solveConflict(causes, args.slice(0, args.length - 1), {
            searchInRange: !!cmdObj.search_in_range
          })
        );
      }
    });
  });

pcs.parse(process.argv);
