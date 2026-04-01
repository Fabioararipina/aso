@echo off
chcp 65001 > nul
echo ============================================
echo   ASO SAUDE - CONFIGURAR BANCO DE DADOS
echo ============================================
echo.
echo ATENCAO: Voce precisa saber a senha do PostgreSQL
echo que foi definida durante a instalacao.
echo.
set /p PGPASS=Digite a senha do PostgreSQL:

echo.
echo [1/3] Criando usuario e banco de dados...
set PGPASSWORD=%PGPASS%
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE USER aso_user WITH PASSWORD 'aso_pass';" 2>nul
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE aso_saude OWNER aso_user;" 2>nul
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE aso_saude TO aso_user;" 2>nul

echo.
echo [2/3] Criando tabelas e dados iniciais...
set PGPASSWORD=aso_pass
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U aso_user -d aso_saude -f "%~dp0backend\src\database\setup_completo.sql"
if errorlevel 1 ( echo ERRO ao criar tabelas! & pause & exit /b 1 )

echo.
echo [3/3] Banco configurado com sucesso!
echo.
echo ============================================
echo   BANCO OK!
echo   Agora execute: 3_INICIAR.bat
echo ============================================
pause
