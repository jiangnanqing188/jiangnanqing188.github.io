# 日常小记 Worker 后端

## 当前交付状态与范围

仅包含本目录的 Cloudflare module Worker、Node 定向测试和配置示例，无第三方运行依赖。使用 ES2022、标准 `fetch` / Streams / WebCrypto AES-GCM；测试运行于 Node 22。**截至 2026-11-09，Worker 已真实部署至 https://jiangnan-daily-notes.jiangnanqingwqw.workers.dev ，初版 version 为 `02585f18-2d73-4ff2-8fb4-4ffbc6a1615a`（主线程确认）。初版匿名 `GET /notes` 实测返回 503，后续运行时修复已由主线程真实部署为 `c8702cf5-2122-4460-857c-50f4c0c3ff01`。修复后首次读取有一次上游非成功，随后一次有界复查中匿名/正式 Origin 均 200，CORS、预检、非法请求拒绝和未配置认证门禁也符合预期；完整失败与成功证据保留在设计包的 `20261109-live-backend/`。GitHub App / Secrets 仍未配置，正式 OAuth / 真实 GitHub 写入 / Cloudflare 缓存实测均未完成，尚未正式可发布。**测试中的用户、授权码、token、记录和提交 SHA 都是隔离 mock 夹具，不会发往 GitHub，不是公开小记。

运行时修复：GitHub API 与 OAuth token exchange 改用 Workers 支持的 `redirect: manual`，所有 3xx 失败关闭，不跟随或转发用户 token / client secret；固定身份、仓库、路径、权限和会话规则不变。新增 Workers 拒绝 `redirect: error` 的失败复现，以及同源/跨源 3xx 的无转发、无持久化写入回归测试。本次定向验证为 **174 tests / 174 pass**（原 121 + 新增 53），连同既有 App 设置工具测试共 **203/203 通过**；复用既有 Wrangler 的 Miniflare/workerd，实测旧代码复现 503/认证错误、修复代码读取/认证/夹具写入成功及 100 个同源/跨源 3xx 拒绝场景。运行时上游全部由本地夹具接管，未访问真实 GitHub 或使用真实 Secrets，原生运行时验证本身不代表线上状态；真实部署证据见上段。

后端不修改 Hexo 主题、前端、全局 package、文章数据、`public/`、`main` 或 Pages 配置，不引入 GitHub Actions，也不会在本地生成初始数据文件。前端与初始文件由主线程在其授权范围内接入。

## 不可变目标与数据

生产来源固定为 `https://jiangnanqing188.github.io`，仅数字用户 ID **192717492** 能发布。`jiangnanqing188` 是显示/仓库定位值，不用于身份判断；即便其他用户昵称相同或 token 解密后声称是 owner，每次写入仍重新 `GET https://api.github.com/user` 严格核验数字 ID。

唯一写入目标固定在代码中：

```text
owner:  jiangnanqing188
repo:   jiangnanqing188.github.io
branch: master
path:   source/_data/daily.json
```

不接受客户端指定 repo、branch、path、created_at、returnURL；POST 额外字段会被拒绝，GET 查询参数不影响读取目标。该 JSON 的唯一顶层结构：

```json
{"version":1,"entries":[]}
```

后续记录结构为 `{id, created_at, body, mood}`：

- `id`：客户端为一次发布生成并保留的小写标准 UUID（推荐 `crypto.randomUUID()`）；网络失败/409 后保留同一个 ID 重试。
- `created_at`：服务器生成的 ISO UTC 时间，含毫秒及 `Z`，不能由客户端指定。
- `body`：非纯空白的 1–1000 个 Unicode code point；不按 UTF-16 长度计数，不接受孤立代理码位。原样保留文本和换行，既不解释 HTML/Markdown，也不通过删除标签来篡改正文。
- `mood`：只能是 `随手记`、`吐槽一下`、`小确幸`。
- 新记录追加后按时间倒序，已有记录不删除。重复 ID、非法时间/排序/结构、坏 base64、错误文件类型/路径/大小/SHA 均令远端读取失败，不覆盖坏档案。

