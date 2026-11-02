/* ==========================================================================
   Caderninho — sync.js
   Conta (login) e sincronização entre aparelhos.

   COMO FUNCIONA
   • O app continua funcionando 100% sem conta. Quem entra ganha cópia na nuvem
     e pode usar o mesmo caderninho em outros aparelhos.
   • Os dados nunca "mandam" um no outro: sempre se JUNTA o aparelho com a nuvem
     (Store.merge: por registro vale o mais novo; exclusões viram "lápides").
     Assim, anotar sem internet e sincronizar depois não perde nada.
   • Fluxo de uma sincronização:  baixa a nuvem -> junta com o aparelho -> aplica
     no aparelho -> envia o resultado (só se mudou).
     O envio usa "versão": se outro aparelho gravou no meio, o servidor recusa,
     e o app baixa de novo, junta de novo e tenta outra vez (até 4 vezes).
   • Quando sincroniza: ao entrar, ao abrir o app, ao voltar a internet, ao voltar
     para o app depois de um tempo, ~2,5 s depois de cada alteração e a cada 5 min.

   ADAPTADORES (para trocar de servidor)
   Um adaptador é um objeto com estas funções (todas async). `session` é sempre
   { accessToken, refreshToken, expiresAt (ms), user: { id, email } }:
     signUp(email, senha)      -> { session | null, needsConfirm }
     signIn(email, senha)      -> session
     refresh(session)          -> session
     signOut(session)          -> (melhor esforço)
     recover(email)            -> (envia e-mail de nova senha)
     pull(session)             -> { data, version } | null
     push(session, data, versionOuNull) -> { version }   (lança SyncError('conflict') se a versão mudou)
   Erros devem ser SyncError(mensagem em português, código) com código:
     'network' | 'auth' | 'conflict' | 'server' | 'config' | 'other'
   Registre em Caderninho.Sync.Adapters.meuServidor = (config) => ({ ... }) e use
   provider: 'meuServidor' no config.js. Só existe o adaptador do Supabase (sem biblioteca,
   só fetch), testado contra um servidor simulado, não contra o Supabase de verdade.
   ========================================================================== */
