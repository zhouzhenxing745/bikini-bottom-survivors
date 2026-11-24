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
const SLOT_LABELS=['左手','右手','悬浮槽 1','悬浮槽 2'];
const SLOT_KINDS=['近战','近战','远程','远程'];
const TIERS=[
  {damage:1,rate:1,range:1},{damage:1.20,rate:.92,range:1.05},
  {damage:1.44,rate:.84,range:1.10},{damage:1.73,rate:.76,range:1.15},
];
const GOODS=[...PREP_ITEMS.map(({cost,...item})=>({...item,price:cost*9})),...SUPPLIES];
const count=value=>Number.isInteger(value)&&value>=0?value:0;
const skin=new Image();
const splash=$('#splash');
const touchInput=matchMedia('(any-pointer: coarse)');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const viewport={w:0,h:0,scale:1,pixels:null};
const camera={x:0,y:0};
const keys=new Set();
const joystick={id:null,x:0,y:0};
const skillQueue=[0,0];
const SKILL_BUFFER=.18;
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
  const hero=HEROES[selectedHero],map=MAPS[selectedMap],weapon=ARMORY[hero.weapon];
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
  const weapons=Object.values(ARMORY).map(w=>`<div><strong>${w.glyph} ${w.name}</strong><small>${w.kind} · 伤害 ${w.damage} · 攻速 ${(1/w.rate).toFixed(2)} 次/秒 · 范围 ${w.range}</small><small>${w.trait}</small></div>`).join('');
  const items=GOODS.map(item=>`<div><strong>${item.glyph} ${item.name}</strong><small>${item.label} · 基础价 ${item.price}</small></div>`).join('');
  openDialog('guide','玩法图鉴',`
    <p>拖动摇杆躲避敌人，武器会自动攻击。泡泡旋刃近身击退并减速敌人，水母风暴会跟随你连续放电。</p>
    <p>键盘支持 WASD 或方向键移动，空格释放小技能，Q 释放终极技能，Esc 暂停。</p>
    <p>每波存活 60 秒，第 5、10、15、20 波还须击败首领。击杀直接获得经验，靠近掉落物可拾取补给点，漏拾的点数会并入下一波掉落。</p>
    <p>开局带一把武器，近战和远程各可装备两把。整备可升阶、回收或锁定商品。浅海通关会解锁所有角色。</p>
    <h3>武器</h3><div class="guide-list">${weapons}</div>
    <h3>商店道具</h3><div class="guide-list">${items}</div>`);
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
  if(battle.hidden)return false;
  const {width,height,left=0,top=0}=field.getBoundingClientRect();
  if(!width||!height)return false;
  const pixels=fitCanvas(field,width,height);
  const changed=width!==viewport.w||height!==viewport.h||pixels.resized;
  viewport.w=width;viewport.h=height;
  viewport.pixels=pixels;
  viewport.scale=clamp(Math.min(width,height)/416,.66,1.32);
  const padBounds=pad.getBoundingClientRect();
  const smallBounds=hud.skill.getBoundingClientRect();
  const ultimateBounds=hud.ultimate.getBoundingClientRect();
  const controlsTop=Math.min(padBounds.top,smallBounds.top,ultimateBounds.top);
  const waveHudBottom=hud.wave.parentElement?.getBoundingClientRect().bottom;
  viewport.warningEdges={
    left:clamp((padBounds.left-left||0)+9,Math.min(21,width*.2),width*.4),
    right:clamp((ultimateBounds.right-left||width)-9,width*.6,width-Math.min(21,width*.2)),
    top:clamp(Number.isFinite(waveHudBottom)?waveHudBottom-top+15:88,0,height*.48),
    bottom:clamp(Number.isFinite(controlsTop)?controlsTop-top-16:height-118,height*.57,height),
  };
  return changed;
}

function useFieldPixels() {
  const {resolution,x,y}=viewport.pixels;
  ctx.setTransform(resolution,0,0,resolution,x,y);
}

function createGround(map) {
  const canvas=document.createElement('canvas');canvas.width=world.w;canvas.height=world.h;
  drawArena(canvas.getContext('2d'),world.w,world.h,map);
  return canvas;
}

const armoryKeys=Object.keys(ARMORY);
const starterSlot=hero=>ARMORY[hero.weapon].kind==='近战'?0:2;
function restoreGear(saved,hero) {
  if(Array.isArray(saved?.gear)){
    const gear=SLOT_KINDS.map((kind,i)=>{
      const slot=saved.gear[i];
      return slot&&armoryKeys.includes(slot.key)&&ARMORY[slot.key].kind===kind
        ?{key:slot.key,tier:clamp(count(slot.tier),1,4),cooldown:0,flash:0,aim:0}:null;
    });
    if(gear.some(Boolean))return gear;
  }
  const gear=Array(4).fill(null);
  gear[starterSlot(hero)]={key:hero.weapon,tier:clamp(count(saved?.player?.weaponTier)+1,1,4),cooldown:0,flash:0,aim:0};
  return gear;
}

function readCheckpointState() {
  try {
    const current=JSON.parse(localStorage.getItem(RUN_STORAGE)||'null');
    return current?{id:current.id,revision:current.revision??JSON.stringify(current)}:{id:null,revision:null};
  } catch {
    return null;
  }
}

