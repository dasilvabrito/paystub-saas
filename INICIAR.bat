@echo off
title PAYSTUB SAAS - Iniciando...
color 0A

echo.
echo =======================================================
echo      INICIANDO SISTEMA DE AUDITORIA (PAYSTUB SAAS)
echo =======================================================
echo.

echo [1/3] Verificando Node.js...
node -v
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERRO CRITICO] O Node.js nao foi encontrado neste computador.
    echo Voce PRECISAR instalar o Node.js para usar o programa.
    echo Baixe em: https://nodejs.org/
    echo.
    echo Pressione qualquer tecla para sair...
    pause >nul
    exit
)
echo Node.js detectado com sucesso.

echo.
echo [2/3] Verificando modo de inicializacao...
if exist "package.json" (
    echo Modo: Codigo Fonte (npm start)
    echo Preparando para abrir o navegador...
    set PORT=3002
    timeout /t 3 >nul
    start http://localhost:3002
    npm run start
) else (
    if exist ".next\standalone\server.js" (
        echo Modo: Standalone (server.js)
        echo Preparando para abrir o navegador...
        set PORT=3002
        timeout /t 3 >nul
        start http://localhost:3002
        node .next\standalone\server.js
    ) else (
        color 0C
        echo [ERRO] Nao foi possivel encontrar os arquivos do sistema.
        echo Verifique se voce copiou a pasta completa.
        pause
        exit
    )
)

echo.
echo O servidor parou.
pause
