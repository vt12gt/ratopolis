const VERSION='rato-snack-api-dev-v15-private-profile-fullname-admin';
const ORIGINS=new Set(['https://vt12gt.github.io','https://ratopolis-cadastro-teste.pages.dev','https://rativa-ids-preview.pages.dev','http://localhost:8158','http://localhost:8787']);
const out=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
function bearer(r){const m=(r.headers.get('Authorization')||'').match(/^Bearer\s+(\S+)$/i);return m?m[1]:''}
async function hashToken(t){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));let b='';for(const x of new Uint8Array(d))b+=String.fromCharCode(x);return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')}
function newPublicId(){const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';const bytes=new Uint8Array(5);crypto.getRandomValues(bytes);return 'RS-'+Array.from(bytes,x=>alphabet[x%alphabet.length]).join('')}
async function ensureGameUser(portal,db){
 let game=await db.prepare("SELECT id,public_id,status,nickname FROM game_users WHERE portal_user_id=? LIMIT 1").bind(portal.id).first();
 if(!game){
  const role=['player','mod','gm','adm','spadm'].includes(portal.role)?portal.role:'player';
  for(let attempt=0;attempt<8;attempt++){
   const id=crypto.randomUUID(),publicId=newPublicId();
   try{
    await db.prepare("INSERT INTO game_users (id,public_id,nickname,status,role,portal_user_id) VALUES (?,?,?,'active',?,?)").bind(id,publicId,portal.nickname,role,portal.id).run();
    game={id,public_id:publicId,status:'active',nickname:portal.nickname};break;
   }catch(e){
    const again=await db.prepare("SELECT id,public_id,status,nickname FROM game_users WHERE portal_user_id=? LIMIT 1").bind(portal.id).first();
    if(again){game=again;break;}
    if(attempt===7)throw e;
   }
  }
 }
 if(!game||game.status!=='active')return null;
 if(game.nickname!==portal.nickname)await db.prepare("UPDATE game_users SET nickname=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(portal.nickname,game.id).run();
 return {id:game.id,public_id:game.public_id,nickname:portal.nickname,role:portal.role,portal_user_id:portal.id};
}
async function auth(r,env){
 const token=bearer(r);if(token.length<20||!env.PORTAL_DB)return null;
 const portal=await env.PORTAL_DB.prepare("SELECT u.id,u.nickname,u.role,u.status FROM ratopolis_sessions s JOIN ratopolis_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active' LIMIT 1").bind(await hashToken(token),new Date().toISOString()).first();
 if(!portal)return null;
 return ensureGameUser(portal,env.DB);
}
async function body(r){try{return await r.json()}catch{return null}}
function cleanFullName(value){return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,120)}
function pixB64(bytes){let s='';for(const x of bytes)s+=String.fromCharCode(x);return btoa(s)}
function pixUnb64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function pixAesKey(env){if(!env.PIX_KEY_ENCRYPTION_SECRET)throw new Error('pix_encryption_secret_missing');return crypto.subtle.importKey('raw',pixUnb64(env.PIX_KEY_ENCRYPTION_SECRET),{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function encryptPix(value,env){const iv=crypto.getRandomValues(new Uint8Array(12)),key=await pixAesKey(env),cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(String(value))));const all=new Uint8Array(iv.length+cipher.length);all.set(iv);all.set(cipher,iv.length);return 'enc:v1:'+pixB64(all)}
async function decryptPix(value,env){const s=String(value||'');if(!s.startsWith('enc:v1:'))return s;const all=pixUnb64(s.slice(7)),iv=all.slice(0,12),cipher=all.slice(12),key=await pixAesKey(env);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv},key,cipher))}
async function profile(db,id){await db.prepare('INSERT OR IGNORE INTO rato_snack_profiles (user_id) VALUES (?)').bind(id).run()}

