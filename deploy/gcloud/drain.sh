#!/usr/bin/env bash
set -euo pipefail
artillery_script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
exec node "$artillery_script_dir/ops.mjs" drain "$@"
