import { z } from 'zod'

export const QueryMetricsZodSchema = z.object({
  from: z
    .number()
    .optional()
    .describe(
      'Start of the queried time period, seconds since the Unix epoch. (default: 24 hours ago)',
    ),
  to: z
    .number()
    .optional()
    .describe(
      'End of the queried time period, seconds since the Unix epoch. (default: now)',
    ),
  query: z
    .string()
    .describe('Datadog metrics query string. e.g. "avg:system.cpu.user{*}'),
})

export type QueryMetricsArgs = z.infer<typeof QueryMetricsZodSchema>

export const GetMetricMetadataZodSchema = z.object({
  metricName: z.string().describe('Name of the metric to get metadata for'),
})

export const GetActiveMetricsZodSchema = z.object({
  query: z.string().describe('Search query string to find metrics'),
  from: z
    .number()
    .optional()
    .describe(
      'Unix timestamp from which to start the query (default: 24 hours ago)',
    ),
  host: z.string().optional().describe('Filter metrics by host'),
  tagFilter: z
    .string()
    .optional()
    .describe('Filter metrics by tags (e.g. "env:prod,region:us-east")'),
})
