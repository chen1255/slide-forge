# 技能市场提交材料 · slide-forge

> 用途：填写 WorkBuddy 技能市场「提交技能」表单时逐项复制。带 ⬜ 的是需要你确认或手填的项。

## 一、基本信息

| 字段 | 内容 |
|---|---|
| 技能标识（name） | `slide-forge` |
| 显示名 | 幻灯片工坊 · slide-forge |
| 版本 | `0.1.2` |
| 许可证 | MIT |
| 源码仓库 | https://github.com/chen1255/slide-forge |
| npm 包 | https://www.npmjs.com/package/@jackc1234/slide-forge （`npx @jackc1234/slide-forge` 可直接跑） |
| 上传包 | `dist/slide-forge.zip`（2.1 MB，顶层目录 `slide-forge/`） |
| 运行依赖 | Node.js ≥ 20（引擎与依赖已内嵌，无需联网安装） |
| 支持平台 | Windows / macOS / Linux |
| ⬜ 分类 | 主推 **办公效率**；若无该级，备选「内容创作」「设计与演示」 |
| ⬜ 图标 | 未提供，建议用「深蓝底 + 金色细线 + 幻灯片叠层」的简洁图标，1024×1024 PNG |

## 二、一句话简介

> 一份 YAML 同时生成可编辑 PPTX 与单文件网页演示，生成前自动校验越界与文字溢出。

（39 字，可直接用于列表页副标题）

## 三、完整简介（可粘贴的 Markdown）

```markdown
面向中文汇报场景的演示生成器：把「内容 + 版式」编译成一份场景描述，再由两个后端各自消费，同一份 spec 同时产出**可编辑的 .pptx** 与**单文件 HTML 演示**，两端信息结构完全一致，不会出现「网页好看、PPTX 崩版」。

### 能力

- **18 个内置版式**：封面、目录、章节、要点、双栏、卡片、KPI、引文、图表、表格、时间线、流程、对比、团队、全幅图、截图、图片、结尾页
- **4 套主题**，支持 `palette` / `fonts` / `sizes` 覆盖，可从公司 `.pptx` 模板提取品牌配色与中文字体
- **中文感知排版**：按字符宽度测量文本，自动缩字号；生成前逐页校验越界与文字溢出
- **双画布**：同一份 spec 切换 16:9 / 4:3，只做纵向重排，横向排版不变
- **长文档拆页**：把 Markdown / 纯文本报告按规则拆成多页 spec，自动从管道表格与正文数值序列抽取图表数据，支持 `---` 分页、`<!-- layout: ... -->`、`<!-- notes: ... -->` 指令
- **PPTX 原生可编辑**：图表与表格在 PowerPoint 里可改数据、改样式；备注写入 notesSlide；HTML 侧带演讲者视图（`?pr=1`）
- **可回归**：`check` 只校验不生成，输出不越界这件事能进 CI

### 典型场景

1. 季度经营复盘要同时交 PPT 和网页版，不想做两遍
2. 一份内容要出 16:9 会场版和 4:3 打印版
3. 手上是 30 页的 Markdown 分析报告，要批量变成汇报 Deck
4. 汇报材料的「不崩版」需要自动化保证，而不是每次靠肉眼复核

### 使用方式

技能会在对话中被自动触发，也可以直接说：

> 用 slide-forge 把 `report.md` 做成 PPT，4:3 画布，套公司模板 `品牌模板.pptx`

### 明确的边界

- 只支持 16:9 与 4:3，不支持竖版与超宽比例
- 套模板只迁移配色与字体，**不克隆母版版式与占位符**
- 长文档拆页是规则抽取，不做语义纠错，生成后需人工复核
- 图片不自动下载，需在 spec 里给出本地路径或 URL
- HTML 输出依赖本机字体

### 隐私与网络

默认**全程本地**，不上传任何内容。唯一例外：用户显式使用 `--llm` 时，会调用用户自己配置的 DeepSeek 兼容接口（环境变量 `DEEPSEEK_API_KEY`）来生成大纲；未配置 key 时自动回落本地骨架，不报错、不联网。
```

## 四、触发词

主触发词（中文）：

```
做PPT  生成PPT  演示文稿  汇报材料  幻灯片  一份YAML出PPT  双画布PPT  4:3 转 16:9  Markdown 转 PPT  长文档拆页
```

