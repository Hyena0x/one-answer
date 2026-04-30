#!/usr/bin/env node
import { realpathSync } from "node:fs";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

import { createToolManifest, runOneAnswer } from "../index.js";

export type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
};

export function createMcpServerInfo() {
  return {
    name: "one-answer",
    version: "0.1.0",
  };
}

function success(id: JsonRpcRequest["id"], result: unknown): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result,
  };
}

function failure(id: JsonRpcRequest["id"], code: number, message: string): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
    },
  };
}

function toolDescriptor() {
  const manifest = createToolManifest();
  return {
    name: manifest.name,
    title: manifest.title,
    description: manifest.description,
    inputSchema: manifest.inputSchema,
  };
}

async function handleToolCall(name: string, args: Record<string, unknown> = {}) {
  if (name !== "one_answer") {
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${name}`,
        },
      ],
      isError: true,
    };
  }

  const result = await runOneAnswer(args as never);
  const isRuntimeError = "error" in result;
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
    isError: isRuntimeError,
  };
}

export async function handleMcpRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  switch (request.method) {
    case "initialize":
      return success(request.id, {
        protocolVersion: "2024-11-05",
        serverInfo: createMcpServerInfo(),
        capabilities: {
          tools: {},
        },
      });

    case "tools/list":
      return success(request.id, {
        tools: [toolDescriptor()],
      });

    case "tools/call": {
      const name = typeof request.params?.name === "string" ? request.params.name : "";
      const args = (request.params?.arguments ?? {}) as Record<string, unknown>;
      const result = await handleToolCall(name, args);
      return success(request.id, result);
    }

    default:
      return failure(request.id, -32601, `Method not found: ${request.method}`);
  }
}

export async function serveStdio() {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let request: JsonRpcRequest;
    try {
      request = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      process.stdout.write(`${JSON.stringify(failure(null, -32700, "Parse error"))}\n`);
      continue;
    }

    const response = await handleMcpRequest(request);
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}

export function isDirectMcpServerExecution(moduleUrl: string, argvPath?: string) {
  if (!argvPath) {
    return false;
  }

  try {
    return fileURLToPath(moduleUrl) === realpathSync(argvPath);
  } catch {
    return false;
  }
}

if (isDirectMcpServerExecution(import.meta.url, process.argv[1])) {
  void serveStdio();
}
