# One Answer prompt contract v1

This document defines the prompt and output contract for the internal V1 tool:
- `one_answer`

External product name:
- `One Answer`

Goal:
- produce one final answer a user can actually use
- avoid raw-output dumping
- preserve only the most decision-relevant structure
- support multi-model, dual-model, and single-model fallback modes

This is not a public API contract. It is the internal quality contract for candidate generation and synthesis.

## Core product promise

One Answer must do this well:
- ask multiple answer paths in the background
- return one clear final answer in the foreground

The user should feel:
- "I no longer need to manually merge 3 model answers myself."

## Non-goals

V1 should not optimize for:
- showing full raw model outputs
- proving every claim with citations
- exposing chain-of-thought
- producing exhaustive academic analysis
- turning every answer into a long report

## Output object target

The synthesis stage must produce data that fits the V1 output schema:
- `run_id`
- `final_answer`
- `consensus_points`
- `divergence_points`
- `uncertainties`
- `confidence`
- `meta`

The prompt contract exists to make these fields meaningful and stable.

## High-level runtime stages

V1 has two logical stages:

1. Candidate stage
- generate one or more answer candidates
- each candidate should represent a useful perspective, not just wording variation

2. Synthesis stage
- merge candidate outputs into one final usable answer
- identify stable agreement, meaningful disagreement, unresolved uncertainty, and calibrated confidence

## Stage 1: candidate contract

## Candidate purpose

Each candidate should help the synthesis stage answer one question:
- what is the best answer from this reasoning perspective?

Candidates are not final user-facing outputs.
Candidates are structured intermediate artifacts.

## Candidate roles

Possible candidate roles:
- `primary_reasoner`
- `challenger`
- `cross_checker`

Each role must produce materially useful information:
- `primary_reasoner`: best direct answer
- `challenger`: strongest objections, alternative interpretations, hidden risks
- `cross_checker`: compression, validation, simplification, or low-cost sanity check

## Candidate output shape

Recommended internal candidate structure:

```json
{
  "role": "primary_reasoner | challenger | cross_checker",
  "direct_answer": "string",
  "key_points": ["string"],
  "disagreements_or_risks": ["string"],
  "uncertainties": ["string"],
  "recommended_direction": "string"
}
```

This structure is internal and may evolve, but V1 should preserve these semantics.

## Candidate prompt requirements

Every candidate prompt must enforce these rules:

1. Answer the user's question directly.
2. Prefer concrete judgments over vague hedging.
3. Include caveats only when they materially change the answer.
4. Surface meaningful risks or objections.
5. Do not optimize for elegance over usefulness.
6. Do not imitate the other candidate roles.

## Candidate quality rules

A good candidate:
- takes a position
- names tradeoffs clearly
- identifies real risk or weakness
- does not wander into generic filler

A bad candidate:
- restates the question
- gives generic "it depends" language
- repeats the same answer with different wording
- lists many low-value caveats

## Candidate prompting by role

### primary_reasoner

Prompt intent:
- produce the best direct answer
- optimize for completeness and practical usefulness

Behavioral rules:
- answer first
- include the main rationale
- recommend a direction when the task is decision-oriented
- do not over-index on defensive caveats

### challenger

Prompt intent:
- pressure-test the main answer
- uncover weaknesses, missing assumptions, or better alternatives

Behavioral rules:
- look for where the obvious answer could fail
- identify hidden dependencies or failure modes
- challenge unsupported certainty
- do not disagree for the sake of disagreement

### cross_checker

Prompt intent:
- provide lightweight validation or a compressed independent pass

Behavioral rules:
- highlight what looks stable across interpretations
- identify what seems overcomplicated or overstated
- provide a cheaper/faster sanity check
- avoid bloated reasoning

## Single-model fallback contract

If only one model is available, V1 still runs the same logical stages with internal self-role prompting.

Required sequence:

1. `primary_reasoner` pass
2. `challenger` pass
3. `final_synthesis` pass

Single-model mode must follow these honesty rules:
- never imply broad cross-model agreement
- use narrower `consensus_points`
- rely more on `uncertainties`
- lower confidence on hard questions unless the answer is very bounded

## Stage 2: synthesis contract

## Synthesis purpose

The synthesis stage is where One Answer becomes a product.

Its job is not to summarize candidate outputs.
Its job is to decide what the user should walk away believing and doing.

## Synthesis priorities

In order:

1. produce one final usable answer
2. preserve important caveats that change action or interpretation
3. expose meaningful disagreement
4. expose unresolved uncertainty
5. calibrate confidence honestly

## Synthesis field-by-field contract

### 1) final_answer

This is the most important field.

Required properties:
- must answer the question immediately
- must be usable on its own without reading the rest of the object
- must sound like a conclusion, not a meeting note
- must be specific enough to guide action

Rules:
- answer first, explain second
- avoid opening with "based on the provided information" unless strictly necessary
- avoid generic neutrality if the evidence supports a directional answer
- when the task is decision-oriented, recommend one direction unless uncertainty truly blocks it

Good pattern:
- direct conclusion
- brief rationale
- bounded caveat if needed

Bad pattern:
- list all sides equally
- defer the conclusion to the end
- output a meta-summary instead of an answer

### 2) consensus_points

Purpose:
- capture the most meaningful stable conclusions shared across candidate reasoning paths

Rules:
- include only points that are materially shared
- do not include trivial wording overlap
- prefer 2-5 strong items over many weak ones
- if single-model mode, keep these conservative and narrow

Good examples:
- "The desktop client has a significantly higher maintenance burden than a narrow MCP tool."
- "A simpler product surface is more likely to reach users quickly."

Bad examples:
- "AI can be useful."
- "There are tradeoffs."

