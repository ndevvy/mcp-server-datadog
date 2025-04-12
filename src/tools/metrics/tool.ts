import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import {
  QueryMetricsZodSchema,
  ListMetricsZodSchema,
  GetMetricMetadataZodSchema,
  ListActiveMetricsZodSchema,
} from './schema'

type MetricsToolName =
  | 'query_metrics'
  | 'list_metrics'
  | 'get_metric_metadata'
  | 'list_active_metrics'
type MetricsTool = ExtendedTool<MetricsToolName>

export const METRICS_TOOLS: MetricsTool[] = [
  createToolSchema(
    QueryMetricsZodSchema,
    'query_metrics',
    'Query timeseries points of metrics from Datadog',
  ),
  createToolSchema(
    ListMetricsZodSchema,
    'list_metrics',
    'Get list of available metrics from Datadog',
  ),
  createToolSchema(
    GetMetricMetadataZodSchema,
    'get_metric_metadata',
    'Get metadata for a specific metric from Datadog',
  ),
  createToolSchema(
    ListActiveMetricsZodSchema,
    'list_active_metrics',
    'Get list of active metrics with additional filtering options',
  ),
] as const

type MetricsToolHandlers = ToolHandlers<MetricsToolName>

export const createMetricsToolHandlers = (
  apiInstance: v1.MetricsApi,
): MetricsToolHandlers => {
  return {
    query_metrics: async (request) => {
      const { from, to, query } = QueryMetricsZodSchema.parse(
        request.params.arguments,
      )

      const response = await apiInstance.queryMetrics({
        from,
        to,
        query,
      })

      return {
        content: [
          {
            type: 'text',
            text: `Queried metrics data: ${JSON.stringify({ response })}`,
          },
        ],
      }
    },

    list_metrics: async (request) => {
      const { query } = ListMetricsZodSchema.parse(request.params.arguments)

      // The API only requires a query string parameter
      const response = await apiInstance.listMetrics({
        q: query || '',
      })

      return {
        content: [
          {
            type: 'json',
            json: response,
          },
        ],
      }
    },

    get_metric_metadata: async (request) => {
      const { metricName } = GetMetricMetadataZodSchema.parse(
        request.params.arguments,
      )

      const response = await apiInstance.getMetricMetadata({
        metricName,
      })

      return {
        content: [
          {
            type: 'json',
            json: response,
          },
        ],
      }
    },

    list_active_metrics: async (request) => {
      const { from, host, tagFilter } = ListActiveMetricsZodSchema.parse(
        request.params.arguments,
      )

      const response = await apiInstance.listActiveMetrics({
        from,
        host,
        tagFilter,
      })

      return {
        content: [
          {
            type: 'json',
            json: response,
          },
        ],
      }
    },
  }
}
