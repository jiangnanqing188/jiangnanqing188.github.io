# 三项修后定向复验

- 时间：2026-11-05T17:38:38.771Z 至 2026-11-05T17:38:43.958Z。
- 范围：阅读页（含1120栏宽/大封面/手机横滚提示/目录）、资源5行表、主题切换。未重跑其它内页，没有把本次结论扩展为全站最终通过。
- 独立真实Chromium；桌面1440×1000、手机模拟390×844；普通偏好与reduce分别创建独立上下文。
- 只写/tmp。未clean/build，未改产品、既有检查器或依赖，未隐藏/拖动宠物，未手改localStorage，未注入任何临时CSS。主题使用真实按钮并核对实际颜色，而不是只看dataset。
- 7/7组定向验证通过，14张修后截图逐张view_image实际查看。首轮临时断言误要求提示含“横向滚动”，产品实际使用等价“可左右滑动”；仅修正/tmp脚本语义匹配后重跑，初轮原始结果保存在initial-assertion-result.json，不是产品缺陷。
- 测试前后五个目标文件字节SHA一致：True；hash详见result.json。未对其它63页做hash结论，等最终build通知。

## 阅读页通过

URL：`http://127.0.0.1:4176/2026/08/21/睿抗赛94分复盘/`

- 桌面`.reading-layout`实际宽1120，居中x160，列`840px 240px`，gap40px。
- `.prose`实际宽840、字体20px，约42.00汉字/行；原53.6字/行问题已解决。
- 封面628.58×353.56px，使用原有文章封面，真实解码；标题/插画接近左右均分而非260px邮票，实际图已看。
- 手机`.toc`实际position=`static`，滚至方案表时不再浮动盖表头；“↔ 可左右滑动，查看表格其余列”实际可见；真实横向滚动后“最终决定”列可看，整页没有横溢。
- 图片：desktop-reading-header.png、desktop-reading-prose.png、mobile-reading-header.png、mobile-reading-table-start/end.png。
- 原文前部自动摘要/验证信息仍较多，本轮仅确认授权修复的宽度/主视觉/表格/TOC，不宣称原文内容被删减或全部密度优化完成。

## 资源页通过

URL：`http://127.0.0.1:4176/downloads/`

- 真实table，6列：编号、资源文件/项目、来源文章、文件路径/地址、用途、获取；tbody恰好5行、编号01–05。不是旧大间距资源card换色。
- 四本地文件分别HTTP200且非空，来源文章/用途/实际路径可读；第五行保留真实公开仓库外链，未访问或改动该仓库。
- 桌面5行紧凑呈现，手机table容器358px、内部880px，左右滑动提示可见；鼠标横向输入实测scrollLeft到522px，右侧用途/获取列可读；整页无横溢。
- 图片：desktop-resources-full.png、mobile-resources-full.png、mobile-resources-table-end.png。

## 主题通过（无诊断CSS）

- desktop-reduce、desktop-normal、mobile-reduce三组均真实单击浅→深，点击后立即读取、等两帧、刷新保持、再点深→浅。
- reduce实际transition-duration=0s，已不再出现1e-05s伪禁用过渡。
- 立即深色body背景rgb(22,30,26)、正文/品牌/非激活nav/结果链接/项目标题为rgb(238,233,220)，summary为rgb(179,198,179)；root变量与body/section真实值一致，webkitTextFillColor一致。
- 稳定及刷新画面均实际看过，未复现先前浅底/黑字中间态；反向切换立即恢复纸色rgb(247,242,232)、墨色rgb(32,35,29)。未改浅色布局/palette。
- 图片：desktop-reduce-theme-dark-immediate/reload.png、desktop-normal-theme-dark-immediate/reload.png、mobile-reduce-theme-dark-immediate/reload.png。

## 待后续

- 宠物流式工位/侧边fixed/手动v2位置/动画的遮挡与交互验收另批进行，本轮未对其作通过结论。截图中宠物保留真实状态。
- 音乐/404插画已收到build信息，本轮没有重截图或扩充验证结论。
- 未变页面hash与最终build发布门禁等待主线程通知。
