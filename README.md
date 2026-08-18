# 连环计 · ChainStrat

[![Live](https://img.shields.io/badge/live-chainstrat.zhanghe.dev-c9a227)](https://chainstrat.zhanghe.dev)
[![Health](https://img.shields.io/badge/health-/api/health-2e7d32)](https://chainstrat.zhanghe.dev/api/health)
[![Chain](https://img.shields.io/badge/chain-Monad%20Testnet%20(10143)-6c5ce7)](https://testnet.monadscan.com/address/0x595Ee3d4873898C6b1dfDD6208fc9DFC8b618d84)
[![pnpm](https://img.shields.io/badge/pnpm-11.21.0-f69220)](https://pnpm.io)
[![License](https://img.shields.io/badge/license-see%20below-lightgrey)](#许可证)

登录，选一名英雄，编一套你觉得最厉害的连招，然后去撞未知的对手。开打之后不能再动手，两套计当场对撞，每次都会撞出不一样的火花。

> 规则以 [`docs/rules.md`](docs/rules.md) 为准。与 PRD / 计划文档冲突时，以规则文档为准。

## 在线演示

| 项目 | 地址 |
| --- | --- |
| 正式站 | https://chainstrat.zhanghe.dev |
| 短域名 | https://cs.zhanghe.dev （301 到正式站，路径和查询串会带过去） |
| 健康检查 | https://chainstrat.zhanghe.dev/api/health |
| PWA 深链 | [英雄库](https://chainstrat.zhanghe.dev/?screen=library) · [天梯](https://chainstrat.zhanghe.dev/?screen=ladder) · [市集](https://chainstrat.zhanghe.dev/?screen=market) · [擂台](https://chainstrat.zhanghe.dev/?screen=arena) |

**没有演示账号。** 本项目用钱包登录，不提供用户名 / 密码。本地或线上体验步骤：

1. 安装支持注入的钱包（MetaMask、Rainbow 等），切到 **Monad Testnet**（`chainId` `10143`）。
2. 从 [Monad 测试网水龙头](https://faucet.monad.xyz) 领取少量测试网 MON（`claimStarterPack` 与 `recordBattle` 需要 gas）。
3. 打开正式站或本地 `http://localhost:5173`，连接钱包。
4. 首次连接会自动调用 `claimStarterPack()`，铸造 4 个灵魂绑定免费英雄。失败（没 gas 等）仍可进大厅，但对战需要这四名英雄。
5. 编连招后可 **匹配真人**（队列空等 20 秒则打机器人）或直接 **人机对战**。单人演示请走人机。

本地 Worker 签名用 `.dev.vars.example` 里的 Anvil account #0，只用于本机预览，**不要**当作玩家演示私钥，也**不要**用于公开部署。

## 项目概述

连环计对应「先谋后动」：连招在战前锁定，开打后玩家不能操作。匹配成功后，Cloudflare Durable Object 用同一份 `simulateBattle` 算出 `{ events, result, seed, signature }`，双方客户端只播 log。播放结束由客户端提交 `BattleRecorder.recordBattle`；合约校验 EIP-712 签名来自 Worker authority，再更新 Elo。

当前阶段是 Monad 黑客松 MVP，合约部署在 **Monad Testnet**，不在主网。付费英雄数据已保留，MVP 不出售。

## 主要功能

- **钱包登录**：RainbowKit 2.2 + wagmi 2.x，连接 Monad Testnet。
- **免费英雄**：战士 / 法师 / 刺客 / 游侠，每地址每类型 1 个，灵魂绑定，不可转移。
- **连招设定**：手动顺序点选或自动随机；录制时钟 60 秒（含 CD 空等）；实时进度条与预览。
- **匹配**：按 Elo 最接近配对；独自等待 20 秒打机器人；另提供立即人机。掉线可凭 `matchId` 取回回放。
- **确定性战斗**：整数 tick（20 Hz），正规 60 秒；超时比血量，血量相同进入突然死亡加时。
- **对战播放**：Phaser 4 只翻译 EventLog（飘字、震动、血条、胜负）。
- **结果上链**：Worker 签名 + `BattleRecorder` 更新 Elo（人机 K=16，真人 K=32，初始 1000）。
- **天梯**：基础排名页。
- **SkillCombo NFT**：把当前连招铸成指定英雄的可交易 NFT，支持挂单 / 取消 / 用 MON 购买，出战可直接载入。
- **守擂擂台**：异步 PvP。上擂质押英雄 + 连招哈希，任何人等额挑战；种子由链上熵派生，胜者拿双方押金的 95%。
- **PWA**：可安装；对战 / 匹配中不自动刷新 Service Worker。

玩法细则（眩晕 / 定身 / 加时 / 同 tick 顺序）见 [`docs/rules.md`](docs/rules.md)。英雄数值见 [`docs/prd.md`](docs/prd.md) 附录，实现以 `src/lib/heroes.ts` 为准。

## 技术栈

以仓库 `package.json` 与合约配置为准（PRD 里的 wagmi 3 已否决：RainbowKit 2.2 不支持 wagmi 3，会导致 MetaMask 只转圈、扩展不弹窗）。

| 层级 | 技术 | 版本 / 说明 |
| --- | --- | --- |
| 包管理 | pnpm | `11.21.0`（`packageManager` 字段锁定） |
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

## 环境要求

- **Node.js** 22+（Vite 8 需要 `^20.19` 或 `>=22.12`，建议 22）
- **pnpm** 11（`corepack enable` 后按 `package.json` 的 `packageManager` 安装）
- 浏览器钱包，网络切到 Monad Testnet
- 跑合约测试 / 部署时： [Foundry](https://getfoundry.sh)（Monad 文档也提供 `foundryup --network monad`）

## 安装与本地运行

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

### 前端环境变量（`.env`）

从 [`.env.example`](.env.example) 复制。当前测试网默认值：

| 变量 | 含义 | 当前值 |
| --- | --- | --- |
| `VITE_WC_PROJECT_ID` | Reown / WalletConnect Project ID | 本地可用 `demo`；正式站必须在 Reown 控制台 allowlist `https://chainstrat.zhanghe.dev` |
| `VITE_HERO_NFT_ADDRESS` | 灵魂绑定英雄 NFT | `0x595Ee3d4873898C6b1dfDD6208fc9DFC8b618d84` |
| `VITE_BATTLE_RECORDER_ADDRESS` | 战报与 Elo | `0x4D3fe98448bc03F24EA4d7404c87b6724F5a9027` |
| `VITE_COMBO_NFT_ADDRESS` | 可交易连招 NFT | `0x2A633509d3929B02A829362B163FDbbaa721a8a3` |
| `VITE_ARENA_ADDRESS` | 守擂擂台（P1，待部署） | `0x0000000000000000000000000000000000000000` |
| `VITE_AUTHORITY_ADDRESS` | Worker 签名地址 | `0x52e9A3868375Ba6b4fC92612642068c00936FF56` |
| `VITE_MONAD_RPC` | 只读 RPC | `https://testnet-rpc.monad.xyz` |
| `VITE_CHAIN_ID` | 链 ID | `10143` |

合约地址变更时，同步改 `.env.example`、`wrangler.toml` 的 `[vars]`、本 README 与 `AGENTS.md`。

### Worker 本地变量（`.dev.vars`）

从 [`.dev.vars.example`](.dev.vars.example) 复制。`AUTHORITY_PRIVATE_KEY` 只放本机，**不要提交、不要 echo 进 shell**。示例文件里的 Anvil #0 仅供本地预览；公开部署必须换成独立 authority，并用下面的 secret 注入。

### 常用命令

```bash
pnpm test          # Vitest（含 combat 确定性用例）
pnpm typecheck
pnpm build         # 产出 dist/，供 Worker assets 使用
pnpm deploy        # vite build + wrangler deploy
```

### 合约

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

# P1 擂台（不重部署现有合约）
HERO_NFT_ADDRESS=0x595Ee3d4873898C6b1dfDD6208fc9DFC8b618d84 \
BATTLE_RECORDER_ADDRESS=0x4D3fe98448bc03F24EA4d7404c87b6724F5a9027 \
  forge script script/DeployArena.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz \
  --broadcast
```

Gas：前端对 `claim` / `record` 使用 `estimateGas` + 10% buffer，避免钱包回落到异常高的 gas limit。

## 已部署合约（Monad Testnet，2026-08-15）

| 合约 | 地址 | 浏览器 |
| --- | --- | --- |
| HeroNFT | `0x595Ee3d4873898C6b1dfDD6208fc9DFC8b618d84` | [monadscan](https://testnet.monadscan.com/address/0x595Ee3d4873898C6b1dfDD6208fc9DFC8b618d84) |
| BattleRecorder | `0x4D3fe98448bc03F24EA4d7404c87b6724F5a9027` | [monadscan](https://testnet.monadscan.com/address/0x4D3fe98448bc03F24EA4d7404c87b6724F5a9027) |
| ComboNFT | `0x2A633509d3929B02A829362B163FDbbaa721a8a3` | [monadscan](https://testnet.monadscan.com/address/0x2A633509d3929B02A829362B163FDbbaa721a8a3) |
| Arena | 待 `script/DeployArena.s.sol` 广播 | — |
| Owner | `0x1872277f92af762768c5280fa9fa65f92674a304` | — |
| Authority | `0x52e9A3868375Ba6b4fC92612642068c00936FF56` | — |

合约留在测试网。重新部署后必须更新前端 `.env`、Worker `[vars]` 与本表。

## 部署

生产形态：**单个 Cloudflare Worker**（`assets` + Durable Object `Matchmaker`），自定义域 `chainstrat.zhanghe.dev`。

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

## 仓库结构

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

## 文档

| 文档 | 用途 |
| --- | --- |
| [`docs/rules.md`](docs/rules.md) | 玩法与权威模拟规则（实现以此为准） |
| [`docs/prd.md`](docs/prd.md) | 产品范围、用户流程、英雄数值附录 |
| [`docs/plan.md`](docs/plan.md) | 半日 MVP 计划与战斗架构说明 |
| [`docs/plan-v2.md`](docs/plan-v2.md) | V2 改造计划：去中心化与深度玩法（按阶段执行） |
| [`AGENTS.md`](AGENTS.md) | 给代理 / 维护者的命令与部署备忘 |

`docs/plan.md` 仍写着 wagmi 3 与「自动模式总 duration ≤ 20s」等旧稿。以 `docs/rules.md`、本 README 和代码为准。

## 许可证

仓库根目录 **尚未添加 `LICENSE` 文件**，发行条款未统一声明。

Solidity 源码带有 `SPDX-License-Identifier: MIT`（`HeroNFT`、`BattleRecorder`、`ComboNFT` 及部署脚本）。前端与 Worker 目前没有 SPDX 头。

在补上根目录许可证之前，请勿默认本仓库可按 MIT 再分发。补许可证后，请同步更新本节与文件头徽章。

## 贡献

1. 用上面的步骤跑通 `pnpm dev`、`pnpm test`、`pnpm typecheck`。
2. 改战斗规则先改 `docs/rules.md`，再改 `src/lib/combat.ts` 与测试。
3. 不要提交 `.env`、`.dev.vars` 或任何私钥。
4. 改合约地址或正式域名时，一并更新本 README、`.env.example`、`wrangler.toml` 与 `AGENTS.md`。
