const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const shuffle=items=>{
  const result=[...items];
  for(let i=result.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
};
const STORAGE='bikini-bottom-survivors-v1';
const RUN_STORAGE='bikini-bottom-wave-checkpoint-v1';
const readLocal=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const writeLocal=(key,value)=>{
  try{
    if(value===null)localStorage.removeItem(key);
    else localStorage.setItem(key,JSON.stringify(value));
    return true;
  }catch{return false}
};
const storedProfile=readLocal(STORAGE);
const validWave=value=>Number.isInteger(value)?clamp(value,0,20):0;
const savedIndex=(index,count)=>Number.isInteger(index)&&index>=0&&index<count?index:0;
const profile={
  unlocked:storedProfile?.unlocked===true,
  best:validWave(storedProfile?.best),
  records:DIFFICULTIES.map((_,i)=>validWave(storedProfile?.records?.[i])),
  music:storedProfile?.music!==false,
  sfx:storedProfile?.sfx!==false,
};
const save=()=>{
  const current=readLocal(STORAGE);
  profile.unlocked||=current?.unlocked===true;
  profile.best=Math.max(profile.best,validWave(current?.best));
  profile.records=profile.records.map((wave,i)=>Math.max(wave,validWave(current?.records?.[i])));
  writeLocal(STORAGE,{...profile,hero:selectedHero,map:selectedMap,difficulty:selectedDifficulty});
};
const audio=new SeaAudio(profile);
const modal=$('#modal'),content=$('#modal-content');
const field=$('#field'),ctx=field.getContext('2d');
const lobby=$('#lobby'),battle=$('#battle');
const world={w:1200,h:900};
const WAVE_SECONDS=60;
const MAX_WAVES=20;
const xpForLevel=level=>Math.round(85+level*28+level**1.35*8);
const skin=new Image();
const splash=$('#splash');
const touchInput=matchMedia('(any-pointer: coarse)');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const viewport={w:0,h:0,dpi:1,scale:1};
const camera={x:0,y:0};
const keys=new Set();
const joystick={id:null,x:0,y:0};
let selectedHero=profile.unlocked?savedIndex(storedProfile?.hero,HEROES.length):0;
let selectedMap=savedIndex(storedProfile?.map,MAPS.length);
let selectedDifficulty=savedIndex(storedProfile?.difficulty,DIFFICULTIES.length);
let checkpoint=readCheckpoint();
let run=null,dialogKind='',toastTimer,frame=0,previous=0,installPrompt,offlineReady=false,drawPaused=false;
let heroCards=[],mapCards=[],difficultyCards=[],waveTicks=[];

function readCheckpoint() {
  const saved=readLocal(RUN_STORAGE);
  if(!saved||typeof saved.id!=='string'||savedIndex(saved.hero,HEROES.length)!==saved.hero||
    savedIndex(saved.map,MAPS.length)!==saved.map||savedIndex(saved.difficulty,DIFFICULTIES.length)!==saved.difficulty||
    !Number.isInteger(saved.wave)||saved.wave<1||saved.wave>MAX_WAVES||!(saved.player?.hp>0))return null;
  return saved;
}

function notify(message) {
  const toast=$('#toast');
  toast.textContent=message;toast.hidden=false;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.hidden=true,2800);
}

function initializeLobby() {
  $('#characters').innerHTML=HEROES.map((hero,i)=>`<button class="character-card" style="--hero-color:${hero.color}" data-hero="${i}"><canvas width="128" height="102" aria-hidden="true"></canvas><span class="card-lock" aria-hidden="true">🔒</span>${hero.name}</button>`).join('');
  $$('.character-card canvas').forEach((canvas,i)=>{
    const c=canvas.getContext('2d'),hero=HEROES[i];
    oval(c,64,54,39,38,hero.color+'23',hero.color+'42',1.5);
    oval(c,64,86,29,6,'#0717258c');
    drawHero(c,hero.id,64,52,1.5);
  });
  $('#maps').innerHTML=MAPS.map((map,i)=>`<button class="map-card" data-map="${i}" title="${map.effect}"><canvas width="260" height="114" aria-hidden="true"></canvas><span>${map.name}</span></button>`).join('');
  $$('.map-card canvas').forEach((canvas,i)=>drawScenery(canvas.getContext('2d'),260,114,MAPS[i]));
  $('#difficulties').innerHTML=DIFFICULTIES.map((difficulty,i)=>`<button class="difficulty" data-difficulty="${i}">${difficulty.name}</button>`).join('');
  $('#wave-track').innerHTML=Array.from({length:20},(_,i)=>`<i${(i+1)%5===0?' class="boss-tick"':''}></i>`).join('');
  heroCards=$$('.character-card');mapCards=$$('.map-card');difficultyCards=$$('.difficulty');waveTicks=$$('#wave-track i');
}

function renderLobby() {
  const record=profile.records[selectedDifficulty];
  $('#record').textContent=record?`本难度纪录 ${record} / 20 波`:'最高纪录 '+profile.best+' / 20 波';
  heroCards.forEach((card,i)=>{
    const locked=i!==0&&!profile.unlocked;
    card.setAttribute('aria-pressed',String(i===selectedHero));
    card.setAttribute('aria-disabled',String(locked));
    card.title=locked?'通关浅海难度后解锁':HEROES[i].name;
    card.querySelector('.card-lock').hidden=!locked;
  });
  mapCards.forEach((card,i)=>card.setAttribute('aria-pressed',String(i===selectedMap)));
  difficultyCards.forEach((card,i)=>card.setAttribute('aria-pressed',String(i===selectedDifficulty)));
  const hero=HEROES[selectedHero],map=MAPS[selectedMap],weapon=WEAPONS[hero.weapon];
  $('#character-info').innerHTML=`<strong>${weapon.glyph} ${weapon.name}</strong><span class="pill">生命 ${hero.hp}</span><span class="pill">${hero.role}</span><span class="hero-perk">${hero.perk}</span>`;
  $('#selection').textContent=checkpoint
    ?`第 ${checkpoint.wave} 波${checkpoint.prep?'后整备':''} · ${HEROES[checkpoint.hero].name}`
    :hero.name+' · '+map.name+' · '+DIFFICULTIES[selectedDifficulty].name.split(' · ')[0];
  $('#selection-detail').textContent=checkpoint
    ?MAPS[checkpoint.map].name+' · '+DIFFICULTIES[checkpoint.difficulty].name.split(' · ')[0]
    :map.effect;
  $('#start').textContent=checkpoint?'继续上局':'开始战斗';
  $('#new-run').hidden=!checkpoint;
}

function syncAudio() {
  $$('[data-audio]').forEach(button=>{
    const channel=button.dataset.audio;
    button.setAttribute('aria-pressed',String(profile[channel]));
    button.title=(channel==='music'?'背景音乐':'攻击音效')+(profile[channel]?'已开启':'已关闭');
  });
  audio.sync();
}

function openDialog(kind,title,body,close=true) {
  dialogKind=kind;
  content.innerHTML=`<div class="dialog-head"><h2 id="modal-title">${title}</h2>${close?'<button class="icon-button" data-close aria-label="关闭">×</button>':''}</div>${body}`;
  if(!modal.open)modal.showModal();
  else (content.querySelector('button:not(:disabled)')||modal).focus();
  modal.scrollTop=0;
}

function closeDialog() {
  if(modal.open)modal.close();
  dialogKind='';
}

function showGuide() {
  const weapons=Object.values(WEAPONS).map(w=>`<div><strong>${w.glyph} ${w.name}</strong><small>${w.kind==='挥砍'?'近战':'远程'} · 伤害 ${w.damage} · 攻速 ${(1/w.rate).toFixed(2)} 次/秒 · 范围 ${w.range}</small></div>`).join('');
  const items=UPGRADES.map(u=>`<div><strong>${u.name}</strong><small>${u.label}</small></div>`).join('');
  openDialog('guide','玩法图鉴',`
    <p>拖动摇杆躲避敌人，武器会自动攻击。泡泡旋刃近身击退并减速敌人，水母风暴会跟随你连续放电。</p>
    <p>键盘支持 WASD 或方向键移动，空格释放小技能，Q 释放终极技能，Esc 暂停。</p>
    <p>每波存活 60 秒，第 5、10、15、20 波还须击败首领。击杀直接获得经验，路过礼包会自动拾取。</p>
    <p>波后统一升级、答题、升级武器和购买道具。浅海通关会解锁所有角色。战斗按波存档，整备选择会随操作保存。</p>
    <h3>武器</h3><div class="guide-list">${weapons}</div>
    <h3>强化道具</h3><div class="guide-list">${items}</div>`);
}

function showInstall() {
  const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  openDialog('install','在 iPhone 上游玩',`
    ${installed?'<p>你已在主屏幕应用中打开游戏。</p>':'<ol><li>用 iPhone 的 Safari 打开游戏链接。</li><li>打开 Safari 的分享菜单，点「添加到主屏幕」。</li><li>如果看到「作为网页 App 打开」，请将它开启，然后点「添加」。</li></ol>'}
    <p id="offline-status" role="status">${offlineReady?'离线资源已就绪。当前设备会保留战绩、解锁和每波存档。':'请联网从要使用的浏览器或主屏幕图标打开游戏，等离线资源准备完成。'}</p>
    <div class="dialog-actions">
      <button class="primary" data-share>分享游戏链接</button>
      <button class="dark-button" data-copy>复制链接</button>
      ${installPrompt?'<button class="dark-button" data-install>安装网页应用</button>':''}
    </div>
    <details class="save-tools">
      <summary>战绩备份</summary>
      <p>换设备、网址或浏览器时，可以用备份带走最高纪录和角色解锁。</p>
      <div class="dialog-actions"><button class="dark-button" data-export-profile>导出战绩</button><button class="dark-button" data-import-profile>导入战绩</button></div>
      <input type="file" accept=".json,application/json" id="profile-file" hidden>
      <p id="profile-message" role="status"></p>
    </details>`);
  $('#profile-file').addEventListener('change',importProfile);
}

