@echo off
echo =========================================
echo 1. Limpiando cache y modulos antiguos...
echo =========================================
rmdir /s /q .next 2>nul
rmdir /s /q node_modules 2>nul
del /q package-lock.json 2>nul

echo.
echo =========================================
echo 2. Instalando todo desde cero... (Esto tardara un poco)
echo =========================================
call npm install

echo.
echo =========================================
echo 3. Configurando Prisma y la Base de Datos...
echo =========================================
call npx prisma generate
call npx prisma db push

echo.
echo =========================================
echo 4. Arrancando el servidor...
echo =========================================
call npm run dev
pause
