import { v1, v2 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createMetricsToolHandlers } from '../../src/tools/metrics/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const metricsEndpoint = `${baseUrl}/v1/query`

// Helper function to safely check text content
const getTextContent = (item: { type: string; text?: string }): string => {
  return item.type === 'text' && item.text ? item.text : ''
}

// Define type for JSON content structure
interface JsonContent {
  type: 'json'
  json: {
    metadata: {
      type: string
      [key: string]: unknown
    }
    tags: {
      tags: {
        host: string[]
        env: string[]
        service: string[]
        [key: string]: string[]
      }
    } | null
    assets: {
      dashboards: { id: string; title: string }[]
      monitors: { id: number; name: string }[]
      notebooks: { id: number; name: string }[]
      slos: unknown[]
      [key: string]: unknown
    } | null
    [key: string]: unknown
  }
}

// Helper function to check if content is JSON type with expected structure
const isJsonContent = (content: unknown): content is JsonContent => {
  return (
    content !== null &&
    typeof content === 'object' &&
    'type' in content &&
    content.type === 'json' &&
    'json' in content
  )
}

describe('Metrics Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v1.MetricsApi(datadogConfig)
  const apiInstanceV2 = new v2.MetricsApi(datadogConfig)
  const toolHandlers = createMetricsToolHandlers(apiInstance, apiInstanceV2)

  // https://docs.datadoghq.com/api/latest/metrics/#query-timeseries-data-across-multiple-products
  describe.concurrent('query_metrics', async () => {
    it('should query metrics data', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json({
          status: 'ok',
          query: 'avg:system.cpu.user{*}',
          series: [
            {
              metric: 'system.cpu.user',
              display_name: 'system.cpu.user',
              pointlist: [
                [1640995000000, 23.45],
                [1640995060000, 24.12],
                [1640995120000, 22.89],
                [1640995180000, 25.67],
              ],
              scope: 'host:web-01',
              expression: 'avg:system.cpu.user{*}',
              unit: [
                {
                  family: 'percentage',
                  scale_factor: 1,
                  name: 'percent',
                  short_name: '%',
                },
              ],
            },
            {
              metric: 'system.cpu.user',
              display_name: 'system.cpu.user',
              pointlist: [
                [1640995000000, 18.32],
                [1640995060000, 19.01],
                [1640995120000, 17.76],
                [1640995180000, 20.45],
              ],
              scope: 'host:web-02',
              expression: 'avg:system.cpu.user{*}',
              unit: [
                {
                  family: 'percentage',
                  scale_factor: 1,
                  name: 'percent',
                  short_name: '%',
                },
              ],
            },
          ],
          from_date: 1640995000000,
          to_date: 1641095000000,
          group_by: ['host'],
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('query_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'avg:system.cpu.user{*}',
        })
        const response = await toolHandlers.query_metrics(request)
        const typedResponse = response as unknown as DatadogToolResponse

        const content = typedResponse.content[0]
        if (content.type === 'text') {
          expect(content.text).toContain('Queried metrics data:')
          expect(content.text).toContain('system.cpu.user')
          expect(content.text).toContain('host:web-01')
          expect(content.text).toContain('host:web-02')
          expect(content.text).toContain('23.45')
        }
      })()

      server.close()
    })

    it('should handle empty response', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json({
          status: 'ok',
          query: 'avg:non.existent.metric{*}',
          series: [],
          from_date: 1640995000000,
          to_date: 1641095000000,
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('query_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'avg:non.existent.metric{*}',
        })
        const response = await toolHandlers.query_metrics(request)
        const typedResponse = response as unknown as DatadogToolResponse

        const content = typedResponse.content[0]
        if (content.type === 'text') {
          expect(content.text).toContain('Queried metrics data:')
          expect(content.text).toContain('series":[]')
        }
      })()

      server.close()
    })

    it('should handle failed query status', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json({
          status: 'error',
          message: 'Invalid query format',
          query: 'invalid:query:format',
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('query_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'invalid:query:format',
        })
        const response = await toolHandlers.query_metrics(request)
        const typedResponse = response as unknown as DatadogToolResponse

        const content = typedResponse.content[0]
        if (content.type === 'text') {
          expect(content.text).toContain('status":"error"')
          expect(content.text).toContain('Invalid query format')
        }
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Authentication failed'] },
          { status: 403 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('query_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'avg:system.cpu.user{*}',
        })
        await expect(toolHandlers.query_metrics(request)).rejects.toThrow()
      })()

      server.close()
    })

    it('should handle rate limit errors', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Rate limit exceeded'] },
          { status: 429 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('query_metrics', {
          from: 1640995000,
          to: 1641095000,
          query: 'avg:system.cpu.user{*}',
        })
        await expect(toolHandlers.query_metrics(request)).rejects.toThrow(
          'Rate limit exceeded',
        )
      })()

      server.close()
    })

    it('should handle invalid time range errors', async () => {
      const mockHandler = http.get(metricsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Time range exceeds allowed limit'] },
          { status: 400 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        // Using a very large time range that might exceed limits
        const request = createMockToolRequest('query_metrics', {
          from: 1600000000, // Very old date
          to: 1700000000, // Very recent date
          query: 'avg:system.cpu.user{*}',
        })
        await expect(toolHandlers.query_metrics(request)).rejects.toThrow(
          'Time range exceeds allowed limit',
        )
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/metrics/#search-metrics
  describe.concurrent('search_metrics', async () => {
    it('should search for metrics', async () => {
      const mockHandler = http.get(
        `${baseUrl}/v1/search?q=system.cpu`,
        async () => {
          return HttpResponse.json({
            results: {
              metrics: [
                'system.cpu.idle',
                'system.cpu.iowait',
                'system.cpu.steal',
                'system.cpu.system',
                'system.cpu.user',
              ],
              dashboards: [],
              monitors: [],
            },
          })
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('search_metrics', {
          query: 'system.cpu',
        })
        const response = await toolHandlers.search_metrics(request)
        const typedResponse = response as unknown as DatadogToolResponse

        const textContent = getTextContent(typedResponse.content[0])
        expect(textContent).toContain('Search results for "system.cpu"')
        expect(textContent).toContain('system.cpu.idle')
        expect(textContent).toContain('system.cpu.user')
      })()

      server.close()
    })

    it('should handle empty search results', async () => {
      const mockHandler = http.get(
        `${baseUrl}/v1/search?q=non.existent.metric`,
        async () => {
          return HttpResponse.json({
            results: {
              metrics: [],
              dashboards: [],
              monitors: [],
            },
          })
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('search_metrics', {
          query: 'non.existent.metric',
        })
        const response = await toolHandlers.search_metrics(request)
        const typedResponse = response as unknown as DatadogToolResponse

        const textContent = getTextContent(typedResponse.content[0])
        expect(textContent).toContain(
          'Search results for "non.existent.metric"',
        )
        expect(textContent).toContain('"metrics":[]')
      })()

      server.close()
    })
  })

  describe.concurrent('get_metric_metadata', async () => {
    it('should fetch metadata, tags, and assets for a metric', async () => {
      const metadataEndpoint = `${baseUrl}/v1/metrics/system.cpu.user`
      const tagsEndpoint = `${baseUrl}/v2/metrics/system.cpu.user/tags`
      const assetsEndpoint = `${baseUrl}/v2/metrics/system.cpu.user/assets`

      const metadataMock = http.get(metadataEndpoint, async () => {
        return HttpResponse.json({
          type: 'gauge',
          description: 'The percentage of CPU time spent in user space',
          short_name: 'system.cpu.user',
          integration: 'system',
          statsd_interval: 15,
          per_unit: 'second',
          unit: 'percent',
        })
      })

      const tagsMock = http.get(tagsEndpoint, async () => {
        return HttpResponse.json({
          tags: {
            host: ['web-01', 'web-02'],
            env: ['prod', 'staging'],
            service: ['api', 'web'],
          },
        })
      })

      const assetsMock = http.get(assetsEndpoint, async () => {
        return HttpResponse.json({
          dashboards: [
            {
              id: 'abc-def-123',
              title: 'System Overview',
            },
          ],
          monitors: [
            {
              id: 12345,
              name: 'High CPU Usage Alert',
            },
          ],
          notebooks: [
            {
              id: 67890,
              name: 'CPU Analysis',
            },
          ],
          slos: [],
        })
      })

      const server = setupServer(metadataMock, tagsMock, assetsMock)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_metric_metadata', {
          metricName: 'system.cpu.user',
        })
        const response = await toolHandlers.get_metric_metadata(request)
        const typedResponse = response as unknown as DatadogToolResponse

        // Check that metadata, tags and assets are included
        const content = typedResponse.content[0]
        if (!isJsonContent(content)) {
          throw new Error('Expected content type to be json')
        }

        expect(content.json.metadata).toBeDefined()
        expect(content.json.metadata.type).toBe('gauge')
        expect(content.json.tags).toBeDefined()
        expect(content.json.tags!.tags).toBeDefined()
        expect(content.json.tags!.tags.host).toContain('web-01')
        expect(content.json.tags!.tags.env).toContain('prod')
        expect(content.json.assets).toBeDefined()
        expect(content.json.assets!.dashboards).toBeDefined()
        expect(content.json.assets!.dashboards[0].title).toBe('System Overview')
        expect(content.json.assets!.monitors).toBeDefined()
        expect(content.json.assets!.monitors[0].name).toBe(
          'High CPU Usage Alert',
        )
      })()

      server.close()
    })

    it('should handle case when tags and assets are not available', async () => {
      const metadataEndpoint = `${baseUrl}/v1/metrics/custom.metric`
      const tagsEndpoint = `${baseUrl}/v2/metrics/custom.metric/tags`
      const assetsEndpoint = `${baseUrl}/v2/metrics/custom.metric/assets`

      const metadataMock = http.get(metadataEndpoint, async () => {
        return HttpResponse.json({
          type: 'count',
          description: 'A custom metric',
          short_name: 'custom.metric',
          statsd_interval: 15,
          unit: 'count',
        })
      })

      const tagsMock = http.get(tagsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Metric not found'] },
          { status: 404 },
        )
      })

      const assetsMock = http.get(assetsEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['Metric not found'] },
          { status: 404 },
        )
      })

      const server = setupServer(metadataMock, tagsMock, assetsMock)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_metric_metadata', {
          metricName: 'custom.metric',
        })
        const response = await toolHandlers.get_metric_metadata(request)
        const typedResponse = response as unknown as DatadogToolResponse

        // Check that metadata is included but tags and assets are null
        const content = typedResponse.content[0]
        if (!isJsonContent(content)) {
          throw new Error('Expected content type to be json')
        }

        expect(content.json.metadata).toBeDefined()
        expect(content.json.metadata.type).toBe('count')
        expect(content.json.tags).toBeNull()
        expect(content.json.assets).toBeNull()
      })()

      server.close()
    })
  })
})
