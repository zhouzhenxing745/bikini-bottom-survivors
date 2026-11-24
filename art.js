const TAU = Math.PI * 2;
const OUTLINE = '#082633';

function oval(ctx,x,y,rx,ry,fill,stroke,width=2) {
  ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,TAU);
  if(fill){ctx.fillStyle=fill;ctx.fill()}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}
}

function shape(ctx,points,fill,stroke,width=2) {
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for(let i=1;i<points.length;i++) ctx.lineTo(...points[i]);
  if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill()}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}
}

function box(ctx,x,y,w,h,r,fill,stroke,width=2) {
  ctx.beginPath(); ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}
}

function eye(ctx,x,y,rx,ry,iris='#58bde7',look=1,bias=0,blink=false) {
  if(blink){
    shape(ctx,[[x-rx*.74,y],[x,y+ry*.21],[x+rx*.74,y]],null,OUTLINE,1.55);
    return;
  }
  oval(ctx,x,y,rx,ry,'#fffbed',OUTLINE,1.6);
  const pupilX=x+rx*.26*look,pupilY=y+ry*.2*bias;
  oval(ctx,pupilX,pupilY,rx*.49,ry*.59,iris);
  oval(ctx,pupilX+rx*.08,pupilY,rx*.24,ry*.38,OUTLINE);
  oval(ctx,pupilX-rx*.06,pupilY-ry*.22,rx*.14,ry*.15,'#fff');
}

function surface(ctx,top,bottom,light,shade) {
  const paint=ctx.createLinearGradient(0,top,0,bottom);
  paint.addColorStop(0,light);
  paint.addColorStop(1,shade);
  return paint;
}

function smile(ctx,x,y,w) {
  ctx.beginPath(); ctx.moveTo(x-w,y);ctx.quadraticCurveTo(x,y+w*.63,x+w,y);
  ctx.quadraticCurveTo(x+w*.47,y+w*1.04,x,y+w*1.07);
  ctx.quadraticCurveTo(x-w*.62,y+w,x-w,y);
  ctx.fillStyle='#6e333c';ctx.fill();ctx.strokeStyle=OUTLINE;ctx.lineWidth=1.6;ctx.stroke();
}

function arcLine(ctx,x,y,rx,ry,start,end,color,width=1.4) {
  ctx.beginPath();
  ctx.ellipse(x,y,rx,ry,0,start,end);
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}

