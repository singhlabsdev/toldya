#!/usr/bin/env node
// toldya 0.0.1 — the name is reserved while v0.1 is built. This version only
// says what's coming, so nobody installs it expecting it to change a file.

const lines = [
  '',
  '  toldya — stop repeating yourself to your AI.',
  '',
  '  Coming in v0.1:',
  '    npx toldya              read your Claude Code / Codex history, find what you',
  '                            keep telling the AI, offer lines for CLAUDE.md',
  '    npx toldya owner/repo   read a repo\'s PR review comments, find the repeats,',
  '                            open one PR into AGENTS.md',
  '',
  '  This version does nothing else. It reads nothing and writes nothing.',
  '  Follow along: https://github.com/singhlabsdev/toldya',
  '',
];
process.stdout.write(lines.join('\n') + '\n');
