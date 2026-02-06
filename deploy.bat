@echo off
echo [INFO] 开始清理缓存...
call hexo clean

echo [INFO] 开始生成静态文件...
call hexo g

echo [INFO] 开始部署到网站...
call hexo d

echo [INFO] 开始备份源码到 GitHub...
git add .
git commit -m "Site Update: %date% %time%"
git push origin main

echo [SUCCESS] 恭喜！部署与备份已完成。
pause