const VERSION = "rativapolis-api-dev-v3-server-phase-tickets";
const ORIGINS = new Set(["https://vt12gt.github.io","https://ratopolis-cadastro-teste.pages.dev","http://localhost:8158","http://localhost:8787"]);
const json = (data,status=200,headers={}) => new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...headers}});
const bearer = request => { const m=(request.headers.get("Authorization")||"").match(/^Bearer\s+(\S+)$/i); return m?m[1]:""; };
async function sha256(value){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));let b="";for(const x of new Uint8Array(d))b+=String.fromCharCode(x);return btoa(b).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
async function portalActor(request,env){
 const token=bearer(request);if(token.length<20||!env.PORTAL_DB)return null;
 return env.PORTAL_DB.prepare("SELECT u.id,u.nickname,u.email,u.role,u.status FROM ratopolis_sessions s JOIN ratopolis_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active' LIMIT 1").bind(await sha256(token),new Date().toISOString()).first();
}
async function gameActor(request,env){
 const portal=await portalActor(request,env);if(!portal)return null;
 const game=await env.POLIS_DB.prepare("SELECT id,public_id,nickname,status FROM game_users WHERE portal_user_id=? LIMIT 1").bind(portal.id).first();
 if(!game||game.status!=="active")return null;
 if(game.nickname!==portal.nickname)await env.POLIS_DB.prepare("UPDATE game_users SET nickname=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(portal.nickname,game.id).run();
 await env.POLIS_DB.prepare("INSERT OR IGNORE INTO ratopolis_profiles (user_id) VALUES (?)").bind(game.id).run();
 return {id:game.id,public_id:game.public_id,nickname:portal.nickname,role:portal.role,portal_user_id:portal.id};
}
function cors(origin){const h={};if(origin&&ORIGINS.has(origin)){h["Access-Control-Allow-Origin"]=origin;h["Access-Control-Allow-Methods"]="GET, POST, OPTIONS";h["Access-Control-Allow-Headers"]="Authorization, Content-Type";h["Access-Control-Max-Age"]="86400";h.Vary="Origin";}return h;}
export default {async fetch(request,env){
 const origin=request.headers.get("Origin")||"",headers=cors(origin);
 if(origin&&!ORIGINS.has(origin))return json({ok:false,error:"origin_not_allowed"},403,headers);
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(!env.PORTAL_DB||!env.POLIS_DB)return json({ok:false,error:"database_binding_missing"},503,headers);
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,"")||"/";
 if(request.method==="GET"&&["/","/health","/api/rativapolis/health"].includes(path)){
  try{const [portal,polis,profiles]=await Promise.all([env.PORTAL_DB.prepare("SELECT COUNT(*) AS total FROM ratopolis_users").first(),env.POLIS_DB.prepare("SELECT COUNT(*) AS total FROM game_users").first(),env.POLIS_DB.prepare("SELECT COUNT(*) AS total FROM ratopolis_profiles").first()]);return json({ok:true,service:"rativapolis-api",version:VERSION,environment:"development",identity:"rativa-games-portal",databases:{portal_users:Number(portal?.total||0),polis_users:Number(polis?.total||0),polis_profiles:Number(profiles?.total||0)}},200,headers);}catch{return json({ok:false,error:"database_check_failed"},503,headers);}
 }
 
 if(request.method==="POST"&&["/api/progression/phase/start","/api/rativapolis/progression/phase/start"].includes(path)){
  const actor=await gameActor(request,env);
  if(!actor)return json({ok:false,erro:"Entre na sua conta para iniciar uma fase sincronizada."},401,headers);
  let body;try{body=await request.json();}catch{return json({ok:false,erro:"JSON invalido."},400,headers);}
  const phase=body?.phase;
  if(!Number.isSafeInteger(phase)||phase<1||phase>12)return json({ok:false,erro:"Fase invalida."},400,headers);
  const now=Date.now(),issuedAt=new Date(now).toISOString(),expiresAt=new Date(now+45*60*1000).toISOString();
  try{
   const recent=await env.POLIS_DB.prepare("SELECT COUNT(*) AS total FROM ratopolis_phase_sessions WHERE user_id=? AND issued_at>=?").bind(actor.id,new Date(now-60*60*1000).toISOString()).first();
   if(Number(recent?.total||0)>=30)return json({ok:false,erro:"Muitas sessoes de fase iniciadas. Tente novamente mais tarde."},429,headers);
   const ticketId=crypto.randomUUID();
   await env.POLIS_DB.prepare("INSERT INTO ratopolis_phase_sessions (ticket_id,user_id,phase,issued_at,expires_at) VALUES (?,?,?,?,?)").bind(ticketId,actor.id,phase,issuedAt,expiresAt).run();
   return json({ok:true,ticket_id:ticketId,phase,issued_at:issuedAt,expires_at:expiresAt},201,headers);
  }catch{return json({ok:false,erro:"Nao foi possivel iniciar a sessao da fase."},503,headers);}
 }
 if(request.method==="POST"&&["/api/progression/reward","/api/rativapolis/progression/reward"].includes(path)){
  const actor=await gameActor(request,env);
  if(!actor)return json({ok:false,erro:"Entre na sua conta para salvar o progresso."},401,headers);
  let body;try{body=await request.json();}catch{return json({ok:false,erro:"JSON invalido."},400,headers);}
  const eventId=typeof body?.event_id==="string"?body.event_id.trim():"";
  const ticketId=typeof body?.ticket_id==="string"?body.ticket_id.trim():"";
  const {phase,cheeses,acorns,lives}=body||{};
  if(!eventId||eventId.length>128||!/^[a-zA-Z0-9._:-]+$/.test(eventId))return json({ok:false,erro:"event_id invalido."},400,headers);
  if(!ticketId||ticketId.length>80||!/^[a-zA-Z0-9-]+$/.test(ticketId))return json({ok:false,erro:"Sessao de fase ausente ou invalida."},400,headers);
  if(!Number.isSafeInteger(phase)||phase<1||phase>12||!Number.isSafeInteger(cheeses)||cheeses<0||cheeses>4||!Number.isSafeInteger(acorns)||acorns<0||acorns>12||!Number.isSafeInteger(lives)||lives<0||lives>3)return json({ok:false,erro:"Dados da fase fora dos limites permitidos."},400,headers);
  const xpAwarded=22+cheeses*5+acorns*8+lives*3;
  const coinsAwarded=10+cheeses*2+acorns*3+lives*2;
  const now=new Date(),createdAt=now.toISOString(),dayStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())).toISOString();
  try{
   const existing=await env.POLIS_DB.prepare("SELECT event_id,user_id,event_type FROM ratopolis_reward_events WHERE event_id=? LIMIT 1").bind(eventId).first();
   if(existing){
    if(existing.user_id!==actor.id||existing.event_type!=="phase_complete")return json({ok:false,erro:"event_id ja utilizado."},409,headers);
    const p=await env.POLIS_DB.prepare("SELECT level,xp,vip_level,coins FROM ratopolis_profiles WHERE user_id=?").bind(actor.id).first();
    return json({ok:true,duplicado:true,progresso:p},200,headers);
   }
   const ticket=await env.POLIS_DB.prepare("SELECT ticket_id,user_id,phase,issued_at,expires_at,consumed_at FROM ratopolis_phase_sessions WHERE ticket_id=? LIMIT 1").bind(ticketId).first();
   if(!ticket||ticket.user_id!==actor.id||Number(ticket.phase)!==phase)return json({ok:false,erro:"Sessao de fase nao pertence a esta conta ou fase."},403,headers);
   if(ticket.consumed_at)return json({ok:false,erro:"Sessao de fase ja utilizada."},409,headers);
   const issued=Date.parse(ticket.issued_at),expires=Date.parse(ticket.expires_at),elapsed=now.getTime()-issued;
   if(!Number.isFinite(issued)||!Number.isFinite(expires)||now.getTime()>expires)return json({ok:false,erro:"Sessao de fase expirada. Inicie a fase novamente."},410,headers);
   if(elapsed<8000)return json({ok:false,erro:"Tempo minimo de fase nao atingido."},422,headers);
   const batch=await env.POLIS_DB.batch([
    env.POLIS_DB.prepare("UPDATE ratopolis_phase_sessions SET consumed_at=? WHERE ticket_id=? AND user_id=? AND phase=? AND consumed_at IS NULL AND issued_at<=? AND expires_at>?").bind(createdAt,ticketId,actor.id,phase,new Date(now.getTime()-8000).toISOString(),createdAt),
    env.POLIS_DB.prepare("INSERT OR IGNORE INTO ratopolis_reward_events (event_id,user_id,event_type,xp_awarded,coins_awarded,created_at) SELECT ?,?,'phase_complete',?,?,? WHERE changes()>0 AND (SELECT COUNT(*) FROM ratopolis_reward_events WHERE user_id=? AND event_type='phase_complete' AND created_at>=?) < 10").bind(eventId,actor.id,xpAwarded,coinsAwarded,createdAt,actor.id,dayStart),
    env.POLIS_DB.prepare("UPDATE ratopolis_profiles SET xp=xp+?,coins=coins+?,level=MAX(level,MIN(50,CAST((xp+?)/100 AS INTEGER)+1)) WHERE user_id=? AND changes()>0").bind(xpAwarded,coinsAwarded,xpAwarded,actor.id),
    env.POLIS_DB.prepare("INSERT INTO game_audit_logs (id,actor_user_id,action,target_user_id,details_json,created_at) SELECT ?,?,'game_phase_reward',?,?,? WHERE changes()>0").bind(crypto.randomUUID(),actor.id,actor.id,JSON.stringify({event_id:eventId,phase,ticket_id:ticketId,cheeses,acorns,lives,xp_awarded:xpAwarded,coins_awarded:coinsAwarded,elapsed_ms:elapsed}),createdAt)
   ]);
   const consumed=Number(batch?.[0]?.meta?.changes||0)>0,inserted=Number(batch?.[1]?.meta?.changes||0)>0;
   if(!consumed)return json({ok:false,erro:"Sessao de fase ja utilizada ou invalida."},409,headers);
   if(!inserted){
    const daily=await env.POLIS_DB.prepare("SELECT COUNT(*) AS total FROM ratopolis_reward_events WHERE user_id=? AND event_type='phase_complete' AND created_at>=?").bind(actor.id,dayStart).first();
    if(Number(daily?.total||0)>=10)return json({ok:false,erro:"Limite diario de recompensas de fase atingido. Tente novamente amanha."},429,headers);
    return json({ok:false,erro:"Recompensa nao processada. A sessao foi encerrada; inicie a fase novamente."},503,headers);
   }
   const p=await env.POLIS_DB.prepare("SELECT level,xp,vip_level,coins FROM ratopolis_profiles WHERE user_id=?").bind(actor.id).first();
   return json({ok:true,duplicado:false,recompensa:{xp:xpAwarded,coins:coinsAwarded},progresso:p},201,headers);
  }catch{return json({ok:false,erro:"Falha ao salvar recompensa."},503,headers);}
 }
 
 if(request.method!=="GET")return json({ok:false,error:"method_not_allowed"},405,headers);
 if(path==="/api/rativapolis/rankings"||path==="/api/rativapolis/rankings/level"||path==="/api/rankings"||path==="/api/rankings/level"){
  try{
   const page=Math.max(1,Math.min(10000,Number.parseInt(url.searchParams.get("page")||"1",10)||1));
   const limit=Math.max(1,Math.min(100,Number.parseInt(url.searchParams.get("limit")||"20",10)||20));
   const offset=(page-1)*limit;
   const totalRow=await env.POLIS_DB.prepare("SELECT COUNT(*) AS total FROM game_users u JOIN ratopolis_profiles p ON p.user_id=u.id WHERE u.status='active'").first();
   const isLegacyGeneral=path==="/api/rankings";
   const orderBy=isLegacyGeneral?"p.xp DESC,p.level DESC,u.nickname COLLATE NOCASE ASC":"p.level DESC,p.xp DESC,u.nickname COLLATE NOCASE ASC";
   const rows=await env.POLIS_DB.prepare("SELECT u.id,u.public_id,u.nickname,p.level,p.xp FROM game_users u JOIN ratopolis_profiles p ON p.user_id=u.id WHERE u.status='active' ORDER BY "+orderBy+" LIMIT ? OFFSET ?").bind(limit,offset).all();
   const total=Number(totalRow?.total||0),players=(rows.results||[]).map((x,i)=>({posicao:offset+i+1,id:x.public_id,nickname:x.nickname,level:Number(x.level),xp:Number(x.xp)}));
   return json({ok:true,ranking:isLegacyGeneral?"geral":"nivel",pagina:page,limite:limit,total,total_paginas:Math.ceil(total/limit),jogadores:players},200,headers);
  }catch{return json({ok:false,error:"ranking_unavailable"},503,headers);}
 }
 if(!path.startsWith("/api/rativapolis/")&&!["/api/profile","/api/progression/me"].includes(path))return json({ok:false,error:"not_found"},404,headers);
 const actor=await gameActor(request,env);if(!actor)return json({ok:false,error:"portal_authentication_required"},401,headers);
 try{
  if(path==="/api/rativapolis/profile"||path==="/api/rativapolis/profile/personal"||path==="/api/rativapolis/me"||path==="/api/profile"){
   const p=await env.POLIS_DB.prepare("SELECT level,xp,vip_level,coins FROM ratopolis_profiles WHERE user_id=?").bind(actor.id).first();
   return json({ok:true,jogador:{id:actor.public_id,public_id:actor.public_id,nickname:actor.nickname,email:actor.email||"",role:actor.role,status:"active",level:Number(p?.level??1),xp:Number(p?.xp??0),vip_level:Number(p?.vip_level??0),coins:Number(p?.coins??0)}},200,headers);
  }
  if(path==="/api/rativapolis/progression/me"||path==="/api/progression/me"){
   const p=await env.POLIS_DB.prepare("SELECT level,xp,vip_level,coins FROM ratopolis_profiles WHERE user_id=?").bind(actor.id).first();
   const level=Math.max(1,Math.min(50,Number(p?.level)||1)),xp=Math.max(0,Number(p?.xp)||0),next=level>=50?null:level*100;
   return json({ok:true,progresso:{level,xp,vip_level:Number(p?.vip_level||0),coins:Number(p?.coins||0),max_level:50,xp_proximo_nivel:next,xp_restante:next===null?0:Math.max(0,next-xp)}},200,headers);
  }
  if(path==="/api/rativapolis/players"){
   const rows=await env.POLIS_DB.prepare("SELECT u.public_id,u.nickname,p.level,p.xp FROM game_users u JOIN ratopolis_profiles p ON p.user_id=u.id WHERE u.status='active' ORDER BY u.nickname COLLATE NOCASE LIMIT 100").all();
   return json({ok:true,jogadores:(rows.results||[]).map(x=>({id:x.public_id,nickname:x.nickname,level:Number(x.level),xp:Number(x.xp)}))},200,headers);
  }
  return json({ok:false,error:"not_found"},404,headers);
 }catch{return json({ok:false,error:"polis_query_failed"},503,headers);}
}};
