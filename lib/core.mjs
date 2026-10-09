// toldya core: read what you told your AI, find what you keep repeating.
// No dependencies, no network. Everything here runs on your machine.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const CLAUDE_ROOT = join(homedir(), '.claude', 'projects');

// Claude Code stores D:\My work\app as D--My-work-app: every non-alphanumeric
// character becomes one dash, never collapsed.
export const encodeProject = (dir) => dir.replace(/[^A-Za-z0-9]/g, '-');

export function claudeProjects(root = CLAUDE_ROOT) {
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((d) => {
    try { return statSync(join(root, d)).isDirectory(); } catch { return false; }
  });
}

// The project folder for this directory: longest matching prefix, so running
// from a subfolder still finds the project it belongs to.
export function projectFor(cwd, all) {
  const want = encodeProject(cwd).toLowerCase();
  return all.filter((d) => want.startsWith(d.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0] || null;
}

// Messages you typed, from one transcript. Skips tool results, system notes,
// compaction summaries and slash-command output: only your own words count.
// `id` is the entry's uuid, which a resumed session's copy keeps unchanged.
export function readClaudeSession(file) {
  let lines;
  try { lines = readFileSync(file, 'utf8').split('\n'); } catch { return []; }
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.type !== 'user' || e.isMeta || e.isCompactSummary || e.toolUseResult) continue;
    let c = e.message?.content;
    if (Array.isArray(c)) c = c.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    if (typeof c !== 'string' || !c.trim()) continue;
    if (/^\s*</.test(c) || /\[Request interrupted/.test(c)) continue;
    out.push({ text: c, ts: e.timestamp || '', id: e.uuid || `${e.timestamp}|${c}` });
  }
  return out;
}

