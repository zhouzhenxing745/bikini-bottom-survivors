class SeaAudio {
  constructor(prefs) {
    this.prefs=prefs;
    this.ctx=null;
    this.timer=null;
    this.beat=0;
    this.next=0;
    this.playing=false;
    this.lastEffect=new Map();
  }

  unlock() {
    try {
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext)return;
      if(!this.ctx){
        this.ctx=new AudioContext();
        this.musicBus=this.ctx.createGain();
        this.effectsBus=this.ctx.createGain();
        const mix=this.ctx.createDynamicsCompressor();
        mix.threshold.value=-16;
        mix.ratio.value=5;
        this.musicBus.connect(mix);
        this.effectsBus.connect(mix);
        mix.connect(this.ctx.destination);
      }
      if(this.ctx.state!=='running')this.ctx.resume().catch(()=>{});
      this.sync();
    }catch{}
  }

  sync() {
    if(!this.ctx)return;
    const now=this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.playing&&this.prefs.music?1:0,now,.028);
    this.effectsBus.gain.setTargetAtTime(this.prefs.sfx?1:0,now,.012);
  }

  tone(hz,at,duration,level,type,bus,end=hz) {
    if(!this.ctx || !bus)return;
    const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(hz,at);
    osc.frequency.exponentialRampToValueAtTime(end,at+duration);
    gain.gain.setValueAtTime(.0001,at);
    gain.gain.exponentialRampToValueAtTime(level,at+.009);
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    osc.connect(gain);gain.connect(bus);osc.start(at);osc.stop(at+duration+.02);
  }

  effect(kind) {
    if(!this.prefs.sfx || this.ctx?.state!=='running')return;
    const now=this.ctx.currentTime, bus=this.effectsBus;
    if(now-(this.lastEffect.get(kind)??-1)<.045)return;
    this.lastEffect.set(kind,now);
    const play=(from,to,duration,level,type='triangle',delay=0)=>this.tone(from,now+delay,duration,level,type,bus,to);
    if(kind==='attack'||kind==='spatula'){play(592,178,.115,.06);play(234,86,.085,.034,'sine')}
    if(kind==='net'){play(431,182,.12,.045);play(740,580,.062,.028,'sine')}
    if(kind==='claw'){play(245,76,.085,.059);play(550,240,.037,.022,'square',.027)}
    if(kind==='rock')play(190,66,.13,.063);
    if(kind==='clarinet'){play(330,294,.13,.052);play(660,588,.09,.022,'sine')}
    if(kind==='bubble'){play(310,614,.092,.035,'sine');play(590,850,.08,.028,'sine',.04)}
    if(kind==='hit'){play(190,68,.095,.047);play(420,220,.039,.022,'square')}
    if(kind==='critical'){play(228,77,.15,.068);play(720,1000,.095,.036,'sine')}
    if(kind==='hurt'){play(134,58,.22,.08,'sawtooth')}
    if(kind==='heal'){play(494,659,.14,.04,'sine');play(660,880,.14,.034,'triangle',.09)}
    if(kind==='gift'){play(590,850,.09,.058,'sine');play(880,1174,.12,.043,'triangle',.066)}
    if(kind==='skill'){play(270,720,.24,.062,'sine');play(663,205,.31,.072,'triangle',.064);play(380,110,.19,.053,'sine',.15)}
    if(kind==='ultimate'){play(93,211,.71,.10,'triangle');play(370,740,.51,.053,'sawtooth');play(600,1100,.62,.068,'sine',.06)}
    if(kind==='pulse'){play(475,180,.23,.063,'triangle');play(77,44,.18,.064,'sine')}
    if(kind==='clear'){play(392,392,.15,.042);play(523,523,.20,.04,'triangle',.13)}
    if(kind==='boss'){play(98,66,.35,.068);play(131,93,.43,.048,'sawtooth',.15)}
    if(kind==='lose'){play(220,165,.26,.042);play(148,95,.36,.038,'triangle',.14)}
    if(kind==='level'||kind==='win'){
      [392,494,587,784].forEach((pitch,i)=>play(pitch,pitch,.24,.065,'triangle',i*.095));
    }
    if(kind==='wrong')play(300,139,.23,.073);
  }

  start(getWave,reset=false) {
    this.stop();
    if(!this.ctx)return;
    this.next=this.ctx.currentTime+.07;
    this.playing=true;
    if(reset)this.beat=0;
    this.sync();
    const melody=[392,0,493.88,440,329.63,0,392,293.66,349.23,0,440,392,293.66,261.63,293.66,0];
    const bass=[98,82.41,87.31,73.42];
    this.timer=setInterval(()=>{
      if(this.ctx.state!=='running')return;
      if(this.next<this.ctx.currentTime)this.next=this.ctx.currentTime+.04;
      const wave=getWave(),stage=Math.floor((wave-1)/5);
      const step=60/(99+wave*2.4)/2;
      while(this.next<this.ctx.currentTime+.16){
        const beat=this.beat++,note=melody[beat%16],bus=this.musicBus;
        if(this.prefs.music){
          const pitch=wave%5===0?note*.841:note;
          if(pitch)this.tone(pitch,this.next,step*.88,.021,'triangle',bus);
          if(beat%4===0 || (stage>=2&&beat%4===2)){
            this.tone(bass[Math.floor(beat/4)%4],this.next,step*1.75,.05,'sine',bus);
          }
          if(stage>=2&&pitch&&beat%4===3)this.tone(pitch*1.5,this.next,step*.68,.012,'sine',bus);
          if(stage>=1&&beat%2===0)this.tone(87,this.next,.105,.037+stage*.006,'triangle',bus,41);
          if(stage>=2&&beat%2===1)this.tone(1350,this.next,.035,.009,'square',bus,690);
          if(wave%5===0&&beat%8===0)this.tone(49,this.next,step*3,.027,'sawtooth',bus);
        }
        this.next+=step;
      }
    },75);
  }

  stop() {
    clearInterval(this.timer);
    this.timer=null;
    this.playing=false;
    this.sync();
  }
}
