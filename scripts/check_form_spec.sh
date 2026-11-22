#!/usr/bin/env bash
# The staff-form checks run on the website and on the server. The two copies must stay identical.
set -e
cd "$(dirname "$0")/.."
if diff -q app/lib/formSpec.ts supabase/functions/upload-document/formSpec.ts >/dev/null; then
  echo "formSpec.ts: both copies match"
else
  echo "formSpec.ts differs from supabase/functions/upload-document/formSpec.ts. Copy app/lib/formSpec.ts over it and redeploy the function." >&2
  exit 1
fi