function exportProfile() {
  const data={game:STORAGE,best:profile.best,records:profile.records,unlocked:profile.unlocked};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;link.download='bikini-bottom-records.json';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function importProfile(event) {
  const input=event.currentTarget;
  const file=input.files[0];
  const message=$('#profile-message');
  if(!file)return;
  try{
    if(file.size>8192)throw Error('file');
    const data=JSON.parse(await file.text());
    if(data?.game!==STORAGE)throw Error('game');
    profile.unlocked||=data.unlocked===true;
    profile.best=Math.max(profile.best,validWave(data.best));
    profile.records=profile.records.map((wave,i)=>Math.max(wave,validWave(data.records?.[i])));
    save();renderLobby();
    message.textContent='战绩和角色解锁已合并。';
  }catch{
    message.textContent='请选择本游戏导出的战绩文件。';
  }
  input.value='';
}

const launchUrl=()=>new URL('./',location.href).href;
async function copyLink(button) {
  try{await navigator.clipboard.writeText(launchUrl());button.textContent='已复制链接'}
  catch{
    let input=content.querySelector('input[type="url"]');
    if(!input){
      input=document.createElement('input');input.type='url';input.className='copy-field';input.readOnly=true;
      input.value=launchUrl();input.setAttribute('aria-label','游戏链接');content.append(input);
    }
    input.focus();input.select();
  }
}

function resizeField() {
  if(battle.hidden)return;
  const {width,height}=field.getBoundingClientRect();
  viewport.w=width;viewport.h=height;viewport.dpi=Math.min(devicePixelRatio||1,2);
  viewport.scale=clamp(Math.max(height/world.h,Math.min(width/480,height/410)),.71,1.32);
  field.width=Math.round(width*viewport.dpi);field.height=Math.round(height*viewport.dpi);
}

function createGround(map) {
  const canvas=document.createElement('canvas');canvas.width=world.w;canvas.height=world.h;
  drawArena(canvas.getContext('2d'),world.w,world.h,map);
  return canvas;
}

function startRun(saved=null) {
  closeDialog();resetInput();
  if(saved){
    selectedHero=saved.hero;selectedMap=saved.map;selectedDifficulty=saved.difficulty;
  }
  const hero=HEROES[selectedHero],map=MAPS[selectedMap],weapon=WEAPONS[hero.weapon];
  const player={
    x:world.w/2,y:world.h/2,hp:hero.hp,maxHp:hero.hp,speed:hero.speed,power:hero.power,rate:hero.id==='squid'?weapon.rate*.82:weapon.rate,
    magnet:map.id==='town'?99:84,range:weapon.range,cooldown:1,invulnerable:0,armor:0,crit:.05,skillPower:1,
    skill:0,ultimate:0,charge:0,attack:0,xp:0,level:1,need:xpForLevel(1),face:1,steps:0,
    stride:0,kick:0,cast:0,tilt:0,aim:0,nextTrail:0,skillMax:0,ultimateMax:0,
    weaponTier:0,weaponDamage:1,
  };
  if(saved){
    for(const stat of Object.keys(player)){
      if(stat!=='need'&&Number.isFinite(saved.player[stat]))player[stat]=saved.player[stat];
    }
    player.need=xpForLevel(player.level);
  }
  const questions=Array.isArray(saved?.questions)?saved.questions.map(id=>QUIZZES.find(q=>q[0]===id)).filter(Boolean):shuffle(QUIZZES);
  const count=value=>Number.isInteger(value)&&value>=0?value:0;
  run={
    hero,map,weapon,ground:createGround(map),difficulty:DIFFICULTIES[selectedDifficulty],difficultyIndex:selectedDifficulty,
    id:saved?.id||globalThis.crypto?.randomUUID?.()||Date.now().toString(36),
    enemies:[],shots:[],fx:[],hazards:[],questions,kills:count(saved?.kills),wave:saved?.wave||0,phase:'intro',clock:0,waveTime:WAVE_SECONDS,
    time:Number.isFinite(saved?.time)?saved.time:0,shake:0,canSave:true,
    drops:[],gifts:count(saved?.gifts),
    upgrades:Array.isArray(saved?.upgrades)?saved.upgrades.filter(name=>UPGRADES.some(u=>u.name===name)):[],
    inventory:Object.fromEntries(PREP_ITEMS.map(item=>[item.id,Math.min(item.limit,count(saved?.inventory?.[item.id]))])),
    answers:count(saved?.answers),correct:count(saved?.correct),player,
  };
  audio.unlock();audio.start(()=>run?.wave||1,true);
  lobby.hidden=true;battle.hidden=false;document.body.classList.add('in-battle');
  const portrait=$('#portrait').getContext('2d');
  portrait.clearRect(0,0,48,48);drawHero(portrait,hero.id,24,23,.77);
  resizeField();drawPaused=false;
  if(saved?.prep){
    run.phase='prep';run.waveTime=0;run.prep=saved.prep;
    audio.stop();showPrep();
  }else{
    beginWave(Boolean(saved));
    battle.focus({preventScroll:true});
  }
  updateHud();
  save();
  previous=performance.now();cancelAnimationFrame(frame);frame=requestAnimationFrame(loop);
}

function saveWave(replace=false) {
  const current=readCheckpoint();
  if(!replace&&current&&current.id!==run.id){
    checkpoint=current;run.canSave=false;
    return;
  }
  const next={
    id:run.id,hero:HEROES.indexOf(run.hero),map:MAPS.indexOf(run.map),difficulty:run.difficultyIndex,
    wave:run.wave,kills:run.kills,time:run.time,player:{...run.player},
    questions:run.questions.map(q=>q[0]),gifts:run.gifts,inventory:{...run.inventory},prep:run.prep||null,
    upgrades:[...run.upgrades],answers:run.answers,correct:run.correct,
  };
  run.canSave=writeLocal(RUN_STORAGE,next);
  checkpoint=next;
}

function clearWaveSave() {
  if(checkpoint?.id===run.id)checkpoint=null;
  if(readCheckpoint()?.id===run.id)writeLocal(RUN_STORAGE,null);
}

function home() {
  closeDialog();resetInput();audio.stop();cancelAnimationFrame(frame);run=null;
  battle.hidden=true;lobby.hidden=false;document.body.classList.remove('in-battle');
  renderLobby();drawSplash(splash,skin);
  $('#start').focus({preventScroll:true});
}

function beginWave(restoring=false) {
  if(!restoring)run.wave++;
  run.phase='intro';run.spawn=.45;
  run.hasBoss=run.wave%5===0;
  run.waveTime=WAVE_SECONDS;
  run.prep=null;
  run.boss=null;
  run.storm=null;
  run.drops.length=0;run.hazards.length=0;
  run.clock=run.hasBoss?1.9:1.5;
  const p=run.player;
  if(restoring)return;
  const healing=run.difficulty.heal+(run.hero.id==='sponge'?8:0)+(run.map.id==='krusty'?4:0);
  p.hp=Math.min(p.maxHp,p.hp+healing);
  p.charge=Math.min(100,p.charge+12);
  p.skill=0;p.ultimate=0;
  run.shots.length=0;
  saveWave(run.wave===1);
}

function enemyPosition(radius) {
  const p=run.player;
  let spot=null,bestDistance=-1;
  for(let i=0;i<10;i++){
    const angle=Math.random()*TAU;
    const candidate={x:clamp(p.x+Math.cos(angle)*radius,29,world.w-29),y:clamp(p.y+Math.sin(angle)*radius,29,world.h-29)};
    const away=distance(candidate,p);
    if(away>radius*.79)return candidate;
    if(away>bestDistance){spot=candidate;bestDistance=away}
  }
  return spot;
}

function spawnEnemy(boss=false,forcedType=null,area=null) {
  const wave=run.wave,diff=run.difficulty;
  const pool=['jelly','jelly','jelly','blue'];
  if(wave>=4)pool.push('blue','robot');
  if(wave>=7)pool.push('spitter');
  if(wave>=12)pool.push('spitter','robot');
  const type=boss?'boss':forcedType||pool[Math.floor(Math.random()*pool.length)];
  const spec=boss?BOSSES[wave/5-1]:ENEMY_TYPES[type];
  const hp=Math.round(spec.hp*(boss?diff.bossHp:diff.hp*(1+(wave-1)*.024)));
  const position=area||enemyPosition(boss?Math.min(290,Math.max(211,viewport.w*.45/viewport.scale)):190+Math.random()*108);
  const e={...position,type,boss,hp,maxHp:hp,name:spec.name,color:spec.color,attack:spec.attack,moves:spec.moves,interval:spec.interval,
    attackClock:boss?1.55:1.9+Math.random()*1.3,activeMove:null,pattern:0,windup:0,castTime:0,rush:0,rushAngle:0,
    size:boss?35+wave*.68:spec.size,damage:spec.damage*diff.damage*(boss?1:1+(wave-1)*.017),xp:boss?spec.xp:area?1:spec.xp,
    speed:spec.speed*diff.speed*(run.map.id==='jelly'?1.1:1)*(1+wave*.005),flash:0,slow:0,dx:0,dy:0,
    entered:0,phase:Math.random()*TAU};
  run.enemies.push(e);
  if(boss)run.boss=e;
  ring(e.x,e.y,e.size*1.85,e.color,.52);
}

function ring(x,y,r,color,life) {
  run.fx.push({kind:'ring',x,y,r,color,life,max:life});
}

function burst(x,y,color,count,power) {
  for(let i=0;i<count;i++){
    const a=Math.random()*TAU,s=power*(.35+Math.random()*.65),life=.21+Math.random()*.33;
    run.fx.push({kind:'spark',x,y,dx:Math.cos(a)*s,dy:Math.sin(a)*s,r:1.3+Math.random()*2.9,color,life,max:life});
  }
}

function floatText(x,y,text,color,big=false) {
  run.fx.push({kind:'text',x,y,text,color,big,life:.69,max:.69});
}

function weaponDamage(p=run.player) {
  return run.weapon.damage*p.power*p.weaponDamage;
}

function damageEnemy(e,damage,knock=0,critical=false) {
  if(e.hp<=0)return;
  const p=run.player,actual=Math.max(1,Math.round(damage));
  const half=e.maxHp*.5;
  if(e.boss&&e.hp>half&&e.hp-actual<=half)e.attackClock=Math.min(e.attackClock,.72);
  e.hp-=actual;e.flash=.12;
  const a=Math.atan2(e.y-p.y,e.x-p.x),force=e.boss?knock*.25:knock;
  e.dx+=Math.cos(a)*force;e.dy+=Math.sin(a)*force;
  burst(e.x,e.y,e.color,e.hp<=0?12:5,e.hp<=0?174:110);
  run.fx.push({kind:'impact',x:e.x,y:e.y,angle:a,r:e.boss?27:17,color:critical?'#ffcc64':'#fff5ce',life:.19,max:.19});
  floatText(e.x,e.y-e.size,String(actual),critical?'#ffcd60':'#fff2c2',critical);
  if(critical)run.shake=Math.max(run.shake,.1);
  if(e.hp>0)return;
  run.kills++;p.charge=Math.min(100,p.charge+(e.boss?32:3.25));
  p.xp+=e.xp*run.difficulty.xp*(run.hero.id==='krabs'?1.25:1)*(run.map.id==='jelly'?1.15:1);
  if(e.boss||run.kills%10===0)run.drops.push({x:e.x,y:e.y,kind:'gift',value:e.boss?3:1});
  if(e.boss||run.kills%run.difficulty.burger===0)run.drops.push({x:e.x+10,y:e.y+8,kind:'heal'});
}

function hurt(base) {
  const p=run.player;
  if(p.invulnerable>0)return;
  const damage=Math.max(1,Math.round(base*12/(12+p.armor)));
  p.hp=Math.max(0,p.hp-damage);p.invulnerable=.67;run.shake=.20;
  run.hurtGlow=.36;
  burst(p.x,p.y,'#ff8399',9,150);floatText(p.x,p.y-21,'−'+damage,'#ffc3c9');
  audio.effect('hurt');
}

function attack() {
  const p=run.player,w=run.weapon;
  let target=null, nearest=p.range;
  for(const e of run.enemies){
    if(e.hp<=0)continue;
    const d=distance(e,p)-e.size*.3;
    if(d<nearest){nearest=d;target=e}
  }
  if(!target)return;
  p.attack=p.rate;p.kick=.29;
  const angle=Math.atan2(target.y-p.y,target.x-p.x);
  p.face=Math.cos(angle)<0?-1:1;p.aim=angle;
  const critical=Math.random()<p.crit;
  const damage=weaponDamage(p)*(critical?1.8:1);
  audio.effect(run.hero.weapon);
  if(w.kind==='挥砍'){
    const swing=run.hero.weapon==='claw'?.78:run.hero.weapon==='net'?1.05:.92;
    run.fx.push({kind:'slash',x:p.x,y:p.y,angle,swing,r:Math.max(65,nearest+target.size*.82),color:w.color,weapon:run.hero.weapon,life:.3,max:.3});
    for(const e of run.enemies){
      const a=Math.atan2(e.y-p.y,e.x-p.x)-angle;
      if(e===target||(distance(e,p)<p.range+e.size*.3&&Math.cos(a)>=Math.cos(swing))){
        damageEnemy(e,damage*(e===target?1:.72),w.knock,critical);
      }
    }
    audio.effect(critical?'critical':'hit');
  }else{
    const speed=w.kind==='投掷'?540:w.kind==='音波'?725:620;
    const x=p.x+Math.cos(angle)*12,y=p.y+Math.sin(angle)*12;
    run.shots.push({x,y,dx:Math.cos(angle)*speed,dy:Math.sin(angle)*speed,
      color:w.color,damage,critical,knock:w.knock,range:(p.range+38)/speed,r:w.kind==='气泡'?9:7,kind:w.kind});
    ring(x,y,22,w.color,.18);
  }
}

function enemyShot(e,a,speed,damage=e.damage) {
  run.shots.push({x:e.x,y:e.y,dx:Math.cos(a)*speed,dy:Math.sin(a)*speed,color:e.color,damage,range:3.1,r:e.boss?7:5,hostile:true});
}

function bossAttack(e,p,angle,dt) {
  if(e.activeMove){
    e.windup=Math.max(0,e.windup-dt);
    if(e.windup)return;
    const kind=e.activeMove,move=BOSS_MOVES[kind];
    e.activeMove=null;
    if(kind==='pulse'){
      run.fx.push({kind:'shockwave',x:e.x,y:e.y,r:move.radius,color:e.color,life:.44,max:.44});
      burst(e.x,e.y,e.color,22,245);
      if(distance(e,p)<move.radius)hurt(e.damage*1.15);
    }
    if(kind==='burst'){
      for(let i=0;i<move.rays;i++)enemyShot(e,e.aim+i*TAU/move.rays,move.speed+(run.wave-10)*3,e.damage*.8);
      ring(e.x,e.y,53,e.color,.25);
    }
    if(kind==='charge'){
      e.rush=move.duration;e.rushAngle=e.aim;
      burst(e.x,e.y,e.color,13,190);
    }
    if(kind==='fan'){
      for(let i=0;i<move.rays;i++){
        const bearing=e.aim+(i/(move.rays-1)-.5)*1.22;
        enemyShot(e,bearing,move.speed,e.damage*.76);
      }
      ring(e.x,e.y,64,e.color,.31);
    }
    if(kind==='mines'){
      for(let i=0;i<move.count;i++){
        const bearing=e.aim+i*TAU/move.count;
        const offset=i===0?0:move.radius*1.43;
        run.hazards.push({
          x:clamp(e.markX+Math.cos(bearing)*offset,30,world.w-30),
          y:clamp(e.markY+Math.sin(bearing)*offset,30,world.h-30),
          radius:move.radius,wait:move.delay+i*.17,duration:move.delay+i*.17,damage:e.damage*1.13,color:e.color,
        });
      }
    }
    if(kind==='summon'&&run.waveTime>0){
      const slots=Math.min(move.count,run.difficulty.crowd+4-run.enemies.length);
      for(let i=0;i<slots;i++){
        const a=e.aim+i*TAU/slots;
        const area={x:clamp(e.x+Math.cos(a)*100,29,world.w-29),y:clamp(e.y+Math.sin(a)*100,29,world.h-29)};
        if(distance(area,p)>75)spawnEnemy(false,i%2?'robot':'blue',area);
      }
      ring(e.x,e.y,116,e.color,.45);
    }
    return;
  }
  if(e.rush>0)return;
  e.attackClock-=dt;
  if(e.attackClock<=0){
    const enraged=e.hp<=e.maxHp*.5;
    const sequence=e.moves||[e.attack];
    const moves=(enraged?sequence:sequence.slice(0,2)).filter(move=>move!=='summon'||run.waveTime>0);
    e.activeMove=moves[e.pattern%moves.length];
    e.pattern++;
    e.castTime=BOSS_MOVES[e.activeMove].windup*run.difficulty.windup;
    e.windup=e.castTime;e.aim=angle;e.markX=p.x;e.markY=p.y;e.dx=0;e.dy=0;
    e.attackClock=e.interval*run.difficulty.recovery*(enraged?.8:1);
  }
}

function updateHazards(dt) {
  for(const hazard of run.hazards){
    hazard.wait-=dt;
    if(hazard.wait>0)continue;
    run.fx.push({kind:'shockwave',x:hazard.x,y:hazard.y,r:hazard.radius,color:hazard.color,life:.37,max:.37});
    burst(hazard.x,hazard.y,hazard.color,10,174);
    if(distance(hazard,run.player)<hazard.radius)hurt(hazard.damage);
  }
  run.hazards=run.hazards.filter(hazard=>hazard.wait>0);
}

function updateSpitter(e,p,angle,dt) {
  if(e.windup>0){
    e.windup=Math.max(0,e.windup-dt);
    if(!e.windup){
      enemyShot(e,e.aim,190,e.damage*.83);
      e.attackClock=2.45+Math.random()*.6;
    }
    return;
  }
  e.attackClock-=dt;
  if(e.attackClock<=0&&distance(e,p)<320){
    e.aim=angle;e.castTime=.61*run.difficulty.windup;e.windup=e.castTime;
  }
}

function updateEnemies(dt) {
  const p=run.player,list=run.enemies;
  for(const e of list){
    if(e.hp<=0)continue;
    const angle=Math.atan2(p.y-e.y,p.x-e.x),d=distance(p,e);
    e.flash-=dt;e.slow-=dt;e.rush-=dt;e.entered+=dt;
    if(e.boss)bossAttack(e,p,angle,dt);
    else if(e.type==='spitter')updateSpitter(e,p,angle,dt);
    let speed=e.speed;
    if(e.type==='spitter'){
      if(d<83)speed=-e.speed*.31;
      else if(d<115)speed*=.38;
    }
    speed*=e.slow>0?(e.boss?.76:.5):1;
    if(e.windup>0||e.entered<.32)speed=0;
    if(e.rush>0)speed=BOSS_MOVES.charge.speed;
    const bearing=e.rush>0?e.rushAngle:angle;
    e.heading=bearing;
    e.x+=(Math.cos(bearing)*speed+e.dx)*dt;e.y+=(Math.sin(bearing)*speed+e.dy)*dt;
    const fade=Math.exp(-dt*6);e.dx*=fade;e.dy*=fade;
    if(e.entered>.32&&distance(e,p)<e.size+11)hurt(e.damage*(e.rush>0?1.23:1));
  }
  for(let i=0;i<list.length;i++){
    const a=list[i];if(a.hp<=0)continue;
    for(let j=i+1;j<list.length;j++){
      const b=list[j];if(b.hp<=0)continue;
      const dx=b.x-a.x,dy=b.y-a.y,r=(a.size+b.size)*.82;
      if(Math.abs(dx)>r||Math.abs(dy)>r)continue;
      const d=Math.hypot(dx,dy)||.01;
      if(d>=r)continue;
      const shift=Math.min(100,(r-d)*6)*dt;
      const x=dx/d*shift,y=dy/d*shift;
      if(!a.boss){a.x-=x;a.y-=y}
      if(!b.boss){b.x+=x;b.y+=y}
    }
  }
  for(const e of list){
    e.x=clamp(e.x,16,world.w-16);e.y=clamp(e.y,16,world.h-16);
  }
}

function shotContact(shot,target,radius,travel) {
  const dx=target.x-shot.x,dy=target.y-shot.y;
  const projection=dx*travel.x+dy*travel.y;
  const offset=dx*dx+dy*dy-projection*projection;
  const room=radius*radius-offset;
  if(room<0)return Infinity;
  const edge=Math.sqrt(room);
  if(projection+edge<0||projection-edge>travel.length)return Infinity;
  return Math.max(0,projection-edge);
}

function updateShots(dt) {
  const p=run.player;
  for(const shot of run.shots){
    const speed=Math.hypot(shot.dx,shot.dy);
    const travel={x:shot.dx/speed,y:shot.dy/speed,length:speed*Math.min(shot.range,dt)};
    if(shot.hostile){
      if(shotContact(shot,p,shot.r+13,travel)<Infinity){hurt(shot.damage);shot.range=0}
    }else{
      let hit=null,nearest=Infinity;
      for(const e of run.enemies){
        if(e.hp<=0)continue;
        const contact=shotContact(shot,e,shot.r+e.size,travel);
        if(contact<nearest){hit=e;nearest=contact}
      }
      if(hit){
        damageEnemy(hit,shot.damage,shot.knock,shot.critical);shot.range=0;
        if(run.hero.id==='gary')hit.slow=2;
        audio.effect(shot.critical?'critical':'hit');
      }
    }
    shot.x+=travel.x*travel.length;shot.y+=travel.y*travel.length;shot.range-=dt;
  }
  run.shots=run.shots.filter(s=>s.range>0&&s.x>0&&s.y>0&&s.x<world.w&&s.y<world.h);
}

function updateDrops(dt) {
  const p=run.player;
  for(const drop of run.drops){
    const d=distance(drop,p);
    const pickup=drop.kind==='gift'?38+Math.min(26,p.magnet*.11):p.magnet*.66;
    if(drop.kind==='heal'&&p.hp===p.maxHp)continue;
    if(d<21){
      if(drop.kind==='gift'){
        run.gifts+=drop.value;
        floatText(p.x,p.y-30,'+'+drop.value+' 礼包','#ffd77a');
        ring(p.x,p.y,31,'#ffd77a',.27);
        audio.effect('gift');
      }else{
        const amount=Math.min(p.maxHp-p.hp,17);
        p.hp+=amount;
        floatText(p.x,p.y-28,'+'+Math.round(amount),'#a5ffb5');
        audio.effect('heal');
      }
      drop.used=true;
    }else if(d<pickup){
      const speed=Math.min(d,(310+d*2)*dt);
      drop.x+=(p.x-drop.x)/d*speed;drop.y+=(p.y-drop.y)/d*speed;
    }
  }
  run.drops=run.drops.filter(d=>!d.used);
}

function useSkill(ultimate) {
  if(!run||modal.open||run.phase!=='combat')return;
  const p=run.player;
  if(ultimate ? p.ultimate>0||p.charge<100 : p.skill>0)return;
  if(ultimate){
    p.ultimate=p.ultimateMax=16*p.cooldown;p.charge=0;
    run.storm={left:3.2,pulse:0};
    p.cast=.65;p.invulnerable=Math.max(p.invulnerable,.78);
    ring(p.x,p.y,105,'#ffd4ef',.48);
  }else{
    p.skill=p.skillMax=7.4*p.cooldown*(run.hero.id==='sandy'?.75:1);
    p.cast=.47;p.invulnerable=Math.max(p.invulnerable,.28);
    run.fx.push({kind:'swirl',x:p.x,y:p.y,r:145,color:'#85fff1',life:.53,max:.53});
    burst(p.x,p.y,'#a9fff3',18,237);
    for(const e of run.enemies){
      if(distance(e,p)>=145+e.size*.5)continue;
      damageEnemy(e,43*p.power*p.skillPower,258);
      e.slow=Math.max(e.slow,e.boss?.75:2.2);
    }
  }
  run.shake=ultimate?.32:.16;
  audio.effect(ultimate?'ultimate':'skill');
  updateHud();
}

function tickStorm(dt) {
  const storm=run.storm;
  if(!storm)return;
  storm.left-=dt;storm.pulse-=dt;
  if(storm.left<=0){run.storm=null;return}
  if(storm.pulse>0)return;
  storm.pulse+=.8;
  const p=run.player;
  run.fx.push({kind:'storm',x:p.x,y:p.y,r:201,color:'#ff9be0',life:.53,max:.53});
  for(const e of run.enemies){
    if(e.hp<=0||distance(e,p)>=201+e.size*.45)continue;
    run.fx.push({kind:'bolt',x:e.x,y:e.y,r:92,color:'#ffd4ef',life:.25,max:.25});
    damageEnemy(e,27*p.power*p.skillPower,104);
    e.slow=Math.max(e.slow,.66);
  }
  audio.effect('pulse');
}

function spawnDuringWave(dt) {
  if(run.waveTime<=0)return;
  run.spawn-=dt;
  if(run.spawn>0)return;
  const pressure=WAVE_SECONDS-run.waveTime;
  const late=pressure>44;
  const bossAlive=run.boss?.hp>0;
  const cap=run.difficulty.crowd+Math.floor(run.wave/4)+(late?2:0)-(bossAlive?3:0);
  if(run.enemies.length>=cap){
    run.spawn=.21;
    return;
  }
  const delay=Math.max(.68,1.63-run.wave*.035-run.difficulty.count*.07-(late?.19:0));
  spawnEnemy();
  if(pressure>17&&run.enemies.length<cap&&Math.random()<.14+run.wave*.008)spawnEnemy();
  run.spawn=delay*(bossAlive?1.28:1)*(.84+Math.random()*.34);
}

function update(dt) {
  const p=run.player;
  run.time+=dt;
  const axis=(positive,negative)=>Number(positive.some(k=>keys.has(k)))-Number(negative.some(k=>keys.has(k)));
  const x=joystick.x+axis(['d','arrowright'],['a','arrowleft']);
  const y=joystick.y+axis(['s','arrowdown'],['w','arrowup']);
  const len=Math.max(1,Math.hypot(x,y));
  const beforeX=p.x,beforeY=p.y;
  if(x||y){
    p.x=clamp(p.x+x/len*p.speed*dt,21,world.w-21);
    p.y=clamp(p.y+y/len*p.speed*dt,21,world.h-21);
    if(Math.abs(x)>.15&&p.kick<=.14)p.face=Math.sign(x);
  }
  const travel=Math.hypot(p.x-beforeX,p.y-beforeY);
  const moving=travel>dt*12;
  p.stride+=(Math.min(travel/(p.speed*dt||1),1)-p.stride)*Math.min(1,dt*12);
  p.tilt+=(clamp(x,-1,1)-p.tilt)*Math.min(1,dt*9);
  p.steps+=travel*.095;
  p.nextTrail-=dt;
  if(moving&&p.nextTrail<=0){
    p.nextTrail=.088;
    run.fx.push({kind:'wake',x:p.x-(p.x-beforeX)*3,y:p.y+14-(p.y-beforeY)*3,
      dx:-x/len*25,dy:-y/len*25,r:5+p.stride*3,color:run.hero.color,life:.32,max:.32});
  }
  p.kick=Math.max(0,p.kick-dt);p.cast=Math.max(0,p.cast-dt);run.hurtGlow=Math.max(0,(run.hurtGlow||0)-dt);
  p.attack=Math.max(0,p.attack-dt);p.invulnerable-=dt;p.skill-=dt;p.ultimate-=dt;run.shake-=dt;
  for(const fx of run.fx){
    fx.life-=dt;
    if(fx.kind==='spark'||fx.kind==='wake'){fx.x+=fx.dx*dt;fx.y+=fx.dy*dt}
    if(fx.kind==='text')fx.y-=38*dt;
  }
  run.fx=run.fx.filter(f=>f.life>0);
  if(run.phase==='intro'){
    run.clock-=dt;
    if(run.clock<=0){
      run.phase='combat';
      if(run.hasBoss)spawnEnemy(true);
      run.spawn=run.hasBoss?1.6:.35;
      if(run.hasBoss)audio.effect('boss');
      return;
    }
  }
  if(run.phase==='combat'){
    run.waveTime=Math.max(0,run.waveTime-dt);
    spawnDuringWave(dt);
    if(p.attack<=0)attack();
    tickStorm(dt);updateEnemies(dt);updateShots(dt);updateHazards(dt);updateDrops(dt);
    run.enemies=run.enemies.filter(e=>e.hp>0);
    if(p.hp<=0){finish(false);return}
    if(run.waveTime===0&&(!run.hasBoss||run.boss.hp<=0))clearWave();
  }else if(run.phase==='clear'){
    updateDrops(dt);
    run.clock-=dt;
    if(run.clock<=0)beginPrep();
  }
}

function clearWave() {
  run.phase='clear';run.clock=2.55;
  run.enemies.length=0;run.shots.length=0;run.hazards.length=0;run.storm=null;
  profile.best=Math.max(profile.best,run.wave);
  profile.records[run.difficultyIndex]=Math.max(profile.records[run.difficultyIndex],run.wave);
  if(run.wave===MAX_WAVES&&run.difficultyIndex===0&&!profile.unlocked){
    profile.unlocked=true;run.newUnlock=true;
  }
  if(run.wave===MAX_WAVES)clearWaveSave();
  audio.effect('clear');save();
}

function prepareLevel() {
  const p=run.player;
  if(p.xp<p.need){run.prep.level=null;return}
  p.xp-=p.need;p.level++;p.need=xpForLevel(p.level);
  const options=shuffle(UPGRADES.filter(upgrade=>!upgrade.available||upgrade.available(p))).slice(0,3).map(upgrade=>upgrade.name);
  if(!run.questions.length)run.questions=shuffle(QUIZZES);
  const [question,correct,...rest]=run.questions.pop();
  run.prep.level={options,question,order:shuffle([correct,...rest]).map(answer=>[correct,...rest].indexOf(answer)),selected:null,answered:null};
  audio.effect('level');
}

function shopItems() {
  return shuffle(PREP_ITEMS.filter(item=>run.inventory[item.id]<item.limit&&(!item.available||item.available(run.player))))
    .slice(0,4).map(item=>item.id);
}

function beginPrep() {
  if(run.wave===MAX_WAVES){finish(true);return}
  run.phase='prep';run.drops.length=0;
  run.prep={offers:shopItems(),bought:[],level:null};
  resetInput();audio.stop();
  prepareLevel();
  saveWave();showPrep();
}

function levelComplete() {
  const level=run.prep.level;
  return !level||(level.selected!==null&&level.answered!==null);
}

function levelPanel(level) {
  if(!level)return `<p class="prep-progress">等级 ${run.player.level} · 经验 ${Math.floor(run.player.xp)} / ${run.player.need}</p>`;
  const [question,correct,...rest]=QUIZZES.find(quiz=>quiz[0]===level.question)||QUIZZES[0];
  const answers=[correct,...rest],done=levelComplete();
  const options=level.options.map(name=>UPGRADES.find(upgrade=>upgrade.name===name)).filter(Boolean);
  return `<section class="prep-level" aria-label="本波升级">
    <h3>升至 Lv. ${run.player.level} · 选择一项强化</h3>
    <div class="choices">${options.map((option,i)=>`<button class="choice${level.selected===i?' selected':''}" data-upgrade="${i}" ${level.selected!==null?'disabled':''}><strong>${option.name}</strong><small>${option.label}</small></button>`).join('')}</div>
    <div class="quiz"><h3>剧情问答</h3><p>${question}</p>
    <div class="answers">${level.order.map(i=>`<button class="answer${level.answered!==null&&i===0?' correct':level.answered===i?' wrong':''}" data-answer="${i}" ${level.answered!==null?'disabled':''}>${answers[i]}</button>`).join('')}</div>
    <p class="quiz-result" role="status">${level.answered===null?'答对后伤害 +3%，恢复 12 生命。':level.answered===0?'答对了！伤害 +3%，恢复最多 12 生命。':'正确答案是「'+correct+'」。'}</p></div>
    ${done&&run.player.xp>=run.player.need?'<button class="dark-button" data-next-level>领取下一次升级</button>':''}
    </section>`;
}

function showPrep(focusSelector) {
  const p=run.player;
  const next=WEAPON_TIERS[p.weaponTier];
  const offers=run.prep.offers.map(id=>PREP_ITEMS.find(item=>item.id===id)).filter(Boolean);
  const cards=offers.map(item=>{
    const sold=run.prep.bought.includes(item.id)||run.inventory[item.id]>=item.limit;
    const capped=item.available&&!item.available(p);
    return `<button class="shop-item" data-buy-item="${item.id}" ${sold||capped||run.gifts<item.cost?'disabled':''}>
      <strong><span>${item.glyph}</span> ${item.name}</strong><small>${item.label}</small>
      <b>${sold?'已购':capped?'属性已满':item.cost+' 礼包'}</b></button>`;
  }).join('');
  const inventory=PREP_ITEMS.filter(item=>run.inventory[item.id]>0).map(item=>item.name+' ×'+run.inventory[item.id]).join('　');
  const scroll=dialogKind==='prep'?modal.scrollTop:0;
  openDialog('prep','第 '+run.wave+' 波后整备',`
    <div class="prep-heading"><span>下一波 · ${(run.wave+1)%5===0?'首领战':'生存战'}</span><strong>▦ ${run.gifts} 礼包</strong></div>
    ${levelPanel(run.prep.level)}
    <section class="loadout-weapon" aria-label="武器">
      <div><h3>${run.weapon.glyph} ${run.weapon.name} · ${run.weapon.kind==='挥砍'?'近战':'远程'} ${p.weaponTier+1} 阶</h3>
      <p>伤害 ${Math.round(weaponDamage(p))} · 攻速 ${(1/p.rate).toFixed(2)} 次/秒 · 范围 ${Math.round(p.range)}</p></div>
      <button class="dark-button" data-buy-weapon ${!next||run.gifts<next.cost?'disabled':''}>${next?'升武器 · '+next.cost+' 礼包':'武器已满阶'}</button>
    </section>
    <h3>道具补给</h3><div class="shop-grid">${cards||'<p>道具购买上限已达。</p>'}</div>
    ${inventory?'<p class="inventory-line">已装备 · '+inventory+'</p>':''}
    <div class="dialog-actions prep-actions">
      <button class="primary" data-next-wave ${!levelComplete()||p.xp>=p.need?'disabled':''}>进入第 ${run.wave+1} 波</button>
      <button class="dark-button" data-home>保存并返回大厅</button>
    </div>`,false);
  modal.scrollTop=scroll;
  if(focusSelector){
    content.querySelector(focusSelector)?.focus({preventScroll:true});
  }
  updateHud();
}

function prepAction(button) {
  if(run?.phase!=='prep'||!run.prep)return;
  const p=run.player,level=run.prep.level;
  let focus=null;
  if(button.dataset.upgrade!==undefined&&level?.selected===null){
    const index=Number(button.dataset.upgrade);
    const upgrade=UPGRADES.find(option=>option.name===level.options[index]);
    if(!upgrade)return;
    upgrade.apply(p);run.upgrades.push(upgrade.name);level.selected=index;
    focus=level.answered===null?'[data-answer]:not(:disabled)':'.prep-actions button:not(:disabled)';
  }else if(button.dataset.answer!==undefined&&level?.answered===null){
    const answer=Number(button.dataset.answer);
    if(!level.order.includes(answer))return;
    level.answered=answer;run.answers++;
    if(answer===0){
      run.correct++;p.power*=1.03;p.hp=Math.min(p.maxHp,p.hp+12);audio.effect('level');
    }else audio.effect('wrong');
    focus=level.selected===null?'[data-upgrade]:not(:disabled)':'.prep-actions button:not(:disabled)';
  }else if(button.hasAttribute('data-next-level')&&levelComplete()&&p.xp>=p.need){
    prepareLevel();focus='[data-upgrade]';
  }else if(button.hasAttribute('data-buy-weapon')){
    const next=WEAPON_TIERS[p.weaponTier],equipped=WEAPON_TIERS[p.weaponTier-1]||{rate:1,range:1};
    if(!next||run.gifts<next.cost)return;
    run.gifts-=next.cost;p.weaponTier++;p.weaponDamage=next.damage;
    p.rate=Math.max(UPGRADE_LIMITS.attackInterval,p.rate*next.rate/equipped.rate);
    p.range=Math.min(UPGRADE_LIMITS.range,p.range+run.weapon.range*(next.range-equipped.range));
    audio.effect('gift');focus='[data-buy-weapon]';
  }else if(button.dataset.buyItem){
    const item=PREP_ITEMS.find(entry=>entry.id===button.dataset.buyItem);
    if(!item||!run.prep.offers.includes(item.id)||run.prep.bought.includes(item.id)||p.hp<=0||
      run.gifts<item.cost||run.inventory[item.id]>=item.limit||(item.available&&!item.available(p)))return;
    run.gifts-=item.cost;run.inventory[item.id]++;run.prep.bought.push(item.id);item.apply(p);
    audio.effect('gift');focus='.shop-item:not(:disabled)';
  }else if(button.hasAttribute('data-next-wave')&&levelComplete()&&p.xp<p.need){
    closeDialog();beginWave();audio.unlock();audio.start(()=>run.wave);return;
  }else return;
  saveWave();showPrep(focus);
}

function finish(win) {
  run.phase='finished';run.won=win;resetInput();audio.stop();
  clearWaveSave();
  const unlocked=win&&run.newUnlock;
  if(win)audio.effect('win');
  else audio.effect('lose');
  openDialog('result',win?'比奇堡守住了！':'战斗结束',`
    <p>${run.hero.name} · ${run.map.name} · ${run.difficulty.name}</p>
    <dl class="result-stats">
      <div><dt>清场</dt><dd>${win?20:run.wave-1}<small> / 20 波</small></dd></div>
      <div><dt>击倒</dt><dd>${run.kills}</dd></div>
      <div><dt>等级</dt><dd>${run.player.level}</dd></div>
      <div><dt>答对</dt><dd>${run.correct}<small> / ${run.answers}</small></dd></div>
    </dl>
    ${unlocked?'<p class="unlock-note">浅海通关！其余 5 名角色已解锁。</p>':''}
    <div class="dialog-actions"><button class="primary" data-retry>再来一局</button><button class="dark-button" data-home>返回大厅</button></div>`,false);
  updateHud();
}

function pause() {
  if(!run||run.phase==='finished')return;
  if(modal.open){
    if(dialogKind==='pause')resume();
    return;
  }
  resetInput();audio.stop();
  const p=run.player;
  let checkpointHint='当前对局可以在此继续。';
  if(checkpoint?.id===run.id){
    checkpointHint=run.canSave?`存档位于第 ${checkpoint.wave} 波开头。返回大厅或重开网页后可继续。`
      :`本次打开期间，可以从第 ${checkpoint.wave} 波开头继续。`;
  }
  openDialog('pause','战斗暂停',`<p>第 ${run.wave} / 20 波 · ${run.weapon.name}</p>
    <dl class="result-stats">
      <div><dt>攻击伤害</dt><dd>${Math.round(weaponDamage(p))}</dd></div>
      <div><dt>攻速</dt><dd>${(1/p.rate).toFixed(2)}<small> 次/秒</small></dd></div>
      <div><dt>范围</dt><dd>${Math.round(p.range)}</dd></div>
    </dl>
    ${run.upgrades.length?`<p class="upgrade-history">本局道具 · ${[...new Set(run.upgrades)].map(name=>`${name} ×${run.upgrades.filter(item=>item===name).length}`).join('、')}</p>`:''}
    <p>${checkpointHint}</p>
    <div class="dialog-actions"><button class="primary" data-resume>继续战斗</button><button class="dark-button" data-home>返回大厅</button></div>`,false);
}

function resume() {
  if(!run)return;
  closeDialog();audio.unlock();audio.start(()=>run?.wave||1);
  battle.focus({preventScroll:true});
}

const hud={
  player:$('#player-name'),health:$('.health'),healthFill:$('#health-fill'),healthText:$('#health-text'),
  xp:$('.experience'),xpFill:$('#xp-fill'),xpText:$('#xp-text'),wave:$('#wave'),detail:$('#wave-detail'),
  boss:$('#boss-meter'),bossBar:$('#boss-meter .meter'),bossName:$('#boss-name'),bossFill:$('#boss-fill'),bossMove:$('#boss-move'),
  banner:$('#wave-banner'),skill:$('#skill'),ultimate:$('#ultimate'),
  time:$('#wave-time'),timeFill:$('#time-fill'),gifts:$('#gift-count'),
};
const writeText=(node,value)=>{if(node.textContent!==value)node.textContent=value};
function setMeter(node,fill,value,max) {
  const current=Math.min(max,Math.max(0,value));
  const percentage=100*current/max+'%';
  if(fill.style.width!==percentage)fill.style.width=percentage;
  const accessible=Math.ceil(current).toString();
  if(node.getAttribute('aria-valuenow')!==accessible)node.setAttribute('aria-valuenow',accessible);
  if(node.getAttribute('aria-valuemax')!==String(max))node.setAttribute('aria-valuemax',String(max));
}

function updateSkillButton(button,disabled,value,progress) {
  button.disabled=disabled;
  button.style.setProperty('--ready-progress',Math.round(clamp(progress,0,1)*100)+'%');
  writeText(button.querySelector('small'),value);
}

function updateHud() {
  if(!run)return;
  const p=run.player,b=run.boss;
  writeText(hud.player,run.hero.name+' · Lv. '+p.level);
  setMeter(hud.health,hud.healthFill,p.hp,p.maxHp);
  setMeter(hud.xp,hud.xpFill,p.xp,p.need);
  writeText(hud.healthText,Math.ceil(p.hp)+' / '+p.maxHp);
  writeText(hud.xpText,Math.floor(p.xp)+' / '+p.need+' XP');
  writeText(hud.wave,'第 '+run.wave+' / 20 波');
  const cleared=run.phase==='clear'||run.phase==='prep'||run.won===true;
  const intro=run.phase==='intro';
  const seconds=Math.ceil(run.waveTime);
  writeText(hud.time,Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'));
  hud.time.classList.toggle('urgent',seconds<=10&&!cleared);
  hud.timeFill.style.width=100*run.waveTime/WAVE_SECONDS+'%';
  writeText(hud.gifts,String(run.gifts));
  const detail=run.phase==='clear'?'拾取附近掉落物':run.phase==='prep'?'备战中':run.phase==='finished'?'战斗结算':
    intro?(run.hasBoss?'首领即将登场':'敌人接近中'):seconds===0?'加时 · 击败首领':'击倒 '+run.kills;
  writeText(hud.detail,detail);
  const mark=run.wave+(cleared?.5:0);
  if(run.displayWave!==mark){
    waveTicks.forEach((tick,i)=>{
      tick.classList.toggle('done',i+1<run.wave||(cleared&&i+1===run.wave));
      tick.classList.toggle('current',!cleared&&i+1===run.wave);
    });
    run.displayWave=mark;
  }
  hud.boss.hidden=!(b?.hp>0);
  if(b?.hp>0){
    const enraged=b.hp<=b.maxHp*.5;
    writeText(hud.bossName,b.name+(enraged?' · 狂暴':''));
    hud.boss.classList.toggle('enraged',enraged);
    setMeter(hud.bossBar,hud.bossFill,b.hp,b.maxHp);
    hud.bossMove.hidden=!b.activeMove;
    if(b.activeMove)writeText(hud.bossMove,{pulse:'范围冲击',burst:'散射弹幕',charge:'直线冲锋',fan:'扇形齐射',mines:'布下水雷',summon:'召唤援军'}[b.activeMove]);
  }
  writeText(hud.banner,intro?(run.hasBoss?BOSSES[run.wave/5-1].name+'来袭':'第 '+run.wave+' 波'):run.phase==='clear'?'清场 · 拾取补给':'');
  const combat=run.phase==='combat';
  updateSkillButton(hud.skill,p.skill>0||!combat,p.skill>0?Math.ceil(p.skill)+' 秒':touchInput.matches?'可释放':'空格',
    1-Math.max(0,p.skill)/(p.skillMax||1));
  updateSkillButton(hud.ultimate,p.ultimate>0||p.charge<100||!combat,p.ultimate>0?Math.ceil(p.ultimate)+' 秒':p.charge<100?p.charge+'%':touchInput.matches?'已充能':'已充能 · Q',
    p.ultimate>0?1-p.ultimate/(p.ultimateMax||1):p.charge/100);
}

function drawEffect(f) {
  const progress=1-f.life/f.max;
  ctx.save();
  ctx.globalAlpha=Math.min(1,f.life/f.max*1.4);
  if(f.kind==='ring'){
    const r=f.r*(.23+progress*.77);
    oval(ctx,f.x,f.y,r,r,null,f.color,Math.max(1,7*(1-progress)));
    ctx.globalAlpha*=.33;oval(ctx,f.x,f.y,r*.91,r*.91,null,f.color,2.5);
  }else if(f.kind==='wake'){
    const r=f.r*(.62+progress*.54);
    oval(ctx,f.x,f.y,r,r*.52,null,'#bdffee',1.3);
    oval(ctx,f.x-r*.5,f.y+4,r*.5,r*.30,null,f.color,1);
  }else if(f.kind==='spark'){
    ctx.translate(f.x,f.y);ctx.rotate(Math.atan2(f.dy,f.dx));ctx.fillStyle=f.color;
    ctx.fillRect(-f.r*2,-f.r*.49,f.r*3.3,f.r);
  }else if(f.kind==='slash'){
    ctx.lineCap='round';
    const radius=f.r*(.72+.28*progress);
    const start=f.angle-f.swing-.34+progress*.34,end=f.angle+f.swing-.34+progress*.34;
    const glow=ctx.createRadialGradient(f.x,f.y,radius*.2,f.x,f.y,radius);
    glow.addColorStop(0,f.color+'00');glow.addColorStop(1,f.color+'83');
    ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.arc(f.x,f.y,radius,start,end);ctx.closePath();
    ctx.fillStyle=glow;ctx.fill();
    for(const [size,width,color] of [[1,13,f.color],[.98,4,'#fff9dc'],[.83,2,f.color]]){
      ctx.beginPath();ctx.arc(f.x,f.y,radius*size,start,end);
      ctx.strokeStyle=color;ctx.lineWidth=width*(1-progress*.60);ctx.stroke();
    }
    if(f.weapon==='claw'||f.weapon==='net'){
      ctx.beginPath();ctx.arc(f.x,f.y,radius*.64,start-.3,end-.18);
      ctx.strokeStyle=f.color;ctx.lineWidth=f.weapon==='net'?3:6;ctx.stroke();
    }
  }else if(f.kind==='impact'){
    ctx.translate(f.x,f.y);ctx.rotate(f.angle);
    const r=f.r*(.75+progress*.30);
    shape(ctx,[[-r*.84,0],[-r*.21,-r*.14],[r*.21,-r*.55],[r*.14,-r*.14],[r,0],
      [r*.19,r*.16],[r*.36,r*.53],[-r*.18,r*.18]],f.color);
  }else if(f.kind==='swirl'){
    const radius=f.r*(.3+.7*Math.min(1,progress*1.45));
    for(let i=0;i<3;i++){
      const offset=i*TAU/3+progress*3.2;
      ctx.beginPath();ctx.arc(f.x,f.y,radius-i*6,offset,offset+1.62);
      ctx.strokeStyle=i===1?'#e8ffdc':f.color;ctx.lineWidth=12*(1-progress)+1;ctx.stroke();
      const x=f.x+Math.cos(offset+1.62)*radius,y=f.y+Math.sin(offset+1.62)*radius;
      oval(ctx,x,y,8-i,7-i,'#68e7da66','#f2ffff',1.7);
    }
  }else if(f.kind==='bolt'){
    const offset=Math.sin(f.x*.21+progress*13)*14;
    const points=[[f.x-20,f.y-91],[f.x+offset,f.y-57],[f.x-9,f.y-43],[f.x+4,f.y-25],[f.x,f.y]];
    shape(ctx,points,null,'#ff82d0',10);
    shape(ctx,points,null,'#fff5e8',3.1);
    oval(ctx,f.x,f.y,14+progress*17,7+progress*9,null,'#f7aef7',2.8);
  }else if(f.kind==='shockwave'||f.kind==='storm'){
    const radius=f.r*Math.min(1,.28+progress*1.75);
    const glow=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,radius);
    glow.addColorStop(0,f.color+'45');glow.addColorStop(.77,f.color+'1c');glow.addColorStop(1,f.color+'6f');
    oval(ctx,f.x,f.y,radius,radius,glow,f.color,Math.max(2,8*(1-progress)));
    oval(ctx,f.x,f.y,radius*.91,radius*.91,null,'#fff0d6',2.1);
    const storm=f.kind==='storm',count=storm?14:8;
    for(let i=0;i<count;i++){
      const angle=i*TAU/count+progress*(storm?1.4:.2);
      const orbit=radius*(.50+(i%3)*.17);
      const x=f.x+Math.cos(angle)*orbit,y=f.y+Math.sin(angle)*orbit;
      if(storm){
        const offset=Math.sin(progress*13+i)*9;
        shape(ctx,[[x-9,y-31],[x+offset,y-15],[x-3,y-11],[x+11,y+3]],null,f.color,3.4);
        shape(ctx,[[x-9,y-31],[x+offset,y-15],[x-3,y-11],[x+11,y+3]],null,'#fff7d2',1.4);
        oval(ctx,x+10,y+3,7,4,null,'#ffd2f3',2);
      }else{
        const r=4+i%3*2;
        oval(ctx,x,y,r,r,null,'#c3fff4',1.5);
        oval(ctx,x-r*.3,y-r*.3,1.4,1.4,'#fff8d8');
      }
    }
  }else{
    ctx.font=`900 ${f.big?22:16}px Arial`;ctx.textAlign='center';
    ctx.strokeStyle='#092433';ctx.lineWidth=f.big?4:3;ctx.strokeText(f.text,f.x,f.y);
    ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y);
  }
  ctx.restore();
}