function drawHero(ctx,id,x,y,scale=1,pose={}) {
  const {time=0,steps=0,face=1,stride=0,tilt=0,kick=0,cast=0,aim=0,splash=false,showWeapon=true}=pose;
  const swing=Math.sin(steps);
  const step=swing*stride*(id==='patrick'?5:7);
  const lift=Math.abs(swing)*stride*(id==='gary'?1.1:3.4);
  const recoil=kick>0?Math.sin(Math.PI*Math.min(1,Math.max(0,1-kick/.29))):0;
  const raise=Math.min(1,cast*4);
  const action=splash||kick>.025;
  const blink=!action&&!raise&&time>0&&time%4.23>4.12;
  const gaze=(ox,oy,rx,ry,color)=>eye(ctx,ox,oy,rx,ry,color,.56+recoil*.44,action?Math.sin(aim):0,blink);
  ctx.save();ctx.translate(x,y);ctx.scale(scale*face,scale);
  ctx.translate(-recoil*2,Math.sin(time*3)*.9-lift-raise*5);
  ctx.rotate(face*tilt*.13+recoil*.17+swing*stride*.035);
  ctx.scale(1+lift*.014+recoil*.067,1-lift*.018-recoil*.045+raise*.076);
  ctx.lineJoin='round';ctx.lineCap='round';
  if(id==='sponge'){
    for(const side of [-1,1]){
      const foot=side*13-side*step;
      const sole=25-Math.max(0,side*swing)*stride*3;
      shape(ctx,[[side*10,14],[foot,sole]],null,side<0?'#ebba56':'#ffe07a',4.3);
      shape(ctx,[[foot,sole-4],[foot,sole]],null,'#fff4ce',3);
      oval(ctx,foot+1,sole+1,6,3.1,OUTLINE);
      oval(ctx,foot+2,sole,2.8,1,'#59818a');
    }
    shape(ctx,[[-17,1],[-25,6-step],[-27,-step-raise*8]],null,'#f6cd56',4);
    const handY=action?-12+recoil*17:-step-raise*13;
    shape(ctx,[[17,1],[25,handY*.42],[29,handY]],null,'#f6cd56',4);
    shape(ctx,[[-21,-20],[-16,-23],[-10,-21],[-4,-23],[3,-21],[9,-23],[15,-21],[21,-23],[23,-15],[21,-9],[23,-2],[21,7],[15,10],[-17,9],[-21,6],[-19,-1],[-22,-8],[-20,-14]],surface(ctx,-22,11,'#fff18a','#e9ac3b'),OUTLINE,2.4);
    shape(ctx,[[-16,-17],[14,-17],[18,-14],[17,6],[-16,6]],surface(ctx,-17,7,'#fff3a0','#ffdd5d'));
    for(const [a,b,c,d] of [[-16,-13,2.9,3.7],[16,-16,3,2],[16,3,2.8,3],[-16,3,2,2.5],[-12,-5,1.5,2],[17,-7,1.4,2]]) oval(ctx,a,b,c,d,'#ddac42');
    shape(ctx,[[-17,-19],[-11,-18],[-5,-20],[1,-18],[8,-20]],null,'#fff9c4',1.2);
    box(ctx,-19,8,38,10,1,surface(ctx,8,18,'#bc7950','#795041'),OUTLINE,1.5);
    shape(ctx,[[-12,13],[-9,13],[-9,17]],null,'#664438',1);
    box(ctx,-19,6,38,5,1,'#fff1d4',OUTLINE,1);
    shape(ctx,[[1,7],[4,9],[5,14],[2,17],[-1,13]],'#ea5683',OUTLINE,1);
    gaze(-6,-10,6,7);gaze(6,-10,6,7);
    shape(ctx,[[-9,-17],[-10,-20],[-6,-17],[-6,-21],[-3,-17]],null,OUTLINE,1.1);
    shape(ctx,[[3,-17],[3,-20],[6,-17],[7,-21],[9,-17]],null,OUTLINE,1.1);
    oval(ctx,-10,-.3,2.7,1.6,'#f79f5870');oval(ctx,12,-.7,2.8,1.6,'#f79f5888');
    smile(ctx,1,-1,10);oval(ctx,3,-4,4,2.6,'#fadd66',OUTLINE,1);
    box(ctx,-3,0,4,3,1,'#fffbea');box(ctx,2,0,4,3,1,'#fffbea');
    if(action&&showWeapon)drawSpatula(ctx,29,handY,-.46+recoil*1.8+Math.sin(aim)*.24);
  }else if(id==='patrick'){
    const arm=action?-13+recoil*14:4+step-raise*10;
    shape(ctx,[[0,-28],[8,-15],[13,-3],[30,arm],[25,8+arm*.23],[14,7],[16-step,25],[5,23],[0,16],[-5,24],[-16+step,25],[-14,7],[-28,13-step],[-30,7-step],[-13,-4],[-8,-19]],surface(ctx,-28,25,'#ffc4cf','#e86f99'),OUTLINE,2.3);
    shape(ctx,[[-14,10],[14,10],[16-step,24],[5,23],[0,17],[-5,24],[-16+step,24]],surface(ctx,10,24,'#c7ef79','#78af4e'),OUTLINE,1.4);
    flower(ctx,-10,17,3.6,'#a776ce');flower(ctx,10,15,3.2,'#a776ce');
    shape(ctx,[[-8,1],[-11,5],[-11,8]],null,'#ffbbce',1.7);
    oval(ctx,1,7,1.65,1,'#ba6388');
    gaze(-4,-9,4.5,6,'#6fbdde');gaze(5,-9,4.5,6,'#6fbdde');smile(ctx,1,0,7);
    if(splash){
      shape(ctx,[[28,-11],[40,-37]],null,OUTLINE,4);
      oval(ctx,43,-42,12,8,null,'#f5b9a0',2.2);
      shape(ctx,[[32,-42],[42,-26],[54,-42],[46,-32],[39,-34],[34,-43]],null,'#b5e9d8',1);
    }else if(action&&showWeapon&&kick>.21){
      shape(ctx,[[24,arm-7],[32,arm-10],[36,arm-4],[32,arm+3],[24,arm+1]],'#cbacc0',OUTLINE,1.5);
    }
  }else if(id==='squid'){
    shape(ctx,[[-16,3],[-19,13-step],[-24,13-step-raise*8]],null,'#7eb8ad',5);
    shape(ctx,[[15,3],[20,10+step],[25,action?1:10+step]],null,'#91cabb',5);
    box(ctx,-15,0,29,13,4,surface(ctx,0,13,'#dbae77','#a66e58'),OUTLINE);
    for(const [i,n] of [-12,-4,4,12].entries()){
      const bend=(i%2?step:-step)*.78;
      shape(ctx,[[n,12],[n+bend,22],[n+bend+3,25]],null,'#86cbbc',4.5);
    }
    oval(ctx,0,-12,18,14,surface(ctx,-27,2,'#b3ecce','#6eb8ad'),OUTLINE);
    arcLine(ctx,0,-12,15,11,3.65,4.83,'#ccf3d8',1.2);
    for(const n of [-11,-7,-4])oval(ctx,n,-18-(n+11)*.2,1.4,1,'#689f99');
    gaze(-5,-5,5,7,'#b6596c');gaze(6,-5,5,7,'#b6596c');
    oval(ctx,3,2,4,8,'#77b6a7',OUTLINE,1.6);shape(ctx,[[-8,8],[-3,6],[8,6]],null,OUTLINE,1.4);
    if(action&&showWeapon){
      shape(ctx,[[9,4],[29,8-recoil*6]],null,'#14273f',5);
      oval(ctx,29,8-recoil*6,3.4,2.3,'#b3a0df',OUTLINE,1.2);
      oval(ctx,19,6-recoil*3,1.6,1.6,'#f6d8a4');
    }
  }else if(id==='sandy'){
    box(ctx,-13,5,26,20,6,surface(ctx,5,25,'#fff7dc','#b7dbe6'),OUTLINE);
    box(ctx,-20,4-step,8,13,3,'#f2f2e2',OUTLINE);box(ctx,12,4+step-raise*10,8,13,3,'#f2f2e2',OUTLINE);
    box(ctx,-13+step,20,10,7,2,'#b7dbe6',OUTLINE);box(ctx,3-step,20,10,7,2,'#b7dbe6',OUTLINE);
    oval(ctx,0,-9,19,19,surface(ctx,-29,10,'#d4fff8','#65b4d1'),OUTLINE);oval(ctx,0,-8,15,14,surface(ctx,-22,6,'#f3bc8e','#c48470'),OUTLINE,1.4);
    oval(ctx,-8,-17,4,4,'#ba775e');oval(ctx,9,-17,4,4,'#ba775e');
    gaze(-5,-10,5,6,'#986045');gaze(5,-10,5,6,'#986045');oval(ctx,1,-4,9,5,'#f2cc9f');oval(ctx,1,-7,3,1.6,OUTLINE);smile(ctx,1,-2,5);
    arcLine(ctx,0,-9,17,17,3.25,4.45,'#dcfffb',1.9);
    oval(ctx,-12,-20,2.3,4.2,'#ebfff7');oval(ctx,11,-23,5,5,'#f679b3',OUTLINE,1);oval(ctx,11,-23,2,2,'#ffe25f');
    box(ctx,-4,13,9,4,1,'#84b6bd',OUTLINE,.8);
    if(action&&showWeapon){
      const netY=-25+recoil*24;
      shape(ctx,[[18,10],[36,netY]],null,'#c59b67',3.6);
      oval(ctx,37,netY-3,9,6,null,'#e2ffed',1.7);
      shape(ctx,[[29,netY-2],[36,netY+8],[45,netY-3],[40,netY+3],[34,netY+1]],null,'#72ded3',1.2);
    }
  }else if(id==='krabs'){
    for(const n of [-10,10])shape(ctx,[[n,14],[n+step,24],[n+step+3,25]],null,'#df706f',5);
    const clawLift=raise*7+recoil*13;
    for(const side of [-1,1]){
      const n=side*24,offset=side*step*.46-(side===1?clawLift:0);
      shape(ctx,[[side*12,3],[n,-7+offset]],null,'#e96065',5);
      shape(ctx,[[n,-7+offset],[n-side*7,-15+offset],[n-side*4,-21+offset],[n,-15+offset],
        [n+side*4,-19+offset],[n+side*8,-12+offset],[n+side*3,-6+offset]],surface(ctx,-22+offset,-6+offset,'#ffac8a','#ed6467'),OUTLINE,1.5);
      shape(ctx,[[n+side*4,-15+offset],[n+side*5,-12+offset],[n+side*2,-9+offset]],null,'#ffd19db7',1);
    }
    oval(ctx,0,5,17,13,surface(ctx,-8,18,'#ff9172','#d94f60'),OUTLINE);
    box(ctx,-16,8,32,12,4,surface(ctx,8,20,'#b3dcf0','#578eac'),OUTLINE);
    box(ctx,-15,14,30,3,1,'#34556f');box(ctx,-3,13,6,5,1,'#f1c37c',OUTLINE,.9);
    gaze(-6,-10,4.4,14,'#82bbaa');gaze(6,-10,4.4,14,'#82bbaa');smile(ctx,0,4,8);
  }else{
    oval(ctx,0,15,24+stride*step*.65,8-lift*.4,surface(ctx,7,24,'#b4f5ed','#65a9cb'),OUTLINE);
    oval(ctx,-4+step*.27,0,16,18,surface(ctx,-18,18,'#ffb4c8','#dc65ac'),OUTLINE);
    ctx.beginPath();ctx.moveTo(-13,3);ctx.bezierCurveTo(-18,-14,9,-16,5,1);ctx.bezierCurveTo(2,12,-12,5,-6,-3);ctx.quadraticCurveTo(1,-6,1,0);ctx.strokeStyle='#ad4b9b';ctx.lineWidth=2.5;ctx.stroke();
    arcLine(ctx,-4+step*.27,0,13,15,3.40,4.95,'#ffe1ef',1.6);
    const sway=step*.43+raise*3;
    shape(ctx,[[15,13],[16+sway,-13],[23+sway,-15],[22,14]],surface(ctx,-15,14,'#c8f8f0','#66a9cb'),OUTLINE,1.5);
    gaze(15+sway,-14,4.3,5,'#d58a39');gaze(23+sway,-15,4.3,5,'#d58a39');
    if(action&&showWeapon)oval(ctx,25,8,4+recoil*4,4+recoil*4,'#b4f7f75a','#e2fff5',1.5);
  }
  ctx.restore();
}

