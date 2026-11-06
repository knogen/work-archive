# 诺知工作档案：重设计方向

这是供选择的设计样机，不是已替换的正式网站。

- A：瑞士索引。白黑朱红、横向项目目录。
- B：研究控制台。深石墨、时间线和原文并排。
- C：蓝图案卷。淡蓝文件夹、宽窄纸页叠合。
- D：构成主义年鉴。明黄钴蓝、年份侧脊与项目索引。

首页文案已确定为：**做过的工作，形成的成果，待解的问题。**

直接打开 `index.html` 可以查看。需将选择回传到当前工作流时，在项目根目录运行：

```powershell
node "$env:USERPROFILE/.codex/skills/qiaomu-design/scripts/qiaomu-design-preview-server.mjs" --file design-previews/2026-11-06-work-archive/index.html --exit-on-select
```

使用该次服务打印的 URL。点选方向会打开确认弹层，三项拨盘与调整建议在确认后一起回传至同目录的 `selection.json`。未确认不会选择，推荐态也不会自动提交。

正式重设计须等方向确认，再更新项目根目录的 `DESIGN.md` 与生产文件。
