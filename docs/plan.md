# 连环计（ChainStrat）完整最终计划文档

**版本**：Final v1.6  
**日期**：2026-08-14  
**项目名称**：连环计  
**英文名**：ChainStrat  
**正式域名**：[chainstrat.zhanghe.dev](https://chainstrat.zhanghe.dev/)  
**副标题**：Chain Stratagem · Monad 英雄连招对决  
**包管理器**：PNPM  

**目标**：半天内（约 4~6 小时）完成可玩、可部署、可演示的在线 1v1 连招对决游戏 MVP，并部署到 Cloudflare（最终域名 chainstrat.zhanghe.dev）。

---

## 一、项目核心逻辑澄清（已锁定）

### 1.1 用户完整流程
1. 打开 PWA 网站（ChainStrat.zhanghe.dev）→ 连接 Monad 钱包
2. 首次进入 claim 4 个免费英雄（每个类型限 1 个，不可交易）
3. 选择出战英雄 → 进入连招设定界面
4. **手动模式**：按顺序点击技能。点击后必须等待该技能完整释放（duration）结束后才能选择下一个技能；技能进入 CD。录制时钟上限 **60 秒**（含 CD 空等，技能数量不限）。实时显示进度条「已用 X.Xs / 60.0s」，超出则禁止继续添加。
5. **自动模式**：客户端使用种子随机生成合法连招（录制时钟 ≤ 60s，遵守 CD）
6. 点击「开始匹配」→ 进入 Cloudflare Durable Object 匹配队列
7. 匹配成功后，双方交换英雄 + 连招 + 共享 battleSeed → 进入自动对战播放画面
8. 对战过程用户完全无法控制，客户端用**确定性连续时间模拟器**自动执行双方连招，画面需达到「漂亮 + 动效震撼」标准
9. 分出胜负后，结果上链（记录胜负与积分），更新天梯
10. 可选：将当前连招铸造成指定英雄的 SkillCombo NFT（Stretch）

### 1.2 关键规则
- 连招录制最大时间：**60 秒**（含 CD 空等）
- 战斗正规时长：60 秒；平局加时突然死亡（见 `docs/rules.md`）
- 战斗 100% 客户端确定性模拟（双方用相同 seed + 连招）
- 免费英雄 4 个，付费英雄 3 个（Stretch）

### 1.3 完整英雄与技能数值

**免费英雄（MVP 必须实现）**

**1. Warrior（战士）HP: 1200**  
- Heavy Slash：180 伤，duration 1.0s，CD 3.5s  
- Shield Bash：90 伤 + 1.2s 眩晕，duration 0.8s，CD 5.5s  
- War Cry：自身攻击 +40% 持续 4s，duration 0.5s，CD 8s  

**2. Mage（法师）HP: 850**  
- Fireball：220 伤，duration 1.4s，CD 4s  
- Ice Spike：140 伤 + 减速（下个技能 duration ×1.5），duration 1.2s，CD 5s  
- Mana Shield：吸收 200 伤害，duration 0.6s，CD 7s  

**3. Assassin（刺客）HP: 980**  
- Backstab：280 伤（30% 暴击 1.5×），duration 0.7s，CD 4.5s  
- Shadow Strike：160 伤 + 下个技能无前摇，duration 0.5s，CD 6s  
- Venom Blade：DoT 50/s 持续 3.5s，duration 0.9s，CD 6.5s  

**4. Ranger（游侠）HP: 1050**  
- Multi Shot：160 伤，duration 1.1s，CD 3.8s  
- Snare Trap：定身 1.8s，duration 0.6s，CD 6s  
- Precision：下个技能伤害 +60%，duration 0.4s，CD 7.5s  

**付费英雄（Stretch Goal）**

**5. Guardian（守护者）HP: 1450**  
- Iron Guard：获得 280 点护盾，duration 0.5s，CD 6.5s  
- Shield Slam：110 伤害 + 1.0s 眩晕，duration 0.9s，CD 5.0s  
- Fortify：受到的所有伤害降低 25% 持续 4.5s，duration 0.4s，CD 8.5s  

**6. Necromancer（死灵法师）HP: 920**  
- Soul Drain：170 伤害 + 自己回复 90 HP，duration 1.1s，CD 4.2s  
- Bone Spear：240 伤害，duration 1.0s，CD 5.0s  
- Weakening Curse：对方攻击倍率 -30% 持续 4s，duration 0.6s，CD 7.0s  

**7. Blademaster（剑圣）HP: 1120**  
- Triple Slash：总伤害 270，duration 1.2s，CD 4.0s  
- Blade Dance：190 伤害 + 下一次受击减免 50%，duration 0.7s，CD 5.8s  
- Execution：基础 150 伤害；若对方当前 HP < 35% 则伤害变为 300，duration 0.6s，CD 7.5s  

---

## 二、最终技术栈（2026年8月最新稳定版 + PNPM）

| 层级 | 技术 | 版本 |
|------|------|------|
| 包管理器 | **PNPM** | 最新 |
| 前端框架 | Vite + React + TypeScript | Vite ^8.2 / React ^19.2 / TypeScript ^5.8 |
| CSS | Tailwind CSS v4 | ^4.3 + @tailwindcss/vite |
| Web3 | wagmi + viem + RainbowKit | wagmi ^3.7 / viem ^2.55 / RainbowKit ^2.2 |
| 数据 | @tanstack/react-query | ^5.101 |
| 游戏引擎 | Phaser | ^4.2 |
| PWA | vite-plugin-pwa | 最新 |
| 实时匹配 | Cloudflare Workers + Durable Objects | 最新 |
| 合约 | Monad Foundry + OpenZeppelin v5 | 最新 |
| 域名 | ChainStrat.zhanghe.dev | 已锁定 |

### 创建与安装命令（PNPM）

```bash
pnpm create vite chainstrat --template react-ts
cd chainstrat

pnpm add react@^19 react-dom@^19
pnpm add wagmi@^3 viem@^2 @rainbow-me/rainbowkit@^2 @tanstack/react-query@^5
pnpm add phaser@^4

pnpm add -D tailwindcss@^4 @tailwindcss/vite@^4 vite-plugin-pwa typescript@^5
```

Tailwind v4 配置示例（vite.config.ts）：
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({ /* 配置 */ })]
})
```

---

## 三、严格半日 MVP 范围

**必须完成（P0）**
1. PWA 网站 + 钱包连接（域名 ChainStrat.zhanghe.dev）
2. 4 个免费英雄 claim（ERC721）
3. 手动 + 自动连招设定（含 60s 录制上限 + 实时进度条 + 预览）
4. 确定性战斗模拟器
5. Phaser 4 自动对战播放（基本震撼效果）
6. 匹配系统（Durable Object 或 vs 机器人保底）
7. 对战结果上链 + 简单天梯
8. 部署到 Cloudflare 并绑定 ChainStrat.zhanghe.dev

**Stretch（P1）**
- 3 个付费英雄购买与使用
- SkillCombo NFT 铸造与基础销售
- 更复杂的粒子与音效
- ENS 名称解析

---

## 四、分阶段可执行计划（时间盒严格）

### 阶段 0：环境准备（15 分钟）
- 使用上方 PNPM 命令创建项目
- 安装 Monad Foundry：`curl -L https://foundry.category.xyz | bash && foundryup --network monad`
- 配置 Tailwind v4 + PWA + TypeScript

