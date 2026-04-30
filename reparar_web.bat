@echo off
echo =========================================
echo Reparando dependencias de la web...
echo =========================================
call npm install

echo.
echo =========================================
echo Arrancando el servidor web...
echo =========================================
call npm run dev
pause