主线程的 feature 应同时提供初始空 `source/_data/daily.json`，不放伪造记录。为首次启动，Contents API **404** 视为空数组；首次写入不携带 SHA，由 GitHub 条件创建。404 也可能表示目标不可见，因此上线前仍需核对仓库、分支和 App 安装权限，不能把 404 当成它们已配置正确的证据。其他网络、限额、权限或数据错误明确 503，绝不伪造空成功。

## API 与前端对接契约

以下 WorkerOrigin 必须是最终真实 HTTPS Worker 地址；示例域名不是已部署服务。

### `GET /notes`

公开、无需 Cookie 或 Bearer，返回上述 `{version:1,entries:[...]}` JSON。只读取 GitHub Contents API 的 `?ref=master`，不从构建产物/其他分支兜底，不使用发布者私有 token 填充公共缓存。

Cloudflare `caches.default` 缓存成功 JSON 120 秒，缓存键为 WorkerOrigin 的 `/notes`（忽略查询参数）。存储响应的 Cache-Control 为 `public, max-age=0, s-maxage=120`：边缘 TTL 120 秒，浏览器不自行沿用 120 秒本地副本。错误为 no-store，无 stale-if-error。边缘缓存仍在有效期时可返回已缓存内容，过期后上游失败返回 503。

所有 GitHub JSON 响应流有界读取，最大 **1 MiB**。Contents API 使用 base64 JSON 封装，解码后的档案另限 **700 KiB**，为 base64、换行、元数据预留空间；写入前同样检查新档案容量。超限拒绝写入（413）而不是截断/删除旧小记；外部导入了超限/不合法档案时读取 503，需人工审查，不自动归档或切换存储。

### `POST /notes`

必须同时满足：

```http
Origin: https://jiangnanqing188.github.io
Content-Type: application/json
Authorization: Bearer <opaque-session>
```

允许 `application/json; charset=utf-8`。请求体只包含 `{id,body,mood}`，实际读取字节数不超过 **16 KiB**（不仅检查 Content-Length），无效 JSON 为 400，超限 413，类型错误 415。先验证请求来源和内容，再解密短会话、重新核验 GitHub `/user`，读取并验证当前 canonical 文件。

- 使用当前 Contents API 文件 SHA 进行 **CAS** 更新，PUT 明确 `branch:master`；成功须有 GitHub 返回的合法 `commit.sha` 和目标文件确认，返回 **201**：

  ```json
  {"entry":{"id":"<original UUID>","created_at":"<server ISO UTC>","body":"<literal text>","mood":"随手记"},"commit_sha":"<GitHub-confirmed commit SHA>","duplicate":false}
  ```

- 已有同一 `id+body+mood`：不再 PUT，不重写时间，返回 **200**、`duplicate:true` 和原 entry。**此时 `commit_sha:null`**：Contents GET 只能证明记录已持久化，提供的是文件 blob SHA，不能伪称原始提交 SHA；不额外查询提交历史。前端以 entry/duplicate 展示幂等确认，不把 null 当作失败。
- ID 相同内容/心情不同：**409**。
- GitHub CAS **409** 原样映射为 API 409；422 写入条件/校验冲突也返回 409。不吞冲突，不基于陈旧内容覆盖，也不自动循环重试。前端先重新读取，再由用户以相同 ID 重试，保留原正文。
- GitHub 网络/限额/保存未确认：**503**。如果 GitHub 已提交但响应在途中丢失，下一次相同 ID 请求会走重复记录确认，不制造第二条。
- 发布成功及重复确认后尝试删除本次数据中心的公共缓存项。缓存设施故障不会把已确认 GitHub 提交改判失败。作者应立即使用返回 entry 更新当前界面；**访客在其他 Cloudflare 区域（或缓存删除故障时）仍可能延迟最多约 120 秒**，不是全网立即刷新。

没有编辑/删除接口；有 Bearer 也不接受错误 Origin。CORS 不是身份认证，非浏览器可自行伪造 Origin，仍必须通过不可伪造的加密会话与真实 `/user` 核验。

