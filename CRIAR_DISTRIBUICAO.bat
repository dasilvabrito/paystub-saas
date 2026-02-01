@echo off
title [1/2] PREPARANDO VERSAO PORTATIL...
color 0B
echo.
echo ========================================================
echo      CRIADOR DE VERSAO PORTATIL (LEVE)
echo ========================================================
echo.

echo [PASSO 1] Compilando o projeto (pode demorar um pouco)...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo [ERRO] Falha na compilacao. Verifique os erros acima.
    pause
    exit
)

echo.
echo [PASSO 2] Criando pasta PAYSTUB_PORTATIL...
if exist "PAYSTUB_PORTATIL" (
    rmdir /s /q "PAYSTUB_PORTATIL"
)
mkdir "PAYSTUB_PORTATIL"

echo.
echo [PASSO 3] Copiando arquivos essenciais...

:: 1. Copy Standalone files (Server + Dependencies) - Deep copy
echo Copiando servidor...
xcopy ".next\standalone\*" "PAYSTUB_PORTATIL\" /E /I /H /Y /Q >nul

:: 2. Copy Static Assets (Images, etc) - Must be inside .next/static
echo Copiando assets estaticos (.next/static)...
mkdir "PAYSTUB_PORTATIL\.next\static"
xcopy ".next\static\*" "PAYSTUB_PORTATIL\.next\static\" /E /I /H /Y /Q >nul

:: 3. Copy Public Folder (Logos, icons)
echo Copiando pasta public...
xcopy "public\*" "PAYSTUB_PORTATIL\public\" /E /I /H /Y /Q >nul

echo.
echo [PASSO 4] Criando script de inicializacao...
(
echo @echo off
echo title PAYSTUB SAAS - Servidor Portatil
echo color 0A
echo.
echo =======================================================
echo      PAYSTUB SAAS - VERSAO PORTATIL
echo =======================================================
echo.
echo [INFO] Verificando Node.js...
echo node -v
echo.
echo [INFO] Iniciando servidor na porta 3002...
echo.
echo -------------------------------------------------------
echo  AGUARDE! O navegador abrira em 3 segundos...
echo -------------------------------------------------------
echo.
echo set PORT=3002
echo start http://localhost:3002
echo node server.js
echo.
echo script finalizado
echo pause
) > "PAYSTUB_PORTATIL\INICIAR.bat"

echo.
echo [PASSO 5] Finalizando pacote...
if exist "CONTRACHEQUE.pdf" (
    echo Copiando arquivo de exemplo...
    copy "CONTRACHEQUE.pdf" "PAYSTUB_PORTATIL\" >nul
)

(
echo =======================================================
echo      PAYSTUB EXTRACTOR - VERSAO PORTATIL
echo =======================================================
echo.
echo 1. O QUE E ISSO?
echo    Esta pasta contem o sistema completo para rodar em
echo    qualquer computador com Windows.
echo.
echo 2. REQUISITOS
echo    - Node.js instalado (https://nodejs.org/)
echo.
echo 3. COMO USAR
echo    - Clique duas vezes em INICIAR.bat
echo    - Aguarde a janela preta abrir
echo    - O sistema abrira no seu navegador automaticamente
echo.
echo 4. SUPORTE
echo    Se a tela fechar rapidamente, verifique se o Node.js
echo    esta instalado corretamente.
) > "PAYSTUB_PORTATIL\LEIA_ME.txt"

echo.
echo ========================================================
echo      SUCESSO! VERSAO PORTATIL CRIADA
echo ========================================================
echo.
echo A pasta "PAYSTUB_PORTATIL" contem tudo que voce precisa.
echo Voce pode copiar essa pasta para qualquer computador (que tenha Node.js).
echo.
pause