### 阶段 1：基础骨架 + 钱包 + 英雄 Claim（60~75 分钟）
- 配置 Monad Testnet（chainId 10143）
- 编写并部署 HeroNFT.sol（claimFreeHero + 预留 mintPaidHero）
- 前端 RainbowKit 连接钱包 + 4 个免费英雄 Claim
- 英雄数据写入 `src/lib/heroes.ts`

### 阶段 2：连招设定器 + 60 秒录制 + 实时预览（60~70 分钟）
- 手动模式：强制等待 duration + CD + 60s 进度条
- 自动模式：种子随机（总 duration ≤ 20s）
- 时间轴预览

### 阶段 3：确定性战斗模拟器（45 分钟）
- 纯 TypeScript 文件 `src/lib/combat.ts`
- 连续时间模拟（0.05s 步进）
- 完整事件 log + resultHash

### 阶段 4：Phaser 4 对战播放（70~90 分钟）
- BattleScene 用事件 log 驱动播放
- 粒子、飘字、屏幕震动、血条、胜负结算

### 阶段 5：匹配系统（45 分钟）
- Cloudflare Durable Object 匹配队列
- 保底：挑战机器人模式

### 阶段 6：结果上链 + 天梯（30~40 分钟）
- BattleRecorder.sol + 简单天梯页

### 阶段 7：PWA + 部署 + 绑定域名（30 分钟）
- 完善 PWA
- Cloudflare Pages 部署
- 绑定 **ChainStrat.zhanghe.dev**
- 完整流程自测

---

## 五、推荐项目目录结构

