# 栖野 TRAILBOUND 0.2

可实际试玩的原创 3D 网页越野探索、机关合作闯关与四驱车足球测试版。

已加入双人乘员：驾驶员双手随方向盘转向，驾驶员和副驾驶的身体随车辆加减速、转弯和地形起伏联动。

本机试玩：**http://127.0.0.1:8790**。服务停止后可双击 `START.cmd`，或运行：

```sh
npm ci
npm start
```

需要 Node.js 22+ 和支持 WebGL 2 的浏览器。详细玩法、手机操作、局域网连接、测试记录和已知边界见 [中文说明](README.zh-CN.md) 与 [验证记录](VALIDATION.md)。

本仓库包含最新多地图、足球、手机触控与双人乘员版本。Cloudflare 部署使用 Workers 静态资产和 Durable Objects；部署说明见 [DEPLOYMENT.md](DEPLOYMENT.md)。
