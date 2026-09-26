import { BaseError, UserRejectedRequestError } from 'viem'

export function isUserRejection(error: unknown): boolean {
  if (error instanceof UserRejectedRequestError) return true
  if (error instanceof BaseError) {
    return error.walk((err) => err instanceof UserRejectedRequestError) instanceof UserRejectedRequestError
  }
  return /user rejected|user denied|rejected the request/i.test(
    error instanceof Error ? error.message : String(error),
  )
}

/** One-shot worker request over /ws — resolves the first non-error reply. */
export async function sendWs<T>(body: unknown, serviceLabel = '服务'): Promise<T> {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const url = `${proto}://${window.location.host}/ws`
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const timer = window.setTimeout(() => {
      ws.close()
      reject(new Error(`${serviceLabel}超时`))
    }, 20_000)
    ws.onopen = () => ws.send(JSON.stringify(body))
    ws.onmessage = (ev) => {
      window.clearTimeout(timer)
      const data = JSON.parse(ev.data as string) as T & { type?: string; message?: string }
      ws.close()
      if (data && typeof data === 'object' && 'type' in data && data.type === 'error') {
        reject(new Error(data.message || `${serviceLabel}错误`))
        return
      }
      resolve(data)
    }
    ws.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error(`${serviceLabel}不可用`))
    }
  })
}
