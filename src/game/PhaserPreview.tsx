import { useEffect, useRef } from 'react'
import * as Phaser from 'phaser'
import type { HeroId } from '../lib/types'
import { PreviewScene } from './PreviewScene'

interface Props {
  heroId: HeroId
  skillId: string | null
  playKey: number
}

export function PhaserPreview({ heroId, skillId, playKey }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<PreviewScene | null>(null)

  useEffect(() => {
    if (!host.current) return
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: 640,
      height: 360,
      backgroundColor: '#07080d',
      scene: [],
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    })
    game.scene.add('preview', PreviewScene, true, { heroId })
    sceneRef.current = game.scene.getScene('preview') as PreviewScene
    gameRef.current = game
    return () => {
      game.destroy(true)
      gameRef.current = null
      sceneRef.current = null
    }
  }, [heroId])

  useEffect(() => {
    if (!skillId) return
    const scene = sceneRef.current
    if (scene?.sys?.isActive()) scene.playSkill(skillId)
  }, [skillId, playKey])

  return <div ref={host} className="overflow-hidden rounded-2xl border border-line bg-ink" />
}
