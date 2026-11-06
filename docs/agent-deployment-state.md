# 档案问答首次部署记录

部署日期：2026-11-06（Asia/Shanghai）。本记录仅包含公开配置和资源标识，不含任何密钥或访问口令。

## 已完成

- 原静态站点继续使用 Cloudflare Pages，正式来源为 `https://work-archive.knogen.com`，同时保留 `https://work-archive.pages.dev`。
- 独立 Worker：`work-archive-agent`，地址为 [work-archive-agent.ider001.workers.dev](https://work-archive-agent.ider001.workers.dev)。
- 首次代码发布版本：`54c264df-bbf2-4603-ae61-ce45fe1c90d8`。取消访问口令的模块通过 Cloudflare 控制台更新，Active 代码版本前缀为 `2d0ad9be`，随后已保存并部署 `AUTH_MODE=public`。控制台保存变量或 secrets 可能继续产生新版本。
- 专用私有 KV：`work-archive-agent-corpus`，namespace ID 为 `ddf02407496d40adb93962df0fb0c9d7`，绑定名 `ARCHIVE_CORPUS`。
- KV 已上传 `corpus:2faa09b23364166702fe`；语料包含 1,417 节点、1,110 条证据、11 个主题入口和 80 个月份。
- 已通过 `v1` / `new_sqlite_classes: ["BudgetLedger"]` 注册 SQLite Durable Object 类，绑定名为 `BUDGET_LEDGER`。代码固定使用 `archive-global-budget-v1` 对象名，后续不要通过改名重置账本。
- 已取消访问口令，访客无需 `Authorization`、口令或 Turnstile 即可提问。保留的 `AGENT_ACCESS_TOKEN` secret 现在仅作为服务端 IP HMAC 盐值，不再用于 public 模式的访问校验，不发送给浏览器。沿用旧盐值可保留既有 IP 频次记录；本地忽略文件和服务端秘密没有被删除、打印或提交到 Git。
- OpenAI key 由用户在 Cloudflare 控制台自行填写。开发流程没有读取其值，也没有通过 CLI 设置它。

## 已部署的非秘密配置

| 配置 | 值 |
| --- | --- |
| `DAILY_BUDGET_USD` | `1`，北京时间零点切日 |
| `AUTH_MODE` | `public`，无需访问口令 |
| `ALLOWED_ORIGINS` | `https://work-archive.knogen.com,https://work-archive.pages.dev` |
| `CORPUS_VERSION` | `2faa09b23364166702fe` |
| `OPENAI_MODEL` | `gpt-6-luna` |
| `INPUT_USD_PER_MILLION` | `0.125`，覆盖默认缓存写入价格的保守输入单价 |
| `OUTPUT_USD_PER_MILLION` | `0.50` |
| API processing tier | 请求显式使用 `service_tier: "default"`，避免账号默认 Fast/Priority 费率 |
| Luna cache policy | 请求显式使用 `prompt_cache_options.ttl: "30m"` |

官方 Standard 短上下文费率为普通输入 $0.10、默认 30 分钟缓存写入 $0.125、输出 $0.50/百万 tokens。账本将全部输入按 $0.125 保守核算，因此不依赖缓存命中折扣。[模型定价](https://developers.openai.com/api/docs/models/gpt-6-luna)、[缓存计费](https://developers.openai.com/api/docs/guides/prompt-caching)

## 验证结果与待完成项

- 后端离线回归 24 项通过，覆盖真实 SQLite DO 的并发预算与结算、Standard tier 和缓存选项固定，以及无口令 public 模式的召回、预算、IP 频次和配置错误处理。原有 token 与 turnstile 模式继续兼容。
- Worker 正式上传和触发器发布均成功；未修改其他 Worker、未删除资源、未升级 Cloudflare 订阅。
- 公网 `GET /api/agent/health` 返回 HTTP 200、`status: "ready"`、正确语料版本和每日 1 美元配置。
- 正式静态站点来源的 health 响应包含正确 CORS；未获准来源返回 HTTP 403。
- health 仅核对配置存在性和语料可用性，不验证 OpenAI key 的有效性，也不会调用模型。
- 首次上线已完成一条获授权的真实问题验证：输入 3,947、输出 840 tokens，返回 8 个有效引用，按保守费率记账 $0.000914。
- 取消口令后，以**不带 Authorization** 的无匹配问题验证生产服务，返回 HTTP 200、`noMatch: true`；流程没有进入模型输入计数、预算预留或生成阶段，没有新增模型调用。请求 ID 为 `559e38de-4321-4240-b019-3ea6c4965423`。
- 该次 public 验证返回的既有账本为已花费 $0.004489、预留 $0、剩余 $0.995511 / $1；账本、IP 限流盐值、DO 名称、namespace 和每日预算均未重置。更改访问模式不清除已发生费用。
- 前端代码通过原仓库的 `main` 发布到 Pages；前端构建和 Worker 代码发布仍是两个独立流程。

维护说明见 [首次部署教程](agent-deploy.md)，语料范围见 [数据流程](agent-data.md)。
