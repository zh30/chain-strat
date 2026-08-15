import { ComboShelf } from './ComboShelf'
import { HeroCard3D } from './HeroCard3D'
import { comboContractReady, useComboNft } from '../hooks/useComboNft'
import { useOwnedHeroes } from '../hooks/useOwnedHeroes'
import { comboFromOnchain } from '../lib/comboNft'
import { useGame } from '../store'

export function HeroLibrary() {
  const heroId = useGame((s) => s.heroId)
  const setHero = useGame((s) => s.setHero)
  const loadComboNft = useGame((s) => s.loadComboNft)
  const comboTokenId = useGame((s) => s.comboTokenId)
  const setScreen = useGame((s) => s.setScreen)
  const { heroes, loading, claimed } = useOwnedHeroes()
  const selected = heroes.find((hero) => hero.id === heroId) ?? null
  const combos = useComboNft(selected?.typeId)

  return (
    <section className="pb-36">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl">我的英雄库</h2>
          <p className="mt-1 text-sm text-mute">点选一名英雄，再选用已上链的连招 NFT，右下角出战。</p>
        </div>
        <button type="button" className="text-sm text-mute" onClick={() => setScreen('hall')}>
          返回大厅
        </button>
      </div>

      {loading && <p className="text-sm text-mute">正在读取你的英雄…</p>}

      {!loading && !claimed && (
        <div className="panel rounded-2xl p-6">
          <p className="text-sm text-mute">英雄库还是空的。回大厅领取四名免费英雄后，他们会出现在这里。</p>
          <button
            type="button"
            className="mt-4 rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink"
            onClick={() => setScreen('hall')}
          >
            去领取
          </button>
        </div>
      )}

      {!loading && claimed && heroes.length === 0 && (
        <p className="text-sm text-mute">链上还没读到英雄，稍后再打开看看。</p>
      )}

      {!loading && heroes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {heroes.map((hero) => (
            <HeroCard3D
              key={hero.id}
              hero={hero}
              active={hero.id === heroId}
              onSelect={() => setHero(hero.id)}
            />
          ))}
        </div>
      )}

      {claimed && selected && comboContractReady() && (
        <div className="panel mt-6 rounded-2xl p-5">
          <div className="font-display text-lg text-gold">{selected.nameZh} 的连招 NFT</div>
          <p className="mt-1 text-xs text-mute">点一套直接带进出战。没有的话去编连招里铸造。</p>
          <div className="mt-4">
            <ComboShelf
              items={combos.owned}
              selectedTokenId={comboTokenId}
              busy={false}
              onSelect={(item) => {
                const loadout = comboFromOnchain(item.heroType, item.skillIndexes)
                loadComboNft(selected.id, loadout.combo, item.tokenId)
              }}
            />
          </div>
        </div>
      )}

      {claimed && heroes.length > 0 && (
        <button
          type="button"
          disabled={!selected}
          onClick={() => setScreen('combo')}
          className="fixed right-5 bottom-5 z-40 flex h-[5.5rem] min-w-[5.5rem] flex-col items-center justify-center rounded-full border-4 border-[#2a1d08] bg-[radial-gradient(circle_at_30%_25%,#f3de9a,var(--color-gold)_42%,#b8892a_78%)] px-7 text-ink shadow-[0_10px_0_#6b4e12,0_16px_32px_rgba(0,0,0,0.45)] transition enabled:hover:-translate-y-0.5 enabled:active:translate-y-1 enabled:active:shadow-[0_4px_0_#6b4e12] disabled:opacity-40 sm:right-8 sm:bottom-8 sm:h-28 sm:min-w-28"
        >
          <span className="font-display text-2xl leading-none tracking-widest sm:text-3xl">出战</span>
          <span className="mt-1 max-w-[6.5rem] truncate text-[11px] font-medium text-ink/75">
            {selected ? (comboTokenId ? `${selected.nameZh} · NFT` : selected.nameZh) : '先点选英雄'}
          </span>
        </button>
      )}
    </section>
  )
}
