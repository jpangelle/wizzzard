#!/usr/bin/env node
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 24) {
  console.error(`wizzzard requires Node 24+ (you have ${process.versions.node})`);
  process.exit(1);
}

const subcommand: string | undefined = process.argv[2];

if (subcommand === "setup") {
  const { runSetup } = await import("./setup.ts");
  await runSetup();
} else if (subcommand === undefined) {
  const { runWizard } = await import("./wizard.ts");
  await runWizard();
} else {
  console.error(`Unknown command: ${subcommand}\nUsage: wizzzard [setup]`);
  process.exit(1);
}
