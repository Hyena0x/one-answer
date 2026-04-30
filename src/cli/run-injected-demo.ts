import { loadSynthesizeInputFromFile } from "./run-local.js";
import { runOneAnswer, type RuntimeConfig, type RunOneAnswerResult } from "../index.js";
import type {
  CandidateArtifact,
  FinalSynthesisArtifact,
  RuntimeStage,
  SingleModelPrompt,
  SingleModelSynthesisProvider,
} from "../core/one-answer.js";

function createInjectedDemoProvider(): SingleModelSynthesisProvider {
  return {
    async complete(stage: RuntimeStage, prompt: SingleModelPrompt) {
      const question = "question" in prompt ? prompt.question.toLowerCase() : "";
      const goal = "goal" in prompt ? prompt.goal : "answer";

      if (stage === "primary_reasoner") {
        const artifact: CandidateArtifact = question.includes("debug") || question.includes("startup") || goal === "debug"
          ? {
              direct_answer: "Start by profiling startup initialization order and temporarily disabling non-essential startup tasks to isolate the blank-screen path.",
              key_points: [
                "The highest-leverage first move is to isolate startup work instead of guessing at rendering issues.",
                "Initialization tasks like provider refresh, i18n, theme hydration, and local DB loading can block or race the first render.",
              ],
              disagreements_or_risks: [
                "The issue may still be rendering-related, but startup sequencing is the most leverage-rich place to begin.",
              ],
              uncertainties: [
                "Without a trace or timings, the exact blocking step is still unknown.",
              ],
              recommended_direction: "Instrument startup and remove tasks one by one until the blank-content path becomes predictable.",
            }
          : goal === "plan"
            ? {
                direct_answer: "The next 2 weeks should focus on output quality first, then host integration polish, not new product surface area.",
                key_points: [
                  "The biggest remaining risk is answer quality, not architecture.",
                  "A few strong examples and prompt tuning will do more than adding more infrastructure right now.",
                ],
                disagreements_or_risks: [
                  "It may be tempting to build more shell features before validating result quality.",
                ],
                uncertainties: [
                  "You still need to confirm that real outputs feel clearly better than manual prompting.",
                ],
                recommended_direction: "Spend the next 2 weeks on quality tuning, golden examples, and host-friendly integration validation.",
              }
            : goal === "answer"
              ? {
                  direct_answer: "One Answer matters because it removes the manual work of merging multiple AI answers into one usable conclusion.",
                  key_points: [
                    "Developers already use multiple models and waste time reconciling conflicting answers.",
                    "One Answer gives them one final answer with visible uncertainty instead of a raw compare dump.",
                  ],
                  disagreements_or_risks: [
                    "The value only feels obvious if the final answer is clearly better than manually reading model outputs.",
                  ],
                  uncertainties: [
                    "You still need sharper examples to prove the difference quickly.",
                  ],
                  recommended_direction: "Explain it as the final-answer layer for developers who already ask multiple AI models the same question.",
                }
              : {
                  direct_answer: question.includes("host integration") || question.includes("dual-model")
                    ? "Prioritize better host integration and evaluation before making dual-model synthesis the next major milestone."
                    : "Start with the narrow MCP capability first instead of the full desktop client.",
                  key_points: question.includes("host integration") || question.includes("dual-model")
                    ? [
                        "The current bottleneck is proving that the answer layer feels valuable in real host workflows.",
                        "Adding dual-model synthesis before stronger host validation risks broadening the system before the product story is sharp.",
                      ]
                    : [
                        "A narrower product surface is easier to ship and validate.",
                        "A reusable capability layer fits existing AI workflows better than a heavy standalone client.",
                      ],
                  disagreements_or_risks: question.includes("host integration") || question.includes("dual-model")
                    ? [
                        "Dual-model synthesis could improve answer quality, but it also increases complexity before the current workflow is fully validated.",
                      ]
                    : [
                        "A thin visible surface may still help explain the product and distribution story.",
                      ],
                  uncertainties: question.includes("host integration") || question.includes("dual-model")
                    ? [
                        "You still need to confirm whether single-model quality is already strong enough for early users.",
                      ]
                    : [
                        "The actual adoption benefit of a demo UI still needs validation.",
                      ],
                  recommended_direction: question.includes("host integration") || question.includes("dual-model")
                    ? "Spend the next milestone on host integration, evaluation, and proof of usefulness."
                    : "Build the MCP-native capability first and keep UI ambitions minimal.",
                };

        return artifact;
      }

      if (stage === "challenger") {
        const artifact: CandidateArtifact = question.includes("debug") || question.includes("startup") || goal === "debug"
          ? {
              direct_answer: "Do not assume startup is the only culprit; add evidence for rendering and data-hydration boundaries too.",
              key_points: [
                "A blank view can also come from state hydration races or render-guard conditions.",
                "You need traces around the first successful paint, not just timing logs around startup tasks.",
              ],
              disagreements_or_risks: [
                "Over-focusing on initialization may miss a rendering guard or suspense boundary issue.",
              ],
              uncertainties: [
                "The exact UI boundary where blank content appears is still not proven.",
              ],
              recommended_direction: "Instrument both startup tasks and first-render boundaries before narrowing further.",
            }
          : {
              direct_answer: "Do not fully discard a thin demo surface too early if discoverability depends on it.",
              key_points: [
                "A small visible layer can help users understand and try the capability.",
                "Pure capability products can be harder to explain without a concrete entry point.",
              ],
              disagreements_or_risks: [
                "A demo UI can quietly grow into the same heavy surface you wanted to avoid.",
              ],
              uncertainties: [
                "It is unclear whether a thin demo surface improves adoption enough to justify even minimal maintenance.",
              ],
              recommended_direction: "If you keep a UI at all, keep it extremely thin and disposable.",
            };

        return artifact;
      }

      const artifact: FinalSynthesisArtifact = question.includes("debug") || question.includes("startup") || goal === "debug"
        ? {
            final_answer: "Start by instrumenting startup and first-render boundaries, then temporarily disable non-essential initialization tasks to isolate which step is causing the blank-content path. That is the highest-leverage debugging direction because it can quickly tell you whether the problem is in startup sequencing, hydration, or render gating.",
            consensus_points: [
              "The first move should produce evidence, not guesses.",
              "Startup sequencing and first-render boundaries are the most leverage-rich places to inspect first.",
            ],
            divergence_points: [
              "The main tension is whether the issue is primarily startup blocking or a render/hydration guard further down the tree."
            ],
            uncertainties: [
              "The exact blocking step is still unknown until traces are added around startup and first paint.",
            ],
            confidence: {
              level: "medium",
              reason: "The self-critique flow strongly supports evidence-first startup instrumentation, but the exact fault boundary is still unproven.",
            },
          }
        : goal === "plan"
          ? {
              final_answer: "For the next 2 weeks, First, tighten output quality on a small set of golden examples. Second, validate host-injected and MCP integration with real usage flows. Third, only then consider adding dual-model synthesis if the single-model final answers already feel clearly useful.",
              consensus_points: [
                "The next 2 weeks should prioritize answer quality over adding more product surface area.",
                "A small number of strong examples will clarify product value faster than broader infrastructure work.",
              ],
              divergence_points: [
                "The main tradeoff is whether to spend the second week on dual-model expansion or on tighter host integration and evaluation.",
              ],
              uncertainties: [
                "You still need real-output validation to know whether single-model quality is already strong enough to justify broader expansion.",
              ],
              confidence: {
                level: "medium",
                reason: "The self-critique flow supports a quality-first 2-week plan, but the exact sequencing after that depends on how strong the real outputs feel.",
              },
            }
          : goal === "answer"
            ? {
                final_answer: "One Answer matters because developers already ask multiple AI models the same question and waste time manually merging the results. It gives them one final answer instead of a pile of competing drafts, while still exposing consensus, disagreement, uncertainty, and confidence.",
                consensus_points: [
                  "The strongest value is reducing the mental cost of manually merging multiple AI answers.",
                  "The product is easier to understand when framed as a final-answer layer rather than as another generic AI client."
                ],
                divergence_points: [
                  "The main communication tradeoff is whether to emphasize decision quality or workflow speed first in the product story.",
                ],
                uncertainties: [
                  "You still need sharper before/after examples to make the value obvious in a few seconds.",
                ],
                confidence: {
                  level: "medium",
                  reason: "The self-critique flow supports this explanation strongly, but the product story will still need real examples to feel instantly compelling.",
                },
              }
            : {
                final_answer: question.includes("host integration") || question.includes("dual-model")
                  ? "Prioritize better host integration and evaluation before making dual-model synthesis the next major milestone. Right now, stronger host integration is higher leverage because it changes what you should do next: first prove the answer layer feels valuable in real workflows, then decide whether broader model orchestration is worth the extra complexity."
                  : "Start with the narrow MCP capability first, and only keep a very thin demo surface if real distribution evidence shows it is necessary. For a solo builder, the reusable capability layer is the higher-leverage asset, while a full desktop client is too expensive too early.",
                consensus_points: question.includes("host integration") || question.includes("dual-model")
                  ? [
                      "The next milestone should optimize for proof of usefulness in real host workflows.",
                      "Host integration and evaluation are higher leverage than broader synthesis complexity right now.",
                    ]
                  : [
                      "A narrower initial product is easier to ship than a full desktop client.",
                      "The reusable capability layer is the highest-leverage long-term asset.",
                    ],
                divergence_points: question.includes("host integration") || question.includes("dual-model")
                  ? [
                      "The main tradeoff changes what you should do next: improve host integration and validate usefulness now, or increase synthesis complexity now in exchange for potentially better answer quality later."
                    ]
                  : [
                      "The main disagreement is whether a thin demo UI should exist early for distribution and explanation."
                    ],
                uncertainties: question.includes("host integration") || question.includes("dual-model")
                  ? [
                      "You still need to confirm whether current single-model quality is already strong enough to earn real usage before expanding the synthesis surface."
                    ]
                  : [
                      "The actual adoption lift of a thin demo surface still needs validation with real users."
                    ],
                confidence: question.includes("host integration") || question.includes("dual-model")
                  ? {
                      level: "medium",
                      reason: "The current evidence favors proving usefulness in host workflows before expanding synthesis complexity, but the exact timing of dual-model work still depends on how strong the real outputs feel.",
                    }
                  : {
                      level: "medium",
                      reason: "The self-critique flow supports a narrow-first strategy, but this is still a single-model synthesis rather than broad cross-model agreement.",
                    },
              };

      return artifact;
    },
  };
}

export async function runInjectedProviderDemo(input: {
  inputFile: string | URL;
}): Promise<string> {
  const request = await loadSynthesizeInputFromFile(input.inputFile);
  const runtime: RuntimeConfig = {
    provider: createInjectedDemoProvider(),
    mode: "single-model",
  };
  const result: RunOneAnswerResult = await runOneAnswer(request, runtime);
  return JSON.stringify(result, null, 2);
}

async function main() {
  const inputFile = process.argv[2] ?? new URL("../../examples/request.decision.json", import.meta.url);
  const output = await runInjectedProviderDemo({ inputFile });
  process.stdout.write(`${output}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
