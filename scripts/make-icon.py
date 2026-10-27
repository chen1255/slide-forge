#!/usr/bin/env python3
"""生成 slide-forge / 做PPT 的品牌图标与横版文字标识。

单一几何源：图标 PNG、SVG、lockup 都由下面的常量推导，改数值只需改一处。

输出（docs/images/）：
  icon.svg          矢量母版
  icon-1024.png     技能市场图标上传用
  icon-512.png      README / 卡片
  icon-256.png      小尺寸
  lockup.png        图标 + 「做PPT」文字，1600x480

用法：
  python scripts/make-icon.py
"""

from __future__ import annotations

import math
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "images")

# ---------------------------------------------------------------- 设计常量
N = 1024                 # 图标画布
SS = 4                   # 超采样倍数，抗锯齿
R_BG = 232               # 底板圆角

BG_A = (13, 21, 38)      # 深蓝 #0D1526
BG_B = (34, 56, 96)      # 稍亮 #223860
GOLD = (232, 176, 75)    # #E8B04B（与主题 accent 一致）
GOLD_DEEP = (184, 127, 34)   # #B87F22
GOLD_LIGHT = (243, 208, 138)  # #F3D08A
GOLD_LINE = (201, 162, 39)    # 细线金
PANEL = (246, 248, 252)       # 幻灯片面板
INK_SOFT = (201, 211, 226)    # 面板内弱文字条

# 幻灯片：前片 + 两张后片（逐层上移并收窄，露出的顶边形成纸张叠层）
SLIDE = (196, 336, 828, 756)          # x0, y0, x1, y1
BACK_STEPS = [(70, 74), (34, 36)]     # (左右内收, 上移)，由远及近
R_SLIDE = 34

# 前片内容
TITLE = (248, 392, 528, 424)
BARS = [(248, 588, 84), (356, 528, 84), (464, 464, 84)]   # x, top, w
BAR_BASE = 684
LINES = [(580, 488, 196), (580, 524, 150), (580, 560, 172)]  # x, y, w
LINE_H = 18

FONT_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_ALT = [
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    "/System/Library/Fonts/PingFang.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
]


def font(size: int) -> ImageFont.FreeTypeFont:
    for path in [FONT_BOLD] + FONT_ALT:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    raise SystemExit("找不到中文字体，请安装微软雅黑 / 苹方 / Noto Sans CJK")


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def gradient(size, c0, c1, direction=(1.0, 1.0)):
    """小尺寸生成后放大，避免逐像素算 4096²。"""
    small = 96
    vx, vy = direction
    denom = (small - 1) * (abs(vx) + abs(vy))
    img = Image.new("RGB", (small, small))
    data = []
    for j in range(small):
        for i in range(small):
            t = (i * max(vx, 0) + j * max(vy, 0)) / denom
            data.append(lerp(c0, c1, min(max(t, 0.0), 1.0)))
    img.putdata(data)
    return img.resize(size, Image.BICUBIC)


def rrect_mask(size, radius):
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return mask


def paint_rrect(canvas, box, radius, c0, c1, direction=(1.0, 1.0)):
    x0, y0, x1, y1 = box
    w, h = int(x1 - x0), int(y1 - y0)
    g = gradient((w, h), c0, c1, direction).convert("RGBA")
    canvas.paste(g, (int(x0), int(y0)), rrect_mask((w, h), radius))


def blurred(canvas, draw_fn, blur):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def clip_round(img, radius):
    """把整体 alpha 收进圆角矩形，避免柔光从圆角外溢出成硬边方块。"""
    mask = rrect_mask(img.size, int(radius))
    img.putalpha(ImageChops.multiply(img.getchannel("A"), mask))
    return img


def measure(text, size):
    f = font(int(size))
    return ImageDraw.Draw(Image.new("RGB", (1, 1))).textlength(text, font=f)


