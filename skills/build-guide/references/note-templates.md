# Note templates

The guide is a set of Obsidian notes in `/home/jesse/repo/note-vault/Me/Side Projects/<Project>/`. Read the vault `AGENTS.md` before you write. Read `Me/Side Projects/Zandbox/` for a complete example at the light level.

## Vault rules that matter here

- Side-project notes start with a tag line, not YAML frontmatter: `#side-project #<language> #<topic>`. Part notes use one tag: `#<project-lowercase>`.
- Use `[[wikilinks]]` for links between notes. Use normal Markdown links for external URLs.
- Keep the file name and the note title the same.
- Do not change other notes in the vault. If a matching note exists (for example `Research/Zig compiler.md`), link to it with `[[...]]`. Do not edit it.
- Checkboxes are plain `- [ ]`. Do not add tags or Tasks fields to them.

## Mermaid rules

- Put each label in double quotes: `A["label text"]`.
- Do not use `<br/>` or other HTML in labels.
- Do not use `<` in labels. Write "less than" or rephrase.
- Use `flowchart` (LR or TB/TD) for structure and flows, `sequenceDiagram` for handshakes between processes, and tables for comparisons.
- Keep a diagram to about 12 nodes or fewer. Split a larger diagram into two.

## Index note: `<Project>.md`

```markdown
#side-project #<language> #<topic>

## Description

<2–4 sentences: what the project is, and what the finished system does.>

The guide below tells **what** to build and **why**, but not **how**. Each part ends with a milestone that you can run. Detail level: **<light|medium|heavy>**.

## Architecture

```mermaid
<one diagram of the finished system>
```

## Parts

| Part | Adds | Milestone |
| --- | --- | --- |
| [[<Project> 00 - The map]] | ... | ... |
| ... | ... | ... |

## Key resources

- <3–6 links that are useful for the whole project: main docs, a book, a reference implementation>

> [!tip] When stuck
> <the general debugging method for this domain>
```

## Part note: `<Project> NN - <Title>.md`

Sections marked (M) are for medium and heavy. Sections marked (H) are for heavy only.

```markdown
#<project-lowercase>

Part of [[<Project>]] · prev: [[<previous part>]] · next: [[<next part>]]

**Adds:** <short list of what this part adds>
**Goal:** <one sentence: what works at the end of this part>

> [!info] Why
> <2–4 sentences: the problem that this layer solves, and the risk if it is missing.>

## Concepts (M)

<For each new mechanism: 2–5 sentences, terms defined at first use, inline links.>

<diagram>

## What to build

1. **<Step name>.** <What to build and why. (M) Name the API or technique, add an inline link, add a "Start here" hint if needed.>
   (H) Outline: <pseudocode or plain-word sequence>
2. ...

## Shapes (H)

| Item | Fields / signature | Purpose |
| --- | --- | --- |

## Read up on

<Names of man pages, specs, std modules, separated by " · ". Use links when they are verified.>

## Done when

- [ ] <a test that the user can run, with the command and the expected result>
- [ ] ...

## Traps

> [!warning] <short name of the trap>
> <1–3 sentences: what goes wrong and how to prevent it.>

## Check your design (H)

> [!question] <question>
```

## Content rules

- Each "What to build" step tells WHAT and WHY. It does not give the code. Pseudocode in heavy mode must not compile in the target language.
- Each "Done when" item is a test with a command and an expected result. "The code works" is not a test.
- Each trap names a real failure that people get often in this domain.
- Put the critical order of operations (if one exists) in Part 00 as a diagram. Refer to it from each part that adds steps to it.
