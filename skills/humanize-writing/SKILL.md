---
name: humanize-writing
description: "Advisory-only review of professional documents for AI-isms, LLM tells, and padding with shorter replacements; never edits the document. Use to humanize writing, sound less like AI, review for AI-isms, decide what to cut, or tighten a wordy draft, proposal, SoW, or report."
cowork:
  category: writing
  icon: TextEditStyle
---

## Overview

Reviews a finished professional document (proposal, SoW, report, memo, executive update) and flags where it reads as machine-written or padded. Each finding gives the quoted original, pattern name, and one shorter replacement.

**Advisory only — never edits the document.** Produces no revised file, tracked changes, or rewritten draft; the user decides what to apply.

Assumptions:
1. **Target a 25–40% cut on editable prose** (excluding tables, rate cards, signature blocks, boilerplate). Below 15%, the review was too timid — go again.
2. **Tells are symptoms, not the disease.** Swapping AI vocabulary without adding the missing specific fact is not a fix — flag what is missing instead.

References: detection catalogue `references/tells.md`, rewrite patterns `references/rewrite-playbook.md`.

## When to Use

- Document "reads like AI", "sounds off", or "isn't how we write".
- Draft going to a client, board, or regulator that must survive a human read.
- User wants to know what to cut and why before deciding themselves.
- User quotes an annoying sentence — treat it as a calibration sample and catch every instance of that pattern.

## When NOT to Use

- Applying changes or creating an edited/tracked-changes file → `docx`.
- Checking SoW clauses, structure, or completeness → `statement-of-work`.
- Writing a new document from scratch → `docx` (or `pptx`).
- Summarising or translating → not a prose review.
- Judging whether a person used AI → report text patterns only.

## Quick Start

```
1. Locate document (input/ → Teams → SharePoint → email) and extract full text
2. Run scripts/aiism_scan.py for mechanical tells and baseline word count
3. Read prose for judgement tells the script misses
4. Draft ONE shorter, plainer replacement per finding with the same facts
5. Report findings table in chat
```

## Core Instructions

### Step 1 — Locate and load the document

Check in order, stopping at the first hit:

| Where the user says it is | How to get it |
|---|---|
| Attached / uploaded | `Glob` on `input/**/*` and `grounding/**/*` |
| "X sent it in Teams" | `m365_teams-ListChatMessages(person=...)` → filename → `m365_search-SearchM365(sources=["files"])` → `sharepoint_onedrive-ReadFileContent(web_url=...)` |
| "it's in SharePoint/OneDrive" | `m365_search-SearchM365(sources=["files"])` then `sharepoint_onedrive-ReadFileContent` |
| "it's in my mail" | `outlook-ListMessages` / `outlook-GetMessage` for the attachment |
| Pasted into chat | Use the pasted text as-is |

`ReadFileContent` saves binaries (`.docx`/`.pdf) to the workspace and returns the path; extract text from it and confirm title, date, and author before reviewing.

### Step 2 — Scan

```bash
python scripts/aiism_scan.py "<path to .docx/.md/.txt>" --json
```

Counts mechanical tells (AI-vocabulary density, 30+ word sentences, enumeration run-ons, trailing "-ing" clauses, negative parallelisms, copula avoidance, puffery, meta commentary, spaced dashes, curly quotes, title-case headings) and baseline word count. Treat as a tripwire, not a verdict.

Then read the document for what regex misses: puffery, unfalsifiable claims, importance-claiming sentences, and duplicate points. See `references/tells.md`.

### Step 3 — Diagnose, in three passes, in this order

Analysis lenses, not edits; each adds findings.

**Pass 1 — Padding.** Cut throat-clearing openers, heading restatements, announcing sentences, hedge stacks, empty adverbs ("deliberately", "actually", "truly", "explicitly", "fully"), and nominalisations ("provides an assessment of" → "assesses").

**Pass 2 — Tells.** Work `references/tells.md` in priority order (definitions in `references/tells.md`; worked rewrites in `references/rewrite-playbook.md`):
1. **Meta commentary** — cut, or move commercial conditions to Assumptions.
2. **Enumeration run-ons** — lead-in sentence + bullets, padding stripped.
3. **Trailing "-ing" analysis** — cut, or promote to its own sentence.
4. **Copula avoidance** — replace with "is", "are", or "has".
5. **Negative parallelism** — flag all; keep at most one that earns it.
6. **Rule of three** — trim to items with distinct meaning, usually two.
7. **Puffery and AI vocabulary** — replace with the specific fact, or cut.

**Pass 3 — Read aloud.** Flag sentences the user would not say across a table to a client, and metronomic long-short-long LLM cadence.

### Step 4 — Report

Present findings in chat as a table (save to `output/` only if asked). Every finding requires four fields:
- **Where** — section or heading.
- **Which pattern** — named from `references/tells.md`.
- **Original, quoted verbatim** — never paraphrased.
- **One suggested replacement** — concrete wording, never "consider tightening".

For missing facts, suggest [specific needed — what number/name/date goes here?]`. End with counts and an offer to hand findings to `docx` to apply.

## Output

**Findings table**, ordered by severity (meta commentary/run-ons first, punctuation last), capped at top 12 with the rest as counts:

| Section | Pattern | Original | Suggested |
|---|---|---|---|
| Why Xebia fits here | Meta commentary | "Naming consent for these references has not yet been reconfirmed, so they are presented anonymously here…" | "References are available on request." — or cut and move to Assumptions |
| Services | 65-word enumeration run-on | "…the role definition and selection, the guardrails that make widened tooling safe, the training…" | Lead-in sentence + 6 bullets, "that …" padding stripped |

Then include:
- **Numbers** — current prose word count, estimated post-cut count and % (state whole-file figures separately when tables/boilerplate dominate).
- **Repeat offenders** — patterns appearing 5+ times, as count + 2 examples.
- **Open questions** — every suggestion needing a user-supplied fact.

Keep it scannable: 12 actionable findings beat a 40-row table nobody reads.

## Guardrails

- **Never edit the document.** No revised file, tracked changes, in-place edit, or writes to `output/` or SharePoint; applying changes is a separate `docx` request.
- **Never change a fact.** Preserve names, figures, dates, prices, entities, deliverables, defined terms, and legal wording verbatim.
- **Never invent missing facts.** Flag vague gaps as `[specific needed]`.
- **Skip contractual/boilerplate clauses** (terms, liability, signature blocks, governing law) unless asked.
- **Match the author's voice.** Follow the document's register and any user-quoted calibration samples, not a house style.
- **Never say a document or author "is AI-generated".** Report text patterns and locations only.
- **Do not suggest edit-to-evade.** If a section lacks substance, say so instead of polishing empty prose.
- **Confirm ambiguous documents first.** When multiple candidates match, list author and date and ask before reviewing.
- **Never send, reply, or post anything.** Deliver findings only to the user.
