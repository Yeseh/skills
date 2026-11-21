---
name: humanize-writing
description: |
  Reviews professional documents for AI-isms, non-human sounding text and padding, and
  reports findings with a suggested shorter replacement for each. Advisory only — it
  never edits the document or writes a revised file. Flags LLM tells: puffery,
  rule-of-three, "not X but Y", meta commentary about the document itself, trailing
  "-ing" analysis, spaced dashes, curly quotes, title-case headings.
  Use when user asks to "humanize this writing", "make this sound less like AI",
  "review this for AI-isms", "does this read as AI-written", "what should I cut",
  "where is this too wordy", or hands over a draft, proposal, SoW or report for a
  writing-quality review.
  Do NOT use to check a SoW's clauses or completeness — use statement-of-work. Do NOT
  use to apply the changes or produce an edited document — use docx.
cowork:
  category: writing
  icon: TextEditStyle
---

## Overview

Reads a finished professional document — proposal, Statement of Work, report, memo,
executive update — and reports where it reads as machine-written and where it is padded.
For each finding: the quoted original, the pattern it belongs to, and a suggested shorter
replacement.

**This skill does not edit anything.** It produces no revised file, no tracked changes and
no rewritten document. The user decides which suggestions to take and applies them. That
separation is the point: a findings list can be argued with line by line, a silently
rewritten document cannot.

Two assumptions are baked in:

1. **The text is longer than it needs to be.** Suggestions should land a 25–40% cut on the
   editable prose — measured excluding tables, rate cards, signature blocks and boilerplate,
   or the percentage lies. If the suggestions add up to less than 15%, the review was too
   timid — go again.
2. **The tells are symptoms, not the disease.** A sentence full of AI vocabulary is usually a
   sentence with nothing specific in it. A suggestion that swaps the vocabulary and keeps the
   vagueness is not a fix — say what the sentence is missing instead.

Detection catalogue: [references/tells.md](references/tells.md).
Suggestion patterns and worked before/afters: [references/rewrite-playbook.md](references/rewrite-playbook.md).

## When to Use

- The user shares a document and says it "reads like AI", "sounds off", or "isn't how we write".
- A draft is going to a client, a board or a regulator and has to survive a human read.
- The user wants to know what to cut, and why, before deciding themselves.
- The user quotes a specific sentence that annoys them — treat it as a calibration sample and
  find every other instance of the same pattern.

## When NOT to Use

- **Applying the changes, or producing an edited/tracked-changes file** — this skill only
  reports. Hand the findings to `docx` if the user then wants them applied.
- **Checking a SoW's clauses, structure or completeness** — use `statement-of-work`.
- **Writing a new document from scratch** — use `docx` (or `pptx` for a deck).
- **Summarising a document** — answer directly; this reviews prose, it does not condense meaning.
- **Translating** — a translation is a rewrite of someone else's words, not a review.
- **Detecting whether AI wrote something, as a verdict about a person.** Report patterns in the
  text, never a judgement about the author. Human writing hits these patterns too.

## Quick Start

```
User: "Review the SoW Wesley sent me — flag the AI-isms"
1. Locate the document (input/ → Teams → SharePoint → email) and extract its full text
2. Run scripts/aiism_scan.py for the mechanical tells and a word-count baseline
3. Read the prose yourself for the judgement tells the script cannot see
4. For each finding, draft ONE suggested replacement — shorter, plainer, same facts
5. Report the findings table in chat. Do not edit the document.
```

## Core Instructions

### Step 1 — Locate and load the document

Check in this order, and stop at the first hit:

| Where the user says it is | How to get it |
|---|---|
| Attached / uploaded | `Glob` on `input/**/*` and `grounding/**/*` |
| "X sent it in Teams" | `m365_teams-ListChatMessages(person=...)` → filename → `m365_search-SearchM365(sources=["files"])` → `sharepoint_onedrive-ReadFileContent(web_url=...)` |
| "it's in SharePoint/OneDrive" | `m365_search-SearchM365(sources=["files"])` then `sharepoint_onedrive-ReadFileContent` |
| "it's in my mail" | `outlook-ListMessages` / `outlook-GetMessage` for the attachment |
| Pasted into chat | Use the pasted text as-is |

`ReadFileContent` saves binaries (.docx/.pdf) to the workspace and returns the path — extract
the text from that path. Confirm you have the right file (title, date, author) before
reviewing. Read it, never write to it, and never touch the SharePoint original.

### Step 2 — Scan

```bash
python scripts/aiism_scan.py "<path to .docx/.md/.txt>" --json
```

It reports the mechanical, countable tells: AI-vocabulary density, sentences over 30 words,
enumeration run-ons, trailing "-ing" clauses, negative parallelisms, copula avoidance,
puffery, meta commentary, spaced dashes, curly quotes, title-case headings, and the baseline
word count. It is a tripwire, not a verdict — a clean scan does not mean clean prose.

Then read the document yourself for what no regex catches: puffery, unfalsifiable claims,
sentences that assert importance instead of stating a fact, and paragraphs that say the same
thing twice. See [references/tells.md](references/tells.md).

