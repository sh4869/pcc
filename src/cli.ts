import { Command } from "commander";
import { NpmConflictChecker } from "./checker/npm_conflict_checker";
import { getLogicTree } from "./misc/npm/logic_tree";
import { Package } from "./misc/type";
import { NpmPackageRepository } from "./misc/npm/npm_package_repository";
import { BruteforceConflictSolver } from "./solver/brutefoce_conflict_solver";
import { SatConflictSolverLatestVersion } from "./solver/sat_conflict_solver_latest_ver";
import { printConflitResult, printNoConflictSituation } from "./misc/printer";
import { MockPackageRepository } from "./misc/mock/mock_package_repository";
import { SemVer } from "semver";

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
  .description("find slove conflict situatuion, use sat-solve solver (default)")
  .action(async (dir, ...args) => {
    const cmdObj = args[args.length - 1] as { bruteforce: true | undefined };
    const target = args[0] as string;
    const result = new NpmConflictChecker().checkConflict(getLogicTree(dir as string));
    const solver = cmdObj.bruteforce
      ? new BruteforceConflictSolver(new NpmPackageRepository())
      : new SatConflictSolverLatestVersion(new NpmPackageRepository());
    result.forEach(async v => {
      const causes = v.versions.map(x => x.depenedecyRoot[0]);
      if (args.length === 1) {
        printNoConflictSituation([v.packageName], await solver.solveConflict(causes, [v.packageName]));
      } else if (target === v.packageName) {
        printNoConflictSituation(
          args.slice(0, args.length - 1),
          await solver.solveConflict(causes, args.slice(0, args.length - 1))
        );
      }
    });
  });

const PACK_NUM = 10000;
const VERSION_NUM = 12;

pcs
  .command("test")
  .description("mock function")
  .option("-p, --packnum <number>", "package number")
  .option("-v, --vernum <number>", "version number")
  .action(async (...args) => {
    const option = args[args.length - 1] as { packnum: string | undefined; vernum: string | undefined };
    const packNum = option.packnum ? Number(option.packnum) : PACK_NUM;
    const vernum = option.vernum ? Number(option.vernum) : VERSION_NUM;
    const repository = new MockPackageRepository(packNum, vernum);
    const satSolver = new SatConflictSolverLatestVersion(repository);
    const bruteSolver = new BruteforceConflictSolver(repository);
    const dep = "dep";
    const causes = new Array(packNum)
      .fill(0)
      .map<Package>((v, i) => ({ name: i.toString(), version: new SemVer("1.0.0") }));
    console.log("sat solver");
    console.time("sat-solver");
    console.log((await satSolver.solveConflict(causes, [dep])).length);
    // printNoConflictSituation([dep], await satSolver.solveConflict(causes, [dep], { searchInRange: false }));
    console.timeEnd("sat-solver");
    console.log("brute solver");
    console.time("brute-solver");
    console.log((await bruteSolver.solveConflict(causes, [dep])).length);
    // printNoConflictSituation([dep], await bruteSolver.solveConflict(causes, [dep], { searchInRange: false }));
    console.timeEnd("brute-solver");
  });

pcs.parse(process.argv);
