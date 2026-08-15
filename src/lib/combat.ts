import { getHero, getSkill } from './heroes'
import { computeResultHash } from './hash'
import { mulberry32 } from './rng'
import type { BattleEvent, BattleResult, Hero, HeroId, Side, Skill } from './types'
import { OVERTIME_TICKS, REGULATION_TICKS, TICK_HZ } from './types'

export function secToTicks(sec: number): number {
  return Math.round(sec * TICK_HZ)
}

export function ticksToSec(tick: number): number {
  return tick / TICK_HZ
}

interface DotState {
  dmgPerSec: number
  until: number
  acc: number
}

interface CastState {
  skill: Skill
  end: number
  dmgAmp: number
}

interface Fighter {
  side: Side
  hero: Hero
  hp: number
  maxHp: number
  shield: number
  atkMult: number
  atkMultUntil: number
  reduceDmg: number
  reduceDmgUntil: number
  stunUntil: number
  rootUntil: number
  cds: Map<string, number>
  queue: Skill[]
  queueIndex: number
  currentCast: CastState | null
  dots: DotState[]
  nextSkillHaste: boolean
  nextSkillSlow: boolean
  nextSkillDmgAmp: number
  nextHitReduce: number
  dead: boolean
}

function createFighter(side: Side, hero: Hero, combo: string[]): Fighter {
  return {
    side,
    hero,
    hp: hero.hp,
    maxHp: hero.hp,
    shield: 0,
    atkMult: 1,
    atkMultUntil: 0,
    reduceDmg: 0,
    reduceDmgUntil: 0,
    stunUntil: 0,
    rootUntil: 0,
    cds: new Map(),
    queue: combo.map((id) => getSkill(hero, id)),
    queueIndex: 0,
    currentCast: null,
    dots: [],
    nextSkillHaste: false,
    nextSkillSlow: false,
    nextSkillDmgAmp: 0,
    nextHitReduce: 0,
    dead: false,
  }
}

function expireTimed(f: Fighter, t: number): void {
  if (t >= f.atkMultUntil) f.atkMult = 1
  if (t >= f.reduceDmgUntil) f.reduceDmg = 0
}

function stunned(f: Fighter, t: number): boolean {
  return t < f.stunUntil
}

function rooted(f: Fighter, t: number): boolean {
  return t < f.rootUntil
}

function nextSkill(f: Fighter, overtime: boolean): Skill | null {
  if (f.queue.length === 0) return null
  if (f.queueIndex >= f.queue.length) {
    if (!overtime) return null
    f.queueIndex = 0
  }
  return f.queue[f.queueIndex] ?? null
}

function applyDamage(
  target: Fighter,
  amount: number,
  t: number,
  events: BattleEvent[],
  source: string,
  isCrit: boolean,
): number {
  let dmg = amount
  if (target.nextHitReduce > 0 && source !== 'dot') {
    dmg = Math.floor(dmg * (1 - target.nextHitReduce))
    target.nextHitReduce = 0
  }
  if (dmg <= 0) return 0
  const shieldHit = Math.min(target.shield, dmg)
  target.shield -= shieldHit
  const hpHit = dmg - shieldHit
  target.hp = Math.max(0, target.hp - hpHit)
  if (source === 'dot') {
    events.push({
      t: ticksToSec(t),
      type: 'dot_tick',
      side: target.side,
      amount: dmg,
      remainingHp: target.hp,
      remainingShield: target.shield,
    })
  } else {
    events.push({
      t: ticksToSec(t),
      type: 'damage',
      side: target.side,
      amount: dmg,
      isCrit,
      remainingHp: target.hp,
      remainingShield: target.shield,
      source,
    })
  }
  return hpHit
}

