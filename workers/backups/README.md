# Backup e rollback do Worker de salas

O Worker de produção `ratopolis-room-server-v1` foi atualizado para `v6.1.0-ws-hibernation-roster-fix`.

- Versão Cloudflare anterior preservada: **62** (`4faa5543-158c-46e3-bd82-b5cf2817f4d2`).
- Versão Cloudflare nova: **63** (implantada em 2026-10-29).
- Código-fonte da versão corrigida: [ratopolis-room-server-v1_v6.1.0_ws-hibernation-roster-fix.js](../ratopolis-room-server-v1_v6.1.0_ws-hibernation-roster-fix.js).
- O rollback deve ser feito pelo histórico de versões/deployments do Worker na Cloudflare, escolhendo a versão 62.

A versão anterior não foi copiada para este arquivo porque o endpoint de leitura de conteúdo retornou dados truncados pelo conector. Não usar uma cópia parcial como backup executável.
