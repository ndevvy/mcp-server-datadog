import { ExtendedTool, ToolHandlers } from '../../utils/types'
import { v1 } from '@datadog/datadog-api-client'
import { createToolSchema } from '../../utils/tool'
import {
  CreateDashboardZodSchema,
  GetDashboardZodSchema,
  ListDashboardsZodSchema,
  ListNotebooksZodSchema,
  GetNotebookZodSchema,
  CreateNotebookZodSchema,
} from './schema'

type DashboardsToolName =
  | 'list_dashboards'
  | 'get_dashboard'
  | 'create_dashboard'
  | 'list_notebooks'
  | 'get_notebook'
  | 'create_notebook'
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
] as const

type DashboardsToolHandlers = ToolHandlers<DashboardsToolName>

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
            text: `Dashboard: ${JSON.stringify(response)}`,
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
        widgets: widgets || [],
        tags: tags,
      }

      const response = await apiInstance.createDashboard({
        body: dashboardDefinition,
      })

      return {
        content: [
          {
            type: 'text',
            text: `Dashboard created: ${JSON.stringify(response)}`,
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
            type: 'json',
            json: response,
          },
        ],
      }
    },

    create_notebook: async (request) => {
      if (!notebooksApi) {
        throw new Error('Notebooks API not initialized')
      }

      const { name, cells, status, time, metadata } =
        CreateNotebookZodSchema.parse(request.params.arguments)

      const notebookData: v1.NotebookCreateRequest = {
        data: {
          attributes: {
            name,
            cells: cells || [],
            status: status as v1.NotebookStatus,
            time,
            metadata,
          },
          type: 'notebooks',
        },
      }

      const response = await notebooksApi.createNotebook({
        body: notebookData,
      })

      return {
        content: [
          {
            type: 'json',
            json: response,
          },
        ],
      }
    },
  }
}
