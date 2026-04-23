import { describe, expect, it, vi } from "vitest";

import { runAlaeSynthesize } from "../src/index.js";
import type { DualModelSynthesisProvider, SingleModelSynthesisProvider } from "../src/core/alae-synthesize.js";

describe("runAlaeSynthesize", () => {
  it("uses real single-model mode when runtime config is provided", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                direct_answer: "Start with the narrow integration-first path.",
                key_points: ["A smaller surface is easier to validate."],
                disagreements_or_risks: ["A demo UI might still help distribution."],
                uncertainties: ["The distribution tradeoff still needs validation."],
                recommended_direction: "Start narrow.",
              }),
            },
          },
        ],
      }),
    }));

    let callCount = 0;
    fetchMock.mockImplementation(async () => {
      callCount += 1;
      const payloads = [
        {
          direct_answer: "Start with the narrow integration-first path.",
          key_points: ["A smaller surface is easier to validate."],
          disagreements_or_risks: ["A demo UI might still help distribution."],
          uncertainties: ["The distribution tradeoff still needs validation."],
          recommended_direction: "Start narrow.",
        },
        {
          direct_answer: "Do not over-commit to removing all UI immediately.",
          key_points: ["A thin demo layer may still help explain the product."],
          disagreements_or_risks: ["Pure backend tools can be harder to discover."],
          uncertainties: ["The demo effect is still uncertain."],
          recommended_direction: "Only keep a thin UI if needed.",
        },
        {
          final_answer: "Start with the narrow integration-first path, and only keep a very thin demo UI if real distribution data shows it is needed.",
          consensus_points: ["A smaller initial surface is easier to ship."],
          divergence_points: ["The main disagreement is whether any thin UI should remain."],
          uncertainties: ["The impact of a thin demo UI on adoption is still unclear."],
          confidence: {
            level: "medium",
            reason: "This single-model self-critique run supports a narrow-first strategy, but it is not true multi-model consensus.",
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

    const result = await runAlaeSynthesize(
      {
        question: "Should I build the desktop client or the MCP tool first?",
        preset: "deep-reasoning",
        goal: "decision",
        audience: "developer",
      },
      {
        mode: "single-model",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "https://example.test/v1",
        fetchImpl: fetchMock,
      },
    );

    expect(callCount).toBe(3);
    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("unexpected error result");
    expect(result.run_id).toMatch(/^single_/);
    expect(result.final_answer).toContain("narrow integration-first path");
    expect(result.confidence.reason.toLowerCase()).toContain("single-model");
  });

  it("prefers an injected provider over apiKey/model config", async () => {
    const calls: string[] = [];
    const injectedProvider: SingleModelSynthesisProvider = {
      async complete(stage) {
        calls.push(stage);
        if (stage === "final_synthesis") {
          return {
            final_answer: "Use the injected provider path.",
            consensus_points: ["Injected provider should win."],
            divergence_points: [],
            uncertainties: ["This is a test run."],
            confidence: {
              level: "medium",
              reason: "Only one model was available via injected provider.",
            },
          };
        }

        return {
          direct_answer: "Use the injected provider path.",
          key_points: ["Injected provider should win."],
          disagreements_or_risks: [],
          uncertainties: ["This is a test run."],
          recommended_direction: "Use injected provider.",
        };
      },
    };

    const result = await runAlaeSynthesize(
      {
        question: "What runtime should be used?",
        preset: "fast-balanced",
      },
      {
        provider: injectedProvider,
        mode: "single-model",
        apiKey: "ignored-key",
        model: "ignored-model",
      },
    );

    expect(calls).toEqual(["primary_reasoner", "challenger", "final_synthesis"]);
    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("unexpected error result");
    expect(result.final_answer).toContain("injected provider");
  });

  it("returns a structured no-runtime error when no usable runtime exists", async () => {
    const result = await runAlaeSynthesize(
      {
        question: "What should I do next?",
        preset: "fast-balanced",
      },
      {
        mode: "single-model",
      },
    );

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.code).toBe("NO_RUNTIME_PROVIDER");
      expect(result.error.retryable).toBe(false);
    }
  });

  it("rejects missing required input before runtime resolution", async () => {
    const result = await runAlaeSynthesize(
      {
        preset: "fast-balanced",
      } as never,
      {
        mode: "stub",
      },
    );

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.code).toBe("INVALID_INPUT");
      expect(result.error.retryable).toBe(false);
      expect(result.error.message).toContain("question");
    }
  });

  it("rejects unknown presets before calling a runtime provider", async () => {
    const complete = vi.fn();

    const result = await runAlaeSynthesize(
      {
        question: "What should I do next?",
        preset: "unknown-preset",
      },
      {
        mode: "single-model",
        provider: { complete },
      },
    );

    expect(complete).not.toHaveBeenCalled();
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.code).toBe("UNKNOWN_PRESET");
      expect(result.error.retryable).toBe(false);
      expect(result.error.message).toContain("unknown-preset");
    }
  });

  it("rejects malformed candidate artifacts before later synthesis stages", async () => {
    const complete = vi.fn(async (stage: string) => {
      if (stage === "primary_reasoner") {
        return {
          direct_answer: 123,
        };
      }

      throw new Error("later stages should not run");
    });

    const result = await runAlaeSynthesize(
      {
        question: "What should I do next?",
        preset: "fast-balanced",
      },
      {
        mode: "single-model",
        provider: { complete },
      },
    );

    expect(complete).toHaveBeenCalledTimes(1);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.code).toBe("UPSTREAM_FAILURE");
      expect(result.error.message).toContain("primary_reasoner must return a valid candidate artifact");
    }
  });

  it("routes deep-reasoning to dual-model when both providers are available", async () => {
    const calls: string[] = [];
    const singleProvider: SingleModelSynthesisProvider = {
      async complete(stage) {
        calls.push(`single:${stage}`);
        if (stage === "final_synthesis") {
          return {
            final_answer: "single path",
            consensus_points: [],
            divergence_points: [],
            uncertainties: ["single"],
            confidence: { level: "medium", reason: "single" },
          };
        }
        return {
          direct_answer: "single path",
          key_points: [],
          disagreements_or_risks: [],
          uncertainties: ["single"],
          recommended_direction: "single",
        };
      },
    };
    const dualProvider: DualModelSynthesisProvider = {
      async complete(stage) {
        calls.push(`dual:${stage}`);
        if (stage === "final_synthesis") {
          return {
            final_answer: "dual path",
            consensus_points: ["dual"],
            divergence_points: ["dual divergence"],
            uncertainties: ["dual uncertainty"],
            confidence: { level: "medium", reason: "dual" },
          };
        }
        return {
          direct_answer: "dual candidate",
          key_points: ["dual"],
          disagreements_or_risks: [],
          uncertainties: ["dual"],
          recommended_direction: "dual",
        };
      },
    };

    const result = await runAlaeSynthesize(
      {
        question: "What should the next milestone be?",
        preset: "deep-reasoning",
        goal: "decision",
      },
      {
        provider: singleProvider,
        dualProvider,
      },
    );

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("unexpected error result");
    expect(result.run_id).toMatch(/^dual_/);
    expect(result.final_answer).toContain("dual path");
    expect(calls).toEqual(["dual:candidate_a", "dual:candidate_b", "dual:final_synthesis"]);
  });

  it("routes deep-reasoning to dual-model when only real apiKey/model config is available in auto mode", async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount += 1;
      const payloads = [
        {
          direct_answer: "candidate a",
          key_points: ["a"],
          disagreements_or_risks: [],
          uncertainties: ["a"],
          recommended_direction: "a",
        },
        {
          direct_answer: "candidate b",
          key_points: ["b"],
          disagreements_or_risks: [],
          uncertainties: ["b"],
          recommended_direction: "b",
        },
        {
          final_answer: "dual via real config",
          consensus_points: ["dual"],
          divergence_points: ["dual divergence"],
          uncertainties: ["dual uncertainty"],
          confidence: { level: "medium", reason: "dual real route" },
        },
      ];
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(payloads[callCount - 1]) } }],
        }),
      };
    });

    const result = await runAlaeSynthesize(
      {
        question: "What should the next milestone be?",
        preset: "deep-reasoning",
        goal: "decision",
      },
      {
        mode: "auto",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "https://example.test/v1",
        fetchImpl: fetchMock,
      },
    );

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("unexpected error result");
    expect(result.run_id).toMatch(/^dual_/);
    expect(result.final_answer).toContain("dual via real config");
    expect(callCount).toBe(3);
  });

  it("routes fast-balanced to single-model when both providers are available", async () => {
    const calls: string[] = [];
    const singleProvider: SingleModelSynthesisProvider = {
      async complete(stage) {
        calls.push(`single:${stage}`);
        if (stage === "final_synthesis") {
          return {
            final_answer: "single preferred",
            consensus_points: ["single"],
            divergence_points: [],
            uncertainties: ["single"],
            confidence: { level: "medium", reason: "single provider path" },
          };
        }
        return {
          direct_answer: "single preferred",
          key_points: ["single"],
          disagreements_or_risks: [],
          uncertainties: ["single"],
          recommended_direction: "single",
        };
      },
    };
    const dualProvider: DualModelSynthesisProvider = {
      async complete(stage) {
        calls.push(`dual:${stage}`);
        if (stage === "final_synthesis") {
          return {
            final_answer: "dual path",
            consensus_points: [],
            divergence_points: [],
            uncertainties: ["dual"],
            confidence: { level: "medium", reason: "dual" },
          };
        }
        return {
          direct_answer: "dual candidate",
          key_points: [],
          disagreements_or_risks: [],
          uncertainties: ["dual"],
          recommended_direction: "dual",
        };
      },
    };

    const result = await runAlaeSynthesize(
      {
        question: "What should I ship first?",
        preset: "fast-balanced",
      },
      {
        provider: singleProvider,
        dualProvider,
      },
    );

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("unexpected error result");
    expect(result.run_id).toMatch(/^single_/);
    expect(result.final_answer).toContain("single preferred");
    expect(calls).toEqual(["single:primary_reasoner", "single:challenger", "single:final_synthesis"]);
  });
});
