var posts=["2026/07/24/AI使用感受/","2026/01/28/ISCC微型工厂模拟赛道经验分享/","2026/01/29/YOLOv5模型训练/","2025/07/27/py学习笔记/","2026/07/23/智慧药房机器人比赛参赛复盘/","2026/02/04/算法学习/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };