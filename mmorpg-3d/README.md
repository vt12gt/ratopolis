# Ratópolis MMORPG 3D — Terceira pessoa

Este diretório é a nova base experimental 3D do Lobby. A versão Canvas anterior permanece intacta.

## Executar
Abra `index.html` por um servidor HTTP/HTTPS (GitHub Pages funciona). O Three.js é carregado como módulo ES pela CDN jsDelivr; portanto, é necessária conexão com a internet.

## Controles
- Teclado: WASD ou setas para andar; Espaço para pular; E para interagir.
- Celular: joystick na tela; botão PULAR; arraste a tela para girar a câmera.
- Câmera em terceira pessoa com acompanhamento suave.

## Cena atual
- Mapa fechado com bordas e colisões.
- Praça central, caminhos, quatro construções 3D, árvores, rochas, luminárias, fonte, flores e NPCs.
- Ratinho 3D low-poly construído com geometria Three.js e animações procedurais simples.
- Interação de proximidade detecta os edifícios; interiores, animações esqueléticas e multiplayer ainda serão etapas seguintes.

## Próximas etapas
1. Substituir o ratinho procedural por modelo 3D próprio (.glb) com rig e animações.
2. Criar modelos artísticos de edifícios, vegetação e props em Blender.
3. Fazer interiores separados com transições e pontos de spawn.
4. Implementar navegação e colisão física mais robustas.
5. Integrar autenticação, estado e multiplayer com os serviços online existentes.
