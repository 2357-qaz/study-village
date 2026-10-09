export const VERSION = 2;
export const HOUR = 3600000;
export const RESOURCES = {
  wood: {name: '木材', icon: 'tree-pine'},
  stone: {name: '石料', icon: 'mountain'},
  food: {name: '补给', icon: 'wheat'},
  stars: {name: '星砂', icon: 'sparkles'}
};
export const BUILDINGS = [
  {
    id: 'cottage',
    name: '林间书屋',
    icon: 'book-open',
    desc: '让每一页书，都有回响。',
    resource: 'stars',
    rate: 2,
    cost: {wood: 60, stone: 30, food: 10},
    color: '#e7a34d',
    size: 2,
    pop: 0,
    coastal: false
  },
  {
    id: 'sawmill',
    name: '森林工坊',
    icon: 'axe',
    desc: '把森林的馈赠变成新的屋檐。',
    resource: 'wood',
    rate: 18,
    cost: {wood: 50, stone: 25, food: 10},
    color: '#79a977',
    size: 2,
    pop: 0,
    coastal: false
  },
  {
    id: 'quarry',
    name: '山石工坊',
    icon: 'mountain',
    desc: '一块块石头，筑起稳固的村庄。',
    resource: 'stone',
    rate: 12,
    cost: {wood: 65, stone: 20, food: 15},
    color: '#9cabb9',
    size: 2,
    pop: 0,
    coastal: false
  },
  {
    id: 'farm',
    name: '风车农场',
    icon: 'wheat',
    desc: '慢慢生长，也是一种努力。',
    resource: 'food',
    rate: 10,
    cost: {wood: 75, stone: 35, food: 10},
    color: '#e4b750',
    size: 2,
    pop: 0,
    coastal: false
  },
  {
    id: 'observatory',
    name: '星月天文台',
    icon: 'telescope',
    desc: '为认真生活的人，收集星光。',
    resource: 'stars',
    rate: 5,
    cost: {wood: 180, stone: 140, food: 60},
    color: '#9b8fd8',
    size: 2,
    pop: 0,
    coastal: false
  },
  {
    id: 'dock',
    name: '渔人码头',
    icon: 'anchor',
    desc: '清晨出海，傍晚带回整片海的味道。',
    resource: 'food',
    rate: 14,
    cost: {wood: 120, stone: 40, food: 20},
    color: '#5f9ec2',
    size: 2,
    pop: 4,
    coastal: true
  },
  {
    id: 'bakery',
    name: '麦香面包坊',
    icon: 'croissant',
    desc: '烤炉一直暖着，等每一个晚归的人。',
    resource: 'food',
    rate: 12,
    cost: {wood: 110, stone: 70, food: 40},
    color: '#d69a5b',
    size: 2,
    pop: 5,
    coastal: false
  },
  {
    id: 'kiln',
    name: '陶土窑',
    icon: 'flame',
    desc: '火候到了，泥土也会变得坚硬。',
    resource: 'stone',
    rate: 16,
    cost: {wood: 140, stone: 60, food: 30},
    color: '#c27a5a',
    size: 2,
    pop: 5,
    coastal: false
  },
  {
    id: 'lumber',
    name: '林场木屋',
    icon: 'trees',
    desc: '种一棵树，砍一棵树，森林一直都在。',
    resource: 'wood',
    rate: 24,
    cost: {wood: 90, stone: 90, food: 40},
    color: '#6f8f5a',
    size: 2,
    pop: 6,
    coastal: false
  },
  {
    id: 'teahouse',
    name: '溪畔茶屋',
    icon: 'coffee',
    desc: '慢慢喝完一杯茶，心事也就落了地。',
    resource: 'stars',
    rate: 3,
    cost: {wood: 160, stone: 90, food: 60},
    color: '#8fb39a',
    size: 2,
    pop: 7,
    coastal: false
  },
  {
    id: 'lighthouse',
    name: '海角灯塔',
    icon: 'tower-control',
    desc: '替所有夜航的人，点一盏不灭的灯。',
    resource: 'stars',
    rate: 6,
    cost: {wood: 200, stone: 260, food: 70},
    color: '#e07a5f',
    size: 1,
    pop: 9,
    coastal: true
  },
  {
    id: 'library',
    name: '星辉图书馆',
    icon: 'library',
    desc: '每本书都是一扇窗，通向更大的世界。',
    resource: 'stars',
    rate: 7,
    cost: {wood: 300, stone: 240, food: 90},
    color: '#7d86c9',
    size: 3,
    pop: 10,
    coastal: false
  },
  {
    id: 'clocktower',
    name: '时光钟楼',
    icon: 'clock',
    desc: '钟声响起时，所有的努力都被记住。',
    resource: 'stars',
    rate: 9,
    cost: {wood: 360, stone: 360, food: 120},
    color: '#c9a45c',
    size: 2,
    pop: 14,
    coastal: false
  }
];
export const COLLECTIONS = [
  {id: 'leaf', name: '琥珀叶', rarity: 'common', icon: 'leaf', text: '一整个秋天，藏进一片叶子。'},
  {id: 'bottle', name: '海风瓶', rarity: 'common', icon: 'flask-conical', text: '打开时，仿佛听见很远的海。'},
  {id: 'feather', name: '旅鸟羽', rarity: 'common', icon: 'feather', text: '一位路过村庄的朋友留下的礼物。'},
  {id: 'compass', name: '旅人罗盘', rarity: 'rare', icon: 'compass', text: '指针总是朝向你想去的地方。'},
  {id: 'moon', name: '月光怀表', rarity: 'rare', icon: 'watch', text: '它记得所有静静用功的夜晚。'},
  {id: 'crystal', name: '极光晶簇', rarity: 'epic', icon: 'gem', text: '把北方的天空带回了家。'},
  {id: 'whale', name: '星海鲸', rarity: 'epic', icon: 'waves', text: '在书页之间，游过一片银河。'},
  {
    id: 'crown',
    name: '永昼之冠',
    rarity: 'legendary',
    icon: 'crown',
    text: '献给那些一次又一次重新开始的人。'
  },
  {id: 'acorn', name: '橡果风铃', rarity: 'common', icon: 'nut', text: '风经过的时候，会轻轻叫你的名字。'},
  {id: 'shell', name: '潮声海螺', rarity: 'common', icon: 'shell', text: '贴在耳边，是一整个夏天的潮汐。'},
  {id: 'teacup', name: '午后茶杯', rarity: 'common', icon: 'coffee', text: '杯底总留着一点刚刚好的温度。'},
  {id: 'lantern', name: '萤火提灯', rarity: 'rare', icon: 'lamp', text: '装着一百只萤火虫借来的光。'},
  {
    id: 'hourglass',
    name: '星沙漏',
    rarity: 'rare',
    icon: 'hourglass',
    text: '每一粒落下的星沙，都是你专注过的一分钟。'
  },
  {id: 'scroll', name: '旧地图卷', rarity: 'rare', icon: 'map', text: '地图边缘写着：此处尚待你去发现。'},
  {id: 'globe', name: '天球仪', rarity: 'epic', icon: 'orbit', text: '把整片夜空，放在掌心慢慢转动。'},
  {id: 'koi', name: '锦鲤风灯', rarity: 'epic', icon: 'fish', text: '逆流而上的鱼，终会游进星海。'},
  {id: 'bonsai', name: '时光古树', rarity: 'legendary', icon: 'trees', text: '一年长一圈，一页书长一片叶。'},
  {
    id: 'phoenix',
    name: '不熄之羽',
    rarity: 'legendary',
    icon: 'flame',
    text: '燃尽之后，又一次从灰烬里亮起来。'
  }
];
export const RARITIES = {
  common: {name: '寻常', chance: 60},
  rare: {name: '稀有', chance: 28},
  epic: {name: '史诗', chance: 10},
  legendary: {name: '传说', chance: 2}
};
export function initialState(now = Date.now()) {
  return {
    version: VERSION,
    createdAt: now,
    lastAccrual: now,
    resources: {wood: 120, stone: 80, food: 30, stars: 30},
    pending: {wood: 0, stone: 0, food: 0, stars: 0},
    buildings: {
      cottage: 1,
      sawmill: 1,
      quarry: 0,
      farm: 0,
      observatory: 0,
      dock: 0,
      bakery: 0,
      kiln: 0,
      lumber: 0,
      teahouse: 0,
      lighthouse: 0,
      library: 0,
      clocktower: 0
    },
    layout: {cottage: {...LAYOUT.cottage}, sawmill: {...LAYOUT.sawmill}},
    island: defaultIsland(),
    decor: defaultDecor(),
    sessions: [],
    collection: {},
    draws: 0,
    pity: 0,
    timer: null
  };
}
export function rates(s) {
  const r = {wood: 0, stone: 0, food: 0, stars: 0};
  for (const b of BUILDINGS) r[b.resource] += b.rate * (s.buildings[b.id] || 0);
  return r;
}
export function accrue(s, now = Date.now()) {
  const r = rates(s),
    hours = Math.max(0, now - s.lastAccrual) / HOUR;
  for (const k of Object.keys(r)) s.pending[k] = Math.min(r[k] * 24, s.pending[k] + hours * r[k]);
  s.lastAccrual = Math.max(now, s.lastAccrual);
  return s;
}
export function collect(s, now = Date.now()) {
  accrue(s, now);
  const gained = {...s.pending};
  for (const k of Object.keys(gained)) {
    s.resources[k] += gained[k];
    s.pending[k] = 0;
  }
  return gained;
}
export function costFor(s, id) {
  const b = BUILDINGS.find(b => b.id === id);
  if (!b) throw Error('找不到这座建筑');
  return Object.fromEntries(
    Object.entries(b.cost).map(([k, v]) => [k, Math.ceil(v * Math.pow(1.65, s.buildings[id]))])
  );
}
export function upgrade(s, id, now = Date.now(), spot) {
  if (s.buildings[id] === 0) {
    need(s, id);
    let sp = spot || findSpot(s, id);
    if (!sp) throw Error('岛上没有合适的空地，请先开拓土地');
    return placeBuilding(s, id, sp.x, sp.z, sp.r || 0, now);
  }
  if (s.buildings[id] >= 5) throw Error('已经达到最高等级');
  const cost = costFor(s, id);
  if (Object.entries(cost).some(([k, v]) => s.resources[k] < v))
    throw Error('建材还不够，再学习一会儿或领取产出吧');
  accrue(s, now);
  for (const [k, v] of Object.entries(cost)) s.resources[k] -= v;
  s.buildings[id]++;
  return s.buildings[id];
}
export function studySeconds(s) {
  return s.sessions.filter(x => x.kind === 'study').reduce((n, x) => n + x.seconds, 0);
}
export function population(s) {
  return 3 + Math.floor(studySeconds(s) / 3600);
}
export function restCredit(s) {
  return Math.max(
    0,
    Math.floor(studySeconds(s) / 5) -
      s.sessions.filter(x => x.kind === 'rest').reduce((n, x) => n + x.seconds, 0)
  );
}
export function secondsBetween(s, start, end, kind = 'study') {
  return s.sessions
    .filter(x => x.kind === kind)
    .reduce(
      (sum, x) =>
        sum +
        x.segments.reduce(
          (v, p) => v + Math.max(0, Math.min(end, p.end) - Math.max(start, p.start)) / 1000,
          0
        ),
      0
    );
}
export function weekStart(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return +d;
}
export function timerSegments(t, now = Date.now()) {
  if (!t) return [];
  let remain = t.goal * 1000;
  const parts = [...t.segments];
  if (t.runningSince !== null) parts.push({start: t.runningSince, end: Math.max(t.runningSince, now)});
  const result = [];
  for (const p of parts) {
    const length = Math.min(Math.max(0, p.end - p.start), remain);
    if (length > 0) result.push({start: p.start, end: p.start + length});
    remain -= length;
    if (remain <= 0) break;
  }
  return result;
}
export function timerElapsed(t, now = Date.now()) {
  return timerSegments(t, now).reduce((v, p) => v + (p.end - p.start) / 1000, 0);
}
export function startTimer(s, kind, minutes, topic, now = Date.now()) {
  if (s.timer) throw Error('请先完成当前计时');
  if (
    !['study', 'rest'].includes(kind) ||
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > (kind === 'rest' ? 15 : 180)
  )
    throw Error('时长不在允许范围内');
  let goal = minutes * 60;
  if (kind === 'rest') {
    goal = Math.min(goal, restCredit(s));
    if (goal < 60) throw Error('先学习 5 分钟，就能解锁 1 分钟休息奖励');
  }
  s.timer = {
    kind,
    goal,
    topic: String(topic).trim().slice(0, 80) || '自由学习',
    segments: [],
    runningSince: now
  };
}
export function pauseTimer(s, now = Date.now()) {
  if (!s.timer) throw Error('还没有开始计时');
  s.timer.segments = timerSegments(s.timer, now);
  s.timer.runningSince = null;
}
export function resumeTimer(s, now = Date.now()) {
  if (!s.timer) throw Error('还没有开始计时');
  if (timerElapsed(s.timer, now) >= s.timer.goal) throw Error('本次计时已经完成，请领取奖励');
  if (s.timer.runningSince === null) s.timer.runningSince = now;
}
export function addSession(s, kind, segments, topic, now = Date.now(), manual = false) {
  const seconds = segments.reduce((n, p) => n + (p.end - p.start) / 1000, 0);
  if (seconds < 60) throw Error('至少完成 1 分钟再打卡吧');
  if (kind === 'rest' && seconds > restCredit(s) + 0.001) throw Error('可奖励的休息时间不足');
  if (
    segments.some(
      p =>
        !Number.isFinite(p.start) ||
        !Number.isFinite(p.end) ||
        p.end > now + 1000 ||
        p.start >= p.end ||
        p.start < now - 366 * 24 * HOUR
    )
  )
    throw Error('请填写过去一年内有效的学习时间');
  for (const x of s.sessions)
    for (const p of segments)
      if (x.segments.some(q => p.start < q.end && p.end > q.start))
        throw Error('这段时间已有打卡记录，请检查结束时间');
  const reward =
    kind === 'study'
      ? {wood: seconds / 30, stone: seconds / 60, food: 0, stars: seconds / 150}
      : {wood: 0, stone: 0, food: seconds / 30, stars: seconds / 300};
  for (const k of Object.keys(reward)) s.resources[k] += reward[k];
  s.sessions.push({
    id: globalThis.crypto?.randomUUID?.() || `${now}-${s.sessions.length}`,
    kind,
    topic: String(topic).trim().slice(0, 80) || '自由学习',
    segments,
    seconds,
    endedAt: segments.at(-1).end,
    recordedAt: now,
    manual
  });
  return reward;
}
export function finishTimer(s, now = Date.now()) {
  if (!s.timer) throw Error('还没有开始计时');
  const t = s.timer;
  const reward = addSession(s, t.kind, timerSegments(t, now), t.topic, now);
  s.timer = null;
  return reward;
}
export function manualStudy(s, minutes, end, topic, now = Date.now()) {
  if (s.timer) throw Error('请先结束当前计时，再补记学习');
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) throw Error('单次补记为 1–240 分钟');
  return addSession(s, 'study', [{start: end - minutes * 60000, end}], topic, now, true);
}
export function draw(s, count = 1, rng = Math.random) {
  if (![1, 5].includes(count)) throw Error('请选择 1 次或 5 次寻宝');
  if (s.resources.stars < count * 30) throw Error('星砂不足，每次寻宝需要 30 星砂');
  s.resources.stars -= count * 30;
  const results = [];
  for (let i = 0; i < count; i++) {
    const roll = rng() * 100;
    let rarity = roll < 2 ? 'legendary' : roll < 12 ? 'epic' : roll < 40 ? 'rare' : 'common';
    if (s.pity >= 19 && !['epic', 'legendary'].includes(rarity)) rarity = 'epic';
    s.pity = ['epic', 'legendary'].includes(rarity) ? 0 : s.pity + 1;
    const pool = COLLECTIONS.filter(x => x.rarity === rarity),
      item = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))],
      isNew = !s.collection[item.id];
    s.collection[item.id] = (s.collection[item.id] || 0) + 1;
    s.draws++;
    results.push({...item, isNew});
  }
  return results;
}
export function validateState(x) {
  const fail = () => {
    throw Error('存档格式无效或版本不兼容，原有进度未改动');
  };
  const n = (v, max = 1e12) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
  const v = x?.version;
  if (!x || (v !== 1 && v !== 2) || !n(x.createdAt, 1e14) || !n(x.lastAccrual, 1e14)) fail();
  for (const obj of ['resources', 'pending'])
    for (const k of Object.keys(RESOURCES)) if (!n(x[obj]?.[k])) fail();
  for (const b of v === 1 ? BUILDINGS.slice(0, 5) : BUILDINGS)
    if (!Number.isInteger(x.buildings?.[b.id]) || x.buildings[b.id] < 0 || x.buildings[b.id] > 5) fail();
  if (!Array.isArray(x.sessions) || x.sessions.length > 100000) fail();
  const intervals = [];
  for (const a of x.sessions) {
    if (
      !['study', 'rest'].includes(a.kind) ||
      typeof a.topic !== 'string' ||
      a.topic.length > 80 ||
      !n(a.seconds, 86400) ||
      !n(a.endedAt, 1e14) ||
      !n(a.recordedAt, 1e14) ||
      !Array.isArray(a.segments) ||
      !a.segments.length
    )
      fail();
    let sum = 0;
    for (const p of a.segments) {
      if (!n(p.start, 1e14) || !n(p.end, 1e14) || p.end <= p.start) fail();
      sum += (p.end - p.start) / 1000;
      intervals.push(p);
    }
    if (Math.abs(sum - a.seconds) > 0.01 || a.endedAt !== a.segments.at(-1).end) fail();
  }
  intervals.sort((a, b) => a.start - b.start);
  for (let i = 1; i < intervals.length; i++) if (intervals[i].start < intervals[i - 1].end) fail();
  if (
    !n(x.draws) ||
    !Number.isInteger(x.draws) ||
    !Number.isInteger(x.pity) ||
    x.pity < 0 ||
    x.pity > 19 ||
    !x.collection ||
    typeof x.collection !== 'object' ||
    Array.isArray(x.collection)
  )
    fail();
  for (const [k, v] of Object.entries(x.collection))
    if (!COLLECTIONS.some(c => c.id === k) || !Number.isInteger(v) || v < 1 || v > 1e9) fail();
  if (x.timer !== null) {
    const t = x.timer;
    if (
      !t ||
      !['study', 'rest'].includes(t.kind) ||
      typeof t.topic !== 'string' ||
      t.topic.length > 80 ||
      !n(t.goal, 10800) ||
      t.goal < 60 ||
      !Array.isArray(t.segments) ||
      !(t.runningSince === null || n(t.runningSince, 1e14))
    )
      fail();
    let prev = 0;
    for (const p of t.segments) {
      if (!n(p.start, 1e14) || !n(p.end, 1e14) || p.end <= p.start || p.start < prev) fail();
      prev = p.end;
    }
    if (t.runningSince !== null && t.runningSince < prev) fail();
  }
  const c = JSON.parse(JSON.stringify(x));
  if (v === 1) return migrate(c);
  validateV2(c, fail);
  return c;
}
export const GRID = 28;
export const TERRAIN = {
  '.': {name: '海'},
  g: {name: '草地'},
  s: {name: '沙滩'},
  f: {name: '花甸'},
  r: {name: '岩地'},
  p: {name: '石径'},
  w: {name: '池塘'}
};
export const DECOR = [
  {id: 'pine', name: '松树', icon: 'tree-pine', cost: {wood: 6}, place: 'land'},
  {id: 'oak', name: '圆冠树', icon: 'tree-deciduous', cost: {wood: 6}, place: 'land'},
  {id: 'blossom', name: '樱花树', icon: 'flower-2', cost: {wood: 8, food: 4}, place: 'land'},
  {id: 'palm', name: '椰子树', icon: 'tree-palm', cost: {wood: 8}, place: 'land'},
  {id: 'bush', name: '灌木丛', icon: 'shrub', cost: {food: 3}, place: 'land'},
  {id: 'flowerbed', name: '花圃', icon: 'flower', cost: {wood: 2, food: 5}, place: 'land'},
  {id: 'rock', name: '景观石', icon: 'mountain', cost: {stone: 5}, place: 'land'},
  {id: 'fence', name: '木栅栏', icon: 'fence', cost: {wood: 3}, place: 'land'},
  {id: 'lamp', name: '路灯', icon: 'lamp-floor', cost: {wood: 4, stone: 4}, place: 'land'},
  {id: 'bench', name: '长椅', icon: 'armchair', cost: {wood: 8}, place: 'land'},
  {id: 'well', name: '水井', icon: 'droplets', cost: {wood: 6, stone: 14}, place: 'land'},
  {id: 'scarecrow', name: '稻草人', icon: 'bird', cost: {wood: 4, food: 4}, place: 'land'},
  {id: 'banner', name: '彩旗', icon: 'flag', cost: {wood: 4, food: 2}, place: 'land'},
  {id: 'stonelantern', name: '石灯笼', icon: 'flame', cost: {stone: 10}, place: 'land'},
  {id: 'campfire', name: '篝火', icon: 'flame-kindling', cost: {wood: 10}, place: 'land'},
  {id: 'tent', name: '帐篷', icon: 'tent', cost: {wood: 6, food: 6}, place: 'land'},
  {id: 'bridge', name: '木桥', icon: 'waves', cost: {wood: 10}, place: 'pond'},
  {id: 'boat', name: '小帆船', icon: 'sailboat', cost: {wood: 20}, place: 'sea'},
  {id: 'statue', name: '星辉雕像', icon: 'star', cost: {stone: 30, stars: 20}, place: 'land'},
  {id: 'display', name: '奇物展台', icon: 'gem', cost: {stone: 12, stars: 10}, place: 'land'}
];
export const TERRAIN_TOOLS = [
  {id: 'reclaim', name: '填海造地', icon: 'land-plot'},
  {id: 'g', name: '草地', icon: 'sprout'},
  {id: 's', name: '沙滩', icon: 'waves'},
  {id: 'f', name: '花甸', icon: 'flower'},
  {id: 'r', name: '岩地', icon: 'mountain'},
  {id: 'p', name: '石径', icon: 'footprints'},
  {id: 'w', name: '池塘', icon: 'droplets'},
  {id: 'raise', name: '抬升', icon: 'arrow-up'},
  {id: 'lower', name: '降低', icon: 'arrow-down'},
  {id: 'sea', name: '还原为海', icon: 'eraser'}
];
const LAYOUT = {
  cottage: {x: 13, z: 12, r: 0},
  sawmill: {x: 10, z: 15, r: 0},
  quarry: {x: 10, z: 12, r: 0},
  farm: {x: 15, z: 12, r: 0},
  observatory: {x: 14, z: 16, r: 0}
};
const NB = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ],
  TCOST = {g: {}, s: {}, f: {food: 2}, r: {stone: 2}, p: {stone: 3}, w: {}, lower: {}, sea: {}},
  NOMAT = '建材还不够，再学习一会儿或领取产出吧';
