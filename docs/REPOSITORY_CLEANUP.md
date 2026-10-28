# Auditoria de organização do repositório

Data da auditoria: 2026-10-28

## Arquivos oficiais — preservar

O responsável pelo RATÓPOLIS confirmou os seguintes arquivos como oficiais:

- **Portal:** `index.html`
- **Jogo:** `ratopolis_v1.52.0_shaman.html`
- **Painel administrativo:** `ratopolis_admin_v65_3_1_integracao_cenarios_auditoria.html`

Não apagar, mover, renomear nem substituir esses arquivos como parte da limpeza. Verificar links, hospedagem e integrações antes de qualquer alteração.

## O que foi encontrado

A raiz contém várias versões históricas do jogo, portal e painel, incluindo arquivos marcados como teste/corrigido/integrado. Exemplos para revisão (não são automaticamente seguros para excluir):

- `index1.html`
- `portal_ratopolis.html`
- `portal_ratopolis_v4_integrado_corrigido.html`
- `portal_ratopolis_v4_integrado_teste.html`
- `ratopolis_admin_v64_corrige_criar_cenario.html`
- `ratopolis_admin_v65_2_teste_integracao_cenarios.html`
- `ratopolis_conta_portal_teste_integrado_v2_corrigido.html`
- versões antigas e variantes de `ratopolis_v*.html`

O painel `ratopolis_admin_v65_3_1_integracao_cenarios_auditoria.html` é oficial, apesar do nome conter “auditoria”; não deve ser tratado como arquivo descartável.

## Resultado da primeira verificação de referências

Foi feita uma leitura estática dos HTMLs da raiz e dos nomes de arquivos referenciados diretamente no conteúdo. Foram encontradas dependências concretas:

- `index.html` contém um link direto para o painel administrativo oficial.
- O painel administrativo oficial contém um link para `portal_ratopolis.html`.
- Variantes antigas do jogo, incluindo `ratopolis_v1.52.0_shamakkn.html` e `ratopolis_v1.53.0_login_obrigatorio_sem_convites.html`, também apontam para `portal_ratopolis.html`.
- `ratopolis_conta_portal_teste_integrado_v2_corrigido.html` e `ratopolis_v1.50.3.html` referenciam `portal_ratopolis_v4_integrado_teste.html`.

**Conclusão:** `portal_ratopolis.html` e `portal_ratopolis_v4_integrado_teste.html` têm referências internas verificadas e não devem ser movidos nem removidos nesta etapa. A ausência de referência encontrada em outros arquivos não prova que uma página esteja sem uso: pode haver links externos, favoritos, URLs compartilhadas ou configurações de publicação que não aparecem no HTML.

O repositório indica que GitHub Pages está habilitado, mas a leitura feita até aqui não confirmou a origem de publicação nem o uso externo de cada URL. Portanto, nenhum HTML legado foi apagado ou movido.

## Próximas etapas seguras

1. Confirmar a origem e a configuração de publicação do GitHub Pages e conferir URLs em uso.
2. Verificar as referências restantes, incluindo links montados por JavaScript e URLs externas compartilhadas.
3. Manter no lugar os arquivos que têm dependências confirmadas.
4. Só arquivar versões comprovadamente antigas em uma alteração reversível e revisável; não excluir duplicatas em lote.
5. Validar os fluxos críticos no ambiente publicado: autenticação, salas online, chat, loja, eventos, recompensas diárias e painel de cenários.

## Observações

- Não renomear ou remover migrations SQL já aplicadas.
- Preservar o Worker, os bindings e os segredos existentes.
- Esta auditoria é estática; não substitui testes funcionais no navegador e no ambiente publicado.
