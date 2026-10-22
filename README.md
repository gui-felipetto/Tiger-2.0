# Tiger Club

Cassino **de brincadeira**, feito para celular: Tiger Slots, Double e Minas. Créditos fictícios chamados **Bryams**, sem compra, depósito, saque ou conversão em dinheiro.

## Rodar

Requer Node.js 20 ou superior. Não há dependências para instalar.

```sh
npm run dev
```

Abra `http://127.0.0.1:4173`. A interface ocupa até 480 px e fica centralizada em telas maiores. Para abrir em um celular físico, use a URL de preview da Vercel.

```sh
npm run check
```

Executa a checagem de sintaxe e os testes do motor, incluindo pagamentos, probabilidades, saldo, persistência, Minas e bônus diário.

## Vercel

Este é um site estático, sem backend e sem etapa de build. `vercel.json` define o diretório raiz como saída, com headers de segurança. No projeto existente da Vercel, mantenha **Root Directory na raiz do repositório** e **Framework Preset: Other**. Remova overrides antigos de Build Command/Output Directory, se houver; a configuração do repositório já contém os valores.

A entrada agora é `/index.html`. O endereço antigo `/View/pages/roleta.html` encaminha para `/#slots`. Os caminhos são absolutos a partir da raiz, compatíveis com o domínio da Vercel.

## O que está pronto

- Interface mobile de 320 a 480 px, áreas seguras do iPhone e navegação inferior.
- Três jogos completos, regras e pagamentos explícitos.
- 1.000 Bryams iniciais; bônus de 500 por dia do calendário local; recarga gratuita de 1.000 quando o saldo fica abaixo de 10, sem partida aberta.
- Histórico das últimas 50 rodadas, estatísticas, favoritos, apelido e configurações.
- Persistência em `localStorage`, recuperação da rodada de Minas, sincronização entre abas com Web Locks quando disponível.
- Som sintetizado no aparelho, desligado por padrão; redução de movimento manual e suporte à preferência do sistema.
- Manifesto e ícone para abrir como app pela tela inicial em navegadores compatíveis. Não há cache offline; é necessária conexão para carregar a aplicação.
- Nenhuma biblioteca, fonte, script ou analytics externo. Ilustração própria em SVG.

## Regras e armazenamento

Valores são guardados como inteiros em centésimos de Bryam para evitar erros de ponto flutuante. Cada resultado usa `crypto.getRandomValues`, com rejeição de amostras para sortear intervalos uniformes. Slots e Double são liquidados antes da animação: recarregar não estorna a aposta nem repete o prêmio. A disposição de Minas é fixa durante a rodada e persiste junto com as casas abertas.

Slots paga pela linha central: par 1,5×; trincas de cereja 4×, limão 5×, sino 7×, trevo 10×, diamante 15× e tigre 25×. Cada símbolo tem probabilidade 1/6 por coluna. Retorno teórico: 93,0556%.

Double sorteia 15 números equiprováveis: coral de 1 a 7 paga 2×, roxo de 8 a 14 paga 2× e dourado 0 paga 14×. Minas usa `floor(0.96 / probabilidade_de_sobreviver * 100) / 100`. Todos os prêmios incluem a aposta e são fictícios.

Os dados pertencem ao navegador e não sincronizam entre aparelhos. Limpar o armazenamento apaga o progresso. Sem armazenamento disponível, a aplicação funciona apenas na memória da aba e avisa o usuário. Bônus e saldo locais podem ser alterados pelas ferramentas do navegador; isso é adequado ao protótipo recreativo, não é uma arquitetura para valores reais, ranking competitivo ou contas autenticadas.

## Estrutura

- `index.html`: estrutura, navegação e símbolos dos ícones.
- `assets/app.css`: interface mobile.
- `assets/app.js`: telas, interações, som e armazenamento.
- `assets/engine.js`: regras isoladas da interface.
- `tests/engine.test.js`: testes de regras e persistência.
- `scripts/serve.mjs`: servidor de desenvolvimento sem dependências.
- `Model/`, `Controller/` e `View/css/`: arquivos do protótipo original, preservados como referência; não são carregados pela nova aplicação.

## Avaliação da base original

O protótipo tinha uma tela HTML aninhada, sem entrada na raiz, sorteio de três cores e um botão sem identificação. Ainda faltavam saldo, apostas, pagamentos, histórico e tratamento de ações repetidas. O CSS fixava a largura em 425 px e bloqueava o scroll, cortando conteúdo em aparelhos menores. Havia dependência externa do Font Awesome e metadados em inglês. A versão atual resolve esses pontos mantendo a simplicidade do HTML, CSS e JavaScript estáticos, sem introduzir um framework desnecessário.
