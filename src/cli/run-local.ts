import { readFile } from "node:fs/promises";

import { runOneAnswer, type RuntimeConfig, type RunOneAnswerResult } from "../index.js";
import type { SynthesizeInput } from "../core/one-answer.js";

export async function loadSynthesizeInputFromFile(path: string | URL): Promise<SynthesizeInput> {
  const content = await readFile(path, "utf8");
  return JSON.parse(content) as SynthesizeInput;
}

export async function runLocalSynthesize(input: {
  inputFile: string | URL;
  runtime?: RuntimeConfig;
}): Promise<string> {
  const request = await loadSynthesizeInputFromFile(input.inputFile);
  const result: RunOneAnswerResult = await runOneAnswer(request, input.runtime);
  return JSON.stringify(result, null, 2);
}

async function main() {
  const inputFile = process.argv[2] ?? new URL("../../examples/request.decision.json", import.meta.url);
  const output = await runLocalSynthesize({ inputFile });
  process.stdout.write(`${output}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
