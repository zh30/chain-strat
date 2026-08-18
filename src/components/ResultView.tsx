import { useCallback, useEffect, useState } from 'react'
import { BaseError, UserRejectedRequestError, formatEther } from 'viem'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { arenaContractReady, useArena } from '../hooks/useArena'
import { MONAD_TESTNET_ID } from '../lib/chain'
import { battleRecorderAbi } from '../lib/abi'
import { shortAddress } from '../lib/chain'
import { hashOfResult } from '../lib/hash'
import { getHero } from '../lib/heroes'
import { payloadToMatchMessage } from '../lib/signing'
import { snapshotPlayer, type MatchReward, type PlayerSnap } from '../lib/ladder'
import type { BattleEndReason, BattleEvent, MatchPayload, Side } from '../lib/types'
import { useGame } from '../store'

const REASON_ZH: Record<BattleEndReason, string> = {
  ko: '击杀',
  timeout: '超时比血',
  sudden_death: '加时突然死亡',
  draw: '双方战平',
}

function buildReward(
  before: PlayerSnap,
  after: PlayerSnap,
  record: MatchReward['record'],
  reason: BattleEndReason,
  vsBot: boolean,
  youTally: ReturnType<typeof tally>,
  alreadyOnChain: boolean,
): MatchReward {
  const ratingDelta = alreadyOnChain ? 0 : after.rating - before.rating
  const rankDelta =
    !alreadyOnChain && before.rank !== null && after.rank !== null ? before.rank - after.rank : null
  const tags: string[] = []
  if (before.wins + before.losses + before.draws === 0 && record === 'win') tags.push('首胜铭刻')
  if (record === 'win') tags.push('战功 +1')
  if (record === 'draw') tags.push('守成')
  if (record === 'loss') tags.push('虽败犹荣')
  if (reason === 'sudden_death' && record === 'win') tags.push('加时绝杀')
  if (reason === 'ko' && record === 'win') tags.push('击杀')
  if (vsBot) tags.push('人机讨伐')
  if (youTally.crits > 0) tags.push('要害一击')
  if (youTally.dealt >= 800) tags.push('输出压制')
  if (after.rank === 1) tags.push('登顶')
  if (rankDelta !== null && rankDelta > 0) tags.push(`连升 ${rankDelta} 名`)
  if (alreadyOnChain) tags.push('本场已入册')
  return {
    ratingBefore: before.rating,
    ratingAfter: after.rating,
    ratingDelta,
    rankBefore: before.rank,
    rankAfter: after.rank,
    rankDelta,
    firstOnBoard: before.rank === null && after.rank !== null,
    record,
    tags,
    boardSize: after.boardSize,
  }
}

function tally(events: BattleEvent[], side: Side) {
  const foe: Side = side === 0 ? 1 : 0
  let dealt = 0
  let taken = 0
  let healed = 0
  let casts = 0
  let crits = 0
  for (const event of events) {
    if (event.type === 'start_cast' && event.side === side) casts += 1
    if (event.type === 'damage' && event.side === foe) {
      dealt += event.amount
      if (event.isCrit) crits += 1
    }
    if (event.type === 'dot_tick' && event.side === foe) dealt += event.amount
    if (event.type === 'damage' && event.side === side) taken += event.amount
    if (event.type === 'dot_tick' && event.side === side) taken += event.amount
    if (event.type === 'heal' && event.side === side) healed += event.amount
  }
  return { dealt, taken, healed, casts, crits }
}

const autoStarted = new Set<string>()

function isUserRejection(error: unknown): boolean {
  if (error instanceof UserRejectedRequestError) return true
  if (error instanceof BaseError) {
    return error.walk((err) => err instanceof UserRejectedRequestError) instanceof UserRejectedRequestError
  }
  return /user rejected|user denied|rejected the request/i.test(
    error instanceof Error ? error.message : String(error),
  )
}

