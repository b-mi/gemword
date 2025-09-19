@echo off
call ng build -c production --base-href .
echo key to copy to IIS
pause
call copyto.cmd