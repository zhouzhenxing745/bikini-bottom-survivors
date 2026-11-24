const HEROES = [
  { id:'sponge', name:'海绵宝宝', color:'#ffe15d', hp:115, speed:210, power:1, weapon:'spatula', role:'均衡', perk:'每波开始恢复 8 点生命' },
  { id:'patrick', name:'派大星', color:'#ff92ad', hp:155, speed:182, power:1.25, weapon:'rock', role:'重击', perk:'体力高，普攻击退更强' },
  { id:'squid', name:'章鱼哥', color:'#88d7bc', hp:90, speed:212, power:1.08, weapon:'clarinet', role:'远程', perk:'普攻间隔缩短 18%' },
  { id:'sandy', name:'珊迪', color:'#f5c195', hp:100, speed:245, power:1.05, weapon:'net', role:'机动', perk:'泡泡旋刃冷却缩短 25%' },
  { id:'krabs', name:'蟹老板', color:'#ff7371', hp:125, speed:205, power:1, weapon:'claw', role:'拾取', perk:'经验获取增加 25%' },
  { id:'gary', name:'小蜗', color:'#8dd8f4', hp:105, speed:222, power:.95, weapon:'bubble', role:'控场', perk:'普攻命中时减速敌人' },
];

const MAPS = [
  { id:'town', name:'比奇堡', subtitle:'菠萝屋街区', colors:['#125a76','#0c375b','#53c4ac'], effect:'拾取距离 +15' },
  { id:'jelly', name:'水母田', subtitle:'水母出没', colors:['#723a77','#352654','#f994c6'], effect:'敌人移速 +10%，经验 +15%' },
  { id:'krusty', name:'蟹堡王', subtitle:'打烊后的餐厅', colors:['#855438','#45334b','#ffbc72'], effect:'每波开始恢复 4 点生命' },
];

const DIFFICULTIES = [
  { name:'浅海 · 简单', hp:.84, damage:.72, speed:1, xp:1, bossHp:.88, count:0, crowd:10, windup:1.12, recovery:1.2, heal:7, burger:10 },
  { name:'深海 · 普通', hp:1, damage:1, speed:1.04, xp:.96, bossHp:1, count:2, crowd:14, windup:1, recovery:1, heal:3, burger:12 },
  { name:'深渊 · 困难', hp:1.18, damage:1.34, speed:1.12, xp:.91, bossHp:1.2, count:4, crowd:18, windup:.89, recovery:.85, heal:0, burger:15 },
];

const WEAPONS = {
  spatula:{ name:'金锅铲', kind:'挥砍', damage:23, range:174, rate:.67, knock:78, color:'#ffe579', glyph:'✦' },
  rock:{ name:'派大星的石头', kind:'投掷', damage:30, range:230, rate:.83, knock:114, color:'#e2ae9b', glyph:'◆' },
  clarinet:{ name:'单簧管', kind:'音波', damage:18, range:280, rate:.49, knock:46, color:'#b9a0fc', glyph:'♫' },
  net:{ name:'水母网', kind:'挥砍', damage:25, range:170, rate:.63, knock:69, color:'#75ffe5', glyph:'◎' },
  claw:{ name:'蟹老板的钳子', kind:'挥砍', damage:31, range:161, rate:.76, knock:90, color:'#ff9d76', glyph:'✸' },
  bubble:{ name:'泡泡棒', kind:'气泡', damage:21, range:253, rate:.59, knock:48, color:'#88e8ff', glyph:'◉' },
};

const UPGRADE_LIMITS={ attackInterval:.26, speed:375, magnet:280, range:380, skillCooldown:.38, crit:.75 };

const WEAPON_TIERS=[
  {cost:5,damage:1.12,rate:.95,range:1.05},
  {cost:8,damage:1.25,rate:.89,range:1.10},
  {cost:11,damage:1.39,rate:.84,range:1.15},
];

