import { describe, expect, it, vi } from "vitest";

import { runCompareDemo } from "../src/cli/run-compare-demo.js";

describe("runCompareDemo", () => {
  it("returns both single and dual results plus a lightweight comparison summary", async () => {
    const output = await runCompareDemo({
      inputFile: new URL("../examples/request.tradeoff.json", import.meta.url),
    });

    const parsed = JSON.parse(output) as {
      input_file: string;
      single: { run_id: string; final_answer: string };
      dual: { run_id: string; final_answer: string };
      comparison: { stronger_for_this_case: string; notes: string[] };
    };

    expect(parsed.input_file).toContain("request.tradeoff.json");
    expect(parsed.single.run_id).toMatch(/^single_/);
    expect(parsed.dual.run_id).toMatch(/^dual_/);
    expect(parsed.comparison.stronger_for_this_case).toBe("dual");
    expect(parsed.comparison.notes.length).toBeGreaterThan(0);
  });

  it("can run both single and dual through real OpenAI-compatible config", async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount += 1;
      const payloads = [
        { direct_answer: "single candidate 1", key_points: ["s1"], disagreements_or_risks: [], uncertainties: ["s1"], recommended_direction: "s1" },
        { direct_answer: "single candidate 2", key_points: ["s2"], disagreements_or_risks: [], uncertainties: ["s2"], recommended_direction: "s2" },
        { final_answer: "single real answer", consensus_points: ["s"], divergence_points: [], uncertainties: ["s"], confidence: { level: "medium", reason: "single real" } },
        { direct_answer: "dual candidate a", key_points: ["a"], disagreements_or_risks: [], uncertainties: ["a"], recommended_direction: "a" },
        { direct_answer: "dual candidate b", key_points: ["b"], disagreements_or_risks: [], uncertainties: ["b"], recommended_direction: "b" },
        { final_answer: "dual real answer with two distinct answer paths", consensus_points: ["d"], divergence_points: ["dd"], uncertainties: ["du"], confidence: { level: "medium", reason: "dual real" } },
      ];
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(payloads[callCount - 1]) } }],
        }),
      };
    });

    const output = await runCompareDemo({
      inputFile: new URL("../examples/request.tradeoff.json", import.meta.url),
      runtime: {
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "https://example.test/v1",
        fetchImpl: fetchMock,
      },
    });

    const parsed = JSON.parse(output) as {
      single: { final_answer: string };
      dual: { final_answer: string };
      comparison: { stronger_for_this_case: string };
    };

    expect(callCount).toBe(6);
    expect(parsed.single.final_answer).toContain("single real answer");
    expect(parsed.dual.final_answer).toContain("dual real answer");
    expect(parsed.comparison.stronger_for_this_case).toBe("dual");
  });
});
