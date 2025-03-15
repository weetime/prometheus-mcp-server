#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const PROMETHEUS_API_BASE = "http://localhost:9090/api/v1";
const USER_AGENT = "prometheus-client/1.0";

// Create server instance
const server = new McpServer({
  name: "prometheus-client",
  version: "1.0.0",
});

// Helper function for making Prometheus API requests
async function makePrometheusRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
  const url = new URL(`${PROMETHEUS_API_BASE}/${endpoint}`);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  
  const headers = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
  };

  try {
    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making Prometheus request:", error);
    return null;
  }
}

// Interface for Prometheus API responses
interface PrometheusResponse<T> {
  status: "success" | "error";
  data?: T;
  errorType?: string;
  error?: string;
  warnings?: string[];
}

// Interface for instant query results
interface InstantQueryResult {
  resultType: "vector" | "matrix" | "scalar" | "string";
  result: any[];
}

// Interface for range query results
interface RangeQueryResult {
  resultType: "matrix";
  result: any[];
}

// Interface for metadata results
interface MetadataResult {
  metric: string;
  type: string;
  help: string;
  unit: string;
}

// Format vector result for display
function formatVectorResult(result: any[]): string {
  if (!result || result.length === 0) {
    return "No data found";
  }

  return result.map((item) => {
    const metricName = Object.entries(item.metric || {})
      .map(([key, value]) => `${key}="${value}"`)
      .join(", ");
    
    const value = item.value ? `${item.value[1]} @${new Date(item.value[0] * 1000).toISOString()}` : "No value";
    
    return `${metricName}: ${value}`;
  }).join("\n\n");
}

// Format matrix result for display
function formatMatrixResult(result: any[]): string {
  if (!result || result.length === 0) {
    return "No data found";
  }

  return result.map((item) => {
    const metricName = Object.entries(item.metric || {})
      .map(([key, value]) => `${key}="${value}"`)
      .join(", ");
    
    const values = item.values ? 
      item.values.map((v: any) => `${v[1]} @${new Date(v[0] * 1000).toISOString()}`).join(", ") : 
      "No values";
    
    return `${metricName}:\n${values}`;
  }).join("\n\n");
}

// Register Prometheus tools
server.tool(
  "instant-query",
  "Execute an instant Prometheus query",
  {
    query: z.string().describe("PromQL query expression"),
    time: z.string().optional().describe("Evaluation timestamp (RFC3339 or Unix timestamp)"),
    timeout: z.string().optional().describe("Evaluation timeout (e.g. '30s')"),
  },
  async ({ query, time, timeout }) => {
    const params: Record<string, string> = { query };
    if (time) params.time = time;
    if (timeout) params.timeout = timeout;

    const data = await makePrometheusRequest<PrometheusResponse<InstantQueryResult>>("query", params);

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve data from Prometheus",
          },
        ],
      };
    }

    if (data.status === "error") {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${data.error || "Unknown error"}`,
          },
        ],
      };
    }

    const result = data.data;
    if (!result) {
      return {
        content: [
          {
            type: "text",
            text: "No data returned",
          },
        ],
      };
    }

    let formattedResult = "";
    if (result.resultType === "vector") {
      formattedResult = formatVectorResult(result.result);
    } else if (result.resultType === "matrix") {
      formattedResult = formatMatrixResult(result.result);
    } else if (result.resultType === "scalar") {
      formattedResult = `Scalar value: ${result.result[1]} @${new Date(result.result[0] * 1000).toISOString()}`;
    } else if (result.resultType === "string") {
      formattedResult = `String value: ${result.result[1]}`;
    }

    const warnings = data.warnings && data.warnings.length > 0 
      ? `\n\nWarnings:\n${data.warnings.join("\n")}` 
      : "";

    return {
      content: [
        {
          type: "text",
          text: `Query: ${query}\nResult Type: ${result.resultType}\n\n${formattedResult}${warnings}`,
        },
      ],
    };
  },
);

server.tool(
  "range-query",
  "Execute a range Prometheus query",
  {
    query: z.string().describe("PromQL query expression"),
    start: z.string().describe("Start timestamp (RFC3339 or Unix timestamp)"),
    end: z.string().describe("End timestamp (RFC3339 or Unix timestamp)"),
    step: z.string().describe("Query resolution step width (e.g. '15s', '1m', '1h')"),
    timeout: z.string().optional().describe("Evaluation timeout (e.g. '30s')"),
  },
  async ({ query, start, end, step, timeout }) => {
    const params: Record<string, string> = { query, start, end, step };
    if (timeout) params.timeout = timeout;

    const data = await makePrometheusRequest<PrometheusResponse<RangeQueryResult>>("query_range", params);

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve data from Prometheus",
          },
        ],
      };
    }

    if (data.status === "error") {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${data.error || "Unknown error"}`,
          },
        ],
      };
    }

    const result = data.data;
    if (!result) {
      return {
        content: [
          {
            type: "text",
            text: "No data returned",
          },
        ],
      };
    }

    const formattedResult = formatMatrixResult(result.result);
    const warnings = data.warnings && data.warnings.length > 0 
      ? `\n\nWarnings:\n${data.warnings.join("\n")}` 
      : "";

    return {
      content: [
        {
          type: "text",
          text: `Range Query: ${query}\nStart: ${start}\nEnd: ${end}\nStep: ${step}\n\n${formattedResult}${warnings}`,
        },
      ],
    };
  },
);