const PREP_ITEMS=[
  {
    id:'meal', name:'蟹堡套餐', glyph:'▤', cost:2, limit:3, label:'生命上限 +12，恢复 20 点生命',
    apply:p=>{p.maxHp+=12;p.hp=Math.min(p.maxHp,p.hp+20)},
  },
  {
    id:'guard', name:'潜水护垫', glyph:'⬡', cost:3, limit:3, label:'护甲 +2，降低受到的伤害',
    apply:p=>{p.armor+=2},
  },
  {
    id:'gloves', name:'防滑手套', glyph:'✦', cost:3, limit:3, label:'攻击伤害 +8%',
    apply:p=>{p.power*=1.08},
  },
  {
    id:'flippers', name:'轻便脚蹼', glyph:'≈', cost:2, limit:3, label:'移速最多 +7%',
    available:p=>p.speed<UPGRADE_LIMITS.speed,
    apply:p=>{p.speed=Math.min(UPGRADE_LIMITS.speed,p.speed*1.07)},
  },
  {
    id:'bag', name:'捕捞口袋', glyph:'◇', cost:2, limit:3, label:'拾取距离最多 +20',
    available:p=>p.magnet<UPGRADE_LIMITS.magnet,
    apply:p=>{p.magnet=Math.min(UPGRADE_LIMITS.magnet,p.magnet+20)},
  },
  {
    id:'jam', name:'波纹果冻', glyph:'◉', cost:4, limit:2, label:'两项技能冷却最多 −9%',
    available:p=>p.cooldown>UPGRADE_LIMITS.skillCooldown,
    apply:p=>{
      const cooldown=Math.max(UPGRADE_LIMITS.skillCooldown,p.cooldown*.91);
      const ratio=cooldown/p.cooldown;
      if(p.skill>0)p.skill*=ratio;
      if(p.ultimate>0)p.ultimate*=ratio;
      p.cooldown=cooldown;
    },
  },
  {
    id:'charm', name:'泡泡徽章', glyph:'✧', cost:3, limit:2, label:'暴击率最多 +8%',
    available:p=>p.crit<UPGRADE_LIMITS.crit,
    apply:p=>{p.crit=Math.min(UPGRADE_LIMITS.crit,p.crit+.08)},
  },
  {
    id:'battery', name:'涡流电池', glyph:'ϟ', cost:4, limit:2, label:'小技能与终极技能伤害 +15%',
    apply:p=>{p.skillPower*=1.15},
  },
];

const UPGRADES = [
  { name:'海霸糊', label:'攻击伤害 +15%', apply:p=>p.power*=1.15 },
  {
    name:'捕水母手套', label:'攻击间隔最多 −13%',
    available:p=>p.rate>UPGRADE_LIMITS.attackInterval,
    apply:p=>{
      const interval=Math.max(UPGRADE_LIMITS.attackInterval,p.rate*.87);
      if(p.attack>0)p.attack*=interval/p.rate;
      p.rate=interval;
    },
  },
  { name:'蟹黄堡', label:'生命上限 +22，回复 30 生命', apply:p=>{p.maxHp+=22;p.hp=Math.min(p.maxHp,p.hp+30)} },
  {
    name:'珊迪的火箭靴', label:'移速最多 +12%',
    available:p=>p.speed<UPGRADE_LIMITS.speed,
    apply:p=>p.speed=Math.min(UPGRADE_LIMITS.speed,p.speed*1.12),
  },
  {
    name:'魔法海螺', label:'拾取距离最多 +34',
    available:p=>p.magnet<UPGRADE_LIMITS.magnet,
    apply:p=>p.magnet=Math.min(UPGRADE_LIMITS.magnet,p.magnet+34),
  },
  { name:'泡芙老师的船', label:'护甲 +2，按比例减伤', apply:p=>p.armor+=2 },
  {
    name:'海之霸护目镜', label:'自动攻击距离最多 +32',
    available:p=>p.range<UPGRADE_LIMITS.range,
    apply:p=>p.range=Math.min(UPGRADE_LIMITS.range,p.range+32),
  },
  {
    name:'水母果酱', label:'两项技能冷却最多 −15%',
    available:p=>p.cooldown>UPGRADE_LIMITS.skillCooldown,
    apply:p=>{
      const cooldown=Math.max(UPGRADE_LIMITS.skillCooldown,p.cooldown*.85);
      const ratio=cooldown/p.cooldown;
      if(p.skill>0)p.skill*=ratio;
      if(p.ultimate>0)p.ultimate*=ratio;
      p.cooldown=cooldown;
    },
  },
  {
    name:'珍珠的啦啦球', label:'暴击率最多 +12%，暴击伤害 1.8 倍',
    available:p=>p.crit<UPGRADE_LIMITS.crit,
    apply:p=>p.crit=Math.min(UPGRADE_LIMITS.crit,p.crit+.12),
  },
  { name:'海超人腰带', label:'小技能与终极技能伤害 +25%', apply:p=>p.skillPower*=1.25 },
];

