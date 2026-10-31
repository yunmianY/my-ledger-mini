# 记账小程序 · 开发规划

> 版本 v1（自用/体验版）｜数据全部落在本地，不依赖后端。
> 工程基线：微信小程序 + Skyline 渲染器 + glass-easel + 自定义导航栏，appid `wxd3902de6df376e31`。

---

## 1. 目标与范围

一个「打开 3 秒记一笔、月底能看清钱去哪了」的个人记账工具。

**一期（v1）范围内**

| 模块 | 内容 |
| --- | --- |
| 快速记账 | 金额、分类、日期、备注，自定义数字键盘，一屏完成 |
| 流水 | 按日/月分组、搜索、编辑、删除（软删）、左滑操作 |
| 统计 | 月度收支总览、分类占比、近 12 个月趋势 |
| 预算 | 月度总预算 + 分类预算，进度条与 80%/100% 提醒 |
| 多账本 | 日常/旅行/人情等账本切换，账本内独立分类与预算 |
| 记账人 | 单笔记账人字段，按人筛选与汇总 |
| 自定义分类 | 增删改分类、emoji 图标、排序、支出/收入分流 |
| 导出备份 | 导出 CSV / JSON 到文件并分享；从 JSON 文本导入恢复 |

**明确不做（v1 之外）**：云同步、多端登录、多人协作、账单自动导入（微信/支付宝）、周期性账单、汇率、Web 端。

**设计原则**：本地优先、离线可用、单次记账 ≤ 3 次点击、金额零浮点误差、数据可导出不锁死。

---

## 2. 技术基线

- **运行时**：基础库 3.x，Skyline 渲染 + glass-easel（模板已启用，`defaultDisplayBlock: true`）。
- **导航**：`navigationStyle: custom`，复用已有 `components/navigation-bar`，需配合 `wx.getWindowInfo()` 处理状态栏/胶囊安全区。
- **存储**：`wx.setStorageSync` 封装成 store 层，带内存缓存 + 写穿 + 版本迁移；总量上限 10MB（约 5 万条流水，自用足够）。
- **依赖**：v1 不引入任何 npm 包（不装图表库、不装状态库），减少构建复杂度。
- **图表**：不用 canvas，全部用 view + flex 手绘（柱状图/横向占比条）。Skyline 对 canvas 支持有版本差异，这是 v1 唯一主动规避的风险点。
- **图标**：全部使用 emoji（🍜🚇🛍️…）+ 文字，不产出图片资源，包体最小。

> ⚠️ 当前会话的 shell 起不来（`pwsh` 退出码 `0xC0000142`，DLL 初始化失败），无法执行命令。写代码不受影响，但**编译预览、lint、真机验证都必须在微信开发者工具里做**。

---

## 3. 信息架构

自定义 tabBar（文字 + emoji，不用 png 图标）：

```
明细(index) │ 统计(stats) │ 我的(mine)
```

页面清单：

| 页面 | 路径 | 职责 |
| --- | --- | --- |
| 明细 | `pages/index/index` | 月度/日分组流水、顶部收支概览、悬浮「+」 |
| 记一笔 | `pages/record/record` | 新增/编辑，复用同一页（带 `id` 参数即编辑） |
| 统计 | `pages/stats/stats` | 月份切换、分类占比、年度趋势 |
| 我的 | `pages/mine/mine` | 账本、分类、预算、导出入口、关于 |
| 账本管理 | `pages/books/books` | 新建/重命名/归档/切换 |
| 分类管理 | `pages/categories/categories` | 分类增删改排序 |
| 预算设置 | `pages/budget/budget` | 月度总额与分类预算 |
| 导出备份 | `pages/export/export` | CSV/JSON 导出、JSON 导入 |

交互约定：记录页与设置类页面用 `navigateTo`；底部弹层（`sheet` 组件）用于账单操作、分类快选，避免频繁跳页。

---

## 4. 数据模型

金额一律用**整数分（cents）**，杜绝 `0.1 + 0.2` 类误差；展示层再除 100 格式化。日期用 `YYYY-MM-DD` 字符串（可直接排序、可直接当月分区键）。

