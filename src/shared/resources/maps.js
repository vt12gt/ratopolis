const MAPS=Object.freeze({
 test_fixture:{id:"test_fixture",version:1,width:1800,height:760,colliders:[
  {id:"floor",x:0,y:700,w:1800,h:60},
  {id:"ledge-a",x:260,y:570,w:280,h:24,oneWay:true},
  {id:"ledge-b",x:690,y:450,w:260,h:24,oneWay:true},
  {id:"ledge-c",x:1120,y:560,w:300,h:24,oneWay:true},
  {id:"goal-platform",x:1510,y:610,w:220,h:90}
 ]}
});
export function getMap(id){const map=MAPS[String(id)];if(!map)throw Error("Mapa não encontrado");return JSON.parse(JSON.stringify(map));}
export function listMaps(){return Object.values(MAPS).map(({id,version,width,height})=>({id,version,width,height}));}
