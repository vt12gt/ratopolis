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


## Etapa executada: Equipe e cargos

Foi criado `Equipe/index.html` como módulo do Admin Geral. Ele usa os endpoints existentes do Worker `ratopolis-api-dev-v30`:

- `GET /api/admin/me`: valida sessão e permissões no servidor.
- `GET /api/admin/users`: consulta contas e cargos atuais.
- `POST /api/admin/role`: altera cargo, com validação de hierarquia no servidor e gravação de `admin_role_change` em `ratopolis_audit_logs` na mesma operação de banco.

A interface só habilita alterações quando a resposta do servidor concede `manageStaff` e o cargo é SpAdmin ou ADM. A rota do Worker impede atribuir SpAdmin, alterar usuário de cargo igual/superior ou promover alguém a cargo igual/superior ao operador.

**Limites identificados:** a lista consultada é a base de contas do Worker RativaPolis v30; não está comprovado ainda que RativaSnack compartilha integralmente a mesma identidade/backend. A tela antiga `Equipe e permissões` do painel RativaPolis é explicitamente um diretório/matriz local de demonstração, não uma gestão real da equipe. Ela deve permanecer no legado até validar que o novo módulo atende o escopo compartilhado e então ser removida em commit separado. O Worker grava auditoria para alterações de cargo, mas ainda não foi encontrada rota de leitura dos registros administrativos gerais; a tela de Auditoria antiga também é local/demo. Portanto, o histórico completo e sua consulta central ainda não estão migrados.

## Próximas tarefas técnicas

1. Criar rota protegida de consulta/paginação da auditoria administrativa no Worker, com autorização específica e sem permitir edição/exclusão de logs.
2. Validar identidade compartilhada entre RativaPolis e RativaSnack antes de chamar o diretório de contas de totalmente global.
3. Migrar os demais módulos gerais um a um, preservando a versão antiga até teste concluído.


## Auditoria administrativa — 2026-11-09
- Criada a tela `Admin/PortalAdmin/Auditoria/index.html`, com paginação e filtros por texto/ação.
- Criada a rota `GET /api/admin/audit` no Worker ativo `ratopolis-api-dev-v30` (v39.3-audit-readonly-dev).
- A rota exige sessão autenticada e cargo exatamente `spadm` ou `adm`; usa consultas parametrizadas, retorna registros da tabela `ratopolis_audit_logs` e não disponibiliza edição/exclusão.
- A consulta de auditoria não gera evento de auditoria próprio para evitar recursão/inchaço do histórico.
- O código fonte do repositório foi sincronizado com o Worker ativo, preservando as mudanças de termos, privacidade, locutor e demais endpoints.
