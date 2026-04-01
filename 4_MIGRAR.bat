@echo off
chcp 65001 > nul
echo ============================================
echo   ASO SAUDE - MIGRACAO v3 (Sub-tipos)
echo ============================================
echo.
set /p PGPASS=Digite a senha do PostgreSQL (admin):

echo.
echo [1/4] Aplicando migracoes no banco...
set PGPASSWORD=%PGPASS%

set PSQL=
for %%v in (18 17 16 15 14) do (
  if exist "C:\Program Files\PostgreSQL\%%v\bin\psql.exe" (
    if not defined PSQL set PSQL=C:\Program Files\PostgreSQL\%%v\bin\psql.exe
  )
)

if not defined PSQL (
  echo ERRO: psql.exe nao encontrado! Verifique a instalacao do PostgreSQL.
  pause
  exit /b 1
)

echo Usando: %PSQL%
echo Rodando migration v2 (exames)...
"%PSQL%" -U postgres -d aso_saude -f "%~dp0backend\src\database\migration_exames.sql"
if errorlevel 1 ( echo ERRO na migracao v2! & pause & exit /b 1 )

echo Rodando migration v3 (sub-tipos)...
"%PSQL%" -U postgres -d aso_saude -f "%~dp0backend\src\database\migration_subtipos.sql"
if errorlevel 1 ( echo ERRO na migracao v3! & pause & exit /b 1 )

echo.
echo [2/4] Rebuild do frontend...
cd /d "%~dp0frontend"
call npm run build
if errorlevel 1 ( echo ERRO no build! & pause & exit /b 1 )

echo.
echo [4/4] Reiniciando sistema...
call pm2 restart aso-backend
call pm2 restart aso-frontend

echo.
echo ============================================
echo   ATUALIZACAO CONCLUIDA!
echo ============================================
pause