function drawWarning(e) {
  const progress=1-e.windup/e.castTime;
  const kind=e.activeMove;
  ctx.save();
  ctx.globalAlpha=.56+progress*.42;
  if(kind==='pulse'||kind==='summon'){
    const radius=kind==='summon'?112:BOSS_MOVES.pulse.radius;
    oval(ctx,e.x,e.y,radius,radius,kind==='summon'?'#94ffca26':'#fb6e913e',kind==='summon'?'#a6f5d1':'#ffc2c2',2.8);
    oval(ctx,e.x,e.y,Math.max(1,radius*progress),Math.max(1,radius*progress),null,kind==='summon'?'#a6f5d1':'#ff9185',2.4);
  }else if(kind==='mines'){
    const r=BOSS_MOVES.mines.radius;
    oval(ctx,e.markX,e.markY,r,r,'#f45c6429','#ffc2aa',2.4);
    shape(ctx,[[e.markX-r*.35,e.markY],[e.markX+r*.35,e.markY]],null,'#ffcebb',2);
    shape(ctx,[[e.markX,e.markY-r*.35],[e.markX,e.markY+r*.35]],null,'#ffcebb',2);
  }else{
    const move=BOSS_MOVES[kind];
    const rays=kind==='burst'||kind==='fan'?move.rays:1;
    const reach=kind==='charge'?move.speed*move.duration+e.size:kind==='burst'?230:kind==='fan'?254:214;
    const width=kind==='charge'?(e.size+11)*2:kind==='burst'?14:10;
    for(let i=0;i<rays;i++){
      const angle=e.aim+(kind==='fan'?(i/(rays-1)-.5)*1.22:i*TAU/rays);
      const dx=Math.cos(angle),dy=Math.sin(angle);
      ctx.lineCap='round';
      shape(ctx,[[e.x,e.y],[e.x+dx*reach,e.y+dy*reach]],null,'#f673974a',width);
      shape(ctx,[[e.x,e.y],[e.x+dx*reach*progress,e.y+dy*reach*progress]],null,'#ffc6a9',2.4);
    }
  }
  ctx.restore();
}