```
chainstrat/
├── contracts/                  # Monad Foundry
│   ├── src/
│   │   ├── HeroNFT.sol
│   │   └── BattleRecorder.sol
│   └── foundry.toml
├── src/
│   ├── components/
│   │   ├── WalletConnect.tsx
│   │   ├── HeroSelect.tsx
│   │   ├── ComboBuilder.tsx
│   │   └── Ladder.tsx
│   ├── game/
│   │   ├── scenes/
│   │   │   ├── BattleScene.ts
│   │   │   └── PreviewScene.ts
│   │   └── PhaserGame.tsx
│   ├── lib/
│   │   ├── heroes.ts
│   │   ├── combat.ts
│   │   ├── chain.ts
│   │   └── types.ts
│   └── App.tsx
├── public/assets/
├── vite.config.ts
├── wrangler.toml
└── package.json
```

---

## 六、Grok Imagine 资产生成清单

**第一批（立刻生成）**  
- 4 个免费英雄全身立绘 + 圆形头像  
- 12 个免费技能图标  

**第二批**  
- 3 个付费英雄立绘 + 头像  
- 9 个付费技能图标  
- 3~4 张战斗竞技场背景  
- 技能特效静帧 + UI 元素  

统一风格：赛博朋克 + 东方奇幻混合，高对比度，干净背景。

---

## 七、部署与测试清单

1. Cloudflare Pages 构建命令：`pnpm build`
2. 绑定自定义域名 **ChainStrat.zhanghe.dev**
3. Workers + Durable Objects 配置
4. 完整自测清单：
   - [ ] 访问 ChainStrat.zhanghe.dev 正常
   - [ ] 钱包连接（Monad Testnet）
   - [ ] 免费英雄可 claim
   - [ ] 手动连招 60s 录制上限生效
   - [ ] 战斗模拟双方结果一致
   - [ ] Phaser 4 播放流畅
   - [ ] 匹配或机器人模式可玩
   - [ ] 结果上链 + 天梯
   - [ ] PWA 可安装

---

## 八、风险与保底方案

| 风险 | 保底方案 |
|------|----------|
| 匹配系统来不及 | 直接做挑战机器人模式 |
| Phaser 4 学习成本 | 可临时降级 Phaser 3，但推荐直接用 4.2 |
| 时间严重不足 | 砍掉天梯与上链，只保客户端完整对战闭环 |
| 付费英雄来不及 | 完全不影响 MVP，数据已准备好 |

---

## 九、后续扩展方向
- 完整实现 3 个付费英雄购买流程
- SkillCombo NFT 完整市场
- 更多英雄与技能
- 主网正式上线
- 赛季天梯与奖励

---

## 十、Phaser 4 战斗模拟器深度技术设计

### 10.1 整体架构原则

```
双方英雄 + 连招 + sharedSeed
          ↓
【纯 TypeScript 确定性模拟器】（src/lib/combat.ts）
          ↓
完整 EventLog[] + Result（winner / finalHP / resultHash）
          ↓
【Phaser 4 BattleScene】只负责「翻译」EventLog 成视觉
```

**核心原则**：
- 逻辑与视觉彻底分离
- 模拟器完全不依赖 Phaser，方便单元测试与双方客户端验证一致性
- Phaser 4 只做播放，不重新计算战斗逻辑
- 战斗开始前一次性跑完整个模拟（预计算 log），播放时零逻辑计算

### 10.2 纯 TypeScript 确定性模拟器

#### 核心数据结构

```ts
interface Skill {
  id: string
  name: string
  dmg: number
  duration: number
  cd: number
  effects: Effect[]
}

interface Effect {
  type: 'damage' | 'stun' | 'root' | 'dot' | 'shield' | 'heal' | 
        'buffAtk' | 'reduceDmg' | 'nextSkillHaste' | 'execute'
  value: number
  duration?: number
}

interface HeroState {
  side: 0 | 1
  hp: number
  maxHp: number
  shield: number
  atkMult: number
  reduceDmg: number
  stunUntil: number
  rootUntil: number
  skillCDs: Map<string, number>
  queue: Skill[]
  queueIndex: number
  currentCast: { skill: Skill; start: number; end: number } | null
  dots: Array<{ dmgPerSec: number; until: number }>
  nextSkillHaste: boolean
}

type BattleEvent = 
  | { t: number; type: 'start_cast'; side: 0|1; skillId: string; duration: number }
  | { t: number; type: 'cast_end'; side: 0|1; skillId: string }
  | { t: number; type: 'damage'; side: 0|1; amount: number; isCrit?: boolean; remainingHp: number; source: string }
  | { t: number; type: 'heal'; side: 0|1; amount: number; remainingHp: number }
  | { t: number; type: 'shield'; side: 0|1; amount: number }
  | { t: number; type: 'effect'; side: 0|1; effect: string; value: number; duration: number }
  | { t: number; type: 'dot_tick'; side: 0|1; amount: number; remainingHp: number }
  | { t: number; type: 'death'; side: 0|1 }
  | { t: number; type: 'battle_end'; winner: 0|1|null; finalHp: [number, number] }
```

