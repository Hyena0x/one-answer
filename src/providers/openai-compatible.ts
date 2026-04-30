import {
  buildStageSystemPrompt,
  buildStageUserPrompt,
} from "../prompts/single-model-prompts.js";
import type {
  CandidateArtifact,
  DualCandidateStage,
  DualModelArtifact,
  DualModelPrompt,
  DualModelSynthesisProvider,
  FinalSynthesisArtifact,
  RuntimeStage,
  SingleModelPrompt,
  SingleModelSynthesisProvider,
} from "../core/one-answer.js";

type MinimalResponse = {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
};

export type FetchLike = (input: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<MinimalResponse>;

export type OpenAICompatibleConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function getEndpoint(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function extractMessageContent(payload: ChatCompletionResponse) {
  const content = payload.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI-compatible response did not include a message content string.");
  }
  return content;
}

function parseStructuredArtifact(content: string): CandidateArtifact | FinalSynthesisArtifact {
  const parsed = JSON.parse(content) as CandidateArtifact | FinalSynthesisArtifact;
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Structured output must be a JSON object.");
  }
  return parsed;
}

async function completeWithOpenAICompatible(
  config: OpenAICompatibleConfig,
  stage: RuntimeStage | DualCandidateStage,
  prompt: SingleModelPrompt | DualModelPrompt,
): Promise<CandidateArtifact | FinalSynthesisArtifact> {
  const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  const fetchImpl = config.fetchImpl ?? fetch;

  const response = await fetchImpl(getEndpoint(baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildStageSystemPrompt(stage === "candidate_a" || stage === "candidate_b" ? "primary_reasoner" : stage),
        },
        {
          role: "user",
          content: buildStageUserPrompt(stage === "candidate_a" || stage === "candidate_b" ? "primary_reasoner" : stage, prompt as never),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible request failed with status ${response.status ?? "unknown"}.`);
  }

  const json = (await response.json()) as ChatCompletionResponse;
  return parseStructuredArtifact(extractMessageContent(json));
}

export function createOpenAICompatibleProvider(config: OpenAICompatibleConfig): SingleModelSynthesisProvider {
  return {
    async complete(stage, prompt) {
      return completeWithOpenAICompatible(config, stage, prompt);
    },
  };
}

export function createDualOpenAICompatibleProvider(config: OpenAICompatibleConfig): DualModelSynthesisProvider {
  return {
    async complete(stage, prompt) {
      return completeWithOpenAICompatible(config, stage, prompt);
    },
  };
}
