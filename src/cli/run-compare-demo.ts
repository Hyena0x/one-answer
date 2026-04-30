import { runInjectedProviderDemo } from "./run-injected-demo.js";
import { runDualDemo } from "./run-dual-demo.js";
import { loadSynthesizeInputFromFile } from "./run-local.js";
import { runOneAnswer, type RuntimeConfig } from "../index.js";
import { createDualOpenAICompatibleProvider } from "../providers/openai-compatible.js";
import { synthesizeDualModel } from "../core/one-answer.js";

function summarizeComparison(single: { final_answer: string }, dual: { final_answer: string }) {
  const notes: string[] = [];
  if (dual.final_answer.length > single.final_answer.length) {
    notes.push("Dual-model output is more explicit about why the recommendation wins, not just what it is.");
  }
  if (/two distinct answer paths/i.test(dual.final_answer)) {
    notes.push("Dual-model output makes the multi-path synthesis value visible in the final answer.");
  }
  if (!/two distinct answer paths/i.test(single.final_answer)) {
    notes.push("Single-model output is still useful, but it reads more like self-critique than cross-answer synthesis.");
  }

  return {
    stronger_for_this_case: "dual",
    notes,
  };
}

type CompareResult = {
  input_file: string;
  single: { run_id: string; final_answer: string };
  dual: { run_id: string; final_answer: string };
  comparison: { stronger_for_this_case: string; notes: string[] };
};

export async function runCompareDemo(input: { inputFile: string | URL; runtime?: RuntimeConfig }): Promise<string> {
  if (!input.runtime) {
    const [singleRaw, dualRaw] = await Promise.all([
      runInjectedProviderDemo({ inputFile: input.inputFile }),
      runDualDemo({ inputFile: input.inputFile }),
    ]);

    const single = JSON.parse(singleRaw) as { run_id: string; final_answer: string };
    const dual = JSON.parse(dualRaw) as { run_id: string; final_answer: string };

    return JSON.stringify(
      {
        input_file: String(input.inputFile),
        single,
        dual,
        comparison: summarizeComparison(single, dual),
      } satisfies CompareResult,
      null,
      2,
    );
  }

  const request = await loadSynthesizeInputFromFile(input.inputFile);
  const singleResult = await runOneAnswer(request, {
    ...input.runtime,
    mode: "single-model",
  });

  if ("error" in singleResult) {
    throw new Error(`single compare path failed: ${singleResult.error.message}`);
  }

  if (!input.runtime.apiKey || !input.runtime.model) {
    throw new Error("real compare path requires apiKey and model");
  }

  const dualProvider = createDualOpenAICompatibleProvider({
    apiKey: input.runtime.apiKey,
    model: input.runtime.model,
    baseUrl: input.runtime.baseUrl,
    fetchImpl: input.runtime.fetchImpl,
  });
  const dualResult = await synthesizeDualModel(request, dualProvider);

  return JSON.stringify(
    {
      input_file: String(input.inputFile),
      single: singleResult,
      dual: dualResult,
      comparison: summarizeComparison(singleResult, dualResult),
    } satisfies CompareResult,
    null,
    2,
  );
}

async function main() {
  const inputFile = process.argv[2] ?? new URL("../../examples/request.tradeoff.json", import.meta.url);
  const output = await runCompareDemo({ inputFile });
  process.stdout.write(`${output}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