server.tool(
  "get-series",
  "Find series by label matchers",
  {
    match: z.string().describe("Series selector (e.g. 'up', 'http_requests_total{job=\"prometheus\"}')"),
    start: z.string().optional().describe("Start timestamp (RFC3339 or Unix timestamp)"),
    end: z.string().optional().describe("End timestamp (RFC3339 or Unix timestamp)"),
  },
  async ({ match, start, end }) => {
    const params: Record<string, string> = { "match[]": match };
    if (start) params.start = start;
    if (end) params.end = end;

    const data = await makePrometheusRequest<PrometheusResponse<string[][]>>("series", params);

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve series data from Prometheus",
          },
        ],
      };
    }

    if (data.status === "error") {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${data.error || "Unknown error"}`,
          },
        ],
      };
    }

    const result = data.data;
    if (!result || result.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No series found matching the selector",
          },
        ],
      };
    }

    const formattedResult = result.map((series) => {
      return Object.entries(series)
        .map(([key, value]) => `${key}="${value}"`)
        .join(", ");
    }).join("\n");

    return {
      content: [
        {
          type: "text",
          text: `Series matching "${match}":\n\n${formattedResult}`,
        },
      ],
    };
  },
);

server.tool(
  "get-label-values",
  "Get label values for a label name",
  {
    labelName: z.string().describe("Label name to get values for"),
  },
  async ({ labelName }) => {
    const data = await makePrometheusRequest<PrometheusResponse<string[]>>(`label/${labelName}/values`);

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve label values from Prometheus",
          },
        ],
      };
    }

    if (data.status === "error") {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${data.error || "Unknown error"}`,
          },
        ],
      };
    }

    const result = data.data;
    if (!result || result.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No values found for label "${labelName}"`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Values for label "${labelName}":\n\n${result.join("\n")}`,
        },
      ],
    };
  },
);

