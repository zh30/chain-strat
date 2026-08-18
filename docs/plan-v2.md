# 连环计 V2 改造计划：去中心化与深度玩法

**状态**：待执行（按阶段顺序推进）
**日期**：2026-08-19
**前置**：V1 MVP 已上线（https://chainstrat.zhanghe.dev ，Monad Testnet）

本文是 V2 改造的执行计划。玩法规则的最终裁定仍以 `docs/rules.md` 为准——**每个阶段动手前，先把该阶段的规则增补写进 `rules.md`，再改代码**。

---

## 总目标

1. **去中心化**：把胜负权威从 Worker 逐步移到链上，终局形态是链上可验证 / 链上模拟，Worker 退化为撮合与加速层。
2. **参与度**：不依赖同时在线的对手也能玩（守擂、阵营、锦标赛），弱玩家也有贡献感。
3. **深度**：连招从死序列进化为条件策略，连招 NFT 获得可验证战绩与真实定价。

## 阶段总览

| 阶段 | 名称 | 主攻方向 | 合约变更 | 依赖 |
|---|---|---|---|---|
| P1 | 守擂擂台 | 参与度 | 新增 `Arena.sol` | 无 |
| P2 | 连招战绩上链 + 作者分成 | 经济 | 改 `BattleRecorder` + `ComboNFT`（重部署） | 无 |
| P3 | Commit-Reveal 对战 | 去中心化 | 新增 `DuelHouse.sol` | P1 经验可复用 |
| P4 | 阵营战（魏蜀吴） | 参与度 | 新增 `FactionWar.sol` | P2（战绩事件） |
| P5 | 锦标赛 | 参与度 | 新增 `Tournament.sol` | P3（对战结算原语） |
| P6 | 条件连招（连招 v2） | 深度 | `ComboNFT` 存储格式 v2 | 建议在 P8 前完成 |
| P7 | 隐藏英雄成就解锁 | 深度 / 留存 | 改 `HeroNFT`（重部署） | P1/P4 提供成就来源 |
| P8 | 全链上模拟 + 乐观挑战 | 去中心化终局 | 新增 `CombatEngine.sol` 等 | P6（连招格式定稿） |

每个阶段独立可上线、可演示。P1–P3 是主线骨架，P4–P7 是内容扩展，P8 是技术旗舰。

---

## 全局约束（每阶段都要遵守）

- **规则先行**：玩法变更先改 `docs/rules.md`，再改 `src/lib/combat.ts` 与测试。
- **确定性红线**：模拟器保持整数 tick（20 Hz）、禁浮点比较、共享 `mulberry32`。任何新效果必须有确定性回归用例（同种子同结果）。
- **地址同步四件套**：合约重部署后必须同步 `.env.example`、`wrangler.toml [vars]`、`README.md`、`AGENTS.md`。
- **私钥纪律**：authority 私钥只在 `.dev.vars` / Worker secret（stdin 写入，不 echo）。新增合约的部署脚本统一走 `contracts/script/`。
- **PWA 纪律**：`match` / `battle` 期间不自动刷新；`/sw.js` 保持 no-cache。
- **钱包栈锁定**：RainbowKit 2.2 + wagmi 2.x，不升 wagmi 3。
- **Gas**：所有新合约写操作沿用 `estimateGas` + 10% buffer。
- 合约始终留在 **Monad Testnet**（chainId 10143），不上主网。

---

## P1 守擂擂台（异步 PvP + 押注）

**解决的问题**：没有同时在线的对手就没得玩。守擂把 PvP 变成异步的：擂主把「英雄 + 连招 + 押金」挂在链上，任何人随时挑战。

### 规则增补（写入 rules.md 第 14 节）

