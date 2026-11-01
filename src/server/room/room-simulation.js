import {PhysicsEngine} from "../physics/physics-engine.js";
import {ShamanAuthority} from "../shaman/shaman-authority.js";
import {getMap} from "../../shared/resources/maps.js";

export class RoomSimulation{
 constructor({roomId,mapId="test_fixture",rng=Math.random,now=()=>Date.now()}={}){this.roomId=String(roomId);this.now=now;this.map=getMap(mapId);this.physics=new PhysicsEngine({width:this.map.width,height:this.map.height,colliders:this.map.colliders});this.shaman=new ShamanAuthority({rng});this.players=new Map();this.phase="waiting";this.phaseNumber=0;this.lastTick=now();this.sequence=0;this.events=[];}
 event(type,payload){this.events.push({seq:++this.sequence,type,payload,at:this.now()});if(this.events.length>256)this.events.shift();}
 join({id,nickname}){id=String(id);if(!id||id.length>128)throw Error("ID inválido");if(this.players.has(id))return this.publicPlayer(this.players.get(id));if(this.players.size>=50)throw Error("Sala cheia");const p={id,nickname:String(nickname||"Rato").slice(0,24),connected:true};this.players.set(id,p);this.physics.addPlayer({id,x:40+this.players.size*30,y:80});this.event("player_joined",{id,nickname:p.nickname});return this.publicPlayer(p);}
 leave(id){id=String(id);if(!this.players.has(id))return;this.players.delete(id);this.physics.removePlayer(id);const next=this.shaman.removePlayer(id,[...this.players.values()],this.now());if(next)this.event("shaman_changed",{shamanId:next});this.event("player_left",{id});}
 startRound(){if(!this.players.size)throw Error("Sala vazia");this.phase="shaman_selection";this.phaseNumber++;this.shaman.begin([...this.players.values()],this.now());this.event("round_started",{phase:this.phase,phaseNumber:this.phaseNumber,selectionEndsAt:this.shaman.deadline});}
 chooseShaman(id){if(!this.players.has(String(id)))return{ok:false,error:"not_in_room"};const result=this.shaman.choose(id,this.now());if(result.ok)this.event("shaman_candidate",{id:String(id)});return result;}
 setInput(id,input){if(!this.players.has(String(id)))return{ok:false,error:"not_in_room"};this.physics.setInput(id,{left:!!input.left,right:!!input.right,jump:!!input.jump});return{ok:true};}
 placeShamanObject(id,request){const result=this.shaman.place({playerId:id,...request},this.map);if(!result.ok)return result;this.physics.addObject(result.object);this.event("shaman_object_created",{object:result.object,mana:result.mana});return result;}
 step(now=this.now()){if(this.phase==="shaman_selection"&&!this.shaman.shamanId&&now>=this.shaman.deadline){const id=this.shaman.elect([...this.players.values()],now);if(id){this.phase="running";this.event("shaman_changed",{shamanId:id});this.event("phase_changed",{phase:"running"});}}const elapsed=Math.max(0,Math.min(.25,(now-this.lastTick)/1000));this.lastTick=now;if(this.phase==="running")this.physics.advance(elapsed);return this.snapshot();}
 publicPlayer(p){return{id:p.id,nickname:p.nickname,connected:p.connected};}
 snapshot(){return{roomId:this.roomId,phase:this.phase,phaseNumber:this.phaseNumber,sequence:this.sequence,players:[...this.players.values()].map(p=>this.publicPlayer(p)),shaman:this.shaman.snapshot(),world:this.physics.snapshot(),events:this.events.slice(-64)};}
}