### Step 3 — Diagnose, in three passes, in this order

The passes are analysis lenses, not edits. Each one adds findings to the list.

**Pass 1 — Padding.** What can go without losing meaning: throat-clearing openers,
restatements of the heading, sentences that only announce what the next sentence says, hedge
stacks, and every adverb that is not doing work ("deliberately", "actually", "truly",
"explicitly", "fully"). Nominalisations that should be verbs: "provides an assessment of" →
"assesses".

**Pass 2 — Tells.** Work the catalogue in `references/tells.md`. The high-yield ones for
business documents, in order:
1. **Meta commentary** — any sentence about the document, its drafting, what could not be
   confirmed, or what the reader might want next. Suggest cutting it, or if it encodes a
   genuine commercial condition, suggest moving it to Assumptions as a condition.
2. **Enumeration run-ons** — a colon followed by five or six comma-joined items, each padded
   with a relative clause. Suggest a lead-in sentence plus a bulleted list, padding stripped.
3. **Trailing "-ing" analysis** — "…, ensuring X", "…, highlighting Y", "…, reflecting Z".
   Suggest cutting, or promoting to its own sentence with a subject.
4. **Copula avoidance** — "serves as", "stands as", "represents", "boasts", "features" →
   "is", "are", "has".
5. **Negative parallelism** — "not only … but also", "It's not X, it's Y", "X rather than Y".
   Flag all instances, recommend keeping at most one, and say which one earns it.
6. **Rule of three** — triples trimmed to the items carrying distinct meaning, usually two.
7. **Puffery and AI vocabulary** — the specific fact instead, or cut the clause.

**Pass 3 — Read aloud.** Any sentence the user would not say to the client across a table
gets a finding. Watch cadence: LLM prose alternates long-short-long in a metronome.

### Step 4 — Report

Findings go in chat, as a table. Nothing is written to the document and nothing is saved to
`output/` unless the user explicitly asks for the findings as a file.

Every finding needs four things, or it is not a finding:
- **Where** — section or heading, so it can be found in the document.
- **Which pattern** — named from the catalogue, so the user learns to see it themselves.
- **The original, quoted verbatim** — never paraphrased. The user has to be able to disagree.
- **One suggested replacement** — concrete text, not "consider tightening". Give the words.

Where a sentence is vague because the underlying fact is missing, the suggestion is
`[specific needed — what number/name/date goes here?]`. Never supply a plausible fact.

End with the counts and an offer to hand the findings to `docx` for applying, if they want
that as a next step.

## Output

**A findings table**, ordered by severity, not by page: meta commentary and run-ons first,
punctuation last. Cap it at the 12 most significant and note the rest as counts.

| Section | Pattern | Original | Suggested |
|---|---|---|---|
| Why Xebia fits here | Meta commentary | "Naming consent for these references has not yet been reconfirmed, so they are presented anonymously here…" | "References are available on request." — or cut and move to Assumptions |
| Services | 65-word enumeration run-on | "…the role definition and selection, the guardrails that make widened tooling safe, the training…" | Lead-in sentence + 6 bullets, "that …" padding stripped |

Then:
- **Numbers** — current prose word count, estimated count if all suggestions are taken, and the
  percentage. State the whole-file figure separately when tables and boilerplate are a large
  share.
- **Repeat offenders** — patterns appearing 5+ times, as a count with 2 examples, not 30 rows.
- **Open questions** — every place a suggestion needs a fact only the user has.

Keep it scannable. A 40-row table nobody reads is worse than 12 findings that get acted on.

## Guardrails

- **Never edit the document.** No revised file, no tracked changes, no in-place edit, no write
  to `output/` or SharePoint. Suggest text; the user applies it. If they ask you to apply the
  changes afterwards, that is a new request for `docx`.
- **Never change a fact, even in a suggestion.** Names, figures, dates, prices, entities,
  deliverables, defined terms and legal wording stay exactly as written. If a suggested cut
  would drop a number, keep the number.
- **Never invent to fill a gap.** If a sentence is vague because the fact is missing, flag it
  as `[specific needed]` — do not supply a plausible one.
- **Do not raise findings on contractual or boilerplate clauses** (terms, liability, signature
  blocks, governing law) unless the user asks. Wordiness there is often deliberate.
- **Suggest in the author's voice, don't impose one.** Match the register already in the
  document. If the user quotes a sentence they dislike, that is the calibration — apply their
  taste, not a house style.
- **Never say a document, or its author, "is AI-generated".** Report patterns and locations.
  Detection tools and human intuition are both unreliable at this; a finding is evidence about
  the prose, nothing more.
- **Do not suggest edit-to-evade.** If a section is empty of content, say so rather than
  proposing wording that makes the emptiness read more naturally.
- **Confirm which document before reviewing when more than one candidate matches.** List the
  candidates with author and date and ask. A confident review of the wrong draft is worse than
  a question.
- **Never send, reply or post anything.** The findings go to the user, not to the document's
  author.
