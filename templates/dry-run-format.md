# Dry run format

Before you change a locked file, post a **dry run**. Then stop and wait for the user's go. The gate blocks code edits until then.

A locked file is a code or test file. The gate decides by the file ending. Notes, config and data files are free.

## Headings

Use these headings, exactly as written, in this order. The mod finds a dry run by an exact heading match. A message that lacks a required heading is not a dry run.

```
## Dry run
### 1. Bug and goal
### 2. Change table
### 3. SOLID
### 4. Pattern
### 5. DSA
### 6. Worked example
### 7. Open decisions
### 8. Language explainer
```

## Sections

╔════╦════════════════════╦══════════════════════════════════╦═══════════════════════════════════════════════════╗
║ #  ║ Section            ║ Required                         ║ Shortest allowed form                             ║
╠════╬════════════════════╬══════════════════════════════════╬═══════════════════════════════════════════════════╣
║ 1  ║ Bug and goal       ║ always                           ║ `**Bug:** none` + `**Goal:** <1 line>`            ║
║ 2  ║ Change table       ║ always                           ║ 1 row: file path, what changes, why               ║
║ 3  ║ SOLID              ║ always                           ║ `None at stake: <reason>`                         ║
║ 4  ║ Pattern            ║ always                           ║ `**Chosen:** none` + `No pattern, because <why>`  ║
║ 5  ║ DSA                ║ always                           ║ `**Chosen:** none` + `None: plain loop`           ║
║ 6  ║ Worked example     ║ always                           ║ `input → old → new` with real values              ║
║ 7  ║ Open decisions     ║ always                           ║ 2 options at most + context + your pick           ║
║ 8  ║ Language explainer ║ `explainLanguage` is set AND a   ║ construct table + flow on one real input          ║
║    ║                    ║ changed file is in another lang. ║                                                   ║
╚════╩════════════════════╩══════════════════════════════════╩═══════════════════════════════════════════════════╝

## Rules

- **Order.** Sections 3 to 5 come after the change table and before the worked example. So the example shows the design working.
- **No tiny mode.** Every required heading is always there. Use the shortest allowed form when a section has nothing to say.
- **Change table.** The first column is the file path. The mod reads the path endings to decide if section 8 is required.
- **SOLID.** List only the principles really in play. Maximum 3. Use a box table with: principle, where in the code, why. Never list all 5 with "n/a".
- **Pattern.** First line: `**Chosen:** <name>`. The name comes from the 12-pattern list in `dry-run-design.md`, or it is `none`. Then say why it wins. Then name exactly one rejected alternative and say why it loses. Repo rules win: "no pattern, because speculative" is valid.
- **DSA.** First line: `**Chosen:** <name>`. The name is one of the 27 names in `dry-run-dsa.md`, or `none`. Then one line of why. Then the Big-O (required). Then up to 3 links, copied from `dry-run-dsa.md` only. A name off the list is allowed. It just has no verified link.
- **Links.** Always write the verified LeetCode links. Do not look up the user's solved cards. The pane does that.
- **Explain once.** Explain each construct once per session. A later dry run explains only the new constructs.
- **Reader's language.** When `explainLanguage` is set, write code for a reader of that language: plain loops, a few short methods, `split` before regex.
- **Revisions.** When the user asks for a change, post the whole dry run again with all headings. Each new dry run locks the gate again. The next go approves the newest one.
