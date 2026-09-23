import { useEffect, useMemo, useState } from 'react'
import { formatEther } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { duelHouseAbi } from '../lib/abi'
import { DuelStatus, duelContractReady, duelHouseAddress, useDuel, type DuelViewData } from '../hooks/useDuel'
import { useOwnedHeroes } from '../hooks/useOwnedHeroes'
import { shortAddress } from '../lib/chain'
import { getHeroByType } from '../lib/comboNft'
import { duelInvitePath, parseDuelParam } from '../lib/pwa'
import { useGame } from '../store'

function statusLabel(status: number): string {
  if (status === DuelStatus.Open) return '等应战'
  if (status === DuelStatus.Committed) return '已约成'
  if (status === DuelStatus.Closed) return '已了'
  return '—'
}

function deadlineLabel(deadline: bigint, nowSec: number): string {
  const left = Number(deadline) - nowSec
  if (left <= 0) return '揭榜期已过'
  const h = Math.floor(left / 3600)
  const m = Math.floor((left % 3600) / 60)
  return h > 0 ? `揭榜期限还剩 ${h} 小时 ${m} 分` : `揭榜期限还剩 ${m} 分`
}

export function DuelView() {
  const { address } = useAccount()
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const timer = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const heroId = useGame((s) => s.heroId)
  const combo = useGame((s) => s.combo)
  const setScreen = useGame((s) => s.setScreen)
  const setMatch = useGame((s) => s.setMatch)
  const { heroes } = useOwnedHeroes()
  const duel = useDuel()
  const [stake, setStake] = useState('0')
  const [createdId, setCreatedId] = useState<bigint | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const selected = heroId ? heroes.find((hero) => hero.id === heroId) : null
  const canAct = Boolean(duel.ready && selected && combo.length > 0)

  const inviteId = useMemo(() => parseDuelParam(window.location.search), [])
  const invitedQuery = useReadContract({
    address: duelHouseAddress,
    abi: duelHouseAbi,
    functionName: 'duelAt',
    args: inviteId ? [inviteId] : undefined,
    query: { enabled: duelContractReady() && inviteId !== null },
  })
  const invited = useMemo(() => {
    if (!invitedQuery.data || !inviteId) return null
    const row = invitedQuery.data as unknown as DuelViewData & { status: number }
    if (!row || Number(row.status) === DuelStatus.None) return null
    return { ...row, id: inviteId } as DuelViewData
  }, [inviteId, invitedQuery.data])
  const invitedIsListed = Boolean(invited && duel.duels.some((d) => d.id === invited.id))

  const copyInvite = async (duelId: bigint) => {
    const link = `${window.location.origin}${duelInvitePath(duelId)}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(duelId.toString())
      window.setTimeout(() => setCopiedId(null), 2000)
    } catch {
      window.prompt('复制这条约战链接', link)
    }
  }

  const busy = duel.phase === 'wallet' || duel.phase === 'pending' || busyId !== null

  const startBattle = async (d: DuelViewData) => {
    setBusyId(d.id.toString())
    try {
      const payload = await duel.requestSettlement(d.id)
      if (payload) setMatch(payload)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="page-kicker">约战</p>
          <h2 className="font-display text-4xl text-gold">连环计</h2>
          <p className="mt-1 text-sm text-mute">
            连招先上链藏死（commit），双方揭榜（reveal）后开打。种子由双方盐和链上熵共同决定，谁也做不了手脚。
          </p>
        </div>
        <button type="button" className="text-sm text-mute" onClick={() => setScreen('hall')}>
          回策场
        </button>
      </div>

      {!duelContractReady() && (
        <div className="panel rounded-2xl p-5 text-sm text-mute">约战合约还没配置，稍后再来。</div>
      )}

      {duelContractReady() && (
        <>
          {duel.error && <p className="mb-4 text-sm text-cinnabar">{duel.error}</p>}
          {(duel.phase === 'wallet' || duel.phase === 'pending') && (
            <p className="mb-4 text-sm text-gold">
              {duel.phase === 'wallet' ? '请在钱包里确认。' : '交易已提交，正在等测试网确认…'}
            </p>
          )}

          {invited && !invitedIsListed && (
            <div className="mb-6">
              <h3 className="mb-3 text-sm uppercase tracking-widest text-gold-dim">受邀的约战</h3>
              <DuelCard
                duel={invited}
                nowSec={nowSec}
                address={address}
                canAct={canAct}
                needCombo={!selected || combo.length === 0}
                busy={busy}
                onNeedCombo={() => setScreen('combo')}
                onAccept={async () => {
                  if (!selected) return
                  await duel.accept(invited, selected.typeId, combo)
                }}
                onReveal={() => void duel.reveal(invited)}
                onCancel={() => void duel.cancel(invited.id)}
                onTimeout={() => void duel.claimTimeout(invited.id)}
                onRefund={() => void duel.claimRefund(invited.id)}
                onBattle={() => void startBattle(invited)}
                onCopy={() => void copyInvite(invited.id)}
                copied={copiedId === invited.id.toString()}
                battling={busyId === invited.id.toString()}
              />
            </div>
          )}

          <div className="panel mb-6 rounded-2xl p-5">
            <h3 className="text-sm uppercase tracking-widest text-gold-dim">发约战</h3>
            <p className="mt-2 text-xs text-mute">
              押金可填 0。连招只上链哈希，明文到揭榜才公开；24 小时内双方都要揭榜。
            </p>
            {!selected && (
              <button type="button" className="mt-3 text-sm text-gold" onClick={() => setScreen('combo')}>
                先去编计
              </button>
            )}
            {selected && combo.length === 0 && (
              <button type="button" className="mt-3 text-sm text-gold" onClick={() => setScreen('combo')}>
                {selected.nameZh} 还没有连招，去写一套
              </button>
            )}
            {selected && combo.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1 text-xs text-mute">
                  押金（MON，可为 0）
                  <input
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-ink-2 px-3 py-2 text-sm text-paper"
                  />
                </label>
                <button
                  type="button"
                  disabled={!canAct || busy}
                  className="rounded-full bg-gold px-6 py-2 font-medium text-ink"
                  onClick={async () => {
                    const id = await duel.create(selected.typeId, combo, stake)
                    if (id) setCreatedId(id)
                  }}
                >
                  以{selected.nameZh}下帖
                </button>
              </div>
            )}
            {createdId && (
              <div className="mt-4 rounded-xl border border-gold/40 bg-ink/40 p-3 text-sm">
                <span className="text-gold">约战 #{createdId.toString()} 已挂出。</span>
                <button type="button" className="ml-2 text-gold underline" onClick={() => void copyInvite(createdId)}>
                  {copiedId === createdId.toString() ? '已复制' : '复制邀请链接'}
                </button>
              </div>
            )}
          </div>

          <div className="mb-6">
            <h3 className="mb-3 text-sm uppercase tracking-widest text-gold-dim">我的约战</h3>
            {duel.mine.length === 0 && <p className="text-sm text-mute">你还没有约战。</p>}
            <div className="grid gap-3 md:grid-cols-2">
              {duel.mine.map((d) => (
                <DuelCard
                  key={d.id.toString()}
                  duel={d}
                  nowSec={nowSec}
                  address={address}
                  canAct={canAct}
                  needCombo={!selected || combo.length === 0}
                  busy={busy}
                  onNeedCombo={() => setScreen('combo')}
                  onAccept={async () => {
                    if (!selected) return
                    await duel.accept(d, selected.typeId, combo)
                  }}
                  onReveal={() => void duel.reveal(d)}
                  onCancel={() => void duel.cancel(d.id)}
                  onTimeout={() => void duel.claimTimeout(d.id)}
                  onRefund={() => void duel.claimRefund(d.id)}
                  onBattle={() => void startBattle(d)}
                  onCopy={() => void copyInvite(d.id)}
                  copied={copiedId === d.id.toString()}
                  battling={busyId === d.id.toString()}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm uppercase tracking-widest text-gold-dim">等应战的帖</h3>
            {duel.loading && <p className="text-sm text-mute">正在读约战…</p>}
            {!duel.loading && duel.open.filter((d) => !address || d.playerA.toLowerCase() !== address.toLowerCase()).length === 0 && (
              <p className="text-sm text-mute">现在没有等应战的帖。把上面的链接发给朋友。</p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {duel.open
                .filter((d) => !address || d.playerA.toLowerCase() !== address.toLowerCase())
                .map((d) => (
                  <DuelCard
                    key={d.id.toString()}
                    duel={d}
                    nowSec={nowSec}
                    address={address}
                    canAct={canAct}
                    needCombo={!selected || combo.length === 0}
                    busy={busy}
                    onNeedCombo={() => setScreen('combo')}
                    onAccept={async () => {
                      if (!selected) return
                      await duel.accept(d, selected.typeId, combo)
                    }}
                    onReveal={() => void duel.reveal(d)}
                    onCancel={() => void duel.cancel(d.id)}
                    onTimeout={() => void duel.claimTimeout(d.id)}
                    onRefund={() => void duel.claimRefund(d.id)}
                    onBattle={() => void startBattle(d)}
                    onCopy={() => void copyInvite(d.id)}
                    copied={copiedId === d.id.toString()}
                    battling={busyId === d.id.toString()}
                  />
                ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function DuelCard({
  duel,
  nowSec,
  address,
  canAct,
  needCombo,
  busy,
  copied,
  battling,
  onAccept,
  onReveal,
  onCancel,
  onTimeout,
  onRefund,
  onBattle,
  onCopy,
  onNeedCombo,
}: {
  duel: DuelViewData
  nowSec: number
  address: `0x${string}` | undefined
  canAct: boolean
  needCombo: boolean
  busy: boolean
  copied: boolean
  battling: boolean
  onAccept: () => void
  onReveal: () => void
  onCancel: () => void
  onTimeout: () => void
  onRefund: () => void
  onBattle: () => void
  onCopy: () => void
  onNeedCombo: () => void
}) {
  const me = address?.toLowerCase()
  const iAmA = Boolean(me && duel.playerA.toLowerCase() === me)
  const iAmB = Boolean(me && duel.playerB.toLowerCase() === me)
  const inDuel = iAmA || iAmB
  const iRevealed = iAmA ? duel.revealedA : iAmB ? duel.revealedB : false
  const foeRevealed = iAmA ? duel.revealedB : iAmB ? duel.revealedA : false
  const bothRevealed = duel.revealedA && duel.revealedB
  const expired = duel.revealDeadline > 0n && BigInt(nowSec) >= duel.revealDeadline
  const heroA = getHeroByType(duel.heroA)
  const heroB = duel.heroB ? getHeroByType(duel.heroB) : null

  return (
    <article className="panel rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-gold-dim">
            #{duel.id.toString()} · {statusLabel(duel.status)}
          </div>
          <h3 className="font-display mt-2 text-xl text-gold">
            {heroA.nameZh}
            {heroB ? ` vs ${heroB.nameZh}` : ' vs ?'}
          </h3>
          <p className="mt-1 text-xs text-mute">
            {shortAddress(duel.playerA)}
            {duel.playerB !== '0x0000000000000000000000000000000000000000' && ` ↔ ${shortAddress(duel.playerB)}`}
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="text-gold">{formatEther(duel.stake)} MON</div>
          <div className="text-xs text-mute">各押</div>
        </div>
      </div>

      {duel.status === DuelStatus.Open && (
        <div className="mt-4 space-y-2">
          {iAmA ? (
            <>
              <p className="text-xs text-mute">等对手揭帖。链接发出去，谁来谁打。</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-full border border-line py-2 text-sm"
                  onClick={onCopy}
                >
                  {copied ? '已复制' : '复制邀请链接'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="flex-1 rounded-full border border-cinnabar/60 py-2 text-sm text-cinnabar"
                  onClick={onCancel}
                >
                  撤帖退押
                </button>
              </div>
            </>
          ) : canAct ? (
            <button
              type="button"
              disabled={busy}
              className="w-full rounded-full bg-gold py-2 text-sm font-medium text-ink"
              onClick={onAccept}
            >
              等额应战（藏计上链）
            </button>
          ) : (
            <button type="button" className="w-full text-sm text-gold" onClick={onNeedCombo}>
              {needCombo ? '先编一套计再来应战' : '连接钱包并切到 Monad Testnet'}
            </button>
          )}
        </div>
      )}

      {duel.status === DuelStatus.Committed && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-mute">{deadlineLabel(duel.revealDeadline, nowSec)}</p>
          <div className="flex gap-2 text-xs text-mute">
            <span className={duel.revealedA ? 'text-jade' : ''}>{iAmA ? '你' : 'A'} {duel.revealedA ? '已揭' : '未揭'}</span>
            <span className={duel.revealedB ? 'text-jade' : ''}>{iAmB ? '你' : 'B'} {duel.revealedB ? '已揭' : '未揭'}</span>
          </div>
          {inDuel && !iRevealed && !expired && (
            <button
              type="button"
              disabled={busy}
              className="w-full rounded-full bg-gold py-2 text-sm font-medium text-ink"
              onClick={onReveal}
            >
              揭榜（公开连招）
            </button>
          )}
          {inDuel && iRevealed && !foeRevealed && !expired && (
            <p className="text-xs text-mute">你已揭榜，等对手。期限一过可直接拿走全部押金。</p>
          )}
          {inDuel && iRevealed && !foeRevealed && expired && (
            <button
              type="button"
              disabled={busy}
              className="w-full rounded-full bg-gold py-2 text-sm font-medium text-ink"
              onClick={onTimeout}
            >
              对手弃权 · 收取全部押金
            </button>
          )}
          {inDuel && !iRevealed && expired && (
            <p className="text-xs text-mute">揭榜期已过而你没揭，这局只能等退押。</p>
          )}
          {inDuel && duel.revealedA === duel.revealedB && expired && (
            <button
              type="button"
              disabled={busy}
              className="w-full rounded-full border border-line py-2 text-sm"
              onClick={onRefund}
            >
              超期未决 · 双方退押
            </button>
          )}
          {inDuel && bothRevealed && (
            <button
              type="button"
              disabled={busy}
              className="w-full rounded-full bg-gold py-2 text-sm font-medium text-ink"
              onClick={onBattle}
            >
              {battling ? '正在请渊裁断…' : '开打算账'}
            </button>
          )}
          {!inDuel && <p className="text-xs text-mute">围观：等双方揭榜。</p>}
        </div>
      )}

      {duel.status === DuelStatus.Closed && <p className="mt-4 text-xs text-mute">这局已了。</p>}
    </article>
  )
}
