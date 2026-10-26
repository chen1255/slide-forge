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
  palette: { accent: "B0861F" }
  fonts: { heading: 思源黑体, body: 思源宋体 }
  sizes: { title: 32, body: 13 }
```

内置四套：`midnight-executive`（午夜高管）、`forest-moss`（森林苔藓）、`coral-energy`（珊瑚活力）、`charcoal-minimal`（炭灰极简）。

`name` 除了内置主题，还可以写**已保存的 profile 名**（`~/.slideforge/profiles/*.json`）。解析顺序是先查内置主题，查不到再查 profile；两者都没有才报错，报错信息里会列出可用的 profile。

```bash
slideforge profile save 客户A --template 客户A品牌.pptx   # 从模板提取配色字体
slideforge profile save 客户A --from 上一版.yaml          # 从已有 spec 提取
slideforge profile list                                   # 看已存的
```

profile 只存差异，缺的色槽回落到默认主题，老 profile 不会因为新增色槽而崩。

`palette` 可覆盖的键，全部为 6 位十六进制、**不带 `#`**：

`bg` `bgDark` `primary` `secondary` `accent` `text` `muted` `line` `card` `onDark` `onDarkMuted`

`sizes` 可覆盖的键（默认值）：`display` 44、`title` 30、`section` 38、`subtitle` 16、`body` 14、`small` 11、`caption` 10、`kpi` 42。

### 画风可控边界

用户说「换个画风」时，先分清他要改的是哪一层，否则会承诺做不到的事：

| 层 | 能不能改 | 怎么改 |
|---|---|---|
| 配色 | ✅ 完整可控 | `palette` 11 个色槽，或整体换内置主题 |
| 字体 | ✅ 完整可控 | `fonts.heading` / `fonts.body` |
| 字号 | ✅ 可控，但需自控幅度 | `sizes` 八级阶梯 |
| 画布比例 | ✅ | `meta.aspect`，仅 16:9 / 4:3 |
| 套用公司模板 | ✅ 只迁配色与字体 | `build --template <pptx/potx>` |
| 版式结构 | ❌ 不可改 | 18 个内置版式写死在 `src/layouts/*.js`，无自定义版式通道 |
| 圆角、间距、留白、装饰元素 | ❌ 不可改 | 全部硬编码在版式源码里 |

所以「换画风」的真实含义是**换配色与字体**，不是换版式。暖色极简、深色商务、杂志感这些可以通过 palette + 字体 + 字号做到；但「把卡片改成通栏」「去掉封面那个圆环」「改成三栏不等宽」做不到，这属于改版式，要动源码。

两个必须提醒用户的坑：

- **字体名写错或本机没装会静默回退**。PPTX 里只记字体名，播放器按自己系统里的字体渲染；写「思源黑体 CN」但机器上只有 `Noto Sans SC`，就会掉回默认黑体，且 `check` 不报错。给用户前先确认字体已安装，或直接写系统里确实存在的名字。
- **调大 `sizes` 没有越界保护**。正文有 `fitFont` 自动缩字号兜底，但标题放大会撞上封面的装饰圆环、章节页的色块，`check` 只看文本是否出画布，不看你是否压到了装饰元素。`display` 超过 60、`title` 超过 36 时务必导 PNG 目检。

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
