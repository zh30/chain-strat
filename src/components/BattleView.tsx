import { useCallback } from 'react'
import { useAccount } from 'wagmi'
import { PhaserGame } from '../game/PhaserGame'
import { fighterTag } from '../lib/chain'
import { getHero } from '../lib/heroes'
import { useGame } from '../store'

export function BattleView() {
  const match = useGame((s) => s.match)
  const setScreen = useGame((s) => s.setScreen)
  const { address } = useAccount()
  const onComplete = useCallback(() => setScreen('result'), [setScreen])
  if (!match) return null
  const a = getHero(match.players[0].heroId)
  const b = getHero(match.players[1].heroId)

  return (
    <section className="battle-stage">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="min-w-0 font-display text-xl">
          {a.nameZh}
          <span className="ml-2 font-sans text-xs text-paper/80">
            {fighterTag(match.players[0].address, address)}
          </span>
          <span className="mx-2 text-mute">vs</span>
          {b.nameZh}
          <span className="ml-2 font-sans text-xs text-paper/80">
            {fighterTag(match.players[1].address, address)}
          </span>
        </div>
        <button type="button" className="shrink-0 text-sm text-mute hover:text-gold" onClick={onComplete}>
          跳过回放
        </button>
      </div>
      <PhaserGame payload={match} youAddress={address} onComplete={onComplete} />
    </section>
  )
}
