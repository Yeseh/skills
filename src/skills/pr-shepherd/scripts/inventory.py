#!/usr/bin/env python3
"""Read-only PR inventory. Run from the repo with:

  python3 -I <skill-dir>/scripts/inventory.py [--team ORG/SLUG ...]

--team adds a GitHub team whose review requests count as requests for you (repeatable; a bare slug
means a team in the repository owner's org).

Each section is either {"ok": true, "items": [...]} or
{"ok": false, "items": null, "error": "..."}; never act on a failed section.
The inventory is a point-in-time discovery aid, not a substitute for live rechecks.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from typing import Any
from urllib.parse import urlencode

PAGE_SIZE = 100
SEARCH_LIMIT = 1000

PR_QUERY = """
query($owner:String!,$repo:String!,$number:Int!) {
  repository(owner:$owner,name:$repo) { pullRequest(number:$number) {
    headRefOid mergeable mergeStateStatus reviewDecision
  } }
}
"""
CHECK_QUERY = """
query($owner:String!,$repo:String!,$number:Int!,$cursor:String) {
  repository(owner:$owner,name:$repo) { pullRequest(number:$number) {
    headRefOid commits(last:1) { nodes { commit { statusCheckRollup {
      contexts(first:100,after:$cursor) { nodes {
        __typename
        ... on CheckRun { name status conclusion detailsUrl startedAt completedAt }
        ... on StatusContext { context state targetUrl }
      } pageInfo { hasNextPage endCursor } }
    } } } }
  } }
}
"""
THREAD_QUERY = """
query($owner:String!,$repo:String!,$number:Int!,$cursor:String) {
  repository(owner:$owner,name:$repo) { pullRequest(number:$number) {
    headRefOid reviewThreads(first:100,after:$cursor) {
      nodes { id isResolved isOutdated path line } pageInfo { hasNextPage endCursor }
    }
  } }
}
"""
THREAD_COMMENTS_QUERY = """
query($id:ID!,$cursor:String) {
  node(id:$id) { ... on PullRequestReviewThread {
    comments(first:100,after:$cursor) {
      nodes { author { login } body createdAt url }
      pageInfo { hasNextPage endCursor }
    }
  } }
}
"""


class InventoryError(Exception):
    pass


def gh(*args: str) -> str:
    try:
        result = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    except OSError as exc:
        raise InventoryError(f"could not run gh: {exc}") from exc
    if result.returncode:
        raise InventoryError(f"gh {' '.join(args[:3])} failed: {result.stderr.strip()}")
    return result.stdout


def api(path: str) -> Any:
    try:
        return json.loads(gh("api", path))
    except json.JSONDecodeError as exc:
        raise InventoryError(f"invalid JSON from {path}: {exc}") from exc


def rest_pages(path: str) -> list[Any]:
    items: list[Any] = []
    separator = "&" if "?" in path else "?"
    for page in range(1, 10001):
        batch = api(f"{path}{separator}per_page={PAGE_SIZE}&page={page}")
        if not isinstance(batch, list) or len(batch) > PAGE_SIZE:
            raise InventoryError(f"invalid page from {path}")
        items.extend(batch)
        if len(batch) < PAGE_SIZE:
            return items
    raise InventoryError(f"pagination limit reached for {path}")


def graphql(query: str, **variables: Any) -> dict[str, Any]:
    args = ["api", "graphql", "-f", f"query={query}"]
    for key, value in variables.items():
        if value is not None:
            args.extend(["-F" if isinstance(value, int) else "-f", f"{key}={value}"])
    try:
        result = json.loads(gh(*args))
    except json.JSONDecodeError as exc:
        raise InventoryError(f"invalid GraphQL JSON: {exc}") from exc
    if not isinstance(result, dict) or result.get("errors") or not isinstance(result.get("data"), dict):
        raise InventoryError(f"GraphQL lookup failed: {result.get('errors') if isinstance(result, dict) else result}")
    return result["data"]


def connection_pages(fetch: Any) -> list[Any]:
    items: list[Any] = []
    cursor = None
    seen: set[str] = set()
    for _ in range(10000):
        connection = fetch(cursor)
        if not isinstance(connection, dict) or not isinstance(connection.get("nodes"), list):
            raise InventoryError("invalid GraphQL connection")
        nodes = connection["nodes"]
        info = connection["pageInfo"]
        if len(nodes) > PAGE_SIZE or any(node is None for node in nodes):
            raise InventoryError("invalid GraphQL connection nodes")
        items.extend(nodes)
        if info["hasNextPage"] is False:
            return items
        next_cursor = info["endCursor"]
        if info["hasNextPage"] is not True or not isinstance(next_cursor, str) or not next_cursor or next_cursor in seen:
            raise InventoryError("invalid or repeated GraphQL pagination cursor")
        seen.add(next_cursor)
        cursor = next_cursor
    raise InventoryError("GraphQL pagination limit reached")


def own_prs(repository: str, login: str) -> list[dict[str, Any]]:
    owner, repo = repository.split("/")
    variables = {"owner": owner, "repo": repo}
    pulls = rest_pages(f"repos/{repository}/pulls?state=open")
    if len({p["number"] for p in pulls}) != len(pulls):
        raise InventoryError("duplicate PR in paginated own-PR lookup")
    own = [p for p in pulls if p["user"]["login"].lower() == login.lower()]
    result = []
    for pr in own:
        number = pr["number"]
        args = {**variables, "number": number}
        data = graphql(PR_QUERY, **args)["repository"]["pullRequest"]
        head = pr["head"]["sha"]
        if not data or data["headRefOid"] != head:
            raise InventoryError(f"PR #{number} head changed during inventory")

        def fetch_checks(cursor: str | None) -> dict[str, Any]:
            pull = graphql(CHECK_QUERY, **args, cursor=cursor)["repository"]["pullRequest"]
            if pull["headRefOid"] != head:
                raise InventoryError(f"PR #{number} head changed during checks lookup")
            commits = pull["commits"]["nodes"]
            if len(commits) != 1:
                raise InventoryError(f"PR #{number} has no head commit")
            rollup = commits[0]["commit"]["statusCheckRollup"]
            return rollup["contexts"] if rollup is not None else {
                "nodes": [], "pageInfo": {"hasNextPage": False, "endCursor": None}
            }

        def fetch_threads(cursor: str | None) -> dict[str, Any]:
            pull = graphql(THREAD_QUERY, **args, cursor=cursor)["repository"]["pullRequest"]
            if pull["headRefOid"] != head:
                raise InventoryError(f"PR #{number} head changed during threads lookup")
            return pull["reviewThreads"]

        checks = connection_pages(fetch_checks)
        threads = connection_pages(fetch_threads)
        for thread in threads:
            thread["comments"] = connection_pages(
                lambda cursor: graphql(THREAD_COMMENTS_QUERY, id=thread["id"], cursor=cursor)["node"]["comments"]
            )
        reviews = rest_pages(f"repos/{repository}/pulls/{number}/reviews")
        comments = rest_pages(f"repos/{repository}/issues/{number}/comments")
        result.append({
            "number": number, "title": pr["title"], "url": pr["html_url"],
            "isDraft": pr["draft"], "headRefName": pr["head"]["ref"], "headRefOid": head,
            "mergeable": data["mergeable"], "mergeStateStatus": data["mergeStateStatus"],
            "reviewDecision": data["reviewDecision"], "statusCheckRollup": checks,
            "reviewThreads": threads, "reviews": reviews,
            "conversationComments": comments,
        })
    return sorted(result, key=lambda p: p["number"])


def search_requests(repository: str, qualifier: str) -> list[dict[str, Any]]:
    query = f"repo:{repository} is:pr is:open {qualifier}"
    items: list[dict[str, Any]] = []
    total = None
    for page in range(1, 11):
        path = "search/issues?" + urlencode({"q": query, "per_page": PAGE_SIZE, "page": page})
        data = api(path)
        if data.get("incomplete_results") is not False or not isinstance(data.get("total_count"), int):
            raise InventoryError(f"incomplete review request search: {qualifier}")
        count = data["total_count"]
        if count >= SEARCH_LIMIT or (total is not None and total != count):
            raise InventoryError(f"truncated or changing review request search: {qualifier}")
        total = count
        batch = data["items"]
        if not isinstance(batch, list) or len(batch) > PAGE_SIZE:
            raise InventoryError(f"invalid review request search page: {qualifier}")
        items.extend(batch)
        if len(items) >= total:
            if len(items) != total or len({p["number"] for p in items}) != total:
                raise InventoryError(f"inconsistent review request search: {qualifier}")
            return items
        if len(batch) < PAGE_SIZE:
            raise InventoryError(f"truncated review request search: {qualifier}")
    raise InventoryError(f"review request search pagination limit reached: {qualifier}")


def review_requests(repository: str, login: str, teams: list[str]) -> list[dict[str, Any]]:
    owner = repository.split("/")[0]
    candidates: dict[int, None] = {}
    qualifiers = ["user-review-requested:@me"]
    qualifiers += [f"team-review-requested:{t if '/' in t else f'{owner}/{t}'}" for t in teams]
    for qualifier in qualifiers:
        for item in search_requests(repository, qualifier):
            candidates[item["number"]] = None
    result = []
    for number in sorted(candidates):
        pr = api(f"repos/{repository}/pulls/{number}")
        if pr["base"]["repo"]["full_name"].lower() != repository.lower():
            raise InventoryError(f"PR #{number} is outside the selected repository")
        if pr["state"] == "open" and not pr["draft"] and pr["user"]["login"].lower() != login.lower():
            result.append({
                "number": number, "title": pr["title"], "url": pr["html_url"],
                "author": pr["user"]["login"], "headRefOid": pr["head"]["sha"],
            })
    return result


def section(fn: Any, *args: Any) -> dict[str, Any]:
    try:
        return {"ok": True, "items": fn(*args)}
    except (InventoryError, KeyError, TypeError, ValueError, IndexError, AttributeError) as exc:
        return {"ok": False, "items": None, "error": str(exc)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--team", action="append", default=[], help="ORG/SLUG or SLUG; repeatable")
    args = parser.parse_args()
    for team in args.team:
        if not re.fullmatch(r"([A-Za-z0-9-]+/)?[A-Za-z0-9_.-]+", team):
            print(json.dumps({"error": f"invalid team: {team}"}))
            return 1
    try:
        repository = gh("repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner").strip()
        login = gh("api", "user", "--jq", ".login").strip()
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository) or not re.fullmatch(
            r"[A-Za-z0-9-]+", login
        ):
            raise InventoryError("invalid repository or authenticated viewer")
    except InventoryError as exc:
        print(json.dumps({"error": str(exc)}))
        return 1
    own = section(own_prs, repository, login)
    requests = section(review_requests, repository, login, args.team)
    print(json.dumps({"repo": repository, "me": login, "own_prs": own, "review_requests": requests}, indent=2))
    return 0 if own["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
