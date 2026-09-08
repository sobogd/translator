#!/usr/bin/env bash
# Dump the ENTIRE prod .env file of iq-rest dashboard-api (the source of the
# Apple service credentials) to your terminal.
#
# The file is printed only to YOUR terminal — nothing is copied into any chat
# or repo. Secrets in it (DATABASE_URL, SMTP_PASS, private keys…) are yours to
# handle; don't paste the output anywhere public.
#
# Usage:
#   ./scripts/dump-prod-env.sh                # print the whole file
#   ./scripts/dump-prod-env.sh > out.env      # save it to a local file
#   HOST=... SSH_USER=... ./scripts/dump-prod-env.sh   # override target
#
# The path can be changed with SRC_ENV=... (defaults to the iq-rest app whose
# .env carries APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_SERVICES_ID / APPLE_PRIVATE_KEY).

set -euo pipefail

HOST="${HOST:-46.225.143.221}"
SSH_USER="${SSH_USER:-deployer}"
SRC_ENV="${SRC_ENV:-/home/deploy/apps/iq-rest-dashboard-api/.env}"

echo "Dumping ${SSH_USER}@${HOST}:${SRC_ENV}" >&2
ssh -o BatchMode=yes -o ConnectTimeout=10 "${SSH_USER}@${HOST}" "cat '${SRC_ENV}'"
