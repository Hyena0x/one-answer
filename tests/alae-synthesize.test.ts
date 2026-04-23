import { describe, expect, it } from "vitest";

import {
  buildSynthesizeStubResult,
  synthesizeDualModel,
  synthesizeSingleModel,
  type ChallengerPrompt,
  type FinalSynthesisPrompt,
  type PrimaryPrompt,
  type SynthesizeInput,
  type SingleModelSynthesisProvider,
  type DualModelSynthesisProvider,
} from "../src/core/alae-synthesize.js";

describe("buildSynthesizeStubResult", () => {
  it("returns a schema-shaped stub result for a decision prompt", () => {
    const input: SynthesizeInput = {
      question: "Should I keep building a desktop client or pivot to MCP?",
      context: "Solo project, limited time, need faster adoption.",
      preset: "deep-reasoning",
      goal: "decision",
      audience: "developer",
      max_answer_style: "balanced",
    };

    const result = buildSynthesizeStubResult(input);

    expect(result.run_id).toMatch(/^stub_/);
    expect(result.final_answer.toLowerCase()).toContain("desktop client");
    expect(result.meta).toEqual({
      preset: "deep-reasoning",
      goal: "decision",
      audience: "developer",
      answer_style: "balanced",
    });
    expect(result.consensus_points.length).toBeGreaterThan(0);
    expect(result.confidence.level).toBe("medium");
  });
});

describe("synthesizeSingleModel", () => {
  it("runs primary, challenger, then final synthesis in order", async () => {
    const calls: string[] = [];

    const provider: SingleModelSynthesisProvider = {
      async complete(stage, prompt) {
        calls.push(stage);

        if (stage === "primary_reasoner") {
          const typedPrompt = prompt as PrimaryPrompt;
          expect(typedPrompt.question).toContain("desktop client");
          return {
            direct_answer: "Pivot away from the desktop client.",
            key_points: ["A narrow tool is easier to ship."],
            disagreements_or_risks: ["A desktop UI may still help distribution."],
            uncertainties: ["Need to prove output quality."],
            recommended_direction: "Build a narrow MCP tool.",
          };
        }

        if (stage === "challenger") {
          const typedPrompt = prompt as ChallengerPrompt;
          expect(typedPrompt.previous.direct_answer).toContain("desktop client");
          return {
            direct_answer: "Do not kill the UI too early if distribution depends on it.",
            key_points: ["A thin demo surface may still be useful."],
            disagreements_or_risks: ["Pure backend products can be harder to explain."],
            uncertainties: ["Real adoption depends on demonstration quality."],
            recommended_direction: "Keep at most a thin demo layer.",
          };
        }

        const typedPrompt = prompt as FinalSynthesisPrompt;
        expect(typedPrompt.primary.direct_answer).toContain("Pivot away");
        expect(typedPrompt.challenger.direct_answer).toContain("Do not kill the UI too early");
        return {
          final_answer: "Pivot away from the standalone desktop client, but keep the option of a thin demo layer if distribution needs it.",
          consensus_points: [
            "A narrower product is easier to ship than a full desktop client.",
          ],
          divergence_points: [
            "The main disagreement is whether even a thin UI should be retained for distribution.",
          ],
          uncertainties: [
            "It is still unclear how much a demo surface affects adoption.",
          ],
          confidence: {
            level: "medium",
            reason: "This is a single-model self-critique run, so the result is useful but not true cross-model consensus.",
          },
        };
      },
    };

    const result = await synthesizeSingleModel(
      {
        question: "Should I keep building a standalone desktop client or pivot to an MCP tool?",
        context: "Solo open-source project with limited time.",
        preset: "deep-reasoning",
        goal: "decision",
        audience: "developer",
        max_answer_style: "balanced",
      },
      provider,
      new Date("2026-04-15T10:11:12.000Z"),
    );

    expect(calls).toEqual(["primary_reasoner", "challenger", "final_synthesis"]);
    expect(result.run_id).toBe("single_20260415101112");
    expect(result.final_answer).toContain("thin demo layer");
    expect(result.meta.goal).toBe("decision");
  });

  it("keeps confidence conservative in single-model mode", async () => {
    const provider: SingleModelSynthesisProvider = {
      async complete(stage) {
        if (stage === "final_synthesis") {
          return {
            final_answer: "Use the narrower path first.",
            consensus_points: ["A smaller scope is easier to ship."],
            divergence_points: [],
            uncertainties: ["This still needs real user validation."],
            confidence: {
              level: "medium",
              reason: "Only one model was available, so this result comes from self-critique rather than true multi-model agreement.",
            },
          };
        }

        return {
          direct_answer: "Use the narrower path first.",
          key_points: ["A smaller scope is easier to ship."],
          disagreements_or_risks: [],
          uncertainties: ["This still needs real user validation."],
          recommended_direction: "Start narrower.",
        };
      },
    };

    const result = await synthesizeSingleModel(
      {
        question: "What should I ship first?",
        preset: "fast-balanced",
      },
      provider,
      new Date("2026-04-15T10:11:12.000Z"),
    );

    expect(result.confidence.level).not.toBe("high");
    expect(result.confidence.reason.toLowerCase()).toContain("one model");
    expect(result.uncertainties.length).toBeGreaterThan(0);
  });
});