function drawSpatula(ctx,x,y,rotation) {
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);
  box(ctx,-2,-14,4,21,2,'#a26b4b',OUTLINE,1);
  box(ctx,-7,-26,14,15,3,surface(ctx,-26,-11,'#fff2c0','#cf975a'),OUTLINE,1.7);
  for(const a of [-3,0,3])shape(ctx,[[a,-23],[a,-17]],null,'#79635b',1.2);
  shape(ctx,[[-5,-24],[-5,-21]],null,'#fffce0',1.15);
  ctx.restore();
}

function drawEnemy(ctx,e,t) {
  const {x,y,size:r,color}=e;
  const robot=e.type==='robot'||e.attack==='burst';
  const ghost=e.attack==='charge';
  const swift=e.type==='blue';
  const spitter=e.type==='spitter';
  const rushing=e.rush>0;
  const charging=e.windup>0;
  const enraged=e.boss&&e.hp<=e.maxHp*.5;
  const cycle=t*(swift?12:robot?5:7)+(e.phase??x*.03);
  const bob=Math.sin(cycle);
  const entry=e.entered===undefined?1:Math.min(1,e.entered/.32);
  const size=1-(1-entry)*(1-entry);
  ctx.save();ctx.translate(x,y);ctx.lineCap='round';ctx.lineJoin='round';
  ctx.globalAlpha*=size;
  if(e.boss){
    oval(ctx,0,r*.65,r*1.20,r*.37,'#141d3e66',enraged?'#ff9a987c':'#e2f8ed58',1.8);
  }else{
    oval(ctx,0,r*.64,r*.83,r*.24,'#04233180');
  }
  ctx.translate(0,bob*r*(robot?.045:.14)-(1-size)*r*.42);
  if(rushing)ctx.rotate(Math.cos(e.rushAngle??0)*.18);
  if(e.flash>0)ctx.rotate(Math.sin(e.flash*48)*.10);
  const pulse=charging?.06:.04;
  ctx.scale((1+bob*pulse+(rushing?.10:0))*size,(1-bob*pulse*1.5)*size);
  const shade=robot?'#368889':ghost?'#35a59e':swift?'#287cab':spitter?'#66539b':'#bb548c';
  const fill=e.flash>0?'#fff7d7':surface(ctx,-r*.77,r*.42,color,shade);
  const lens=charging||enraged?'#fff0ab':ghost?'#defff4':'#e7faff';
  if(robot){
    const edge=r*.71,foot=r*.22;
    for(const side of [-1,1]){
      const point=side*(edge+r*.12),beat=bob*side*r*.11;
      box(ctx,point-r*.16,-r*.37+beat,r*.31,r*.63,r*.12,'#3c8f95',OUTLINE,2);
      box(ctx,side*r*.44-foot/2,r*.47+beat,foot,r*.38,r*.08,'#246477',OUTLINE,2);
      box(ctx,side*r*.44-foot,r*.75+beat,foot*2,r*.15,r*.06,'#599da5',OUTLINE,1.85);
    }
    box(ctx,-edge,-r*.74,edge*2,r*1.36,r*.18,fill,OUTLINE,2.8);
    shape(ctx,[[-r*.49,-r*.64],[r*.32,-r*.64],[r*.52,-r*.52]],null,'#c9faf594',1.5);
    box(ctx,-r*.53,-r*.43,r*1.06,r*.55,r*.10,'#142c44',OUTLINE,1.5);
    const light=charging||enraged?'#fff1a6':'#ff889b';
    box(ctx,-r*.39,-r*.28,r*.78,r*.10,r*.04,light);
    for(const side of [-1,1])oval(ctx,side*r*.25,r*.35,r*.068,r*.068,'#28566b');
    oval(ctx,0,r*.33,r*.13,r*.13,light,OUTLINE,1.4);
    shape(ctx,[[0,-r*.74],[r*.09,-r*1.02]],null,OUTLINE,2);
    oval(ctx,r*.09,-r*1.02,r*.09,r*.09,light,OUTLINE,1.35);
    if(e.boss){
      for(const side of [-1,1]){
        box(ctx,side*r*.86-r*.19,-r*.42,r*.38,r*.33,r*.09,'#487e84',OUTLINE,2.6);
        oval(ctx,side*r*.93,-r*.27,r*.13,r*.09,light,OUTLINE,2);
      }
    }
  }else if(ghost){
    const tail=.9+bob*.18+(rushing?.30:0);
    ctx.beginPath();ctx.moveTo(-r*.86,r*.43);
    ctx.bezierCurveTo(-r*.97,-r*.4,-r*.58,-r*.76,0,-r*.78);
    ctx.bezierCurveTo(r*.84,-r*.82,r*.91,-r*.20,r*.64,r*.16);
    ctx.quadraticCurveTo(r*.27,r*.58,r*tail,r*.90);
    ctx.quadraticCurveTo(r*.28,r*1.17,-r*.12,r*.52);
    ctx.quadraticCurveTo(-r*.42,r*.22,-r*.86,r*.44);
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=OUTLINE;ctx.lineWidth=3;ctx.stroke();
    shape(ctx,[[-r*.44,-r*.62],[-r*.28,-r*.96],[r*.20,-r*1.05],[r*.46,-r*.64]],'#326c75',OUTLINE,2.5);
    shape(ctx,[[-r*.31,-r*.67],[r*.35,-r*.68]],null,'#8bded5',2.1);
    oval(ctx,-r*.19,-r*.15,r*.15,r*.13,lens,OUTLINE,2);
    oval(ctx,r*.19,-r*.15,r*.15,r*.13,lens,OUTLINE,2);
    smile(ctx,0,r*.12,r*.35);
    arcLine(ctx,0,-r*.24,r*.66,r*.43,3.22,4.35,'#ddfff2',1.8);
  }else{
    const arms=swift?[-.32,.32]:[-.56,-.19,.19,.56];
    const height=swift?.77:spitter?1.06:1;
    for(const n of arms){
      const bend=Math.sin(cycle+n*4)*.24,tip=swift?1.08:spitter?.76:.89;
      ctx.beginPath();ctx.moveTo(r*n,r*.07);
      ctx.bezierCurveTo(r*(n+bend),r*.38,r*(n-bend*.76),r*.68,r*(n+bend),r*tip);
      ctx.strokeStyle=OUTLINE;ctx.lineWidth=r*.19;ctx.stroke();
      ctx.strokeStyle=color;ctx.lineWidth=r*.09;ctx.stroke();
    }
    ctx.beginPath();ctx.moveTo(-r,0);
    ctx.bezierCurveTo(-r*height,-r*1.20*height,r*height,-r*1.20*height,r,0);
    ctx.bezierCurveTo(r*.82,r*.43,-r*.82,r*.42,-r,0);
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    ctx.strokeStyle=OUTLINE;ctx.lineWidth=e.boss?3:2;ctx.stroke();
    arcLine(ctx,0,-r*.04,r*.80,r*.55*height,3.52,4.84,'#fff1f1ad',Math.max(1,r*.065));
    oval(ctx,r*.43,-r*.32,r*.085,r*.075,'#fff9');
    oval(ctx,-r*.26,r*.09,r*.073,r*.10,OUTLINE);oval(ctx,r*.26,r*.09,r*.073,r*.10,OUTLINE);
    if(swift)shape(ctx,[[-r*.19,-r*.15],[-r*.26,-r*.01],[-r*.08,-r*.04]],null,'#e2f8f6',1.3);
    if(spitter){
      oval(ctx,0,r*.09,r*.19,r*.17,charging?'#fff1ab':'#753763',OUTLINE,1.7);
      oval(ctx,0,r*.04,r*.07,r*.052,charging?'#fffdeb':'#ce96e3');
    }
    if(e.boss){
      const metal=e.attack==='mixed'?'#fff0a0':'#ffcf63';
      shape(ctx,[[-r*.42,-r*.69],[-r*.54,-r*1.18],[-r*.18,-r*.98],[0,-r*1.31],
        [r*.21,-r*.99],[r*.52,-r*1.2],[r*.42,-r*.69]],metal,OUTLINE,2.6);
      oval(ctx,0,-r*.84,r*.098,r*.10,enraged?'#ff6c93':'#9deddf',OUTLINE,1.5);
      shape(ctx,[[-r*.32,-r*.03],[-r*.14,r*.04]],null,lens,1.65);
      shape(ctx,[[r*.32,-r*.03],[r*.14,r*.04]],null,lens,1.65);
    }
  }
  ctx.restore();
}

