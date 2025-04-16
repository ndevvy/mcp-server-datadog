# Datadog MCP Server

MCP server for the Datadog API, enabling incident management and more. Forked from https://github.com/winor30/mcp-server-datadog

## Features

- **Observability Tools**: Provides a mechanism to leverage key Datadog monitoring features, such as incidents, monitors, logs, dashboards, and metrics, through the MCP server.
- **Extensible Design**: Designed to easily integrate with additional Datadog APIs, allowing for seamless future feature expansion.

## Tools

1. `list_incidents`

   - Retrieve a list of incidents from Datadog.
   - **Inputs**:
     - `pageSize` (optional number): Maximum number of incidents to return per page.
     - `pageOffset` (optional number): Offset for pagination.
   - **Returns**: Array of Datadog incidents and associated metadata.

2. `get_incident`

   - Retrieve detailed information about a specific Datadog incident.
   - **Inputs**:
     - `incidentId` (string): Incident ID to fetch details for.
   - **Returns**: Detailed incident information (title, status, timestamps, etc.).

3. `get_monitors`

   - Fetch the status of Datadog monitors.
   - **Inputs**:
     - `groupStates` (optional array): States to filter (e.g., alert, warn, no data, ok).
     - `name` (optional string): Filter by name.
     - `tags` (optional array): Filter by tags.
   - **Returns**: Monitors data and a summary of their statuses.

4. `get_logs`

   - Search and retrieve logs from Datadog.
   - **Inputs**:
     - `query` (optional string): Datadog logs query string.
     - `from` (number): Start time in epoch seconds.
     - `to` (number): End time in epoch seconds.
     - `limit` (optional number): Maximum number of logs to return (defaults to 100).
   - **Returns**: Array of matching logs.

5. `list_dashboards`

   - Get a list of dashboards from Datadog.
   - **Inputs**:
     - `name` (optional string): Filter dashboards by name.
     - `tags` (optional array): Filter dashboards by tags.
   - **Returns**: Array of dashboards with URL references.

6. `get_dashboard`

   - Retrieve a specific dashboard from Datadog.
   - **Inputs**:
     - `dashboardId` (string): ID of the dashboard to fetch.
   - **Returns**: Dashboard details including title, widgets, etc.

7. `create_dashboard`

   - Create a new dashboard in Datadog.
   - **Inputs**:
     - `title` (string): The title of the dashboard.
     - `description` (optional string): The description of the dashboard.
     - `layoutType` (optional string): The layout type ('ordered' or 'free', defaults to 'ordered').
     - `widgets` (optional array): The widgets to add to the dashboard.
     - `tags` (optional array): A list of tags to associate with the dashboard.
   - **Returns**: Details of the created dashboard including ID and URL.

8. `query_metrics`

   - Retrieve metrics data from Datadog.
   - **Inputs**:
     - `query` (string): Metrics query string (e.g., "avg:system.cpu.user{\*}").
     - `from` (number): Start time in epoch seconds.
     - `to` (number): End time in epoch seconds.
   - **Returns**: Metrics data for the queried timeframe.

9. `get_metric_metadata`

   - Get metadata for a specific metric from Datadog.
   - **Inputs**:
     - `metricName` (string): Name of the metric to get metadata for.
   - **Returns**: Metadata information for the specified metric.

10. `get_active_metrics`

    - Get a list of active metrics with optional filtering by host, tags, and search query.
    - **Inputs**:
      - `query` (string): Search query string to find metrics.
      - `from` (optional number): Unix timestamp from which to start the query (default: 24 hours ago).
      - `host` (optional string): Filter metrics by host.
      - `tagFilter` (optional string): Filter metrics by tags (e.g. "env:prod,region:us-east").
    - **Returns**: List of metrics matching the search query and/or active metrics based on filters.

11. `analyze_tag_relationships`

    - Show hierarchical relationships between tags across metrics.
    - **Inputs**:
      - `from` (optional number): Unix timestamp from which to start analyzing tags (default: now - 1 day).
      - `limit` (optional number): Maximum number of tag relationships to analyze (default: 50).
      - `metricPrefix` (optional string): Optional prefix to filter metrics by (e.g., "system." or "aws.").
    - **Returns**: Analysis of tag relationships showing how tags are related hierarchically.

12. `analyze_tag_cardinality`

    - Identify high-cardinality tags that might cause performance issues.
    - **Inputs**:
      - `from` (optional number): Unix timestamp from which to start analyzing tags (default: now - 1 day).
      - `limit` (optional number): Maximum number of tags to analyze (default: 50).
      - `metricPrefix` (optional string): Optional prefix to filter metrics by (e.g., "system." or "aws.").
      - `minCardinality` (optional number): Minimum cardinality threshold to report (default: 10).
    - **Returns**: Analysis of high-cardinality tags that could impact performance.