function drawShot(shot) {
  const angle=Math.atan2(shot.dy,shot.dx);
  ctx.save();ctx.translate(shot.x,shot.y);ctx.rotate(angle);
  const tail=shot.hostile?22:37;
  const trail=ctx.createLinearGradient(-tail,0,shot.r,0);
  trail.addColorStop(0,shot.color+'00');trail.addColorStop(1,shot.color+'bb');
  shape(ctx,[[-tail,0],[0,-shot.r*.78],[shot.r,0],[0,shot.r*.78]],trail);
  if(shot.kind==='音波'){
    for(const offset of [-13,-5,3]){
      ctx.beginPath();ctx.arc(offset,0,9+offset*.16,-1.05,1.05);
      ctx.strokeStyle=offset===3?'#f8e5ff':shot.color;ctx.lineWidth=offset===3?2.8:1.9;ctx.stroke();
    }
  }else if(shot.kind==='投掷'){
    ctx.rotate(shot.range*12);
    shape(ctx,[[-7,-4],[2,-7],[8,-1],[4,7],[-7,5]],shot.color,OUTLINE,1.5);
    shape(ctx,[[-5,-3],[1,-5],[4,-2]],null,'#ffeecc',1.5);
  }else{
    oval(ctx,0,0,shot.r,shot.r,shot.hostile?'#e485acbb':'#70e7e766',shot.color,1.7);
    oval(ctx,-2,-2,shot.r*.27,shot.r*.24,'#fff9dc');
  }
  ctx.restore();
}

