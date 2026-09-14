#!/bin/sh
# Prunes old paxpivot-{api,web} images after an upgrade, keeping only the currently deployed tag
# and an explicitly given previous tag (for rollback). Usage:
#   ./deploy/prune-images.sh <previous-tag>
# See docs/DEPLOYMENT.md ("First start / upgrade"). Self-contained on purpose: it re-reads the
# currently deployed tag from .env.production itself rather than trusting a shell variable that
# may not exist if this is run standalone or in a later session, and it refuses to prune at all if
# either tag is empty. An earlier version relied on the caller's $TAG/$PREVIOUS_TAG shell
# variables; if either was unset when this block was run alone, GNU grep's
# `-v -E "^(|)$"` matches every non-empty tag and every image was removed, including the running
# and rollback ones. This version never builds that pattern.
set -eu

cd /opt/paxpivot

previous_tag="${1:-}"
env_file="/opt/paxpivot/.env.production"
current_tag=$(grep -m1 '^PAXPIVOT_TAG=' "$env_file" 2>/dev/null | cut -d '=' -f2-) || current_tag=""

if [ -z "$current_tag" ]; then
	echo "prune-images: PAXPIVOT_TAG is not set in $env_file; refusing to prune" >&2
	exit 1
fi
if [ -z "$previous_tag" ]; then
	echo "prune-images: usage: $0 <previous-tag>; refusing to prune with no previous tag given" >&2
	exit 1
fi

running_images=$(docker ps --format '{{.Image}}')

for repo in paxpivot-api paxpivot-web; do
	docker images "$repo" --format '{{.Tag}}' | while IFS= read -r tag; do
		case "$tag" in
			"$current_tag" | "$previous_tag")
				continue
				;;
		esac
		if printf '%s\n' "$running_images" | grep -qFx "$repo:$tag"; then
			echo "prune-images: skipping $repo:$tag (currently running)"
			continue
		fi
		docker rmi "$repo:$tag"
	done
done
