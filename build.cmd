@echo off
call npm version patch
call ng build -c production --base-href .
del gemword\dist\gemword\browser\config.json 
rem echo key to copy to IIS
pause
rem call copyto.cmd