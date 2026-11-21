# Detection catalogue — signs of AI writing in professional documents

Adapted for business documents from *Wikipedia:Signs of AI writing*
(https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing, CC BY-SA 4.0), which is written for
encyclopedia articles. Signs that only matter on Wikipedia (wikitext markup, notability language,
citation quirks) are dropped here; signs that matter in a proposal, SoW or report are kept and
re-weighted.

**Four rules for using this list.**

1. **These are signs, not proof.** Humans write this way too, and heavily so in marketing and
   consulting prose. One hit is noise. A dense cluster across a document is the signal.
2. **Never conclude "this was written by AI"** about a document or a person. Report the pattern,
   its location, and what you would put there instead.
3. **The tell is rarely the real problem.** Puffery marks a sentence with no fact in it; a
   trailing "-ing" clause usually marks an unsupported claim. Naming only the surface makes the
   document harder to diagnose. Say what the tell is covering for.
4. **Every "Suggest:" below is a recommendation to report, not an edit to make.** This skill
   never touches the document. The user decides which suggestions to take.

---

## Tier 1 — Highest yield in business documents

### Meta commentary about the document itself
The document narrating its own construction, its status, or what the author could not verify.
Almost always an artefact of the instruction given to the model, repeated back into the output.

Watch for: "This document is deliberately issued as…", "…has not yet been reconfirmed, so…",
"…is presented here as…", "for the purposes of this section", "as outlined above", "it should be
noted that", "we can provide … on request once …", "the honest order", "we would rather … than …".

Suggest: cut it. If it encodes a real commercial condition, move it to Assumptions and write it as a
condition ("References are available on request."), not as a confession.

### Enumeration run-ons
A colon or dash, then five or six comma-joined items, each inflated with a relative clause that
restates the item's own purpose ("the guardrails that make widened tooling safe" — guardrails).
Reads as comprehensive; carries less than a bulleted list a third the length.

Suggest: one short sentence, then a list. Strip every "that …" clause that only re-explains its noun.

### Trailing "-ing" analysis
A participle clause bolted to the end of a sentence to editorialise on what was just said:
"…, ensuring alignment", "…, highlighting its importance", "…, reflecting the broader shift",
"…, contributing to", "…, fostering", "…, underscoring", "…, enabling", "…, cultivating".

Suggest: delete it. If the claim matters, give it a subject and a verb of its own — and a source.

### Puffery and self-congratulation
Importance asserted instead of demonstrated. Words to watch: *robust, comprehensive, holistic,
seamless, cutting-edge, world-class, best-in-class, unparalleled, proven, deep expertise,
commitment to, tailored, bespoke, vibrant, rich, profound, groundbreaking, renowned, showcasing,
exemplifies, boasts, dedicated to delivering, at the heart of*.

Suggest: replace with the specific fact that earned the adjective, or cut the clause. "Deep expertise
in Power Platform" → the number of engagements, or nothing.

### Undue emphasis on significance and broader trends
Sentences that situate an ordinary item in a sweeping narrative: *stands as / serves as a
testament to, plays a crucial/pivotal/vital/key role, underscores the importance of, reflects a
broader shift, marks a turning point, in today's rapidly evolving landscape, setting the stage
for, in an era of*.

Suggest: cut. A client buying a training programme does not need the era contextualised.

### Vague attribution and weasel claims
*Industry reports suggest, experts agree, studies show, it is widely recognised, many
organisations, best practice dictates, research indicates* — with nothing named.

Suggest: name the source and the number, or delete the sentence. In a proposal, an unattributed
statistic is a liability.

---

## Tier 2 — Sentence-level language tells

### AI vocabulary, at density
One is coincidence; a paragraph of them is a signature. *Additionally* (opening a sentence),
*align with, boasts, bolstered, crucial, delve, deep dive, emphasizing, enduring, enhance,
foster(ing), garner, highlight* (as a verb), *interplay, intricate, key* (adjective), *landscape*
(abstract), *leverage, meticulous, navigate* (abstract), *pivotal, realm, robust, seamless,
showcase, streamline, tapestry, testament, underscore, valuable, vibrant*.

