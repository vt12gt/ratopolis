const ALLOWED_ORIGINS = new Set(["https://vt12gt.github.io","https://ratopolis-cadastro-teste.pages.dev"]);
const ITERATIONS = 100000;
const ROLE_RANK = {spadm:5,adm:4,gm:3,mod:2,editor:1.5,divulgador:1.25,locutor:1.1,player:1};
export default {
 async fetch(request, env) {
  const origin=request.headers.get("Origin")||"";
  const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Vary":"Origin"};
  if(origin&&ALLOWED_ORIGINS.has(origin)) {
   headers["Access-Control-Allow-Origin"]=origin;
   headers["Access-Control-Allow-Methods"]="POST, OPTIONS";
   headers["Access-Control-Allow-Headers"]="Content-Type, Authorization";
   headers["Access-Control-Max-Age"]="86400";
  }
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!ALLOWED_ORIGINS.has(origin))return reply({ok:false,erro:"Origem nao autorizada."},403);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method==="GET"&&new URL(request.url).pathname==="/health")return reply({ok:true,service:"ratopolis-password-admin",version:"1.0.0"});
  if(request.method!=="POST"||new URL(request.url).pathname!=="/api/admin/users/password-reset")return reply({ok:false,erro:"Endpoint nao encontrado."},404);
  if(!env.DB)return reply({ok:false,erro:"Banco de dados nao configurado."},500);
  try {
   const auth=request.headers.get("Authorization")||"";
   const tokenMatch=auth.match(/^Bearer\\s+(\\S+)$/i);
   if(!tokenMatch)return reply({ok:false,erro:"Autenticacao necessaria."},401);
   const tokenHash=await sha256(tokenMatch[1]);
   const actor=await env.DB.prepare("SELECT u.id,u.role,CASE WHEN rs.role IS NOT NULL THEN rs.role ELSE u.role END AS effective_role FROM ratopolis_sessions s JOIN ratopolis_users u ON u.id=s.user_id LEFT JOIN ratopolis_radio_staff rs ON rs.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active' LIMIT 1").bind(tokenHash,new Date().toISOString()).first();
   if(!actor)return reply({ok:false,erro:"Sessao invalida ou expirada."},401);
   if(!["spadm","adm"].includes(actor.effective_role))return reply({ok:false,erro:"Somente SpAdmin e ADM podem redefinir senhas."},403);
   let body;try{body=await request.json()}catch{return reply({ok:false,erro:"JSON invalido."},400)}
   const targetId=typeof body.user_id==="string"?body.user_id.trim():"";
   const password=typeof body.password==="string"?body.password:"";
   if(!targetId||targetId.length>128)return reply({ok:false,erro:"Selecione uma conta valida."},400);
   if(password.length<8||password.length>128)return reply({ok:false,erro:"A nova senha deve ter entre 8 e 128 caracteres."},400);
   const target=await env.DB.prepare("SELECT u.id,u.nickname,CASE WHEN rs.role IS NOT NULL THEN rs.role ELSE u.role END AS role FROM ratopolis_users u LEFT JOIN ratopolis_radio_staff rs ON rs.user_id=u.id WHERE u.id=? AND u.status='active' LIMIT 1").bind(targetId).first();
   if(!target)return reply({ok:false,erro:"Conta ativa nao encontrada."},404);
   if(target.role==="spadm"||(actor.effective_role==="adm"&&(ROLE_RANK[target.role]??0)>=ROLE_RANK.adm))return reply({ok:false,erro:"Seu cargo nao permite redefinir a senha desta conta."},403);
   const credential=await env.DB.prepare("SELECT user_id FROM ratopolis_credentials WHERE user_id=? LIMIT 1").bind(targetId).first();
   if(!credential)return reply({ok:false,erro:"Credencial nao encontrada; nenhuma senha foi alterada."},404);
   const salt=crypto.getRandomValues(new Uint8Array(16));
   const saltEncoded=toBase64url(salt);
   const hash=await passwordHash(password,salt);
   const at=new Date().toISOString();
   await env.DB.batch([
    env.DB.prepare("UPDATE ratopolis_credentials SET password_hash=?,password_salt=?,updated_at=? WHERE user_id=?").bind(hash,saltEncoded,at,targetId),
    env.DB.prepare("DELETE FROM ratopolis_sessions WHERE user_id=?").bind(targetId),
    env.DB.prepare("INSERT INTO ratopolis_audit_logs (id,actor_user_id,action,target_user_id,details,created_at) VALUES (?,?, 'admin_password_reset',?,?,?)").bind(crypto.randomUUID(),actor.id,targetId,JSON.stringify({nickname:target.nickname,target_role:target.role,sessions_revoked:true}),at)
   ]);
   return reply({ok:true,mensagem:"Senha redefinida. Todas as sessoes anteriores foram encerradas.",jogador:{id:target.id,nickname:target.nickname}});
  } catch(error) {
   return reply({ok:false,erro:"Falha interna ao redefinir a senha."},500);
  }
 }
};
function toBase64url(bytes){let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"")}
async function passwordHash(password,salt){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:ITERATIONS,hash:"SHA-256"},key,256);
 return toBase64url(new Uint8Array(bits));
}
async function sha256(value){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return toBase64url(new Uint8Array(digest))}