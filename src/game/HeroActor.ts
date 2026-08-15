import * as Phaser from 'phaser'
import type { HeroId } from '../lib/types'
import { heroTexture, playSkillMotion } from './fx'

export class HeroActor {
  readonly root: Phaser.GameObjects.Container
  readonly sprite: Phaser.GameObjects.Image
  private shield: Phaser.GameObjects.Arc
  private stun: Phaser.GameObjects.Text
  private rooted: Phaser.GameObjects.Text
  private facing: 1 | -1
  private baseX: number
  private baseY: number

  constructor(scene: Phaser.Scene, x: number, y: number, heroId: HeroId, facing: 1 | -1) {
    this.facing = facing
    this.baseX = x
    this.baseY = y
    this.sprite = scene.add.image(0, 0, heroTexture(heroId))
    this.sprite.setDisplaySize(150, 225)
    if (facing < 0) this.sprite.setFlipX(true)
    this.shield = scene.add.circle(0, 10, 78, 0x4aa3ff, 0.0)
    this.shield.setStrokeStyle(3, 0x7ec8ff, 0)
    this.stun = scene.add.text(0, -130, '眩晕', { fontFamily: 'Noto Serif SC', fontSize: '16px', color: '#e4c36a' }).setOrigin(0.5).setAlpha(0)
    this.rooted = scene.add.text(0, -150, '定身', { fontFamily: 'Noto Serif SC', fontSize: '16px', color: '#3ecf8e' }).setOrigin(0.5).setAlpha(0)
    this.root = scene.add.container(x, y, [this.shield, this.sprite, this.stun, this.rooted])
  }

  playCast(scene: Phaser.Scene, skillId: string, targetX: number, targetY: number): void {
    const aura = scene.add.circle(this.baseX, this.baseY, 20, 0xe4c36a, 0.2)
    scene.tweens.add({
      targets: aura,
      scale: 3,
      alpha: 0,
      duration: 280,
      onComplete: () => aura.destroy(),
    })
    scene.tweens.add({
      targets: this.sprite,
      x: 18 * this.facing,
      scaleX: 1.06,
      scaleY: 0.96,
      duration: 90,
      yoyo: true,
    })
    playSkillMotion(scene, this.baseX, this.baseY, targetX, targetY, skillId, this.facing)
  }

  hitFlash(scene: Phaser.Scene): void {
    this.sprite.setTint(0xffffff)
    scene.tweens.add({
      targets: this.sprite,
      x: -12 * this.facing,
      duration: 70,
      yoyo: true,
      onComplete: () => this.sprite.clearTint(),
    })
  }

  setShield(on: boolean): void {
    this.shield.setFillStyle(0x4aa3ff, on ? 0.18 : 0)
    this.shield.setStrokeStyle(3, 0x7ec8ff, on ? 0.85 : 0)
  }

  setStun(on: boolean): void {
    this.stun.setAlpha(on ? 1 : 0)
  }

  setRoot(on: boolean): void {
    this.rooted.setAlpha(on ? 1 : 0)
  }

  die(scene: Phaser.Scene): void {
    scene.tweens.add({
      targets: this.root,
      alpha: 0.2,
      scale: 0.92,
      angle: this.facing * 8,
      duration: 700,
    })
  }
}