function seeded(seed) {
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
}

function flower(ctx,x,y,r,color) {
  ctx.save();ctx.translate(x,y);ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,r*.065);
  for(let i=0;i<5;i++){ctx.rotate(TAU/5);ctx.beginPath();ctx.ellipse(0,-r*.52,r*.25,r*.46,0,0,TAU);ctx.stroke()}
  ctx.restore();
}

function kelp(ctx,x,y,h,color,side=1) {
  ctx.save();ctx.translate(x,y);ctx.scale(side,1);ctx.fillStyle=color;
  for(let i=0;i<4;i++){
    const a=(i-1.4)*h*.19;
    ctx.beginPath();ctx.moveTo(a*.23,0);ctx.bezierCurveTo(a-h*.25,-h*.34,a+h*.27,-h*.67,a,-h*(.55+i*.13));
    ctx.bezierCurveTo(a+h*.5,-h*.61,a-h*.03,-h*.25,a*.24+h*.12,0);ctx.fill();
  }
  ctx.restore();
}

function pineapple(ctx,x,y,s) {
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.lineJoin='round';
  oval(ctx,0,1,39,8,'#0c344b69');
  for(const a of [-1,-.49,.06,.67,1]){
    shape(ctx,[[a*14,-70],[a*38,-95+Math.abs(a)*12],[a*20+9,-74]],'#49a58a','#164d60',1.5);
  }
  oval(ctx,0,-37,33,43,surface(ctx,-78,6,'#f0b373','#a36153'),'#243c4c',3);
  ctx.save();ctx.beginPath();ctx.ellipse(0,-37,31,41,0,0,TAU);ctx.clip();
  for(let i=-5;i<7;i++){shape(ctx,[[i*13,-85],[i*13+69,-2]],null,'#aa6649',2);shape(ctx,[[i*13,-85],[i*13-69,-2]],null,'#f1ac60',2);}
  ctx.restore();
  oval(ctx,13,-45,9,10,'#4a6370','#263c50',2);
  oval(ctx,13,-45,5.7,7,'#9af2de','#233944',1.7);
  arcLine(ctx,13,-45,4,5.4,3.20,4.45,'#fff7dc',1.4);
  box(ctx,-12,-27,24,32,9,surface(ctx,-27,4,'#4c9c9e','#21546e'),'#203e50',3);
  box(ctx,-16,4,32,3,1,'#6cc3b4','#203e50',1);
  oval(ctx,5,-10,2,2,'#edc87e');
  ctx.restore();
}

