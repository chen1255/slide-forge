# 与 diagram-design 的功能对比与补齐记录

对标对象：[cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design)（61K stars，45 种视觉类型，自包含 HTML+SVG）

## 一、先澄清定位：两者不是同类产品

| | diagram-design | slide-forge |
|---|---|---|
| 产物 | **单张**图表/图示，HTML + SVG | **多页**幻灯片，PPTX + HTML |
| 生成方式 | 教 Agent **手写 SVG**，靠规范约束质量 | **程序化**生成，YAML spec → 元素 → 两种渲染器 |
| 可编辑性 | 输出的是最终图形，改内容要重画 | PPTX 里是原生文本/图表/表格，可继续编辑 |
| 形态规模 | 45 种图型，每种一份规范（references 760KB） | 18 种版式，版式逻辑写在 `src/layouts/*.js` |
| 核心价值 | 图表好不好看 | 整份 deck 的结构、排版与可编辑性 |

**结论：不该按它的形状追平。** 它强在「单图画得漂亮」，slide-forge 强在「整份 deck 一次成型且能在 PowerPoint 里改」。盲目追 45 种图型会把一个 deck 工具变成残缺的绘图工具。

真正该补的是**工程能力**：可读性校验、环境体检、不依赖 Office 的出图、品牌复用。这四项它做得比 slide-forge 扎实。

## 二、逐项对比

| 能力 | diagram-design | slide-forge 补齐前 | 处理 |
|---|---|---|---|
| 色彩可读性校验 | WCAG AA，不达标自动微调并标注 | ❌ 完全没有 | ✅ **已补齐** |
| 环境体检 | `doctor` 命令 | ❌ 没有 | ✅ **已补齐** |
| 不依赖 Office 出图 | PNG/SVG 导出脚本 | ⚠️ 只有 Photoshop COM 导 PNG | ✅ **已补齐 SVG** |
| 品牌复用 | profiles 持久化 + 首次门禁 | ⚠️ `--template` 一次性，每次要重带 | ✅ **已补齐 profile** |
| 无障碍 | `role=img` + `title`/`desc` + 独立 ID | ❌ 没有 | ✅ **已补齐** |
| 渐进披露 | 60 个 references，每图型一份 | ⚠️ 3 份，够用但偏薄 | 保持，原因见下 |
| 旧图重绘 | drawio / Mermaid / Excalidraw 导入 | ❌ 无 | ⏸ 不做，原因见下 |
| 动效 | reveal / step / loop，尊重减少动效 | ❌ PPTX 侧无 | ⏸ 不做 |
| 多平台插件清单 | Claude/Codex/Cursor/Qoder 各一份 | 只有 SKILL.md | ⏸ 不做 |
| 输出旋钮 | format×size×detail×audience 四档 | 只有 `--aspect` | ⏸ 部分不做 |

## 三、已补齐的四项

### 1. WCAG 对比度校验（`src/contrast.js`）

palette 允许任意覆盖，但此前浅灰字配白底不会有任何报错。现在 `check` 按 WCAG 2.1 相对亮度公式算**真实**对比度，覆盖 11 组版式里真实出现的前景/背景配对（内容页正文、标题、卡片、深色页、表格表头等）。

- 低于 3:1 → 直接判错，退出码 1（这种页面投影出来看不清）
- 3:1 到阈值之间 → 提示微调
- 留 0.1 工程容差，避免 4.47 对 4.5 这种无实际意义的报错

**顺带发现并修了内置主题的问题**：三套主题的 accent 在白色背景上只有 1.95 / 2.25 / 2.41，KPI 大数字其实偏淡。已按原色相压深到 3.03–3.44：

| 主题 | 原 accent | 新 accent | 对比度 |
|---|---|---|---|
| midnight-executive | E8B04B | B87F22 | 1.95 → 3.44 |
| forest-moss | D9A441 | B0861F | 2.25 → 3.35 |
| charcoal-minimal | C8A24A | A8873A | 2.41 → 3.39 |

### 2. 环境体检（`src/doctor.js`）

`slideforge doctor [spec]`。重点是把「跑起来才发现」的问题提前：Node 版本、依赖完整性、引擎文件、输出目录可写、能否导 PNG，以及**字体是否真的装了**。

