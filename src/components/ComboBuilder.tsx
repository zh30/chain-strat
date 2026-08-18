import { useState } from 'react'
import { PhaserPreview } from '../game/PhaserPreview'
import { ComboShelf } from './ComboShelf'
import { HeroCard3D } from './HeroCard3D'
import { generateAutoCombo, planCombo } from '../lib/combo'
import { comboContractReady, useComboNft } from '../hooks/useComboNft'
import { useOwnedHeroes } from '../hooks/useOwnedHeroes'
import { comboFromOnchain, comboIsLegal } from '../lib/comboNft'
import { getHero } from '../lib/heroes'
import { heroLore } from '../lib/lore'
import { useOnline } from '../hooks/useOnline'
import { useStarterPack } from '../hooks/useStarterPack'
import { COMBO_MAX_SEC } from '../lib/types'
import { useGame } from '../store'

export function ComboBuilder() {
  const heroId = useGame((s) => s.heroId)
  const combo = useGame((s) => s.combo)
  const setCombo = useGame((s) => s.setCombo)
  const loadComboNft = useGame((s) => s.loadComboNft)
  const comboTokenId = useGame((s) => s.comboTokenId)
  const setHero = useGame((s) => s.setHero)
  const clearHero = useGame((s) => s.clearHero)
  const setScreen = useGame((s) => s.setScreen)
  const startMatch = useGame((s) => s.startMatch)
  const { claimed } = useStarterPack()
  const { heroes, loading } = useOwnedHeroes()
  const online = useOnline()
  const hero = heroId ? getHero(heroId) : null
  const combos = useComboNft(hero?.typeId)
  const plan = hero ? planCombo(hero, combo) : { entries: [], totalTime: 0, legal: false }
  const canFight = Boolean(claimed && hero && combo.length > 0 && online)
  const canMint = Boolean(hero && claimed && comboIsLegal(hero, combo) && online && comboContractReady())
  const [previewSkill, setPreviewSkill] = useState<string | null>(null)
  const [previewKey, setPreviewKey] = useState(0)

  if (!hero) {
    return (
      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="page-kicker">编计</p>
            <h2 className="font-display text-4xl text-gold">先点出战的旗</h2>
            <p className="mt-1 text-sm text-mute">将未定，计不能写。点一面魂旗，才能排连环。</p>
          </div>
          <button type="button" className="text-sm tracking-[0.2em] text-mute" onClick={() => setScreen('hall')}>
            回策场
          </button>
        </div>

        {loading && <p className="text-sm text-mute">渊正在认你的旗…</p>}

        {!loading && !claimed && (
          <div className="lobby-door">
            <b>召旗</b>
            <div>
              <strong>四旗未烙</strong>
              <p className="mt-1 text-sm text-mute">回策场先把先锋四旗烙进名字，再来写计。</p>
              <button type="button" className="btn-enter mt-4 !min-w-0 !px-6 !py-2 !text-lg" onClick={() => setScreen('hall')}>
                回策场召旗
              </button>
            </div>
          </div>
        )}

        {!loading && claimed && heroes.length === 0 && (
          <p className="text-sm text-mute">链上还没读到魂旗，稍后再开编计。</p>
        )}

        {!loading && heroes.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {heroes.map((owned) => (
              <HeroCard3D key={owned.id} hero={owned} active={false} onSelect={() => setHero(owned.id)} />
            ))}
          </div>
        )}
      </section>
    )
  }

  const add = (id: string): void => {
    const next = [...combo, id]
    if (!planCombo(hero, next).legal) return
    setCombo(next)
    setPreviewSkill(id)
    setPreviewKey((n) => n + 1)
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-gold">
            {heroLore(hero.id).title} · 编计
          </h2>
          <button type="button" className="text-sm tracking-[0.2em] text-mute" onClick={clearHero}>
            换将
          </button>
        </div>
        <div className="mt-4">
          <PhaserPreview heroId={hero.id} skillId={previewSkill} playKey={previewKey} />
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-mute">
            <span>录制时钟</span>
            <span>
              已用 {plan.totalTime.toFixed(1)}s / {COMBO_MAX_SEC.toFixed(1)}s
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink-2">
            <div
              className="h-full bg-gold"
              style={{ width: `${Math.min(100, (plan.totalTime / COMBO_MAX_SEC) * 100)}%` }}
            />
          </div>
        </div>

        <ol className="mt-6 space-y-2">
          {plan.entries.length === 0 && <li className="text-sm text-mute">还没有技能。点右侧技能写入时间轴。</li>}
          {plan.entries.map((e, i) => {
            const skill = hero.skills.find((s) => s.id === e.skillId)
            return (
              <li key={`${e.skillId}-${i}`} className="flex items-center justify-between rounded-lg bg-ink-2 px-3 py-2 text-sm">
                <span>
                  {i + 1}. {skill?.nameZh}
                  {e.waitBefore > 0 && (
                    <span className="ml-2 text-xs text-mute">空等 {e.waitBefore.toFixed(1)}s</span>
                  )}
                </span>
                <span className="text-xs text-gold-dim">
                  {e.start.toFixed(1)}–{e.end.toFixed(1)}s
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="space-y-4">
        <div className="panel rounded-2xl p-6">
          <h3 className="text-sm uppercase tracking-widest text-gold-dim">技能</h3>
          <div className="mt-4 space-y-3">
            {hero.skills.map((skill) => {
              const enabled = planCombo(hero, [...combo, skill.id]).legal
              return (
                <button
                  key={skill.id}
                  type="button"
                  disabled={!enabled}
                  onClick={() => add(skill.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-line bg-ink-2 px-4 py-3 text-left hover:border-gold-dim"
                >
                  <span>
                    <span className="block font-medium">{skill.nameZh}</span>
                    <span className="text-xs text-mute">
                      {skill.duration}s · CD {skill.cd}s
                    </span>
                  </span>
                  <span className="text-gold">+</span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-full border border-line py-2 text-sm"
              onClick={() => setCombo(generateAutoCombo(hero, Date.now() % 0xffffffff))}
            >
              自动生成
            </button>
            <button type="button" className="flex-1 rounded-full border border-line py-2 text-sm" onClick={() => setCombo([])}>
              清空
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {!claimed && (
            <p className="text-center text-xs text-cinnabar">还没领取英雄，请回大厅先确认那一笔领取交易。</p>
          )}
          {claimed && !online && (
            <p className="text-center text-xs text-cinnabar">离线时不能匹配或人机。连上网络后再出战。</p>
          )}
          {comboContractReady() && (
            <div className="panel rounded-2xl p-5">
              <h3 className="text-sm uppercase tracking-widest text-gold-dim">玉简</h3>
              <p className="mt-2 text-xs text-mute">
                把这套计烙成玉简。下次出战直接抽出。玉简可挂到玉市卖掉。
              </p>
              {combos.error && <p className="mt-2 text-xs text-cinnabar">{combos.error}</p>}
              {(combos.phase === 'wallet' || combos.phase === 'pending') && (
                <p className="mt-2 text-xs text-gold">
                  {combos.phase === 'wallet' ? '请在钱包里确认。' : '交易已提交，正在确认…'}
                </p>
              )}
              <button
                type="button"
                disabled={!canMint || combos.phase === 'wallet' || combos.phase === 'pending'}
                className="mt-3 w-full rounded-full border border-gold/40 py-2 text-sm text-gold"
                onClick={() => hero && void combos.mint(hero, combo)}
              >
                烙成玉简
              </button>
              <div className="mt-4">
                <ComboShelf
                  items={combos.owned}
                  selectedTokenId={comboTokenId}
                  busy={combos.phase === 'wallet' || combos.phase === 'pending'}
                  onSelect={(item) => {
                    if (!hero) return
                    const loadout = comboFromOnchain(item.heroType, item.skillIndexes)
                    loadComboNft(hero.id, loadout.combo, item.tokenId)
                  }}
                  onList={(tokenId, price) => void combos.list(tokenId, price)}
                  onCancel={(tokenId) => void combos.cancel(tokenId)}
                />
              </div>
            </div>
          )}
          <button
            type="button"
            disabled={!canFight}
            onClick={() => startMatch('pvp')}
            className="rounded-full bg-gold py-3 font-medium text-ink"
          >
            开始匹配
          </button>
          <button
            type="button"
            disabled={!canFight}
            onClick={() => startMatch('bot')}
            className="rounded-full border border-gold/40 py-3 text-gold"
          >
            人机对战
          </button>
          <button
            type="button"
            disabled={!canFight}
            onClick={() => setScreen('arena')}
            className="rounded-full border border-gold/40 py-3 text-gold"
          >
            上擂
          </button>
        </div>
      </div>
    </section>
  )
}
