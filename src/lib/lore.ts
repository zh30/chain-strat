import type { HeroId } from './types'

export interface HeroLore {
  title: string
  epithet: string
  line: string
}

export const HERO_LORE: Record<HeroId, HeroLore> = {
  warrior: {
    title: '铁卫 · 靳灵',
    epithet: '把门闩砸进骨头',
    line: '他不怕拖。他怕你比他先动手。',
  },
  mage: {
    title: '星火 · 泠曜',
    epithet: '先让你走不动',
    line: '她活不了多久，所以计都短、都狠。',
  },
  assassin: {
    title: '夜裁 · 绯影',
    epithet: '出现时已经在砍',
    line: '有些计必须在一息之内结束。',
  },
  ranger: {
    title: '苍原 · 朔弦',
    epithet: '空白也是武器',
    line: '陷阱先于箭。那空白是她在等你踩进去。',
  },
  guardian: {
    title: '城垣 · 不裂',
    epithet: '城塌了人还站着',
    line: '几乎没有杀意。他把时间买回来。',
  },
  necromancer: {
    title: '枯潮 · 食名',
    epithet: '吃掉战报上的一个字',
    line: '你掉血，他活。你变弱，他从容。',
  },
  blademaster: {
    title: '无岁 · 斩策',
    epithet: '只写结尾',
    line: '真正的计，在血量掉过三成五时结束。',
  },
}

export const LORE = {
  title: '连环计',
  world: '连环渊',
  hook: '先把杀招写死，再把人放进去。',
  sub: '开打之后不能改。六十息。平手则加时突然死亡。',
  enter: '进入策场',
  seal: '谋定，然后死。',
  claimTitle: '召回先锋四旗',
  claimBody: '渊要先把四面白旗烙进你的名字。战士、法师、刺客、游侠，一笔。拒了就还站在石阶上。',
} as const

export function heroLore(id: HeroId): HeroLore {
  return HERO_LORE[id]
}
