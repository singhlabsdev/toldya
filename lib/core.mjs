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
    out.push({ text: c, ts: e.timestamp || '' });
  }
  return out;
}

// A correction is a short instruction aimed at the agent's behaviour.
const CUE = /\b(don'?t|dont|do not|never|stop|always|avoid|instead|i told you|i said|again|not like that|why did you|make sure|keep it|no need|must)\b/i;
// Not corrections: you being lost, or asking something.
const NOT = /\bunders\w*|\bunderst\w*|\b(don'?t know|dont know|no idea|what is|where is|how do|how to|where to)\b|\?\s*$/i;
// Long messages are pastes (specs, logs, briefs), not things you said.
const PASTE = 600;

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

const STOP = new Set("the a an to of and or is it i you me my we our this that for in on with be its it's please just so also now ok okay".split(' '));
const tokens = (s) => new Set((s.toLowerCase().match(/[a-z0-9']+/g) || [])
  .map((w) => w.replace(/'/g, '')).filter((w) => w.length > 1 && !STOP.has(w)));
const grams = (s) => {
  const t = s.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const g = new Set();
  for (let i = 0; i + 3 <= t.length; i++) g.add(t.slice(i, i + 3));
  return g;
};
const inter = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n; };

// Same thing said twice? Word overlap catches rewordings, letter trigrams catch
// typos ("dont comlicate that" vs "don't complicate it").
export function similar(a, b) {
  const ta = a.t || tokens(a.s || a), tb = b.t || tokens(b.s || b);
  const ga = a.g || grams(a.s || a), gb = b.g || grams(b.s || b);
  const j = inter(ta, tb) / Math.max(1, new Set([...ta, ...tb]).size);
  const d = (2 * inter(ga, gb)) / Math.max(1, ga.size + gb.size);
  return Math.max(j, d);
}
export const SAME = 0.5;

// Greedy grouping against each group's first sentence. ponytail: O(n·groups);
// fine for a few thousand corrections, swap for an index if histories get huge.
export function group(items) {
  const groups = [];
  for (const it of items) {
    const x = { ...it, t: tokens(it.s), g: grams(it.s) };
    let best = null, score = 0;
    for (const grp of groups) {
      const sc = similar(grp.rep, x);
      if (sc > score) { score = sc; best = grp; }
    }
    if (best && score >= SAME) best.items.push(x);
    else groups.push({ rep: x, items: [x] });
  }
  return groups;
}

// Repeats worth a rule: said at least `min` times, in at least two sessions.
export function repeats(groups, min = 3) {
  return groups
    .filter((g) => g.items.length >= min && new Set(g.items.map((i) => i.session)).size >= 2)
    .map((g) => {
      // Pick the wording made of the words you used most across the group, so a
      // one-off typo ("pleae keep it simle") loses to the version you usually type.
      const freq = new Map();
      for (const i of g.items) for (const w of i.t) freq.set(w, (freq.get(w) || 0) + 1);
      const score = (i) => [...i.t].reduce((n, w) => n + freq.get(w), 0) / Math.max(1, i.t.size);
      const best = [...g.items].sort((a, b) => score(b) - score(a) || a.s.length - b.s.length)[0];
      const phrase = best.s.replace(/[.!]+$/, '');
      return {
        phrase,
        count: g.items.length,
        sessions: new Set(g.items.map((i) => i.session)).size,
        first: g.items.map((i) => i.ts).filter(Boolean).sort()[0] || '',
        last: g.items.map((i) => i.ts).filter(Boolean).sort().at(-1) || '',
        items: g.items,
      };
    })
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

// How often a rule's phrase came back before and after it was added.
export function beforeAfter(rule, items) {
  let before = 0, after = 0;
  for (const i of items) {
    if (similar(rule.text, i.s) < SAME) continue;
    if (i.ts && i.ts >= rule.addedAt) after++; else before++;
  }
  return { before, after };
}