(function (global) {
  'use strict';

  const C = (global.Caderninho = global.Caderninho || {});
  const Store = C.Store;

  const SESSION_KEY = 'caderninho:session'; // sessão atual (tokens)
  const LINK_KEY = 'caderninho:link';       // de qual conta são os dados deste aparelho
  const DEBOUNCE_MS = 2500;
  const TIMER_MS = 5 * 60 * 1000;
  const FOCUS_GAP_MS = 30 * 1000;
  const MAX_ATTEMPTS = 4;
  const REQUEST_TIMEOUT_MS = 15000;

  class SyncError extends Error {
    constructor(message, code) { super(message); this.name = 'SyncError'; this.code = code || 'other'; }
  }

  /* ---------- localStorage seguro ---------- */
  const lsGet = (k) => { try { return global.localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { global.localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  const lsDel = (k) => { try { global.localStorage.removeItem(k); } catch (e) { /* ignore */ } };

  /* ======================================================================
     Adaptador Supabase (Auth/GoTrue + PostgREST, só com fetch)
     ====================================================================== */
  function supabaseAdapter(cfg) {
    const base = String(cfg.url || '').replace(/\/+$/, '');
    const table = cfg.table || 'caderninho_data';

    function translate(status, body) {
      const raw = String((body && (body.error_description || body.msg || body.message || body.error)) || '');
      const low = raw.toLowerCase();
      if (/invalid login credentials/.test(low)) return new SyncError('E-mail ou senha incorretos.', 'auth');
      if (/email not confirmed/.test(low)) return new SyncError('Confirme seu e-mail (veja a caixa de entrada e o spam) e tente de novo.', 'auth');
      if (/already registered|already been registered|user already exists/.test(low)) return new SyncError('Esse e-mail já tem conta. Toque em Entrar.', 'auth');
      if (/password/.test(low) && (status === 422 || status === 400)) return new SyncError('Senha fraca ou curta demais. Use pelo menos 8 caracteres.', 'auth');
      if (/valid email|invalid email|email address.*invalid/.test(low)) return new SyncError('Esse e-mail não parece correto.', 'auth');
      if (status === 429 || /rate limit|too many/.test(low)) return new SyncError('Muitas tentativas. Espere um pouco e tente de novo.', 'other');
      if (status === 401 || status === 403 || /jwt expired|invalid jwt|invalid refresh token|refresh_token_not_found/.test(low)) return new SyncError('Sua sessão expirou. Entre de novo.', 'auth');
      if (status === 409) return new SyncError('Os dados mudaram em outro aparelho.', 'conflict');
      if (status >= 500) return new SyncError('O servidor está com problema agora. Tentamos de novo daqui a pouco.', 'server');
      return new SyncError(raw ? 'Não deu certo: ' + raw : 'Não deu certo. Tente de novo.', 'other');
    }

    async function call(path, o) {
      o = o || {};
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS) : null;
      let res;
      try {
        res = await global.fetch(base + path, {
          method: o.method || 'GET',
          headers: Object.assign({
            apikey: cfg.anonKey,
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + (o.token || cfg.anonKey),
          }, o.headers || {}),
          body: o.body === undefined ? undefined : JSON.stringify(o.body),
          signal: ctl ? ctl.signal : undefined,
          cache: 'no-store',
        });
      } catch (e) {
        throw new SyncError('Sem conexão com o servidor.', 'network');
      } finally {
        if (timer) clearTimeout(timer);
      }
      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
      if (!res.ok) throw translate(res.status, json);
      return json;
    }

    function toSession(j) {
      if (!j || !j.access_token || !j.user) return null;
      const expiresAt = j.expires_at ? j.expires_at * 1000 : Date.now() + (Number(j.expires_in) || 3600) * 1000;
      return { accessToken: j.access_token, refreshToken: j.refresh_token || '', expiresAt, user: { id: j.user.id, email: j.user.email || '' } };
    }

    return {
      async signUp(email, password) {
        const j = await call('/auth/v1/signup', { method: 'POST', body: { email, password } });
        const s = toSession(j);
        return { session: s, needsConfirm: !s };
      },
      async signIn(email, password) {
        const s = toSession(await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }));
        if (!s) throw new SyncError('Não consegui entrar. Tente de novo.', 'other');
        return s;
      },
      async refresh(session) {
        const s = toSession(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refreshToken } }));
        if (!s) throw new SyncError('Sua sessão expirou. Entre de novo.', 'auth');
        return s;
      },
      async signOut(session) {
        try { await call('/auth/v1/logout', { method: 'POST', token: session.accessToken }); } catch (e) { /* melhor esforço */ }
      },
      async recover(email) {
        await call('/auth/v1/recover', { method: 'POST', body: { email } });
      },
      async pull(session) {
        const rows = await call(`/rest/v1/${table}?select=data,version&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`, { token: session.accessToken });
        if (!Array.isArray(rows) || !rows.length) return null;
        return { data: rows[0].data, version: Number(rows[0].version) || 1 };
      },
      async push(session, data, version) {
        const prefer = { Prefer: 'return=representation' };
        if (version == null) {
          // 1ª gravação desta conta. Se outro aparelho gravou primeiro, o servidor responde 409 (conflict).
          await call(`/rest/v1/${table}`, { method: 'POST', token: session.accessToken, headers: prefer, body: { user_id: session.user.id, data, version: 1 } });
          return { version: 1 };
        }
        const rows = await call(
          `/rest/v1/${table}?user_id=eq.${encodeURIComponent(session.user.id)}&version=eq.${version}`,
          { method: 'PATCH', token: session.accessToken, headers: prefer, body: { data, version: version + 1, updated_at: new Date().toISOString() } }
        );
        if (!Array.isArray(rows) || !rows.length) throw new SyncError('Os dados mudaram em outro aparelho.', 'conflict');
        return { version: version + 1 };
      },
    };
  }

  const Adapters = { supabase: supabaseAdapter };

  /* ======================================================================
     Estado da sincronização
     ====================================================================== */
  let session = null;
  let adapterCache = null;
  let running = null;
  let again = false;
  let applying = false;
  let debounceTimer = null;
  let retryTimer = null;
  let retryCount = 0;
  let refreshing = null;
  const listeners = new Set();
  const status = { state: 'off', lastSyncAt: 0, error: '' };

  const cfg = () => (C.Config && C.Config.sync) || {};
  const online = () => !(global.navigator && global.navigator.onLine === false);

  function isConfigured() {
    const c = cfg();
    return !!(c.url && c.anonKey && Adapters[c.provider || 'supabase'] &&
      (/^https:\/\//i.test(c.url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(c.url)));
  }

  function adapter() {
    if (!isConfigured()) throw new SyncError('A conta ainda não foi configurada neste app.', 'config');
    if (!adapterCache) adapterCache = Adapters[cfg().provider || 'supabase'](cfg());
    return adapterCache;
  }

  function setStatus(patch) {
    Object.assign(status, patch);
    listeners.forEach((fn) => { try { fn(getStatus()); } catch (e) { /* ignore */ } });
    // se a pessoa está olhando o Perfil, mostra o novo estado na hora
    if (C.App && C.App.currentRoute && C.App.currentRoute() === 'perfil') C.App.render();
  }

  const getStatus = () => Object.assign({ loggedIn: !!session, email: session ? session.user.email : '', configured: isConfigured() }, status);
  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const isLoggedIn = () => !!session;

  /* ---------- Sessão ---------- */
  function saveSession() {
    if (!session) { lsDel(SESSION_KEY); return; }
    lsSet(SESSION_KEY, JSON.stringify(Object.assign({}, session, { lastSyncAt: status.lastSyncAt })));
  }

  function loadSession() {
    try {
      const s = JSON.parse(lsGet(SESSION_KEY) || 'null');
      if (s && s.accessToken && s.user && s.user.id) { status.lastSyncAt = s.lastSyncAt || 0; return s; }
    } catch (e) { /* sessão inválida: ignora */ }
    return null;
  }

  function dropSession(message) {
    session = null;
    saveSession();
    clearTimeout(debounceTimer); clearTimeout(retryTimer);
    setStatus({ state: 'off', error: message || '' });
  }

  async function refreshSession() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const next = await adapter().refresh(session);
        session = next;
        saveSession();
      } catch (e) {
        if (e.code === 'auth') dropSession('Sua sessão expirou. Entre de novo para voltar a sincronizar.');
        throw e;
      } finally { refreshing = null; }
    })();
    return refreshing;
  }

  async function withAuth(fn) {
    if (session.expiresAt - Date.now() < 60 * 1000) await refreshSession();
    try {
      return await fn(session);
    } catch (e) {
      if (e.code !== 'auth') throw e;
      await refreshSession();
      return fn(session);
    }
  }

  /* ======================================================================
     Sincronizar
     ====================================================================== */
  const canon = (st) => JSON.stringify(Store.merge(st, st));

  async function doSync() {
    setStatus({ state: 'syncing', error: '' });
    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const remote = await withAuth((s) => adapter().pull(s));

        // tudo daqui até aplicar é síncrono: nada que a pessoa anotar se perde no meio
        const local = Store.snapshot();
        const merged = remote ? Store.merge(local, remote.data) : local;
        const mergedKey = canon(merged);
        if (canon(local) !== mergedKey) {
          applying = true;
          try { Store.replaceState(merged); } finally { applying = false; }
          if (C.Game && C.Game.evaluate) C.Game.evaluate({ silent: true });
        }

        if (remote && canon(remote.data) === mergedKey) break; // nuvem já está igual: nada a enviar

        try {
          await withAuth((s) => adapter().push(s, merged, remote ? remote.version : null));
          break;
        } catch (e) {
          if (e.code === 'conflict' && attempt < MAX_ATTEMPTS - 1) continue; // outro aparelho gravou: repete
          throw e;
        }
      }
      retryCount = 0;
      setStatus({ state: 'idle', lastSyncAt: Date.now(), error: '' });
      saveSession();
      return { ok: true };
    } catch (e) {
      if (!session) return { ok: false, error: e.message }; // sessão caiu (dropSession já avisou)
      const offline = e.code === 'network' && !online();
      setStatus({ state: offline ? 'offline' : 'error', error: offline ? '' : (e.message || 'Não consegui sincronizar.') });
      if (e.code === 'network' || e.code === 'server' || e.code === 'conflict') scheduleRetry();
      return { ok: false, error: e.message };
    }
  }

  function syncNow() {
    if (!session) return Promise.resolve({ ok: false, skipped: true });
    if (!isConfigured()) return Promise.resolve({ ok: false, skipped: true });
    if (!online()) { setStatus({ state: 'offline', error: '' }); return Promise.resolve({ ok: false, offline: true }); }
    if (running) { again = true; return running; }
    clearTimeout(debounceTimer); clearTimeout(retryTimer);
    running = doSync().finally(() => {
      running = null;
      if (again) { again = false; schedule(400); }
    });
    return running;
  }

  function schedule(ms) {
    if (!session) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { syncNow(); }, ms == null ? DEBOUNCE_MS : ms);
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryCount += 1;
    const wait = Math.min(5 * 60 * 1000, 15000 * Math.pow(2, retryCount - 1));
    retryTimer = setTimeout(() => { syncNow(); }, wait);
  }

  /* ======================================================================
     Entrar, criar conta, sair
     ====================================================================== */
  const localHasData = () => {
    const s = Store.get();
    return s.transactions.length > 0 || s.bills.length > 0 || s.goals.length > 0;
  };

  /** Começa a usar uma sessão recém-criada: protege dados de outra conta e faz a 1ª sincronização. */
  async function begin(next, opts) {
    const uid = next.user.id;
    const link = lsGet(LINK_KEY);
    if (link && link !== uid) {
      if (localHasData() && !(opts && opts.replaceLocal)) {
        // a pessoa já se identificou no servidor; guardamos a sessão para continuar se ela confirmar a troca
        const err = new SyncError('Este aparelho tem dados de outra conta.', 'other-account');
        err.pending = next;
        throw err;
      }
      // dados da outra conta saem daqui (continuam na nuvem dela); sem lápides, para não "apagar" nada na nuvem
      applying = true;
      try { Store.replaceState({ profile: { welcomed: true } }); } finally { applying = false; }
    }
    session = next;
    lsSet(LINK_KEY, uid);
    saveSession();
    retryCount = 0;
    setStatus({ state: online() ? 'syncing' : 'offline', error: '' });
    return syncNow();
  }

  const cleanEmail = (e) => String(e || '').trim().toLowerCase();

  async function signIn(email, password, opts) {
    const em = cleanEmail(email);
    if (!em || !password) throw new SyncError('Digite o e-mail e a senha.', 'auth');
    const next = await adapter().signIn(em, password);
    await begin(next, opts);
    return getStatus();
  }

  async function signUp(email, password, opts) {
    const em = cleanEmail(email);
    if (!/^\S+@\S+\.\S+$/.test(em)) throw new SyncError('Esse e-mail não parece correto.', 'auth');
    if (String(password || '').length < 8) throw new SyncError('A senha precisa ter pelo menos 8 caracteres.', 'auth');
    const res = await adapter().signUp(em, password);
    if (res.needsConfirm) return { needsConfirm: true };
    await begin(res.session, opts);
    return { needsConfirm: false };
  }

  /** Continua uma entrada que parou em 'other-account', depois que a pessoa confirmou a troca. */
  async function continueWith(pending) {
    await begin(pending, { replaceLocal: true });
    return getStatus();
  }

  async function recover(email) {
    const em = cleanEmail(email);
    if (!/^\S+@\S+\.\S+$/.test(em)) throw new SyncError('Digite o e-mail da sua conta.', 'auth');
    await adapter().recover(em);
  }

  async function signOut() {
    if (!session) return;
    // última tentativa de mandar o que ainda não foi (só se tiver internet; não trava a saída)
    if (online()) { try { await Promise.race([syncNow(), new Promise((r) => setTimeout(r, 6000))]); } catch (e) { /* ignore */ } }
    const old = session;
    try { await adapter().signOut(old); } catch (e) { /* ignore */ }
    dropSession('');
  }

  /* ======================================================================
     Início
     ====================================================================== */
  function init() {
    session = isConfigured() ? loadSession() : null;
    setStatus({ state: session ? (online() ? 'idle' : 'offline') : 'off' });

    Store.subscribe(() => { if (!applying && session) schedule(); });

    global.addEventListener('online', () => { if (session) { retryCount = 0; syncNow(); } });
    global.addEventListener('offline', () => { if (session) setStatus({ state: 'offline', error: '' }); });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && session && Date.now() - status.lastSyncAt > FOCUS_GAP_MS) syncNow();
    });
    setInterval(() => { if (session && !document.hidden) syncNow(); }, TIMER_MS);

    if (session) schedule(700);
  }

  C.Sync = {
    init, isConfigured, isLoggedIn, status: getStatus, subscribe,
    signIn, signUp, signOut, recover, syncNow, continueWith,
    SyncError, Adapters,
  };
})(typeof window !== 'undefined' ? window : globalThis);