function diner(ctx,x,y,s) {
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  oval(ctx,0,1,56,7,'#211c3a64');
  box(ctx,-49,-55,98,58,3,surface(ctx,-55,3,'#bb805d','#725154'),'#382b43',3);
  for(const floor of [-39,-27,-14])shape(ctx,[[-46,floor],[46,floor]],null,'#6b4b53',1);
  shape(ctx,[[-55,-55],[-39,-75],[39,-75],[55,-55]],surface(ctx,-76,-54,'#d8a26b','#986350'),'#382b43',3);
  shape(ctx,[[-45,-57],[-36,-70],[35,-70],[44,-57]],null,'#ffd294a7',1.5);
  for(const left of [-41,-23,10,28]){
    box(ctx,left,-49,13,26,2,surface(ctx,-49,-23,'#ffe9a3','#e6a868'),'#523a42',2);
    shape(ctx,[[left+6.5,-48],[left+6.5,-24],[left+2,-24]],null,'#b77856',1);
  }
  box(ctx,-11,-45,22,47,6,surface(ctx,-45,2,'#5fa6ab','#32637a'),'#44384a',2.1);
  box(ctx,-6,-40,12,18,2,'#9dead9','#355369',1.6);
  oval(ctx,6,-12,1.4,1.4,'#ffdfa4');
  shape(ctx,[[0,-74],[0,-94],[27,-85],[0,-80]],'#eaaa9e','#442e46',2);
  ctx.restore();
}

function coral(ctx,x,y,height,color,side=1) {
  ctx.save();ctx.translate(x,y);ctx.scale(side,1);ctx.lineCap='round';ctx.lineJoin='round';
  const stem=[[0,0],[height*.05,-height*.42],[-height*.04,-height*.68],[height*.16,-height]];
  const left=[[height*.05,-height*.42],[-height*.30,-height*.56],[-height*.38,-height*.83]];
  const right=[[-height*.04,-height*.68],[height*.42,-height*.74],[height*.50,-height*.91]];
  for(const branch of [stem,left,right])shape(ctx,branch,null,color,Math.max(1,height*.11));
  ctx.restore();
}

function arenaLamp(ctx,x,y,s=1) {
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  const halo=ctx.createRadialGradient(0,-27,3,0,-27,47);
  halo.addColorStop(0,'#ffdd9738');halo.addColorStop(1,'#ffdd9700');
  ctx.fillStyle=halo;ctx.fillRect(-48,-75,96,96);
  oval(ctx,3,0,10,3,'#142c4f6e');
  shape(ctx,[[0,0],[0,-26]],null,'#152f3f',3.6);
  shape(ctx,[[1,-2],[1,-23]],null,'#679092',.9);
  oval(ctx,0,-27,5,5,'#f9d795','#365665',1.5);
  oval(ctx,-1,-28,1.6,1.3,'#fff5c8');
  ctx.restore();
}

function stoneHouse(ctx,x,y,s) {
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.lineJoin='round';
  oval(ctx,3,2,45,10,'#112b456e');
  shape(ctx,[[-31,1],[-36,-22],[-31,-51],[-35,-74],[-28,-116],[-13,-128],[21,-127],
    [32,-111],[31,-78],[36,-50],[31,-24],[32,1]],surface(ctx,-128,2,'#729ea7','#3d6779'),'#143b52',3);
  shape(ctx,[[-31,-20],[-34,-47],[-28,-76],[-29,-111],[-15,-123],[20,-123]],null,'#acd3cb7b',1.8);
  for(const side of [-1,1]){
    const n=side*15;
    shape(ctx,[[n-9,-88],[n+7,-91],[n+8,-82],[n-8,-79]],'#3a5b70','#254c64',1.5);
    box(ctx,n-6,-85,12,5,1.4,'#9dd6ca');
  }
  shape(ctx,[[-5,-72],[5,-73],[10,-49],[-5,-43],[-10,-47]],'#86a6ad','#34586c',2.3);
  shape(ctx,[[-25,-39],[-16,-42],[-12,-39]],null,'#587483',1.45);
  shape(ctx,[[20,-26],[29,-33],[31,-40]],null,'#31586b',1.45);
  box(ctx,-12,-24,24,26,10,'#23475e','#22415b',2.6);
  oval(ctx,6,-9,1.5,1.5,'#e8ca89');
  ctx.restore();
}

