# Transição controlada de autenticação — RativaGames

**Status:** ponte temporária autorizada em 2026-11-11  
**Repositório:** `vt12gt/RativaGames`  
**Branch de referência:** `main`

## Decisão aprovada

Manter temporariamente `ratopolis-api-dev-v30` como API de autenticação utilizada pelo portal e pelos serviços que validam a sessão, enquanto é preparada uma separação definitiva entre desenvolvimento e produção.

Esta decisão **não** significa que o Worker de desenvolvimento foi renomeado ou convertido em produção. O nome atual, as rotas e a infraestrutura permanecem explícitos para evitar uma migração disfarçada.

## Estado confirmado na auditoria

- O portal `index.html` define `API` como `https://ratopolis-api-dev-v30.juniorgmj69.workers.dev`.
- O portal também define serviços separados para Core, RativaPolis, Admin, RatoSnack, comunidade/chat, rádio e salas. Não substituir esses endereços em bloco.
- O Worker `ratopolis-community-chat-preview` define `AUTH_API` e `ADMIN_API` para a mesma API `ratopolis-api-dev-v30`.
- O Worker da comunidade possui o binding de serviço `AUTH_SERVICE` apontado para `ratopolis-api-dev-v30`; as rotas de autenticação podem usar esse binding.
- A API atual possui D1 associado. A infraestrutura da comunidade também usa esse mesmo banco e um Durable Object com estado persistido. O ID do D1 compartilhado é `f9555968-014d-499a-addd-e8bfbe4fb471`.
- Os bindings secretos da API incluem `COMPETITION_SECRET`, `MP_ACCESS_TOKEN`, `PROGRESSION_SECRET`, `REWARD_SECRET` e `ROOM_SESSION_REVOKE_SECRET`. Foram identificados apenas os nomes; os valores não foram lidos nem alterados.
- O binding de serviço do Worker de comunidade está configurado como `AUTH_SERVICE` → `ratopolis-api-dev-v30` (ambiente `production`). O rótulo do ambiente não muda o nome nem a natureza de desenvolvimento do Worker de destino.
- A versão implantada do Worker de comunidade continua identificada como **PREVIEW** na anotação de implantação. A existência do código na branch `main` não prova, por si só, que o portal publicado já esteja executando a versão nova.

## Escopo funcional identificado no código versionado

O arquivo `workers/ratopolis-api-dev-v30.js` no branch `main` contém rotas para:

- **Identidade e sessão:** cadastro, login, perfil autenticado e logout.
- **Conta e jogo:** jogadores, rankings, progressão, recompensas, calendário diário, inventário, loja, gifts e eventos.
- **Pagamentos:** checkout e webhooks do Mercado Pago para doações e loja.
- **Administração:** perfil/permissões administrativas, usuários, auditoria, logs de acesso e gestão de catálogos/eventos.
- **Editor de cenários:** salvar, enviar, testar, revisar e publicar cenários.
- **Integrações internas:** recompensas de competição, concessão de recompensas e auditoria/controle de transmissão da rádio.

O login também chama o Worker de salas `ratopolis-room-server-v1` para revogar a sessão substituída, usando `ROOM_SESSION_REVOKE_SECRET`. A migração, portanto, não é apenas trocar o endpoint do formulário de login: ela precisa preservar os contratos usados pelos jogos, painel administrativo, pagamentos, rádio e salas.

**Ponto de atenção:** o código versionado referencia `ADMIN_BOOTSTRAP_SECRET`, mas esse nome não apareceu entre os bindings secretos configurados na API durante a auditoria. A rota de bootstrap verifica esse segredo e, sem ele, recusa a operação. Não foi criado nem alterado segredo algum; confirmar se essa rota deve permanecer desativada ou se precisa de configuração própria antes da migração.

A inspeção do arquivo no GitHub não comprova, por si só, que ele seja byte a byte igual ao código atualmente implantado no Worker. Essa correspondência deve ser conferida antes de uma migração.

## Regras de preservação

1. Não apagar, recriar ou renomear `ratopolis-api-dev-v30` durante esta etapa.
2. Não trocar o banco D1 por um banco vazio, nem copiar dados parcialmente.
3. Não alterar secrets, bindings, migrations ou namespaces de Durable Objects sem plano de migração e validação.
4. Não remover o Worker de preview nem promover sua versão automaticamente para produção.
5. Não declarar a autenticação ou o feed social como testados em produção sem testes reais de login, sessão, permissões e operações administrativas.

## Plano de separação definitiva

A migração para uma API de produção independente deverá seguir esta ordem:

1. Inventariar rotas de autenticação, sessão, recuperação de conta, permissões e auditoria usadas pelo portal e pelos jogos.
2. Inventariar bindings, D1, migrations, secrets e integrações dependentes da API atual, sem expor valores secretos.
3. Criar o Worker de produção separado, com configuração e secrets próprios.
4. Inventariar e provisionar de forma segura os segredos necessários na nova API, sem copiar valores por canais inseguros.
5. Definir como os dados existentes serão mantidos ou migrados, com backup e estratégia de retorno.
6. Testar login, leitura de perfil, renovação/expiração de sessão, autorização administrativa, auditoria e integração com a comunidade em ambiente de teste.
7. Fazer a troca dos endpoints de forma controlada, serviço por serviço, mantendo a API antiga disponível durante a janela de validação.
8. Só desativar a API antiga após confirmação de que nenhum portal, jogo, Worker ou cliente ainda depende dela.

## Limite desta etapa

Nesta etapa foi registrada a decisão aprovada e o mapa de dependências conhecido. Nenhum Worker, banco, Durable Object, secret ou endpoint de produção foi alterado. A próxima etapa técnica é completar o inventário de rotas e dependências da API antes de criar a API independente.
