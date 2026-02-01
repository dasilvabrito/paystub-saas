# Como Rodar o Sistema em Outro Computador

Para executar este sistema em qualquer computador Windows do seu escritório, siga os passos abaixo.

## 1. Requisito Único: Node.js
O computador de destino **precisa** ter o Node.js instalado. É um programa leve e gratuito.
1. Baixe o **Node.js LTS** em: [https://nodejs.org/](https://nodejs.org/)
2. Instale (basta clicar em Next/Próximo até o fim).

## 2. Levando o Programa
1. Copie a pasta inteira `app` (ou `PROGRAMAS WILLIAN`) para o Pen Drive ou Rede.
2. Cole no computador de destino (ex: `C:\Sistemas\Auditoria`).

## 3. Executando
1. Abra a pasta do sistema.
2. Dê um clique duplo no arquivo **`INICIAR.bat`**.
3. Uma tela preta abrirá (é o servidor) e em seguida o sistema abrirá no seu navegador automaticamente.

## Dica Pro: Modo "Portátil" Leve
Se quiser levar apenas o necessário (sem o peso de desenvolvimento):
1. No computador original, rode `npm run build`.
2. Copie a pasta `.next/standalone` gerada + a pasta `public` + a pasta `.next/static` para o destino.
*Nota: O método mais simples é copiar a pasta inteira atual, pois já está tudo configurado.*

## Suporte
Se aparecer uma mensagem vermelha "Node.js não encontrado", repita o passo 1.