function drawOffscreenThreats() {
  const {w,h,dpi,scale}=viewport;
  const p=run.player;
  const near=run.enemies.filter(e=>e.boss||e.entered<.9);
  if(!near.length)return;
  ctx.setTransform(dpi,0,0,dpi,0,0);
  const position={x:clamp((p.x-camera.x)*scale,30,w-30),y:clamp((p.y-camera.y)*scale,92,h-112)};
  const used=new Set();
  for(const e of near.sort((a,b)=>Number(b.boss)-Number(a.boss))){
    const x=(e.x-camera.x)*scale,y=(e.y-camera.y)*scale,s=e.size*scale;
    if(x>-s&&x<w+s&&y>-s&&y<h+s)continue;
    const dx=x-position.x,dy=y-position.y;
    const edge=Math.min(
      dx>0?(w-21-position.x)/dx:dx<0?(21-position.x)/dx:Infinity,
      dy>0?(h-103-position.y)/dy:dy<0?(75-position.y)/dy:Infinity,
    );
    const px=position.x+dx*edge,py=position.y+dy*edge;
    const sector=Math.round((Math.atan2(dy,dx)+Math.PI)*4/Math.PI)%8;
    if(used.has(sector))continue;
    used.add(sector);
    ctx.save();ctx.translate(px,py);ctx.rotate(Math.atan2(dy,dx));
    ctx.globalAlpha=e.boss?.94:Math.min(.78,(.97-e.entered)*2);
    oval(ctx,0,0,e.boss?13:9,e.boss?13:9,'#112134dd',e.color,1.6);
    shape(ctx,[[-3,-3],[3,0],[-3,3]],null,e.color,2);
    ctx.restore();
  }
}