const QUIZZES = [
  ['海绵宝宝在蟹堡王做什么工作？','煎蟹黄堡','开船','收银'],
  ['海绵宝宝的宠物叫什么？','小蜗','小目','泡芙'],
  ['派大星住在哪里？','一块石头下面','复活节岛人像里','海之霸'],
  ['章鱼哥最常演奏哪种乐器？','单簧管','小提琴','长号'],
  ['珊迪来自哪里？','得克萨斯州','比奇堡','水母田'],
  ['蟹堡王的老板是谁？','蟹老板','痞老板','海超人'],
  ['痞老板的电脑妻子叫什么？','凯伦','珍珠','泡芙'],
  ['蟹老板的女儿叫什么？','珍珠','珊迪','凯伦'],
  ['谁教海绵宝宝开船？','泡芙老师','章鱼哥','飞天魔鬼'],
  ['海绵宝宝平时用什么捕捉水母？','水母网','蟹黄堡','单簧管'],
  ['海绵宝宝的房子长什么样？','菠萝','石头','鲸鱼'],
  ['痞老板经营的餐厅叫什么？','海之霸','蟹堡王','珊迪树屋'],
  ['珊迪是什么动物？','松鼠','海星','螃蟹'],
  ['派大星是什么动物？','海星','水母','海绵'],
  ['小蜗平时发出什么叫声？','喵','汪','咕咕'],
  ['魔法海螺在哪一类活动中指引了大家？','荒野露营','驾驶考试','蟹黄堡烹饪比赛'],
  ['飞天魔鬼通常以什么形象出现？','绿色幽灵','粉色海星','蓝色水母'],
  ['《乐队极客》里乐队在哪里演出？','泡泡碗','蟹堡王厨房','水母田'],
  ['海超人的搭档是谁？','大洋游侠','蟹老板','痞老板'],
  ['章鱼哥的房子像什么？','复活节岛人像','菠萝','玻璃圆顶'],
  ['谁经常试图偷蟹黄堡秘方？','痞老板','海绵宝宝','泡芙老师'],
  ['海绵宝宝用什么吹出造型泡泡？','泡泡棒','单簧管','金锅铲'],
];

const ENEMY_TYPES = {
  jelly:{ hp:26, speed:75, size:15, damage:10, xp:4, color:'#f999d2' },
  blue:{ hp:20, speed:124, size:12, damage:11, xp:5, color:'#7be6ff' },
  robot:{ hp:66, speed:62, size:20, damage:16, xp:8, color:'#88cbc0' },
  spitter:{ hp:41, speed:77, size:17, damage:12, xp:7, color:'#c2a2fa' },
};

const BOSSES = [
  { name:'水母国王', color:'#f585d2', hp:540, speed:70, damage:19, xp:44, attack:'pulse', interval:3.15, moves:['pulse','fan'] },
  { name:'痞老板机甲', color:'#74ecab', hp:930, speed:62, damage:23, xp:56, attack:'burst', interval:3.05, moves:['burst','mines','fan'] },
  { name:'飞天魔鬼', color:'#92ffe1', hp:1420, speed:82, damage:26, xp:68, attack:'charge', interval:3.05, moves:['charge','summon','fan'] },
  { name:'巨型水母王', color:'#ff9a93', hp:2150, speed:84, damage:29, xp:80, attack:'mixed', interval:2.85, moves:['pulse','fan','mines','charge','summon','burst'] },
];

const BOSS_MOVES = {
  pulse:{ windup:1.04, radius:148 },
  burst:{ windup:.93, rays:10, speed:218 },
  charge:{ windup:.97, speed:344, duration:.65 },
  fan:{ windup:1.02, rays:5, speed:238 },
  mines:{ windup:1.13, count:3, radius:46, delay:1.10 },
  summon:{ windup:1.16, count:3 },
};
