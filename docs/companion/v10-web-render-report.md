# V10 网页实际渲染核验

## 本次实际结果（2026-10-24 05:57 UTC）

在重新启动的云端桌面 Chrome 中，通过普通 HTTP 服务打开完整 V10 运行包：

```sh
python3 -m http.server 4174 --bind 127.0.0.1 --directory dist
```

访问 `http://127.0.0.1:4174/?companion=v10&hour=16#focus`，跳过引导后，计时页、25:00、专注/休息切换及按钮正常显示。**房间与人物没有渲染，因此本次不构成 V10 模型网页视觉验收通过，也没有可交付的实际模型网页截图。**

浏览器控制台实际错误：

```text
THREE.WebGLRenderer: A WebGL context could not be created.
GL_VENDOR = Disabled, GL_RENDERER = Disabled, Sandboxed = yes
ErrorMessage = BindToCurrentSequence failed
THREE.WebGLRenderer: Error creating WebGL context.
```

服务端访问日志另外确认 `assets/companion-v10.json?v=7` 与 `assets/companion-v10.bin?v=7` 均返回 HTTP 200，排除这两项模型资产 404。测试结束已以 Ctrl+C 停止临时服务并确认退出。

服务目录为恢复后逐文件校验的 `v10-recover/extracted/dist`，不是 Blender 预览。阻塞发生在 WebGL 上下文创建阶段；不能由此判断模型在正常 WebGL 浏览器中的视觉效果或性能。不更改浏览器安全开关，不关闭沙箱，未调用用户离线电脑。

## 可用正常 WebGL 浏览器后的人工验收

1. 在包含 V10 资产的仓库根目录运行上面的 Python 命令，保持终端运行。
2. 用支持 WebGL 的 Chrome/Edge 打开上述 URL；使用独立测试浏览器档案，避免影响真实学习记录。
3. 跳过首次故事，打开计时页面。开发者工具 Network 中确认 `assets/companion-v10.json` 与 `.bin` 成功返回；Console 不应出现 WebGL 创建失败。
4. 检查阅读状态：完整房间和人物可见；耳后原长发应贴耳侧向下弯曲，不能是追加的短条；脸部比例与 V10 预览一致。检查书、手、椅子遮挡及肩袖连接，保留已知茶姿肩袖接缝作为待检查项。
5. 点击「开始专注」。实际计时完成但尚未打卡时切换为倒茶姿态（源码 `dist/ui/reading.js` 的 `poseNow`）；「好好休息」选项本身不是保证进入倒茶的条件。
6. 各保存阅读/倒茶截图，至少桌面 1280×860 和手机竖屏各一组。记录浏览器版本、视口、设备像素比、缩放和渲染器；检查耳侧、下巴、头发层次、手指/茶壶/茶杯对齐以及 UI 是否遮住角色。
7. 退出/重进计时界面并调整窗口，确认没有空白、明显闪烁或 WebGL 错误。仅正常 GPU 设备测试才可讨论硬件帧率或耗电。

## 自动化测试入口（尚未在本次云端运行通过）

仓库已有 `tests/e2e/companion-v10.spec.mjs`：检查 WebGL2、V10 资产成功响应、房间 ready、人物非透明像素、manifest 版本、计时完成后的姿态切换，并保存 `v10-timer-reading.png` / `v10-timer-tea.png`。使用隔离测试上下文与固定测试时钟，不必真实等 25 分钟。

在具备合适测试环境和依赖的机器上，测试入口为：

```sh
npm ci
npx playwright install chromium
npm run test:e2e -- tests/e2e/companion-v10.spec.mjs --project=desktop --workers=1
npm run test:e2e -- tests/e2e/companion-v10.spec.mjs --project=phone --workers=1
```

**配置注意：**当前仓库 `playwright.config.mjs` 显式使用 SwiftShader，并包含 `--enable-unsafe-swiftshader`。本次没有运行或新增这些标志。上面的命令不是本环境绕过限制的方案；执行前应在有授权的隔离 CI 中审查现有配置，或在正常 GPU 测试配置中去掉整段 `launchOptions`，保留沙箱、使用浏览器默认图形后端。不要为通过测试使用 `--no-sandbox` 或修改系统安全策略。

软件 WebGL 截图可以证明页面渲染链路运行，但不等于 GPU 性能验收；非透明像素断言也不能替代人工审美与穿模检查。截图存在且经人工核验后才能声称视觉测试通过。
