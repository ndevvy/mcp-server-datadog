// Base URL for Datadog API
export const baseUrl = 'https://api.datadoghq.com/api'

export interface DatadogToolResponse {
  content: Array<{
    type: 'text'
    text: string
  }>
}
