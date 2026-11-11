#!/bin/sh
set -eu

PATH=/snap/bin:/usr/local/bin:/usr/bin:/bin
export PATH
cd "$(dirname "$0")"

image=${COOKBOOK_IMAGE:-ghcr.io/polonium14/ss14-cookbook:latest}
webroot=${COOKBOOK_WEBROOT:-/var/www/html/ss14-cookbook}

if ! out=$(docker pull --quiet "$image" 2>&1); then
  echo "$(date -Is) pull failed:"
  echo "$out"
  exit 1
fi

latest=$(docker image inspect --format '{{.Id}}' "$image")
deployed=$(cat .deployed 2>/dev/null || echo none)
if [ "$latest" = "$deployed" ]; then
  exit 0
fi

echo "$(date -Is) deploying $image $latest"

rm -rf staging
container=$(docker create "$image")
trap 'docker rm "$container" >/dev/null 2>&1 || true' EXIT
docker cp --quiet "$container:/site/." staging/

rsync -rtp --chmod=D755,F644 \
  --exclude=/index.html --exclude=/data/index.json \
  staging/ "$webroot/"
rsync -tp --chmod=F644 staging/data/index.json "$webroot/data/"
rsync -tp --chmod=F644 staging/index.html "$webroot/"

rm -rf staging
echo "$latest" > .deployed
docker image prune --force \
  --filter "label=org.opencontainers.image.title=ss14-cookbook" >/dev/null
echo "$(date -Is) done"
