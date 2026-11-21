---
name: build-guide
description: "Layered build-it-yourself implementation guide in note-vault Obsidian notes: what/why, diagrams, milestones, traps, links—no solution code. Asks detail level first; ASD-STE100 (~80%). Use for build guides, learning paths, 'guide me through building X', or project roadmaps for learning."
---

# Build guide

Write a guide that lets the user build a project by themselves. The guide is a map, not a solution. It tells the user what to build, why it matters, and where to read. The user writes all the code.

The model example of this kind of guide is the Zandbox guide in `note-vault/Me/Side Projects/Zandbox/` (agent sandbox in Zig). That guide is at the **light** level. Read `Zandbox.md` and one part note before you start, so you match the structure and the tone.

## Step 1: Ask the detail level first

Before you do any research or writing, ask the user which detail level they want. Use the AskUserQuestion tool. Put the detail level question first. In the same call, ask only for the information that is missing from the request (for example: the language, the target platform, the project name, or the scope).

The three levels (full definitions with examples are in `ref::detail-levels`):

| Level | For | Contains |
| --- | --- | --- |
| **Light** | Topics the user knows well | What + why, milestones, traps, read-up list |
| **Medium** | Topics that are new to the user | Light + concept explanations, named techniques and APIs, "start here" hints, inline links in each step |
| **Heavy** | Topics that are very new or very hard | Medium + step outlines, API shapes and data-structure sketches in pseudocode, a "check your design" question per part |

Recommend **medium** when the user says the topic is new to them. Never give the full solution code at any level. The user wants to learn by doing, and complete code removes the reason for the guide.

## Step 2: Research the topic

1. Identify the concepts, in dependency order. Each concept becomes a layer that the user can build and test alone.
2. Collect resources for each part: official documentation, man pages, specifications, RFCs, well-known books or articles, and reference implementations to compare against. Prefer canonical sources (official docs, man7.org, kernel.org, language std docs, RFC Editor) to blog posts.
3. Verify each link before you use it. Use WebFetch or WebSearch when they are available. If you cannot verify a link, give the name of the document and the site (for example "`seccomp(2)` on man7.org") and no URL. Do not invent URLs. A broken link costs the user time and trust.
4. Note version-sensitive APIs (for example the Zig std library). Tell the user to pin a version and to read the docs for that version.

## Step 3: Plan the parts

Use this sequence. Adapt the number of middle parts to the topic (usually 5 to 9).

- **Part 00 – The map.** Threat model or problem statement, architecture diagram, the layers, the critical order of operations (if there is one), prerequisites, and the language concepts that the project uses again and again.
- **Parts 01…N – One layer each.** Each part ends with a milestone that the user can run and test. Put the parts in dependency order. A part must not need a later part.
- **Second-last part – Test or break it.** A test or attack matrix that connects each failure to the layer that must prevent it.
- **Last part – Beyond.** Optional stretch goals.

Before you write, show the part list to the user in a short table (part, what it adds, milestone). Continue when the user agrees.

## Step 4: Write the notes

Write the guide as Obsidian notes in the vault. Read `ref::note-templates` for the exact templates and the vault conventions.

- Vault: `var::note_vault_path`. Obey its `AGENTS.md`.
- Folder: `Me/Side Projects/<Project>/`.
- Files: `<Project>.md` (the index note) and one note per part: `<Project> 00 - <Title>.md`, `<Project> 01 - <Title>.md`, and so on.
- Diagrams: Mermaid code blocks. Obsidian shows them. Give each part at least one diagram when a diagram explains the mechanism better than text (flows, sequences, layers, trees, data layouts).
- Milestones: plain Markdown checkboxes (do not add tags such as `#inbox` or `#weekly` to them, because the vault Tasks queries collect tasks by tag).
- Resources: put links **inline**, at the step where the user needs them. Also keep a short "Read up on" list at the end of each part. A link in the step is more useful than a link list at the bottom of the note.

## Step 5: Write in ASD-STE100 (about 80%)

Read `ref::ste100` before you write. Apply the strict rules to all instructions, milestones, and traps. Apply the relaxed rules to explanations of concepts. Technical names (API names, syscalls, file names, flags) are always permitted.

When the notes are complete, run the checker on the project folder. The script is in the `scripts/` folder of this skill (the folder that contains this SKILL.md):

```bash
python3 <skill-folder>/scripts/ste_check.py "/home/jesse/repo/note-vault/Me/Side Projects/<Project>"
```

The target is a score of 80% or more. If the score is lower, rewrite the sentences that the checker shows and run it again. The checker uses simple rules, so it cannot find all problems and it shows some false positives. Use your judgment: if a flagged sentence is clear and a rewrite makes it worse, keep it.

The checker examines only mechanical rules (length, listed words, phrasal verbs, passive voice, contractions). It does not examine word choice, consistent terms, or tone. Thus a pass is necessary but not sufficient. After it passes, read one part note again against the strict rules in `ref::ste100`. Look for casual phrases, changes in the name of a component, and instructions that are not in the imperative. Correct the same problems in all notes.

## Step 6: Report

Tell the user:
- the folder and the list of notes,
- the detail level and the STE score,
- the links that you could not verify (if any).

Do not commit to git unless the user asks.
