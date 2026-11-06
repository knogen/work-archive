# 档案问答首次部署记录

部署日期：2026-11-06（Asia/Shanghai）。本记录仅包含公开配置和资源标识，不含任何密钥或访问口令。

## 已完成

- 原静态站点继续使用 Cloudflare Pages，正式来源为 `https://work-archive.knogen.com`，同时保留 `https://work-archive.pages.dev`。
- 独立 Worker：`work-archive-agent`，地址为 [work-archive-agent.ider001.workers.dev](https://work-archive-agent.ider001.workers.dev)。
- 本次代码发布版本：`54c264df-bbf2-4603-ae61-ce45fe1c90d8`。后续在控制台保存 secrets 可能产生新版本，不影响此处记录的首次代码发布事实。
- 专用私有 KV：`work-archive-agent-corpus`，namespace ID 为 `ddf02407496d40adb93962df0fb0c9d7`，绑定名 `ARCHIVE_CORPUS`。
- KV 已上传 `corpus:2faa09b23364166702fe`；语料包含 1,417 节点、1,110 条证据、11 个主题入口和 80 个月份。
- 已通过 `v1` / `new_sqlite_classes: ["BudgetLedger"]` 注册 SQLite Durable Object 类，绑定名为 `BUDGET_LEDGER`。代码固定使用 `archive-global-budget-v1` 对象名，后续不要通过改名重置账本。
- 已创建独立问答访问口令并经标准输入写入 Worker 的 `AGENT_ACCESS_TOKEN` secret。该口令只保存在本地忽略文件 `.local/agent-access-token.txt`，没有写入公开前端、Git 或日志。
- OpenAI key 由用户在 Cloudflare 控制台自行填写。开发流程没有读取其值，也没有通过 CLI 设置它。

## 已部署的非秘密配置

| 配置 | 值 |
| --- | --- |
| `DAILY_BUDGET_USD` | `1`，北京时间零点切日 |
| `AUTH_MODE` | `token` |
| `ALLOWED_ORIGINS` | `https://work-archive.knogen.com,https://work-archive.pages.dev` |
| `CORPUS_VERSION` | `2faa09b23364166702fe` |
| `OPENAI_MODEL` | `gpt-6-luna` |
| `INPUT_USD_PER_MILLION` | `0.125`，覆盖默认缓存写入价格的保守输入单价 |
| `OUTPUT_USD_PER_MILLION` | `0.50` |
| API processing tier | 请求显式使用 `service_tier: "default"`，避免账号默认 Fast/Priority 费率 |
| Luna cache policy | 请求显式使用 `prompt_cache_options.ttl: "30m"` |

官方 Standard 短上下文费率为普通输入 $0.10、默认 30 分钟缓存写入 $0.125、输出 $0.50/百万 tokens。账本将全部输入按 $0.125 保守核算，因此不依赖缓存命中折扣。[模型定价](https://developers.openai.com/api/docs/models/gpt-6-luna)、[缓存计费](https://developers.openai.com/api/docs/guides/prompt-caching)

## 验证结果与待完成项

- 后端离线回归 19 项通过，覆盖真实 SQLite DO 的并发预算与结算，以及 Standard tier 和缓存选项固定。
- Worker 正式上传和触发器发布均成功；未修改其他 Worker、未删除资源、未升级 Cloudflare 订阅。
- 公网 `GET /api/agent/health` 返回 HTTP 200、`status: "ready"`、正确语料版本和每日 1 美元配置。
- 正式静态站点来源的 health 响应包含正确 CORS；未获准来源返回 HTTP 403。
- health 仅核对配置存在性和语料可用性，不验证 OpenAI key 的有效性，也不会调用模型。
- 此记录落盘时尚未发送真实模型问题。需要在用户确认 key 保存后，以一个小问题验证 OpenAI 访问权限、模型调用、引用和费用结算。
- 前端代码通过原仓库的 `main` 发布到 Pages；前端构建和 Worker 代码发布仍是两个独立流程。

维护说明见 [首次部署教程](agent-deploy.md)，语料范围见 [数据流程](agent-data.md)。
