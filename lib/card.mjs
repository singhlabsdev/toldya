// toldya --card: one image of your top repeats, for when you want to show someone.
// Writes a local HTML page that draws the card and saves it as a PNG. No network.
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
canvas{max-width:95vw;height:auto;box-shadow:0 2px 12px #0002}a{font-weight:700;color:#0d0d0d;background:#ffd23f;border:3px solid #0d0d0d;padding:10px 18px;border-radius:30px;text-decoration:none;box-shadow:4px 4px 0 #0d0d0d}</style>
<canvas id="c" width="1200" height="675"></canvas><a id="save" download="toldya.png" href="#">Save as PNG</a>
<script>
const D = ${json}, c = document.getElementById('c'), x = c.getContext('2d'), INK = '#0d0d0d';
const font = (w, s) => (x.font = w + ' ' + s + 'px system-ui, "Segoe UI", sans-serif');
const pill = (px, py, w, h, fill) => {
  x.fillStyle = INK; x.beginPath(); x.roundRect(px + 5, py + 5, w, h, h / 2); x.fill();
  x.fillStyle = fill; x.beginPath(); x.roundRect(px, py, w, h, h / 2); x.fill();
  x.lineWidth = 3; x.strokeStyle = INK; x.stroke();
};
const fit = (s, max) => { if (x.measureText(s).width <= max) return s;
  while (s.length > 1 && x.measureText(s + '…').width > max) s = s.slice(0, -1); return s + '…'; };
function draw(img) {
  x.fillStyle = '#fff'; x.fillRect(0, 0, 1200, 675);
  if (img) x.drawImage(img, 30, 150, 330, 330);
  x.fillStyle = INK; font(800, 46); x.fillText('Things I keep telling my AI', 390, 100);
  D.rows.forEach(([n, p], i) => {
    const y = 150 + i * 88;
    pill(390, y, 118, 58, '#ffd23f');
    x.fillStyle = INK; font(800, 30); x.textAlign = 'center'; x.fillText(n + '×', 449, y + 40);
    x.textAlign = 'left'; font(600, 32); x.fillText(fit('“' + p + '”', 640), 532, y + 41);
  });
  font(500, 22); x.fillStyle = '#6b6b6b';
  x.fillText(D.sessions + ' Claude Code sessions · ' + D.from + ' – ' + D.to, 390, 628);
  pill(990, 596, 180, 50, INK); x.fillStyle = '#fff'; font(700, 24); x.fillText('npx toldya', 1017, 629);
  document.getElementById('save').href = c.toDataURL('image/png');
}
if (D.mark) { const i = new Image(); i.onload = () => draw(i); i.onerror = () => draw(); i.src = D.mark; } else draw();
</script>`;
}
