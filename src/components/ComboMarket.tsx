import { useMemo, useState } from 'react'
import { formatEther } from 'viem'
import { useAccount } from 'wagmi'
import { comboContractReady, useComboNft } from '../hooks/useComboNft'
import { comboFromOnchain, comboLabel, getHeroByType } from '../lib/comboNft'
import { HEROES } from '../lib/heroes'
import { shortAddress } from '../lib/chain'
import { useGame } from '../store'

export function ComboMarket() {
  const { address } = useAccount()
  const setScreen = useGame((s) => s.setScreen)
  const loadComboNft = useGame((s) => s.loadComboNft)
  const { listings, owned, loading, phase, error, buy } = useComboNft()
  const [heroFilter, setHeroFilter] = useState<number | 'all'>('all')

  const rows = useMemo(
    () => (heroFilter === 'all' ? listings : listings.filter((item) => item.heroType === heroFilter)),
    [heroFilter, listings],
  )

  return (
    <section>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl">连招市集</h2>
          <p className="mt-1 text-sm text-mute">别人挂出的 SkillCombo NFT。买下后即可给对应英雄直接出战。</p>
        </div>
        <button type="button" className="text-sm text-mute" onClick={() => setScreen('hall')}>
          返回大厅
        </button>
      </div>

      {!comboContractReady() && (
        <div className="panel rounded-2xl p-5 text-sm text-mute">连招合约还没配置，稍后再来。</div>
      )}

      {comboContractReady() && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <FilterChip active={heroFilter === 'all'} onClick={() => setHeroFilter('all')}>
              全部
            </FilterChip>
            {HEROES.filter((hero) => !hero.paid).map((hero) => (
              <FilterChip
                key={hero.id}
                active={heroFilter === hero.typeId}
                onClick={() => setHeroFilter(hero.typeId)}
              >
                {hero.nameZh}
              </FilterChip>
            ))}
          </div>

          {error && <p className="mb-4 text-sm text-cinnabar">{error}</p>}
          {phase === 'wallet' && <p className="mb-4 text-sm text-gold">请在钱包里确认购买。</p>}
          {phase === 'pending' && <p className="mb-4 text-sm text-gold">交易已提交，正在等测试网确认…</p>}
          {loading && <p className="text-sm text-mute">正在读取挂单…</p>}

          {!loading && rows.length === 0 && (
            <div className="panel rounded-2xl p-6 text-sm text-mute">
              现在没有挂单。去编连招把自己的 NFT 挂出来。
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((item) => {
              const hero = getHeroByType(item.heroType)
              const combo = comboFromOnchain(item.heroType, item.skillIndexes).combo
              const mine = address && item.seller && item.seller.toLowerCase() === address.toLowerCase()
              const alreadyOwn = owned.some((row) => row.tokenId === item.tokenId)
              return (
                <article key={item.tokenId.toString()} className="panel rounded-2xl p-5">
                  <div className="text-xs uppercase tracking-[0.25em] text-gold-dim">{hero.nameZh}</div>
                  <h3 className="font-display mt-2 text-xl text-gold">#{item.tokenId.toString()}</h3>
                  <p className="mt-2 text-sm">{comboLabel(hero, combo)}</p>
                  <p className="mt-3 text-sm text-mute">
                    {formatEther(item.priceWei)} MON
                    {item.seller && <span> · {shortAddress(item.seller)}</span>}
                  </p>
                  {mine || alreadyOwn ? (
                    <p className="mt-4 text-xs text-gold-dim">这是你挂出的。</p>
                  ) : (
                    <button
                      type="button"
                      disabled={phase === 'wallet' || phase === 'pending'}
                      className="mt-4 rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink"
                      onClick={() => void buy(item.tokenId, item.priceWei)}
                    >
                      买入
                    </button>
                  )}
                  <button
                    type="button"
                    className="mt-3 block text-xs text-mute"
                    onClick={() => {
                      loadComboNft(hero.id, combo, item.tokenId)
                      setScreen('combo')
                    }}
                  >
                    预览这套连招
                  </button>
                </article>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs ${
        active ? 'bg-gold text-ink' : 'border border-line text-mute'
      }`}
    >
      {children}
    </button>
  )
}
