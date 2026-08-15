import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { simulateBattle } from '../lib/combat'
import { generateBotLoadout } from '../lib/combo'
import { BOT_ADDRESS, QUEUE_TIMEOUT_MS, type MatchPayload } from '../lib/types'
import { useGame } from '../store'

export function useMatch() {
  const { address } = useAccount()
  const heroId = useGame((s) => s.heroId)
  const combo = useGame((s) => s.combo)
  const mode = useGame((s) => s.matchMode)
  const setMatch = useGame((s) => s.setMatch)
  const setScreen = useGame((s) => s.setScreen)
  const [status, setStatus] = useState<'connecting' | 'queued' | 'error'>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [leftMs, setLeftMs] = useState(QUEUE_TIMEOUT_MS)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!address || !heroId) return
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${window.location.host}/ws`
    const ws = new WebSocket(url)
    wsRef.current = ws
    let timer: number | undefined

    ws.onopen = () => {
      if (mode === 'bot') {
        ws.send(JSON.stringify({ type: 'bot', address, heroId, combo }))
      } else {
        ws.send(JSON.stringify({ type: 'queue', address, heroId, combo, rating: 1000 }))
        setStatus('queued')
        const start = Date.now()
        timer = window.setInterval(() => {
          setLeftMs(Math.max(0, QUEUE_TIMEOUT_MS - (Date.now() - start)))
        }, 200)
      }
    }

    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data as string) as
        | { type: 'matched'; payload: MatchPayload }
        | { type: 'queued'; waitMs: number }
        | { type: 'error'; message: string }
      if (data.type === 'matched') {
        setMatch(data.payload)
      } else if (data.type === 'error') {
        setStatus('error')
        setError(data.message)
      }
    }

    ws.onerror = () => {
      if (mode === 'bot') {
        const seed = Math.floor(Math.random() * 0xffffffff)
        const bot = generateBotLoadout(seed)
        const result = simulateBattle(heroId, combo, bot.heroId, bot.combo, seed)
        const fallback: MatchPayload = {
          matchId: `0x${seed.toString(16).padStart(64, '0')}`,
          seed,
          vsBot: true,
          players: [
            { address, heroId, combo, rating: 1000 },
            { address: BOT_ADDRESS, heroId: bot.heroId, combo: bot.combo, rating: 1000 },
          ],
          result,
          signature: '0x',
        }
        setMatch(fallback)
        return
      }
      setStatus('error')
      setError('匹配服务不可用')
    }

    return () => {
      if (timer) window.clearInterval(timer)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'cancel' }))
      }
      ws.close()
    }
  }, [address, heroId, combo, mode, setMatch])

  return { status, error, leftMs, cancel: () => setScreen('combo') }
}
