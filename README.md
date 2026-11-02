# Caderninho — Purytalent

App de organização financeira simples para autônomos e famílias: anotar entradas e saídas,
lembrar de contas, cobrar clientes por WhatsApp e acompanhar o progresso com **XP, níveis,
sequência diária e conquistas**.

HTML + CSS + JavaScript puro. **Sem build e sem dependências.** Funciona 100% no aparelho; conta e sincronização na nuvem são opcionais (precisam de um projeto Supabase, veja abaixo).

## Como rodar

Abra `index.html` no navegador (funciona direto do arquivo). Para testar como app no celular:

```bash
python3 -m http.server 8080   # e abra http://SEU-IP:8080 no celular
```

Na primeira abertura, "Ver com exemplo" carrega dados de demonstração.

Para testar o **modo offline** e a **conta**, sirva por `http://localhost` (o `file://` não liga o Service Worker).

## Estrutura

Todos os arquivos ficam na mesma pasta (sem subpastas):

```
index.html         casca do app (header, <main>, barra de abas)
style.css          todo o visual (cores nas variáveis de :root; modo escuro automático)
utils.js           dinheiro, datas, telefone, escape de HTML
icons.js           ícones SVG (substitui todos os emojis)
config.js          ÚNICO arquivo para ligar a conta/nuvem (url e chave do Supabase)
store.js           estado + localStorage + regras de negócio + eventos
game.js            XP, níveis, streak, conquistas
ui.js              toast, bottom-sheet, confirmação, componentes de HTML
qr.js              gerador de QR Code (sem biblioteca)
pix.js             Pix copia e cola (BR Code, CRC16, validação de chaves)
forms.js           formulários (anotação, conta, meta, Pix, login) + ações globais
home.js            tela Início            (#/home)
transactions.js    tela Anotações         (#/lancamentos)
bills.js           tela Contas            (#/contas)
summary.js         tela Resumo            (#/resumo)
goals.js           tela Metas             (#/metas)
profile.js         tela Perfil            (#/perfil)
sync.js            login (e-mail/senha) e sincronização entre aparelhos
offline.js         registra o Service Worker, faixa de "nova versão", aviso de internet
sw.js              Service Worker: guarda o app no aparelho para abrir sem internet
supabase.sql       rode uma vez no Supabase para criar a tabela e as regras de segurança
features.css       estilos do Pix, da conta e do modo offline (separado do style.css)
app.js             roteador por hash, render, delegação de eventos
manifest.json      permite "instalar" na tela inicial (PWA)
icon.svg           ícone do app
icon-192.png, icon-512.png   ícones PNG (instalação no Android/Chrome)
```

A ordem dos `<script>` no `index.html` importa (cada arquivo usa os anteriores).
Tudo vive no namespace global `Caderninho` (para funcionar sem módulos ES e abrir via `file://`).

## Design e tamanhos (v2)

- **Sem emojis.** Todos os ícones são SVG em `icons.js` (traço, herdam a cor e o tamanho do texto).
  Para usar: `Caderninho.Icons.svg('flame')` no JS ou `<i data-ic="home"></i>` no HTML.
  Categorias e conquistas guardam o **nome** do ícone (`icon: 'cart'`), não o desenho.
- **Escala automática pela tela.** Todo tamanho do CSS é em `rem`. O `app.js` (`fitScreen`) mede a tela
  do aparelho (largura e altura) ao abrir, ao girar e ao redimensionar, e ajusta o `font-size` da raiz;
  textos, botões, ícones e espaços acompanham juntos. Sem JS, um `clamp()` no CSS faz o equivalente.
- **Hierarquia visual.** Mais importante = maior: saldo e botões Entrou/Saiu (maiores da tela), botão central (+),
  valores em dinheiro. Médio: títulos de cartão e itens de lista. Menor e cinza: dicas, legendas, etiquetas.
  Os tamanhos ficam nas variáveis `--fs-*` no topo do `style.css`.
- Alvos de toque nunca ficam abaixo de 44px, mesmo no menor celular.
- **Explicações em tudo.** Cada tela e cada formulário tem cardzinhos de ajuda (letra pequena, ícone, 3 tons:
  azul = explica, amarelo = dica, vermelho = atenção). Código: `UI.help('texto com <b>negrito</b>', { title, tone, icon })`.
  A tela de boas-vindas mostra 3 passos. Em Perfil > "Mostrar explicações" o usuário esconde ou liga todos
  (`profile.hideHelp`). Estilo em `.help` no `style.css`.
