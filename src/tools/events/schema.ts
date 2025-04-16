import { z } from 'zod'

export const SearchEventsZodSchema = z.object({
  query: z.string().describe('Datadog events query string'),
  from: z
    .string()
    .describe(
      'Start time as string - either epoch seconds or relative time (e.g., "now-40m")',
    )
    .optional()
    .default('now-24h'),
  to: z
    .string()
    .describe(
      'End time as string - either epoch seconds or relative time (e.g., "now")',
    )
    .optional()
    .default('now'),
  limit: z
    .number()
    .optional()
    .default(100)
    .describe('Maximum number of events to return. Default is 100.'),
  sort: z
    .enum(['timestamp', '-timestamp'])
    .optional()
    .default('-timestamp')
    .describe('Sort order for events'),
})
