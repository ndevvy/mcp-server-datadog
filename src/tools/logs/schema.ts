import { z } from 'zod'

export const GetLogsZodSchema = z.object({
  query: z.string().default('').describe('Datadog logs query string'),
  from: z.number().describe('Start time in epoch seconds'),
  to: z.number().describe('End time in epoch seconds'),
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
 * @param from - Optional. Start time in epoch seconds. Defaults to 24 hours ago.
 * @param to - Optional. End time in epoch seconds. Defaults to current time.
 * @param limit - Optional. Maximum number of logs to search through. Default is 1000.
 */
export const GetAllServicesZodSchema = z.object({
  query: z
    .string()
    .default('*')
    .describe('Optional query filter for log search'),
  from: z
    .number()
    .optional()
    .default(() => Math.floor(Date.now() / 1000) - 24 * 60 * 60)
    .describe('Start time in epoch seconds. Defaults to 24 hours ago.'),
  to: z
    .number()
    .optional()
    .default(() => Math.floor(Date.now() / 1000))
    .describe('End time in epoch seconds. Defaults to current time.'),
  limit: z
    .number()
    .optional()
    .default(1000)
    .describe('Maximum number of logs to search through. Default is 1000.'),
})