- 擂主上擂：质押 ≥ 最低押金（建议 0.01 MON 起，参数可调）+ 指定英雄与连招。连招以 keccak 哈希形式上链（防抄袭），明文交给 Worker 保管用于结算。
- 挑战：挑战者支付等额押金，带自己的英雄与连招发起挑战。
- 结算：沿用 V1 战斗规则（60 秒正规 + 加时），种子由链上熵（`prevrandao` + 双方地址 + nonce）派生，**不再由 Worker 随机生成**。
- 分配：胜者拿走双方押金的 95%，5% 进协议金库（后续阶段的奖池来源）。平局各退。
- 守擂计数：擂台记录 `defendCount`，被击败则擂台关闭、押金按上述分配。擂主可随时撤擂退押金（无进行中的挑战时）。
- Elo：守擂胜负按真人对局 K=32 记入 BattleRecorder（复用现有 `recordBattle`）。

### 合约：新增 `contracts/src/Arena.sol`

- `createStand(uint8 heroType, bytes32 comboHash) payable` — 上擂。
- `challenge(uint256 standId, uint8 heroType, bytes32 comboHash) payable` — 发起挑战，进入 pending。
- `resolve(uint256 standId, MatchInput m, bytes signature, string defenderCombo, string challengerCombo)` — 本阶段仍由 authority 签名结算（去中心化在 P3/P8 完成），但合约校验 `keccak(combo)` 与上擂/挑战时的哈希一致，防 Worker 换连招。
- `withdraw(uint256 standId)` — 撤擂。
- 视图：`standCount / standAt / standsOf`，供擂台列表页分页。
- 复用 `IHeroGate.hasHero` 校验英雄所有权。
- 押金托管在合约内，`call` 转账 + 重入守护（结算函数加 `nonReentrant` 或 checks-effects-interactions）。

### Worker

- `Matchmaker` DO 新增消息：`{ type: 'arena_challenge', standId }`。Worker 读链上双方 comboHash，向双方（或存储中的擂主连招）取明文，跑 `simulateBattle`（种子按规则从链上熵派生，Worker 只是执行者），签名后返回 `resolve` 所需参数。
- 上擂时客户端把连招明文交给 Worker 存储（`stand:{standId}` 键），Worker 校验哈希一致才收。
- 掉线恢复沿用 `match:{matchId}` 机制。

### 前端

- 新屏幕 `arena`（擂台列表 + 我的擂台 + 挑战流程），入口加进 `App.tsx` 与 PWA 深链（`/?screen=arena`）。
- `ComboBuilder` 增加「上擂」出口（与「匹配」「人机」并列）。
- 战斗播放与结果页复用 `BattleView` / `ResultView`，结果页增加押金结算信息。
- `src/lib/abi.ts` 增加 Arena ABI；新 hook `useArena.ts`。

### 测试与验收

- Foundry：上擂 / 挑战 / 结算 / 撤擂 / 重入 / 哈希不符 / 重复结算全覆盖。
- Vitest：链上熵派生种子的确定性用例。
- 验收：两个钱包不同时在线完成一次完整守擂对决并上链；押金分配正确；Elo 正确变动。

### 部署

- `forge script` 部署 Arena，四件套同步 + `VITE_ARENA_ADDRESS`。无需重部署现有合约。

---

## P2 连招 NFT 战绩上链 + 作者分成

**解决的问题**：市集里的连招 NFT 没有定价依据。给连招记上链战绩，让「87 胜 12 负」成为可验证的卖点；给原作者战胜分成，催生「军师」玩家。

### 规则增补（rules.md 第 12 节扩展）

- 出战时若连招来自某个 ComboNFT，`recordBattle` 附带 `comboTokenIdA/B`（0 表示手编连招）。
- 每次结算给对应 tokenId 累计 `wins/losses/draws`。战绩跟随 NFT 转移。
- 作者分成：ComboNFT 记录 `author`（首铸者）。在有押金的对局（守擂、P3 押注局）中，若胜方使用他人创作的连招，从其奖金中抽 2% 给 author。无押金对局只记战绩不分成。
- 市集列表按胜率 / 场次排序。

### 合约

