import { useEffect, useRef } from 'react'
import * as Phaser from 'phaser'
import type { MatchPayload } from '../lib/types'
import { BattleScene } from './BattleScene'

interface Props {
  payload: MatchPayload
  onComplete: () => void
}

export function PhaserGame({ payload, onComplete }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!host.current) return
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: 960,
      height: 540,
      backgroundColor: '#07080d',
      scene: [],
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    })
    game.scene.add('battle', BattleScene, true, { payload, onComplete })
    gameRef.current = game
    return () => {
      game.destroy(true)
      gameRef.current = null
    }
  }, [payload, onComplete])

  return <div ref={host} className="panel overflow-hidden rounded-2xl" />
}
