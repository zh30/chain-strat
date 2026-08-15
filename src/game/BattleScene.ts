import * as Phaser from 'phaser'
import { getHero } from '../lib/heroes'
import type { BattleEvent, MatchPayload, Side } from '../lib/types'
import { HeroActor } from './HeroActor'
import { burst, preloadVisuals } from './fx'

export class BattleScene extends Phaser.Scene {
  private payload!: MatchPayload
  private idx = 0
  private battleTime = 0
  private onComplete: (() => void) | null = null
  private actors: [HeroActor, HeroActor] | null = null
  private bars: [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle] | null = null
  private otBanner: Phaser.GameObjects.Text | null = null
  private resultText: Phaser.GameObjects.Text | null = null
  private hp: [number, number] = [1, 1]
  private maxHp: [number, number] = [1, 1]
  private finished = false

  constructor() {
    super('battle')
  }

  init(data: { payload: MatchPayload; onComplete: () => void }): void {
    this.payload = data.payload
    this.onComplete = data.onComplete
    this.idx = 0
    this.battleTime = 0
    this.finished = false
    const a = getHero(this.payload.players[0].heroId)
    const b = getHero(this.payload.players[1].heroId)
    this.maxHp = [a.hp, b.hp]
    this.hp = [a.hp, b.hp]
  }

  preload(): void {
    preloadVisuals(this)
  }

  create(): void {
    const w = this.scale.width
    const h = this.scale.height
    if (this.textures.exists('arena')) {
      this.add.image(w / 2, h / 2, 'arena').setDisplaySize(w, h)
    } else {
      this.cameras.main.setBackgroundColor('#07080d')
    }
    this.add.rectangle(w / 2, 40, w, 80, 0x000000, 0.45)

    const a = getHero(this.payload.players[0].heroId)
    const b = getHero(this.payload.players[1].heroId)
    const left = new HeroActor(this, w * 0.26, h * 0.58, a.id, 1)
    const right = new HeroActor(this, w * 0.74, h * 0.58, b.id, -1)
    this.actors = [left, right]

    this.add.rectangle(w * 0.26, 36, 228, 16, 0x2a2d38)
    this.add.rectangle(w * 0.74, 36, 228, 16, 0x2a2d38)
    const barL = this.add.rectangle(w * 0.26 - 114, 36, 228, 12, 0xc23b3b).setOrigin(0, 0.5)
    const barR = this.add.rectangle(w * 0.74 - 114, 36, 228, 12, 0xc23b3b).setOrigin(0, 0.5)
    this.bars = [barL, barR]
    this.add.text(w * 0.26, 16, a.nameZh, { fontFamily: 'Noto Serif SC', fontSize: '16px', color: '#e4c36a' }).setOrigin(0.5)
    this.add.text(w * 0.74, 16, b.nameZh, { fontFamily: 'Noto Serif SC', fontSize: '16px', color: '#e4c36a' }).setOrigin(0.5)

    this.otBanner = this.add
      .text(w / 2, h * 0.2, '', { fontFamily: 'Noto Serif SC', fontSize: '32px', color: '#e4c36a' })
      .setOrigin(0.5)
      .setAlpha(0)
    this.resultText = this.add
      .text(w / 2, h * 0.42, '', { fontFamily: 'Noto Serif SC', fontSize: '56px', color: '#e4c36a' })
      .setOrigin(0.5)
      .setAlpha(0)
  }

  update(_: number, delta: number): void {
    if (this.finished) return
    this.battleTime += delta / 1000
    const log = this.payload.result.events
    while (this.idx < log.length && log[this.idx]!.t <= this.battleTime) {
      this.play(log[this.idx]!)
      this.idx += 1
    }
  }

  private foeOf(side: Side): Side {
    return side === 0 ? 1 : 0
  }

  private play(e: BattleEvent): void {
    const w = this.scale.width
    const h = this.scale.height
    switch (e.type) {
      case 'start_cast': {
        const foe = this.foeOf(e.side)
        const tx = foe === 0 ? w * 0.26 : w * 0.74
        this.actors?.[e.side].playCast(this, e.skillId, tx, h * 0.58)
        break
      }
      case 'damage':
        this.floatText(e.side, `${e.amount}${e.isCrit ? '!' : ''}`, e.isCrit ? '#e4c36a' : '#efe6d2', e.isCrit ? 34 : 24)
        this.cameras.main.shake(120, e.isCrit ? 0.014 : 0.01)
        this.actors?.[e.side].hitFlash(this)
        burst(this, e.side === 0 ? w * 0.26 : w * 0.74, h * 0.52, e.isCrit ? 0xe4c36a : 0xffffff, e.isCrit ? 20 : 12, 160)
        this.hp[e.side] = e.remainingHp
        this.syncBars()
        break
      case 'dot_tick':
        this.floatText(e.side, `${e.amount}`, '#3ecf8e', 14)
        burst(this, (e.side === 0 ? w * 0.26 : w * 0.74) + 20, h * 0.5, 0x3ecf8e, 6, 50)
        this.hp[e.side] = e.remainingHp
        this.syncBars()
        break
      case 'heal':
        this.floatText(e.side, `+${e.amount}`, '#3ecf8e')
        this.hp[e.side] = e.remainingHp
        this.syncBars()
        break
      case 'shield':
        this.actors?.[e.side].setShield(e.amount > 0)
        this.floatText(e.side, `盾+${e.amount}`, '#7ec8ff', 16)
        break
      case 'effect':
        if (e.effect === 'stun') this.actors?.[e.side].setStun(true)
        if (e.effect === 'root') this.actors?.[e.side].setRoot(true)
        this.time.delayedCall(Math.max(200, e.duration * 1000), () => {
          if (e.effect === 'stun') this.actors?.[e.side].setStun(false)
          if (e.effect === 'root') this.actors?.[e.side].setRoot(false)
        })
        break
      case 'overtime_start':
        this.otBanner?.setText('加时赛 · 突然死亡').setAlpha(1)
        this.tweens.add({ targets: this.otBanner, alpha: 0.2, yoyo: true, repeat: 8, duration: 240 })
        this.cameras.main.flash(180, 194, 59, 59, false)
        break
      case 'death':
        this.actors?.[e.side].die(this)
        this.time.timeScale = 0.45
        this.time.delayedCall(500, () => {
          this.time.timeScale = 1
        })
        break
      case 'battle_end':
        this.finished = true
        this.showResult(e.winner)
        this.time.delayedCall(1600, () => this.onComplete?.())
        break
      default:
        break
    }
  }

  private showResult(winner: 0 | 1 | null): void {
    const text = winner === null ? '平局' : winner === 0 ? '左方胜利' : '右方胜利'
    this.resultText?.setText(text).setAlpha(1).setScale(0.6)
    this.tweens.add({ targets: this.resultText, scale: 1, duration: 280 })
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.25)
  }

  private syncBars(): void {
    if (!this.bars) return
    for (const side of [0, 1] as const) {
      this.bars[side].width = 228 * Math.max(0, this.hp[side] / this.maxHp[side])
    }
  }

  private floatText(side: Side, text: string, color: string, size = 22): void {
    const x = side === 0 ? this.scale.width * 0.26 : this.scale.width * 0.74
    const label = this.add
      .text(x, this.scale.height * 0.34, text, { fontFamily: 'Cinzel', fontSize: `${size}px`, color })
      .setOrigin(0.5)
    this.tweens.add({
      targets: label,
      y: label.y - 50,
      alpha: 0,
      duration: 720,
      onComplete: () => label.destroy(),
    })
  }
}