### `GET /auth/start` → GitHub → `GET /auth/callback`

1. 前端必须在用户点击事件中直接 `window.open(WorkerOrigin + '/auth/start', ...)`，保留 popup 引用和 opener；不是先跨域 fetch 再跳转，也不接受前端传 returnURL。
2. Worker 创建 32 字节随机 state、PKCE verifier/challenge，将 state/verifier/iat/exp AES-GCM 加密放入 `__Host-daily-notes-oauth` Cookie：`Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`，无 Domain。浏览器顶层 popup 的第一方 Cookie 仅用于本次 state，不依赖第三方 Cookie。
3. callback 严格核对唯一 state、唯一匹配 Cookie、到期时间、加密完整性和 Worker Origin 绑定，再以 GitHub App Client ID/Client Secret、code、PKCE verifier 在服务器端交换 token；不发送 `public_repo` 等 OAuth App 广泛 scope。
4. callback 再请求 GitHub `/user`。owner 得到下述消息，其他用户只得到 readonly、无 session。失败/取消只返回服务器定义的安全消息，不回显 GitHub 错误正文、code、token 或 secret。
5. Cookie 在**所有 callback 结果**中清除；GitHub 单次 code 兑换和 PKCE 防止同一回调 code 再次完成认证。此无状态实现没有持久化 nonce 黑名单，也不声称能在 GitHub 之前原子锁住所有并发回调；回调兑换重放由 GitHub 拒绝，测试明确模拟单次 code。并行开启两个登录窗口会令 Cookie 相互替换，应前端限制一次只开一个。

callback HTML 严格 no-store / nosniff / no-referrer / nonce CSP（不使用 unsafe-inline），不含小记正文、不含 token 明文。只向固定生产来源执行：

```js
{ type: 'daily-notes-auth', status: 'owner', session: '<opaque AES-GCM session>' }
{ type: 'daily-notes-auth', status: 'readonly' }
{ type: 'daily-notes-auth', status: 'error', message: '<safe server message>' }
```

`postMessage` 后尝试关闭窗口，无 opener 时只显示可关闭的提示。不加 `Cross-Origin-Opener-Policy: same-origin`，也不要在前端开 popup 时使用 `noopener` 导致对接失效；如正式博客未来启用隔离策略，需要重新验证跨源 opener。

前端接收时**同时**检查：

```js
if (event.origin !== WorkerOrigin || event.source !== popup) return;
if (event.data?.type !== 'daily-notes-auth') return;
```

随后检查 status/session 数据类型；只将 opaque session 放前端**内存变量**，不放 localStorage、sessionStorage、IndexedDB、URL、hash、日志或 DOM；明文 GitHub token 永远不进入浏览器。刷新页面即丢失会话，需要重登。正文展示用 `textContent` 等安全文本 API，不能 `innerHTML`，即使 body 含 `<script>` 也当文本处理。

会话 AES-GCM 加密 GitHub token、固定 owner、iat、exp，并用 AAD 绑定用途、WorkerOrigin 和博客来源。有效期最多 **1 小时**，如上游 token 剩余期限更短则采用更短期限，不实现 refresh token/后台续期。解密失败/超期 401；owner 不匹配 403。每次发布或 `/session` 检查都核验 GitHub 用户，撤销 token 后上游 401 令本地会话不可继续使用。

### `GET /session`

用 `Authorization: Bearer <opaque-session>` 检查；成功：

```json
{"role":"owner","login":"jiangnanqing188","expires_at":"<ISO UTC>"}
```

失败 401/403，上游核验不可用 503。不使用认证 Cookie，跨域 fetch 无需 `credentials:'include'`。

### CORS / 预检 / 配置

