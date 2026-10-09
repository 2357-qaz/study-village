# Timegrove v2 — 自由建造岛屿 规格（内部协作文档）

目标：细化 3D 村庄、玩家自由决定建筑位置与岛屿地貌、扩充建筑/装饰/收藏品、收藏品 3D 模型。
**硬性约束：现有资源都继续有用；旧存档 (version 1) 无损自动迁移；不改变任何既有数值规则（学习奖励、休息、产速、升级费用公式、抽奖概率与保底、离线 24h 上限）。现有 `tests/core.test.mjs` 的 10 个测试必须原样通过。**

代码风格：与现有文件一致（紧凑 ES module、两空格以内缩进、中文用户文案）。不引入依赖、无构建步骤。

## 文件归属

| 文件 | 负责 |
|---|---|
| `dist/core.js`, `tests/core.test.mjs` | 核心规则代理 |
| `dist/scene.js`, `dist/models.js`, `dist/items3d.js` | 3D/美术（主会话） |
| `dist/app.js`, `dist/index.html`, `dist/style.css` | UI 代理 |

所有对 core 的 import 统一写 `./core.js?v=4`（保证浏览器只实例化一份模块）。`index.html` 中 `style.css?v=5`、`app.js?v=4`；`app.js` 动态导入 `./scene.js?v=4` 与 `./items3d.js?v=4`。

## 坐标

- 网格 `GRID = 28`，格子 `(x, z)`，`0 <= x,z < 28`，索引 `z*GRID + x`。
- 世界坐标：格子 `(x,z)` 覆盖 `[x-14, x-13] × [z-14, z-13]`，中心 `(x-13.5, z-13.5)`。
- 建筑 `size` 为 1/2/3 的正方形占地，锚点 `(x,z)` 为最小角，占 `x..x+size-1`, `z..z+size-1`。`r` 为 0..3（每 90° 旋转，正方形占地不变）。

## 地貌

`island.terrain`：长度 784 的字符串，每格一个字符：

| 字符 | 名称 | 说明 |
|---|---|---|
| `.` | 海 | 非陆地，高度必须为 0 |
| `g` | 草地 | 陆地 |
| `s` | 沙滩 | 陆地 |
| `f` | 花甸 | 陆地 |
| `r` | 岩地 | 陆地 |
| `p` | 石径 | 陆地 |
| `w` | 池塘 | 陆地上的水，不可放建筑/普通装饰（木桥除外） |

`island.height`：长度 784，字符 `0`–`3`。

导出 `TERRAIN = {'.':{name:'海'},g:{name:'草地'},s:{name:'沙滩'},f:{name:'花甸'},r:{name:'岩地'},p:{name:'石径'},w:{name:'池塘'}}`。

### 默认岛屿 `defaultIsland()`（确定性）

```
for z,x in 0..27: wx=x-13.5, wz=z-13.5, d=hypot(wx,wz), a=atan2(wz,wx)
  edge = 6.4 + 0.55*sin(3a+0.7) + 0.35*sin(5a+2.1)
  d > edge        → '.' h0
  d > edge - 1.3  → 's' h0
  else            → 'g' h1
  若为 g 且 ((wx-3.8)/1.9)^2 + ((wz-2.3)/1.25)^2 < 1 → 'w'
  若为 g 且 ((z===14 && 9<=x<=18) || (x===12 && 10<=z<=19)) → 'p'
  若为 g 且 (x*7+z*13)%11===0 → 'f'
最后：defaultLayout() 中五座原始建筑的占地格强制为 'g' h1（路径格除外保持 'p'）。
```

### 默认布局 `defaultLayout()`（对应旧版固定地块）

```
cottage {x:13,z:12,r:0}  sawmill {x:10,z:15,r:0}  quarry {x:10,z:12,r:0}
farm    {x:15,z:12,r:0}  observatory {x:14,z:16,r:0}
```

### 默认装饰 `defaultDecor()`

