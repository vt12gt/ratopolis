import {RoomSimulation} from "./room-simulation.js";
import {validateCommand} from "../../shared/protocol/commands.js";

/**
 * Adapter to embed in the existing Durable Object.
 * The caller MUST supply identity from its already-verified session.
 * Never construct identity from a WebSocket message.
 */
export class RoomWorkerAdapter{
 constructor({roomId,mapId="test_fixture",broadcast=()=>{},now=()=>Date.now()}={}){this.room=new RoomSimulation({roomId,mapId,now});this.broadcast=broadcast;this.now=now;this.sockets=new Map();this.lastBroadcast=0;}
 attach(socket,verifiedIdentity){const id=String(verifiedIdentity?.userId||"");if(!id)throw Error("Sessão autenticada obrigatória");const player=this.room.join({id,nickname:verifiedIdentity.nickname});this.sockets.set(id,socket);this.send(socket,{type:"room_snapshot",...this.room.snapshot()});return player;}
 detach(userId){const id=String(userId);this.sockets.delete(id);this.room.leave(id);this.publish({type:"room_snapshot",...this.room.snapshot()});}
 receive(userId,raw){const id=String(userId);if(!this.sockets.has(id))return{ok:false,error:"socket_not_attached"};const parsed=validateCommand(raw);if(!parsed.ok)return parsed;const m=parsed.message;let result;
  switch(m.type){
   case "input":result=this.room.setInput(id,m.input);break;
   case "choose_shaman":result=this.room.chooseShaman(id);break;
   case "place_shaman_object":result=this.room.placeShamanObject(id,{kind:m.kind,x:Number(m.x),y:Number(m.y),rotation:Number(m.rotation)||0});break;
   case "remove_shaman_object":{const ok=this.room.shaman.remove(m.objectId,id);if(ok)this.room.physics.removeObject(m.objectId);result={ok};break;}
   case "request_snapshot":result={ok:true};this.send(this.sockets.get(id),{type:"room_snapshot",...this.room.snapshot()});break;
   case "ping":this.send(this.sockets.get(id),{type:"pong",at:this.now()});result={ok:true};break;
  }
  if(result?.ok===false)this.send(this.sockets.get(id),{type:"command_error",error:result.error});
  return result||{ok:true};
 }
 startRound(){this.room.startRound();this.publish({type:"room_snapshot",...this.room.snapshot()});}
 tick(){const state=this.room.step(this.now());const now=this.now();if(now-this.lastBroadcast>=50){this.lastBroadcast=now;this.publish({type:"room_snapshot",...state});}return state;}
 publish(payload){const raw=JSON.stringify(payload);for(const [id,socket] of this.sockets){try{if(socket.readyState===1)socket.send(raw);}catch{this.sockets.delete(id);}}}
 send(socket,payload){try{if(socket?.readyState===1)socket.send(JSON.stringify(payload));}catch{}}
}
