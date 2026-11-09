const VERSION="rativapolis-guilds-api-v1";
const ORIGINS=new Set(["https://vt12gt.github.io","http://localhost:8158","http://localhost:8787"]);
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...headers}});
const bearer=r=>{const m=(r.headers.get("Authorization")||"").match(/^Bearer\s+(\S+)$/i);return m?m[1]:"";};
async function sha256(v){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));let b="";for(const x of new Uint8Array(d))b+=String.fromCharCode(x);return btoa(b).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
async function actor(request,env){
 const token=bearer(request);if(token.length<20)return null;
 const p=await env.PORTAL_DB.prepare("SELECT u.id,u.nickname,u.email,u.role,u.status FROM ratopolis_sessions s JOIN ratopolis_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active' LIMIT 1").bind(await sha256(token),new Date().toISOString()).first();
 if(!p)return null;
 let g=await env.POLIS_DB.prepare("SELECT id,public_id,nickname,status FROM game_users WHERE portal_user_id=? LIMIT 1").bind(p.id).first();
 if(!g)return null;
 if(g.status!=="active")return null;
 if(g.nickname!==p.nickname)await env.POLIS_DB.prepare("UPDATE game_users SET nickname=?,updated_at=? WHERE id=?").bind(p.nickname,new Date().toISOString(),g.id).run();
 await env.POLIS_DB.prepare("INSERT OR IGNORE INTO ratopolis_profiles(user_id) VALUES(?)").bind(g.id).run();
 return {id:g.id,public_id:g.public_id,nickname:p.nickname,role:p.role,email:p.email||null};
}
const now=()=>new Date().toISOString();
const uuid=()=>crypto.randomUUID();
const roles=["leader","vice","general","officer","veteran","member","recruit"];
const managers=["leader","vice","general","officer"];
async function member(db,user){return db.prepare("SELECT m.*,g.name,g.tag,g.emblem,g.status AS guild_status FROM rativapolis_guild_members m JOIN rativapolis_guilds g ON g.id=m.guild_id WHERE m.user_id=? AND g.status='active' LIMIT 1").bind(user).first();}
async function audit(db,guild,actor,target,action,details={}){await db.prepare("INSERT INTO rativapolis_guild_audit_logs(id,guild_id,actor_user_id,target_user_id,action,details_json,created_at) VALUES(?,?,?,?,?,?,?)").bind(uuid(),guild,actor,target||null,action,JSON.stringify(details),now()).run();}
async function body(r){try{return await r.json();}catch{return null;}}
async function getMe(env,a){
 const m=await member(env.POLIS_DB,a.id);
 const [inv,profile]=await Promise.all([
  env.POLIS_DB.prepare("SELECT i.id,i.expires_at,g.name,g.tag,g.emblem,u.nickname AS inviter FROM rativapolis_guild_invites i JOIN rativapolis_guilds g ON g.id=i.guild_id JOIN game_users u ON u.id=i.inviter_user_id WHERE i.invitee_user_id=? AND i.status='pending' AND i.expires_at>? ORDER BY i.created_at DESC").bind(a.id,now()).all(),
  env.POLIS_DB.prepare("SELECT coins FROM ratopolis_profiles WHERE user_id=?").bind(a.id).first()
 ]);
 const result={ok:true,member:!!m,coins:Number(profile?.coins||0),invites:inv.results||[],guild:null,members:[],applications:[],missions:[],transactions:[],donors:[],shop:[],purchases:[],achievements:[],audit:[],donation_cp_remaining_today:100};
 if(!m)return result;
 const gid=m.guild_id,day=new Date().toISOString().slice(0,10);
 const [g,ms,apps,missions,tx,donors,shop,purchases,ach,aud,cp]=await Promise.all([
  env.POLIS_DB.prepare("SELECT * FROM rativapolis_guilds WHERE id=?").bind(gid).first(),
  env.POLIS_DB.prepare("SELECT u.public_id,u.nickname,u.id,p.level,m.role,m.contribution_total,m.contribution_points FROM rativapolis_guild_members m JOIN game_users u ON u.id=m.user_id LEFT JOIN ratopolis_profiles p ON p.user_id=u.id WHERE m.guild_id=? ORDER BY CASE m.role WHEN 'leader' THEN 0 WHEN 'vice' THEN 1 ELSE 2 END,m.joined_at").bind(gid).all(),
  env.POLIS_DB.prepare("SELECT x.id,x.created_at,u.nickname,u.public_id FROM rativapolis_guild_applications x JOIN game_users u ON u.id=x.user_id WHERE x.guild_id=? AND x.status='pending' ORDER BY x.created_at").bind(gid).all(),
  env.POLIS_DB.prepare("SELECT * FROM rativapolis_guild_missions WHERE guild_id=? AND status IN ('active','completed') ORDER BY created_at DESC").bind(gid).all(),
  env.POLIS_DB.prepare("SELECT t.*,u.nickname FROM rativapolis_guild_transactions t JOIN game_users u ON u.id=t.user_id WHERE t.guild_id=? ORDER BY t.created_at DESC LIMIT 100").bind(gid).all(),
  env.POLIS_DB.prepare("SELECT u.nickname,m.contribution_total,m.contribution_points FROM rativapolis_guild_members m JOIN game_users u ON u.id=m.user_id WHERE m.guild_id=? ORDER BY m.contribution_points DESC,m.contribution_total DESC LIMIT 20").bind(gid).all(),
  env.POLIS_DB.prepare("SELECT * FROM rativapolis_guild_shop_catalog WHERE active=1 ORDER BY min_level,price_cheese").all(),
  env.POLIS_DB.prepare("SELECT p.price_total,p.created_at,c.name FROM rativapolis_guild_shop_purchases p JOIN rativapolis_guild_shop_catalog c ON c.item_code=p.item_code WHERE p.guild_id=? ORDER BY p.created_at DESC").bind(gid).all(),
  env.POLIS_DB.prepare("SELECT * FROM rativapolis_guild_achievements WHERE guild_id=? ORDER BY unlocked_at DESC").bind(gid).all(),
  env.POLIS_DB.prepare("SELECT l.*,u.nickname AS actor,t.nickname AS target FROM rativapolis_guild_audit_logs l JOIN game_users u ON u.id=l.actor_user_id LEFT JOIN game_users t ON t.id=l.target_user_id WHERE l.guild_id=? ORDER BY l.created_at DESC LIMIT 30").bind(gid).all(),
  env.POLIS_DB.prepare("SELECT COALESCE(SUM(points),0) AS points FROM rativapolis_guild_cp_events WHERE guild_id=? AND user_id=? AND source='donation' AND substr(created_at,1,10)=?").bind(gid,a.id,day).first()
 ]);
 const mine=(ms.results||[]).find(x=>x.id===a.id);
 result.guild={...g,members:(ms.results||[]).length,my_role:m.role,my_contribution_points:Number(m.contribution_points||0),level:Number(g.level),xp:Number(g.xp),bank_cheese:Number(g.bank_cheese),member_limit:Number(g.member_limit),total_donations:Number(g.total_donations)};
 result.members=(ms.results||[]).map(x=>({...x,level:Number(x.level||1),contribution_total:Number(x.contribution_total||0),contribution_points:Number(x.contribution_points||0)}));
 result.applications=apps.results||[];result.missions=missions.results||[];result.transactions=tx.results||[];result.donors=donors.results||[];result.shop=shop.results||[];result.purchases=purchases.results||[];result.achievements=ach.results||[];result.audit=aud.results||[];
 result.donation_cp_remaining_today=Math.max(0,100-Number(cp?.points||0));
 return result;
}
export default {async fetch(request,env){
 const origin=request.headers.get("Origin")||"",h={};
 if(origin&&ORIGINS.has(origin)){h["Access-Control-Allow-Origin"]=origin;h["Access-Control-Allow-Methods"]="GET, POST, OPTIONS";h["Access-Control-Allow-Headers"]="Authorization, Content-Type";h["Access-Control-Max-Age"]="86400";h.Vary="Origin";}
 if(origin&&!ORIGINS.has(origin))return json({ok:false,error:"origin_not_allowed"},403,h);
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:h});
 if(!env.PORTAL_DB||!env.POLIS_DB)return json({ok:false,error:"database_binding_missing"},503,h);
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,"")||"/";
 if(request.method==="GET"&&["/","/health","/api/guilds/health"].includes(path))return json({ok:true,service:"rativapolis-guilds-api",version:VERSION,database:"rativapolis-dev-isolated"},200,h);
 const a=await actor(request,env);if(!a)return json({ok:false,error:"portal_authentication_required"},401,h);
 try{
  if(request.method==="GET"&&path==="/api/guilds/me")return json(await getMe(env,a),200,h);
  if(request.method==="GET"&&path==="/api/guilds/search"){
   const q=(url.searchParams.get("q")||"").trim().slice(0,40),like="%"+q+"%";
   const rows=await env.POLIS_DB.prepare("SELECT g.id,g.name,g.tag,g.emblem,g.level,g.member_limit,(SELECT COUNT(*) FROM rativapolis_guild_members m WHERE m.guild_id=g.id) AS members FROM rativapolis_guilds g WHERE g.status='active' AND (?='' OR g.name LIKE ? OR g.tag LIKE ?) ORDER BY g.level DESC,g.xp DESC LIMIT 30").bind(q,like,like).all();
   return json({ok:true,guilds:rows.results||[]},200,h);
  }
  if(request.method==="GET"&&path==="/api/guilds/ranking"){
   const page=Math.max(1,Math.min(1000,Number(url.searchParams.get("page")||1))),limit=Math.max(1,Math.min(20,Number(url.searchParams.get("limit")||20))),offset=(page-1)*limit;
   const [rows,total]=await Promise.all([env.POLIS_DB.prepare("SELECT g.id,g.name,g.tag,g.emblem,g.level,g.xp,g.mission_points,g.member_limit,(SELECT COUNT(*) FROM rativapolis_guild_members m WHERE m.guild_id=g.id) AS members FROM rativapolis_guilds g WHERE g.status='active' ORDER BY g.level DESC,g.xp DESC,g.mission_points DESC,g.total_donations DESC LIMIT ? OFFSET ?").bind(limit,offset).all(),env.POLIS_DB.prepare("SELECT COUNT(*) AS n FROM rativapolis_guilds WHERE status='active'").first()]);
   return json({ok:true,guilds:rows.results||[],pages:Math.ceil(Number(total?.n||0)/limit)},200,h);
  }
  if(request.method!=="POST")return json({ok:false,error:"method_not_allowed"},405,h);
  const b=await body(request);if(!b||typeof b!=="object")return json({ok:false,error:"invalid_json"},400,h);
  const m=await member(env.POLIS_DB,a.id),gid=m?.guild_id;
  if(path==="/api/guilds/create"){
   if(m)return json({ok:false,error:"already_in_guild"},409,h);
   const name=String(b.name||"").trim(),tag=String(b.tag||"").trim().toUpperCase(),desc=String(b.description||"").trim().slice(0,240),emblem=String(b.emblem||"🛡️").slice(0,8);
   if(name.length<3||name.length>24)return json({ok:false,error:"invalid_guild_name"},400,h);
   if(!/^[A-Z0-9]{3,5}$/.test(tag))return json({ok:false,error:"invalid_guild_tag"},400,h);
   const id=uuid(),t=now();
   try{
    await env.POLIS_DB.batch([
     env.POLIS_DB.prepare("INSERT INTO rativapolis_guilds(id,name,tag,description,emblem,leader_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(id,name,tag,desc,emblem,a.id,t,t),
     env.POLIS_DB.prepare("INSERT INTO rativapolis_guild_members(guild_id,user_id,role,joined_at) VALUES(?,?,'leader',?)").bind(id,a.id,t)
    ]);
    await audit(env.POLIS_DB,id,a.id,null,"guild_created",{name,tag});
    return json({ok:true,guild_id:id},201,h);
   }catch{return json({ok:false,error:"duplicate_or_conflict"},409,h);}
  }
  if(path==="/api/guilds/apply"){
   if(m)return json({ok:false,error:"already_in_guild"},409,h);
   const g=await env.POLIS_DB.prepare("SELECT id FROM rativapolis_guilds WHERE id=? AND status='active'").bind(String(b.guild_id||"")).first();if(!g)return json({ok:false,error:"guild_not_found"},404,h);
   try{await env.POLIS_DB.prepare("INSERT INTO rativapolis_guild_applications(id,guild_id,user_id,created_at) VALUES(?,?,?,?)").bind(uuid(),g.id,a.id,now()).run();return json({ok:true},201,h);}catch{return json({ok:false,error:"duplicate_or_conflict"},409,h);}
  }
  if(path==="/api/guilds/invite"){
   if(!m||!managers.includes(m.role))return json({ok:false,error:"permission_denied"},403,h);
   const value=String(b.player||"").trim(),target=await env.POLIS_DB.prepare("SELECT id FROM game_users WHERE (nickname=? COLLATE NOCASE OR public_id=? COLLATE NOCASE) AND status='active'").bind(value,value.toUpperCase()).first();
   if(!target)return json({ok:false,error:"player_not_found"},404,h);
   if(await member(env.POLIS_DB,target.id))return json({ok:false,error:"player_already_in_guild"},409,h);
   try{await env.POLIS_DB.prepare("INSERT INTO rativapolis_guild_invites(id,guild_id,inviter_user_id,invitee_user_id,expires_at,created_at) VALUES(?,?,?,?,?,?)").bind(uuid(),gid,a.id,target.id,new Date(Date.now()+7*86400000).toISOString(),now()).run();return json({ok:true},201,h);}catch{return json({ok:false,error:"duplicate_or_conflict"},409,h);}
  }
  if(path==="/api/guilds/invite/respond"){
   const invite=await env.POLIS_DB.prepare("SELECT * FROM rativapolis_guild_invites WHERE id=? AND invitee_user_id=? AND status='pending' AND expires_at>?").bind(String(b.invite_id||""),a.id,now()).first();
   if(!invite)return json({ok:false,error:"invite_not_found"},404,h);
   if(b.decision==="accept"){
    if(m)return json({ok:false,error:"already_in_guild"},409,h);
    try{await env.POLIS_DB.batch([env.POLIS_DB.prepare("UPDATE rativapolis_guild_invites SET status='accepted',responded_at=? WHERE id=? AND status='pending'").bind(now(),invite.id),env.POLIS_DB.prepare("INSERT INTO rativapolis_guild_members(guild_id,user_id,role,joined_at) SELECT ?,?,'member',? WHERE changes()>0").bind(invite.guild_id,a.id,now())]);}catch{return json({ok:false,error:"guild_full"},409,h);}
   }else if(b.decision==="decline")await env.POLIS_DB.prepare("UPDATE rativapolis_guild_invites SET status='declined',responded_at=? WHERE id=?").bind(now(),invite.id).run();else return json({ok:false,error:"invalid_decision"},400,h);
   return json({ok:true},200,h);
  }
  if(path==="/api/guilds/application/respond"){
   if(!m||!managers.includes(m.role))return json({ok:false,error:"permission_denied"},403,h);
   const app=await env.POLIS_DB.prepare("SELECT * FROM rativapolis_guild_applications WHERE id=? AND guild_id=? AND status='pending'").bind(String(b.application_id||""),gid).first();if(!app)return json({ok:false,error:"application_not_found"},404,h);
   if(b.decision==="accept"){
    try{await env.POLIS_DB.batch([env.POLIS_DB.prepare("UPDATE rativapolis_guild_applications SET status='accepted',responded_at=? WHERE id=? AND status='pending'").bind(now(),app.id),env.POLIS_DB.prepare("INSERT INTO rativapolis_guild_members(guild_id,user_id,role,joined_at) SELECT ?,?,'member',? WHERE changes()>0").bind(gid,app.user_id,now())]);}catch{return json({ok:false,error:"guild_full"},409,h);}
   }else if(b.decision==="reject")await env.POLIS_DB.prepare("UPDATE rativapolis_guild_applications SET status='rejected',responded_at=? WHERE id=?").bind(now(),app.id).run();else return json({ok:false,error:"invalid_decision"},400,h);
   return json({ok:true},200,h);
  }
  if(!m)return json({ok:false,error:"not_in_guild"},409,h);
  if(path==="/api/guilds/donate"){
   const amount=Number(b.amount),key=String(b.idempotency_key||"");
   if(!Number.isSafeInteger(amount)||amount<1||amount>100000||key.length<8||key.length>100)return json({ok:false,error:"invalid_amount_or_key"},400,h);
   const prev=await env.POLIS_DB.prepare("SELECT id FROM rativapolis_guild_transactions WHERE idempotency_key=?").bind(key).first();if(prev)return json({ok:true,duplicado:true},200,h);
   const t=now(),day=t.slice(0,10);
   const r=await env.POLIS_DB.batch([
    env.POLIS_DB.prepare("UPDATE ratopolis_profiles SET coins=coins-? WHERE user_id=? AND coins>=? AND EXISTS(SELECT 1 FROM rativapolis_guild_members m JOIN rativapolis_guilds g ON g.id=m.guild_id WHERE m.user_id=? AND m.guild_id=? AND g.status='active')").bind(amount,a.id,amount,a.id,gid),
    env.POLIS_DB.prepare("UPDATE rativapolis_guilds SET bank_cheese=bank_cheese+?,total_donations=total_donations+?,updated_at=? WHERE id=? AND status='active' AND changes()>0").bind(amount,amount,t,gid),
    env.POLIS_DB.prepare("INSERT INTO rativapolis_guild_transactions(id,guild_id,user_id,type,amount,balance_before,balance_after,idempotency_key,note,created_at,guild_xp_awarded) SELECT ?,?,?, 'donation',?,bank_cheese-?,bank_cheese,?,'Doação de membro',?,MIN(?,MAX(0,250-COALESCE((SELECT SUM(guild_xp_awarded) FROM rativapolis_guild_transactions WHERE guild_id=? AND user_id=? AND type='donation' AND substr(created_at,1,10)=?),0))) FROM rativapolis_guilds WHERE id=? AND changes()>0").bind(uuid(),gid,a.id,amount,amount,key,t,Math.floor(amount/100),gid,a.id,day,gid),
    env.POLIS_DB.prepare("UPDATE rativapolis_guild_members SET contribution_total=contribution_total+?,contribution_points=contribution_points+MIN(?,MAX(0,100-COALESCE((SELECT SUM(points) FROM rativapolis_guild_cp_events WHERE guild_id=? AND user_id=? AND source='donation' AND substr(created_at,1,10)=?),0))) WHERE guild_id=? AND user_id=? AND changes()>0").bind(amount,Math.floor(amount/100),gid,a.id,day,gid,a.id),
    env.POLIS_DB.prepare("INSERT OR IGNORE INTO rativapolis_guild_cp_events(event_id,guild_id,user_id,points,source,created_at) SELECT ?,?,?,MIN(?,MAX(0,100-COALESCE((SELECT SUM(points) FROM rativapolis_guild_cp_events WHERE guild_id=? AND user_id=? AND source='donation' AND substr(created_at,1,10)=?),0))),'donation',? WHERE changes()>0 AND ?>0 AND MIN(?,MAX(0,100-COALESCE((SELECT SUM(points) FROM rativapolis_guild_cp_events WHERE guild_id=? AND user_id=? AND source='donation' AND substr(created_at,1,10)=?),0)))>0").bind(uuid(),gid,a.id,Math.floor(amount/100),gid,a.id,day,t,Math.floor(amount/100),gid,a.id,day),
    env.POLIS_DB.prepare("UPDATE rativapolis_guilds SET xp=xp+COALESCE((SELECT guild_xp_awarded FROM rativapolis_guild_transactions WHERE idempotency_key=?),0),level=MIN(50,CAST((xp+COALESCE((SELECT guild_xp_awarded FROM rativapolis_guild_transactions WHERE idempotency_key=?),0))/1000 AS INTEGER)+1),member_limit=MIN(80,30+CAST((MIN(50,CAST((xp+COALESCE((SELECT guild_xp_awarded FROM rativapolis_guild_transactions WHERE idempotency_key=?),0))/1000 AS INTEGER)+1)-1)/5 AS INTEGER)*5),updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM rativapolis_guild_transactions WHERE idempotency_key=?)").bind(key,key,key,t,gid,key)
   ]);
   if(!(Number(r[0]?.meta?.changes||0)>0))return json({ok:false,error:"insufficient_cheese"},409,h);
   if(!(Number(r[1]?.meta?.changes||0)>0))return json({ok:false,error:"not_in_guild"},409,h);
   await audit(env.POLIS_DB,gid,a.id,null,"donation",{amount,idempotency_key:key});
   return json({ok:true,amount},200,h);
  }
  if(path==="/api/guilds/bank/withdraw"){
   const amount=Number(b.amount),key=String(b.idempotency_key||"");
   if(!["leader","vice"].includes(m.role))return json({ok:false,error:"permission_denied"},403,h);
   if(!Number.isSafeInteger(amount)||amount<1||amount>50000||key.length<8)return json({ok:false,error:"invalid_amount_or_key"},400,h);
   const r=await env.POLIS_DB.batch([
    env.POLIS_DB.prepare("UPDATE rativapolis_guilds SET bank_cheese=bank_cheese-?,updated_at=? WHERE id=? AND bank_cheese>=?").bind(amount,now(),gid,amount),
    env.POLIS_DB.prepare("UPDATE ratopolis_profiles SET coins=coins+? WHERE user_id=? AND changes()>0").bind(amount,a.id),
    env.POLIS_DB.prepare("INSERT INTO rativapolis_guild_transactions(id,guild_id,user_id,type,amount,balance_before,balance_after,idempotency_key,note,created_at) SELECT ?,?,?, 'withdrawal',?,bank_cheese+?,bank_cheese,?,'Retirada do banco',? FROM rativapolis_guilds WHERE id=? AND changes()>0").bind(uuid(),gid,a.id,amount,amount,key,now(),gid)
   ]);
   if(!Number(r[0]?.meta?.changes||0))return json({ok:false,error:"insufficient_guild_bank"},409,h);
   return json({ok:true},200,h);
  }
  if(path==="/api/guilds/bulletin"){
   if(!managers.includes(m.role))return json({ok:false,error:"permission_denied"},403,h);
   const bulletin=String(b.bulletin||"").trim().slice(0,220);await env.POLIS_DB.prepare("UPDATE rativapolis_guilds SET bulletin=?,updated_at=? WHERE id=?").bind(bulletin,now(),gid).run();await audit(env.POLIS_DB,gid,a.id,null,"bulletin_updated",{});return json({ok:true},200,h);
  }
  if(path==="/api/guilds/member/role"){
   if(m.role!=="leader")return json({ok:false,error:"leader_only"},403,h);
   const target=await env.POLIS_DB.prepare("SELECT id FROM game_users WHERE public_id=?").bind(String(b.player_id||"")).first(),role=String(b.role||"");
   if(!target||!roles.includes(role)||role==="leader")return json({ok:false,error:"invalid_target_or_role"},400,h);
   await env.POLIS_DB.prepare("UPDATE rativapolis_guild_members SET role=? WHERE guild_id=? AND user_id=? AND role<>'leader'").bind(role,gid,target.id).run();await audit(env.POLIS_DB,gid,a.id,target.id,"member_role_changed",{role});return json({ok:true},200,h);
  }
  if(path==="/api/guilds/member/remove"){
   if(m.role!=="leader")return json({ok:false,error:"leader_only"},403,h);
   const target=await env.POLIS_DB.prepare("SELECT id FROM game_users WHERE public_id=?").bind(String(b.player_id||"")).first();if(!target)return json({ok:false,error:"player_not_found"},404,h);
   await env.POLIS_DB.prepare("DELETE FROM rativapolis_guild_members WHERE guild_id=? AND user_id=? AND role<>'leader'").bind(gid,target.id).run();await audit(env.POLIS_DB,gid,a.id,target.id,"member_removed",{});return json({ok:true},200,h);
  }
  if(path==="/api/guilds/transfer"){
   if(m.role!=="leader")return json({ok:false,error:"leader_only"},403,h);
   const target=await env.POLIS_DB.prepare("SELECT id FROM game_users WHERE public_id=?").bind(String(b.player_id||"")).first();if(!target||target.id===a.id)return json({ok:false,error:"invalid_target"},400,h);
   const tm=await env.POLIS_DB.prepare("SELECT 1 AS ok FROM rativapolis_guild_members WHERE guild_id=? AND user_id=?").bind(gid,target.id).first();if(!tm)return json({ok:false,error:"player_not_found"},404,h);
   await env.POLIS_DB.batch([env.POLIS_DB.prepare("UPDATE rativapolis_guild_members SET role='vice' WHERE guild_id=? AND user_id=?").bind(gid,a.id),env.POLIS_DB.prepare("UPDATE rativapolis_guild_members SET role='leader' WHERE guild_id=? AND user_id=?").bind(gid,target.id),env.POLIS_DB.prepare("UPDATE rativapolis_guilds SET leader_user_id=?,updated_at=? WHERE id=?").bind(target.id,now(),gid)]);
   await audit(env.POLIS_DB,gid,a.id,target.id,"leadership_transferred",{});return json({ok:true},200,h);
  }
  if(path==="/api/guilds/leave"){
   if(m.role==="leader"&&Number((await env.POLIS_DB.prepare("SELECT COUNT(*) AS n FROM rativapolis_guild_members WHERE guild_id=?").bind(gid).first())?.n||0)>1)return json({ok:false,error:"transfer_leadership_first"},409,h);
   await env.POLIS_DB.prepare("DELETE FROM rativapolis_guild_members WHERE guild_id=? AND user_id=?").bind(gid,a.id).run();return json({ok:true},200,h);
  }
  if(path==="/api/guilds/close"){
   if(m.role!=="leader")return json({ok:false,error:"leader_only"},403,h);
   await env.POLIS_DB.prepare("UPDATE rativapolis_guilds SET status='closed',updated_at=? WHERE id=?").bind(now(),gid).run();await env.POLIS_DB.prepare("DELETE FROM rativapolis_guild_members WHERE guild_id=?").bind(gid).run();return json({ok:true},200,h);
  }
  if(path==="/api/guilds/shop/buy"){
   if(!managers.includes(m.role))return json({ok:false,error:"permission_denied"},403,h);
   const code=String(b.item_code||""),key=String(b.idempotency_key||""),item=await env.POLIS_DB.prepare("SELECT * FROM rativapolis_guild_shop_catalog WHERE item_code=? AND active=1").bind(code).first();
   if(!item)return json({ok:false,error:"item_not_found"},404,h);
   const guild=await env.POLIS_DB.prepare("SELECT * FROM rativapolis_guilds WHERE id=?").bind(gid).first();
   if(Number(guild.level)<Number(item.min_level))return json({ok:false,error:"guild_level_required"},409,h);
   const r=await env.POLIS_DB.batch([
    env.POLIS_DB.prepare("UPDATE rativapolis_guilds SET bank_cheese=bank_cheese-?,updated_at=? WHERE id=? AND bank_cheese>=?").bind(item.price_cheese,now(),gid,item.price_cheese),
    env.POLIS_DB.prepare("INSERT INTO rativapolis_guild_shop_purchases(id,guild_id,item_code,buyer_user_id,quantity,price_total,idempotency_key,created_at) SELECT ?,?,?,?,1,?,?,? WHERE changes()>0").bind(uuid(),gid,code,a.id,item.price_cheese,key,now()),
    env.POLIS_DB.prepare("INSERT INTO rativapolis_guild_transactions(id,guild_id,user_id,type,amount,balance_before,balance_after,idempotency_key,note,created_at) SELECT ?,?,?, 'shop_purchase',?,bank_cheese+?,bank_cheese,?,'Compra: '||? ,? FROM rativapolis_guilds WHERE id=? AND changes()>0").bind(uuid(),gid,a.id,item.price_cheese,item.price_cheese,key,code,now(),gid)
   ]);
   if(!Number(r[0]?.meta?.changes||0))return json({ok:false,error:"insufficient_guild_bank"},409,h);
   return json({ok:true},200,h);
  }
  return json({ok:false,error:"not_found"},404,h);
 }catch(e){return json({ok:false,error:"guild_api_error",detail:"A operação não foi concluída. Tente novamente."},503,h);}
}};
