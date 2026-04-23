import { describe, expect, it } from "vitest";

import { createToolManifest } from "../src/index.js";

describe("createToolManifest", () => {
  it("exposes the alae_synthesize tool manifest", () => {
    const manifest = createToolManifest();

    expect(manifest.name).toBe("alae_synthesize");
    expect(manifest.title).toBe("One Answer");
    expect(manifest.inputSchema.required).toContain("question");
    expect(manifest.inputSchema.required).toContain("preset");
  });
});
