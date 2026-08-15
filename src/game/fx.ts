import * as Phaser from 'phaser'
import type { HeroId } from '../lib/types'
import { ARENA_ART, HERO_ART, HERO_POSES, skillLook, type HeroPose } from '../lib/visuals'

export function poseTextureKey(id: HeroId, pose: HeroPose): string {
  return `hero-${id}-${pose}`
}

export function heroTexture(id: HeroId): string {
  return `hero-${id}`
}

export function preloadVisuals(scene: Phaser.Scene): void {
  scene.load.image('arena', ARENA_ART)
  for (const [id, url] of Object.entries(HERO_ART)) {
    scene.load.image(`hero-${id}`, url)
  }
  for (const [id, poses] of Object.entries(HERO_POSES)) {
    for (const [pose, url] of Object.entries(poses)) {
      if (url) scene.load.image(poseTextureKey(id as HeroId, pose as HeroPose), url)
    }
  }
}

export function burst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  count = 14,
  speed = 180,
): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.45
    const r = 2 + Math.random() * 4
    const dot = scene.add.circle(x, y, r, color, 0.95)
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * (36 + Math.random() * speed),
      y: y + Math.sin(angle) * (36 + Math.random() * speed),
      alpha: 0,
      scale: 0.15,
      duration: 260 + Math.random() * 240,
      onComplete: () => dot.destroy(),
    })
  }
}

export function impactRing(scene: Phaser.Scene, x: number, y: number, color: number, scaleTo = 4): void {
  const ring = scene.add.circle(x, y, 10, color, 0)
  ring.setStrokeStyle(4, color, 0.95)
  scene.tweens.add({
    targets: ring,
    scale: scaleTo,
    alpha: 0,
    duration: 280,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  })
}

export function slashArc(
  scene: Phaser.Scene,
  x: number,
  y: number,
  facing: 1 | -1,
  color: number,
): void {
  const start = facing > 0 ? 200 : 20
  const end = facing > 0 ? 340 : 160
  const arc = scene.add.arc(x, y, 58, start, end, false, color, 0)
  arc.setStrokeStyle(8, color, 1)
  arc.setScale(0.35)
  scene.tweens.add({
    targets: arc,
    scale: 1.55,
    alpha: 0,
    duration: 240,
    ease: 'Cubic.easeOut',
    onComplete: () => arc.destroy(),
  })
  const ghost = scene.add.arc(x + 8 * facing, y + 6, 72, start, end, false, color, 0)
  ghost.setStrokeStyle(3, 0xffffff, 0.7)
  ghost.setScale(0.5)
  scene.tweens.add({
    targets: ghost,
    scale: 1.7,
    alpha: 0,
    duration: 300,
    onComplete: () => ghost.destroy(),
  })
}

