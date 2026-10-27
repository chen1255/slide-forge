#!/usr/bin/env python3
"""把 dist/slide-forge 打成两种上传结构，放进 dist/submit/。

技能市场对压缩包结构的要求不统一，两种都留着，上传口要哪种给哪种：

- slide-forge-<ver>.zip        带外层目录，解压后是 slide-forge/SKILL.md
                               适合本地安装、以及按「一个包一个目录」收录的口子
- slide-forge-<ver>-flat.zip   SKILL.md 直接在包根目录
                               适合要求「包里第一层就是 SKILL.md」的口子

用法（先跑 npm run pack:skill 生成 dist/slide-forge）：
  python scripts/make-zips.py
"""

from __future__ import annotations

import json
import os
import re
import shutil
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "dist", "slide-forge")
OUT_DIR = os.path.join(ROOT, "dist", "submit")


def version() -> str:
    with open(os.path.join(ROOT, "package.json"), encoding="utf-8") as fh:
        return json.load(fh)["version"]


def zip_tree(root: str, arc_prefix: str, target: str) -> tuple[int, float]:
    n = 0
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for base, _dirs, files in os.walk(root):
            for name in files:
                full = os.path.join(base, name)
                rel = os.path.relpath(full, root).replace(os.sep, "/")
                z.write(full, f"{arc_prefix}{rel}")
                n += 1
    return n, os.path.getsize(target) / 1048576


def main() -> int:
    if not os.path.isdir(SRC):
        raise SystemExit("dist/slide-forge 不存在，先运行 node scripts/pack-skill.js")
    if not os.path.exists(os.path.join(SRC, "SKILL.md")):
        raise SystemExit("dist/slide-forge/SKILL.md 缺失，包不完整")

    os.makedirs(OUT_DIR, exist_ok=True)
    ver = version()
    stem = f"slide-forge-{ver}"

    # 带外层目录
    wrapped = os.path.join(OUT_DIR, f"{stem}.zip")
    n1, mb1 = zip_tree(SRC, "slide-forge/", wrapped)
    print(f"  {os.path.basename(wrapped):34s} {n1:4d} 文件  {mb1:4.1f} MB  （含外层目录）")

    # SKILL.md 在根
    flat = os.path.join(OUT_DIR, f"{stem}-flat.zip")
    n2, mb2 = zip_tree(SRC, "", flat)
    print(f"  {os.path.basename(flat):34s} {n2:4d} 文件  {mb2:4.1f} MB  （SKILL.md 在根）")

    # 顺带把包内 frontmatter 打印出来，便于核对市场侧字段
    with zipfile.ZipFile(flat) as z:
        head = z.read("SKILL.md").decode("utf-8")
    fm = re.match(r"---\n(.*?)\n---", head, re.S)
    if fm:
        keys = [line.split(":", 1)[0] for line in fm.group(1).splitlines() if ":" in line and not line.startswith(" ")]
        print(f"  frontmatter 字段: {', '.join(keys)}")

    # 图片素材一并归位，方便一次全选
    for src_name, dst_name in [
        ("icon-1024.png", "icon-1024.png"),
        ("chart.png", "screenshot-1-chart.png"),
        ("kpi.png", "screenshot-2-kpi.png"),
        ("process.png", "screenshot-3-process.png"),
    ]:
        s = os.path.join(ROOT, "docs", "images", src_name)
        if os.path.exists(s):
            shutil.copy2(s, os.path.join(OUT_DIR, dst_name))
    for extra in ("SUBMIT.md",):
        s = os.path.join(ROOT, extra)
        if os.path.exists(s):
            shutil.copy2(s, os.path.join(OUT_DIR, extra))
    print(f"  图标与截图已归到 {os.path.relpath(OUT_DIR, ROOT)}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