function startRun(saved=null) {
  closeDialog();resetInput();
  if(saved){
    selectedHero=saved.hero;selectedMap=saved.map;selectedDifficulty=saved.difficulty;
  }
  const memoryOnly=saved?.pendingRevision!==undefined;
  const checkpointRevision=saved
    ?(memoryOnly?saved.pendingRevision:saved.revision??JSON.stringify(saved))
    :(readCheckpointState()?.revision??null);
  const hero=HEROES[selectedHero],map=MAPS[selectedMap],weapon=ARMORY[hero.weapon];
  const player={
    x:world.w/2,y:world.h/2,hp:hero.hp,maxHp:hero.hp,speed:hero.speed,power:hero.power,rate:hero.id==='squid'?weapon.rate*.82:weapon.rate,
    magnet:map.id==='town'?99:84,range:weapon.range,cooldown:1,invulnerable:0,armor:0,crit:.05,skillPower:1,
    skill:0,ultimate:0,charge:0,xp:0,level:1,need:xpForLevel(1),face:1,steps:0,
    stride:0,kick:0,cast:0,tilt:0,aim:0,nextTrail:0,skillMax:0,ultimateMax:0,
    recovery:0,pickupBonus:0,luck:0,
  };
  if(saved){
    for(const stat of Object.keys(player)){
      if(stat!=='need'&&Number.isFinite(saved.player[stat]))player[stat]=saved.player[stat];
    }
    player.need=xpForLevel(player.level);
    if(!Array.isArray(saved.gear)){
      const oldTier=PREVIOUS_WEAPON_TIERS[count(saved.player.weaponTier)-1];
      player.rate=clamp(player.rate/(oldTier?.rate||1),UPGRADE_LIMITS.attackInterval,1.8);
      player.range=clamp(player.range-weapon.range*((oldTier?.range||1)-1),60,UPGRADE_LIMITS.range);
    }
  }
  const questions=Array.isArray(saved?.questions)?saved.questions.map(id=>QUIZZES.find(q=>q[0]===id)).filter(Boolean):shuffle(QUIZZES);
  run={
    hero,map,gear:restoreGear(saved,hero),ground:createGround(map),difficulty:DIFFICULTIES[selectedDifficulty],difficultyIndex:selectedDifficulty,
    id:saved?.id||globalThis.crypto?.randomUUID?.()||Date.now().toString(36),
    enemies:[],shots:[],fx:[],hazards:[],questions,kills:count(saved?.kills),wave:saved?.wave||0,phase:'intro',clock:0,waveTime:WAVE_SECONDS,
    time:Number.isFinite(saved?.time)?saved.time:0,shake:0,canSave:!memoryOnly,checkpointRevision,
    drops:[],points:saved?.points===undefined?count(saved?.gifts)*9:count(saved.points),
    reserve:count(saved?.reserve),pointFraction:Number.isFinite(saved?.pointFraction)?clamp(saved.pointFraction,0,1):0,
    heldOffers:validOffers(saved?.heldOffers),
    upgrades:Array.isArray(saved?.upgrades)?saved.upgrades.filter(name=>UPGRADES.some(u=>u.name===name)):[],
    inventory:Object.fromEntries(GOODS.map(item=>[item.id,Math.min(item.limit,count(saved?.inventory?.[item.id]))])),
    answers:count(saved?.answers),correct:count(saved?.correct),player,
  };
  audio.unlock();audio.start(()=>run?.wave||1,true);
  lobby.hidden=true;battle.hidden=false;document.body.classList.add('in-battle');
  const portrait=$('#portrait').getContext('2d');
  portrait.clearRect(0,0,48,48);drawHero(portrait,hero.id,24,23,.77);
  resizeField();drawPaused=false;
  if(saved?.prep){
    run.phase='prep';run.waveTime=0;
    run.prep={rerolls:count(saved.prep.rerolls),level:saved.prep.level||null,offers:shopOffers(validOffers(saved.prep.offers))};
    audio.stop();showPrep();
  }else{
    beginWave(Boolean(saved));
    battle.focus({preventScroll:true});
  }
  updateHud();
  save();
  previous=performance.now();cancelAnimationFrame(frame);frame=requestAnimationFrame(loop);
}

function saveWave() {
  const current=readCheckpointState();
  if(current&&current.revision!==run.checkpointRevision){
    checkpoint=readCheckpoint();
    if(run.canSave)notify('另一标签页已更新存档，本页的进度不会覆盖它。');
    run.canSave=false;
    return;
  }
  const next={
    id:run.id,revision:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),
    hero:HEROES.indexOf(run.hero),map:MAPS.indexOf(run.map),difficulty:run.difficultyIndex,
    wave:run.wave,kills:run.kills,time:run.time,player:{...run.player},
    questions:run.questions.map(q=>q[0]),points:run.points,reserve:run.reserve,pointFraction:run.pointFraction,
    gear:run.gear.map(slot=>slot?{key:slot.key,tier:slot.tier}:null),
    inventory:{...run.inventory},prep:run.prep||null,heldOffers:run.heldOffers,
    upgrades:[...run.upgrades],answers:run.answers,correct:run.correct,
  };
  run.canSave=writeLocal(RUN_STORAGE,next);
  if(run.canSave)run.checkpointRevision=next.revision;
  else Object.defineProperty(next,'pendingRevision',{value:run.checkpointRevision});
  checkpoint=next;
}