#### 模拟主循环（固定步进保证确定性）

```ts
const STEP = 0.05 // 20 ticks / 秒

function simulateBattle(
  hero1: Hero, combo1: Skill[],
  hero2: Hero, combo2: Skill[],
  seed: number
): BattleResult {
  const rng = mulberry32(seed)
  let t = 0
  const s1 = createState(hero1, combo1)
  const s2 = createState(hero2, combo2)
  const events: BattleEvent[] = []

  while (t < 60 && s1.hp > 0 && s2.hp > 0) {
    processSide(s1, s2, t, events, rng)
    processSide(s2, s1, t, events, rng)
    applyDoTs(s1, s2, t, events, STEP)
    t += STEP
  }

  const winner = s1.hp <= 0 ? 1 : s2.hp <= 0 ? 0 : (s1.hp > s2.hp ? 0 : 1)
  events.push({ t, type: 'battle_end', winner, finalHp: [s1.hp, s2.hp] })

  const resultHash = computeResultHash(events, s1.hp, s2.hp, seed)
  return { winner, finalHp: [s1.hp, s2.hp], events, resultHash }
}
```

#### 效果应用顺序（关键）
1. 检查特殊条件（Execution 等）
2. 计算最终伤害（含 atkMult、减伤、暴击）
3. 先扣护盾，再扣 HP
4. 应用次要效果（stun / root / buff / heal / DoT 等）
5. 检查死亡

### 10.3 Phaser 4 播放层

#### 推荐播放架构（自定义时间轴）

```ts
class BattleScene extends Phaser.Scene {
  private log: BattleEvent[] = []
  private idx = 0
  private battleTime = 0
  private playbackSpeed = 1.0

  update(_: number, delta: number) {
    this.battleTime += (delta / 1000) * this.playbackSpeed

    while (this.idx < this.log.length && this.log[this.idx].t <= this.battleTime) {
      this.playEvent(this.log[this.idx])
      this.idx++
    }
  }

  private playEvent(e: BattleEvent) {
    switch (e.type) {
      case 'start_cast':
        this.playCastAnim(e.side, e.skillId)
        break
      case 'damage':
        this.showFloatingText(e.side, e.amount, e.isCrit)
        this.cameras.main.shake(120, 0.01)
        this.flashHit(e.side)
        this.updateHpBar(e.side, e.remainingHp)
        this.spawnHitParticles(e.side, e.source)
        break
      case 'dot_tick':
        this.showSmallFloatingText(e.side, e.amount)
        this.spawnDotParticles(e.side)
        break
      case 'death':
        this.playDeath(e.side)
        break
      case 'battle_end':
        this.showResult(e.winner)
        break
    }
  }
}
```

#### 视觉映射（半日最小震撼集）

| 事件 | 视觉表现 |
|------|----------|
| start_cast | 英雄攻击动画 + 施法光环 |
| damage | 大号飘字（暴击金色）+ 屏幕震动 + 受击闪白 + 击中粒子 |
| dot_tick | 小飘字 + 持续粒子 |
| shield | 蓝色半透明护盾圈 |
| stun / root | 头上状态图标 |
| death | 慢动作 + 暗化 + 胜利文字 |
| battle_end | 全屏结算动画 |

#### Phaser 4 优势利用
- 更好的粒子系统 + Mesh2D（技能轨迹）
- Stencil（护盾遮罩）
- 更强的 Tween 与批量渲染

### 10.4 半日实现优先级

**P0**：
1. 完整确定性模拟器 + EventLog
2. 基础播放（start_cast、damage 飘字、震动、血条、死亡）
3. resultHash

**P1**：DoT 粒子、护盾视觉、状态图标、加速播放  
**P2**：Mesh2D 高级特效、Stencil 护盾、慢动作结算

### 10.5 架构优势总结

| 优点 | 说明 |
|------|------|
| 确定性 | 双方结果永远一致，可上链验证 |
| 可测试 | 纯 TS 模拟器可写大量单元测试 |
| 可扩展 | 加新效果只改模拟器，视觉层只加 case |
| 半日可行 | 逻辑与视觉分离，可并行开发 |
| 视觉上限高 | Phaser 4 有足够能力做出震撼效果 |

---

**文档状态**：Final v1.6（完整最终版）  
**已锁定全部内容**：名称、域名、PNPM、最新技术栈、英雄数值、20秒规则、Phaser 4 战斗系统设计、半日执行计划。

可直接按此文档开始开发。
