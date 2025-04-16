import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { SearchEventsZodSchema } from './schema'

type EventsToolName = 'search_events'
type EventsTool = ExtendedTool<EventsToolName>

export const EVENTS_TOOLS: EventsTool[] = [
  createToolSchema(
    SearchEventsZodSchema,
    'search_events',
    'Search for events in Datadog',
  ),
] as const

type EventsToolHandlers = ToolHandlers<EventsToolName>

export const createEventsToolHandlers = (
  apiInstance: v2.EventsApi,
): EventsToolHandlers => ({
  search_events: async (request) => {
    const { query, from, to, limit, sort } = SearchEventsZodSchema.parse(
      request.params.arguments,
    )

    const response = await apiInstance.searchEvents({
      body: {
        filter: {
          query,
          // Handle string format - if numeric string, convert to ms; otherwise pass through
          from: /^\d+$/.test(from) ? `${parseInt(from, 10) * 1000}` : from,
          to: /^\d+$/.test(to) ? `${parseInt(to, 10) * 1000}` : to,
        },
        page: {
          limit,
        },
        sort,
      },
    })

    if (response.data == null) {
      throw new Error('No events data returned')
    }

    return {
      content: [
        {
          type: 'text',
          text: `Events data: ${JSON.stringify(response.data)}`,
        },
      ],
    }
  },
})