### 3) divergence_points

Purpose:
- capture meaningful places where candidate reasoning leads to different conclusions, emphases, or recommendations

Rules:
- only include disagreement that could affect the user's understanding or action
- do not report cosmetic phrasing differences
- keep each item user-readable and decision-relevant
- if disagreement is minor, say so implicitly by keeping the list short

Good examples:
- "Some reasoning paths recommend dropping the client entirely, while others suggest keeping a very thin demo surface for distribution."

Bad examples:
- "One answer used more cautious language than another."

### 4) uncertainties

Purpose:
- describe what remains unresolved after synthesis

Rules:
- uncertainty is not the same as disagreement
- uncertainty means the synthesis still cannot firmly know something important
- prioritize uncertainties that could change the final recommendation
- do not dump every possible unknown

Good examples:
- "Adoption depends on whether the synthesized output is clearly better than manual prompting."
- "The best preset mix may change depending on real provider availability and cost."

Bad examples:
- "There may be unknown unknowns."

### 5) confidence

Purpose:
- express synthesis confidence, not raw model confidence

Structure:
- `level`: `low | medium | high`
- `reason`: short, concrete explanation

Rules:
- confidence.reason is mandatory
- reason must reference why the conclusion is more or less stable
- mention degraded execution when relevant: same-provider only, dual-model only, single-model only, missing context, or strong disagreement

### Confidence calibration

Use `high` when:
- candidate reasoning materially converges
- disagreements are minor or non-action-changing
- uncertainties do not undermine the main recommendation

Use `medium` when:
- there is enough convergence for a useful answer
- but important caveats remain
- or only 2 candidates were available
- or synthesis relies on same-provider variation rather than broad diversity

Use `low` when:
- meaningful disagreement remains unresolved
- or only single-model self-critique supported a hard question
- or critical context is missing

## Synthesis prompt requirements

The synthesis prompt must instruct the model to:

1. produce one final answer, not a recap of candidates
2. separate agreement, disagreement, and uncertainty cleanly
3. avoid over-reporting disagreement
4. avoid flattening real disagreement into fake consensus
5. calibrate confidence conservatively when execution is degraded
6. optimize for user usefulness over rhetorical balance

## Required distinctions

### Consensus vs divergence

Consensus:
- what multiple reasoning paths materially support

Divergence:
- where reasoning paths materially differ in conclusion, emphasis, or recommendation

### Divergence vs uncertainty

Divergence:
- candidate answers disagree with each other

Uncertainty:
- the synthesis still cannot confidently resolve something important

This distinction must be preserved. V1 quality depends on it.

## Style controls

The synthesis stage should respect:
- `goal`
- `audience`
- `max_answer_style`

### By goal

#### answer
- default explanatory shape
- prioritize clarity and usefulness

#### decision
- push toward a recommendation
- explicitly note the best direction and major caveat

#### plan
- final_answer should be action-oriented and sequenced
- consensus/divergence should focus on implementation tradeoffs

#### debug
- final_answer should identify the most likely root cause or debugging direction
- uncertainties should focus on missing evidence

### By audience

#### general
- simpler language
- fewer technical assumptions

#### developer
- practical technical clarity
- acceptable use of product/engineering terminology

#### expert
- more compact, more precise, more assumption-dense language

### By max_answer_style

#### concise
- short final_answer
- minimal but meaningful supporting lists

#### balanced
- default
- enough detail to trust the result

#### detailed
- longer rationale
- richer caveats and structured nuance
- still avoid report bloat

## Failure modes to prevent

V1 must actively prevent these common failures:

### Failure 1: summary instead of answer

Bad:
- "The candidates discussed several tradeoffs..."

Fix:
- force final_answer to state the answer first

### Failure 2: fake consensus

Bad:
- smoothing over meaningful disagreement just to sound coherent

Fix:
- preserve action-relevant divergence

### Failure 3: disagreement spam

Bad:
- listing every minor wording difference as divergence

Fix:
- divergence must be action-relevant

### Failure 4: inflated confidence

Bad:
- `high` confidence from a single-model hard-question run

Fix:
- confidence must reflect execution mode and evidence quality

### Failure 5: vague uncertainty

Bad:
- "More research may be needed"

Fix:
- name the specific unresolved uncertainty

### Failure 6: raw-output smell

Bad:
- final result reads like lightly compressed candidate outputs

Fix:
- synthesis must integrate, not concatenate

## Gold standard examples

A gold-standard result should feel like:
- one strong answer
- a few highly relevant consensus points
- one or two meaningful divergence points
- a short list of real unresolved uncertainties
- confidence that sounds honest, not performative

## Recommended implementation checks

Before returning a V1 result, validate these heuristics:

- `final_answer` contains a direct answer in the first 1-2 sentences
- `consensus_points` are not empty unless true convergence is absent
- `divergence_points` do not just restate stylistic differences
- `uncertainties` are specific, not generic filler
- `confidence.reason` references actual convergence, disagreement, degradation, or missing context
- result reads like a final answer, not a summary of summaries

## Suggested internal reviewer checklist

Use this checklist during development or evaluation:

1. If I hide everything except `final_answer`, is the result still useful?
2. Are `consensus_points` genuinely shared, or just plausible?
3. Would removing `divergence_points` hide an action-relevant disagreement?
4. Are `uncertainties` the most decision-relevant unknowns?
5. Does `confidence` feel earned?
6. Would a user feel that this saved them real mental effort?

## Future extensions

Possible V2 additions:
- citation-aware synthesis
- evidence-backed trace mode
- optional raw candidate inspection
- structured recommendation objects by task type

Do not add these to V1 unless they materially improve the core final-answer experience.
