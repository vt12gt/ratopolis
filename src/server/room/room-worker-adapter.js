import {RoomSimulation} from "./room-simulation.js";
import {decodeRequest} from "../../../modules/request/index.js";
/**
 * Runtime adapter for a Durable Object WebSocket.
 * verifiedIdentity must be derived by the Worker's authenticated ticket/session flow.
 */
export class RoomWorkerAdapter{
 constructor({roomId,mapId="ratopolis_01",broadcast=()=>{},now=()=>Date.now()}={}){this.room=new RoomSimulation({roomId,mapId,now});this.broadcast=broadcast;this.now=now;this.sockets=new Map();this.lastBroadcast=0;}
 attach(socket,verifiedIdentity){
  const id=String(verifiedIdentity?.userId||""),nickname=String(verifiedIdentity?.nickname||"").trim();
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||!nickname||nickname.length>24)throw Error("verified_identity_required");
  const player=this.room.join({id,nickname});this.sockets.set(id,socket);
  this.send(socket,{type:"room_snapshot",...this.room.snapshot(),selfId:id});this.publish({type:"room_snapshot",...this.room.snapshot()});return player;
 }
 detach(userId){const id=String(userId);this.sockets.delete(id);this.room.leave(id);this.publish({type:"room_snapshot",...this.room.snapshot()});}
 receive(userId,raw){
  const id=String(userId),socket=this.sockets.get(id);if(!socket)return{ok:false,error:"socket_not_attached"};
  const decoded=decodeRequest(typeof raw==="string"?raw:JSON.stringify(raw));if(!decoded.ok){this.send(socket,{type:"command_error",error:decoded.error});return decoded;}
  const req=decoded.request;let result;
  switch(req.type){
   case "input": result=this.room.setInput(id,req.payload.input);break;
   case "choose_shaman": result=this.room.chooseShaman(id);break;
   case "place_shaman_object": result=this.room.placeShamanObject(id,{kind:req.payload.kind,x:req.payload.x,y:req.payload.y,rotation:req.payload.rotation||0});break;
   case "remove_shaman_object":{const ok=this.room.shaman.remove(req.payload.objectId,id);if(ok)this.room.physics.removeObject(req.payload.objectId);result={ok};break;}
   case "connect_shaman_objects":result=this.room.connectShamanObjects(id,{objectA:req.payload.objectA,objectB:req.payload.objectB,anchorX:req.payload.anchorX,anchorY:req.payload.anchorY});break;
   case "disconnect_shaman_objects":result=this.room.disconnectShamanObjects(id,req.payload.jointId);break;
   case "request_snapshot":result={ok:true};this.send(socket,{type:"room_snapshot",...this.room.snapshot()});break;
   case "ping":this.send(socket,{type:"pong",at:this.now()});result={ok:true};break;
   default:result={ok:false,error:"unknown_command"};
  }
  if(result?.ok===false)this.send(socket,{type:"command_error",error:result.error,requestId:req.requestId});
  else if(req.type!=="input"&&req.type!=="ping"&&req.type!=="request_snapshot")this.publish({type:"room_snapshot",...this.room.snapshot()});
  return result||{ok:true};
 }
 startRound(){this.room.startRound();this.publish({type:"room_snapshot",...this.room.snapshot()});}
 tick(){const state=this.room.step(this.now()),now=this.now();if(now-this.lastBroadcast>=50){this.lastBroadcast=now;this.publish({type:"room_snapshot",...state});}return state;}
 publish(payload){const raw=JSON.stringify(payload);for(const [id,socket] of this.sockets){try{if(socket.readyState===1)socket.send(raw);}catch{this.sockets.delete(id);}}}
 send(socket,payload){try{if(socket?.readyState===1)socket.send(JSON.stringify(payload));}catch{}}
}
