# V10 加载、缓存与手机端资源审查（2026-10-25）

审查基线：main `a70f975e5820ab818b8deee47d769fb6505352d5`，V10 预览 `10d1520d7ba9b61e2d90c1bd0e67482a7de4b499`。改动基于 V10 预览，在独立优化分支提交；默认仍使用旧模型，没有修改生产部署工作流或 main。

结论：存在无需减面即可兑现的传输、解码和回退优化。没有真实 iPhone 的 Safari 耗时、峰值内存、卡顿和温升数据，不能据此判定 V10 性能不合格，也不能声称手机性能验收通过。

## 定量对比

下表字节是文件或 TypedArray backing store 计数，MB 为十进制；不是浏览器进程 RSS、实测 VRAM 或线上 transferSize。只计雕刻部件，不包含书、眼镜等程序生成道具、房间、材质、阴影、图片字符串、解压临时缓冲和帧缓冲。

| 项目 | main 旧模型 | V10 优化前 | 本分支 V10 |
| --- | ---: | ---: | ---: |
| 原始二进制字节 | 1,134,116 | 12,530,916 | 12,530,916（未改） |
| 本分支选择的传输载荷字节 | 1,134,116 | 12,530,916 | 5,908,689 gzip；不支持时回退原始文件 |
| 所有姿态资源顶点合计 | 50,957 | 362,342 | 362,342 |
| 所有姿态资源三角形合计 | 104,082 | 705,560 | 705,560 |
| 所有部件解码后的 CPU backing stores | 2,968,568 | 25,575,228 | 21,227,124 |
| 首次仅解码 read 的 CPU backing stores | 原加载器一次解码全部 | 原加载器一次解码全部 | 15,062,028 |
| 所有部件都被用过时的 GPU 属性字节 | 2,458,944 | 20,864,736 | 17,603,658 |
| read 的 GPU 属性字节 | 950,676 | 5,912,916 | 4,963,749 |

V10 固定 gzip 文件比原始二进制小 **52.85%**。首次仅解码 read 的模型 CPU backing stores 比原来的全量解码少 **41.1%**；走遍全部姿态后仍少 **17.0%**。全部 GPU 属性字节少 **15.6%**。旧模型也可使用本分支的惰性解码和紧凑法线，原始文件保持不变。

gzip 是应用加载的独立静态文件，不依赖 GitHub Pages 为 `.bin` 配置压缩。原部署也可能有 HTTP 压缩/缓存，本审查未测现网响应头，所以不把 52.85% 直接称为实测网络时间提升。单次模型请求的纯传输理论值在 10 Mbit/s 时为 10.02 → 4.73 秒，在 50 Mbit/s 时为 2.00 → 0.95 秒；均不含延迟、缓存、解压、解码和绘制。

| 单姿态（仅模型，单次提交） | main 顶点 / 三角形 | V10 顶点 / 三角形 |
| --- | ---: | ---: |
| read 阅读 | 19,738 / 40,018 | 105,463 / 204,278 |
| turn 翻页 | 19,876 / 40,292 | 106,150 / 205,652 |
| look 抬头 | 19,680 / 40,030 | 106,108 / 205,508 |
| tea 倒茶 | 20,795 / 42,176 | 105,317 / 203,114 |

每种姿态使用 5 个共享雕刻部件。`turn` 在现有产品里表示翻页，不是新增的全身转身动画。阴影 pass 会增加实际提交；表中不是整场景 renderer.info.render.triangles。

完整逐部件结果及 SHA-256 见 [v10-resource-audit.json](v10-resource-audit.json)。重算：

```sh
node tools/audit-companion.mjs > docs/companion/v10-resource-audit.json
node tools/compress-companion.mjs
node --test tests/companion-v10.test.mjs tests/companion-loading.test.mjs tests/companion-cache.test.mjs
```

## 实际加载与复用

原链路：`app.js → ui/reading.js → 动态 import reading-room.js → loadCompanion → loadSculpt`。旧 `paintRoom` 仅检查尺寸，因此滑动页中具有尺寸但不在前台的计时页也可能启动加载；模型请求还会在 WebGL 初始化前启动。manifest 和完整 `.bin` 并发下载，一次性展开全部 13 个部件的 position、normal、color。四种姿态使用不同 upper/hands，头、头发和下半身按引用共享，`LiveSink` 新建 Mesh 时不克隆 BufferGeometry。

本分支仅在可见计时页启动房间和人物；WebGL 初始化失败时不再发出模型下载。V10 读取 manifest 后优先下载 gzip，解压成功且长度正确后使用；gzip 不可用时尝试未压缩 V10，再失败则尝试旧模型，最后才用现有程序生成角色。单次 fetch 及响应读取有 30 秒超时，失败 Promise 从去重缓存移除，后续显式重试仍可进行。多级失败耗时可以累加；这是可靠性上限，不是首屏性能承诺。

