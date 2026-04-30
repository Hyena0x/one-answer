import type {
  ChallengerPrompt,
  FinalSynthesisPrompt,
  PrimaryPrompt,
  RuntimeStage,
  SingleModelPrompt,
} from "../core/one-answer.js";

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function buildSharedContext(prompt: PrimaryPrompt) {
  return [
    `Question:\n${prompt.question}`,
    prompt.context ? `Context:\n${prompt.context}` : null,
    `Preset: ${prompt.preset}`,
    `Goal: ${prompt.goal}`,
    `Audience: ${prompt.audience}`,
    `Answer style: ${prompt.max_answer_style}`,
  ].filter(Boolean).join("\n\n");
}

export function buildStageSystemPrompt(stage: RuntimeStage) {
  switch (stage) {
    case "primary_reasoner":
      return [
        "You are the primary reasoner for One Answer.",
        "Return strict JSON only.",
        "Answer directly, not with a recap.",
        "Produce: direct_answer, key_points, disagreements_or_risks, uncertainties, recommended_direction.",
      ].join(" ");
    case "challenger":
      return [
        "You are the challenger for One Answer.",
        "Return strict JSON only.",
        "Pressure-test the previous answer, surface missing assumptions, and identify better alternatives if they exist.",
        "Do not disagree for the sake of disagreement.",
        "Produce: direct_answer, key_points, disagreements_or_risks, uncertainties, recommended_direction.",
      ].join(" ");
    case "final_synthesis":
      return [
        "You are the final synthesizer for One Answer.",
        "Return strict JSON only.",
        "Produce one final usable answer, not a recap of candidate outputs.",
        "Produce: final_answer, consensus_points, divergence_points, uncertainties, confidence.",
      ].join(" ");
  }
}

function buildGoalSpecificSynthesisInstructions(prompt: PrimaryPrompt) {
  switch (prompt.goal) {
    case "decision":
      return [
        "- Recommend one direction unless uncertainty truly blocks it.",
        "- answer first, explain second.",
        "- Keep only caveats that could change the decision.",
      ];
    case "debug":
      return [
        "- Name the highest-leverage debugging direction first.",
        "- Prefer evidence-first next steps over abstract advice.",
        "- Make uncertainties point to the missing proof or missing trace that would narrow the issue.",
      ];
    case "plan":
      return [
        "- Make the final_answer action-oriented and sequenced.",
        "- Prefer concrete next steps over broad strategy language.",
      ];
    case "answer":
    default:
      return [
        "- Keep the final_answer clear, direct, and usable on its own.",
      ];
  }
}

export function buildStageUserPrompt(stage: RuntimeStage, prompt: SingleModelPrompt) {
  switch (stage) {
    case "primary_reasoner": {
      const typedPrompt = prompt as PrimaryPrompt;
      return [
        buildSharedContext(typedPrompt),
        "Instructions:",
        "- Answer directly.",
        "- Name the strongest key points.",
        "- Include only meaningful risks and uncertainties.",
        "- End with a recommended_direction.",
        "- Return strict JSON with keys: direct_answer, key_points, disagreements_or_risks, uncertainties, recommended_direction.",
      ].join("\n\n");
    }
    case "challenger": {
      const typedPrompt = prompt as ChallengerPrompt;
      return [
        buildSharedContext(typedPrompt),
        "Previous answer to challenge:",
        prettyJson(typedPrompt.previous),
        "Instructions:",
        "- Challenge missing assumptions, hidden risks, and better alternatives.",
        "- Do not disagree for the sake of disagreement.",
        "- Return strict JSON with keys: direct_answer, key_points, disagreements_or_risks, uncertainties, recommended_direction.",
      ].join("\n\n");
    }
    case "final_synthesis": {
      const typedPrompt = prompt as FinalSynthesisPrompt;
      return [
        buildSharedContext(typedPrompt),
        "Primary candidate:",
        prettyJson(typedPrompt.primary),
        "Challenger candidate:",
        prettyJson(typedPrompt.challenger),
        "Instructions:",
        "- Produce one final answer the user can actually use.",
        ...buildGoalSpecificSynthesisInstructions(typedPrompt),
        "- Distinguish consensus_points, divergence_points, and uncertainties clearly.",
        "- Do not dump raw candidate outputs.",
        "- Return strict JSON with keys: final_answer, consensus_points, divergence_points, uncertainties, confidence.",
      ].join("\n\n");
    }
  }
}
