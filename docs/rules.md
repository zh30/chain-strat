# 连环计（ChainStrat）锁定规则

**状态**：已锁定，实现以本文为准  
**日期**：2026-08-15  
**覆盖**：用户裁定 + 项目最优解

本文是代码的规则源。与 `prd.md` / `plan.md` 冲突时，以本文为准。

---

## 1. 连招录制

- 录制时钟上限 **60.0 秒**（含 CD 空等）。
- 技能数量不设上限，能塞进 60 秒多少是玩家的事。
- 手动：点技能即写入时间轴。若该技能仍在 CD，自动插入空等到 CD 结束（放不下 60 秒则拒绝）。点完后播放头推进该技能 `duration`，才能点下一个。
- 自动 / 机器人：在 60 秒内随机合法填充（遵守 CD 与 duration）。
- 存盘格式：有序 `skillId[]`。空等不单独存储，回放时按 CD 自动等待。
- 进度条：`已用 X.Xs / 60.0s`。

## 2. 正规时间与连招播放

- 正规战斗 **60 秒**。
- 连招队列在正规时间内 **只播一遍**。播完站桩，吃残留 DoT / Buff / 护盾。
- 队列中下一招 CD 未好：站着等，不跳招。
- CD 从 **起手** 起算（打断也已进入 CD）。

## 3. 加时赛（突然死亡）

正规 60 秒结束时：

- HP 不同：HP 高者胜，`reason = timeout`。
- HP 相同：**加时赛**。事件 `overtime_start`，画面必须有「加时赛 / OVERTIME · 突然死亡」提示。
- 加时赛规则：**谁先掉 HP 谁输**。扣护盾不算掉血。
- 同一 tick 双方都掉 HP：不算「谁先」，继续。
- 加时赛连招 **从队首循环**，CD / Buff / 护盾 / DoT **连续不重置**。
- 加时赛上限 60 秒。仍无人单独掉血：HP 低者负；仍相同则平局。
- 加时赛上限：30 秒内若双方同 tick 互秒至 0，判平。

更正：加时赛上限为 **60 秒**。若 60 秒内从未出现「仅一方掉 HP」：比当前 HP，仍平则 `winner = null`。

## 4. 控制与读条

| 效果 | 当前读条 | 新技能 |
|------|----------|--------|
| **Stun 眩晕** | 打断，技能不结算（CD 已走） | 禁止 |
| **Root 定身** | 不打断，读完照常结算 | 禁止起手 |
| **Ice Spike 减速** | 不影响当前 | 下一个起手的技能 `duration × 1.5`，用一次 |
| **无前摇** | — | 下一个成功起手的技能 `duration = 0`，当 tick 结算 |

无前摇与减速同时存在时：**无前摇胜**（duration 仍为 0）。两旗都消耗。

Root 必须禁施法，否则在无位移游戏里是空技能。Stun 负责「打断」，Root 负责「锁下一招」，两者有分工。

## 5. 胜负与同 tick

- 仅一方 HP ≤ 0：另一方胜，`reason = ko`。
- 同一 tick 双方 HP ≤ 0（正规）：平局，不加时。
- 超时 HP 不等：高 HP 胜。
- 超时 HP 相等：加时。
- 加时中仅一方掉 HP：该方负，`reason = sudden_death`（立刻结束，即使没死）。
- 模拟步进：内部用 **整数 tick**（20 Hz，1 秒 = 20 tick），禁止用浮点时间比较。

同 tick 处理顺序（锁死，保证确定性）：

1. Side 0 `processSide`
2. Side 1 `processSide`
3. 双方 DoT
4. 死亡检查
5. 加时掉血检查
6. `t += 1 tick`

## 6. 效果细则