- 响应只在请求 Origin 与固定正式博客完全相同时返回精确 ACAO，不回显任意 Origin、不使用 `*`，均带 `Vary: Origin`，不允许跨源 credentials。
- OPTIONS 只允许 `/notes` 的 GET/POST、`/session` 的 GET，且请求头只能为 Authorization、Content-Type；拒绝其他方法/头/路径/来源。
- API 错误统一 JSON `{error:<safe message>}`、no-store；callback 错误仍是用于 popup 通知的安全 HTML，前端依据消息 status，而非假设 callback 有 JSON 错误体。
- 可选 `GET /health` 只检查本地配置可用性，不调用上游，**不证明** Cloudflare、OAuth、仓库权限或正式发布已验收。
- `ALLOWED_ORIGIN` / `OWNER_ID` 环境变量可省略，代码默认固定值；如果提供则必须等于固定值，否则 503。repo/branch/path 无环境覆盖入口。
- `createWorker({testOrigin:'http://localhost:4000', ...})` 只供 Node 测试注入，生产默认导出不读取此环境配置，其他外部测试 Origin 被拒绝。不要用修改生产允许来源来绕过真实接入验收。

## 真实配置前置事项（本次未执行）

以下是**用户之后明确授权执行**的设置说明，不是已完成事项，也不会自动安装工具、注册服务或发布。

1. 用户先在 GitHub 注册 **GitHub App（不是 OAuth App）**：
   - Homepage 为正式博客；Callback URL 为最终 `https://<your-worker-host>/auth/callback`，与 Worker 生成值完全一致。
   - Repository permissions 仅 **Contents: Read and write**，保留 GitHub 必需 Metadata read；不加 Workflows、组织、账号资料等额外权限。用户身份通过 GET /user 返回的公共数字 ID 判断。
   - 安装到自己的账号，只选择 `jiangnanqing188.github.io` 这一个仓库，不选 All repositories。
   - 这是用户 OAuth web application flow，既不是用 PEM 私钥生成 installation token，也不需要将 App private key 交给 Worker。无需开启 Device Flow、Actions 或配置 webhook 处理器；若不使用 webhook，应在 App 注册里关闭 Active webhook，而不是填假地址。
   - 记录 **Client ID**（不是 App ID）并由用户生成 Client Secret；不要把它们粘贴到聊天、提交、前端或普通日志。App 用户 token 的权限来自“用户与 App 的交集”；实际单仓库权限仍由 App 安装选仓保障，Worker 代码另外固定唯一可写路径。
2. 由用户准备 Cloudflare 账号、登录/现有 Wrangler CLI 和正式 HTTPS Worker 域名。本次未安装 Wrangler 或其他依赖。
3. 在本目录将 `wrangler.example.toml` 复制为本地 `wrangler.toml`，设置真实 GITHUB_CLIENT_ID；本目录 `.gitignore` 忽略该副本、`.dev.vars`、`.env` 与 `.wrangler/`。
4. 在安全本地环境生成 **32 字节随机密钥，hex 编码恰好 64 个字符**，由用户保存为 `SESSION_SECRET`。不要使用测试固定密钥。示例生成命令（只在安全终端执行，不贴输出）：

   ```bash
   openssl rand -hex 32
   ```

   之后经 Cloudflare Secret 管理输入 `SESSION_SECRET` 和 `GITHUB_CLIENT_SECRET`，例如在本目录运行既有 Wrangler 的交互式 `wrangler secret put SESSION_SECRET`、`wrangler secret put GITHUB_CLIENT_SECRET`。不用命令行明文参数、不把真实值写入配置示例。Client ID 可放 vars；Secret 缺失、长度/编码错误会令认证接口 503。轮换 SESSION_SECRET 会使已有会话和未完成 OAuth state 全部失效。
5. 核对主线程 feature 含空的 `source/_data/daily.json`，前端 API 地址使用最终 WorkerOrigin、且前端文本展示与 popup 消息校验符合上述契约。此后才由用户授权发布 Worker/站点。不要为此改 Pages 分支、创建 Actions 或自动推送。

### 部署后仍必须真实验收

