@echo off
:: 设置字符集，防止乱码
chcp 65001 >nul

echo [INFO] ==============================
echo [INFO] 1. 开始清理缓存 (Hexo Clean)
echo [INFO] ==============================
call hexo clean
if errorlevel 1 goto error

echo.
echo [INFO] ==============================
echo [INFO] 2. 开始生成网页 (Hexo Generate)
echo [INFO] ==============================
call hexo g
if errorlevel 1 goto error

echo.
echo [INFO] ==============================
echo [INFO] 3. 开始部署到 GitHub Pages
echo [INFO] ==============================
call hexo d
if errorlevel 1 goto error

echo.
echo [INFO] ==============================
echo [INFO] 4. 开始备份源码到 GitHub
echo [INFO] ==============================
:: 注意：这里假设你的本地分支是 master
git add .
git commit -m "Site Update: %date% %time%"
git push origin master

echo.
echo [SUCCESS] 恭喜！全套流程执行完毕！
pause
exit

:error
echo.
echo [ERROR] 发生错误，脚本已终止。请检查上方的报错信息。
pause