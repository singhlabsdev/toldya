#!/usr/bin/env node
// toldya — stop repeating yourself to your AI.
//
// Reads what you typed to Claude Code (from its own history on this machine),
// finds the corrections you keep repeating, offers each one as a line for the
// rule file your agent reads, and next time counts whether you still say it.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import {
  CLAUDE_ROOT, claudeProjects, projectFor, readClaudeSession,
  corrections, group, repeats, toRule, alreadyWritten, beforeAfter, isRetry,
} from '../lib/core.mjs';
import { cardHtml } from '../lib/card.mjs';

const VERSION = '0.3.0';
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

if (has('--help') || has('-h')) {
  console.log(`toldya ${VERSION} — stop repeating yourself to your AI

  toldya            this project: what you keep telling Claude Code here
  toldya --all      every project; rules go to your global ~/.claude/CLAUDE.md
  --min N           only repeats said at least N times (default 3)
  --to FILE         write rules to FILE instead (e.g. AGENTS.md)
  --add 1,3         add repeats by their number, without asking
  --dry             show the report, change nothing
  --card            make an image of your top repeats, to share
  --json            machine-readable report, change nothing

Reads Claude Code's own history on this machine. Sends nothing anywhere.`);
  process.exit(0);
}
if (has('--version') || has('-v')) { console.log(VERSION); process.exit(0); }
if (argv.some((a) => /^[\w.-]+\/[\w.-]+$/.test(a))) {
  console.log('Team mode (owner/repo) is coming next. For now: run `npx toldya` in your project.');
  process.exit(0);
}

const all = has('--all');
const min = Math.max(2, parseInt(opt('--min', '3'), 10) || 3);
const cwd = process.cwd();
const projects = claudeProjects();
const chosen = all ? projects : [projectFor(cwd, projects)].filter(Boolean);

if (!chosen.length) {
  console.log(projects.length
    ? `No Claude Code history for this folder (${cwd}).\nRun it inside a project you've used Claude Code in, or try: npx toldya --all`
    : `No Claude Code history found at ${CLAUDE_ROOT}.`);
  process.exit(0);
}

// Everything you typed, stamped with the session it came from.
const messages = [];
let sessions = 0;
for (const p of chosen) {
  const dir = join(CLAUDE_ROOT, p);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
    const ms = readClaudeSession(join(dir, f));
    if (ms.length) sessions++;
    for (const m of ms) messages.push({ ...m, session: `${p}/${f}` });
  }
}
const said = corrections(messages);
const retries = said.filter((i) => isRetry(i.s)).length;
const items = said.filter((i) => !isRetry(i.s));
const found = repeats(group(items), min);

// Where rules go, and what's already written there.
const target = resolve(opt('--to', all ? join(homedir(), '.claude', 'CLAUDE.md') : join(cwd, 'CLAUDE.md')));
const ruleFiles = [...new Set(all ? [target] : [target, join(cwd, 'CLAUDE.md'), join(cwd, 'AGENTS.md')])];
const written = ruleFiles.filter(existsSync).map((f) => readFileSync(f, 'utf8')).join('\n');

// Rules toldya added before, so we can count whether they worked.
const stateDir = join(homedir(), '.toldya');
const stateFile = join(stateDir, 'state.json');
// Rules are remembered per rule file: that's where they live.
const key = target;
let state = {};
try { state = JSON.parse(readFileSync(stateFile, 'utf8')); } catch {}
const ours = state[key]?.rules || [];

const dates = messages.map((m) => m.ts).filter(Boolean).sort();
const day = (t) => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '?');

if (has('--json')) {
  console.log(JSON.stringify({
    sessions, messages: messages.length, corrections: items.length, retries,
    from: dates[0] || null, to: dates.at(-1) || null,
    repeats: found.map((r) => ({ phrase: r.phrase, count: r.count, sessions: r.sessions,
      alreadyWritten: alreadyWritten(r.phrase, written) })),
    rules: ours.map((r) => ({ ...r, ...beforeAfter(r, items) })),
  }, null, 2));
  process.exit(0);
}

console.log(`\ntoldya · ${sessions} sessions (${day(dates[0])} – ${day(dates.at(-1))}) · ${messages.length} of your messages · ${items.length} corrections\n`);