- popup owner 登录、取消、其他账号 readonly；Secure/SameSite Cookie 正常，code/state 不在日志或错误页回显，CSP nonce 可执行且无第三方 Cookie 依赖。
- owner session 仅存内存，刷新丢失，陌生来源/匿名/非 owner/过期或撤销 token 无法发布。
- 测试真实发布前由用户提供愿意公开的真实正文并明确同意（不能为了验收向公开仓库写假记录）。核对唯一 master 源 JSON、真实 commit SHA、SHA 并发冲突和同 ID 重试。
- 确认 GitHub App 只安装目标仓库，Contents write 已生效；读取限额/网络失败正确显示不可用。
- 验证发布者即时显示返回 entry、Cloudflare 同区缓存失效、其他区域最多约 120 秒延迟。Node 缓存 mock 不等于 Cloudflare 真实缓存运行结果。
- 本次没有自动构建/部署 main；Worker 读取 master 让读者可获取新小记，不代表其他静态页面已经重新构建。

## 本地验证（无网络、无安装、无真实密钥）

从仓库根目录：

```bash
node --check backend/daily-notes/worker.mjs
node --test backend/daily-notes/test/worker.test.mjs
```

本环境 Node 22 的默认隔离 reporter 会折叠成文件级测试统计。为了清楚看到逐项计数，本次同时使用：

```bash
node --test --experimental-test-isolation=none --test-reporter=spec backend/daily-notes/test/worker.test.mjs
```

测试依赖 Node 内置 `node:test`、标准 WebCrypto 与注入的 GitHub fetch / 时钟 / Cache；没有真实出站网络。覆盖认证成功序列、固定 ID 核验、匿名/篡改/过期/非 owner、state 错/缺/过期/重复、code 重放、PKCE、Secret 不泄漏、nonce CSP、XSS 字符串边界、Origin/CORS、1 MiB 上游/16 KiB 请求限制、远端结构/容量、SHA 冲突、幂等和网络结果不确定后重试等。

回退时只取消主线程的后端 API 接入即可保留纯静态阅读；服务未部署时无需处理远端回退。正式上线后应先停止前端发布入口，必要时撤销 App 用户授权或轮换 SESSION_SECRET；不要删除 GitHub 已保存的真实小记来“回滚服务”。

## 实现依据（官方文档）

- GitHub App user access token / web application flow / PKCE：<https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app>
- Repository Contents GET/PUT、Contents write、更新 SHA 和冲突：<https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents>
- Cloudflare Cache API 及 data-center-local delete：<https://developers.cloudflare.com/workers/runtime-apis/cache/>

上述文档用于协议核对，不构成已完成真实服务验收的证据。

## 本次本地交接记录 · 2026-11-07

- 基线：`master` / `eacc1b42be75601873a8d1d7f3a9a3d761616097`；开始时存在其他执行者的桌宠相关改动及未跟踪素材，保持不动。另有主线程同期 UI 工作，本任务不读取/撤销其内容。
- 本次只新建本目录的 `worker.mjs`、`test/worker.test.mjs`、`wrangler.example.toml`、`.gitignore` 与本 README；未触碰主题、前端、全局 package 和现有文章数据。
- 实测：两份 `.mjs` 的 `node --check` 通过；默认 `node --test` 文件级通过；关闭测试隔离后得到 **92 tests / 92 pass / 0 fail**。Node 内置覆盖率报告为 Worker 行覆盖 **99.42%**、分支 **94.40%**；仅表示本地 mock 覆盖，非真实网络/浏览器/Cloudflare 证明。
- 未运行仓库级 `npm run build`：本子任务限定只写 backend，避免和主线程并发修改共享的 Hexo 构建产物；整站 build/桌面手机端截图由主线程最终集成验收执行。本任务没有前端布局改动。
- 按明确指令未暂存、提交、推送、部署、安装依赖、创建 GitHub App/Secret 或写远端。文件保留未提交状态供主线程审查、集成；未切换配置或启动其他执行 AI，不声称已核验当前执行模型档位。
- 下一步：主线程对接上述接口与初始空 JSON；用户另行完成真实 Cloudflare/GitHub App 配置并授权部署，再按“部署后仍必须真实验收”逐项验证。不需要重新生成或公开任何测试夹具。

