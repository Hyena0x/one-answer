import { describe, expect, it } from "vitest";

import { createToolManifest } from "../src/index.js";

describe("createToolManifest", () => {
  it("exposes the one_answer tool manifest", () => {
    const manifest = createToolManifest();

    expect(manifest.name).toBe("one_answer");
    expect(manifest.title).toBe("One Answer");
    expect(manifest.inputSchema.required).toContain("question");
    expect(manifest.inputSchema.required).toContain("preset");
  });
});