资源下载完成后，部件第一次被某个姿态访问时才解码，之后返回同一个 BufferGeometry。触屏或 save-data 环境停止后台预生成另外三种姿态，首次进入只生成当前姿态；桌面仍在 idle 时预热，离开计时页或后台隐藏时停止。触屏首次切到未生成姿态仍有同步绘制成本，这需要实机检查。此次没有按姿态拆分网络资源：完整压缩包及解压后的原始 buffer 仍需保留。按需指页面加载、部件解码及姿态图片生成。

源码原来已使用 Int8 法线，本分支直接用 normalized Int8 BufferAttribute 交给 GPU，不再展开成 Float32；测试验证全部来源法线在 -127…127，归一化值与原 n/127 相同。绘制颜色保持原 Float32 线性色彩值，以 256 项查表替换逐顶点 new Color。所有位置、颜色和索引逐元素与原资源解码结果核对，未改拓扑、头发、脸、腿、姿态和道具变换。

完全相同的量化位置、法线和可见颜色计数只找到 V10 448 个重复顶点（0.124%，大部分在 lowerStand），旧模型 3 个。未据此增加焊接或减面流程。四份 upper 各约 7.6 万顶点，包含随姿态制作的表面，不能仅凭名称相似视为相同网格；跨姿态的近似合并需要额外视觉容差验收，本次保留。

## 缓存与手机端余留风险

- 同一页面同一资源的请求 Promise 复用，几何引用复用，完整原始 buffer 仍被 index/normal 视图和未解码部件引用。
- Service Worker 原来对所有请求 network-first。新逻辑只对带内容散列的 `companion-v10.<hash>.bin.gz` cache-first；命中时不启动网络请求。manifest、JS 和普通模型仍 network-first，查询版本继续参与缓存键。缓存不可读、不可写时不阻断在线请求；不能保证浏览器永久保留离线数据。
- 内容变化生成新的文件名，旧标签页仍可请求旧文件。旧散列文件暂不自动清理，未来多版本发布应管理这类缓存空间。首次未受 SW 控制的访问仍依赖正常 HTTP 缓存；gzip 失败回退原始文件属于额外请求。
- 人物被渲染成透明 PNG，与房间 JPEG 叠加、交叉淡入；没有持续每帧绘制 70.6 万三角形。主要重活发生在首次进入、首次姿态、尺寸/天气/日夜改变后重新生成图片。
- 共有最多 7 个场景/姿态 data URL 缓存。DPR 上限为 2；像素数仍是 CSS 面积的 4 倍。toDataURL 编码、图片解码、抗锯齿/保留绘图缓冲、1024² 方向光阴影与 512² 点光阴影，可能比纯网格更主导峰值内存及暂停。7 条缓存不等于 7 张全尺寸解码图片同时常驻。
- 此次不减低 DPR、阴影或模型质量。也不添加未经实机数据支持的设备分档、强制低模或 Web Worker 重构。

## 验证与证据边界

本地 19 项相关 Node 检查通过：原/新模型四姿态装配、gzip 逐字节往返、全部顶点和三角形一致、惰性解码与共享、损坏/缺失/不支持解压回退、旧模型优先回退、并发去重、失败后重试、超时和 SW 缓存失败路径。它们不等同网页视觉或 iPhone 性能测试。

原报告之后，预览分支 `10d1520` 的 [GitHub Actions #38](https://github.com/2357-qaz/study-village/actions/runs/40071632435) 已成功（2026-10-24 06:55 UTC），artifact `companion-v10-webgl-evidence` / ID `12551158873` 中存在 desktop/phone 的阅读和倒茶网页截图。已下载并检查，人物确实在实际网页房间里，不是 Blender 预览。其配置为 Chromium + SwiftShader；phone 是 iPhone 13 尺寸模拟，仍不是 Safari 或真 iPhone。旧报告中“当次云端浏览器失败”的记录仍然成立，但不能再把它扩展成“仓库从未产出网页截图”。

本次交互浏览器无法连接执行容器的本地 HTTP 服务；文件协议也被浏览器策略阻止，没有绕过限制。新增 CI 沿用仓库已有的隔离 runner/浏览器配置，扩展为 read、look、turn、tea 四姿态，并导出当前模型、已解码部件、视口和 DPR 元数据。新代码的实际网页证据以本 PR 对应提交的 `companion-v10-webgl-evidence` 为准，不能用基线截图冒充优化后的截图。

真实设备验收仍保留：iPhone Safari 冷/热缓存的首次可见耗时、四姿态首次切换停顿、横竖屏反复切换的内存趋势和背景恢复；近距离检查耳侧发丝、脸/腿比例、倒茶肩袖接缝、抬头书与手的接触。这些项目未填入虚构的通过结论。

API 参考：[Three.js BufferAttribute normalized](https://threejs.org/docs/pages/BufferAttribute.html)、[DecompressionStream gzip](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream)。
