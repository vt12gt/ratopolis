# Contratos dos quatro módulos do Ratópolis

Os quatro módulos abaixo são entregas independentes. **Não os conecte ainda ao Worker, ao portal ou ao HTML oficial.** A integração será feita separadamente, depois da revisão de cada contrato.

## 1. Server — `modules/server/index.js`

API pública:
- `new RatopolisServer(options)`
- `createRoom({ roomId, mapId, metadata })`
- `addAuthenticatedPlayer(roomId, identity)`
- `removePlayer(roomId, userId)`
- `setPhase(roomId, phase)`
- `publishState(roomId, authoritativeState)`
- `snapshot(roomId)` e `listRooms()`

Responsabilidade: manter estado de sala, participantes, fases, sequência de snapshots e histórico de eventos. Só recebe identidade já validada por uma camada de autenticação confiável. O navegador nunca deve chamar esta API diretamente.

## 2. Request — `modules/request/index.js`

API pública:
- `PROTOCOL_VERSION` e `REQUEST_TYPES`
- `decodeRequest(raw, options)`
- `encodeMessage(type, payload, requestId)`
- `encodeResponse(type, payload)`

Responsabilidade: contrato de mensagens independente do transporte, com versão, limite de tamanho e allow-list de comandos. Não aceitar posição, velocidade, identidade, XP ou moedas como autoridade vinda do cliente.

## 3. Resource — `modules/resource/index.js`

API pública:
- `SHAMAN_OBJECTS`
- `ResourceRegistry`
- `validateMap(map)`

Responsabilidade: registrar, validar e entregar cópias defensivas de mapas e recursos. O mapa real do jogo não está incluído nesta etapa; não substituir por fixture nem inventar geometria.

## 4. Client — `modules/client/index.js`

API pública:
- `RatopolisClient`

Responsabilidade: encaminhar controles e comandos, receber snapshots e entregá-los ao renderer. Não calcula posição oficial, colisão, Shaman, identidade, XP ou moedas. Implementação de apresentação em HTML5/JavaScript; Adobe Flash não faz parte da arquitetura.

## Regras de integração futura

1. O Worker existente valida a sessão Ratópolis e injeta a identidade verificada no Server.
2. Request valida cada mensagem antes do encaminhamento.
3. Server executa as regras autoritativas e publica um snapshot único por sala.
4. Resource fornece a versão exata do mapa e dos objetos para a simulação e o Client.
5. Client apenas apresenta snapshots e envia intenções de controle.
6. A progressão do Ratópolis e a do Rato Snack permanecem em namespaces/tabelas separados.
7. A integração deve preservar login, matchmaking, entrada na sala e reconexão da versão funcional v1.55.11.
8. Nenhuma alteração desta etapa publica Worker nem modifica o jogo oficial.

## Verificação

Os testes de contrato ficam em `tests/modules/modules.test.js`. A suíte completa é `npm test`; ela deve executar tanto os testes de física quanto os quatro testes de módulo.
