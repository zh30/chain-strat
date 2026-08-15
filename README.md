# 连环计 · ChainStrat

[![现在就能玩](https://img.shields.io/badge/现在就能玩-chainstrat.zhanghe.dev-c9a227)](https://chainstrat.zhanghe.dev)

先想好招式，再看一场自动对决。

连环计是一款网页游戏：你选一名英雄，事先排好技能顺序，然后和对手同时开打。开打之后不能再动手，只能看双方按各自的计划打完。谁的计划更好，谁就赢。

**现在就玩：** https://chainstrat.zhanghe.dev

---

## 这是什么

很多对战游戏比的是手速。连环计比的是事先想好的一套连招。

你有 60 秒时间编排技能。可以自己一个个点，也可以让游戏帮你随机生成一套合法连招。排好后去匹配：对面可以是真人，也可以是电脑。对战画面会自动播完，最后告诉你谁赢。

赢了会记入排行榜。你也可以把自己编好的连招做成一件可以买卖的收藏，别人买走就能直接拿去用。

游戏跑在 Monad 测试网上。你不需要注册账号，连上钱包就能玩。测试币没有真实价值，只用来走一遍完整流程。

## 怎么玩

1. 打开 https://chainstrat.zhanghe.dev
2. 点右上角连接钱包（第一次用的话，先装 [MetaMask](https://metamask.io) 或 [Rainbow](https://rainbow.me)）
3. 把钱包网络切到 **Monad Testnet**
4. 去 [水龙头](https://faucet.monad.xyz) 领一点测试币（很少就够）
5. 回到网站。第一次进来会自动送给你四名免费英雄：战士、法师、刺客、游侠
6. 选一名英雄，编一套连招（或点自动生成）
7. 点匹配。一个人演示的话，选「人机对战」立刻开打

没有演示账号，也没有用户名密码。你的钱包就是登录方式。

领英雄和登记战绩都要花一点点测试币。如果钱包里没有测试币，这两步会失败，但网站本身还是打得开。

手机也可以把网站「添加到主屏幕」，当小应用来用。

## 你能做什么

- **编连招**：自己点技能，或一键随机。屏幕上会显示已经用了多少秒 / 一共 60 秒。
- **打一局**：匹配真人，或直接打电脑。等太久没人来，也会自动改打电脑。
- **看回放**：对战像看一场短片。有飘字、震动、血条和胜负画面。中途掉线也能把这一局找回来看完。
- **上榜**：输赢会记入天梯。
- **买卖连招**：把当前这套招式做成收藏，挂出去卖，或买别人的来用。

四名免费英雄人人可领，领过就不能转给别人。另外三名英雄（守护者、死灵法师、剑圣）数据已经做好，这版还不卖。

想看具体技能和胜负规则，打开 [`docs/rules.md`](docs/rules.md)。数字和设定以游戏里实际表现为准。

---

## 给评委与开发者

下面是实现、栈、合约和部署。玩法规则以 [`docs/rules.md`](docs/rules.md) 为准；与 PRD / 计划文档冲突时，以规则文档为准。

[![Health](https://img.shields.io/badge/health-/api/health-2e7d32)](https://chainstrat.zhanghe.dev/api/health)
[![Chain](https://img.shields.io/badge/chain-Monad%20Testnet%20(10143)-6c5ce7)](https://testnet.monadscan.com/address/0x595Ee3d4873898C6b1dfDD6208fc9DFC8b618d84)
[![pnpm](https://img.shields.io/badge/pnpm-11.21.0-f69220)](https://pnpm.io)
[![License](https://img.shields.io/badge/license-see%20below-lightgrey)](#许可证)

### 设计要点

连招在战前锁定，开打后客户端不能改结果。匹配成功后，Cloudflare Durable Object 用同一份 `simulateBattle` 算出 `{ events, result, seed, signature }`，双方只播 EventLog。播放结束由客户端提交 `BattleRecorder.recordBattle`；合约校验 EIP-712 签名来自 Worker authority，再更新 Elo。

当前是 Monad 黑客松 MVP。合约在 **Monad Testnet**，不在主网。

| 能力 | 实现 |
| --- | --- |
| 钱包 | RainbowKit 2.2 + wagmi 2.x（不要升 wagmi 3，MetaMask 会只转圈） |
| 英雄 | `claimStarterPack()` 一次铸 4 个灵魂绑定 NFT；每地址每类型 1 个 |
| 连招器 | 手动 / 自动；录制时钟 60s（含 CD 空等）；进度条 + 预览 |
| 匹配 | Elo 最近配对；独等 20s 打机器人；也可立即人机；`matchId` 可重连回放 |
| 模拟 | 整数 tick（20 Hz），正规 60s；超时比血；同血进突然死亡加时 |
| 画面 | Phaser 4 只翻译 EventLog |
| 上链 | Worker 签名 + `BattleRecorder`（人机 K=16，真人 K=32，初始 1000） |
| 连招资产 | SkillCombo NFT：可转移，`list` / `cancel` / `buy`，出战可载入 |
| PWA | `vite-plugin-pwa`，`registerType: prompt`；`match` / `battle` 中不自动重载 |

深链：[英雄库](https://chainstrat.zhanghe.dev/?screen=library) · [天梯](https://chainstrat.zhanghe.dev/?screen=ladder) · [市集](https://chainstrat.zhanghe.dev/?screen=market) · [健康检查](https://chainstrat.zhanghe.dev/api/health)

### 技术栈

以仓库 `package.json` 与合约配置为准。`docs/plan.md` 里的 wagmi 3、「自动模式总 duration ≤ 20s」是旧稿。

| 层级 | 技术 | 版本 / 说明 |
| --- | --- | --- |
| 包管理 | pnpm | `11.21.0`（`packageManager` 锁定） |
| 前端 | Vite + React + TypeScript | Vite `^8.2` / React `^19.2` / TypeScript `^5.9` |
| 样式 | Tailwind CSS | `^4.3` + `@tailwindcss/vite` |
| 钱包 | RainbowKit + wagmi + viem | RainbowKit `^2.2` / wagmi `^2.19` / viem `^2.55` |
| 数据 | TanStack Query + Zustand | `^5.101` / `^5.0` |
| 游戏 | Phaser | `^4.2`，只播放 EventLog |
| PWA | vite-plugin-pwa | `registerType: prompt` |
| 匹配 / 托管 | Cloudflare Workers + Durable Objects | 静态资源与 API 同一 Worker |
| 合约 | Foundry + OpenZeppelin v5 | Solidity `0.8.28`，`evm_version = prague` |
| 链 | Monad Testnet | `chainId` `10143`，RPC `https://testnet-rpc.monad.xyz` |

共享逻辑在 `src/lib/*`，前端与 Worker 共用。

```
钱包 + 连招
    ↓
Cloudflare Worker / Matchmaker DO  （权威 simulateBattle）
    ↓
EventLog + resultHash + EIP-712 签名
    ↓
Phaser 4 播放          客户端 recordBattle
    ↓                         ↓
画面结算              HeroNFT / BattleRecorder / ComboNFT
```

### 环境要求

- **Node.js** 22+（Vite 8 需要 `^20.19` 或 `>=22.12`，建议 22）
- **pnpm** 11（`corepack enable` 后按 `packageManager` 安装）
- 浏览器钱包，网络切到 Monad Testnet
- 跑合约测试 / 部署时：[Foundry](https://getfoundry.sh)（Monad 文档也提供 `foundryup --network monad`）

### 安装与本地运行

```bash
pnpm install
cp .env.example .env
cp .dev.vars.example .dev.vars
pnpm dev
```

`pnpm dev` 会同时拉起：

- Vite：http://localhost:5173（`/api`、`/ws` 代理到 Worker）
- Wrangler：http://127.0.0.1:8787

打开 5173，连接钱包后即可编连招。单人请选人机对战。

本地 Worker 签名用 `.dev.vars.example` 里的 Anvil account #0，只用于本机预览，不要当作玩家私钥，也不要用于公开部署。

#### 前端环境变量（`.env`）

从 [`.env.example`](.env.example) 复制。当前测试网默认值：

| 变量 | 含义 | 当前值 |
| --- | --- | --- |
| `VITE_WC_PROJECT_ID` | Reown / WalletConnect Project ID | 本地可用 `demo`；正式站必须在 Reown 控制台 allowlist `https://chainstrat.zhanghe.dev` |
| `VITE_HERO_NFT_ADDRESS` | 灵魂绑定英雄 NFT | `0x595Ee3d4873898C6b1dfDD6208fc9DFC8b618d84` |
| `VITE_BATTLE_RECORDER_ADDRESS` | 战报与 Elo | `0x4D3fe98448bc03F24EA4d7404c87b6724F5a9027` |
| `VITE_COMBO_NFT_ADDRESS` | 可交易连招 NFT | `0x2A633509d3929B02A829362B163FDbbaa721a8a3` |
| `VITE_AUTHORITY_ADDRESS` | Worker 签名地址 | `0x52e9A3868375Ba6b4fC92612642068c00936FF56` |
| `VITE_MONAD_RPC` | 只读 RPC | `https://testnet-rpc.monad.xyz` |
| `VITE_CHAIN_ID` | 链 ID | `10143` |

合约地址变更时，同步改 `.env.example`、`wrangler.toml` 的 `[vars]`、本 README 与 `AGENTS.md`。

#### Worker 本地变量（`.dev.vars`）

从 [`.dev.vars.example`](.dev.vars.example) 复制。`AUTHORITY_PRIVATE_KEY` 只放本机，不要提交、不要 `echo` 进 shell。公开部署必须换成独立 authority，并用 secret 注入。

#### 常用命令

```bash
pnpm test          # Vitest（含 combat 确定性用例）
pnpm typecheck
pnpm build         # 产出 dist/，供 Worker assets 使用
pnpm deploy        # vite build + wrangler deploy
```

#### 合约

```bash
cd contracts
forge install --no-git OpenZeppelin/openzeppelin-contracts
forge test
```

部署（需要已认证的 RPC 与有余额的私钥；`AUTHORITY_ADDRESS` 必须与 Worker 签名地址一致）：

```bash
cd contracts
AUTHORITY_ADDRESS=0x52e9A3868375Ba6b4fC92612642068c00936FF56 \
  forge script script/Deploy.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz \
  --broadcast
```

Gas：前端对 `claim` / `record` 使用 `estimateGas` + 10% buffer，避免钱包回落到异常高的 gas limit。

### 已部署合约（Monad Testnet，2026-08-15）

| 合约 | 地址 | 浏览器 |
| --- | --- | --- |
| HeroNFT | `0x595Ee3d4873898C6b1dfDD6208fc9DFC8b618d84` | [monadscan](https://testnet.monadscan.com/address/0x595Ee3d4873898C6b1dfDD6208fc9DFC8b618d84) |
| BattleRecorder | `0x4D3fe98448bc03F24EA4d7404c87b6724F5a9027` | [monadscan](https://testnet.monadscan.com/address/0x4D3fe98448bc03F24EA4d7404c87b6724F5a9027) |
| ComboNFT | `0x2A633509d3929B02A829362B163FDbbaa721a8a3` | [monadscan](https://testnet.monadscan.com/address/0x2A633509d3929B02A829362B163FDbbaa721a8a3) |
| Owner | `0x1872277f92af762768c5280fa9fa65f92674a304` | — |
| Authority | `0x52e9A3868375Ba6b4fC92612642068c00936FF56` | — |

合约留在测试网。重新部署后必须更新前端 `.env`、Worker `[vars]` 与本表。

### 部署

生产形态：单个 Cloudflare Worker（`assets` + Durable Object `Matchmaker`），自定义域 `chainstrat.zhanghe.dev`。

```bash
pnpm deploy
```

等价于 `vite build` 后 `wrangler deploy`。`wrangler.toml` 已绑定该域名，并声明 SQLite Durable Object 迁移 `v1`。

上线前把 authority 私钥写入 Worker secret（从文件 stdin，不要 `echo`）：

```bash
wrangler secret put AUTHORITY_PRIVATE_KEY < ./authority.key
```

对应公钥必须等于 `AUTHORITY_ADDRESS` / `VITE_AUTHORITY_ADDRESS`。Reown / WalletConnect 项目需 allowlist `https://chainstrat.zhanghe.dev`。

`/sw.js` 必须 `Cache-Control: no-cache`（Worker 已处理）。不要在 `match` / `battle` 期间自动重载页面。

### 仓库结构

```
chain-strat/
├── src/
│   ├── lib/combat.ts          # 权威确定性模拟器（整数 tick）
│   ├── lib/heroes.ts          # 英雄与技能数值
│   ├── game/BattleScene.ts    # Phaser 4 播放 EventLog
│   └── components/            # 大厅、连招器、匹配、天梯、市集
├── worker/index.ts            # 静态资源 + /api/health + Matchmaker DO
├── contracts/src/             # HeroNFT、BattleRecorder、ComboNFT
├── docs/prd.md                # 产品需求
├── docs/plan.md               # 执行计划（部分栈信息已过时，以本 README 为准）
└── docs/rules.md              # 锁定规则（实现源）
```

### 文档

| 文档 | 用途 |
| --- | --- |
| [`docs/rules.md`](docs/rules.md) | 玩法与权威模拟规则（实现以此为准） |
| [`docs/prd.md`](docs/prd.md) | 产品范围、用户流程、英雄数值附录 |
| [`docs/plan.md`](docs/plan.md) | 半日 MVP 计划与战斗架构说明 |
| [`AGENTS.md`](AGENTS.md) | 给代理 / 维护者的命令与部署备忘 |

### 许可证

仓库根目录尚未添加 `LICENSE` 文件，发行条款未统一声明。

Solidity 源码带有 `SPDX-License-Identifier: MIT`（`HeroNFT`、`BattleRecorder`、`ComboNFT` 及部署脚本）。前端与 Worker 目前没有 SPDX 头。

在补上根目录许可证之前，请勿默认本仓库可按 MIT 再分发。补许可证后，请同步更新本节与徽章。

### 贡献

1. 跑通 `pnpm dev`、`pnpm test`、`pnpm typecheck`。
2. 改战斗规则先改 `docs/rules.md`，再改 `src/lib/combat.ts` 与测试。
3. 不要提交 `.env`、`.dev.vars` 或任何私钥。
4. 改合约地址或正式域名时，一并更新本 README、`.env.example`、`wrangler.toml` 与 `AGENTS.md`。
