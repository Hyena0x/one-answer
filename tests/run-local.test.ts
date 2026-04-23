import { describe, expect, it, vi } from "vitest";

import { loadSynthesizeInputFromFile, runLocalSynthesize } from "../src/cli/run-local.js";

describe("loadSynthesizeInputFromFile", () => {
  it("loads a synthesize input JSON file", async () => {
    const input = await loadSynthesizeInputFromFile(new URL("../examples/request.decision.json", import.meta.url));

    expect(input.question).toContain("standalone AI desktop client");
    expect(input.preset).toBe("deep-reasoning");
    expect(input.goal).toBe("decision");
  });
});

describe("runLocalSynthesize", () => {
  it("returns pretty JSON output from a local file request", async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount += 1;
      const payloads = [
        {
          direct_answer: "Start with the narrow MCP path first.",
          key_points: ["It is smaller and easier to ship."],
          disagreements_or_risks: ["A visible UI may still help adoption."],
          uncertainties: ["The value of a thin demo layer is still uncertain."],
          recommended_direction: "Build the MCP path first.",
        },
        {
          direct_answer: "Do not fully remove the thin demo option yet.",
          key_points: ["A visible surface can help explain the product."],
          disagreements_or_risks: ["A backend-only tool may be harder to discover."],
          uncertainties: ["Adoption still needs real validation."],
          recommended_direction: "Keep only a thin demo option if needed.",
        },
        {
          final_answer: "Start with the narrow MCP path first, and only keep a thin demo layer if real distribution evidence shows it is necessary.",
          consensus_points: ["A smaller scope is easier to ship than a full desktop client."],
          divergence_points: ["The main disagreement is whether a thin demo layer should remain available."],
          uncertainties: ["The real distribution impact of a demo layer is still unclear."],
          confidence: {
            level: "medium",
            reason: "This single-model self-critique run supports a narrow-first approach, but it is not true multi-model consensus.",
          },
        },
      ];

      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(payloads[callCount - 1]) } }],
        }),
      };
    });

    const output = await runLocalSynthesize({
      inputFile: new URL("../examples/request.decision.json", import.meta.url),
      runtime: {
        mode: "single-model",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "https://example.test/v1",
        fetchImpl: fetchMock,
      },
    });

    const parsed = JSON.parse(output) as { final_answer: string; run_id: string };
    expect(callCount).toBe(3);
    expect(parsed.run_id).toMatch(/^single_/);
    expect(parsed.final_answer).toContain("narrow MCP path first");
    expect(output).toContain("consensus_points");
  });
});
