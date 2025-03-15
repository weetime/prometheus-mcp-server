# Prometheus MCP

A Prometheus client that implements the Model Context Protocol (MCP) to provide an interface for querying and interacting with Prometheus metrics.

## Overview

This project provides a bridge between Prometheus and AI assistants using the Model Context Protocol. It allows AI assistants to query Prometheus metrics, explore available metrics, and perform various operations on time series data.

## Features

- Query instant metrics from Prometheus
- Perform range queries over time periods
- List available metrics and their metadata
- Execute PromQL queries
- Format results in human-readable format
- Explore labels and label values

## Prerequisites

- Node.js (v16 or higher)
- A running Prometheus server (default: http://localhost:9090)

## Installation

```bash
# Install globally
npm install -g prometheus-mcp-server

# Or install locally
npm install prometheus-mcp-server
```

## Usage

### As a Command Line Tool

```bash
# Run the MCP server
prometheus-mcp-server
```

### In Your Project

```javascript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import prometheusClient from "prometheus-mcp-server";

// Initialize and use the client
// ...
```

## Configuration

By default, the client connects to a Prometheus server running at `http://localhost:9090`. You can modify the `PROMETHEUS_API_BASE` constant in the source code to point to your Prometheus instance.

## Available Functions

The client provides the following functions:

- `queryInstant`: Execute an instant query at a specific time
- `queryRange`: Execute a range query over a time period
- `listMetrics`: List all available metrics
- `getMetricMetadata`: Get metadata for specific metrics
- `getLabelNames`: Get all label names
- `getLabelValues`: Get values for a specific label
- `getTargets`: Get information about scrape targets
- `getAlerts`: Get information about alerts
- `getRules`: Get information about recording and alerting rules

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start

# Debug
npm run dev:debug
```

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.