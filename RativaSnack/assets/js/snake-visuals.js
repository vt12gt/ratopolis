/* RativaSnack — renderizador visual modular de cobras
 * A lógica de movimento permanece no motor principal. Este módulo cuida apenas
 * da aparência dos segmentos e usa spritesheet externo com fallback vetorial.
 */
(()=>{'use strict';
 const BASE='assets/snakes/snake-atlas.svg';
 const image=new Image();
 let ready=false;
 image.onload=()=>{ready=true};
 image.onerror=()=>{ready=false;console.warn('[RativaSnakeVisuals] Spritesheet indisponível; usando desenho vetorial.')};
 image.src=BASE;
 const FRAME=64, FRAMES={default:0,neon:1,galaxia:2,ouro:3,cristal:2,aurora:1};
 function drawSegment(ctx,o){
   if(!ready||!ctx||!o)return false;
   const frame=FRAMES[o.skin]??0, r=Math.max(1,o.radius);
   ctx.save();
   ctx.drawImage(image,frame*FRAME,0,FRAME,FRAME,o.x-r*1.12,o.y-r*1.12,r*2.24,r*2.24);
   ctx.globalCompositeOperation='source-atop';
   ctx.globalAlpha=.38;
   ctx.fillStyle=o.color||'#ffffff';
   ctx.beginPath();ctx.arc(o.x,o.y,r*.98,0,Math.PI*2);ctx.fill();
   ctx.restore();
   return true;
 }
 window.RativaSnakeVisuals=Object.freeze({
   version:'1.0.0',
   isReady:()=>ready,
   drawSegment
 });
})();