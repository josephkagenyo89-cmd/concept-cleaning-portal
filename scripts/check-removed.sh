#!/usr/bin/env bash
fail=0
check() {
  if git grep -q -E "$1" -- src index.html; then
    echo "REMOVED FEATURE BACK: $2"
    git grep -n -E "$1" -- src index.html | head -5
    fail=1
  fi
}
check "serviceVideo|categoryVideo" "demo video helpers"
check "<video|<source " "video element"
check "home-deep-cleaning-demo|homepage-hero" "demo video asset paths"
if git ls-files | grep -q -E "\.mp4$"; then
  echo "MP4 FILE TRACKED IN REPO:"
  git ls-files | grep -E "\.mp4$"
  fail=1
fi
[ $fail -eq 0 ] && echo "OK: no removed features present"
exit $fail
