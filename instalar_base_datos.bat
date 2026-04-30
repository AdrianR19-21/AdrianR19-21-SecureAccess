@echo off
echo =========================================
echo Instalando la base de datos...
echo Por favor, espera un momento.
echo =========================================
call npm install prisma @prisma/client

echo.
echo =========================================
echo Creando el archivo de la base de datos local (dev.db)...
echo =========================================
call npx prisma db push

echo.
echo =========================================
echo ¡Todo listo! La base de datos se ha creado correctamente.
echo Ya puedes cerrar esta ventana negra.
echo =========================================
pause
