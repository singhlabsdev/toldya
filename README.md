# toldya

**Stop repeating yourself to your AI.**

You keep telling your coding agent the same things. "Keep it simple." "Don't complicate it."
"Check again." toldya reads what you typed to Claude Code, finds the corrections you keep
repeating, offers each one as a line for your `CLAUDE.md`, and next time counts whether you
still have to say it.

```bash
npx toldya --all --dry
```

This is a real run, on the author's own history:

```
toldya · 142 sessions (2 Jul – 25 Sept) · 6355 of your messages · 600 corrections

You keep telling your AI:
   40×  keep it simple   (36 sessions)
   38×  try again   (25 sessions)
   19×  Don't complicate it   (14 sessions)
   18×  check again   (10 sessions)
   11×  dont assume   (11 sessions)
```

## Use it

```bash
npx toldya            # this project: offers rules for ./CLAUDE.md
npx toldya --all      # every project: offers rules for ~/.claude/CLAUDE.md
npx toldya --dry      # report only, change nothing
npx toldya --json     # machine-readable report
npx toldya --min 5    # only things you said 5+ times
```

Without `--dry`, it asks about each repeat: **y** adds it, **n** skips it, **e** lets you reword
it first. Rules go under a `## Things I kept repeating` heading. Nothing is written without a yes.

Run it again a week later and it shows, for every rule it added, how often you said it before
and how often since.

## What it reads, and what it doesn't

- Only **your own messages** in Claude Code's history on this machine
  (`~/.claude/projects`). Not the AI's replies, not tool output, not files.
- Long messages are treated as pastes (briefs, logs) and skipped. Questions and "I don't
  understand" are not corrections, so they're skipped too.
- A repeat counts only if it shows up in **at least two sessions**.
- **Sends nothing anywhere.** No account, no telemetry, no network calls.

Claude Code keeps about 30 days of history by default, so toldya sees roughly a month.

## Coming next

- **Team mode:** `npx toldya owner/repo` reads a repo's pull-request review comments (from people
  or any review bot), finds what reviewers keep writing, and opens one PR into `AGENTS.md`.
- Codex history (not tested on real files yet, so not claimed).

## Requirements

Node 18+. No dependencies.

## License

MIT © Sevenopt Solutions Private Limited (Singh Labs)
