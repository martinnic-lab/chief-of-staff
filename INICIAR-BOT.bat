@echo off
title Chief of Staff - BOT Telegram
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%
echo.
echo  ============================================
echo   CHIEF OF STAFF - Bot de Telegram
echo   Deja esta ventana abierta: ella ES el bot.
echo   Para apagarlo: cerra la ventana.
echo  ============================================
echo.
npm run bot
echo.
echo  El bot se detuvo. Si fue un error, la causa aparece arriba.
pause
