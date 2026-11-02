/* ==========================================================================
   Caderninho — offline.js
   Registra o Service Worker (sw.js), avisa quando há versão nova e mostra o
   estado da internet no topo do app.

   • Só funciona em endereço http(s) (não em file://) e, fora do localhost, só em https.
   • O app em si não depende disso: sem Service Worker ele funciona igual, só que
     precisa de internet para abrir.
   • ?sw=off no endereço desliga o modo offline e apaga o cache (para desenvolver).
   ========================================================================== */
(function (global) {
  'use strict';

  const C = (global.Caderninho = global.Caderninho || {});
  const I = (n) => C.Icons.svg(n);

  const nav = global.navigator;
  let reg = null;
  let swState = 'unsupported'; // unsupported | registering | ready
  let wasControlled = false;
  let reloading = false;
  let started = false;
  let lastOnline = true;

  const online = () => !(nav && nav.onLine === false);
  const supported = () => !!(nav && nav.serviceWorker) && /^https?:$/.test(global.location.protocol);

  /* ---------- Indicador no topo ---------- */
  function paint() {
    const el = document.getElementById('netChip');
    if (!el) return;
    const sync = C.Sync ? C.Sync.status() : { loggedIn: false, state: 'off' };
    let kind = ''; let icon = ''; let text = '';
    if (!online()) { kind = 'off'; icon = 'wifi-off'; text = 'Sem internet'; }
    else if (sync.loggedIn && sync.state === 'syncing') { kind = 'busy'; icon = 'refresh'; text = 'Sincronizando'; }
    else if (sync.loggedIn && sync.state === 'error') { kind = 'err'; icon = 'cloud-off'; text = 'Não sincronizou'; }
    if (!kind) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.className = 'chip-net ' + kind;
    el.setAttribute('aria-label', text);
    el.innerHTML = I(icon) + '<span>' + text + '</span>';
  }

  /* ---------- Faixa "nova versão" ---------- */
  function showUpdate(worker) {
    if (document.getElementById('updateBar')) return;
    const bar = document.createElement('div');
    bar.id = 'updateBar';
    bar.className = 'update-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>' + I('download') + 'Nova versão do Caderninho disponível.</span>' +
      '<button type="button" class="btn small primary" data-update>Atualizar</button>' +
      '<button type="button" class="icon-btn" data-later aria-label="Depois">' + I('x') + '</button>';
    document.body.appendChild(bar);
    bar.querySelector('[data-update]').addEventListener('click', () => {
      bar.querySelector('[data-update]').disabled = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
    bar.querySelector('[data-later]').addEventListener('click', () => bar.remove());
  }

  function track(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      // "installed" com alguém já controlando a página = é uma atualização (e não a 1ª instalação)
      if (worker.state === 'installed' && nav.serviceWorker.controller) showUpdate(worker);
    });
  }

  /* ---------- Registro ---------- */
  async function register() {
    wasControlled = !!nav.serviceWorker.controller;
    swState = wasControlled ? 'ready' : 'registering';
    nav.serviceWorker.addEventListener('controllerchange', () => {
      if (wasControlled && !reloading) { reloading = true; global.location.reload(); return; }
      wasControlled = true; swState = 'ready'; paint(); rerenderProfile();
    });
    try {
      reg = await nav.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    } catch (e) {
      swState = 'unsupported';
      return;
    }
    track(reg.installing);
    reg.addEventListener('updatefound', () => track(reg.installing));
    if (reg.waiting && nav.serviceWorker.controller) showUpdate(reg.waiting);
    nav.serviceWorker.ready.then(() => { swState = 'ready'; rerenderProfile(); }).catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden && online()) reg.update().catch(() => {}); });
  }

  function rerenderProfile() {
    if (C.App && C.App.currentRoute && C.App.currentRoute() === 'perfil') C.App.render();
  }

  /** Desliga o modo offline e apaga o cache (uso em desenvolvimento: abrir com ?sw=off). */
  async function disable() {
    try {
      const regs = await nav.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      const keys = await global.caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('caderninho-')).map((k) => global.caches.delete(k)));
    } catch (e) { /* ignore */ }
    const url = new URL(global.location.href);
    url.searchParams.delete('sw');
    global.history.replaceState(null, '', url.pathname + url.search + url.hash);
    if (C.UI) C.UI.toast('Modo offline desligado e cache apagado', 'info');
  }

  function init() {
    if (started) return;
    started = true;
    lastOnline = online();
    global.addEventListener('online', () => {
      paint();
      if (!lastOnline && C.UI) C.UI.toast('A internet voltou', 'success');
      lastOnline = true;
      if (reg) reg.update().catch(() => {});
    });
    global.addEventListener('offline', () => {
      paint();
      if (lastOnline && C.UI) C.UI.toast('Sem internet. Você pode continuar anotando normalmente.', 'info');
      lastOnline = false;
    });
    if (C.Sync) C.Sync.subscribe(paint);
    paint();

    if (!supported()) return;
    if (/[?&]sw=off\b/.test(global.location.search)) { disable(); return; }
    register();
  }

  /** Texto para a tela de Perfil. */
  function info() {
    if (!supported()) {
      const secure = /^https?:$/.test(global.location.protocol);
      return { state: 'unsupported', text: secure ? 'Este navegador não permite o modo offline.' : 'Para usar sem internet, abra o app por um endereço da internet (https), não direto do arquivo.' };
    }
    if (swState === 'ready') return { state: 'ready', text: 'Pronto: o app abre e funciona sem internet.' };
    return { state: 'registering', text: 'Preparando o app para funcionar sem internet…' };
  }

  /** Procura versão nova agora (botão no Perfil). */
  async function checkUpdate() {
    if (!reg) return { found: false, supported: supported() };
    try { await reg.update(); } catch (e) { return { found: false, error: true }; }
    await new Promise((r) => setTimeout(r, 1200));
    return { found: !!(reg.waiting || reg.installing), supported: true };
  }

  C.Offline = { init, info, paint, checkUpdate, disable, isOnline: online };
})(typeof window !== 'undefined' ? window : globalThis);
