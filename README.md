# One Answer

Ask many models once. Get one final answer.

One Answer is a narrow MCP/API-first product for the multi-model AI era. It runs multiple answer paths in the background, then returns one answer a user can actually use.

Instead of dumping raw outputs from several models, One Answer returns only the decision-relevant structure:
- one final answer
- key consensus
- important disagreement
- unresolved uncertainty
- calibrated confidence

## What One Answer is

One Answer is the final-answer layer for multi-model AI workflows.

Use it when:
- multiple AI answers may disagree
- you do not want to manually merge GPT, Claude, Gemini, or other model outputs
- you want one clear answer with explicit caveats
- you care more about the final decision than raw comparison output

## What One Answer is not

- not a desktop client
- not a generic chat UI
- not a raw compare dashboard
- not a full tracing/audit product in V1

## V1 scope

V1 intentionally does one thing only:
- public tool: `alae_synthesize`

Not in V1:
- public compare tool
- public trace tool
- report retrieval/debug API
- full client surface

## Product naming

External product name:
- `One Answer`

Internal V1 tool name:
- `alae_synthesize`

Why the split:
- `One Answer` is the user-facing product identity
- `alae_synthesize` is the implementation-level tool name used by MCP/API integrations

## V1 tool contract

One-line definition:
- Input a question and a preset, return a directly usable final answer plus consensus, divergence, uncertainty, and confidence.

## Input schema summary

Required:
- `question`
- `preset`

Optional:
- `context`
- `goal`
- `audience`
- `max_answer_style`

See:
- `schemas/alae_synthesize.input.v1.json`

## Output schema summary

Returns:
- `run_id`
- `final_answer`
- `consensus_points`
- `divergence_points`
- `uncertainties`
- `confidence`
- `meta`

See:
- `schemas/alae_synthesize.output.v1.json`

## Error schema summary

Standard error object:
- `INVALID_INPUT`
- `UNKNOWN_PRESET`
- `NO_RUNTIME_PROVIDER`
- `UPSTREAM_FAILURE`
- `SYNTHESIS_FAILED`
- `TIMEOUT`

See:
- `schemas/error.v1.json`

## V1 presets

Recommended starting presets:
- `fast-balanced`
- `deep-reasoning`
- `low-cost`

These are server-defined presets. Clients should not assume any fixed internal model bundle.

## V1 product rules

1. `final_answer` must answer first, explain second.
2. The tool should not dump raw model outputs by default.
3. `consensus_points` should only contain meaningfully shared conclusions.
4. `divergence_points` should reflect real disagreement, not wording differences.
5. `uncertainties` should capture what remains unresolved after synthesis.
6. `confidence.reason` is mandatory; confidence must never be score-only.

## Positioning

Recommended external tagline:
- `Turn multiple AI answers into one answer you can actually use.`

Short version:
- `Ask many models once. Get one final answer.`

## Local smoke run

Default stub run:

```bash
npm run synthesize
```

Run with a specific input file:

```bash
npm run synthesize -- ./examples/request.decision.json
```

## Runtime resolution order

One Answer is designed for embedded/hosted use first.

When `mode=single-model`, runtime resolution should follow this order:
1. use an injected host/provider if one is supplied
2. otherwise use local OpenAI-compatible config
3. otherwise return a structured `NO_RUNTIME_PROVIDER` error

When `mode=auto` or no explicit mode override is given, the current routing strategy is:
- `deep-reasoning` -> prefer dual-model if a `dualProvider` is available, or if real OpenAI-compatible config can be used to construct one
- `fast-balanced` -> prefer single-model
- `low-cost` -> prefer single-model
- if the preferred route is unavailable, fall back to the best available route

This means end users do not necessarily need to configure provider env vars if the host already provides LLM access.

## MCP stdio server

Start the minimal MCP stdio server:

```bash
npm run mcp
```

It currently supports:
- `initialize`
- `tools/list`
- `tools/call`

Exposed tool:
- `alae_synthesize`

This is the recommended embedded/hosted integration path for agent runtimes and MCP-capable hosts.

## Host-injected provider demo

Run a demo that simulates the ideal embedded mode: the host injects a provider directly, so the end user does not need to configure API keys.

```bash
npm run injected-demo -- ./examples/request.decision.json
```

This is the closest local demonstration of the intended product shape:
- host owns model access
- One Answer owns synthesis behavior
- end users do not need to understand provider configuration

## Dual-model demo

Run a minimal dual-model synthesis demo:

```bash
npm run dual-demo -- ./examples/request.tradeoff.json
```

This is the first step beyond self-critique mode:
- two answer paths
- one synthesized result
- useful for validating whether broader orchestration changes the recommendation quality enough to matter

## Single vs dual compare demo

Run a direct comparison between single-model and dual-model outputs for the same input:

```bash
npm run compare-demo -- ./examples/request.tradeoff.json
```

This is the fastest way to evaluate whether multi-path synthesis is producing meaningfully stronger final answers.

The compare CLI also supports real OpenAI-compatible runtime config when called programmatically, so single and dual can be compared against the same real provider setup.

Run against a real OpenAI-compatible endpoint in standalone dev mode:

```bash
ONE_ANSWER_MODE=single-model \
ONE_ANSWER_API_KEY=your_key \
ONE_ANSWER_MODEL=gpt-4.1-mini \
ONE_ANSWER_BASE_URL=https://api.openai.com/v1 \
npm run synthesize -- ./examples/request.decision.json
```

Required env for standalone real mode:
- `ONE_ANSWER_MODE=single-model`
- `ONE_ANSWER_API_KEY`
- `ONE_ANSWER_MODEL`

Optional:
- `ONE_ANSWER_BASE_URL`

## Example request

```json
{
  "question": "Should I keep building a standalone AI desktop client or pivot to a narrow MCP tool?",
  "context": "Small solo open-source project. Limited time. Need something more likely to get adoption.",
  "preset": "deep-reasoning",
  "goal": "decision",
  "audience": "developer",
  "max_answer_style": "balanced"
}
```

## Example response

```json
{
  "run_id": "syn_01jv9x8zq8j5k2m4r7c1",
  "final_answer": "You should pivot away from the standalone desktop client and focus on a narrow MCP-native tool. For a solo project, the client has too much UI and platform overhead, while a synthesis tool is easier to ship, easier to integrate into existing workflows, and more likely to get real usage.",
  "consensus_points": [
    "A standalone client has high maintenance overhead for a solo developer.",
    "A narrow MCP/API tool fits existing AI workflows more naturally.",
    "A synthesis-focused product is easier to explain and validate with users."
  ],
  "divergence_points": [
    "Some candidate answers may still recommend keeping a very thin demo UI for distribution."
  ],
  "uncertainties": [
    "Adoption still depends on whether the synthesized output feels clearly better than manual prompting."
  ],
  "confidence": {
    "level": "high",
    "reason": "The candidate answers align strongly on reducing product surface area and prioritizing a narrow integration-first capability."
  },
  "meta": {
    "preset": "deep-reasoning",
    "goal": "decision",
    "audience": "developer",
    "answer_style": "balanced"
  }
}
```

## Next recommended docs

After schema lock-in, the next docs to add are:
- prompt contract v1
- preset semantics v1
- golden examples for evaluation
