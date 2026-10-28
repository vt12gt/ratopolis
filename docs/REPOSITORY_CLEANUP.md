# Auditoria de organização do repositório

Data da auditoria: 2026-10-27

## O que foi encontrado

A raiz contém várias versões históricas do jogo, portal e painel, incluindo arquivos marcados como teste/corrigido/integrado. Também há dois portais com nomes genéricos (`index.html` e `index1.html`) e um README praticamente vazio.

Exemplos de arquivos que precisam de confirmação de uso antes de arquivar/remover:

- `index1.html`
- `portal_ratopolis.html`
- `portal_ratopolis_v4_integrado_corrigido.html`
- `portal_ratopolis_v4_integrado_teste.html`
- `ratopolis_admin_v64_corrige_criar_cenario.html`
- `ratopolis_admin_v65_2_teste_integracao_cenarios.html`
- `ratopolis_admin_v65_3_1_integracao_cenarios_auditoria.html`
- `ratopolis_conta_portal_teste_integrado_v2_corrigido.html`
- `ratopolis_v1.50.3.html` até `ratopolis_v1.53.0_login_obrigatorio_sem_convites.html` e variantes

## Decisão de segurança

Nenhum HTML legado foi apagado nesta primeira etapa. Os nomes dos arquivos não provam que são descartáveis: links externos, favoritos, Pages e integrações podem depender deles. Apagar em lote pode quebrar o jogo ou o painel sem aviso.

## Próxima etapa recomendada

1. Confirmar quais arquivos são publicados/usados atualmente e quais são apenas cópias de teste.
2. Procurar referências a cada HTML dentro do repositório e conferir configurações de hospedagem/deploy.
3. Mover versões confirmadas como antigas para `archive/` (em vez de apagar de imediato) e manter um README com a versão oficial.
4. Validar links e os fluxos críticos: autenticação, salas online, chat, loja, eventos, recompensas diárias e painel de cenários.
5. Só depois, excluir duplicatas comprovadamente sem uso em um PR separado.

## Observações

- Não renomear ou remover migrations SQL já aplicadas.
- Não sobrescrever o Worker nem alterar bindings/segredos como parte de uma limpeza de arquivos.
- Esta auditoria é estática; ainda não substitui testes funcionais no navegador e no ambiente publicado.
