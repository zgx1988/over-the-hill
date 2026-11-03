# Cloudflare 发布

部署目标为 Cloudflare Workers 静态资源与 SQLite Durable Objects。构建使用固定版本依赖，不需要 Node.js 服务器常驻或额外数据库服务。

## 发布前

```sh
npm ci
npm test
npm run build
npx wrangler deploy --dry-run
```

`wrangler.jsonc` 将 `/ws`、`/api/*` 交给 Worker，其余路径由静态资源绑定 `ASSETS` 服务。`VALLEY` 绑定 `Valley` Durable Object，`v1` 迁移创建 SQLite 类型命名空间。客户端通过当前网站的同源 `wss://…/ws` 建立联机，不依赖本地地址。

## 账户与发布

使用自己的 Cloudflare 登录会话，先确认所选账户、同名 Worker、Workers 计划与 Durable Objects 配额，再执行正式发布。不要把 API Token、OAuth 文件、`.env`、`.dev.vars` 或 Wrangler 本地状态提交到 Git。

```sh
npx wrangler whoami
npx wrangler deploy
```

免费计划支持 SQLite Durable Objects，但有日配额；达到免费额度后可能暂时无法匹配或联机。活跃的游戏房间持续模拟，当前版本不使用 Durable Object 休眠。正式运营前应按房间拆分对象并进行容量、费用和真实移动设备验证。

当前源码同步与部署过程中，不自动开通付费计划、不购买域名、不创建长期 API Token，也不配置自动发布凭据。正式网址和线上实测结果以实际发布返回值为准，不能将本地模拟器地址当作线上网址。
