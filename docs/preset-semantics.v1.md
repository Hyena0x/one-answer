# One Answer preset semantics v1

This document defines the runtime behavior of V1 presets for One Answer.

Internal tool name:
- `one_answer`


Goal:
- keep the public API simple
- let the server choose model strategy internally
- support graceful degradation from multi-model to single-model mode
- preserve the product promise: return one more reliable final answer

## Core rule

Users select a preset, not a raw model bundle.

The preset decides:
- how many candidate passes to run
- what roles those passes play
- whether synthesis is cross-model or single-model self-critique
- how assertive the final answer should be

Clients should treat presets as stable names with unstable internals.
Do not assume a fixed provider/model list behind any preset.

## V1 preset list

- `fast-balanced`
- `deep-reasoning`
- `low-cost`

## Shared runtime concepts

### Candidate roles

V1 runtime should think in roles, not brands:

- `primary_reasoner`
  - produces the main answer candidate
  - should optimize for overall quality and completeness

- `challenger`
  - looks for missing assumptions, errors, edge cases, or stronger alternatives
  - should increase disagreement signal quality rather than verbosity

- `cross_checker`
  - validates, compresses, or reframes the answer from a lower-cost or faster perspective
  - useful for spotting unstable conclusions and cheap consensus signals

### Execution modes

V1 supports three execution modes internally:

1. `multi_model`
   - 3 or more distinct candidate runs are available
   - best mode for true consensus/divergence analysis

2. `dual_model`
   - 2 candidate runs are available
   - enough for disagreement detection but weaker consensus confidence

3. `single_model`
   - only 1 model is available
   - the system simulates synthesis via staged self-critique
   - should never pretend to be true cross-model consensus

### Synthesis posture

Each preset also implies a synthesis posture:

- `balanced`
  - answer clearly, but preserve important uncertainty

- `assertive`
  - prefer a strong final recommendation when evidence is reasonably aligned

- `conservative`
  - avoid overclaiming, surface caveats early, downgrade confidence more easily

## Preset semantics

## 1) fast-balanced

### Product intent

Use when the user wants a good answer quickly.
This should be the default preset for casual use and first-run demos.

### Target behavior

- fast response
- acceptable synthesis quality
- moderate cost
- good enough for broad usage

### Preferred internal composition

If enough providers/models are available:
- 1 fast high-quality candidate as `primary_reasoner`
- 1 fast or medium-speed candidate as `challenger`
- 1 cheap or fast candidate as `cross_checker`

Recommended shape:
- candidate count target: 3
- synthesis posture: `balanced`
- bias: speed over exhaustive deliberation

### Degradation rules

If 3 candidates available:
- run `multi_model`

If only 2 candidates available:
- run `dual_model`
- confidence should be slightly more conservative

If only 1 candidate available:
- run `single_model`
- use internal phases:
  1. draft answer
  2. critique / find weaknesses
  3. final synthesis
- confidence must explicitly acknowledge single-model limitation

### Best-fit scenarios

- general Q&A
- quick technical decisions
- first-pass product strategy
- lightweight debugging direction

## 2) deep-reasoning

### Product intent

Use when the user wants the strongest final answer quality, not the fastest turnaround.
This should be the flagship preset for hard technical and strategic questions.

### Target behavior

- slower but stronger synthesis
- more explicit handling of disagreement and uncertainty
- better for ambiguous, high-stakes, or technical tasks

### Preferred internal composition

If enough providers/models are available:
- 1 strongest available candidate as `primary_reasoner`
- 1 independent strong candidate as `challenger`
- 1 fast or lower-cost candidate as `cross_checker`

Recommended shape:
- candidate count target: 3
- synthesis posture: `balanced` leaning `conservative`
- bias: answer quality and failure detection over latency

### Degradation rules

If 3 candidates available:
- run `multi_model`
- prefer diversity across model families when possible

If only 2 candidates available:
- run `dual_model`
- preserve divergence carefully; do not flatten disagreement too aggressively

If only 1 candidate available:
- run `single_model`
- use expanded internal phases:
  1. produce candidate answer
  2. generate strongest objections / alternative interpretations
  3. revise answer with explicit unresolved uncertainties
- confidence ceiling should generally be lower than true multi-model mode

### Best-fit scenarios

- architecture decisions
- root-cause reasoning
- implementation planning
- difficult tradeoffs
- strategy calls with long-term implications

## 3) low-cost

### Product intent

Use when the user cares about minimal spend and still wants a synthesized answer.
This preset protects affordability, not maximum rigor.

### Target behavior

