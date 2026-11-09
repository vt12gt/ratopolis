# Administração do Portal RativaGames

Este diretório é a entrada do Admin Geral e reúne os módulos administrativos compartilhados da plataforma.

## Entrada

- `index.html`: central de acesso aos módulos gerais.

## Módulos

- `Equipe/index.html`: gestão de cargos da base global de contas, compartilhada por RativaPolis e RativaSnack.
- `Auditoria/index.html`: consulta somente leitura do histórico administrativo central, com filtros e paginação.
- `Radio/radio_admin.html`: painel de controle da rádio.
- `Radio/radio_stats.html`: estatísticas e relatório de audiência.

## Auditoria e segurança

Os serviços centrais, rádio e comunidade gravam eventos administrativos na tabela `ratopolis_audit_logs`. A consulta é exclusiva de SpAdmin e ADM. A interface não oferece edição ou exclusão dos registros; as permissões de cada operação são validadas no servidor.

A migração do painel legado é feita por etapas. Telas locais/demo não são tratadas como operações reais e não devem ser removidas até existir substituto conectado ao servidor e testado.

O mapa de responsabilidades está em [SEPARACAO_PAINES.md](./SEPARACAO_PAINES.md). O portal público único continua sendo o `index.html` da raiz do repositório.
