---
name: slide-forge
description: |
  用一份 YAML spec 同时生成可编辑 PPTX 与单文件 HTML 演示，并在生成前逐页做越界与文字溢出校验。适用于中文汇报场景下需要「一次产出两种交付物」「16:9 与 4:3 双版本」「把长 Markdown 报告批量拆成多页 Deck」，以及要求产物可被 CI 自动回归的场合。
description_en: |
  Compile one YAML spec into both an editable PPTX and a self-contained HTML deck, with pre-render bounds and text-overflow checks. Use it for Chinese business reporting when a task needs two deliverables from one source, 16:9 and 4:3 variants, batch conversion of long Markdown reports into multi-page decks, or outputs that CI can regression-test.
agent_created: true
license: MIT
---

# slide-forge 幻灯片工坊

把「内容 + 版式」编译成一份场景描述（文字、形状、图表、表格都带坐标），再由两个后端分别消费：PPTX 后端用 pptxgenjs 出原生可编辑图表与表格，HTML 后端出单文件离线演示。两端共享同一套版面模型，因此不会出现「网页好看、PPTX 崩版」。

内置 18 个版式、4 套主题，中英文按字符宽度测量并自动缩字号，生成前可用 `check` 做越界与溢出回归。

## 何时使用

在以下情形调用本 skill：

- 同一份内容要同时交付 PPTX 和网页演示
- 需要 16:9 与 4:3 两个画布版本，且改动只做一次
- 手上是一篇 Markdown / 纯文本长报告，要批量拆成 10 页以上的 Deck
- 汇报材料要纳入 CI，要求「输出不越界」有自动化回归门
- 需要页级演讲者备注写进 notesSlide，同时保留 HTML 演讲者视图

在以下情形改用内置的 `workbuddy-pptx`，不要用本 skill：

- 要克隆公司母版的版式与占位符（本工具只迁移配色与字体，`references/spec.md` 有明确边界）
- 需要对已有 .pptx 做局部改页、改标题
- 需要竖版、超宽或自由设计排版（本工具只支持 16:9 与 4:3）

## 前置检查

调用任何命令前先确认引擎可用，整个会话只做一次：

```bash
node -v                      # 需要 >= 20
ls "$SKILL_DIR/engine/bin/slideforge.js"
```

- `$SKILL_DIR` 取自本次加载 skill 时给出的 base directory。
- `engine/` 存在 → 直接用下文命令。
- `engine/` 不存在（从源码仓库直接使用）→ 在仓库根目录执行 `npm ci`，再把下文命令里的 `$SKILL_DIR/engine/bin/slideforge.js` 换成 `bin/slideforge.js`。
- Node 缺失时先安装，或回落 `npx --yes slide-forge`（需该包已发布）。

## 标准流程

1. **定内容**：先确定标题、章节骨架、每页要传达的那一句话。每页只放一个结论，结论写进 `takeaway`。
2. **出 spec**：新写用 `assets/deck-skeleton.yaml` 作骨架；已有 Markdown 报告用 `new --from` 自动拆页。
3. **校验**：`check` 必须全绿再往下走，不要靠肉眼。
4. **构建**：`build` 出 PPTX + HTML，需要双画布就跑两次。
5. **交付**：给出产物绝对路径，说明页数与版式分布；PPTX 建议用 `scripts/qa-render.ps1` 导 PNG 目检一次。

交付时说明这一点：图表是 **OOXML 原生可编辑图表**，在 PowerPoint / WPS 里正常，但部分轻量预览器（含应用内预览面板、在线预览）不渲染，会显示成空白。要确认效果，用 PowerPoint 打开或看同名的 HTML 版。

```bash
# 1) 从 Markdown 报告自动拆页（纯本地规则，不调模型）
node "$SKILL_DIR/engine/bin/slideforge.js" new "供应链数字化改造" --from report.md -o out/doc.deck.yaml

# 2) 校验：越界、文字溢出、spec 结构
node "$SKILL_DIR/engine/bin/slideforge.js" check out/doc.deck.yaml

# 3) 构建双画布
node "$SKILL_DIR/engine/bin/slideforge.js" build out/doc.deck.yaml
node "$SKILL_DIR/engine/bin/slideforge.js" build out/doc.deck.yaml --aspect 4:3

# 4) 套公司品牌色与中文字体
node "$SKILL_DIR/engine/bin/slideforge.js" template "品牌模板.pptx"
node "$SKILL_DIR/engine/bin/slideforge.js" build out/doc.deck.yaml --template "品牌模板.pptx"
```

## 最小 spec

