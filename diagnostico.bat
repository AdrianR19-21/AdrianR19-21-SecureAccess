@echo off
echo =========================================
echo Analizando el problema (Creando archivo de log)...
echo =========================================
echo Ejecutando diagnostico... > diagnostico.log
echo. >> diagnostico.log
echo [1] Ejecutando npm install... >> diagnostico.log
call npm install --verbose >> diagnostico.log 2>&1

echo. >> diagnostico.log
echo [2] Ejecutando prisma generate... >> diagnostico.log
call npx prisma generate >> diagnostico.log 2>&1

echo. >> diagnostico.log
echo [3] Ejecutando prisma db push... >> diagnostico.log
call npx prisma db push >> diagnostico.log 2>&1

echo =========================================
echo ¡Análisis terminado! Ya puedes cerrar esta ventana.
echo =========================================
pause
