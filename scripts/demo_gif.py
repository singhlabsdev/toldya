"""Render assets/demo.gif and assets/report.png from captured real runs.

The text on every frame is the tool's actual output, captured into demo/run*.txt by:
  toldya --all --min 9 --dry                      > run1.txt
  toldya --all --min 9 --add 1,2,3 --to CLAUDE.md > run2.txt
  cat CLAUDE.md                                   > run3.txt
Only the typing animation is added. Usage: python scripts/demo_gif.py <folder with run*.txt>
"""
import sys, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

src = Path(sys.argv[1])
out = Path(__file__).resolve().parent.parent / 'assets'
out.mkdir(exist_ok=True)

W, H, PAD, LH = 980, 410, 28, 26
BG, BAR, FG, DIM = (22, 24, 33), (38, 41, 54), (226, 228, 235), (140, 146, 165)
PINK, YEL, GRN, SAGE = (255, 144, 232), (255, 210, 63), (126, 231, 135), (152, 161, 121)
font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 18)
bold = ImageFont.truetype('C:/Windows/Fonts/consolab.ttf', 18)

def colour(line):
    if line.startswith('$ '): return None
    if re.match(r'\s+\d+\.\s+\d+×', line): return YEL
    if line.startswith('Added') or line.startswith('## ') : return GRN
    if line.startswith('And ') or line.startswith('toldya ·'): return DIM
    return FG

def frame(lines):
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 36], fill=BAR)
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse([16 + i * 22, 12, 28 + i * 22, 24], fill=c)
    y = 36 + PAD - 8
    for ln in lines[-((H - 60) // LH):]:
        if ln.startswith('$ '):
            d.text((PAD, y), '$', font=bold, fill=PINK)
            d.text((PAD + 22, y), ln[2:], font=bold, fill=FG)
        else:
            d.text((PAD, y), ln, font=font, fill=colour(ln))
        y += LH
    return im

frames, durations = [], []
def add(lines, ms):
    frames.append(frame(lines)); durations.append(ms)

def scene(cmd, body, hold):
    screen = []
    for i in range(0, len(cmd) + 1, 3):
        add(['$ ' + cmd[:i] + '▌'], 45)
    screen = ['$ ' + cmd, '']
    add(screen, 400)
    for ln in body:
        screen.append(ln)
        add(screen, 110 if ln.strip() else 60)
    add(screen, hold)

read = lambda n: (src / f'run{n}.txt').read_text(encoding='utf-8').rstrip('\n').split('\n')
run1 = read(1)
while run1 and not run1[0].strip(): run1.pop(0)  # the tool prints a leading blank line
scene('npx toldya --all --min 9 --dry', run1, 2600)
report_png = frames[-1]
run2 = read(2)
scene('npx toldya --all --min 9 --add 1,2,3 --to CLAUDE.md', [run2[-1]], 1400)
scene('cat CLAUDE.md', read(3), 3200)

report_png.save(out / 'report.png')
frames[0].save(out / 'demo.gif', save_all=True, append_images=frames[1:], duration=durations,
               loop=0, optimize=True, disposal=2)
print('frames', len(frames), '->', out / 'demo.gif', (out / 'demo.gif').stat().st_size // 1024, 'KB')