13. `visualize_tag_co_occurrence`

    - Visualize which tags frequently appear together for a specific metric.
    - **Inputs**:
      - `metricName` (string): Name of the metric to analyze tags for.
      - `from` (optional number): Unix timestamp from which to start analyzing tags (default: now - 1 day).
      - `limit` (optional number): Maximum number of tag pairs to analyze (default: 20).
    - **Returns**: Visualization of tag co-occurrence patterns for the specified metric.

14. `search_events`

    - Search for events in Datadog.
    - **Inputs**:
      - `query` (string): Datadog events query string.
      - `from` (optional string): Start time as string - either epoch seconds or relative time (e.g., "now-40m") (default: "now-24h").
      - `to` (optional string): End time as string - either epoch seconds or relative time (e.g., "now") (default: "now").
      - `limit` (optional number): Maximum number of events to return (default: 100).
      - `sort` (optional string): Sort order for events (default: "-timestamp").
    - **Returns**: Array of matching events from Datadog.

15. `list_traces`

    - Retrieve a list of APM traces from Datadog.
    - **Inputs**:
      - `query` (string): Datadog APM trace query string.
      - `from` (number): Start time in epoch seconds.
      - `to` (number): End time in epoch seconds.
      - `limit` (optional number): Maximum number of traces to return (defaults to 100).
      - `sort` (optional string): Sort order for traces (defaults to '-timestamp').
      - `service` (optional string): Filter by service name.
      - `operation` (optional string): Filter by operation name.
    - **Returns**: Array of matching traces from Datadog APM.

16. `list_apm_services`

    - Get list of APM services from Datadog.
    - **Inputs**:
      - `limit` (optional number): Maximum number of services to return (defaults to 100).
    - **Returns**: List of available APM services.

17. `list_apm_resources`

    - Get list of APM resources for a specific service from Datadog.
    - **Inputs**:
      - `service` (string): Service name to filter resources by.
      - `entry_spans_only` (optional boolean): Filter to only show service entry spans.
      - `limit` (optional number): Maximum number of resources to return (defaults to 100).
      - `search_query` (optional string): Search query to filter resource names by.
    - **Returns**: List of resources for the specified service.

18. `list_apm_operations`

    - Get list of top operation names for a specific service from Datadog.
    - **Inputs**:
      - `service` (string): Service name to filter operations by.
      - `entry_spans_only` (optional boolean): Filter to only show service entry spans.
      - `limit` (optional number): Maximum number of operations to return (defaults to 100).
    - **Returns**: List of operation names for the specified service.

19. `get_resource_hash`

    - Get the resource hash for a specific resource name within a service.
    - **Inputs**:
      - `service` (string): Service name the resource belongs to.
      - `resource_name` (string): Resource name to get the hash for.
    - **Returns**: Resource hash information.

20. `get_all_services`

    - Extract all unique service names from logs.
    - **Inputs**:
      - `from` (optional number): Start time in epoch seconds (defaults to 24 hours ago).
      - `to` (optional number): End time in epoch seconds (defaults to current time).
      - `limit` (optional number): Maximum number of logs to search through (defaults to 1000).
      - `query` (optional string): Optional query filter for log search.
    - **Returns**: List of unique service names found in logs.

21. `list_hosts`

    - Get list of hosts from Datadog.
    - **Inputs**:
      - `filter` (optional string): Filter string for search results.
      - `sort_field` (optional string): Field to sort hosts by.
      - `sort_dir` (optional string): Sort direction (asc/desc).
      - `start` (optional number): Starting offset for pagination.
      - `count` (optional number): Max number of hosts to return (max: 1000).
      - `from` (optional number): Search hosts from this UNIX timestamp.
      - `include_muted_hosts_data` (optional boolean): Include muted hosts status and expiry.
      - `include_hosts_metadata` (optional boolean): Include host metadata (version, platform, etc).
    - **Returns**: Array of hosts with details.

22. `get_active_hosts_count`

    - Get the total number of active hosts in Datadog.
    - **Inputs**:
      - `from` (optional number): Number of seconds from which you want to get total number of active hosts (defaults to 2h).
    - **Returns**: Count of total active and up hosts.

23. `mute_host`

    - Mute a host in Datadog.
    - **Inputs**:
      - `hostname` (string): The name of the host to mute.
      - `message` (optional string): Message to associate with the muting of this host.
      - `end` (optional number): POSIX timestamp for when the mute should end.
      - `override` (optional boolean): If true and the host is already muted, replaces existing end time.
    - **Returns**: Success status and confirmation message.

