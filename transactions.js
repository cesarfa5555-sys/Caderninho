/* ==========================================================================
   Caderninho — views/transactions.js  (#/lancamentos)
   Lista de anotações por mês, agrupadas por dia, com filtro entrada/saída.
   ========================================================================== */
(function (global) {
  'use strict';

  const C = global.Caderninho;
  const U = C.Utils;
  const Store = C.Store;
  const UI = C.UI;
  const I = C.Icons.svg;

  // Estado local da tela (some ao recarregar a página — de propósito)
  const local = { month: U.monthKey(U.today()), filter: 'all' };

  const FILTERS = [
    { id: 'all', label: 'Tudo' },
    { id: 'in', label: 'Entradas' },
    { id: 'out', label: 'Saídas' },
  ];

  function render() {
    const nowKey = U.monthKey(U.today());
    if (local.month > nowKey) local.month = nowKey;
    const range = U.monthRange(local.month);
    const all = Store.txInRange(range.from, range.to);
    const t = Store.totals(all);
    const list = all.filter((x) => (local.filter === 'all' ? true : x.type === local.filter));

    // agrupa por dia (a lista já vem ordenada do mais novo para o mais antigo)
    const groups = [];
    list.forEach((x) => {
      let g = groups[groups.length - 1];
      if (!g || g.date !== x.date) { g = { date: x.date, items: [] }; groups.push(g); }
      g.items.push(x);
    });

    return `
      <div>
        <h1 class="page-title">Suas anotações</h1>
        <p class="page-sub">Tudo o que entrou e saiu.</p>
      </div>

      ${UI.help('Aqui ficam todas as suas anotações, dia por dia. <b>Verde com +</b> é dinheiro que entrou; <b>vermelho com −</b> é dinheiro que saiu. Toque numa anotação para corrigir ou excluir. Para anotar algo novo, use o botão <b>+</b> lá embaixo.', { title: 'Como ler esta tela' })}

      <div class="period-nav">
        <button type="button" class="icon-btn" data-action="tx:month" data-dir="-1" aria-label="Mês anterior">${I('chevron-left')}</button>
        <b>${U.monthLabel(local.month)}</b>
        <button type="button" class="icon-btn" data-action="tx:month" data-dir="1" aria-label="Próximo mês" ${local.month >= nowKey ? 'disabled' : ''}>${I('chevron-right')}</button>
      </div>

      <div class="totals-strip">
        <div><small>Entrou</small><b class="pos">${U.formatMoney(t.in)}</b></div>
        <div><small>Saiu</small><b class="neg">${U.formatMoney(t.out)}</b></div>
        <div><small>Sobrou</small><b class="${t.net < 0 ? 'neg' : ''}">${U.formatMoney(t.net)}</b></div>
      </div>

      ${UI.help('<b>Sobrou</b> = o que entrou menos o que saiu no mês escolhido. Use as setas para ver outros meses.')}

      <div class="filters" role="group" aria-label="Filtrar">
        ${FILTERS.map((f) => `<button type="button" class="pill ${local.filter === f.id ? 'active' : ''}" data-action="tx:filter" data-filter="${f.id}">${f.label}</button>`).join('')}
      </div>

      ${groups.length ? groups.map((g) => {
        const gt = Store.totals(g.items);
        return `
          <section>
            <div class="day-head"><span>${U.relativeDay(g.date)}</span><small>${gt.net >= 0 ? '+ ' : '− '}${U.formatMoney(Math.abs(gt.net))}</small></div>
            <div class="card list" style="padding:4px 14px;margin-top:6px">${g.items.map(UI.txRow).join('')}</div>
          </section>`;
      }).join('') : `
        <section class="card">
          ${UI.emptyState('book', 'Nada por aqui',
            local.filter === 'all' ? 'Você ainda não anotou nada neste mês.' : 'Nenhuma anotação desse tipo neste mês.',
            '<button type="button" class="btn primary" data-action="tx:new" data-type="out">Fazer uma anotação</button>')}
        </section>`}`;
  }

  C.Actions['tx:month'] = (el) => {
    local.month = U.monthKey(U.addMonths(local.month + '-01', Number(el.dataset.dir), 1));
    C.App.render();
  };
  C.Actions['tx:filter'] = (el) => { local.filter = el.dataset.filter; C.App.render(); };

  C.Views.lancamentos = { render };
})(typeof window !== 'undefined' ? window : globalThis);