# ---------------------------------------------------------------- 图标
def draw_icon(size: int = N) -> Image.Image:
    s = size * SS
    k = s / N  # 设计单位 → 像素

    def sc(v):
        return v * k

    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))

    # 底板
    paint_rrect(img, (0, 0, s, s), int(sc(R_BG)), BG_A, BG_B, (1.0, 0.85))

    # 左上柔光
    blurred(
        img,
        lambda d: d.ellipse(
            [sc(-140), sc(-220), sc(640), sc(520)], fill=GOLD + (26,)
        ),
        sc(150),
    )

    # 内描边
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(
        [sc(30), sc(30), sc(N - 30), sc(N - 30)],
        radius=sc(204),
        outline=GOLD_LINE + (120,),
        width=max(1, int(sc(2.2))),
    )

    # 叠层后片：逐层上移收窄，只露出顶边，形成纸张叠层
    for inset, lift in BACK_STEPS:
        box = (SLIDE[0] + inset, SLIDE[1] - lift, SLIDE[2] - inset, SLIDE[3] - lift)
        paint_rrect(img, tuple(sc(v) for v in box), sc(R_SLIDE), (30, 48, 82), (24, 39, 68))
        d.rounded_rectangle(
            [sc(box[0]), sc(box[1]), sc(box[2]), sc(box[3])],
            radius=sc(R_SLIDE),
            outline=GOLD_LINE + (110,),
            width=max(1, int(sc(2.4))),
        )

    # 前片投影
    def shadow(dd):
        dd.rounded_rectangle(
            [sc(SLIDE[0]), sc(SLIDE[1] + 14), sc(SLIDE[2]), sc(SLIDE[3] + 22)],
            radius=sc(R_SLIDE),
            fill=(0, 0, 0, 110),
        )

    blurred(img, shadow, sc(34))

    # 前片
    paint_rrect(img, tuple(sc(v) for v in SLIDE), sc(R_SLIDE), (255, 255, 255), PANEL)

    # 标题条
    paint_rrect(
        img, tuple(sc(v) for v in TITLE), sc(16), GOLD_LIGHT, GOLD, (1.0, 0.0)
    )

    # 柱状图（金色渐变，柱顶圆角）
    for x, top, w in BARS:
        paint_rrect(
            img,
            (sc(x), sc(top), sc(x + w), sc(BAR_BASE)),
            sc(12),
            GOLD_LIGHT,
            GOLD_DEEP,
            (0.0, 1.0),
        )

    # 右侧解读文字条
    for x, y, w in LINES:
        d.rounded_rectangle(
            [sc(x), sc(y), sc(x + w), sc(y + LINE_H)],
            radius=sc(LINE_H / 2),
            fill=INK_SOFT,
        )

    return clip_round(img, sc(R_BG)).resize((size, size), Image.LANCZOS)


# ---------------------------------------------------------------- SVG 母版
def svg_icon() -> str:
    def rc(box, radius, fill="none", stroke=None, sw=0, opacity=1.0):
        x0, y0, x1, y1 = box
        attrs = [
            f'x="{x0}"', f'y="{y0}"',
            f'width="{x1 - x0}"', f'height="{y1 - y0}"',
            f'rx="{radius}"', f'fill="{fill}"',
        ]
        if stroke:
            attrs += [f'stroke="{stroke}"', f'stroke-width="{sw}"', f'stroke-opacity="{opacity}"']
        return "  <rect " + " ".join(attrs) + " />"

    backs = [
        (SLIDE[0] + i, SLIDE[1] - lift, SLIDE[2] - i, SLIDE[3] - lift)
        for i, lift in BACK_STEPS
    ]
    gold = "#C9A227"
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" width="{N}" height="{N}" role="img" aria-label="做PPT 图标">',
        "  <defs>",
        '    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0.85">',
        f'      <stop offset="0" stop-color="#{ "%02X%02X%02X" % BG_A }" />',
        f'      <stop offset="1" stop-color="#{ "%02X%02X%02X" % BG_B }" />',
        "    </linearGradient>",
        '    <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">',
        f'      <stop offset="0" stop-color="#{ "%02X%02X%02X" % GOLD_LIGHT }" />',
        f'      <stop offset="1" stop-color="#{ "%02X%02X%02X" % GOLD_DEEP }" />',
        "    </linearGradient>",
        '    <linearGradient id="title" x1="0" y1="0" x2="1" y2="0">',
        f'      <stop offset="0" stop-color="#{ "%02X%02X%02X" % GOLD_LIGHT }" />',
        f'      <stop offset="1" stop-color="#{ "%02X%02X%02X" % GOLD }" />',
        "    </linearGradient>",
        '    <radialGradient id="glow" cx="0.28" cy="0.12" r="0.72">',
        f'      <stop offset="0" stop-color="#{ "%02X%02X%02X" % GOLD }" stop-opacity="0.16" />',
        f'      <stop offset="1" stop-color="#{ "%02X%02X%02X" % GOLD }" stop-opacity="0" />',
        "    </radialGradient>",
        f'    <clipPath id="clip"><rect width="{N}" height="{N}" rx="{R_BG}" /></clipPath>',
        "  </defs>",
        f'  <g clip-path="url(#clip)">',
        rc((0, 0, N, N), R_BG, fill="url(#bg)"),
        f'    <rect width="{N}" height="{N}" fill="url(#glow)" />',
        rc((30, 30, N - 30, N - 30), 204, fill="none", stroke=gold, sw=2.2, opacity=0.23),
    ]
    for box in backs:
        parts.append(rc(box, R_SLIDE, fill="#1E304A", stroke=gold, sw=2.4, opacity=0.42))
    parts += [
        rc(SLIDE, R_SLIDE, fill="#F6F8FC"),
        rc(TITLE, 16, fill="url(#title)"),
    ]
    for x, top, w in BARS:
        parts.append(rc((x, top, x + w, BAR_BASE), 12, fill="url(#bar)"))
    for x, y, w in LINES:
        parts.append(rc((x, y, x + w, y + LINE_H), LINE_H / 2, fill="#C9D3E2"))
    parts += ["  </g>", "</svg>", ""]
    return "\n".join(parts)