### 同批跨层审查 · 2026-11-07

主线程复跑后端 92 tests 通过后，本次审查基线为 `master` / `1d879ccc145ec4ddb6307cc5ef6a60caf06469cc`。仅在授权范围修改 `themes/notebook/source/js/daily.js`、`themes/notebook/lib/daily.js`，新增本目录 `test/cross-layer.test.mjs` 并补本段记录；Worker 协议和实现不变。未改主线程的 `scripts/check-daily.cjs` 或其他并发文件。

由先失败后通过的定向用例确认并修复：

1. 旧区域缓存曾直接替换静态/已读历史，可能令已存条目消失。现按追加契约合并已有条目，保留本页已确认结果；同 ID 的正文、心情或服务器时间不一致时拒绝替换并明确报错。
2. helper 曾将非法条目过滤掉并把坏数据包装成正常空集合。现与 Worker 的 UUID、Unicode、UTC 日历时间、唯一 ID、字段和倒序要求一致；异常档案显示错误、隐藏正常空状态，并输出 `null` 供客户端识别失败，不伪造 `{version:1,entries:[]}`。未配置服务时也不再覆盖静态失败提示。HTML、属性和内嵌 JSON 继续安全转义。
3. 前端曾先解析响应 JSON 再检查 HTTP 状态；非 JSON 的 401/403 会丢失认证失效状态，非 JSON 409 也不能触发刷新门禁。现先处理 HTTP 状态，即使中间层返回 HTML，退出会话、保留无凭据草稿及 CAS 重试门禁仍生效。
4. callback 在 `postMessage` 后立即关闭，轮询如果先观测 closed 会丢弃尚在消息队列的正常回调。现给予 **1 秒有界宽限**，仍要求 WorkerOrigin 与精确 popup 引用匹配，并在 `/session` 成功之前隐藏草稿与编辑器；取消超出宽限后不再接受迟到消息。

源码级 DOM 测试使用仓库**已存在**的 `jsdom`（没有安装/改动依赖），增加 29 项断言；其中一项将实际前端与实际 Worker 连通，只有最外层 GitHub fetch 为 mock，实测加密 OAuth 回调、`/session`、发布 `/user` 核验、固定目标 SHA 写入与返回处理。并覆盖非法消息源/窗口、检查会话前不恢复草稿、退出/过期/刷新不保存 Bearer、退出后的迟到发布响应、网络结果不确定后跨刷新同 ID 重试、409 门禁、Unicode 和文本 XSS。

```bash
node --check themes/notebook/source/js/daily.js
node --check themes/notebook/lib/daily.js
node --test --experimental-test-isolation=none --test-reporter=spec backend/daily-notes/test/worker.test.mjs backend/daily-notes/test/cross-layer.test.mjs
```

最终为 **121 tests / 121 pass / 0 fail**（原 Worker 92 + 新跨层 29），不是正式浏览器或 GitHub OAuth 验收。popup 宽限期的真实跨窗口消息调度仍须由主线程浏览器回归复核；Node DOM 模拟证明的是指定竞态及权限路径，不保证所有浏览器调度。**本次修改 helper 与前端源码后需要主线程重建再截图。**本子任务未并发 build、未修改生成物，也未暂存、提交、推送或部署。


## 一次性本机 Manifest 开通辅助（不自动创建或安装）

> 当前状态（2026-11-09）：真实开通尚未完成。此前浏览器提交后 GitHub 返回 `Invalid GitHub App configuration: "url" wasn't supplied`，未得到成功创建或凭据兑换的证据。本次核对官方 Manifest 字段表及其文档源码，确认 `hook_attributes.url` 标为必需，`active` 单独控制投递，文档未列出 `active: false` 时可省略 URL 的例外；已补齐本地 manifest 的这一契约缺口，但未重新提交 GitHub，不能认定它是此前报错的唯一原因，也不能将本地测试视为真实开通成功。此前临时入口已过期，请勿复用。

