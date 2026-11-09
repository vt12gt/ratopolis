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
- O helper `workers/lib/game-public-id.js` gera RS e RP para as D1s isoladas, usando aleatoriedade criptográfica e verificação de colisão; a restrição UNIQUE do banco é a proteção final. O RV do Portal depende de uma migração própria de registro de IDs na D1 do Portal e ainda não foi ativado.
- ID público nunca é senha, token ou prova de autenticação.
- UUIDs internos existentes não serão reescritos.

## Independência de contas e progresso

Cada jogo terá suas próprias credenciais, sessões e perfis. Nicknames podem coincidir entre jogos. Níveis, XP, moedas, recordes, inventários, conquistas e rankings ficam exclusivamente no banco do respectivo jogo.

## Situação legada constatada

Os Workers `ratopolis-api-dev-v30` e `rato-snack-api-dev` estavam ligados à mesma D1 `ratopolis-dev-v31`. O Worker do Snack valida atualmente o bearer token consultando `ratopolis_sessions` e `ratopolis_users` e seus dados de jogo estão nas tabelas `rato_snack_*`, com FKs para `ratopolis_users`. Isso significa que o Snack ainda depende da identidade/sessão do Portal.

O repositório `RativaGames` contém o Worker e o HTML do Rativapolis, mas não foi localizado um repositório independente de backend chamado Rativapolis. Portanto, a separação da autenticação do Polis também requer adaptação do Worker existente.

## Migração inicial de dados em desenvolvimento

Foi feita uma cópia controlada da D1 atual para as D1s isoladas, sem apagar nem alterar registros na origem. Não foram copiadas senhas, hashes de senha, e-mails, tokens ou sessões. Cada registro migrado mantém o vínculo antigo em `legacy_user_id`, recebe um novo UUID interno e um ID público de jogo.

- **Snack:** 2 contas com perfil, 2 perfis, 6 itens de inventário e 1 ciclo de ranking. As tabelas de conquistas, recordes e snapshots estavam vazias na origem.
- **Polis:** 19 contas, 19 perfis, 51 eventos de recompensa, 5 cenários, 6 versões, 1 revisão, 45 itens no registro, 31 itens no catálogo e 1 presente. As tabelas de compras, inventário da loja, VIP pago, resgates, eventos e ledger estavam vazias na origem.
- Verificação `PRAGMA foreign_key_check`: zero violações nas duas bases após a cópia.

A cópia está em desenvolvimento e ainda não atende jogadores porque os Workers atuais continuam autenticando pela D1 antiga. Nenhum usuário foi obrigado a redefinir senha nem teve sua conta alterada na origem.

## Próximas etapas obrigatórias antes de produção

1. Criar backup verificável da D1 original e registrar contagens completas por tabela.
2. Integrar os Workers do Snack e Polis aos novos bancos e implementar cadastro/login/sessões independentes.
3. Criar fluxo de vinculação/recuperação para os jogadores migrados; não copiar credenciais nem sessões do Portal.
4. Validar contagens, FKs, rankings, inventários, recordes, moedas e cenários antes/depois.
5. Testar concorrência na geração dos IDs, login, logout, expiração e revogação de sessões.
6. Trocar bindings/rotas dos Workers de jogo somente após homologação e com rollback preparado.

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
