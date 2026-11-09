# Admin Geral — RativaGames

## Objetivo

Centralizar a administração dos recursos compartilhados da RativaGames sem misturar a operação interna de cada jogo. O portal público continua sendo único e permanece em `/index.html`.

## Quem pode acessar

1. **Dono:** acesso total a todas as áreas e configurações administrativas.
2. **Administrador autorizado:** acesso somente após autorização explícita do dono e limitado às permissões atribuídas.

Regras obrigatórias:

- Não permitir cadastro público de administradores.
- Não conceder privilégios automaticamente por conhecer um link ou URL do painel.
- Exigir autenticação e validar permissões no servidor em toda operação administrativa.
- Um administrador comum não pode elevar a própria permissão, autorizar outros administradores nem remover o acesso do dono.
- Revogar o acesso deve invalidar sessões e credenciais administrativas aplicáveis.
- A interface pode ocultar funções sem permissão, mas a segurança precisa ser aplicada também na API/Worker.

## Áreas previstas

- Visão geral: contas, jogadores online, atividade e indicadores do portal e dos jogos.
- Jogadores: consulta de contas, advertências, suspensões e histórico de moderação.
- Portal e comunidade: publicações, denúncias, ranking, notícias e rádio.
- Equipe: administradores, moderadores e permissões individuais.
- Serviços: estado dos serviços, erros e eventos operacionais.
- Auditoria: pesquisa e consulta do histórico administrativo.

## Separação dos produtos

- **PortalAdmin:** recursos compartilhados da RativaGames.
- **Admin/RativaPolis:** operações específicas do jogo RativaPolis.
- **Admin/RativaSnack:** operações específicas do jogo RativaSnack, quando seu painel próprio existir.

O Admin Geral poderá oferecer atalhos e uma visão consolidada, mas não deve misturar dados nem substituir as regras específicas de cada jogo.

## Histórico administrativo completo

Registrar toda ação administrativa bem-sucedida ou tentativa relevante, incluindo:

- autenticação administrativa, falhas de acesso e encerramento de sessão;
- criação, alteração, autorização, mudança de permissão e revogação de membros da equipe;
- consulta ou alteração de contas quando envolver operação privilegiada;
- advertências, suspensões, banimentos e reversões;
- alterações em configurações, ranking, recompensas, eventos, rádio e comunidade;
- ações administrativas executadas nos painéis dos jogos;
- falhas, recusas por falta de permissão e erros em operações administrativas.

Cada evento deve conter, quando aplicável:

- data e hora confiáveis do servidor, armazenadas em UTC;
- identificador do responsável e função/permissão usada;
- ação executada, área e sistema de origem;
- alvo afetado (por exemplo, ID da conta ou recurso);
- resultado (sucesso, negado ou falha);
- valores anteriores e novos para alterações, sem registrar senhas, tokens, segredos ou dados de autenticação;
- identificador de correlação da solicitação para investigação técnica.

## Proteção dos registros

- A gravação deve ocorrer no servidor, não apenas no navegador.
- Os registros devem ser append-only: usuários administrativos comuns não podem editar nem apagar o histórico.
- Restringir a consulta do histórico a pessoas autorizadas; o dono tem acesso integral.
- Proteger os registros contra acesso público e alterações indevidas.
- Registrar também tentativas de acesso e falhas de gravação, com monitoramento para evitar ações administrativas sem trilha de auditoria.
- Definir política de retenção e backups seguros antes da entrada em produção; não descartar registros automaticamente sem decisão explícita do dono.

## Estado de implementação

Este documento registra as decisões e os requisitos aprovados para orientar o desenvolvimento. A documentação, por si só, **não significa que autenticação, permissões ou auditoria já estejam implementadas no backend**. Cada requisito deverá ser implementado e testado nos serviços responsáveis antes de ser considerado ativo em produção.
