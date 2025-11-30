@echo off
call npm version patch
call ng build -c production --base-href .
del gemword\dist\gemword\browser\config.json 
echo key to copy to ISP
pause
rclone sync ./dist/gemword/browser arxa:/subdoms/gemword/wwwroot/ --progress --exclude "media/**" --exclude "config.json" --ignore-times --inplace

rem rclone delete arxa:/www/ --max-depth 1 --filter "+ *.js" --filter "+ *.css" --filter "- *" -v %DRY_RUN%
rem rclone copy h:\Data\repos\ng\arxa\dist\arxa.eu\browser\ arxa:/www/ --filter "- assets/settings.json" --filter "+ *" --max-depth 2 --ignore-times -v %DRY_RUN%

pause 
rem call copyto.cmd