# 最终定向验收：短标签、纸边工位、音乐与404

## 结论

**本轮有限补拍通过，未发现这次授权范围内的视觉阻断项。** 工位标签孤字换行已消除；上一轮9组行为与可达性结论继续成立，未重复运行动画行为。
本报告不是全站重新验收，也不是自动证明像素完美。主线程负责的63页、静态链接、fidelity和媒体检查不计为本轮执行结果。

## 执行与边界

- 门禁：用户转述Epicurus标签build成功后才执行；复核用户提供的partial和资源HTML完整SHA完全一致。没有自行build。
- 捕获区间：`2026-11-05T19:02:35.725Z` — `2026-11-05T19:02:38.582Z`。
- 最终锁定时间：`2026-11-05T19:08:21.419308+00:00`。
- 独立Playwright/Chromium软件测试上下文，Chrome `/opt/google/chrome/chrome`；没有使用CUA或共享用户浏览器。
- 视口：桌面1440×1000、手机390×844，deviceScaleFactor=1；手机为触屏模拟，不是真机。
- 共6个独立上下文、10张新截图；每张已实际使用view_image查看。等待document.fonts.ready与所有页面图片decode后拍摄。
- 初始偏好未注入或修改localStorage；未隐藏宠物、未注入诊断/美化CSS。深色通过真实主题按钮切换，核对body实际背景和文字颜色已变化。
- 本轮只新增/tmp中的临时脚本、截图、指标与报告；没有改产品或现有检查器，没有安装、提交、推送、部署。

## 实际页面与结果

| 目标 | URL | 视口与画面 | 结果 |
| --- | --- | --- | --- |
| 阅读页工位，有JS | http://127.0.0.1:4176/2026/08/21/睿抗赛94分复盘/ | 390×844，末尾工位 | 短标签真实一行；正常flow独占高度；宠物可见；与正文、文案区不重叠；宽390无横溢 |
| 阅读页工位，无JS | 同上 | 390×844，末尾工位 | 短标签真实一行；原HTML流式工位和原宠物图可见，不挡末段正文；不声称JS动作无JS可用 |
| 音乐 | http://127.0.0.1:4176/music/ | 1440×1000、390×844，浅/深各一张全页 | 耳机/笔记本完整显示，纸感衬线与绿橙细节一致，未退回旧模板；短标签单行、无横溢 |
| 404 | http://127.0.0.1:4176/404.html | 1440×1000、390×844，浅/深各一张全页 | 履带机器人/路线完整显示，标题、三个出口与新工位无截断，深色可读，短标签单行、无横溢 |

### 关键实测尺寸/颜色

- `mobile-flow`：label `COMPANION / 纸边工位`，实际行数1；工位358.000×179.000px，宠物106×146px，position=relative；html/body宽390/390px。
- `mobile-nojs-flow`：label `COMPANION / 纸边工位`，实际行数1；工位358.000×179.000px，宠物106×146px，position=relative；html/body宽390/390px。
- `desktop-music`：图像565.72×377.14px，原图1536×1024、object-fit=contain；body浅色背景`rgb(247, 242, 232)`/字色`rgb(32, 35, 29)`，深色背景`rgb(22, 30, 26)`/字色`rgb(238, 233, 220)`。
- `desktop-404`：图像569.91×379.94px，原图1536×1024、object-fit=contain；body浅色背景`rgb(247, 242, 232)`/字色`rgb(32, 35, 29)`，深色背景`rgb(22, 30, 26)`/字色`rgb(238, 233, 220)`。
- `mobile-music`：图像300.00×200.00px，原图1536×1024、object-fit=contain；body浅色背景`rgb(247, 242, 232)`/字色`rgb(32, 35, 29)`，深色背景`rgb(22, 30, 26)`/字色`rgb(238, 233, 220)`。
- `mobile-404`：图像320.00×213.33px，原图1536×1024、object-fit=contain；body浅色背景`rgb(247, 242, 232)`/字色`rgb(32, 35, 29)`，深色背景`rgb(22, 30, 26)`/字色`rgb(238, 233, 220)`。

