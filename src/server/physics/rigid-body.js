export function rotatePoint(x,y,angle){const c=Math.cos(angle),s=Math.sin(angle);return{x:x*c-y*s,y:x*s+y*c};}
export function rectangleVertices(body){const w=body.w/2,h=body.h/2;return[[-w,-h],[w,-h],[w,h],[-w,h]].map(([x,y])=>{const p=rotatePoint(x,y,body.angle||0);return{x:body.x+w+p.x,y:body.y+h+p.y};});}
export function inverseInertia(body){if(body.static||body.lockRotation)return 0;return 1/Math.max(.05,(Number(body.mass)||1)*(body.w*body.w+body.h*body.h)/12);}
export function cross2D(a,b){return a.x*b.y-a.y*b.x;}
export function velocityAtPoint(body,offset){return{x:body.vx-(body.angularVelocity||0)*offset.y,y:body.vy+(body.angularVelocity||0)*offset.x};}

export function rectangleCollision(a,b){const av=rectangleVertices(a),bv=rectangleVertices(b),axes=[];for(const points of [av,bv])for(let i=0;i<4;i++){const p=points[i],q=points[(i+1)%4],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1;axes.push({x:-dy/len,y:dx/len});}let depth=Infinity,normal=null;for(const axis of axes){const pa=projectVertices(av,axis),pb=projectVertices(bv,axis),overlap=Math.min(pa.max,pb.max)-Math.max(pa.min,pb.min);if(overlap<=0)return null;if(overlap<depth){depth=overlap;normal=axis;}}const ac={x:a.x+a.w/2,y:a.y+a.h/2},bc={x:b.x+b.w/2,y:b.y+b.h/2};if((bc.x-ac.x)*normal.x+(bc.y-ac.y)*normal.y<0)normal={x:-normal.x,y:-normal.y};const sa=supportVertices(av,normal,true),sb=supportVertices(bv,normal,false);return{normal,depth,point:{x:(sa.x+sb.x)/2,y:(sa.y+sb.y)/2}};}
function projectVertices(points,axis){let min=Infinity,max=-Infinity;for(const p of points){const d=p.x*axis.x+p.y*axis.y;min=Math.min(min,d);max=Math.max(max,d);}return{min,max};}

function supportVertices(points,axis,highest){let best=highest?-Infinity:Infinity,found=[];for(const p of points){const d=p.x*axis.x+p.y*axis.y;if(highest?d>best+1e-5:d<best-1e-5){best=d;found=[p];}else if(Math.abs(d-best)<1e-5)found.push(p);}return{x:found.reduce((v,p)=>v+p.x,0)/found.length,y:found.reduce((v,p)=>v+p.y,0)/found.length};}
