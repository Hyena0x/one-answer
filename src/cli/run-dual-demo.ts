import { loadSynthesizeInputFromFile } from "./run-local.js";
import { synthesizeDualModel, type CandidateArtifact, type DualFinalSynthesisPrompt, type DualModelSynthesisProvider } from "../core/one-answer.js";

function createDualDemoProvider(): DualModelSynthesisProvider {
  return {
    async complete(stage, prompt) {
      const question = "question" in prompt ? prompt.question.toLowerCase() : "";

      if (stage === "candidate_a") {
        const artifact: CandidateArtifact = question.includes("host integration") || question.includes("dual-model")
          ? {
              direct_answer: "Prioritize host integration and evaluation first.",
              key_points: [
                "Real workflow validation is the highest-leverage next milestone.",
              ],
              disagreements_or_risks: [
                "Dual-model quality gains may matter later, but not before usefulness is proven.",
              ],
              uncertainties: [
                "Current single-model usefulness still needs more evidence.",
              ],
              recommended_direction: "Do host integration first.",
            }
          : {
              direct_answer: "Start with the MCP-native capability first.",
              key_points: ["A narrower capability is easier to ship."],
              disagreements_or_risks: ["A thin demo surface may still help adoption."],
              uncertainties: ["Demo UI lift is still unproven."],
              recommended_direction: "Build the capability layer first.",
            };
        return artifact;
      }

      if (stage === "candidate_b") {
        const artifact: CandidateArtifact = question.includes("host integration") || question.includes("dual-model")
          ? {
              direct_answer: "Dual-model synthesis should wait unless current answer quality is clearly the bottleneck.",
              key_points: [
                "Higher synthesis complexity should follow evidence of need.",
              ],
              disagreements_or_risks: [
                "Premature model orchestration may widen scope too early.",
              ],
              uncertainties: [
                "Unknown whether users already find current answers useful enough.",
              ],
              recommended_direction: "Validate answer quality before widening scope.",
            }
          : {
              direct_answer: "Keep at most a thin UI if distribution really needs it.",
              key_points: ["Visible entry points can help explain the product."],
              disagreements_or_risks: ["A demo UI can become accidental product surface area."],
              uncertainties: ["Adoption lift from a thin UI is uncertain."],
              recommended_direction: "Only keep a very thin UI if needed.",
            };
        return artifact;
      }

      const typedPrompt = prompt as DualFinalSynthesisPrompt;
      return {
        final_answer: question.includes("host integration") || question.includes("dual-model")
          ? "Prioritize better host integration and evaluation before making dual-model synthesis the next major milestone. Two distinct answer paths both point to the same immediate move: prove usefulness in real workflows first, then widen synthesis complexity only if current answer quality still limits adoption."
          : "Start with the narrow MCP capability first, and only keep a very thin demo surface if real distribution evidence shows it is necessary.",
        consensus_points: question.includes("host integration") || question.includes("dual-model")
          ? [
              "Proof of usefulness in real host workflows should come before broader orchestration complexity.",
              "The current milestone should optimize for validation, not system breadth.",
            ]
          : [
              "A narrower capability is easier to ship than a heavy client surface.",
              "A thin UI is optional, not the core asset.",
            ],
        divergence_points: question.includes("host integration") || question.includes("dual-model")
          ? [
              "The remaining divergence changes sequencing: improve host integration now, or bet on immediate quality gains from dual-model synthesis now."
            ]
          : [
              "The main disagreement is whether a thin demo surface helps enough to justify early maintenance."
            ],
        uncertainties: question.includes("host integration") || question.includes("dual-model")
          ? [
              "You still need stronger evidence about current single-model usefulness before deciding whether broader orchestration is urgent."
            ]
          : [
              "The real distribution benefit of a thin demo surface still needs validation."
            ],
        confidence: {
          level: "medium",
          reason: "Two distinct answer paths converge on validating usefulness before broadening scope, but real usage evidence should still decide when dual-model complexity becomes worth it.",
        },
      };
    },
  };
}

export async function runDualDemo(input: { inputFile: string | URL }): Promise<string> {
  const request = await loadSynthesizeInputFromFile(input.inputFile);
  const result = await synthesizeDualModel(request, createDualDemoProvider());
  return JSON.stringify(result, null, 2);
}

async function main() {
  const inputFile = process.argv[2] ?? new URL("../../examples/request.tradeoff.json", import.meta.url);
  const output = await runDualDemo({ inputFile });
  process.stdout.write(`${output}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
