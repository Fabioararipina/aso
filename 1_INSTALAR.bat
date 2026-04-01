@echo off
chcp 65001 > nul
echo ============================================
echo   ASO SAUDE - INSTALACAO
echo ============================================
echo.

echo [1/4] Instalando dependencias do backend...
cd /d "%~dp0backend"
call npm install
if errorlevel 1 ( echo ERRO nas dependencias do backend! & pause & exit /b 1 )

echo.
echo [2/4] Instalando dependencias do frontend...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 ( echo ERRO nas dependencias do frontend! & pause & exit /b 1 )

echo.
echo [3/4] Gerando build do frontend...
call npm run build
if errorlevel 1 ( echo ERRO no build do frontend! & pause & exit /b 1 )

echo.
echo [4/4] Instalando PM2 (gerenciador de processos)...
call npm install -g pm2
if errorlevel 1 ( echo ERRO ao instalar PM2! & pause & exit /b 1 )

echo.
echo ============================================
echo   INSTALACAO CONCLUIDA!
echo   Agora execute: 2_CONFIGURAR_BANCO.bat
echo ============================================
pause
