# slide-forge · 幻灯片工坊

一份 YAML，同时产出**可编辑的 .pptx** 和**单文件 HTML 演示**。

面向中文汇报场景：18 个内置版式、自动测量文字宽度并按框缩字号、生成前做越界与溢出校验。

```bash
slideforge build examples/demo.deck.yaml
# PPTX → out/2026-Q3-经营复盘.pptx
# HTML → out/2026-Q3-经营复盘.html
```

![demo](examples/preview.png)

---

## 为什么是「一份 spec 两个后端」

大多数工具要么只出 PPTX（设计受限），要么只出网页（不能在 PowerPoint 里改）。
slide-forge 把「内容 + 版式」编译成一份**场景描述**（文字/形状/图表/表格都带坐标），再由两个后端各自消费：

- **PPTX 后端**：pptxgenjs，生成原生可编辑的图表与表格
- **HTML 后端**：绝对定位 + 内联 SVG，单文件、可离线、支持键盘翻页与打印

所以两端的**信息结构完全一致**，不会出现「网页好看、PPTX 崩版」。

---

## 安装

需要 Node.js 18+。

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

脚本会自动定位 Node（兼容 PATH 里没有的绿色版）、安装依赖、校验并生成示例。
只装依赖不生成示例：`.\install.ps1 -SkipDemo`。

手动安装：

```bash
npm install
node bin/slideforge.js build examples/demo.deck.yaml
```

---

## 命令

| 命令 | 作用 |
|---|---|
| `slideforge build <spec>` | 生成 PPTX + HTML；`--no-html` 只出 PPTX |
| `slideforge build <spec> --aspect 4:3` | 改画布比例（`16:9` 默认 / `4:3`），输出文件名自动加 `-4x3` |
| `slideforge build <spec> --template brand.pptx` | 套用模板的品牌色与字体 |
| `slideforge check <spec>` | 校验 spec 与版面（越界、文字溢出），不生成文件 |
| `slideforge themes` | 列出内置主题 |
| `slideforge template <file>` | 查看模板的配色、字体、尺寸与版式 |
| `slideforge new "<主题>"` | 生成可编辑的 spec 骨架 |
| `slideforge new "<主题>" --llm` | 调 DeepSeek 写完整大纲（需 `DEEPSEEK_API_KEY`） |
| `slideforge new "<主题>" --from doc.md` | 把 Markdown 文档拆成页面 |

> `--llm` 使用环境变量 `DEEPSEEK_API_KEY`；不设 key 时自动退回本地骨架，不会报错中断。
> 也可以设置 `DEEPSEEK_API_URL` / `DEEPSEEK_MODEL` 指向其他兼容接口。

---

## spec 长什么样

```yaml
meta:
  title: 2026 Q3 经营复盘
  subtitle: 增长、效率与下一步
  author: 张三
  date: 2026-10-26
  language: zh-CN
  aspect: "16:9"              # 或 "4:3"；命令行 --aspect 可覆盖

theme:
  name: midnight-executive   # 或写 palette / fonts 覆盖

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

  - layout: chart
    title: 季度营收
    chart:
      type: bar
      labels: [Q1, Q2, Q3, Q4E]
      series:
        - { name: 营收, values: [12.4, 16.8, 18.3, 20.5] }
    insight:
      - Q4 预测 2.05 亿，依赖华南复制
```

字段约定：

- `layout` 必填，取下面 18 个之一
- `takeaway` 可选，出现在页面底部的一句话结论条（有空间控制效果）
- `notes` 可选，写进 PPTX 演讲者备注
- 颜色一律写 6 位十六进制、**不带 `#`**
- YAML 里 `2026-10-26` 会被解析成日期对象，工具已自动转回字符串

---

## 画布比例（16:9 / 4:3）

宽度固定 10in，比例只改高度：**16:9 = 10 × 5.625in，4:3 = 10 × 7.5in**。因此所有横向坐标、列宽、字号不受影响，只有纵向重新分布：

- 标题区固定在顶部，结论条与页脚贴底
- 正文区（要点、图表、表格行高、卡片、对比面板、图片框）随画布拉高
- 18 个版式全部按同一套规则适配，`check` 会使用当前画布的边界做越界校验
- PPTX 分别用 `LAYOUT_16x9` / `LAYOUT_4x3`；HTML 画布 960×540 / 960×720

