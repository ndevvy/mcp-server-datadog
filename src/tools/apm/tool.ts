import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v2 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import {
  ListServicesZodSchema,
  SearchResourcesZodSchema,
  ListOperationsZodSchema,
  GetResourceHashZodSchema,
} from './schema'
import type { LogsAggregateRequest } from '@datadog/datadog-api-client/dist/packages/datadog-api-client-v2/models/LogsAggregateRequest'

type APMToolName =
  | 'list_apm_services'
  | 'list_apm_resources'
  | 'list_apm_operations'
  | 'get_resource_hash'
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
    SearchResourcesZodSchema,
    'list_apm_resources',
    'Get list of APM resources for a specific service from Datadog, optionally filtered by operation name',
  ),
  createToolSchema(
    ListOperationsZodSchema,
    'list_apm_operations',
    'Get list of top operation names for a specific service from Datadog',
  ),
  createToolSchema(
    GetResourceHashZodSchema,
    'get_resource_hash',
    'Get the resource hash for a specific resource name within a service',
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
              type: 'text',
              text: JSON.stringify({
                services: uniqueServices,
                count: uniqueServices.length,
              }),
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
      const {
        service,
        search_query,
        entry_spans_only = true,
        limit = 1000,
      } = SearchResourcesZodSchema.parse(request.params.arguments)

      try {
        // Build the query string to filter by service and search_query (if available)
        let queryString = `service:${service}`
        if (search_query) {
          queryString += ` resource_name:*${search_query}*`
        }

        // Add entry span filter if requested
        if (entry_spans_only) {
          queryString += ` @_top_level:1`
        }

        // Use the span analytics aggregate API to get resources
        const response = await spansApiInstance.aggregateSpans({
          body: {
            data: {
              attributes: {
                compute: [
                  {
                    aggregation: 'count',
                    type: 'total',
                  },
                ],
                filter: {
                  query: queryString,
                  from: new Date(
                    Date.now() - 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(), // Last 7 days
                  to: new Date().toISOString(),
                },
                groupBy: [
                  {
                    facet: 'resource_name',
                    limit: 1000,
                    sort: {
                      order: 'desc',
                    },
                    total: true,
                  },
                ],
              },
              type: 'aggregate_request',
            },
          },
        })

        // Handle potential errors or empty responses
        if (
          !response.data ||
          !Array.isArray(response.data) ||
          response.data.length === 0
        ) {
          return {
            content: [
              {
                type: 'text',
                text: `No resources found for service: ${service}`,
              },
            ],
          }
        }

        // Parse the bucket structure based on the example
        interface SpansBucket {
          type: string
          attributes?: {
            compute?: Record<string, number>
            by?: {
              resource_name?: string
            }
          }
          id: string
        }

        // Extract resource names and their counts from the buckets
        const resources = response.data
          .filter((bucket: unknown): bucket is SpansBucket => {
            if (typeof bucket !== 'object' || bucket === null) return false
            const b = bucket as Record<string, unknown>
            if (!('type' in b) || b.type !== 'bucket') return false
            if (
              !('attributes' in b) ||
              typeof b.attributes !== 'object' ||
              b.attributes === null
            )
              return false

            const attrs = b.attributes as Record<string, unknown>
            if (
              !('by' in attrs) ||
              typeof attrs.by !== 'object' ||
              attrs.by === null
            )
              return false

            const by = attrs.by as Record<string, unknown>
            if (
              !('resource_name' in by) ||
              typeof by.resource_name !== 'string'
            )
              return false

            return by.resource_name !== '__TOTAL__'
          })
          .map((bucket) => ({
            name: bucket.attributes?.by?.resource_name || '',
            service,
            count: bucket.attributes?.compute?.c0 || 0,
          }))
          .filter((resource) => resource.name !== '')
          .sort((a, b) => b.count - a.count) // Sort by count descending
          .slice(0, limit)

        if (resources.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No resources found for service: ${service}`,
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resources.map((resource) => resource.name)),
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
    list_apm_operations: async (request) => {
      const {
        service,
        entry_spans_only = false,
        limit = 100,
      } = ListOperationsZodSchema.parse(request.params.arguments)

      try {
        // Build the query string to filter by service
        let queryString = `service:${service}`

        // Add entry span filter if requested
        if (entry_spans_only) {
          queryString += ` @_top_level:1`
        }

        // Use the span analytics aggregate API to get operations
        const response = await spansApiInstance.aggregateSpans({
          body: {
            data: {
              attributes: {
                compute: [
                  {
                    aggregation: 'count',
                    type: 'total',
                  },
                ],
                filter: {
                  query: queryString,
                  from: new Date(
                    Date.now() - 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(), // Last 7 days
                  to: new Date().toISOString(),
                },
                groupBy: [
                  {
                    facet: 'operation_name',
                    limit: 1000,
                    sort: {
                      order: 'desc',
                    },
                    total: true,
                  },
                ],
              },
              type: 'aggregate_request',
            },
          },
        })

        // Handle potential errors or empty responses
        if (
          !response.data ||
          !Array.isArray(response.data) ||
          response.data.length === 0
        ) {
          return {
            content: [
              {
                type: 'text',
                text: `No operations found for service: ${service}`,
              },
            ],
          }
        }

        // Parse the bucket structure
        interface SpansBucket {
          type: string
          attributes?: {
            compute?: Record<string, number>
            by?: {
              operation_name?: string
            }
          }
          id: string
        }

        // Extract operation names and their counts from the buckets
        const operations = response.data
          .filter((bucket: unknown): bucket is SpansBucket => {
            if (typeof bucket !== 'object' || bucket === null) return false
            const b = bucket as Record<string, unknown>
            if (!('type' in b) || b.type !== 'bucket') return false
            if (
              !('attributes' in b) ||
              typeof b.attributes !== 'object' ||
              b.attributes === null
            )
              return false

            const attrs = b.attributes as Record<string, unknown>
            if (
              !('by' in attrs) ||
              typeof attrs.by !== 'object' ||
              attrs.by === null
            )
              return false

            const by = attrs.by as Record<string, unknown>
            if (
              !('operation_name' in by) ||
              typeof by.operation_name !== 'string'
            )
              return false

            return by.operation_name !== '__TOTAL__'
          })
          .map((bucket) => ({
            name: bucket.attributes?.by?.operation_name || '',
            service,
            count: bucket.attributes?.compute?.c0 || 0,
          }))
          .filter((operation) => operation.name !== '')
          .sort((a, b) => b.count - a.count) // Sort by count descending
          .slice(0, limit)

        if (operations.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No operations found for service: ${service}`,
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                operations.map((operation) => operation.name),
              ),
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
                  text: `Error retrieving APM operations: ${error.message}`,
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
              text: `Error retrieving APM operations: ${String(error)}`,
            },
          ],
        }
      }
    },
    get_resource_hash: async (request) => {
      const { service, resource_name } = GetResourceHashZodSchema.parse(
        request.params.arguments,
      )

      try {
        // Build the query string to filter by service and resource name
        const queryString = `service:${service} resource_name:${resource_name}`

        // Use the span analytics search API to find the resource hash
        const response = await spansApiInstance.listSpans({
          body: {
            data: {
              attributes: {
                filter: {
                  query: queryString,
                  from: new Date(
                    Date.now() - 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(), // Last 7 days
                  to: new Date().toISOString(),
                },
                sort: 'timestamp',
                page: {
                  limit: 1, // We only need one span to get the resource hash
                },
              },
              type: 'search_request',
            },
          },
        })

        // Handle potential errors or empty responses
        if (
          !response.data ||
          !Array.isArray(response.data) ||
          response.data.length === 0
        ) {
          return {
            content: [
              {
                type: 'text',
                text: `No spans found for service: ${service} and resource: ${resource_name}`,
              },
            ],
          }
        }

        // Extract the resource hash from the span data
        const span = response.data[0]
        const resourceHash = span.attributes?.resourceHash

        if (!resourceHash) {
          return {
            content: [
              {
                type: 'text',
                text: `Resource hash not found for service: ${service} and resource: ${resource_name}`,
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ resource_hash: resourceHash }),
            },
          ],
        }
      } catch (error: unknown) {
        // Error handling
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
                  text: `Error retrieving resource hash: ${error.message}`,
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
              text: `Error retrieving resource hash: ${String(error)}`,
            },
          ],
        }
      }
    },
  }
}
