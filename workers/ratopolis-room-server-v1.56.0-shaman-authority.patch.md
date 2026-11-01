# Patch do Worker de salas — v1.56.0 (não publicar sem revisão)

## Por que é um patch, não um Worker completo
O Worker ativo `ratopolis-room-server-v1` foi lido diretamente no Cloudflare. O arquivo-fonte completo não está versionado no repositório; não devemos substituir o Worker ativo por uma cópia incompleta. Este patch documenta a mudança pontual necessária no método `Room.webSocketMessage`.

## Localizar
Dentro de `if(m.type==="player_state"&&socketPlayerId)`, localize a atribuição atual:

```js
p.state=m.state&&typeof m.state==="object"?m.state:{};
```

Substitua por:

```js
const incoming=m.state&&typeof m.state==="object"?m.state:{};
const isAuthoritativeShaman=String(x.shamanId||"")===socketPlayerId;
const safeState={...incoming,role:isAuthoritativeShaman?"shaman":"mouse"};
if(isAuthoritativeShaman){
  const allowedKinds=new Set(["plank","box","anvil","cannon","spring","trampoline","bridge","pillar"]);
  safeState.shamanObjects=Array.isArray(incoming.shamanObjects)
    ? incoming.shamanObjects
        .filter(o=>o&&typeof o==="object"
          &&allowedKinds.has(String(o.kind||""))
          &&[o.x,o.y,o.w,o.h].every(v=>Number.isFinite(Number(v)))
          &&Number(o.w)>0&&Number(o.h)>0&&Number(o.w)<=500&&Number(o.h)<=500)
        .slice(0,80)
        .map(o=>({
          type:String(o.type||"").slice(0,32),kind:String(o.kind),
          x:Number(o.x),y:Number(o.y),w:Number(o.w),h:Number(o.h),
          cost:Math.max(0,Math.min(100,Number(o.cost)||0)),
          vy:Math.max(-2000,Math.min(2000,Number(o.vy)||0)),
          vx:Math.max(-2000,Math.min(2000,Number(o.vx)||0)),
          falling:!!o.falling,used:!!o.used,lifting:!!o.lifting,
          rider:!!o.rider,realSpring:!!o.realSpring,shamanPlaced:true
        }))
    : [];
  if(incoming.shamanPreview&&typeof incoming.shamanPreview==="object"){
    const v=incoming.shamanPreview;
    safeState.shamanPreview={
      kind:String(v.kind||"").slice(0,20),
      x:Number(v.x)||0,y:Number(v.y)||0
    };
  }else delete safeState.shamanPreview;
}else{
  delete safeState.shamanObjects;
  delete safeState.shamanPreview;
}
p.state=safeState;
```

## O que protege
- O papel é calculado pelo Durable Object com base em `room.shamanId`, nunca pelo campo enviado pelo navegador.
- Apenas o Shaman atual pode publicar a lista de construções e a prévia.
- Tipos, dimensões e números dos objetos são filtrados antes de replicar aos outros clientes.

## Limite
Este patch valida o dono e os dados das construções, mas não move a física para o servidor. O movimento, gravidade e colisões continuam simulados nos clientes. A simulação autoritativa completa é uma etapa posterior.
