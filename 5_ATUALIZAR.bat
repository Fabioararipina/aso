@echo off
chcp 65001 > nul
echo ============================================
echo   ASO SAUDE - ATUALIZACAO DO SISTEMA
echo ============================================
echo.
echo Este processo vai:
echo  1. Parar o sistema
echo  2. Aplicar migrações do banco (v2 a v5)
echo  3. Reconstruir o frontend
echo  4. Reiniciar tudo
echo.
pause

echo.
echo [0/5] Parando servicos...
call pm2 stop aso-backend 2>nul
call pm2 stop aso-frontend 2>nul

echo.
echo [1/5] Localizando psql...
set PSQL=
for %%v in (18 17 16 15 14) do (
  if exist "C:\Program Files\PostgreSQL\%%v\bin\psql.exe" (
    if not defined PSQL set PSQL=C:\Program Files\PostgreSQL\%%v\bin\psql.exe
  )
)

if not defined PSQL (
  echo ERRO: psql.exe nao encontrado! Verifique o PostgreSQL.
  pause
  exit /b 1
)
echo Usando: %PSQL%

echo.
echo [2/5] Aplicando migracoes no banco...
set PGPASSWORD=aso_pass

echo  Migracao v2 (exames)...
"%PSQL%" -U aso_user -d aso_saude -f "%~dp0backend\src\database\migration_exames.sql"

echo  Migracao v3 (sub-tipos)...
"%PSQL%" -U aso_user -d aso_saude -f "%~dp0backend\src\database\migration_subtipos.sql"

echo  Migracao v4 (templates WhatsApp / salas adm)...
"%PSQL%" -U aso_user -d aso_saude -f "%~dp0backend\src\database\migration_v4.sql"

echo  Migracao v5 (ausencia / hibernacao)...
"%PSQL%" -U aso_user -d aso_saude -f "%~dp0backend\src\database\migration_v5.sql"

echo.
echo [3/5] Instalando dependencias do backend...
cd /d "%~dp0backend"
call npm install
if errorlevel 1 ( echo ERRO nas dependencias do backend! & pause & exit /b 1 )

echo.
echo [4/5] Reconstruindo frontend...
cd /d "%~dp0frontend"
call npm install
call npm run build
if errorlevel 1 ( echo ERRO no build do frontend! & pause & exit /b 1 )

echo.
echo [5/5] Reiniciando sistema...
call pm2 restart aso-backend 2>nul || (
  cd /d "%~dp0backend"
  call pm2 start src/index.js --name aso-backend
)
call pm2 restart aso-frontend 2>nul || (
  cd /d "%~dp0frontend"
  call pm2 start "npm start" --name aso-frontend
)
call pm2 save

echo.
echo ============================================
echo   ATUALIZACAO CONCLUIDA!
echo.
call ipconfig | findstr "IPv4"
echo.
echo   Recepcao : http://[IP]:3000/recepcao/aso
echo   TV       : http://[IP]:3000/tv/aso
echo   Operador : http://[IP]:3000/operador/[sala]
echo   Admin    : http://[IP]:3000/admin
echo ============================================
pause