server.tool(
  "get-metadata",
  "Get metadata for metrics",
  {
    metric: z.string().optional().describe("Metric name to get metadata for"),
    limit: z.number().optional().describe("Maximum number of metrics to return"),
  },
  async ({ metric, limit }) => {
    const params: Record<string, string> = {};
    if (metric) params.metric = metric;
    if (limit !== undefined) params.limit = limit.toString();

    const data = await makePrometheusRequest<PrometheusResponse<MetadataResult[]>>("metadata", params);

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve metadata from Prometheus",
          },
        ],
      };
    }

    if (data.status === "error") {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${data.error || "Unknown error"}`,
          },
        ],
      };
    }

    const result = data.data;
    if (!result || result.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: metric ? `No metadata found for metric "${metric}"` : "No metadata found",
          },
        ],
      };
    }

    const formattedResult = result.map((item) => {
      return [
        `Metric: ${item.metric}`,
        `Type: ${item.type}`,
        `Help: ${item.help}`,
        `Unit: ${item.unit || "none"}`,
        "---"
      ].join("\n");
    }).join("\n");

    return {
      content: [
        {
          type: "text",
          text: `Metadata:\n\n${formattedResult}`,
        },
      ],
    };
  },
);

server.tool(
  "get-targets",
  "Get information about targets",
  {
    state: z.enum(["active", "dropped", "any"]).optional().describe("Filter targets by state"),
  },
  async ({ state }) => {
    const params: Record<string, string> = {};
    if (state && state !== "any") params.state = state;

    const data = await makePrometheusRequest<PrometheusResponse<any>>("targets", params);

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve targets from Prometheus",
          },
        ],
      };
    }

    if (data.status === "error") {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${data.error || "Unknown error"}`,
          },
        ],
      };
    }

    const result = data.data;
    if (!result) {
      return {
        content: [
          {
            type: "text",
            text: "No target data returned",
          },
        ],
      };
    }

    const activeTargets = result.activeTargets || [];
    const droppedTargets = result.droppedTargets || [];

    let formattedResult = "";

    if ((state === "active" || state === "any" || !state) && activeTargets.length > 0) {
      formattedResult += "Active Targets:\n\n";
      formattedResult += activeTargets.map((target: any) => {
        return [
          `Endpoint: ${target.scrapeUrl}`,
          `State: ${target.health}`,
          `Labels: ${Object.entries(target.labels || {}).map(([k, v]) => `${k}="${v}"`).join(", ")}`,
          `Last Scrape: ${target.lastScrape}`,
          `Error: ${target.lastError || "none"}`,
          "---"
        ].join("\n");
      }).join("\n");
    }

    if ((state === "dropped" || state === "any" || !state) && droppedTargets.length > 0) {
      if (formattedResult) formattedResult += "\n\n";
      formattedResult += "Dropped Targets:\n\n";
      formattedResult += droppedTargets.map((target: any) => {
        return [
          `Endpoint: ${target.scrapeUrl}`,
          `Labels: ${Object.entries(target.labels || {}).map(([k, v]) => `${k}="${v}"`).join(", ")}`,
          "---"
        ].join("\n");
      }).join("\n");
    }

    if (!formattedResult) {
      formattedResult = "No targets found";
    }

    return {
      content: [
        {
          type: "text",
          text: formattedResult,
        },
      ],
    };
  },
);

