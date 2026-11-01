# Caderninho — Purytalent

App de organização financeira simples para autônomos e famílias: anotar entradas e saídas,
lembrar de contas, cobrar clientes por WhatsApp e acompanhar o progresso com **XP, níveis,
sequência diária e conquistas**.

HTML + CSS + JavaScript puro. **Sem build, sem dependências, sem backend.**

## Como rodar

Abra `index.html` no navegador (funciona direto do arquivo). Para testar como app no celular:

```bash
python3 -m http.server 8080   # e abra http://SEU-IP:8080 no celular
```

Na primeira abertura, "Ver com exemplo" carrega dados de demonstração.

## Estrutura

Todos os arquivos ficam na mesma pasta (sem subpastas):

```
index.html         casca do app (header, <main>, barra de abas)
style.css          todo o visual (cores nas variáveis de :root; modo escuro automático)
utils.js           dinheiro, datas, telefone, escape de HTML
icons.js           ícones SVG (substitui todos os emojis)
store.js           estado + localStorage + regras de negócio + eventos
game.js            XP, níveis, streak, conquistas
ui.js              toast, bottom-sheet, confirmação, componentes de HTML
forms.js           formulários (anotação, conta, meta) + ações globais
home.js            tela Início            (#/home)
transactions.js    tela Anotações         (#/lancamentos)
bills.js           tela Contas            (#/contas)
summary.js         tela Resumo            (#/resumo)
goals.js           tela Metas             (#/metas)
profile.js         tela Perfil            (#/perfil)
app.js             roteador por hash, render, delegação de eventos
manifest.json      permite "instalar" na tela inicial (PWA básico)
icon.svg           ícone do app
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

1. **Dados só no aparelho** (localStorage). Backup manual em JSON no Perfil. Para contas de usuário e sincronização: trocar `load()`/`save()` em `store.js` por Firebase/Supabase/API.
2. **Sem notificações push**: os lembretes aparecem dentro do app. Próximo passo: Service Worker + Web Push (ou app nativo).
3. **Sem modo offline garantido**: falta um Service Worker para cache dos arquivos.
4. Ideias de produto: Pix copia-e-cola na cobrança, cobrança recorrente automática, ranking entre amigos, exportar PDF/planilha, categorias personalizadas, gráficos mais ricos, onboarding por perfil (diarista, motorista de app, etc.).
5. Ícone do PWA é SVG; para publicar nas lojas gere PNGs 192/512.
6. Testes automatizados ainda não existem no repositório (a lógica está isolada em `utils.js`/`store.js`, pronta para testar).

---
Feito pela Purytalent.
