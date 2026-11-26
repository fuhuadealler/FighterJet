# FighterJet

[English](README.md) | 简体中文

> 是兄弟，就一起打飞机！

FighterJet 是一个浏览器端、竖屏 9:16 的在线双人飞机射击游戏。两名玩家各自在自己的电脑或手机上控制一架飞机，进入同一个权威服务器维护的对局，共享 3 条命，在无尽敌机中合作得分。

当前仓库实现的是 **第一个可玩 thin slice**：在线双人连接、移动、自动开火、一种直线敌人、共享生命、计分、game over 和双方准备后重开。Boss、武器升级、完整波次和音乐属于后续 v1.0。

## 当前功能

- 全局唯一对局，最多 2 名玩家；第三人会看到“对局已满”。
- 必须 2 人才能开始；第二人加入后 3 秒倒计时。
- 权威服务器：客户端发送输入，服务器以 60Hz 固定时间步运行 simulation，30Hz 下发快照。
- 共享 3 条命：死亡扣 1 条，3 秒后重生并带 2 秒无敌；两人都死亡时各扣 1 条。
- 无友军伤害，玩家之间不碰撞。
- 自动开火；桌面 WASD / 方向键，手机拖拽，飞机显示在手指上方约 40px。
- 一种直线敌人、连续生成、分数、服务器内存 Top 10。
- 断线或切后台时暂停对局，保留 30 秒重连窗口；使用浏览器保存的 session token 恢复。
- game over 后双方各自准备，两人都准备好后 3 秒倒计时重开。
- 像素风 Canvas 渲染；6 类程序化音效（当前 thin slice 使用其中 4 类）。
- 单 Node 服务同源托管构建后的客户端和 WebSocket。

## 尚未实现（v1.0）

- 3 种敌人：Zigzag、Shooter。
- 每波约 20–30 秒的完整波次系统，第 5/10/15 波 Boss。
- 三阶段 Boss 和 Boss 弹幕。
- 武器升级道具与 3 级武器。
- 音乐、更多音效和更完整的画面反馈。
- 数据库排行榜、账号、房间/匹配、中途加入、动态难度、客户端预测。

## 技术栈

- 客户端：React 19 + TypeScript + Canvas 2D，Vite。
- 服务器：Node.js + TypeScript + `ws`。
- 共享：`shared/` 放常量、消息协议、类型和固定时间步 simulation。
- 工作区：npm workspaces（`client/`、`server/`、`shared/`）。
- 测试：Vitest（共享逻辑 + 双 WebSocket 客户端服务器集成测试）。

## 目录结构

```text
FighterJet/
├── client/          # React UI + Canvas 渲染 + WebSocket 客户端
│   └── src/game/    # 输入、插值、渲染、音频、连接
├── server/          # Node HTTP + WebSocket 权威服务器
│   └── src/room.ts  # 全局对局、重连、暂停、Top 10
├── shared/          # 协议、类型、常量、simulation、单元测试
└── package.json     # npm workspaces 与统一脚本
```

## 本地运行

要求：Node.js 24+（当前在 Node 24.19 上验证）和 npm。

```sh
npm install
npm run dev
```

打开 <http://localhost:5173>。再开一个浏览器标签页或另一台同局域网设备访问同一个地址，第二人加入后自动开始倒计时。

开发时 Vite 运行在 5173，Node/WebSocket 运行在 3001；Vite 会把 `/ws` 代理到服务器。

### 局域网 / 手机测试

`npm run dev` 已启用 Vite 的 `host: true`。手机与电脑在同一网络时，访问电脑的局域网 IP（例如 `http://192.168.1.10:5173`）即可。手机端会自动尝试请求全屏和竖屏锁定，浏览器不支持时会静默失败。

## 生产构建

```sh
npm run build
npm start
```

打开 <http://localhost:3001>。生产环境由同一个 Node 服务托管 `client/dist` 和 `/ws`，不需要额外配置 CORS。

## 脚本

| 命令 | 作用 |
|---|---|
| `npm run dev` | 同时启动 Vite 客户端和 Node 服务器 |
| `npm run dev:client` | 只启动 Vite 客户端 |
| `npm run dev:server` | 只启动 Node 服务器（tsx watch） |
| `npm run build` | 构建客户端到 `client/dist` |
| `npm start` | 启动生产服务器 |
| `npm test` | 运行 shared 单元测试和 server 集成测试 |
| `npm run typecheck` | 对三个 workspace 做 TypeScript 检查 |

## 操作

- 桌面：WASD 或方向键移动；自动开火。
- 手机：在游戏画面上拖拽移动；自动开火；飞机在手指上方约 40px。
- 无需手动射击或暂停。断线/切后台会自动暂停并尝试重连。

## 已知限制

- 当前是全局唯一对局：同一时间只能有一组两人在玩。
- Top 10 存在服务器内存，重启后清空；没有账号和持久化。
- 断线重连依赖浏览器保存的 session token；清除存储后无法恢复原座位。
- 当前 thin slice 仍使用连续生成敌人，不是完整波次/Boss 系统。
- 自动化测试通过；**尚未在真实浏览器或手机上完成双设备 playtest**，手感和移动端适配仍需实际测试。
- 无账号系统，适合朋友之间的小范围对局。

## License

MIT