server.tool(
  "get-alerts",
  "Get information about alerts",
  {},
  async () => {
    const data = await makePrometheusRequest<PrometheusResponse<any>>("alerts");

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve alerts from Prometheus",
          },
        ],
      };
    }

    if (data.status === "error") {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${data.error || "Unknown error"}`,
          },
        ],
      };
    }

    const result = data.data;
    if (!result) {
      return {
        content: [
          {
            type: "text",
            text: "No alert data returned",
          },
        ],
      };
    }

    const alerts = result.alerts || [];
    if (alerts.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No alerts found",
          },
        ],
      };
    }

    const formattedResult = alerts.map((alert: any) => {
      return [
        `Name: ${alert.labels?.alertname || "Unknown"}`,
        `State: ${alert.state}`,
        `Labels: ${Object.entries(alert.labels || {}).map(([k, v]) => `${k}="${v}"`).join(", ")}`,
        `Annotations: ${Object.entries(alert.annotations || {}).map(([k, v]) => `${k}="${v}"`).join(", ")}`,
        `Active Since: ${alert.activeAt}`,
        "---"
      ].join("\n");
    }).join("\n");

    return {
      content: [
        {
          type: "text",
          text: `Alerts:\n\n${formattedResult}`,
        },
      ],
    };
  },
);

server.tool(
  "get-rules",
  "Get information about alerting and recording rules",
  {},
  async () => {
    const data = await makePrometheusRequest<PrometheusResponse<any>>("rules");

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve rules from Prometheus",
          },
        ],
      };
    }

    if (data.status === "error") {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${data.error || "Unknown error"}`,
          },
        ],
      };
    }

    const result = data.data;
    if (!result) {
      return {
        content: [
          {
            type: "text",
            text: "No rule data returned",
          },
        ],
      };
    }

    const groups = result.groups || [];
    if (groups.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No rule groups found",
          },
        ],
      };
    }

    let formattedResult = "";
    groups.forEach((group: any) => {
      formattedResult += `Group: ${group.name} (${group.file})\n\n`;
      
      const rules = group.rules || [];
      if (rules.length === 0) {
        formattedResult += "No rules in this group\n\n";
        return;
      }

      rules.forEach((rule: any) => {
        formattedResult += [
          `Type: ${rule.type}`,
          `Name: ${rule.name}`,
          rule.type === "alerting" ? `State: ${rule.state}` : "",
          `Query: ${rule.query}`,
          rule.type === "alerting" ? `Alerts: ${(rule.alerts || []).length}` : "",
          "---"
        ].filter(Boolean).join("\n");
        formattedResult += "\n\n";
      });
    });

    return {
      content: [
        {
          type: "text",
          text: `Rules:\n\n${formattedResult}`,
        },
      ],
    };
  },
);

server.tool(
  "get-status",
  "Get status information about the Prometheus server",
  {
    statusType: z.enum(["config", "flags", "runtime", "buildinfo", "tsdb"]).describe("Type of status information to retrieve"),
  },
  async ({ statusType }) => {
    const endpoint = `status/${statusType}`;
    const data = await makePrometheusRequest<PrometheusResponse<any>>(endpoint);

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve ${statusType} status from Prometheus`,
          },
        ],
      };
    }

    if (data.status === "error") {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${data.error || "Unknown error"}`,
          },
        ],
      };
    }

    const result = data.data;
    if (!result) {
      return {
        content: [
          {
            type: "text",
            text: "No status data returned",
          },
        ],
      };
    }

    // Format the result based on the status type
    let formattedResult = "";
    if (statusType === "config") {
      formattedResult = `Configuration:\n\n${JSON.stringify(result, null, 2)}`;
    } else if (statusType === "flags") {
      formattedResult = "Flags:\n\n";
      formattedResult += Object.entries(result)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
    } else if (statusType === "runtime") {
      formattedResult = "Runtime Information:\n\n";
      formattedResult += [
        `Start Time: ${result.startTime}`,
        `CWD: ${result.CWD}`,
        `GOMAXPROCS: ${result.GOMAXPROCS}`,
        `GOGC: ${result.GOGC}`,
        `GODEBUG: ${result.GODEBUG}`,
        `Goroutines: ${result.goroutineCount}`,
      ].join("\n");
    } else if (statusType === "buildinfo") {
      formattedResult = "Build Information:\n\n";
      formattedResult += [
        `Version: ${result.version}`,
        `Revision: ${result.revision}`,
        `Branch: ${result.branch}`,
        `Build User: ${result.buildUser}`,
        `Build Date: ${result.buildDate}`,
        `Go Version: ${result.goVersion}`,
      ].join("\n");
    } else if (statusType === "tsdb") {
      formattedResult = "TSDB Stats:\n\n";
      formattedResult += [
        `Head: ${JSON.stringify(result.headStats, null, 2)}`,
        `Series Count by Metric Name: ${JSON.stringify(result.seriesCountByMetricName, null, 2)}`,
        `Label Value Count by Label Name: ${JSON.stringify(result.labelValueCountByLabelName, null, 2)}`,
      ].join("\n\n");
    }

    return {
      content: [
        {
          type: "text",
          text: formattedResult,
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Prometheus MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});