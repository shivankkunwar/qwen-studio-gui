// /api/video/<model>/<path> -> the model's own Modal API (same proxy-token auth as Qwen).
// Video apps are separate Modal deployments, so each model has its own base URL.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const model = getRouterParam(event, 'model') || ''
  const path = getRouterParam(event, 'path') || ''

  const bases: Record<string, string> = {
    ltx: config.ltxApiUrl,
    fastwan: config.fastwanApiUrl
  }
  const base = bases[model]
  if (!base) {
    throw createError({ statusCode: 404, statusMessage: `unknown video model "${model}"` })
  }

  // Keys typed in the Settings modal win; otherwise use the server's .env keys.
  const key = getHeader(event, 'x-modal-key') || config.modalKey
  const secret = getHeader(event, 'x-modal-secret') || config.modalSecret
  if (!key || !secret) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Video models need Modal proxy-token keys: set MODAL_KEY/MODAL_SECRET in gui/.env or in Settings'
    })
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Modal-Key': key,
    'Modal-Secret': secret
  }
  // <video> seeks with Range requests; the Modal API answers them with 206.
  const range = getHeader(event, 'range')
  if (range) headers.Range = range

  const targetPath = path === 'health' ? '/health' : `/v1/${path.replace(/^v1\//, '')}`
  return proxyRequest(event, `${base.replace(/\/+$/, '')}${targetPath}`, { headers })
})