切换方式二选一：

```bash
slideforge build my.deck.yaml --aspect 4:3     # 临时切换，输出文件名加 -4x3
```

```yaml
meta:
  aspect: "4:3"                                 # 写进 spec，长期生效
```

---

## 18 个内置版式

| 类别 | layout | 用途 |
|---|---|---|
| 结构 | `cover` | 封面：kicker + 大标题 + 副标题 + 署名 |
| 结构 | `section` | 章节页：大编号 + 章节标题 |
| 结构 | `toc` | 目录：双栏编号列表 |
| 结构 | `end` | 结尾：谢谢 + 联系方式 |
| 内容 | `bullets` | 要点页：自动缩字号、支持二级注释 |
| 内容 | `twoCol` | 左要点 + 右卡片解读 |
| 内容 | `cards` | 2×3 卡片网格 |
| 内容 | `kpi` | 3-4 个大数字 + 注释 |
| 内容 | `quote` | 引文页 |
| 内容 | `image` | 图片页（无图时画占位框，不伪造内容） |
| 数据 | `chart` | 原生图表 + 右侧「解读」面板 |
| 数据 | `table` | 表格，列宽按内容权重自动分配 |
| 数据 | `timeline` | 横向时间线 |
| 数据 | `process` | 3-4 步流程 |
| 数据 | `compare` | 前后 / 方案 A-B 对比 |
| 特殊 | `team` | 团队介绍 |
| 特殊 | `hero` | 全幅图标题页 |
| 特殊 | `screenshot` | 带浏览器窗口框的截图说明页 |

图表类型：`bar` / `line` / `pie` / `doughnut` / `area` / `scatter`。

内置主题：`midnight-executive`、`forest-moss`、`coral-energy`、`charcoal-minimal`。

---

## 长文档拆页（`new --from`）

把一篇 Markdown / 纯文本报告直接拆成多页 spec，全程本地规则、不调模型：

```bash
slideforge new "供应链数字化改造" --from examples/sample-report.md -o out/doc.deck.yaml
# spec → out/doc.deck.yaml
# 生成 12 页（从 Markdown 拆页（examples/sample-report.md））
# 版式分布：cover×1 toc×1 bullets×3 section×1 chart×2 process×1 timeline×1 compare×1 end×1
```

支持的扩展名：`.md` / `.markdown` / `.txt` / `.text`。

拆页规则：

- 文档的第一个 H1 是整篇标题，只用来取封面标题与副标题，**不进目录、不做章节**；它下面的引言段落单独成「背景」页
- 其余章节（带 `#` 的标题；文档完全没有 `#` 时也认「一、」「1. 」这类中文序号）各成一章；一章展开 ≥ 2 页时自动插章节隔断页
- 每章第一页带 `speaker notes`，取自该章原文（去掉表格符号、超长截断）；`--no-notes` 可关掉
- `--author "张三"` 写封面署名，`--slides N` 改页数上限（默认 24）；超限时先砍隔断页，再从尾部截断并保留结尾页

图表数据抽取：

- **Markdown 管道表格**：第一列当类目，任一列全是数值就能出图；类目多为年份 → `line`，百分比合计 ≈ 100% → `pie`，否则 `bar`
- **正文数值序列**：「华东 34%，华南 26%，华北 21%，西南 12%，其他 7%」这种，要求**同一句内 ≥ 3 个数值对**；跨行拼接时必须单位一致，否则宁可不出图
- 图表右侧「解读」用该章前 3 条要点，剩下的要点才另起文字页，避免同一句话在相邻两页重复

形态判断（决定用哪种版式）：出现「现状 / 目标」→ `compare`；出现「首先 / 其次 / 然后 / 最后」→ `process`；≥ 3 处日期 → `timeline`；短句列表 → `cards`；其余 `bullets`。

> 这是**规则抽取**，不做语义纠错：口径混杂的句子会被主动放弃出图，图表也只取一个数值列。生成后请按需手工调整。


---

## 套用公司模板

```bash
slideforge template "品牌模板.pptx"          # 先看模板里有哪些颜色和字体
slideforge build my.deck.yaml --template "品牌模板.pptx"
```

当前版本会迁移：**主题配色、中文字体、页面尺寸检测**，并给出比例告警。

