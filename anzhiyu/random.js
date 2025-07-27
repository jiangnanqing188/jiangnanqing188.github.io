var posts=["2025/07/26/hello-world/","2025/07/26/test/","2025/07/27/py学习笔记/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };