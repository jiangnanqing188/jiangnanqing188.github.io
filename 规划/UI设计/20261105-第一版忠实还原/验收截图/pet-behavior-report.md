> **后续短标签build已完成有限复验并锁定。最终报告：`/tmp/innerpage-visual-20261105/final-text-lock/RESULT.md`。以下保留为重构建前9组行为与截图的历史记录。**

# 剩余内页与宠物流式工位定向复验（待短标签重构建锁定）

## 当前状态

- 上一锁定产物定向9组实测全部通过，24张截图均已实际逐张查看。不是全站验收，也不是像素完美证明。
- 用户随后通知 Epicurus 将工位文案从 `NOTEBOOK COMPANION / 纸边工位` 缩为 `COMPANION / 纸边工位` 并重构建；本报告当前不是此次短标签重构建的最终锁定记录。等待完成确认后只补拍关键工位、音乐、404，不重做已成立的动画行为。
- 只写 `/tmp`，没有构建、产品修改、安装依赖、提交、推送或部署；没有CUA或共享用户浏览器。
- 主线程报告的 fidelity8/8、静态63页2463链接、UI9、reading、cover、video 和 Epicurus check-pet28/28 为其他责任方结果，不冒领为本报告重跑。

## 环境与旧批次证据范围

- 浏览器：Playwright独立 Chromium，`/opt/google/chrome/chrome`；本地站点 `http://127.0.0.1:4176/`。
- 实测区间：2026-11-05T18:31:02.214Z — 2026-11-05T18:31:12.961Z。
- 桌面1440×1000；手机390×844触屏模拟，不是真机。截图前等待images decode与document.fonts.ready。
- 页面：`/2026/08/21/睿抗赛94分复盘/`、`/music/`、`/404.html`。QQ歌单通过真实点击打开外站；404三个出口分别真实到达。
- 默认context初始无宠物偏好；手动v2/quiet/hidden由真实菜单与CDP触摸创建，没有注入localStorage或测试CSS美化截图。

## 已成立的定向结果

1. **手机默认flow**：正文首区、表格、末尾和底部工位抽样不遮字，html/body宽均390。工位358×194.375px，宠物106×146px，正常相对定位。文案列190px与右侧宠物分开。
2. **交互**：实点菜单和“翻翻笔记”得到motion=read；CDP触摸拖出后真实dragging再fixed，v2 auto=false；实点reset回flow、auto=true且未主动跳滚动位置。动作触发后的截图因菜单焦点滚动仅见气泡，不冒称该帧完整展示所有动画。
3. **v2状态**：真实拖动后位置174/622与quiet在刷新后保留；hide刷新后stage隐藏、restore可见；restore恢复manual fixed且quiet不变。手动定位可能覆盖内容，属于用户主动选择，不算默认停靠缺陷。
4. **桌面净空**：reading x160,width1120，右界1280；pet fixed x1282,y798,size148×184，确实位于右侧净空。首区/表格/中段/末尾抽样不与main正文文字相交，html/body宽1440。不是全滚动像素穷尽证明。
5. **no-JS**：手机与桌面均有正常文档流工位和已解码原宠物图，真实占高度，不叠末段正文。仅证明静态显示/布局，不声称JS动作在无JS时可用。
6. **音乐**：1536×1024透明耳机笔记本生产插画，桌面565.72×377.14、手机300×200，contain完整显示；浅深均与工程手记字体、绿/橙细节、暖纸/深绿背景一致，不再仅换旧模板字色。页面无audio/video，不自动播放。
7. **真实歌单**：按钮原href为 `https://y.qq.com/n/ryqq/playlist/9545516252`，新弹窗真实到 `https://y.qq.com/n/ryqq_v2/playlist/9545516252` 并呈现hexo歌单与歌曲。未登录/播放/收藏/评论。popup响应监听晚于初始导航，responses为空，不据此捏造导航HTTP状态。手机同href/target核验，未重复外站点击。
8. **404**：1536×1024履带车绕路生产插画，桌面569.91×379.94、手机320×213.33，contain完整显示；浅深字图可读，与同一纸感设计一致。两个viewport均实点 `/`、`/archives/#search`、`/projects/` 并到达对应h1。
9. **资源真实性**：两新生产图实际200、decode成功，浏览器所取字节SHA与source/public一致；四份CSS/JS源码与public字节一致。

## 唯一非阻断观察（已转修，待新批次复验）

- 390px旧工位小标签末字“位”孤行，P3排版瑕疵，无正文遮挡。用户已安排缩短文案；旧24张截图保留为该批次证据，不冒用为修字后最终图。
- 菜单打开会正常浮层覆盖部分页尾，是主动交互态，不等同默认宠物遮字。

## 旧批次hash与文本调整关系

- 测试前后19个目标SHA256全相同，`changedTargets: []`，详细初末值见同目录 `result.json`。
- 文本调整到来后只读核对：宠物partial与三页public HTML的变化，均能在内存逆替换短标签后复得旧已验SHA；CSS/JS行为目标未变。这只是变动范围证据，不代替新build完成确认。
- 待新build确认完成后另存最终hash清单与新关键截图，保留本轮及之前失败证据。

## 24张实际查看截图清单（旧锁定产物）

- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/desktop-404-dark-full.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/desktop-404-light-full.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/desktop-music-dark-full.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/desktop-music-light-full.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/desktop-nojs-flow-bottom.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/desktop-reading-safe-fixed-end.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/desktop-reading-safe-fixed-table.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/desktop-reading-safe-fixed-top.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-404-dark-full.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-404-light-full.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-flow-dragged-out.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-flow-menu.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-flow-read-action.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-flow-reset.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-music-dark-full.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-music-light-full.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-nojs-flow-bottom.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-reading-bottom-flow.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-reading-default-table.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-reading-default-top.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-v2-hidden-reload.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-v2-manual-quiet-reload.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/mobile-v2-restored.png`
- 已实际查看：`/tmp/innerpage-visual-20261105/final-remaining/qq-playlist-live-popup.png`

## 直接证据文件

- 浏览器指标、9组断言与初末SHA：`/tmp/innerpage-visual-20261105/final-remaining/result.json`
- 本轮独立临时脚本：`/tmp/innerpage-visual-20261105/final-remaining/recheck.cjs`
- 前序阅读/资源/主题修后结果另见 `/tmp/innerpage-visual-20261105/recheck-three/RESULT.md`，本轮不重跑。
- 旧完整内页审查与历史问题见 `/tmp/innerpage-visual-20261105/REPORT.md`；不能把旧失败图当最终通过。
