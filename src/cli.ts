import { Command } from "commander";
import { NpmConflictChecker } from "./conflict_chekcer/npm_conflict_checker";
import { getLogicTree } from "./logic_tree";
import { NpmConflictSolver } from "./conflict_solver/npm_conflict_solver";
import { NpmPackageRepository } from "./get_package_info";
import { ConflictPackage, Package } from "./type";
import { version } from "punycode";
import { Z_ASCII } from "zlib";

const pcc = new Command("pcc");

const printConflitResult = (conflictResult: ConflictPackage[]): void => {
  conflictResult.forEach(pack => {
    const groupByVersions: { [key: string]: Package[][] } = {};
    pack.versions.forEach(v => {
      if (groupByVersions[v.version.version]) groupByVersions[v.version.version].push(v.depenedecyRoot);
      else groupByVersions[v.version.version] = [v.depenedecyRoot];
    });
    console.log(`${pack.packageName}`);
  });
};

pcc.version("0.1.0");

pcc
  .command("check")
  .description("check conflict in package")
  .action((dir, _) => {
    const result = new NpmConflictChecker().checkConflict(getLogicTree(dir as string));
    console.log(result);
  });

pcc
  .command("solve")
  .description("find slove conflict situatuion")
  .action(async (dir, _) => {
    const result = new NpmConflictChecker().checkConflict(getLogicTree(dir as string));
    const solver = new NpmConflictSolver(new NpmPackageRepository());
    result.forEach(async v => {
      console.log(await solver.solveConflict(v), v);
    });
  });

pcc.parse(process.argv);
