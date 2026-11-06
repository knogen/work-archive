# 待续研究整改实施记录

实施日期：2026-11-06。依据 [逐项复核与整改方案](research-backlog-review.md)，已完成原 38 条的全部整改：P0 10/10、P1 19/19、P2 9/9。原入口均保留，没有以删除旧页面的方式掩盖混组。

## 当前结构

原 38 个混合议题重整为 68 个可独立验收的记录：**44 个研究问题、16 项数据/方法核验、5 项工程/产品验收、3 项成果/技术材料核验**。这不是新增工作成果或未解决问题数量的增长，而是将不同验收对象分别记录。

默认 [待续研究](https://work-archive.knogen.com/#/questions?kind=research) 只列研究；[关联核验](https://work-archive.knogen.com/#/questions?kind=tasks) 单独列任务。可以按具体类型、专题、关键词筛选；这些状态保存在 URL 中。首页与导航只统计研究，专题内研究与核验分别列出，全站搜索可找到两者。

每项记录有独立状态、最近明确讨论、最后实质进展、材料日期、后续验收条件和关联事项。排序使用最近明确讨论；上传材料不自动更新研究日期。仅提出尚未执行、旧结果待复现、已有进展待验证、待核验分别展示。

研究资料包只带本问题的直接证据。混合消息按精确原文片段摘录，保留完整消息入口；关联任务另列，不把专利、产品交付或旁支讨论塞回主研究上下文。原文、文档摘要、附件和当前图表入口均保留。

## 关键落地结果

- 本体迁移原 ID 保留研究质量目标，日期为 2023-03-13；产品范围核验独立记录至 03-30，技术交底核验独立记录至 04-06。迁移主问不再使用专利初检或授权状态作为研究依据。
- 数学子学科剔除记录 2019-09-04 已有答复及 2026-04-28 重提，状态为旧结果待复现；未确认关联的图片不作为进展。时间线与研究页双向关联。
- KQI fragment 主问截至 2025-06-20；07-17 为材料日期。节点复制检查与 K=2 等价证明草稿复核独立关联，已有证明报告作为阶段结果保留。
- GPC 相似度有效性、词序、token 匹配口径分别归属；知识复杂性的迭代、FOS 计量和奖项权重分别验收。
- WoS 样本恢复与创新假说、软件复用模型与文件分布及调用图核验分离；科学迁徙保留一个核验组，用三节区分科学家、书籍、图书馆的分母与位置含义。
- OneCulture 稿件和 SPECint 口径分别转成果/数据核验；缺失推导稿仅作依赖，不新增纯“丢失文档”页面。

## 原 38 个入口的去向

| 原入口 | 当前事项（独立状态与验收） |
| --- | --- |
| 学者关系网络怎样保证名单纯净且各学科可比？ · `wiki-research-platform-q1` | [人物名单中的非人物条目与学科归属是否已核验？](https://work-archive.knogen.com/#/question/wiki-research-platform-q1)（数据与方法核验）<br>[人物距离的跨学科比较对名单规模是否稳健？](https://work-archive.knogen.com/#/question/wiki-research-platform-q1-sample-stability)（研究验证） |
| Google知识距离应该按node还是edge、linksin还是linksout计算？ · `wiki-research-platform-q2` | [知识距离的节点集合、边集合及其交集应怎样定义？](https://work-archive.knogen.com/#/question/wiki-research-platform-q2)（研究验证）<br>[固定距离定义后，入链与出链为何产生不同的学科聚合顺序？](https://work-archive.knogen.com/#/question/wiki-research-platform-q2-link-direction)（研究验证） |
| 2011/2013 BerkeleyDB与其他年份的边数据是否可比？ · `wiki-core-consistency-q1` | [2011/2013 Wikipedia引用边能否恢复并通过跨版本一致性核验？](https://work-archive.knogen.com/#/question/wiki-core-consistency-q1)（数据与方法核验） |
| Core和封闭学术圈怎样避免学科外词条扰动？ · `wiki-core-consistency-q2` | [封闭学术圈中工程与哲学距离偏近，由哪些词条和分类路径贡献？](https://work-archive.knogen.com/#/question/wiki-core-consistency-q2)（研究验证） |
| 为什么学科间信息距离变远，而学术圈内部最短路径较稳定或缩短？ · `academic-distance-q1` | [同一学术圈中，知识距离与拓扑路径为何可以呈不同时间趋势？](https://work-archive.knogen.com/#/question/academic-distance-q1)（研究验证） |
| Wiki/MAG幂律指数应该在哪个区间估计？ · `academic-distance-q2` | [Wiki/MAG度分布的尾部区间与γ应怎样稳健估计？](https://work-archive.knogen.com/#/question/academic-distance-q2)（研究验证） |
| MAG与Wikipedia为什么呈现不同的幂律和学科聚合趋势？ · `mag-science-mapping-q1` | [固定统计口径后，MAG与Wikipedia幂律时间趋势为何不同？](https://work-archive.knogen.com/#/question/mag-science-mapping-q1)（研究验证）<br>[MAG与Wikipedia学科聚合阈值的时间趋势为何不同？](https://work-archive.knogen.com/#/question/mag-science-mapping-q1-coupling-trend)（研究验证） |
| MAG数据中的错年、缺引用、重复记录怎样影响网络测量？ · `mag-science-mapping-q2` | [MAG重复记录、缺失引用和错年引用是否通过统一数据核验？](https://work-archive.knogen.com/#/question/mag-science-mapping-q2)（数据与方法核验） |
| 学科小世界与活跃期的定义如何解释高路径长度和工程低自引？ · `mag-science-mapping-q3` | [MAG小世界指标对历史排名和引用时间窗怎样变化？](https://work-archive.knogen.com/#/question/mag-science-mapping-q3)（研究验证）<br>[工程子学科的低自引比例与较长路径由什么造成？](https://work-archive.knogen.com/#/question/mag-science-mapping-q3-engineering-self-citation)（研究验证） |
| 论文主结论是否已有足够证据和可重复的图表？ · `one-two-many-cultures-paper-q1` | [OneCulture文稿最终版本、发表状态及图表复现材料是否可核验？](https://work-archive.knogen.com/#/question/one-two-many-cultures-paper-q1)（成果与技术材料核验） |
| 跨数据库学科树的结构差异能否可靠量化？ · `knowledge-consilience-q1` | [固定节点对齐与过滤后，Wikipedia和MAG学科群落差异怎样量化？](https://work-archive.knogen.com/#/question/knowledge-consilience-q1)（研究验证）<br>[两棵带权知识树的结构相似度怎样定义并验证？](https://work-archive.knogen.com/#/question/knowledge-consilience-q1-weighted-tree-similarity)（研究验证） |
| OpenAlex学科首次出现年份及2000年后类数不变如何修正？ · `knowledge-consilience-q2` | [OpenAlex以最早收录论文推断学科年代，可靠边界是什么？](https://work-archive.knogen.com/#/question/knowledge-consilience-q2)（研究验证） |
| 去掉代数、几何、分析或拓扑后，数学与物理的距离如何变化？ · `knowledge-consilience-q3` | [复现2019剔除数学子学科实验：数学—物理距离变化是否稳健？](https://work-archive.knogen.com/#/question/knowledge-consilience-q3)（研究验证） |
| D、CD5与实际创新影响力的偏差来自指标，还是引文数据缺失？ · `disruption-wm-q1` | [数据缺失与指标限制分别怎样影响 D/CD5 对成果重要性的判断？](https://work-archive.knogen.com/#/question/disruption-wm-q1)（研究验证）<br>[D/CD5 个案的论文身份与引文是否核对一致？](https://work-archive.knogen.com/#/question/disruption-wm-q1-citation-audit)（数据与方法核验） |
| 为什么WM与同样规模高被引集合重叠仍只有约16.8%？ · `disruption-wm-q2` | [同规模百科收录集合与高被引集合为何只部分重叠？](https://work-archive.knogen.com/#/question/disruption-wm-q2)（研究验证）<br>[16.8% 与后续 E102/C102 结果分别对应哪些集合版本？](https://work-archive.knogen.com/#/question/disruption-wm-q2-collection-audit)（数据与方法核验） |
| Wiki引用但未匹配MAG的论文有多少，近期下降是否由漏匹配造成？ · `disruption-wm-q3` | [近期 WM 数量下降有多少来自漏匹配、数据库覆盖或引用滞后？](https://work-archive.knogen.com/#/question/disruption-wm-q3)（研究验证）<br>[Wikipedia 学术引文候选中未匹配 MAG 的比例有多大？](https://work-archive.knogen.com/#/question/disruption-wm-q3-unmatched-audit)（数据与方法核验） |
| WM增长的xlnx、线性和多项式解释是否稳定？ · `disruption-wm-q4` | [WM 按引入时间的增长模型及发表年代队列解释能否复现？](https://work-archive.knogen.com/#/question/disruption-wm-q4)（研究验证） |
| D/CD5集中在0的机制能否严格解释？ · `disruption-index-q1` | [逐论文的 k/(i+j) 关系能否解释 D/CD5 的近零集中？](https://work-archive.knogen.com/#/question/disruption-index-q1)（研究验证）<br>[保度且保年份随机化后，D/CD5 分布与平均趋势怎样变化？](https://work-archive.knogen.com/#/question/disruption-index-q1-randomization)（研究验证） |
| WoS对照和跨学科创新假设如何继续？ · `disruption-index-q2` | [跨学科性与创新性的关系能否独立于引用影响力检验？](https://work-archive.knogen.com/#/question/disruption-index-q2)（研究验证）<br>[WoS Top10000 的论文清单与筛选口径能否恢复？](https://work-archive.knogen.com/#/question/disruption-index-q2-wos-recovery)（数据与方法核验） |
| GPC距离约束是否能稳定完成类比推理？ · `gpc-distance-q1` | [GPC 四边形距离约束能否可靠回答类比题？](https://work-archive.knogen.com/#/question/gpc-distance-q1)（研究验证）<br>[多边形及父子类替换后的距离约束如何定义和验证？](https://work-archive.knogen.com/#/question/gpc-distance-q1-polygon-extension)（研究验证）<br>[ku2ku 类比查询原型已实现哪些输入输出和性能范围？](https://work-archive.knogen.com/#/question/gpc-distance-q1-query-audit)（工程与产品验收） |
| GPC能否替代向量数据库的具体能力？ · `gpc-distance-q2` | [预计算 GPC 能否满足指定近邻检索任务？](https://work-archive.knogen.com/#/question/gpc-distance-q2)（研究验证）<br>[GPC 检索服务与目标向量数据库的功能差距有哪些？](https://work-archive.knogen.com/#/question/gpc-distance-q2-capability-audit)（工程与产品验收） |
| GPC文本相似度在独立数据上的有效性与词序如何处理？ · `gpc-text-similarity-q1` | [GPC 文本相似度在独立人工语义基准上是否有效？](https://work-archive.knogen.com/#/question/gpc-text-similarity-q1)（研究验证）<br>[GPC 能否区分词序、语义角色与否定造成的意义变化？](https://work-archive.knogen.com/#/question/gpc-text-similarity-q1-word-order)（研究验证）<br>[长短 token 重叠时的匹配规则是否一致且可复算？](https://work-archive.knogen.com/#/question/gpc-text-similarity-q1-token-matching)（数据与方法核验） |
| 知识复杂性如何避免迭代退化并稳定解释稀缺性？ · `knowledge-complexity-q1` | [国家—学科知识复杂性迭代为何收敛为相同值？](https://work-archive.knogen.com/#/question/knowledge-complexity-q1)（研究验证）<br>[多 FOS 论文如何计入国家—学科贡献量？](https://work-archive.knogen.com/#/question/knowledge-complexity-q1-fos-allocation)（数据与方法核验）<br>[奖项—学科网络中二值 RCA 与加权关系分别测量什么？](https://work-archive.knogen.com/#/question/knowledge-complexity-q1-award-weighting)（研究验证）<br>[国家专利复杂度演示的矩阵与迭代结果是否可复算？](https://work-archive.knogen.com/#/question/knowledge-complexity-q1-patent-audit)（数据与方法核验） |
| 知识复杂性是否领先经济复杂性及GDP？ · `knowledge-complexity-q2` | [知识复杂性是否提供经济复杂性变化的领先信息？](https://work-archive.knogen.com/#/question/knowledge-complexity-q2)（研究验证）<br>[加入知识复杂性后能否改善 GDP 增长预测？](https://work-archive.knogen.com/#/question/knowledge-complexity-q2-gdp-prediction)（研究验证） |
| 如何解释MAG与Wiki不同熵的方向，是否真由边比点增长更快造成？ · `network-entropy-q1` | [边数相对节点数的增长能否解释度分布熵的变化？](https://work-archive.knogen.com/#/question/network-entropy-q1)（研究验证）<br>[统一定义后，MAG 与 Wiki 的度熵及度分布熵趋势能否复算？](https://work-archive.knogen.com/#/question/network-entropy-q1-trend-audit)（数据与方法核验） |
| 能否从Wiki增长模型推出结构熵或有效直径的公式？ · `network-entropy-q2` | [Wiki 增长模型的度分布熵候选推导是否成立？](https://work-archive.knogen.com/#/question/network-entropy-q2)（研究验证）<br>[指定 Wiki 模型的节点度熵及归一化度熵能否推导？](https://work-archive.knogen.com/#/question/network-entropy-q2-node-degree)（研究验证）<br>[指定增长模型能否解释 Wiki 有效直径维持在较小范围？](https://work-archive.knogen.com/#/question/network-entropy-q2-effective-diameter)（研究验证） |
| 距离复杂度替换结构熵的定义是否成立？ · `network-entropy-kqi-q1` | [语义距离构造的复杂度能否继承结构熵性质？](https://work-archive.knogen.com/#/question/network-entropy-kqi-q1)（研究验证） |
| KQI编码树、交叉节点片段与出入度应怎样计算？ · `network-entropy-kqi-q2` | [高效 KQI 的 fragment、度数与体积如何一致计算？](https://work-archive.knogen.com/#/question/network-entropy-kqi-q2)（研究验证）<br>[多学科节点复制与结构熵重算是否正确？](https://work-archive.knogen.com/#/question/network-entropy-kqi-q2-node-copy-audit)（数据与方法核验）<br>[K=2 时 HT 与 H2 的等价证明草稿如何复核？](https://work-archive.knogen.com/#/question/network-entropy-kqi-q2-k2-proof-audit)（成果与技术材料核验） |
| 层次聚类能否恢复Wiki或MAG分类树？ · `network-entropy-kqi-q3` | [层次聚类所得树与 Wiki/MAG 分类结构有多一致？](https://work-archive.knogen.com/#/question/network-entropy-kqi-q3)（研究验证） |
| 增长拟合的经验效果能否得到一致的机制解释？ · `wiki-evolution-q1` | [知识增长拟合、派生比值与时间口径能否保持一致？](https://work-archive.knogen.com/#/question/wiki-evolution-q1)（研究验证） |
| 文章长度是否服从对数正态分布，早期与成熟期是否不同？ · `wiki-evolution-q2` | [文章长度是否服从对数正态分布，年代差异如何检验？](https://work-archive.knogen.com/#/question/wiki-evolution-q2)（研究验证） |
| Koomey外推何时达到Landauer极限，量纲和外推是否可靠？ · `computing-growth-q1` | [明确量纲与擦除假设后，Koomey 外推和 Landauer 下限如何比较？](https://work-archive.knogen.com/#/question/computing-growth-q1)（研究验证） |
| SPECint与多核性能比较应如何界定？ · `computing-growth-q2` | [所用 SPECint 数据与多核比较的口径是否匹配？](https://work-archive.knogen.com/#/question/computing-growth-q2)（数据与方法核验） |
| 为什么不同语料的压缩结果近线性，怎样证明代码更难压缩？ · `software-compression-q1` | [跨语料可压缩性的规模关系与差异能否复现？](https://work-archive.knogen.com/#/question/software-compression-q1)（研究验证）<br>[压缩耗时随规模和输入结构的关系是否复现？](https://work-archive.knogen.com/#/question/software-compression-q1-runtime-audit)（工程与产品验收） |
| 软件复用理论与程序调用层次如何量化？ · `software-compression-q2` | [软件复用与调用层次能否形成可测量的复杂度模型？](https://work-archive.knogen.com/#/question/software-compression-q2)（研究验证）<br>[项目文件大小分布是否更符合 λ-幂律？](https://work-archive.knogen.com/#/question/software-compression-q2-file-size-distribution)（研究验证）<br>[宏、多架构与同名头文件下的调用图是否准确？](https://work-archive.knogen.com/#/question/software-compression-q2-call-graph-audit)（工程与产品验收） |
| 如何减少地图样本偏倚并区分缺失与真实迁徙？ · `science-migration-q1` | [科学家、书籍和图书馆地图的样本覆盖与位置含义如何核验？](https://work-archive.knogen.com/#/question/science-migration-q1)（数据与方法核验） |
| 科研资助如何关联到论文、专利和真实创新成果？ · `science-funding-q1` | [NSF 项目负责人如何跨库关联论文、专利与公司？](https://work-archive.knogen.com/#/question/science-funding-q1)（数据与方法核验）<br>[OpenKG 人物能否可靠匹配学术作者？](https://work-archive.knogen.com/#/question/science-funding-q1-entity-resolution)（数据与方法核验） |
| 本体迁移的覆盖率、准确率和产品完成范围？ · `metapedia-ontology-q1` | [英文分类向无本体百科迁移的质量如何验证？](https://work-archive.knogen.com/#/question/metapedia-ontology-q1)（研究验证）<br>[百科树浏览和共同父类查询完成到什么范围？](https://work-archive.knogen.com/#/question/metapedia-ontology-q1-product-audit)（工程与产品验收）<br>[本体方案的技术步骤与初检差异说明是否补齐？](https://work-archive.knogen.com/#/question/metapedia-ontology-q1-technical-disclosure)（成果与技术材料核验） |

## 验证范围

- 归档校验：68 个 ID 唯一，38 个旧 ID 与全部迁移去向存在；证据、关联和时间线链接均有效，精确片段与原文一致，日期不超出导出范围。
- 渲染集成：全部旧入口和 68 个详情页、事项类型/专题/关键词组合、倒序、刷新参数恢复、重置、项目内列表、搜索、资料包换行与引用范围通过。
- 浏览器：本地桌面与 390px 窄屏检查；本体在研究筛选中只有质量主问，在核验筛选中为两项关联任务；核验详情、最近讨论日期、手机筛选与阅读无横向溢出。临时视口在完成后恢复。
- 静态构建与 JavaScript 语法检查通过。部署发布验证以仓库提交及线上返回的数据为准，不以本地预览冒充线上发布。

维护时在 `data/archive.json` 更新事项；`kind` 决定计数和默认视图，`relatedIds` 只表达关联，不共享结论或进展日期。`backlogReview` 保留本轮 38 条迁移映射。