function clearWaveSave() {
  const current=readCheckpointState();
  if(current&&current.revision!==run.checkpointRevision){
    checkpoint=readCheckpoint();
    return;
  }
  if(checkpoint?.id===run.id)checkpoint=null;
  if(current?.id===run.id&&writeLocal(RUN_STORAGE,null))run.checkpointRevision=null;
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
  const healing=run.difficulty.heal+(run.hero.id==='sponge'?8:0)+(run.map.id==='krusty'?4:0)+p.recovery;
  p.hp=Math.min(p.maxHp,p.hp+healing);
  p.charge=Math.min(100,p.charge+12);
  p.skill=0;p.ultimate=0;
  run.gear.forEach(slot=>{if(slot){slot.cooldown=0;slot.flash=0}});
  run.shots.length=0;
  saveWave();
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

function spawnEnemy(boss=false,forcedType=null,area=null,summoned=false) {
  const wave=run.wave,diff=run.difficulty;
  const pool=['jelly','jelly','jelly','blue'];
  if(wave>=4)pool.push('blue','robot');
  if(wave>=7)pool.push('spitter');
  if(wave>=12)pool.push('spitter','robot');
  const type=boss?'boss':forcedType||pool[Math.floor(Math.random()*pool.length)];
  const spec=boss?BOSSES[wave/5-1]:ENEMY_TYPES[type];
  const healthScale=boss?diff.bossHp*(1+.29*(wave/5-1)**1.45)
    :diff.hp*(1+(wave-1)*.059+Math.max(0,wave-5)*.075);
  const hp=Math.round(spec.hp*healthScale);
  const position=area||enemyPosition(boss?Math.min(290,Math.max(211,viewport.w*.45/viewport.scale)):190+Math.random()*108);
  const e={...position,type,boss,hp,maxHp:hp,name:spec.name,color:spec.color,attack:spec.attack,moves:spec.moves,interval:spec.interval,
    attackClock:boss?1.55:1.9+Math.random()*1.3,activeMove:null,pattern:0,windup:0,castTime:0,rush:0,rushAngle:0,
    size:boss?35+wave*.68:spec.size,damage:spec.damage*diff.damage*(boss?1+(wave-5)*.019:1+(wave-1)*.029),
    xp:boss?spec.xp:summoned?.5:spec.xp*.47,
    speed:spec.speed*diff.speed*(run.map.id==='jelly'?1.1:1)*(1+wave*.007)*(boss?1:{jelly:.92,blue:.87,spitter:.95,robot:1.05}[type]),
    flash:0,slow:0,dx:0,dy:0,entered:0,phase:Math.random()*TAU,summoned};
  run.enemies.push(e);
  if(boss)run.boss=e;
  if(boss||!area||summoned)ring(e.x,e.y,e.size*1.85,e.color,.52);
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

function weaponStats(slot) {
  const p=run.player,weapon=ARMORY[slot.key],base=ARMORY[run.hero.weapon],tier=TIERS[slot.tier-1];
  return {
    damage:weapon.damage*p.power*tier.damage,
    rate:Math.max(.23,weapon.rate*(p.rate/base.rate)*tier.rate),
    range:clamp(weapon.range*tier.range+p.range-base.range,70,UPGRADE_LIMITS.range),
  };
}

function weaponMount(index) {
  const p=run.player;
  if(index<2)return {x:p.x+(index===0?-23:23),y:p.y+4};
  const a=run.time*1.85+(index-2)*Math.PI;
  return {x:p.x+Math.cos(a)*39,y:p.y-13+Math.sin(a)*19};
}

function materialDrop(e) {
  const decay=run.wave<=4?1:Math.max(.5,1-run.wave*.015);
  const dropRate=e.type==='robot'?.59:e.type==='spitter'?.33:run.wave<=3?.22:.26;
  const chance=decay*dropRate;
  if(e.summoned||(!e.boss&&Math.random()>=chance))return;
  const value=e.boss?12:e.type==='robot'?3:e.type==='spitter'?2:1;
  const owed=Math.min(run.reserve,3);
  run.reserve-=owed;
  run.drops.push({x:e.x,y:e.y,kind:'point',value:value+owed});
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
  materialDrop(e);
  if(e.boss||run.kills%(run.difficulty.burger*2)===0)run.drops.push({x:e.x+10,y:e.y+8,kind:'heal'});
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

const MELEE={
  slash:{arc:.94,limit:5,falloff:.7},cleave:{arc:1.34,limit:8,falloff:.73},
  thrust:{arc:.23,limit:2,falloff:.82},
};
const PROJECTILES={
  rock:{speed:555,radius:9,pierce:0},note:{speed:722,radius:7,pierce:1},
  bubble:{speed:620,radius:9,pierce:0},dart:{speed:855,radius:5,pierce:0},
};

function attack(dt) {
  const p=run.player;
  run.gear.forEach((slot,index)=>{
    if(!slot)return;
    slot.cooldown=Math.max(0,slot.cooldown-dt);
    if(slot.cooldown>0)return;
    const origin=weaponMount(index),stats=weaponStats(slot);
    let target=null,nearest=stats.range;
    for(const enemy of run.enemies){
      if(enemy.hp<=0)continue;
      const d=distance(enemy,origin)-enemy.size*.3;
      if(d<nearest){nearest=d;target=enemy}
    }
    if(!target)return;
    fireWeapon(slot,origin,target,nearest,stats);
  });
}

function fireWeapon(slot,origin,target,nearest,stats) {
  const p=run.player,w=ARMORY[slot.key];
  slot.cooldown=stats.rate;slot.flash=.25;
  const angle=Math.atan2(target.y-origin.y,target.x-origin.x);
  slot.aim=angle;
  p.kick=.27;p.face=Math.cos(angle)<0?-1:1;p.aim=angle;
  const critical=Math.random()<p.crit;
  const damage=stats.damage*(critical?1.8:1);
  const {style}=w;
  const melee=MELEE[style];
  if(melee){
    const radius=Math.min(stats.range+15,Math.max(69,nearest+target.size*.88));
    run.fx.push({kind:style==='thrust'?'lance':'slash',...origin,angle,swing:melee.arc,r:radius,color:w.color,
      weapon:slot.key,life:.28,max:.28});
    damageEnemy(target,damage,w.knock,critical);
    let count=1;
    for(const e of run.enemies){
      if(count>=melee.limit)break;
      if(e===target||e.hp<=0||distance(e,origin)>stats.range+e.size*.3)continue;
      const bearing=Math.atan2(e.y-origin.y,e.x-origin.x);
      if(Math.cos(bearing-angle)>=Math.cos(melee.arc)){
        damageEnemy(e,damage*melee.falloff,w.knock*.76,critical);
        count++;
      }
    }
    audio.effect(critical?'critical':'hit');
    return;
  }
  const dx=Math.cos(angle),dy=Math.sin(angle);
  if(style==='beam'){
    const travel={x:dx,y:dy,length:stats.range+18};
    const targets=run.enemies.filter(e=>e.hp>0).map(e=>({e,hit:shotContact(origin,e,e.size+5,travel)}))
      .filter(entry=>entry.hit<Infinity).sort((a,b)=>a.hit-b.hit).slice(0,3);
    targets.forEach(({e},i)=>damageEnemy(e,damage*.77**i,w.knock,critical));
    run.fx.push({kind:'beam',...origin,angle,r:travel.length,color:w.color,life:.2,max:.2});
    audio.effect(critical?'critical':'clarinet');
    return;
  }
  const shot=PROJECTILES[style];
  run.shots.push({...origin,dx:dx*shot.speed,dy:dy*shot.speed,color:w.color,damage,critical,knock:w.knock,
    range:(stats.range+38)/shot.speed,r:shot.radius,pierce:shot.pierce,hits:[],kind:style});
  ring(origin.x,origin.y,17,w.color,.15);
  audio.effect({rock:'rock',note:'clarinet',bubble:'bubble',dart:'net'}[style]);
}

function closestShotTarget(shot,travel) {
  let target=null,nearest=Infinity;
  for(const e of run.enemies){
    if(e.hp<=0||shot.hits.includes(e))continue;
    const contact=shotContact(shot,e,shot.r+e.size,travel);
    if(contact<nearest){target=e;nearest=contact}
  }
  return target;
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
        if(distance(area,p)>75)spawnEnemy(false,i%2?'robot':'blue',area,true);
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
      let hit;
      while((hit=closestShotTarget(shot,travel))){
        damageEnemy(hit,shot.damage,shot.knock,shot.critical);
        if(shot.kind==='bubble'||run.hero.id==='gary')hit.slow=Math.max(hit.slow,2);
        audio.effect(shot.critical?'critical':'hit');
        if(!shot.pierce){shot.range=0;break}
        shot.hits.push(hit);
        shot.pierce--;shot.damage*=.68;
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
    const pickup=drop.kind==='point'?26+p.magnet*.60:p.magnet*.66;
    if(drop.kind==='heal'&&p.hp===p.maxHp)continue;
    if(d<21){
      if(drop.kind==='point'){
        const value=drop.value*(1+p.pickupBonus)+run.pointFraction;
        const points=Math.floor(value+1e-7);
        run.points+=points;run.pointFraction=Math.max(0,value-points);
        if(drop.value>=3)floatText(p.x,p.y-30,'+'+points,'#ffd77a');
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
  if(!run||modal.open||run.phase!=='combat')return false;
  const p=run.player;
  if(ultimate ? p.ultimate>0||p.charge<100 : p.skill>0)return false;
  const slot=Number(ultimate);
  skillQueue[slot]=0;
  run.castUntil??=[0,0];
  run.castUntil[slot]=run.time+.28;
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
  return true;
}

function requestSkill(ultimate) {
  if(useSkill(ultimate)||!run||modal.open||run.phase!=='combat')return;
  const p=run.player;
  const remaining=ultimate?p.ultimate:p.skill;
  if(remaining>SKILL_BUFFER||remaining<=0||(ultimate&&p.charge<100))return;
  skillQueue[Number(ultimate)]=run.time+SKILL_BUFFER+.06;
  updateHud();
}

function releaseQueuedSkills() {
  for(let i=0;i<skillQueue.length;i++){
    const deadline=skillQueue[i];
    if(!deadline)continue;
    if(run.time>deadline)skillQueue[i]=0;
    else useSkill(Boolean(i));
  }
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
  const cap=Math.min(46,13+run.difficulty.crowd+Math.floor(run.wave*.43)+(late?3:0)-(bossAlive?3:0));
  if(run.enemies.length>=cap){
    run.spawn=.16;
    return;
  }
  const roll=Math.random();
  const type=run.wave>=4&&roll<.18?'robot':run.wave>=3&&roll<.42?'spitter':run.wave>=2&&roll>.77?'blue':'jelly';
  const amount=type==='robot'?1:(type==='spitter'?2:5)+Number(Math.random()<.56);
  const capacity=cap-run.enemies.length;
  if(capacity<Math.ceil(amount/2)){
    run.spawn=.18;
    return;
  }
  const center=enemyPosition(226+Math.random()*94);
  const formation=Math.random()*TAU;
  for(let i=0;i<Math.min(capacity,amount);i++){
    const angle=formation+i*TAU/amount;
    const radius=amount===1?0:amount<4?21:34;
    const spot={
      x:clamp(center.x+Math.cos(angle)*radius,25,world.w-25),
      y:clamp(center.y+Math.sin(angle)*radius,25,world.h-25),
    };
    spawnEnemy(false,type,spot);
  }
  ring(center.x,center.y,amount===1?27:amount<4?40:52,ENEMY_TYPES[type].color,.52);
  const delay=Math.max(.71,1.22-run.wave*.018-run.difficulty.count*.052-(late?.12:0));
  run.spawn=delay*(bossAlive?1.2:1)*(.87+Math.random()*.28);
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
  p.invulnerable-=dt;p.skill-=dt;p.ultimate-=dt;run.shake-=dt;
  run.gear.forEach(slot=>{if(slot)slot.flash=Math.max(0,slot.flash-dt)});
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
    releaseQueuedSkills();
    spawnDuringWave(dt);
    attack(dt);
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
  skillQueue.fill(0);
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

const sellableItem=id=>GOODS.find(item=>item.id===id);
const itemAvailable=item=>run.inventory[item.id]<item.limit&&(!item.available||item.available(run.player));
const shopPrice=base=>Math.max(1,Math.floor(base*(1+.055*run.wave)+Math.sqrt(run.wave)));
const tierPrice=tier=>[1,1.65,2.52,3.7][tier-1];
const refreshPrice=()=>3+Math.floor(run.wave*.5)+(run.prep.rerolls+1)*(2+Math.floor(run.wave/8));

function validOffers(raw) {
  if(!Array.isArray(raw))return [];
  return raw.filter(entry=>entry&&Number.isInteger(entry.price)&&entry.price>0&&
    (entry.type==='weapon'?armoryKeys.includes(entry.id):entry.type==='item'&&sellableItem(entry.id))).slice(0,4).map(entry=>({
      id:entry.id,type:entry.type,price:entry.price,tier:clamp(count(entry.tier),1,4),
      locked:entry.locked===true,sold:entry.sold===true,discount:entry.discount===true,
    }));
}

function weaponDestination(offer) {
  const kind=ARMORY[offer.id].kind;
  const merge=run.gear.findIndex(slot=>slot?.key===offer.id&&slot.tier===offer.tier&&slot.tier<4);
  if(merge>=0)return {index:merge,merge:true};
  return {index:run.gear.findIndex((slot,i)=>!slot&&SLOT_KINDS[i]===kind),merge:false};
}

function shopOffers(kept=[]) {
  const offers=[...kept],used=new Set(offers.map(offer=>offer.id));
  const missing=SLOT_KINDS.filter((_,i)=>!run.gear[i]);
  const guaranteed=missing.includes('近战')&&missing.includes('远程')?SLOT_KINDS[starterSlot(run.hero)]==='近战'?'远程':'近战':missing[0];
  const firstWeapon=offers.every(offer=>offer.type!=='weapon'||offer.sold);
  const items=shuffle(GOODS.filter(item=>itemAvailable(item)&&!used.has(item.id)));
  while(offers.length<4){
    const heldWeapons=offers.filter(entry=>entry.type==='weapon').length;
    const isStarterOffer=firstWeapon&&heldWeapons===0;
    const type=isStarterOffer||!items.length||((heldWeapons<2||!offers.some(entry=>entry.type==='item'))&&Math.random()<.49)?'weapon':'item';
    if(type==='weapon'){
      let keys=armoryKeys.filter(key=>!used.has(key));
      if(isStarterOffer&&guaranteed){
        const compatible=keys.filter(key=>ARMORY[key].kind===guaranteed);
        if(compatible.length)keys=compatible;
      }
      if(isStarterOffer&&run.wave<=2){
        const affordable=keys.filter(key=>ARMORY[key].price<=34);
        if(affordable.length)keys=affordable;
      }
      const id=keys[Math.floor(Math.random()*keys.length)];
      const p=run.player;
      const rankRoll=Math.random();
      const tier=!isStarterOffer&&run.wave>=10&&rankRoll<.04+p.luck*.004?3
        :!isStarterOffer&&run.wave>=4&&rankRoll<.13+run.wave*.009+p.luck*.006?2:1;
      const openingDeal=isStarterOffer&&run.wave===1;
      const discount=openingDeal||Math.random()<.03+p.luck*.006;
      const price=shopPrice(ARMORY[id].price*tierPrice(tier)*(openingDeal?.8:discount?.86:1));
      offers.push({id,type,tier,locked:false,sold:false,discount,price});
      used.add(id);
    }else{
      const item=items.pop();
      const discount=Math.random()<.04+run.player.luck*.007;
      offers.push({id:item.id,type,tier:1,locked:false,sold:false,discount,price:shopPrice(item.price*(discount?.86:1))});
      used.add(item.id);
    }
  }
  return offers;
}

function beginPrep() {
  if(run.wave===MAX_WAVES){finish(true);return}
  run.phase='prep';
  run.reserve+=run.drops.reduce((value,drop)=>value+(drop.kind==='point'?drop.value:0),0);
  run.drops.length=0;
  run.points+=9+Math.floor(run.wave*.48);
  run.prep={offers:shopOffers(run.heldOffers),rerolls:0,level:null};
  run.heldOffers=[];
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
  const scroll=dialogKind==='prep'?modal.scrollTop:0;
  const statsOpen=dialogKind==='prep'&&content.querySelector('.prep-build')?.open;
  openDialog('prep','第 '+run.wave+' 波后整备',`
    <div class="prep-heading"><span>下一波 · ${(run.wave+1)%5===0?'首领战':'生存战'}</span><strong>补给点 ${run.points}</strong></div>
    ${levelPanel(run.prep.level)}
    <details class="prep-build"${statsOpen?' open':''}><summary>当前属性</summary>
      <p>生命 ${Math.ceil(p.hp)} / ${p.maxHp} · 护甲 ${p.armor} · 移速 ${Math.round(p.speed)} · 暴击 ${Math.round(p.crit*100)}%</p>
      <p>拾取增益 ${Math.round(p.pickupBonus*100)}% · 幸运 ${p.luck} · 波初额外回复 ${p.recovery}</p>
    </details>
    ${renderArmory(armoryModel())}
    ${run.reserve?`<p>漏拾 <strong>${run.reserve}</strong> 点补给会并入下一波掉落。</p>`:''}
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

const slotUpgradePrice=slot=>shopPrice(ARMORY[slot.key].price*(1+slot.tier*.46));
const slotSellPrice=slot=>Math.max(1,Math.floor(shopPrice(ARMORY[slot.key].price*tierPrice(slot.tier))*.25));
const canSellWeapon=()=>run.gear.filter(Boolean).length>1;

function armoryModel() {
  const slots=run.gear.map((slot,index)=>{
    const layout={index,label:SLOT_LABELS[index],kind:SLOT_KINDS[index]};
    if(!slot)return {...layout,weapon:null};
    const {name,glyph}=ARMORY[slot.key],stats=weaponStats(slot);
    const upgradePrice=slot.tier<4?slotUpgradePrice(slot):null;
    return {...layout,weapon:{name,glyph,tier:slot.tier,damage:Math.round(stats.damage),speed:1/stats.rate,range:Math.round(stats.range)},
      upgradePrice,canUpgrade:upgradePrice!==null&&run.points>=upgradePrice,sellPrice:canSellWeapon()?slotSellPrice(slot):null};
  });
  const offers=run.prep.offers.map((offer,index)=>{
    const funded=run.points>=offer.price;
    const common={...offer,index};
    const sale=offer.discount?' · 折扣':'';
    if(offer.type==='item'){
      const item=sellableItem(offer.id),available=itemAvailable(item);
      return {...common,name:item.name,glyph:item.glyph,detail:item.label+sale,
        canBuy:available&&funded,buyLabel:!available?'已达上限':funded?'购买':'点数不足'};
    }
    const w=ARMORY[offer.id],destination=weaponDestination(offer),tier=TIERS[offer.tier-1];
    return {...common,name:w.name,glyph:w.glyph,kind:w.kind+' · '+offer.tier+' 阶',
      detail:`伤害 ${Math.round(w.damage*tier.damage)} · 攻速 ${(1/(w.rate*tier.rate)).toFixed(2)} · 射程 ${Math.round(w.range*tier.range)}。 ${w.trait}${sale}`,
      canBuy:funded&&destination.index>=0,
      buyLabel:destination.index<0?'槽位已满':!funded?'点数不足':destination.merge?'合成升阶':'购买并装备'};
  });
  return {slots,offers,points:run.points,wave:run.wave,nextBoss:(run.wave+1)%5===0,
    inventory:GOODS.filter(item=>run.inventory[item.id]>0).map(item=>item.name+' ×'+run.inventory[item.id]).join('　'),
    reroll:{price:refreshPrice(),enabled:run.points>=refreshPrice()&&run.prep.offers.some(entry=>!entry.locked||entry.sold)}};
}

function buyOffer(offer) {
  if(!offer||offer.sold||run.points<offer.price)return false;
  if(offer.type==='weapon'){
    const {index,merge}=weaponDestination(offer);
    if(index<0)return false;
    if(merge)run.gear[index].tier++;
    else run.gear[index]={key:offer.id,tier:offer.tier,cooldown:0,flash:0,aim:0};
  }else{
    const item=sellableItem(offer.id);
    if(!item||!itemAvailable(item))return false;
    run.inventory[item.id]++;item.apply(run.player);
  }
  run.points-=offer.price;offer.sold=true;offer.locked=false;audio.effect('gift');
  return true;
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
  }else if(button.dataset.offerBuy!==undefined){
    if(!buyOffer(run.prep.offers[Number(button.dataset.offerBuy)]))return;
    focus='[data-offer-buy]:not(:disabled)';
  }else if(button.dataset.offerLock!==undefined){
    const index=Number(button.dataset.offerLock),entry=run.prep.offers[index];
    if(!entry||entry.sold)return;
    entry.locked=!entry.locked;focus=`[data-offer-lock="${index}"]`;
  }else if(button.dataset.slotUpgrade!==undefined){
    const index=Number(button.dataset.slotUpgrade),slot=run.gear[index];
    if(!slot||slot.tier>=4||run.points<slotUpgradePrice(slot))return;
    run.points-=slotUpgradePrice(slot);slot.tier++;audio.effect('gift');
    focus=`[data-slot-upgrade="${index}"]`;
  }else if(button.dataset.slotSell!==undefined){
    const index=Number(button.dataset.slotSell),slot=run.gear[index];
    if(!slot||!canSellWeapon())return;
    run.points+=slotSellPrice(slot);run.gear[index]=null;audio.effect('gift');
    focus='[data-offer-buy]:not(:disabled)';
  }else if(button.hasAttribute('data-shop-reroll')){
    const kept=run.prep.offers.filter(entry=>entry.locked&&!entry.sold);
    if(kept.length===4||run.points<refreshPrice())return;
    run.points-=refreshPrice();run.prep.rerolls++;run.prep.offers=shopOffers(kept);
    focus='[data-shop-reroll]';
  }else if(button.hasAttribute('data-next-wave')&&levelComplete()&&p.xp<p.need){
    run.heldOffers=run.prep.offers.filter(entry=>entry.locked&&!entry.sold);
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
  let checkpointHint='当前对局可以在此继续。';
  if(checkpoint?.id===run.id){
    checkpointHint=run.canSave?`存档位于第 ${checkpoint.wave} 波开头。返回大厅或重开网页后可继续。`
      :`本次打开期间，可以从第 ${checkpoint.wave} 波开头继续。`;
  }
  const gear=run.gear.filter(Boolean).map(slot=>ARMORY[slot.key].name+' '+slot.tier+' 阶').join(' · ');
  openDialog('pause','战斗暂停',`<p>第 ${run.wave} / 20 波 · ${run.points} 补给点</p>
    <p>${gear}</p>
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
  time:$('#wave-time'),timeFill:$('#time-fill'),points:$('#point-count'),
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

function updateSkillButton(button,disabled,value,progress,slot) {
  const state=String(disabled);
  if(button.getAttribute('aria-disabled')!==state)button.setAttribute('aria-disabled',state);
  const ringProgress=Math.round(clamp(progress,0,1)*100)+'%';
  if(button.style.getPropertyValue('--ready-progress')!==ringProgress)button.style.setProperty('--ready-progress',ringProgress);
  button.classList.toggle('is-firing',run.castUntil?.[slot]>run.time);
  button.classList.toggle('is-queued',skillQueue[slot]>run.time);
  writeText(button.querySelector('small'),value);
}

const cooldownText=seconds=>seconds<1?Math.max(.1,Math.ceil(seconds*10)/10).toFixed(1)+' 秒':Math.ceil(seconds)+' 秒';

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
  writeText(hud.points,String(run.points));
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
  const skillText=skillQueue[0]>run.time?'即将释放':p.skill>0?cooldownText(p.skill):!combat?'待开战':touchInput.matches?'可释放':'空格';
  const ultimateText=skillQueue[1]>run.time?'即将释放':p.ultimate>0?cooldownText(p.ultimate):p.charge<100?p.charge+'%':!combat?'待开战':touchInput.matches?'已充能':'已充能 · Q';
  updateSkillButton(hud.skill,p.skill>0||!combat,skillText,1-Math.max(0,p.skill)/(p.skillMax||1),0);
  updateSkillButton(hud.ultimate,p.ultimate>0||p.charge<100||!combat,ultimateText,
    p.ultimate>0?1-p.ultimate/(p.ultimateMax||1):p.charge/100,1);
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
  }else if(f.kind==='lance'||f.kind==='beam'){
    ctx.translate(f.x,f.y);ctx.rotate(f.angle);
    const beam=f.kind==='beam',width=(beam?13:8)*(1-progress)+2;
    shape(ctx,[[0,0],[f.r,0]],null,f.color,width);
    shape(ctx,[[beam?0:f.r*.24,0],[f.r,0]],null,'#fff5dd',width*.31);
    if(!beam)shape(ctx,[[f.r*.70,-5],[f.r,0],[f.r*.70,5]],null,f.color,2);
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
  if(shot.kind==='note'){
    for(const offset of [-13,-5,3]){
      ctx.beginPath();ctx.arc(offset,0,9+offset*.16,-1.05,1.05);
      ctx.strokeStyle=offset===3?'#f8e5ff':shot.color;ctx.lineWidth=offset===3?2.8:1.9;ctx.stroke();
    }
  }else if(shot.kind==='rock'){
    ctx.rotate(shot.range*12);
    shape(ctx,[[-7,-4],[2,-7],[8,-1],[4,7],[-7,5]],shot.color,OUTLINE,1.5);
    shape(ctx,[[-5,-3],[1,-5],[4,-2]],null,'#ffeecc',1.5);
  }else if(shot.kind==='dart'){
    shape(ctx,[[-10,0],[0,-4],[11,0],[0,4]],shot.color,OUTLINE,1.4);
    shape(ctx,[[0,0],[9,0]],null,'#fff9dd',1.5);
  }else{
    oval(ctx,0,0,shot.r,shot.r,shot.hostile?'#e485acbb':'#70e7e766',shot.color,1.7);
    oval(ctx,-2,-2,shot.r*.27,shot.r*.24,'#fff9dc');
  }
  ctx.restore();
}

function drawEquippedWeapons(behind) {
  run.gear.forEach((slot,index)=>{
    if(!slot)return;
    const weapon=ARMORY[slot.key],mount=weaponMount(index);
    const ranged=index>=2,back=ranged&&mount.y<run.player.y-12;
    if(back!==behind)return;
    const flash=slot.flash/.25;
    ctx.save();ctx.translate(mount.x,mount.y);
    if(back)ctx.globalAlpha=.79;
    if(ranged){
      oval(ctx,0,0,13,12,'#11374394',weapon.color+'a8',1.6+flash);
      ctx.fillStyle='#f7ffed';ctx.font='bold 15px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(weapon.glyph,0,0);
      if(flash>0){
        const dx=Math.cos(slot.aim),dy=Math.sin(slot.aim);
        oval(ctx,dx*13,dy*12,4+flash*3,4+flash*3,weapon.color);
      }
    }else{
      const rest=index===0?3.74:-.55;
      const tilt=flash>0?slot.aim+flash*.36:rest;
      ctx.rotate(tilt);
      shape(ctx,[[-5,0],[10,0]],null,OUTLINE,6);
      shape(ctx,[[-5,0],[9,0]],null,'#d0aa86',3);
      if(slot.key==='spatula')box(ctx,8,-5,12,10,1,weapon.color,OUTLINE,1.7);
      else if(slot.key==='net')oval(ctx,15,0,8,5,'#69d4bc66',weapon.color,2);
      else if(weapon.style==='thrust')shape(ctx,[[7,-4],[25,0],[7,4]],weapon.color,OUTLINE,1.7);
      else shape(ctx,[[7,-4],[17,-7],[24,-3],[22,5],[12,7],[7,3]],weapon.color,OUTLINE,1.8);
    }
    ctx.restore();
  });
}

function drawOffscreenThreats() {
  const {w,h,scale,warningEdges}=viewport;
  const p=run.player;
  const near=run.enemies.filter(e=>e.boss||e.entered<.9);
  if(!near.length)return;
  useFieldPixels();
  const {left,right,top,bottom}=warningEdges;
  const position={x:clamp((p.x-camera.x)*scale,left+1,right-1),y:clamp((p.y-camera.y)*scale,top+1,bottom-1)};
  const used=new Set();
  for(const e of near.sort((a,b)=>Number(b.boss)-Number(a.boss))){
    const x=(e.x-camera.x)*scale,y=(e.y-camera.y)*scale,s=e.size*scale;
    if(x>-s&&x<w+s&&y>-s&&y<h+s)continue;
    const dx=x-position.x,dy=y-position.y;
    const edge=Math.min(
      dx>0?(right-position.x)/dx:dx<0?(left-position.x)/dx:Infinity,
      dy>0?(bottom-position.y)/dy:dy<0?(top-position.y)/dy:Infinity,
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
  const {w,h,scale}=viewport,p=run.player;
  if(w<=0||h<=0)return;
  const visibleW=w/scale,visibleH=h/scale;
  camera.x=visibleW>=world.w?(world.w-visibleW)/2:clamp(p.x-visibleW/2,0,world.w-visibleW);
  camera.y=visibleH>=world.h?(world.h-visibleH)/2:clamp(p.y-visibleH/2,0,world.h-visibleH);
  const shake=run.shake>0&&!reduceMotion.matches?run.shake*21:0;
  useFieldPixels();ctx.fillStyle='#081a29';ctx.fillRect(0,0,w,h);
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
    if(drop.kind==='point'){
      const x=drop.x,y=drop.y+bob;
      const r=drop.value>=10?12:drop.value>=3?8:5.6;
      const color=drop.value>=10?'#ffb3e9':drop.value>=3?'#ffd47c':'#84ffdb';
      oval(ctx,x,y+r*.45,r,3,'#072b3574');
      shape(ctx,[[x,y-r],[x+r*.8,y],[x,y+r],[x-r*.8,y]],color,OUTLINE,1.3);
      shape(ctx,[[x,y-r],[x+r*.8,y],[x,y+1],[x-r*.8,y]],'#ffffff72');
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
  drawEquippedWeapons(true);
  ctx.save();
  if(run.hurtGlow>0)ctx.globalAlpha=.75+run.hurtGlow*.5;
  drawHero(ctx,run.hero.id,p.x,p.y-7,.91,{time:run.time,steps:p.steps,face:p.face,
    stride:p.stride,tilt:p.tilt,kick:p.kick,cast:p.cast,aim:p.aim,showWeapon:false});
  ctx.restore();
  drawEquippedWeapons(false);
  for(const effect of run.fx){if(effect.kind!=='wake'&&inView(effect,effect.r||35))drawEffect(effect)}
  drawOffscreenThreats();
  if(run.hurtGlow>0){
    useFieldPixels();
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
  skillQueue.fill(0);
  releaseStick();
  hud.skill.classList.remove('is-pressed');hud.ultimate.classList.remove('is-pressed');
}

function releaseStick() {
  const active=joystick.id;
  joystick.id=null;joystick.x=0;joystick.y=0;joystick.bounds=null;
  if(active!==null&&pad.hasPointerCapture(active))pad.releasePointerCapture(active);
  pad.classList.remove('is-active');
  stick.style.transform='';
}

function moveStick(e) {
  const rect=joystick.bounds,max=rect.width*.345;
  const x=e.clientX-rect.left-rect.width/2,y=e.clientY-rect.top-rect.height/2;
  const len=Math.hypot(x,y),deadzone=rect.width*.047;
  const strength=clamp((len-deadzone)/(max-deadzone),0,1);
  joystick.x=x/(len||1)*strength;joystick.y=y/(len||1)*strength;
  stick.style.transform=`translate(calc(-50% + ${joystick.x*max}px),calc(-50% + ${joystick.y*max}px))`;
}

const pad=$('#joystick'),stick=$('#stick');
pad.addEventListener('pointerdown',e=>{
  if(joystick.id!==null||!run||modal.open||e.button!==0)return;
  e.preventDefault();joystick.id=e.pointerId;joystick.bounds=pad.getBoundingClientRect();
  pad.setPointerCapture(e.pointerId);pad.classList.add('is-active');moveStick(e);
});
pad.addEventListener('pointermove',e=>{if(e.pointerId===joystick.id)moveStick(e)});
for(const event of ['pointerup','pointercancel','lostpointercapture']){
  pad.addEventListener(event,e=>{
    if(e.pointerId===joystick.id)releaseStick();
  });
}

for(const [button,ultimate] of [[hud.skill,false],[hud.ultimate,true]]){
  let touched=false;
  button.addEventListener('pointerdown',e=>{
    if(e.button!==0||!run||modal.open)return;
    touched=e.pointerType==='touch'||e.pointerType==='pen';
    button.classList.add('is-pressed');
    if(touched){
      e.preventDefault();
      requestSkill(ultimate);
    }
  });
  for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture']){
    button.addEventListener(event,()=>{
      button.classList.remove('is-pressed');
      if(event==='pointercancel')skillQueue[Number(ultimate)]=0;
    });
  }
  button.addEventListener('click',e=>{
    if(touched&&e.detail>0){touched=false;return}
    requestSkill(ultimate);
  });
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
pad.addEventListener('contextmenu',e=>e.preventDefault());

document.addEventListener('keydown',e=>{
  if(!run || e.ctrlKey || e.metaKey || e.altKey)return;
  const key=e.key.toLowerCase();
  if(key==='escape'){
    if(!e.repeat && !modal.open){e.preventDefault();pause()}
    return;
  }
  if(modal.open)return;
  const focused=document.activeElement;
  if(key===' '&&focused?.tagName==='BUTTON'&&focused!==hud.skill&&focused!==hud.ultimate)return;
  if(['a','d','s','w','arrowup','arrowdown','arrowleft','arrowright',' ','q'].includes(key)){
    e.preventDefault();
    if(key===' '||key==='q'){
      if(!e.repeat)requestSkill(key==='q'||focused===hud.ultimate);
    }else keys.add(key);
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
let viewportFrame=null;
function scheduleViewportFit() {
  if(viewportFrame!==null)return;
  viewportFrame=requestAnimationFrame(()=>{
    viewportFrame=null;
    if(!run)drawSplash(splash,skin);
    else if(resizeField()){resetInput();draw()}
  });
}
function orientationChanged() {
  if(run)resetInput();
  scheduleViewportFit();
}
window.addEventListener('resize',scheduleViewportFit);
window.addEventListener('orientationchange',orientationChanged);
window.screen?.orientation?.addEventListener('change',orientationChanged);
window.visualViewport?.addEventListener('resize',scheduleViewportFit);
if(window.ResizeObserver){
  const observer=new window.ResizeObserver(scheduleViewportFit);
  observer.observe(battle);
  observer.observe(splash);
}
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
      if(data?.type!=='offline-status'||data.version!==7||controller!==navigator.serviceWorker.controller)return;
      offlineReady=data.ready===true;
      const status=$('#offline-status');
      if(status)status.textContent=offlineReady?'离线资源已就绪。当前设备会保留战绩、解锁和每波存档。':'离线资源还在准备，请保持联网并刷新游戏。';
    };
    controller.postMessage({type:'offline-status'},[channel.port2]);
  };
  navigator.serviceWorker.addEventListener('controllerchange',checkOffline);
  checkOffline();
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});
}
