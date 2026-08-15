import * as Phaser from 'phaser'
import { fighterTag } from '../lib/chain'
import { getHero, getSkill } from '../lib/heroes'
import type { BattleEvent, MatchPayload, Side } from '../lib/types'
import {
  CLASH_SLOW,
  DEATH_SLOW,
  OVERTIME_SLOW,
  highlightForDamage,
  shouldClash,
  skillApproach,
  strongerPulse,
  type SlowPulse,
} from './choreography'
import { burst, clashBurst, impactRing, preloadVisuals } from './fx'
import { HeroActor } from './HeroActor'

export class BattleScene extends Phaser.Scene {
  private payload!: MatchPayload
  private idx = 0
  private battleTime = 0
  private onComplete: (() => void) | null = null
  private actors: [HeroActor, HeroActor] | null = null
  private bars: [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle] | null = null
  private otBanner: Phaser.GameObjects.Text | null = null
  private resultText: Phaser.GameObjects.Text | null = null
  private callout: Phaser.GameObjects.Text | null = null
  private letterTop: Phaser.GameObjects.Rectangle | null = null
  private letterBot: Phaser.GameObjects.Rectangle | null = null
  private clock: Phaser.GameObjects.Text | null = null
  private hp: [number, number] = [1, 1]
  private maxHp: [number, number] = [1, 1]
  private finished = false
  private playing = false
  private lastCast: { side: Side; skillId: string; t: number } | null = null
  private pulse: SlowPulse | null = null
  private pulseUntil = 0
  private elapsed = 0
  private lastTs = 0
  private youAddress: string | null = null

  constructor() {
    super('battle')
  }

  init(data: { payload: MatchPayload; onComplete: () => void; youAddress?: string | null }): void {
    this.payload = data.payload
    this.onComplete = data.onComplete
    this.youAddress = data.youAddress ?? null
    this.idx = 0
    this.battleTime = 0
    this.finished = false
    this.playing = false
    this.lastCast = null
    this.pulse = null
    this.pulseUntil = 0
    this.elapsed = 0
    this.lastTs = 0
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
    this.add.rectangle(w / 2, h * 0.78, w, 90, 0x000000, 0.28)
    this.add.rectangle(w / 2, 40, w, 80, 0x000000, 0.5)

    const a = getHero(this.payload.players[0].heroId)
    const b = getHero(this.payload.players[1].heroId)
    const left = new HeroActor(this, w * 0.24, h * 0.62, a.id, 1)
    const right = new HeroActor(this, w * 0.76, h * 0.62, b.id, -1)
    this.actors = [left, right]
    left.enterFrom(this, -80)
    right.enterFrom(this, w + 80)

    this.add.rectangle(w * 0.24, 44, 240, 18, 0x1a1c24)
    this.add.rectangle(w * 0.76, 44, 240, 18, 0x1a1c24)
    const barL = this.add.rectangle(w * 0.24 - 120, 44, 240, 12, 0xc23b3b).setOrigin(0, 0.5)
    const barR = this.add.rectangle(w * 0.76 - 120, 44, 240, 12, 0xc23b3b).setOrigin(0, 0.5)
    this.bars = [barL, barR]
    this.add
      .text(w * 0.24, 12, a.nameZh, { fontFamily: 'Noto Serif SC', fontSize: '16px', color: '#e4c36a' })
      .setOrigin(0.5)
    this.add
      .text(w * 0.76, 12, b.nameZh, { fontFamily: 'Noto Serif SC', fontSize: '16px', color: '#e4c36a' })
      .setOrigin(0.5)
    this.add
      .text(w * 0.24, 28, fighterTag(this.payload.players[0].address, this.youAddress), {
        fontFamily: 'Noto Sans SC',
        fontSize: '12px',
        color: '#efe6d2',
      })
      .setOrigin(0.5)
    this.add
      .text(w * 0.76, 28, fighterTag(this.payload.players[1].address, this.youAddress), {
        fontFamily: 'Noto Sans SC',
        fontSize: '12px',
        color: '#efe6d2',
      })
      .setOrigin(0.5)
    this.clock = this.add
      .text(w / 2, 20, '0.0', { fontFamily: 'Cinzel', fontSize: '14px', color: '#efe6d2' })
      .setOrigin(0.5)

    this.otBanner = this.add
      .text(w / 2, h * 0.2, '', { fontFamily: 'Noto Serif SC', fontSize: '34px', color: '#e4c36a' })
      .setOrigin(0.5)
      .setAlpha(0)
    this.resultText = this.add
      .text(w / 2, h * 0.42, '', { fontFamily: 'Noto Serif SC', fontSize: '56px', color: '#e4c36a' })
      .setOrigin(0.5)
      .setAlpha(0)
    this.callout = this.add
      .text(w / 2, h * 0.3, '', { fontFamily: 'Noto Serif SC', fontSize: '28px', color: '#efe6d2' })
      .setOrigin(0.5)
      .setAlpha(0)
    this.letterTop = this.add.rectangle(w / 2, 0, w, 0, 0x000000, 0.72).setOrigin(0.5, 0)
    this.letterBot = this.add.rectangle(w / 2, h, w, 0, 0x000000, 0.72).setOrigin(0.5, 1)

    this.idx = 0
    this.battleTime = 0
    this.finished = false
    this.playing = false
    this.lastCast = null
    this.pulse = null
    this.tweens.timeScale = 0.8
    this.playIntro()
  }

