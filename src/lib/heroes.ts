import type { Hero, HeroId, Skill } from './types'

function skill(
  id: string,
  name: string,
  nameZh: string,
  duration: number,
  cd: number,
  effects: Skill['effects'],
): Skill {
  return { id, name, nameZh, duration, cd, effects }
}

export const HEROES: Hero[] = [
  {
    id: 'warrior',
    typeId: 1,
    name: 'Warrior',
    nameZh: '战士',
    hp: 1200,
    paid: false,
    blurb: 'Frontline bruiser. Stun and roar.',
    blurbZh: '前线猛将。眩晕与战吼。',
    skills: [
      skill('warrior.heavy_slash', 'Heavy Slash', '重斩', 1.0, 3.5, [{ type: 'damage', value: 180 }]),
      skill('warrior.shield_bash', 'Shield Bash', '盾击', 0.8, 5.5, [
        { type: 'damage', value: 90 },
        { type: 'stun', value: 0, duration: 1.2 },
      ]),
      skill('warrior.war_cry', 'War Cry', '战吼', 0.5, 8, [{ type: 'buffAtk', value: 40, duration: 4 }]),
    ],
  },
  {
    id: 'mage',
    typeId: 2,
    name: 'Mage',
    nameZh: '法师',
    hp: 850,
    paid: false,
    blurb: 'Glass cannon. Slow and shield.',
    blurbZh: '玻璃大炮。减速与法盾。',
    skills: [
      skill('mage.fireball', 'Fireball', '火球', 1.4, 4, [{ type: 'damage', value: 220 }]),
      skill('mage.ice_spike', 'Ice Spike', '冰刺', 1.2, 5, [
        { type: 'damage', value: 140 },
        { type: 'nextSkillSlow', value: 50 },
      ]),
      skill('mage.mana_shield', 'Mana Shield', '法力护盾', 0.6, 7, [{ type: 'shield', value: 200 }]),
    ],
  },
  {
    id: 'assassin',
    typeId: 3,
    name: 'Assassin',
    nameZh: '刺客',
    hp: 980,
    paid: false,
    blurb: 'Burst, haste, venom.',
    blurbZh: '爆发、无前摇、剧毒。',
    skills: [
      skill('assassin.backstab', 'Backstab', '背刺', 0.7, 4.5, [
        { type: 'damage', value: 280 },
        { type: 'critChance', value: 30 },
      ]),
      skill('assassin.shadow_strike', 'Shadow Strike', '影袭', 0.5, 6, [
        { type: 'damage', value: 160 },
        { type: 'nextSkillHaste', value: 1 },
      ]),
      skill('assassin.venom_blade', 'Venom Blade', '毒刃', 0.9, 6.5, [
        { type: 'dot', value: 50, duration: 3.5 },
      ]),
    ],
  },
  {
    id: 'ranger',
    typeId: 4,
    name: 'Ranger',
    nameZh: '游侠',
    hp: 1050,
    paid: false,
    blurb: 'Trap and mark.',
    blurbZh: '陷阱与弱点标记。',
    skills: [
      skill('ranger.multi_shot', 'Multi Shot', '连射', 1.1, 3.8, [{ type: 'damage', value: 160 }]),
      skill('ranger.snare_trap', 'Snare Trap', '定身陷阱', 0.6, 6, [
        { type: 'root', value: 0, duration: 1.8 },
      ]),
      skill('ranger.precision', 'Precision', '精准', 0.4, 7.5, [
        { type: 'nextSkillDmgAmp', value: 60 },
      ]),
    ],
  },
  {
    id: 'guardian',
    typeId: 5,
    name: 'Guardian',
    nameZh: '守护者',
    hp: 1450,
    paid: true,
    blurb: 'Living wall.',
    blurbZh: '活体城墙。',
    skills: [
      skill('guardian.iron_guard', 'Iron Guard', '铁壁', 0.5, 6.5, [{ type: 'shield', value: 280 }]),
      skill('guardian.shield_slam', 'Shield Slam', '盾猛', 0.9, 5, [
        { type: 'damage', value: 110 },
        { type: 'stun', value: 0, duration: 1.0 },
      ]),
      skill('guardian.fortify', 'Fortify', '固守', 0.4, 8.5, [
        { type: 'reduceDmg', value: 25, duration: 4.5 },
      ]),
    ],
  },
  {
    id: 'necromancer',
    typeId: 6,
    name: 'Necromancer',
    nameZh: '死灵法师',
    hp: 920,
    paid: true,
    blurb: 'Drain and curse.',
    blurbZh: '吸取与诅咒。',
    skills: [
      skill('necromancer.soul_drain', 'Soul Drain', '吸魂', 1.1, 4.2, [
        { type: 'damage', value: 170 },
        { type: 'heal', value: 90 },
      ]),
      skill('necromancer.bone_spear', 'Bone Spear', '骨矛', 1.0, 5, [
        { type: 'damage', value: 240 },
      ]),
      skill('necromancer.weakening_curse', 'Weakening Curse', '衰弱诅咒', 0.6, 7, [
        { type: 'buffAtk', value: -30, duration: 4 },
      ]),
    ],
  },
  {
    id: 'blademaster',
    typeId: 7,
    name: 'Blademaster',
    nameZh: '剑圣',
    hp: 1120,
    paid: true,
    blurb: 'Dance and execute.',
    blurbZh: '剑舞与处决。',
    skills: [
      skill('blademaster.triple_slash', 'Triple Slash', '三连斩', 1.2, 4, [
        { type: 'damage', value: 270 },
      ]),
      skill('blademaster.blade_dance', 'Blade Dance', '剑舞', 0.7, 5.8, [
        { type: 'damage', value: 190 },
        { type: 'nextHitReduce', value: 50 },
      ]),
      skill('blademaster.execution', 'Execution', '处决', 0.6, 7.5, [
        { type: 'damage', value: 150 },
        { type: 'execute', value: 300 },
      ]),
    ],
  },
]

export const FREE_HEROES = HEROES.filter((h) => !h.paid)

export function getHero(id: HeroId): Hero {
  const hero = HEROES.find((h) => h.id === id)
  if (!hero) throw new Error(`unknown hero: ${id}`)
  return hero
}

export function getSkill(hero: Hero, skillId: string): Skill {
  const found = hero.skills.find((s) => s.id === skillId)
  if (!found) throw new Error(`unknown skill ${skillId} for ${hero.id}`)
  return found
}

export function heroByTypeId(typeId: number): Hero | undefined {
  return HEROES.find((h) => h.typeId === typeId)
}