```js
// settings —— 存 key: 'acc:meta'
{ version: 1, activeBookId: 'bk_default', currency: 'CNY', weekStart: 1, theme: 'light' }

// books —— key: 'acc:books'
{ id, name, emoji, color, members: ['我'], archived: false, createdAt, order }

// categories —— key: 'acc:cats'
{ id, bookId, name, emoji, type: 'expense' | 'income', color, order, builtin: false }

// transactions —— 按月分片 key: 'acc:txns:2026-10'
{ id, bookId, type, amountCents, categoryId, date: '2026-10-30',
  note, member, createdAt, updatedAt, deleted: false }

// 月份索引 —— key: 'acc:txnMonths' → ['2026-09', '2026-10']
// 预算 —— key: 'acc:budgets'
{ '2026-10': { bookId: 'bk_default', totalCents: 500000, byCategory: { c_food: 150000 } } }
```

**分层理由**：流水按月分片，首页/统计只读当前需要的月份，避免全量反序列化；`deleted` 软删 + 可撤销；`builtin` 分类不可删只能改名/排序，防止历史数据变孤儿。

**内置分类（种子数据）**
支出：餐饮🍜 交通🚇 购物🛍️ 居住🏠 娱乐🎮 医疗💊 学习📚 人情🎁 其他📌
收入：工资💰 奖金🏆 兼职💻 理财📈 红包🧧 其他📌

---

## 5. 存储层设计（`utils/store.js`）

```
读：内存缓存 → 命中直接返回 → 未命中读 storage 并回填
写：更新缓存 → 立即写穿 storage → 抛事件让页面刷新
```

对外只暴露语义化 API，页面不直接碰 storage：

```js
listTxns({ bookId, month }), getTxn(id), addTxn(payload), updateTxn(id, patch), removeTxn(id)
monthSummary({ bookId, month })            // { expense, income, balance }
categoryStats({ bookId, month, type })     // [{ categoryId, cents, ratio }]
yearTrend({ bookId, year })                // 12 个月收支数组
getBudget({ bookId, month }), setBudget(...)
listBooks() / addBook() / updateBook() / archiveBook()
listCategories({ bookId, type }) / addCategory() / updateCategory() / removeCategory()
exportAll() / importAll(json)
```

附带要求：
- `version` 字段驱动迁移函数数组，后续加字段不炸老数据。
- `id` 生成用 `时间戳base36 + 随机`，不依赖后端。
- 所有写入 try/catch，配额超限（10MB）给出明确提示并引导导出。

---

## 6. 视觉与设计规范

| 项 | 取值 |
| --- | --- |
| 背景 | `#F7F7F5` 纸感浅灰 |
| 卡片 | `#FFFFFF`，圆角 24rpx，阴影 `0 2rpx 12rpx rgba(0,0,0,.04)` |
| 主文字 | `#1A1A1A` / 次文字 `#8A8A8A` |
| 支出色 | `#E4572E` 赤陶 |
| 收入色 | `#2A9D8F` 青绿 |
| 强调色 | `#F4A261` 沙金（按钮、选中态） |
| 危险色 | `#D64545` |
| 间距 | 8 的倍数（8/16/24/32rpx） |
| 金额字号 | 首屏概览 64rpx / 列表 34rpx，`font-weight: 600` |

全部写进 `app.wxss` 的 CSS 变量（`--c-bg` 等），组件内只用 `var()`，后续换肤只改一处。

**Skyline 注意事项（需真机确认）**
- 滚动容器必须 `<scroll-view type="list">`，单纯 `scroll-y` 在 Skyline 下行为不同；列表项不要嵌套滚动。
- 避免 `position: fixed`，底部键盘/悬浮按钮用页面根节点 flex 布局定位。
- 避免 `*`、属性选择器、复杂后代选择器；只用 class + flex。
- `conic-gradient` / `filter` / `backdrop-filter` 不要依赖，图表用 view 拼。

---

## 7. 分阶段路线

每个阶段结束都要在开发者工具里跑通，并按验收标准自查。

### 阶段 0 · 骨架（0.5 天）
- [ ] `app.json` 注册 tabBar；建 `custom-tab-bar` 组件
- [ ] `app.wxss` 落地主题变量、安全区、通用卡片/按钮/空态样式
- [ ] `utils/store.js` + `money.js` + `date.js` + 种子数据初始化（首次启动写入默认账本与分类）
- [ ] 四个主页面空壳 + 路由互通

**验收**：点击三个 tab 能切页，首次启动不掉错，storage 里能看到 `acc:*` 数据。

### 阶段 1 · 记账闭环（2 天）★核心
- [ ] `amount-keyboard` 自定义数字键盘（两位小数、退格、千分位、禁用非法输入）
- [ ] `record` 页：金额 → 分类 → 日期 → 备注 → 保存，编辑态回填
- [ ] `index` 页：月度概览卡、按日分组的流水、悬浮 +、下拉/上拉加载更多
- [ ] 长按/左滑流水 → 编辑 / 删除（软删 + 撤销 toast）
- [ ] 空态引导