function resolveSkill(
  self: Fighter,
  enemy: Fighter,
  skill: Skill,
  t: number,
  events: BattleEvent[],
  rng: () => number,
  dmgAmp: number,
): void {
  const execute = skill.effects.find((e) => e.type === 'execute')
  const critFx = skill.effects.find((e) => e.type === 'critChance')
  const dmgFx = skill.effects.find((e) => e.type === 'damage')

  if (dmgFx) {
    let base = dmgFx.value
    if (execute && enemy.hp / enemy.maxHp < 0.35) {
      base = execute.value
    }
    let isCrit = false
    if (critFx && rng() < critFx.value / 100) {
      base = Math.floor(base * 1.5)
      isCrit = true
    }
    let dmg = Math.floor(base * self.atkMult * (1 + dmgAmp) * (1 - enemy.reduceDmg))
    applyDamage(enemy, dmg, t, events, skill.id, isCrit)
  }

  for (const fx of skill.effects) {
    switch (fx.type) {
      case 'stun':
        enemy.stunUntil = Math.max(enemy.stunUntil, t + secToTicks(fx.duration ?? 0))
        if (enemy.currentCast) {
          events.push({
            t: ticksToSec(t),
            type: 'cast_interrupt',
            side: enemy.side,
            skillId: enemy.currentCast.skill.id,
          })
          enemy.currentCast = null
        }
        events.push({
          t: ticksToSec(t),
          type: 'effect',
          side: enemy.side,
          effect: 'stun',
          value: 0,
          duration: fx.duration ?? 0,
        })
        break
      case 'root':
        enemy.rootUntil = Math.max(enemy.rootUntil, t + secToTicks(fx.duration ?? 0))
        events.push({
          t: ticksToSec(t),
          type: 'effect',
          side: enemy.side,
          effect: 'root',
          value: 0,
          duration: fx.duration ?? 0,
        })
        break
      case 'dot':
        enemy.dots.push({
          dmgPerSec: fx.value,
          until: t + secToTicks(fx.duration ?? 0),
          acc: 0,
        })
        events.push({
          t: ticksToSec(t),
          type: 'effect',
          side: enemy.side,
          effect: 'dot',
          value: fx.value,
          duration: fx.duration ?? 0,
        })
        break
      case 'shield':
        self.shield += fx.value
        events.push({
          t: ticksToSec(t),
          type: 'shield',
          side: self.side,
          amount: fx.value,
          remainingShield: self.shield,
        })
        break
      case 'heal':
        self.hp = Math.min(self.maxHp, self.hp + fx.value)
        events.push({
          t: ticksToSec(t),
          type: 'heal',
          side: self.side,
          amount: fx.value,
          remainingHp: self.hp,
        })
        break
      case 'buffAtk': {
        const target = fx.value < 0 ? enemy : self
        target.atkMult = 1 + fx.value / 100
        target.atkMultUntil = t + secToTicks(fx.duration ?? 0)
        events.push({
          t: ticksToSec(t),
          type: 'effect',
          side: target.side,
          effect: 'buffAtk',
          value: fx.value,
          duration: fx.duration ?? 0,
        })
        break
      }
      case 'reduceDmg':
        self.reduceDmg = fx.value / 100
        self.reduceDmgUntil = t + secToTicks(fx.duration ?? 0)
        events.push({
          t: ticksToSec(t),
          type: 'effect',
          side: self.side,
          effect: 'reduceDmg',
          value: fx.value,
          duration: fx.duration ?? 0,
        })
        break
      case 'nextSkillHaste':
        self.nextSkillHaste = true
        events.push({
          t: ticksToSec(t),
          type: 'effect',
          side: self.side,
          effect: 'nextSkillHaste',
          value: 1,
          duration: 0,
        })
        break
      case 'nextSkillSlow':
        enemy.nextSkillSlow = true
        events.push({
          t: ticksToSec(t),
          type: 'effect',
          side: enemy.side,
          effect: 'nextSkillSlow',
          value: fx.value,
          duration: 0,
        })
        break
      case 'nextSkillDmgAmp':
        self.nextSkillDmgAmp = fx.value / 100
        events.push({
          t: ticksToSec(t),
          type: 'effect',
          side: self.side,
          effect: 'nextSkillDmgAmp',
          value: fx.value,
          duration: 0,
        })
        break
      case 'nextHitReduce':
        self.nextHitReduce = fx.value / 100
        events.push({
          t: ticksToSec(t),
          type: 'effect',
          side: self.side,
          effect: 'nextHitReduce',
          value: fx.value,
          duration: 0,
        })
        break
      default:
        break
    }
  }
}

function processSide(
  self: Fighter,
  enemy: Fighter,
  t: number,
  events: BattleEvent[],
  rng: () => number,
  overtime: boolean,
): void {
  if (self.dead) return
  expireTimed(self, t)

  if (self.currentCast) {
    if (stunned(self, t)) {
      events.push({
        t: ticksToSec(t),
        type: 'cast_interrupt',
        side: self.side,
        skillId: self.currentCast.skill.id,
      })
      self.currentCast = null
      return
    }
    if (t >= self.currentCast.end) {
      const { skill, dmgAmp } = self.currentCast
      self.currentCast = null
      resolveSkill(self, enemy, skill, t, events, rng, dmgAmp)
      events.push({ t: ticksToSec(t), type: 'cast_end', side: self.side, skillId: skill.id })
    }
    return
  }

  if (stunned(self, t) || rooted(self, t)) return

  const skill = nextSkill(self, overtime)
  if (!skill) return

  const readyAt = self.cds.get(skill.id) ?? 0
  if (t < readyAt) return

  let durationSec = skill.duration
  const hadSlow = self.nextSkillSlow
  const hadHaste = self.nextSkillHaste
  if (hadSlow) {
    durationSec *= 1.5
    self.nextSkillSlow = false
  }
  if (hadHaste) {
    durationSec = 0
    self.nextSkillHaste = false
  }
  void hadSlow

  const dmgAmp = self.nextSkillDmgAmp
  self.nextSkillDmgAmp = 0
  self.cds.set(skill.id, t + secToTicks(skill.cd))
  self.queueIndex += 1

  const durTicks = secToTicks(durationSec)
  events.push({
    t: ticksToSec(t),
    type: 'start_cast',
    side: self.side,
    skillId: skill.id,
    duration: durationSec,
  })

  if (durTicks <= 0) {
    resolveSkill(self, enemy, skill, t, events, rng, dmgAmp)
    events.push({ t: ticksToSec(t), type: 'cast_end', side: self.side, skillId: skill.id })
    return
  }

  self.currentCast = { skill, end: t + durTicks, dmgAmp }
}