- **Animação de abertura.** Ao abrir, o app mostra a logo se montando (caderno, lombada, linhas e o check desenhados),
  o nome e, embaixo, "desenvolvido por N E K Purytalent". Dura ~3s, toque para pular; com "reduzir movimento"
  ligado no celular ela fica parada por ~1,5s. É só CSS (`.splash` no `style.css`) + `runSplash()` no `app.js`;
  o HTML está no começo do `<body>` do `index.html`. A boas-vindas só abre depois dela.
  No fim do desenho da logo toca um "tim" de sino, gerado por código (`playTim()` no `app.js`, sem arquivo de áudio)
  e uma vibração curta no Android. Celulares só liberam som depois de um toque: se ainda estiver bloqueado, o "tim"
  não toca atrasado; ele toca quando a pessoa toca na tela para pular. Em Perfil > "Som de abertura" dá para desligar
  (`profile.muteSound`).
- Mensagens enviadas para fora (cobrança e resumo no WhatsApp) agora vão sem emoji, só texto.

## Pix na cobrança

- Em **Perfil > Meu Pix** a pessoa cadastra chave (CPF, CNPJ, celular, e-mail ou aleatória), nome e cidade. Fica em `profile.pix`.
- Nas contas **a receber**, o botão Pix mostra **QR Code + copia e cola** com o valor certo, e a mensagem de cobrança do WhatsApp já leva o código.
- É um código **estático** (padrão do Banco Central): o app **não sabe se o cliente pagou**. Quem confirma é a pessoa, tocando em "Recebi". Confirmação automática exige a API de um banco/PSP (próximo passo possível).
- Tudo é gerado no aparelho (funciona sem internet). Verificado com CRC16 independente, campos do BR Code e QR lido por outro decodificador.
- API: `Caderninho.Pix.build({key,name,city,amountCents,txid})`, `Pix.forBill(bill)`, `Pix.verify(code)`, `QR.svg(texto)`.

## Conta e sincronização (opcional)

Sem configurar nada, o app funciona só no aparelho e o Perfil mostra "Conta e nuvem: em breve". Para ligar:

1. Crie um projeto em supabase.com.
2. No **SQL Editor**, cole e rode o `supabase.sql` (cria a tabela `caderninho_data` com **RLS**: cada pessoa só acessa a própria linha).
3. Em **Settings > API**, copie *Project URL* e a chave **anon public** para `config.js`. (A chave anon é pública por desenho. **Nunca** use a `service_role`.)
4. Em **Authentication**: deixe "Confirm email" ligado (recomendado) e coloque o endereço do app em *Site URL*.

Como funciona (`sync.js`):
- Login por e-mail e senha (criar conta, entrar, esqueci a senha, sair). A senha nunca é guardada; só os tokens da sessão.
- Sincronizar = **baixar a nuvem, juntar com o aparelho (`Store.merge`), aplicar, enviar**. Por registro vale o mais novo; exclusões viram "lápides" (senão voltariam). Anotar sem internet e sincronizar depois não perde nada.
- Envio com **versão**: se outro aparelho gravou no meio, o servidor recusa, o app baixa de novo, junta e tenta outra vez (até 4x).
- Sincroniza ao entrar, ao abrir o app, quando a internet volta, ao voltar para o app, ~2,5 s após cada alteração e a cada 5 min.
- Trocar de conta no mesmo aparelho **pede confirmação** antes de remover os dados locais da conta anterior.
- "Apagar tudo", restaurar backup e dados de exemplo, com conta conectada, **também valem para a nuvem** (o app avisa e sincroniza antes, para não deixar sobras).
- Outro servidor (Firebase, API própria): crie um adaptador em `sync.js` (contrato descrito no topo do arquivo) e troque `provider` no `config.js`.

> **Importante:** o adaptador do Supabase foi testado contra um servidor **simulado** (mesmas rotas de auth e REST, com RLS e versão), não contra um projeto Supabase real. Faça um teste de ponta a ponta no seu projeto antes de publicar.

## Modo offline (Service Worker)

