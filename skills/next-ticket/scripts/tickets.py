#!/usr/bin/env python3
"""Deterministic ticket selection and claiming for the next-ticket skill.

Run from a clone of the repo with an authenticated `gh`. Standard library only; run with `python3 -I`.

  tickets.py select [--scope N]        rank unblocked, unclaimed implementation tickets (JSON on stdout)
  tickets.py claim N                   assign yourself and post a claim marker; exit 3 if another run won
  tickets.py release N [--body-file F] [--question]
                                       post a release marker (and message) and unassign yourself; with
                                       --question the ticket is skipped until someone replies

GitHub is the only state. Markers are HTML comments in issue and PR bodies, so they are invisible when rendered.
"""

from __future__ import annotations

import argparse
import json
import re
import secrets
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from typing import Any

CLAIM = "<!-- next-ticket:claim"
QUESTION = "<!-- next-ticket:question -->"
RELEASE = "<!-- next-ticket:release -->"
PR_MARKER = "<!-- next-ticket:pr"
TRUSTED_AUTHORS = {"OWNER", "MEMBER", "COLLABORATOR"}
REQUIRED_SECTIONS = ("## What is built", "## Test plan")
STALE_CLAIM = timedelta(hours=24)


def gh(*args: str, stdin: str | None = None) -> str:
    proc = subprocess.run(["gh", *args], input=stdin, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        sys.exit(f"gh {' '.join(args)} failed: {proc.stderr.strip()}")
    return proc.stdout


def api(path: str) -> Any:
    return json.loads(gh("api", path))


def api_all(path: str) -> list[Any]:
    """Fetch every page of a list endpoint."""
    sep = "&" if "?" in path else "?"
    items: list[Any] = []
    page = 1
    while True:
        batch = api(f"{path}{sep}per_page=100&page={page}")
        items.extend(batch)
        if len(batch) < 100:
            return items
        page += 1


def repo() -> str:
    return gh("repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner").strip()


def me() -> str:
    return gh("api", "user", "--jq", ".login").strip()


def parse_time(stamp: str) -> datetime:
    return datetime.fromisoformat(stamp)


def mentions(text: str, number: int) -> bool:
    return re.search(rf"(?<![\w/]){re.escape('#')}{number}(?!\d)", text or "") is not None


def branch_mentions(branch: str, number: int) -> bool:
    return re.search(rf"(^|/){number}(-|$)", branch) is not None


def works_on(pr: dict[str, Any], number: int) -> bool:
    """A merged PR worked on the issue: it names it in its title, its branch or a `Closes`/`Part of` line.

    A bare mention elsewhere in the body (an example, a list of related issues) is not evidence of work.
    """
    if mentions(pr.get("title") or "", number):
        return True
    link = rf"(?i)\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|part\s+of)\b:?\s+#{number}(?!\d)"
    if re.search(link, pr.get("body") or ""):
        return True
    return branch_mentions(api(pr["pull_request"]["url"])["head"]["ref"], number)


def last_member_note(comments: list[dict[str, Any]]) -> datetime | None:
    """When a repo member last commented on the issue by hand (not a next-ticket marker)."""
    notes = [
        parse_time(c["created_at"]) for c in comments
        if c.get("author_association") in TRUSTED_AUTHORS and "<!-- next-ticket:" not in (c.get("body") or "")
    ]
    return max(notes, default=None)


def active_claims(comments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Claim comments posted after the most recent release, oldest first."""
    claims: list[dict[str, Any]] = []
    for c in comments:
        body = c.get("body") or ""
        if RELEASE in body:
            claims = []
        elif body.lstrip().startswith(CLAIM):
            claims.append(c)
    return claims


def awaiting_answer(comments: list[dict[str, Any]]) -> bool:
    """The last comment is a next-ticket question that nobody has answered yet."""
    return bool(comments) and QUESTION in (comments[-1].get("body") or "")


def descendants(r: str, number: int) -> set[int]:
    found: set[int] = set()
    stack = [number]
    while stack:
        for sub in api_all(f"repos/{r}/issues/{stack.pop()}/sub_issues"):
            if sub["number"] not in found:
                found.add(sub["number"])
                stack.append(sub["number"])
    return found


def blocked_ancestor(issue: dict[str, Any], cache: dict[str, dict[str, Any]]) -> int | None:
    url = issue.get("parent_issue_url")
    while url:
        parent = cache.get(url)
        if parent is None:
            parent = json.loads(gh("api", url))
            cache[url] = parent
        if parent["state"] == "open" and parent["issue_dependencies_summary"]["blocked_by"] > 0:
            return int(parent["number"])
        url = parent.get("parent_issue_url")
    return None


def remote_branches() -> list[str]:
    proc = subprocess.run(["git", "ls-remote", "--heads", "origin"], capture_output=True, text=True, check=False)
    return [line.split("refs/heads/", 1)[1] for line in proc.stdout.splitlines() if "refs/heads/" in line]


def select(scope: int | None) -> dict[str, Any]:
    r, login = repo(), me()
    issues = [i for i in api_all(f"repos/{r}/issues?state=open") if "pull_request" not in i]
    open_prs = json.loads(
        gh("pr", "list", "--state", "open", "--limit", "500",
           "--json", "number,title,body,headRefName,isDraft,author,url,closingIssuesReferences")
    )
    open_pr_numbers = {p["number"] for p in open_prs}
    own_prs = [p for p in open_prs if p["author"]["login"] == login and PR_MARKER in (p.get("body") or "")]
    branches = remote_branches()
    in_scope = descendants(r, scope) if scope is not None else None
    parents: dict[str, dict[str, Any]] = {}
    now = datetime.now(UTC)

    candidates: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []

    def exclude(issue: dict[str, Any], reason: str, detail: str) -> None:
        excluded.append({"number": issue["number"], "title": issue["title"], "reason": reason, "detail": detail})

    for issue in issues:
        n = issue["number"]
        deps = issue.get("issue_dependencies_summary") or {}
        subs = issue.get("sub_issues_summary") or {}
        body = issue.get("body") or ""
        if in_scope is not None and n not in in_scope:
            continue
        if issue.get("author_association") not in TRUSTED_AUTHORS:
            continue
        if deps.get("blocked_by", 0) > 0:
            continue
        if subs.get("total", 0) > 0:
            if subs.get("completed", 0) == subs["total"]:
                exclude(issue, "children-done", "every sub-issue is closed; close or update the parent")
            continue
        if not all(re.search(rf"(?m)^{re.escape(s)}\b", body) for s in REQUIRED_SECTIONS):
            continue

        assignees = [a["login"] for a in issue["assignees"]]
        comments = api_all(f"repos/{r}/issues/{n}/comments") if issue.get("comments", 0) else []
        claims = active_claims(comments)
        linked_open = sorted(
            p["number"] for p in open_prs
            if any(ref["number"] == n for ref in p.get("closingIssuesReferences") or [])
            or mentions(p.get("title") or "", n) or mentions(p.get("body") or "", n)
            or branch_mentions(p["headRefName"], n)
        )

        if assignees:
            if login in assignees and claims and not linked_open:
                age = now - parse_time(claims[0]["created_at"])
                if age > STALE_CLAIM:
                    exclude(issue, "stale-claim", f"claimed {claims[0]['created_at']} with no open PR; "
                            "release it or unassign to let next-ticket retry")
            continue
        if claims:
            exclude(issue, "claimed-unassigned", "claim marker without an assignee; post a release marker")
            continue
        if awaiting_answer(comments):
            exclude(issue, "awaiting-answer", "next-ticket asked a question that has no reply yet")
            continue

        body_prs = sorted({int(m) for m in re.findall(r"(?<![\w/])#(\d+)", body)} & open_pr_numbers)
        timeline = api_all(f"repos/{r}/issues/{n}/timeline")
        xref_prs = [
            e["source"]["issue"] for e in timeline
            if e.get("event") == "cross-referenced"
            and (e.get("source") or {}).get("issue", {}).get("pull_request") is not None
        ]
        linked_open = sorted(set(linked_open) | set(body_prs)
                             | {p["number"] for p in xref_prs if p["state"] == "open"})
        if linked_open:
            exclude(issue, "in-flight", "open PR " + ", ".join(f"#{p}" for p in linked_open))
            continue
        # A member's comment after the merge ("what is left is …") settles the question.
        note = last_member_note(comments)
        merged = sorted({
            p["number"] for p in xref_prs
            if (merged_at := (p["pull_request"] or {}).get("merged_at"))
            and (note is None or parse_time(merged_at) > note)
            and works_on(p, n)
        })
        if merged:
            exclude(issue, "maybe-done", "merged PR " + ", ".join(f"#{p}" for p in merged)
                    + " references it; close the issue or say what is left")
            continue
        wip_branches = [b for b in branches if branch_mentions(b, n)]
        if wip_branches:
            exclude(issue, "branch-without-pr", "remote branch " + ", ".join(wip_branches))
            continue
        ancestor = blocked_ancestor(issue, parents)
        if ancestor is not None:
            exclude(issue, "ancestor-blocked", f"parent #{ancestor} has open blockers")
            continue

        candidates.append({
            "number": n,
            "title": issue["title"],
            "url": issue["html_url"],
            "unblocks": deps.get("blocking", 0),
            "parent": int(issue["parent_issue_url"].rsplit("/", 1)[1]) if issue.get("parent_issue_url") else None,
        })

    candidates.sort(key=lambda c: (-c["unblocks"], c["number"]))
    return {
        "repo": r,
        "me": login,
        "own_open_prs": [
            {"number": p["number"], "title": p["title"], "draft": p["isDraft"], "branch": p["headRefName"]}
            for p in own_prs
        ],
        "candidates": candidates,
        "excluded": sorted(excluded, key=lambda e: e["number"]),
    }


def claim(number: int) -> int:
    r, login = repo(), me()
    issue = api(f"repos/{r}/issues/{number}")
    others = [a["login"] for a in issue["assignees"] if a["login"] != login]
    if issue["state"] != "open" or others:
        print(json.dumps({"claimed": False, "reason": "closed or assigned to someone else"}))
        return 3
    run = secrets.token_hex(6)
    gh("api", "-X", "POST", f"repos/{r}/issues/{number}/assignees", "-f", f"assignees[]={login}")
    gh("api", "-X", "POST", f"repos/{r}/issues/{number}/comments", "-f",
       f"body={CLAIM} run={run} -->\nPicked up by the `next-ticket` skill. A PR will follow, or a question.")
    claims = active_claims(api_all(f"repos/{r}/issues/{number}/comments"))
    if not claims or f"run={run} " not in claims[0]["body"]:
        mine = [c for c in claims if f"run={run} " in c["body"]]
        for c in mine:
            gh("api", "-X", "DELETE", f"repos/{r}/issues/comments/{c['id']}")
        print(json.dumps({"claimed": False, "reason": "another run claimed it first"}))
        return 3
    print(json.dumps({"claimed": True, "run": run}))
    return 0


def release(number: int, body_file: str | None, question: bool) -> int:
    r, login = repo(), me()
    message = ""
    if body_file:
        with open(body_file, encoding="utf-8") as fh:
            message = fh.read().strip()
    markers = RELEASE + (f"\n{QUESTION}" if question else "")
    gh("api", "-X", "POST", f"repos/{r}/issues/{number}/comments", "-f",
       f"body={markers}\n{message or 'Released by the `next-ticket` skill.'}")
    gh("api", "-X", "DELETE", f"repos/{r}/issues/{number}/assignees", "-f", f"assignees[]={login}")
    print(json.dumps({"released": True}))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_select = sub.add_parser("select")
    p_select.add_argument("--scope", type=int, help="only sub-issues (recursively) of this issue")
    p_claim = sub.add_parser("claim")
    p_claim.add_argument("number", type=int)
    p_release = sub.add_parser("release")
    p_release.add_argument("number", type=int)
    p_release.add_argument("--body-file", help="message to post with the release marker")
    p_release.add_argument("--question", action="store_true",
                           help="the message asks the user something: skip the ticket until someone replies")
    args = parser.parse_args()
    if args.cmd == "select":
        print(json.dumps(select(args.scope), indent=2))
        return 0
    if args.cmd == "claim":
        return claim(args.number)
    return release(args.number, args.body_file, args.question)


if __name__ == "__main__":
    sys.exit(main())
