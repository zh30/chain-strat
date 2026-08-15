import { useEffect, useState } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { battleRecorderAbi } from '../lib/abi'
import { shortAddress } from '../lib/chain'

interface Row {
  address: `0x${string}`
  wins: number
  losses: number
  draws: number
  rating: number
}

const RANK_MARK = ['壹', '贰', '叁']

function games(row: Row): number {
  return row.wins + row.losses + row.draws
}

function winRate(row: Row): number {
  const n = games(row)
  return n === 0 ? 0 : Math.round((row.wins / n) * 100)
}

export function Ladder() {
  const client = usePublicClient()
  const { address: me } = useAccount()
  const [rows, setRows] = useState<Row[]>([])
  const [note, setNote] = useState('正在召集名册…')
  const recorder = (import.meta.env.VITE_BATTLE_RECORDER_ADDRESS ||
    '0x0000000000000000000000000000000000000000') as `0x${string}`

  useEffect(() => {
    async function load(): Promise<void> {
      if (!client || recorder.endsWith('0000')) {
        setNote('战报官尚未入驻。打完一局并把结果上链后，名册才会出现。')
        setRows([])
        return
      }
      try {
        const count = await client.readContract({
          address: recorder,
          abi: battleRecorderAbi,
          functionName: 'playerCount',
        })
        const n = Number(count)
        const next: Row[] = []
        for (let i = 0; i < Math.min(n, 50); i++) {
          const address = await client.readContract({
            address: recorder,
            abi: battleRecorderAbi,
            functionName: 'playerAt',
            args: [BigInt(i)],
          })
          const stats = await client.readContract({
            address: recorder,
            abi: battleRecorderAbi,
            functionName: 'getStats',
            args: [address],
          })
          next.push({
            address,
            wins: stats.wins,
            losses: stats.losses,
            draws: stats.draws,
            rating: stats.rating,
          })
        }
        next.sort((a, b) => b.rating - a.rating || b.wins - a.wins)
        setRows(next)
        setNote(next.length === 0 ? '尚无名将。去打一局，把胜负刻上链。' : '')
      } catch {
        setNote('名册读取失败，稍后再试。')
      }
    }
    void load()
  }, [client, recorder])

  const podium = rows.slice(0, 3)
  const rest = rows.slice(3)
  const myIndex = me ? rows.findIndex((r) => r.address.toLowerCase() === me.toLowerCase()) : -1

  return (
    <section>
      <div className="mb-8 text-center">
        <div className="text-xs uppercase tracking-[0.45em] text-gold-dim">Monad Testnet</div>
        <h2 className="font-display mt-2 text-5xl tracking-[0.28em] text-gold">天梯</h2>
        <p className="mt-3 text-sm text-mute">胜负上链之后，才会刻上这块名册。</p>
      </div>

      {note && (
        <div className="panel mx-auto max-w-lg rounded-2xl px-6 py-10 text-center">
          <div className="font-display text-2xl text-gold-dim">虚位以待</div>
          <p className="mt-3 text-sm text-mute">{note}</p>
        </div>
      )}

      {podium.length > 0 && (
        <div className="mb-10 flex flex-col items-center gap-4">
          {podium[0] && (
            <div className="w-full max-w-xs">
              <PodiumCard rank={1} row={podium[0]} mine={isMine(podium[0], me)} />
            </div>
          )}
          {(podium[1] || podium[2]) && (
            <div className="grid w-full max-w-3xl grid-cols-2 items-start gap-3 sm:gap-8">
              {podium[1] ? (
                <PodiumCard rank={2} row={podium[1]} mine={isMine(podium[1], me)} />
              ) : (
                <div />
              )}
              {podium[2] ? (
                <PodiumCard rank={3} row={podium[2]} mine={isMine(podium[2], me)} />
              ) : (
                <div />
              )}
            </div>
          )}
        </div>
      )}

      {myIndex >= 0 && (
        <p className="mb-4 text-center text-xs tracking-[0.2em] text-gold-dim">
          你的位次 · 第 {myIndex + 1} 名 · {rows[myIndex]!.rating} 分
        </p>
      )}

      {rest.length > 0 && (
        <ol className="space-y-2">
          {rest.map((row, i) => {
            const rank = i + 4
            const mine = isMine(row, me)
            return (
              <li
                key={row.address}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                  mine ? 'border-gold bg-gold/10' : 'border-line bg-panel/80'
                }`}
              >
                <div className="font-display w-10 text-xl text-gold-dim">{String(rank).padStart(2, '0')}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {shortAddress(row.address)}
                    {mine && <span className="ml-2 text-[11px] tracking-widest text-gold">你</span>}
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-2">
                    <div className="h-full bg-gold/80" style={{ width: `${winRate(row)}%` }} />
                  </div>
                </div>
                <div className="hidden text-right text-xs text-mute sm:block">
                  {row.wins}胜 {row.losses}负
                  {row.draws > 0 ? ` ${row.draws}平` : ''}
                </div>
                <div className="font-display w-16 text-right text-2xl text-gold">{row.rating}</div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function isMine(row: Row, me: string | undefined): boolean {
  return Boolean(me && row.address.toLowerCase() === me.toLowerCase())
}

const METAL = {
  1: {
    name: '金',
    text: 'text-[#e4c36a]',
    border: 'border-[#e4c36a]',
    glow: 'shadow-[0_0_32px_rgba(228,195,106,0.28)]',
    fill: 'bg-[#e4c36a]/15',
    bar: 'bg-[#e4c36a]',
    face: 'from-[#f3de9a] to-[#b8892a]',
  },
  2: {
    name: '银',
    text: 'text-[#c5cdd8]',
    border: 'border-[#c5cdd8]',
    glow: 'shadow-[0_0_24px_rgba(197,205,216,0.2)]',
    fill: 'bg-[#c5cdd8]/12',
    bar: 'bg-[#c5cdd8]',
    face: 'from-[#eef2f6] to-[#8e99a6]',
  },
  3: {
    name: '铜',
    text: 'text-[#c47a4a]',
    border: 'border-[#c47a4a]',
    glow: 'shadow-[0_0_24px_rgba(196,122,74,0.22)]',
    fill: 'bg-[#c47a4a]/12',
    bar: 'bg-[#c47a4a]',
    face: 'from-[#e0a06a] to-[#8a4a28]',
  },
} as const

function PodiumCard({ rank, row, mine }: { rank: 1 | 2 | 3; row: Row; mine: boolean }) {
  const metal = METAL[rank]
  const first = rank === 1

  return (
    <article className="flex flex-col items-center">
      <div
        className={`w-full rounded-3xl border-2 bg-ink-2/80 p-5 ${metal.border} ${metal.glow} ${
          first ? 'px-6 py-7' : 'py-5'
        } ${mine ? 'ring-2 ring-offset-2 ring-offset-ink' : ''}`}
      >
        <div className="flex items-baseline justify-between">
          <span className={`font-display ${first ? 'text-4xl' : 'text-3xl'} ${metal.text}`}>
            {RANK_MARK[rank - 1]}
          </span>
          <span className={`text-[11px] uppercase tracking-[0.3em] ${metal.text}`}>{metal.name} · No.{rank}</span>
        </div>
        <div
          className={`mt-5 flex items-center justify-center rounded-2xl bg-gradient-to-b ${metal.face} font-display text-ink ${
            first ? 'h-20 text-4xl' : 'h-14 text-3xl'
          }`}
        >
          {shortAddress(row.address).slice(2, 4).toUpperCase()}
        </div>
        <div className="mt-4 truncate text-sm">
          {shortAddress(row.address)}
          {mine && <span className={`ml-2 ${metal.text}`}>· 你</span>}
        </div>
        <div className={`font-display mt-1 ${first ? 'text-5xl' : 'text-3xl'} ${metal.text}`}>{row.rating}</div>
        <div className="mt-1 text-xs text-mute">
          {row.wins}胜 {row.losses}负 · 胜率 {winRate(row)}%
        </div>
      </div>
      <div
        className={`mt-0 h-3 w-[72%] bg-gradient-to-b ${metal.face} ${first ? 'h-5 w-[78%]' : ''}`}
        style={{ clipPath: 'polygon(8% 0, 92% 0, 100% 100%, 0 100%)' }}
      />
      <div className={`h-2 w-[88%] ${metal.bar} opacity-80 ${first ? 'h-3 w-[92%]' : ''}`} />
    </article>
  )
}