const clone = o => JSON.parse(JSON.stringify(o)),
  rot = r => (((Math.trunc(r) || 0) % 4) + 4) % 4;
export function tileIndex(x, z) {
  return z * GRID + x;
}
export function inBounds(x, z) {
  return Number.isInteger(x) && Number.isInteger(z) && x >= 0 && z >= 0 && x < GRID && z < GRID;
}
export function isLand(t) {
  return t !== '.';
}
export function tileAt(s, x, z) {
  if (!inBounds(x, z)) return null;
  const i = tileIndex(x, z);
  return {t: s.island.terrain[i], h: +s.island.height[i]};
}
export function landCount(s) {
  let n = 0;
  for (const c of s.island.terrain) if (c !== '.') n++;
  return n;
}
export function buildingSize(id) {
  return BUILDINGS.find(b => b.id === id)?.size || 1;
}
export function defaultLayout() {
  return clone(LAYOUT);
}
export function defaultIsland() {
  const forced = new Set();
  for (const [id, p] of Object.entries(LAYOUT)) {
    const n = buildingSize(id);
    for (let dz = 0; dz < n; dz++) for (let dx = 0; dx < n; dx++) forced.add(tileIndex(p.x + dx, p.z + dz));
  }
  let t = '',
    h = '';
  for (let z = 0; z < GRID; z++)
    for (let x = 0; x < GRID; x++) {
      const wx = x - 13.5,
        wz = z - 13.5,
        d = Math.hypot(wx, wz),
        a = Math.atan2(wz, wx),
        edge = 6.4 + 0.55 * Math.sin(3 * a + 0.7) + 0.35 * Math.sin(5 * a + 2.1);
      let c,
        hh = 0;
      if (d > edge) c = '.';
      else if (d > edge - 1.3) c = 's';
      else {
        c = 'g';
        hh = 1;
      }
      if (c === 'g' && ((wx - 3.8) / 1.9) ** 2 + ((wz - 2.3) / 1.25) ** 2 < 1) c = 'w';
      if (c === 'g' && ((z === 14 && x >= 9 && x <= 18) || (x === 12 && z >= 10 && z <= 19))) c = 'p';
      if (c === 'g' && (x * 7 + z * 13) % 11 === 0) c = 'f';
      if (forced.has(tileIndex(x, z)) && c !== 'p') {
        c = 'g';
        hh = 1;
      }
      t += c;
      h += hh;
    }
  return {terrain: t, height: h};
}
const BASE_LAND = [...defaultIsland().terrain].filter(c => c !== '.').length;
function* cells(s) {
  for (const [id, p] of Object.entries(s.layout || {})) {
    const n = buildingSize(id);
    for (let dz = 0; dz < n; dz++)
      for (let dx = 0; dx < n; dx++) yield [tileIndex(p.x + dx, p.z + dz), 'b:' + id];
  }
  for (const d of s.decor || []) yield [tileIndex(d.x, d.z), 'd:' + d.id];
}
export function occupancy(s) {
  const m = new Map();
  for (const [i, k] of cells(s)) m.set(i, k);
  return m;
}
export function objectAt(s, x, z) {
  return inBounds(x, z) ? occupancy(s).get(tileIndex(x, z)) || null : null;
}
function check(s, occ, kind, type, x, z, ign, item) {
  const no = reason => ({ok: false, reason}),
    yes = {ok: true, reason: ''};
  if (kind === 'building') {
    const b = BUILDINGS.find(b => b.id === type);
    if (!b) return no('找不到这座建筑');
    let coast = !b.coastal,
      h0;
    for (let dz = 0; dz < b.size; dz++)
      for (let dx = 0; dx < b.size; dx++) {
        const px = x + dx,
          pz = z + dz,
          q = tileAt(s, px, pz);
        if (!q) return no('超出岛屿范围');
        if (q.t === '.') return no('建筑只能建在陆地上');
        if (q.t === 'w') return no('池塘上不能建造');
        if (h0 === undefined) h0 = q.h;
        if (q.h !== h0) return no('地面高度不一致，请先整平');
        const o = occ.get(tileIndex(px, pz));
        if (o && o !== ign) return no('这里已被占用');
        if (!coast)
          for (let a = -2; a <= 2; a++)
            for (let c = -2; c <= 2; c++) if (tileAt(s, px + a, pz + c)?.t === '.') coast = true;
      }
    return coast ? yes : no('需要靠近海边（两格以内）');
  }
  if (kind !== 'decor') return no('未知的放置类型');
  const d = DECOR.find(d => d.id === type);
  if (!d) return no('找不到这种装饰');
  const q = tileAt(s, x, z);
  if (!q) return no('超出岛屿范围');
  if (d.place === 'land' && (q.t === '.' || q.t === 'w')) return no('这里不能放置，请选择陆地');
  if (d.place === 'pond' && q.t !== 'w') return no('只能放在池塘上');
  if (
    d.place === 'sea' &&
    !(
      q.t === '.' &&
      x >= 1 &&
      z >= 1 &&
      x <= 26 &&
      z <= 26 &&
      NB.some(([a, c]) => {
        const n = tileAt(s, x + a, z + c);
        return n && n.t !== '.';
      })
    )
  )
    return no('只能放在靠近岸边的海面上');
  if (type === 'display' && !COLLECTIONS.some(c => c.id === item)) return no('请选择要展示的收藏品');
  const o = occ.get(tileIndex(x, z));
  if (o && o !== ign) return no('这里已被占用');
  return yes;
}
export function canPlace(s, kind, type, x, z, ignoreKey = null, item) {
  return check(s, occupancy(s), kind, type, x, z, ignoreKey, item);
}
function need(s, id) {
  const b = BUILDINGS.find(b => b.id === id);
  if (!b) throw Error('找不到这座建筑');
  if (s.buildings[id] >= 5) throw Error('已经达到最高等级');
  const cost = costFor(s, id);
  if (Object.entries(cost).some(([k, v]) => s.resources[k] < v)) throw Error(NOMAT);
  if (population(s) < b.pop) throw Error(`需要 ${b.pop} 位居民`);
  return cost;
}
export function placeBuilding(s, id, x, z, r = 0, now = Date.now()) {
  r = rot(r);
  if (!BUILDINGS.some(b => b.id === id)) throw Error('找不到这座建筑');
  s.layout ||= {};
  if (s.buildings[id] > 0) {
    const c = canPlace(s, 'building', id, x, z, 'b:' + id);
    if (!c.ok) throw Error(c.reason);
    s.layout[id] = {x, z, r};
    return s.buildings[id];
  }
  const cost = need(s, id),
    c = canPlace(s, 'building', id, x, z, 'b:' + id);
  if (!c.ok) throw Error(c.reason);
  accrue(s, now);
  for (const [k, v] of Object.entries(cost)) s.resources[k] -= v;
  s.buildings[id] = 1;
  s.layout[id] = {x, z, r};
  return 1;
}
export function rotateBuilding(s, id) {
  const p = s.layout?.[id];
  if (!p) throw Error('这座建筑还没有建成');
  p.r = (p.r + 1) % 4;
  return p.r;
}
export function findSpot(s, id) {
  const n = buildingSize(id),
    occ = occupancy(s),
    c = [];
  for (let z = 0; z + n <= GRID; z++)
    for (let x = 0; x + n <= GRID; x++) c.push([Math.hypot(x + n / 2 - 14, z + n / 2 - 14), x, z]);
  c.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
  for (const [, x, z] of c) if (check(s, occ, 'building', id, x, z, 'b:' + id).ok) return {x, z};
  return null;
}
export function placeDecor(s, type, x, z, r = 0, item) {
  const d = DECOR.find(d => d.id === type);
  if (!d) throw Error('找不到这种装饰');
  if (Object.entries(d.cost).some(([k, v]) => s.resources[k] < v)) throw Error(NOMAT);
  if (type === 'display' && !(s.collection[item] > 0)) throw Error('需要先拥有这件收藏品才能展示');
  if (s.decor.length >= 600) throw Error('装饰数量已达上限');
  const c = canPlace(s, 'decor', type, x, z, null, item);
  if (!c.ok) throw Error(c.reason);
  for (const [k, v] of Object.entries(d.cost)) s.resources[k] -= v;
  const ids = new Set(s.decor.map(o => o.id));
  let i = s.decor.length;
  while (ids.has('d' + i)) i++;
  const o = {id: 'd' + i, type, x, z, r: rot(r)};
  if (type === 'display') o.item = item;
  s.decor.push(o);
  return o.id;
}
const findDecor = (s, uid) =>
  s.decor.find(d => d.id === uid) ||
  (() => {
    throw Error('找不到这件装饰');
  })();
