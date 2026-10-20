#!/usr/bin/env python3
"""Flag the mechanical, countable signs of AI writing in a document.

Reads .docx, .md, .txt (and any UTF-8 text file) and reports the tells that can be
counted: AI-vocabulary density, over-long sentences, enumeration run-ons, trailing
"-ing" analysis clauses, negative parallelisms, copula avoidance, puffery, meta
commentary, spaced dashes, curly quotes, title-case headings and leftover chat.

This is a tripwire, not a verdict. A clean scan does not mean the prose is clean, and
a noisy scan does not mean a machine wrote it — humans write this way too. Read the
document yourself for the judgement tells (vagueness, unsupported claims, puffery that
uses none of the listed words).

Usage:
    python aiism_scan.py DOCUMENT [--json] [--top N]
"""

import argparse
import html
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

AI_VOCAB = [
    "additionally", "align with", "aligns with", "boasts", "bolstered", "crucial",
    "deep dive", "delve", "emphasizing", "emphasising", "enduring", "enhance",
    "enhancing", "foster", "fostering", "garner", "holistic", "interplay",
    "intricate", "intricacies", "landscape", "leverage", "leveraging", "meticulous",
    "meticulously", "navigate the", "pivotal", "realm", "robust", "seamless",
    "seamlessly", "showcase", "showcasing", "streamline", "tapestry", "testament",
    "underscore", "underscores", "underscoring", "vibrant",
]

PUFFERY = [
    "best-in-class", "world-class", "cutting-edge", "state-of-the-art", "unparalleled",
    "comprehensive", "proven expertise", "deep expertise", "commitment to",
    "dedicated to delivering", "groundbreaking", "renowned", "exemplifies",
    "at the heart of", "rapidly evolving", "ever-evolving", "in today's",
]

META = [
    "this document", "this section", "as mentioned above", "as outlined above",
    "it should be noted", "it is worth noting", "for the purposes of this",
    "has not yet been reconfirmed", "presented anonymously here", "on request once",
    "we would rather", "the honest order", "deliberately issued",
    "in this response", "the following is",
]

LEFTOVER_CHAT = [
    "certainly!", "of course!", "you're absolutely right", "i hope this helps",
    "let me know if", "would you like me to", "here is a", "as an ai",
    "lorem ipsum", "[insert", "[client name]", "[your name]", "todo:",
]

COPULA_DODGE = [
    "serves as", "serve as", "stands as", "stand as", "functions as", "operates as",
    "represents a", "represent a", "boasts a", "features a", "maintains a", "refers to",
]

ING_TRAIL = (
    r",\s+(ensuring|ensures|highlighting|reflecting|underscoring|emphasizing|"
    r"emphasising|showcasing|fostering|contributing|enabling|allowing|cultivating|"
    r"leveraging|driving|solidifying|marking|symbolizing|symbolising|positioning|"
    r"demonstrating|reinforcing)\b"
)

NEG_PARALLEL = [
    (r"\bnot only\b[^.]{0,90}?\bbut\b", "not only X but Y"),
    (r"\bnot just\b[^.]{0,90}?\bbut\b", "not just X but Y"),
    (r"\bis not\b[^.]{0,60}?[:,]\s*(it|that|they)\b", "it's not X, it's Y"),
    (r"\brather than\b", "X rather than Y"),
    (r"\bno\s+\w+,\s*no\s+\w+,\s*just\b", "no X, no Y, just Z"),
]

RULE_OF_THREE = r"\b(\w+), (\w+),? and (\w+)\b"

SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")
WORD = re.compile(r"[A-Za-z0-9\u2019'\-]+")


def read_docx(path):
    """Extract paragraph text and a bold-run count from a .docx without XML parsing."""
    with zipfile.ZipFile(path) as zf:
        try:
            xml = zf.read("word/document.xml").decode("utf-8", "replace")
        except KeyError:
            return "", 0, 0
    bold_runs = len(re.findall(r"<w:b\s*/>|<w:b\s+[^>]*/>", xml))
    total_runs = len(re.findall(r"<w:r[\s>]", xml))
    xml = re.sub(r"</w:p>", "\n", xml)
    xml = re.sub(r"<w:tab[^>]*/>", "\t", xml)
    xml = re.sub(r"<w:br[^>]*/>", "\n", xml)
    text = re.sub(r"<[^>]+>", "", xml)
    return html.unescape(text), bold_runs, total_runs