function roundShelter(ctx,x,y,s) {
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.lineJoin='round';
  oval(ctx,6,0,59,10,'#122b466e');
  ctx.beginPath();ctx.moveTo(-51,1);ctx.bezierCurveTo(-54,-25,-39,-55,-10,-61);
  ctx.bezierCurveTo(21,-67,52,-41,52,1);ctx.closePath();ctx.fillStyle=surface(ctx,-63,1,'#c99a83','#775f64');
  ctx.fill();ctx.strokeStyle='#33455d';ctx.lineWidth=3;ctx.stroke();
  arcLine(ctx,0,-1,47,54,3.27,4.69,'#f3c5a47e',2.1);
  shape(ctx,[[30,-39],[23,-30],[30,-22],[27,-15]],null,'#675762',1.5);
  shape(ctx,[[-21,-45],[-14,-28],[-22,-20]],null,'#9a756c',1.6);
  box(ctx,-11,-15,22,17,5,'#333e55','#58616d',1.85);
  shape(ctx,[[8,-60],[11,-77],[3,-83]],null,'#3c5165',2.4);
  oval(ctx,3,-83,2.5,2.5,'#e4c090');
  ctx.restore();
}

function reefCapsule(ctx,x,y,s) {
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.lineJoin='round';
  oval(ctx,6,2,76,12,'#10173470');
  shape(ctx,[[-50,-4],[-51,3],[-26,3],[-26,-7],[30,-7],[31,3],[56,3],[55,-4]],'#322a46','#222942',2);
  box(ctx,-68,-59,136,59,26,surface(ctx,-59,0,'#8f749e','#4b4870'),'#222942',3.2);
  shape(ctx,[[-27,-54],[42,-54],[57,-44]],null,'#c89bb79c',2);
  box(ctx,-24,-47,80,25,8,'#40486e','#252940',2.1);
  for(const offset of [-17,7,31]){
    box(ctx,offset,-42,18,15,4,surface(ctx,-43,-27,'#a4ead2','#5ea49f'),'#344a6c',1.8);
    shape(ctx,[[offset+3,-39],[offset+7,-39]],null,'#e9f6de',1.3);
  }
  oval(ctx,-44,-29,10,10,'#c098b1','#303654',2.1);
  oval(ctx,-44,-29,5.5,5.5,'#4d5374','#e4b4c4',1.1);
  shape(ctx,[[44,-59],[44,-76],[59,-81]],null,'#303955',2.7);
  oval(ctx,59,-81,3.2,3.2,'#eed8af','#342b4b',1.3);
  ctx.restore();
}

function arenaGround(ctx,map) {
  const ground=ctx.createLinearGradient(30,25,1030,870);
  ground.addColorStop(0,map.colors[1]);ground.addColorStop(.48,map.colors[0]);ground.addColorStop(1,map.colors[1]);
  ctx.fillStyle=ground;ctx.fillRect(0,0,1200,900);
  const light=ctx.createRadialGradient(560,430,30,560,430,720);
  light.addColorStop(0,map.colors[2]+'16');light.addColorStop(.74,map.colors[2]+'03');light.addColorStop(1,'#111b3a4b');
  ctx.fillStyle=light;ctx.fillRect(0,0,1200,900);
}

function townArena(ctx) {
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(-34,626);
  ctx.bezierCurveTo(245,559,371,730,605,690);
  ctx.bezierCurveTo(792,655,928,613,1234,714);
  ctx.strokeStyle='#174758';ctx.lineWidth=77;ctx.stroke();
  ctx.strokeStyle='#5683835c';ctx.lineWidth=65;ctx.stroke();
  ctx.strokeStyle='#b3d0ad24';ctx.lineWidth=2;ctx.setLineDash([18,29]);ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(122,149);
  ctx.bezierCurveTo(408,296,648,312,1074,227);
  ctx.strokeStyle='#1c4759';ctx.lineWidth=70;ctx.stroke();
  ctx.strokeStyle='#669c9661';ctx.lineWidth=59;ctx.stroke();
  ctx.restore();
  oval(ctx,584,484,302,151,'#34787938','#7eaaa72f',2.6);
  oval(ctx,584,484,288,139,null,'#7eaaa72c',1.5);
  flower(ctx,584,476,48,'#7eb3a823');
  for(const [x,y,scale] of [[310,274,.91],[451,299,1.0],[778,276,1.03],[940,252,.89],[198,650,.75],[1019,704,.8]]){
    arenaLamp(ctx,x,y,scale);
  }
  roundShelter(ctx,374,272,1.03);
  stoneHouse(ctx,536,289,1.05);
  pineapple(ctx,676,285,1.49);
  diner(ctx,968,251,1.17);
  stoneHouse(ctx,150,497,.81);pineapple(ctx,1058,558,.94);
  roundShelter(ctx,410,820,.94);reefCapsule(ctx,815,835,.86);
}

