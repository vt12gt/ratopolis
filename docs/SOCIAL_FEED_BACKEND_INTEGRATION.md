# RativaGames — integração do feed social (fase 1)

## Estado confirmado — 11/11/2026

A implementação do feed social está na branch isolada `feature/social-community`.

- Portal cliente: `index.html`.
- Worker: `workers/ratopolis-community-chat-preview.js`.
- Painel de moderação: `Admin/PortalAdmin/Comunidade/index.html`.
- Worker de preview: `ratopolis-community-chat-preview.juniorgmj69.workers.dev`.
- API de autenticação usada pelo Worker: `ratopolis-api-dev-v30`.

## Implementado no código

- Reações ❤️ 😂 😮 👏 🔥 persistidas no Durable Object, com alternância por membro.
- Comentários persistidos, até 250 caracteres, máximo de 8 por minuto por membro.
- Consulta de comentários e contagem no histórico do feed.
- Exclusão pelo autor ou equipe autorizada.
- Denúncia com motivos permitidos, prevenção de duplicidade por membro e trilha de auditoria.
- Fila administrativa para consultar, arquivar ou remover publicações denunciadas.
- Autenticação validada no servidor; ticket sem sessão de conta é recusado.
- Publicação e interação bloqueadas para contas banidas.
- Feed mantém expiração de 12 horas.

## Implantação de teste

- Commit do código do Worker: `aa8127057d99fe78beb132aaf6dfa43458b42ca6`.
- Versão Cloudflare de preview implantada: **38**.
- Deployment ativo: `eda68e4f-d539-4cf7-a6d6-f8c9dcdec9ee`.
- Tráfego do Worker de preview direcionado 100% para a versão 38.
- Binding existente do Durable Object preservado: `CommunityRoom`, namespace `4695a38376e34a7e9621918e8506820b`, armazenamento SQLite.
- Bindings preservados: autenticação `AUTH_SERVICE`, Durable Object `COMMUNITY_ROOM`, D1 `DB` e R2 `RADIO_AUDIO`.
- Nenhuma migração ou exclusão de dados do Durable Object foi solicitada.
- O portal oficial na branch `main` e o GitHub Pages oficial não foram alterados.

## O que ainda não foi validado

- Abertura e navegação do portal de preview com a nova interface.
- Teste de login real e emissão de ticket pelo domínio implantado.
- Teste em dois dispositivos/duas contas.
- Persistência de reações e comentários após desconectar, reconectar e recarregar.
- Regressão de chat, mensagens privadas, voz, rádio, jogos e painel administrativo.

A implantação do Worker foi confirmada pela API da Cloudflare; isso não substitui os testes reais do navegador e de duas contas.

## Critérios de aceite

1. Entrar com conta RativaGames existente.
2. Publicar e visualizar o mesmo post em outro dispositivo.
3. Reagir e comentar em um dispositivo; confirmar a atualização no outro.
4. Recarregar e reconectar; confirmar que reações e comentários continuam salvos.
5. Confirmar que visitante sem login não recebe ticket nem pode publicar/interagir.
6. Confirmar que denúncia aparece na fila administrativa e que arquivar/remover gera auditoria.
7. Confirmar que chat, mensagens privadas, voz, rádio, jogos, login e administração continuam funcionando.

## Próxima etapa

Disponibilizar/validar o portal de preview apontando para este Worker e executar o roteiro de dois dispositivos antes de qualquer publicação no portal oficial.
