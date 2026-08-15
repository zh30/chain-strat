import { DurableObject } from 'cloudflare:workers'
import { keccak256, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { generateBotLoadout } from '../src/lib/combo'
import { simulateBattle } from '../src/lib/combat'
import { seedFromBytes } from '../src/lib/rng'
import { payloadToMatchMessage, signMatch } from '../src/lib/signing'
import { MONAD_TESTNET_ID } from '../src/lib/chain'
import type { HeroId, MatchPayload, PlayerLoadout } from '../src/lib/types'
import { BOT_ADDRESS, QUEUE_TIMEOUT_MS } from '../src/lib/types'

export interface Env {
  MATCHMAKER: DurableObjectNamespace
  ASSETS: Fetcher
  AUTHORITY_PRIVATE_KEY: string
  AUTHORITY_ADDRESS: string
  BATTLE_RECORDER_ADDRESS: `0x${string}`
  MONAD_RPC: string
}

interface QueueTicket {
  id: string
  address: `0x${string}`
  heroId: HeroId
  combo: string[]
  rating: number
  joinedAt: number
}

type ClientMsg =
  | { type: 'queue'; address: `0x${string}`; heroId: HeroId; combo: string[]; rating?: number }
  | { type: 'bot'; address: `0x${string}`; heroId: HeroId; combo: string[] }
  | { type: 'resume'; matchId: `0x${string}` }
  | { type: 'cancel' }

const SW_ASSETS = new Set(['/sw.js', '/registerSW.js', '/manifest.webmanifest'])

function isServiceWorkerAsset(pathname: string): boolean {
  return SW_ASSETS.has(pathname)
}

function withServiceWorkerHeaders(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-cache')
  if (pathname === '/sw.js') {
    headers.set('Service-Worker-Allowed', '/')
    headers.set('Content-Type', 'application/javascript; charset=utf-8')
  }
  if (pathname === '/manifest.webmanifest') {
    headers.set('Content-Type', 'application/manifest+json; charset=utf-8')
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/ws' || url.pathname === '/api/ws') {
      const id = env.MATCHMAKER.idFromName('global')
      return env.MATCHMAKER.get(id).fetch(request)
    }
    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, service: 'chainstrat' })
    }
    if (env.ASSETS) {
      const asset = await env.ASSETS.fetch(request)
      if (isServiceWorkerAsset(url.pathname)) {
        return withServiceWorkerHeaders(asset, url.pathname)
      }
      return asset
    }
    return new Response('ChainStrat worker', { status: 200 })
  },
}

