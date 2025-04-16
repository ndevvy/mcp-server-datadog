import { z } from 'zod'

export const GetLogsZodSchema = z.object({
  query: z.string().default('').describe('Datadog logs query string'),
  from: z
    .string()
    .describe('Start time as string (e.g., "now-40m" or timestamp)')
    .optional()
    .default('now-24h'),
  to: z
    .string()
    .describe('End time as string (e.g., "now" or timestamp)')
    .optional()
    .default('now'),
  limit: z
    .number()
    .optional()
    .default(100)
    .describe('Maximum number of logs to return. Default is 100.'),
})

/**
 * Schema for retrieving all unique service names from logs.
 * Defines parameters for querying logs within a time window.
 *
 * @param query - Optional. Additional query filter for log search. Defaults to "*" (all logs)
 * @param from - Optional. Start time as string. Defaults to 24 hours ago.
 * @param to - Optional. End time as string. Defaults to current time.
 * @param limit - Optional. Maximum number of logs to search through. Default is 1000.
 */
export const GetAllServicesZodSchema = z.object({
  query: z
    .string()
    .default('*')
    .describe('Optional query filter for log search'),
  from: z
    .string()
    .optional()
    .default(() => `${Math.floor(Date.now() / 1000) - 24 * 60 * 60}`)
    .describe(
      'Start time as string - either epoch seconds or relative time (e.g., "now-40m")',
    ),
  to: z
    .string()
    .optional()
    .default(() => `${Math.floor(Date.now() / 1000)}`)
    .describe(
      'End time as string - either epoch seconds or relative time (e.g., "now")',
    ),
  limit: z
    .number()
    .optional()
    .default(1000)
    .describe('Maximum number of logs to search through. Default is 1000.'),
})
