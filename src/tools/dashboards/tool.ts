import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import { z } from 'zod'
import {
  CreateDashboardZodSchema,
  GetDashboardZodSchema,
  ListDashboardsZodSchema,
  ListNotebooksZodSchema,
  GetNotebookZodSchema,
  CreateNotebookZodSchema,
  AddCellToNotebookZodSchema,
  NotebookCellSchema,
} from './schema'

type DashboardsToolName =
  | 'list_dashboards'
  | 'get_dashboard'
  | 'create_dashboard'
  | 'list_notebooks'
  | 'get_notebook'
  | 'create_notebook'
  | 'add_cell_to_notebook'
type DashboardsTool = ExtendedTool<DashboardsToolName>

export const DASHBOARDS_TOOLS: DashboardsTool[] = [
  createToolSchema(
    ListDashboardsZodSchema,
    'list_dashboards',
    'Get list of dashboards from Datadog',
  ),
  createToolSchema(
    GetDashboardZodSchema,
    'get_dashboard',
    'Get a dashboard from Datadog',
  ),
  createToolSchema(
    CreateDashboardZodSchema,
    'create_dashboard',
    'Create a new dashboard in Datadog',
  ),
  createToolSchema(
    ListNotebooksZodSchema,
    'list_notebooks',
    'Get list of notebooks from Datadog',
  ),
  createToolSchema(
    GetNotebookZodSchema,
    'get_notebook',
    'Get a notebook from Datadog',
  ),
  createToolSchema(
    CreateNotebookZodSchema,
    'create_notebook',
    'Create a new notebook in Datadog',
  ),
  createToolSchema(
    AddCellToNotebookZodSchema,
    'add_cell_to_notebook',
    'Add a cell to an existing Datadog notebook',
  ),
] as const

type DashboardsToolHandlers = ToolHandlers<DashboardsToolName>

// Define a type for the expected input cell structure
// Not used in the current implementation but kept for reference
/* 
interface InputCell {
  type: string
  // Input might have content (markdown) or definition (widgets)
  content?: string
  definition?: Record<string, unknown>
  // Allow other potential properties
  [key: string]: unknown
}
*/

// Define a type for the expected Datadog error body structure
type DatadogApiErrorBody = {
  errors?: string[]
}

// Function to format a cell for API requests (create/update)
const formatCellForApi = (
  cellInput: z.infer<typeof NotebookCellSchema>,
): v1.NotebookCellCreateRequestAttributes | null => {
  // Handle Markdown Cells specifically
  if (cellInput.type === 'markdown' && cellInput.content) {
    // Construct the attributes object
    const markdownAttributes = {
      definition: {
        type: 'markdown', // Use string literal
        text: cellInput.content,
        fontSize: 'auto',
        textAlign: 'left',
      },
    }
    // Cast the whole attributes object
    return markdownAttributes as unknown as v1.NotebookCellCreateRequestAttributes
  }

  // Handle Widget Cells
  if (
    cellInput.type &&
    cellInput.definition &&
    typeof cellInput.definition === 'object'
  ) {
    if (
      !cellInput.definition.type ||
      typeof cellInput.definition.type !== 'string'
    ) {
      console.warn(
        "Widget definition lacks a valid string 'type'. Attempting to use outer type.",
        cellInput,
      )
      cellInput.definition.type = String(cellInput.type)
    }
    const widgetAttributes: v1.NotebookCellCreateRequestAttributes = {
      // @ts-expect-error - This is a valid cast
      definition: cellInput.definition as unknown as v1.WidgetDefinition,
    }
    return widgetAttributes
  }

  console.warn(
    'Skipping cell due to invalid format or missing data:',
    cellInput,
  )
  return null
}

