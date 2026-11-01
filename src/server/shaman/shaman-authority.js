export const SHAMAN_OBJECTS=Object.freeze({
 plank:{w:150,h:18,cost:10,dynamic:true,oneWay:true},
 bridge:{w:180,h:18,cost:14,dynamic:true,oneWay:true},
 box:{w:44,h:44,cost:12,dynamic:true},
 anvil:{w:46,h:52,cost:18,dynamic:true},
 spring:{w:48,h:22,cost:20,dynamic:true},
 trampoline:{w:110,h:20,cost:24,dynamic:true},
 pillar:{w:26,h:130,cost:12,dynamic:true}
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class ShamanAuthority{
 constructor({rng=Math.random,selectionMs=15000,mana=100,maxObjects=80}={}){this.rng=rng;this.selectionMs=selectionMs;this.maxMana=mana;this.maxObjects=maxObjects;this.shamanId=null;this.candidates=new Set();this.deadline=0;this.mana=new Map();this.objects=[];}
 begin(players,now=Date.now()){this.shamanId=null;this.candidates.clear();this.objects=[];this.mana.clear();for(const p of players)this.mana.set(String(p.id),this.maxMana);this.deadline=now+this.selectionMs;}
 choose(id,now=Date.now()){id=String(id);if(this.shamanId)return{ok:this.shamanId===id,shamanId:this.shamanId,reason:"already_selected"};if(now>this.deadline)return{ok:false,error:"selection_closed"};if(!this.mana.has(id))return{ok:false,error:"not_in_room"};this.candidates.add(id);return{ok:true,pending:true};}
 elect(players,now=Date.now()){if(this.shamanId||now<this.deadline)return this.shamanId;const eligible=players.map(p=>String(p.id)).filter(id=>this.mana.has(id));if(!eligible.length)return null;const pool=this.candidates.size?eligible.filter(id=>this.candidates.has(id)):eligible;this.shamanId=pool[Math.floor(this.rng()*pool.length)]??eligible[0];return this.shamanId;}
 removePlayer(id,players,now=Date.now()){id=String(id);this.candidates.delete(id);this.mana.delete(id);if(this.shamanId===id){this.shamanId=null;this.deadline=now+this.selectionMs;this.candidates.clear();}return this.elect(players,now);}
 place({playerId,kind,x,y,rotation=0},world){playerId=String(playerId);const def=SHAMAN_OBJECTS[kind];if(playerId!==this.shamanId)return{ok:false,error:"shaman_only"};if(!def)return{ok:false,error:"invalid_object"};if(this.objects.length>=this.maxObjects)return{ok:false,error:"object_limit"};if(![x,y,rotation].every(v=>Number.isFinite(Number(v))))return{ok:false,error:"invalid_coordinates"};const mana=this.mana.get(playerId)||0;if(mana<def.cost)return{ok:false,error:"insufficient_mana"};const object={id:"sh-"+(this.objects.length+1)+"-"+Math.floor(this.rng()*1e9),ownerId:playerId,kind,x:clamp(Number(x),0,world.width-def.w),y:clamp(Number(y),0,world.height-def.h),w:def.w,h:def.h,cost:def.cost,dynamic:def.dynamic,oneWay:!!def.oneWay};this.mana.set(playerId,mana-def.cost);this.objects.push(object);return{ok:true,object,mana:this.mana.get(playerId)};}
 snapshot(){return{shamanId:this.shamanId,deadline:this.deadline,mana:Object.fromEntries(this.mana),objects:this.objects.map(o=>({...o}))};}
}