- **伤害**：先盾后血。`floor` 到整数。
- **最终伤害**：`base` → Execution 替换 → 暴击 → `× atkMult` → `× (1 + nextSkillDmgAmp)` → `× (1 - reduceDmg)` → `× (1 - nextHitReduce)`。
- **Execution**：在 **命中时**（读条结束）看目标当前 HP% `< 35%`。
- **暴击**：在命中时用共享 `mulberry32(seed)` 掷骰。
- **War Cry / Fortify**：刷新持续时间，不叠加。
- **护盾**：数值叠加，无超时，直到打光。
- **DoT**：每 tick `round(dmgPerSec / 20)` 至少 0（用整数：`dmgPerSec * 1 / 20`，累计余数避免吞伤）。多段 DoT 独立。DoT **不消耗** Blade Dance。
- **Blade Dance「下一次受击」**：只吃下一次 **技能直伤**，不含 DoT。
- **Precision**：吃在下一记造成主伤害的技能上，乘算。
- 正规结束有人已死：不再进加时。

DoT 整数：每个 DoT 持有 `carry` 微伤害，每 tick `carry += dmgPerSec * 50`（以毫秒计，`dmgPerSec * 1000 * STEP_MS / 1000`），更简单：

```
acc += dmgPerSec * 100
tickDmg = floor(acc / 2000)   // 因为 1 tick = 1/20 s，*100 后 /2000 = /20
acc %= 2000
```

等价 `dmgPerSec / 20` 的精确整数化。

## 7. 权威模拟与上链

- **Worker（Matchmaker DO）是胜负权威**。配对成功后立刻跑同一份 `simulateBattle`，把 `{ events, result, seed, signature }` 发给双方。
- 客户端 **只播 EventLog，不重算权威结果**。本地可再跑一遍做 sanity check，不一致则仍以上链前校验为准：必须与 Worker 下发的 `resultHash` 一致才允许提交。
- `battleSeed` 由 DO 用 `crypto.getRandomValues` 生成，客户端不可选。
- 播放结束（或跳过结算）后，**客户端**调 `BattleRecorder.recordBattle`，合约校验：
  - `matchId` 未用过
  - EIP-712 签名来自 `authority`（Worker 持有的 signer）
  - 字段与签名消息一致
- 合约用结果更新 Elo，客户端不能自报积分。

## 8. 匹配

- 默认模式：按 **Elo 最接近** 匹配。队列里有人就与最接近者立刻配对；独自等待 **20 秒** 则打机器人。
- 另提供 **人机对战**：立即开打，不进队列。
- 机器人：随机免费英雄 + 60 秒随机合法连招。机器人 Elo 视为 1000。
- 掉线：Worker 已算完。重连带 `matchId` 取回回放，**算完赛**。结果照常可上链。
- 传输：**同一 Cloudflare Worker** 托管静态资源 + API；前端用 **WebSocket** 连 `/ws`（同源）。本地 Vite 把 `/ws`、`/api` 代理到 `wrangler dev :8787`。
- 人机与真人胜负都上链，天梯才有内容。人机 K=16，真人 K=32。

## 9. 英雄与 NFT

- 四个免费英雄 **登录即可用**，不挡游玩。
- 钱包连上后若未领过，**自动**调 `claimStarterPack()` 一次铸造 4 个灵魂绑定 NFT。失败（没 gas 等）仍可玩。
- 灵魂绑定：OZ v5 `_update`，禁止 `from != 0 && to != 0` 的转移。
- 每地址每类型 1 个。`tokenId = (uint256(uint160(user)) << 8) | heroType`。
- 付费英雄仍是 Stretch，数据保留，MVP 不卖。
- 连招 NFT 见第 12 节：可交易，不灵魂绑定。

## 10. 积分（Elo）

- 初始 1000，下限 100。
- 线性近似：`expected = clamp(500 + (ra - rb) * 5 / 4, 50, 950)`（千分制）。
- `new = ra + K * (score - expected) / 1000`，胜 score=1000，负 0，平 500。
- 人机对手按 1000 算，K=16。

## 11. 技术裁定

