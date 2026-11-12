/* RativaSnack — renderizador visual modular de cobras
 * Movimento continua no motor principal; este módulo fornece sprites e fallback.
 */
(()=>{'use strict';
 const ASSET='assets/snakes/';
 const load=(file)=>{const im=new Image();let ok=false;im.onload=()=>ok=true;im.onerror=()=>{ok=false;console.warn('[RativaSnakeVisuals] Falha ao carregar '+file)};im.src=ASSET+file;return {im,ready:()=>ok}};
 const body=load('snake-atlas.svg'), heads=load('head-atlas.svg'), tails=load('tail-atlas.svg');
 const FRAME=64, HEAD_FRAME=96, TAIL_FRAME=64;
 const FRAMES={default:0,neon:1,galaxia:2,ouro:3,cristal:2,aurora:1};
 const TAILS={normal:0,pompom:0,flor:1,estrela:2,coracao:3,chama:4,cristal:5};
 function drawSegment(ctx,o){
   if(!body.ready()||!ctx||!o)return false;
   const frame=FRAMES[o.skin]??0,r=Math.max(1,o.radius);
   ctx.save();ctx.drawImage(body.im,frame*FRAME,0,FRAME,FRAME,o.x-r*1.12,o.y-r*1.12,r*2.24,r*2.24);
   ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=.38;ctx.fillStyle=o.color||'#fff';ctx.beginPath();ctx.arc(o.x,o.y,r*.98,0,Math.PI*2);ctx.fill();ctx.restore();return true;
 }
 function drawHead(ctx,s,R,time,drawCloth,drawExtras){
   if(!ctx||!s)return false;
   if(heads.ready()){
     const frame=FRAMES[s.headSkin||s.skin]??0;
     ctx.save();ctx.drawImage(heads.im,frame*HEAD_FRAME,0,HEAD_FRAME,HEAD_FRAME,-R*1.25,-R*1.25,R*2.5,R*2.5);ctx.restore();
     if(typeof drawCloth==='function')drawCloth(s,R);
     if(typeof drawExtras==='function')drawExtras(s,R,RATS[s.rat]||{});
     return true;
   }
   // Fallback vetorial preserva o visual anterior.
   const gameTime=time;
   drawCloth(s,R);const c=RATS[s.rat]||{ear:'#ffb6c6',nose:'#ff8fa3',eye:'#172033'},col=s.color,wg=Math.sin(gameTime*4+(s.x||0)*.01)*.08,es=c.es||1;if(c.hs){ctx.save();ctx.scale(c.hs,c.hs)}
   for(const sy of [-1,1]){ctx.fillStyle=c.earc||col;ctx.beginPath();ctx.ellipse(-R*.12,sy*R*.98,R*.66*es,R*.6*es,sy*(-.3+wg),0,6.2832);ctx.fill();const eg=ctx.createRadialGradient(-R*.1,sy*R*.98,R*.05,-R*.1,sy*R*.98,R*.45);eg.addColorStop(0,c.ear);eg.addColorStop(1,'#d9748f');ctx.fillStyle=eg;ctx.beginPath();ctx.ellipse(-R*.1,sy*R*.98,R*.42*es,R*.38*es,sy*(-.3+wg),0,6.2832);ctx.fill()}
   ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(0,0,R,R*.92,0,0,6.2832);ctx.fill();ctx.beginPath();ctx.moveTo(R*.4,-R*.7);ctx.quadraticCurveTo(R*1.6,-R*.24,R*1.55,0);ctx.quadraticCurveTo(R*1.6,R*.24,R*.4,R*.7);ctx.closePath();ctx.fill();
   if(c.sn){ctx.fillStyle=c.sn;ctx.beginPath();ctx.ellipse(R,0,R*.55,R*.38,0,0,6.2832);ctx.fill()}if(c.pat){ctx.fillStyle=c.pat;ctx.beginPath();ctx.ellipse(-R*.25,-R*.38,R*.42,R*.3,.3,0,6.2832);ctx.fill()}
   const fg=ctx.createRadialGradient(R*.15,-R*.25,R*.1,0,0,R*1.35);fg.addColorStop(0,'#ffffff40');fg.addColorStop(.6,'#ffffff00');fg.addColorStop(1,'#00000050');ctx.fillStyle=fg;ctx.beginPath();ctx.ellipse(0,0,R,R*.92,0,0,6.2832);ctx.fill();
   for(const sy of [-1,1]){ctx.fillStyle=c.eye;ctx.beginPath();ctx.arc(R*.42,sy*R*.36,R*.25,0,6.2832);ctx.fill();ctx.fillStyle='#0a0f1c';ctx.beginPath();ctx.arc(R*.46,sy*R*.36,R*.16,0,6.2832);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(R*.5,sy*R*.36-R*.09,R*.08,0,6.2832);ctx.arc(R*.38,sy*R*.36+R*.09,R*.04,0,6.2832);ctx.fill()}
   if((gameTime+((s.x||0)*.013%3))%3.4<.12){ctx.fillStyle=col;ctx.beginPath();ctx.arc(R*.44,-R*.36,R*.27,0,6.2832);ctx.arc(R*.44,R*.36,R*.27,0,6.2832);ctx.fill()}
   ctx.fillStyle=c.nose;ctx.beginPath();ctx.ellipse(R*1.52,0,R*.21,R*.17,0,0,6.2832);ctx.fill();ctx.fillStyle='#ffffff99';ctx.beginPath();ctx.arc(R*1.5,-R*.06,R*.05,0,6.2832);ctx.fill();
   const w=Math.sin(gameTime*6)*.06*R;ctx.strokeStyle=c.wh||'#ffffffd0';ctx.lineWidth=Math.max(1,R*.06);ctx.lineCap='round';ctx.beginPath();for(const sy of [-1,1])for(const k of [-1,0,1]){ctx.moveTo(R*1.2,sy*R*.12);ctx.quadraticCurveTo(R*1.7,sy*R*(.35+k*.28)+w*sy,R*(1.75+k*.1),sy*R*(.9+k*.4)+w*sy)}ctx.stroke();if(typeof drawExtras==='function')drawExtras(s,R,c);if(c.hs)ctx.restore();return true;
 }
 function drawTail(ctx,s,cam,W,H,time,drawNormalTail){
   const t=s&&s.tail;if(!s||!t||t==='normal'){if(typeof drawNormalTail==='function')drawNormalTail(s);return true}
   const sg=s.segments||[],n=sg.length;if(!n)return true;const q=sg[n-1],p=sg[Math.max(0,n-2)],px=q.x-cam.x,py=q.y-cam.y;
   if(px<-50||py<-50||px>W+50||py>H+50)return true;
   const R=s.radius,ang=Math.atan2(q.y-p.y,q.x-p.x),frame=TAILS[t]??0;
   if(tails.ready()){ctx.save();ctx.translate(px,py);ctx.rotate(ang);ctx.drawImage(tails.im,frame*TAIL_FRAME,0,TAIL_FRAME,TAIL_FRAME,-R,-R,R*2,R*2);ctx.restore();return true}
   const ca=Math.cos(ang),sa=Math.sin(ang);
   if(t==='pompom'){ctx.fillStyle='#f4f8ff';ctx.beginPath();ctx.arc(px+ca*R*.6,py+sa*R*.6,R*.62,0,6.2832);ctx.fill();ctx.fillStyle='#8fa3c466';ctx.beginPath();ctx.arc(px+ca*R*.6+2,py+sa*R*.6+2,R*.3,0,6.2832);ctx.fill()}
   else if(t==='flor'){for(let k=0;k<5;k++){const a=k*1.2566;ctx.fillStyle='#ff9ad5';ctx.beginPath();ctx.arc(px+Math.cos(a)*R*.55,py+Math.sin(a)*R*.55,R*.38,0,6.2832);ctx.fill()}ctx.fillStyle='#ffe477';ctx.beginPath();ctx.arc(px,py,R*.3,0,6.2832);ctx.fill()}
   else if(t==='estrela'||t==='coracao'){const cx=px+ca*R*1.1,cy=py+sa*R*1.1,rr=R*.95;ctx.fillStyle=t==='estrela'?'#ffd34e':'#ff5d8f';ctx.beginPath();if(t==='estrela'){for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2,r2=k%2?rr*.45:rr;ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2)}ctx.closePath()}else{ctx.moveTo(cx,cy+rr*.8);ctx.bezierCurveTo(cx-rr*1.3,cy-rr*.1,cx-rr*.6,cy-rr*1.1,cx,cy-rr*.35);ctx.bezierCurveTo(cx+rr*.6,cy-rr*1.1,cx+rr*1.3,cy-.1*rr,cx,cy+rr*.8)}ctx.fill();ctx.strokeStyle='#00000033';ctx.lineWidth=1;ctx.stroke()}
   else if(t==='chama'){const tt=time*12;for(let k=1;k<=3;k++){const d=R*(.5+k*.75),w=Math.sin(tt+k*1.7)*R*.25;ctx.fillStyle=k===1?'#ffd34ecc':k===2?'#ff9f43aa':'#ff5d7388';ctx.beginPath();ctx.arc(px+ca*d-sa*w,py+sa*d+ca*w,R*(.55-k*.1),0,6.2832);ctx.fill()}}
   return true;
 }
 function headBob(time,x){return Math.sin(time*6+(x||0)*.02)*.05}
 function segmentWobble(index,time,radius){return Math.sin(index*.55-time*7)*radius*.14}
 window.RativaSnakeVisuals=Object.freeze({version:'2.0.0',isReady:()=>body.ready()&&heads.ready()&&tails.ready(),drawSegment,drawHead,drawTail,headBob,segmentWobble});
})();