function jellyArena(ctx) {
  ctx.beginPath();ctx.moveTo(405,122);
  ctx.bezierCurveTo(470,201,740,205,841,178);
  ctx.bezierCurveTo(965,154,1006,315,938,430);
  ctx.bezierCurveTo(864,557,949,701,779,749);
  ctx.bezierCurveTo(578,774,537,710,404,739);
  ctx.bezierCurveTo(254,758,200,584,258,494);
  ctx.bezierCurveTo(318,401,161,192,405,122);ctx.closePath();
  ctx.fillStyle='#b97bab26';ctx.fill();ctx.strokeStyle='#c49abb37';ctx.lineWidth=3;ctx.stroke();
  for(const [x,y,r] of [[388,370,62],[651,276,77],[815,593,48],[450,601,54],[575,532,45]]){
    oval(ctx,x,y,r,r*.45,'#ad88c51f','#dbabd225',1.8);
    oval(ctx,x,y,r*.82,r*.35,null,'#d8a9cf22',1.2);
  }
  const ridge=[[30,200,57],[185,150,78],[304,232,58],[938,204,68],[1118,289,82],
    [87,631,83],[213,737,57],[1017,706,63],[1129,778,42]];
  for(const [x,y,r] of ridge){
    oval(ctx,x+6,y,r*.78,r*.21,'#261d3f69');
    shape(ctx,[[x-r*.66,y],[x-r*.71,y-r*.36],[x-r*.32,y-r*.83],[x+r*.34,y-r*.96],
      [x+r*.59,y-r*.62],[x+r*.77,y-r*.07],[x+r*.35,y+r*.11]],
      surface(ctx,y-r,y,'#7d658e','#403b64'),'#30274e',2.4);
    shape(ctx,[[x-r*.63,y-r*.32],[x-r*.33,y-r*.77],[x+r*.32,y-r*.89]],null,'#bd99b888',1.8);
    for(const side of [-1,1])coral(ctx,x+side*r*.55,y+r*.13,r*.54,'#ba82a784',side);
  }
  reefCapsule(ctx,680,230,1.2);reefCapsule(ctx,321,767,.91);
  arenaLamp(ctx,549,234,.94);arenaLamp(ctx,783,231,.88);arenaLamp(ctx,438,768,.79);
}

function dinerArena(ctx) {
  ctx.save();
  ctx.beginPath();ctx.moveTo(213,209);ctx.lineTo(986,209);
  ctx.quadraticCurveTo(1008,211,1017,245);ctx.lineTo(1065,703);
  ctx.quadraticCurveTo(1066,733,1030,749);ctx.lineTo(170,749);
  ctx.quadraticCurveTo(136,741,139,707);ctx.lineTo(188,239);
  ctx.quadraticCurveTo(192,215,213,209);ctx.closePath();
  ctx.fillStyle=surface(ctx,212,753,'#9c785e74','#4c3a557c');ctx.fill();
  ctx.strokeStyle='#edb98160';ctx.lineWidth=6;ctx.stroke();ctx.clip();
  for(let row=0;row<19;row++){
    const y=217+row*30;
    ctx.fillStyle=row%2?'#f6c59312':'#44294019';ctx.fillRect(135,y,936,27);
    shape(ctx,[[137,y+29],[1070,y+29]],null,'#412d4770',1.2);
    for(let x=184+row%2*95;x<1080;x+=190)shape(ctx,[[x,y],[x,y+27]],null,'#4d3a4b4d',1);
  }
  ctx.restore();
  oval(ctx,596,489,263,143,'#6c536e20','#f1bb8740',2.4);
  oval(ctx,596,489,254,134,null,'#e4af8732',1.25);
  diner(ctx,599,257,2.35);
  arenaLamp(ctx,450,275,1.02);arenaLamp(ctx,749,275,1.02);
  for(const [x,y] of [[267,299],[306,692],[899,690],[927,306]]){
    oval(ctx,x+8,y+12,29,11,'#362d4e57');
    oval(ctx,x,y,28,20,'#a5785a','#553e53',2);
    oval(ctx,x,y-2,22,14,null,'#d2a2798a',1.6);
    box(ctx,x-7,y-11,15,8,3,'#566d7e','#4d455c',1.5);
    coral(ctx,x+2,y-5,14,'#94b8aa');
    for(const side of [-1,1]){
      box(ctx,x+side*34-5,y-6,12,12,3,'#725866','#4d3f57',1.4);
    }
  }
  reefCapsule(ctx,312,191,.88);roundShelter(ctx,940,200,.82);
  arenaLamp(ctx,251,745,.82);arenaLamp(ctx,952,745,.82);
}

function drawArena(ctx,w,h,map=MAPS[0]) {
  ctx.save();ctx.scale(w/1200,h/900);
  arenaGround(ctx,map);
  const rand=seeded([...map.id].reduce((sum,part)=>sum*31+part.charCodeAt(0),71));
  for(let i=0;i<460;i++){
    const x=rand()*1200,y=rand()*900,r=.65+rand()*1.5;
    oval(ctx,x,y,r,r*.62,i%3?map.colors[2]+'20':'#14274445');
  }
  if(map.id==='jelly')jellyArena(ctx);
  else if(map.id==='krusty')dinerArena(ctx);
  else townArena(ctx);
  for(let i=0;i<22;i++){
    const left=i%2===0;
    const x=left?14+rand()*148:1038+rand()*148,y=22+i*38+rand()*59;
    const size=12+rand()*36;
    if(i%3===0)kelp(ctx,x,y,size,'#164d5880',left?1:-1);
    else coral(ctx,x,y,size,map.colors[2]+'53',left?1:-1);
    oval(ctx,x+size*.4,y+5,size*.24,size*.10,'#23395475');
  }
  for(let i=0;i<17;i++){
    const x=rand()*1200,y=i%2?21+rand()*53:825+rand()*55,r=11+rand()*19;
    oval(ctx,x,y,r,r*.26,'#263d575d');
  }
  ctx.strokeStyle=map.colors[2]+'49';ctx.lineWidth=2;
  ctx.strokeRect(9,9,1182,882);
  ctx.strokeStyle='#12233c62';ctx.lineWidth=10;
  ctx.strokeRect(1,1,1198,898);
  ctx.restore();
}

