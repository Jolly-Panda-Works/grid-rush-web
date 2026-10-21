#!/usr/bin/env bash
# Decides version + what to build. Used by .github/workflows/android.yml (kept in a script so it can be tested locally).
# Inputs (env): EVENT, REF_TYPE, REF_NAME, RUN_NUMBER, PR_NUMBER, INPUT_BUMP, INPUT_BUILD, INPUT_RELEASE, HAS_KS
# Output: key=value lines appended to $GITHUB_OUTPUT (stdout when run locally)
set -euo pipefail

OUT="${GITHUB_OUTPUT:-/dev/stdout}"
EVENT="${EVENT:-push}"
BASE="$(node -p "require('./package.json').version")"
MSG="$(git log -1 --pretty=%B 2>/dev/null || true)"

# Which part to bump: commit message "[minor]" / "[major]" (or #minor / #major); default patch. Manual runs choose it explicitly.
BUMP=patch
if echo "$MSG" | grep -qiE '(\[major\]|#major)'; then BUMP=major
elif echo "$MSG" | grep -qiE '(\[minor\]|#minor)'; then BUMP=minor; fi
if [ "$EVENT" = workflow_dispatch ]; then BUMP="${INPUT_BUMP:-patch}"; fi

LAST="$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -n1 || true)"

next_version() {
  if [ -z "$LAST" ]; then echo "$BASE"; return; fi   # first release uses the version from package.json
  local ma mi pa
  IFS=. read -r ma mi pa <<< "${LAST#v}"
  pa="${pa%%[!0-9]*}"
  case "$BUMP" in
    major) echo "$((ma + 1)).0.0" ;;
    minor) echo "${ma}.$((mi + 1)).0" ;;
    *)     echo "${ma}.${mi}.$((pa + 1))" ;;
  esac
}

PUBLISH=true
if [ "$EVENT" = pull_request ]; then
  VERSION="${BASE}-pr${PR_NUMBER:-0}"; PUBLISH=false
elif [ "${REF_TYPE:-}" = tag ]; then
  VERSION="${REF_NAME#v}"
elif [ "$EVENT" = workflow_dispatch ] && [ "${INPUT_RELEASE:-true}" = false ]; then
  VERSION="${BASE}-dev.${RUN_NUMBER:-0}"; PUBLISH=false
else
  VERSION="$(next_version)"
fi

# What to build: signed release when the keystore secrets exist, otherwise a debug APK.
REQ="${INPUT_BUILD:-auto}"
if [ "$EVENT" = pull_request ]; then BUILD=debug
else
  case "$REQ" in
    debug-apk)   BUILD=debug ;;
    release-apk) BUILD=release-apk ;;
    release-aab) BUILD=release-aab ;;
    *)           if [ "${HAS_KS:-false}" = true ]; then BUILD=release-both; else BUILD=debug; fi ;;
  esac
fi
case "$BUILD" in
  debug)        TASK=assembleDebug;                    SIGNED=false ;;
  release-apk)  TASK=assembleRelease;                  SIGNED=true ;;
  release-aab)  TASK=bundleRelease;                    SIGNED=true ;;
  release-both) TASK="assembleRelease bundleRelease";  SIGNED=true ;;
esac
if [ "$SIGNED" = true ] && [ "${HAS_KS:-false}" != true ]; then
  echo "::error::A release build needs the secrets ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS and ANDROID_KEY_PASSWORD (see README)." >&2
  exit 1
fi

{
  echo "version=$VERSION"
  echo "publish=$PUBLISH"
  echo "build=$BUILD"
  echo "task=$TASK"
  echo "signed=$SIGNED"
  echo "bump=$BUMP"
} >> "$OUT"
