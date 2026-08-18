@echo off
chcp 65001 >nul
title 追番列表 - 本地预览服务器
echo ==========================================
echo   追番列表 - 启动本地预览服务器
echo ==========================================
echo.
cd /d "%~dp0"
echo 打开浏览器访问: http://localhost:8081
echo 按 Ctrl+C 停止服务器
echo.
python -m http.server 8081
pause