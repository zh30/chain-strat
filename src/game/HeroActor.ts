import * as Phaser from 'phaser'
import type { HeroId } from '../lib/types'
import type { HeroPose } from '../lib/visuals'
import { poseForSkill, skillApproach } from './choreography'
import { heroTexture, playSkillMotion, poseTextureKey } from './fx'

const BODY_H = 310
const BODY_W = 207

export class HeroActor {
  readonly root: Phaser.GameObjects.Container
  readonly sprite: Phaser.GameObjects.Image
  readonly heroId: HeroId
  readonly facing: 1 | -1
  readonly baseX: number
  readonly baseY: number

  private shield: Phaser.GameObjects.Arc
  private shadow: Phaser.GameObjects.Ellipse
  private stun: Phaser.GameObjects.Text
  private rooted: Phaser.GameObjects.Text
  private currentPose: HeroPose = 'stance'
  private dead = false
  private breathe?: Phaser.Tweens.Tween

  constructor(scene: Phaser.Scene, x: number, y: number, heroId: HeroId, facing: 1 | -1) {
    this.heroId = heroId
    this.facing = facing
    this.baseX = x
    this.baseY = y
    this.shadow = scene.add.ellipse(0, 118, 92, 22, 0x000000, 0.45)
    this.sprite = scene.add.image(0, 0, this.resolveTexture(scene, 'stance'))
    this.sprite.setDisplaySize(BODY_W, BODY_H)
    this.sprite.setOrigin(0.5, 0.72)
    if (facing < 0) this.sprite.setFlipX(true)
    this.shield = scene.add.circle(0, 10, 86, 0x4aa3ff, 0)
    this.shield.setStrokeStyle(3, 0x7ec8ff, 0)
    this.stun = scene.add
      .text(0, -150, '眩晕', { fontFamily: 'Noto Serif SC', fontSize: '16px', color: '#e4c36a' })
      .setOrigin(0.5)
      .setAlpha(0)
    this.rooted = scene.add
      .text(0, -172, '定身', { fontFamily: 'Noto Serif SC', fontSize: '16px', color: '#3ecf8e' })
      .setOrigin(0.5)
      .setAlpha(0)
    this.root = scene.add.container(x, y, [this.shadow, this.shield, this.sprite, this.stun, this.rooted])
    this.startBreathe(scene)
  }

  get x(): number {
    return this.root.x
  }

  get y(): number {
    return this.root.y
  }

  get pose(): HeroPose {
    return this.currentPose
  }

  setPose(scene: Phaser.Scene, pose: HeroPose): void {
    if (this.dead && pose !== 'hurt') return
    this.currentPose = pose
    const key = this.resolveTexture(scene, pose)
    if (this.sprite.texture.key !== key) this.sprite.setTexture(key)
    const grow = pose === 'strike' ? 1.04 : pose === 'hurt' ? 0.96 : 1
    this.sprite.setDisplaySize(BODY_W * grow, BODY_H * grow)
  }

  playCast(
    scene: Phaser.Scene,
    skillId: string,
    targetX: number,
    targetY: number,
    opts?: { clashX?: number },
  ): void {
    if (this.dead) return
    this.killMotion(scene)
    this.setPose(scene, poseForSkill(skillId))
    if (skillApproach(skillId) === 'clash') {
      const destX = opts?.clashX ?? this.baseX + 118 * this.facing
      this.ghost(scene)
      scene.tweens.add({
        targets: this.root,
        x: destX,
        duration: 150,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          playSkillMotion(scene, this.root.x, this.root.y, targetX, targetY, skillId, this.facing)
          this.ghost(scene)
          scene.time.delayedCall(240, () => this.returnHome(scene))
        },
      })
      return
    }
    playSkillMotion(scene, this.root.x, this.root.y, targetX, targetY, skillId, this.facing)
    scene.time.delayedCall(360, () => {
      if (!this.dead) this.setPose(scene, 'stance')
    })
  }

  takeHit(scene: Phaser.Scene, crit = false): void {
    if (this.dead) return
    this.setPose(scene, 'hurt')
    this.sprite.setTint(crit ? 0xffe08a : 0xffffff)
    scene.tweens.add({
      targets: this.root,
      x: this.root.x - 22 * this.facing,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => this.sprite.clearTint(),
    })
    scene.time.delayedCall(crit ? 420 : 280, () => {
      if (!this.dead) this.setPose(scene, 'stance')
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

  enterFrom(scene: Phaser.Scene, fromX: number): void {
    this.root.x = fromX
    this.root.alpha = 0
    scene.tweens.add({
      targets: this.root,
      x: this.baseX,
      alpha: 1,
      duration: 520,
      ease: 'Cubic.easeOut',
    })
  }

  die(scene: Phaser.Scene): void {
    this.dead = true
    this.setPose(scene, 'hurt')
    this.killMotion(scene)
    this.breathe?.stop()
    scene.tweens.add({
      targets: this.root,
      alpha: 0.42,
      y: this.baseY + 18,
      angle: this.facing * 10,
      duration: 760,
      ease: 'Sine.easeIn',
    })
  }

  returnHome(scene: Phaser.Scene): void {
    if (this.dead) return
    scene.tweens.add({
      targets: this.root,
      x: this.baseX,
      y: this.baseY,
      duration: 220,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        if (!this.dead) this.setPose(scene, 'stance')
      },
    })
  }

  private resolveTexture(scene: Phaser.Scene, pose: HeroPose): string {
    const exact = poseTextureKey(this.heroId, pose)
    if (scene.textures.exists(exact)) return exact
    const stance = poseTextureKey(this.heroId, 'stance')
    if (pose !== 'stance' && scene.textures.exists(stance)) return stance
    return heroTexture(this.heroId)
  }

  private startBreathe(scene: Phaser.Scene): void {
    this.breathe = scene.tweens.add({
      targets: this.sprite,
      y: -5,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private ghost(scene: Phaser.Scene): void {
    const g = scene.add.image(this.root.x, this.root.y, this.sprite.texture.key)
    g.setDisplaySize(BODY_W, BODY_H)
    g.setOrigin(this.sprite.originX, this.sprite.originY)
    g.setFlipX(this.sprite.flipX)
    g.setAlpha(0.4)
    g.setTint(0xe4c36a)
    scene.tweens.add({
      targets: g,
      alpha: 0,
      x: this.root.x - 28 * this.facing,
      duration: 220,
      onComplete: () => g.destroy(),
    })
  }

  private killMotion(scene: Phaser.Scene): void {
    scene.tweens.killTweensOf(this.root)
  }
}
