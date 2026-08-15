import type { HeroPose, SkillLook } from '../lib/visuals'
import { skillLook } from '../lib/visuals'

export type Approach = 'clash' | 'ranged' | 'self'

export interface SlowPulse {
  scale: number
  durationMs: number
  zoom: number
}

const CLASH_MOTIONS = new Set<SkillLook['motion']>(['slash', 'bash', 'dash', 'execute'])
const RANGED_MOTIONS = new Set<SkillLook['motion']>(['bolt', 'spike', 'shots', 'mist', 'drain'])

export function skillApproach(skillId: string): Approach {
  const motion = skillLook(skillId).motion
  if (CLASH_MOTIONS.has(motion)) return 'clash'
  if (RANGED_MOTIONS.has(motion)) return 'ranged'
  return 'self'
}

export function poseForSkill(skillId: string): HeroPose {
  return skillApproach(skillId) === 'self' ? 'cast' : 'strike'
}

export function isExecuteSkill(skillId: string): boolean {
  return skillLook(skillId).motion === 'execute'
}

export function highlightForDamage(isCrit: boolean | undefined, source: string): SlowPulse | null {
  if (isExecuteSkill(source)) {
    return { scale: 0.28, durationMs: 680, zoom: 1.18 }
  }
  if (isCrit) {
    return { scale: 0.38, durationMs: 420, zoom: 1.12 }
  }
  return null
}

export const DEATH_SLOW: SlowPulse = { scale: 0.3, durationMs: 900, zoom: 1.16 }
export const OVERTIME_SLOW: SlowPulse = { scale: 0.22, durationMs: 480, zoom: 1.08 }
export const CLASH_SLOW: SlowPulse = { scale: 0.42, durationMs: 260, zoom: 1.1 }

export function shouldClash(a: string, b: string, dt: number): boolean {
  return skillApproach(a) === 'clash' && skillApproach(b) === 'clash' && Math.abs(dt) <= 0.35
}

export function strongerPulse(current: SlowPulse | null, next: SlowPulse): SlowPulse {
  if (!current) return next
  return next.scale < current.scale ? next : current
}
