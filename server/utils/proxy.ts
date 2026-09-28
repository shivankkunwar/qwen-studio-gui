import { H3Event } from 'h3'

export interface UpstreamConfig {
  baseUrl: string
  headers: Record<string, string>
}

export function getUpstreamConfig(event: H3Event): UpstreamConfig {
  const config = useRuntimeConfig()
  const customEndpoint = getHeader(event, 'x-custom-endpoint')
  const clientKey = getHeader(event, 'x-modal-key')
  const clientSecret = getHeader(event, 'x-modal-secret')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  // 1. If client provided custom credentials in request headers
  if (clientKey && clientSecret) {
    headers['Modal-Key'] = clientKey
    headers['Modal-Secret'] = clientSecret
    const base = customEndpoint || config.modalApiUrl
    return { baseUrl: base.replace(/\/+$/, ''), headers }
  }

  // 2. If client provided custom endpoint without explicit keys (e.g. local proxy URL)
  if (customEndpoint) {
    return { baseUrl: customEndpoint.replace(/\/+$/, ''), headers }
  }

  // 3. If server environment has Modal keys configured
  if (config.modalKey && config.modalSecret) {
    headers['Modal-Key'] = config.modalKey
    headers['Modal-Secret'] = config.modalSecret
    return {
      baseUrl: config.modalApiUrl.replace(/\/+$/, ''),
      headers
    }
  }

  // 4. Fallback to local proxy (http://127.0.0.1:8787, which holds keys in its own env)
  return {
    baseUrl: (config.localProxyUrl || 'http://127.0.0.1:8787').replace(/\/+$/, ''),
    headers
  }
}
