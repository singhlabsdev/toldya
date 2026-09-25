"""assets/social-preview.png (1280x640) for GitHub's Settings > Social preview.
Mark on the left, name and promise typeset on the right. Rebuild after changing either.
Usage: python scripts/social_card.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

A = Path(__file__).resolve().parent.parent / 'assets'
W, H = 1280, 640
mark = Image.open(A / 'mark.webp').convert('RGB')
side = 560
mark = mark.resize((side, side), Image.LANCZOS)
# the generated art is not quite #fff; use its own corner so no box shows
card = Image.new('RGB', (W, H), mark.getpixel((4, 4)))
card.paste(mark, (40, (H - side) // 2))

d = ImageDraw.Draw(card)
F = 'C:/Windows/Fonts/'
name = ImageFont.truetype(F + 'seguibl.ttf', 132)
line = ImageFont.truetype(F + 'segoeuib.ttf', 42)
code = ImageFont.truetype(F + 'consolab.ttf', 34)
x = 640
d.text((x, 150), 'toldya', font=name, fill='#0d0d0d')
d.text((x, 330), 'Stop repeating yourself', font=line, fill='#0d0d0d')
d.text((x, 382), 'to your AI.', font=line, fill='#0d0d0d')
# the one command, in a yellow pill with a hard black shadow (house style)
box = [x, 470, x + 380, 530]
d.rounded_rectangle([b + 6 for b in box], radius=30, fill='#0d0d0d')
d.rounded_rectangle(box, radius=30, fill='#ffd23f', outline='#0d0d0d', width=4)
d.text((x + 34, 481), 'npx toldya', font=code, fill='#0d0d0d')
card.save(A / 'social-preview.png', optimize=True)
print('ok', (A / 'social-preview.png').stat().st_size // 1024, 'KB')