24. `unmute_host`

    - Unmute a host in Datadog.
    - **Inputs**:
      - `hostname` (string): The name of the host to unmute.
    - **Returns**: Success status and confirmation message.

25. `list_notebooks`

    - Get list of notebooks from Datadog.
    - **Inputs**:
      - `query` (optional string): Return only notebooks with this query string in notebook name or author handle.
      - `authorHandle` (optional string): Return notebooks created by the given author handle.
      - `excludeAuthorHandle` (optional string): Return notebooks not created by the given author handle.
      - `start` (optional number): The index of the first notebook to return.
      - `count` (optional number): The number of notebooks to be returned.
      - `sortField` (optional string): Sort by field (modified, name, created).
      - `sortDir` (optional string): Sort direction (asc, desc).
      - `type` (optional string): Return only notebooks with that metadata type.
      - `isTemplate` (optional boolean): True value returns only template notebooks.
      - `includeCells` (optional boolean): Value of false excludes the cells and global time for each notebook.
    - **Returns**: List of notebooks matching the specified criteria.

26. `get_notebook`

    - Get a notebook from Datadog.
    - **Inputs**:
      - `notebookId` (number): Unique ID of the notebook to retrieve.
    - **Returns**: Details of the requested notebook including cells and metadata.

27. `create_notebook`

    - Create a new notebook in Datadog.
    - **Inputs**:
      - `name` (string): The name of the notebook.
      - `cells` (optional array): Cells to include in the notebook.
      - `time` (optional string): Time settings for the notebook (defaults to '1h').
      - `metadata` (optional object): Additional metadata for the notebook.
    - **Returns**: Details of the created notebook.

28. `add_cell_to_notebook`

    - Add a cell to an existing Datadog notebook.
    - **Inputs**:
      - `notebookId` (number): The ID of the notebook to add the cell to.
      - `cell` (object): The cell definition to add.
    - **Returns**: Updated notebook information.

29. `list_downtimes`

    - List scheduled downtimes from Datadog.
    - **Inputs**:
      - `currentOnly` (optional boolean): Return only currently active downtimes when true.
    - **Returns**: Array of scheduled downtimes with details.

30. `schedule_downtime`

    - Schedule a downtime in Datadog.
    - **Inputs**:
      - `scope` (string): Scope to apply downtime to (e.g. 'host:my-host').
      - `start` (optional number): UNIX timestamp for the start of the downtime.
      - `end` (optional number): UNIX timestamp for the end of the downtime.
      - `message` (optional string): A message to include with the downtime.
      - `timezone` (optional string): The timezone for the downtime.
      - `monitorId` (optional number): The ID of the monitor to mute.
      - `monitorTags` (optional array): A list of monitor tags for filtering.
      - `recurrence` (optional object): Recurrence settings for the downtime.
    - **Returns**: Scheduled downtime details including ID and active status.

31. `cancel_downtime`
    - Cancel a scheduled downtime in Datadog.
    - **Inputs**:
      - `downtimeId` (number): The ID of the downtime to cancel.
    - **Returns**: Confirmation of downtime cancellation.

## Setup

### Datadog Credentials

You need valid Datadog API credentials to use this MCP server:

- `DATADOG_API_KEY`: Your Datadog API key
- `DATADOG_APP_KEY`: Your Datadog Application key
- `DATADOG_SITE` (optional): The Datadog site (e.g. `datadoghq.eu`)

Export them in your environment before running the server:

```bash
export DATADOG_API_KEY="your_api_key"
export DATADOG_APP_KEY="your_app_key"
export DATADOG_SITE="your_datadog_site"
```

## Installation

### Installing via Smithery

To install Datadog MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@ndevvy/mcp-server-datadog):

```bash
npx -y @smithery/cli install @ndevvy/mcp-server-datadog --client claude
```

### Manual Installation

```bash
pnpm install
pnpm build
pnpm watch   # for development with auto-rebuild
```

## Usage

Add to your `claude_desktop_config.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "datadog": {
      "command": "/path/to/mcp-server-datadog/build/index.js",
      "env": {
        "DATADOG_API_KEY": "<YOUR_API_KEY>",
        "DATADOG_APP_KEY": "<YOUR_APP_KEY>",
        "DATADOG_SITE": "<YOUR_SITE>" // Optional
      }
    }
  }
}
```

## Debugging

Because MCP servers communicate over standard input/output, debugging can sometimes be tricky. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector). You can run the inspector with:

```bash
npm run inspector
```

The inspector will provide a URL you can open in your browser to see logs and send requests manually.

## License

This project is licensed under the [Apache License, Version 2.0](./LICENSE).