```yaml
meta:
  title: 2026 Q3 经营复盘
  subtitle: 增长、效率与下一步
  author: 张三
  date: 2026-10-26
  aspect: "16:9"          # 或 "4:3"

theme:
  name: midnight-executive # midnight-executive / forest-moss / coral-energy / charcoal-minimal

output:
  dir: out
  speakerNotes: true

slides:
  - layout: cover
    kicker: 内部经营汇报
    title: 2026 Q3 经营复盘
    subtitle: 增长、效率与下一步

  - layout: kpi
    title: 三张关键数字
    items:
      - { value: "1.83亿", label: 季度营收, note: 环比 +9% }
      - { value: "42.6%", label: 同比增速, note: 超目标 6.2pt }
    takeaway: 收入达标，但毛利率连续两个季度下滑。
```

必填字段随 `layout` 而变，完整对照见 `references/layouts.md`；`meta` / `theme` / `output` / `chart` / `table` 的全字段与校验规则见 `references/spec.md`。

## 命令速查

| 命令 | 作用 |
|---|---|
| `build <spec>` | 生成 PPTX + HTML，`--no-html` / `--no-notes` 可裁剪 |
| `build <spec> --aspect 4:3` | 切画布，输出名自动加 `-4x3` |
| `build <spec> --template x.pptx` | 套模板配色与中文字体 |
| `build <spec> --pptx a.pptx --html b.html` | 指定产物路径 |
| `check <spec>` | 只校验不生成，越界与溢出问题在此暴露 |
| `new "<主题>"` | 出可编辑 spec 骨架，`--llm` 调模型写大纲 |
| `new "<主题>" --from doc.md` | Markdown 拆页，`--slides N` 限页数，`--no-notes` 关备注 |
| `themes` / `template <file>` | 列主题 / 读模板配色字体尺寸 |

`--llm` 读环境变量 `DEEPSEEK_API_KEY`，未设置时自动回落本地骨架，不中断。

## 硬规则

- 颜色写 6 位十六进制且**不带 `#`**。
- `chart.series[i].values` 的长度必须等于 `chart.labels` 的长度，否则 spec 校验直接失败。
- `chart.type` 只认 8 个值（`bar` `column` `line` `pie` `doughnut` `area` `scatter` `radar`），缺省为 `bar`；写 `funnel` 之类会报错并列出可用类型。用户要漏斗图、甘特图这类没有的形状时，**主动告知改用 `bar` 或 `process` 近似表达**，不要指望它兜住。
- **多系列折线图默认不显示逐点数值**（两条线数值接近时标签会重叠），需要时显式写 `chart.showValue: true`。
- `table.rows` 每一行的长度必须等于 `columns` 的长度。
- 页数不是越多越好：`bullets` 超过 4 条、`cards` 超过 6 张就拆页，自动缩字号只救小溢出，救不了信息过载。
- 卡片类版式（`compare` / `twoCol` / `team` / `cards`）的卡片高度是按内容区固定撑满的，**条目少于一屏时会留白**。每栏少于 3 条时补一条 `takeaway` 收底，或换用 `kpi` / `bullets`。
- 图片不会自动下载，`src` 必须是本地路径或 URL；无图时 `image` 版式画占位框，不会伪造内容。
- `new --from` 是规则抽取，不做语义纠错：口径混杂的句子会主动放弃出图，每章最多抽一张图，生成后需人工复核。
- YAML 会把 `2026-10-26` 解析成日期对象，工具已自动转回字符串，无需加引号。

## 排错

| 现象 | 原因 | 处理 |
|---|---|---|
| `未知 layout "xxx"` | 版式名拼错 | 从 `references/layouts.md` 的 18 个枚举里取 |
| `图表类型 "xxx" 不支持` | `chart.type` 不在 8 个枚举内 | 换成支持的近似形状，并告知用户这不是原形状 |
| `缺少必填字段` | 该版式的必需键缺失 | 对照 `references/layouts.md` 的必填列补齐 |
| `values 数量与 labels 不一致` | 图表数据行对不齐 | 逐条 series 补齐或截断到 labels 长度 |
| `第 N 行有 M 列` | 表格行列数不匹配 | 补空串或调整表头 |
| `check` 报越界 | 内容超出画布 | 拆页、减条目，或换 4:3 画布 |
| 中文变方块/回退字体 | 本机缺字体 | HTML 依赖本机字体，PPTX 指定 `微软雅黑` 等已装字体 |
| 预览里图表是空白，PowerPoint 打开正常 | 轻量预览器不渲染 OOXML 原生图表 | 不是文件问题。让用户用 PowerPoint 打开，或直接看 HTML 版 / 导出的 PNG |
| 套模板后版式没变 | 设计如此 | 只迁移配色与字体，版式级克隆不在范围内 |

## 参考

- `references/layouts.md` — 18 个版式的字段、必填项、适用场景
- `references/spec.md` — spec 全字段、主题覆盖、模板边界、画布规则
- `references/ingest.md` — Markdown 拆页规则与分页/版式指令
- `assets/deck-skeleton.yaml` — 可直接复制的最小骨架
