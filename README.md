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

## 套用公司模板

```bash
slideforge template "品牌模板.pptx"          # 先看模板里有哪些颜色和字体
slideforge build my.deck.yaml --template "品牌模板.pptx"
```

当前版本会迁移：**主题配色、中文字体、页面尺寸检测**，并给出比例告警。

明确的限制：**不克隆母版的版式与占位符**。也就是说，套模板后出来的是「品牌配色 + 你的版式」，不是「原模板的第 3 页长什么样」。要做版式级克隆，需要直接改 `ppt/slides/slideN.xml` 与关系文件，属于单独的进阶通道，当前版本未包含。

另外，内置版式按 16:9 设计；4:3 模板会提示比例差异，但不会强制改变画布。

---

## 质量校验

```bash
node bin/slideforge.js check my.deck.yaml
```

逐页构建场景后检查：

- 元素是否越出 10 × 5.625 in 画布
- 文字按字号与框宽估算的行高，是否超出文本框
- spec 结构：必填字段、图表 labels/values 数量、表格列数与表头是否一致

生成后还可以用本机 PowerPoint 逐页导出 PNG 目检：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\qa-render.ps1 -Pptx out\demo.pptx -Out out\png
```

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
src/outline.js         主题 / Markdown → spec 草稿
scripts/validate.js    版面校验
scripts/qa-render.ps1  PPTX → PNG 目检
```

---

## 已知边界

- 只支持 16:9 画布；4:3 与其他比例未适配
- 模板只迁移配色与字体，不克隆母版版式
- 图片不会自动下载，需在 spec 里给出本地路径或 URL
- HTML 输出的字体依赖本机字体（中文默认微软雅黑，缺失时回退系统字体）

---

## English

**slide-forge** turns one YAML spec into both an editable PowerPoint deck and a self-contained HTML presentation, sharing a single layout model so the two outputs never diverge.

- 18 built-in layouts, 4 themes, Chinese-aware text measurement with automatic font shrinking
- Native, editable charts and tables in PPTX; inline SVG charts in HTML
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
