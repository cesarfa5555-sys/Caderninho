/* ==========================================================================
   Caderninho — views/goals.js  (#/metas)
   Metas de economia. Guardar dinheiro vira uma "saída" na categoria interna
   'meta' (não conta como gasto no resumo).
   ========================================================================== */
(function (global) {
  'use strict';

  const C = global.Caderninho;
  const U = C.Utils;
  const Store = C.Store;
  const UI = C.UI;
  const esc = U.escapeHTML;
  const I = C.Icons.svg;

  function goalCard(g) {
    const done = !!g.doneAt;
    const missing = Math.max(0, g.target - g.saved);
    return `
      <article class="card goal">
        <div class="goal-head"><b>${I(done ? 'trophy' : 'target')} ${esc(g.title)}</b><span class="muted">${Math.min(100, Math.round((g.saved / g.target) * 100))}%</span></div>
        ${UI.progressBar(g.saved / g.target, 'green')}
        <div class="goal-meta"><span>${U.formatMoney(g.saved)} guardados</span><span>${done ? 'Meta batida!' : `faltam ${U.formatMoney(missing)}`}</span></div>
        <div class="actions">
          <button type="button" class="btn danger-ghost small" data-action="goal:delete" data-id="${g.id}" aria-label="Excluir meta ${esc(g.title)}">Excluir</button>
          ${done ? '' : `<button type="button" class="btn primary small grow" data-action="goal:deposit" data-id="${g.id}">${I('plus')} Guardar dinheiro</button>`}
        </div>
      </article>`;
  }

  function render() {
    const goals = Store.get().goals.slice().sort((a, b) => (a.doneAt ? 1 : 0) - (b.doneAt ? 1 : 0) || b.createdAt - a.createdAt);
    return `
      <div>
        <h1 class="page-title">Suas metas</h1>
        <p class="page-sub">Guardar aos poucos também é vencer.</p>
      </div>

      ${UI.help('<b>Meta</b> é um sonho com valor, como uma reserva, uma viagem ou um celular novo. Crie a meta e, sempre que separar um dinheirinho, toque em <b>Guardar dinheiro</b>. A barra mostra quanto já juntou e quanto falta. O valor guardado não conta como gasto.', { title: 'Como funcionam as metas' })}
      <button type="button" class="btn primary block" data-action="goal:new">${I('plus')} Nova meta</button>
      ${goals.length ? goals.map(goalCard).join('') : `
        <section class="card">
          ${UI.emptyState('target', 'Nenhuma meta ainda', 'Crie uma meta (reserva, viagem, celular novo…) e acompanhe o quanto já juntou.')}
        </section>`}`;
  }

  C.Actions['goal:delete'] = async (el) => {
    const g = Store.getGoal(el.dataset.id);
    if (!g) return;
    const yes = await UI.confirmDialog({ title: 'Excluir meta?', message: `A meta "${g.title}" será apagada. O dinheiro já anotado continua nas suas anotações.`, okLabel: 'Excluir', danger: true });
    if (yes) { Store.deleteGoal(g.id); UI.toast('Meta excluída', 'info'); }
  };

  C.Views.metas = { render };
})(typeof window !== 'undefined' ? window : globalThis);
