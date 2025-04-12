import { z } from 'zod'

export const ListDashboardsZodSchema = z.object({
  name: z.string().optional().describe('Filter dashboards by name'),
  tags: z.array(z.string()).optional().describe('Filter dashboards by tags'),
})

export const GetDashboardZodSchema = z.object({
  dashboardId: z.string(),
})

export const CreateDashboardZodSchema = z.object({
  title: z.string().describe('The title of the dashboard'),
  description: z
    .string()
    .optional()
    .describe('The description of the dashboard'),
  layoutType: z
    .enum(['ordered', 'free'])
    .default('ordered')
    .describe('The layout type of the dashboard'),
  widgets: z
    .array(z.any())
    .optional()
    .describe('The widgets to add to the dashboard'),
  tags: z
    .array(z.string())
    .optional()
    .describe('A list of tags to associate with the dashboard'),
})

export const ListNotebooksZodSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      'Return only notebooks with this query string in notebook name or author handle',
    ),
  authorHandle: z
    .string()
    .optional()
    .describe('Return notebooks created by the given author handle'),
  excludeAuthorHandle: z
    .string()
    .optional()
    .describe('Return notebooks not created by the given author handle'),
  includeCells: z
    .boolean()
    .optional()
    .describe(
      'Value of false excludes the cells and global time for each notebook',
    ),
  isTemplate: z
    .boolean()
    .optional()
    .describe('True value returns only template notebooks'),
  type: z
    .string()
    .optional()
    .describe('Return only notebooks with that metadata type'),
  count: z
    .number()
    .optional()
    .describe('The number of notebooks to be returned'),
  start: z
    .number()
    .optional()
    .describe('The index of the first notebook to return'),
  sortField: z
    .enum(['modified', 'name', 'created'])
    .optional()
    .describe('Sort by field'),
  sortDir: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
})

export const GetNotebookZodSchema = z.object({
  notebookId: z
    .number()
    .describe('Unique ID, assigned when the notebook was created'),
})

export const CreateNotebookZodSchema = z.object({
  name: z.string().describe('The name of the notebook'),
  cells: z
    .array(z.any())
    .optional()
    .describe('Cells to include in the notebook'),
  status: z
    .enum(['published', 'draft'])
    .optional()
    .default('draft')
    .describe('Status of the notebook'),
  time: z.any().optional().describe('Time settings for the notebook'),
  metadata: z.any().optional().describe('Additional metadata for the notebook'),
})
