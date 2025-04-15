import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1, v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import {
  QueryMetricsZodSchema,
  GetMetricMetadataZodSchema,
  ListActiveMetricsZodSchema,
  SearchMetricsZodSchema,
} from './schema'

type MetricsToolName =
  | 'query_metrics'
  | 'get_metric_metadata'
  | 'list_active_metrics'
  | 'search_metrics'
type MetricsTool = ExtendedTool<MetricsToolName>

export const METRICS_TOOLS: MetricsTool[] = [
  createToolSchema(
    QueryMetricsZodSchema,
    'query_metrics',
    'Query timeseries points of metrics from Datadog',
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
  createToolSchema(
    SearchMetricsZodSchema,
    'search_metrics',
    'Search for metrics by name pattern',
  ),
] as const

type MetricsToolHandlers = ToolHandlers<MetricsToolName>

export const createMetricsToolHandlers = (
  apiInstance: v1.MetricsApi,
  apiInstanceV2?: v2.MetricsApi,
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

    get_metric_metadata: async (request) => {
      const { metricName } = GetMetricMetadataZodSchema.parse(
        request.params.arguments,
      )

      const response = await apiInstance.getMetricMetadata({
        metricName,
      })

      let tags = null
      let assets = null

      if (apiInstanceV2) {
        try {
          const tagsResponse = await apiInstanceV2.listTagsByMetricName({
            metricName,
          })
          tags = tagsResponse
        } catch (error) {
          console.error(`Error fetching tags for metric ${metricName}:`, error)
        }

        try {
          const assetsResponse = await apiInstanceV2.listMetricAssets({
            metricName,
          })
          assets = assetsResponse
        } catch (error) {
          console.error(
            `Error fetching assets for metric ${metricName}:`,
            error,
          )
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              metadata: response,
              tags: tags,
              assets: assets,
            }),
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
            type: 'text',
            text: JSON.stringify(response),
          },
        ],
      }
    },

    search_metrics: async (request) => {
      const { query } = SearchMetricsZodSchema.parse(request.params.arguments)

      try {
        // We need to get the Datadog site from the environment
        // The base URL pattern for Datadog API
        const datadogSite = process.env.DATADOG_SITE || 'datadoghq.com'
        const baseUrl = `https://api.${datadogSite}/api`

        // API keys should be available as environment variables
        const apiKey = process.env.DATADOG_API_KEY
        const appKey = process.env.DATADOG_APP_KEY

        if (!apiKey || !appKey) {
          throw new Error(
            'Datadog API keys are not available in environment variables',
          )
        }

        // Make the fetch request directly to the search endpoint
        const response = await fetch(
          `${baseUrl}/v1/search?q=${encodeURIComponent(query)}`,
          {
            method: 'GET',
            headers: {
              'DD-API-KEY': apiKey,
              'DD-APPLICATION-KEY': appKey,
              'Content-Type': 'application/json',
            },
          },
        )

        if (!response.ok) {
          throw new Error(
            `Search metrics failed with status: ${response.status}`,
          )
        }

        const data = await response.json()

        return {
          content: [
            {
              type: 'text',
              text: `Search results for "${query}": ${JSON.stringify(data)}`,
            },
          ],
        }
      } catch (error) {
        console.error(`Error searching metrics with query ${query}:`, error)
        throw error
      }
    },
  }
}