- 栈仍按 `plan.md`：PNPM + Vite SPA + React 19 + Tailwind 4 + Phaser 4 + wagmi/RainbowKit（**不用 Para**，本项目已锁 RainbowKit）。
- 部署形态：单个 Worker（`assets` + Durable Object），域名 `ChainStrat.zhanghe.dev`。
- 共享逻辑：`src/lib/*` 给前端和 Worker 共用。
- 合约未部署时：前端用本地权威模拟（开发模式），签名校验可关。演示 / 生产必须走 Worker。
- Monad gas：claim / record 先 `estimateGas`，最多加 10% buffer，禁止钱包回落到超高 limit。
- ENS：不做。地址显示 `0xabcd…1234`。
- 音效：P0 不做。
- 默认文案中文，保留英文键方便之后切。

## 12. SkillCombo NFT

- 编连招里可以把当前 `skillId[]` 铸成 **指定英雄** 的 SkillCombo NFT。
- 存盘：链上存 `heroType` + 该英雄技能下标（0–2），与客户端 `skillId[]` 一一对应。
- 铸造条件：调用者必须已拥有该英雄；连招非空且 ≤ 64 个技能；下标合法。60 秒合法性由客户端在铸造前保证。
- **可转移、可出售**（与灵魂绑定的 HeroNFT 相反）。合约内基础挂单：`list / cancel / buy`，计价为原生 MON。
- 出战：英雄库 / 编连招里选用自己持有的、对应英雄的 Combo NFT，直接载入连招，不必重编。
- 战斗权威仍只认 `skillId[]`。NFT 是连招资产与交易载体，不改 Worker 签名。

## 13. 开发时保底

- 无第二玩家 → 人机模式保证可演示。
- 合约挂了 → 仍可打完，结果页提示「上链不可用」。
- 时间不够时的砍单顺序：天梯页装饰 → PWA 完善 → 上链 → Phaser 特效。不砍模拟器与连招器。

## 14. 守擂擂台

没有同时在线的对手时，把 PvP 变成异步守擂：擂主把「英雄 + 连招 + 押金」挂在链上，任何人随时挑战。

- **上擂**：擂主质押 ≥ 最低押金（默认 0.01 MON，合约参数可调），指定已拥有的英雄，并把连招以 `keccak256(bytes(plaintext))` 哈希形式上链（防抄袭）。明文交给 Worker 保管，仅用于结算；Worker 必须先校验明文哈希与链上承诺一致才收。
- **挑战**：挑战者支付与擂台等额的押金，带自己的英雄与连招哈希发起挑战。同一擂台同时只允许一场进行中的挑战。
- **结算**：沿用本文第 2–6 节战斗规则（60 秒正规 + 加时）。种子由链上熵派生：`uint64(uint256(keccak256(abi.encodePacked(prevrandao, defender, challenger, nonce))))` 的低 32 位写入 `MatchInput.seed` 并交给 `simulateBattle`。`prevrandao` 与 `nonce` 在挑战成交时写入擂台，**不再由 Worker 随机生成**。Worker 只执行模拟并签 EIP-712。
- **分配**：双方押金合计为奖池。胜者拿走奖池的 95%，5% 进协议金库（后续阶段奖池来源）。平局各退押金。
  - 擂主胜：奖池 95% 记为擂主所得；原押金继续锁在擂台上，差额立即打给擂主；`defendCount += 1`，擂台保持开放，可再被挑战。
  - 挑战者胜：奖池 95% 打给挑战者，擂台关闭。
  - 平局：双方退回各自押金，擂台关闭。
- **撤擂**：无进行中的挑战时，擂主可撤擂并取回押金，擂台关闭。
- **防换招**：结算时合约用 `keccak256(bytes(combo))` 核对上擂 / 挑战时的哈希，不符则拒绝。同一场挑战不可重复结算。
- **Elo**：守擂按真人对局记入现有 `BattleRecorder.recordBattle`，K=32。本阶段结算仍需 authority 签名；去中心化在后续阶段完成。
