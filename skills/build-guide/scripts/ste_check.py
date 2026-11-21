#!/usr/bin/env python3
"""Heuristic ASD-STE100 checker for build-guide notes.

Usage: ste_check.py <file-or-folder> [--verbose]

Checks Markdown prose (skips code blocks, Mermaid, tables, headings, tag lines).
A sentence passes when it has no hard violation:
  - too long (20 words in lists / callout warnings, 25 in paragraphs)
  - a word from the "do not use" list
  - a phrasal verb from the list
  - probable passive voice
  - a contraction (don't, you'll, it's)
Soft warnings (do not change the score): -ing words, noun clusters, long paragraphs.
The score is the percentage of sentences that pass. The target is 80% or more.
"""
import re
import sys
from pathlib import Path

BANNED = {
    "utilize": "use", "utilise": "use", "leverage": "use", "employ": "use",
    "facilitate": "help / let", "in order to": "to", "prior to": "before",
    "subsequent to": "after", "commence": "start", "initiate": "start",
    "ensure": "make sure", "obtain": "get", "acquire": "get", "retrieve": "get",
    "sufficient": "enough", "approximately": "about", "additional": "more",
    "numerous": "many", "require": "need", "requires": "needs", "perform": "do",
    "attempt": "try", "verify": "make sure / check", "determine": "find / decide",
    "indicate": "show", "robust": "(delete)", "seamless": "(delete)",
    "seamlessly": "(delete)", "powerful": "(delete)", "basically": "(delete)",
    "simply": "(delete)", "just": "(delete or 'only')",
}
PHRASAL = {
    "set up": "configure / prepare", "sets up": "configures", "figure out": "find",
    "find out": "find / learn", "come up with": "make / find", "look into": "examine",
    "carry out": "do", "point out": "show", "go through": "read / examine",
    "get rid of": "remove", "run into": "get / have", "fill in": "write / complete",
    "pick up": "continue", "end up": "(rephrase)", "ends up": "(rephrase)",
    "turn on": "enable / start", "turn off": "disable / stop", "make up": "(rephrase)",
}
ING_OK = {
    "string", "strings", "thing", "things", "nothing", "something", "anything",
    "everything", "during", "bring", "ring", "king", "ceiling", "spring",
    "logging", "networking", "padding", "routing", "caching", "parsing",
    "sandboxing", "scheduling", "hashing", "testing", "debugging", "mapping",
    "binding", "rendering", "tracing", "encoding", "warning", "warnings",
    "building", "morning", "evening", "missing", "following", "existing",
    "pending", "spring", "swing", "sing", "wing", "bring", "sting",
}
BE = r"\b(is|are|was|were|be|been|being|gets|get|got)\b"
PASSIVE = re.compile(BE + r"\s+(\w+ly\s+)?(\w+(ed|en)|made|done|set|put|kept|built|sent|held|run|shown|known|given|taken|written|read)\b", re.I)
ADJ_EN = {"open", "often", "even", "hidden", "broken", "given", "seen", "frozen", "golden", "children", "kernel"}


def prose_blocks(text):
    """Yield (kind, text) for prose: 'list' for list items/callouts, 'para' for paragraphs."""
    in_code = False
    para = []
    for raw in text.splitlines():
        line = raw.rstrip()
        if line.strip().startswith("```"):
            in_code = not in_code
            if para:
                yield "para", " ".join(para); para = []
            continue
        if in_code:
            continue
        s = line.strip()
        if not s or s.startswith("#") or s.startswith("|") or re.match(r"^\*\*\w[\w\s/]*:\*\*", s) and len(s) < 60:
            if para:
                yield "para", " ".join(para); para = []
            continue
        if s.startswith("Part of [[") or s.startswith("> [!"):
            if para:
                yield "para", " ".join(para); para = []
            continue
        callout = s.startswith(">")
        s = s.lstrip("> ").strip()
        if not s:
            continue
        m = re.match(r"^(\d+\.|[-*])\s+(\[[ xX]\]\s+)?(.*)", s)
        if m or callout:
            if para:
                yield "para", " ".join(para); para = []
            yield "list", m.group(3) if m else s
        else:
            para.append(s)
    if para:
        yield "para", " ".join(para)


def clean(s):
    s = re.sub(r"`[^`]*`", "CODE", s)                 # inline code = one word
    s = re.sub(r"\[\[([^\]|]*\|)?([^\]]*)\]\]", r"\2", s)
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)     # link text only
    s = re.sub(r"https?://\S+", "URL", s)
    s = re.sub(r"[*_]", "", s)
    return s


def sentences(s):
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z\"(])", s)
    return [p.strip() for p in parts if len(p.split()) >= 3]


def check_sentence(sent, kind):
    hard, soft = [], []
    words = sent.split()
    limit = 20 if kind == "list" else 25
    if len(words) > limit:
        hard.append(f"{len(words)} words (max {limit})")
    low = " " + sent.lower() + " "
    for w, r in BANNED.items():
        if re.search(r"\b" + re.escape(w) + r"\b", low):
            hard.append(f"'{w}' -> {r}")
    for w, r in PHRASAL.items():
        if re.search(r"\b" + re.escape(w) + r"\b", low):
            hard.append(f"phrasal '{w}' -> {r}")
    contr = re.findall(r"\b\w+'(t|ll|re|ve|d|m)\b", sent, re.I)
    if contr:
        hard.append("contraction (write the full words)")
    for m in PASSIVE.finditer(sent):
        if m.group(3).lower() not in ADJ_EN:
            hard.append(f"passive? '{m.group(0)}'")
            break
    ings = [w for w in re.findall(r"\b[a-zA-Z]+ing\b", sent) if w.lower() not in ING_OK and w != "CODE"]
    if ings:
        soft.append("-ing: " + ", ".join(sorted(set(ings))))
    return hard, soft


def check_file(path, verbose):
    text = Path(path).read_text(encoding="utf-8")
    total = passed = 0
    report = []
    for kind, block in prose_blocks(text):
        sents = sentences(clean(block))
        if kind == "para" and len(sents) > 6:
            report.append(("soft", f"paragraph has {len(sents)} sentences (max 6)", sents[0][:70] + "..."))
        for s in sents:
            total += 1
            hard, soft = check_sentence(s, kind)
            if not hard:
                passed += 1
            else:
                report.append(("hard", "; ".join(hard), s))
            if soft and verbose:
                report.append(("soft", "; ".join(soft), s))
    return total, passed, report


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(2)
    target = Path(sys.argv[1]); verbose = "--verbose" in sys.argv
    files = sorted(target.glob("*.md")) if target.is_dir() else [target]
    T = P = 0
    for f in files:
        t, p, rep = check_file(f, verbose)
        T += t; P += p
        score = 100 * p / t if t else 100
        print(f"\n== {f.name}: {score:.0f}% ({p}/{t})")
        for level, msg, s in rep:
            tag = "FIX " if level == "hard" else "note"
            print(f"  [{tag}] {msg}\n         {s[:160]}")
    overall = 100 * P / T if T else 100
    print(f"\nOVERALL STE SCORE: {overall:.0f}% ({P}/{T} sentences pass). Target: 80%.")
    sys.exit(0 if overall >= 80 else 1)


if __name__ == "__main__":
    main()
