import { describe, expect, it } from "vitest";

import {
  buildStageSystemPrompt,
  buildStageUserPrompt,
} from "../src/prompts/single-model-prompts.js";

describe("single-model prompt builders", () => {
  it("builds a primary_reasoner prompt that asks for a direct answer", () => {
    const system = buildStageSystemPrompt("primary_reasoner");
    const user = buildStageUserPrompt("primary_reasoner", {
      question: "Should I build the desktop client or the MCP tool first?",
      context: "Solo project with limited time.",
      preset: "deep-reasoning",
      goal: "decision",
      audience: "developer",
      max_answer_style: "balanced",
    });

    expect(system).toContain("primary reasoner");
    expect(system).toContain("strict JSON");
    expect(user).toContain("Should I build the desktop client");
    expect(user).toContain("Answer directly");
    expect(user).toContain("recommended_direction");
  });

  it("builds a challenger prompt that references the previous answer", () => {
    const system = buildStageSystemPrompt("challenger");
    const user = buildStageUserPrompt("challenger", {
      question: "Should I build the desktop client or the MCP tool first?",
      preset: "deep-reasoning",
      goal: "decision",
      audience: "developer",
      max_answer_style: "balanced",
      previous: {
        direct_answer: "Ship the MCP tool first.",
        key_points: ["It is smaller and easier to ship."],
        disagreements_or_risks: ["A UI may still help distribution."],
        uncertainties: ["Adoption is still uncertain."],
        recommended_direction: "Build the MCP tool first.",
      },
    });

    expect(system).toContain("challenger");
    expect(user).toContain("Previous answer to challenge");
    expect(user).toContain("Ship the MCP tool first");
    expect(user).toContain("Do not disagree for the sake of disagreement");
  });

  it("builds a final_synthesis prompt that distinguishes consensus, divergence, and uncertainty", () => {
    const system = buildStageSystemPrompt("final_synthesis");
    const user = buildStageUserPrompt("final_synthesis", {
      question: "Should I build the desktop client or the MCP tool first?",
      preset: "deep-reasoning",
      goal: "decision",
      audience: "developer",
      max_answer_style: "balanced",
      primary: {
        direct_answer: "Ship the MCP tool first.",
        key_points: ["Smaller scope."],
        disagreements_or_risks: ["A UI may still help distribution."],
        uncertainties: ["Need validation."],
        recommended_direction: "Build MCP first.",
      },
      challenger: {
        direct_answer: "Keep at most a thin demo UI.",
        key_points: ["A visible surface may help adoption."],
        disagreements_or_risks: ["A backend-only product can be harder to explain."],
        uncertainties: ["The effect is unknown."],
        recommended_direction: "Only keep a thin UI if needed.",
      },
    });

    expect(system).toContain("final synthesizer");
    expect(user).toContain("consensus_points");
    expect(user).toContain("divergence_points");
    expect(user).toContain("uncertainties");
    expect(user).toContain("Do not dump raw candidate outputs");
  });

  it("adds stronger decision instructions for decision-oriented prompts", () => {
    const user = buildStageUserPrompt("final_synthesis", {
      question: "Should I build the desktop client or the MCP tool first?",
      preset: "deep-reasoning",
      goal: "decision",
      audience: "developer",
      max_answer_style: "balanced",
      primary: {
        direct_answer: "Build MCP first.",
        key_points: ["Smaller scope."],
        disagreements_or_risks: ["A demo UI may still help."],
        uncertainties: ["Need validation."],
        recommended_direction: "Build MCP first.",
      },
      challenger: {
        direct_answer: "Keep only a thin UI if needed.",
        key_points: ["A visible surface may help adoption."],
        disagreements_or_risks: ["The UI can grow too much."],
        uncertainties: ["The effect is unknown."],
        recommended_direction: "Keep the UI minimal.",
      },
    });

    expect(user).toContain("Recommend one direction unless uncertainty truly blocks it");
    expect(user).toContain("answer first, explain second");
  });

  it("adds evidence-first debugging instructions for debug prompts", () => {
    const user = buildStageUserPrompt("final_synthesis", {
      question: "What is the most likely debugging direction for the startup blank-screen issue?",
      preset: "deep-reasoning",
      goal: "debug",
      audience: "developer",
      max_answer_style: "balanced",
      primary: {
        direct_answer: "Start with startup instrumentation.",
        key_points: ["Initialization can block first render."],
        disagreements_or_risks: ["The fault may still be in hydration."],
        uncertainties: ["Exact blocking step unknown."],
        recommended_direction: "Instrument startup.",
      },
      challenger: {
        direct_answer: "Inspect render boundaries too.",
        key_points: ["Blank views can come from render guards."],
        disagreements_or_risks: ["Over-focusing on startup may miss render issues."],
        uncertainties: ["First successful paint boundary unknown."],
        recommended_direction: "Instrument startup and render boundaries.",
      },
    });

    expect(user).toContain("Name the highest-leverage debugging direction first");
    expect(user).toContain("Prefer evidence-first next steps over abstract advice");
  });
});
