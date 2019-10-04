import { Command } from "commander";

const pcc = new Command("pcc");

pcc.version("0.1.0");
pcc.parse(process.argv);
