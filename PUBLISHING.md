# 发布到 npm

本文档记录 `slide-forge` 发布到 npm 的完整流程。发布是公开且基本不可撤回的动作，每一步都先验证再执行。

## 一、发布前检查（都可自动完成）

```bash
npm test                                  # 38 个单元测试
npm pack --dry-run                        # 看包内容与体积，确认没有误带 dist/ 或 .smoke/
npm view slide-forge version              # 404 表示包名可用；有版本号说明已被占用
```

三条都要过。`npm view` 若返回 404 是**好事**，表示名称未被占用。

## 二、需要人工确认的三件事

1. **`author` 字段**：当前是 `chen1255`。想改成真实姓名或邮箱，改 `package.json` 后重新提交。
2. **版本号**：`0.1.2` 会以 `latest` 标签发布，`npx slide-forge` 直接拿到它。首版也可以从 `0.1.0` 开始。
3. **README 渲染**：npm 页面会把 README 渲染出来，但**不解析相对路径的图片**。所有图片必须是绝对 URL（当前已用 `raw.githubusercontent.com`）。

## 三、登录

```bash
npm login
```

浏览器会打开授权页，登录后在终端确认。凭据存到 `~/.npmrc`，只留在本机。

也可用 automation token（适合 CI）：

```bash
npm config set //registry.npmjs.org/:_authToken=<token>
```

发布完成后建议撤销该 token。

## 四、发布

```bash
npm publish
```

然后打 tag，让 GitHub 上的版本与 npm 对齐：

```bash
git tag v0.1.2
git push origin v0.1.2
```

## 五、发布后验证（必做）

```bash
# 全新目录，验证包能被真实安装和使用
mkdir /tmp/verify && cd /tmp/verify && npm init -y
npm i slide-forge
npx slide-forge themes
npx slide-forge build <(curl -s https://raw.githubusercontent.com/chen1255/slide-forge/main/examples/demo.deck.yaml)
```

再打开 <https://www.npmjs.com/package/slide-forge> 检查：README 的四张截图是否正常显示、命令示例是否可点。

## 六、已知的坑

| 坑 | 说明 |
|---|---|
| `files` 白名单漏文件 | 只有显式列出的路径会进包。`qa-render.ps1` 曾漏过一轮，导致 `doctor` 提示的脚本在装包后找不到 |
| 相对路径图片 | npm 页面不渲染，必须绝对 URL |
| 版本不可复用 | 同一个版本号永远不能重发。发错了只能 `npm unpublish`（72 小时内、且无依赖方可）再升版本重发 |
| 0.x 也用 latest | `0.1.2` 会覆盖 `latest` 标签，不会因为是小版本就隔离 |
| 技能包与 npm 包是两件事 | `npm run pack:skill` 产出内嵌引擎的 zip 给技能市场；`npm publish` 产出靠 dependencies 安装的包。两者 `files` 规则不同，改一个别忘另一个 |

## 七、发版节奏

改动合并进 `main` 后，按语义化版本升 `package.json` 的 `version`，再走一遍上面流程。技能市场的 zip 用 `npm run pack:skill` 重新生成，与 npm 版本号保持一致。
