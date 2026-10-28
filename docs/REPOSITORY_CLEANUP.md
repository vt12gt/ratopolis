# Auditoria de organização do repositório

Data da auditoria: 2026-10-27

## Arquivos oficiais — preservar

O responsável pelo RATÓPOLIS confirmou os seguintes arquivos como oficiais:

- **Portal:** `index.html`
- **Jogo:** `ratopolis_v1.52.0_shaman.html`
- **Painel administrativo:** `ratopolis_admin_v65_3_1_integracao_cenarios_auditoria.html`

Não apagar, mover, renomear nem substituir esses arquivos como parte da limpeza. Verificar links, hospedagem e integrações antes de qualquer alteração.

## O que foi encontrado

A raiz contém várias versões históricas do jogo, portal e painel, incluindo arquivos marcados como teste/corrigido/integrado. Exemplos de arquivos candidatos a revisão (não são automaticamente seguros para excluir):

- `index1.html`
- `portal_ratopolis.html`
- `portal_ratopolis_v4_integrado_corrigido.html`
- `portal_ratopolis_v4_integrado_teste.html`
- `ratopolis_admin_v64_corrige_criar_cenario.html`
- `ratopolis_admin_v65_2_teste_integracao_cenarios.html`
- `ratopolis_conta_portal_teste_integrado_v2_corrigido.html`
- versões antigas e variantes de `ratopolis_v*.html)

O painel `ratopolis_admin_v65_3_1_integracao_cenarios_auditoria.html` é oficial, apesar do nome conter “auditoria”; não deve ser tratado como arquivo descartável.

## Decisão de segurança

Nenhum HTML legado foi apagado nesta primeira etapa. Os nomes dos arquivos não provam que são descartáveis: links externos, favoritos, Pages e integrações podem depender deles. Apagar em lote pode quebrar o jogo ou o painel sem aviso.

## Próxima etapa recomendada

1. Procurar referências aos HTMLs candidatos dentro do repositório e conferir configurações de hospedagem/deploy.
2. Confirmar se cada candidato é usado por links externos, ferramentas de administração ou fluxos de suporte.
3. Mover apenas versões comprovadamente antigas para `archive/` (em vez de apagar de imediato), sem tocar nos três arquivos oficiais.
4. Validar os fluxos críticos: autenticação, salas online, chat, loja, eventos, recompensas diárias e painel de cenários.
5. Excluir duplicatas comprovadamente sem uso somente em uma mudança separada e revisável.

## Observações

- Não renomear ou remover migrations SQL já aplicadas.
- Preservar o Worker, os bindings e os segredos existentes.
- Esta auditoria é estática; ainda não substitui testes funcionais no navegador e no ambiente publicado.
