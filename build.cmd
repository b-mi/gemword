@echo off
call npm version patch
call ng build -c production --base-href .
del gemword\dist\gemword\browser\config.json 
echo key to copy to ISP
pause
rclone sync ./dist/gemword/browser arxa:/subdoms/gemword/wwwroot/ --progress --exclude "media/**" --exclude "config.json" --dry-run

REM rclone delete arxa:/www/ --max-depth 1 --filter "+ *.js" --filter "+ *.css" --filter "- *" -v 
pause 
rem call copyto.cmd