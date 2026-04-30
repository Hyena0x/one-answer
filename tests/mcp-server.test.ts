import { describe, expect, it } from "vitest";

import {
  createMcpServerInfo,
  handleMcpRequest,
} from "../src/mcp/server.js";

describe("createMcpServerInfo", () => {
  it("exposes basic MCP server metadata", () => {
    const info = createMcpServerInfo();

    expect(info.name).toBe("one-answer");
    expect(info.version).toBe("0.1.0");
  });
});

describe("handleMcpRequest", () => {
  it("responds to initialize", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    });

    expect(response.id).toBe(1);
    expect(response.result.serverInfo.name).toBe("one-answer");
    expect(response.result.protocolVersion).toBe("2024-11-05");
  });

  it("returns the alae_synthesize tool from tools/list", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });

    expect(response.id).toBe(2);
    expect(response.result.tools).toHaveLength(1);
    expect(response.result.tools[0].name).toBe("alae_synthesize");
    expect(response.result.tools[0].title).toBe("One Answer");
  });

  it("executes tools/call and returns JSON text content", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "alae_synthesize",
        arguments: {
          question: "Should I build the desktop client or the MCP tool first?",
          preset: "deep-reasoning",
          goal: "decision",
          audience: "developer",
        },
      },
    });

    expect(response.id).toBe(3);
    expect(response.result.content[0].type).toBe("text");
    expect(response.result.content[0].text).toContain("final_answer");
    expect(response.result.isError).toBe(false);
  });

  it("marks tool calls as MCP errors when the runtime returns a structured error", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "alae_synthesize",
        arguments: {
          preset: "deep-reasoning",
        },
      },
    });

    expect(response.id).toBe(5);
    expect(response.result.content[0].type).toBe("text");
    expect(response.result.content[0].text).toContain("INVALID_INPUT");
    expect(response.result.isError).toBe(true);
  });

  it("returns an MCP error result for unknown tools", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "unknown_tool",
        arguments: {},
      },
    });

    expect(response.id).toBe(4);
    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain("Unknown tool");
  });
});