function applyDots(target: Fighter, t: number, events: BattleEvent[]): void {
  if (target.dead) return
  const remain: DotState[] = []
  for (const dot of target.dots) {
    if (t >= dot.until) continue
    // acc += dmgPerSec * 100; tick = acc / 2000 because 1 tick = 1/20 s
    dot.acc += dot.dmgPerSec * 100
    const tickDmg = Math.floor(dot.acc / 2000)
    dot.acc %= 2000
    if (tickDmg > 0) {
      applyDamage(target, tickDmg, t, events, 'dot', false)
    }
    remain.push(dot)
  }
  target.dots = remain
}

function markDeaths(a: Fighter, b: Fighter, t: number, events: BattleEvent[]): void {
  for (const f of [a, b]) {
    if (!f.dead && f.hp <= 0) {
      f.dead = true
      f.currentCast = null
      events.push({ t: ticksToSec(t), type: 'death', side: f.side })
    }
  }
}

export function simulateBattle(
  hero1: Hero | HeroId,
  combo1: string[],
  hero2: Hero | HeroId,
  combo2: string[],
  seed: number,
): BattleResult {
  const h1 = typeof hero1 === 'string' ? getHero(hero1) : hero1
  const h2 = typeof hero2 === 'string' ? getHero(hero2) : hero2
  const rng = mulberry32(seed)
  const s1 = createFighter(0, h1, combo1)
  const s2 = createFighter(1, h2, combo2)
  const events: BattleEvent[] = []

  let t = 0
  let overtime = false
  let otStart = 0
  let ended = false
  let winner: 0 | 1 | null = null
  let reason: BattleResult['reason'] = 'draw'

  const finish = (w: 0 | 1 | null, r: BattleResult['reason']): void => {
    winner = w
    reason = r
    ended = true
    events.push({
      t: ticksToSec(t),
      type: 'battle_end',
      winner: w,
      reason: r,
      finalHp: [s1.hp, s2.hp],
      overtime,
    })
  }

  while (!ended) {
    if (!overtime && t >= REGULATION_TICKS) {
      if (s1.hp <= 0 && s2.hp <= 0) {
        finish(null, 'draw')
        break
      }
      if (s1.hp <= 0) {
        finish(1, 'ko')
        break
      }
      if (s2.hp <= 0) {
        finish(0, 'ko')
        break
      }
      if (s1.hp !== s2.hp) {
        finish(s1.hp > s2.hp ? 0 : 1, 'timeout')
        break
      }
      overtime = true
      otStart = t
      events.push({ t: ticksToSec(t), type: 'overtime_start', hp: [s1.hp, s2.hp] })
    }

    if (overtime && t >= otStart + OVERTIME_TICKS) {
      if (s1.hp !== s2.hp) finish(s1.hp > s2.hp ? 0 : 1, 'timeout')
      else finish(null, 'draw')
      break
    }

    const hpBefore: [number, number] = [s1.hp, s2.hp]
    processSide(s1, s2, t, events, rng, overtime)
    processSide(s2, s1, t, events, rng, overtime)
    applyDots(s1, t, events)
    applyDots(s2, t, events)
    markDeaths(s1, s2, t, events)

    if (s1.dead && s2.dead) {
      finish(null, 'draw')
      break
    }
    if (s1.dead) {
      finish(1, 'ko')
      break
    }
    if (s2.dead) {
      finish(0, 'ko')
      break
    }

    if (overtime) {
      const lost0 = s1.hp < hpBefore[0]
      const lost1 = s2.hp < hpBefore[1]
      if (lost0 && !lost1) {
        finish(1, 'sudden_death')
        break
      }
      if (lost1 && !lost0) {
        finish(0, 'sudden_death')
        break
      }
    }

    t += 1
  }

  const result: BattleResult = {
    winner,
    reason,
    finalHp: [s1.hp, s2.hp],
    events,
    overtime,
    seed,
    resultHash: '0x',
  }
  result.resultHash = computeResultHash({
    seed,
    winner,
    finalHp: result.finalHp,
    overtime,
    eventCount: events.length,
    reason,
  })
  return result
}
