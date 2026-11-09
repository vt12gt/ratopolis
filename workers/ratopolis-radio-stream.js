const ALLOWED_ORIGINS = new Set(["https://vt12gt.github.io","https://ratopolis-portal-community-preview.juniorgmj69.workers.dev","https://ratopolis.github.io","http://localhost:8000","http://127.0.0.1:8000"]);
const ADMIN_API = "https://ratopolis-api-dev-v30.juniorgmj69.workers.dev";
const cors = origin => ({
 "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://vt12gt.github.io",
 "Access-Control-Allow-Methods":"GET, POST, PATCH, DELETE, OPTIONS",
 "Access-Control-Allow-Headers":"Content-Type, Authorization",
 "Access-Control-Max-Age":"86400","Vary":"Origin"
});
const json = (data,status=200,origin="") => new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...cors(origin)}});
const cleanName = v => String(v||"audio.mp3").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"_").replace(/^\.+/,"").slice(-100) || "audio.mp3";
async function hasRadioPermission(request,env,permission) {
 const auth=request.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer ")) return false;
 try {
  const headers={Authorization:auth,Accept:"application/json"};
  const r=env.AUTH_SERVICE
   ? await env.AUTH_SERVICE.fetch(new Request("https://auth.internal/api/admin/me",{headers}))
   : await fetch(ADMIN_API+"/api/admin/me",{headers});
  const d=await r.json(); const a=d?.data&&typeof d.data==="object"?{...d,...d.data}:d;
  const p=a?.permissions||a?.permissoes||{};
  return r.ok && a?.ok!==false && p?.[permission]===true;
 } catch { return false; }
}
async function liveSfu(env,path,method='POST',body=null){const r=await fetch('https://rtc.live.cloudflare.com/v1/apps/'+env.REALTIME_SFU_APP_ID+path,{method,headers:{Authorization:'Bearer '+env.REALTIME_SFU_APP_SECRET,'Content-Type':'application/json'},body:body===null||method==='GET'?undefined:JSON.stringify(body)});const raw=await r.text();let d={};try{d=raw?JSON.parse(raw):{}}catch{}if(!r.ok||d.errorCode||d.error){const detail=d.errorDescription||d.error||d.message||raw.slice(0,240);throw new Error('SFU '+r.status+' '+(d.errorCode?d.errorCode+' ':'')+detail)}return d}
async function authRadioLease(request,env,path,body={}){
 const auth=request.headers.get('Authorization')||'';
 if(!auth.startsWith('Bearer '))return {ok:false,status:401,data:{error:'authentication_required'}};
 const headers={Authorization:auth,'Content-Type':'application/json',Accept:'application/json'};
 const target=new Request('https://auth.internal'+path,{method:'POST',headers,body:JSON.stringify(body)});
 const r=env.AUTH_SERVICE?await env.AUTH_SERVICE.fetch(target):await fetch(ADMIN_API+path,{method:'POST',headers,body:JSON.stringify(body)});
 const data=await r.json().catch(()=>({}));
 return {ok:r.ok,status:r.status,data};
}
async function readLiveState(env){const o=await env.RADIO_AUDIO.get('radio-control/live.json');return o?await o.json():{active:false}}
async function writeLiveState(env,d){await env.RADIO_AUDIO.put('radio-control/live.json',JSON.stringify(d),{httpMetadata:{contentType:'application/json',cacheControl:'no-store'}})}
async function readAds(env) {
 const obj=await env.RADIO_AUDIO.get("radio-control/ads.json");
 return obj?await obj.json():{enabled:false,intervalMinutes:30,tracks:[],cursor:0,lastPlayedAt:null,nextAdAt:null};
}
async function restoreAfterAd(env,state,now=Date.now()) {
 const original=state?.adReturnState;
 if(!original)return {active:false,updatedAt:now};
 const restored={...original,startedAt:now-Math.max(0,Number(state.adReturnPositionMs||0)),updatedAt:now};
 delete restored.isAd;delete restored.adReturnState;delete restored.adReturnPositionMs;
 await env.RADIO_AUDIO.put("radio-control/state.json",JSON.stringify(restored),{httpMetadata:{contentType:"application/json",cacheControl:"no-store"}});
 return restored;
}
function localClock(date=new Date()) {
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Recife",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",weekday:"short",hourCycle:"h23"}).formatToParts(date);
 const v=Object.fromEntries(parts.map(p=>[p.type,p.value])); const days={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:0};
 return {date:v.year+"-"+v.month+"-"+v.day,time:v.hour+":"+v.minute,day:days[v.weekday]??0};
}
async function readPrograms(env) { const o=await env.RADIO_AUDIO.get("radio-control/programs.json"); return o?await o.json():{programs:[]}; }
function activeProgram(programs,clock) {
 return (programs||[]).filter(p=>p&&p.enabled!==false&&Array.isArray(p.days)&&p.days.includes(clock.day)&&p.start<=p.end&&clock.time>=p.start&&clock.time<p.end).sort((a,b)=>a.start.localeCompare(b.start))[0]||null;
}
async function tracksForState(env,state) {
 if(state.scheduleId){const d=await readPrograms(env);const p=(d.programs||[]).find(x=>x.id===state.scheduleId);if(p?.tracks?.length)return p.tracks;}
 const d=await env.RADIO_AUDIO.get("radio-control/playlist.json");const p=d?await d.json():{tracks:[]};return Array.isArray(p.tracks)?p.tracks:[];
}
async function advancePlaylist(env,expected={},allowEarly=false,action="next") {
 const stateKey="radio-control/state.json",stateObj=await env.RADIO_AUDIO.get(stateKey);if(!stateObj)return {advanced:false,reason:"no_active_state"};
 const state=await stateObj.json();if(!state.active)return {advanced:false,reason:"radio_offline"};
 if(expected.key&&String(expected.key)!==String(state.key))return {advanced:false,reason:"stale_track"};
 if(expected.startedAt&&Number(expected.startedAt)!==Number(state.startedAt))return {advanced:false,reason:"stale_start"};
 const durationMs=Number(state.durationMs||0),startedAt=Number(state.startedAt||0),now=Date.now();
 if(state.isAd&&action!=="ended"){await restoreAfterAd(env,state,now);return advancePlaylist(env,{},false,action);}
 if(action==="ended"&&state.isAd){if(state.paused)return {advanced:false,reason:"radio_paused"};if(!durationMs||!startedAt||now<startedAt+durationMs-(allowEarly?6000:0))return {advanced:false,reason:"track_not_finished"};const restored=await restoreAfterAd(env,state,now);return {advanced:true,state:restored,adFinished:true};}
 if(action==="ended"&&state.paused)return {advanced:false,reason:"radio_paused"}; if(action==="ended"&&(!durationMs||!startedAt||now<startedAt+durationMs-(allowEarly?6000:0)))return {advanced:false,reason:"track_not_finished"};
 const tracks=(await tracksForState(env,state)).filter(t=>t&&t.key&&!String(t.key).startsWith("radio-control/"));if(!tracks.length)return {advanced:false,reason:"empty_playlist"};
 let index=tracks.findIndex(t=>t.key===state.key);if(index<0)index=0;
 let nextIndex=index;
 if(action==="previous")nextIndex=(index-1+tracks.length)%tracks.length;
 else if(action==="next"||action==="ended"){
  if(state.shuffle===true){nextIndex=tracks.length===1?index:Math.floor(Math.random()*tracks.length);if(nextIndex===index)nextIndex=(index+1)%tracks.length;}
  else if(index===tracks.length-1&&state.repeatMode==="off"){const stopped={...state,active:false,updatedAt:now};await env.RADIO_AUDIO.put(stateKey,JSON.stringify(stopped),{httpMetadata:{contentType:"application/json",cacheControl:"no-store"}});return {advanced:false,stopped:true,reason:"queue_finished"};}
  else nextIndex=(index+1)%tracks.length;
 }
 const candidate=tracks[nextIndex],head=await env.RADIO_AUDIO.head(candidate.key);if(!head)return {advanced:false,reason:"track_missing"};
 const nextState={...state,active:true,key:candidate.key,name:candidate.name||head.customMetadata?.originalName||head.customMetadata?.name||candidate.key,startedAt:now,durationMs:Number(candidate.durationMs||head.customMetadata?.durationMs||0),paused:false,pausedPositionMs:0,updatedAt:now};
 if(state.repeatMode==="track"&&action==="ended"){nextState.key=state.key;nextState.name=state.name;nextState.startedAt=now;nextState.durationMs=durationMs;}
 const saved=await env.RADIO_AUDIO.put(stateKey,JSON.stringify(nextState),{onlyIf:{etagMatches:stateObj.etag},httpMetadata:{contentType:"application/json",cacheControl:"no-store"}});
 if(!saved)return {advanced:false,reason:"already_advanced"};return {advanced:true,state:nextState};
}
async function runSchedule(env) {
 const now=Date.now();let ads=await readAds(env);
 const obj=await env.RADIO_AUDIO.get("radio-control/state.json");let state=obj?await obj.json():{active:false};
 if(state.isAd){if(state.paused)return {adPaused:true,name:state.name||"Anúncio"};const duration=Number(state.durationMs||0),started=Number(state.startedAt||0);if(duration>0&&started>0&&now>=started+duration){state=await restoreAfterAd(env,state,now);}else{return {adPlaying:true,name:state.name||"Anúncio"};}}
 if(ads.enabled===true&&Array.isArray(ads.tracks)&&ads.tracks.length&&state.active&&!state.paused&&(!Number(ads.nextAdAt)||now>=Number(ads.nextAdAt))){
  let picked=null,index=Number(ads.cursor||0)%ads.tracks.length;for(let n=0;n<ads.tracks.length;n++){const candidate=ads.tracks[(index+n)%ads.tracks.length],head=await env.RADIO_AUDIO.head(candidate.key);if(head&&Number(candidate.durationMs||head.customMetadata?.durationMs||0)>0){picked={...candidate,durationMs:Number(candidate.durationMs||head.customMetadata?.durationMs||0)};index=(index+n)%ads.tracks.length;break;}}
  if(picked){const positionMs=Math.max(0,now-Number(state.startedAt||now));const adState={active:true,key:picked.key,name:picked.name||picked.key,startedAt:now,durationMs:picked.durationMs,paused:false,pausedPositionMs:0,repeatMode:"off",shuffle:false,playlistMode:false,isAd:true,adReturnState:state,adReturnPositionMs:positionMs,updatedAt:now};await env.RADIO_AUDIO.put("radio-control/state.json",JSON.stringify(adState),{httpMetadata:{contentType:"application/json",cacheControl:"no-store"}});ads={...ads,cursor:(index+1)%ads.tracks.length,lastPlayedAt:now,nextAdAt:now+750000,updatedAt:now};await env.RADIO_AUDIO.put("radio-control/ads.json",JSON.stringify(ads),{httpMetadata:{contentType:"application/json",cacheControl:"no-store"}});return {adStarted:true,name:adState.name,nextAdAt:ads.nextAdAt};}
 }
 const clock=localClock(),data=await readPrograms(env),program=activeProgram(data.programs,clock);
 const freshObj=await env.RADIO_AUDIO.get("radio-control/state.json");state=freshObj?await freshObj.json():{active:false};
 if(program){
  const slot=clock.date+":"+program.id;
  if(state.scheduleSlot!==slot){
   const tracks=Array.isArray(program.tracks)?program.tracks:[];let first=null;
   for(const t of tracks){const h=await env.RADIO_AUDIO.head(t.key);if(h){first={...t,durationMs:Number(t.durationMs||h.customMetadata?.durationMs||0)};break;}}
   if(first){const next={active:true,key:first.key,name:first.name||first.key,startedAt:Date.now(),durationMs:first.durationMs,loop:false,playlistMode:true,repeatMode:program.repeatMode||"playlist",shuffle:program.shuffle===true,paused:false,scheduleId:program.id,scheduleSlot:slot,programName:program.name,updatedAt:Date.now()};await env.RADIO_AUDIO.put("radio-control/state.json",JSON.stringify(next),{httpMetadata:{contentType:"application/json",cacheControl:"no-store"}});return {program:program.name,started:true};}
  }
  if(state.active&&state.scheduleSlot===slot){const res=await advancePlaylist(env,{},false,"ended");return {program:program.name,...res};}
  return {program:program.name,started:false};
 }
 if(state.scheduleSlot){const next={...state,scheduleId:null,scheduleSlot:null,programName:null,updatedAt:Date.now()};await env.RADIO_AUDIO.put("radio-control/state.json",JSON.stringify(next),{httpMetadata:{contentType:"application/json",cacheControl:"no-store"}});}
 if(state.active&&state.playlistMode) return advancePlaylist(env,{},false,"ended");
 return {program:null,active:state.active};
}

