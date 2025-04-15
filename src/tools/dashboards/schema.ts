import { z } from 'zod'

export const ListDashboardsZodSchema = z.object({
  name: z.string().optional().describe('Filter dashboards by name'),
  tags: z.array(z.string()).optional().describe('Filter dashboards by tags'),
})

export const GetDashboardZodSchema = z.object({
  dashboardId: z.string(),
})

// Define a more structured Widget schema that matches the Datadog API expectation
const WidgetSchema = z
  .object({
    definition: z
      .object({
        type: z.string(),
        title: z.string().optional(),
        // Other properties will be allowed through unknown
      })
      .passthrough(),
    id: z.number().optional(),
    layout: z
      .object({
        x: z.number().optional(),
        y: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      })
      .optional(),
  })
  .passthrough()

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
    .array(WidgetSchema)
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

// Define a more structured Cell schema that matches the Datadog API expectation
// Export this schema so it can be imported by tool.ts
export const NotebookCellSchema = z
  .object({
    type: z.string(),
    // For markdown cells
    content: z.string().optional(),
    // For widget cells - Use a generic record to hopefully translate better for LLM schema generation
    definition: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

export const CreateNotebookZodSchema = z.object({
  name: z.string().describe('The name of the notebook'),
  cells: z
    .array(NotebookCellSchema)
    .optional()
    .describe('Cells to include in the notebook'),
  time: z
    .string()
    .optional()
    .default('1h')
    .describe('Time settings for the notebook'),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Additional metadata for the notebook'),
})

// Schema for adding a cell to an existing notebook
export const AddCellToNotebookZodSchema = z.object({
  notebookId: z.number().describe('The ID of the notebook to add the cell to'),
  cell: NotebookCellSchema.describe('The cell definition to add'),
})
