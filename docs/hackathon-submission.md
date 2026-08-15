# 连环计 · ChainStrat
# Monad Blitz V2 @北京 · 项目提交文案

提交截止 18:30。下面按常见表单字段分段，可整段复制。段落已按纯文本排过，不要再往表单里贴 README 或代码。

---

## 1. 表单字段（直接粘贴）

### 项目名称

连环计（ChainStrat）

### 一句话介绍

先把杀招写死，再把人放进去。Monad 上的 1v1 英雄连招对决：开打后不能操作，两套计当场对撞，胜负与 Elo 上链，连招本身还能铸成可交易 NFT。

### 项目类型 / 赛道

链游 / GameFi / Consumer App

### Demo

https://chainstrat.zhanghe.dev

健康检查：https://chainstrat.zhanghe.dev/api/health

无需演示账号。请切到 Monad Testnet（chainId 10143），从 https://faucet.monad.xyz 领少量测试网 MON 后连接钱包。单人演示请选「人机对战」。

### 代码仓库

https://github.com/zh30/chain-strat

### 合约（Monad Testnet）

HeroNFT（灵魂绑定英雄）
0x595Ee3d4873898C6b1dfDD6208fc9DFC8b618d84
https://testnet.monadscan.com/address/0x595Ee3d4873898C6b1dfDD6208fc9DFC8b618d84

BattleRecorder（战报与 Elo）
0x4D3fe98448bc03F24EA4d7404c87b6724F5a9027
https://testnet.monadscan.com/address/0x4D3fe98448bc03F24EA4d7404c87b6724F5a9027

ComboNFT（可交易连招）
0x2A633509d3929B02A829362B163FDbbaa721a8a3
https://testnet.monadscan.com/address/0x2A633509d3929B02A829362B163FDbbaa721a8a3

---

## 2. 项目详细描述（主字段，建议整段粘贴）

连环计是一款部署在 Monad Testnet 上的完整 1v1 英雄对决游戏。玩家不是临场连点技能，而是在开打前把自己的连招写死；匹配成功后，两套计由权威模拟器当场对撞，客户端只负责把结果播成一场能看懂的战斗。

这个设计直接对应成语「连环计」，也对应我们想解决的链游问题：实时操作门槛高、链上每一步都贵、视觉又平。连环计把「思考」留给人，把「执行」交给确定性引擎，把「身份、所有权、结算、交易」留给 Monad。

完整闭环已经上线，不需要本地编译就能玩：

连接钱包后，合约会为每个新地址铸造四名灵魂绑定免费英雄：铁卫、星火、夜裁、苍原。英雄不可转让。玩家在六十秒录制钟里手动点选或一键随机生成连招，空等和冷却都算进时钟。然后可以匹配真人（队列空等二十秒则打机器人），或直接进人机。

战斗本身是整数 tick 的确定性模拟，正规时间六十秒；超时比血量，血量相同进入突然死亡加时。Cloudflare Durable Object 在匹配成功后先跑完模拟，再把事件日志、结果哈希和 EIP-712 签名发给双方。Phaser 4 只播放这份日志，不自己判胜负。播放结束后，客户端把战报提交给 BattleRecorder，合约校验签名来自 Worker 权威地址，再在链上更新 Elo。人机 K=16，真人 K=32，初始分 1000。

写得好的连招可以铸成 ComboNFT。英雄仍是你的，计可以卖掉。市集支持挂单、取消、用 MON 购买，买到的玉简可以直接载入出战。产品因此拆成两层资产：魂旗认人，玉简认计。

产品已作为 PWA 部署在 https://chainstrat.zhanghe.dev，可安装到手机或桌面。对战和匹配进行中不会自动刷新页面。

---

## 3. 项目特色 / 创新点（主打分项）

一、玩法本身就是规则，不是皮肤。
多数链游把链当成积分板。连环计把「先谋后动」做成不可逆的对局：连招在战前锁定，开打后玩家不能再伸手。策略深度来自技能顺序、冷却空等、控制链和加时突然死亡，而不是来自手速。

二、英雄与计分离，链上资产有分工。
HeroNFT 灵魂绑定，每地址每类型只能领一次，防止把「入场资格」做成投机。ComboNFT 可交易，买的是一套写死的杀法，不是英雄本体。将还是你的，计可以属于别人。这比「再发一个角色 NFT」更接近真正的策略市场。

三、权威在链下模拟，结算在链上认。
二十赫兹的战斗不该、也不需要整场上链。匹配成功后由 Worker 用同一份 simulateBattle 算出结果，再以 EIP-712 签名交给 BattleRecorder。Elo 在合约里算，客户端不能自己报分。同一场不能重复上链。这是可验证的比赛结算，不是自说自话的前端计数。

