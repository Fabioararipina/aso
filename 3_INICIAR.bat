@echo off
chcp 65001 > nul
echo ============================================
echo   ASO SAUDE - INICIANDO SISTEMA
echo ============================================
echo.

echo Parando processos anteriores (se houver)...
call pm2 stop aso-backend 2>nul
call pm2 stop aso-frontend 2>nul
call pm2 delete aso-backend 2>nul
call pm2 delete aso-frontend 2>nul

echo.
echo Iniciando backend...
cd /d "%~dp0backend"
call pm2 start src/index.js --name aso-backend

echo.
echo Iniciando frontend...
cd /d "%~dp0frontend"
call pm2 start "npm start" --name aso-frontend

echo.
call pm2 save

echo.
echo ============================================
echo   SISTEMA NO AR!
echo.
call ipconfig | findstr "IPv4"
echo.
echo   Use o IP acima para acessar de outros
echo   dispositivos na rede:
echo.
echo   Recepcao : http://[IP]:3000/recepcao/aso
echo   TV       : http://[IP]:3000/tv/aso
echo   Operador : http://[IP]:3000/operador
echo   Admin    : http://[IP]:3000/admin
echo.
echo   Login admin: usuario=admin  senha=admin123
echo ============================================
pause