### 生产图片真实性

- `/img/fieldnotes/music-notebook-4cdbbe9341.webp`：实际200、成功decode；请求字节与source/public SHA一致。
- `/img/fieldnotes/detour-notebook-13bcf3e306.webp`：实际200、成功decode；请求字节与source/public SHA一致。
- 浏览器所取三页HTML字节SHA分别与锁定public文件一致，避免“截图读了另一个旧预览”的假通过。

## 行为结论为何保留，而非重跑

- 与上一轮已验9组的19个目标对比，仅4个目标发生变化：宠物partial、阅读页HTML、音乐HTML、404 HTML。四者均在内存将短标签逆替换为旧长标签后，精确恢复上一轮完整SHA。
- pet.js/notebook.js/pet.css/notebook.css源码与产物均同上一轮逐字节一致。其余旧目标hash也不变。资源HTML另以用户给定SHA核对，未对资源页进行重复视觉/行为测试。
- 因此保留上一轮已实测的菜单/翻笔记/触屏拖出/reset、v2手动位置/quiet/hidden刷新恢复、1440阅读侧边安全fixed、无JS flow、真实QQ歌单弹窗及404三个实际出口的结论。
- 本轮没有重跑这些动作，不能把它写成新动画回归或新的外站可用性探测。真实歌单旧证据：`/tmp/innerpage-visual-20261105/final-remaining/qq-playlist-live-popup.png`。

## Hash锁定

- 共20个明确目标：拍摄前、拍摄后、逐张人工查看后均完全一致；`changedDuringCapture: []`。不是63页全站hash锁。
- partial：`dc91325a46a014028642d3eed4a1136dc6976d6c764e335a6b234cb92303e31c`（与用户给定一致）。
- 资源HTML：`2d68f3619cac4d2f6c225f26301a5f969fade8d61f65aa177f246ca078653b14`（与用户给定一致）。
- 20目标清单的规范化JSON SHA256：`edc79601980140ff2729ae6747d7931cd77105e7ce1fba2b5b996d92ffddb41a`。
- 完整前后值：`/tmp/innerpage-visual-20261105/final-text-lock/result.json`。
- 查看后最终锁：`/tmp/innerpage-visual-20261105/final-text-lock/hash-lock.json`。
- 目标与10截图逐文件校验清单：`/tmp/innerpage-visual-20261105/final-text-lock/SHA256SUMS.txt`。

## 最终10张截图（已逐张查看）

- `/tmp/innerpage-visual-20261105/final-text-lock/mobile-reading-flow-short-label.png`
- `/tmp/innerpage-visual-20261105/final-text-lock/mobile-reading-nojs-flow-short-label.png`
- `/tmp/innerpage-visual-20261105/final-text-lock/desktop-music-light-full.png`
- `/tmp/innerpage-visual-20261105/final-text-lock/desktop-music-dark-full.png`
- `/tmp/innerpage-visual-20261105/final-text-lock/desktop-404-light-full.png`
- `/tmp/innerpage-visual-20261105/final-text-lock/desktop-404-dark-full.png`
- `/tmp/innerpage-visual-20261105/final-text-lock/mobile-music-light-full.png`
- `/tmp/innerpage-visual-20261105/final-text-lock/mobile-music-dark-full.png`
- `/tmp/innerpage-visual-20261105/final-text-lock/mobile-404-light-full.png`
- `/tmp/innerpage-visual-20261105/final-text-lock/mobile-404-dark-full.png`

## 留存与限制

- 旧批次24张截图及9组结果仍保留在 `/tmp/innerpage-visual-20261105/final-remaining/`；带长标签的旧图不是修字后最终图。
- 先前主题/阅读宽度/资源表修后证据见 `/tmp/innerpage-visual-20261105/recheck-three/RESULT.md`；历史失败和根因见 `/tmp/innerpage-visual-20261105/REPORT.md`。未删除或覆写失败截图。
- 本轮本地生成产物软件浏览器验收，不等于已部署、线上缓存已刷新或真机实测。