export function moveDecor(s, uid, x, z) {
  const d = findDecor(s, uid),
    c = canPlace(s, 'decor', d.type, x, z, 'd:' + uid, d.item);
  if (!c.ok) throw Error(c.reason);
  d.x = x;
  d.z = z;
}
export function rotateDecor(s, uid) {
  const d = findDecor(s, uid);
  d.r = (d.r + 1) % 4;
  return d.r;
}
export function removeDecor(s, uid) {
  findDecor(s, uid);
  s.decor = s.decor.filter(d => d.id !== uid);
}
export function defaultDecor() {
  const trees = [
      [-5.3, -1.8],
      [-5, -2.8],
      [-4.3, -3.8],
      [-3.5, -4.5],
      [-2.4, -5.1],
      [-1.2, -5.5],
      [0.2, -5.45],
      [1.5, -5.2],
      [2.7, -4.7],
      [4, -3.8],
      [4.9, -2.4],
      [5.5, -0.8],
      [5.6, 0.5],
      [-5.4, 0.2],
      [-5.2, 1.5],
      [-4.5, 2.9],
      [-3.7, 4],
      [-2.8, 4.8],
      [4.3, 3.8],
      [2.9, 4.9],
      [1.4, 5.35],
      [-0.5, 5.3]
    ],
    list = trees.map(([wx, wz], i) => ({
      type: i % 3 === 0 ? 'oak' : 'pine',
      x: Math.floor(wx + 14),
      z: Math.floor(wz + 14),
      r: i % 4
    }));
  [
    [9, 17],
    [10, 17],
    [11, 17],
    [15, 10],
    [16, 10],
    [17, 10]
  ].forEach(([x, z]) => list.push({type: 'fence', x, z, r: 0}));
  const s = {island: defaultIsland(), layout: defaultLayout(), decor: []};
  for (const o of list)
    if (canPlace(s, 'decor', o.type, o.x, o.z).ok) s.decor.push({id: 'g' + s.decor.length, ...o});
  return s.decor;
}
export function migrate(v1) {
  const s = clone(v1),
    lay = defaultLayout();
  for (const b of BUILDINGS) if (s.buildings[b.id] === undefined) s.buildings[b.id] = 0;
  s.layout = {};
  for (const b of BUILDINGS) if (s.buildings[b.id] > 0 && lay[b.id]) s.layout[b.id] = lay[b.id];
  s.island = defaultIsland();
  s.decor = defaultDecor();
  s.version = 2;
  return s;
}
export function terrainCost(s, tool, x, z) {
  if (tool === 'reclaim') {
    const n = Math.max(0, landCount(s) - BASE_LAND);
    return {stone: 6 + Math.floor(n / 12), wood: 4 + Math.floor(n / 20), food: 2 + Math.floor(n / 30)};
  }
  if (tool === 'raise') return {stone: 4 * ((tileAt(s, x, z)?.h || 0) + 1)};
  if (!Object.hasOwn(TCOST, tool)) throw Error('未知的地貌工具');
  return {...TCOST[tool]};
}
export function editTerrain(s, tool, x, z) {
  if (!TERRAIN_TOOLS.some(t => t.id === tool)) throw Error('未知的地貌工具');
  const q = tileAt(s, x, z);
  if (!q) throw Error('超出岛屿范围');
  if (occupancy(s).has(tileIndex(x, z))) throw Error('这里有建筑或装饰，请先移走');
  let c = q.t,
    h = q.h;
  if (tool === 'reclaim') {
    if (q.t !== '.') throw Error('这里已经是陆地');
    if (x < 1 || z < 1 || x > 26 || z > 26) throw Error('最外圈不能填海');
    if (
      !NB.some(([a, b]) => {
        const n = tileAt(s, x + a, z + b);
        return n && n.t !== '.';
      })
    )
      throw Error('需要紧邻现有陆地');
    c = 's';
    h = 0;
  } else {
    if (q.t === '.') throw Error('这里是海，请先填海造地');
    if (tool === 'raise') {
      if (h >= 3) throw Error('已经是最高的地势');
      h++;
    } else if (tool === 'lower') {
      if (h <= 0) throw Error('已经是最低的地势');
      h--;
    } else if (tool === 'sea') {
      if (h !== 0) throw Error('请先把地势降到最低');
      c = '.';
    } else {
      if (q.t === tool) throw Error('这里已经是这种地貌');
      c = tool;
    }
  }
  const cost = terrainCost(s, tool, x, z);
  if (Object.entries(cost).some(([k, v]) => s.resources[k] < v)) throw Error(NOMAT);
  for (const [k, v] of Object.entries(cost)) s.resources[k] -= v;
  const i = tileIndex(x, z),
    I = s.island;
  I.terrain = I.terrain.slice(0, i) + c + I.terrain.slice(i + 1);
  I.height = I.height.slice(0, i) + h + I.height.slice(i + 1);
  return cost;
}
function validateV2(x, fail) {
  const L = x.layout,
    I = x.island;
  if (
    !L ||
    typeof L !== 'object' ||
    Array.isArray(L) ||
    !I ||
    typeof I.terrain !== 'string' ||
    typeof I.height !== 'string' ||
    !/^[.gsfrpw]{784}$/.test(I.terrain) ||
    !/^[0-3]{784}$/.test(I.height)
  )
    fail();
  for (let i = 0; i < 784; i++) if (I.terrain[i] === '.' && I.height[i] !== '0') fail();
  for (const k of Object.keys(L)) if (!BUILDINGS.some(b => b.id === k)) fail();
  const seen = new Set(),
    mark = i => {
      if (seen.has(i)) fail();
      seen.add(i);
    };
  for (const b of BUILDINGS) {
    const p = L[b.id];
    if (x.buildings[b.id] > 0 !== (p !== undefined)) fail();
    if (p === undefined) continue;
    if (
      !p ||
      typeof p !== 'object' ||
      !Number.isInteger(p.r) ||
      p.r < 0 ||
      p.r > 3 ||
      !inBounds(p.x, p.z) ||
      !inBounds(p.x + b.size - 1, p.z + b.size - 1)
    )
      fail();
    for (let dz = 0; dz < b.size; dz++)
      for (let dx = 0; dx < b.size; dx++) mark(tileIndex(p.x + dx, p.z + dz));
  }
  if (!Array.isArray(x.decor) || x.decor.length > 600) fail();
  const ids = new Set();
  for (const d of x.decor) {
    if (
      !d ||
      typeof d.id !== 'string' ||
      !/^[a-z0-9-]{1,40}$/.test(d.id) ||
      ids.has(d.id) ||
      !DECOR.some(t => t.id === d.type) ||
      !inBounds(d.x, d.z) ||
      !Number.isInteger(d.r) ||
      d.r < 0 ||
      d.r > 3
    )
      fail();
    ids.add(d.id);
    if (d.type === 'display' ? !COLLECTIONS.some(c => c.id === d.item) : d.item !== undefined) fail();
    mark(tileIndex(d.x, d.z));
  }
}
