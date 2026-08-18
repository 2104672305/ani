@echo off
chcp 65001 >nul
title 追番列表 - 数据更新
echo ==========================================
echo   追番列表数据更新脚本
echo ==========================================
echo.

cd /d "%~dp0"

REM 如果直连 api.bgm.tv 超时，改用本机代理（Clash 默认端口 7897）
set "PROXY=http://127.0.0.1:7897"

echo [1/2] 正在从 Bangumi API 获取最新数据...
python fetch_bangumi.py
if errorlevel 1 (
    echo.
    echo [错误] 数据获取失败，请检查网络或用户名设置
    pause
    exit /b 1
)

echo.
echo [2/2] 数据更新完成!
echo.
echo 运行下面的命令启动本地服务器预览：
echo   python -m http.server 8081
echo 然后访问 http://localhost:8081
echo.
pause