旧版树木点位（世界坐标）`[[-5.3,-1.8],[-5,-2.8],[-4.3,-3.8],[-3.5,-4.5],[-2.4,-5.1],[-1.2,-5.5],[.2,-5.45],[1.5,-5.2],[2.7,-4.7],[4,-3.8],[4.9,-2.4],[5.5,-.8],[5.6,.5],[-5.4,.2],[-5.2,1.5],[-4.5,2.9],[-3.7,4],[-2.8,4.8],[4.3,3.8],[2.9,4.9],[1.4,5.35],[-.5,5.3]]` → 格子 `floor(wx+14), floor(wz+14)`，类型 `i%3===0?'oak':'pine'`，`r:i%4`。
栅栏：`(9,17),(10,17),(11,17),(15,10),(16,10),(17,10)`，类型 `fence`，`r:0`。
id 依次为 `g0`,`g1`,…。在默认岛屿 + 默认布局（五座都算占用）上逐个检查 `canPlace`，不合法或重复格子的跳过。

## 建筑（`BUILDINGS`，原 5 个保持原字段原数值，新增 `size/pop/coastal` 字段）

原有 5 个：`size:2, pop:0, coastal:false`。

新增（顺序如下追加到数组末尾）：

| id | name | icon | resource | rate | cost | size | pop | coastal | color | desc |
|---|---|---|---|---|---|---|---|---|---|---|
| dock | 渔人码头 | anchor | food | 14 | wood 120, stone 40, food 20 | 2 | 4 | true | #5f9ec2 | 清晨出海，傍晚带回整片海的味道。 |
| bakery | 麦香面包坊 | croissant | food | 12 | wood 110, stone 70, food 40 | 2 | 5 | false | #d69a5b | 烤炉一直暖着，等每一个晚归的人。 |
| kiln | 陶土窑 | flame | stone | 16 | wood 140, stone 60, food 30 | 2 | 5 | false | #c27a5a | 火候到了，泥土也会变得坚硬。 |
| lumber | 林场木屋 | trees | wood | 24 | wood 90, stone 90, food 40 | 2 | 6 | false | #6f8f5a | 种一棵树，砍一棵树，森林一直都在。 |
| teahouse | 溪畔茶屋 | coffee | stars | 3 | wood 160, stone 90, food 60 | 2 | 7 | false | #8fb39a | 慢慢喝完一杯茶，心事也就落了地。 |
| lighthouse | 海角灯塔 | tower-control | stars | 6 | wood 200, stone 260, food 70 | 1 | 9 | true | #e07a5f | 替所有夜航的人，点一盏不灭的灯。 |
| library | 星辉图书馆 | library | stars | 7 | wood 300, stone 240, food 90 | 3 | 10 | false | #7d86c9 | 每本书都是一扇窗，通向更大的世界。 |
| clocktower | 时光钟楼 | clock | stars | 9 | wood 360, stone 360, food 120 | 2 | 14 | false | #c9a45c | 钟声响起时，所有的努力都被记住。 |

升级规则与费用公式不变（`ceil(cost*1.65^level)`，最高 Lv.5）。

## 装饰（`DECOR`，可多次放置，1×1，拆除不返还资源）

`place`：`land`=陆地非水；`pond`=只能在 `w` 格；`sea`=只能在与陆地四邻相接的 `.` 格且不在最外圈。

| id | name | icon | cost | place | 备注 |
|---|---|---|---|---|---|
| pine | 松树 | tree-pine | wood 6 | land | |
| oak | 圆冠树 | tree-deciduous | wood 6 | land | |
| blossom | 樱花树 | flower-2 | wood 8, food 4 | land | |
| palm | 椰子树 | tree-palm | wood 8 | land | |
| bush | 灌木丛 | shrub | food 3 | land | |
| flowerbed | 花圃 | flower | wood 2, food 5 | land | |
| rock | 景观石 | mountain | stone 5 | land | |
| fence | 木栅栏 | fence | wood 3 | land | |
| lamp | 路灯 | lamp-floor | wood 4, stone 4 | land | |
| bench | 长椅 | armchair | wood 8 | land | |
| well | 水井 | droplets | wood 6, stone 14 | land | |
| scarecrow | 稻草人 | bird | wood 4, food 4 | land | |
| banner | 彩旗 | flag | wood 4, food 2 | land | |
| stonelantern | 石灯笼 | flame | stone 10 | land | |
| campfire | 篝火 | flame-kindling | wood 10 | land | |
| tent | 帐篷 | tent | wood 6, food 6 | land | |
| bridge | 木桥 | waves | wood 10 | pond | |
| boat | 小帆船 | sailboat | wood 20 | sea | |
| statue | 星辉雕像 | star | stone 30, stars 20 | land | |
| display | 奇物展台 | gem | stone 12, stars 10 | land | 需要 `item`：已拥有的收藏品 id |

