import {
  buildSynthesizeStubResult,
  synthesizeDualModel,
  synthesizeSingleModel,
  type DualModelSynthesisProvider,
  type SingleModelSynthesisProvider,
  type SynthesizeInput,
  type SynthesizeOutput,
} from "./core/one-answer.js";
import {
  createDualOpenAICompatibleProvider,
  createOpenAICompatibleProvider,
  type FetchLike,
} from "./providers/openai-compatible.js";
import { z } from "zod";

const VALID_PRESETS = ["fast-balanced", "deep-reasoning", "low-cost"] as const;

const inputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["question", "preset"],
  properties: {
    question: { type: "string", minLength: 1, maxLength: 12000 },
    context: { type: "string", maxLength: 24000 },
    preset: { type: "string", enum: VALID_PRESETS },
    goal: { type: "string", enum: ["answer", "decision", "plan", "debug"], default: "answer" },
    audience: { type: "string", enum: ["general", "developer", "expert"], default: "general" },
    max_answer_style: { type: "string", enum: ["concise", "balanced", "detailed"], default: "balanced" },
  },
} as const;

const synthesizeInputSchema = z.object({
  question: z.string().min(1).max(12000),
  context: z.string().max(24000).optional(),
  preset: z.string().min(1).max(64),
  goal: z.enum(["answer", "decision", "plan", "debug"]).optional(),
  audience: z.enum(["general", "developer", "expert"]).optional(),
  max_answer_style: z.enum(["concise", "balanced", "detailed"]).optional(),
}).strict();

export type RuntimeConfig = {
  mode?: "stub" | "single-model" | "auto";
  provider?: SingleModelSynthesisProvider;
  dualProvider?: DualModelSynthesisProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
};

export type RuntimeErrorCode =
  | "INVALID_INPUT"
  | "UNKNOWN_PRESET"
  | "NO_RUNTIME_PROVIDER"
  | "UPSTREAM_FAILURE"
  | "SYNTHESIS_FAILED"
  | "TIMEOUT";

export type RuntimeErrorResult = {
  error: {
    code: RuntimeErrorCode;
    message: string;
    retryable: boolean;
  };
};

export type RunOneAnswerResult = SynthesizeOutput | RuntimeErrorResult;

export function createToolManifest() {
  return {
    name: "one_answer",
    title: "One Answer",
    description:
      "Turn multiple AI answer paths into one final answer the user can actually use, with consensus, disagreement, uncertainty, and confidence.",
    inputSchema,
  };
}

function readRuntimeConfigFromEnv(): RuntimeConfig {
  return {
    mode: process.env.ONE_ANSWER_MODE === "single-model"
      ? "single-model"
      : process.env.ONE_ANSWER_MODE === "auto"
        ? "auto"
        : "stub",
    apiKey: process.env.ONE_ANSWER_API_KEY,
    model: process.env.ONE_ANSWER_MODEL,
    baseUrl: process.env.ONE_ANSWER_BASE_URL,
  };
}

function noRuntimeProviderError(): RuntimeErrorResult {
  return {
    error: {
      code: "NO_RUNTIME_PROVIDER",
      message:
        "One Answer did not receive any usable model runtime from the host, and no local fallback configuration is available.",
      retryable: false,
    },
  };
}

function invalidInputError(message: string): RuntimeErrorResult {
  return {
    error: {
      code: "INVALID_INPUT",
      message,
      retryable: false,
    },
  };
}

function unknownPresetError(preset: string): RuntimeErrorResult {
  return {
    error: {
      code: "UNKNOWN_PRESET",
      message: `Unknown preset: ${preset}. Expected one of: ${VALID_PRESETS.join(", ")}.`,
      retryable: false,
    },
  };
}

function validateSynthesizeInput(input: unknown): SynthesizeInput | RuntimeErrorResult {
  const parsed = synthesizeInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "input";
    const detail = issue ? `${path}: ${issue.message}` : "input is invalid";
    return invalidInputError(`Invalid one_answer input: ${detail}.`);
  }

  if (!VALID_PRESETS.includes(parsed.data.preset as (typeof VALID_PRESETS)[number])) {
    return unknownPresetError(parsed.data.preset);
  }

  return parsed.data;
}

function resolveSingleModelProvider(runtime: RuntimeConfig): SingleModelSynthesisProvider | null {
  if (runtime.provider) {
    return runtime.provider;
  }

  if (runtime.apiKey && runtime.model) {
    return createOpenAICompatibleProvider({
      apiKey: runtime.apiKey,
      model: runtime.model,
      baseUrl: runtime.baseUrl,
      fetchImpl: runtime.fetchImpl,
    });
  }

  return null;
}

function resolveDualModelProvider(runtime: RuntimeConfig): DualModelSynthesisProvider | null {
  if (runtime.dualProvider) {
    return runtime.dualProvider;
  }

  if (runtime.apiKey && runtime.model) {
    return createDualOpenAICompatibleProvider({
      apiKey: runtime.apiKey,
      model: runtime.model,
      baseUrl: runtime.baseUrl,
      fetchImpl: runtime.fetchImpl,
    });
  }

  return null;
}

function shouldUseDualModel(input: SynthesizeInput, runtime: RuntimeConfig) {
  if (!resolveDualModelProvider(runtime)) {
    return false;
  }
  if (runtime.mode === "single-model") {
    return false;
  }
  return input.preset === "deep-reasoning";
}

export async function runOneAnswer(
  input: SynthesizeInput,
  runtimeConfig?: RuntimeConfig,
): Promise<RunOneAnswerResult> {
  const validatedInput = validateSynthesizeInput(input);
  if ("error" in validatedInput) {
    return validatedInput;
  }

  const runtime = runtimeConfig ?? readRuntimeConfigFromEnv();

  if (runtime.mode === "stub") {
    return buildSynthesizeStubResult(validatedInput);
  }

  if (shouldUseDualModel(validatedInput, runtime)) {
    try {
      return await synthesizeDualModel(validatedInput, resolveDualModelProvider(runtime) as DualModelSynthesisProvider);
    } catch (error) {
      return {
        error: {
          code: "UPSTREAM_FAILURE",
          message: error instanceof Error ? error.message : "Unknown upstream failure.",
          retryable: true,
        },
      };
    }
  }

  if (runtime.mode === "single-model" || runtime.mode === "auto" || runtime.provider || runtime.apiKey) {
    const provider = resolveSingleModelProvider(runtime);
    if (!provider) {
      return noRuntimeProviderError();
    }

    try {
      return await synthesizeSingleModel(validatedInput, provider);
    } catch (error) {
      return {
        error: {
          code: "UPSTREAM_FAILURE",
          message: error instanceof Error ? error.message : "Unknown upstream failure.",
          retryable: true,
        },
      };
    }
  }

  return buildSynthesizeStubResult(validatedInput);
}

async function main() {
  const manifest = createToolManifest();
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
