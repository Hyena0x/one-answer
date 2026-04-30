import { describe, expect, it } from "vitest";

import { evaluateGoldenCase, runGoldenEval } from "../src/cli/run-eval.js";

describe("evaluateGoldenCase", () => {
  it("passes a golden eval case when compare output matches the expected signals", async () => {
    const result = await evaluateGoldenCase({
      caseFile: new URL("../examples/golden/decision.eval.json", import.meta.url),
    });

    expect(result.name).toBe("decision-demo");
    expect(result.passed).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.comparison.stronger_for_this_case).toBe("dual");
  });

  it("reports clear reasons when a golden case expectation fails", async () => {
    const result = await evaluateGoldenCase({
      spec: {
        name: "failing-case",
        input_file: "../request.decision.json",
        expected_winner: "single",
        single_final_answer_must_include: ["definitely missing phrase"],
      },
      baseDir: new URL("../examples/golden/", import.meta.url),
    });

    expect(result.name).toBe("failing-case");
    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toContain("expected_winner");
    expect(result.reasons[1]).toContain("single.final_answer");
  });
});

describe("runGoldenEval", () => {
  it("evaluates multiple cases and returns a summary", async () => {
    const output = await runGoldenEval({
      caseFiles: [
        new URL("../examples/golden/decision.eval.json", import.meta.url),
        new URL("../examples/golden/tradeoff.eval.json", import.meta.url),
      ],
    });

    const parsed = JSON.parse(output) as {
      summary: { total: number; passed: number; failed: number };
      results: Array<{ name: string; passed: boolean }>;
    };

    expect(parsed.summary).toEqual({
      total: 2,
      passed: 2,
      failed: 0,
    });
    expect(parsed.results.map((item) => item.name)).toEqual([
      "decision-demo",
      "tradeoff-demo",
    ]);
  });

  it("accepts relative string case paths for CLI-style invocation", async () => {
    const output = await runGoldenEval({
      caseFiles: ["./examples/golden/tradeoff.eval.json"],
    });

    const parsed = JSON.parse(output) as {
      summary: { total: number; passed: number; failed: number };
    };

    expect(parsed.summary).toEqual({
      total: 1,
      passed: 1,
      failed: 0,
    });
  });

  it("discovers the default golden case directory from the repo root", async () => {
    const output = await runGoldenEval();

    const parsed = JSON.parse(output) as {
      summary: { total: number; passed: number; failed: number };
    };

    expect(parsed.summary).toEqual({
      total: 2,
      passed: 2,
      failed: 0,
    });
  });
});
