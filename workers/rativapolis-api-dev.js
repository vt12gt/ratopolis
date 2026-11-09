const VERSION = "rativapolis-api-dev-v1-central-identity-read";
const ORIGINS = new Set(["https://vt12gt.github.io","https://ratopolis-cadastro-teste.pages.dev","http://localhost:8158","http://localhost:8787"]);
const json = (data,status=200,headers={}) => new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...headers}});
const bearer = request => { const m=(request.headers.get("Authorization")||"").match(/^Bearer\s+(\S+)$/i); return m?m[1]:""; };
async function sha256(value){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));let b="";for(const x of new Uint8Array(d))b+=String.fromCharCode(x);return btoa(b).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
async function portalActor(request,env){
 const token=bearer(request);if(token.length<20||!env.PORTAL_DB)return null;
 return env.PORTAL_DB.prepare("SELECT u.id,u.nickname,u.role,u.status FROM ratopolis_sessions s JOIN ratopolis_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active' LIMIT 1").bind(await sha256(token),new Date().toISOString()).first();
}
async function gameActor(request,env){
 const portal=await portalActor(request,env);if(!portal)return null;
 const game=await env.POLIS_DB.prepare("SELECT id,public_id,nickname,status FROM game_users WHERE portal_user_id=? LIMIT 1").bind(portal.id).first();
 if(!game||game.status!=="active")return null;
 if(game.nickname!==portal.nickname)await env.POLIS_DB.prepare("UPDATE game_users SET nickname=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(portal.nickname,game.id).run();
 await env.POLIS_DB.prepare("INSERT OR IGNORE INTO ratopolis_profiles (user_id) VALUES (?)").bind(game.id).run();
 return {id:game.id,public_id:game.public_id,nickname:portal.nickname,role:portal.role,portal_user_id:portal.id};
}
function cors(origin){const h={};if(origin&&ORIGINS.has(origin)){h["Access-Control-Allow-Origin"]=origin;h["Access-Control-Allow-Methods"]="GET, OPTIONS";h["Access-Control-Allow-Headers"]="Authorization, Content-Type";h["Access-Control-Max-Age"]="86400";h.Vary="Origin";}return h;}
export default {async fetch(request,env){
 const origin=request.headers.get("Origin")||"",headers=cors(origin);
 if(origin&&!ORIGINS.has(origin))return json({ok:false,error:"origin_not_allowed"},403,headers);
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(!env.PORTAL_DB||!env.POLIS_DB)return json({ok:false,error:"database_binding_missing"},503,headers);
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,"")||"/";
 if(request.method==="GET"&&["/","/health","/api/rativapolis/health"].includes(path)){
  try{const [portal,polis]=await Promise.all([env.PORTAL_DB.prepare("SELECT COUNT(*) AS total FROM ratopolis_users").first(),env.POLIS_DB.prepare("SELECT COUNT(*) AS total FROM game_users").first(),env.POLIS_DB.prepare("SELECT COUNT(*) AS total FROM ratopolis_profiles").first()]);return json({ok:true,service:"rativapolis-api",version:VERSION,environment:"development",identity:"rativa-games-portal",databases:{portal_users:Number(portal?.total||0),polis_users:Number(polis?.total||0),polis_profiles:Number(polis?.total||0)}},200,headers);}catch{return json({ok:false,error:"database_check_failed"},503,headers);}
 }
 if(request.method!=="GET")return json({ok:false,error:"method_not_allowed"},405,headers);
 if(path==="/api/rativapolis/rankings"||path==="/api/rativapolis/rankings/level"){
  try{
   const page=Math.max(1,Math.min(10000,Number.parseInt(url.searchParams.get("page")||"1",10)||1));
   const limit=Math.max(1,Math.min(100,Number.parseInt(url.searchParams.get("limit")||"20",10)||20));
   const offset=(page-1)*limit;
   const totalRow=await env.POLIS_DB.prepare("SELECT COUNT(*) AS total FROM game_users u JOIN ratopolis_profiles p ON p.user_id=u.id WHERE u.status='active'").first();
   const rows=await env.POLIS_DB.prepare("SELECT u.id,u.public_id,u.nickname,p.level,p.xp FROM game_users u JOIN ratopolis_profiles p ON p.user_id=u.id WHERE u.status='active' ORDER BY p.level DESC,p.xp DESC,u.nickname COLLATE NOCASE ASC LIMIT ? OFFSET ?").bind(limit,offset).all();
   const total=Number(totalRow?.total||0),players=(rows.results||[]).map((x,i)=>({posicao:offset+i+1,id:x.public_id,nickname:x.nickname,level:Number(x.level),xp:Number(x.xp)}));
   return json({ok:true,ranking:"level",pagina:page,limite:limit,total,total_paginas:Math.ceil(total/limit),jogadores:players},200,headers);
  }catch{return json({ok:false,error:"ranking_unavailable"},503,headers);}
 }
 if(!path.startsWith("/api/rativapolis/"))return json({ok:false,error:"not_found"},404,headers);
 const actor=await gameActor(request,env);if(!actor)return json({ok:false,error:"portal_authentication_required"},401,headers);
 try{
  if(path==="/api/rativapolis/profile"||path==="/api/rativapolis/profile/personal"||path==="/api/rativapolis/me"){
   const p=await env.POLIS_DB.prepare("SELECT level,xp,vip_level,coins FROM ratopolis_profiles WHERE user_id=?").bind(actor.id).first();
   return json({ok:true,jogador:{id:actor.public_id,public_id:actor.public_id,nickname:actor.nickname,role:actor.role,level:Number(p?.level??1),xp:Number(p?.xp??0),vip_level:Number(p?.vip_level??0),coins:Number(p?.coins??0)}},200,headers);
  }
  if(path==="/api/rativapolis/progression/me"){
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
