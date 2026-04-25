#!/usr/bin/env bash
# scripts/clear-opencode-orfe-cache.sh
#
# Clears OpenCode cache entries related to the orfe plugin.
# Usage: ./scripts/clear-opencode-orfe-cache.sh [--dry-run]
#
# Options:
#   --dry-run   Print what would be deleted without deleting anything

set -euo pipefail

CACHE_ROOT="${HOME}/.cache/opencode"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if [[ ! -d "$CACHE_ROOT" ]]; then
  echo "No OpenCode cache directory found at $CACHE_ROOT. Nothing to do."
  exit 0
fi

# Known orfe-specific cache paths (confirmed from ~/.cache/opencode layout)
TARGETS=(
  "$CACHE_ROOT/packages/@mirzamerdovic"
  "$CACHE_ROOT/node_modules/@throw-if-null/orfe"
  "$CACHE_ROOT/node_modules/.bin/orfe"
)

matched=()
for target in "${TARGETS[@]}"; do
  if [[ -e "$target" ]]; then
    matched+=("$target")
  fi
done

if [[ ${#matched[@]} -eq 0 ]]; then
  echo "No orfe-related cache entries found under $CACHE_ROOT. Nothing to do."
  exit 0
fi

echo "Found ${#matched[@]} orfe-related cache entry/entries:"
for entry in "${matched[@]}"; do
  echo "  $entry"
done

if [[ "$DRY_RUN" == true ]]; then
  echo ""
  echo "Dry run — nothing deleted."
  exit 0
fi

echo ""
for entry in "${matched[@]}"; do
  rm -rf "$entry"
  echo "Deleted: $entry"
done

echo ""
echo "Done. Restart OpenCode to pick up the updated orfe plugin."
