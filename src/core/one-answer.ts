import { z } from "zod";

export type SynthesizeGoal = "answer" | "decision" | "plan" | "debug";
export type SynthesizeAudience = "general" | "developer" | "expert";
export type SynthesizeAnswerStyle = "concise" | "balanced" | "detailed";
export type ConfidenceLevel = "low" | "medium" | "high";
export type CandidateStage = "primary_reasoner" | "challenger";
export type DualCandidateStage = "candidate_a" | "candidate_b";
export type SynthesisStage = "final_synthesis";
export type RuntimeStage = CandidateStage | SynthesisStage;

export type SynthesizeInput = {
  question: string;
  context?: string;
  preset: string;
  goal?: SynthesizeGoal;
  audience?: SynthesizeAudience;
  max_answer_style?: SynthesizeAnswerStyle;
};

export type SynthesizeOutput = {
  run_id: string;
  final_answer: string;
  consensus_points: string[];
  divergence_points: string[];
  uncertainties: string[];
  confidence: {
    level: ConfidenceLevel;
    reason: string;
  };
  meta: {
    preset: string;
    goal: SynthesizeGoal;
    audience: SynthesizeAudience;
    answer_style: SynthesizeAnswerStyle;
  };
};

export type CandidateArtifact = {
  direct_answer: string;
  key_points: string[];
  disagreements_or_risks: string[];
  uncertainties: string[];
  recommended_direction: string;
};

export type FinalSynthesisArtifact = {
  final_answer: string;
  consensus_points: string[];
  divergence_points: string[];
  uncertainties: string[];
  confidence: {
    level: ConfidenceLevel;
    reason: string;
  };
};

export type PrimaryPrompt = {
  question: string;
  context?: string;
  preset: string;
  goal: SynthesizeGoal;
  audience: SynthesizeAudience;
  max_answer_style: SynthesizeAnswerStyle;
};

export type ChallengerPrompt = PrimaryPrompt & {
  previous: CandidateArtifact;
};

export type FinalSynthesisPrompt = PrimaryPrompt & {
  primary: CandidateArtifact;
  challenger: CandidateArtifact;
};

export type DualFinalSynthesisPrompt = PrimaryPrompt & {
  candidateA: CandidateArtifact;
  candidateB: CandidateArtifact;
};

export type SingleModelPrompt = PrimaryPrompt | ChallengerPrompt | FinalSynthesisPrompt;
export type SingleModelArtifact = CandidateArtifact | FinalSynthesisArtifact;

export type SingleModelSynthesisProvider = {
  complete(stage: RuntimeStage, prompt: SingleModelPrompt): Promise<SingleModelArtifact>;
};

export type DualModelPrompt = PrimaryPrompt | DualFinalSynthesisPrompt;
export type DualModelArtifact = CandidateArtifact | FinalSynthesisArtifact;

export type DualModelSynthesisProvider = {
  complete(stage: DualCandidateStage | SynthesisStage, prompt: DualModelPrompt): Promise<DualModelArtifact>;
};

const DEFAULT_GOAL: SynthesizeGoal = "answer";
const DEFAULT_AUDIENCE: SynthesizeAudience = "general";
const DEFAULT_STYLE: SynthesizeAnswerStyle = "balanced";

const candidateArtifactSchema = z.object({
  direct_answer: z.string().min(1),
  key_points: z.array(z.string()),
  disagreements_or_risks: z.array(z.string()),
  uncertainties: z.array(z.string()),
  recommended_direction: z.string().min(1),
}).strict();

const finalSynthesisArtifactSchema = z.object({
  final_answer: z.string().min(1),
  consensus_points: z.array(z.string()),
  divergence_points: z.array(z.string()),
  uncertainties: z.array(z.string()),
  confidence: z.object({
    level: z.enum(["low", "medium", "high"]),
    reason: z.string().min(1),
  }).strict(),
}).strict();

function compactTimestamp(now: Date) {
  return now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function normalizeInput(input: SynthesizeInput) {
  return {
    ...input,
    goal: input.goal ?? DEFAULT_GOAL,
    audience: input.audience ?? DEFAULT_AUDIENCE,
    max_answer_style: input.max_answer_style ?? DEFAULT_STYLE,
  };
}

function buildStubAnswerText(input: ReturnType<typeof normalizeInput>) {
  const base = input.goal === "decision"
    ? "The current best direction is to prefer the narrower, easier-to-ship path over the heavier product surface."
    : "Here is the current synthesized answer based on the available reasoning paths.";

  const referencesDesktopClient = /desktop client|standalone/i.test(`${input.question}\n${input.context ?? ""}`);

  if (referencesDesktopClient) {
    return `${base} For this question, the safer recommendation is to stop investing in the desktop client as the primary surface and move toward a narrower integration-first approach.`;
  }

  return `${base} This stub result is intentionally simple and will later be replaced by real candidate generation and synthesis.`;
}

function ensureSingleModelConfidence(artifact: FinalSynthesisArtifact): FinalSynthesisArtifact {
  const reason = artifact.confidence.reason.toLowerCase();
  const mentionsSingleModel = reason.includes("single-model") || reason.includes("one model");
  const level = artifact.confidence.level === "high" ? "medium" : artifact.confidence.level;
  const normalizedReason = mentionsSingleModel
    ? artifact.confidence.reason
    : `${artifact.confidence.reason} Only one model was available, so this result comes from self-critique rather than true cross-model agreement.`;

  const uncertainties = artifact.uncertainties.length > 0
    ? artifact.uncertainties
    : ["This result comes from a single-model self-critique flow and still needs real-world validation."];

  return {
    ...artifact,
    uncertainties,
    confidence: {
      level,
      reason: normalizedReason,
    },
  };
}

function formatArtifactIssue(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) {
    return "artifact is invalid";
  }
  const path = issue.path.length ? issue.path.join(".") : "artifact";
  return `${path}: ${issue.message}`;
}

