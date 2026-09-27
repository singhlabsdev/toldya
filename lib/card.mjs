// toldya --card: one image of your top repeats, for when you want to show someone.
// Writes a local HTML page that draws the card and saves it as a PNG. No network,
// unless you click a share button: that opens X or LinkedIn with a pre-filled post.
import { readFileSync } from 'node:fs';

const MARK = new URL('../assets/mark.webp', import.meta.url);

export function cardHtml({ repeats, sessions, from, to }) {
  let mark = '';
  try { mark = 'data:image/webp;base64,' + readFileSync(MARK).toString('base64'); } catch {}
  const data = { rows: repeats.slice(0, 5).map((r) => [r.count, r.phrase]), sessions, from, to, mark };
  // JSON inside <script>: escape "<" so a phrase like "</script>" can't end the block.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html><meta charset="utf-8"><title>toldya card</title>
<style>body{margin:0;background:#eee;font:16px system-ui;display:grid;place-items:center;min-height:100vh;gap:16px}
canvas{max-width:95vw;height:auto;box-shadow:0 2px 12px #0002}.row{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}p{margin:0;color:#555;max-width:60ch;text-align:center}a{font-weight:700;color:#0d0d0d;background:#ffd23f;border:3px solid #0d0d0d;padding:10px 18px;border-radius:30px;text-decoration:none;box-shadow:4px 4px 0 #0d0d0d}</style>
<canvas id="c" width="1200" height="675"></canvas>
<div class="row"><a id="save" download="toldya.png" href="#">1. Save as PNG</a><a id="x" target="_blank" rel="noopener" href="#">2. Post on X</a><a id="li" target="_blank" rel="noopener" href="#">2. Share on LinkedIn</a></div>
<p>Save the picture first, then attach it to your post. The card is drawn on your machine; nothing leaves it unless you click a share button. Or add it to <a style="all:revert" href="https://github.com/singhlabsdev/toldya/discussions/1" target="_blank" rel="noopener">Share your card</a> on GitHub.</p>
<script>
const D = ${json}, c = document.getElementById('c'), x = c.getContext('2d'), INK = '#0d0d0d';
const REPO = 'github.com/singhlabsdev/toldya';
const first = D.rows[0] || [0, ''];
const post = 'My AI has heard "' + first[1] + '" ' + first[0] + ' times 😅 Counted from my own Claude Code history with npx toldya';
document.getElementById('x').href = 'https://x.com/intent/post?text=' + encodeURIComponent(post) + '&url=' + encodeURIComponent('https://' + REPO);
document.getElementById('li').href = 'https://www.linkedin.com/feed/?shareActive=true&text=' + encodeURIComponent(post + ' https://' + REPO);
const font = (w, s) => (x.font = w + ' ' + s + 'px system-ui, "Segoe UI", sans-serif');
const pill = (px, py, w, h, fill) => {
  x.fillStyle = INK; x.beginPath(); x.roundRect(px + 5, py + 5, w, h, h / 2); x.fill();
  x.fillStyle = fill; x.beginPath(); x.roundRect(px, py, w, h, h / 2); x.fill();
  x.lineWidth = 3; x.strokeStyle = INK; x.stroke();
};
const fit = (s, max) => { if (x.measureText(s).width <= max) return s;
  while (s.length > 1 && x.measureText(s + '…').width > max) s = s.slice(0, -1); return s + '…'; };
// Wrap s into at most 2 lines of width max; the second line gets an ellipsis if it overflows.
const wrap = (s, max) => {
  const lines = [''];
  for (const w of s.split(' ')) {
    const t = lines.at(-1) ? lines.at(-1) + ' ' + w : w;
    if (x.measureText(t).width <= max || !lines.at(-1)) lines[lines.length - 1] = t;
    else if (lines.length < 2) lines.push(w);
    else { lines[1] = fit(lines[1] + ' ' + w, max); break; }
  }
  return lines;
};
function draw(img) {
  x.fillStyle = '#fff'; x.fillRect(0, 0, 1200, 675);
  if (img) x.drawImage(img, 20, 170, 330, 330);
  // The headline is the top correction itself, in quotes, with its count.
  x.fillStyle = '#6b6b6b'; font(600, 30); x.fillText('I have told my AI', 390, 92);
  x.fillStyle = INK; font(800, 66);
  const lines = wrap('“' + first[1] + '”', 760);
  lines.forEach((l, i) => x.fillText(l, 390, 170 + i * 76));
  const cy = 170 + (lines.length - 1) * 76 + 34;
  pill(390, cy, 250, 72, '#ffd23f');
  x.fillStyle = INK; font(800, 44); x.textAlign = 'center'; x.fillText(first[0] + ' times', 515, cy + 52); x.textAlign = 'left';
  // The rest, smaller.
  const rest = D.rows.slice(1, 4);
  if (rest.length) { x.fillStyle = '#6b6b6b'; font(600, 24); x.fillText('also:', 390, cy + 128); }
  rest.forEach(([n, p], i) => {
    const y = cy + 128 + (i + 1) * 40;
    x.fillStyle = INK; font(800, 26); x.fillText(n + '×', 390, y);
    font(500, 26); x.fillText(fit(p, 640), 470, y);
  });
  font(500, 22); x.fillStyle = '#6b6b6b';
  x.fillText(D.sessions + ' Claude Code sessions · ' + D.from + ' – ' + D.to, 390, 628);
  pill(990, 596, 180, 50, INK); x.fillStyle = '#fff'; font(700, 24); x.fillText('npx toldya', 1017, 629);
  x.fillStyle = '#6b6b6b'; font(500, 18); x.textAlign = 'right'; x.fillText(REPO, 1170, 580); x.textAlign = 'left';
  document.getElementById('save').href = c.toDataURL('image/png');
}
if (D.mark) { const i = new Image(); i.onload = () => draw(i); i.onerror = () => draw(); i.src = D.mark; } else draw();
</script>`;
}
