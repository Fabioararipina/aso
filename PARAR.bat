@echo off
echo Parando o sistema ASO Saude...
call pm2 stop aso-backend
call pm2 stop aso-frontend
echo Sistema parado.
pause
