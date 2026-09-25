import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corrections, group, repeats, similar, alreadyWritten, beforeAfter, toRule, encodeProject } from '../lib/core.mjs';

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
