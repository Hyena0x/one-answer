import { describe, expect, it } from "vitest";

import { runInjectedProviderDemo } from "../src/cli/run-injected-demo.js";

describe("runInjectedProviderDemo", () => {
  it("runs an example request using an injected host-style provider without api keys", async () => {
    const output = await runInjectedProviderDemo({
      inputFile: new URL("../examples/request.decision.json", import.meta.url),
    });

    const parsed = JSON.parse(output) as {
      run_id: string;
      final_answer: string;
      confidence: { reason: string };
      meta: { preset: string };
    };

    expect(parsed.run_id).toMatch(/^single_/);
    expect(parsed.final_answer.toLowerCase()).toContain("mcp");
    expect(parsed.confidence.reason.toLowerCase()).toContain("single-model");
    expect(parsed.meta.preset).toBe("deep-reasoning");
  });

  it("produces plan-shaped output for plan examples", async () => {
    const output = await runInjectedProviderDemo({
      inputFile: new URL("../examples/request.plan.json", import.meta.url),
    });

    const parsed = JSON.parse(output) as {
      final_answer: string;
      meta: { goal: string };
    };

    expect(parsed.meta.goal).toBe("plan");
    expect(parsed.final_answer).toContain("next 2 weeks");
    expect(parsed.final_answer).toContain("First");
  });

  it("produces explanation-shaped output for strategy examples", async () => {
    const output = await runInjectedProviderDemo({
      inputFile: new URL("../examples/request.strategy.json", import.meta.url),
    });

    const parsed = JSON.parse(output) as {
      final_answer: string;
      meta: { goal: string };
    };

    expect(parsed.meta.goal).toBe("answer");
    expect(parsed.final_answer).toContain("multiple AI models");
    expect(parsed.final_answer).toContain("one final answer");
  });

  it("makes tradeoff divergence explicitly action-relevant", async () => {
    const output = await runInjectedProviderDemo({
      inputFile: new URL("../examples/request.tradeoff.json", import.meta.url),
    });

    const parsed = JSON.parse(output) as {
      divergence_points: string[];
      confidence: { reason: string };
      final_answer: string;
      meta: { goal: string };
    };

    expect(parsed.meta.goal).toBe("decision");
    expect(parsed.final_answer).toContain("host integration");
    expect(parsed.divergence_points[0]).toContain("changes what you should do next");
    expect(parsed.confidence.reason).not.toContain("self-critique flow supports");
  });
});