## 收藏品（`COLLECTIONS` 追加，原 8 个不变）

| id | name | rarity | icon | text |
|---|---|---|---|---|
| acorn | 橡果风铃 | common | nut | 风经过的时候，会轻轻叫你的名字。 |
| shell | 潮声海螺 | common | shell | 贴在耳边，是一整个夏天的潮汐。 |
| teacup | 午后茶杯 | common | coffee | 杯底总留着一点刚刚好的温度。 |
| lantern | 萤火提灯 | rare | lamp | 装着一百只萤火虫借来的光。 |
| hourglass | 星沙漏 | rare | hourglass | 每一粒落下的星沙，都是你专注过的一分钟。 |
| scroll | 旧地图卷 | rare | map | 地图边缘写着：此处尚待你去发现。 |
| globe | 天球仪 | epic | orbit | 把整片夜空，放在掌心慢慢转动。 |
| koi | 锦鲤风灯 | epic | fish | 逆流而上的鱼，终会游进星海。 |
| bonsai | 时光古树 | legendary | trees | 一年长一圈，一页书长一片叶。 |
| phoenix | 不熄之羽 | legendary | flame | 燃尽之后，又一次从灰烬里亮起来。 |

## 存档 v2

```js
{version:2, createdAt, lastAccrual, resources, pending, sessions, collection, draws, pity, timer, // 与 v1 相同
 buildings:{<13 个 id>: 0..5},
 layout:{<已建成建筑 id>:{x,z,r}},     // level>0 ⇔ 有 layout
 island:{terrain:string(784), height:string(784)},
 decor:[{id:/^[a-z0-9-]{1,40}$/, type, x, z, r, item?}]}  // ≤ 600 个，id 唯一
```

- `initialState(now)` 返回 v2：原有字段数值不变；`buildings` 包含 13 个 id（新的为 0）；`layout` 仅 cottage、sawmill；`island=defaultIsland()`；`decor=defaultDecor()`。
- `validateState(x)`：
  - `version===1`：按旧规则校验（建筑仅检查原 5 个）后调用 `migrate` 返回 v2。迁移：缺失建筑补 0、`layout` 取 `defaultLayout()` 中 level>0 的项、`island=defaultIsland()`、`decor=defaultDecor()`。其余字段原样保留（深拷贝）。
  - `version===2`：旧规则全部保留，额外校验：13 个建筑等级；layout 与 level>0 一一对应、坐标整数且占地在界内、r∈0..3；terrain/height 正则；海格高度必须为 0；decor 结构、类型存在、id 唯一、display 的 item 属于 COLLECTIONS；建筑与装饰的占地互不重叠。**不**重新校验地貌合法性（宽松，避免规则调整后读不了档）。
  - 其它版本：抛出原错误信息。
  - 返回深拷贝；对合法 v2 存档 `deepEqual(validateState(s), s)`。

## Core API（新增导出）

