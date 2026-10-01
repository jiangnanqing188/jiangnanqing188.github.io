# 江南的碎碎念

Hexo 源码位于 `master`。2026-10-01 已将确认的暗色多页 UI、五张主题封面和 Q 版猫娘接入本地源码。当前主题为本仓库内的 `notebook`；2026-10-01 已按用户要求发布到 GitHub Pages；页面发布提交为 `6f1011e`，上线验证见当天工作记录。

## 当前入口与事实来源

| 文件 / 目录 | 用途 |
| --- | --- |
| `_config.yml` | 站点地址、永久链接、生成与部署配置；当前 `theme: notebook` |
| `themes/notebook/layout/` | 正式页面布局、主导航、页脚和猫娘共享控件 |
| `themes/notebook/scripts/view.js` | 页面视图、四份项目详情生成、封面映射、页面分享元数据 |
| `themes/notebook/source/css/` | 正式公共样式和宠物样式 |
| `themes/notebook/source/js/` | 搜索、文章目录、代码复制、评论加载和宠物交互 |
| `themes/notebook/_config.yml` | 沿用的 Giscus 公共设置；仍按原文章 pathname 对应讨论 |
| `scripts/lab-site.js` | 结构化数据、复现与验证卡、下载资源卡、旧地址跳转；旧主题 UI 注入仅在旧主题下运行 |
| `source/_posts/` | 文章内容与元数据，八篇正文和原地址保留 |
| `source/_data/` | 首页信息、项目档案、奖项和能力数据；四份项目详情读取同一份 `projects.yml` |
| `source/about/index.md` | 关于页正文；奖项占位符由当前主题读取 `achievements.yml` 渲染 |
| `source/img/covers/notebook/` | 五张已确认的 AI 概念封面；旧封面保留在原路径 |
| `source/img/pet/catgirl.webp` | 已确认的 Q 版透明立绘；生成来源与提示词记录在原型素材说明中 |
| `scripts/check-site.cjs` | 检查生成页面的链接、锚点、图片、分享元数据及重复 ID |
| `规划/原型/` | 此次确认的设计快照，作为视觉参考，不参与正式构建 |

正式入口为 `/`、`/projects/`、`/archives/`、`/about/`。四份项目详情为 `/projects/ruikang/`、`pharmacy/`、`yolov5/`、`iscc/`。原文章、分类、标签、资源、音乐及旧跳转地址继续可用。

## 本地生成与检查

```bash
npm run build
npm run check:site
python3 -m http.server 4175 --bind 127.0.0.1 --directory public
```

浏览器访问 `http://localhost:4175/`。模板、过滤器或主题切换后，建议先运行 `npm run clean`，再构建和检查，避免 Hexo 缓存保留旧主题资源。`public/` 与 `db.json` 是构建产物，不直接编辑或提交。

正文搜索读取现有 `search.xml`；分类、标签和文章目录使用正式链接。评论通过“加载评论”按需连接原 Giscus 仓库，原 pathname 映射及管理入口保留。此次没有新增依赖。

## 猫娘与封面

猫娘可点击打招呼、鼠标或触摸拖动、收起和叫回，支持键盘移动和减少动画偏好。当前是单张 Q 版立绘配合轻微整体动画，并非 Live2D。位置和收起状态保存在当前浏览器的 `jiangnan-blog-pet-v1`，台词为本地预设，不接入聊天服务。

五张新封面是 AI 概念插画，用于主题表达；页面已标注，不作为现场照片或工程证据。成长文章的真实团队合影保持原图，原封面与文章图片均保留。图像工具未返回可核验的模型和质量档位，不宣称锁定 Image 2.5 high。

## 回退与发布

本次实装为独立本地提交，可整体回退以恢复此前主题和关于页。已有未提交的奖项、项目、文章及规划内容不纳入本次提交。

`_config.anzhiyu.yml`、`source/css/custom.css` 和原主题适配代码保留作为原主题恢复来源，当前页面不加载旧主题样式。恢复主题时需重新生成页面。未经明确要求，不执行 `npm run deploy` 或 `git push`。
