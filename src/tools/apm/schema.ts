import { z } from 'zod'

export const ListServicesZodSchema = z.object({
  limit: z
    .number()
    .optional()
    .default(100)
    .describe('Maximum number of services to return'),
})

export type ListServicesArgs = z.infer<typeof ListServicesZodSchema>

export const SearchResourcesZodSchema = z.object({
  service: z.string().describe('Service name to filter resources by'),
  search_query: z
    .string()
    .optional()
    .describe('Search query to filter resource names by'),
  entry_spans_only: z
    .boolean()
    .optional()
    .default(false)
    .describe('Filter to only show service entry spans (span.kind:server)'),
  limit: z
    .number()
    .optional()
    .default(100)
    .describe('Maximum number of resources to return'),
})

export type SearchResourcesArgs = z.infer<typeof SearchResourcesZodSchema>

export const ListOperationsZodSchema = z.object({
  service: z.string().describe('Service name to filter operations by'),
  entry_spans_only: z
    .boolean()
    .optional()
    .default(false)
    .describe('Filter to only show service entry spans (span.kind:server)'),
  limit: z
    .number()
    .optional()
    .default(100)
    .describe('Maximum number of operations to return'),
})

export type ListOperationsArgs = z.infer<typeof ListOperationsZodSchema>

export const GetResourceHashZodSchema = z.object({
  service: z.string().describe('Service name the resource belongs to'),
  resource_name: z.string().describe('Resource name to get the hash for'),
})

export type GetResourceHashArgs = z.infer<typeof GetResourceHashZodSchema>
