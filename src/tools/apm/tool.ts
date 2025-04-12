import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { ListServicesZodSchema, ListResourcesZodSchema } from './schema'
import type { LogsAggregateRequest } from '@datadog/datadog-api-client/dist/packages/datadog-api-client-v2/models/LogsAggregateRequest'

type APMToolName = 'list_apm_services' | 'list_apm_resources'
type APMTool = ExtendedTool<APMToolName>

const getServicesFromLogs = async (
  logsApiInstance: v2.LogsApi,
): Promise<string[]> => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const body: LogsAggregateRequest = {
    filter: {
      from: sevenDaysAgo.toISOString(),
      to: now.toISOString(),
      indexes: ['main'],
    },
    compute: [{ aggregation: 'count', type: 'total' }],
    groupBy: [{ facet: 'service', limit: 1000, total: false }],
  }

  try {
    const response = await logsApiInstance.aggregateLogs({ body })

    if (!response.data?.buckets) {
      console.warn('No service data found in log aggregation results.')
      return []
    }

    // Extract service names from buckets
    const services = response.data.buckets.map((bucket) => {
      // Ensure bucket.by is treated as Record<string, string>
      const by = bucket.by as Record<string, string>
      return by.service // Extract the service name
    })

    return services.filter(
      (service): service is string => service !== undefined,
    )
  } catch (error: unknown) {
    // Basic error handling, can be expanded
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      const errorMessage = (error as { message: string }).message
      // Handle specific errors like 403 Forbidden if needed
      if (errorMessage.includes('403')) {
        console.error(
          'Error: Insufficient permissions to query logs. Check API key permissions.',
        )
        // Optionally, return a specific error or empty array
      } else {
        console.error(`Error aggregating logs: ${errorMessage}`)
      }
    } else {
      console.error(`Error aggregating logs: ${String(error)}`)
    }
    // Decide return value on error, e.g., empty list or throw
    return []
  }
}

export const APM_TOOLS: APMTool[] = [
  createToolSchema(
    ListServicesZodSchema,
    'list_apm_services',
    'Get list of service names from Datadog',
  ),
  createToolSchema(
    ListResourcesZodSchema,
    'list_apm_resources',
    'Get list of APM resources for a specific service from Datadog',
  ),
] as const

type APMToolHandlers = ToolHandlers<APMToolName>

export const createAPMToolHandlers = (
  spansApiInstance: v2.SpansApi,
  softwareCatalogApiInstance: v2.SoftwareCatalogApi,
  logsApiInstance: v2.LogsApi,
): APMToolHandlers => {
  return {
    list_apm_services: async (request) => {
      const { limit = 100 } = ListServicesZodSchema.parse(
        request.params.arguments,
      )

      try {
        // Fetch services from Software Catalog
        const catalogPromise = softwareCatalogApiInstance.listCatalogEntity({
          pageLimit: limit, // Use limit for catalog query
          filterKind: 'service',
        })

        // Fetch services from Logs
        const logsPromise = getServicesFromLogs(logsApiInstance)

        // Wait for both promises to resolve
        const [catalogResponse, logServices] = await Promise.all([
          catalogPromise,
          logsPromise,
        ])

        // Process Catalog results
        const catalogServices =
          catalogResponse.data
            ?.map((entity) => {
              // Assuming entity.attributes.name contains the service name
              const attributes = entity.attributes as Record<string, unknown>
              return typeof attributes?.name === 'string'
                ? attributes.name
                : null
            })
            .filter((name): name is string => name !== null) || []

        // Combine and deduplicate services
        const combinedServicesSet = new Set([
          ...catalogServices,
          ...logServices,
        ])
        const uniqueServices = Array.from(combinedServicesSet).slice(0, limit) // Apply limit to the combined list

        if (uniqueServices.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No services found in the Datadog Software Catalog or via Log aggregation.',
              },
            ],
          }
        }

        // Format response (simple list for now, adjust as needed)
        return {
          content: [
            {
              type: 'json',
              json: { services: uniqueServices, count: uniqueServices.length },
            },
          ],
        }
      } catch (error: unknown) {
        // Keep existing error handling, potentially enhance for combined errors
        if (
          typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof (error as { message?: unknown }).message === 'string'
        ) {
          const errorMessage = (error as { message: string }).message
          if (errorMessage.includes('403')) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: Your Datadog API credentials lack permissions for Software Catalog or Logs. Please check API key permissions. Error: ${errorMessage}`,
                },
              ],
            }
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error retrieving services: ${errorMessage}`,
                },
              ],
            }
          }
        }

        // Fallback for unknown error types
        return {
          content: [
            {
              type: 'text',
              text: `Error retrieving services: ${String(error)}`,
            },
          ],
        }
      }
    },
    list_apm_resources: async (request) => {
      const { service, limit = 100 } = ListResourcesZodSchema.parse(
        request.params.arguments,
      )

      try {
        // Retrieve spans for the specific service to extract resource names
        const response = await spansApiInstance.listSpans({
          body: {
            data: {
              attributes: {
                filter: {
                  query: `service:${service}`, // Filter by service
                  from: new Date(
                    Date.now() - 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(), // Last 7 days
                  to: new Date().toISOString(),
                },
                sort: '-timestamp',
                page: { limit: 5000 }, // Match the limit used in list_services previously for consistency
              },
              type: 'search_request',
            },
          },
        })

        if (!response.data) {
          throw new Error('No spans data returned')
        }

        // Extract unique resources (operations) from spans
        const resourcesSet = new Set<string>()

        response.data.forEach((span) => {
          // Use type assertion to access properties on attributes
          const attributes = span.attributes as Record<
            string,
            string | undefined
          >
          // Try different possible property names for operations/resources
          const resourceName =
            attributes.name ||
            attributes.resource ||
            attributes.operation ||
            attributes.operation_name

          if (resourceName) {
            resourcesSet.add(resourceName)
          }
        })

        // Convert to array and apply pagination
        const resources = Array.from(resourcesSet).slice(0, limit)

        // Format response
        const resourcesList = resources.map((resource) => ({
          name: resource,
          service,
        }))

        return {
          content: [
            {
              type: 'text',
              text: `APM Resources for ${service}: ${JSON.stringify({
                resources: resourcesList,
                count: resourcesList.length,
              })}`,
            },
          ],
        }
      } catch (error: unknown) {
        // Handle all error types with appropriate responses
        if (
          typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
        ) {
          if (error.message.includes('403')) {
            // Permission error (403)
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: Your Datadog API credentials don't have sufficient permissions to access APM data. Please check that your API key has APM/Tracing permissions enabled in your Datadog account settings.`,
                },
              ],
            }
          } else {
            // Other errors with message
            return {
              content: [
                {
                  type: 'text',
                  text: `Error retrieving APM resources: ${error.message}`,
                },
              ],
            }
          }
        }

        // Fallback for unknown error types
        return {
          content: [
            {
              type: 'text',
              text: `Error retrieving APM resources: ${String(error)}`,
            },
          ],
        }
      }
    },
  }
}