主触发词（英文）：

```
make slides  generate pptx  html deck  yaml to pptx  markdown to deck  speaker notes  presenter view
```

主要触发短语（用于描述里加权重）：

```
把这份报告做成 PPT / 同时要 PPT 和网页版 / 出一版 4:3 / 套公司模板配色 / 校验 PPT 有没有文字溢出
```

## 五、标签

```
PPT  PPTX  幻灯片  演示文稿  汇报  YAML  Markdown  图表  双画布  版式  自动化  离线可用
```

英文标签：`pptx` `powerpoint` `presentation` `slides` `yaml` `markdown` `charts` `offline`

## 六、截图（3 张 + 备选）

建议上传顺序：**首图放图表页**，因为它一屏同时展示了「原生图表 + 右侧解读面板 + 底部结论条」，最能说明产品的信息密度控制能力。

| 顺序 | 路径 | 尺寸 | 建议配文 |
|---|---|---|---|
| 1（首图） | `docs/images/chart.png` | 2200×1238 | 原生可编辑图表 + 自动解读面板 + 一句话结论条 |
| 2 | `docs/images/kpi.png` | 2200×1238 | KPI 页：3–4 个大数字自动对齐，带口径注释 |
| 3 | `docs/images/process.png` | 2200×1238 | 流程页：步骤编号、标题与说明分层次排布 |

备选（想换风格时用）：

| 路径 | 尺寸 | 说明 |
|---|---|---|
| `docs/images/cover.png` | 2200×1238 | 封面页，品牌感最强，适合当缩略图 |
| `docs/images/chart-4x3.png` | 2200×1650 | 同一份 spec 的 4:3 版本，用来证明双画布能力 |

完整路径（在仓库根目录下）：

```
C:\Users\ROG魔霸新锐\WorkBuddy\2026-10-26-23-31-52\slide-forge\docs\images\chart.png
C:\Users\ROG魔霸新锐\WorkBuddy\2026-10-26-23-31-52\slide-forge\docs\images\kpi.png
C:\Users\ROG魔霸新锐\WorkBuddy\2026-10-26-23-31-52\slide-forge\docs\images\process.png
```

## 七、审核备注（填「其他说明」栏）

```
1. 与内置 workbuddy-pptx 的关系：不替代、不抢触发。内置技能负责「套母版版式、改已有 .pptx、自由排版」，本技能负责「一份 spec 出 PPTX + HTML 双产物、双画布、长文档批量拆页、越界校验可进 CI」。SKILL.md 里已写明这条边界，触发描述也做了区分。

2. 自包含：技能包内嵌了引擎（bin + src + 生产依赖），解压即可离线运行，不在用户机器上执行 npm install、不写全局目录。

3. 可验证性：仓库 CI 在 Node 20 / 22 双版本跑 38 个单元测试，包含解包 PPTX 后断言页数、sldSz 画布尺寸、封面标题入 slide XML、饼图图例与多色扇区、备注写入 notesSlide、多系列折线默认不标数值、未知图表类型报错、WCAG 对比度判定、SVG 断行与无障碍属性；另有两个画布的 check 与四份产物构建。技能包本身也有「在空目录用内嵌引擎跑通」这一步，npm 包另在全新目录装线上版本验证过。

4. 文件写入：只在用户指定的输出目录（默认 out/）生成 .pptx / .html / .yaml，不改动其他文件。
```

## 八、提交前 checklist

已核验：

- [x] `SKILL.md` 存在，frontmatter 含 `name`（hyphen-case）/ `description` / `description_en` / `agent_created: true`
- [x] 官方 `quick_validate.py` 返回 `Skill is valid!`
- [x] 官方 `package_skill.py` 打包通过
- [x] 技能包解到空目录后，用内嵌引擎跑 `check` + `build` 能产出 6 页 PPTX 与 HTML
- [x] `description` 不含尖括号
- [x] 目录结构符合 `SKILL.md` + `references/` + `assets/` + `scripts/`
- [x] `SKILL.md` 正文约 1400 字（4000 字符），远低于 5k words 上限，细节已下沉到 references

待你确认：

- [ ] 分类选哪个（主推「办公效率」）
- [ ] 是否要做一个 1024×1024 图标
- [ ] 是否把本次改动 push 到 `chen1255/slide-forge` 的 main
