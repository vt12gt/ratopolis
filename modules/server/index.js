/**
 * Authoritative Ratópolis room registry.
 * Identity is accepted only from a trusted authentication/session boundary.
 * Each room owns its RoomSimulation; clients never submit positions or velocities.
 */
import { RoomSimulation } from "../../src/server/room/room-simulation.js";
const PHASES = new Set(["waiting", "shaman_selection", "running", "finished"]);
const clone = value => structuredClone(value);

export class RatopolisServer {
  constructor({ clock = () => Date.now(), maxPlayers = 50, snapshotHistory = 64,
    simulationFactory = options => new RoomSimulation(options) } = {}) {
    if (typeof clock !== "function") throw new Error("clock_invalid");
    if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 200) throw new Error("max_players_invalid");
    if (!Number.isInteger(snapshotHistory) || snapshotHistory < 1 || snapshotHistory > 512) throw new Error("snapshot_history_invalid");
    if (typeof simulationFactory !== "function") throw new Error("simulation_factory_invalid");
    this.clock=clock;this.maxPlayers=maxPlayers;this.snapshotHistory=snapshotHistory;
    this.simulationFactory=simulationFactory;this.rooms=new Map();
  }
  createRoom({roomId,mapId="test_fixture",metadata={}}={}) {
    const id=typeof roomId==="string"?roomId.trim():"",map=typeof mapId==="string"?mapId.trim():"";
    if(!id||id.length>100)throw new Error("room_id_invalid");
    if(!map||map.length>100)throw new Error("map_id_invalid");
    if(!metadata||typeof metadata!=="object"||Array.isArray(metadata))throw new Error("room_metadata_invalid");
    if(this.rooms.has(id))throw new Error("room_already_exists");
    const simulation=this.simulationFactory({roomId:id,mapId:map,now:this.clock});
    const room={id,mapId:map,metadata:clone(metadata),createdAt:this.clock(),players:new Map(),sequence:0,history:[],simulation};
    this.rooms.set(id,room);return this.describeRoom(room);
  }
  removeRoom(roomId){return this.rooms.delete(String(roomId));}
  addAuthenticatedPlayer(roomId,identity){
    const room=this.requireRoom(roomId),userId=typeof identity?.userId==="string"?identity.userId.trim():"",nickname=typeof identity?.nickname==="string"?identity.nickname.trim():"";
    if(!userId||userId.length>128||!/^[A-Za-z0-9_-]+$/.test(userId)||!nickname||nickname.length>24||/[\u0000-\u001f\u007f]/.test(nickname))throw new Error("verified_identity_required");
    if(room.players.has(userId))return this.publicPlayer(room.players.get(userId));
    if(room.players.size>=this.maxPlayers)throw new Error("room_full");
    room.simulation.join({id:userId,nickname});
    const player={userId,nickname,connected:true};room.players.set(userId,player);
    this.record(room,"player_joined",{userId,nickname});return this.publicPlayer(player);
  }
  removePlayer(roomId,userId){const room=this.requireRoom(roomId),id=String(userId);if(!room.players.delete(id))return false;room.simulation.leave(id);this.record(room,"player_left",{userId:id});return true;}
  setPhase(roomId,phase){if(!PHASES.has(phase))throw new Error("phase_invalid");const room=this.requireRoom(roomId);if(phase==="shaman_selection"&&room.simulation.phase!=="shaman_selection")room.simulation.startRound();else if(phase==="running"&&room.simulation.phase==="shaman_selection"){room.simulation.step(this.clock()+16000);}else if(phase==="finished")room.simulation.phase="finished";this.record(room,"phase_changed",{phase});return this.snapshot(roomId);}
  dispatch(roomId,userId,request){
    const room=this.requireRoom(roomId),id=String(userId);
    if(!room.players.has(id))return{ok:false,error:"not_in_room"};
    const p=request?.payload||{};
    switch(request?.type){
      case "input": return room.simulation.setInput(id,p.input||{});
      case "choose_shaman": return room.simulation.chooseShaman(id);
      case "place_shaman_object": return room.simulation.placeShamanObject(id,{kind:p.kind,x:p.x,y:p.y,rotation:p.rotation||0});
      case "remove_shaman_object": {const ok=room.simulation.shaman.remove(p.objectId,id);if(ok)room.simulation.physics.removeObject(p.objectId);return{ok};}
      case "connect_shaman_objects": return room.simulation.connectShamanObjects(id,{objectA:p.objectA,objectB:p.objectB,anchorX:p.anchorX,anchorY:p.anchorY});
      case "disconnect_shaman_objects": return room.simulation.disconnectShamanObjects(id,p.jointId);
      case "request_snapshot": return{ok:true};
      case "ping": return{ok:true};
      default:return{ok:false,error:"unknown_command"};
    }
  }
  step(roomId,now=this.clock()){const room=this.requireRoom(roomId);const state=room.simulation.step(now);this.record(room,"simulation_tick",{tick:state.world.tick});return state;}
  publishState(roomId,state){const room=this.requireRoom(roomId);if(!state||typeof state!=="object"||Array.isArray(state))throw new Error("authoritative_state_invalid");this.record(room,"state_updated",{tick:Number.isSafeInteger(state.tick)?state.tick:0});return this.snapshot(roomId);}
  snapshot(roomId){const room=this.requireRoom(roomId),sim=room.simulation.snapshot();return clone({roomId:room.id,mapId:room.mapId,phase:sim.phase,phaseNumber:sim.phaseNumber,sequence:room.sequence,players:[...room.players.values()].map(p=>this.publicPlayer(p)),simulation:sim,events:room.history.slice(-this.snapshotHistory)});}
  listRooms(){return[...this.rooms.values()].map(room=>this.describeRoom(room));}
  requireRoom(roomId){const room=this.rooms.get(String(roomId));if(!room)throw new Error("room_not_found");return room;}
  record(room,type,payload){room.history.push({sequence:++room.sequence,type,payload:clone(payload),at:this.clock()});if(room.history.length>this.snapshotHistory)room.history.shift();}
  publicPlayer(p){return{userId:p.userId,nickname:p.nickname,connected:p.connected};}
  describeRoom(room){return{roomId:room.id,mapId:room.mapId,phase:room.simulation.phase,playerCount:room.players.size,maxPlayers:this.maxPlayers,createdAt:room.createdAt};}
}
