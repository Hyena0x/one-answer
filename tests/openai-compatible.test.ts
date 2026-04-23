import { describe, expect, it, vi } from "vitest";

import {
  createDualOpenAICompatibleProvider,
  createOpenAICompatibleProvider,
  type OpenAICompatibleConfig,
} from "../src/providers/openai-compatible.js";

describe("createOpenAICompatibleProvider", () => {
  it("maps the three stages to structured JSON outputs via fetch", async () => {
    const responses = [
      {
        direct_answer: "Use the narrow MCP path first.",
        key_points: ["A smaller scope is easier to ship."],
        disagreements_or_risks: ["A UI may still help explain the product."],
        uncertainties: ["Real user pull still needs validation."],
        recommended_direction: "Ship the MCP path first.",
      },
      {
        direct_answer: "Do not fully discard a thin demo surface.",
        key_points: ["A visible entry point may help adoption."],
        disagreements_or_risks: ["Backend-only tools can be harder to discover."],
        uncertainties: ["The value of a demo layer is still unknown."],
        recommended_direction: "Keep only a very thin demo layer if needed.",
      },
      {
        final_answer: "Ship the narrow MCP path first, and only keep a very thin demo layer if distribution proves to need it.",
        consensus_points: ["A smaller scope is easier to ship than a full client."],
        divergence_points: ["The main disagreement is whether a thin demo layer should remain."],
        uncertainties: ["The adoption impact of a demo layer is still unproven."],
        confidence: {
          level: "medium",
          reason: "The self-critique pass supports the narrow path, but a single-model run should remain conservative.",
        },
      },
    ];

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(responses.shift()),
            },
          },
        ],
      }),
    }));

    const config: OpenAICompatibleConfig = {
      apiKey: "test-key",
      model: "gpt-test",
      baseUrl: "https://example.test/v1",
      fetchImpl: fetchMock,
    };

    const provider = createOpenAICompatibleProvider(config);

    const primary = await provider.complete("primary_reasoner", {
      question: "What should I build first?",
      preset: "deep-reasoning",
      goal: "decision",
      audience: "developer",
      max_answer_style: "balanced",
    });

    const challenger = await provider.complete("challenger", {
      question: "What should I build first?",
      preset: "deep-reasoning",
      goal: "decision",
      audience: "developer",
      max_answer_style: "balanced",
      previous: primary as never,
    });

    const final = await provider.complete("final_synthesis", {
      question: "What should I build first?",
      preset: "deep-reasoning",
      goal: "decision",
      audience: "developer",
      max_answer_style: "balanced",
      primary: primary as never,
      challenger: challenger as never,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((primary as { direct_answer: string }).direct_answer).toContain("MCP");
    expect((challenger as { direct_answer: string }).direct_answer).toContain("demo surface");
    expect((final as { final_answer: string }).final_answer).toContain("Ship the narrow MCP path first");

    const firstCall = fetchMock.mock.calls[0] as unknown as [string, { headers?: Record<string, string> }];
    expect(firstCall?.[0]).toBe("https://example.test/v1/chat/completions");
    expect(firstCall?.[1]?.headers?.Authorization).toBe("Bearer test-key");
  });
});

describe("createDualOpenAICompatibleProvider", () => {
  it("maps two candidate calls plus one final synthesis call via fetch", async () => {
    const responses = [
      {
        direct_answer: "Prioritize host integration first.",
        key_points: ["Real workflow proof matters first."],
        disagreements_or_risks: ["Dual-model may matter later."],
        uncertainties: ["Need current quality evidence."],
        recommended_direction: "Do host integration first.",
      },
      {
        direct_answer: "Dual-model should wait unless current quality is still the bottleneck.",
        key_points: ["Broader orchestration should follow evidence of need."],
        disagreements_or_risks: ["Premature orchestration widens scope too early."],
        uncertainties: ["Users may already find current output useful enough."],
        recommended_direction: "Validate usefulness before widening scope.",
      },
      {
        final_answer: "Prioritize host integration and evaluation first, then add dual-model synthesis if real usage still shows answer quality is the bottleneck.",
        consensus_points: ["Proof of usefulness should come before broader orchestration complexity."],
        divergence_points: ["The remaining tradeoff is whether quality gains justify more complexity right now."],
        uncertainties: ["Current single-model usefulness still needs stronger evidence."],
        confidence: {
          level: "medium",
          reason: "Two answer paths converge on validating usefulness before widening scope.",
        },
      },
    ];

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(responses.shift()) } }],
      }),
    }));

    const provider = createDualOpenAICompatibleProvider({
      apiKey: "test-key",
      model: "gpt-test",
      baseUrl: "https://example.test/v1",
      fetchImpl: fetchMock,
    });

    const candidateA = await provider.complete("candidate_a", {
      question: "Should the next milestone be dual-model synthesis or host integration?",
      preset: "deep-reasoning",
      goal: "decision",
      audience: "developer",
      max_answer_style: "balanced",
    });

    const candidateB = await provider.complete("candidate_b", {
      question: "Should the next milestone be dual-model synthesis or host integration?",
      preset: "deep-reasoning",
      goal: "decision",
      audience: "developer",
      max_answer_style: "balanced",
    });

    const final = await provider.complete("final_synthesis", {
      question: "Should the next milestone be dual-model synthesis or host integration?",
      preset: "deep-reasoning",
      goal: "decision",
      audience: "developer",
      max_answer_style: "balanced",
      candidateA: candidateA as never,
      candidateB: candidateB as never,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((candidateA as { direct_answer: string }).direct_answer).toContain("host integration");
    expect((candidateB as { direct_answer: string }).direct_answer).toContain("Dual-model");
    expect((final as { final_answer: string }).final_answer).toContain("Prioritize host integration and evaluation first");
  });
});
