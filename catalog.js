const ARMORY = {
  spatula:{name:'金锅铲',kind:'近战',style:'slash',damage:23,rate:.67,range:174,knock:78,color:'#ffe579',glyph:'✦',price:27,trait:'横扫前方，多目标命中'},
  rock:{name:'派大星的石头',kind:'远程',style:'rock',damage:30,rate:.83,range:230,knock:114,color:'#e2ae9b',glyph:'◆',price:34,trait:'单发重击，击退强'},
  clarinet:{name:'单簧管',kind:'远程',style:'note',damage:18,rate:.49,range:280,knock:46,color:'#b9a0fc',glyph:'♫',price:35,trait:'音波可穿透一个目标'},
  net:{name:'水母网',kind:'近战',style:'slash',damage:25,rate:.63,range:170,knock:69,color:'#75ffe5',glyph:'◎',price:34,trait:'横扫前方，多目标命中'},
  claw:{name:'蟹老板的钳子',kind:'近战',style:'cleave',damage:31,rate:.76,range:161,knock:90,color:'#ff9d76',glyph:'✸',price:36,trait:'宽幅横扫，击退较强'},
  bubble:{name:'泡泡棒',kind:'远程',style:'bubble',damage:21,rate:.59,range:253,knock:48,color:'#88e8ff',glyph:'◉',price:30,trait:'泡泡命中后减速'},
  griddleTong:{name:'烤架火钳',kind:'近战',style:'thrust',damage:18,rate:.50,range:134,knock:53,color:'#ffc092',glyph:'♢',price:26,trait:'快速刺击，可打到一列敌人'},
  sandyLasso:{name:'珊迪的套索',kind:'近战',style:'thrust',damage:24,rate:.77,range:211,knock:76,color:'#fbd38e',glyph:'⟲',price:35,trait:'长距离直扫，可打到一列敌人'},
  galleyBell:{name:'蟹堡王餐铃',kind:'近战',style:'cleave',damage:34,rate:1.23,range:159,knock:132,color:'#ffd27b',glyph:'♮',price:38,trait:'宽幅重击，击退强'},
  wreckOar:{name:'幽灵船木桨',kind:'近战',style:'cleave',damage:36,rate:1.36,range:188,knock:122,color:'#9de3cd',glyph:'◈',price:44,trait:'大范围重击，间隔较长'},
  reefSkewer:{name:'珊瑚烤签',kind:'近战',style:'thrust',damage:29,rate:.83,range:181,knock:67,color:'#ffa6b7',glyph:'➤',price:32,trait:'直刺一列敌人，主目标伤害高'},
  pineappleFan:{name:'菠萝叶扇',kind:'近战',style:'slash',damage:16,rate:.48,range:145,knock:65,color:'#d5f680',glyph:'✿',price:28,trait:'短距快扫，出手频繁'},
  barrelLid:{name:'腌菜桶盖',kind:'近战',style:'cleave',damage:28,rate:1.07,range:135,knock:141,color:'#c9d993',glyph:'◍',price:33,trait:'贴身宽扫，击退强'},
  kelpKnot:{name:'海藻绳球',kind:'远程',style:'rock',damage:31,rate:1.0,range:247,knock:131,color:'#a9e68f',glyph:'✣',price:37,trait:'绳球重击，击退强'},
  bubbleRing:{name:'大泡泡圈',kind:'远程',style:'bubble',damage:25,rate:.91,range:286,knock:61,color:'#b3ecfd',glyph:'◌',price:36,trait:'长程泡泡，命中减速'},
  conchHorn:{name:'海螺号角',kind:'远程',style:'note',damage:24,rate:.80,range:252,knock:58,color:'#ffc29f',glyph:'♬',price:36,trait:'号角音波可穿透一个目标'},
  pearlWhistle:{name:'珍珠的哨子',kind:'远程',style:'note',damage:13,rate:.45,range:221,knock:31,color:'#ff91d3',glyph:'♪',price:28,trait:'快速音波可穿透一个目标'},
  shellSling:{name:'贝壳弹弓',kind:'远程',style:'dart',damage:17,rate:.51,range:274,knock:46,color:'#ffe4ba',glyph:'❋',price:32,trait:'高速单发，适合追打快敌'},
  corkLauncher:{name:'软木塞发射器',kind:'远程',style:'dart',damage:30,rate:.95,range:305,knock:81,color:'#ffae8f',glyph:'➸',price:43,trait:'长距离精准单发'},
  searchlight:{name:'海底探照灯',kind:'远程',style:'beam',damage:30,rate:1.30,range:295,knock:52,color:'#a6fff3',glyph:'✧',price:47,trait:'直线光束，最多击中三个目标'},
};