明确的限制：**不克隆母版的版式与占位符**。也就是说，套模板后出来的是「品牌配色 + 你的版式」，不是「原模板的第 3 页长什么样」。要做版式级克隆，需要直接改 `ppt/slides/slideN.xml` 与关系文件，属于单独的进阶通道，当前版本未包含。

另外，模板尺寸会提示比例差异。如果你的 spec 或模板是 4:3，用 `--aspect 4:3` 输出即可；模板本身的比例不会被强制套用。

---

## 质量校验

```bash
node bin/slideforge.js check my.deck.yaml
```

逐页构建场景后检查：

- 元素是否越出当前画布（16:9 为 10 × 5.625 in，4:3 为 10 × 7.5 in）
- 文字按字号与框宽估算的行高，是否超出文本框
- spec 结构：必填字段、图表 labels/values 数量、表格列数与表头是否一致

生成后还可以用本机 PowerPoint 逐页导出 PNG 目检：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\qa-render.ps1 -Pptx out\demo.pptx -Out out\png
```

### 持续集成

[.github/workflows/ci.yml](.github/workflows/ci.yml) 在 push 到 `main` 与提 PR 时跑：Node 20 / 22 双版本、`npm ci`、单元测试、两种画布的 `check`、生成 4 个产物并确认非空，最后把 demo 的 PPTX 与 HTML 作为 artifact 上传。

单元测试除了版面校验，还会解包生成的 PPTX 做断言：页数与 spec 一致、`sldSz` 的宽高符合 16:9 / 4:3、封面标题进了 slide XML、饼图带图例与多色扇区、备注写入 notesSlide。这样无需 PowerPoint 也能在 Linux CI 上守住产物结构。

「输出不越界」这个约束因此有了自动化回归门，不必每次靠肉眼复核。

---

## 目录结构

```
bin/slideforge.js      CLI
src/spec.js            YAML 解析、规范化、结构校验
src/theme.js           主题与字号阶梯
src/kit.js             版面常量、中英文宽度测量、自动缩字号
src/layouts/           18 个版式（只产出场景描述）
src/render-pptx.js     场景 → PPTX
src/render-html.js     场景 → 单文件 HTML（含内联 SVG 图表）
src/template.js        模板配色/字体提取
src/outline.js         主题 / 文档 → spec 草稿（拆页、选版式）
src/extract.js         文档结构化抽取（切章、表格、数值序列、形态判断）
scripts/validate.js    版面校验
scripts/qa-render.ps1  PPTX → PNG 目检
.github/workflows/ci.yml  CI：测试 + 双画布校验 + 产物构建
```

---

## 已知边界

- 只支持 16:9 与 4:3 两种画布；竖版、超宽等其他比例未适配
- 4:3 的纵向适配是「按内容区拉伸」，不重排版式结构：一页内容很少时（如 KPI）下半页仍会留白
- 模板只迁移配色与字体，不克隆母版版式
- `new --from` 是纯规则拆页：不做语义改写，每章最多抽一张图，口径不统一的数字会主动跳过
- 图片不会自动下载，需在 spec 里给出本地路径或 URL
- HTML 输出的字体依赖本机字体（中文默认微软雅黑，缺失时回退系统字体）

---

## English

**slide-forge** turns one YAML spec into both an editable PowerPoint deck and a self-contained HTML presentation, sharing a single layout model so the two outputs never diverge.

- 18 built-in layouts, 4 themes, Chinese-aware text measurement with automatic font shrinking
- 16:9 and 4:3 canvases from the same spec (`meta.aspect` or `--aspect 4:3`), with vertical re-flow only
- Native, editable charts and tables in PPTX; inline SVG charts in HTML
- `new --from report.md` splits a long Markdown/text report into a full multi-page spec, extracting chart data from pipe tables and numeric sentences
- Brand extraction from `.pptx` / `.potx` (colors, East-Asian fonts, slide size) — layout cloning is out of scope in this version
- Spec validation for out-of-bounds elements and text overflow before rendering

```bash
npm install
node bin/slideforge.js build examples/demo.deck.yaml --template brand.pptx
node bin/slideforge.js new "Q3 business review" --llm   # needs DEEPSEEK_API_KEY
```

MIT licensed.

---

## License

MIT