字体判定分三档，因为这件事有真实的模糊地带：

- `✓ 已安装`：磁盘文件名直接命中（`msyh` → 微软雅黑）
- `· 疑似`：靠别名猜到的（`思源宋体 CN` → NotoSerifSC）。字体在，但 Office 按**家族名**查找，家族名可能不叫这个中文名，仍可能回退——所以不给「已安装」的安心感
- `× 未安装`：明确找不到，并给出建议（如「建议改用 Noto Sans SC」）

最后这档直接对应上一次实测踩到的坑：spec 里写「思源黑体 CN Bold」，本机只有 Noto Sans SC，渲染静默回退且 `check` 一字不提。

### 3. SVG 导出（`src/render-svg.js`）

`slideforge svg <spec>`，一页一张 `.svg`。解决两件事：轻量预览器不渲染 OOXML 图表；导 PNG 要装 PowerPoint。

图表部分**复用 render-html 的 SVG 片段**，保证 HTML 与 SVG 两条路图形一致；文字断行复用 `kit` 的测量模型，不另起一套。图片自动转 base64 内嵌，单个 svg 文件自包含。

### 4. 品牌 profile（`src/profile.js`）

```bash
slideforge profile save 客户A --template 客户A品牌.pptx
```

之后 spec 里写 `theme: 客户A` 即可，跨会话有效（存 `~/.slideforge/profiles/`）。名字先查内置主题，查不到再查 profile。profile 只存差异，缺的色槽回落默认主题，老 profile 不会因为后续新增色槽而崩。名称做了路径穿越校验。

### 5. 无障碍

SVG 输出带 `role="img"` + `aria-labelledby` + 非空 `<title>`/`<desc>`，ID 带页码避免多个 svg 内联时互相抢；HTML 每页 `<section>` 加 `role="group"` 和「第 N 页：标题」的 `aria-label`。

PPTX 侧本身天然可访问：文字是真文本、图表是原生对象，没有把文字栅格化成图片。

## 四、故意不补的三项

**旧图导入（drawio / Mermaid / Excalidraw）** —— 它的价值是「把你已有的图重画得更好看」。slide-forge 的输入是 deck 结构，解析这三种格式再映射到 18 个版式，做出来的效果大概率不如它原生重画。真要接，应该做成 `--from` 的 Markdown 通道增强，而不是抄它的格式清单。

**45 种图型** —— 版式在 slide-forge 里是**代码实现**（坐标、字号、分栏全算好），不是在文档里写规范。加一种图型 = 写一个 layout 模块 + 加字段校验 + 补测试，成本远高于它写一份 reference。而 deck 场景真正需要的图型不到它的三分之一。

**动效与多平台插件清单** —— PPTX 动效需要操作 OOXML 动画节点，风险高收益低；插件清单是分发问题，等有第二个平台需求再说。

## 五、验证结果

| 项目 | 结果 |
|---|---|
| 单元测试 | **38 / 38 通过**（补齐前 29，新增 9 条覆盖对比度、profile、SVG） |
| demo 校验 | 19 页，16:9 与 4:3 双画布均通过，配色对比度 11 项达标 |
| 构建 | PPTX + HTML 各 19 页正常 |
| SVG | 19 个文件，逐页 Chrome 截图目检通过（表格页曾因字段用错整体错位，已修） |
| 技能包 | 重新打包安装，`doctor` / `svg` / `profile` 在打包后的内嵌引擎里均可用 |
| CI | 新增对比度明细、SVG 页数与可访问性断言、体检三个步骤 |

## 六、还没做的，以及建议

- **18 个版式的像素级截图基线**：没有它就不敢动垂直居中和卡片留白（上次报告里记过这个结论）。建议下一步做，这是敢改版式的前提。
- **`detail` 旋钮**：目前「拆页规则」只写在 SKILL.md 里靠 Agent 自觉执行，没做成参数。做成 `--detail faithful|balanced|simplified` 会影响版式内部的条目上限，需要版式配合，不是纯 CLI 改动。
- **首次风格门禁**：它用「默认令牌 + 未定制」判定并强制询问。slide-forge 的默认主题本身是可用的成品，不像它那样默认皮肤必须换，所以没抄这个门禁，改为在 SKILL.md 里要求 Agent 主动问用户有没有品牌色。
