import { v1, v2 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createMetricsToolHandlers } from '../../src/tools/metrics/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const metricsEndpoint = `${baseUrl}/v1/query`

const getTextContent = (item: { type: string; text?: string }): string => {
  return item.type === 'text' && item.text ? item.text : ''
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
  describe('query_metrics', async () => {
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

  // https://docs.datadoghq.com/api/latest/metrics/#search-metrics and https://docs.datadoghq.com/api/latest/metrics/#get-a-list-of-active-metrics
  describe('get_active_metrics', async () => {
    it('should search for metrics using the query parameter', async () => {
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
        const request = createMockToolRequest('get_active_metrics', {
          query: 'system.cpu', // Only query is provided for search functionality
        })
        const response = await toolHandlers.get_active_metrics(request)
        const typedResponse = response as unknown as DatadogToolResponse

        const textContent = getTextContent(typedResponse.content[0])
        expect(textContent).toContain('Search results for "system.cpu":')
        // Check for structure returned by get_active_metrics handler
        expect(textContent).toContain('"searchResults":{')
        expect(textContent).toContain('"metrics":["system.cpu.idle"')
        expect(textContent).toContain('"activeMetrics":null') // activeMetrics should be null as 'from' wasn't provided
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
        const request = createMockToolRequest('get_active_metrics', {
          query: 'non.existent.metric',
        })
        const response = await toolHandlers.get_active_metrics(request)
        const typedResponse = response as unknown as DatadogToolResponse

        const textContent = getTextContent(typedResponse.content[0])
        expect(textContent).toContain(
          'Search results for "non.existent.metric":',
        )
        expect(textContent).toContain('"metrics":[]')
        expect(textContent).toContain('"activeMetrics":null')
      })()

      server.close()
    })

    it('should fetch active metrics when from parameter is provided', async () => {
      const activeMetricsEndpoint = `${baseUrl}/v1/metrics`
      const searchEndpoint = `${baseUrl}/v1/search?q=system.cpu`
      const now = Math.floor(Date.now() / 1000)
      const fromTs = now - 3600 // 1 hour ago

      const activeMetricsMock = http.get(
        activeMetricsEndpoint,
        ({ request }) => {
          const url = new URL(request.url)
          // Check if 'from' param exists; msw doesn't parse query params easily here
          if (url.searchParams.has('from')) {
            return HttpResponse.json({
              metrics: ['system.cpu.user', 'system.mem.used'],
              from: String(fromTs), // Convert number to string
            })
          }
          return HttpResponse.json({}, { status: 400 }) // Should not be called without 'from'
        },
      )

      const searchMetricsMock = http.get(searchEndpoint, async () => {
        return HttpResponse.json({
          results: {
            metrics: ['system.cpu.idle', 'system.cpu.user'],
            dashboards: [],
            monitors: [],
          },
        })
      })

      const server = setupServer(activeMetricsMock, searchMetricsMock)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_active_metrics', {
          query: 'system.cpu',
          from: fromTs, // Provide 'from' to trigger active metrics fetching
        })
        const response = await toolHandlers.get_active_metrics(request)
        const typedResponse = response as unknown as DatadogToolResponse

        const textContent = getTextContent(typedResponse.content[0])
        expect(textContent).toContain('Search results for "system.cpu":')
        // Check for both search results and active metrics
        expect(textContent).toContain('"searchResults":{')
        expect(textContent).toContain('"metrics":["system.cpu.idle"')
        expect(textContent).toContain('"activeMetrics":{')
        expect(textContent).toContain(
          '"metrics":["system.cpu.user","system.mem.used"]',
        )
      })()

      server.close()
    })
  })

  describe('get_metric_metadata', async () => {
    it('should fetch metadata, tags, and assets for a metric', async () => {
      const metadataEndpoint = `${baseUrl}/v1/metrics/system.cpu.user`
      const tagsEndpoint = `${baseUrl}/v2/metrics/system.cpu.user/tags`
      const assetsEndpoint = `${baseUrl}/v2/metrics/system.cpu.user/assets`

      const metadataMock = http.get(metadataEndpoint, async () => {
        return HttpResponse.json({
          description:
            'The percent of time the CPU spent running user space processes.',
          short_name: 'cpu user',
          type: 'gauge',
          unit: 'percent',
          per_unit: null,
          statsd_interval: null,
          integration: 'system',
        })
      })

      const tagsMock = http.get(tagsEndpoint, async () => {
        return HttpResponse.json({
          data: {
            type: 'metrics',
            id: 'system.cpu.user',
            attributes: {
              tags: [
                'availability-zone:us-east-1a',
                'availability-zone:us-east-1b',
                'availability-zone:us-east-1c',
                'availability-zone:us-east-1d',
                'aws_ec2launchtemplate_version:1',
                'aws_eks_cluster-name:geppo-v2-prod',
                'aws_eks_cluster-name:geppo-v8-staging',
                'cloud_provider:aws',
                'eks_kubernetes-node-class-name:default',
                'env:prod',
                'env:staging',
                'host:purple-snake-01.rmq6.cloudamqp.com',
              ],
            },
          },
        })
      })

      const assetsMock = http.get(assetsEndpoint, async () => {
        return HttpResponse.json({
          data: {
            id: 'system.cpu.user',
            type: 'metrics',
            relationships: {
              dashboards: {
                data: [
                  {
                    id: 'fxk-iu9-a2r',
                    type: 'dashboards',
                  },
                  {
                    id: '31163',
                    type: 'dashboards',
                  },
                  {
                    id: '26',
                    type: 'dashboards',
                  },
                  {
                    id: 'xkt-2us-g8w',
                    type: 'dashboards',
                  },
                  {
                    id: 'sze-kcv-zck',
                    type: 'dashboards',
                  },
                  {
                    id: 'ssz-99i-2vk',
                    type: 'dashboards',
                  },
                  {
                    id: '9zw-676-xq5',
                    type: 'dashboards',
                  },
                  {
                    id: '30675',
                    type: 'dashboards',
                  },
                  {
                    id: '30327',
                    type: 'dashboards',
                  },
                  {
                    id: '1',
                    type: 'dashboards',
                  },
                  {
                    id: '17',
                    type: 'dashboards',
                  },
                ],
              },
              monitors: {
                data: [],
              },
              notebooks: {
                data: [
                  {
                    id: '6604682',
                    type: 'notebooks',
                  },
                  {
                    id: '7918899',
                    type: 'notebooks',
                  },
                  {
                    id: '6594653',
                    type: 'notebooks',
                  },
                  {
                    id: '9494024',
                    type: 'notebooks',
                  },
                  {
                    id: '1314706',
                    type: 'notebooks',
                  },
                  {
                    id: '5983147',
                    type: 'notebooks',
                  },
                  {
                    id: '10415496',
                    type: 'notebooks',
                  },
                  {
                    id: '11354656',
                    type: 'notebooks',
                  },
                  {
                    id: '11337115',
                    type: 'notebooks',
                  },
                  {
                    id: '11734176',
                    type: 'notebooks',
                  },
                  {
                    id: '397571',
                    type: 'notebooks',
                  },
                  {
                    id: '1286125',
                    type: 'notebooks',
                  },
                  {
                    id: '392772',
                    type: 'notebooks',
                  },
                  {
                    id: '10361063',
                    type: 'notebooks',
                  },
                  {
                    id: '11255693',
                    type: 'notebooks',
                  },
                ],
              },
              slos: {
                data: [],
              },
            },
          },
          included: [
            {
              id: 'fake-id-1',
              type: 'dashboards',
              attributes: {
                popularity: 4,
                title: 'Fake Dashboard 1',
                url: '/dashboard/fake-id-1',
              },
            },
          ],
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
        if (content.type !== 'text') {
          throw new Error('Expected content type to be text')
        }

        const jsonContent = JSON.parse(content.text)

        expect(jsonContent.metadata).toBeDefined()
        expect(jsonContent.metadata.type).toBe('gauge')
        expect(jsonContent.tags).toBeDefined()
        expect(jsonContent.included_in_assets).toBeDefined()
        expect(jsonContent.included_in_assets).toBeInstanceOf(Array)
        expect(jsonContent.included_in_assets![0].id).toBe('fake-id-1')
        expect(jsonContent.included_in_assets![0].type).toBe('dashboards')
        expect(jsonContent.included_in_assets![0].attributes.title).toBe(
          'Fake Dashboard 1',
        )
        expect(jsonContent.tags).toBeDefined()
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
        if (content.type !== 'text') {
          throw new Error('Expected content type to be text')
        }

        const jsonContent = JSON.parse(content.text)

        expect(jsonContent.metadata).toBeDefined()
        expect(jsonContent.metadata.type).toBe('count')
        expect(jsonContent.tags).toBeNull()
        expect(jsonContent.included_in_assets).toBeNull()
      })()

      server.close()
    })
  })
})