**验收**：连续记 20 笔不同分类与日期，列表分组正确、合计与手算一致、杀掉小程序重进数据还在。

### 阶段 2 · 统计（1.5 天）
- [ ] `stats` 页：月份切换器、收支总览、分类占比横向条、近 12 月柱状趋势
- [ ] `ratio-bar` / `bar-chart` 两个纯 view 图表组件（动画：宽度/高度过渡）
- [ ] 年份切换、点击分类跳到该分类流水

**验收**：随机造 3 个月数据，占比之和 100%（允许 0.1% 舍入误差），趋势柱高比例正确。

### 阶段 3 · 预算（1 天）
- [ ] `budget` 页：月度总预算 + 分类预算输入
- [ ] 统计页与首页展示预算进度，80% 提示、100% 警示
- [ ] 超支分类高亮；跨月自动沿用上月预算（可开关）

**验收**：预算 5000，花 4000 时进度 80%、颜色变黄；超支时变红且文案正确。

### 阶段 4 · 多账本与自定义分类（1.5 天）
- [ ] `books` 页：新建/重命名/排序/归档/切换，切换后全局生效
- [ ] `categories` 页：支出/收入分栏、emoji 选择器、排序、删除（有关联流水时二次确认）
- [ ] 记账人：`mine` 里维护成员列表，记录页可选，明细页可按人筛选

**验收**：新建「旅行」账本记 3 笔，切回「日常」看不到这 3 笔；删掉一个已用分类时给出拦截提示。

### 阶段 5 · 导出备份与打磨（1.5 天）
- [ ] CSV 导出（`wx.getFileSystemManager().writeFile` 到 `USER_DATA_PATH` + `wx.shareFileMessage`）
- [ ] JSON 全量导出/导入（导入前校验 `version` 与结构，支持覆盖/合并）
- [ ] 明细搜索、月份快跳、深色模式跟随系统
- [ ] 整体走查：空态、超长文本、大金额、时间边界（跨月 0 点记账）

**验收**：导出 CSV 用 Excel 打开中文不乱码、金额与 App 内一致；清空数据后导入 JSON 完全还原。

---

## 8. 目标文件结构

```
app.js / app.json / app.wxss
custom-tab-bar/index.{js,json,wxml,wxss}
components/
  navigation-bar/    已有
  amount-keyboard/   数字键盘
  sheet/             底部弹层
  txn-item/          单条流水
  category-picker/   分类网格选择
  bar-chart/         柱状趋势图（view）
  ratio-bar/         占比条（view）
  empty-state/       空态
pages/
  index/  record/  stats/  mine/
  books/  categories/  budget/  export/
utils/
  store.js  model.js  money.js  date.js  seed.js
```

---

## 9. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| Skyline CSS 子集限制 | 样式写不出来/图表画不了 | 只用 flex + class 选择器；图表纯 view；每阶段真机验证，卡住就评估切回 webview 渲染 |
| 本地 10MB 上限 | 长期使用写满 | 按月分片 + 导出引导 + 写满时明确报错而非静默失败 |
| 换机/清缓存丢数据 | 数据不可恢复 | 把「备份」做成显眼入口，导入前提示；v2 再上云同步 |
| 自定义键盘输入法兼容 | 金额输错 | 键盘完全自绘，不依赖原生 input 聚焦；`type="digit"` 仅作兜底 |
| 无 shell、无自动化 | 回归靠手点 | 阶段验收清单逐条手测；关键路径（金额换算、月份汇总）补纯函数单测，后续接 jest |

---

## 10. 需要你拍板的 3 件事

1. **渲染器**：保留 Skyline（性能好、默认配置）还是切回 webview（CSS 自由度高、图表好画）？我建议**先保留 Skyline**，阶段 2 做图表时如果受阻再切——切换成本只是改 `app.json` 两行。
2. **记账人**：是「给自己记，不需要人字段」还是「家庭共用一台手机、要区分谁花的」？后者我会把成员做成必备字段并加筛选 tab。
3. **预算粒度**：只做「月度总预算」，还是「总预算 + 分类预算」都要？后者工作量 +0.5 天，但超支归因清晰得多。

确认后我按阶段 0 → 1 开始落地，优先把「能记上一笔」的闭环跑通。
