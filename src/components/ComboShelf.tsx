import { useState } from 'react'
import { formatEther } from 'viem'
import { comboFromOnchain, comboLabel, getHeroByType, type ComboRecord } from '../lib/comboNft'

export function ComboShelf({
  items,
  selectedTokenId,
  busy,
  onSelect,
  onList,
  onCancel,
}: {
  items: ComboRecord[]
  selectedTokenId: bigint | null
  busy: boolean
  onSelect: (item: ComboRecord) => void
  onList?: (tokenId: bigint, priceMon: string) => void
  onCancel?: (tokenId: bigint) => void
}) {
  const [prices, setPrices] = useState<Record<string, string>>({})

  if (items.length === 0) {
    return <p className="text-sm text-mute">还没有这名英雄的连招 NFT。</p>
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const hero = getHeroByType(item.heroType)
        const combo = comboFromOnchain(item.heroType, item.skillIndexes).combo
        const key = item.tokenId.toString()
        const active = selectedTokenId === item.tokenId
        return (
          <li
            key={key}
            className={`rounded-xl border px-3 py-3 ${
              active ? 'border-gold bg-[#2a2314]' : 'border-line bg-ink-2'
            }`}
          >
            <button type="button" className="w-full text-left" onClick={() => onSelect(item)}>
              <div className="flex items-center justify-between gap-2 text-xs text-gold-dim">
                <span>
                  #{key} · {hero.nameZh}
                </span>
                {item.priceWei > 0n && <span>挂单 {formatEther(item.priceWei)} MON</span>}
              </div>
              <p className="mt-1 text-sm">{comboLabel(hero, combo)}</p>
            </button>
            {onList && onCancel && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {item.priceWei > 0n ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-full border border-line px-3 py-1 text-xs"
                    onClick={() => onCancel(item.tokenId)}
                  >
                    取消挂单
                  </button>
                ) : (
                  <>
                    <input
                      value={prices[key] ?? ''}
                      onChange={(event) => setPrices((prev) => ({ ...prev, [key]: event.target.value }))}
                      placeholder="0.1"
                      inputMode="decimal"
                      className="w-20 rounded-full border border-line bg-ink px-3 py-1 text-xs text-paper outline-none"
                    />
                    <button
                      type="button"
                      disabled={busy || !(prices[key] ?? '').trim()}
                      className="rounded-full bg-gold px-3 py-1 text-xs font-medium text-ink"
                      onClick={() => onList(item.tokenId, prices[key] ?? '')}
                    >
                      挂单出售
                    </button>
                  </>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
