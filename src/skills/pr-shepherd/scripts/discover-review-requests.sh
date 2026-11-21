#!/usr/bin/env bash
# List open, non-draft PRs in this repo that request your review directly or through any given team.
#   discover-review-requests.sh [ORG/SLUG | SLUG ...]   (a bare SLUG is a team in the repo owner's org)
set -euo pipefail

repository=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
owner=${repository%%/*}

list_requests() {
  gh pr list --repo "$repository" --state open --limit 1000 --search "$1" \
    --json number,title,author,headRefOid,isDraft || {
    printf 'Failed to discover review requests in %s for %s\n' "$repository" "$1" >&2
    return 1
  }
}

requests=$(
  {
    list_requests 'user-review-requested:@me' || exit 1
    for team in "$@"; do
      case "$team" in */*) ;; *) team="$owner/$team" ;; esac
      list_requests "team-review-requested:$team" || exit 1
    done
  } | jq -s '
    if any(.[]; length == 1000) then error("Review request search reached the GitHub result limit")
    else add | map(select(.isDraft | not)) | unique_by(.number)
    end
  '
)
printf '%s\n' "$requests"
