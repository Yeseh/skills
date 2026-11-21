"""Offline interface tests for inventory.py using a fake gh executable."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import unittest


SCRIPT = Path(__file__).with_name("inventory.py")
FAKE_GH = r"""#!/usr/bin/env python3
import json, os, sys
from urllib.parse import parse_qs, urlsplit
args = sys.argv[1:]
with open(os.environ["GH_LOG"], "a", encoding="utf-8") as log:
    log.write(json.dumps(args) + "\n")
with open(os.environ["GH_FIXTURE"], encoding="utf-8") as f:
    fixture = json.load(f)
if args[:2] == ["repo", "view"]:
    print("Acme/repo")
    sys.exit(0)
if args[:2] == ["api", "user"] and "--jq" in args:
    print("alice")
    sys.exit(0)
if args[:2] == ["api", "graphql"]:
    query = next(a[6:] for a in args if a.startswith("query="))
    name = next(n for n, token in [
        ("threads", "reviewThreads("), ("comments", "node(id:"),
        ("checks", "statusCheckRollup"), ("pr", "mergeStateStatus")
    ] if token in query)
    cursor = next((a[7:] for a in args if a.startswith("cursor=")), "start")
    node_id = next((a[3:] for a in args if a.startswith("id=")), "")
    key = "graphql:" + name + (":" + node_id if node_id else "") + ":" + cursor
else:
    key = args[1]
    if key.startswith("search/issues?"):
        params = parse_qs(urlsplit(key).query)
        key = "search:" + params["q"][0].split(" is:open ", 1)[1] + ":" + params["page"][0]
response = fixture.get(key, {"__failure": "missing fixture: " + key})
if isinstance(response, dict) and "__failure" in response:
    print(response["__failure"], file=sys.stderr)
    sys.exit(1)
