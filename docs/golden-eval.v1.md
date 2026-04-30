# One Answer golden eval v1

This document defines the lightweight local evaluation loop for One Answer V1.

## Goal

The purpose of the golden eval is not to prove model quality in the abstract.
It is to catch product regressions in the answer shape that One Answer is supposed to deliver.

In V1, a good eval should answer:

- did the synthesized answer still recommend the expected direction?
- did the dual-path output preserve the signal we wanted to demonstrate?
- did the comparison summary still explain why the dual path is stronger for this case?

## Current format

Each eval case is a JSON file under:

- `examples/golden/*.eval.json`

Current fields:

- `name`
- `input_file`
- `expected_winner`
- `single_final_answer_must_include`
- `dual_final_answer_must_include`
- `comparison_notes_must_include`

These are intentionally narrow substring checks.
The goal is to keep the eval stable across small wording changes while still catching obvious regressions.

## Run locally

Run all golden eval cases:

```bash
npm run eval
```

Run a specific case:

```bash
npm run eval -- ./examples/golden/tradeoff.eval.json
```

## Interpretation

Pass means:

- the current demo compare flow still matches the expected product signal
- the result still looks like "one answer" instead of a raw compare dump

Fail means one of three things:

1. the product behavior regressed
2. the golden expectation is too brittle
3. the intended product message has changed and the eval should be updated on purpose

Do not silently loosen a failing case without checking which of those three happened.
