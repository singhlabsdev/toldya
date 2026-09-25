# toldya

**Stop repeating yourself to your AI.**

You keep telling your coding agent the same things. "Don't create a new file." "Use pnpm."
"Run the tests before you say it's done." toldya finds what you keep repeating, writes it into
the rule file your agent reads (`CLAUDE.md` / `AGENTS.md`), then counts whether it stopped.

## Status

`0.0.1` reserves the name and does nothing else: it prints what's coming, reads nothing and
writes nothing. **v0.1** is being built.

## Planned for v0.1

- **Solo mode:** `npx toldya` reads your local Claude Code and Codex history, finds the corrections
  you repeat, and offers lines for `CLAUDE.md`. You approve each one. Nothing leaves your machine.
- **Team mode:** `npx toldya owner/repo` reads a repo's pull-request review comments (from people
  or any review bot), finds the repeats, and opens one PR adding them to `AGENTS.md`.
- **Count:** next run shows how often each repeat came back after the rule was added.

No account. No telemetry.

## License

MIT © Sevenopt Solutions Private Limited (Singh Labs)
