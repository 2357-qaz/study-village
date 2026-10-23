# 学习伙伴 V6 · 独立模型资产归档

2026-10-23 保存的结构优化版。**仅作资产保留；不替换线上计时页，不改动 dist，也不包含完整应用集成补丁。**

## 内容与使用
- `output/study-companion.blend.gz`：无损压缩的可编辑 Blender 场景（含不同姿态部件及展示设置）。
- `output/study-companion.glb`：通用 glTF 二进制导出，供查看/导入；不是完整应用场景或骨骼动画包。
- `output/companion-stylized.bin` + `.json`：配套运行时压缩网格及描述；必须成对使用。13 个刚性部件，read/turn/look/tea 四种姿态，非全身蒙皮骨架。
- `src/`：完整程序化建模、展示渲染及验证脚本；`approved-v5-protected.json` 为头部/发型/比例保护基准。
- `output/*validation.json`：最终构建时的结构、左右手与 V5 保护验证记录。
- `ART-NOTES.md`：设计、参考出处、结构说明与已知限制。
- `manifest.json` / `SHA256SUMS`：来源、构建说明与逐文件校验。

先运行 `gzip -dk output/study-companion.blend.gz` 解压为 `.blend` 后用 Blender 打开；压缩用于适配上传大小限制，解压后与原始可编辑文件逐字节相同，原始 SHA 见 manifest。

### 重建（Blender 4.3.2，Python 标准库）
在本目录执行；建议先复制到临时目录，避免覆盖归档原件：

```sh
blender --background --factory-startup --python src/build_companion.py
blender --background --factory-startup --python src/validate_structure.py
python3 src/validate_protected.py
```

源码从空场景生成全部几何，不需要外部模型或贴图。可用 `-- --output-dir /absolute/output` 改变构建输出目录（验证脚本默认读取本目录 output）。重建具有程序可复现性，但不同 Blender 版本/平台的浮点、几何运算及文件元数据可能导致二进制哈希不同。

**不要从展示用 .blend 的隐藏姿态状态局部重导出运行时数据。** 正式导出须完整运行构建脚本，否则可能漏部件或破坏左右手镜像。

### 运行时格式
Y 轴向上，+Z 向前，部件局部原点沿用 study-village。JSON 的 pos/nrm/mat/idx 是 BIN 字节偏移：位置为 int16（通过 lo/hi 反量化），法线 int8/127，材质为 uint8 palette 索引，索引依 wide 为 uint32 或 uint16；可选 col 为 sRGB uint8 顶点色。精确字段、部件名、数量与比例见 JSON。现有线上加载器不会因本次归档自动切换；集成时需单独适配部件、材质、姿态/书本锚点并验证。

## 授权与来源
本目录原创程序化建模源码与生成资产随仓库根目录 Apache-2.0 LICENSE 分发。第三方人体/服装资料仅供观察学习；未复制、导入或随包分发第三方网格、绑定或脚本。具体参考链接和 Human Base Meshes 历史授权文字歧义见 ART-NOTES.md；不将参考资料重新授予 Apache-2.0。

## 已知边界
保留 V5 脸、头发、配色与长腿/小头比例；V6 改善肩袖连接、空心袖口、手掌与虎口，以及坐姿裙下腿部体积。衣服近看仍可见低多边形的大块平面，不是高精度雕刻。坐垫处约 1.9 cm 隐蔽软垫重叠，不是零穿插物理求解。没有真机帧率保证。应用中四姿态含道具约 13.1–13.5 万可见三角形；这里不包含应用场景和集成测试。