# ---------------------------------------------------------------- 横版标识
LOCK_H = 480
ICON_BOX = 320
WORD = "做"
WORD_ACCENT = "PPT"
SUB = "幻灯片工坊 · slide-forge"
PILL = "办公效率"
WORD_SIZE = 170
PAD_L = 80          # 图标左边距
GAP = 74            # 图标与文字间距
PAD_R = 92          # 文字右边距


def lock_width() -> int:
    """按实测字宽定稿画布，避免右端被裁。"""
    w = measure(WORD, WORD_SIZE) + 6 + measure(WORD_ACCENT, WORD_SIZE)
    return int(round(PAD_L + ICON_BOX + GAP + w + PAD_R))


def draw_lockup() -> Image.Image:
    s = SS
    lock_w = lock_width()
    W, H = lock_w * s, LOCK_H * s
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    def sc(v):
        return v * s

    paint_rrect(img, (0, 0, W, H), sc(40), BG_A, BG_B, (1.0, 0.7))
    blurred(
        img,
        lambda d: d.ellipse([sc(-160), sc(-260), sc(900), sc(520)], fill=GOLD + (24,)),
        sc(160),
    )
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(
        [sc(24), sc(24), sc(lock_w - 24), sc(LOCK_H - 24)],
        radius=sc(28),
        outline=GOLD_LINE + (58,),
        width=max(1, int(sc(1.8))),
    )

    # 图标
    icon = draw_icon(ICON_BOX * s).resize((int(sc(ICON_BOX)), int(sc(ICON_BOX))), Image.LANCZOS)
    img.alpha_composite(icon, (int(sc(PAD_L)), int(sc(80))))

    # 文字标识：做 + PPT（金色）
    f_big = font(int(sc(WORD_SIZE)))
    x = sc(PAD_L + ICON_BOX + GAP)
    baseline = sc(258)
    d.text((x, baseline), WORD, font=f_big, fill=(255, 255, 255), anchor="ls")
    x += d.textlength(WORD, font=f_big) + sc(6)
    d.text((x, baseline), WORD_ACCENT, font=f_big, fill=GOLD, anchor="ls")

    # 副标题
    f_sub = font(int(sc(40)))
    d.text((sc(PAD_L + ICON_BOX + GAP + 6), sc(310)), SUB, font=f_sub, fill=(159, 176, 201), anchor="lm")

    # 分类标签
    f_pill = font(int(sc(28)))
    tw = d.textlength(PILL, font=f_pill)
    px0, py0 = sc(PAD_L + ICON_BOX + GAP + 6), sc(352)
    pw, ph = tw + sc(64), sc(58)
    d.rounded_rectangle(
        [px0, py0, px0 + pw, py0 + ph],
        radius=ph / 2,
        outline=GOLD + (150,),
        width=max(1, int(sc(1.8))),
    )
    d.text((px0 + pw / 2, py0 + ph / 2), PILL, font=f_pill, fill=GOLD_LIGHT, anchor="mm")

    return clip_round(img, sc(40)).resize((lock_w, LOCK_H), Image.LANCZOS)


def main() -> int:
    os.makedirs(OUT, exist_ok=True)

    master = draw_icon(N)
    targets = {"icon-1024.png": 1024, "icon-512.png": 512, "icon-256.png": 256}
    for name, size in targets.items():
        out = master if size == N else master.resize((size, size), Image.LANCZOS)
        path = os.path.join(OUT, name)
        out.save(path, "PNG", optimize=True)
        print(f"  {name:16s} {os.path.getsize(path) / 1024:6.1f} KB  {size}x{size}")

    svg_path = os.path.join(OUT, "icon.svg")
    with open(svg_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(svg_icon())
    print(f"  {'icon.svg':16s} {os.path.getsize(svg_path) / 1024:6.1f} KB  vector")

    lock = draw_lockup()
    lock_path = os.path.join(OUT, "lockup.png")
    lock.save(lock_path, "PNG", optimize=True)
    print(f"  {'lockup.png':16s} {os.path.getsize(lock_path) / 1024:6.1f} KB  {lock.size[0]}x{lock.size[1]}")

    # 深浅两种背景下自查对比度（图标本身不受影响，仅提示）
    lum_bg = 0.2126 * BG_A[0] + 0.7152 * BG_A[1] + 0.0722 * BG_A[2]
    if lum_bg > 128:
        print("! 底板偏亮，金色描边可能不够醒目", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