if (ours.length) {
  console.log('Rules toldya added earlier:');
  for (const r of ours) {
    const { before, after } = beforeAfter(r, items);
    console.log(`  "${r.text}"  said ${before}× before · ${after}× since (added ${day(r.addedAt)})`);
  }
  console.log('');
}

const fresh = found.filter((r) => !ours.some((o) => o.text === toRule(r.phrase)));
if (!fresh.length) {
  console.log(found.length ? 'Nothing new you keep repeating. Nice.' : `No correction said ${min}+ times across sessions yet.`);
  process.exit(0);
}

if (has('--card')) {
  if (!found.length) { console.log(`No correction said ${min}+ times yet, so no card.`); process.exit(0); }
  const file = join(tmpdir(), 'toldya-card.html');
  writeFileSync(file, cardHtml({ repeats: found, sessions, from: day(dates[0]), to: day(dates.at(-1)) }));
  const open = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', file]]
    : [process.platform === 'darwin' ? 'open' : 'xdg-open', [file]];
  try { spawn(open[0], open[1], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref(); } catch {}
  console.log(`Your card: ${file}
It opens in your browser: save it as a PNG, then post it. Nothing leaves your machine unless you click share.`);
  process.exit(0);
}

console.log('You keep telling your AI:');
const shown = fresh.slice(0, 10);
shown.forEach((r, n) => {
  const note = alreadyWritten(r.phrase, written) ? '   ← already in your rules, still repeated' : '';
  console.log(`  ${String(n + 1).padStart(2)}. ${String(r.count).padStart(3)}×  ${r.phrase}   (${r.sessions} sessions)${note}`);
});
if (retries >= min) console.log(`\nAnd ${retries} times you told it to try or check again: its first go missed.`);
const spanDays = dates.length ? (new Date(dates.at(-1)) - new Date(dates[0])) / 864e5 : 0;
if (spanDays < 35) console.log('\nClaude Code keeps about 30 days of history by default, so older repeats are not counted.');

const picks = opt('--add', null);
if (has('--dry') || (!picks && !process.stdin.isTTY)) {
  if (!has('--dry')) console.log('\nRun in a terminal to add these as rules, or pick them with --add 1,3.');
  process.exit(0);
}

// Ask before touching any file (or take the numbers given). Each rule is your own words.
const add = [];
if (picks) {
  for (const n of String(picks).split(',').map((x) => parseInt(x, 10))) {
    const r = shown[n - 1];
    if (r && !alreadyWritten(r.phrase, written)) add.push(toRule(r.phrase));
  }
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\nAdd them to ${target}? For each: y = add, n = skip, e = edit the wording.\n`);
  for (const r of shown) {
    if (alreadyWritten(r.phrase, written)) continue;
    let text = toRule(r.phrase);
    const a = (await rl.question(`  ${text}  [y/n/e] `)).trim().toLowerCase();
    if (a === 'e') text = toRule((await rl.question('    new wording: ')).trim() || r.phrase);
    if (a === 'y' || a === 'e') add.push(text);
  }
  rl.close();
}

if (!add.length) { console.log('\nNothing added.'); process.exit(0); }

const heading = '## Things I kept repeating';
let doc = existsSync(target) ? readFileSync(target, 'utf8') : '';
const block = add.map((t) => `- ${t}`).join('\n');
if (doc.includes(heading)) doc = doc.replace(heading, `${heading}\n${block}`);
else doc = `${doc.replace(/\s*$/, '')}${doc ? '\n\n' : ''}${heading}\n${block}\n`;
mkdirSync(join(target, '..'), { recursive: true });
writeFileSync(target, doc);

const now = new Date().toISOString();
state[key] = { rules: [...ours, ...add.map((text) => ({ text, addedAt: now }))] };
mkdirSync(stateDir, { recursive: true });
writeFileSync(stateFile, JSON.stringify(state, null, 2));
const shortTarget = target.startsWith(cwd) ? target.slice(cwd.length + 1) : target.replace(homedir(), '~');
console.log(`\nAdded ${add.length} rule${add.length > 1 ? 's' : ''} to ${shortTarget}. Run toldya again in a week to see if they stuck.`);