function drawScenery(ctx,w,h,map=MAPS[0],hero=false) {
  const rand=seeded(map.id.length*19);
  const gradient=ctx.createLinearGradient(0,0,0,h);
  gradient.addColorStop(0,map.colors[1]);gradient.addColorStop(.58,map.colors[0]);gradient.addColorStop(1,'#193846');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  const reflection=ctx.createRadialGradient(w*.76,0,0,w*.76,0,w*.72);
  reflection.addColorStop(0,map.colors[2]+'52');reflection.addColorStop(1,map.colors[2]+'00');
  ctx.fillStyle=reflection;ctx.fillRect(0,0,w,h);
  for(let i=0;i<6;i++){
    const x=(.19+i*.14)*w;
    shape(ctx,[[x,0],[x+w*.09,0],[x-w*.12,h],[x-w*.27,h]],'#a4f9e309');
  }
  for(let i=0;i<6;i++) flower(ctx,w*(.10+rand()*.87),h*(.09+rand()*.42),h*(.035+rand()*.105),map.colors[2]+'36');
  for(let i=0;i<17;i++){
    const x=rand()*w,y=rand()*h*.93,r=1+rand()*h*.019;
    oval(ctx,x,y,r,r,null,'#80ebf359',1.1);
    oval(ctx,x-r*.25,y-r*.27,r*.21,r*.17,'#afdfe788');
  }
  for(let i=0;i<11;i++)kelp(ctx,i*w/10,h*.87,h*(.10+rand()*.33),i%2?'#286f7966':map.colors[2]+'34',i%2?1:-1);
  const floor=map.id==='krusty'?'#694750':map.id==='jelly'?'#4d3b68':'#317477';
  ctx.beginPath();ctx.moveTo(0,h*.81);ctx.quadraticCurveTo(w*.42,h*.62,w,h*.85);ctx.lineTo(w,h);ctx.lineTo(0,h);
  ctx.fillStyle=surface(ctx,h*.69,h,map.colors[0],floor);ctx.fill();
  const pathColor=map.id==='krusty'?'#be8976':map.id==='jelly'?'#9b7296':'#7ca89c';
  ctx.beginPath();ctx.moveTo(w*.37,h);ctx.quadraticCurveTo(w*.70,h*.87,w*.73,h*.79);
  ctx.quadraticCurveTo(w*.76,h*.80,w*.81,h*.83);ctx.quadraticCurveTo(w*.83,h*.90,w*.73,h);
  ctx.fillStyle=surface(ctx,h*.78,h,pathColor,floor);ctx.fill();
  if(map.id==='town'){pineapple(ctx,w*.64,h*.83,h/150);pineapple(ctx,w*.91,h*.81,h/235)}
  if(map.id==='krusty')diner(ctx,w*.63,h*.87,h/114);
  if(map.id==='jelly'||hero){
    for(const [x,y,s] of [[.51,.40,.07],[.91,.25,.11],[.82,.10,.051],[.72,.50,.056]]){
      const glow=ctx.createRadialGradient(w*x,h*y,1,w*x,h*y,h*s*2.7);
      glow.addColorStop(0,'#ff78d278');glow.addColorStop(1,'#ff78d200');ctx.fillStyle=glow;
      ctx.fillRect(w*x-h*s*3,h*y-h*s*3,h*s*6,h*s*6);
      const swift=s<.060;
      drawEnemy(ctx,{x:w*x,y:h*y,size:h*s,color:swift?'#83d4f5':'#f582c3',type:swift?'blue':'jelly'},0);
    }
  }
  for(let i=0;i<6;i++){
    const x=w*(.07+.16*i),base=h*(.94+rand()*.09);
    coral(ctx,x,base,h*(.07+rand()*.11),i%2?map.colors[2]+'65':'#367e83cf',i%2?1:-1);
  }
  kelp(ctx,w*.98,h,h*.47,'#063a4c');kelp(ctx,w*.10,h,h*.20,'#073343',-1);
}

function drawSplash(canvas,backdrop) {
  const bounds=canvas.getBoundingClientRect();
  if(!bounds.width||!bounds.height)return;
  const dpi=Math.min(devicePixelRatio||1,2),w=bounds.width,h=bounds.height;
  canvas.width=Math.round(w*dpi);canvas.height=Math.round(h*dpi);
  const ctx=canvas.getContext('2d');ctx.scale(dpi,dpi);
  if(backdrop?.naturalWidth){
    const cover=Math.max(w/backdrop.width,h/backdrop.height);
    ctx.drawImage(backdrop,w-backdrop.width*cover,(h-backdrop.height*cover)*.52,backdrop.width*cover,backdrop.height*cover);
  }else drawScenery(ctx,w,h,MAPS[0],true);
  const mobile=w<630;
  const x=w*(mobile?.77:.70),y=h*(mobile?.61:.59),s=Math.min(h/101,w/(mobile?126:180));
  const glow=ctx.createRadialGradient(x,y,h*.06,x,y,h*.54);
  glow.addColorStop(0,'#65f6e046');glow.addColorStop(.62,'#368eb343');glow.addColorStop(1,'#59f9e300');
  ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(x+s*(mobile?19:29),y-s*14);ctx.rotate(.27);
  ctx.shadowColor='#12dabe';ctx.shadowBlur=16;drawHero(ctx,'patrick',0,0,s*.76,{splash:true});ctx.restore();
  ctx.save();ctx.translate(x-s*4,y+s*4);ctx.rotate(-.17);
  ctx.shadowColor='#ffe774';ctx.shadowBlur=14;drawHero(ctx,'sponge',0,0,s,{splash:true});ctx.restore();
  const rand=seeded(74);
  for(let i=0;i<22;i++){
    const dx=(rand()-.46)*s*107,dy=(rand()-.48)*s*83;
    if(Math.abs(dx)<s*24 && Math.abs(dy)<s*32)continue;
    const r=1+rand()*3;shape(ctx,[[x+dx-r*2,y+dy],[x+dx,y+dy-r],[x+dx+r*2,y+dy],[x+dx,y+dy+r]],i%2?'#f8dc75':'#71edda');
  }
  for(let i=0;i<7;i++){
    const bx=x+(rand()-.34)*s*110,by=y+(rand()-.50)*s*71;
    if(Math.abs(bx-x)<s*21&&Math.abs(by-y)<s*31)continue;
    const r=Math.max(1.6,s*(.48+rand()*.78));
    oval(ctx,bx,by,r,r,null,'#c5fff398',1.2);
    oval(ctx,bx-r*.28,by-r*.26,r*.17,r*.16,'#d7fff4a0');
  }
}