function draw() {
  const {w,h,dpi,scale}=viewport,p=run.player;
  if(w<=0||h<=0)return;
  const visibleW=w/scale,visibleH=h/scale;
  camera.x=visibleW>=world.w?(world.w-visibleW)/2:clamp(p.x-visibleW/2,0,world.w-visibleW);
  camera.y=visibleH>=world.h?(world.h-visibleH)/2:clamp(p.y-visibleH/2,0,world.h-visibleH);
  const shake=run.shake>0&&!reduceMotion.matches?run.shake*21:0;
  ctx.setTransform(dpi,0,0,dpi,0,0);ctx.fillStyle='#081a29';ctx.fillRect(0,0,w,h);
  ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
  ctx.scale(scale,scale);ctx.translate(-camera.x,-camera.y);
  ctx.drawImage(run.ground,0,0);
  const inView=(point,pad)=>point.x>=camera.x-pad&&point.x<=camera.x+visibleW+pad&&
    point.y>=camera.y-pad&&point.y<=camera.y+visibleH+pad;
  for(const fx of run.fx)if(fx.kind==='wake')drawEffect(fx);
  if(run.storm){
    const p=run.player,orbit=run.time*2.9;
    oval(ctx,p.x,p.y,200,200,'#ee83ff12','#e9a2e962',2.5);
    for(let i=0;i<5;i++){
      const a=orbit+i*TAU/5;
      const x=p.x+Math.cos(a)*169,y=p.y+Math.sin(a)*169;
      oval(ctx,x,y,8,5,'#f979dbbc','#ffd7f4',2);
      oval(ctx,x+3,y-2,2,2,'#fff4f7');
    }
  }
  for(const hazard of run.hazards){
    if(!inView(hazard,hazard.radius))continue;
    const progress=1-hazard.wait/hazard.duration;
    oval(ctx,hazard.x,hazard.y,hazard.radius,hazard.radius,'#ff737a39','#fdd098',2.2);
    const r=Math.max(1,hazard.radius*progress);
    oval(ctx,hazard.x,hazard.y,r,r,null,'#ff9b80',3);
    oval(ctx,hazard.x,hazard.y,11,10,'#542235','#ffbe84',2);
  }
  for(const drop of run.drops){
    if(!inView(drop,12))continue;
    const bob=Math.sin(run.time*5+drop.x)*2;
    if(drop.kind==='gift'){
      const x=drop.x,y=drop.y+bob;
      const r=drop.value>1?14:10;
      oval(ctx,x,y+8,r+3,5,'#1518287f');
      box(ctx,x-r,y-7,r*2,16,3,drop.value>1?'#e68ad7':'#e5ad67','#221637',1.7);
      box(ctx,x-r-1,y-9,r*2+2,6,2,'#ffcc7c','#221637',1);
      shape(ctx,[[x,y+8],[x,y-10],[x-5,y-14],[x-8,y-10],[x,y-10],[x+6,y-14],[x+8,y-10],[x,y-10]],null,'#fff2be',2);
    }else{
      oval(ctx,drop.x,drop.y+bob,8,6,'#fddb79','#543d33',1.5);
      box(ctx,drop.x-8,drop.y-1+bob,16,3,1,'#98684c');
      box(ctx,drop.x-8,drop.y-2+bob,16,2,1,'#8bc274');
    }
  }
  for(const e of run.enemies){
    if(!inView(e,e.windup>0?(e.boss?300:219):e.size+70))continue;
    if(e.windup>0)drawWarning(e);
    if(e.rush>0){
      const dx=Math.cos(e.rushAngle),dy=Math.sin(e.rushAngle);
      for(let i=1;i<=3;i++)oval(ctx,e.x-dx*i*21,e.y-dy*i*21,e.size*(1-i*.17),e.size*(.58-i*.10),e.color+'43');
    }
    drawEnemy(ctx,e,run.time);
  }
  for(const shot of run.shots)if(inView(shot,42))drawShot(shot);
  oval(ctx,p.x,p.y+15,22-p.stride*2,8,'#07283795',run.hero.color+'8f',1.65);
  ctx.save();
  if(run.hurtGlow>0)ctx.globalAlpha=.75+run.hurtGlow*.5;
  drawHero(ctx,run.hero.id,p.x,p.y-7,.91,{time:run.time,steps:p.steps,face:p.face,
    stride:p.stride,tilt:p.tilt,kick:p.kick,cast:p.cast,aim:p.aim});
  ctx.restore();
  for(const effect of run.fx){if(effect.kind!=='wake'&&inView(effect,effect.r||35))drawEffect(effect)}
  drawOffscreenThreats();
  if(run.hurtGlow>0){
    ctx.setTransform(dpi,0,0,dpi,0,0);
    const size=Math.min(w,h);
    const edge=ctx.createRadialGradient(w/2,h/2,size*.27,w/2,h/2,Math.hypot(w,h)*.54);
    edge.addColorStop(0,'#ef4a7400');edge.addColorStop(1,'#ef4a7473');
    ctx.globalAlpha=run.hurtGlow*1.45;ctx.fillStyle=edge;ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;
  }
}

