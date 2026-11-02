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

  /* ======================================================================
     Meu Pix (chave para receber)
     ====================================================================== */
  function openPixForm() {
    const cur = Store.get().profile.pix || {};
    let type = cur.type || 'cpf';
    UI.openSheet({
      title: 'Meu Pix',
      html: `
        <form class="form" autocomplete="off" novalidate>
          ${UI.help('Cadastre a chave em que você recebe. Nas contas <b>a receber</b>, o app cria o <b>Pix copia e cola</b> e o <b>QR Code</b> já com o valor certo. O nome e a cidade devem ser iguais aos do seu banco.', { title: 'Receber por Pix' })}
          ${UI.help('O app <b>não sabe</b> se o cliente pagou. Quando o dinheiro cair na sua conta, toque em <b>Recebi</b>.', { tone: 'warn', force: true })}
          <div class="field"><span>Tipo da chave</span><div class="chips" data-types></div></div>
          <label class="field"><span>Sua chave Pix</span>
            <input type="text" name="key" maxlength="80" autocapitalize="off" spellcheck="false" value="${esc(cur.key || '')}">
          </label>
          <label class="field"><span>Seu nome <em>(como aparece no banco)</em></span>
            <input type="text" name="name" maxlength="40" placeholder="Ex.: Maria da Silva" value="${esc(cur.name || Store.get().profile.name || '')}">
          </label>
          <label class="field"><span>Sua cidade</span>
            <input type="text" name="city" maxlength="30" placeholder="Ex.: Recife" value="${esc(cur.city || '')}">
          </label>
          <div class="actions">
            ${cur.key ? '<button type="button" class="btn danger-ghost" data-clear>Remover</button>' : ''}
            <button type="submit" class="btn primary grow">Salvar Pix</button>
          </div>
        </form>`,
      onMount(body, sheet) {
        const form = body.querySelector('form');
        const el = form.elements;
        const chips = body.querySelector('[data-types]');

        function paint() {
          const t = C.Pix.KEY_TYPES.find((x) => x.id === type);
          chips.innerHTML = C.Pix.KEY_TYPES.map((x) => `
            <button type="button" class="chip ${x.id === type ? 'active' : ''}" data-type="${x.id}" aria-pressed="${x.id === type}">${esc(x.label)}</button>`).join('');
          el.key.placeholder = t.placeholder;
          el.key.inputMode = type === 'email' ? 'email' : type === 'random' ? 'text' : 'numeric';
        }
        chips.addEventListener('click', (e) => {
          const b = e.target.closest('[data-type]');
          if (b) { type = b.dataset.type; paint(); }
        });
        paint();

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const ok = safely(() => {
            const key = C.Pix.validateKey(type, el.key.value);
            const name = el.name.value.trim();
            const city = el.city.value.trim();
            C.Pix.build({ key, name, city }); // só para validar nome e cidade com mensagens claras
            Store.setProfile({ pix: { type, key, name, city } });
            UI.toast('Pix salvo', 'success');
            return true;
          });
          if (ok) sheet.close();
        });

        const clear = body.querySelector('[data-clear]');
        if (clear) {
          clear.addEventListener('click', async () => {
            const yes = await UI.confirmDialog({ title: 'Remover Pix?', message: 'As cobranças deixam de levar o Pix copia e cola.', okLabel: 'Remover', danger: true });
            if (!yes) return;
            Store.setProfile({ pix: null });
            UI.toast('Pix removido', 'info');
            sheet.close();
          });
        }
      },
    });
  }

  /* ======================================================================
     Conta (entrar / criar conta) — sincronização na nuvem
     ====================================================================== */
  function openAccountForm() {
    const Sync = C.Sync;
    if (!Sync || !Sync.isConfigured()) { UI.toast('A conta ainda não está disponível neste app', 'info'); return; }
    let mode = 'in'; // 'in' = entrar, 'up' = criar conta

    UI.openSheet({
      title: 'Minha conta',
      html: `
        <form class="form" autocomplete="on" novalidate>
          ${UI.help('Com uma conta, seus dados ficam guardados na nuvem e você usa o Caderninho em outros aparelhos. <b>O app continua funcionando sem internet</b>: o que você anotar é enviado quando a internet voltar.', { title: 'Para que serve' })}
          <div class="seg" role="group" aria-label="Entrar ou criar conta">
            <button type="button" class="seg-btn" data-m="in">Entrar</button>
            <button type="button" class="seg-btn" data-m="up">Criar conta</button>
          </div>
          <label class="field"><span>Seu e-mail</span>
            <input type="email" name="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="120" placeholder="voce@exemplo.com">
          </label>
          <label class="field"><span>Senha <em data-pw-hint></em></span>
            <input type="password" name="password" autocomplete="current-password" maxlength="72">
          </label>
          <label class="check"><input type="checkbox" name="show"> Mostrar a senha</label>
          <p class="form-msg" data-msg role="alert" hidden></p>
          <div class="actions">
            <button type="submit" class="btn primary grow" data-submit>Entrar</button>
          </div>
          <button type="button" class="link center" data-forgot>Esqueci minha senha</button>
        </form>`,
      onMount(body, sheet) {
        const form = body.querySelector('form');
        const el = form.elements;
        const msg = body.querySelector('[data-msg]');
        const submit = body.querySelector('[data-submit]');
        const forgot = body.querySelector('[data-forgot]');
        let busy = false;
        let lastPending = null; // entrada que parou no aviso de 'outra conta' (para não repetir o cadastro)

        function say(text, tone) {
          msg.hidden = !text;
          msg.textContent = text || '';
          msg.className = 'form-msg' + (tone ? ' ' + tone : '');
        }
        function paint() {
          body.querySelectorAll('.seg-btn').forEach((b) => {
            const on = b.dataset.m === mode;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
          });
          submit.textContent = mode === 'in' ? 'Entrar' : 'Criar minha conta';
          el.password.autocomplete = mode === 'in' ? 'current-password' : 'new-password';
          body.querySelector('[data-pw-hint]').textContent = mode === 'up' ? '(mínimo 8 caracteres)' : '';
          forgot.hidden = mode !== 'in';
          say('');
        }
        function setBusy(on) {
          busy = on;
          submit.disabled = on;
          forgot.disabled = on;
          if (on) submit.textContent = 'Aguarde…'; else paint2();
        }
        const cleanMail = (v) => String(v || '').trim().toLowerCase();
        function paint2() { submit.textContent = mode === 'in' ? 'Entrar' : 'Criar minha conta'; }

        body.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => { if (!busy) { mode = b.dataset.m; paint(); } }));
        el.show.addEventListener('change', () => { el.password.type = el.show.checked ? 'text' : 'password'; });
        paint();

        /** Pergunta antes de trocar de conta; só continua (e apaga os dados locais) se a pessoa confirmar. */
        async function confirmSwitch(pending) {
          lastPending = pending;
          const yes = await UI.confirmDialog({
            title: 'Trocar de conta?',
            message: 'Este aparelho tem dados de outra conta. Para entrar nesta, esses dados serão removidos daqui (eles continuam salvos na outra conta). Deseja continuar?',
            okLabel: 'Trocar de conta', danger: true,
          });
          if (yes) return run(pending);
          return undefined;
        }

        async function run(pending) {
          setBusy(true); say('');
          try {
            if (pending) {
              await Sync.continueWith(pending);
              UI.toast('Conta conectada', 'success');
              sheet.close();
            } else if (mode === 'in') {
              await Sync.signIn(el.email.value, el.password.value);
              UI.toast('Conta conectada', 'success');
              sheet.close();
            } else {
              const r = await Sync.signUp(el.email.value, el.password.value);
              if (r.needsConfirm) {
                mode = 'in'; paint();
                say('Enviamos um e-mail de confirmação. Abra o e-mail, toque no link e depois volte aqui para entrar.', 'ok');
              } else {
                UI.toast('Conta criada e conectada', 'success');
                sheet.close();
              }
            }
          } catch (e) {
            if (e && e.code === 'other-account') {
              setBusy(false);
              return await confirmSwitch(e.pending);
            }
            say((e && e.message) || 'Não deu certo. Tente de novo.', 'bad');
          } finally {
            if (busy) setBusy(false);
          }
          return undefined;
        }

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          if (busy) return;
          // já se identificou e parou no aviso de troca? pergunta de novo (nunca apaga sem confirmar)
          if (lastPending && cleanMail(el.email.value) === lastPending.user.email) confirmSwitch(lastPending); else run(null);
        });

        forgot.addEventListener('click', async () => {
          if (busy) return;
          setBusy(true); say('');
          try {
            await Sync.recover(el.email.value);
            say('Se esse e-mail tiver conta, você vai receber um link para criar uma nova senha.', 'ok');
          } catch (e) {
            say((e && e.message) || 'Não deu certo. Tente de novo.', 'bad');
          } finally { setBusy(false); }
        });
      },
    });
  }

  /* ---------- Ações globais ---------- */
  A['pix:settings'] = () => openPixForm();
  A['account:open'] = () => openAccountForm();
  A['account:sync'] = async () => {
    const r = await C.Sync.syncNow();
    if (r && r.offline) UI.toast('Sem internet. Sincroniza quando voltar.', 'info');
    else if (r && r.ok) UI.toast('Tudo sincronizado', 'success');
    else if (r && r.error) UI.toast(r.error, 'error');
  };
  A['account:signout'] = async () => {
    const yes = await UI.confirmDialog({
      title: 'Sair da conta?',
      message: 'Seus dados continuam neste aparelho e na nuvem, mas param de sincronizar até você entrar de novo.',
      okLabel: 'Sair',
    });
    if (!yes) return;
    await C.Sync.signOut();
    UI.toast('Você saiu da conta', 'info');
  };
  A['offline:check'] = async () => {
    const r = await C.Offline.checkUpdate();
    if (!r.supported) UI.toast('O modo offline não está ligado neste endereço', 'info');
    else if (r.error) UI.toast('Não consegui procurar agora. Veja a internet.', 'error');
    else if (r.found) UI.toast('Versão nova encontrada. Toque em Atualizar.', 'success');
    else UI.toast('Você já está com a versão mais nova', 'success');
  };
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

  C.Forms = { openTransactionForm, openBillForm, openGoalForm, openDepositForm, openNameForm, openPixForm, openAccountForm, safely };
})(typeof window !== 'undefined' ? window : globalThis);