- `ComboNFT` v2（重部署）：增加 `author` 字段、`stats(tokenId)`、`recordResult(tokenId, outcome)`（仅授权的 recorder / arena 可调）、`authorOf`。
- `BattleRecorder` v2（重部署）：`MatchInput` 增加 `comboA/comboB` 两个 uint256；EIP-712 `MATCH_TYPEHASH` 同步变更；结算时回调 `ComboNFT.recordResult`。
- `Arena.resolve` 奖金分配加入 author 抽成路径。

### Worker / 前端

- `signing.ts` / `chain.ts` 的 `matchTypes` 与 `payloadToMatchMessage` 增加 combo 字段；`MatchPayload` 与 DO `createMatch` 透传 `comboTokenId`。
- `ComboShelf` / `ComboMarket` 显示战绩徽章（胜-负-平、胜率）与作者地址；市集支持按胜率排序。
- 结果页显示「本局为连招 #123 记入一胜」。

### 测试与验收

- Foundry：战绩累计、越权 `recordResult` 拒绝、author 分成数额、TYPEHASH 回归。
- 验收：用 NFT 连招打一场人机，链上 stats +1；市集能看到战绩。

### 部署与迁移

- **BattleRecorder 与 ComboNFT 都要重部署**，旧战绩（Elo、旧连招 NFT）不迁移（测试网，接受重置；公告即可）。四件套 + `VITE_*` 地址全部更新。EIP-712 域名 version 升到 "2"。

---

## P3 Commit-Reveal 对战（去中心化 PvP 核心）

**解决的问题**：实时匹配的种子与结果都由 Worker 说了算。改为链上 commit-reveal：种子无人可控，连招互相保密，结果任何人可复算。

### 规则增补（rules.md 新增第 15 节）

- 流程：A 创建对局并 `commit(hash(combo, salt))` → B 应战并 commit → 双方 reveal（连招明文 + salt）→ 种子 = `keccak(saltA, saltB, blockhash)` → 结算。
- 超时保护：对手 24 小时不 reveal，己方可单方面判胜收走押金（惩罚弃赛）。
- 结算方式（本阶段）：任何一方 reveal 齐后，Worker（或任何人）链下跑 `simulateBattle`，提交结果 + authority 签名；**同时合约存下全部输入**，为 P8 的无签名结算做好数据基础。
- 支持可选押注（0 也行），分配规则同 P1。

### 合约：新增 `contracts/src/DuelHouse.sol`

- `createDuel(uint8 heroType, bytes32 comboCommit) payable`
- `acceptDuel(uint256 duelId, uint8 heroType, bytes32 comboCommit) payable`
- `reveal(uint256 duelId, uint8[] skillIndexes, bytes32 salt)` — 链上校验 commit；连招用 P2 的下标编码存储。
- `settle(uint256 duelId, MatchInput m, bytes signature)` — 校验种子按公式派生、双方连招与 reveal 一致。
- `claimTimeout(uint256 duelId)`

### Worker / 前端

- Worker 监听 reveal 完成的对局（客户端触发即可，不需要索引器）：跑模拟、签名、返回 `settle` 参数。
- 前端新增「约战」入口：创建对局后生成邀请链接 `/?duel=<id>`，可发给朋友——这是拉新利器。
- salt 存 localStorage，丢失时提示（丢 salt = 弃赛，文案要醒目）。

### 测试与验收

- Foundry：commit/reveal/超时/种子校验/押金路径。
- Vitest：`seedFromBytes` 与链上 keccak 派生的一致性（跨语言向量测试）。
- 验收：两个钱包通过邀请链接完成一场全流程约战，第三方脚本可用链上数据独立复算出同一 resultHash。

---

## P4 阵营战（魏 / 蜀 / 吴）

**解决的问题**：个体输赢之外没有集体目标，弱玩家缺少参与感。

### 规则增补

