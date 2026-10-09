---
name: toldya
description: >
  Finds what the user keeps repeating to Claude Code (corrections like "keep it
  simple" or "don't assume", said again and again across sessions) and, only
  with their approval, writes them into CLAUDE.md or AGENTS.md as rules. Later
  runs show how often each added rule was said before and since. Use when the
  user says "toldya", "what do I keep repeating", "what do I keep telling you",
  "turn my corrections into rules", "update my CLAUDE.md from my history",
  "why do I keep having to say this", or asks whether a rule they added
  actually worked. Do NOT use to write rules the user never said.
argument-hint: "[--all]"
license: MIT
---

# toldya

toldya is a zero-dependency CLI (Node 18+). It reads the user's own Claude Code
history in `~/.claude/projects` on this machine and sends nothing anywhere.

## Steps

1. **Report first, change nothing.** Run it for this project, or every project
   if the user asked for everything or passed `--all`:

   ```bash
   npx -y toldya@0.3.5 --dry          # this project
   npx -y toldya@0.3.5 --all --dry    # every project, rules go to ~/.claude/CLAUDE.md
   ```

   Show the numbered list exactly as printed. Do not reword, merge or
   re-rank it: those are the user's own words and counts.

2. **Ask which to add.** Ask the user which numbers to keep, and whether any
   wording should change. Suggest tidying obvious typos, but never add a rule
   they didn't pick.

3. **Write only what they picked.** The Bash tool has no interactive prompt,
   so pass the numbers:

   ```bash
   npx -y toldya@0.3.5 --add 1,3              # this project's CLAUDE.md
   npx -y toldya@0.3.5 --all --add 1,3        # global ~/.claude/CLAUDE.md
   npx -y toldya@0.3.5 --add 1,3 --to AGENTS.md
   ```

   If they asked for reworded rules, add them with toldya first, then edit the
   written lines in the file to their wording.

4. **Say how to check it worked.** Run toldya again in a week: each added rule
   shows how often it was said before and since it went in.

## Notes

- "Nothing repeated yet" is a normal result for new users, not an error.
- It needs a phrase said at least 3 times across at least 2 sessions
  (`--min N` changes the 3).
- `--card` draws a shareable image of the top repeats and opens it in the
  browser. Only run it if the user asks.
