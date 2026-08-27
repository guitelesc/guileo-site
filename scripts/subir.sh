#!/usr/bin/env bash
# Sobe SÓ com tudo verde. Existe porque eu deployei DUAS vezes com teste vermelho no mesmo dia:
# um `for` que só imprime ❌ não faz o `&&` seguinte parar. Aqui o teste é um portão, não um aviso.
set -euo pipefail
cd "$(dirname "$0")/.."
falhou=0
for t in $(find functions src -name "*.test.mjs" | sort); do
  node "$t" >/dev/null 2>&1 || { echo "❌ $t"; falhou=1; }
done
[ "$falhou" -eq 0 ] || { echo "→ deploy ABORTADO: teste vermelho"; exit 1; }
echo "✅ testes verdes"
npm run build
npx wrangler pages deploy dist --project-name=guileoai --branch=main