- 首次连接时选阵营（魏 / 蜀 / 吴），入营后 7 天冷却才能改。
- 所有对局（人机、匹配、守擂、约战）胜利为阵营 +1 分，真人局 +2。
- 周赛季：每周一 00:00 UTC 快照，胜方阵营按成员当周贡献分瓜分奖池（奖池来自 P1/P3 的 5% 协议抽成）。
- 阵营加成不影响战斗数值（保持模拟器纯净），只影响奖励。

### 实现

- 合约：新增 `FactionWar.sol`（入营 / 记分 / 周结算 / 领奖）。记分由 `BattleRecorder` 结算时回调（BattleRecorder 在 P2 已重部署，此处只加一个可配置的 hook 地址，避免再次重部署——**P2 实施时预留 `IScoreHook` 接口**）。
- 前端：HUD 显示阵营徽记与本周战况条（三国杀气氛拉满）；天梯页增加阵营榜。
- 世界观文案进 `docs/lore.md`。

### 验收

- 一场胜利后阵营分实时 +1；周结算脚本（`contracts/script/SettleWeek.s.sol`）可由任何人调用（有时间锁，非 owner 特权）。

---

## P5 锦标赛

**解决的问题**：缺少定期的节拍器事件拉回流。

### 规则增补

- 报名费制单败淘汰，8 / 16 人档。报名带英雄 + 连招 commit（复用 P3 原语）。
- 每轮限时 48 小时 reveal + 结算，超时判负。
- 奖池：报名费 90% 按 5:3:2 分给前三，10% 进协议金库。

### 实现

- 合约：`Tournament.sol`，对局结算直接复用 `DuelHouse` 的 commit-reveal-settle 流程（组合而非重写）。
- 前端：新屏幕 `tournament`（对阵树、报名、我的赛程）；对阵树用现成组件或简单 CSS grid。
- Worker：无新增权威职责，只做模拟与签名执行者。

### 验收

- 8 人（可含机器人补位）完整跑完一届，奖金正确分配，对阵树全程链上可查。

---

## P6 条件连招（连招 v2）

**解决的问题**：死序列连招套路会固化。加条件分支，把编连招变成写策略脚本，这是「先谋后动」的终极形态。

### 规则增补（rules.md 重写第 1 节 + 新增第 16 节）

- 连招条目从 `skillId` 升级为 `{ skillId, condition? }`。条件在**起手判定时**求值，全部用整数比较保持确定性。
- 首发条件集（刻意最小化）：
  - `selfHpBelow(pct)` / `enemyHpBelow(pct)`
  - `selfHasShield` / `enemyCasting`
  - `always`（默认）
- 语义：轮到下一条时，若条件不满足则**跳过该条**继续看下一条（最多跳到队尾；正规时间不回头，加时循环时重新可用）。CD 未好仍是等待，不是跳过——两个机制分开。
- 60 秒录制时钟按「全部条件成立」的最坏情况校验合法性。
- 编码：每条目 1 字节技能下标 + 1 字节条件码 + 1 字节参数，定长 3 字节，链上友好。

### 实现

- `src/lib/combat.ts`：起手选择逻辑加条件求值（一个纯函数 `evalCondition(state, cond)`），事件流增加 `skill_skipped` 事件。
- `src/lib/combo.ts` / `ComboBuilder`：条件选择 UI（每格技能右键 / 长按加条件徽章）；机器人生成器可少量随机加条件。
- `ComboNFT` 存储格式 v2：`uint8[]` 改为 3 字节组编码（P2 重部署时**直接预留 bytes 存储**，避免第三次重部署——P2 实施时用 `bytes combo` 而非 `uint8[] skillIndexes`）。
- `BattleScene`：`skill_skipped` 播放一个轻量提示（灰色飘字「弃」）。

### 测试与验收

- 确定性回归：同种子同结果向量固定进 `combat.test.ts`。
- 边界：全部条件不满足时站桩到队尾、加时循环重置可用性、条件 + 无前摇 / 减速旗叠加顺序。
- 验收：编一套「对方读条时打断、否则攒 buff」的条件连招并实战生效。

