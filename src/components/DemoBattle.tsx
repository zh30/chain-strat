import { useMemo, useState } from 'react'
import { PhaserGame } from '../game/PhaserGame'
import { buildDemoMatch } from '../lib/demoMatch'

export function DemoBattle() {
  const match = useMemo(() => buildDemoMatch(), [])
  const [replay, setReplay] = useState(0)
  return (
    <div className="flex h-dvh items-center justify-center overflow-hidden bg-[#07080d] p-4">
      <div className="w-full max-w-5xl">
        <div className="mb-3 flex items-center justify-between text-[#e4c36a]">
          <span className="text-xl" style={{ fontFamily: 'Noto Serif SC, serif' }}>
            对决回放 · 演示
          </span>
          <button
            type="button"
            className="text-xs text-[#efe6d2]/70 hover:text-[#e4c36a]"
            onClick={() => setReplay((n) => n + 1)}
          >
            再看一场
          </button>
        </div>
        <PhaserGame
          key={replay}
          payload={match}
          youAddress={match.players[0].address}
          onComplete={() => undefined}
        />
      </div>
    </div>
  )
}

export const DEMO_BATTLE =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demoBattle') === '1'

export function isDemoBattleRequest(): boolean {
  return DEMO_BATTLE
}
