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

**Limites identificados:** a identidade de contas foi confirmada como compartilhada entre RativaPolis e RativaSnack. O módulo Equipe administra cargos globais nessa base central. A tela antiga `Equipe e permissões` do painel RativaPolis continua sendo uma matriz local/demo e deve permanecer preservada até substituição testada. A consulta central de auditoria já existe; os eventos dos serviços conectados estão sendo integrados por etapas.

## Próximas tarefas técnicas

1. Conferir a cobertura de auditoria de cada endpoint administrativo legado antes de remover qualquer tela.
2. Criar os módulos reais de comunidade e ranking no Admin Geral, substituindo somente operações locais/demo depois dos testes.
3. Criar ferramentas administrativas específicas do RativaSnack quando forem necessárias, usando a identidade global e a auditoria central.


## Auditoria administrativa — 2026-11-09
- Criada a tela `Admin/PortalAdmin/Auditoria/index.html`, com paginação e filtros por texto/ação.
- Criada a rota `GET /api/admin/audit` no Worker ativo `ratopolis-api-dev-v30` (v39.3-audit-readonly-dev).
- A rota exige sessão autenticada e cargo exatamente `spadm` ou `adm`; usa consultas parametrizadas, retorna registros da tabela `ratopolis_audit_logs` e não disponibiliza edição/exclusão.
- A consulta de auditoria não gera evento de auditoria próprio para evitar recursão/inchaço do histórico.
- O código fonte do repositório foi sincronizado com o Worker ativo, preservando as mudanças de termos, privacidade, locutor e demais endpoints.


## Auditoria ampliada — 2026-11-09
- Confirmado que RativaSnack compartilha a identidade central: `RativaSnack/server/server.js` usa o Worker central para `/api/login` e `/api/me`; `rato-snack-api-dev` valida `ratopolis_sessions` e `ratopolis_users` no mesmo D1.
- O módulo Equipe do Admin Geral agora descreve corretamente o escopo global das contas compartilhadas. O painel específico do RativaSnack ainda não existe; a pasta `Admin/RativaSnack` fica reservada para operações próprias do jogo.
- Worker principal atualizado para `v39.4-audit-radio-coverage`: a allowlist da auditoria agora aceita eventos de envio de áudio, atualização da fila e controles da rádio, com checagem da permissão correspondente.
- Worker `ratopolis-radio-stream` atualizado para `v1.1.1-audit-complete`: upload de áudio, alteração da fila, avanço manual, pausa/retomada/repetição/embaralhamento passam a enviar eventos à auditoria central. Renomear/excluir faixas, playlists nomeadas, programação, anúncios, reprodução e locução já tinham registros.
- `ratopolis-password-admin` já registra redefinições de senha como `admin_password_reset` na mesma tabela central.
- Limite restante: a moderação da comunidade usa Durable Object e ainda não grava seus eventos na tabela central. Não foi criado um atalho inseguro com token longo; será necessário integrar um canal interno autenticado antes de considerar a auditoria completa.
- O Worker RativaSnack atual não possui rotas administrativas próprias; suas rotas existentes são de perfil, recordes, conquistas e inventário do jogador, não ações administrativas. Não foram adicionados eventos de progresso do jogador ao histórico administrativo para evitar misturar auditoria de staff com telemetria do jogo.


## Auditoria da comunidade — 2026-11-09
- Worker `ratopolis-community-chat-preview` atualizado para `1.2.0-community-audit` e ligado ao mesmo D1 central (`ratopolis_audit_logs`).
- Eventos registrados: consulta de banimentos, concessão de símbolo, consulta/revisão de fotos, consulta/revisão de denúncias, remoção de avatar, mute/unmute/ban/unban e publicação de avisos.
- O ator é identificado pelo ID real da conta validada no login central; o token de sessão não é armazenado no Durable Object.
- Se o D1 estiver indisponível, o evento fica em fila persistente no Durable Object e é reenviado durante a limpeza agendada.
- A moderação de chat foi restringida a SpAdmin, ADM e GM, conforme a mensagem de permissão existente; locutor continua podendo publicar avisos, mas não banir ou silenciar.
- A tela de auditoria agora exibe como alvo o nickname/chave de jogador presente nos detalhes quando o evento não possui `target_user_id` relacional.
- Feed posts e ações comuns de jogadores não são misturados ao histórico administrativo. O feed continua sendo conteúdo de jogadores, não operação de staff.