The set drifts by model generation — *delve* and *tapestry* date a 2023–24 draft; *showcasing*,
*emphasizing*, *enhance*, *highlighting* mark later ones. Judge density, not any single word, and
do not assume a word's synonyms are equally suspect.

### Copula avoidance
LLMs dodge plain *is / are / has*: **serves as, stands as, functions as, operates as, represents,
marks, features, offers, boasts, maintains, refers to**. Also inflated career verbs — "ventured
into consulting as" for "was a consultant".

Suggest: "The workshop serves as the starting point" → "The workshop is the starting point."

### Negative parallelism
- *Not only X, but also Y*
- *It's not X, it's Y* / *That is not a stylistic preference: …*
- *X rather than Y* / *no X, no Y, just Z*

Genuinely useful once per document, where the contrast is the point. Three times is a tic.

### Rule of three
Triples everywhere: three adjectives, three clauses, three bullets. Often the third item is
filler that repeats the second.

Suggest: keep the items that carry distinct meaning — usually two. Vary list lengths across the doc.

### Vague expression of connection
*in connection with, associated with, in association with, related to, in the context of* where a
plain preposition or a named relationship would do (*of, for, by, built with, caused by, used in*).

### "Despite the challenges" conclusions
A closing paragraph that concedes difficulties in the abstract and then reassures in the abstract:
"Despite these challenges, the programme is well positioned to…". Also section headings named
*Challenges, Future Outlook, Key Takeaways, Conclusion* appended out of habit.

Suggest: name the actual risk with an owner and a mitigation, or delete the paragraph.

### Symmetry and cadence
Paragraphs of near-identical length; every section opening with the same construction; a
metronomic long-short-long sentence rhythm. Human documents are lumpier.

---

## Tier 3 — Formatting and punctuation

Weak on their own — a Word template or an editor produces several of these. Useful as
corroboration, and cheap to fix.

| Tell | What to look for | Suggest |
|---|---|---|
| Spaced dashes | ` - ` or ` — ` used where a comma, colon or parentheses belongs; several per page | Re-punctuate; keep at most one or two em dashes per page, unspaced or per house style |
| Curly quotes / apostrophes | `“ ” ’` mixed inconsistently with `" '` in the same document | Normalise to one convention (Word's smart quotes alone prove nothing) |
| Title Case Headings | "Our Approach And Next Steps" | Sentence case, unless house style says otherwise |
| Bold overuse | Every instance of a key phrase bolded; "key takeaways" bolding inside prose | Bold for defined terms and true emphasis only |
| Inline-header bullets | Every bullet as **Bold header:** then a sentence, mechanically, for a whole section | Fine occasionally; alternate with plain bullets and prose |
| Emoji as structure | Emoji in front of headings or bullets | Remove from professional documents |
| Heading stacks | A heading whose only content is more headings | Add a line of prose, or merge the levels |
| Unneeded tables | A two-row table for what is one sentence | Convert to prose |
| Thematic breaks | `---` between every section | Remove; headings already separate sections |
| Number style drift | "twenty-five" and "1,700" and "eighty per cent" in one document | Pick one convention and apply it |
| Repeated title | The document title repeated as a heading above content that already has a title page | Remove |

---

## Tier 4 — Leftover chat

Unmistakable when present. Search for these before anything else:

*Certainly!*, *Of course!*, *You're absolutely right*, *I hope this helps*, *Let me know if you'd
like…*, *Would you like me to…*, *Here is a…*, *In this response*, *As an AI*, *[insert X]*,
*[Client Name]*, *TODO*, *Lorem ipsum*, a stray "Note:" addressed to the drafter, or a bracketed
instruction that survived from the prompt.

Suggest: delete on sight, and tell the user — a placeholder that reached a client draft is worth
flagging louder than any stylistic point.

---

## What is *not* a tell

Do not "fix" these:

- Bullet lists, headings, and tables in a document that needs them. Structure is not a sign.
- Em dashes used well, sparingly, by a writer who uses them.
- Curly quotes throughout, applied consistently — that is Word, or a typographer.
- Correct, formal register in a contract. Legal boilerplate is repetitive by design.
- Passive voice where the actor genuinely does not matter.
- A long sentence that earns its length. Length is not the crime; padding is.
