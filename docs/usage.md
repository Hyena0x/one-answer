# One Answer Usage Guide

This guide keeps the practical setup details out of the README.

## Install

```bash
npm install @hyena0x/one-answer
```

For one-off MCP usage without adding the package to a project:

```bash
npx --yes --package @hyena0x/one-answer one-answer-mcp
```

## MCP Server

Start the stdio server from this repository:

```bash
npm run mcp
```

Start it from the published package:

```bash
npx --yes --package @hyena0x/one-answer one-answer-mcp
```

The server supports:

- `initialize`
- `tools/list`
- `tools/call`

The exposed tool is:

```text
one_answer
```

## MCP Host Config

Most MCP hosts use `command`, `args`, and optional `env`.

Stub-only wiring check:

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

Real OpenAI-compatible runtime:

```json
{
  "mcpServers": {
    "one-answer": {
      "command": "npx",
      "args": ["--yes", "--package", "@hyena0x/one-answer", "one-answer-mcp"],
      "env": {
        "ONE_ANSWER_MODE": "single-model",
        "ONE_ANSWER_API_KEY": "your_key",
        "ONE_ANSWER_MODEL": "gpt-4.1-mini",
        "ONE_ANSWER_BASE_URL": "https://api.openai.com/v1"
      }
    }
  }
}
```

Keep real API keys in user-local host config or host-level secret storage. Do not commit them.

## Library Usage

```ts
import { runOneAnswer } from "@hyena0x/one-answer";

const result = await runOneAnswer({
  question: "Should I use one model or compare multiple models for this decision?",
  preset: "deep-reasoning",
  goal: "decision",
  audience: "developer",
});

console.log(result);
```

## Runtime Modes

Default local runs use the built-in stub runtime. The stub verifies package shape, CLI wiring, schemas, and MCP plumbing without sending requests to a provider.

Real standalone mode needs:

- `ONE_ANSWER_MODE=single-model`
- `ONE_ANSWER_API_KEY`
- `ONE_ANSWER_MODEL`

Optional:

- `ONE_ANSWER_BASE_URL`

If `single-model` mode has no usable provider config, One Answer returns `NO_RUNTIME_PROVIDER`.

## Local Commands

Stub smoke:

```bash
npm run synthesize -- ./examples/request.decision.json
```

Real provider smoke:

```bash
ONE_ANSWER_MODE=single-model \
ONE_ANSWER_API_KEY=your_key \
ONE_ANSWER_MODEL=gpt-4.1-mini \
ONE_ANSWER_BASE_URL=https://api.openai.com/v1 \
npm run synthesize -- ./examples/request.decision.json
```

Host-injected provider demo:

```bash
npm run injected-demo -- ./examples/request.decision.json
```

Dual-model demo:

```bash
npm run dual-demo -- ./examples/request.tradeoff.json
```

Single-vs-dual demo:

```bash
npm run compare-demo -- ./examples/request.tradeoff.json
```

Golden eval:

```bash
npm run eval
```

## Presets

V1 presets:

- `fast-balanced`
- `deep-reasoning`
- `low-cost`

Clients should treat presets as stable names with server-defined internals.