export class Matchmaker extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }
    const pair = new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1])
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string') return
    let msg: ClientMsg
    try {
      msg = JSON.parse(raw) as ClientMsg
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'invalid json' }))
      return
    }

    try {
      if (msg.type === 'cancel') {
        await this.removeSocket(ws)
        ws.send(JSON.stringify({ type: 'cancelled' }))
        return
      }
      if (msg.type === 'resume') {
        const payload = await this.ctx.storage.get<MatchPayload>(`match:${msg.matchId}`)
        if (!payload) {
          ws.send(JSON.stringify({ type: 'error', message: 'match not found' }))
          return
        }
        ws.send(JSON.stringify({ type: 'matched', payload }))
        return
      }
      if (msg.type === 'bot') {
        await this.removeSocket(ws)
        const payload = await this.createMatch(
          {
            address: msg.address,
            heroId: msg.heroId,
            combo: msg.combo,
            rating: 1000,
          },
          null,
        )
        ws.send(JSON.stringify({ type: 'matched', payload }))
        return
      }
      if (msg.type === 'queue') {
        await this.enqueue(ws, {
          id: crypto.randomUUID(),
          address: msg.address,
          heroId: msg.heroId,
          combo: msg.combo,
          rating: msg.rating ?? 1000,
          joinedAt: Date.now(),
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'match error'
      ws.send(JSON.stringify({ type: 'error', message }))
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.removeSocket(ws)
  }

  async alarm(): Promise<void> {
    const now = Date.now()
    const queue = await this.getQueue()
    const remain: QueueTicket[] = []
    for (const ticket of queue) {
      if (now - ticket.joinedAt < QUEUE_TIMEOUT_MS) {
        remain.push(ticket)
        continue
      }
      const ws = this.socketFor(ticket.id)
      if (!ws) continue
      try {
        const payload = await this.createMatch(
          {
            address: ticket.address,
            heroId: ticket.heroId,
            combo: ticket.combo,
            rating: ticket.rating,
          },
          null,
        )
        ws.send(JSON.stringify({ type: 'matched', payload }))
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'bot match failed' }))
      }
    }
    await this.setQueue(remain)
    this.scheduleAlarm(remain)
  }

  private async enqueue(ws: WebSocket, ticket: QueueTicket): Promise<void> {
    await this.removeSocket(ws)
    const queue = await this.getQueue()
    if (queue.length > 0) {
      let bestIdx = 0
      let bestDiff = Number.POSITIVE_INFINITY
      for (let i = 0; i < queue.length; i++) {
        const diff = Math.abs(queue[i]!.rating - ticket.rating)
        if (diff < bestDiff) {
          bestDiff = diff
          bestIdx = i
        }
      }
      const other = queue[bestIdx]!
      const next = queue.filter((_, i) => i !== bestIdx)
      await this.setQueue(next)
      this.scheduleAlarm(next)

      const otherWs = this.socketFor(other.id)
      const payload = await this.createMatch(
        {
          address: ticket.address,
          heroId: ticket.heroId,
          combo: ticket.combo,
          rating: ticket.rating,
        },
        {
          address: other.address,
          heroId: other.heroId,
          combo: other.combo,
          rating: other.rating,
        },
      )
      ws.send(JSON.stringify({ type: 'matched', payload }))
      otherWs?.send(JSON.stringify({ type: 'matched', payload }))
      return
    }

    ws.serializeAttachment({ ticketId: ticket.id })
    queue.push(ticket)
    await this.setQueue(queue)
    this.scheduleAlarm(queue)
    ws.send(JSON.stringify({ type: 'queued', waitMs: QUEUE_TIMEOUT_MS }))
  }

  private socketFor(ticketId: string): WebSocket | undefined {
    return this.ctx.getWebSockets().find((ws) => {
      const att = ws.deserializeAttachment() as { ticketId?: string } | null
      return att?.ticketId === ticketId
    })
  }

  private async removeSocket(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as { ticketId?: string } | null
    if (!att?.ticketId) return
    const queue = (await this.getQueue()).filter((t) => t.id !== att.ticketId)
    await this.setQueue(queue)
    this.scheduleAlarm(queue)
    ws.serializeAttachment(null)
  }

  private async getQueue(): Promise<QueueTicket[]> {
    return (await this.ctx.storage.get<QueueTicket[]>('queue')) ?? []
  }

  private async setQueue(queue: QueueTicket[]): Promise<void> {
    await this.ctx.storage.put('queue', queue)
  }

  private scheduleAlarm(queue: QueueTicket[]): void {
    if (queue.length === 0) {
      void this.ctx.storage.deleteAlarm()
      return
    }
    const soonest = Math.min(...queue.map((t) => t.joinedAt + QUEUE_TIMEOUT_MS))
    void this.ctx.storage.setAlarm(soonest)
  }

  private async createMatch(a: Omit<PlayerLoadout, 'address'> & { address: `0x${string}` }, b: PlayerLoadout | null): Promise<MatchPayload> {
    const entropy = crypto.getRandomValues(new Uint8Array(32))
    const matchId = keccak256(entropy)
    const seed = seedFromBytes(entropy)

    let playerB: PlayerLoadout
    let vsBot = false
    if (!b) {
      vsBot = true
      const bot = generateBotLoadout(seed ^ 0x9e3779b9)
      playerB = {
        address: BOT_ADDRESS,
        heroId: bot.heroId,
        combo: bot.combo,
        rating: 1000,
      }
    } else {
      playerB = b
    }

    const result = simulateBattle(a.heroId, a.combo, playerB.heroId, playerB.combo, seed)
    const payload: MatchPayload = {
      matchId,
      seed,
      vsBot,
      players: [
        { address: a.address, heroId: a.heroId, combo: a.combo, rating: a.rating },
        playerB,
      ],
      result,
      signature: '0x',
    }

    const pk = this.env.AUTHORITY_PRIVATE_KEY
    const recorder = this.env.BATTLE_RECORDER_ADDRESS
    if (pk && recorder && recorder !== '0x0000000000000000000000000000000000000000') {
      const account = privateKeyToAccount(pk as Hex)
      payload.signature = await signMatch(
        account,
        MONAD_TESTNET_ID,
        recorder,
        payloadToMatchMessage(payload),
      )
    }

    await this.ctx.storage.put(`match:${matchId}`, payload)
    return payload
  }
}
