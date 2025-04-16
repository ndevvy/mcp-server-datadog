import { v2 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createEventsToolHandlers } from '../../src/tools/events/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const eventsEndpoint = `${baseUrl}/v2/events/search`

describe('Events Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v2.EventsApi(datadogConfig)
  const toolHandlers = createEventsToolHandlers(apiInstance)

  describe.concurrent('search_events', async () => {
    it('should retrieve events', async () => {
      // Mock API response based on Datadog API documentation
      const mockHandler = http.post(eventsEndpoint, async () => {
        return HttpResponse.json({
          data: [
            {
              id: '1234567890',
              attributes: {
                message: 'Test event message',
                timestamp: 1631234567000,
                tags: ['env:test'],
              },
              type: 'event',
            },
          ],
          meta: {
            page: {
              after: 'cursor-id',
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('search_events', {
          query: 'tags:env:test',
          from: '1631234560', // epoch seconds as string
          to: '1631234570', // epoch seconds as string
          limit: 10,
        })
        const response = (await toolHandlers.search_events(
          request,
        )) as unknown as DatadogToolResponse
        expect(response.content[0].text).toContain('Events data')
        expect(response.content[0].text).toContain('Test event message')
      })()

      server.close()
    })

    it('should handle empty response', async () => {
      const mockHandler = http.post(eventsEndpoint, async () => {
        return HttpResponse.json({
          data: [],
          meta: {
            page: {},
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('search_events', {
          query: 'tags:non-existent',
          from: '1631234560',
          to: '1631234570',
        })
        const response = (await toolHandlers.search_events(
          request,
        )) as unknown as DatadogToolResponse
        expect(response.content[0].text).toContain('Events data')
        expect(response.content[0].text).toContain('[]')
      })()

      server.close()
    })

    it('should handle null response data', async () => {
      const mockHandler = http.post(eventsEndpoint, async () => {
        return HttpResponse.json({
          data: null,
          meta: {
            page: {},
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('search_events', {
          query: 'tags:env:test',
          from: '1631234560',
          to: '1631234570',
        })
        await expect(toolHandlers.search_events(request)).rejects.toThrow(
          'No events data returned',
        )
      })()

      server.close()
    })
  })
})