// A correction is a short instruction aimed at the agent's behaviour.
const CUE = /\b(don'?t|dont|do not|never|stop|always|avoid|instead|i told you|i said|again|not like that|why did you|make sure|keep it|no need|must)\b/i;
// Not corrections: you being lost, or asking something. "I don't get it" is
// lost too; "don't get rid of the tests" is a rule, so only get it/this/that/you.
const NOT = /\bunde\w*t[ae]?n|\bunders\w*|\b(don'?t know|dont know|no idea|what is|where is|how do|how to|where to)\b|\b(don'?t|dont|didn'?t|didnt|do not|did not)\s+get\s+(it|this|that|you|what|how|why)\b(?!\s+(wrong|right|done))|\bnot getting (it|this|that)\b|\?\s*$/i;
// Long messages are pastes (specs, logs, briefs), not things you said.
const PASTE = 600;

// "Try again", "check again", "so try again": short sentences built on "again"
// are retries, not rules. They mean the first attempt missed. Counted
// separately, never offered as a rule.
export const isRetry = (s) => s.split(' ').length <= 5 && /\bagain\b/i.test(s);

export function corrections(messages) {
  const out = [];
  for (const m of messages) {
    if (m.text.length > PASTE) continue;
    for (let s of m.text.split(/(?<=[.!?])\s+|\n+|\.{2,}|,{2,}/)) {
      s = s.trim().replace(/\s+/g, ' ');
      const words = s.split(' ').length;
      if (words < 2 || words > 16) continue;
      if (/https?:|\]\(|`/.test(s)) continue;
      if (!CUE.test(s) || NOT.test(s)) continue;
      out.push({ ...m, s });
    }
  }
  return out;
}

const STOP = new Set("the a an to of and or is it i you me my we our this that for in on with be its it's please just so also now ok okay then one".split(' '));
// The words a correction is built from (the ones CUE looks for, plus "want" and
// "have to"). Every correction has some, so sharing them proves nothing: "I don't
// want to move" and "I don't want a database" are two different things.
const FRAME = new Set('dont do not never stop always avoid instead told said again like why did make sure keep no need must want have'.split(' '));
const words = (s) => (s.toLowerCase().match(/[a-z0-9']+/g) || [])
  .map((w) => w.replace(/'/g, '')).filter((w) => w.length > 1 && !STOP.has(w));
const content = (ws) => ws.filter((w) => !FRAME.has(w));

// One word, allowing for how you type: the same first five letters ("complex",
// "complicate"), or one letter added, dropped, changed or swapped ("siple").
function near(a, b) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  if (a.slice(0, 5) === b.slice(0, 5)) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (a[i] === b[i]) i++;
  const x = a.slice(i), y = b.slice(i);
  return x.slice(1) === y.slice(1) || x.slice(1) === y || x === y.slice(1)
    || (x[0] === y[1] && x[1] === y[0] && x.slice(2) === y.slice(2));
}
// Share of words in common (Jaccard), typos forgiven.
function overlap(a, b) {
  const used = new Set();
  let m = 0;
  for (const w of a) {
    const j = b.findIndex((v, k) => !used.has(k) && near(w, v));
    if (j >= 0) { used.add(j); m++; }
  }
  return m / Math.max(1, a.length + b.length - m);
}
// The shorter wording, word for word, inside the longer one.
const inside = (s, l) => l.some((_, i) => i + s.length <= l.length && s.every((w, k) => near(w, l[i + k])));

// Same thing said twice? Yes if one wording says all of the other ("keep it
// simple and few lines" says "keep it simple"); otherwise by the share of words
// in common that aren't frame ("Don't complicate it", "dont complex this").
function sim(a, b) {
  if (a.join(' ') > b.join(' ')) [a, b] = [b, a]; // same answer either way round
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length >= 2 && content(s).length && inside(s, l)) return 1;
  const ca = content(a), cb = content(b);
  if (!ca.length && !cb.length) return overlap([...new Set(a)], [...new Set(b)]);
  return overlap([...new Set(ca)], [...new Set(cb)]);
}
export const similar = (a, b) => sim(words(a), words(b));
export const SAME = 0.5;

// Habits, grouped the same whatever order the history is read in. Wordings are
// taken A–Z, and the two closest groups merge while, on average across every
// pair of sentences between them, they are the same thing said twice (average
// linkage). Comparing whole groups, not a first sentence, keeps one loose match
// from pulling in a stranger. ponytail: O(n³) in distinct wordings, about 4 s
// at 1,000 (a heavy three months is ~300); split into connected components
// first if histories get that big.
export function group(items) {
  const by = new Map();
  for (const it of items) (by.get(it.s) || by.set(it.s, []).get(it.s)).push(it);
  const keys = [...by.keys()].sort();
  const ws = keys.map(words);
  const size = keys.map((k) => by.get(k).length);
  // Sum of similarity over every pair of sentences between two groups.
  const pair = keys.map((_, i) => keys.map((_, j) => (i === j ? 0 : sim(ws[i], ws[j]) * size[i] * size[j])));
  const members = keys.map((_, i) => [i]);
  for (;;) {
    let best = SAME, bi = -1, bj = -1;
    for (let i = 0; i < keys.length; i++) {
      if (!members[i]) continue;
      for (let j = i + 1; j < keys.length; j++) {
        if (!members[j]) continue;
        const avg = pair[i][j] / (size[i] * size[j]);
        if (avg > best || (avg === best && bi < 0)) { best = avg; bi = i; bj = j; }
      }
    }
    if (bi < 0) break;
    members[bi].push(...members[bj]);
    members[bj] = null;
    size[bi] += size[bj];
    for (let k = 0; k < keys.length; k++) { pair[bi][k] += pair[bj][k]; pair[k][bi] = pair[bi][k]; }
  }
  return members.filter(Boolean).map((m) => ({ items: m.flatMap((i) => by.get(keys[i])) }));
}

// Letter trigrams in common, for telling a typo from the word it misspells.
const grams = (s) => {
  const g = new Set();
  for (let i = 0; i + 3 <= s.length; i++) g.add(s.slice(i, i + 3));
  return g;
};
function dice(a, b) {
  const ga = grams(a), gb = grams(b);
  let n = 0;
  for (const x of ga) if (gb.has(x)) n++;
  return (2 * n) / Math.max(1, ga.size + gb.size);
}

// A habit's name: the wording typed in the most sessions (case and end
// punctuation aside), since one session repeating itself is not a habit. A tie
// goes to the best-spelled wording: a typo shares fewer letters with the other
// spellings of its word than the real spelling does ("siple" and "simle" are
// each nearer "simple" than each other). Then the shortest, then A–Z. Shown
// with the capitals used most.
function label(items) {
  const strip = (i) => i.s.replace(/[.!]+$/, '');
  const by = new Map();
  for (const i of items) { const k = strip(i).toLowerCase(); (by.get(k) || by.set(k, []).get(k)).push(i); }
  const ses = (k) => new Set(by.get(k).map((i) => i.session)).size;
  const vocab = [...new Set([...by.keys()].flatMap(words))];
  const centre = new Map(vocab.map((w) => [w, vocab.reduce((t, v) => t + (near(w, v) ? dice(w, v) : 0), 0)]));
  const spelled = (k) => { const ws = words(k); return ws.reduce((t, w) => t + centre.get(w), 0) / Math.max(1, ws.length); };
  const k = [...by.keys()].sort((a, b) => ses(b) - ses(a) || spelled(b) - spelled(a) || a.length - b.length || (a < b ? -1 : 1))[0];
  const n = new Map();
  for (const i of by.get(k)) n.set(strip(i), (n.get(strip(i)) || 0) + 1);
  return [...n.keys()].sort((a, b) => n.get(b) - n.get(a) || (a < b ? -1 : 1))[0];
}

// Repeats worth a rule: said at least `min` times, in at least two sessions.
export function repeats(groups, min = 3) {
  return groups
    .filter((g) => g.items.length >= min && new Set(g.items.map((i) => i.session)).size >= 2)
    .map((g) => ({
      phrase: label(g.items),
      count: g.items.length,
      sessions: new Set(g.items.map((i) => i.session)).size,
      first: g.items.map((i) => i.ts).filter(Boolean).sort()[0] || '',
      last: g.items.map((i) => i.ts).filter(Boolean).sort().at(-1) || '',
      items: g.items,
    }))
    .sort((a, b) => b.count - a.count);
}

export const toRule = (phrase) => {
  const p = phrase.trim().replace(/\s+/g, ' ');
  return p.charAt(0).toUpperCase() + p.slice(1) + (/[.!]$/.test(p) ? '' : '.');
};

// Is this already a line in the rule file? Then the wording isn't landing.
export function alreadyWritten(phrase, ruleText) {
  return ruleText.split('\n').map((l) => l.replace(/^[\s>*\-#\d.]+/, '').trim())
    .filter((l) => l.length > 3).some((l) => similar(phrase, l) >= SAME);
}

// How often a rule's habit came back before and after it was added. Counted on
// the same habits the report shows, so the two numbers agree: of the groups whose
// sentences are, on average, the same thing as the rule (the test group() merges
// by), the biggest. A rule comes from a habit, and one long sentence that merely
// contains the rule can match it just as well. A rule reworded past every habit
// falls back to a sentence-by-sentence match.
export function beforeAfter(rule, items, groups = group(items)) {
  const r = words(rule.text);
  let best = null, bestAvg = 0;
  for (const g of groups) {
    const avg = g.items.reduce((t, i) => t + sim(r, words(i.s)), 0) / g.items.length;
    if (avg < SAME) continue;
    const n = g.items.length, m = best ? best.items.length : 0;
    if (n > m || (n === m && avg > bestAvg)) { best = g; bestAvg = avg; }
  }
  const hits = best ? best.items : items.filter((i) => similar(rule.text, i.s) >= SAME);
  let before = 0, after = 0;
  for (const i of hits) {
    if (i.ts && i.ts >= rule.addedAt) after++; else before++;
  }
  return { before, after };
}
