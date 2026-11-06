# 工作档案问答：第一次部署 Cloudflare Workers

本项目继续保留静态站点。Worker 代码放在**同一个仓库**的 `agent/worker/`，由 Wrangler 单独发布；它不需要 VPS，也不会进入静态站点的 `dist/`。

```text
浏览器：现有静态站点 + 独立问答侧栏
    │ HTTPS /api/agent/chat，SSE 流
Cloudflare Worker：鉴权 → 时间/主题/关键词召回 → 输入计数 → 预算预留 → OpenAI → 结算
    ├─ 私有 KV：脱敏语料、时间和主题索引、证据
    └─ 一个 SQLite Durable Object：全站额度、每日/IP频次、并发和调用账本
```

完整原始导出、附件全文、密钥和私有语料均不应放到静态资源目录。当前问答范围仅为已审阅的 `data/archive.json`；本次构建不改写原站点的公开数据和附件，其原有发布边界仍需分别审阅。详见 [数据流程](agent-data.md)。

## 先在本地看到工作流程

需要 Node.js 22 或以上；测试环境使用 Node.js 24。命令均在仓库根目录执行：

```sh
npm ci
npm run agent:build
npm run agent:preview
```

打开终端给出的 `http://127.0.0.1:4174`，点击右下角“问档案”，选择示例问题或输入年份/主题。页面将展示解析问题、关键词检索、时间和主题过滤、排序、证据读取、模型输入计数、预算预留与生成的过程。

**本地预览使用真实检索、私有 KV 和 SQLite Durable Object，仅 OpenAI 响应为模拟。不会读取你环境中的 OpenAI key，也不会调用任何外部模型 API。** 回答带有“本地流程演示”标记，只摘录检索到的资料，不新增历史结论。演示费率不是线上模型报价。预览的账本是临时数据，重启后重置；按 `Ctrl+C` 停止预览。演示访问口令仅由该本地服务注入，生产配置不含演示口令或模拟开关。

仅查看原静态站点仍可运行 `npm start`，无需密钥；未连接服务时问答模块会提示服务待连接，普通浏览和搜索照常可用。

## 1. 准备 Cloudflare

1. 注册/登录 Cloudflare 账号，准备接入 Cloudflare 的自有域名。
2. 运行 `npx wrangler login`，在打开的浏览器里登录并授权。此操作由你在本机完成。
3. 复制 `agent/worker/wrangler.example.jsonc` 为 `agent/worker/wrangler.jsonc`。后者已加入 `.gitignore`，用于保存你自己的部署参数，不要在其中填写密钥。

