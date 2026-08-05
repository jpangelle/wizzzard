import { fileURLToPath } from "node:url";
import { generate } from "../src/generate.ts";

const [json, parentDir] = process.argv.slice(2);
if (!json || !parentDir) {
  console.error('Usage: node test/gen-fixture.ts \'{"appName":...}\' <parent-dir>');
  process.exit(1);
}
const templateDir = fileURLToPath(new URL("../template", import.meta.url));
const target = await generate(JSON.parse(json), parentDir, templateDir, { git: false });
console.log(target);