四、Monad 被用在会反复发生的动作上。
领取四将、记录战报、铸造连招、挂单成交，都是游戏里会反复发生的交易。Monad 的低费用和亚秒级最终性，让这些动作可以当成产品功能，而不是需要玩家忍耐的手续。

五、演示的是成品，不是概念图。
正式站、健康检查、三份已部署合约、可安装 PWA、人机保底、掉线可凭 matchId 取回回放，评委当场就能走完「领将 → 编计 → 观战 → 上链 → 看名册 / 进玉市」。

---

## 4. 为什么做在 Monad 上

连环计需要两类链上动作同时成立：第一类是入场身份，每个新玩家要一次领走四名英雄；第二类是高频结算，几乎每场对战都要写 Elo，好的连招还要能铸造和买卖。

这两类动作在慢链或贵链上都会把游戏卡死。Monad 是并行 EVM，兼容现有 Solidity / Foundry / RainbowKit / wagmi 工具链，同时给出约 400ms 出块、约 800ms 最终性和极低的实际费用。玩家在正式站里 claim、record、mint、buy，体感接近普通网页，而不是「等一个区块再继续玩」。

我们没有为了「显得很链」把战斗逐步上链。战斗是确定性的，结果可以复现；链负责认人、认计、认分。Monad 让这三件事可以发生在同一条用户路径里，而不拆成几个互相等待的产品。

前端对 claim 和 record 使用 estimateGas 加百分之十缓冲。Monad 按 gas limit 收费，乱填高 limit 会让玩家多付钱，这一点我们已经按链的计费方式处理。

---

## 5. 技术实现（给会看仓库的评委）

前端：Vite + React 19 + TypeScript + Tailwind 4。钱包是 RainbowKit 2.2 + wagmi 2 + viem，连接 Monad Testnet。对战画面是 Phaser 4，只翻译事件日志。

匹配与权威模拟：Cloudflare Workers + Durable Object。配对后先模拟再下发 EventLog、resultHash 和签名。静态站与 API 部署在同一个 Worker，域名 chainstrat.zhanghe.dev。

合约：Foundry + OpenZeppelin v5，Solidity 0.8.28。HeroNFT 禁用转移；BattleRecorder 用 EIP-712 校验权威签名并在合约内更新 Elo；ComboNFT 绑定英雄类型，用原生 MON 成交。

共享逻辑在 src/lib，前端与 Worker 共用同一份战斗模拟器。规则以 docs/rules.md 为准。

---

## 6. 评委三分钟演示路径

1. 打开 https://chainstrat.zhanghe.dev
2. 连接钱包，确认网络是 Monad Testnet
3. 首次连接会调用 claimStarterPack，一笔领四面白旗
4. 选一名将，进入编计：手动点技能，或一键随机
5. 选人机对战，避免排队
6. 看完一场对撞，提交战报上链
7. 打开名册看 Elo，再把当前连招铸成玉简并挂到玉市

如果现场 RPC 或钱包弹窗不稳定，直接打开正式站的人机回放与合约浏览器链接，说明「权威模拟 + 链上认分」即可。

---

## 7. 团队

Henry Zhang。一人全栈：玩法、确定性战斗、合约、匹配、PWA 与上线。

---

## 8. 下一步

付费三将目前只保留数据，不出售。之后会补赛季名册、更多英雄与控制效果、以及连招市集的发现和分成。合约现阶段留在 Monad Testnet；主网要等权威密钥、经济参数和反作弊一起定。

---

## 9. 九十秒口头陈述

先谋后动。这就是连环计。

Web3 游戏常见的问题是：要么手速门槛太高，要么链只是一个积分贴图。我们反过来做。玩家在开打前把自己的连招写死，开打后不能再操作。两套计由同一份确定性引擎对撞，Phaser 只负责把日志播成能看的战斗。

链上有三件事。HeroNFT 灵魂绑定，每人四名免费英雄，入场资格不能倒卖。BattleRecorder 只接受 Worker 签过的战报，Elo 在合约里算，玩家不能自己报分。ComboNFT 把连招变成可交易资产：将还是你的，计可以卖掉。

这些交易会反复发生，所以我们选 Monad。低费用、亚秒最终性、完全兼容 EVM，claim、record、mint、buy 都可以当成普通产品按钮。

请打开 chainstrat.zhanghe.dev。现在就能领将、编计、打一场、把结果写上 Monad。