Workers 免费版每次请求只有 10ms CPU；本语料及索引约数 MB，解析和召回可能超过该限额。正式使用建议选 Workers Paid 后实测，当前基础订阅通常为每月 5 美元；OpenAI 调用、存储等另外计费。**应用的每日 1 美元限制只约束按配置费率核算的 OpenAI 推理消耗，不包含 Cloudflare 账单。** 以 [Workers 官方计费](https://developers.cloudflare.com/workers/platform/pricing/) 和 [运行限制](https://developers.cloudflare.com/workers/platform/limits/) 为准。

## 2. 创建私有语料 KV，并填写非密钥参数

```sh
npx wrangler kv namespace create ARCHIVE_CORPUS
```

将输出的 namespace ID 填入 `wrangler.jsonc` 的 `kv_namespaces[0].id`。KV 不提供公开文件地址，浏览器只能通过 Worker 获取受控的回答与引用，不能直接下载这份问答语料。

填写配置中的 `vars`：

| 参数 | 填写方式 |
| --- | --- |
| `DAILY_BUDGET_USD` | 保持 `"1"`，北京时间零点切日 |
| `AUTH_MODE` | 第一版建议 `"token"`，访问者输入独立的问答口令 |
| `ALLOWED_ORIGINS` | 静态站点的完整 origin，如 `https://archive.example.com`；多个用英文逗号分隔，不带末尾 `/` 或页面路径，不允许 `*` |
| `CORPUS_VERSION` | `npm run agent:build` 输出的 20 位语料版本，也见 `.local/agent-release/privacy-report.json` |
| `OPENAI_MODEL` | 你的 API Project 可用、支持 Responses API 和输入 token 计数的文本模型 ID |
| `INPUT_USD_PER_MILLION` | 所选模型的保守输入计费上界，美元/百万 tokens；至少覆盖普通输入和所用缓存写入价格中的较高者 |
| `OUTPUT_USD_PER_MILLION` | 所选模型的输出价格，美元/百万 tokens；填写当前官方报价 |

模板中的价格故意不预填。缺少密钥、模型、费率、来源域名或语料版本时，服务会拒绝模型调用。缓存输入也按配置的保守输入单价核算，不依赖缓存折扣。模型切换或价格变化时必须同步更新费率。可先在 [OpenAI 官方模型与价格](https://developers.openai.com/api/docs/pricing) 核对。当前正式部署采用 Luna 输入 `0.125`、输出 `0.50`，详见 [部署记录](agent-deployment-state.md)。

## 3. 上传脱敏语料

```sh
npm run agent:build
npx wrangler kv bulk put .local/agent-release/kv-upload.json --binding ARCHIVE_CORPUS --remote --config agent/worker/wrangler.jsonc
```

上传对象的 key 为 `corpus:<版本>`。更新时先上传新版本，再修改 `CORPUS_VERSION` 并部署 Worker；旧版本暂时保留可用于回滚。KV 是最终一致的，刚上传后短时间不可见时服务会拒绝调用，不会退回未审阅原始数据。[KV 一致性说明](https://developers.cloudflare.com/kv/concepts/how-kv-works/)

`.local/agent-release/` 被 Git 忽略，也不会由 `npm run build` 复制到 `dist/`。不要手工将该目录加入静态托管。

## 4. 配置 OpenAI key 和问答口令

建议创建独立 OpenAI Project，再创建 Restricted key。最小权限为 Responses API 的 Write；若控制台另列 Model capabilities，则启用 Request。Files、Vector Stores、Assistants、Agents、Batch、Usage、管理权限均不需要；代码不列模型，不需要 List models 权限。本系统只请求 `POST /v1/responses/input_tokens` 和 `POST /v1/responses`。控制台显示因账号可能不同，以 [API key 官方指南](https://developers.openai.com/api/docs/guides/api-keys)、[权限指南](https://developers.openai.com/api/docs/guides/rbac) 为准。

通过 Wrangler 的交互输入保存秘密，避免将秘密放进命令行参数、前端配置或 Git：

```sh
npx wrangler secret put OPENAI_API_KEY --config agent/worker/wrangler.jsonc
npx wrangler secret put AGENT_ACCESS_TOKEN --config agent/worker/wrangler.jsonc
```

`AGENT_ACCESS_TOKEN` 是你自行生成、至少 24 字符的问答访问口令，**不是 OpenAI key**。可以将问答口令交给获准访问的人，OpenAI key 始终留在服务端。浏览器仅在本次页面内存中保留问答口令，不写入 URL、localStorage 或 cookies。全站额度仍由同一个账本控制；同 IP 的用户会共享 20 次/日的频次限制。

初次创建 Worker 时若 `secret put` 提示脚本不存在，可按 Wrangler 提示创建该名称 Worker 后继续，或先完成第 5 步首次发布（此时缺密钥，服务不会调用模型），再写入 secrets。

建议同时在 OpenAI 独立 Project 上设置月度硬限额作为第二道防线；它有执行传播延迟，不能替代应用内每日预算。[OpenAI 支出限制](https://developers.openai.com/api/docs/guides/spend-limits)

## 5. 选择域名并发布 Worker

配置模板故意使用 `workers_dev: false` 和空 `routes`，避免误公开未完成的服务。**二者都不修改就不会得到可访问的服务地址。** 首次体验可以先将 `workers_dev` 改为 `true`，保留 `routes: []`；`wrangler deploy` 会输出你的 `https://work-archive-agent.<你的子域>.workers.dev` 地址。保持 `AUTH_MODE: token`，并完成密钥、口令、来源和语料配置后再使用。前端的 `apiBase` 填该地址加 `/api/agent` 即可。

有自有域名时，推荐新增一个 API 子域名，比如 `agent.example.com`。保持 `workers_dev: false`，将 `wrangler.jsonc` 顶层现有的 `routes: []` **替换**为：

```json
"routes": [{ "pattern": "agent.example.com", "custom_domain": true }]
```

该域名必须属于你的 Cloudflare zone，并检查没有需要保留的同名 DNS 记录。另一种方案是在已接入 Cloudflare 的静态站点域名下，仅将 `/api/agent/*` 路径路由给 Worker：

```json
"routes": [{ "pattern": "archive.example.com/api/agent/*", "zone_name": "example.com" }]
```

如果静态站点仍托管于 `https://knogen.github.io/work-archive/`，使用独立 API 子域名，`ALLOWED_ORIGINS` 填 `https://knogen.github.io`；不能控制 `github.io` 的 CF 路由。CORS 用于限制浏览器来源，真正的访问验证依赖服务端口令或 Turnstile。

先做本地检查，然后由你发布：

```sh
npm run agent:check
npm run agent:bundle
npx wrangler deploy --config agent/worker/wrangler.jsonc
```

`agent:bundle` 只打包到 `.local/worker-bundle`，不上传也不部署。首次部署的 migration 会自动创建 SQLite Durable Object，不需要手工建数据库。本例保留已测试的 `compatibility_date`，升级时单独验证。

**不要更改或删除 `BUDGET_LEDGER` 绑定、迁移、Worker 名称、类名或代码中固定的 `archive-global-budget-v1` 对象名来重置预算。** 这些标识共同确定生产账本。使用多个 Worker/不同环境时，它们默认拥有独立账本和各自 1 美元额度；若希望全站共用一个额度，应让所有站点访问同一个 Worker，不能分别部署后误以为仍共用预算。

## 6. 连接静态站点的问答模块

修改根目录公开的 `agent-config.js`：

```js
window.WORK_ARCHIVE_AGENT = Object.freeze({
  apiBase: 'https://agent.example.com/api/agent',
  authMode: 'token',
  turnstileSiteKey: '',
});
```

此处仅填写公开 API 地址，不能填写 OpenAI key 或问答口令。然后运行 `npm run build`，沿用原来的静态站点部署方式发布 `dist/`。Worker 发布和静态发布是两件独立操作，原站点内容、路由和浏览功能继续保留。

打开 `https://agent.example.com/api/agent/health` 应显示 `status: "ready"`。若显示未配置，检查上面的变量、secrets、KV 上传和版本是否一致。`health` 不会发送 OpenAI 推理请求，也不返回秘密。

在静态站点侧栏输入问答口令，先用一个小问题检查检索流程、引用、流式回答和剩余额度。真实 OpenAI 调用会计费；当前仓库的自动验证全部使用模拟 API，尚未验证你的账号权限、模型访问或真实网络连通性。

## 每日预算与故障处理

- 每日上限：按配置价格核算的 1 美元，北京时间零点恢复；同时最多 3 个请求，每个 IP 20 次/日和 5 次/分钟，全站 300 次请求/日。
- 每题最多一次付费模型生成。先使用 OpenAI 的输入计数接口核对输入，再按输入数加 128 tokens 余量、最大 2,000 输出 tokens 预留费用；输入上限为 12,000 tokens。超过日余额时不会调用生成接口。
- 使用 SQLite Durable Object 的事务预留，避免并发超卖；完成后按 usage 结算。推理 token 包含在 API 的输出 token 计数中，缓存输入仍按标准价保守计费。
- 网络中断、服务端 5xx、缺少 usage 或放弃的调用按完整预留费用记账；明确的 400/401/403/404/413/422/429 拒绝可以释放预留。账本中的预留到期会自动保守入账，不因浏览器关页而退款。
- 若真实 usage 超过预留边界，会冻结当日调用并按返回 usage 入账，需要检查模型、费率和计数配置。应用预算不是供应商账单的法律上绝对上限，仍应配合独立 Project 限额。
- 预算耗尽只暂停问答，静态浏览和搜索照常可用。不要通过重试或重建账本绕过额度；修复后等待次日，或由你明确调整预算。
- 调用设置 `store:false`，应用不记录问答正文。它不等于供应商零留存，详见 [OpenAI 数据控制](https://developers.openai.com/api/docs/guides/your-data)。DO 保存最多 30 天的请求 ID、每日费用、HMAC 后的 IP 标识与状态，不保存原始 IP、问题、回答或密钥。

## 可选：以后公开给访客

第一版默认使用口令。若公开开放，创建 Cloudflare Turnstile 组件，将静态站点域名加入组件允许的 hostname，并设置：

- Worker `AUTH_MODE` 改为 `turnstile`，用 `wrangler secret put TURNSTILE_SECRET_KEY --config agent/worker/wrangler.jsonc` 保存 secret，长度至少 24 字符。
- 前端 `authMode` 改为 `turnstile`，公开的 `turnstileSiteKey` 填组件 site key。
- `ALLOWED_ORIGINS` 保留准确来源，前端组件使用 `archive_chat` action；后端验证 action 和 hostname。其余日预算、IP 频次、并发限制仍然生效。
- API 域名可另配 Cloudflare WAF 规则处理流量滥用。Turnstile 不是用户账号系统；有更严格访问范围时继续使用口令或再接入正式身份认证。

## 本地真实 Worker 调试（最后才填密钥）

复制 `agent/worker/.dev.vars.example` 为同目录的 `.dev.vars`，由你填入秘密；`.dev.vars` 已被 Git 忽略。复制并填写 `wrangler.jsonc`，执行：

```sh
npx wrangler dev --config agent/worker/wrangler.jsonc
```

Wrangler 本地 KV 与远端 KV 分开，需要用 `wrangler kv bulk put ... --local` 导入同一语料后才能检索。这种运行方式可能调用真实 OpenAI 并计费；只想看流程时请使用 `npm run agent:preview`。
