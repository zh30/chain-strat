import { useEffect, useState } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { battleRecorderAbi } from '../lib/abi'
import { shortAddress } from '../lib/chain'
import { useGame } from '../store'

interface Row {
  address: `0x${string}`
  wins: number
  losses: number
  draws: number
  rating: number
}

const RANK_MARK = ['壹', '贰', '叁']
const SEAT_FIRE = ['金焰', '银焰', '铜焰'] as const

function games(row: Row): number {
  return row.wins + row.losses + row.draws
}

function winRate(row: Row): number {
  const n = games(row)
  return n === 0 ? 0 : Math.round((row.wins / n) * 100)
}

function recordLine(row: Row): string {
  return `${row.wins}胜 ${row.losses}负${row.draws > 0 ? ` ${row.draws}平` : ''}`
}

export function Ladder() {
  const client = usePublicClient()
  const { address: me } = useAccount()
  const setScreen = useGame((s) => s.setScreen)
  const [rows, setRows] = useState<Row[]>([])
  const [note, setNote] = useState('石阶还在认旗…')
  const recorder = (import.meta.env.VITE_BATTLE_RECORDER_ADDRESS ||
    '0x0000000000000000000000000000000000000000') as `0x${string}`

  useEffect(() => {
    async function load(): Promise<void> {
      if (!client || recorder.endsWith('0000')) {
        setNote('战报还没入渊。打完一局并刻上链，石阶才会认你。')
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
        setNote(next.length === 0 ? '石阶还是空的。去打一局，把胜负刻上来。' : '')
      } catch {
        setNote('石阶读旗失败，稍后再试。')
      }
    }
    void load()
  }, [client, recorder])

  const first = rows[0]
  const second = rows[1]
  const third = rows[2]
  const rest = rows.slice(3)
  const myIndex = me ? rows.findIndex((r) => r.address.toLowerCase() === me.toLowerCase()) : -1
  const mine = myIndex >= 0 ? rows[myIndex] : null

  return (
    <section className="roll">
      <div className="roll-head">
        <div>
          <p className="page-kicker">石阶</p>
          <h2 className="font-display mt-1 text-4xl text-gold sm:text-5xl">名册</h2>
          <p className="mt-2 max-w-md text-sm text-mute">渊底没有观众席。只有一圈冷火石阶。没上链的胜负，石阶不认。</p>
        </div>
        <button type="button" className="text-sm tracking-[0.2em] text-mute" onClick={() => setScreen('hall')}>
          回策场
        </button>
      </div>

      {note && rows.length === 0 && (
        <div className="roll-empty">
          <b>虚位</b>
          <div>
            <strong>石阶还是空的</strong>
            <p>{note}</p>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="roll-ring" aria-label="最高三席">
            <Seat rank={2} row={second} mine={second ? isMine(second, me) : false} />
            <Seat rank={1} row={first} mine={first ? isMine(first, me) : false} />
            <Seat rank={3} row={third} mine={third ? isMine(third, me) : false} />
          </div>

          {mine && (
            <div className={`roll-yours ${myIndex < 3 ? 'is-high' : ''}`}>
              <b>你</b>
              <div>
                <strong>第 {myIndex + 1} 席 · {mine.rating}</strong>
                <p>
                  {myIndex === 0
                    ? '金焰在你脚下。'
                    : myIndex < 3
                      ? '你坐在最高的冷火里。'
                      : '还没走到最高的三席。'}
                  <span className="ml-2 text-mute">{recordLine(mine)}</span>
                </p>
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <ol className="roll-slabs">
              {rest.map((row, i) => {
                const rank = i + 4
                const self = isMine(row, me)
                return (
                  <li key={row.address} className={self ? 'is-you' : undefined}>
                    <span className="roll-idx">{String(rank).padStart(2, '0')}</span>
                    <span className="roll-name">
                      {shortAddress(row.address)}
                      {self && <em>本座</em>}
                    </span>
                    <span className="roll-rec">{recordLine(row)}</span>
                    <span className="roll-score">{row.rating}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </>
      )}
    </section>
  )
}

function isMine(row: Row, me: string | undefined): boolean {
  return Boolean(me && row.address.toLowerCase() === me.toLowerCase())
}

function Seat({
  rank,
  row,
  mine,
}: {
  rank: 1 | 2 | 3
  row: Row | undefined
  mine: boolean
}) {
  const mark = RANK_MARK[rank - 1]
  const fire = SEAT_FIRE[rank - 1]
  return (
    <article className={`roll-seat rank-${rank} ${mine ? 'is-you' : ''} ${row ? '' : 'is-void'}`}>
      <header>
        <span>{mark}</span>
        <em>{fire}</em>
      </header>
      {row ? (
        <>
          <strong>{shortAddress(row.address)}</strong>
          {mine && <i>本座</i>}
          <b>{row.rating}</b>
          <p>
            {recordLine(row)} · 胜率 {winRate(row)}%
          </p>
        </>
      ) : (
        <p className="roll-void">此席无人</p>
      )}
    </article>
  )
}
