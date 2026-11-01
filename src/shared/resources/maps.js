import {RATOPOLIS_MAPS,getRatopolisMap} from "./ratopolis-maps-v1.js";
const FIXTURE={
 id:"test_fixture",version:1,name:"Fixture de testes",width:1800,height:760,
 colliders:[
  {id:"floor",x:0,y:700,w:1800,h:60},
  {id:"ledge-a",x:260,y:570,w:280,h:24,oneWay:true},
  {id:"ledge-b",x:690,y:450,w:260,h:24,oneWay:true},
  {id:"ledge-c",x:1120,y:560,w:300,h:24,oneWay:true},
  {id:"goal-platform",x:1510,y:610,w:220,h:90}
 ]
};
export function getMap(id){
 const key=String(id);
 if(key==="test_fixture")return structuredClone(FIXTURE);
 return getRatopolisMap(key);
}
export function listMaps(){
 return [FIXTURE,...RATOPOLIS_MAPS].map(({id,version,name,width,height})=>({id,version,name,width,height}));
}