export const createDashboardsToolHandlers = (
  apiInstance: v1.DashboardsApi,
  notebooksApi?: v1.NotebooksApi,
): DashboardsToolHandlers => {
  return {
    list_dashboards: async (request) => {
      const { name, tags } = ListDashboardsZodSchema.parse(
        request.params.arguments,
      )

      const response = await apiInstance.listDashboards({
        filterShared: false,
      })

      if (!response.dashboards) {
        throw new Error('No dashboards data returned')
      }

      // Filter dashboards based on name and tags if provided
      let filteredDashboards = response.dashboards
      if (name) {
        const searchTerm = name.toLowerCase()
        filteredDashboards = filteredDashboards.filter((dashboard) =>
          dashboard.title?.toLowerCase().includes(searchTerm),
        )
      }
      if (tags && tags.length > 0) {
        filteredDashboards = filteredDashboards.filter((dashboard) => {
          const dashboardTags = dashboard.description?.split(',') || []
          return tags.every((tag) => dashboardTags.includes(tag))
        })
      }

      const dashboards = filteredDashboards.map((dashboard) => ({
        ...dashboard,
        url: `https://app.datadoghq.com/dashboard/${dashboard.id}`,
      }))

      return {
        content: [
          {
            type: 'text',
            text: `Dashboards: ${JSON.stringify(dashboards)}`,
          },
        ],
      }
    },
    get_dashboard: async (request) => {
      const { dashboardId } = GetDashboardZodSchema.parse(
        request.params.arguments,
      )

      const response = await apiInstance.getDashboard({
        dashboardId,
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response),
          },
        ],
      }
    },

    create_dashboard: async (request) => {
      const { title, description, layoutType, widgets, tags } =
        CreateDashboardZodSchema.parse(request.params.arguments)

      const dashboardDefinition: v1.Dashboard = {
        layoutType: layoutType,
        title: title,
        description: description,
        widgets: widgets
          ? widgets.map(
              (widget) =>
                ({
                  definition: widget.definition,
                  id: widget.id,
                  layout: widget.layout,
                }) as v1.Widget,
            )
          : [],
        tags: tags,
      }

      const response = await apiInstance.createDashboard({
        body: dashboardDefinition,
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response),
          },
        ],
      }
    },

    list_notebooks: async (request) => {
      if (!notebooksApi) {
        throw new Error('Notebooks API not initialized')
      }

      const {
        query,
        authorHandle,
        excludeAuthorHandle,
        includeCells,
        isTemplate,
        type,
        count,
        start,
        sortField,
        sortDir,
      } = ListNotebooksZodSchema.parse(request.params.arguments)

      const response = await notebooksApi.listNotebooks({
        authorHandle,
        excludeAuthorHandle,
        start,
        count,
        sortField,
        sortDir,
        query,
        includeCells,
        isTemplate,
        type,
      })

      if (!response.data) {
        throw new Error('No notebooks data returned')
      }

      const notebooks = response.data.map((notebook) => {
        const attributes = notebook.attributes // Use inferred type

        if (!attributes) {
          return {
            author: { name: undefined, email: undefined },
            cell_names: [],
            tags: [],
            name: undefined,
            is_favorite: undefined,
            created: undefined,
            modified: undefined,
            status: undefined,
          }
        }

        const author = attributes.author
        // Omit cells processing as accessing definition causes type errors without 'any'
        // const cells = attributes.cells || []
        // const cell_names = cells.map(...) Omitted

        // Omit tags and is_favorite as they rely on properties not in the strict type definitions
        // const tags = ... Omitted
        // const is_favorite = ... Omitted

        return {
          author: {
            name: author?.name,
            email: author?.email,
          },
          // cell_names: [], // Omitted
          // tags: [], // Omitted
          name: attributes.name,
          // is_favorite: undefined, // Omitted
          created: attributes.created,
          modified: attributes.modified,
          status: attributes.status,
          id: notebook.id,
          link: `https://app.datadoghq.com/notebooks/${notebook.id}`,
        }
      })

      return {
        content: [
          {
            type: 'text',
            text: `Notebooks: ${JSON.stringify(notebooks)}`,
          },
        ],
      }
    },

    get_notebook: async (request) => {
      if (!notebooksApi) {
        throw new Error('Notebooks API not initialized')
      }

      const { notebookId } = GetNotebookZodSchema.parse(
        request.params.arguments,
      )

      const response = await notebooksApi.getNotebook({
        notebookId,
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response?.data),
          },
        ],
      }
    },

    create_notebook: async (request) => {
      if (!notebooksApi) {
        throw new Error('Notebooks API not initialized')
      }

      // Only destructure needed variables
      const { name, cells } = CreateNotebookZodSchema.parse(
        request.params.arguments,
      )

      const notebookCells = (cells || [])
        .map((cellInput) => {
          const attributes = formatCellForApi(cellInput)
          // Use a simpler structure for filtering
          return attributes
            ? { type: 'notebook_cells' as const, attributes: attributes }
            : null
        })
        // Adjust the type predicate to be less strict, checking only for non-null
        .filter(
          (
            cell,
          ): cell is {
            type: 'notebook_cells'
            attributes: v1.NotebookCellCreateRequestAttributes
          } => cell !== null,
        )

      // Create a very simple request
      const notebookData = {
        data: {
          attributes: {
            name: name,
            // Cast the cells array to the expected API type
            cells: notebookCells as v1.NotebookCellCreateRequest[],
            status: 'published' as v1.NotebookStatus,
            time: { liveSpan: '1h' },
          },
          type: 'notebooks' as const,
        },
      }

      try {
        // Log the detailed structure before sending
        console.log('--- Preparing to send Notebook Data ---')
        console.log(JSON.stringify(notebookData, null, 2))
        console.log('--------------------------------------')

        // Use double casting to avoid type issues
        const typedRequest = notebookData as unknown as v1.NotebookCreateRequest

        console.log('Sending typed request to Datadog API...')
        const response = await notebooksApi.createNotebook({
          body: typedRequest,
        })
        console.log('Notebook created successfully:', response)

        // Construct the success response text safely
        const notebookId = response?.data?.id
        const responseText = notebookId
          ? `Notebook created (ID: ${notebookId}, Cells Processed: ${notebookCells.length}): https://app.datadoghq.com/notebook/${notebookId}`
          : `Notebook created (Cells Processed: ${notebookCells.length}), but ID not found in response.`

        return {
          content: [
            {
              type: 'text',
              text: responseText,
            },
          ],
        }
      } catch (error: unknown) {
        // Catch as 'unknown' for safer type checking
        // Log the error details to the server console first
        console.error('--- Error Creating Notebook ---')
        let guidanceMessage =
          'Notebook creation failed. An unexpected error occurred.' // Default message
        let apiErrorBody: DatadogApiErrorBody | null = null // Use the defined type

        if (error && typeof error === 'object') {
          if ('message' in error) {
            console.error('Error Message:', (error as Error).message)
          }
          if ('body' in error && error.body && typeof error.body === 'object') {
            // Check if body is an object
            console.error('Attempting to log API Error Body...')
            // Type assertion is safer here now
            apiErrorBody = error.body as DatadogApiErrorBody
            try {
              console.error(
                'API Error Body:',
                JSON.stringify(error.body, null, 2),
              )
            } catch (parseError) {
              console.error(
                'Could not parse API Error Body. Raw body:',
                error.body,
              )
              console.error('Parse Error:', parseError)
            }
          }
        } else {
          console.error('Unknown error object:', error)
        }
        console.error('------------------------------')

        // Now, construct guidance for the LLM
        if (
          apiErrorBody &&
          apiErrorBody.errors &&
          Array.isArray(apiErrorBody.errors) &&
          apiErrorBody.errors.length > 0 &&
          typeof apiErrorBody.errors[0] === 'string'
        ) {
          const apiErrorString = apiErrorBody.errors[0]
          if (apiErrorString.startsWith('API input validation failed:')) {
            // Extract the details part
            const validationDetailsMatch = apiErrorString.match(
              /API input validation failed: (.*)/,
            )
            const validationDetails = validationDetailsMatch
              ? validationDetailsMatch[1]
              : apiErrorString

            // Try to find keywords
            const mentionsRequests = /requests/.test(validationDetails)
            const mentionsDefinition = /definition|attributes/.test(
              validationDetails,
            )
            const mentionsCells = /cells/.test(validationDetails)

            guidanceMessage = `Notebook creation failed due to API input validation.\nError Details: ${validationDetails}\n`

            if (mentionsCells && mentionsDefinition && mentionsRequests) {
              guidanceMessage += `\nGuidance: The error often relates to the 'requests' array within the 'definition' of one or more timeseries cells. Please double-check that structure. Each timeseries definition needs its own 'type': 'timeseries' and a valid 'requests' array: definition: { type: 'timeseries', title: '...', requests: [{ q: '...', display_type: '...' }] }`
            } else if (mentionsCells && mentionsDefinition) {
              guidanceMessage += `\nGuidance: The error seems related to the 'definition' structure within a cell. Ensure each widget cell's definition has the correct fields required by its 'type'.`
            } else {
              guidanceMessage += `\nGuidance: Review the structure of the cells provided, paying close attention to the validation details.`
            }
          } else {
            // API error, but not the validation format we expected
            guidanceMessage = `Notebook creation failed. Datadog API Error: ${apiErrorString}`
          }
        } else if (error instanceof Error) {
          // Handle cases where body wasn't available/parsed or errors array missing
          guidanceMessage = `Notebook creation failed. Error: ${error.message}`
        } else if (apiErrorBody) {
          // Body existed but didn't match expected structure
          guidanceMessage = `Notebook creation failed with an unexpected API error format. Check server logs for details.`
        } else {
          // Handle completely unknown errors
          guidanceMessage = `Notebook creation failed with an unknown error. Check server logs.`
        }

        // Return the formatted guidance to the LLM instead of throwing
        return {
          content: [
            {
              type: 'text',
              text: guidanceMessage,
            },
          ],
        }
      }
    },

    add_cell_to_notebook: async (request) => {
      if (!notebooksApi) {
        throw new Error('Notebooks API not initialized')
      }

      const { notebookId, cell: newCellInput } =
        AddCellToNotebookZodSchema.parse(request.params.arguments)

      try {
        // 1. Fetch the existing notebook
        console.log(`Fetching notebook ${notebookId}...`)
        const existingNotebook = await notebooksApi.getNotebook({ notebookId })

        if (!existingNotebook.data?.attributes) {
          throw new Error(
            `Could not fetch attributes for notebook ${notebookId}`,
          )
        }
        const attributes = existingNotebook.data.attributes

        // 2. Format the new cell attributes
        console.log('Formatting new cell:', newCellInput)
        const formattedNewCellAttributes = formatCellForApi(newCellInput) // Call original function
        if (!formattedNewCellAttributes) {
          throw new Error('Invalid new cell definition provided.')
        }

        // Construct the cell update object
        // Generate a unique string ID. Check Datadog docs if specific format needed.
        const newCellId = `cell_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        const newCellForUpdate: v1.NotebookUpdateCell = {
          type: 'notebook_cells',
          id: newCellId,
          attributes:
            formattedNewCellAttributes as v1.NotebookCellUpdateRequestAttributes,
        }

        // 3. Get existing cells and map them to NotebookUpdateCell format
        const existingCellsForUpdate: v1.NotebookUpdateCell[] = (
          attributes.cells || []
        )
          .filter(
            (
              cell,
            ): cell is {
              id: string
              type: v1.NotebookCellResourceType
              attributes: v1.NotebookCellResponseAttributes
            } => !!cell && !!cell.id && !!cell.type && !!cell.attributes,
          )
          .map((cell) => ({
            type: cell.type,
            id: cell.id,
            attributes:
              cell.attributes as v1.NotebookCellUpdateRequestAttributes,
          }))

        const updatedCells = [...existingCellsForUpdate, newCellForUpdate]

        // 4. Prepare the update request body
        const updatePayload: v1.NotebookUpdateRequest = {
          data: {
            type: 'notebooks', // Required type for update request
            attributes: {
              cells: updatedCells,
              // Include other essential attributes from the fetched notebook
              name: attributes.name,
              status: attributes.status || 'published',
              // Ensure time is correctly typed for update
              time: attributes.time as v1.NotebookGlobalTime,
              metadata: (attributes.metadata as Record<string, unknown>) || {},
            },
          },
        }

        // 5. Call the update API
        console.log(`Updating notebook ${notebookId}...`)
        console.log('Update payload:', JSON.stringify(updatePayload, null, 2))
        const updateResponse = await notebooksApi.updateNotebook({
          notebookId,
          body: updatePayload,
        })

        return {
          content: [
            {
              type: 'text',
              text: `Successfully added cell to notebook ${notebookId}. Response: ${JSON.stringify(updateResponse.data?.id)}`,
            },
          ],
        }
      } catch (error: unknown) {
        // Log the error details to the server console first
        console.error(`--- Error Adding Cell to Notebook ${notebookId} ---`)
        let guidanceMessage = `Failed to add cell to notebook ${notebookId}. An unexpected error occurred.` // Default message
        let apiErrorBody: DatadogApiErrorBody | null = null // Use the defined type

        if (error && typeof error === 'object') {
          if ('message' in error) {
            console.error('Error Message:', (error as Error).message)
          }
          if ('body' in error && error.body && typeof error.body === 'object') {
            // Check if body is an object
            console.error('Attempting to log API Error Body...')
            // Type assertion is safer here now
            apiErrorBody = error.body as DatadogApiErrorBody
            try {
              console.error(
                'API Error Body:',
                JSON.stringify(error.body, null, 2),
              )
            } catch (parseError) {
              console.error(
                'Could not parse API Error Body. Raw body:',
                error.body,
              )
              console.error('Parse Error:', parseError)
            }
          }
        } else {
          console.error('Unknown error object:', error)
        }
        console.error('----------------------------------------------')

        // Construct guidance similar to create_notebook
        if (
          apiErrorBody &&
          apiErrorBody.errors &&
          Array.isArray(apiErrorBody.errors) &&
          apiErrorBody.errors.length > 0 &&
          typeof apiErrorBody.errors[0] === 'string'
        ) {
          const apiErrorString = apiErrorBody.errors[0]
          if (apiErrorString.startsWith('API input validation failed:')) {
            const validationDetailsMatch = apiErrorString.match(
              /API input validation failed: (.*)/,
            )
            const validationDetails = validationDetailsMatch
              ? validationDetailsMatch[1]
              : apiErrorString
            guidanceMessage = `Failed to add cell due to API input validation.\nError Details: ${validationDetails}\n\nGuidance: Check the structure of the provided cell definition. For widgets like timeseries, ensure the 'definition' object includes its own 'type' and valid 'requests' array.`
          } else {
            guidanceMessage = `Failed to add cell. Datadog API Error: ${apiErrorString}`
          }
        } else if (error instanceof Error) {
          guidanceMessage = `Failed to add cell. Error: ${error.message}`
        } else if (apiErrorBody) {
          guidanceMessage = `Failed to add cell due to an unexpected API error format. Check server logs.`
        } // Default message remains if no specific info found

        // Return the formatted guidance
        return {
          content: [
            {
              type: 'text',
              text: guidanceMessage,
            },
          ],
        }
      }
    },
  }
}
