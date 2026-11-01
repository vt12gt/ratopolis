/**
 * Ratópolis official procedural maps, ported from makeLevel() in
 * ratopolis_v1.55.11_multiplayer_reconnect_fix.html.
 * Canonical multiplayer world: 3000 x 760. Geometry is server-owned.
 * Map index/layout is zero-based internally; public IDs are ratopolis_01..12.
 */
const SCENARIOS = [
  "Clareira dos Saltos", "Bosque dos Troncos", "Ruínas das Plataformas",
  "Jardim dos Espinhos", "Vale do Besouro", "Toca da Bolota Dourada",
  "Bosque dos Ratinhos", "Caverna dos Cristais", "Ponte do Castelo",
  "Montanha Gelada", "Vale Vulcânico", "Templo da Bolota"
];
const X_OFFSETS = [
 [0,0,4,-3,2,-2,3,0,-3,0],[0,3,-2,4,-3,2,0,-4,3,0],
 [0,-3,4,0,-2,3,-4,2,0,0],[0,4,-3,2,-4,0,3,-2,4,0],
 [0,-2,3,-4,2,0,-3,4,-2,0],[0,3,-4,2,0,-3,4,-2,3,0],
 [0,2,-3,3,-2,4,-3,2,-2,0],[0,-4,3,-2,4,-3,2,-4,3,0],
 [0,0,3,-3,0,3,-3,0,2,0],[0,3,-3,4,-4,2,-2,3,-3,0],
 [0,-2,4,-4,3,-3,4,-2,2,0],[0,2,-2,2,-2,3,-3,2,-2,0]
];
const STEP_SIZES=[188,194,200,206,198,210,192,200,196,204,202,208];
const HEIGHTS=[
 [36,56,82,104,126,140,152,122,84,42],
 [44,70,94,120,144,160,144,112,76,44],
 [34,64,92,116,148,166,140,106,70,38],
 [40,72,104,132,156,174,148,110,72,42],
 [38,62,88,120,150,168,150,118,80,46],
 [46,78,110,140,164,180,152,112,76,40],
 [38,60,84,110,132,150,156,128,88,44],
 [42,66,96,124,148,164,140,110,74,40],
 [36,60,90,118,142,158,170,136,96,48],
 [40,68,98,126,152,172,146,114,78,42],
 [44,72,100,132,158,176,150,116,80,44],
 [46,76,108,138,162,182,156,120,82,42]
];
const WIDTHS=[
 [154,150,158,152,160,156,154,158,152,160],
 [150,158,152,160,154,158,152,160,154,158],
 [152,156,150,160,154,158,152,160,156,158],
 [150,154,158,152,160,154,158,152,160,156],
 [156,150,158,154,160,152,156,160,154,158],
 [150,158,152,160,154,158,150,160,154,158],
 [158,152,156,160,154,158,150,160,154,158],
 [152,158,150,156,160,152,158,154,160,156],
 [160,156,158,154,160,156,152,160,158,154],
 [154,160,152,158,150,160,154,156,152,160],
 [150,156,160,152,158,154,160,150,156,158],
 [160,154,158,152,156,160,150,158,154,160]
];
const BRANCHES=[
 [[18,-38,88],[120,-56,92]],
 [[16,-52,96],[124,-36,84],[222,-66,86]],
 [[22,-36,82],[118,-60,88]],
 [[14,-62,80],[108,-42,82],[206,-70,90]],
 [[20,-40,92],[126,-64,82]],
 [[12,-58,80],[106,-38,92],[210,-72,84]],
 [[18,-44,90],[118,-62,88]],
 [[14,-50,86],[116,-34,84],[214,-64,88]],
 [[20,-38,94],[122,-58,86]],
 [[16,-56,82],[112,-40,84],[208,-68,88]],
 [[18,-42,90],[120,-62,80]],
 [[12,-60,82],[108,-40,90],[212,-70,86]]
];
const ACORN_INDICES=[2,7,4,8,3,6,5,3,3,4,4,5];
const HAZARDS=[
 [["stump",.24],["beetle",.49]],
 [["spikes",.22],["beetle",.58]],
 [["beetle",.30],["spikes",.57]],
 [["spikes",.27],["stump",.53],["beetle",.76]],
 [["beetle",.34],["spikes",.66]],
 [["stump",.25],["beetle",.56],["spikes",.78]],
 [["stump",.23],["beetle",.47],["spikes",.83]],
 [["spikes",.28],["beetle",.54],["stump",.83]],
 [["beetle",.25],["spikes",.52],["beetle",.82]],
 [["stump",.29],["spikes",.56]],
 [["spikes",.26],["beetle",.52],["spikes",.83]],
 [["beetle",.24],["stump",.55],["spikes",.83]]
];
const TUNNELS=[
 [[.35,104]],[[.31,118],[.72,108]],[[.39,112],[.70,138]],[[.43,120]],
 [[.28,100],[.73,116]],[[.36,110],[.66,126]],[[.33,108]],[[.35,112],[.68,120]],
 [[.38,116]],[[.31,104],[.70,124]],[[.40,114],[.65,108]],[[.34,110],[.66,128]]
];
const CHECKPOINTS=[.42,.46,.50,.44,.48,.52,.41,.45,.47,.42,.46,.49];
const clone = value => structuredClone(value);