---

## P7 隐藏英雄成就解锁

**解决的问题**：`guardian / necromancer / blademaster` 三个付费英雄数据闲置。改为成就解锁，给长线玩家稀缺目标。

### 规则增补

- 守护者：累计守擂成功 10 场解锁。
- 死灵法师：累计真人对局 30 胜解锁。
- 剑圣：拿到任意一届锦标赛冠军解锁。
- 解锁英雄仍灵魂绑定，每地址每类型 1 个。

### 实现

- `HeroNFT` v2（重部署）：增加 `unlockHero(address user, uint8 heroType)`，仅授权的 `unlocker` 合约（Arena / BattleRecorder / Tournament）可调；`claimStarterPack` 不变。
- 各来源合约在满足条件时自动调用解锁（结算路径里检查计数）。
- 前端：英雄库里三个英雄显示为剪影 + 解锁进度条。
- **注意**：HeroNFT 重部署会导致旧 starter 失效，安排在 P2 重部署潮之后统一公告；`ComboNFT.heroes` 指向新地址（构造参数，需与 P2 协调——**若能提前定稿，P2 时一并重部署 HeroNFT 最省事**）。

### 验收

- 守擂 10 胜后自动收到守护者；英雄库进度条实时正确。

---

## P8 全链上模拟 + 乐观挑战（终局）

**解决的问题**：彻底移除 authority 签名依赖，成为真正的全链游戏，也是 Monad 高性能叙事的旗舰演示。

### 路线（两步走）

**8a. 乐观结算**：`DuelHouse.settle` 增加无签名路径——任何人提交 `resultHash`，进入 6 小时挑战期；挑战者链上调用 `CombatEngine.simulate` 复算，不一致则罚没提交者保证金。诚实路径 gas 极低，纠纷才跑全模拟。

**8b. 直接链上模拟**：对押注大的对局提供 `settleOnChain(duelId)`，一笔交易跑完 1200 tick。Monad 的吞吐让这在测试网可行，作为技术展示常开。

### 实现

- `contracts/src/CombatEngine.sol`：把 `src/lib/combat.ts` 逐行移植为纯函数库（`pure`，输入英雄 typeId + 连招编码 + seed，输出 winner / finalHp / resultHash）。V1 模拟器已是整数 tick、无浮点，具备直译条件。英雄数值表用常量函数硬编码，与 `heroes.ts` 一一对应。
- **差分测试是本阶段的生命线**：Vitest 生成 N=1000 随机对局向量（英雄、连招、种子、期望 resultHash）写入 JSON，Foundry ffi / 固定 fixture 逐条断言 `CombatEngine` 输出一致。任何一条不一致就不许上线。
- `resultHash` 的定义需要在 TS 与 Solidity 间完全一致：P8 动手前先把 `src/lib/hash.ts` 的哈希输入规范化为紧凑整数编码（当前实现若依赖 JSON 字符串需先重构，此项列为 8a 的第 0 步）。
- mulberry32 在 Solidity 中用 uint32 位运算复刻，加跨语言向量测试。

### 验收

- 1000 条差分向量全绿；一场真实约战走 8b 全链上结算成功；移除该路径上的 authority 依赖。

---

## 建议节奏与砍单顺序

- 每阶段一个 feature 分支，合并前过 `pnpm test` + `pnpm typecheck` + `forge test`。
- 合约重部署集中在 P2（BattleRecorder、ComboNFT、可选 HeroNFT 一起换），之后尽量只增不改，靠 P2 预留的 hook / bytes 存储吸收后续需求。
- 时间紧的砍单顺序（后砍的优先保）：P5 锦标赛 → P4 阵营战 → P7 隐藏英雄 → 其余不砍。P1、P2、P3、P8 是「更去中心化、更好玩」的主线，尽量守住。
- 文档同步：每阶段完成后更新 `rules.md`（规则）、`README.md`（功能列表）、`AGENTS.md`（地址与命令）。