describe("synthesizeDualModel", () => {
  it("runs two candidate providers then a final synthesis provider", async () => {
    const calls: string[] = [];

    const provider: DualModelSynthesisProvider = {
      async complete(stage, prompt) {
        calls.push(stage);

        if (stage === "candidate_a") {
          const typedPrompt = prompt as PrimaryPrompt;
          expect(typedPrompt.question).toContain("host integration");
          return {
            direct_answer: "Prioritize host integration first.",
            key_points: ["Real workflow proof matters first."],
            disagreements_or_risks: ["Dual-model may improve quality later."],
            uncertainties: ["Need to validate current answer quality."],
            recommended_direction: "Do host integration first.",
          };
        }

        if (stage === "candidate_b") {
          const typedPrompt = prompt as PrimaryPrompt;
          expect(typedPrompt.question).toContain("host integration");
          return {
            direct_answer: "Dual-model synthesis could be the next milestone if answer quality is still weak.",
            key_points: ["Quality improvements may justify the extra complexity."],
            disagreements_or_risks: ["Broader orchestration may come too early."],
            uncertainties: ["Unknown whether users already find single-model useful enough."],
            recommended_direction: "Validate quality before widening scope.",
          };
        }

        const typedPrompt = prompt as FinalSynthesisPrompt & {
          candidateA: { direct_answer: string };
          candidateB: { direct_answer: string };
        };
        expect(typedPrompt.candidateA.direct_answer).toContain("host integration");
        expect(typedPrompt.candidateB.direct_answer).toContain("Dual-model synthesis");
        return {
          final_answer: "Prioritize host integration and evaluation first, then add dual-model synthesis if real usage shows current answer quality is still the main bottleneck.",
          consensus_points: ["Real workflow proof should come before broader complexity."],
          divergence_points: ["The main tradeoff is whether quality gains justify dual-model complexity right now."],
          uncertainties: ["You still need evidence about current single-model usefulness."],
          confidence: {
            level: "medium",
            reason: "Two distinct answer paths converge on validating usefulness before broadening complexity.",
          },
        };
      },
    };

    const result = await synthesizeDualModel(
      {
        question: "Should the next milestone be dual-model synthesis or better host integration and evaluation?",
        preset: "deep-reasoning",
        goal: "decision",
        audience: "developer",
        max_answer_style: "balanced",
      },
      provider,
      new Date("2026-04-15T10:11:12.000Z"),
    );

    expect(calls).toEqual(["candidate_a", "candidate_b", "final_synthesis"]);
    expect(result.run_id).toBe("dual_20260415101112");
    expect(result.final_answer).toContain("host integration and evaluation first");
    expect(result.confidence.reason.toLowerCase()).toContain("two distinct answer paths");
  });
});