  update(_time: number, _delta: number): void {
    if (this.finished || !this.playing) {
      this.lastTs = 0
      return
    }
    const now = performance.now()
    const step = this.lastTs === 0 ? 16 : Math.min(now - this.lastTs, 34)
    this.lastTs = now
    this.elapsed += step
    if (this.pulse && this.elapsed >= this.pulseUntil) this.clearSlow()
    const scale = (this.pulse?.scale ?? 1) * 0.8
    this.battleTime += (step / 1000) * scale
    this.clock?.setText(this.battleTime.toFixed(1))
    const log = this.payload.result.events
    while (this.idx < log.length && log[this.idx]!.t <= this.battleTime) {
      this.play(log[this.idx]!)
      this.idx += 1
    }
  }

  private playIntro(): void {
    const w = this.scale.width
    const title = this.add
      .text(w / 2, this.scale.height * 0.44, '计已落锁', {
        fontFamily: 'Noto Serif SC',
        fontSize: '40px',
        color: '#e4c36a',
      })
      .setOrigin(0.5)
      .setAlpha(0)
    this.tweens.add({ targets: title, alpha: 1, duration: 280 })
    this.time.delayedCall(700, () => {
      title.setText('开战')
      this.tweens.add({ targets: title, scale: 1.2, alpha: 0, duration: 360, delay: 180, onComplete: () => title.destroy() })
    })
    this.time.delayedCall(1180, () => {
      this.playing = true
    })
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
        const foeActor = this.actors?.[foe]
        const self = this.actors?.[e.side]
        if (!self || !foeActor) break
        const clash =
          this.lastCast &&
          this.lastCast.side !== e.side &&
          shouldClash(this.lastCast.skillId, e.skillId, e.t - this.lastCast.t)
        const opts = clash || skillApproach(e.skillId) === 'clash' ? { clashX: clash ? w / 2 - 56 * (e.side === 0 ? 1 : -1) : undefined } : undefined
        if (clash) {
          this.applySlow(CLASH_SLOW)
          clashBurst(this, w / 2, h * 0.56)
          this.cameras.main.shake(160, 0.012)
        }
        self.playCast(this, e.skillId, foeActor.x, foeActor.y, opts)
        this.showCallout(e.side, e.skillId)
        this.lastCast = { side: e.side, skillId: e.skillId, t: e.t }
        break
      }
      case 'cast_interrupt':
        this.actors?.[e.side].takeHit(this, false)
        break
      case 'damage': {
        const target = this.actors?.[e.side]
        const highlight = highlightForDamage(e.isCrit, e.source)
        if (highlight) this.applySlow(highlight)
        this.floatText(e.side, `${e.amount}${e.isCrit ? ' 暴击' : ''}`, e.isCrit ? '#e4c36a' : '#efe6d2', e.isCrit ? 36 : 24)
        this.cameras.main.shake(e.isCrit ? 180 : 110, e.isCrit ? 0.016 : 0.009)
        if (e.isCrit) this.cameras.main.flash(80, 228, 195, 106, false)
        target?.takeHit(this, Boolean(e.isCrit))
        burst(this, target?.x ?? (e.side === 0 ? w * 0.24 : w * 0.76), h * 0.52, e.isCrit ? 0xe4c36a : 0xffffff, e.isCrit ? 22 : 12, e.isCrit ? 200 : 140)
        if (e.isCrit && target) impactRing(this, target.x, target.y, 0xe4c36a, 4)
        this.hp[e.side] = e.remainingHp
        this.syncBars()
        break
      }
      case 'dot_tick':
        this.floatText(e.side, `${e.amount}`, '#3ecf8e', 14)
        burst(this, (e.side === 0 ? w * 0.24 : w * 0.76) + 16, h * 0.5, 0x3ecf8e, 6, 50)
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
        this.applySlow(OVERTIME_SLOW)
        this.otBanner?.setText('加时赛 · 突然死亡').setAlpha(1)
        this.tweens.add({ targets: this.otBanner, alpha: 0.25, yoyo: true, repeat: 8, duration: 240 })
        this.cameras.main.flash(180, 194, 59, 59, false)
        break
      case 'death':
        this.actors?.[e.side].die(this)
        this.applySlow(DEATH_SLOW)
        this.cameras.main.flash(120, 255, 255, 255, false)
        break
      case 'battle_end': {
        this.finished = true
        const hold = this.pulse ? this.pulse.durationMs + 80 : 240
        this.time.delayedCall(hold, () => {
          this.clearSlow()
          this.showResult(e.winner)
        })
        this.time.delayedCall(hold + 1600, () => this.onComplete?.())
        break
      }
      default:
        break
    }
  }

  private applySlow(next: SlowPulse): void {
    this.pulse = strongerPulse(this.pulse, next)
    this.pulseUntil = this.elapsed + this.pulse.durationMs
    this.tweens.timeScale = this.pulse.scale * 0.8
    this.cameras.main.zoomTo(this.pulse.zoom, 140)
    this.tweens.add({
      targets: [this.letterTop, this.letterBot],
      height: 42,
      duration: 140,
    })
  }

  private clearSlow(): void {
    this.pulse = null
    this.tweens.timeScale = 0.8
    this.cameras.main.zoomTo(1, 220)
    this.tweens.add({
      targets: [this.letterTop, this.letterBot],
      height: 0,
      duration: 200,
    })
  }

  private showCallout(side: Side, skillId: string): void {
    const hero = getHero(this.payload.players[side].heroId)
    let name = skillId.split('.')[1]?.replaceAll('_', ' ') ?? skillId
    try {
      name = getSkill(hero, skillId).nameZh
    } catch {
      /* unknown demo id */
    }
    const x = side === 0 ? this.scale.width * 0.32 : this.scale.width * 0.68
    this.callout?.setText(name).setPosition(x, this.scale.height * 0.28).setAlpha(1).setScale(0.8)
    this.tweens.add({
      targets: this.callout,
      scale: 1,
      alpha: 0,
      y: this.scale.height * 0.22,
      duration: 700,
      delay: 180,
    })
  }

  private showResult(winner: 0 | 1 | null): void {
    const text = winner === null ? '平局' : winner === 0 ? '左方胜利' : '右方胜利'
    this.resultText?.setText(text).setAlpha(1).setScale(0.6)
    this.tweens.add({ targets: this.resultText, scale: 1, duration: 280 })
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.28)
  }

  private syncBars(): void {
    if (!this.bars) return
    for (const side of [0, 1] as const) {
      this.bars[side].width = 240 * Math.max(0, this.hp[side] / this.maxHp[side])
    }
  }

  private floatText(side: Side, text: string, color: string, size = 22): void {
    const actor = this.actors?.[side]
    const x = actor?.x ?? (side === 0 ? this.scale.width * 0.24 : this.scale.width * 0.76)
    const label = this.add
      .text(x, this.scale.height * 0.32, text, { fontFamily: 'Cinzel', fontSize: `${size}px`, color })
      .setOrigin(0.5)
    this.tweens.add({
      targets: label,
      y: label.y - 56,
      alpha: 0,
      duration: 760,
      onComplete: () => label.destroy(),
    })
  }
}
