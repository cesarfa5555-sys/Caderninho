/* ==========================================================================
   Caderninho — app.js
   Roteador (hash), renderização, delegação de eventos e inicialização.

   Como criar uma tela nova:
     1) minha.js  ->  Caderninho.Views.minha = { render() { return '<html>'; } }
     2) <script src="minha.js"> no index.html (antes do app.js)
     3) Link: <a href="#/minha">  — pronto, o roteador acha sozinho.
   Como criar uma ação nova:
     Caderninho.Actions['grupo:acao'] = (elemento, evento) => { ... }
     e no HTML: <button data-action="grupo:acao" data-id="123">
   ========================================================================== */
(function (global) {
  'use strict';

  const C = global.Caderninho;
  const U = C.Utils;
  const Store = C.Store;
  const Game = C.Game;

  const TITLES = {
    home: 'Início', lancamentos: 'Anotações', contas: 'Contas',
    resumo: 'Resumo', metas: 'Metas', perfil: 'Perfil',
  };

  let lastRoute = null;
  let queued = false;

  function currentRoute() {
    const name = (global.location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return C.Views[name] ? name : 'home';
  }

  function paintChrome(route) {
    const s = Store.get();
    document.querySelectorAll('.tabbar a[data-route]').forEach((a) => {
      const on = a.dataset.route === route;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const st = Game.streak(s);
    const chip = document.getElementById('streakChip');
    if (chip) {
      chip.innerHTML = `${C.Icons.svg(st.count > 0 ? 'flame' : 'sprout')} <b>${st.count}</b>`;
      chip.classList.toggle('off', st.count === 0);
    }
    const av = document.getElementById('avatar');
    if (av) {
      if (s.profile.name && s.profile.name.trim()) av.textContent = s.profile.name.trim().charAt(0).toUpperCase();
      else av.innerHTML = C.Icons.svg('user');
    }
    document.title = `${TITLES[route] || 'Caderninho'} · Caderninho`;
  }

  /**
   * Redesenha a tela atual. Pode ser chamado à vontade: várias chamadas seguidas
   * viram um único redesenho. Usa microtask (e não requestAnimationFrame) de
   * propósito: o navegador pausa o rAF quando o app vai para segundo plano
   * (ex.: o usuário abre o WhatsApp), e a tela ficaria "congelada" ao voltar.
   */
  function render() {
    if (queued) return;
    queued = true;
    Promise.resolve().then(() => {
      queued = false;
      const route = currentRoute();
      const main = document.getElementById('view');
      main.innerHTML = C.Views[route].render();
      main.dataset.route = route;
      paintChrome(route);
      C.Icons.hydrate(main);
      if (route !== lastRoute) { global.scrollTo(0, 0); lastRoute = route; }
    });
  }

  function bindEvents() {
    // Um único ouvinte para todos os botões com data-action (inclusive dentro dos modais).
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || el.disabled) return;
      const fn = C.Actions[el.dataset.action];
      if (fn) { e.preventDefault(); fn(el, e); }
    });
    document.addEventListener('change', (e) => {
      const el = e.target.closest('[data-change]');
      if (!el) return;
      const fn = C.Actions[el.dataset.change];
      if (fn) fn(el, e);
    });
    global.addEventListener('hashchange', render);
    // se o app ficou aberto de um dia para o outro, atualiza ao voltar
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
    Store.subscribe(render);
  }

  /**
   * Calcula o tamanho da tela do aparelho e ajusta a escala de TODA a interface.
   * Referência: celular de 390 x 780. Telas menores encolhem, maiores crescem
   * (com limites). Altura baixa também reduz, para caber mais coisa sem rolar.
   * Todos os tamanhos do CSS são em rem, então tudo acompanha junto.
   */
  function fitScreen() {
    const vv = global.visualViewport;
    const w = Math.min((vv && vv.width) || global.innerWidth || 390, 480);
    const h = (vv && vv.height) || global.innerHeight || 780;
    const byWidth = w / 390;
    const byHeight = Math.max(0.86, h / 780);
    const k = Math.max(0.82, Math.min(1.1, Math.min(byWidth, byHeight + 0.14)));
    document.documentElement.style.fontSize = (15 * k).toFixed(2) + 'px';
  }

  /**
   * "Tim" de sino no fim da animação da logo, gerado na hora (sem arquivo de áudio).
   * Navegadores de celular só liberam som depois de um toque do usuário; por isso, se o som
   * ainda estiver bloqueado, ele não toca atrasado — toca no toque para pular a animação.
   */
  let audioCtx = null;
  let timPlayed = false;
  function playTim(force) {
    if (timPlayed) return;
    const st = Store.get();
    if (st && st.profile && st.profile.muteSound) { timPlayed = true; return; }
    try {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      const ctx = audioCtx;
      const ring = () => {
        if (timPlayed || ctx.state !== 'running') return;
        timPlayed = true;
        const t0 = ctx.currentTime + 0.02;
        // volume baixinho e som macio: filtro tira o brilho agudo demais
        const master = ctx.createGain();
        master.gain.value = 0.06;
        const soft = ctx.createBiquadFilter();
        soft.type = 'lowpass';
        soft.frequency.value = 3200;
        master.connect(soft); soft.connect(ctx.destination);
        // dois toquinhos de sino subindo ("ti-im"): dó agudo e depois sol
        [[1046.5, 0], [1568, 0.12]].forEach(([freq, delay]) => {
          [[1, 1, 1.0], [2, 0.25, 0.6]].forEach(([mult, vol, dur]) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            const t = t0 + delay;
            osc.type = 'sine';
            osc.frequency.value = freq * mult;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(vol, t + 0.025);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.connect(g); g.connect(master);
            osc.start(t); osc.stop(t + dur + 0.05);
          });
        });
        if (global.navigator && global.navigator.vibrate) { try { global.navigator.vibrate(15); } catch (e) { /* ignore */ } }
      };
      if (ctx.state === 'running') ring();
      else ctx.resume().then(() => { if (force) ring(); else setTimeout(ring, 0); }).catch(() => {});
    } catch (e) { /* som é opcional */ }
  }

  /** Animação de abertura: dura ~3s, toque para pular. Devolve uma Promise que resolve ao terminar. */
  function runSplash() {
    const el = document.getElementById('splash');
    if (!el) return Promise.resolve();
    const reduce = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    return new Promise((resolve) => {
      let over = false;
      function finish() {
        if (over) return;
        over = true;
        el.classList.add('leave');
        setTimeout(() => { el.remove(); resolve(); }, 450);
      }
      // toque = pular (e já libera o som, que o navegador só permite depois de um toque)
      el.addEventListener('pointerdown', () => playTim(true));
      el.addEventListener('click', finish);
      if (!reduce) setTimeout(() => playTim(false), 1900); // quando o check termina de ser desenhado
      setTimeout(finish, reduce ? 1500 : 3000);
    });
  }

  function init() {
    const splash = runSplash();
    fitScreen();
    global.addEventListener('resize', fitScreen);
    global.addEventListener('orientationchange', fitScreen);
    if (global.visualViewport) global.visualViewport.addEventListener('resize', fitScreen);
    Store.load();
    Game.init();
    Game.evaluate({ silent: true });
    bindEvents();
    render();
    // a boas-vindas só abre depois da animação (senão o teclado aparece por baixo dela)
    if (!Store.get().profile.welcomed) splash.then(() => C.Forms.openNameForm({ welcome: true }));
  }

  C.App = { init, render, currentRoute, fitScreen, playTim };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
