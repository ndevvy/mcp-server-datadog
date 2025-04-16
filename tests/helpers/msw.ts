import { RequestHandler } from 'msw'
import { SetupServerApi, setupServer as setupServerNode } from 'msw/node'

export function setupServer(...handlers: RequestHandler[]) {
  const server = setupServerNode(...handlers)
  debugServer(server)
  return server
}

function debugServer(server: SetupServerApi) {
  // Enable network request debugging
  try {
    server.listen({
      onUnhandledRequest: 'warn',
    })
  } catch (error) {
    console.error('Error setting up server:', error)
  }

  // Log all requests that pass through MSW
  server.events.on('request:start', ({ request }) => {
    console.log(`[MSW] Request started: ${request.method} ${request.url}`)
  })

  server.events.on('request:match', ({ request }) => {
    console.log(`[MSW] Request matched: ${request.method} ${request.url}`)
  })

  server.events.on('request:unhandled', ({ request }) => {
    console.log(`[MSW] Request not handled: ${request.method} ${request.url}`)
  })
}
