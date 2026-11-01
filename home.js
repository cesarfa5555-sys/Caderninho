/* ==========================================================================
   Caderninho — views/home.js  (#/home)
   Resumo do mês, progresso (sequência + nível), alertas de contas, meta e
   últimas anotações.
   Cada view exporta { render() } que devolve uma string de HTML.
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

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }

  function streakCard(s) {
    const st = Game.streak(s);
    const lvl = Game.levelFor(s.game.xp);
    let msg;
    if (st.loggedToday) msg = 'Sequência garantida hoje.';
    else if (st.atRisk) msg = 'Anote algo hoje para não perder a sequência!';
    else msg = 'Anote hoje para começar sua sequência.';
    return `
      <section class="card" aria-label="Seu progresso">
        <div class="streak-line">
          <span class="streak-flame" aria-hidden="true">${I(st.count > 0 ? 'flame' : 'sprout')}</span>
          <div>
            <b>${st.count} ${st.count === 1 ? 'dia seguido' : 'dias seguidos'}</b>
            <p>${msg}</p>
          </div>
        </div>
        <hr class="soft">
        <div class="lvl-head"><b>Nível ${lvl.level} · ${esc(lvl.title)}</b><small>${lvl.into}/${lvl.span} XP</small></div>
        ${UI.progressBar(lvl.progress)}
        ${UI.help('<b>Sequência</b> são os dias seguidos em que você anotou algo. <b>XP</b> são pontos que você ganha usando o app; com XP suficiente você sobe de <b>nível</b>.', { tone: 'tip', title: 'Como funciona o progresso' })}
      </section>`;
  }

  function alertsCard(today) {
    const due = Store.openBills().filter((b) => U.diffDays(today, b.dueDate) <= 3).slice(0, 3);
    if (!due.length) return '';
    return `
      <section class="card" aria-label="Contas para ficar de olho">
        <div class="card-title"><h2>${I('clock')} Fique de olho</h2><a class="link" href="#/contas">Ver contas</a></div>
        <div class="list">
          ${due.map((b) => {
            const late = U.diffDays(today, b.dueDate) < 0;
            return `
            <a class="row" href="#/contas">
              <span class="row-ico ${late ? 'late' : ''}" aria-hidden="true">${I(b.kind === 'receive' ? 'banknote' : 'receipt')}</span>
              <span class="row-main"><b>${esc(b.title)}</b><small class="${late ? 'late' : ''}">${U.dueLabel(b.dueDate)}</small></span>
              <span class="amount ${b.kind === 'receive' ? 'in' : 'out'}">${U.formatMoney(b.amount)}</span>
            </a>`;
          }).join('')}
        </div>
        ${UI.help('Aparecem aqui as contas que já venceram ou vencem em até 3 dias. Toque numa delas para ir às suas contas.')}
      </section>`;
  }

  function goalCard(s) {
    const g = s.goals.find((x) => !x.doneAt) || s.goals[0];
    if (!g) {
      return `
        <section class="card">
          <div class="card-title"><h2>${I('target')} Suas metas</h2></div>
          <p class="muted">Guardar um pouquinho todo mês muda a vida. Que tal criar sua primeira meta?</p>
          <button type="button" class="btn ghost block" style="margin-top:12px" data-action="goal:new">Criar uma meta</button>
          ${UI.help('<b>Meta</b> é um valor que você quer juntar, como uma reserva de emergência ou uma viagem.')}
        </section>`;
    }
    return `
      <section class="card">
        <div class="card-title"><h2>${I('target')} ${esc(g.title)}</h2><a class="link" href="#/metas">Ver metas</a></div>
        ${UI.progressBar(g.saved / g.target, 'green')}
        <div class="goal-meta" style="margin-top:8px"><span>${U.formatMoney(g.saved)}</span><span>de ${U.formatMoney(g.target)}</span></div>
        ${UI.help('A barra mostra quanto da meta você já juntou. Em <b>Ver metas</b> você guarda mais dinheiro.')}
      </section>`;
  }

  function render() {
    const s = Store.get();
    const today = U.today();
    const mk = U.monthKey(today);
    const range = U.monthRange(mk);
    const month = Store.txInRange(range.from, range.to);
    const t = Store.totals(month);
    const name = s.profile.name ? `, ${esc(U.firstName(s.profile.name))}` : '';
    const empty = s.transactions.length === 0 && s.bills.length === 0;
    const recent = Store.recentTx(5);

    return `
      <div>
        <h1 class="page-title">${greeting()}${name}</h1>
        <p class="page-sub">Vamos ver como está o seu mês.</p>
      </div>

      <section class="card balance" aria-label="Saldo do mês">
        <p class="eyebrow">Sobrou em ${U.monthName(mk)}</p>
        <p class="big ${t.net < 0 ? 'neg' : ''}">${U.formatMoney(t.net)}</p>
        <div class="split">
          <div><small>Entrou</small><b>${U.formatMoney(t.in)}</b></div>
          <div><small>Saiu</small><b>${U.formatMoney(t.out)}</b></div>
        </div>
        ${t.saved > 0 ? `<p class="saved-note">${I('target')} Guardado em metas: ${U.formatMoney(t.saved)}</p>` : ''}
        <div class="quick">
          <button type="button" class="btn b-in" data-action="tx:new" data-type="in">${I('plus')} Entrou</button>
          <button type="button" class="btn" data-action="tx:new" data-type="out">${I('minus')} Saiu</button>
        </div>
      </section>

      ${UI.help('<b>Sobrou</b> é tudo o que entrou menos tudo o que saiu neste mês. Toque em <b>Entrou</b> quando receber dinheiro e em <b>Saiu</b> quando gastar. O botão <b>+</b> lá embaixo faz o mesmo.', { title: 'Comece por aqui' })}

      ${empty ? `
        <section class="card">
          ${UI.emptyState('notebook', 'Seu caderninho está vazio',
            'Toque em “Entrou” ou “Saiu” para fazer a primeira anotação. Ou veja o app com dados de exemplo.',
            '<button type="button" class="btn ghost" data-action="demo:load">Ver com exemplo</button>')}
        </section>` : ''}

      ${streakCard(s)}
      ${alertsCard(today)}
      ${goalCard(s)}

      ${recent.length ? `
        <section class="card" aria-label="Últimas anotações">
          <div class="card-title"><h2>${I('book')} Últimas anotações</h2><a class="link" href="#/lancamentos">Ver tudo</a></div>
          <div class="list">${recent.map(UI.txRow).join('')}</div>
          ${UI.help('Toque numa anotação para corrigir ou excluir.')}
        </section>` : ''}`;
  }

  C.Actions['demo:load'] = async () => {
    const s = Store.get();
    if (s.transactions.length || s.bills.length) {
      const yes = await UI.confirmDialog({ title: 'Carregar exemplo?', message: 'Isso substitui o que você já anotou por dados de exemplo.', okLabel: 'Carregar', danger: true });
      if (!yes) return;
    }
    Store.loadDemo();
    C.Game.evaluate({ silent: true });
    UI.toast('Dados de exemplo carregados', 'success');
  };

  C.Views.home = { render };
})(typeof window !== 'undefined' ? window : globalThis);