function loop(now) {
  if(!run)return;
  let elapsed=clamp((now-previous)/1000,0,.15);previous=now;
  if(!modal.open&&run.phase!=='finished'){
    while(elapsed>0&&!modal.open){
      const dt=Math.min(elapsed,.032);
      update(dt);elapsed-=dt;
    }
    updateHud();
  }
  if(!modal.open||!drawPaused)draw();
  drawPaused=modal.open;
  frame=requestAnimationFrame(loop);
}

function resetInput() {
  keys.clear();
  if(joystick.id!==null && $('#joystick').hasPointerCapture(joystick.id))$('#joystick').releasePointerCapture(joystick.id);
  joystick.id=null;joystick.x=0;joystick.y=0;
  $('#stick').style.transform='translate(-50%,-50%)';
}

function moveStick(e) {
  const rect=joystick.bounds,max=rect.width*.33;
  const x=e.clientX-rect.left-rect.width/2,y=e.clientY-rect.top-rect.height/2,len=Math.hypot(x,y);
  const deadzone=rect.width*.062;
  const strength=clamp((len-deadzone)/(max-deadzone),0,1);
  joystick.x=x/(len||1)*strength;joystick.y=y/(len||1)*strength;
  $('#stick').style.transform=`translate(calc(-50% + ${joystick.x*max}px),calc(-50% + ${joystick.y*max}px))`;
}