/* replaced legacy scheduler */

export default { async fetch(request,env) {
 const url=new URL(request.url), origin=request.headers.get("Origin")||"";
 if(origin && !ALLOWED_ORIGINS.has(origin)) return json({ok:false,error:"origin_not_allowed"},403,origin);
 if(request.method==="OPTIONS") return new Response(null,{status:204,headers:cors(origin)});
 if(url.pathname==="/"||url.pathname==="/health") return json({ok:true,service:"ratopolis-radio-stream",version:"v1.1.1-audit-complete",storage:"R2",status:"ready"},200,origin);
 if(url.pathname==='/api/live/status'&&request.method==='GET'){let l=await readLiveState(env);if(l.active&&Date.now()-Number(l.lastSeen||l.startedAt||0)>75000){l={active:false,stoppedAt:Date.now(),reason:'publisher_timeout'};await writeLiveState(env,l)}return json({ok:true,live:{active:l.active===true,sessionId:l.active?l.sessionId:null,trackName:l.active?l.trackName:'radio-live',title:l.title||'Locução ao vivo',owner:l.owner||null,startedAt:l.startedAt||null}},200,origin)}
 if(url.pathname==='/api/live/publish'&&request.method==='POST'){
  if(!(await hasRadioPermission(request,env,'manageRadioPlayback')))return json({ok:false,error:'admin_permission_required'},403,origin);
  let leaseId='';
  try{
   const b=await request.json(),rawSdp=String(b.sessionDescription?.sdp||''),mid=String(b.mid??'');
   if(!rawSdp||!mid||String(b.sessionDescription?.type||'')!=='offer')return json({ok:false,error:'offer_mid_required'},400,origin);
   const sdp=rawSdp.replace(/\r\n|\r|\n/g,'\r\n').trim()+'\r\n';
   if(!sdp.startsWith('v=0\r\n')||!sdp.includes('m=audio ')||!sdp.includes('a=ice-ufrag:')||!sdp.includes('a=ice-pwd:')||!sdp.includes('a=fingerprint:'))return json({ok:false,error:'invalid_webrtc_offer',diagnostics:{sdpLength:sdp.length,hasAudio:sdp.includes('m=audio '),hasIceUfrag:sdp.includes('a=ice-ufrag:'),hasIcePwd:sdp.includes('a=ice-pwd:'),hasFingerprint:sdp.includes('a=fingerprint:')}},400,origin);
   const claim=await authRadioLease(request,env,'/api/internal/radio/live/claim',{});
   if(!claim.ok)return json({ok:false,error:claim.data?.error||'live_lock_denied',message:claim.data?.erro||'Outro locutor está com a transmissão reservada.'},claim.status,origin);
   leaseId=String(claim.data.leaseId||'');if(!leaseId)throw new Error('live_lock_lease_missing');
   const c=await liveSfu(env,'/sessions/new','POST',null),id=c.sessionId;if(!id)throw new Error('session_id_missing');
   const p=await liveSfu(env,'/sessions/'+encodeURIComponent(id)+'/tracks/new','POST',{sessionDescription:{type:'offer',sdp},tracks:[{location:'local',mid,trackName:'radio-live'}]});
   if(!p.sessionDescription?.sdp)throw new Error('publisher_answer_missing');
   return json({ok:true,sessionId:id,leaseId,sessionDescription:p.sessionDescription},200,origin);
  }catch(e){
   if(leaseId)try{await authRadioLease(request,env,'/api/internal/radio/live/release',{leaseId})}catch{}
   return json({ok:false,error:'live_publish_failed',message:String(e?.message||e).slice(0,350)},502,origin);
  }
 }
 if(url.pathname==='/api/live/publish/complete'&&request.method==='POST'){
  if(!(await hasRadioPermission(request,env,'manageRadioPlayback')))return json({ok:false,error:'admin_permission_required'},403,origin);
  try{
   const b=await request.json(),id=String(b.sessionId||''),leaseId=String(b.leaseId||'');
   if(!id||!leaseId)return json({ok:false,error:'session_or_lease_required'},400,origin);
   const lock=await authRadioLease(request,env,'/api/internal/radio/live/heartbeat',{leaseId});
   if(!lock.ok)return json({ok:false,error:'live_lock_expired',message:lock.data?.erro||'A reserva exclusiva da locução expirou.'},409,origin);
   const old=await readLiveState(env);if(old.active&&old.sessionId!==id)return json({ok:false,error:'another_locutor_is_live'},409,origin);
   const l={active:true,sessionId:id,leaseId,trackName:'radio-live',title:String(b.title||'Locução ao vivo').slice(0,80),owner:String(lock.data?.owner||''),startedAt:Date.now(),lastSeen:Date.now()};
   await writeLiveState(env,l);const audit=await authRadioLease(request,env,'/api/internal/radio/live/started',{leaseId,sessionId:id});if(!audit.ok)console.warn('Auditoria de início da locução não foi registrada:',audit.data?.erro||audit.status);return json({ok:true,live:l},200,origin);
  }catch(e){return json({ok:false,error:'live_publish_complete_failed',message:String(e?.message||e)},502,origin)}
 }
 if(url.pathname==='/api/live/heartbeat'&&request.method==='POST'){
  if(!(await hasRadioPermission(request,env,'manageRadioPlayback')))return json({ok:false,error:'admin_permission_required'},403,origin);
  try{
   const b=await request.json(),l=await readLiveState(env),leaseId=String(b.leaseId||'');
   if(!l.active||l.sessionId!==String(b.sessionId||'')||l.leaseId!==leaseId)return json({ok:false,error:'live_session_not_found'},404,origin);
   const lock=await authRadioLease(request,env,'/api/internal/radio/live/heartbeat',{leaseId});
   if(!lock.ok)return json({ok:false,error:'live_lock_expired'},409,origin);
   l.lastSeen=Date.now();await writeLiveState(env,l);return json({ok:true},200,origin);
  }catch(e){return json({ok:false,error:'live_heartbeat_failed',message:String(e?.message||e)},502,origin)}
 }
 if(url.pathname==='/api/live/subscribe'&&request.method==='POST'){try{const l=await readLiveState(env);if(!l.active||Date.now()-Number(l.lastSeen||l.startedAt||0)>75000)return json({ok:false,error:'live_offline'},404,origin);const c=await liveSfu(env,'/sessions/new');const id=c.sessionId;if(!id)throw new Error('subscriber_session_missing');const s=await liveSfu(env,'/sessions/'+encodeURIComponent(id)+'/tracks/new','POST',{tracks:[{location:'remote',sessionId:l.sessionId,trackName:l.trackName||'radio-live'}]});if(!s.sessionDescription?.sdp)throw new Error('subscriber_offer_missing');return json({ok:true,sessionId:id,sessionDescription:s.sessionDescription},200,origin)}catch(e){return json({ok:false,error:'live_subscribe_failed',message:String(e?.message||e).slice(0,350)},502,origin)}}
 if(url.pathname==='/api/live/subscribe/complete'&&request.method==='POST'){try{const b=await request.json(),id=String(b.sessionId||'');if(!id||!b.sessionDescription?.sdp)return json({ok:false,error:'answer_required'},400,origin);await liveSfu(env,'/sessions/'+encodeURIComponent(id)+'/renegotiate','PUT',{sessionDescription:b.sessionDescription});return json({ok:true},200,origin)}catch(e){return json({ok:false,error:'live_subscriber_negotiate_failed',message:String(e?.message||e).slice(0,350)},502,origin)}}
 if(url.pathname==='/api/live/stop'&&request.method==='POST'){
  if(!(await hasRadioPermission(request,env,'manageRadioPlayback')))return json({ok:false,error:'admin_permission_required'},403,origin);
  try{
   const b=await request.json().catch(()=>({})),l=await readLiveState(env),leaseId=String(b.leaseId||l.leaseId||'');
   if(l.active&&l.leaseId&&leaseId!==l.leaseId)return json({ok:false,error:'live_session_owner_mismatch'},409,origin);
   if(leaseId){const released=await authRadioLease(request,env,'/api/internal/radio/live/release',{leaseId});if(!released.ok)return json({ok:false,error:released.data?.error||'live_stop_not_authorized',message:released.data?.erro||'Somente o locutor atual ou um administrador pode encerrar a transmissão.'},released.status,origin);}
   await writeLiveState(env,{active:false,stoppedAt:Date.now(),stoppedSessionId:l.sessionId||null});
   return json({ok:true,stoppedSessionId:l.sessionId||null},200,origin);
  }catch(e){return json({ok:false,error:'live_stop_failed',message:String(e?.message||e)},502,origin)}
 }
 if(url.pathname==="/api/tracks" && request.method==="GET") {
  try {
   if(!env.RADIO_AUDIO) return json({ok:false,error:"r2_binding_missing",message:"O binding RADIO_AUDIO não está disponível."},503,origin);
   const listed=await env.RADIO_AUDIO.list({limit:1000});
   const tracks=listed.objects.filter(o=>!o.key.startsWith("radio-control/")&&((o.httpMetadata?.contentType||"").toLowerCase().startsWith("audio/")||/\.(mp3|m4a|aac|ogg|wav|flac|opus|webm)$/i.test(o.key))).map(o=>({key:o.key,name:o.customMetadata?.originalName||o.customMetadata?.name||o.key.split("-").slice(2).join("-")||("Áudio "+o.key.slice(0,8)),artist:o.customMetadata?.artist||"",durationMs:Number(o.customMetadata?.durationMs||0),size:o.size,uploadedAt:o.uploaded,contentType:o.httpMetadata?.contentType||"audio/mpeg",url:"/audio/"+encodeURIComponent(o.key)}));
   return json({ok:true,tracks,cursor:listed.truncated?listed.cursor:null},200,origin);
  } catch(e) {
   return json({ok:false,error:"r2_list_failed",message:String(e?.message||e).slice(0,300)},502,origin);
  }
 }
 if(url.pathname==="/api/on-air" && request.method==="GET") {
  try { const obj=await env.RADIO_AUDIO.get("radio-control/state.json"); const state=obj?await obj.json():{active:false}; return json({ok:true,state},200,origin); } catch(e) { return json({ok:false,error:"radio_state_read_failed",message:String(e?.message||e)},502,origin); }
 }
 if(url.pathname==="/api/on-air" && request.method==="POST") {
  if(!(await hasRadioPermission(request,env,"manageRadioPlayback"))) return json({ok:false,error:"admin_permission_required"},403,origin);
  try { const body=await request.json(); let state; if(body.action==="stop") state={active:false,updatedAt:Date.now()}; else { const key=String(body.key||""); if(!key) return json({ok:false,error:"track_key_required"},400,origin); const obj=await env.RADIO_AUDIO.head(key); if(!obj) return json({ok:false,error:"track_not_found"},404,origin); const playlistObj=body.playlist===true?await env.RADIO_AUDIO.get("radio-control/playlist.json"):null; const playlist=playlistObj?await playlistObj.json():{tracks:[]}; const saved=(playlist.tracks||[]).find(t=>t.key===key); state={active:true,key,name:saved?.name||obj.customMetadata?.originalName||obj.customMetadata?.name||key,startedAt:Date.now(),durationMs:Number(saved?.durationMs||obj.customMetadata?.durationMs||0),loop:body.loop===true,playlistMode:body.playlist===true,repeatMode:body.repeatMode||"off",shuffle:body.shuffle===true,paused:false,pausedPositionMs:0,updatedAt:Date.now()}; } await env.RADIO_AUDIO.put("radio-control/state.json",JSON.stringify(state),{httpMetadata:{contentType:"application/json",cacheControl:"no-store"}});const audit=await authRadioLease(request,env,"/api/internal/radio/audit",{action:"radio_playback_control",details:{action:body.action==="stop"?"stop":"play",key:state.key||null}});if(!audit.ok)console.warn("Auditoria do controle de reprodução não registrada:",audit.data?.erro||audit.status);return json({ok:true,state},200,origin); } catch(e) { return json({ok:false,error:"radio_state_write_failed",message:String(e?.message||e)},502,origin); }
 }

 if(url.pathname==="/api/playlist" && request.method==="GET") {
  try { const obj=await env.RADIO_AUDIO.get("radio-control/playlist.json"); const playlist=obj?await obj.json():{tracks:[],updatedAt:null}; const valid=[]; for(const t of (Array.isArray(playlist.tracks)?playlist.tracks:[])){const key=String(t?.key||""); if(!key||key.startsWith("radio-control/"))continue; const head=await env.RADIO_AUDIO.head(key); if(!head)continue; const type=(head.httpMetadata?.contentType||"").toLowerCase(); if(type.startsWith("audio/")||/\.(mp3|m4a|aac|ogg|wav|flac|opus|webm)$/i.test(key))valid.push({...t,key,name:t.name||head.customMetadata?.originalName||head.customMetadata?.name||("Áudio "+key.slice(0,8)),durationMs:Number(t.durationMs||head.customMetadata?.durationMs||0)});} playlist.tracks=valid; return json({ok:true,playlist},200,origin); } catch(e) { return json({ok:false,error:"playlist_read_failed"},502,origin); }
 }
 if(url.pathname==="/api/playlist" && request.method==="POST") {
  if(!(await hasRadioPermission(request,env,"manageRadioPlaylists"))) return json({ok:false,error:"admin_permission_required"},403,origin);
  try { const body=await request.json(); const keys=Array.isArray(body.tracks)?body.tracks:[]; if(keys.length>500) return json({ok:false,error:"playlist_limit_exceeded"},400,origin);
   const tracks=[]; for(const item of keys){const key=String(typeof item==="string"?item:item?.key||""); if(!key||key.startsWith("radio-control/")||tracks.some(t=>t.key===key))continue; const obj=await env.RADIO_AUDIO.head(key); if(obj){const requestedName=typeof item==="object"?String(item.name||"").trim():""; const durationMs=Number(typeof item==="object"?item.durationMs:0)||Number(obj.customMetadata?.durationMs||0); tracks.push({key,name:requestedName||obj.customMetadata?.originalName||obj.customMetadata?.name||key.split("-").slice(2).join("-")||("Áudio "+key.slice(0,8)),durationMs});}}
   const playlist={tracks,updatedAt:Date.now()}; await env.RADIO_AUDIO.put("radio-control/playlist.json",JSON.stringify(playlist),{httpMetadata:{contentType:"application/json",cacheControl:"no-store"}});
   const audit=await authRadioLease(request,env,"/api/internal/radio/audit",{action:"radio_queue_updated",details:{trackCount:tracks.length}});if(!audit.ok)console.warn("Auditoria da fila não registrada:",audit.data?.erro||audit.status);
   return json({ok:true,playlist},200,origin);
  } catch(e){return json({ok:false,error:"playlist_write_failed",message:String(e?.message||e)},502,origin);}
 }
 if(url.pathname==="/api/control" && request.method==="POST") {
  if(!(await hasRadioPermission(request,env,"manageRadioPlayback")))return json({ok:false,error:"admin_permission_required"},403,origin);
  try { const body=await request.json(),action=String(body.action||""),obj=await env.RADIO_AUDIO.get("radio-control/state.json");if(!obj)return json({ok:false,error:"radio_not_started"},409,origin);let state=await obj.json();
   if(action==="next"||action==="previous"){const r=await advancePlaylist(env,{},false,action);const audit=await authRadioLease(request,env,"/api/internal/radio/audit",{action:"radio_control_action",details:{action}});if(!audit.ok)console.warn("Auditoria do controle da rádio não registrada:",audit.data?.erro||audit.status);return json({ok:true,...r},200,origin);}
   if(action==="pause"){if(state.active&&!state.paused){state.pausedPositionMs=Math.max(0,Date.now()-Number(state.startedAt||Date.now()));state.paused=true;state.updatedAt=Date.now();}}
   else if(action==="resume"){if(state.active&&state.paused){state.startedAt=Date.now()-Number(state.pausedPositionMs||0);state.paused=false;state.updatedAt=Date.now();}}
   else if(action==="repeat"){state.repeatMode=body.mode==="track"?"track":body.mode==="playlist"?"playlist":"off";state.loop=state.repeatMode==="track";state.updatedAt=Date.now();}
   else if(action==="shuffle"){state.shuffle=body.enabled===true;state.updatedAt=Date.now();}
   else return json({ok:false,error:"invalid_control_action"},400,origin);
   await env.RADIO_AUDIO.put("radio-control/state.json",JSON.stringify(state),{httpMetadata:{contentType:"application/json",cacheControl:"no-store"}});const audit=await authRadioLease(request,env,"/api/internal/radio/audit",{action:"radio_control_action",details:{action,mode:body.mode||null,enabled:body.enabled===true}});if(!audit.ok)console.warn("Auditoria do controle da rádio não registrada:",audit.data?.erro||audit.status);return json({ok:true,state},200,origin);
  }catch(e){return json({ok:false,error:"radio_control_failed",message:String(e?.message||e)},502,origin);}
 }
 if(url.pathname==="/api/programs" && request.method==="GET") {const d=await readPrograms(env);return json({ok:true,...d},200,origin);}
 if(url.pathname==="/api/programs" && request.method==="POST") {
  if(!(await hasRadioPermission(request,env,"manageRadioSchedule")))return json({ok:false,error:"admin_permission_required"},403,origin);
  try {const body=await request.json(),programs=Array.isArray(body.programs)?body.programs:[];if(programs.length>100)return json({ok:false,error:"program_limit_exceeded"},400,origin);
   const clean=[];for(const p of programs){const name=String(p.name||"").trim().slice(0,80),start=String(p.start||""),end=String(p.end||""),days=Array.isArray(p.days)?[...new Set(p.days.map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6))]:[],tracks=Array.isArray(p.tracks)?p.tracks.slice(0,500).map(t=>({key:String(t.key||""),name:String(t.name||t.key||"").slice(0,100),durationMs:Number(t.durationMs||0)})).filter(t=>t.key&&!t.key.startsWith("radio-control/")):[];
    if(!name||!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||start>=end||!days.length||!tracks.length)continue;
    const valid=[];for(const t of tracks){const h=await env.RADIO_AUDIO.head(t.key);if(h)valid.push({...t,durationMs:t.durationMs||Number(h.customMetadata?.durationMs||0)});}
    if(valid.length)clean.push({id:String(p.id||crypto.randomUUID()).slice(0,80),name,start,end,days,tracks:valid,repeatMode:["off","playlist","track"].includes(p.repeatMode)?p.repeatMode:"playlist",shuffle:p.shuffle===true,enabled:p.enabled!==false});
   }
   for(let x=0;x<clean.length;x++)for(let y=x+1;y<clean.length;y++){if(clean[x].start<clean[y].end&&clean[y].start<clean[x].end&&clean[x].days.some(d=>clean[y].days.includes(d)))return json({ok:false,error:"program_time_conflict",message:"Existem programas com horários sobrepostos no mesmo dia."},409,origin);}
   const result={programs:clean,updatedAt:Date.now()};await env.RADIO_AUDIO.put("radio-control/programs.json",JSON.stringify(result),{httpMetadata:{contentType:"application/json",cacheControl:"no-store"}});const audit=await authRadioLease(request,env,"/api/internal/radio/audit",{action:"radio_schedule_updated",details:{programCount:clean.length}});if(!audit.ok)console.warn("Auditoria da programação não registrada:",audit.data?.erro||audit.status);return json({ok:true,...result},200,origin);
  }catch(e){return json({ok:false,error:"programs_write_failed",message:String(e?.message||e)},502,origin);}
 }
 if(url.pathname==="/api/playlists" && request.method==="GET") {
  if(!(await hasRadioPermission(request,env,"viewRadioPanel")))return json({ok:false,error:"radio_permission_required"},403,origin);
  try { const obj=await env.RADIO_AUDIO.get("radio-control/playlists.json"),data=obj?await obj.json():{playlists:[]};return json({ok:true,playlists:Array.isArray(data.playlists)?data.playlists:[]},200,origin); } catch(err) { return json({ok:false,error:"named_playlists_read_failed",message:String(err?.message||err)},502,origin); }
 }
 if(url.pathname==="/api/playlists" && request.method==="POST") {
  if(!(await hasRadioPermission(request,env,"manageRadioPlaylists")))return json({ok:false,error:"radio_permission_required"},403,origin);
  try { const body=await request.json(),obj=await env.RADIO_AUDIO.get("radio-control/playlists.json"),data=obj?await obj.json():{playlists:[]};let playlists=Array.isArray(data.playlists)?data.playlists:[];
   if(body.action==="delete"){const id=String(body.id||"");playlists=playlists.filter(p=>p.id!==id);}else if(body.action==="rename"){const id=String(body.id||""),name=String(body.name||"").trim().slice(0,80),item=playlists.find(p=>p.id===id);if(!item)return json({ok:false,error:"playlist_not_found"},404,origin);if(!name)return json({ok:false,error:"playlist_name_required"},400,origin);if(playlists.some(p=>p.id!==id&&String(p.name||"").toLocaleLowerCase()===name.toLocaleLowerCase()))return json({ok:false,error:"playlist_name_already_exists"},409,origin);item.name=name;item.updatedAt=Date.now();}else{const name=String(body.name||"").trim().slice(0,80),items=Array.isArray(body.tracks)?body.tracks:[];if(!name||!items.length)return json({ok:false,error:"playlist_name_and_tracks_required"},400,origin);if(items.length>500)return json({ok:false,error:"playlist_limit_exceeded"},400,origin);const tracks=[];for(const item of items){const key=String(item?.key||"");if(!key||key.startsWith("radio-control/")||tracks.some(t=>t.key===key))continue;const head=await env.RADIO_AUDIO.head(key);if(!head)continue;const durationMs=Number(item.durationMs||head.customMetadata?.durationMs||0);if(durationMs>0)tracks.push({key,name:String(item.name||head.customMetadata?.originalName||head.customMetadata?.name||key).slice(0,100),durationMs});}if(!tracks.length)return json({ok:false,error:"no_valid_tracks_with_duration"},400,origin);const existing=playlists.find(p=>p.id===body.id)||playlists.find(p=>String(p.name||"").toLocaleLowerCase()===name.toLocaleLowerCase());const item={id:existing?.id||String(body.id||crypto.randomUUID()),name,tracks,updatedAt:Date.now()};playlists=playlists.filter(p=>p.id!==item.id);playlists.push(item);if(playlists.length>50)playlists=playlists.slice(-50);}
   const result={playlists,updatedAt:Date.now()};await env.RADIO_AUDIO.put("radio-control/playlists.json",JSON.stringify(result),{httpMetadata:{contentType:"application/json",cacheControl:"no-store"}});const auditAction=body.action==="delete"?"radio_playlist_deleted":body.action==="rename"?"radio_playlist_renamed":"radio_playlist_saved";const audit=await authRadioLease(request,env,"/api/internal/radio/audit",{action:auditAction,details:{playlistId:body.id||null,name:body.name||null,trackCount:Array.isArray(body.tracks)?body.tracks.length:null}});if(!audit.ok)console.warn("Auditoria de playlist não registrada:",audit.data?.erro||audit.status);return json({ok:true,...result},200,origin);
  } catch(err) { return json({ok:false,error:"named_playlists_write_failed",message:String(err?.message||err)},502,origin); }
 }
 if(url.pathname==="/api/ads" && request.method==="GET") {
  if(!(await hasRadioPermission(request,env,"viewRadioPanel")))return json({ok:false,error:"radio_permission_required"},403,origin);
  try { const ads=await readAds(env),now=Date.now();return json({ok:true,ads:{enabled:ads.enabled===true,intervalMinutes:30,tracks:Array.isArray(ads.tracks)?ads.tracks:[],lastPlayedAt:ads.lastPlayedAt||null,nextAdAt:ads.nextAdAt||null,warningActive:!!ads.nextAdAt&&Number(ads.nextAdAt)-now>0&&Number(ads.nextAdAt)-now<=120000,secondsToNextAd:ads.nextAdAt?Math.max(0,Math.ceil((Number(ads.nextAdAt)-now)/1000)):null}},200,origin); } catch(err) { return json({ok:false,error:"ads_read_failed",message:String(err?.message||err)},502,origin); }
 }
 if(url.pathname==="/api/ads" && request.method==="POST") {
  if(!(await hasRadioPermission(request,env,"manageRadioAds")))return json({ok:false,error:"radio_permission_required"},403,origin);
  try { const body=await request.json(),old=await readAds(env),keys=Array.isArray(body.tracks)?body.tracks:[];if(keys.length>100)return json({ok:false,error:"ad_track_limit_exceeded"},400,origin);const tracks=[];for(const item of keys){const key=String(item?.key||item||"");if(!key||key.startsWith("radio-control/")||tracks.some(t=>t.key===key))continue;const head=await env.RADIO_AUDIO.head(key);if(!head)continue;const name=String(item?.name||head.customMetadata?.originalName||head.customMetadata?.name||key).slice(0,100),durationMs=Number(item?.durationMs||head.customMetadata?.durationMs||0);if(durationMs>0)tracks.push({key,name,durationMs});}
   const enabled=body.enabled===true&&tracks.length>0,now=Date.now(),nextAdAt=enabled?(old.enabled&&old.nextAdAt?Number(old.nextAdAt):now+750000):null;const ads={enabled,intervalMinutes:30,tracks,cursor:Number(old.cursor||0)%Math.max(1,tracks.length),lastPlayedAt:old.lastPlayedAt||null,nextAdAt,updatedAt:now};await env.RADIO_AUDIO.put("radio-control/ads.json",JSON.stringify(ads),{httpMetadata:{contentType:"application/json",cacheControl:"no-store"}});const audit=await authRadioLease(request,env,"/api/internal/radio/audit",{action:"radio_ads_updated",details:{enabled,trackCount:tracks.length}});if(!audit.ok)console.warn("Auditoria dos anúncios não registrada:",audit.data?.erro||audit.status);return json({ok:true,ads},200,origin);
  } catch(err) { return json({ok:false,error:"ads_write_failed",message:String(err?.message||err)},502,origin); }
 }
 if(url.pathname==="/api/playlist/advance" && request.method==="POST") {
  try { const body=await request.json().catch(()=>({})); const result=await advancePlaylist(env,{key:body.key,startedAt:body.startedAt},true,"ended"); return json({ok:true,...result},200,origin); } catch(e){return json({ok:false,error:"playlist_advance_failed",message:String(e?.message||e)},502,origin);}
 }
 if(url.pathname==="/api/listeners/heartbeat" && request.method==="POST") {
  try { const body=await request.json(); const id=String(body.id||"").slice(0,80); if(!/^[a-zA-Z0-9_-]{8,80}$/.test(id))return json({ok:false,error:"invalid_listener_id"},400,origin);
   const key="radio-control/listeners.json",obj=await env.RADIO_AUDIO.get(key); const data=obj?await obj.json():{listeners:{},history:[]}; const now=Date.now(); const listeners=data.listeners||{};
   for(const [k,v] of Object.entries(listeners))if(now-Number(v.lastSeen||0)>90000)delete listeners[k];
   listeners[id]={lastSeen:now,startedAt:listeners[id]?.startedAt||now}; const count=Object.keys(listeners).length;
   const history=Array.isArray(data.history)?data.history:[]; const minute=Math.floor(now/60000)*60000; const last=history[history.length-1]; if(last?.minute===minute)last.count=count; else history.push({minute,count});
   data.listeners=listeners;data.history=history.slice(-10080);await env.RADIO_AUDIO.put(key,JSON.stringify(data),{httpMetadata:{contentType:"application/json",cacheControl:"no-store"}});
   return json({ok:true,listeners:count},200,origin);
  } catch(e){return json({ok:false,error:"listener_heartbeat_failed"},502,origin);}
 }
 if(url.pathname==="/api/listeners" && request.method==="GET") {
  if(!(await hasRadioPermission(request,env,"manageRadioSettings"))) return json({ok:false,error:"admin_permission_required"},403,origin);
  try {const obj=await env.RADIO_AUDIO.get("radio-control/listeners.json");const data=obj?await obj.json():{listeners:{},history:[]};const now=Date.now(),listeners=Object.values(data.listeners||{}).filter(v=>now-Number(v.lastSeen||0)<=90000);const history=(data.history||[]).slice(-1440);return json({ok:true,count:listeners.length,history,updatedAt:now},200,origin);}catch(e){return json({ok:false,error:"listener_stats_failed"},502,origin);}
 }
 if(url.pathname==="/api/upload" && request.method==="POST") {
  if(!(await hasRadioPermission(request,env,"manageRadioLibrary"))) return json({ok:false,error:"admin_permission_required"},403,origin);
  const originalName=String(url.searchParams.get("name")||request.headers.get("X-File-Name")||"audio.mp3").replace(/[\u0000-\u001f\u007f]/g,"").trim().slice(0,180)||"audio.mp3";
  const name=cleanName(originalName);
  const type=request.headers.get("Content-Type")||"audio/mpeg";
  if(!type.startsWith("audio/") && type!=="application/octet-stream") return json({ok:false,error:"audio_file_required"},415,origin);
  const len=Number(request.headers.get("Content-Length")||0);
  if(len>100*1024*1024) return json({ok:false,error:"file_too_large_max_100mb"},413,origin);
  const key=Date.now().toString(36)+"-"+crypto.randomUUID()+"-"+name;
  try {
   await env.RADIO_AUDIO.put(key,request.body,{httpMetadata:{contentType:type,cacheControl:"public, max-age=3600"},customMetadata:{name,originalName,uploadedBy:"radio-admin"}});
   const saved=await env.RADIO_AUDIO.head(key);
   if(!saved) return json({ok:false,error:"r2_write_not_verified",message:"O R2 não confirmou a existência do arquivo após o envio.",key},502,origin);
   const audit=await authRadioLease(request,env,"/api/internal/radio/audit",{action:"radio_track_uploaded",details:{key,name:originalName,size:saved.size}});if(!audit.ok)console.warn("Auditoria do envio de áudio não registrada:",audit.data?.erro||audit.status);
   return json({ok:true,verified:true,track:{key,name:originalName,size:saved.size,uploadedAt:saved.uploaded,url:"/audio/"+encodeURIComponent(key)}},201,origin);
  } catch(e) {
   return json({ok:false,error:"r2_write_failed",message:String(e?.message||e).slice(0,300),key},502,origin);
  }
 }
 if(url.pathname.startsWith("/api/tracks/") && request.method==="PATCH") {
  if(!(await hasRadioPermission(request,env,"manageRadioLibrary")))return json({ok:false,error:"admin_permission_required"},403,origin);
  const key=decodeURIComponent(url.pathname.slice("/api/tracks/".length));if(!key||key.includes("..")||key.startsWith("radio-control/"))return json({ok:false,error:"invalid_key"},400,origin);
  try { const body=await request.json(),originalName=String(body.name||"").replace(/[\u0000-\u001f\u007f]/g,"").trim().slice(0,180),artist=String(body.artist??"").replace(/[\u0000-\u001f\u007f]/g,"").trim().slice(0,120);if(!originalName)return json({ok:false,error:"track_name_required"},400,origin);const obj=await env.RADIO_AUDIO.get(key);if(!obj)return json({ok:false,error:"track_not_found"},404,origin);await env.RADIO_AUDIO.put(key,obj.body,{httpMetadata:obj.httpMetadata,customMetadata:{...(obj.customMetadata||{}),name:cleanName(originalName),originalName,artist}});const audit=await authRadioLease(request,env,"/api/internal/radio/audit",{action:"radio_track_updated",details:{key,name:originalName,artist}});if(!audit.ok)console.warn("Auditoria de metadados não registrada:",audit.data?.erro||audit.status);return json({ok:true,key,name:originalName,artist},200,origin); }catch(err){return json({ok:false,error:"track_rename_failed",message:String(err?.message||err)},502,origin);}
 }
 if(url.pathname.startsWith("/api/tracks/") && request.method==="DELETE") {
  if(!(await hasRadioPermission(request,env,"manageRadioLibrary"))) return json({ok:false,error:"admin_permission_required"},403,origin);
  const key=decodeURIComponent(url.pathname.slice("/api/tracks/".length));
  if(!key || key.includes("..")) return json({ok:false,error:"invalid_key"},400,origin);
  await env.RADIO_AUDIO.delete(key);const audit=await authRadioLease(request,env,"/api/internal/radio/audit",{action:"radio_track_deleted",details:{key}});if(!audit.ok)console.warn("Auditoria de exclusão não registrada:",audit.data?.erro||audit.status);
  return json({ok:true,deleted:key},200,origin);
 }
 if(url.pathname.startsWith("/audio/") && (request.method==="GET"||request.method==="HEAD")) {
  const key=decodeURIComponent(url.pathname.slice("/audio/".length));
  if(!key || key.includes("..")) return json({ok:false,error:"invalid_key"},400,origin);
  const rangeHeader=request.headers.get("Range"); let range=null,status=200;
  const fullObject=await env.RADIO_AUDIO.head(key); if(!fullObject) return json({ok:false,error:"track_not_found"},404,origin);
  const total=Number(fullObject.size||0);
  if(rangeHeader){
   const match=/^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
   if(!match||(!match[1]&&!match[2])||!total)return new Response(null,{status:416,headers:{"Content-Range":"bytes */"+total,"Accept-Ranges":"bytes",...cors(origin)}});
   let start,end;
   if(!match[1]){const suffix=Number(match[2]);if(!Number.isFinite(suffix)||suffix<=0)return new Response(null,{status:416,headers:{"Content-Range":"bytes */"+total,"Accept-Ranges":"bytes",...cors(origin)}});start=Math.max(0,total-suffix);end=total-1;}
   else{start=Number(match[1]);end=match[2]?Number(match[2]):total-1;}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=total||end<start)return new Response(null,{status:416,headers:{"Content-Range":"bytes */"+total,"Accept-Ranges":"bytes",...cors(origin)}});
   end=Math.min(end,total-1);range={offset:start,length:end-start+1};status=206;
  }
  const object=range?await env.RADIO_AUDIO.get(key,{range}):await env.RADIO_AUDIO.get(key); if(!object)return json({ok:false,error:"track_not_found"},404,origin);
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set("ETag",object.httpEtag);headers.set("Accept-Ranges","bytes");headers.set("Access-Control-Allow-Origin",ALLOWED_ORIGINS.has(origin)?origin:"*");headers.set("Cache-Control","public, max-age=3600");headers.set("Content-Length",String(range?range.length:total));
  if(range)headers.set("Content-Range","bytes "+range.offset+"-"+(range.offset+range.length-1)+"/"+total);
  if(request.method==="HEAD")return new Response(null,{status,headers});return new Response(object.body,{status,headers});
 }
 return json({ok:false,error:"not_found"},404,origin);
}, async scheduled(controller,env,ctx) { ctx.waitUntil(runSchedule(env).catch(()=>{})); } };