/* ==========================================================================
   Caderninho — forms.js
   Formulários (em bottom-sheet) + ações globais de criar/editar.
   Ações ficam registradas em Caderninho.Actions e são chamadas por qualquer
   elemento com data-action="nome:acao" (veja app.js).
   ========================================================================== */
(function (global) {
  'use strict';

  const C = (global.Caderninho = global.Caderninho || {});
  const U = C.Utils;
  const Store = C.Store;
  const Game = C.Game;
  const UI = C.UI;
  const A = C.Actions;
  const esc = U.escapeHTML;
  const I = C.Icons.svg;

  /** Executa uma ação que pode lançar erro de validação e mostra a mensagem em toast. */
  function safely(fn) {
    try { return fn(); } catch (e) { UI.toast(e.message || 'Algo deu errado', 'error'); return undefined; }
  }

  /* ======================================================================
     Anotação (entrada / saída)
     ====================================================================== */
  function openTransactionForm(opts) {
    opts = opts || {};
    const editing = opts.tx || null;
    let type = editing ? editing.type : (opts.type === 'in' ? 'in' : 'out');
    let category = editing ? editing.category : null;

    const html = `
      <form class="form" autocomplete="off" novalidate>
        ${UI.help('Escolha <b>Saída</b> se você gastou e <b>Entrada</b> se recebeu dinheiro. Digite o valor, escolha a categoria e toque em <b>Salvar</b>. A anotação é opcional, serve só para você lembrar.', { title: 'Como anotar' })}
        <div class="seg" role="group" aria-label="Tipo de anotação">
          <button type="button" class="seg-btn" data-t="out">${I('minus')} Saída</button>
          <button type="button" class="seg-btn" data-t="in">${I('plus')} Entrada</button>
        </div>
        <label class="field">
          <span>Quanto foi?</span>
          <div class="money-input">
            <b>R$</b>
            <input name="amount" inputmode="decimal" placeholder="0,00" aria-label="Valor em reais"
                   value="${editing ? esc(U.centsToInput(editing.amount)) : ''}">
          </div>
        </label>
        <div class="field"><span>Categoria</span><div class="chips" data-cats></div></div>
        <label class="field"><span>Quando?</span>
          <input type="date" name="date" max="${U.today()}" value="${editing ? editing.date : U.today()}">
        </label>
        <label class="field"><span>Anotação <em>(opcional)</em></span>
          <input type="text" name="note" maxlength="80" placeholder="Ex.: feira da semana" value="${editing ? esc(editing.note) : ''}">
        </label>
        <div class="actions">
          ${editing ? '<button type="button" class="btn danger-ghost" data-del>Excluir</button>' : ''}
          <button type="submit" class="btn primary grow">Salvar</button>
        </div>
      </form>`;

    UI.openSheet({
      title: editing ? 'Editar anotação' : 'Nova anotação',
      html,
      onMount(body, sheet) {
        const form = body.querySelector('form');
        const chips = body.querySelector('[data-cats]');
        const el = form.elements;

        function paint() {
          body.querySelectorAll('.seg-btn').forEach((b) => {
            const on = b.dataset.t === type;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
          });
          const list = Store.CATEGORIES[type];
          if (!list.some((c) => c.id === category)) category = list[0].id;
          chips.innerHTML = list.map((c) => `
            <button type="button" class="chip ${c.id === category ? 'active' : ''}" data-cat="${c.id}" aria-pressed="${c.id === category}">
              ${I(c.icon)} ${c.label}
            </button>`).join('');
        }

        body.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => { type = b.dataset.t; paint(); }));
        chips.addEventListener('click', (e) => {
          const b = e.target.closest('[data-cat]');
          if (b) { category = b.dataset.cat; paint(); }
        });
        el.amount.addEventListener('input', () => { el.amount.value = el.amount.value.replace(/[^\d.,]/g, ''); });
        paint();

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const amount = U.parseMoney(el.amount.value);
          if (amount <= 0) { UI.toast('Digite quanto foi', 'error'); el.amount.focus(); return; }
          const data = { type, amount, category, date: el.date.value || U.today(), note: el.note.value };
          const ok = safely(() => {
            if (editing) {
              Store.updateTransaction(editing.id, data);
              UI.toast('Anotação alterada', 'success');
            } else {
              Game.lastGain = 0;
              Store.addTransaction(data);
              UI.toast(Game.lastGain ? `Anotado! +${Game.lastGain} XP` : 'Anotado!', 'success');
            }
            return true;
          });
          if (ok) sheet.close();
        });

        const del = body.querySelector('[data-del]');
        if (del) {
          del.addEventListener('click', async () => {
            const yes = await UI.confirmDialog({ title: 'Excluir anotação?', message: 'Ela some do seu caderninho. Não dá para desfazer.', okLabel: 'Excluir', danger: true });
            if (!yes) return;
            Store.deleteTransaction(editing.id);
            UI.toast('Anotação excluída', 'info');
            sheet.close();
          });
        }
      },
    });
  }

  /* ======================================================================
     Conta (a pagar / a receber)
     ====================================================================== */
  function openBillForm(opts) {
    opts = opts || {};
    const editing = opts.bill || null;
    let kind = editing ? editing.kind : (opts.kind === 'receive' ? 'receive' : 'pay');
    const due = editing ? editing.dueDate : U.today();

    const html = `
      <form class="form" autocomplete="off" novalidate>
        ${UI.help('Cadastre uma conta para ser lembrado do vencimento. <b>A pagar</b> é uma conta sua; <b>A receber</b> é dinheiro que alguém vai te pagar. Marque <b>Repete todo mês</b> em contas fixas, como aluguel.', { title: 'Como cadastrar' })}
        <div class="seg" role="group" aria-label="Tipo de conta">
          <button type="button" class="seg-btn" data-k="pay">${I('receipt')} A pagar</button>
          <button type="button" class="seg-btn" data-k="receive">${I('banknote')} A receber</button>
        </div>
        <label class="field"><span data-title-label>Qual conta?</span>
          <input type="text" name="title" maxlength="50" value="${editing ? esc(editing.title) : ''}">
        </label>
        <label class="field"><span>Valor</span>
          <div class="money-input"><b>R$</b>
            <input name="amount" inputmode="decimal" placeholder="0,00" aria-label="Valor em reais"
                   value="${editing ? esc(U.centsToInput(editing.amount)) : ''}">
          </div>
        </label>
        <label class="field"><span>Vence quando?</span>
          <input type="date" name="due" value="${due}">
        </label>
        <label class="check"><input type="checkbox" name="recurring" ${editing && editing.recurring ? 'checked' : ''}> Repete todo mês</label>
        <div class="form" data-receive hidden>
          ${UI.help('Com o WhatsApp do cliente, o botão <b>Cobrar</b> abre a conversa já com a mensagem pronta. Se não tiver o número, pode deixar em branco.', { tone: 'tip' })}
          <label class="field"><span>Quem vai pagar você?</span>
            <input type="text" name="person" maxlength="40" placeholder="Nome do cliente" value="${editing ? esc(editing.person) : ''}">
          </label>
          <label class="field"><span>WhatsApp <em>(para cobrar com 1 toque)</em></span>
            <input type="tel" name="phone" inputmode="tel" maxlength="20" placeholder="(81) 90000-0000" value="${editing ? esc(editing.phone) : ''}">
          </label>
        </div>
        <div class="actions">
          ${editing ? '<button type="button" class="btn danger-ghost" data-del>Excluir</button>' : ''}
          <button type="submit" class="btn primary grow">Salvar</button>
        </div>
      </form>`;

    UI.openSheet({
      title: editing ? 'Editar conta' : 'Nova conta',
      html,
      onMount(body, sheet) {
        const form = body.querySelector('form');
        const el = form.elements;
        const label = body.querySelector('[data-title-label]');
        const recv = body.querySelector('[data-receive]');

        function paint() {
          body.querySelectorAll('.seg-btn').forEach((b) => {
            const on = b.dataset.k === kind;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
          });
          label.textContent = kind === 'pay' ? 'Qual conta?' : 'O que você vendeu ou fez?';
          el.title.placeholder = kind === 'pay' ? 'Ex.: conta de luz' : 'Ex.: faxina da Dona Lúcia';
          recv.hidden = kind !== 'receive';
        }
        body.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => { kind = b.dataset.k; paint(); }));
        el.amount.addEventListener('input', () => { el.amount.value = el.amount.value.replace(/[^\d.,]/g, ''); });
        paint();

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const data = {
            kind,
            title: el.title.value,
            amount: U.parseMoney(el.amount.value),
            dueDate: el.due.value || U.today(),
            recurring: el.recurring.checked,
            person: kind === 'receive' ? el.person.value : '',
            phone: kind === 'receive' ? el.phone.value : '',
          };
          const ok = safely(() => {
            if (editing) Store.updateBill(editing.id, data); else Store.addBill(data);
            UI.toast('Conta salva', 'success');
            return true;
          });
          if (ok) sheet.close();
        });

        const del = body.querySelector('[data-del]');
        if (del) {
          del.addEventListener('click', async () => {
            const yes = await UI.confirmDialog({ title: 'Excluir conta?', message: 'Essa conta será apagada.', okLabel: 'Excluir', danger: true });
            if (!yes) return;
            Store.deleteBill(editing.id);
            UI.toast('Conta excluída', 'info');
            sheet.close();
          });
        }
      },
    });
  }

  /* ======================================================================
     Meta
     ====================================================================== */
  function openGoalForm() {
    UI.openSheet({
      title: 'Nova meta',
      html: `
        <form class="form" autocomplete="off" novalidate>
          ${UI.help('Pense em algo que você quer comprar ou ter, como uma reserva de emergência. Depois é só ir guardando aos poucos e acompanhar a barra.', { title: 'Criar uma meta' })}
          <label class="field"><span>Qual é o sonho?</span>
            <input type="text" name="title" maxlength="40" placeholder="Ex.: reserva de emergência">
          </label>
          <label class="field"><span>Quanto você quer juntar?</span>
            <div class="money-input"><b>R$</b><input name="target" inputmode="decimal" placeholder="0,00" aria-label="Valor da meta"></div>
          </label>
          <div class="actions"><button type="submit" class="btn primary grow">${I('target')} Criar meta</button></div>
        </form>`,
      onMount(body, sheet) {
        const form = body.querySelector('form');
        form.elements.target.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^\d.,]/g, ''); });
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const ok = safely(() => {
            Game.lastGain = 0;
            Store.addGoal({ title: form.elements.title.value, target: U.parseMoney(form.elements.target.value) });
            UI.toast(Game.lastGain ? `Meta criada! +${Game.lastGain} XP` : 'Meta criada!', 'success');
            return true;
          });
          if (ok) sheet.close();
        });
      },
    });
  }

  function openDepositForm(goalId) {
    const g = Store.getGoal(goalId);
    if (!g) return;
    const missing = Math.max(0, g.target - g.saved);
    UI.openSheet({
      title: 'Guardar dinheiro',
      html: `
        <form class="form" autocomplete="off" novalidate>
          <p class="hint">${esc(g.title)} — faltam <b>${U.formatMoney(missing)}</b></p>
          ${UI.help('Digite o valor que você separou agora. Ele sai do seu saldo como uma anotação, mas <b>não conta como gasto</b> no resumo.')}
          <label class="field"><span>Quanto você guardou?</span>
            <div class="money-input"><b>R$</b><input name="amount" inputmode="decimal" placeholder="0,00" aria-label="Valor guardado"></div>
          </label>
          <div class="actions"><button type="submit" class="btn primary grow">${I('heart')} Guardar</button></div>
        </form>`,
      onMount(body, sheet) {
        const form = body.querySelector('form');
        form.elements.amount.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^\d.,]/g, ''); });
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const ok = safely(() => {
            Game.lastGain = 0;
            const done = !g.doneAt;
            Store.depositGoal(g.id, U.parseMoney(form.elements.amount.value));
            const reached = done && Store.getGoal(g.id).doneAt;
            UI.toast(reached ? 'Meta batida!' : (Game.lastGain ? `Guardado! +${Game.lastGain} XP` : 'Guardado!'), reached ? 'gold' : 'success');
            return true;
          });
          if (ok) sheet.close();
        });
      },
    });
  }

  /* ======================================================================
     Perfil / boas-vindas
     ====================================================================== */
  function openNameForm(opts) {
    opts = opts || {};
    const welcome = !!opts.welcome;
    UI.openSheet({
      title: welcome ? 'Bem-vindo(a) ao Caderninho!' : 'Seu nome',
      html: `
        <form class="form" autocomplete="off" novalidate>
          ${welcome ? [
            UI.help('Toque em <b>Entrou</b> ou <b>Saiu</b> sempre que receber ou gastar dinheiro.', { title: '1. Anote', icon: 'pencil', force: true }),
            UI.help('Cadastre suas contas e veja o que vence. Nós lembramos você.', { title: '2. Lembre das contas', icon: 'receipt', force: true }),
            UI.help('Veja o resumo, crie metas e ganhe pontos (XP) por manter o hábito.', { title: '3. Acompanhe', icon: 'chart', force: true }),
          ].join('') : UI.help('Seu nome aparece nas saudações do app. Fica só neste aparelho.')}
          <label class="field"><span>Como podemos te chamar?</span>
            <input type="text" name="name" maxlength="30" placeholder="Seu nome" value="${esc(Store.get().profile.name)}">
          </label>
          <div class="actions">
            ${welcome ? '<button type="button" class="btn ghost grow" data-demo>Ver com exemplo</button>' : ''}
            <button type="submit" class="btn primary grow">${welcome ? 'Começar' : 'Salvar'}</button>
          </div>
        </form>`,
      onMount(body, sheet) {
        const form = body.querySelector('form');
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          Store.setProfile({ name: form.elements.name.value.trim().slice(0, 30), welcomed: true });
          sheet.close();
        });
        const demo = body.querySelector('[data-demo]');
        if (demo) {
          demo.addEventListener('click', () => {
            Store.setProfile({ name: form.elements.name.value.trim().slice(0, 30) });
            Store.loadDemo();
            Game.evaluate({ silent: true });
            UI.toast('Dados de exemplo carregados', 'success');
            sheet.close();
          });
        }
      },
      onClose() { if (welcome && !Store.get().profile.welcomed) Store.setProfile({ welcomed: true }); },
    });
  }

  /* ---------- Ações globais ---------- */
  A['tx:new'] = (el) => openTransactionForm({ type: el.dataset.type });
  A['tx:edit'] = (el) => {
    const tx = Store.getTransaction(el.dataset.id);
    if (!tx) return;
    if (tx.category === 'meta') { UI.toast('Esse valor foi guardado numa meta. Veja em Metas', 'info'); return; }
    openTransactionForm({ tx });
  };
  A['bill:new'] = (el) => openBillForm({ kind: el.dataset.kind });
  A['goal:new'] = () => openGoalForm();
  A['goal:deposit'] = (el) => openDepositForm(el.dataset.id);

  C.Forms = { openTransactionForm, openBillForm, openGoalForm, openDepositForm, openNameForm, safely };
})(typeof window !== 'undefined' ? window : globalThis);
