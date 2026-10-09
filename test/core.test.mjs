import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardHtml } from '../lib/card.mjs';
import { corrections, group, repeats, similar, alreadyWritten, beforeAfter, toRule, encodeProject, isRetry } from '../lib/core.mjs';

const msg = (text, session, ts = '2026-09-01T00:00:00Z') => ({ text, session, ts });

test('finds a correction repeated across sessions, ignoring typos and noise', () => {
  const ms = [
    msg("don't complicate it", 'a'), msg('dont comlicate that', 'b'), msg("Don't complicate it.", 'c'),
    msg('i dont understand this', 'a'), msg('i dont understanfd this', 'b'), msg('i dont understand this', 'c'),
    msg('why is the build red?', 'a'),
    msg('x'.repeat(700) + " don't do that", 'b'), // a paste, not something you said
  ];
  const found = repeats(group(corrections(ms)), 3);
  assert.equal(found.length, 1);
  assert.equal(found[0].count, 3);
  assert.equal(found[0].sessions, 3);
  assert.match(found[0].phrase, /complicate/i);
});

test('one session repeating itself is not a habit', () => {
  const ms = ['keep it simple', 'keep it simple', 'keep it simple'].map((t) => msg(t, 'only'));
  assert.equal(repeats(group(corrections(ms)), 3).length, 0);
});

test('rules, already-written check, before/after count', () => {
  assert.equal(toRule('keep it simple'), 'Keep it simple.');
  assert.ok(alreadyWritten('keep it simple', '# Rules\n- Keep it simple.\n'));
  assert.ok(!alreadyWritten('use pnpm not npm', '- Keep it simple.'));
  assert.ok(similar("don't assume", 'dont assume anything') >= 0.5);
  const items = corrections([
    msg('keep it simple', 'a', '2026-09-01T00:00:00Z'),
    msg('keep it simple', 'b', '2026-09-02T00:00:00Z'),
    msg('keep it simple', 'c', '2026-09-20T00:00:00Z'),
  ]);
  assert.deepEqual(beforeAfter({ text: 'Keep it simple.', addedAt: '2026-09-10T00:00:00Z' }, items), { before: 2, after: 1 });
  assert.equal(encodeProject(String.raw`D:\My work\app`), 'D--My-work-app');
});

test('rewordings merge; try-again is a retry, not a rule', () => {
  assert.ok(similar("Don't complicate it", 'dont complex this') >= 0.5);
  for (const t of ['try again', 'please check again', 'ok try again', 'Try again.', 'so try again', 'connected again']) assert.ok(isRetry(t), t);
  assert.ok(!isRetry("don't try to fix everything again"));
});

test('card keeps a phrase inside its script block', () => {
  const html = cardHtml({ repeats: [{ count: 3, phrase: 'stop </script><b>' }], sessions: 2, from: 'a', to: 'b' });
  assert.equal(html.match(/<\/script>/g).length, 1);
  assert.ok(html.includes('stop ' + String.fromCharCode(92) + 'u003c/script>'));
});

test('plugin skill and manifest pin the version being released', async () => {
  const { readFileSync } = await import('node:fs');
  const v = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version;
  const skill = readFileSync(new URL('../skills/toldya/SKILL.md', import.meta.url), 'utf8');
  const pins = [...skill.matchAll(/toldya@([\w.-]+)/g)].map((m) => m[1]);
  assert.ok(pins.length && pins.every((p) => p === v), `SKILL.md pins ${pins} but package.json is ${v}`);
  assert.equal(JSON.parse(readFileSync(new URL('../.claude-plugin/plugin.json', import.meta.url))).version, v);
});

test('a resumed session copies the old messages: each one counts once, in the session it was typed in', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const line = (uuid, sessionId, ts, text) => JSON.stringify({ type: 'user', uuid, sessionId, timestamp: ts, message: { role: 'user', content: text } });
  const typed = ['u1', 'u2', 'u3'].map((u, i) => [u, `2026-09-01T10:0${i}:00Z`, 'keep it simple']);
  const run = (resumedAlso) => {
    const home = mkdtempSync(join(tmpdir(), 'toldya-'));
    const dir = join(home, '.claude', 'projects', 'D--app');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'b-old.jsonl'), typed.map(([u, ts, t]) => line(u, 'b-old', ts, t)).join('\n'));
    // Named to sort first, so reading files in directory order would credit the copies to it.
    writeFileSync(join(dir, 'a-resumed.jsonl'), [...typed, ...resumedAlso].map(([u, ts, t]) => line(u, 'a-resumed', ts, t)).join('\n'));
    const out = execFileSync(process.execPath, [fileURLToPath(new URL('../bin/toldya.mjs', import.meta.url)), '--all', '--json'],
      { cwd: home, env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: 'utf8' });
    return JSON.parse(out);
  };
  // Copies alone: said 3 times in one session, so not a habit yet.
  let r = run([['u4', '2026-09-02T10:00:00Z', 'why is the build red?']]);
  assert.equal(r.messages, 4);
  assert.deepEqual(r.repeats, []);
  // Said once more after resuming: 4 times, in 2 sessions.
  r = run([['u4', '2026-09-02T10:00:00Z', 'keep it simple']]);
  assert.equal(r.messages, 4);
  assert.equal(r.sessions, 2);
  assert.deepEqual(r.repeats.map((x) => [x.phrase, x.count, x.sessions]), [['keep it simple', 4, 2]]);
});
