/* ==========================================================================
   Caderninho — views/bills.js  (#/contas)
   Contas a pagar e a receber, lembretes de vencimento e cobrança por WhatsApp.
   ========================================================================== */
(function (global) {
  'use strict';

  const C = global.Caderninho;
  const U = C.Utils;
  const Store = C.Store;
  const Game = C.Game;
  const UI = C.UI;
  const esc = U.escapeHTML;
  const I = C.Icons.svg;

  const local = { filter: 'all' };
  const FILTERS = [
    { id: 'all', label: 'Todas' },
    { id: 'pay', label: I('receipt') + ' A pagar' },
    { id: 'receive', label: I('banknote') + ' A receber' },
  ];

  function billCard(b, today) {
    const n = U.diffDays(today, b.dueDate);
    const late = n < 0;
    const isRecv = b.kind === 'receive';
    const who = isRecv && b.person ? ` · ${esc(b.person)}` : '';
    return `
      <article class="card bill-card">
        <button type="button" class="bill-top" data-action="bill:open" data-id="${b.id}" aria-label="Abrir ${esc(b.title)}">
          <span class="row-ico ${late ? 'late' : isRecv ? 'in' : 'out'}" aria-hidden="true">${I(isRecv ? 'banknote' : 'receipt')}</span>
          <span class="row-main">
            <b>${esc(b.title)}${b.recurring ? ' <span class="tag">todo mês</span>' : ''}</b>
            <small class="${late ? 'late' : ''}">${U.dueLabel(b.dueDate)}${who}</small>
          </span>
          <span class="amount ${isRecv ? 'in' : 'out'}">${U.formatMoney(b.amount)}</span>
        </button>
        <div class="bill-actions">
          <button type="button" class="btn primary small grow" data-action="bill:settle" data-id="${b.id}">${I('check')} ${isRecv ? 'Recebi' : 'Paguei'}</button>
          ${isRecv ? `<button type="button" class="btn wa small grow" data-action="bill:charge" data-id="${b.id}">${I('message')} Cobrar</button>
          <button type="button" class="btn ghost small grow" data-action="pix:show" data-id="${b.id}">${I('qr')} Pix</button>` : ''}
        </div>
        ${isRecv && b.lastChargeAt ? `<p class="hint">Última cobrança enviada em ${U.formatDate(b.lastChargeAt)}.</p>` : ''}
      </article>`;
  }

  function section(title, items, today) {
    if (!items.length) return '';
    return `<h2 class="section-title">${title}</h2>${items.map((b) => billCard(b, today)).join('')}`;
  }

  function render() {
    const today = U.today();
    const open = Store.openBills().filter((b) => local.filter === 'all' || b.kind === local.filter);
    const overdue = open.filter((b) => U.diffDays(today, b.dueDate) < 0);
    const soon = open.filter((b) => { const n = U.diffDays(today, b.dueDate); return n >= 0 && n <= 7; });
    const later = open.filter((b) => U.diffDays(today, b.dueDate) > 7);
    const done = Store.doneBills(20).filter((b) => local.filter === 'all' || b.kind === local.filter).slice(0, 5);

    const all30 = Store.openBills().filter((b) => U.diffDays(today, b.dueDate) <= 30);
    const toPay = U.sum(all30.filter((b) => b.kind === 'pay'), (b) => b.amount);
    const toReceive = U.sum(all30.filter((b) => b.kind === 'receive'), (b) => b.amount);

    return `
      <div>
        <h1 class="page-title">Suas contas</h1>
        <p class="page-sub">Não deixe nada vencer. Nós lembramos você.</p>
      </div>

      ${UI.help('<b>A pagar</b> são as suas contas, como luz, aluguel e internet. <b>A receber</b> é dinheiro que alguém ainda vai te pagar. Quando pagar ou receber, toque no botão verde da conta para dar baixa (e ganhar XP).', { title: 'Para que serve esta tela' })}

      <div class="two-up">
        <div class="stat"><small>A pagar (30 dias)</small><b class="neg">${U.formatMoney(toPay)}</b></div>
        <div class="stat"><small>A receber (30 dias)</small><b class="pos">${U.formatMoney(toReceive)}</b></div>
      </div>

      <div class="two-up">
        <button type="button" class="btn primary" data-action="bill:new" data-kind="pay">${I('plus')} Conta a pagar</button>
        <button type="button" class="btn ghost" data-action="bill:new" data-kind="receive">${I('plus')} A receber</button>
      </div>

      ${UI.help('Em contas <b>a receber</b>, o botão <b>Cobrar</b> abre o WhatsApp com a mensagem pronta. Para isso, cadastre o número do cliente com DDD. Contas marcadas <b>todo mês</b> voltam sozinhas depois de pagas. Cadastre sua chave em <b>Perfil &gt; Meu Pix</b> e a cobrança já vai com o <b>Pix copia e cola</b>; o botão <b>Pix</b> mostra o QR Code.', { tone: 'tip' })}

      <div class="filters" role="group" aria-label="Filtrar contas">
        ${FILTERS.map((f) => `<button type="button" class="pill ${local.filter === f.id ? 'active' : ''}" data-action="bill:filter" data-filter="${f.id}">${f.label}</button>`).join('')}
      </div>

      ${open.length === 0 ? `
        <section class="card">
          ${UI.emptyState('check-circle', 'Tudo em dia!', 'Nenhuma conta pendente por aqui. Cadastre as suas para receber lembretes.')}
        </section>` : ''}

      ${section(I('alert') + ' Atrasadas', overdue, today)}
      ${section(I('calendar') + ' Próximos 7 dias', soon, today)}
      ${section(I('calendar-days') + ' Mais para frente', later, today)}

      ${done.length ? `
        <h2 class="section-title">${I('check-circle')} Resolvidas recentemente</h2>
        <section class="card list" style="padding:4px 14px">
          ${done.map((b) => `
            <button type="button" class="row" data-action="bill:open" data-id="${b.id}">
              <span class="row-ico ${b.kind === 'receive' ? 'in' : 'out'}" aria-hidden="true">${I('check')}</span>
              <span class="row-main"><b>${esc(b.title)}</b><small>${b.kind === 'receive' ? 'Recebida' : 'Paga'} em ${U.formatDate(b.paidAt)}</small></span>
              <span class="amount ${b.kind === 'receive' ? 'in' : 'out'}">${U.formatMoney(b.amount)}</span>
            </button>`).join('')}
        </section>` : ''}`;
  }

  /* ---------- Ações ---------- */
  C.Actions['bill:filter'] = (el) => { local.filter = el.dataset.filter; C.App.render(); };

  C.Actions['bill:settle'] = (el) => {
    const b = Store.getBill(el.dataset.id);
    if (!b) return;
    Game.lastGain = 0;
    const res = Store.settleBill(b.id);
    if (!res) return;
    const xp = Game.lastGain ? ` +${Game.lastGain} XP` : '';
    const nextTxt = res.next ? ` Próxima: ${U.formatDate(res.next.dueDate)}.` : '';
    UI.toast(`${b.kind === 'receive' ? 'Recebido!' : 'Conta paga!'}${xp}${nextTxt}`, 'success');
  };

  C.Actions['bill:open'] = (el) => {
    const b = Store.getBill(el.dataset.id);
    if (!b) return;
    if (b.status === 'open') { C.Forms.openBillForm({ bill: b }); return; }
    // conta já resolvida: só dá para desfazer ou excluir
    UI.openSheet({
      title: esc(b.title),
      html: `
        <p>${b.kind === 'receive' ? 'Recebida' : 'Paga'} em <b>${U.formatDate(b.paidAt)}</b> · ${U.formatMoney(b.amount)}</p>
        <div class="actions">
          <button type="button" class="btn danger-ghost" data-del>Excluir</button>
          <button type="button" class="btn primary grow" data-undo>Desfazer</button>
        </div>`,
      onMount(body, sheet) {
        body.querySelector('[data-undo]').addEventListener('click', () => {
          Store.reopenBill(b.id);
          UI.toast('Voltou para as contas abertas', 'info');
          sheet.close();
        });
        body.querySelector('[data-del]').addEventListener('click', () => {
          Store.deleteBill(b.id);
          sheet.close();
        });
      },
    });
  };

  /** Monta a mensagem e abre o WhatsApp com ela pronta. */
  function chargeMessage(b) {
    const n = U.diffDays(U.today(), b.dueDate);
    const hi = b.person ? `Olá, ${U.firstName(b.person)}! Tudo bem?` : 'Olá! Tudo bem?';
    const base = `Passando para lembrar do pagamento de "${b.title}", no valor de ${U.formatMoney(b.amount)}`;
    if (n < 0) return `${hi} ${base}, que venceu no dia ${U.formatDate(b.dueDate)}. Consegue me confirmar quando puder pagar? Obrigado!`;
    return `${hi} ${base}, com vencimento em ${U.formatDate(b.dueDate)}. Qualquer dúvida é só me chamar. Obrigado!`;
  }

  /** Mensagem da cobrança + (se a pessoa cadastrou a chave) o Pix copia e cola. */
  function chargeText(b) {
    let msg = chargeMessage(b);
    let pix = null;
    try { pix = C.Pix.forBill(b, { qr: false }); } catch (e) { pix = null; }
    if (pix) msg += `\n\nPara pagar por Pix, copie o código abaixo e cole no app do seu banco (Pix copia e cola):\n${pix.code}`;
    return msg;
  }

  /** Mostra o QR Code e o Pix copia e cola de uma conta a receber. */
  C.Actions['pix:show'] = (el) => {
    const b = Store.getBill(el.dataset.id);
    if (!b) return;
    let pix = null;
    if (C.Pix.getConfig()) {
      try { pix = C.Pix.forBill(b); } catch (e) { UI.toast(e.message || 'Não consegui criar o Pix', 'error'); return; }
    }
    if (!pix) {
      UI.openSheet({
        title: 'Cobrar por Pix',
        html: `
          ${UI.help('Para gerar o QR Code e o Pix copia e cola, cadastre primeiro a sua chave Pix, o nome e a cidade. É rápido e só precisa fazer uma vez.', { title: 'Falta a sua chave', force: true })}
          <div class="actions"><button type="button" class="btn primary grow" data-setup>${I('qr')} Cadastrar minha chave</button></div>`,
        onMount(body, sheet) {
          body.querySelector('[data-setup]').addEventListener('click', () => { sheet.close(); C.Forms.openPixForm(); });
        },
      });
      return;
    }
    UI.openSheet({
      title: 'Cobrar por Pix',
      html: `
        <div class="pix-box">
          <div class="qr-wrap">${pix.svg}</div>
          <p class="pix-amount">${U.formatMoney(b.amount)}</p>
          <p class="hint">${esc(b.title)}${b.person ? ' · ' + esc(b.person) : ''}</p>
        </div>
        ${UI.help('O cliente pode <b>apontar a câmera do app do banco</b> para o QR Code, ou <b>copiar o código</b> abaixo e colar em &quot;Pix copia e cola&quot;. Quando o dinheiro cair, toque em <b>Recebi</b> na conta.', { tone: 'tip' })}
        <label class="field"><span>Pix copia e cola</span>
          <textarea class="pix-code" readonly rows="4" aria-label="Código Pix copia e cola">${esc(pix.code)}</textarea>
        </label>
        <div class="actions">
          <button type="button" class="btn primary grow" data-copy>${I('copy')} Copiar código</button>
          <button type="button" class="btn wa grow" data-wa>${I('message')} WhatsApp</button>
        </div>`,
      onMount(body, sheet) {
        body.querySelector('[data-copy]').addEventListener('click', async () => {
          const ok = await C.Pix.copyText(pix.code);
          UI.toast(ok ? 'Código copiado' : 'Não consegui copiar. Segure o texto para copiar.', ok ? 'success' : 'error');
        });
        body.querySelector('[data-wa]').addEventListener('click', () => {
          sheet.close();
          C.Actions['bill:charge']({ dataset: { id: b.id } });
        });
      },
    });
  };

  C.Actions['bill:charge'] = (el) => {
    const b = Store.getBill(el.dataset.id);
    if (!b) return;
    if (!b.phone) {
      UI.toast('Adicione o WhatsApp do cliente para cobrar', 'info');
      C.Forms.openBillForm({ bill: b });
      return;
    }
    const phone = U.normalizePhoneBR(b.phone);
    if (!phone) {
      UI.toast('Esse número de WhatsApp parece errado. Confira com o DDD.', 'error');
      C.Forms.openBillForm({ bill: b });
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(chargeText(b))}`;
    global.open(url, '_blank', 'noopener');
    Game.lastGain = 0;
    Store.markChargeSent(b.id);
    UI.toast(Game.lastGain ? `Cobrança pronta! +${Game.lastGain} XP` : 'Cobrança pronta!', 'success');
  };

  C.Views.contas = { render, chargeMessage, chargeText };
})(typeof window !== 'undefined' ? window : globalThis);
