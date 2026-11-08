// Container entry for `ast project start`: runs the eval named by eval/config.json "task"
// ("drafter", the default, or "checker").
import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../eval/config.json", import.meta.url), "utf8"));
await import(config.task === "checker" ? "./eval-checker.mts" : "./eval.mts");
