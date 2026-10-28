# Ratópolis PWA — primeira versão

Acesse em: https://vt12gt.github.io/ratopolis/pwa/

## Incluído
- Interface PWA independente em `pwa/`, com manifesto e service worker de escopo limitado à pasta.
- Login e perfil usando a API já usada pelo portal principal.
- Cadastro e recuperação de senha dentro do app.
- Botões de navegação para Início, Conta, Perfil, MiniGames e Loja.
- Cache apenas dos arquivos estáticos; as rotas de API não são armazenadas no cache.
- Não há compras falsas nem links de minijogos inventados.

## Integração de conta confirmada no portal
- API: `https://ratopolis-api-dev-v30.juniorgmj69.workers.dev`
- `POST /api/login` com `{ identifier, password }`
- `GET /api/me`
- `POST /api/logout`
- `POST /api/register` com `{ nickname, email, password }`
- `POST /api/forgot-password` (a API pode ainda não oferecer recuperação funcional; a interface mostrará o erro real)

A sessão usa `localStorage` com a chave `ratopolis_session_token`, como o portal existente. O navegador só compartilha essa chave entre páginas da mesma origem, o que vale para o portal e a pasta `/pwa/` deste GitHub Pages.

## Jogo
O botão JOGAR usa o destino encontrado no portal atual:
`https://vt12gt.github.io/ratopolis/ratopolis_v1.53.0_corrigido.html`

Se o destino oficial mudar para outra versão, atualize a constante `GAME` em `index.html` depois de confirmar o URL publicado.

## Instalação Android
1. Abra o endereço do PWA no Chrome.
2. Use o menu ⋮ e escolha “Instalar app” ou “Adicionar à tela inicial”.
3. Abra o ícone criado na tela inicial.

O cache offline só abre a estrutura da interface. Login, perfil remoto e o jogo online precisam de internet. Dependendo do navegador e da hospedagem, o jogo pode abrir em uma navegação dentro da janela do PWA ou em uma janela do navegador.

## Importante
A primeira versão foi adicionada ao repositório para testes incrementais. A loja e os minijogos continuam como áreas informativas até existirem endpoints e URLs oficiais confirmados.

## Atualização de orientação, sessão e MiniGames
- O manifesto agora pede orientação horizontal (landscape); em telas em pé, a interface mostra um aviso para girar o celular.
- Depois de autenticado, a aba Conta some. No portal, tocar no botão do nickname abre o Perfil em vez de voltar ao formulário de login.
- O PWA extrai o token de sessão da resposta da API, confirma o perfil em /api/me e mantém a chave ratopolis_session_token.
- A área MiniGames separa offline (não exige login) e online (exige uma sessão válida).
- **Limitação atual:** não encontrei arquivos de minijogos offline publicados na raiz do repositório; por isso a área offline está preparada, mas ainda precisa receber o arquivo/link real do jogo offline. Os jogos online também precisam dos links oficiais antes de serem listados.