- `sw.js` guarda todos os arquivos do app; depois da 1ª visita ele abre e funciona sem internet. Só liga em endereço `https://` (ou `localhost`); abrindo direto de `file://` o app funciona, só sem offline.
- Estratégia: **cache primeiro, versão fechada** (nunca mistura arquivo novo com antigo). O topo mostra o aviso "Sem internet"; quando há versão nova aparece a faixa **Nova versão disponível > Atualizar**.
- **A CADA ENTREGA:** troque `VERSION` no `sw.js` (ex.: `caderninho-v3.0.1`). Sem isso quem já instalou continua na versão velha. Arquivo novo? Coloque também na lista `FILES`.
- Desenvolvendo: abra o app com `?sw=off` para desligar o offline e apagar o cache.
- Pedidos para outros endereços (servidor de conta, WhatsApp) nunca passam pelo cache.

## Convenções (importante)

- **Dinheiro sempre em centavos (inteiro).** R$ 12,50 = `1250`. Use `Utils.formatMoney` / `Utils.parseMoney`.
- **Datas sempre ISO local `"AAAA-MM-DD"`** (sem hora/fuso). Use os helpers de `Utils`.
- **Todo texto digitado pelo usuário passa por `Utils.escapeHTML`** antes de ir para `innerHTML`.
- A UI nunca mexe no estado direto: chame funções da `Store` (ela salva e avisa as telas).

## Modelo de dados (`Store.get()`)

| Campo | Conteúdo |
|---|---|
| `transactions[]` | `{id, type:'in'\|'out', amount, category, note, date, billId?, goalId?}` |
| `bills[]` | `{id, kind:'pay'\|'receive', title, amount, dueDate, recurring, status:'open'\|'done', person, phone, ...}` |
| `goals[]` | `{id, title, target, saved, doneAt}` |
| `game` | `{xp, achievements:{id:data}, days[], daily, chargesSent}` |
| `deleted[]` | lápides de exclusão `{k:'t'\|'b'\|'g', id, at}` (a sincronização precisa delas) |
| `profile` | `{name, welcomed, pix?, hideHelp?, muteSound?, updatedAt}` |

Todo lançamento, conta e meta tem `updatedAt` (ms): é o que a sincronização compara. Ao mexer na `Store`, use as funções dela (elas atualizam `updatedAt` e as lápides).

Guardar dinheiro numa meta cria uma saída na categoria interna `meta`, que **não** conta como gasto no resumo.

## Como estender

**Nova tela:** crie `minha.js` com `Caderninho.Views.minha = { render() { return '<html>'; } }`,
adicione o `<script>` no `index.html` antes do `app.js` e use `<a href="#/minha">`.

**Nova ação de clique:** `Caderninho.Actions['grupo:acao'] = (el, ev) => {...}` e no HTML
`<button data-action="grupo:acao" data-id="123">`. Um único ouvinte global cuida de tudo (inclusive nos modais).

**Nova conquista:** adicione um item em `ACHIEVEMENTS` no `game.js`.

**Nova categoria:** edite `CATEGORIES` no `store.js`.

## Regras de gamificação (ajuste em `game.js`)

- XP: anotação +10 (só as 5 primeiras do dia), conta paga +20, cobrança +15, meta criada +10, depósito em meta +10, conquista +30.
- Nível N exige `50·N·(N−1)` XP no total (nível 2 = 100, nível 3 = 300…).
- Sequência conta o **dia real** em que a pessoa anotou, não a data do lançamento (impede "preencher dias" para trás).

## Limitações atuais / próximos passos sugeridos

1. **Conta**: falta teste com um projeto Supabase real, "excluir minha conta" (exige função no servidor; importante para a LGPD) e política de privacidade/termos antes de publicar.
2. **Dados na nuvem** ficam em texto no banco (protegidos por RLS, não criptografados de ponta a ponta). Inclui a chave Pix cadastrada.
3. **Sem notificações push** (lembretes só aparecem dentro do app). Próximo passo: Web Push (Service Worker já existe) ou app nativo.
4. **Pix sem confirmação automática** (código estático). Para saber que foi pago: API de PSP + webhook.
5. Duas abas abertas no mesmo aparelho não se atualizam entre si (localStorage). A sincronização com a nuvem junta tudo depois.
6. Ideias de produto: cobrança recorrente automática, ranking entre amigos, exportar PDF/planilha, categorias personalizadas, onboarding por perfil (diarista, motorista de app, etc.).
7. Testes automáticos **não estão no repositório** (rodamos fora, em Playwright). Vale versionar: estão prontos para virar CI.

---
Feito pela Purytalent.