const pad=$('#joystick');
pad.addEventListener('pointerdown',e=>{
  if(joystick.id!==null||!run||modal.open||e.button!==0)return;
  e.preventDefault();joystick.id=e.pointerId;joystick.bounds=pad.getBoundingClientRect();
  pad.setPointerCapture(e.pointerId);moveStick(e);
});
pad.addEventListener('pointermove',e=>{if(e.pointerId===joystick.id)moveStick(e)});
for(const event of ['pointerup','pointercancel','lostpointercapture']){
  pad.addEventListener(event,e=>{
    if(e.pointerId!==joystick.id)return;
    joystick.id=null;joystick.x=0;joystick.y=0;$('#stick').style.transform='translate(-50%,-50%)';
  });
}

document.addEventListener('keydown',e=>{
  if(!run || e.ctrlKey || e.metaKey || e.altKey)return;
  const key=e.key.toLowerCase();
  if(key==='escape'){
    if(!e.repeat && !modal.open){e.preventDefault();pause()}
    return;
  }
  if(modal.open)return;
  if(['a','d','s','w','arrowup','arrowdown','arrowleft','arrowright',' ','q'].includes(key)){
    e.preventDefault();
    if(!e.repeat&&key===' ')useSkill(false);
    else if(!e.repeat&&key==='q')useSkill(true);
    else keys.add(key);
  }
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',resetInput);
document.addEventListener('visibilitychange',()=>{
  if(!run||run.phase==='finished')return;
  if(document.hidden){
    if(!modal.open)pause();
    else audio.stop();
  }
});
window.addEventListener('resize',()=>{if(run){resetInput();resizeField();draw()}else drawSplash(splash,skin)});
window.addEventListener('storage',e=>{
  if(e.key===RUN_STORAGE&&!run){
    checkpoint=readCheckpoint();
    renderLobby();
  }
});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});
skin.addEventListener('load',()=>drawSplash(splash,skin));
skin.src='./undersea.jpg';

modal.addEventListener('cancel',e=>{
  e.preventDefault();
  if(dialogKind==='pause')resume();
  else if(dialogKind!=='prep'&&dialogKind!=='result')closeDialog();
});

document.addEventListener('click',async e=>{
  const button=e.target.closest('button');
  if(!button)return;
  if(dialogKind==='prep')prepAction(button);
  if(button.dataset.audio){
    const channel=button.dataset.audio;profile[channel]=!profile[channel];
    audio.unlock();syncAudio();save();
    if(channel==='sfx')audio.effect('attack');
  }
  if(button.dataset.hero!==undefined){
    const i=Number(button.dataset.hero);
    if(i&&!profile.unlocked)notify('通过浅海难度的全部 20 波即可解锁');
    else {selectedHero=i;renderLobby();save()}
  }
  if(button.dataset.map!==undefined){
    selectedMap=Number(button.dataset.map);renderLobby();save();
  }
  if(button.dataset.difficulty!==undefined){
    selectedDifficulty=Number(button.dataset.difficulty);renderLobby();save();
  }
  if(button.dataset.open==='guide')showGuide();
  if(button.dataset.open==='install')showInstall();
  if(button.hasAttribute('data-close'))closeDialog();
  if(button.hasAttribute('data-copy'))await copyLink(button);
  if(button.hasAttribute('data-export-profile'))exportProfile();
  if(button.hasAttribute('data-import-profile'))$('#profile-file').click();
  if(button.hasAttribute('data-share')){
    try{
      if(navigator.share)await navigator.share({title:document.title,url:launchUrl()});
      else await copyLink(button);
    }catch(error){if(error.name!=='AbortError')await copyLink(button)}
  }
  if(button.hasAttribute('data-install')&&installPrompt){
    const prompt=installPrompt;installPrompt=null;await prompt.prompt();showInstall();
  }
  if(button.id==='start')startRun(checkpoint);
  if(button.hasAttribute('data-retry')||button.hasAttribute('data-new-run'))startRun();
  if(button.id==='new-run'){
    openDialog('replace','新开一局？',`<p>当前进度在第 ${checkpoint.wave} 波。开新局会覆盖这份战斗存档。</p>
      <div class="dialog-actions"><button class="dark-button" data-close>取消</button><button class="primary" data-new-run>开始新局</button></div>`);
  }
  if(button.id==='pause')pause();
  if(button.id==='skill')useSkill(false);
  if(button.id==='ultimate')useSkill(true);
  if(button.hasAttribute('data-resume'))resume();
  if(button.hasAttribute('data-home'))home();
});

initializeLobby();renderLobby();syncAudio();drawSplash(splash,skin);
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  const checkOffline=()=>{
    const controller=navigator.serviceWorker.controller;
    if(!controller)return;
    const channel=new MessageChannel();
    const timer=setTimeout(()=>channel.port1.close(),5000);
    channel.port1.onmessage=({data})=>{
      clearTimeout(timer);channel.port1.close();
      if(data?.type!=='offline-status'||data.version!==4||controller!==navigator.serviceWorker.controller)return;
      offlineReady=data.ready===true;
      const status=$('#offline-status');
      if(status)status.textContent=offlineReady?'离线资源已就绪。当前设备会保留战绩、解锁和每波存档。':'离线资源还在准备，请保持联网并刷新游戏。';
    };
    controller.postMessage({type:'offline-status'},[channel.port2]);
  };
  navigator.serviceWorker.addEventListener('controllerchange',checkOffline);
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(checkOffline).catch(()=>{});
}
