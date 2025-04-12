import { z } from 'zod'

export const ListServicesZodSchema = z.object({
  limit: z
    .number()
    .optional()
    .default(100)
    .describe('Maximum number of services to return'),
})

export type ListServicesArgs = z.infer<typeof ListServicesZodSchema>

export const ListResourcesZodSchema = z.object({
  service: z.string().describe('Service name to filter resources by'),
  limit: z
    .number()
    .optional()
    .default(100)
    .describe('Maximum number of resources to return'),
})

export type ListResourcesArgs = z.infer<typeof ListResourcesZodSchema>
