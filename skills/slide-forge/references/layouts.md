# 18 个内置版式

`layout` 必填，取下列枚举之一。写错会直接抛错并列出全部可用值。

通用可选字段（每个版式都认）：

- `takeaway` — 页面底部一句话结论条，有空间时会压缩正文区
- `notes` — 写进 PPTX 的 notesSlide 与 HTML 的 `data-notes`
- `title` — 标题，除 `quote` / `image` / `screenshot` 外均建议给

## 结构类

| layout | 必填 | 可选 | 说明 |
|---|---|---|---|
| `cover` | `title` | `kicker` `subtitle` `author` `date` | 封面：小标签 + 大标题 + 副标题 + 署名 |
| `section` | `title` | `number` `note` | 章节隔断：大编号 + 章节标题，`note` 为标题下的一行说明 |
| `toc` | `items` | `title` | 目录：双栏编号列表 |
| `end` | — | `title` `note` `contact` | 结尾页，`contact` 为字符串数组 |

```yaml
- layout: toc
  title: 本次汇报结构
  items:
    - { title: 核心指标, note: 三张关键曲线 }
    - { title: 渠道结构, note: 直营与分销的剪刀差 }
```

## 内容类

| layout | 必填 | 可选 | 条目结构 |
|---|---|---|---|
| `bullets` | `items` | `title` | `{ text, note }`，`note` 为二级注释；超过 4 条考虑拆页 |
| `twoCol` | `left` | `title` `right` | 左为 `{ text, note }` 数组，右为 `{ title, items: [字符串] }` |
| `cards` | `items` | `title` | `{ tag, title, body }`，2×3 网格，最多 6 张 |
| `kpi` | `items` | `title` | `{ value, label, note }`，3–4 个大数字最稳 |
| `quote` | `quote` | `attribution` | 引文原文与出处 |

```yaml
- layout: twoCol
  title: 渠道结构：剪刀差在扩大
  left:
    - { text: 直营：营收占比 58%，环比 +2% }
  right:
    title: 这意味着什么
    items:
      - 增长来自低毛利渠道
```

## 数据类

| layout | 必填 | 可选 | 说明 |
|---|---|---|---|
| `chart` | `chart` | `title` `insight` `takeaway` | `chart: { type, labels, series, title }`，`insight` 是右侧解读面板的字符串数组 |
| `table` | `columns` `rows` | `title` | 列宽按内容权重自动分配 |
| `timeline` | `items` | `title` | `{ when, title, body }` |
| `process` | `steps` | `title` | `{ title, body }`，3–4 步 |
| `compare` | `before` `after` | `title` | 各为 `{ title, items: [字符串] }` |

```yaml
- layout: chart
  title: 季度营收
  chart:
    type: bar            # bar / line / pie / doughnut / area / scatter
    labels: [Q1, Q2, Q3, Q4E]
    series:
      - { name: 营收（千万）, values: [12.4, 16.8, 18.3, 20.5] }
  insight:
    - Q4 预测 2.05 亿，依赖华南复制
```

硬约束：每条 `series[].values` 的长度必须等于 `labels` 的长度；`table.rows` 每行长度必须等于 `columns` 长度。

## 特殊类

| layout | 必填 | 可选 | 说明 |
|---|---|---|---|
| `team` | `members` | `title` | `{ name, role, bio }` |
| `hero` | `title` | `subtitle` `src` | 全幅图标题页，无 `src` 时画背景占位框 |
| `screenshot` | — | `title` `src` `caption` `alt` | 带浏览器窗口框的截图说明页 |
| `image` | — | `title` `src` `caption` `alt` | 普通图片页，无 `src` 时画占位框，不伪造内容 |

`src` 接受本地路径或 URL，工具不会自动下载远程图片。

## 选型建议

| 内容形态 | 选 layout |
|---|---|
| 3–4 个关键数字 | `kpi` |
| 有序列数据、要让人看见趋势 | `chart` + `insight` |
| 两个方案 / 改造前后对比 | `compare` |
| 有先后顺序的步骤 | `process` |
| 有时间点 | `timeline` |
| 互不相关的并列要点 | `cards`（短句）或 `bullets`（长句） |
| 需要一句金句收束 | `quote` |
