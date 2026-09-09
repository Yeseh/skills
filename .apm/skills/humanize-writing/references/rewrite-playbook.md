# Suggestion playbook

The catalogue in [tells.md](tells.md) says what to find; this says what to *propose* instead.

Everything here is wording to put in the **Suggested** column of a findings table. The skill
does not apply any of it — the user decides. So write each suggestion as finished text they
could paste, not as advice about their writing. "Consider making this more concise" is not a
suggestion; the shorter sentence is.

## The default: assume 30% of the words are load-free

Business drafts that read as AI-written are almost always over-written. Set a word budget before
reviewing and measure the suggestions against it. What a hard cut mostly takes out:

| What comes out | Example |
|---|---|
| Throat-clearing openers | "It is worth noting that", "In this section we will", "As mentioned above" |
| Sentences restating the heading | Heading "Our approach" followed by "Our approach is as follows." |
| Announcement sentences | "There are three things to consider. First, …" → start with First |
| Hedge stacks | "may potentially help to somewhat improve" → "improves" or "may improve" |
| Empty adverbs | deliberately, actually, truly, really, explicitly, fully, ultimately, effectively |
| Purpose clauses restating the noun | "the guardrails that make widened tooling safe" → "the guardrails" |
| Second halves of doubled sentences | Any sentence that says the previous one again in other words |

## Verb-first surgery

| Instead of | Write |
|---|---|
| provides an assessment of | assesses |
| conducts a review of | reviews |
| is responsible for the delivery of | delivers |
| has the ability to | can |
| in order to | to |
| at this point in time | now |
| a number of | some, or the number |
| with regard to / in terms of | about, for, in |
| it is our recommendation that | we recommend |
| serves as the foundation for | underpins, or *is* |
| plays a key role in | *name what it does* |

## Sentence rules

- **One idea per sentence.** Two at most, joined by a conjunction that earns its place.
- **Split at 25 words, hard-split at 35.** Any sentence with three or more comma-joined items
  that each carry a clause becomes a lead-in plus a list.
- **Front-load the point.** Subject, verb, object. Move the qualification behind it, or drop it.
- **Vary length on purpose.** Long, long, short. Then a fragment, if the register allows.
- **Prefer the plain verb.** *is, are, has, does, builds, runs, costs, takes.*

## Worked examples

### 1. Meta commentary — cut it

> **Before (24 words).** Naming consent for these references has not yet been reconfirmed, so
> they are presented anonymously here; we can release names on request once confirmed.

The document is talking about its own drafting. It hands the reader an admin problem, and it
reads as an instruction echoed back rather than something a person chose to write to a client.

> **After (5 words).** References are available on request.

Or, better, delete the sentence and put the condition in Assumptions.

### 2. Enumeration run-on — sentence plus list

> **Before (68 words).** Xebia designs and runs the first cohort of Orbia's AI Builder function:
> the role definition and selection, the guardrails that make widened tooling safe, the training
> and coaching of twenty-five business practitioners, the pipeline that carries an idea from a
> business team to a supported solution in production, the community that sustains it, and the
> measurement that makes the result visible to the steering committee.

Six items in one breath, each padded with a clause explaining why the item exists. The padding is
what makes it airless, not the count.

> **After (36 words).** Xebia designs and runs the first cohort of Orbia's AI Builder function:
>
> - role definition and selection
> - guardrails for the widened tooling
> - training and coaching for 25 practitioners
> - the idea-to-production pipeline
> - the practitioner community
> - value measurement for the steering committee

Followed by the second sentence, kept, because it is a commitment: "We own the outcome of this
pilot cohort; Orbia runs the next one."

### 3. Trailing "-ing" analysis — delete

> **Before.** The community rhythm is set up early, fostering engagement and ensuring the
> capability is sustained beyond the programme.

> **After.** The community rhythm is set up early, so the capability outlasts the programme.

Two participles removed, one causal claim kept.

### 4. Puffery — replace with the fact

> **Before.** Xebia brings deep, proven expertise and a comprehensive, best-in-class approach to
> enterprise AI enablement.

> **After.** We have run this programme at LEGO Group, TNO and Embla Medical.

If no fact exists to put there, the sentence should not exist.

### 5. Copula avoidance — say "is"

> **Before.** The baseline assessment serves as the foundation for each participant's learning
> path and represents the zero measurement for the programme indicators.

> **After.** The baseline assessment sets each learning path and is the zero measurement for the
> programme indicators.

### 6. Negative parallelism — keep one, at most

> **Before.** That is not a stylistic preference: participants consistently rate work on their
> own tickets highest.

> **After.** Participants consistently rate work on their own tickets highest.

The contrast was doing no work; the evidence was.

### 7. Rule of three — cut to two

> **Before.** a structured, disciplined and repeatable intake process

> **After.** a repeatable intake process

## Numbers and consistency

Business documents drift between "twenty-five", "25" and "1,700" in the same paragraph. Pick one
rule — usually digits for anything countable, words for one to nine — and apply it throughout.
Never change the value while normalising the style.

## What to hand back

1. The findings table — where, which pattern, the original quoted verbatim, one suggested
   replacement. Ordered by severity, not by page.
2. Two numbers: current prose words, and the estimate if every suggestion is taken.
3. Repeat offenders as a count with two examples, not thirty rows.
4. Open questions — every suggestion that needs a fact only the user has.

No edited file. No tracked changes. The document is left exactly as it was found.

## Calibration

If the user quotes a sentence that annoys them, that sentence outranks everything in this file.
Name the pattern it belongs to, then find every other instance of that pattern in the document
and fix those the same way. Their taste is the specification.
