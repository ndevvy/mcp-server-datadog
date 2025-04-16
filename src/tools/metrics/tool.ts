import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1, v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import {
  QueryMetricsZodSchema,
  GetMetricMetadataZodSchema,
  GetActiveMetricsZodSchema,
} from './schema'

type MetricsToolName =
  | 'query_metrics'
  | 'get_metric_metadata'
  | 'get_active_metrics'
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
    GetActiveMetricsZodSchema,
    'get_active_metrics',
    'Get a list of active metrics with optional filtering by host, tags, search query, and time range',
  ),
] as const

type MetricsToolHandlers = ToolHandlers<MetricsToolName>

export const createMetricsToolHandlers = (
  apiInstance: v1.MetricsApi,
  apiInstanceV2?: v2.MetricsApi,
): MetricsToolHandlers => {
  return {
    query_metrics: async (request) => {
      const { query } = QueryMetricsZodSchema.parse(request.params.arguments)
      let { from, to } = QueryMetricsZodSchema.parse(request.params.arguments)

      if (!from || !to) {
        const now = Math.floor(Date.now() / 1000)
        const oneDayInSeconds = 24 * 60 * 60
        to = to || now
        from = from || to - oneDayInSeconds
      }

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
      let included_in_assets = null

      if (apiInstanceV2) {
        try {
          const tagsResponse = await apiInstanceV2.listTagsByMetricName({
            metricName,
          })
          tags = tagsResponse?.data
        } catch (error) {
          console.error(`Error fetching tags for metric ${metricName}:`, error)
        }

        try {
          const assetsResponse = await apiInstanceV2.listMetricAssets({
            metricName,
          })
          included_in_assets = assetsResponse?.included
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
              tags,
              included_in_assets,
            }),
          },
        ],
      }
    },

    get_active_metrics: async (request) => {
      const { query, from, host, tagFilter } = GetActiveMetricsZodSchema.parse(
        request.params.arguments,
      )

      try {
        // Get active metrics if any of the list_active_metrics parameters are provided
        let activeMetricsData = null
        if (
          from !== undefined ||
          host !== undefined ||
          tagFilter !== undefined
        ) {
          // Default to 24 hours ago if not specified
          const actualFrom =
            from ??
            (() => {
              const now = Math.floor(Date.now() / 1000)
              const oneDayInSeconds = 24 * 60 * 60
              return now - oneDayInSeconds
            })()

          const activeMetricsResponse = await apiInstance.listActiveMetrics({
            from: actualFrom,
            host,
            tagFilter,
          })

          activeMetricsData = activeMetricsResponse
        }

        const datadogSite = process.env.DATADOG_SITE || 'datadoghq.com'
        const baseUrl = `https://api.${datadogSite}/api`

        const apiKey = process.env.DATADOG_API_KEY
        const appKey = process.env.DATADOG_APP_KEY

        if (!apiKey || !appKey) {
          throw new Error(
            'Datadog API keys are not available in environment variables',
          )
        }

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
              text: `Search results for "${query}": ${JSON.stringify({
                searchResults: data,
                activeMetrics: activeMetricsData,
              })}`,
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