function buildScenario(index) {
  const width=3000,height=760,base=height-54,layout=index;
  const xOffsets=X_OFFSETS[layout],step=STEP_SIZES[layout],widths=WIDTHS[layout];
  const blockXs=Array.from({length:10},(_,i)=>220+i*step+xOffsets[i]);
  const blocks=blockXs.map((x,i)=>({id:`main-${i+1}`,x,y:base-HEIGHTS[layout][i],w:widths[i],h:22,block:true}));
  const branchBase=blocks[3];
  const branches=BRANCHES[layout].map(([dx,dy,w],i)=>({
    id:`secret-${i+1}`,x:branchBase.x+branchBase.w+dx,y:base+dy,w,h:16,block:true,secret:true
  }));
  const colliders=[
    {id:"ground",x:0,y:base,w:width,h:90,block:false},
    ...blocks.map(({id,x,y,w,h})=>({id,x,y,w,h,block:true})),
    ...branches.map(({id,x,y,w,h})=>({id,x,y,w,h,block:true,oneWay:true}))
  ];
  const hazards=HAZARDS[layout].map(([type,ratio],i)=>{
    const w=type==="spikes"?44:type==="beetle"?32:34;
    const h=type==="spikes"?16:type==="beetle"?20:25;
    const x=Math.min(width-520,Math.max(160,width*ratio));
    return {id:`hazard-${i+1}`,type,x,y:base-h,w,h,
      ...(type==="beetle"?{minX:Math.max(110,x-48),maxX:Math.min(width-100,x+48),dir:1,patrolSpeed:32+layout*2}:{})};
  });
  const checkpointX=width*CHECKPOINTS[layout];
  const filteredHazards=hazards.filter(o=>{
    const cx=o.x+o.w/2;
    if(cx<145||cx>width-245||Math.abs(cx-checkpointX)<78)return false;
    if((o.type==="spikes"||o.type==="beetle")&&blockXs.some((bx,i)=>Math.abs(cx-(bx+widths[i]/2))<34&&i<2))return false;
    return true;
  });
  if(layout===2)filteredHazards.push({id:"spring-1",type:"spring",x:185,y:base-28,w:38,h:28});
  const tunnels=TUNNELS[layout].map(([ratio,w],i)=>({id:`tunnel-${i+1}`,type:"lowroof",x:Math.round(width*ratio),y:base-28,w,h:9}));
  for(const tunnel of tunnels){
    const overlaps=filteredHazards.some(o=>Math.abs((o.x+o.w/2)-(tunnel.x+tunnel.w/2))<(o.w+tunnel.w)/2+42);
    if(overlaps)tunnel.disabled=true;
  }
  const acornPlatform=blocks[ACORN_INDICES[layout]];
  const cheesePlatform=blocks[2];
  return {
    id:`ratopolis_${String(index+1).padStart(2,"0")}`,version:1,name:SCENARIOS[index],
    width,height,groundY:base,colliders,
    spawn:{x:45,y:base-30},goal:{x:width-150,y:base-38},
    checkpoint:{x:checkpointX,y:base},
    collectibles:{
      cheese:{x:cheesePlatform.x+cheesePlatform.w*.5,y:cheesePlatform.y-24,shared:true,personal:true},
      acorn:{x:acornPlatform.x+acornPlatform.w*.52,y:acornPlatform.y-27}
    },
    hazards:filteredHazards,tunnels:tunnels.filter(t=>!t.disabled),
    shield:{x:width*.68,y:base-31,initiallyCollected:layout<2},
    source:"ratopolis_v1.55.11_multiplayer_reconnect_fix.html#makeLevel"
  };
}

export const RATOPOLIS_MAPS = Object.freeze(Array.from({length:12},(_,i)=>deepFreeze(buildScenario(i))));
function deepFreeze(value){
  if(value&&typeof value==="object"&&!Object.isFrozen(value)){
    Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);
  }
  return value;
}
export function getRatopolisMap(id){const map=RATOPOLIS_MAPS.find(m=>m.id===String(id));if(!map)throw new Error("map_not_found");return clone(map);}
