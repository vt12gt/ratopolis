export function rotatePoint(x,y,angle){const c=Math.cos(angle),s=Math.sin(angle);return{x:x*c-y*s,y:x*s+y*c};}
export function rectangleVertices(body){const w=body.w/2,h=body.h/2;return[[-w,-h],[w,-h],[w,h],[-w,h]].map(([x,y])=>{const p=rotatePoint(x,y,body.angle||0);return{x:body.x+w+p.x,y:body.y+h+p.y};});}
export function inverseInertia(body){if(body.static||body.lockRotation)return 0;return 1/Math.max(.05,(Number(body.mass)||1)*(body.w*body.w+body.h*body.h)/12);}
export function cross2D(a,b){return a.x*b.y-a.y*b.x;}
export function velocityAtPoint(body,offset){return{x:body.vx-(body.angularVelocity||0)*offset.y,y:body.vy+(body.angularVelocity||0)*offset.x};}
