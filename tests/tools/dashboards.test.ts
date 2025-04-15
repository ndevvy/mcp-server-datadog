import { v1 } from '@datadog/datadog-api-client'
import { describe, it, expect } from 'vitest'
import { createDatadogConfig } from '../../src/utils/datadog'
import { createDashboardsToolHandlers } from '../../src/tools/dashboards/tool'
import { createMockToolRequest } from '../helpers/mock'
import { http, HttpResponse } from 'msw'
import { setupServer } from '../helpers/msw'
import { baseUrl, DatadogToolResponse } from '../helpers/datadog'

const dashboardEndpoint = `${baseUrl}/v1/dashboard`
const notebooksEndpoint = `${baseUrl}/v1/notebooks`

describe('Dashboards Tool', () => {
  if (!process.env.DATADOG_API_KEY || !process.env.DATADOG_APP_KEY) {
    throw new Error('DATADOG_API_KEY and DATADOG_APP_KEY must be set')
  }

  const datadogConfig = createDatadogConfig({
    apiKeyAuth: process.env.DATADOG_API_KEY,
    appKeyAuth: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE,
  })

  const apiInstance = new v1.DashboardsApi(datadogConfig)
  const notebooksApi = new v1.NotebooksApi(datadogConfig)
  const toolHandlers = createDashboardsToolHandlers(apiInstance, notebooksApi)

  // https://docs.datadoghq.com/api/latest/dashboards/#get-all-dashboards
  describe.concurrent('list_dashboards', async () => {
    it('should list dashboards', async () => {
      const mockHandler = http.get(dashboardEndpoint, async () => {
        return HttpResponse.json({
          dashboards: [
            {
              id: 'q5j-nti-fv6',
              type: 'host_timeboard',
            },
          ],
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_dashboards', {
          name: 'test name',
          tags: ['test_tag'],
        })
        const response = (await toolHandlers.list_dashboards(
          request,
        )) as unknown as DatadogToolResponse
        expect(response.content[0].text).toContain('Dashboards')
      })()

      server.close()
    })

    it('should handle authentication errors', async () => {
      const mockHandler = http.get(dashboardEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['dummy authentication error'] },
          { status: 403 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_dashboards', {
          name: 'test',
        })
        await expect(toolHandlers.list_dashboards(request)).rejects.toThrow(
          'dummy authentication error',
        )
      })()

      server.close()
    })

    it('should handle too many requests', async () => {
      const mockHandler = http.get(dashboardEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['dummy too many requests'] },
          { status: 429 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_dashboards', {
          name: 'test',
        })
        await expect(toolHandlers.list_dashboards(request)).rejects.toThrow(
          'dummy too many requests',
        )
      })()

      server.close()
    })

    it('should handle unknown errors', async () => {
      const mockHandler = http.get(dashboardEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['dummy unknown error'] },
          { status: 500 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_dashboards', {
          name: 'test',
        })
        await expect(toolHandlers.list_dashboards(request)).rejects.toThrow(
          'dummy unknown error',
        )
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/ja/api/latest/dashboards/#get-a-dashboard
  describe.concurrent('get_dashboard', async () => {
    it('should get a dashboard', async () => {
      const dashboardId = '123456789'
      const mockHandler = http.get(
        `${dashboardEndpoint}/${dashboardId}`,
        async () => {
          return HttpResponse.json({
            id: '123456789',
            title: 'Dashboard',
            layout_type: 'ordered',
            widgets: [],
          })
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_dashboard', {
          dashboardId,
        })
        const response = (await toolHandlers.get_dashboard(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('123456789')
        expect(response.content[0].text).toContain('Dashboard')
        expect(response.content[0].text).toContain('ordered')
      })()

      server.close()
    })

    it('should handle not found errors', async () => {
      const dashboardId = '999999999'
      const mockHandler = http.get(
        `${dashboardEndpoint}/${dashboardId}`,
        async () => {
          return HttpResponse.json({ errors: ['Not found'] }, { status: 404 })
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_dashboard', {
          dashboardId,
        })
        await expect(toolHandlers.get_dashboard(request)).rejects.toThrow(
          'Not found',
        )
      })()

      server.close()
    })

    it('should handle server errors', async () => {
      const dashboardId = '123456789'
      const mockHandler = http.get(
        `${dashboardEndpoint}/${dashboardId}`,
        async () => {
          return HttpResponse.json(
            { errors: ['Internal server error'] },
            { status: 500 },
          )
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_dashboard', {
          dashboardId,
        })
        await expect(toolHandlers.get_dashboard(request)).rejects.toThrow(
          'Internal server error',
        )
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/dashboards/#create-a-new-dashboard
  describe.concurrent('create_dashboard', async () => {
    it('should create a dashboard', async () => {
      const mockHandler = http.post(dashboardEndpoint, async () => {
        return HttpResponse.json({
          id: 'abc-123-xyz',
          title: 'Test Dashboard',
          description: 'This is a test dashboard',
          layoutType: 'ordered',
          widgets: [],
          tags: ['test', 'dashboard'],
          url: 'https://app.datadoghq.com/dashboard/abc-123-xyz',
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('create_dashboard', {
          title: 'Test Dashboard',
          description: 'This is a test dashboard',
          layoutType: 'ordered',
          widgets: [],
          tags: ['test', 'dashboard'],
        })
        const response = (await toolHandlers.create_dashboard(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Dashboard created')
        expect(response.content[0].text).toContain('Test Dashboard')
        expect(response.content[0].text).toContain('abc-123-xyz')
      })()

      server.close()
    })

    it('should handle validation errors', async () => {
      const mockHandler = http.post(dashboardEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['The dashboard definition is invalid'] },
          { status: 400 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('create_dashboard', {
          title: 'Test Dashboard',
          layoutType: 'ordered',
        })
        await expect(toolHandlers.create_dashboard(request)).rejects.toThrow(
          'The dashboard definition is invalid',
        )
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/notebooks/#get-all-notebooks
  describe.concurrent('list_notebooks', async () => {
    it('should list notebooks', async () => {
      const mockHandler = http.get(notebooksEndpoint, async () => {
        return HttpResponse.json({
          data: [
            {
              id: 123456,
              attributes: {
                name: 'Test Notebook',
                status: 'published',
                time: {
                  live_span: '1h',
                },
                metadata: {
                  is_template: false,
                },
                created: {
                  author_handle: 'user@example.com',
                  created_at: '2023-01-01T00:00:00.000Z',
                },
                modified: {
                  author_handle: 'user@example.com',
                  modified_at: '2023-01-02T00:00:00.000Z',
                },
              },
              type: 'notebooks',
            },
          ],
          meta: {
            page: {
              total_count: 1,
              total_filtered_count: 1,
            },
          },
        })
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_notebooks', {
          query: 'test',
        })
        const response = (await toolHandlers.list_notebooks(
          request,
        )) as unknown as DatadogToolResponse
        expect(response.content[0].text).toContain('Notebooks')
        expect(response.content[0].text).toContain('Test Notebook')
      })()

      server.close()
    })

    it('should handle errors when listing notebooks', async () => {
      const mockHandler = http.get(notebooksEndpoint, async () => {
        return HttpResponse.json(
          { errors: ['An error occurred'] },
          { status: 500 },
        )
      })

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('list_notebooks', {
          query: 'test',
        })
        await expect(toolHandlers.list_notebooks(request)).rejects.toThrow(
          'An error occurred',
        )
      })()

      server.close()
    })
  })

  // https://docs.datadoghq.com/api/latest/notebooks/#get-a-notebook
  describe.concurrent('get_notebook', async () => {
    it('should get a notebook', async () => {
      const notebookId = 123456
      const mockHandler = http.get(
        `${notebooksEndpoint}/${notebookId}`,
        async () => {
          return HttpResponse.json({
            data: {
              id: 123456,
              attributes: {
                name: 'Test Notebook',
                status: 'published',
                cells: [
                  {
                    type: 'markdown',
                    content: {
                      text: '# Test Markdown',
                    },
                  },
                ],
                time: {
                  live_span: '1h',
                },
                metadata: {
                  is_template: false,
                },
                created: {
                  author_handle: 'user@example.com',
                  created_at: '2023-01-01T00:00:00.000Z',
                },
                modified: {
                  author_handle: 'user@example.com',
                  modified_at: '2023-01-02T00:00:00.000Z',
                },
              },
              type: 'notebooks',
            },
          })
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_notebook', {
          notebookId,
        })
        const response = (await toolHandlers.get_notebook(
          request,
        )) as unknown as DatadogToolResponse

        expect(response.content[0].text).toContain('Notebook')
        expect(response.content[0].text).toContain('Test Notebook')
        expect(response.content[0].text).toContain('Test Markdown')
      })()

      server.close()
    })

    it('should handle not found errors for notebooks', async () => {
      const notebookId = 999999
      const mockHandler = http.get(
        `${notebooksEndpoint}/${notebookId}`,
        async () => {
          return HttpResponse.json(
            { errors: ['Notebook not found'] },
            { status: 404 },
          )
        },
      )

      const server = setupServer(mockHandler)

      await server.boundary(async () => {
        const request = createMockToolRequest('get_notebook', {
          notebookId,
        })
        await expect(toolHandlers.get_notebook(request)).rejects.toThrow(
          'Notebook not found',
        )
      })()

      server.close()
    })
  })
})