def read_document(path):
    p = Path(path)
    if not p.exists():
        raise SystemExit("File not found: %s" % path)
    if p.suffix.lower() in (".docx", ".dotx", ".docm"):
        return read_docx(p)
    return p.read_text(encoding="utf-8", errors="replace"), 0, 0


def count_phrases(text_lower, phrases):
    hits = Counter()
    for phrase in phrases:
        n = text_lower.count(phrase)
        if n:
            hits[phrase] = n
    return hits


def looks_like_heading(line):
    stripped = line.strip()
    if not stripped or len(stripped) > 80:
        return False
    if stripped.startswith("#"):
        return True
    words = stripped.split()
    return 1 < len(words) <= 10 and not stripped.endswith((".", ":", ";", ","))


def title_cased(line):
    words = [w for w in re.sub(r"^#+\s*", "", line.strip()).split() if w[:1].isalpha()]
    if len(words) < 3:
        return False
    capped = sum(1 for w in words if w[:1].isupper())
    minor = {"a", "an", "and", "the", "of", "in", "for", "to", "or", "on", "at", "with"}
    lower_minor = sum(1 for w in words[1:] if w.lower() in minor and w[:1].islower())
    return capped >= len(words) - lower_minor - 1 and capped > len(words) * 0.7


def analyse(text, bold_runs, total_runs, top):
    lower = text.lower()
    paragraphs = [ln for ln in text.splitlines() if ln.strip()]
    prose = " ".join(paragraphs)
    # Split per paragraph so headings, table cells and address blocks are not welded
    # into one artificial "sentence" by the join above.
    sentences = []
    for para in paragraphs:
        sentences.extend(s.strip() for s in SENT_SPLIT.split(para) if s.strip())
    words = WORD.findall(prose)

    long_sentences = []
    run_ons = []
    for s in sentences:
        n = len(WORD.findall(s))
        if n > 30:
            long_sentences.append({"words": n, "text": s[:220]})
        if n > 40 and s.count(",") >= 4:
            run_ons.append({"words": n, "commas": s.count(","), "text": s[:220]})
    long_sentences.sort(key=lambda d: -d["words"])
    run_ons.sort(key=lambda d: -d["words"])

    neg = []
    for pattern, label in NEG_PARALLEL:
        n = len(re.findall(pattern, lower))
        if n:
            neg.append({"pattern": label, "count": n})

    headings = [ln for ln in paragraphs if looks_like_heading(ln)]
    title_case = [h.strip()[:80] for h in headings if title_cased(h)]

    curly = sum(lower.count(c) for c in ("\u201c", "\u201d", "\u2018", "\u2019"))
    straight = lower.count('"') + lower.count("'")
    emoji = len(re.findall(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]", text))

    word_total = len(words)
    vocab = count_phrases(lower, AI_VOCAB)
    vocab_total = sum(vocab.values())

    return {
        "word_count": word_total,
        "sentence_count": len(sentences),
        "mean_sentence_words": round(word_total / len(sentences), 1) if sentences else 0,
        "suggested_target_words": int(word_total * 0.7),
        "ai_vocabulary": {
            "total_hits": vocab_total,
            "per_1000_words": round(1000 * vocab_total / word_total, 1) if word_total else 0,
            "top": vocab.most_common(top),
        },
        "puffery": count_phrases(lower, PUFFERY).most_common(top),
        "meta_commentary": count_phrases(lower, META).most_common(top),
        "leftover_chat": count_phrases(lower, LEFTOVER_CHAT).most_common(top),
        "copula_avoidance": count_phrases(lower, COPULA_DODGE).most_common(top),
        "trailing_ing_clauses": len(re.findall(ING_TRAIL, lower)),
        "negative_parallelisms": neg,
        "rule_of_three_triples": len(re.findall(RULE_OF_THREE, prose)),
        "long_sentences_over_30_words": {
            "count": len(long_sentences), "examples": long_sentences[:top],
        },
        "enumeration_run_ons": {
            "count": len(run_ons), "examples": run_ons[:top],
        },
        "spaced_dashes": {
            "hyphen_as_dash": len(re.findall(r"\s-\s", text)),
            "spaced_em_dash": len(re.findall(r"\s\u2014\s", text)),
            "spaced_en_dash": len(re.findall(r"\s\u2013\s", text)),
        },
        "quotes": {"curly": curly, "straight": straight, "mixed": curly > 0 and straight > 0},
        "title_case_headings": {"count": len(title_case), "examples": title_case[:top]},
        "emoji": emoji,
        "bold_runs": bold_runs,
        "bold_share_of_runs": round(bold_runs / total_runs, 3) if total_runs else None,
        "thematic_breaks": len(re.findall(r"^\s*(---|___|\*\*\*)\s*$", text, re.M)),
    }


def render(report, path):
    out = []
    out.append("AI-ism scan: %s" % path)
    out.append("=" * 60)
    out.append("Words: %d   Sentences: %d   Mean sentence: %.1f words"
               % (report["word_count"], report["sentence_count"], report["mean_sentence_words"]))
    out.append("Suggested target after a concision pass: ~%d words (-30%%)"
               % report["suggested_target_words"])
    out.append("")
    vocab = report["ai_vocabulary"]
    out.append("AI vocabulary: %d hits (%.1f per 1000 words)"
               % (vocab["total_hits"], vocab["per_1000_words"]))
    for term, n in vocab["top"]:
        out.append("    %-28s %d" % (term, n))

    def block(title, items):
        if items:
            out.append("")
            out.append("%s: %d distinct" % (title, len(items)))
            for term, n in items:
                out.append("    %-28s %d" % (term, n))

    block("Meta commentary", report["meta_commentary"])
    block("Leftover chat / placeholders", report["leftover_chat"])
    block("Puffery", report["puffery"])
    block("Copula avoidance", report["copula_avoidance"])

    out.append("")
    out.append("Trailing '-ing' analysis clauses: %d" % report["trailing_ing_clauses"])
    out.append("Rule-of-three triples: %d" % report["rule_of_three_triples"])
    for item in report["negative_parallelisms"]:
        out.append("Negative parallelism (%s): %d" % (item["pattern"], item["count"]))

    out.append("")
    out.append("Sentences over 30 words: %d" % report["long_sentences_over_30_words"]["count"])
    for ex in report["long_sentences_over_30_words"]["examples"]:
        out.append("    [%d words] %s..." % (ex["words"], ex["text"][:120]))
    out.append("Enumeration run-ons (>40 words, 4+ commas): %d"
               % report["enumeration_run_ons"]["count"])
    for ex in report["enumeration_run_ons"]["examples"]:
        out.append("    [%d words, %d commas] %s..." % (ex["words"], ex["commas"], ex["text"][:120]))

    d = report["spaced_dashes"]
    out.append("")
    out.append("Spaced dashes: hyphen %d, em %d, en %d"
               % (d["hyphen_as_dash"], d["spaced_em_dash"], d["spaced_en_dash"]))
    q = report["quotes"]
    out.append("Quotes: %d curly, %d straight%s"
               % (q["curly"], q["straight"], "  <- mixed conventions" if q["mixed"] else ""))
    tc = report["title_case_headings"]
    out.append("Title Case headings: %d" % tc["count"])
    for h in tc["examples"]:
        out.append("    %s" % h)
    out.append("Emoji: %d   Thematic breaks: %d" % (report["emoji"], report["thematic_breaks"]))
    if report["bold_share_of_runs"] is not None:
        out.append("Bold runs: %d (%.1f%% of runs)"
                   % (report["bold_runs"], 100 * report["bold_share_of_runs"]))
    out.append("")
    out.append("Counts are signals, not proof. Read the prose for vagueness and unsupported")
    out.append("claims - those are the real problems the tells point at.")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description="Scan a document for mechanical AI-writing tells.")
    ap.add_argument("document", help="Path to a .docx, .md or .txt file")
    ap.add_argument("--json", action="store_true", help="Emit JSON instead of a text report")
    ap.add_argument("--top", type=int, default=10, help="Max examples per category (default 10)")
    args = ap.parse_args()

    text, bold_runs, total_runs = read_document(args.document)
    if not text.strip():
        raise SystemExit("No readable text found in %s" % args.document)
    report = analyse(text, bold_runs, total_runs, args.top)
    if args.json:
        json.dump({"document": str(args.document), "report": report}, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        print(render(report, args.document))


if __name__ == "__main__":
    main()
