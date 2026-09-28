export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path') || ''
  const { baseUrl, headers } = getUpstreamConfig(event)

  // /api/health -> /health; everything else routes under /v1/
  const targetPath = path === 'health' || path === 'docs' ? `/${path}` : path.startsWith('v1/') ? `/${path}` : `/v1/${path}`
  const targetUrl = `${baseUrl}${targetPath}`

  return proxyRequest(event, targetUrl, {
    headers
  })
})