const BRT=3*60*60*1000;
function localParts(d=new Date()){const x=new Date(d.getTime()-BRT);return {y:x.getUTCFullYear(),m:x.getUTCMonth()};}
function closeUtc(y,m){return new Date(Date.UTC(y,m+1,1,3,0,0,0)-1);}
function cycleFor(now=new Date()){const p=localParts(now),end=closeUtc(p.y,p.m);if(now.getTime()>end.getTime()){const nm=p.m===11?0:p.m+1,ny=p.m===11?p.y+1:p.y;return {y:ny,m:nm,key:ny+'-'+String(nm+1).padStart(2,'0'),start:new Date(end.getTime()+1),close:closeUtc(ny,nm)};}const pm=p.m===0?11:p.m-1,py=p.m===0?p.y-1:p.y;return {y:p.y,m:p.m,key:p.y+'-'+String(p.m+1).padStart(2,'0'),start:new Date(closeUtc(py,pm).getTime()+1),close:end};}
async function closeCycle(db,y,m,now=new Date()){const end=closeUtc(y,m);if(now.getTime()<end.getTime())return false;const pm=m===0?11:m-1,py=m===0?y-1:y,start=new Date(closeUtc(py,pm).getTime()+1),key=y+'-'+String(m+1).padStart(2,'0'),closedAt=now.toISOString(),startAt=start.toISOString(),endAt=end.toISOString();await db.batch([
 db.prepare("INSERT OR IGNORE INTO rato_snack_rank_cycles (cycle_key,starts_at,closes_at,status,closed_at) VALUES (?,?,?,'closed',?)").bind(key,startAt,endAt,closedAt),
 db.prepare("INSERT OR IGNORE INTO rato_snack_rank_snapshots (cycle_key,user_id,nickname_snapshot,position,total_score,games_count,snapshot_at) SELECT ?,r.user_id,u.nickname,ROW_NUMBER() OVER (ORDER BY SUM(r.score) DESC,COUNT(*) DESC,u.nickname COLLATE NOCASE ASC),SUM(r.score),COUNT(*),? FROM rato_snack_records r JOIN game_users u ON u.id=r.user_id WHERE r.mode='online' AND r.created_at>=? AND r.created_at<=? AND u.status='active' GROUP BY r.user_id ORDER BY SUM(r.score) DESC,COUNT(*) DESC,u.nickname COLLATE NOCASE ASC LIMIT 5").bind(key,closedAt,startAt,endAt)
]);return true;}
function monthWindow(now=new Date()){const p=localParts(now),start=new Date(Date.UTC(p.y,p.m,1)+BRT),end=new Date(Date.UTC(p.y,p.m+1,1)+BRT);return {y:p.y,m:p.m,key:p.y+'-'+String(p.m+1).padStart(2,'0'),start,end};}
async function refreshMonthlyRanking(db,now=new Date()){const w=monthWindow(now),stamp=now.toISOString();await db.batch([
 db.prepare('DELETE FROM rato_snack_monthly_rank_cache WHERE month_key=?').bind(w.key),
 db.prepare("INSERT INTO rato_snack_monthly_rank_cache (month_key,user_id,nickname_snapshot,position,total_score,games_count,snapshot_at) SELECT ?,u.id,u.nickname,ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(r.score),0) DESC,COUNT(r.id) DESC,u.nickname COLLATE NOCASE ASC),COALESCE(SUM(r.score),0),COUNT(r.id),? FROM game_users u LEFT JOIN rato_snack_records r ON r.user_id=u.id AND r.mode='online' AND r.created_at>=? AND r.created_at<? WHERE u.status='active' GROUP BY u.id ORDER BY COALESCE(SUM(r.score),0) DESC,COUNT(r.id) DESC,u.nickname COLLATE NOCASE ASC LIMIT 50").bind(w.key,stamp,w.start.toISOString(),w.end.toISOString()),
 db.prepare('INSERT INTO rato_snack_monthly_rank_state (month_key,refreshed_at,starts_at,ends_at) VALUES (?,?,?,?) ON CONFLICT(month_key) DO UPDATE SET refreshed_at=excluded.refreshed_at,starts_at=excluded.starts_at,ends_at=excluded.ends_at').bind(w.key,stamp,w.start.toISOString(),w.end.toISOString())
]);return w;}
async function ensureRecentClosures(db,now=new Date()){const p=localParts(now);await closeCycle(db,p.y,p.m,now);const pm=p.m===0?11:p.m-1,py=p.m===0?p.y-1:p.y;await closeCycle(db,py,pm,now);}
export default {async scheduled(event,env,ctx){if(!env.DB)return;const now=new Date(event.scheduledTime||Date.now());await ensureRecentClosures(env.DB,now);const w=monthWindow(now),state=await env.DB.prepare('SELECT refreshed_at FROM rato_snack_monthly_rank_state WHERE month_key=?').bind(w.key).first();if(!state||!state.refreshed_at||now.getTime()-Date.parse(state.refreshed_at)>=48*60*60*1000)await refreshMonthlyRanking(env.DB,now)},async fetch(request,env){
 const origin=request.headers.get('Origin')||'',cors={};
 if(origin&&ORIGINS.has(origin)){cors['Access-Control-Allow-Origin']=origin;cors['Access-Control-Allow-Methods']='GET, POST, OPTIONS';cors['Access-Control-Allow-Headers']='Content-Type, Authorization';cors['Access-Control-Max-Age']='86400';cors.Vary='Origin'}
 if(origin&&!ORIGINS.has(origin))return out({ok:false,error:'origin_not_allowed'},403,cors);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(!env.DB||!env.PORTAL_DB)return out({ok:false,error:'database_binding_missing'},503,cors);
 const u=new URL(request.url),p=u.pathname.replace(/\/+$/,'')||'/';
 if(p==='/'||p==='/health')return out({ok:true,service:'rato-snack-api',version:VERSION,environment:'development',identity:'rativa-games-portal'},200,cors);
 if(!p.startsWith('/api/rato-snack/'))return out({ok:false,error:'not_found'},404,cors);
 if(p==='/api/rato-snack/leaderboard'&&request.method==='GET'){
  const n=Math.max(1,Math.min(50,parseInt(u.searchParams.get('limit')||'20',10)||20)),period=(u.searchParams.get('period')||'best').toLowerCase();
  if(period==='top5'){
   const v=await env.DB.prepare("SELECT s.cycle_key,s.position,u.public_id AS user_id,s.nickname_snapshot AS nickname,s.total_score AS score,s.games_count,s.snapshot_at,c.status AS prize_status FROM rato_snack_rank_snapshots s JOIN rato_snack_rank_cycles c ON c.cycle_key=s.cycle_key JOIN game_users u ON u.id=s.user_id ORDER BY s.cycle_key DESC,s.position ASC LIMIT 5").all();
   return out({ok:true,period:'top5',players:v.results||[],updated_at:new Date().toISOString(),note:'Top 5 congelado do último fechamento; histórico preservado.'},200,cors)
  }
  if(!['best','monthly','total'].includes(period))return out({ok:false,error:'invalid_period'},400,cors);
  if(period==='best'){
   const v=await env.DB.prepare("SELECT u.public_id AS id,u.public_id AS public_id,u.nickname AS nickname,u.nickname AS display_name,COALESCE(p.best_score,0) AS score,COALESCE(p.games_played,0) AS games_played FROM game_users u LEFT JOIN rato_snack_profiles p ON p.user_id=u.id WHERE u.status='active' ORDER BY score DESC,games_played DESC,u.nickname COLLATE NOCASE ASC LIMIT ?").bind(String(n)).all();
   return out({ok:true,period,players:v.results||[],updated_at:new Date().toISOString(),note:'Melhor pontuação individual registrada por conta.'},200,cors)
  }
  const now=new Date();await ensureRecentClosures(env.DB,now);let v,cycle=null,updatedAt=now.toISOString();
  if(period==='monthly'){
   cycle=cycleFor(now);
   let state=await env.DB.prepare('SELECT refreshed_at FROM rato_snack_monthly_rank_state WHERE month_key=?').bind(cycle.key).first();
   if(!state||!state.refreshed_at||now.getTime()-Date.parse(state.refreshed_at)>=48*60*60*1000){await refreshMonthlyRanking(env.DB,now);state=await env.DB.prepare('SELECT refreshed_at FROM rato_snack_monthly_rank_state WHERE month_key=?').bind(cycle.key).first();}
   updatedAt=state?.refreshed_at||now.toISOString();
   v=await env.DB.prepare("SELECT c.user_id AS id,u.public_id AS public_id,c.nickname_snapshot AS nickname,c.nickname_snapshot AS display_name,c.total_score AS score,c.games_count AS games_played FROM rato_snack_monthly_rank_cache c JOIN game_users u ON u.id=c.user_id WHERE c.month_key=? AND u.status='active' ORDER BY c.position ASC LIMIT ?").bind(cycle.key,String(n)).all()
  }else{
   v=await env.DB.prepare("SELECT u.public_id AS id,u.public_id AS public_id,u.nickname,u.nickname AS display_name,COALESCE(SUM(r.score),0) AS score,COUNT(r.id) AS games_played FROM game_users u LEFT JOIN rato_snack_records r ON r.user_id=u.id AND r.mode='online' WHERE u.status='active' GROUP BY u.id ORDER BY score DESC,games_played DESC,u.nickname COLLATE NOCASE ASC LIMIT ?").bind(String(n)).all()
  }
  return out({ok:true,period,cycle:cycle?{key:cycle.key,starts_at:cycle.start.toISOString(),closes_at:cycle.close.toISOString()}:null,players:v.results||[],updated_at:period==='monthly'?updatedAt:new Date().toISOString(),note:period==='monthly'?'Pontuações do mês acumuladas e atualizadas a cada 2 dias às 00:00 (horário de Brasília).':'Soma permanente das pontuações de todas as partidas online registradas.'},200,cors)
 }
 const a=await auth(request,env);if(!a)return out({ok:false,error:'invalid_session'},401,cors);const id=a.id;

  const eventStaff=async()=>{try{const r=await fetch('https://rato-snack-multiplayer.onrender.com/api/admin/announcements/access',{headers:{Authorization:'Bearer '+bearer(request)},cache:'no-store'});const j=await r.json();return r.ok&&j.allowed===true?j:null}catch{return null}};
  if(p==='/api/rato-snack/private-profile'&&request.method==='GET'){
   const row=await env.DB.prepare('SELECT full_name,pix_key,updated_at FROM rato_snack_pix_profiles WHERE user_id=?').bind(id).first();
   const pix=await decryptPix(String(row?.pix_key||''),env);
   return out({ok:true,profile:{id:a.id,public_id:a.public_id,nickname:a.nickname,full_name:String(row?.full_name||''),pix_key:pix,updated_at:row?.updated_at||null}},200,cors)
  }
  if(p==='/api/rato-snack/private-profile'&&request.method==='POST'){
   const b=await body(request);if(!b||typeof b!=='object'||Array.isArray(b))return out({ok:false,error:'invalid_profile'},400,cors);
   const hasName=Object.prototype.hasOwnProperty.call(b,'full_name'),hasPix=Object.prototype.hasOwnProperty.call(b,'pix_key');
   if(!hasName&&!hasPix)return out({ok:false,error:'no_profile_changes'},400,cors);
   const old=await env.DB.prepare('SELECT full_name,pix_key FROM rato_snack_pix_profiles WHERE user_id=?').bind(id).first();
   const fullName=hasName?cleanFullName(b.full_name):String(old?.full_name||'');
   if(hasName&&(fullName.length<3||fullName.length>120))return out({ok:false,error:'invalid_full_name'},400,cors);
   const pix=hasPix?String(b.pix_key??'').trim():await decryptPix(String(old?.pix_key||''),env);
   if(hasPix&&(pix.length>160||(pix.length>0&&(pix.length<3||pix.includes('\n')||pix.includes('\r')))))return out({ok:false,error:'invalid_pix_key'},400,cors);
   const stamp=now(),stored=await encryptPix(pix,env);
   await env.DB.prepare('INSERT INTO rato_snack_pix_profiles(user_id,full_name,pix_key,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,pix_key=excluded.pix_key,updated_at=excluded.updated_at').bind(id,fullName,stored,stamp).run();
   return out({ok:true,saved:true,profile:{id:a.id,public_id:a.public_id,nickname:a.nickname,full_name:fullName,pix_key:pix,updated_at:stamp}},200,cors)
  }
  if(p==='/api/rato-snack/admin/private-profiles'&&request.method==='GET'){
   const access=await eventStaff();if(!access)return out({ok:false,error:'staff_only'},403,cors);
   const q=String(u.searchParams.get('q')||'').trim().slice(0,80);if(q.length<2)return out({ok:false,error:'query_required'},400,cors);
   const like='%'+q+'%';
   const rows=await env.DB.prepare("SELECT g.id,g.public_id,g.nickname,p.full_name,p.pix_key,p.updated_at FROM game_users g LEFT JOIN rato_snack_pix_profiles p ON p.user_id=g.id WHERE g.status='active' AND (g.nickname LIKE ? OR g.public_id LIKE ? OR COALESCE(p.full_name,'') LIKE ?) ORDER BY g.nickname COLLATE NOCASE LIMIT 30").bind(like,like,like).all();
   const profiles=await Promise.all((rows.results||[]).map(async row=>({...row,full_name:String(row.full_name||''),pix_key:await decryptPix(String(row.pix_key||''),env)})));
   return out({ok:true,profiles},200,cors)
  }
  const privateNamePrefix='/api/rato-snack/admin/private-profiles/';
  if(p.startsWith(privateNamePrefix)&&p.length>privateNamePrefix.length&&request.method==='POST'){
   const access=await eventStaff();if(!access)return out({ok:false,error:'staff_only'},403,cors);
   const b=await body(request);if(b&&Object.prototype.hasOwnProperty.call(b,'pix_key'))return out({ok:false,error:'pix_key_player_only'},403,cors);
   const fullName=cleanFullName(b?.full_name);if(fullName.length<3||fullName.length>120)return out({ok:false,error:'invalid_full_name'},400,cors);
   const targetKey=decodeURIComponent(p.slice(privateNamePrefix.length)),target=await env.DB.prepare('SELECT id,public_id,nickname FROM game_users WHERE id=? OR public_id=? LIMIT 1').bind(targetKey,targetKey).first();
   if(!target)return out({ok:false,error:'player_not_found'},404,cors);
   const old=await env.DB.prepare('SELECT full_name,pix_key FROM rato_snack_pix_profiles WHERE user_id=?').bind(target.id).first(),previous=String(old?.full_name||''),stored=old?.pix_key||await encryptPix('',env),stamp=now();
   await env.DB.prepare('INSERT INTO rato_snack_pix_profiles(user_id,full_name,pix_key,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,updated_at=excluded.updated_at').bind(target.id,fullName,stored,stamp).run();
   await env.DB.prepare("INSERT INTO game_audit_logs(id,actor_user_id,action,target_user_id,details_json,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),a.id,'rativasnack_private_name_updated',target.id,JSON.stringify({actor_nickname:a.nickname,target_nickname:target.nickname,public_id:target.public_id,previous_full_name:previous,new_full_name:fullName,staff_roles:access.roles||[]}),stamp).run();
   return out({ok:true,updated:true,full_name:fullName,updated_at:stamp},200,cors)
  }

  if(p==='/api/rato-snack/pix-key'&&request.method==='GET'){
   const row=await env.DB.prepare('SELECT pix_key,updated_at FROM rato_snack_pix_profiles WHERE user_id=?').bind(id).first();const key=await decryptPix(String(row?.pix_key||''),env);return out({ok:true,has_key:!!key,masked:key?key.slice(0,2)+'••••'+key.slice(-Math.min(3,Math.max(1,key.length-2))):'',updated_at:row?.updated_at||null},200,cors)
  }
  if(p==='/api/rato-snack/pix-key'&&request.method==='POST'){
   const b=await body(request),key=String(b?.pix_key||'').trim();if(key.length<3||key.length>160||/[\\r\\n]/.test(key))return out({ok:false,error:'invalid_pix_key'},400,cors);const now=new Date().toISOString();await env.DB.prepare('INSERT INTO rato_snack_pix_profiles (user_id,pix_key,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET pix_key=excluded.pix_key,updated_at=excluded.updated_at').bind(id,await encryptPix(key,env),now).run();return out({ok:true,saved:true,updated_at:now},200,cors)
  }
  if(p==='/api/rato-snack/events'&&request.method==='GET'){
   const roomId=String(u.searchParams.get('room_id')||'').slice(0,100);const active=await env.DB.prepare("SELECT id,room_id,status,goal_type,goal_value,reward_type,reward_amount,event_type,prize_cents,payment_status,created_by_nickname,created_at,winner_nickname,winner_score,won_at FROM rato_snack_live_events WHERE status='active' ORDER BY created_at DESC LIMIT 100").all();if(!roomId)return out({ok:true,event:null,events:active.results||[]},200,cors);const ev=await env.DB.prepare("SELECT id,room_id,status,goal_type,goal_value,reward_type,reward_amount,event_type,prize_cents,payment_status,created_by_nickname,created_at,winner_nickname,winner_score,won_at FROM rato_snack_live_events WHERE room_id=? AND status IN ('active','won') ORDER BY created_at DESC LIMIT 1").bind(roomId).first();return out({ok:true,event:ev||null,events:active.results||[]},200,cors)
  }
  if(p==='/api/rato-snack/events/register'&&request.method==='POST'){
   const b=await body(request),eventId=String(b?.event_id||'');if(b?.confirm!==true||!eventId)return out({ok:false,error:'explicit_consent_required'},400,cors);const ev=await env.DB.prepare("SELECT id,event_type,status FROM rato_snack_live_events WHERE id=?").bind(eventId).first();if(!ev||ev.status!=='active'||ev.event_type!=='pix')return out({ok:false,error:'pix_event_unavailable'},404,cors);const profile=await env.DB.prepare('SELECT pix_key,full_name FROM rato_snack_pix_profiles WHERE user_id=?').bind(id).first();const stored=String(profile?.pix_key||'');const key=await decryptPix(stored,env),fullName=cleanFullName(profile?.full_name);if(key.length<3)return out({ok:false,error:'pix_key_required'},409,cors);if(fullName.length<3)return out({ok:false,error:'full_name_required'},409,cors);const now=new Date().toISOString();await env.DB.prepare('INSERT INTO rato_snack_event_registrations (id,event_id,user_id,nickname_snapshot,full_name_snapshot,pix_key_snapshot,consent_at,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(event_id,user_id) DO NOTHING').bind(crypto.randomUUID(),eventId,id,a.nickname,fullName,stored,now,now).run();const reg=await env.DB.prepare('SELECT consent_at,full_name_snapshot FROM rato_snack_event_registrations WHERE event_id=? AND user_id=?').bind(eventId,id).first();await env.DB.prepare("INSERT INTO rato_snack_live_event_audit (id,event_id,action,actor_user_id,actor_nickname,target_user_id,target_nickname,details_json,created_at) VALUES (?,?, 'pix_registration',?,?,?,?,?,?)").bind(crypto.randomUUID(),eventId,id,a.nickname,id,a.nickname,JSON.stringify({consent_at:reg?.consent_at||now,full_name_snapshot:reg?.full_name_snapshot||fullName}),now).run();return out({ok:true,registered:true,consent_at:reg?.consent_at||now},200,cors)
  }
  if(p==='/api/rato-snack/events'&&request.method==='POST'){
   const access=await eventStaff();if(!access)return out({ok:false,error:'staff_only'},403,cors);
   const b=await body(request);const action=String(b?.action||'create'),roomId=String(b?.room_id||'').trim().slice(0,100);const roles=Array.isArray(access.roles)?access.roles:[];
   if(action==='confirm_paid'){
    const eventId=String(b?.event_id||'');if(!eventId)return out({ok:false,error:'event_required'},400,cors);const ev=await env.DB.prepare("SELECT id,event_type,status,payment_status,prize_cents,winner_user_id,winner_nickname FROM rato_snack_live_events WHERE id=?").bind(eventId).first();if(!ev||ev.event_type!=='pix'||ev.status!=='won')return out({ok:false,error:'pix_winner_not_found'},404,cors);if(ev.payment_status==='paid')return out({ok:false,error:'already_paid'},409,cors);const now=new Date().toISOString();const upd=await env.DB.prepare("UPDATE rato_snack_live_events SET payment_status='paid',paid_by=?,paid_by_nickname=?,paid_at=? WHERE id=? AND event_type='pix' AND status='won' AND payment_status='pending'").bind(a.id,a.nickname,now,eventId).run();if(!upd.meta?.changes)return out({ok:false,error:'payment_state_conflict'},409,cors);await env.DB.prepare("INSERT INTO rato_snack_live_event_audit (id,event_id,action,actor_user_id,actor_nickname,target_user_id,target_nickname,details_json,created_at) VALUES (?,?, 'pix_payment_confirmed',?,?,?,?,?,?)").bind(crypto.randomUUID(),eventId,a.id,a.nickname,ev.winner_user_id,ev.winner_nickname,JSON.stringify({prize_cents:Number(ev.prize_cents)||0,confirmed_manually:true}),now).run();return out({ok:true,paid:true,paid_at:now,paid_by:a.nickname},200,cors)
   }
   if(action==='create'){
    if(!roomId)return out({ok:false,error:'room_required'},400,cors);const eventType=String(b?.event_type||'cheese')==='pix'?'pix':'cheese';const goal=Math.floor(Number(b.goal_value));const reward=eventType==='cheese'?Math.floor(Number(b.reward_amount)):1;const prizeCents=eventType==='pix'?Math.round(Number(b.prize_reais)*100):null;
    if(!Number.isSafeInteger(goal)||goal<1||goal>1000000000||(eventType==='cheese'&&(!Number.isSafeInteger(reward)||reward<1||reward>1000000000))||(eventType==='pix'&&(!Number.isSafeInteger(prizeCents)||prizeCents<1||prizeCents>1000000000)))return out({ok:false,error:'invalid_goal_or_reward'},400,cors);
    const active=await env.DB.prepare("SELECT id FROM rato_snack_live_events WHERE room_id=? AND status='active' LIMIT 1").bind(roomId).first();if(active)return out({ok:false,error:'event_already_active'},409,cors);const id=crypto.randomUUID(),now=new Date().toISOString();
    try{await env.DB.batch([env.DB.prepare("INSERT INTO rato_snack_live_events (id,room_id,status,goal_type,goal_value,reward_type,reward_amount,created_by,created_by_nickname,created_at,event_type,prize_cents,payment_status) VALUES (?,?,'active','score',?,?,?,?,?,?,?,?,?)").bind(id,roomId,goal,eventType==='pix'?'pix':'cheese',reward,a.id,a.nickname,now,eventType,prizeCents,eventType==='pix'?'pending':'not_applicable'),env.DB.prepare("INSERT INTO rato_snack_live_event_audit (id,event_id,action,actor_user_id,actor_nickname,details_json,created_at) VALUES (?,?, 'created',?,?,?,?)").bind(crypto.randomUUID(),id,a.id,a.nickname,JSON.stringify({room_id:roomId,event_type:eventType,goal_type:'score',goal_value:goal,reward_type:eventType==='pix'?'pix':'cheese',reward_amount:eventType==='pix'?prizeCents:reward,staff_roles:roles}),now)])}catch(e){return out({ok:false,error:'event_create_conflict'},409,cors)}return out({ok:true,event:{id,room_id:roomId,status:'active',goal_type:'score',goal_value:goal,reward_type:eventType==='pix'?'pix':'cheese',reward_amount:reward,event_type:eventType,prize_cents:prizeCents,payment_status:eventType==='pix'?'pending':'not_applicable',created_by_nickname:a.nickname,created_at:now}},201,cors)
   }
   if(action==='cancel'){
    if(!roomId)return out({ok:false,error:'room_required'},400,cors);const eventId=String(b.event_id||'');const now=new Date().toISOString();
    const upd=await env.DB.prepare("UPDATE rato_snack_live_events SET status='cancelled',cancelled_by=?,cancelled_at=? WHERE id=? AND room_id=? AND status='active'").bind(a.id,now,eventId,roomId).run();
    if(!upd.meta?.changes)return out({ok:false,error:'active_event_not_found'},404,cors);
    await env.DB.prepare("INSERT INTO rato_snack_live_event_audit (id,event_id,action,actor_user_id,actor_nickname,details_json,created_at) VALUES (?,?, 'cancelled',?,?,?,?)").bind(crypto.randomUUID(),eventId,a.id,a.nickname,JSON.stringify({room_id:roomId,staff_roles:roles}),now).run();
    return out({ok:true,cancelled:true},200,cors)
   }
   return out({ok:false,error:'invalid_action'},400,cors)
  }
  if(p==='/api/rato-snack/events/progress'&&request.method==='POST'){
   const b=await body(request),eventId=String(b?.event_id||''),roomId=String(b?.room_id||''),score=Math.floor(Number(b?.score));
   if(!eventId||!roomId||!Number.isSafeInteger(score)||score<0||score>1000000000)return out({ok:false,error:'invalid_progress'},400,cors);
   const ev=await env.DB.prepare("SELECT id,goal_value,reward_amount,reward_type,status,event_type,prize_cents FROM rato_snack_live_events WHERE id=? AND room_id=?").bind(eventId,roomId).first();
   if(!ev||ev.status!=='active')return out({ok:true,claimed:false,event_closed:true},200,cors);let pixRegistration=null;if(ev.event_type==='pix'){pixRegistration=await env.DB.prepare('SELECT pix_key_snapshot,nickname_snapshot FROM rato_snack_event_registrations WHERE event_id=? AND user_id=?').bind(eventId,a.id).first();if(!pixRegistration)return out({ok:false,error:'pix_registration_required'},403,cors)}
   if(score<Number(ev.goal_value))return out({ok:true,claimed:false,remaining:Number(ev.goal_value)-score},200,cors);
   const now=new Date().toISOString();
   const claim=await env.DB.prepare("UPDATE rato_snack_live_events SET status='won',winner_user_id=?,winner_nickname=?,winner_score=?,won_at=? WHERE id=? AND room_id=? AND status='active' AND ? >= goal_value").bind(a.id,a.nickname,score,now,eventId,roomId,score).run();
   if(!claim.meta?.changes)return out({ok:true,claimed:false,event_closed:true},200,cors);
   if(ev.event_type==='pix'){await env.DB.prepare("INSERT INTO rato_snack_live_event_audit (id,event_id,action,actor_user_id,actor_nickname,target_user_id,target_nickname,details_json,created_at) VALUES (?,?, 'pix_winner',?,?,?,?,?,?)").bind(crypto.randomUUID(),eventId,a.id,a.nickname,a.id,a.nickname,JSON.stringify({score,prize_cents:Number(ev.prize_cents)||0,pix_key:pixRegistration.pix_key_snapshot,nickname_snapshot:pixRegistration.nickname_snapshot,full_name_snapshot:pixRegistration.full_name_snapshot||'',room_id:roomId}),now).run();return out({ok:true,claimed:true,winner:true,pix:true,prize_cents:Number(ev.prize_cents)||0,payment_status:'pending'},200,cors)}
   const save=await env.DB.prepare("SELECT save_json FROM rato_snack_cloud_saves WHERE user_id=?").bind(a.id).first();
   const oldSave=save?.save_json||'{}';
   const oldEco=(()=>{try{return JSON.parse(oldSave).eco||{}}catch{return {}}})();
   const oldCheese=Math.max(0,Math.floor(Number(oldEco.cheese)||0));
   const updatedSave=JSON.stringify({eco:{...oldEco,cheese:oldCheese+Number(ev.reward_amount)}});
   await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO rato_snack_profiles (user_id) VALUES (?)").bind(a.id),
    env.DB.prepare("INSERT OR IGNORE INTO rato_snack_cloud_saves (user_id,save_json,updated_at) VALUES (?, ?, ?)").bind(a.id,JSON.stringify({stats:{},prog:{},eco:{cheese:0},bestQuick:0}),now),
    env.DB.prepare("UPDATE rato_snack_profiles SET coins=coins+?,updated_at=? WHERE user_id=? AND EXISTS(SELECT 1 FROM rato_snack_live_events WHERE id=? AND status='won' AND winner_user_id=?)").bind(ev.reward_amount,now,a.id,eventId,a.id),
    env.DB.prepare("UPDATE rato_snack_cloud_saves SET save_json=json_set(save_json,'$.eco.cheese',COALESCE(CAST(json_extract(save_json,'$.eco.cheese') AS INTEGER),0)+?),updated_at=? WHERE user_id=? AND EXISTS(SELECT 1 FROM rato_snack_live_events WHERE id=? AND status='won' AND winner_user_id=?)").bind(ev.reward_amount,now,a.id,eventId,a.id),
    env.DB.prepare("INSERT INTO rato_snack_live_event_audit (id,event_id,action,actor_user_id,actor_nickname,target_user_id,target_nickname,details_json,created_at) VALUES (?,?, 'winner_paid',?,?,?,?,?,?)").bind(crypto.randomUUID(),eventId,a.id,a.nickname,a.id,a.nickname,JSON.stringify({score,reward_type:ev.reward_type,reward_amount:ev.reward_amount,room_id:roomId}),now)
   ]);
   return out({ok:true,claimed:true,winner:true,reward:{type:ev.reward_type,amount:Number(ev.reward_amount)}},200,cors)
  }
  if(p==='/api/rato-snack/events/audit'&&request.method==='GET'){
   const access=await eventStaff();if(!access)return out({ok:false,error:'staff_only'},403,cors);
   const limit=Math.max(1,Math.min(100,Number(u.searchParams.get('limit'))||50));
   const rows=await env.DB.prepare("SELECT e.id,e.room_id,e.status,e.goal_type,e.goal_value,e.reward_type,e.reward_amount,e.event_type,e.prize_cents,e.payment_status,e.paid_by_nickname,e.paid_at,e.created_by_nickname,e.created_at,e.winner_user_id,e.winner_nickname,e.winner_score,e.won_at,e.cancelled_at FROM rato_snack_live_events e ORDER BY e.created_at DESC LIMIT ?").bind(limit).all();
   const logs=await env.DB.prepare("SELECT id,event_id,action,actor_user_id,actor_nickname,target_user_id,target_nickname,details_json,created_at FROM rato_snack_live_event_audit ORDER BY created_at DESC LIMIT ?").bind(limit*4).all();
   const registrations=await env.DB.prepare("SELECT r.event_id,r.user_id,g.public_id AS public_id,r.nickname_snapshot,r.full_name_snapshot,r.pix_key_snapshot,r.consent_at,r.created_at FROM rato_snack_event_registrations r JOIN game_users g ON g.id=r.user_id JOIN rato_snack_live_events e ON e.id=r.event_id WHERE e.event_type='pix' ORDER BY r.created_at DESC LIMIT ?").bind(limit*5).all();
   const safeRegs=await Promise.all((registrations.results||[]).map(async r=>({...r,pix_key_snapshot:await decryptPix(r.pix_key_snapshot,env)})));
   const safeLogs=await Promise.all((logs.results||[]).map(async row=>{let details={};try{details=JSON.parse(row.details_json||'{}')}catch{}if(details.pix_key)details.pix_key=await decryptPix(details.pix_key,env);return {...row,details_json:JSON.stringify(details)}}));
   return out({ok:true,events:rows.results||[],audit:safeLogs,pix_registrations:safeRegs},200,cors)
  }
 
 try{
  if(p==='/api/rato-snack/save'&&request.method==='GET'){
   const row=await env.DB.prepare('SELECT save_json,updated_at FROM rato_snack_cloud_saves WHERE user_id=?').bind(id).first();
   let save=null;if(row){try{save=JSON.parse(row.save_json)}catch(e){return out({ok:false,error:'saved_data_corrupt'},500,cors)}}
   return out({ok:true,save,updated_at:row?.updated_at||null},200,cors)
  }
  if(p==='/api/rato-snack/save'&&request.method==='POST'){
   const b=await body(request);
   if(!b||!b.save||typeof b.save!=='object'||Array.isArray(b.save))return out({ok:false,error:'invalid_save'},400,cors);
   const save={stats:b.save.stats&&typeof b.save.stats==='object'&&!Array.isArray(b.save.stats)?b.save.stats:{},prog:b.save.prog&&typeof b.save.prog==='object'&&!Array.isArray(b.save.prog)?b.save.prog:{},eco:b.save.eco&&typeof b.save.eco==='object'&&!Array.isArray(b.save.eco)?b.save.eco:{},bestQuick:Number.isFinite(Number(b.save.bestQuick))?Math.max(0,Math.min(1000000000,Math.floor(Number(b.save.bestQuick)))):0};
   await profile(env.DB,id);
   const old=await env.DB.prepare('SELECT save_json FROM rato_snack_cloud_saves WHERE user_id=?').bind(id).first();
   let oldBest=0;if(old?.save_json){try{oldBest=Number(JSON.parse(old.save_json).bestQuick)||0}catch(e){}}
   const oldProfile=await env.DB.prepare('SELECT best_score FROM rato_snack_profiles WHERE user_id=?').bind(id).first();
   const best=Math.min(1000000000,Math.floor(Math.max(save.bestQuick,oldBest,Number(oldProfile?.best_score)||0)));
   save.bestQuick=best;
   const json=JSON.stringify(save);if(json.length>150000)return out({ok:false,error:'save_too_large'},413,cors);
   const now=new Date().toISOString();
   await env.DB.prepare('INSERT INTO rato_snack_cloud_saves (user_id,save_json,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET save_json=excluded.save_json,updated_at=excluded.updated_at').bind(id,json,now).run();
   const xp=Math.max(0,Math.min(1000000000,Math.floor(Number(save.prog.xp)||0))),level=Math.max(1,Math.min(10000,Math.floor(Number(save.prog.lvlRw)||1))),coins=Math.max(0,Math.min(1000000000,Math.floor(Number(save.eco.cheese)||0))),games=Math.max(0,Math.min(1000000000,Math.floor(Number(save.stats.games)||0))),wins=Math.max(0,Math.min(1000000000,Math.floor(Number(save.stats.wins)||0)));
   await env.DB.prepare('UPDATE rato_snack_profiles SET level=?,xp=?,coins=?,best_score=MAX(best_score,?),updated_at=? WHERE user_id=?').bind(level,xp,coins,best,now,id).run();
   return out({ok:true,saved:true,best_score:best,updated_at:now},200,cors)
  }
  if(p==='/api/rato-snack/sync'&&request.method==='GET'){await profile(env.DB,id);const v=await env.DB.prepare('SELECT level,xp FROM rato_snack_profiles WHERE user_id=?').bind(id).first();const ach=await env.DB.prepare('SELECT achievement_code,progress,unlocked_at FROM rato_snack_achievements WHERE user_id=?').bind(id).all();const inv=await env.DB.prepare('SELECT item_code,quantity,equipped FROM rato_snack_inventory WHERE user_id=?').bind(id).all();return out({ok:true,profile:v,achievements:ach.results||[],inventory:inv.results||[]},200,cors)}
  if(p==='/api/rato-snack/sync'&&request.method==='POST')return out({ok:false,error:'server_authoritative_only'},409,cors);
  if(p==='/api/rato-snack/profile'&&request.method==='GET'){await profile(env.DB,id);const v=await env.DB.prepare('SELECT level,xp,coins,best_score,created_at,updated_at FROM rato_snack_profiles WHERE user_id=?').bind(id).first();const q=await env.DB.prepare("SELECT COUNT(*) AS games_played,COALESCE(SUM(score),0) AS total_score,COALESCE(SUM(CAST(json_extract(details_json,'$.kills') AS INTEGER)),0) AS kills,COALESCE(SUM(CAST(json_extract(details_json,'$.food') AS INTEGER)),0) AS food,COALESCE(SUM(duration_ms),0) AS total_time_ms,COALESCE(MAX(CAST(json_extract(details_json,'$.max_size') AS INTEGER)),0) AS max_size,COALESCE(MAX(score),0) AS best_online_score,COALESCE(SUM(CASE WHEN json_extract(details_json,'$.outcome')='win' THEN 1 ELSE 0 END),0) AS wins FROM rato_snack_records WHERE user_id=? AND mode='online'").bind(id).first();const onlineStats=Object.fromEntries(Object.entries(q||{}).map(([k,val])=>[k,Number(val)||0]));const profileData={...v,games_played:onlineStats.games_played,wins:onlineStats.wins};return out({ok:true,profile:profileData,online_stats:onlineStats,identity:{nickname:a.nickname,public_id:a.public_id}},200,cors)}
  if(p==='/api/rato-snack/records'&&request.method==='GET'){const n=Math.max(1,Math.min(50,parseInt(u.searchParams.get('limit')||'20',10)||20));const v=await env.DB.prepare("SELECT id,mode,score,duration_ms,details_json,created_at FROM rato_snack_records WHERE user_id=? AND mode='online' ORDER BY id DESC LIMIT ?").bind(id,String(n)).all();return out({ok:true,records:v.results||[]},200,cors)}
  if(p==='/api/rato-snack/records'&&request.method==='POST'){const b=await body(request);const matchId=String(b?.match_id||'').trim();const mode=String(b?.mode||'');const allowed=new Set(['quick','survival','challenge','team','boss','infinite','daily','mundial','treino']);const score=Number(b?.score),duration=Number(b?.duration_ms);if(!/^[A-Za-z0-9_-]{16,80}$/.test(matchId)||!allowed.has(mode)||!Number.isFinite(score)||score<0||score>1000000000||!Number.isFinite(duration)||duration<5000||duration>86400000)return out({ok:false,error:'invalid_record'},400,cors);const kills=Math.max(0,Math.min(1000000,Math.floor(Number(b.kills)||0))),food=Math.max(0,Math.min(1000000,Math.floor(Number(b.food)||0))),maxSize=Math.max(1,Math.min(1000000,Math.floor(Number(b.max_size)||1))),outcome=['dead','time','win'].includes(b.outcome)?b.outcome:'dead',now=new Date().toISOString(),points=Math.floor(score),details=JSON.stringify({outcome,kills,food,max_size:maxSize,source:'authenticated-online'});await profile(env.DB,id);const ins=await env.DB.prepare("INSERT OR IGNORE INTO rato_snack_records (user_id,mode,score,duration_ms,details_json,created_at,match_id) VALUES (?,'online',?,?,?,?,?)").bind(id,mode,points,Math.floor(duration),details,now,matchId).run();if(!ins.meta?.changes)return out({ok:true,saved:false,duplicate:true},200,cors);const counts=await env.DB.prepare("SELECT COUNT(*) AS games_played,COALESCE(SUM(CASE WHEN json_extract(details_json,'$.outcome')='win' THEN 1 ELSE 0 END),0) AS wins FROM rato_snack_records WHERE user_id=? AND mode='online'").bind(id).first();await env.DB.prepare('UPDATE rato_snack_profiles SET games_played=?,wins=?,updated_at=? WHERE user_id=?').bind(Number(counts.games_played)||0,Number(counts.wins)||0,now,id).run();await refreshMonthlyRanking(env.DB,new Date(now));return out({ok:true,saved:true,score:points,updated_at:now},200,cors)}
  if(p==='/api/rato-snack/achievements'&&request.method==='GET'){const v=await env.DB.prepare('SELECT achievement_code,progress,unlocked_at,updated_at FROM rato_snack_achievements WHERE user_id=? ORDER BY achievement_code').bind(id).all();return out({ok:true,achievements:v.results||[]},200,cors)}
  if(p==='/api/rato-snack/achievements'&&request.method==='POST')return out({ok:false,error:'server_authoritative_only'},409,cors);
  if(p==='/api/rato-snack/inventory'&&request.method==='GET'){const v=await env.DB.prepare('SELECT item_code,quantity,equipped,acquired_at,updated_at FROM rato_snack_inventory WHERE user_id=? ORDER BY item_code').bind(id).all();return out({ok:true,inventory:v.results||[]},200,cors)}
  if(p==='/api/rato-snack/inventory/equip'&&request.method==='POST'){const b=await body(request),code=typeof b?.item_code==='string'?b.item_code.trim():'';if(!/^[a-zA-Z0-9_.:-]{1,64}$/.test(code))return out({ok:false,error:'invalid_item_code'},400,cors);const owned=await env.DB.prepare('SELECT quantity FROM rato_snack_inventory WHERE user_id=? AND item_code=?').bind(id,code).first();if(!owned||Number(owned.quantity)<1)return out({ok:false,error:'item_not_owned'},409,cors);const now=new Date().toISOString();await env.DB.batch([env.DB.prepare('UPDATE rato_snack_inventory SET equipped=0,updated_at=? WHERE user_id=?').bind(now,id),env.DB.prepare('UPDATE rato_snack_inventory SET equipped=1,updated_at=? WHERE user_id=? AND item_code=?').bind(now,id,code)]);return out({ok:true,equipped:code},200,cors)}
  return out({ok:false,error:'not_found'},404,cors)
 }catch(e){return out({ok:false,error:'internal_error'},500,cors)}
}};