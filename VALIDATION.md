# 栖野 0.2 验证记录

以下为发布前本地验证记录，线上验证须另行完成并记录。

## 结果

- `npm test`：**19 / 19 通过**，包含实际服务器与 WebSocket 客户端；最后一次运行约 41.5 秒。
- `npm run build`：成功生成 `dist/`。
- `npm run test:browser`：四张地图选择、雪地键盘驾驶、两个 Chrome 客户端进入机关房间、受车重影响的跷跷板、足球 2 真人 + 8 AI、添加 AI 按钮、比分/时钟、刷新恢复和手机布局通过；脚本/资源错误 0。
- `npm run test:touch`：Chrome 多点触控、横竖屏、真实位移、释放/取消/旋转时清除输入、触摸创建房间和邀请码加入、足球地图按钮通过；脚本错误 0。
- Cloudflare Workers + Durable Objects **本地模拟器**：同一套机关/足球混编及 10 真人连接测试 **2 / 2 通过**。未登录、未部署。

## 关键证据

双人乘员更新另通过 `node tests/crew-browser.mjs`：车库显示驾驶员与副驾驶两人，转向时方向盘和双手联动，两人上身产生不同幅度的惯性反应；另一名真实浏览器客户端能看到转向动作。手机足球场中 9 辆 AI 简化车辆均有两名乘员。手臂可达范围误差在本次采样为 0，脚本/资源错误为 0。原始数据在 `artifacts/crew-browser-results.json`，程序化人偶与两段手臂 IK 并非完整人体或布料物理。

| 检查 | 实测 |
| --- | --- |
| 机关完整驾驶 | 服务端同一车辆计算实际驶过跷跷板、双木梁、滑索并完成三个检查点，测试路线跌落 0 次 |
| 跷跷板受载 | 两客户端同一帧收到相同桥角；Node 样本约 0.04 rad，Cloudflare 本地样本约 0.05 rad |
| 滑索携车 | 两客户端同帧平台状态一致；车辆从上板位置随平台实际运输约 7.6–7.9m 后进行采样，仍位于板上 |
| 木梁空隙 | 两个轮胎轨道有支撑，中间无支撑；跌落后自动回检查点 |
| 雪地任务 | 驶过目标不完成，按顺序停稳两秒才装载、交接、点亮信标 |
| 混编足球 | 2 个实际 WebSocket 真人 + 8 个服务端 AI，共 10 辆；两队各 5；同帧足球、比分、时钟数据完全一致 |
| 满真人容量 | **10 个实际 WebSocket 客户端**，无 AI，两队各 5；第 11 个邀请码加入被拒绝 |
| AI 行为 | AI 实际驾驶并碰到足球；完整模拟比赛发生进球，并从 05:00 计时至 00:00，进入终场，再重赛 |
| 进球 | 从球门前真实速度轨迹穿过门框计分；进球后回中场，未用客户端报分 |
| 恢复 | 断线后恢复相同车辆 ID 与房间；补齐 AI 后恢复真人仍不会超过 10 辆 |
| 手机同时操作 | CDP 同时发出两个触点，转向与油门均生效，实际驾驶约 2.62m，航向变化约 0.566 rad |
| 触摸释放 | touchEnd、touchCancel、窗口旋转均释放油门/转向/刹车与活动触点 |
| 手机房间 | 用触摸按钮创建私房，另一手机尺寸页面输入邀请码加入，并切换到房主的雪地地图 |
| 手机尺寸 | 390×844 竖屏、844×390 横屏，无文档横向溢出；踏板不覆盖竖屏足球房间操作区 |

## 原始记录

开发目录 `artifacts/`：

- `v2-browser-results.json`
- `v2-network-results.json`、`v2-ten-player-results.json`
- `v2-touch-results.json`
- `cloudflare/v2-network-results.json`、`cloudflare/v2-ten-player-results.json`
- `v2-menu.png`、`v2-snow.png`、`v2-trials.png`、`v2-soccer.png`、双客户端与手机横竖屏截图

运行包的 `verification/` 仅包含 JSON，不附浏览器截图。测试结果为本机样本，不代表所有设备/地形的误差或互联网延迟保证。

## 复现

```powershell
npm ci
npm test
npm run build
npm start
# 保持游戏服务运行，另开终端
npm run test:browser
npm run test:touch
node tests/crew-browser.mjs
# Cloudflare 本地适配
npm run dev:cloudflare
# 本地模拟器就绪后，另开终端
$env:TEST_WS='ws://127.0.0.1:8791/ws'
$env:QA_DIR='artifacts/cloudflare'
node --test tests/expansion-network.test.mjs
```

## 验证边界

10 真人容量测试使用 10 个真实 WebSocket 连接，不等于 10 台设备同时渲染测试；浏览器真实画面以两个 Chrome 页面和 AI 混编为主。手机测试使用 Chrome 的移动视口与实际 CDP 触摸事件，不是实体手机测试。没有测试 iOS Safari、低端手机、长时间发热、跨地区延迟或线上高并发。

机关使用动态高度面与平台携带约束，足球使用简化碰撞冲量；车辆保留近似悬架和地形响应，尚非完整刚体/机械/轮胎仿真。服务重启会清空内存房间，60 秒恢复只覆盖服务仍运行时的断线或刷新。