export function playSkillMotion(
  scene: Phaser.Scene,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  skillId: string,
  facing: 1 | -1,
): void {
  const look = skillLook(skillId)
  const color = look.tint
  switch (look.motion) {
    case 'bolt':
    case 'spike': {
      const size = look.motion === 'bolt' ? 12 : 7
      const orb = scene.add.circle(fromX + 36 * facing, fromY - 28, size, color, 1)
      orb.setStrokeStyle(2, 0xffffff, 0.7)
      const trail: Phaser.GameObjects.Arc[] = []
      for (let i = 0; i < 4; i++) {
        const t = scene.add.circle(orb.x, orb.y, size * (0.7 - i * 0.12), color, 0.45)
        trail.push(t)
      }
      scene.tweens.add({
        targets: orb,
        x: toX,
        y: toY - 24,
        duration: 260,
        ease: 'Cubic.easeIn',
        onUpdate: () => {
          for (let i = trail.length - 1; i >= 0; i--) {
            const prev = i === 0 ? orb : trail[i - 1]!
            trail[i]!.x += (prev.x - trail[i]!.x) * 0.45
            trail[i]!.y += (prev.y - trail[i]!.y) * 0.45
          }
        },
        onComplete: () => {
          burst(scene, toX, toY - 24, color, 18, 200)
          impactRing(scene, toX, toY - 24, color, 3.4)
          orb.destroy()
          for (const t of trail) t.destroy()
        },
      })
      break
    }
    case 'shots': {
      for (let i = 0; i < 3; i++) {
        const arrow = scene.add.rectangle(fromX + 24 * facing, fromY - 48 + i * 20, 34, 4, color).setRotation(facing < 0 ? Math.PI : 0)
        scene.tweens.add({
          targets: arrow,
          x: toX - 10 * facing,
          y: toY - 52 + i * 18,
          duration: 200 + i * 45,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            burst(scene, arrow.x, arrow.y, color, 8, 90)
            arrow.destroy()
          },
        })
      }
      break
    }
    case 'slash': {
      slashArc(scene, fromX + 46 * facing, fromY - 8, facing, color)
      burst(scene, fromX + 70 * facing, fromY - 10, color, 10, 120)
      break
    }
    case 'bash': {
      impactRing(scene, fromX + 40 * facing, fromY + 18, color, 5)
      const shock = scene.add.circle(fromX + 30 * facing, fromY + 20, 8, color, 0.35)
      shock.setStrokeStyle(3, color, 0.95)
      scene.tweens.add({
        targets: shock,
        scale: 5.4,
        alpha: 0,
        duration: 320,
        onComplete: () => shock.destroy(),
      })
      burst(scene, fromX + 50 * facing, fromY + 16, color, 12, 140)
      break
    }
    case 'aura':
    case 'mark':
    case 'curse': {
      const ring = scene.add.circle(fromX, fromY, 22, color, 0.16)
      ring.setStrokeStyle(3, color, 0.95)
      scene.tweens.add({
        targets: ring,
        scale: 3.4,
        alpha: 0,
        duration: 520,
        onComplete: () => ring.destroy(),
      })
      burst(scene, fromX, fromY - 44, color, 14, 100)
      break
    }
    case 'shield': {
      const dome = scene.add.circle(fromX, fromY, 34, 0x4aa3ff, 0.2)
      dome.setStrokeStyle(3, 0x7ec8ff, 0.95)
      scene.tweens.add({
        targets: dome,
        scale: 1.7,
        alpha: 0.3,
        yoyo: true,
        duration: 280,
        onComplete: () => dome.destroy(),
      })
      break
    }
    case 'dash': {
      const streak = scene.add.rectangle(fromX, fromY, 70, 8, color, 0.7).setRotation(facing < 0 ? Math.PI : 0)
      scene.tweens.add({
        targets: streak,
        x: toX,
        alpha: 0,
        scaleX: 2.2,
        duration: 180,
        onComplete: () => streak.destroy(),
      })
      burst(scene, toX, toY, color, 14, 140)
      slashArc(scene, toX - 10 * facing, toY - 8, facing, color)
      break
    }
    case 'mist':
    case 'drain': {
      for (let i = 0; i < 12; i++) {
        const puff = scene.add.circle(fromX + facing * 16, fromY - 8, 7 + Math.random() * 5, color, 0.5)
        scene.tweens.add({
          targets: puff,
          x: toX + (Math.random() - 0.5) * 50,
          y: toY - 16 - Math.random() * 50,
          alpha: 0,
          scale: 1.8,
          duration: 400 + i * 18,
          onComplete: () => puff.destroy(),
        })
      }
      break
    }
    case 'trap': {
      const root = scene.add.rectangle(toX, toY + 46, 10, 12, color, 0.9)
      scene.tweens.add({
        targets: root,
        height: 78,
        y: toY + 8,
        duration: 220,
        yoyo: true,
        hold: 380,
        onComplete: () => root.destroy(),
      })
      impactRing(scene, toX, toY + 30, color, 2.4)
      break
    }
    case 'execute': {
      const midX = (fromX + toX) / 2
      const beam = scene.add.rectangle(midX, fromY - 16, Math.max(40, Math.abs(toX - fromX)), 5, color, 1)
      scene.tweens.add({
        targets: beam,
        scaleY: 14,
        alpha: 0,
        duration: 320,
        onComplete: () => beam.destroy(),
      })
      const pillar = scene.add.rectangle(toX, toY - 10, 8, 220, 0xffffff, 0.9)
      scene.tweens.add({
        targets: pillar,
        scaleX: 8,
        alpha: 0,
        duration: 280,
        onComplete: () => pillar.destroy(),
      })
      burst(scene, toX, toY, color, 24, 240)
      impactRing(scene, toX, toY, color, 5)
      break
    }
    default:
      burst(scene, toX, toY, color, 12, 120)
  }
}

export function clashBurst(scene: Phaser.Scene, x: number, y: number): void {
  impactRing(scene, x, y, 0xffffff, 6)
  impactRing(scene, x, y, 0xe4c36a, 4)
  slashArc(scene, x, y, 1, 0xe4c36a)
  slashArc(scene, x, y, -1, 0xff4da6)
  burst(scene, x, y, 0xffffff, 22, 260)
}
