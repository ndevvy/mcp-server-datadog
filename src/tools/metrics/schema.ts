import { z } from 'zod'

export const QueryMetricsZodSchema = z.object({
  from: z
    .number()
    .describe(
      'Start of the queried time period, seconds since the Unix epoch.',
    ),
  to: z
    .number()
    .describe('End of the queried time period, seconds since the Unix epoch.'),
  query: z
    .string()
    .describe('Datadog metrics query string. e.g. "avg:system.cpu.user{*}'),
})

export type QueryMetricsArgs = z.infer<typeof QueryMetricsZodSchema>

export const ListMetricsZodSchema = z.object({
  query: z
    .string()
    .optional()
    .describe('Search query to filter metrics by name'),
})

export const ListActiveMetricsZodSchema = z.object({
  from: z.number().describe('Unix timestamp from which to start the query'),
  host: z.string().optional().describe('Filter metrics by host'),
  tagFilter: z.string().optional().describe('Filter metrics by tags'),
})

export const GetMetricMetadataZodSchema = z.object({
  metricName: z.string().describe('Name of the metric to get metadata for'),
})
