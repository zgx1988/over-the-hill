# 原创资产与第三方许可

## 原创内容

`public/vehicle.mjs` 中的 PIONEER 42 车身、轮胎胎块、轮毂、内饰、备胎、行李、车架、车桥、弹簧和灯光均为本项目代码生成。仅参考经典开放式四驱车的一般比例和机械布局，不含品牌标识，不是第三方模型下载或原游戏资产提取。

`public/scene.mjs`、`shared/world.mjs` 中的地形、松树、岩石、建筑、帐篷、路面、标牌、地图、天空和粒子均为本项目原创程序生成。车辆泥尘纹理由 Canvas 在本机生成。音效由 Web Audio 在本机合成。0.2 版雪地、机关道、足球场、足球纹理、导航和 AI 简化车辆也均由本项目代码生成。界面使用系统字体。

没有使用、提取、下载或重新分发《over the hill》的车辆、关卡、贴图、声音、UI 或游戏代码。

## 仅用于参考的材料

- Steam 官方商店说明：https://store.steampowered.com/app/2929250/over_the_hill/
- 用户提供的玩法参考视频，仅用于分析驾驶、镜头和车辆地形响应，未放入源码或运行包。
- 据连续帧观察调校的方向：低速共同穿越、绷紧牵引绳脱困、高位第三人称跟随/环绕、真实地形导致的侧倾/俯仰/轮拱相对位移、冷暖灯光对比。首版保留原创秋季山谷与经典四驱车，不宣称重建原游戏或视频车型。

## 运行依赖

- Three.js 0.180.0，MIT，https://github.com/mrdoob/three.js 。包含 `RoundedBoxGeometry`、`RoomEnvironment`。本地构建保留 `dist/vendor/THREE-LICENSE.txt`。
- ws 8.18.3，MIT，https://github.com/websockets/ws 。完整许可在 `node_modules/ws/LICENSE`。
- 开发验证工具：Playwright（Apache-2.0），Wrangler（MIT/Apache-2.0，以各自包内许可为准）。它们不是游戏美术资产。

## 技术参考

双人乘员、服装、脸部、手部、方向盘轮辐和关节动画均为本项目程序化原创。未下载人物模型或使用任何真实人物的扫描、肖像与贴图。驾驶员手臂使用两段逆向运动学，身体动画来自实际车辆运动与阻尼响应。

- Three.js 官方文档：https://threejs.org/docs/
- Cloudflare Durable Objects WebSocket 官方文档：https://developers.cloudflare.com/durable-objects/best-practices/websockets/
