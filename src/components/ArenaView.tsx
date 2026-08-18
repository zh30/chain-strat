import { useState } from 'react'
import { formatEther } from 'viem'
import { useAccount } from 'wagmi'
import { ArenaStatus, arenaContractReady, useArena, type ArenaStandView } from '../hooks/useArena'
import { useOwnedHeroes } from '../hooks/useOwnedHeroes'
import { shortAddress } from '../lib/chain'
import { getHeroByType } from '../lib/comboNft'
import { useGame } from '../store'

function statusLabel(status: number): string {
  if (status === ArenaStatus.Open) return '守擂中'
  if (status === ArenaStatus.Pending) return '挑战中'
  if (status === ArenaStatus.Closed) return '已撤'
  return '—'
}

export function ArenaView() {
  const { address } = useAccount()
  const heroId = useGame((s) => s.heroId)
  const combo = useGame((s) => s.combo)
  const setScreen = useGame((s) => s.setScreen)
  const setMatch = useGame((s) => s.setMatch)
  const { heroes } = useOwnedHeroes()
  const arena = useArena()
  const [stake, setStake] = useState('0.01')
  const selected = heroId ? heroes.find((hero) => hero.id === heroId) : null
  const canCreate = Boolean(arena.ready && selected && combo.length > 0)
  const canChallenge = Boolean(arena.ready && selected && combo.length > 0)

  return (
    <section>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="page-kicker">守擂</p>
          <h2 className="font-display text-4xl text-gold">擂台</h2>
          <p className="mt-1 text-sm text-mute">把英雄和连招挂上去。人不在线，计还在。胜者拿走双方押金的 95%。</p>
        </div>
        <button type="button" className="text-sm text-mute" onClick={() => setScreen('hall')}>
          回策场
        </button>
      </div>

      {!arenaContractReady() && (
        <div className="panel rounded-2xl p-5 text-sm text-mute">擂台合约还没配置，稍后再来。</div>
      )}

      {arenaContractReady() && (
        <>
          {arena.error && <p className="mb-4 text-sm text-cinnabar">{arena.error}</p>}
          {(arena.phase === 'wallet' || arena.phase === 'pending') && (
            <p className="mb-4 text-sm text-gold">
              {arena.phase === 'wallet' ? '请在钱包里确认。' : '交易已提交，正在等测试网确认…'}
            </p>
          )}

          <div className="panel mb-6 rounded-2xl p-5">
            <h3 className="text-sm uppercase tracking-widest text-gold-dim">上擂</h3>
            <p className="mt-2 text-xs text-mute">
              最低押金 {arena.minStakeLabel || '0.01'} MON。连招只上哈希，明文交给 Worker 保管。
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
                  押金（MON）
                  <input
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-ink-2 px-3 py-2 text-sm text-paper"
                  />
                </label>
                <button
                  type="button"
                  disabled={!canCreate || arena.phase === 'wallet' || arena.phase === 'pending'}
                  className="rounded-full bg-gold px-6 py-2 font-medium text-ink"
                  onClick={() => void arena.createStand(selected.typeId, combo, stake)}
                >
                  以{selected.nameZh}上擂
                </button>
              </div>
            )}
          </div>

          <div className="mb-6">
            <h3 className="mb-3 text-sm uppercase tracking-widest text-gold-dim">我的擂台</h3>
            {arena.mine.length === 0 && <p className="text-sm text-mute">你还没有挂出去的擂。</p>}
            <div className="grid gap-3 md:grid-cols-2">
              {arena.mine.map((stand) => (
                <StandCard
                  key={stand.id.toString()}
                  stand={stand}
                  mine
                  onWithdraw={() => void arena.withdraw(stand.id)}
                  busy={arena.phase === 'wallet' || arena.phase === 'pending'}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm uppercase tracking-widest text-gold-dim">开放的擂</h3>
            {arena.loading && <p className="text-sm text-mute">正在读擂台…</p>}
            {!arena.loading && arena.open.length === 0 && (
              <p className="text-sm text-mute">现在没有人守擂。你来挂第一座。</p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {arena.open.map((stand) => {
                const mineStand = Boolean(address && stand.defender.toLowerCase() === address.toLowerCase())
                return (
                  <StandCard
                    key={stand.id.toString()}
                    stand={stand}
                    onChallenge={
                      mineStand || !canChallenge
                        ? undefined
                        : async () => {
                            if (!selected) return
                            const payload = await arena.challenge(stand, selected.typeId, combo)
                            if (payload) setMatch(payload)
                          }
                    }
                    challengeHint={!selected || combo.length === 0 ? '先编一套计再来挑战' : undefined}
                    onNeedCombo={() => setScreen('combo')}
                    busy={arena.phase === 'wallet' || arena.phase === 'pending'}
                  />
                )
              })}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function StandCard({
  stand,
  mine,
  onWithdraw,
  onChallenge,
  onNeedCombo,
  challengeHint,
  busy,
}: {
  stand: ArenaStandView
  mine?: boolean
  onWithdraw?: () => void
  onChallenge?: () => void
  onNeedCombo?: () => void
  challengeHint?: string
  busy?: boolean
}) {
  const hero = getHeroByType(stand.heroType)
  return (
    <article className="panel rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-gold-dim">
            #{stand.id.toString()} · {statusLabel(stand.status)}
          </div>
          <h3 className="font-display mt-2 text-xl text-gold">{hero.nameZh}</h3>
          <p className="mt-1 text-xs text-mute">{shortAddress(stand.defender)}</p>
        </div>
        <div className="text-right text-sm">
          <div className="text-gold">{formatEther(stand.stake)} MON</div>
          <div className="text-xs text-mute">守成 {stand.defendCount}</div>
        </div>
      </div>
      {mine && stand.status === ArenaStatus.Open && onWithdraw && (
        <button
          type="button"
          disabled={busy}
          className="mt-4 w-full rounded-full border border-line py-2 text-sm"
          onClick={onWithdraw}
        >
          撤擂退押金
        </button>
      )}
      {!mine && onChallenge && (
        <button
          type="button"
          disabled={busy}
          className="mt-4 w-full rounded-full bg-gold py-2 text-sm font-medium text-ink"
          onClick={onChallenge}
        >
          等额挑战
        </button>
      )}
      {!mine && !onChallenge && challengeHint && (
        <button type="button" className="mt-4 w-full text-sm text-gold" onClick={onNeedCombo}>
          {challengeHint}
        </button>
      )}
    </article>
  )
}