```js
GRID, TERRAIN, DECOR, defaultIsland(), defaultLayout(), defaultDecor(), migrate(v1)
tileIndex(x,z), inBounds(x,z), tileAt(s,x,z) -> {t,h}|null, isLand(t) // t!=='.'
landCount(s)                      // 非 '.' 格数
occupancy(s) -> Map(index -> key)  // key: 'b:<id>' | 'd:<uid>'
objectAt(s,x,z) -> key|null
buildingSize(id)
canPlace(s, kind, type, x, z, ignoreKey=null, item) -> {ok, reason}
   // kind 'building'|'decor'。building：全部占地是陆地且非 'w'、同高度、未被占用（忽略 ignoreKey）、
   //   coastal 时占地任一格两格范围内（切比雪夫距离 ≤2）有 '.'；decor 按 place 规则；不合法时 reason 为中文原因。
placeBuilding(s,id,x,z,r=0,now=Date.now())
   // level 0：顺序检查 满级/费用/人口(population(s)>=pop，否则 `需要 N 位居民`)/canPlace；accrue(s,now)；扣费；level=1；写 layout。返回 1。
   // level>0：免费移动（canPlace 忽略自身），返回当前等级。
rotateBuilding(s,id)               // 已建成：r=(r+1)%4
findSpot(s,id) -> {x,z}|null       // 从岛中心向外螺旋/按距离排序搜索第一个合法锚点
upgrade(s,id,now=Date.now(),spot)  // level>0 行为与旧版完全一致；level 0 时：满级→费用→人口检查后，
                                    // 有 spot 用 spot，否则 findSpot，找不到抛 '岛上没有合适的空地，请先开拓土地'
placeDecor(s,type,x,z,r=0,item)    // 费用、display 需拥有 item、上限 600、canPlace；扣费；push；返回新 id
moveDecor(s,uid,x,z) / rotateDecor(s,uid) / removeDecor(s,uid)
terrainCost(s,tool,x,z) -> cost 对象（可能为 {}）
editTerrain(s,tool,x,z)            // 合法性检查 → 扣费 → 修改；错误抛中文
TERRAIN_TOOLS                      // [{id,name,icon}] 顺序如下
```

地貌工具（id / name / icon / 规则 / 费用）：

| id | name | icon | 规则 | 费用 |
|---|---|---|---|---|
| reclaim | 填海造地 | land-plot | 目标为 `.`，不在最外圈（x,z∈1..26），四邻至少一格陆地；变为 `s` 高度 0 | n=max(0,landCount-初始岛陆地数)；stone 6+⌊n/12⌋, wood 4+⌊n/20⌋, food 2+⌊n/30⌋ |
| g | 草地 | sprout | 陆地、未占用、类型不同 | 免费 |
| s | 沙滩 | waves | 同上 | 免费 |
| f | 花甸 | flower | 同上 | food 2 |
| r | 岩地 | mountain | 同上 | stone 2 |
| p | 石径 | footprints（不存在则用 grid-3x3） | 同上 | stone 3 |
| w | 池塘 | droplets | 同上 | 免费 |
| raise | 抬升 | arrow-up | 陆地非 `w`？（`w` 也可抬升）、未占用、h<3 | stone 4*(h+1) |
| lower | 降低 | arrow-down | 陆地、未占用、h>0 | 免费 |
| sea | 还原为海 | eraser | 陆地、未占用、h===0 | 免费 |

（初始岛陆地数 = `defaultIsland()` 中非 `.` 格数，可在模块加载时计算常量 `BASE_LAND`。）

## Scene API（`dist/scene.js`，主会话实现）

```js
const village = createVillage(container, onSelect)  // onSelect(buildingId) —— 非建造模式下点击建筑（保留旧行为）
village.update(state)          // 状态变化时调用（内部按签名去重）
village.reset()                // 重置视角
village.setBuildMode(on)       // 建造模式：显示网格、单指拖动=旋转+俯仰、双指=缩放+平移，点击触发 onTile
village.onTile = info => {}    // 建造模式下点击：{x, z, tile:{t,h}|null, key:'b:id'|'d:uid'|null}
village.setTool(tool)          // null | {kind:'building',id,r} | {kind:'decor',type,r,item} | {kind:'terrain',tool} | {kind:'move',key,r}
village.setGhost(g)            // null | {x,z,valid}：在 (x,z) 显示当前 tool 的半透明预览，valid 决定绿/红
village.setSelection(key)      // 高亮选中物体，null 取消
```

## 收藏品 3D（`dist/items3d.js`，主会话实现）

```js
itemThumbnail(id) -> Promise<string>   // PNG dataURL（缓存）；失败 reject
mountItemViewer(el, id) -> {dispose()} // 在 el 中渲染可拖动旋转的 3D 模型
```

## UI（UI 代理）

见 UI 代理任务说明。