export function ResultView() {
  const match = useGame((s) => s.match)
  const clearMatch = useGame((s) => s.clearMatch)
  const setScreen = useGame((s) => s.setScreen)
  const { address } = useAccount()
  const client = usePublicClient({ chainId: MONAD_TESTNET_ID })
  const { writeContractAsync } = useWriteContract()
  const arena = useArena()
  const [tx, setTx] = useState<string | null>(null)
  const [arenaPhase, setArenaPhase] = useState<'idle' | 'pending' | 'done' | 'failed'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'wallet' | 'pending' | 'done' | 'failed'>('idle')
  const [reward, setReward] = useState<MatchReward | null>(null)

  const payload = match
  const localHash = payload ? hashOfResult(payload.result) : '0x'
  const hashOk = Boolean(payload && localHash === payload.result.resultHash)
  const recorder = (import.meta.env.VITE_BATTLE_RECORDER_ADDRESS ||
    '0x0000000000000000000000000000000000000000') as `0x${string}`
  const canChain = Boolean(
    payload && recorder !== '0x0000000000000000000000000000000000000000' && payload.signature !== '0x' && hashOk,
  )

  const submit = useCallback(async (): Promise<void> => {
    if (!client || !payload || !canChain || !address) return
    setPhase('wallet')
    setErr(null)
    try {
      const already = await client.readContract({
        address: recorder,
        abi: battleRecorderAbi,
        functionName: 'recorded',
        args: [payload.matchId],
      })
      const youAreANow = address.toLowerCase() === payload.players[0].address.toLowerCase()
      const side: Side = youAreANow ? 0 : 1
      const outcome: MatchReward['record'] =
        payload.result.winner === null ? 'draw' : payload.result.winner === side ? 'win' : 'loss'
      const youTally = tally(payload.result.events, side)

      if (already) {
        const after = await snapshotPlayer(client, recorder, address)
        setReward(buildReward(after, after, outcome, payload.result.reason, payload.vsBot, youTally, true))
        if (payload.arena && arenaContractReady()) {
          setArenaPhase('pending')
          const settled = await arena.resolve(payload)
          setArenaPhase(settled ? 'done' : 'failed')
        }
        setPhase('done')
        return
      }
      const before = await snapshotPlayer(client, recorder, address)
      const message = payloadToMatchMessage(payload)
      const gas = await client.estimateContractGas({
        address: recorder,
        abi: battleRecorderAbi,
        functionName: 'recordBattle',
        args: [message, payload.signature],
        account: address,
      })
      const hash = await writeContractAsync({
        address: recorder,
        abi: battleRecorderAbi,
        functionName: 'recordBattle',
        args: [message, payload.signature],
        gas: gas + gas / 10n,
      })
      setPhase('pending')
      await client.waitForTransactionReceipt({ hash })
      if (payload.arena && arenaContractReady()) {
        setArenaPhase('pending')
        const settled = await arena.resolve(payload)
        setArenaPhase(settled ? 'done' : 'failed')
      }
      const after = await snapshotPlayer(client, recorder, address)
      setReward(buildReward(before, after, outcome, payload.result.reason, payload.vsBot, youTally, false))
      setTx(hash)
      setPhase('done')
    } catch (e) {
      if (isUserRejection(e)) {
        setPhase('failed')
        setErr('上链需要在钱包里确认这一笔。取消的话本场不会记入天梯。')
        return
      }
      const message = e instanceof Error ? e.message : '上链失败'
      if (/alreadyrecorded/i.test(message)) {
        setPhase('done')
        return
      }
      setPhase('failed')
      setErr(message)
    }
  }, [address, arena, canChain, client, payload, recorder, writeContractAsync])

  useEffect(() => {
    if (!payload || !canChain || !client || !address) return
    if (autoStarted.has(payload.matchId)) return
    autoStarted.add(payload.matchId)
    void submit()
  }, [address, canChain, client, payload, submit])

  if (!payload) return null

  const winner = payload.result.winner
  const youAreA = address?.toLowerCase() === payload.players[0].address.toLowerCase()
  const youSide: Side = youAreA ? 0 : 1
  const foeSide: Side = youAreA ? 1 : 0
  const youWin = winner === youSide
  const draw = winner === null

  const you = payload.players[youSide]
  const foe = payload.players[foeSide]
  const youHero = getHero(you.heroId)
  const foeHero = getHero(foe.heroId)
  const youHp = payload.result.finalHp[youSide]
  const foeHp = payload.result.finalHp[foeSide]
  const youStats = tally(payload.result.events, youSide)
  const foeStats = tally(payload.result.events, foeSide)
  const verdict = draw ? '平局' : youWin ? '胜利' : '落败'
  const verdictColor = draw ? 'text-gold' : youWin ? 'text-gold' : 'text-cinnabar'

  return (
    <section className="relative overflow-hidden">
      <div className="mb-5 text-center">
        <div className="text-xs uppercase tracking-[0.35em] text-gold-dim">
          {payload.result.overtime ? '加时赛结束' : '对决结束'} · {REASON_ZH[payload.result.reason]}
          {payload.vsBot ? ' · 人机' : ''}
        </div>
        <h2 className={`font-display mt-2 text-6xl tracking-[0.2em] sm:text-7xl ${verdictColor}`}>{verdict}</h2>
        {payload.arena && <StakeStrip payload={payload} youWin={youWin} draw={draw} phase={arenaPhase} />}
        {reward && <RewardStrip reward={reward} />}
      </div>

      <div className="relative grid overflow-hidden rounded-3xl border border-line md:grid-cols-2">
        <FighterColumn
          align="left"
          label="己方"
          name={youHero.nameZh}
          en={youHero.name}
          address={you.address}
          maxHp={youHero.hp}
          hp={youHp}
          stats={youStats}
          won={youWin}
          draw={draw}
        />
        <FighterColumn
          align="right"
          label={payload.vsBot ? '机器人' : '对手'}
          name={foeHero.nameZh}
          en={foeHero.name}
          address={foe.address}
          maxHp={foeHero.hp}
          hp={foeHp}
          stats={foeStats}
          won={!draw && !youWin}
          draw={draw}
        />
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold bg-ink font-display text-2xl text-gold shadow-[0_0_24px_rgba(228,195,106,0.35)]">
            VS
          </div>
        </div>
      </div>

      <div className="mt-4 text-center text-sm">
        {!canChain && <p className="text-mute">本场没有 Worker 签名，无法上链。请用 pnpm dev 开着匹配服务再打。</p>}
        {canChain && phase === 'wallet' && <p className="text-gold">请在钱包里确认这一笔，本场结果正在上链。</p>}
        {canChain && phase === 'pending' && <p className="text-gold">交易已提交，等待测试网确认…</p>}
        {canChain && phase === 'done' && (
          <p className="text-jade">
            已记入天梯
            {tx && (
              <>
                {' · '}
                <a
                  className="text-gold underline"
                  href={`https://testnet.monadscan.com/tx/${tx}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看交易
                </a>
              </>
            )}
          </p>
        )}
        {err && <p className="text-cinnabar">{err}</p>}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {canChain && phase === 'failed' && (
          <button
            type="button"
            className="rounded-full bg-gold px-8 py-3 font-medium text-ink"
            onClick={() => void submit()}
          >
            重新上链
          </button>
        )}
        <button
          type="button"
          className="rounded-full border border-gold/40 px-8 py-3 text-gold"
          onClick={() => setScreen('combo')}
        >
          再来一局
        </button>
        <button type="button" className="px-6 py-3 text-sm text-mute" onClick={clearMatch}>
          返回大厅
        </button>
      </div>
    </section>
  )
}

function StakeStrip({
  payload,
  youWin,
  draw,
  phase,
}: {
  payload: MatchPayload
  youWin: boolean
  draw: boolean
  phase: 'idle' | 'pending' | 'done' | 'failed'
}) {
  const arena = payload.arena
  if (!arena) return null
  const stake = formatEther(BigInt(arena.stakeWei))
  const prize = formatEther(BigInt(arena.winnerPayoutWei))
  const cut = formatEther(BigInt(arena.treasuryWei))
  const line = draw
    ? `平局退押 · 各退 ${stake} MON`
    : youWin
      ? `胜者得 ${prize} MON · 金库 ${cut} MON`
      : `押金 ${stake} MON 已按 95/5 结算`
  return (
    <p className="mt-3 text-sm text-gold-dim">
      守擂 · 押金 {stake} MON
      {draw ? '' : ` × 2`} · {line}
      {phase === 'pending' ? ' · 正在结算押金' : ''}
      {phase === 'done' ? ' · 押金已上链' : ''}
      {phase === 'failed' ? ' · 押金结算未完成，可回擂台重试' : ''}
    </p>
  )
}

function RewardStrip({ reward }: { reward: MatchReward }) {
  const up = reward.ratingDelta > 0
  const down = reward.ratingDelta < 0
  const rankText =
    reward.rankAfter === null
      ? '暂未上榜'
      : reward.firstOnBoard
        ? `新上榜 · 第 ${reward.rankAfter} 名`
        : reward.rankDelta !== null && reward.rankDelta > 0
          ? `第 ${reward.rankAfter} 名 · 上升 ${reward.rankDelta}`
          : reward.rankDelta !== null && reward.rankDelta < 0
            ? `第 ${reward.rankAfter} 名 · 下降 ${-reward.rankDelta}`
            : `第 ${reward.rankAfter} 名`

  return (
    <div className="mx-auto mt-6 max-w-3xl rounded-3xl border border-gold/40 bg-[linear-gradient(180deg,rgba(228,195,106,0.14),rgba(7,8,13,0.4))] px-5 py-5">
      <div className="text-xs uppercase tracking-[0.35em] text-gold-dim">本场收获</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <RewardCell
          label="积分"
          value={`${up ? '+' : ''}${reward.ratingDelta}`}
          sub={`${reward.ratingBefore} → ${reward.ratingAfter}`}
          hot={up}
          cold={down}
        />
        <RewardCell
          label="天梯"
          value={rankText}
          sub={reward.boardSize > 0 ? `全榜 ${reward.boardSize} 人` : '等待更多战报'}
          hot={Boolean(reward.firstOnBoard || (reward.rankDelta && reward.rankDelta > 0))}
        />
        <RewardCell
          label="战绩"
          value={reward.record === 'win' ? '胜 +1' : reward.record === 'loss' ? '负 +1' : '平 +1'}
          sub={
            reward.record === 'win' ? '记入胜场' : reward.record === 'loss' ? '记入负场' : '双方均分'
          }
        />
      </div>
      {reward.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {reward.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-gold/35 bg-ink/40 px-3 py-1 text-xs tracking-widest text-gold"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function RewardCell({
  label,
  value,
  sub,
  hot,
  cold,
}: {
  label: string
  value: string
  sub: string
  hot?: boolean
  cold?: boolean
}) {
  return (
    <div className="rounded-2xl bg-ink/50 px-4 py-3 text-center">
      <div className="text-[11px] tracking-[0.3em] text-mute">{label}</div>
      <div
        className={`font-display mt-1 text-3xl ${hot ? 'text-gold' : cold ? 'text-cinnabar' : 'text-paper'}`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-mute">{sub}</div>
    </div>
  )
}

function FighterColumn({
  align,
  label,
  name,
  en,
  address,
  maxHp,
  hp,
  stats,
  won,
  draw,
}: {
  align: 'left' | 'right'
  label: string
  name: string
  en: string
  address: string
  maxHp: number
  hp: number
  stats: ReturnType<typeof tally>
  won: boolean
  draw: boolean
}) {
  const ratio = Math.max(0, Math.min(1, hp / maxHp))
  const dead = hp <= 0
  const tone = draw ? 'from-[#1a1810]' : won ? 'from-[#2a2310]' : 'from-[#1a1010]'
  const bar = dead ? 'bg-cinnabar' : won || draw ? 'bg-gold' : 'bg-cinnabar'

  return (
    <div
      className={`relative min-h-[22rem] bg-gradient-to-b ${tone} to-ink px-6 py-8 sm:px-10 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${!draw && !won ? 'opacity-80' : ''}`}
    >
      {!draw && won && (
        <div
          className={`absolute top-5 rounded-full bg-gold px-3 py-1 text-xs font-semibold tracking-widest text-ink ${
            align === 'right' ? 'right-5' : 'left-5'
          }`}
        >
          WIN
        </div>
      )}
      {!draw && !won && (
        <div
          className={`absolute top-5 rounded-full border border-cinnabar/60 px-3 py-1 text-xs tracking-widest text-cinnabar ${
            align === 'right' ? 'right-5' : 'left-5'
          }`}
        >
          LOSE
        </div>
      )}
      <div className="text-xs uppercase tracking-[0.28em] text-gold-dim">{label}</div>
      <div className="mt-6 flex items-center gap-4" style={{ flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
        <div
          className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl font-display text-5xl ${
            won || draw ? 'bg-gold/15 text-gold' : 'bg-ink-2 text-mute'
          }`}
        >
          {name.slice(0, 1)}
        </div>
        <div>
          <div className="font-display text-4xl leading-none">{name}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.22em] text-gold-dim">{en}</div>
          <div className="mt-2 text-xs text-mute">{shortAddress(address)}</div>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-1 flex justify-between text-xs text-mute">
          <span>剩余生命</span>
          <span className={dead ? 'text-cinnabar' : 'text-paper'}>
            {hp} / {maxHp}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-ink-2">
          <div className={`h-full ${bar}`} style={{ width: `${ratio * 100}%` }} />
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <Stat label="造成伤害" value={stats.dealt} />
        <Stat label="承受伤害" value={stats.taken} />
        <Stat label="释放技能" value={stats.casts} />
        <Stat label="暴击" value={stats.crits} />
      </dl>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-ink/50 px-3 py-2">
      <dt className="text-[11px] tracking-widest text-mute">{label}</dt>
      <dd className="font-display text-xl text-paper">{value}</dd>
    </div>
  )
}
