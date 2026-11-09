# Plano de separação dos painéis administrativos

## Objetivo

Separar a administração compartilhada da RativaGames da administração específica do jogo RativaPolis, aproveitando o painel legado já existente e preservando suas integrações.

## Estrutura de destino

- `Admin/PortalAdmin/`: administração compartilhada da plataforma.
- `Admin/RativaPolis/`: administração específica do RativaPolis.
- `Admin/RativaSnack/`: reservado para ferramentas administrativas próprias do RativaSnack, quando existirem.

## Mapeamento inicial do painel legado v65.3

### Destino: Admin Geral / PortalAdmin

- Visão geral e relatórios globais (após trocar fontes locais/demo por dados confiáveis do servidor).
- Consulta de contas globais e perfis de jogadores (se o cadastro for compartilhado).
- Equipe, autorização de administradores e matriz de permissões.
- Auditoria administrativa completa.
- Registros protegidos de acesso, conforme escopo e política de privacidade.
- Integração e configurações do portal.
- Rádio e estatísticas da rádio (já estão separados em `Radio/`).

### Destino: Admin RativaPolis

- Fases, salas, cenários e fila de aprovação.
- XP, economia, loja, catálogo, inventário e gifts.
- Missões e recompensas específicas do jogo.
- Guildas, ranking do jogo, competições e temporadas.
- Regras e balanceamento.
- Eventos e feedback específicos do RativaPolis.

### Revisão de escopo antes de mover

Moderação, pagamentos, avisos, notificações e eventos precisam ser classificados pelo alcance real de cada registro: plataforma inteira ou apenas um jogo. Não mover até confirmar os endpoints e a origem dos dados.

## Diagnóstico do painel atual

O arquivo legado é um HTML monolítico com navegação e JavaScript compartilhados. Algumas seções são explicitamente demonstrativas e guardam dados no navegador; outras consultam endpoints reais do Worker. A seção de jogadores mistura uma tabela demo local com consulta real de contas. Portanto, uma simples cópia ou remoção de blocos poderia quebrar funções, duplicar ações ou dar impressão falsa de que uma operação demo é real.

## Etapas seguras

1. Preservar o painel atual e mapear cada módulo, fonte de dados, endpoint e permissão.
2. Extrair primeiro os módulos compartilhados para PortalAdmin, mantendo compatibilidade com o Worker.
3. Testar login, autorização, operações e auditoria no novo caminho.
4. Remover do painel RativaPolis somente os módulos que tenham substituto testado.
5. Repetir o processo para RativaSnack quando houver painel próprio.

## Critério de conclusão

Um módulo só será considerado migrado quando funcionar no painel de destino, validar autorização no servidor, registrar auditoria quando aplicável e não depender de dados locais demonstrativos para operações que prometem alterar dados reais.