- lowest cost
- acceptable final answer quality
- greater willingness to operate in dual-model or single-model mode

### Preferred internal composition

If enough providers/models are available:
- 1 cheap candidate as `primary_reasoner`
- 1 cheap or free candidate as `challenger`
- optional cheap `cross_checker` only if cost budget allows

Recommended shape:
- candidate count target: 2
- synthesis posture: `balanced` leaning `assertive`
- bias: cost containment over broad model diversity

### Degradation rules

If 2 or more candidates available:
- prefer `dual_model`
- only add third candidate if marginal cost is very low

If only 1 candidate available:
- run `single_model`
- use lightweight self-critique:
  1. draft
  2. counterpoints
  3. final answer
- keep latency low and token budget restrained

### Best-fit scenarios

- frequent daily use
- budget-sensitive personal workflows
- simple planning
- non-critical drafting and summarization

## Model selection policy

V1 should not expose provider/model selection in the public schema.
However, the server should follow these internal rules.

### Selection principles

1. Prefer model diversity over brand loyalty when multiple providers are available.
2. Prefer one strong candidate and one disagree-capable candidate over three near-identical candidates.
3. When forced into same-provider mode, vary role prompts aggressively.
4. Do not block usage just because only one model is available.
5. Be honest in confidence reasoning about degraded execution.

### Provider availability tiers

At runtime, the server can think in terms of availability tiers:

- Tier A: multiple providers and multiple strong models available
- Tier B: one provider with multiple usable models available
- Tier C: one usable model only
- Tier D: no usable models available

Behavior:
- Tier A -> use normal preset composition
- Tier B -> preserve role diversity via prompting and model tier variation
- Tier C -> use `single_model` synthesis
- Tier D -> return `UPSTREAM_FAILURE` or `SYNTHESIS_FAILED` depending on cause

## Same-provider behavior

If only one provider ecosystem is available, the preset should still work.

Example approach:
- `primary_reasoner`: strongest or most capable model in that provider set
- `challenger`: faster or differently prompted model from the same provider set
- `cross_checker`: cheapest viable model or another differently prompted pass

Important:
- same-provider synthesis is valid
- but confidence reasoning should avoid language like "broad cross-model consensus" unless there is real cross-family diversity

## Single-model behavior

Single-model mode is a first-class fallback, not an error.

### Purpose

The goal is not to fake multi-model consensus.
The goal is to deliver a better final answer than a single naive completion.

### Required internal phases

V1 single-model synthesis should include at least:

1. `answer_draft`
   - answer the question directly

2. `self_critique`
   - identify likely weak points, hidden assumptions, missing context, and best objections

3. `final_synthesis`
   - produce the final answer, explicit uncertainties, and calibrated confidence

### Single-model constraints

- never claim strong consensus
- keep `consensus_points` narrowly worded
- use `uncertainties` more actively
- cap `confidence.level` unless the problem is simple and well-bounded

## Confidence calibration rules

Confidence is not raw model confidence.
It is synthesis confidence.

### High confidence

Use only when:
- candidate answers materially align on the recommendation or answer
- disagreements are limited or non-critical
- uncertainties do not undermine the main conclusion

### Medium confidence

Use when:
- there is useful convergence but important caveats remain
- or only 2 candidates were available
- or the synthesis relied on same-provider diversity rather than true cross-family diversity

### Low confidence

Use when:
- candidate disagreement is substantial
- or only single-model self-critique was available for a hard question
- or the context is insufficient to support a stable answer

## Output shaping rules by preset

### fast-balanced
- shorter `final_answer`
- fewer divergence points
- emphasize clarity and speed

### deep-reasoning
- richer `final_answer`
- preserve more caveats and unresolved tensions
- better separation between divergence and uncertainty

### low-cost
- concise `final_answer`
- avoid unnecessary reasoning sprawl
- only include the most important consensus and uncertainty items

## Non-goals for V1 presets

V1 presets do not define:
- exact provider names
- exact model IDs
- token budgets in the public contract
- user-tunable weights
- user-visible routing graphs

Those are implementation details and should stay server-side.

## Recommended default preset

V1 default should be:
- `fast-balanced`

Reason:
- easiest first-run experience
- better latency for demos and adoption
- simpler to explain

Flagship preset for serious usage:
- `deep-reasoning`

Budget preset:
- `low-cost`

## Future extension points

Possible V2 additions:
- `code-review`
- `fact-sensitive`
- `debate-heavy`
- `strict-conservative`

Do not add these in V1 unless the current three presets are clearly insufficient.
