import { readdir, readFile } from "node:fs/promises";

import { runCompareDemo } from "./run-compare-demo.js";

export type GoldenEvalSpec = {
  name: string;
  input_file: string;
  expected_winner: string;
  single_final_answer_must_include?: string[];
  dual_final_answer_must_include?: string[];
  comparison_notes_must_include?: string[];
};

export type GoldenEvalResult = {
  name: string;
  input_file: string;
  passed: boolean;
  reasons: string[];
  single: { run_id: string; final_answer: string };
  dual: { run_id: string; final_answer: string };
  comparison: { stronger_for_this_case: string; notes: string[] };
};

function resolveBaseDir(baseDir?: string | URL) {
  return baseDir ?? new URL("./examples/golden/", `file://${process.cwd()}/`);
}

function resolveUrl(path: string | URL, base: string | URL) {
  return path instanceof URL ? path : new URL(path, base);
}

async function loadGoldenEvalSpec(path: string | URL): Promise<GoldenEvalSpec> {
  const content = await readFile(path, "utf8");
  return JSON.parse(content) as GoldenEvalSpec;
}

function checkIncludes(target: string, expected: string[], label: string) {
  const reasons: string[] = [];
  const normalizedTarget = target.toLowerCase();

  for (const snippet of expected) {
    if (!normalizedTarget.includes(snippet.toLowerCase())) {
      reasons.push(`${label} must include: ${snippet}`);
    }
  }

  return reasons;
}

export async function evaluateGoldenCase(input: {
  caseFile?: string | URL;
  spec?: GoldenEvalSpec;
  baseDir?: string | URL;
}): Promise<GoldenEvalResult> {
  const baseDir = resolveBaseDir(input.baseDir);
  const caseFileUrl = input.caseFile ? resolveUrl(input.caseFile, new URL(`file://${process.cwd()}/`)) : null;
  const spec = input.spec ?? await loadGoldenEvalSpec(caseFileUrl as URL);
  const caseBaseDir = caseFileUrl ? new URL("./", caseFileUrl) : baseDir;
  const output = await runCompareDemo({
    inputFile: new URL(spec.input_file, caseBaseDir),
  });

  const parsed = JSON.parse(output) as {
    single: { run_id: string; final_answer: string };
    dual: { run_id: string; final_answer: string };
    comparison: { stronger_for_this_case: string; notes: string[] };
  };

  const reasons: string[] = [];

  if (parsed.comparison.stronger_for_this_case !== spec.expected_winner) {
    reasons.push(
      `expected_winner mismatch: expected ${spec.expected_winner}, got ${parsed.comparison.stronger_for_this_case}`,
    );
  }

  reasons.push(
    ...checkIncludes(
      parsed.single.final_answer,
      spec.single_final_answer_must_include ?? [],
      "single.final_answer",
    ),
  );
  reasons.push(
    ...checkIncludes(
      parsed.dual.final_answer,
      spec.dual_final_answer_must_include ?? [],
      "dual.final_answer",
    ),
  );
  reasons.push(
    ...checkIncludes(
      parsed.comparison.notes.join("\n"),
      spec.comparison_notes_must_include ?? [],
      "comparison.notes",
    ),
  );

  return {
    name: spec.name,
    input_file: spec.input_file,
    passed: reasons.length === 0,
    reasons,
    single: parsed.single,
    dual: parsed.dual,
    comparison: parsed.comparison,
  };
}

export async function runGoldenEval(input?: {
  caseFiles?: Array<string | URL>;
}): Promise<string> {
  const baseDir = resolveBaseDir();
  const caseFiles = input?.caseFiles ?? (await readdir(baseDir))
    .filter((file) => file.endsWith(".eval.json"))
    .sort()
    .map((file) => new URL(file, baseDir));

  const results = await Promise.all(
    caseFiles.map((caseFile) => evaluateGoldenCase({ caseFile })),
  );

  const passed = results.filter((item) => item.passed).length;
  const failed = results.length - passed;

  return JSON.stringify(
    {
      summary: {
        total: results.length,
        passed,
        failed,
      },
      results,
    },
    null,
    2,
  );
}

async function main() {
  const caseFiles = process.argv.slice(2);
  const output = await runGoldenEval({
    caseFiles: caseFiles.length > 0 ? caseFiles : undefined,
  });
  process.stdout.write(`${output}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