function validateCandidateArtifact(
  stage: CandidateStage | DualCandidateStage,
  value: SingleModelArtifact | DualModelArtifact,
): CandidateArtifact {
  const parsed = candidateArtifactSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`${stage} must return a valid candidate artifact: ${formatArtifactIssue(parsed.error)}.`);
  }
  return parsed.data;
}

function validateFinalSynthesisArtifact(
  stage: SynthesisStage,
  value: SingleModelArtifact | DualModelArtifact,
): FinalSynthesisArtifact {
  const parsed = finalSynthesisArtifactSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`${stage} must return a valid final synthesis artifact: ${formatArtifactIssue(parsed.error)}.`);
  }
  return parsed.data;
}

export function buildSynthesizeStubResult(input: SynthesizeInput, now = new Date()): SynthesizeOutput {
  const normalized = normalizeInput(input);

  return {
    run_id: `stub_${compactTimestamp(now)}`,
    final_answer: buildStubAnswerText(normalized),
    consensus_points: [
      "A narrower product surface is usually easier to ship and validate than a heavier client surface.",
      "The synthesized answer should optimize for user usefulness, not raw model output volume.",
    ],
    divergence_points: [
      "A later version may still keep a thin demo surface if distribution requires a visible UI.",
    ],
    uncertainties: [
      "Real output quality still depends on model availability, prompt quality, and the final synthesis implementation.",
    ],
    confidence: {
      level: "medium",
      reason: "This is an implementation stub with product-shaped structure, not a real multi-model synthesis run yet.",
    },
    meta: {
      preset: normalized.preset,
      goal: normalized.goal,
      audience: normalized.audience,
      answer_style: normalized.max_answer_style,
    },
  };
}

export async function synthesizeSingleModel(
  input: SynthesizeInput,
  provider: SingleModelSynthesisProvider,
  now = new Date(),
): Promise<SynthesizeOutput> {
  const normalized = normalizeInput(input);

  const primaryPrompt: PrimaryPrompt = {
    question: normalized.question,
    context: normalized.context,
    preset: normalized.preset,
    goal: normalized.goal,
    audience: normalized.audience,
    max_answer_style: normalized.max_answer_style,
  };

  const primaryResult = await provider.complete("primary_reasoner", primaryPrompt);
  const primary = validateCandidateArtifact("primary_reasoner", primaryResult);

  const challengerPrompt: ChallengerPrompt = {
    ...primaryPrompt,
    previous: primary,
  };

  const challengerResult = await provider.complete("challenger", challengerPrompt);
  const challenger = validateCandidateArtifact("challenger", challengerResult);

  const synthesisPrompt: FinalSynthesisPrompt = {
    ...primaryPrompt,
    primary,
    challenger,
  };

  const finalResult = await provider.complete("final_synthesis", synthesisPrompt);
  const artifact = ensureSingleModelConfidence(validateFinalSynthesisArtifact("final_synthesis", finalResult));

  return {
    run_id: `single_${compactTimestamp(now)}`,
    final_answer: artifact.final_answer,
    consensus_points: artifact.consensus_points,
    divergence_points: artifact.divergence_points,
    uncertainties: artifact.uncertainties,
    confidence: artifact.confidence,
    meta: {
      preset: normalized.preset,
      goal: normalized.goal,
      audience: normalized.audience,
      answer_style: normalized.max_answer_style,
    },
  };
}

export async function synthesizeDualModel(
  input: SynthesizeInput,
  provider: DualModelSynthesisProvider,
  now = new Date(),
): Promise<SynthesizeOutput> {
  const normalized = normalizeInput(input);

  const prompt: PrimaryPrompt = {
    question: normalized.question,
    context: normalized.context,
    preset: normalized.preset,
    goal: normalized.goal,
    audience: normalized.audience,
    max_answer_style: normalized.max_answer_style,
  };

  const candidateAResult = await provider.complete("candidate_a", prompt);
  const candidateA = validateCandidateArtifact("candidate_a", candidateAResult);

  const candidateBResult = await provider.complete("candidate_b", prompt);
  const candidateB = validateCandidateArtifact("candidate_b", candidateBResult);

  const synthesisPrompt: DualFinalSynthesisPrompt = {
    ...prompt,
    candidateA,
    candidateB,
  };

  const finalResult = await provider.complete("final_synthesis", synthesisPrompt);
  const artifact = validateFinalSynthesisArtifact("final_synthesis", finalResult);

  return {
    run_id: `dual_${compactTimestamp(now)}`,
    final_answer: artifact.final_answer,
    consensus_points: artifact.consensus_points,
    divergence_points: artifact.divergence_points,
    uncertainties: artifact.uncertainties,
    confidence: artifact.confidence,
    meta: {
      preset: normalized.preset,
      goal: normalized.goal,
      audience: normalized.audience,
      answer_style: normalized.max_answer_style,
    },
  };
}
