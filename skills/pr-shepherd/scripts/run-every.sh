#!/usr/bin/env sh
# Run a pr-shepherd pass with any agent CLI, every INTERVAL seconds (default 600), or once with -1.
#
#   run-every.sh [-i seconds] [-1] -- <agent command and arguments...>
#
# Run from inside the repo. Passes never overlap: a lock directory in the git common dir stops a second
# loop (or a cron-started pass) while one is running. Output is appended to <git-common-dir>/pr-shepherd.log.
set -eu

interval=600
once=false
while [ $# -gt 0 ]; do
  case "$1" in
    -i) interval="$2"; shift 2 ;;
    -1) once=true; shift ;;
    --) shift; break ;;
    *) echo "usage: $0 [-i seconds] [-1] -- <agent command...>" >&2; exit 2 ;;
  esac
done
[ $# -gt 0 ] || { echo "usage: $0 [-i seconds] [-1] -- <agent command...>" >&2; exit 2; }

gitdir=$(git rev-parse --path-format=absolute --git-common-dir)
lock="$gitdir/pr-shepherd.lock"
log="$gitdir/pr-shepherd.log"

owned=false
release() { if $owned; then rmdir "$lock" 2>/dev/null || true; owned=false; fi; }
trap release EXIT
trap 'exit 130' INT TERM

pass() {
  if ! mkdir "$lock" 2>/dev/null; then
    echo "$(date -u +%FT%TZ) skipped: another pass holds $lock (remove it if no pass is running)" | tee -a "$log"
    return 0
  fi
  owned=true
  touch "$log"
  start=$(($(wc -l <"$log") + 1))
  echo "== $(date -u +%FT%TZ) pass start" >>"$log"
  "$@" >>"$log" 2>&1 || echo "$(date -u +%FT%TZ) pass exited with status $?" >>"$log"
  release
  tail -n "+$start" "$log"
}

if $once; then
  pass "$@"
  exit 0
fi

echo "pr-shepherd: a pass every ${interval}s; log: $log; Ctrl-C to stop"
while :; do
  pass "$@"
  sleep "$interval"
done
