# One Answer

Many answers in. One answer out.

One Answer is a tiny MCP/API primitive for agents that ask multiple models, prompts, or runtimes and need one decision-ready result.

```bash
npx --yes --package @hyena0x/one-answer one-answer-mcp
```

## The Problem

Multi-model products are easy to demo and hard to trust.

Users do not want five model transcripts. They want to know:

- what should I do?
- what do the answers agree on?
- where could this still be wrong?

One Answer packages that into one narrow tool.

## The Primitive

```text
one_answer(question, preset) -> answer + caveats + confidence
```

Use it when a product, agent, or workflow needs a final answer instead of a comparison table.

## What It Returns

- `final_answer`: the answer you can show or act on
- `consensus_points`: what the answer paths agree on
- `divergence_points`: meaningful disagreement
- `uncertainties`: what is still unresolved
- `confidence`: level plus reason

## Quick Start

```bash
npm install @hyena0x/one-answer
```

Add One Answer to any MCP host that supports stdio servers:

```json
{
  "mcpServers": {
    "one-answer": {
      "command": "npx",
      "args": ["--yes", "--package", "@hyena0x/one-answer", "one-answer-mcp"]
    }
  }
}
```

Then call:

```text
one_answer
```

## Library Usage

```ts
import { runOneAnswer } from "@hyena0x/one-answer";

const result = await runOneAnswer({
  question: "Should this product stay MCP-first?",
  preset: "deep-reasoning",
  goal: "decision",
  audience: "developer",
});

console.log(result.final_answer);
```

## Output Example

```json
{
  "final_answer": "Use the narrow MCP-first path first.",
  "consensus_points": ["The smaller surface is easier to adopt."],
  "divergence_points": ["A thin UI may still help demos later."],
  "uncertainties": ["Real adoption still needs validation."],
  "confidence": {
    "level": "medium",
    "reason": "The answer paths agree on sequence, but usage data is still missing."
  }
}
```

## Local Smoke

Default local runs use a built-in stub, so you can verify the package without calling a model provider.

```bash
npm run synthesize -- ./examples/request.decision.json
```

## Where It Fits

- coding agents deciding between implementation paths
- research assistants reconciling model opinions
- product workflows that need a single recommendation
- internal tools that need confidence without a compare UI

## V1 Promise

One public tool:

```text
one_answer
```

No chat UI. No dashboard. No storage. No product ceremony.

## Use a Real Provider

Real OpenAI-compatible runtime setup, MCP host env config, and local demos live in the usage guide.

- [Usage guide](docs/usage.md)

## Docs

- [Input schema](schemas/one_answer.input.v1.json)
- [Output schema](schemas/one_answer.output.v1.json)
- [Error schema](schemas/error.v1.json)
- [Preset semantics](docs/preset-semantics.v1.md)
- [Prompt contract](docs/prompt-contract.v1.md)
- [Golden eval](docs/golden-eval.v1.md)
- [Changelog](CHANGELOG.md)
