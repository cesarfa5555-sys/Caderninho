/* ==========================================================================
   Caderninho — views/summary.js  (#/resumo)
   Resumo em linguagem simples ("você ganhou X, gastou Y e sobrou Z"),
   comparação com o período anterior, gráfico de barras e gastos por categoria.
   ========================================================================== */
(function (global) {
  'use strict';

  const C = global.Caderninho;
  const U = C.Utils;
  const Store = C.Store;
  const UI = C.UI;
  const esc = U.escapeHTML;
  const I = C.Icons.svg;

  const local = { mode: 'week', offset: 0 }; // offset 0 = atual, -1 = anterior...
  const WEEK_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  /** Calcula {from, to, label, title} do período escolhido. */
  function period(mode, offset) {
    const today = U.today();
    if (mode === 'week') {
      const from = U.addDays(U.startOfWeek(today), offset * 7);
      const to = U.addDays(from, 6);
      const title = offset === 0 ? 'Nesta semana' : offset === -1 ? 'Na semana passada' : `De ${U.formatDate(from)} a ${U.formatDate(to)}`;
      return { from, to, label: `${U.formatDate(from)} a ${U.formatDate(to)}`, title };
    }
    const key = U.monthKey(U.addMonths(today, offset, 1));
    const r = U.monthRange(key);
    const title = offset === 0 ? 'Neste mês' : offset === -1 ? 'No mês passado' : `Em ${U.monthName(key)}`;
    return { from: r.from, to: r.to, label: U.monthLabel(key), title };
  }

  /** Divide o período em colunas: 7 dias (semana) ou blocos de 7 dias (mês). */
  function buckets(mode, p, list) {
    const cols = mode === 'week'
      ? WEEK_LABELS.map((label) => ({ label, in: 0, out: 0 }))
      : [1, 2, 3, 4, 5].map((n) => ({ label: `${(n - 1) * 7 + 1}–${n === 5 ? '31' : n * 7}`, in: 0, out: 0 }));
    list.forEach((t) => {
      const i = mode === 'week'
        ? U.diffDays(p.from, t.date)
        : Math.min(4, Math.floor((Number(t.date.slice(8, 10)) - 1) / 7));
      if (!cols[i]) return;
      if (t.type === 'in') cols[i].in += t.amount;
      else if (t.category !== 'meta') cols[i].out += t.amount;
    });
    return mode === 'month' && Number(p.to.slice(8, 10)) <= 28 ? cols.slice(0, 4) : cols;
  }

  function story(p, t, prev, isCurrent) {
    const net = `<strong class="${t.net < 0 ? 'neg' : 'pos'}">${U.formatMoney(t.net)}</strong>`;
    let text = `${p.title} você ganhou <strong class="pos">${U.formatMoney(t.in)}</strong>, gastou <strong class="neg">${U.formatMoney(t.out)}</strong> e ${t.net < 0 ? 'ficou devendo' : 'sobrou'} ${t.net < 0 ? `<strong class="neg">${U.formatMoney(-t.net)}</strong>` : net}.`;
    const tips = [];
    const tip = (icon, msg, warn) => `<span class="tip${warn ? ' warn' : ''}">${I(icon)}<span>${msg}</span></span>`;
    if (t.in === 0 && t.out === 0) {
      return `<p class="story">${p.title} você ainda não anotou nada. Que tal começar agora?</p>`;
    }
    if (prev.out > 0) {
      const diff = Math.round(((t.out - prev.out) / prev.out) * 100);
      const ref = isCurrent ? 'no período anterior inteiro' : 'no período anterior';
      if (diff <= -10) tips.push(tip('trending-down', `Você gastou ${-diff}% a menos do que ${ref}.`));
      else if (diff >= 10) tips.push(tip('alert', `Você gastou ${diff}% a mais do que ${ref}.`, true));
      else tips.push(tip('info', `Seus gastos estão parecidos com ${ref}.`));
    }
    if (t.net < 0) tips.push(tip('alert', 'Gastou mais do que ganhou. Olhe a categoria que mais pesou aqui embaixo.', true));
    else if (t.in > 0 && t.net / t.in >= 0.2) tips.push(tip('heart', 'Muito bem! Você está guardando uma boa parte do que ganha.'));
    if (t.saved > 0) tips.push(tip('target', `E ainda guardou ${U.formatMoney(t.saved)} nas suas metas.`));
    return `<p class="story">${text}${tips.join('')}</p>`;
  }

  function render() {
    const p = period(local.mode, local.offset);
    const pp = period(local.mode, local.offset - 1);
    const list = Store.txInRange(p.from, p.to);
    const t = Store.totals(list);
    const prev = Store.totals(Store.txInRange(pp.from, pp.to));
    const cols = buckets(local.mode, p, list);
    const max = Math.max(1, ...cols.map((c) => Math.max(c.in, c.out)));
    const cats = Store.byCategory(list, 'out').slice(0, 5);
    const catTotal = t.out || 1;
    const h = (v) => (v > 0 ? Math.max(4, Math.round((v / max) * 100)) : 0);

    return `
      <div>
        <h1 class="page-title">Seu resumo</h1>
        <p class="page-sub">Em palavras simples.</p>
      </div>

      ${UI.help('Aqui você vê, em palavras simples, quanto ganhou, quanto gastou e quanto sobrou. Escolha <b>Semana</b> ou <b>Mês</b> e use as setas para olhar períodos anteriores.', { title: 'Como usar o resumo' })}

      <div class="filters" role="group" aria-label="Período">
        <button type="button" class="pill ${local.mode === 'week' ? 'active' : ''}" data-action="sum:mode" data-mode="week">Semana</button>
        <button type="button" class="pill ${local.mode === 'month' ? 'active' : ''}" data-action="sum:mode" data-mode="month">Mês</button>
      </div>

      <div class="period-nav">
        <button type="button" class="icon-btn" data-action="sum:nav" data-dir="-1" aria-label="Período anterior">${I('chevron-left')}</button>
        <b>${esc(p.label)}</b>
        <button type="button" class="icon-btn" data-action="sum:nav" data-dir="1" aria-label="Próximo período" ${local.offset >= 0 ? 'disabled' : ''}>${I('chevron-right')}</button>
      </div>

      <section class="card">${story(p, t, prev, local.offset === 0)}</section>

      <section class="card" aria-label="Gráfico">
        <div class="card-title"><h2>${I('chart')} Dia a dia</h2></div>
        <div class="bars" role="img" aria-label="Gráfico de entradas e saídas">
          ${cols.map((c) => `
            <div class="col">
              <div class="pair"><i class="in" style="height:${h(c.in)}%"></i><i class="out" style="height:${h(c.out)}%"></i></div>
              <small>${c.label}</small>
            </div>`).join('')}
        </div>
        <div class="legend"><span>Entrou</span><span class="out">Saiu</span></div>
        ${UI.help('Cada par de colunas é um dia (no mês, um bloco de 7 dias). Quanto mais alta a coluna, maior o valor.')}
      </section>

      <section class="card" aria-label="Onde você mais gastou">
        <div class="card-title"><h2>${I('cart')} Onde mais gastou</h2></div>
        ${cats.length ? cats.map((c) => `
          <div class="cat-row">
            <div class="cat-top"><span>${I(c.icon)} ${esc(c.label)}</span><span>${U.formatMoney(c.total)}</span></div>
            ${UI.progressBar(c.total / catTotal, 'red')}
          </div>`).join('') : '<p class="muted">Sem gastos neste período.</p>'}
        ${UI.help('As categorias em que você mais gastou, da maior para a menor. Dinheiro guardado em metas não conta como gasto.')}
      </section>

      <button type="button" class="btn wa block" data-action="sum:share">${I('message')} Compartilhar meu resumo</button>`;
  }

  function shareText() {
    const p = period(local.mode, local.offset);
    const t = Store.totals(Store.txInRange(p.from, p.to));
    return `Meu resumo no Caderninho (${p.label})\n` +
      `Ganhei: ${U.formatMoney(t.in)}\nGastei: ${U.formatMoney(t.out)}\n` +
      `${t.net < 0 ? 'Faltou' : 'Sobrou'}: ${U.formatMoney(Math.abs(t.net))}`;
  }

  C.Actions['sum:mode'] = (el) => { local.mode = el.dataset.mode; local.offset = 0; C.App.render(); };
  C.Actions['sum:nav'] = (el) => {
    local.offset = Math.min(0, local.offset + Number(el.dataset.dir));
    C.App.render();
  };
  C.Actions['sum:share'] = async () => {
    const text = shareText();
    if (global.navigator && global.navigator.share) {
      try { await global.navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    global.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  C.Views.resumo = { render, period, shareText };
})(typeof window !== 'undefined' ? window : globalThis);
