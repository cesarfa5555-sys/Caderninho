/* ==========================================================================
   Caderninho — ui.js
   Peças visuais reutilizáveis: toast, bottom-sheet (modal), confirmação,
   e trechos de HTML compartilhados entre as telas.
   ========================================================================== */
(function (global) {
  'use strict';

  const C = (global.Caderninho = global.Caderninho || {});
  const U = C.Utils;
  const esc = U.escapeHTML;

  /* ---------- Toast ---------- */
  const TOAST_ICON = { success: 'check-circle', error: 'alert', gold: 'trophy', info: 'info' };

  function toast(msg, kind) {
    const box = document.getElementById('toasts');
    if (!box) return;
    while (box.children.length >= 3) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast toast-' + (kind || 'info');
    el.innerHTML = C.Icons.svg(TOAST_ICON[kind] || 'info') + '<span></span>';
    el.lastChild.textContent = msg;
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 250);
    }, 3400);
  }

  /* ---------- Bottom sheet ---------- */
  function openSheet(opts) {
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    backdrop.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}">
        <div class="sheet-grip" aria-hidden="true"></div>
        <div class="sheet-head">
          <h2>${esc(opts.title)}</h2>
          <button type="button" class="icon-btn" data-close aria-label="Fechar">${C.Icons.svg('x')}</button>
        </div>
        <div class="sheet-body">${opts.html}</div>
      </div>`;
    document.body.appendChild(backdrop);
    document.body.classList.add('no-scroll');
    const prevFocus = document.activeElement;
    let closed = false;

    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      if (!document.querySelector('.sheet-backdrop')) document.body.classList.remove('no-scroll');
      if (prevFocus && prevFocus.focus) { try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    backdrop.querySelector('[data-close]').addEventListener('click', close);

    const body = backdrop.querySelector('.sheet-body');
    const sheet = { el: backdrop, body, close };
    if (opts.onMount) opts.onMount(body, sheet);
    const first = body.querySelector('input:not([type=hidden]):not([type=checkbox]), textarea');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    return sheet;
  }

  /** Pergunta sim/não. Devolve Promise<boolean>. */
  function confirmDialog(opts) {
    return new Promise((resolve) => {
      openSheet({
        title: opts.title || 'Tem certeza?',
        html: `
          <p class="confirm-msg">${esc(opts.message || '')}</p>
          <div class="actions">
            <button type="button" class="btn ghost grow" data-no>Cancelar</button>
            <button type="button" class="btn ${opts.danger ? 'danger' : 'primary'} grow" data-yes>${esc(opts.okLabel || 'Confirmar')}</button>
          </div>`,
        onMount(body, sheet) {
          body.querySelector('[data-yes]').addEventListener('click', () => { resolve(true); sheet.close(); });
          body.querySelector('[data-no]').addEventListener('click', () => sheet.close());
        },
        onClose: () => resolve(false),
      });
    });
  }

  /* ---------- HTML compartilhado ---------- */
  function money(cents, type) {
    const sign = type === 'in' ? '+ ' : type === 'out' ? '− ' : '';
    return sign + U.formatMoney(cents);
  }

  function txRow(tx) {
    const cat = C.Store.category(tx.category);
    const isSaved = tx.category === 'meta';
    const cls = isSaved ? 'saved' : tx.type;
    return `
      <button type="button" class="row" data-action="tx:edit" data-id="${tx.id}">
        <span class="row-ico ${cls}" aria-hidden="true">${C.Icons.svg(cat.icon)}</span>
        <span class="row-main">
          <b>${esc(tx.note || cat.label)}</b>
          <small>${esc(cat.label)} · ${U.formatDate(tx.date)}</small>
        </span>
        <span class="amount ${cls}">${money(tx.amount, tx.type)}</span>
      </button>`;
  }

  function progressBar(ratio, tone) {
    const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    return `<div class="bar ${tone || ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>`;
  }

  /**
   * Cardzinho de explicação (letra pequena, com ícone). Os textos são escritos
   * por nós (podem ter <b>). O usuário pode ocultar todos em Perfil > Mostrar explicações.
   * opts: { title, icon, tone: 'info' | 'tip' | 'warn', force: true (ignora o ocultar) }
   */
  function help(text, opts) {
    opts = opts || {};
    const st = C.Store && C.Store.get();
    if (!opts.force && st && st.profile.hideHelp) return '';
    const tone = opts.tone || 'info';
    const icon = opts.icon || (tone === 'tip' ? 'lightbulb' : tone === 'warn' ? 'alert' : 'help');
    return `
      <aside class="help help-${tone}" role="note">
        <span class="help-ico" aria-hidden="true">${C.Icons.svg(icon)}</span>
        <div class="help-body">${opts.title ? `<b class="help-title">${opts.title}</b>` : ''}<span>${text}</span></div>
      </aside>`;
  }

  function emptyState(icon, title, text, actionsHtml) {
    return `
      <div class="empty">
        <div class="empty-ico" aria-hidden="true">${C.Icons.svg(icon)}</div>
        <h3>${esc(title)}</h3>
        <p>${esc(text)}</p>
        ${actionsHtml || ''}
      </div>`;
  }

  C.UI = { toast, openSheet, confirmDialog, money, txRow, progressBar, emptyState, help };
})(typeof window !== 'undefined' ? window : globalThis);
