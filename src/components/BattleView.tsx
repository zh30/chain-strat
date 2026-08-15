import { useCallback } from 'react'
import { useGame } from '../store'
import { PhaserGame } from '../game/PhaserGame'
import { getHero } from '../lib/heroes'

export function BattleView() {
  const match = useGame((s) => s.match)
  const setScreen = useGame((s) => s.setScreen)
  const onComplete = useCallback(() => setScreen('result'), [setScreen])
  if (!match) return null
  const a = getHero(match.players[0].heroId)
  const b = getHero(match.players[1].heroId)

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="font-display text-xl">
          {a.nameZh} <span className="text-mute">vs</span> {b.nameZh}
          {match.vsBot && <span className="ml-2 text-xs text-gold-dim">人机</span>}
        </div>
        <button type="button" className="text-sm text-mute" onClick={onComplete}>
          跳到结果
        </button>
      </div>
      <PhaserGame payload={match} onComplete={onComplete} />
    </section>
  )
}
