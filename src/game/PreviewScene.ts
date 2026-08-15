import * as Phaser from 'phaser'
import type { HeroId } from '../lib/types'
import { HeroActor } from './HeroActor'
import { preloadVisuals } from './fx'

export class PreviewScene extends Phaser.Scene {
  private actor: HeroActor | null = null
  private caption: Phaser.GameObjects.Text | null = null
  private heroId: HeroId = 'warrior'
  private pendingSkill: string | null = null

  constructor() {
    super('preview')
  }

  init(data: { heroId: HeroId; skillId?: string }): void {
    this.heroId = data.heroId
    this.pendingSkill = data.skillId ?? null
  }

  preload(): void {
    preloadVisuals(this)
  }

  create(): void {
    const w = this.scale.width
    const h = this.scale.height
    if (this.textures.exists('arena')) {
      this.add.image(w / 2, h / 2, 'arena').setDisplaySize(w, h).setAlpha(0.55)
    } else {
      this.cameras.main.setBackgroundColor('#07080d')
    }
    this.add.rectangle(w / 2, h * 0.82, w, 80, 0x000000, 0.35)
    this.actor = new HeroActor(this, w * 0.36, h * 0.6, this.heroId, 1)
    this.add.circle(w * 0.74, h * 0.58, 22, 0x2a2d38, 0.85)
    this.add.circle(w * 0.74, h * 0.58, 8, 0xc23b3b, 0.9)
    this.caption = this.add
      .text(w / 2, 22, '点选技能，预览动作', {
        fontFamily: 'Noto Serif SC',
        fontSize: '18px',
        color: '#e4c36a',
      })
      .setOrigin(0.5)
    if (this.pendingSkill) this.playSkill(this.pendingSkill)
  }

  playSkill(skillId: string): void {
    if (!this.actor) return
    const w = this.scale.width
    const h = this.scale.height
    this.caption?.setText(skillId.split('.')[1]?.replaceAll('_', ' ') ?? skillId)
    this.actor.playCast(this, skillId, w * 0.72, h * 0.58)
  }
}
