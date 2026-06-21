import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dataApi } from "@surf-ai/sdk/server";
import type { OpenAPISpec, OpenAPIOperation, OpenAPIParameter } from "./spec";

interface ParamInfo {
  name: string;
  type: string;
  required: boolean;
  description: string;
  enumValues?: string[];
}

interface OperationInfo {
  command: string;
  method: string;
  path: string; // stripped path, e.g. "market/price"
  summary: string;
  params: ParamInfo[];
  hasPathParams: boolean;
}

interface TagGroup {
  name: string;
  description: string;
  toolName: string;
  operations: OperationInfo[];
}

function slugify(tag: string): string {
  return tag.toLowerCase().replace(/ /g, "-");
}

function toolName(tag: string): string {
  return `surf_${tag.toLowerCase().replace(/ /g, "_")}`;
}

function deriveCommand(operationId: string, tagSlug: string): string {
  if (operationId.startsWith(tagSlug + "-")) {
    return operationId.slice(tagSlug.length + 1);
  }
  return operationId;
}

function resolveRef(ref: string, spec: OpenAPISpec): any {
  // "#/components/schemas/Foo" → spec.components.schemas.Foo
  const parts = ref.replace("#/", "").split("/");
  let current: any = spec;
  for (const part of parts) {
    current = current?.[part];
    if (current === undefined) {
      throw new Error(
        `[surf-mcp] Failed to resolve \$ref "${ref}": path segment "${part}" not found in spec`
      );
    }
  }
  return current;
}

function extractBodyParams(op: OpenAPIOperation, spec: OpenAPISpec): ParamInfo[] {
  const content = op.requestBody?.content?.["application/json"];
  if (!content?.schema) return [];

  let schema = content.schema;
  if (schema.$ref) {
    schema = resolveRef(schema.$ref, spec);
  }
  if (!schema?.properties) return [];

  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties).map(([name, prop]: [string, any]) => ({
    name,
    type: prop.type ?? "string",
    required: required.has(name),
    description: prop.description ?? "",
    enumValues: prop.enum,
  }));
}

function extractParams(parameters: OpenAPIParameter[]): ParamInfo[] {
  return parameters
    .filter((p) => p.in === "query" || p.in === "path")
    .map((p) => ({
      name: p.name,
      type: p.schema?.type ?? "string",
      required: p.required ?? p.in === "path",
      description: p.description ?? "",
      enumValues: p.schema?.enum,
    }));
}

function buildDescription(group: TagGroup): string {
  const lines: string[] = [group.description, "", "Commands:"];

  for (const op of group.operations) {
    lines.push(`  ${op.command} - ${op.summary}`);
    if (op.params.length > 0) {
      const paramStrs = op.params.map((p) => {
        let s = p.required ? `${p.name}*` : p.name;
        s += ` (${p.type})`;
        if (p.enumValues && p.enumValues.length <= 6) {
          s += ` [${p.enumValues.join(", ")}]`;
        }
        return s;
      });
      lines.push(`    params: ${paramStrs.join(", ")}`);
    }
  }

  return lines.join("\n");
}

function parseSpec(spec: OpenAPISpec): TagGroup[] {
  const tagDescriptions = new Map<string, string>();
  for (const tag of spec.tags ?? []) {
    tagDescriptions.set(tag.name, tag.description ?? "");
  }

  const groups = new Map<string, TagGroup>();

  for (const [path, methods] of Object.entries(spec.paths)) {
    // Skip v2 endpoints
    if (path.startsWith("/gateway/v2")) continue;

    for (const [method, op] of Object.entries(methods)) {
      if (!["get", "post"].includes(method)) continue;

      const tag = op.tags?.[0];
      if (!tag) continue;

      const tagSlug = slugify(tag);
      const command = deriveCommand(op.operationId, tagSlug);
      const strippedPath = path.replace(/^\/gateway\/v1\//, "");

      const params = [
        ...extractParams(op.parameters ?? []),
        ...extractBodyParams(op, spec),
      ];

      const operation: OperationInfo = {
        command,
        method: method.toUpperCase(),
        path: strippedPath,
        summary: op.summary ?? op.description ?? op.operationId,
        params,
        hasPathParams: path.includes("{"),
      };

      if (!groups.has(tag)) {
        groups.set(tag, {
          name: tag,
          description: tagDescriptions.get(tag) ?? "",
          toolName: toolName(tag),
          operations: [],
        });
      }
      groups.get(tag)!.operations.push(operation);
    }
  }

  return Array.from(groups.values());
}

function resolvePath(
  pathTemplate: string,
  params: Record<string, unknown>
): { path: string; remainingParams: Record<string, unknown> } {
  const remaining = { ...params };
  const path = pathTemplate.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = remaining[key];
    delete remaining[key];
    return encodeURIComponent(String(value ?? ""));
  });
  return { path, remainingParams: remaining };
}

export function registerTools(server: McpServer, spec: OpenAPISpec): void {
  const groups = parseSpec(spec);

  for (const group of groups) {
    const commandNames = group.operations.map((o) => o.command);
    const description = buildDescription(group);

    server.tool(
      group.toolName,
      description,
      {
        command: z.enum(commandNames as [string, ...string[]]),
        params: z.record(z.string(), z.any()).optional(),
      },
      async ({ command, params }) => {
        const op = group.operations.find((o) => o.command === command);
        if (!op) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Unknown command: ${command}. Valid: ${commandNames.join(", ")}`,
              },
            ],
            isError: true,
          };
        }

        try {
          const inputParams = params ?? {};
          const { path, remainingParams } = op.hasPathParams
            ? resolvePath(op.path, inputParams)
            : { path: op.path, remainingParams: inputParams };

          const result =
            op.method === "POST"
              ? await dataApi.post(path, remainingParams)
              : await dataApi.get(path, remainingParams as Record<string, any>);

          return {
            content: [
              { type: "text" as const, text: JSON.stringify(result, null, 2) },
            ],
          };
        } catch (err) {
          return {
            content: [
              { type: "text" as const, text: `Error: ${(err as Error).message}` },
            ],
            isError: true,
          };
        }
      }
    );
  }

  console.error(
    `[surf-mcp] Registered ${groups.length} tools: ${groups.map((g) => g.toolName).join(", ")}`
  );
}
