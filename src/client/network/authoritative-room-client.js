export class AuthoritativeRoomClient extends EventTarget{
 constructor({url,ticket,WebSocketImpl=WebSocket}){super();this.url=url;this.ticket=ticket;this.WebSocketImpl=WebSocketImpl;this.socket=null;this.lastSequence=0;}
 connect(){return new Promise((resolve,reject)=>{const u=new URL(this.url);u.searchParams.set("ticket",this.ticket);const ws=this.socket=new this.WebSocketImpl(u);let done=false;ws.addEventListener("open",()=>{done=true;this.dispatchEvent(new Event("connected"));resolve();});ws.addEventListener("message",e=>{let data;try{data=JSON.parse(e.data);}catch{return;}if(Number.isFinite(data.sequence)){if(data.sequence<this.lastSequence)return;this.lastSequence=data.sequence;}this.dispatchEvent(new CustomEvent("state",{detail:data}));});ws.addEventListener("close",()=>{this.dispatchEvent(new Event("disconnected"));if(!done)reject(Error("Conexão encerrada"));});ws.addEventListener("error",()=>{if(!done)reject(Error("Falha no WebSocket"));});});}
 send(type,payload={}){if(!this.socket||this.socket.readyState!==1)return false;this.socket.send(JSON.stringify({type,...payload}));return true;}
 input({left=false,right=false,jump=false}){return this.send("input",{input:{left:!!left,right:!!right,jump:!!jump}});}
 chooseShaman(){return this.send("choose_shaman");}
 placeObject(kind,x,y,rotation=0){return this.send("place_shaman_object",{kind,x,y,rotation});}
 connectObjects(objectA,objectB,anchorX,anchorY){return this.send("connect_shaman_objects",{objectA,objectB,anchorX,anchorY});}
 disconnectJoint(jointId){return this.send("disconnect_shaman_objects",{jointId});}
 removeObject(objectId){return this.send("remove_shaman_object",{objectId});}
 requestSnapshot(){return this.send("request_snapshot");}
 close(){this.socket?.close(1000,"client_exit");}
}