const SUPPLY_LIMITS={recovery:18,pickupBonus:.36,luck:15};

function supplyHealth(player,capacity,heal) {
  player.maxHp=Math.max(1,player.maxHp+capacity);
  player.hp=Math.min(player.maxHp,player.hp+heal);
}

function supplyAttackInterval(player,multiplier) {
  player.rate=Math.max(UPGRADE_LIMITS.attackInterval,player.rate*multiplier);
}

function supplyCooldown(player,multiplier) {
  const next=Math.max(UPGRADE_LIMITS.skillCooldown,player.cooldown*multiplier);
  const ratio=next/player.cooldown;
  for(const timer of ['skill','skillMax','ultimate','ultimateMax']){
    if(player[timer]>0)player[timer]*=ratio;
  }
  player.cooldown=next;
}

function supplyBonus(player,stat,amount) {
  player[stat]=Math.min(SUPPLY_LIMITS[stat],(player[stat]||0)+amount);
}

const SUPPLIES = [
  {
    id:'kelp_roll',name:'海藻蛋卷',glyph:'▤',price:14,limit:3,label:'生命上限 +9，回复 24 生命',
    apply:p=>supplyHealth(p,9,24),
  },
  {
    id:'picnic_box',name:'水母田野餐盒',glyph:'▣',price:29,limit:2,label:'生命上限 +18，波初回复最多 +2',
    apply:p=>{supplyHealth(p,18,0);supplyBonus(p,'recovery',2)},
  },
  {
    id:'diver_seal',name:'潜水服密封圈',glyph:'⊙',price:22,limit:2,label:'护甲 +3，移速 −4%',
    apply:p=>{p.armor+=3;p.speed*=.96},
  },
  {
    id:'helmet_pad',name:'玻璃盔软垫',glyph:'⬡',price:17,limit:3,label:'护甲 +1，生命上限 +9，回复 12 生命',
    apply:p=>{p.armor+=1;supplyHealth(p,9,12)},
  },
  {
    id:'puffer_vest',name:'河豚护身背心',glyph:'◈',price:29,limit:2,label:'护甲 +2，暴击率最多 +5%',
    apply:p=>{p.armor+=2;p.crit=Math.min(UPGRADE_LIMITS.crit,p.crit+.05)},
  },
  {
    id:'race_pennant',name:'开船课终点旗',glyph:'⚑',price:21,limit:2,label:'移速最多 +9%',
    available:p=>p.speed<UPGRADE_LIMITS.speed,
    apply:p=>{p.speed=Math.min(UPGRADE_LIMITS.speed,p.speed*1.09)},
  },
  {
    id:'spring_soles',name:'弹簧潜水鞋',glyph:'〰',price:29,limit:2,label:'移速最多 +14，攻击间隔最多 −4%',
    available:p=>p.speed<UPGRADE_LIMITS.speed||p.rate>UPGRADE_LIMITS.attackInterval,
    apply:p=>{p.speed=Math.min(UPGRADE_LIMITS.speed,p.speed+14);supplyAttackInterval(p,.96)},
  },
  {
    id:'reef_lens',name:'海底望远镜',glyph:'◐',price:23,limit:2,label:'攻击范围最多 +26，拾取距离最多 +12',
    available:p=>p.range<UPGRADE_LIMITS.range||p.magnet<UPGRADE_LIMITS.magnet,
    apply:p=>{
      p.range=Math.min(UPGRADE_LIMITS.range,p.range+26);
      p.magnet=Math.min(UPGRADE_LIMITS.magnet,p.magnet+12);
    },
  },
  {
    id:'field_log',name:'水母观察手册',glyph:'▥',price:23,limit:2,label:'拾取距离最多 +35，幸运最多 +2',
    available:p=>p.magnet<UPGRADE_LIMITS.magnet||(p.luck||0)<SUPPLY_LIMITS.luck,
    apply:p=>{p.magnet=Math.min(UPGRADE_LIMITS.magnet,p.magnet+35);supplyBonus(p,'luck',2)},
  },
  {
    id:'seagrass_pouch',name:'零钱海草袋',glyph:'◇',price:28,limit:2,label:'拾取材料收益最多 +12%',
    available:p=>(p.pickupBonus||0)<SUPPLY_LIMITS.pickupBonus,
    apply:p=>supplyBonus(p,'pickupBonus',.12),
  },
  {
    id:'oyster_pearl',name:'牡蛎小珍珠',glyph:'✧',price:18,limit:2,label:'幸运最多 +5，提高打折概率',
    available:p=>(p.luck||0)<SUPPLY_LIMITS.luck,
    apply:p=>supplyBonus(p,'luck',5),
  },
  {
    id:'stamp_card',name:'蟹堡王集章卡',glyph:'▦',price:36,limit:1,label:'幸运最多 +3，拾取材料收益最多 +12%',
    available:p=>(p.luck||0)<SUPPLY_LIMITS.luck||(p.pickupBonus||0)<SUPPLY_LIMITS.pickupBonus,
    apply:p=>{supplyBonus(p,'luck',3);supplyBonus(p,'pickupBonus',.12)},
  },
  {
    id:'jelly_tonic',name:'冰镇水母露',glyph:'◉',price:28,limit:2,label:'波初回复最多 +4，技能冷却最多 −6%',
    available:p=>(p.recovery||0)<SUPPLY_LIMITS.recovery||p.cooldown>UPGRADE_LIMITS.skillCooldown,
    apply:p=>{supplyBonus(p,'recovery',4);supplyCooldown(p,.94)},
  },
  {
    id:'emergency_can',name:'海底应急罐头',glyph:'▧',price:20,limit:2,label:'回复 33 生命，波初回复最多 +2',
    available:p=>p.hp<p.maxHp||(p.recovery||0)<SUPPLY_LIMITS.recovery,
    apply:p=>{supplyHealth(p,0,33);supplyBonus(p,'recovery',2)},
  },
  {
    id:'sonar_dial',name:'花斑声呐拨盘',glyph:'⌾',price:32,limit:2,label:'攻击间隔最多 −10%，攻击范围最多 +12',
    available:p=>p.rate>UPGRADE_LIMITS.attackInterval||p.range<UPGRADE_LIMITS.range,
    apply:p=>{supplyAttackInterval(p,.9);p.range=Math.min(UPGRADE_LIMITS.range,p.range+12)},
  },
  {
    id:'char_spice',name:'蟹堡王炭烤香料',glyph:'✸',price:29,limit:3,label:'伤害 +12%，技能额外伤害 +5%',
    apply:p=>{p.power*=1.12;p.skillPower*=1.05},
  },
  {
    id:'wrist_coil',name:'珊迪的腕部线圈',glyph:'ϟ',price:31,limit:2,label:'技能伤害 +18%，技能冷却最多 −6%',
    apply:p=>{p.skillPower*=1.18;supplyCooldown(p,.94)},
  },
  {
    id:'spotlight_reflector',name:'舞台聚光镜',glyph:'✺',price:27,limit:2,label:'暴击率最多 +10%，攻击范围最多 +12',
    available:p=>p.crit<UPGRADE_LIMITS.crit||p.range<UPGRADE_LIMITS.range,
    apply:p=>{
      p.crit=Math.min(UPGRADE_LIMITS.crit,p.crit+.1);
      p.range=Math.min(UPGRADE_LIMITS.range,p.range+12);
    },
  },
  {
    id:'secret_sauce',name:'海之霸烈味酱',glyph:'♨',price:35,limit:1,label:'伤害 +17%，生命上限 −8',
    apply:p=>{p.power*=1.17;supplyHealth(p,-8,0)},
  },
  {
    id:'marathon_badge',name:'比奇堡长跑勋章',glyph:'✪',price:32,limit:2,label:'生命上限 +12，移速最多 +6%',
    apply:p=>{supplyHealth(p,12,0);p.speed=Math.min(UPGRADE_LIMITS.speed,p.speed*1.06)},
  },
];
