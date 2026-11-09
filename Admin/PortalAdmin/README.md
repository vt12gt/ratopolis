# Administração do Portal RativaGames

Este diretório é a entrada do Admin Geral e reúne os módulos administrativos compartilhados da plataforma.

## Entrada

- `index.html`: central de acesso aos módulos gerais.

## Módulos

- `Equipe/index.html`: gestão de cargos da base global de contas, compartilhada por RativaPolis e RativaSnack.
- `Auditoria/index.html`: consulta somente leitura do histórico administrativo central, com filtros e paginação.\n- `Comunidade/index.html`: moderação em tempo real, banimentos, revisão de avatares e denúncias e comunicados.\n- `Ranking/index.html`: consulta autenticada do ranking geral por XP e do ranking por nível, usando os endpoints de leitura `/api/rankings` e `/api/rankings/level`.
- `Premiacoes/index.html`: simulador da regra de reserva de 60% para o Top 5, com percentuais configuráveis, cálculo em reais e regras mensais de contato/retorno. Não registra pagamentos nem grava apuração oficial; depende de endpoints seguros para isso.
- `Radio/radio_admin.html`: painel de controle da rádio.
- `Radio/radio_stats.html`: estatísticas e relatório de audiência.

## Auditoria e segurança

Os serviços centrais, rádio e comunidade gravam eventos administrativos na tabela `ratopolis_audit_logs`. A consulta é exclusiva de SpAdmin e ADM. A interface não oferece edição ou exclusão dos registros; as permissões de cada operação são validadas no servidor.

O painel de Comunidade conecta ao Worker `ratopolis-community-chat-preview` por ticket temporário e WebSocket. A interface reflete as permissões por cargo; o Worker continua sendo a autoridade final para cada operação. Membros online são obtidos por presença em tempo real. O feed de publicações dos jogadores não possui ação administrativa de exclusão neste módulo.\n\nA migração do painel legado é feita por etapas. Telas locais/demo não são tratadas como operações reais e não devem ser removidas até existir substituto conectado ao servidor e testado.

O mapa de responsabilidades está em [SEPARACAO_PAINES.md](./SEPARACAO_PAINES.md). O portal público único continua sendo o `index.html` da raiz do repositório.