print(json.dumps(response))
"""


def pr(number, author="alice", draft=False):
    return {
        "number": number, "title": f"PR {number}", "html_url": f"https://example.test/{number}",
        "user": {"login": author}, "draft": draft, "state": "open",
        "head": {"sha": "abc", "ref": "branch"},
        "base": {"repo": {"full_name": "Acme/repo"}},
    }


def connection(nodes, cursor=None):
    return {"nodes": nodes, "pageInfo": {"hasNextPage": cursor is not None, "endCursor": cursor}}


def pull_graphql(value):
    return {"data": {"repository": {"pullRequest": value}}}


def fixtures():
    thread = {"id": "T", "isResolved": False, "isOutdated": False, "path": "x", "line": 1}
    later_thread = {"id": "T2", "isResolved": True, "isOutdated": False, "path": "y", "line": 2}
    return {
        "repos/Acme/repo/pulls?state=open&per_page=100&page=1": [pr(1)],
        "graphql:pr:start": pull_graphql({
            "headRefOid": "abc", "mergeable": "MERGEABLE", "mergeStateStatus": "CLEAN",
            "reviewDecision": "APPROVED",
        }),
        "graphql:checks:start": pull_graphql({"headRefOid": "abc", "commits": {"nodes": [{
            "commit": {"statusCheckRollup": {"contexts": connection([{"__typename": "CheckRun", "name": "a"}], "c2")}}
        }]}}),
        "graphql:checks:c2": pull_graphql({"headRefOid": "abc", "commits": {"nodes": [{
            "commit": {"statusCheckRollup": {"contexts": connection([{"__typename": "StatusContext", "context": "b"}])}}
        }]}}),
        "graphql:threads:start": pull_graphql({
            "headRefOid": "abc", "reviewThreads": connection([thread], "t2"),
        }),
        "graphql:threads:t2": pull_graphql({"headRefOid": "abc", "reviewThreads": connection([later_thread])}),
        "graphql:comments:T:start": {"data": {"node": {"comments": connection([{"body": "first"}], "m2")}}},
        "graphql:comments:T:m2": {"data": {"node": {"comments": connection([{"body": "last"}])}}},
        "graphql:comments:T2:start": {"data": {"node": {"comments": connection([{"body": "later thread"}])}}},
        "repos/Acme/repo/pulls/1/reviews?per_page=100&page=1": [
            {"user": {"login": "copilot-pull-request-reviewer[bot]"}, "body": "old",
             "submitted_at": "2026-01-01T00:00:00Z"},
            *({"user": {"login": "human"}, "state": "COMMENTED"} for _ in range(99)),
        ],
        "repos/Acme/repo/pulls/1/reviews?per_page=100&page=2": [
            {"user": {"login": "copilot-pull-request-reviewer[bot]"}, "body": "new",
             "submitted_at": "2026-02-01T00:00:00Z"},
        ],
        "repos/Acme/repo/issues/1/comments?per_page=100&page=1": [{"body": f"discussion {n}"} for n in range(100)],
        "repos/Acme/repo/issues/1/comments?per_page=100&page=2": [{"body": "last discussion"}],
        "search:user-review-requested:@me:1": {
            "total_count": 3, "incomplete_results": False, "items": [{"number": 2}, {"number": 3}, {"number": 4}],
        },
        "search:team-review-requested:Acme/reviewers:1": {
            "total_count": 2, "incomplete_results": False, "items": [{"number": 2}, {"number": 5}],
        },
        "repos/Acme/repo/pulls/2": pr(2, "bob"),
        "repos/Acme/repo/pulls/3": pr(3, "bob", True),
        "repos/Acme/repo/pulls/4": pr(4, "alice"),
        "repos/Acme/repo/pulls/5": pr(5, "carol"),
    }


class InventoryTests(unittest.TestCase):
    def run_inventory(self, data, args=("--team", "reviewers")):
        path = Path.cwd() / ".inventory-test-fixture"
        path.mkdir(exist_ok=False)
        try:
            (path / "gh").write_text(FAKE_GH, encoding="utf-8")
            (path / "gh").chmod(0o755)
            (path / "fixture.json").write_text(json.dumps(data), encoding="utf-8")
            env = dict(os.environ, PATH=f"{path}{os.pathsep}{os.environ['PATH']}",
                       GH_FIXTURE=str(path / "fixture.json"), GH_LOG=str(path / "log"))
            proc = subprocess.run(["python3", "-I", str(SCRIPT), *args], env=env, capture_output=True, text=True, check=False)
            calls = [json.loads(line) for line in (path / "log").read_text(encoding="utf-8").splitlines()]
            self.assertEqual(proc.stderr, "")
            return proc.returncode, json.loads(proc.stdout), calls
        finally:
            shutil.rmtree(path)

    def test_overlap_filtering_and_nested_pagination(self):
        code, result, calls = self.run_inventory(fixtures())
        self.assertEqual(code, 0)
        self.assertEqual((result["repo"], result["me"]), ("Acme/repo", "alice"))
        self.assertEqual([p["number"] for p in result["review_requests"]["items"]], [2, 5])
        own = result["own_prs"]["items"][0]
        self.assertEqual(len(own["statusCheckRollup"]), 2)
        self.assertEqual([c["body"] for c in own["reviewThreads"][0]["comments"]], ["first", "last"])
        self.assertEqual([t["id"] for t in own["reviewThreads"]], ["T", "T2"])
        self.assertEqual(own["reviewThreads"][1]["comments"][0]["body"], "later thread")
        self.assertEqual(len(own["reviews"]), 101)
        self.assertEqual(own["reviews"][-1]["body"], "new")
        self.assertEqual(len(own["conversationComments"]), 101)
        self.assertEqual(own["conversationComments"][-1]["body"], "last discussion")
        self.assertFalse(any("user/teams" in " ".join(call) for call in calls))
        self.assertTrue(all(call[0] in ("repo", "api") for call in calls))
        self.assertFalse(any("-X" in call or "--method" in call for call in calls))

    def test_rest_and_search_pagination(self):
        data = fixtures()
        data["repos/Acme/repo/pulls?state=open&per_page=100&page=1"] = [pr(n, "other") for n in range(100, 200)]
        data["repos/Acme/repo/pulls?state=open&per_page=100&page=2"] = [pr(1)]
        data["search:user-review-requested:@me:1"] = {
            "total_count": 101, "incomplete_results": False, "items": [{"number": n} for n in range(100, 200)]
        }
        data["search:user-review-requested:@me:2"] = {
            "total_count": 101, "incomplete_results": False, "items": [{"number": 2}]
        }
        for n in range(100, 200):
            data[f"repos/Acme/repo/pulls/{n}"] = pr(n, "bob", True)
        code, result, _ = self.run_inventory(data)
        self.assertEqual(code, 0)
        self.assertEqual([p["number"] for p in result["review_requests"]["items"]], [2, 5])
        self.assertEqual(result["own_prs"]["items"][0]["number"], 1)

    def test_failed_or_truncated_review_lookup_preserves_own_section(self):
        for bad in (
            {"__failure": "membership lookup failed"},
            {"total_count": 1000, "incomplete_results": False, "items": []},
            {"total_count": 1, "incomplete_results": True, "items": []},
            {"total_count": 2, "incomplete_results": False, "items": [{"number": 2}]},
        ):
            with self.subTest(bad=bad):
                data = fixtures()
                key = "search:user-review-requested:@me:1"
                data[key] = bad
                code, result, _ = self.run_inventory(data)
                self.assertEqual(code, 0)
                self.assertTrue(result["own_prs"]["ok"])
                self.assertFalse(result["review_requests"]["ok"])
                self.assertIsNone(result["review_requests"]["items"])
                self.assertTrue(result["review_requests"]["error"])

    def test_incomplete_own_section_is_never_actionable(self):
        for key, bad in (
            ("graphql:checks:c2", {"__failure": "page failed"}),
            ("graphql:comments:T:m2", {"data": {"node": {"comments": connection([], "m2")}}}),
            ("repos/Acme/repo/pulls?state=open&per_page=100&page=1", {"__failure": "PR listing failed"}),
        ):
            with self.subTest(key=key):
                data = fixtures()
                data[key] = bad
                code, result, _ = self.run_inventory(data)
                self.assertEqual(code, 1)
                self.assertFalse(result["own_prs"]["ok"])
                self.assertIsNone(result["own_prs"]["items"])
                self.assertTrue(result["review_requests"]["ok"])

    def test_partial_rest_page_failure_discards_own_results(self):
        data = fixtures()
        data["repos/Acme/repo/issues/1/comments?per_page=100&page=1"] = [{"body": "x"}] * 100
        data["repos/Acme/repo/issues/1/comments?per_page=100&page=2"] = {"__failure": "page 2 failed"}
        code, result, _ = self.run_inventory(data)
        self.assertEqual(code, 1)
        self.assertIsNone(result["own_prs"]["items"])
        self.assertIn("page 2 failed", result["own_prs"]["error"])

    def test_team_search_failure_discards_direct_results(self):
        data = fixtures()
        data["search:team-review-requested:Acme/reviewers:1"] = {"__failure": "team lookup failed"}
        code, result, _ = self.run_inventory(data)
        self.assertEqual(code, 0)
        self.assertIsNone(result["review_requests"]["items"])
        self.assertIn("team lookup failed", result["review_requests"]["error"])

    def test_without_team_only_direct_requests_are_searched(self):
        data = fixtures()
        del data["search:team-review-requested:Acme/reviewers:1"]
        code, result, calls = self.run_inventory(data, args=())
        self.assertEqual(code, 0)
        self.assertEqual([p["number"] for p in result["review_requests"]["items"]], [2])


if __name__ == "__main__":
    unittest.main()
