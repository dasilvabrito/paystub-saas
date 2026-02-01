@echo off
title PAYSTUB SAAS - Servidor Portatil
color 0A

=======================================================
     PAYSTUB SAAS - VERSAO PORTATIL
=======================================================

[INFO] Verificando Node.js...
node -v

[INFO] Iniciando servidor na porta 3002...

-------------------------------------------------------
 AGUARDE! O navegador abrira em 3 segundos...
-------------------------------------------------------

set PORT=3002
start http://localhost:3002
node server.js

script finalizado
pause
