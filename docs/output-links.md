# 当前图表入口与历史产出对应表

核对日期：2026-11-06。按用户确认，本次只接入能对应历史工作的图表；GPC、学者/图书浏览器、国家排名应用及无明确对应项的页面保持原状。

依据：

- [新平台图表目录](https://github.com/ider-zh/discipline-network-research-website/blob/main/src/catalog.ts)
- [迁移范围与限制](https://github.com/ider-zh/discipline-network-research-website/blob/main/docs/migration-audit.md)
- [图表快照导出定义](https://github.com/ider-zh/discipline-network-research-website/blob/main/scripts/sync-series-snapshots.mjs)
- 本项目已归档的原文证据。目录路径快照和源文件 blob SHA 保存在 `data/output-catalog.json`。

## 展示与维护

`data/archive.json` 的 `outputs` 保存当前入口、项目归属、消息 ID、说明、范围限制及可确认的旧路径。项目页集中展示入口，时间线和证据抽屉按消息 ID 精确关联；文档同时匹配其归并版本的消息 ID。原始聊天地址和历史完成状态不改写。

全站搜索可直接查找图表。续研包只附上与该问题证据交集匹配的当前图表，并带上范围限制。

不要只按相近名称替换：新版 MAG/WM 度分布不替代 Wikipedia 度分布；MAG 平均引用年龄不替代引用半衰期；2026 OpenAlex Topics Tree 不替代历史 MAG 分类浏览器。原 3D 学科距离图对应当前二维距离图时，明确保留展示差异。

## 对应条目

| 当前图表 | 归档专题 | 历史出处 | 当前范围 |
| --- | --- | --- | --- |
| [Wikipedia 学科关系最小生成树](https://discipline-network-research.nikepai.com/charts/wikipedia-network) | Wikipedia 学科关系平台 | m00034, m00036, m04576 | 当前入口保留最小生成树展示，不等同于旧版全部年份、距离阈值和 3D 动画。 |
| [Wikipedia 学科文章数与增量](https://discipline-network-research.nikepai.com/charts/wikipedia-article-count) | Wikipedia 学科关系平台、Wikipedia 演化与知识增长 | m00362, m03599 | 本页对应文章规模统计；旧页面中的单篇长度和 dx 分析不在此入口中。 |
| [Wikipedia 小世界与网络联通统计](https://discipline-network-research.nikepai.com/charts/wikipedia-network-profile) | Wikipedia 学科关系平台 | m04941, m04994, m05047 | 当前页合并多个统计面板，年份与网络层次以页面选择器为准。 |
| [Wikipedia 度分布熵](https://discipline-network-research.nikepai.com/charts/wikipedia-degree-entropy) | 网络熵、复杂度与 KQI | m05562, m05564 | 保留度分布熵口径，不能与节点度概率定义的结构熵混用。 |
| [Wikipedia 结构熵与网络密度](https://discipline-network-research.nikepai.com/charts/wikipedia-structural-entropy) | 网络熵、复杂度与 KQI | m05207, m05208, m05267, m05273 | 图表为迁移后的历史快照；结构熵曲线不代表质量假说已获验证。 |
| [Wikipedia 总体演化与拟合统计](https://discipline-network-research.nikepai.com/charts/snapshots/wikipedia-global-evolution) | Wikipedia 演化与知识增长、Wikipedia 学科关系平台 | m00521, m03557, m04494, m05428, m06157 | 保留历史拟合与统计口径，不把预测当作后来年份的实际观测。 |
| [Wikipedia 文章长度分布](https://discipline-network-research.nikepai.com/charts/snapshots/wikipedia-article-length) | Wikipedia 演化与知识增长 | m05428, m06466, m06485 | 长度为字数口径；不是原始文件的字节大小。 |
| [Wikipedia 学科内部链接比例](https://discipline-network-research.nikepai.com/charts/snapshots/wikipedia-self-citation) | Wikipedia 学科关系平台 | m03336, m03337 | 对应历史讨论中的学科“自恋度”，不表示作者个人自引。 |
| [Wikipedia 学科有向距离](https://discipline-network-research.nikepai.com/charts/snapshots/wikipedia-directed-distance) | Wikipedia 学科关系平台 | m00848, m01547, m01552 | 当前快照仅保留 Biology 与四个学科的比较，不复现旧 Core v2 的全部网络规模与任意学科查询。 |
| [MAG 小世界网络统计](https://discipline-network-research.nikepai.com/charts/snapshots/mag-small-world) | 学科图谱与知识融通 | m00717, m01439, m01599, m02102 | 保留主要学科的导出快照；旧版四十年活跃窗口等组合以新页面实际提供的选择为准。 |
| [MAG 学科距离气泡图](https://discipline-network-research.nikepai.com/charts/snapshots/mag-distance-bubbles) | 学科图谱与知识融通 | m02802, m02808 | 保留历史快照；气泡大小表示文章数量，双轴表示与指定学科的距离。 |
| [MAG 学科距离网络](https://discipline-network-research.nikepai.com/charts/snapshots/mag-distance-network) | 学科图谱与知识融通 | m02802, m02895, m02898 | 旧版 3D 引力图转为二维网络，保留八个历史快照，不复现全部旧动画。 |
| [MAG / Wikipedia 学科依赖关系](https://discipline-network-research.nikepai.com/charts/snapshots/discipline-dependency) | 学科图谱与知识融通、Wikipedia 学科关系平台 | m02194, m02210, m02211, m02397 | 当前导出以 Biology 为中心；历史名称“因果图”不等同于因果识别。 |
| [MAG 颠覆度分位与引用流](https://discipline-network-research.nikepai.com/charts/mag-disruption-structure) | 颠覆度与重要性的检验 | m02470, m02544, m02548, m02550 | 展示历史指标与样本，不代表对颠覆度有效性的质疑已解决。 |
| [MAG 颠覆度年度趋势](https://discipline-network-research.nikepai.com/charts/snapshots/mag-disruption-trend) | 颠覆度与重要性的检验 | m03603, m03606, m03796, m04213 | 仅收录已核验的历史缓存组合，不支持把未恢复的查询组合当作零结果。 |
| [MAG 分学科网络熵](https://discipline-network-research.nikepai.com/charts/mag-subject-entropy) | 网络熵、复杂度与 KQI | m05564, m05744 | 历史快照覆盖 1900—2020 年；不同熵指标的定义以图表说明为准。 |
| [MAG 平均引用时间距离](https://discipline-network-research.nikepai.com/charts/snapshots/mag-reference-age-average) | 学科图谱与知识融通 | m05538, m05987, m05988 | 对应 linksout 的平均引用寿命，不是累计引用半衰期。 |
| [MAG 学科幂律指数](https://discipline-network-research.nikepai.com/charts/snapshots/mag-degree-exponent) | 学科图谱与知识融通 | m01439, m03260 | 与 Wiki 的 core 文章幂律不是同一数据集，不能互相替代。 |
| [MAG 分学科论文数量](https://discipline-network-research.nikepai.com/charts/snapshots/mag-article-totals) | 学科图谱与知识融通 | m03260 | 只对应 MAG 论文规模，不替代旧页面中的 Wikipedia 或 WM 数量。 |
| [MAG 头部论文内部引用比例](https://discipline-network-research.nikepai.com/charts/snapshots/mag-self-citation-ranking) | 学科图谱与知识融通 | m02397, m03260 | 迁移数据截至 2019 年；保留学科内部引用口径，不表示个人自引。 |
| [OpenAlex 点边与学科规模](https://discipline-network-research.nikepai.com/charts/openalex-node-edge) | 学科图谱与知识融通 | m07653 | 原记录为计算完成、尚待部署；当前入口补充展示，不改写当时完成状态。 |
| [OpenAlex 网络熵](https://discipline-network-research.nikepai.com/charts/openalex-entropy) | 网络熵、复杂度与 KQI、学科图谱与知识融通 | m07654, m09604, m09605 | 当前快照覆盖 1900—2022 年，不等同于全部后续 KQI 或高维熵实验。 |
| [WM 网络点边与增长统计](https://discipline-network-research.nikepai.com/charts/snapshots/wm-network-scale) | 颠覆度与重要性的检验 | m06611 | 仅对应 WM 统计；不以图表上线推断历史待计算项已在当时完成。 |
| [WM 分学科颠覆度](https://discipline-network-research.nikepai.com/charts/wm-disruption) | 颠覆度与重要性的检验 | m06611 | 沿用新平台 WM 数据口径，不将 WM、E1200 和完整 Web of Science 数据量视为相同集合。 |
| [MAG / WM 度分布](https://discipline-network-research.nikepai.com/charts/snapshots/degree-distributions) | 学科图谱与知识融通、颠覆度与重要性的检验 | m01439, m06611 | 本页不含 Wikipedia 度分布，不用于替代 Wikipedia 旧版 DegreeDistribution。 |
| [Wikipedia 引用学科与时间分布](https://discipline-network-research.nikepai.com/charts/snapshots/wikipedia-reference-patterns) | 颠覆度与重要性的检验、Wikipedia 演化与知识增长 | m06437, m06576 | 用于回看历史引用窗口和滞后分布，不将探索性拟合写为已确定规律。 |

## 验证

- 源码核对：26 个入口均存在于新平台的 42 项目录中；项目归属与消息 ID 均有效。
- 归档保护：与本次修改前比较，项目、时间线、问题、证据、文档摘要与原始图表数据完全一致。
- 渲染集成检查：10 个项目路由、17 个时间线节点、证据抽屉、图表搜索、1 组文档版本、9 份续研包通过；非目标域、脚本协议及带凭据的地址被拒绝。
- `npm run check`、`npm run build`、JavaScript 语法检查通过。
- 在线验证限制：本次直接请求新站返回 HTTP 403，浏览器连接检查超时；已核对源码路由，未声称所有线上图表均已加载成功。此次未完成新增入口的浏览器视觉复核。