`setup-app.mjs` 只监听 `127.0.0.1`，提供一个 15 分钟有效的随机设置入口；打开后还需要在 GitHub 页面核对账号、名称和权限，再由操作者确认创建。它不自行点击创建、安装、写配置或部署。只允许固定账号 `jiangnanqing188`（数字 ID `192717492`）、固定 App 名称和 Contents write / Metadata read；创建完成后仍须只安装到博客仓库。Manifest 的 Worker 回调固定为 `https://jiangnan-daily-notes.jiangnanqingwqw.workers.dev/auth/callback`，部署前核对最终域名。

`hook_attributes.url` 固定为预期 Worker 域名下的 `https://jiangnan-daily-notes.jiangnanqingwqw.workers.dev/github/webhook`，与 OAuth 的 `/auth/callback` 分开；仅补齐配置字段，始终显式保留 `active: false`、`default_events: []` 和原有权限。本次没有新增 Worker webhook 处理路由，该地址不是已实现或已验证的接收服务，不要启用 webhook，也不要为它增加事件或权限。下次真实创建时仍须核对 webhook 未启用、最终域名、账号和权限，并验证 GitHub 接受 manifest、回调兑换和仅博客仓库安装；Cloudflare Secret 上传、部署及 OAuth/发布链路验收也仍未完成。

从仓库根目录运行（目录必须是**尚不存在**的仓库外绝对路径；如已存在则换新名字，不复用）：

```bash
node backend/daily-notes/setup-app.mjs --private-dir /tmp/blog-daily-setup-private-20261108-01
```

可在末尾加 `--port 8765`；省略时使用系统分配端口。控制台给出本机入口 URL，回调仅在服务端兑换授权码；不会记录 query、请求头、响应正文或异常详情，也不会把密钥显示在页面、URL或控制台。GitHub 返回的 state 会严格核验；错误、过期、重复或并发回调不会重复兑换。服务退出或 15 分钟到期即关闭。Manifest 握手方式依据 GitHub 官方的 [App manifest 文档](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest)。

成功后在新建的 `0700` 目录内生成两个 `0600` 文件：

- `worker-secrets.json`：仅 `GITHUB_CLIENT_SECRET` 与新生成的 32 字节 hex `SESSION_SECRET`，供已授权的 Wrangler 进程一次性读取。
- `app-metadata.json`：非敏感 Client ID、App URL、slug 及一次性清理说明。PEM 和 webhook secret 不写盘、不使用。

配置本地 Client ID、确认 Cloudflare 账号及 Worker 目标后，主线程可通过 stdin 输入 secrets（以下是命令示例，辅助工具不会自动执行）：

```bash
wrangler secret bulk --config backend/daily-notes/wrangler.toml < /tmp/blog-daily-setup-private-20261108-01/worker-secrets.json
```

不要 `cat`、截图或粘贴秘密文件；上传确认成功后仅删除这次新建的私有目录。若失败，页面只显示安全状态，私有目录可能保留部分文件，应先检查文件是否存在而不显示内容，不能盲目重新创建 App。不要把这个目录放进仓库、共享目录或有符号链接的父路径。

辅助工具独立测试（全部兑换为 mock，不访问 GitHub、不创建 App）：

```bash
node --check backend/daily-notes/setup-app.mjs
node --test --experimental-test-isolation=none --test-reporter=spec backend/daily-notes/test/setup-app.test.mjs
```

2026-11-09 回归：先新增用例，从真实本机表单解析 manifest；修复前 `hook_attributes.url` 为 `undefined`，HTTPS webhook URL 断言失败。补齐字段后，该针对性用例 **1/1 通过**，整批 helper 测试 **29/29 通过**（原 28 项 + 本次 1 项）；同时锁定 `active: false`、空事件、原权限及不触发兑换。脚本与测试的 `node --check` 通过。以上全部为本机 mock 结果，没有真实创建 App、兑换凭据或上传 Secret。

这些测试需要本机回环监听权限；不等于真实 GitHub manifest、安装或 Cloudflare Secret 上传验收。
