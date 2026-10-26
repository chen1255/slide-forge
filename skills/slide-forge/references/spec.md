# spec 全字段参考

spec 支持 YAML 与 JSON，按扩展名分派。

## 顶层结构

```yaml
meta:      # 演示元信息
theme:     # 主题名，或写 palette / fonts 覆盖
output:    # 产物路径与备注开关
slides:    # 页面数组，必填
```

## meta

| 字段 | 默认 | 说明 |
|---|---|---|
| `title` | `未命名演示` | 同时用于产物文件名（非法字符转 `-`） |
| `subtitle` | 空 | 封面副标题 |
| `author` | 空 | 署名 |
| `date` | 当天 | YAML 会解析成日期对象，工具已自动转回 `YYYY-MM-DD` |
| `language` | `zh-CN` | 设为 `en-US` 时主题字体整体切到 Arial |
| `aspect` | `16:9` | 只接受 `16:9` / `4:3`（`4x3` 等写法会归一） |

## theme

三种写法等价：

```yaml
theme: forest-moss
theme:
  name: forest-moss
theme:
  name: forest-moss
  palette: { accent: "D9A441" }
  fonts: { heading: 思源黑体, body: 思源宋体 }
  sizes: { title: 32, body: 13 }
```

内置四套：`midnight-executive`（午夜高管）、`forest-moss`（森林苔藓）、`coral-energy`（珊瑚活力）、`charcoal-minimal`（炭灰极简）。

`palette` 可覆盖的键，全部为 6 位十六进制、**不带 `#`**：

`bg` `bgDark` `primary` `secondary` `accent` `text` `muted` `line` `card` `onDark` `onDarkMuted`

`sizes` 可覆盖的键（默认值）：`display` 44、`title` 30、`section` 38、`subtitle` 16、`body` 14、`small` 11、`caption` 10、`kpi` 42。

## output

| 字段 | 默认 | 说明 |
|---|---|---|
| `dir` | `out` | 产物目录 |
| `pptx` | `<dir>/<title>.pptx` | 可用命令行 `--pptx` 覆盖 |
| `html` | `<dir>/<title>.html` | 可用命令行 `--html` 覆盖 |
| `speakerNotes` | `true` | 设 false 等价于命令行 `--no-notes` |

## 画布规则

宽度固定 10in，比例只改高度：16:9 = 10 × 5.625in，4:3 = 10 × 7.5in。横向坐标、列宽、字号完全不变，只有纵向重新分布——所以同一份 spec 换画布不会挤坏横向排版。

- 标题区固定在顶部，结论条与页脚贴底
- 正文区（要点、图表、表格行高、卡片、对比面板、图片框）随画布拉高
- `check` 使用当前画布边界做越界校验
- PPTX 分别用 `LAYOUT_16x9` / `LAYOUT_4x3`，HTML 画布 960×540 / 960×720

不支持竖版与超宽比例。

## chart

| 字段 | 说明 |
|---|---|
| `type` | `bar` `column` `line` `pie` `doughnut` `area` `scatter` `radar`；缺省为 `bar` |
| `labels` | 类目数组，必填非空 |
| `series` | `[{ name, values: [] }]`，必填非空 |
| `title` | 图表标题 |
| `showValue` | 是否逐点显示数值，见下 |

校验规则：

- 每条 `series[].values` 长度必须等于 `labels` 长度，否则报错。
- `type` 写了不支持的名称会**直接报错并列出可用类型**，不会静默降级成柱状图（早期版本会）。

数值标签的默认行为：

| 情况 | 默认 | 原因 |
|---|---|---|
| 单系列折线 / 面积图 | 显示数值 | 一条线不会互相压住 |
| **多系列折线 / 面积图** | **不显示数值** | 两条线数值接近时逐点标签会完全重叠糊成一团 |
| 柱状 / 散点 | 显示数值 | 柱体横向分开，不易撞 |

多条折线确实需要标注数值时，显式写 `showValue: true`，但要先确认两条线的数值差距足够大。

PPTX 侧生成原生可编辑图表（饼图带图例与多色扇区），HTML 侧生成内联 SVG。

`insight` 是页面级的右侧解读面板（字符串数组），不属于 `chart`，写在与 `chart` 同级。

## table

`columns` 为字符串数组，`rows` 为二维数组。每行长度必须等于表头列数。列宽按内容权重自动分配，不需要手写宽度。

## 模板套用边界

```bash
slideforge template "品牌模板.pptx"   # 先看模板里的颜色、字体、尺寸
slideforge build deck.yaml --template "品牌模板.pptx"
```

迁移：主题配色、中文字体、页面尺寸检测（并给出比例告警）。

**不迁移**：母版版式与占位符。套模板得到的是「品牌配色 + 本工具的版式」，不是「原模板第 3 页的样子」。版式级克隆需要直接改 `ppt/slides/slideN.xml` 与关系文件，不在本工具范围内。若用户的核心诉求是「必须和公司模板长得一模一样」，改用 `workbuddy-pptx`。

模板比例不会被强制套用：spec 或模板是 4:3 时，用 `--aspect 4:3` 输出。
