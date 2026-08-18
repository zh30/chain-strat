# ChainStrat / 连环计

Monad Testnet 上的 1v1 英雄连招对决。规则以 `docs/rules.md` 为准。世界观与登入语气以 `docs/lore.md` 为准。

## Commands

```bash
pnpm install
cp .env.example .env
cp .dev.vars.example .dev.vars
pnpm dev          # Vite :5173 + wrangler :8787
pnpm test
pnpm typecheck
pnpm build
```

合约：

```bash
cd contracts
forge install --no-git OpenZeppelin/openzeppelin-contracts
forge test
# deploy after alchemy auth / a funded key
# AUTHORITY_ADDRESS=0xf39... forge script script/Deploy.s.sol --rpc-url https://testnet-rpc.monad.xyz --broadcast
```

## Architecture

- `src/lib/combat.ts` — 权威确定性模拟器（整数 tick）
- `worker/index.ts` — Matchmaker Durable Object，配对后先模拟再下发 EventLog
- `src/game/BattleScene.ts` — Phaser 4 只播放 log
- `contracts/` — 灵魂绑定 HeroNFT + 可交易 ComboNFT + Worker 签名的 BattleRecorder

钱包用 RainbowKit 2.2 + **wagmi 2.x**（RainbowKit 2.2 不支持 wagmi 3；v3 会导致 MetaMask 只转圈、扩展不弹窗）。
Gas：claim / record 使用 estimateGas + 10% buffer。

## Monad Testnet (deployed 2026-08-15)

| 合约 | 地址 |
|---|---|
| HeroNFT | `0x595Ee3d4873898C6b1dfDD6208fc9DFC8b618d84` |
| BattleRecorder | `0x4D3fe98448bc03F24EA4d7404c87b6724F5a9027` |
| ComboNFT | `0x2A633509d3929B02A829362B163FDbbaa721a8a3` |
| Owner (Agent Wallet) | `0x1872277f92af762768c5280fa9fa65f92674a304` |
| Authority (Worker signer) | `0x52e9A3868375Ba6b4fC92612642068c00936FF56` |

Explorer: https://testnet.monadscan.com/address/0x595Ee3d4873898C6b1dfDD6208fc9DFC8b618d84  
ComboNFT: https://testnet.monadscan.com/address/0x2A633509d3929B02A829362B163FDbbaa721a8a3  
Authority 私钥只在本地 `.dev.vars` 的 `AUTHORITY_PRIVATE_KEY`，上线 Worker 时用 `wrangler secret put AUTHORITY_PRIVATE_KEY`（从文件 stdin 写入，不要 echo）。

## Production (Cloudflare Worker + assets)

- Site: https://chainstrat.zhanghe.dev
- Short: https://cs.zhanghe.dev (301 to the site, path and query preserved)
- Health: https://chainstrat.zhanghe.dev/api/health
- Deploy: `pnpm deploy` (`vite build` + `wrangler deploy`)
- Contracts stay on **Monad Testnet** (not mainnet).
- Reown / WalletConnect project must allowlist `https://chainstrat.zhanghe.dev`.

## PWA

- `vite-plugin-pwa` (`registerType: prompt`) + `src/components/PwaChrome.tsx`.
- Icons in `public/icons/` (192/512 + maskable + apple-touch). Do not rely on SVG-only icons for installability.
- Service worker must stay `Cache-Control: no-cache` (Worker sets this for `/sw.js`).
- Do not auto-reload during `match` / `battle`.
- Deep links: `/?screen=library` and `/?screen=ladder` (PWA shortcuts).
