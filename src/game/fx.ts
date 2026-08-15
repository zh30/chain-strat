import * as Phaser from 'phaser'
import type { HeroId } from '../lib/types'
import { ARENA_ART, HERO_ART, skillLook } from '../lib/visuals'

export function preloadVisuals(scene: Phaser.Scene): void {
  scene.load.image('arena', ARENA_ART)
  for (const [id, url] of Object.entries(HERO_ART)) {
    scene.load.image(`hero-${id}`, url)
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
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4
    const dot = scene.add.circle(x, y, 3 + Math.random() * 3, color, 0.9)
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * (40 + Math.random() * speed),
      y: y + Math.sin(angle) * (40 + Math.random() * speed),
      alpha: 0,
      scale: 0.2,
      duration: 280 + Math.random() * 220,
      onComplete: () => dot.destroy(),
    })
  }
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
      const orb = scene.add.circle(fromX + 40 * facing, fromY - 20, look.motion === 'bolt' ? 10 : 6, color)
      scene.tweens.add({
        targets: orb,
        x: toX,
        y: toY - 30,
        duration: 280,
        onComplete: () => {
          burst(scene, toX, toY - 30, color, 16, 160)
          orb.destroy()
        },
      })
      break
    }
    case 'shots': {
      for (let i = 0; i < 3; i++) {
        const arrow = scene.add.rectangle(fromX + 20 * facing, fromY - 40 + i * 18, 28, 4, color).setRotation(facing < 0 ? Math.PI : 0)
        scene.tweens.add({
          targets: arrow,
          x: toX,
          y: toY - 50 + i * 16,
          duration: 220 + i * 40,
          onComplete: () => {
            burst(scene, arrow.x, arrow.y, color, 8, 80)
            arrow.destroy()
          },
        })
      }
      break
    }
    case 'slash': {
      const slash = scene.add.arc(fromX + 50 * facing, fromY - 10, 46, facing > 0 ? 200 : 20, facing > 0 ? 340 : 160, false, color, 0.0)
      slash.setStrokeStyle(6, color, 0.95)
      slash.setScale(0.4)
      scene.tweens.add({
        targets: slash,
        scale: 1.3,
        alpha: 0,
        duration: 260,
        onComplete: () => slash.destroy(),
      })
      break
    }
    case 'bash': {
      const shock = scene.add.circle(fromX + 30 * facing, fromY + 20, 8, color, 0.35)
      shock.setStrokeStyle(3, color, 0.9)
      scene.tweens.add({
        targets: shock,
        scale: 5,
        alpha: 0,
        duration: 320,
        onComplete: () => shock.destroy(),
      })
      break
    }
    case 'aura':
    case 'mark':
    case 'curse': {
      const ring = scene.add.circle(fromX, fromY, 20, color, 0.15)
      ring.setStrokeStyle(3, color, 0.95)
      scene.tweens.add({
        targets: ring,
        scale: 3.2,
        alpha: 0,
        duration: 500,
        onComplete: () => ring.destroy(),
      })
      burst(scene, fromX, fromY - 40, color, 12, 90)
      break
    }
    case 'shield': {
      const dome = scene.add.circle(fromX, fromY, 28, 0x4aa3ff, 0.18)
      dome.setStrokeStyle(3, 0x7ec8ff, 0.9)
      scene.tweens.add({
        targets: dome,
        scale: 1.6,
        alpha: 0.35,
        yoyo: true,
        duration: 280,
        onComplete: () => dome.destroy(),
      })
      break
    }
    case 'dash': {
      const ghost = scene.add.rectangle(fromX, fromY, 50, 90, color, 0.35)
      scene.tweens.add({
        targets: ghost,
        x: toX,
        alpha: 0,
        duration: 180,
        onComplete: () => ghost.destroy(),
      })
      burst(scene, toX, toY, color, 12, 120)
      break
    }
    case 'mist':
    case 'drain': {
      for (let i = 0; i < 10; i++) {
        const puff = scene.add.circle(fromX + facing * 20, fromY, 8, color, 0.45)
        scene.tweens.add({
          targets: puff,
          x: toX + (Math.random() - 0.5) * 40,
          y: toY - 20 - Math.random() * 40,
          alpha: 0,
          duration: 420 + i * 20,
          onComplete: () => puff.destroy(),
        })
      }
      break
    }
    case 'trap': {
      const root = scene.add.rectangle(toX, toY + 40, 8, 10, color, 0.8)
      scene.tweens.add({
        targets: root,
        height: 70,
        y: toY + 10,
        duration: 220,
        yoyo: true,
        hold: 400,
        onComplete: () => root.destroy(),
      })
      break
    }
    case 'execute': {
      const beam = scene.add.rectangle((fromX + toX) / 2, fromY - 20, Math.abs(toX - fromX), 6, color, 0.9)
      scene.tweens.add({
        targets: beam,
        scaleY: 8,
        alpha: 0,
        duration: 260,
        onComplete: () => beam.destroy(),
      })
      burst(scene, toX, toY, color, 20, 220)
      break
    }
    default:
      burst(scene, toX, toY, color, 10, 100)
  }
}

export function heroTexture(id: HeroId): string {
  return `hero-${id}`
}
