# Rativa Core — arquitetura multi-D1

## Estado desta entrega (desenvolvimento)

- D1 isolada do RativaSnack: `rativasnack-dev-isolated`.
- D1 isolada do Rativapolis: `rativapolis-dev-isolated`.
- Worker `rativa-core-dev` implantado com bindings `PORTAL_DB`, `SNACK_DB`, `POLIS_DB`.
- Health check e busca administrativa somente leitura disponíveis no Worker de desenvolvimento.
- Busca administrativa exige sessão válida do Portal e papel `spadm` ou `adm`; cada consulta é registrada no log administrativo do Portal.
- Tabelas-base de identidade, credenciais, sessões e auditoria criadas nos dois bancos novos.

## Topologia

O Portal continua na D1 atual durante a transição. Snack e Polis terão bancos independentes. Rativa Core faz consultas separadas e agrega os resultados na camada de aplicação. Não há JOIN nem transação SQL entre bancos.

## IDs públicos

- Portal: `RV-`.
- RativaSnack: `RS-`.
- Rativapolis: `RP-`.
- IDs públicos são identificadores curtos, imutáveis, únicos dentro de cada jogo e gerados exclusivamente no servidor.
- O helper `workers/lib/game-public-id.js` usa aleatoriedade criptográfica e faz verificação de colisão; a restrição UNIQUE do banco é a proteção final.
- ID público nunca é senha, token ou prova de autenticação.
- UUIDs internos existentes não serão reescritos.

## Independência de contas e progresso

Cada jogo terá suas próprias credenciais, sessões e perfis. Nicknames podem coincidir entre jogos. Níveis, XP, moedas, recordes, inventários, conquistas e rankings ficam exclusivamente no banco do respectivo jogo.

## Situação legada constatada

Os Workers `ratopolis-api-dev-v30` e `rato-snack-api-dev` estavam ligados à mesma D1 `ratopolis-dev-v31`. O Worker do Snack valida atualmente o bearer token consultando `ratopolis_sessions` e `ratopolis_users` e seus dados de jogo estão nas tabelas `rato_snack_*`, com FKs para `ratopolis_users`. Isso significa que o Snack ainda depende da identidade/sessão do Portal.

O repositório `RativaGames` contém o Worker e o HTML do Rativapolis, mas não foi localizado um repositório independente de backend chamado Rativapolis. Portanto, a separação da autenticação do Polis também requer adaptação do Worker existente.

## Migração segura — ainda não executada

1. Fazer backup verificável da D1 atual e registrar contagens por tabela.
2. Preparar schemas completos do Snack e Polis nas D1s isoladas.
3. Migrar registros de jogo por script idempotente, preservando IDs legados via `legacy_user_id`.
4. Não copiar credenciais ou sessões do Portal para os jogos. Criar fluxo próprio de autenticação/recuperação para cada jogo.
5. Validar contagens, FKs, rankings, inventários, recordes e totais de moeda antes/depois.
6. Testar concorrência na geração dos IDs, login, logout, expiração e revogação de sessões.
7. Trocar os bindings dos Workers de jogo somente após homologação e com rollback preparado.

## Camada Rativa Core

Worker: `rativa-core-dev`.

Endpoints:
- `GET /health`: verifica conexão e contagem de usuários por banco.
- `GET /api/core/health`: alias do health check.
- `GET /api/core/admin/search?q=<termo>`: busca nickname/ID nas três bases. Exige bearer de sessão Portal válida e papel `spadm` ou `adm`. Registra a consulta no log de auditoria do Portal.

O Admin Geral deve continuar com autorização de servidor; não confiar em permissões vindas do navegador. Consultas entre bancos são feitas separadamente. Escritas devem ser sempre direcionadas ao banco de origem e registradas em auditoria.

## Arquivos SQL

- `migrations/snack/0001_identity.sql`
- `migrations/polis/0001_identity.sql`

As migrações-base criam identidade, credenciais, sessões e auditoria. Elas não movem usuários nem alteram os Workers atuais.
