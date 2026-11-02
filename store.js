/* ==========================================================================
   Caderninho — store.js
   Estado único do app + persistência em localStorage + eventos.

   Para trocar localStorage por um backend (Firebase, Supabase, API própria),
   mexa apenas em load() e save() — o resto do app só fala com a Store.

   Eventos emitidos (Store.on): 'transaction:added', 'bill:settled',
   'charge:sent', 'goal:created', 'goal:deposit', 'goal:done'
   ========================================================================== */
(function (global) {
  'use strict';

  const C = (global.Caderninho = global.Caderninho || {});
  const U = C.Utils;
  const KEY = 'caderninho:v1';

  /* ---------- Categorias ---------- */
  const CATEGORIES = {
    out: [
      { id: 'mercado', icon: 'cart', label: 'Mercado' },
      { id: 'comida', icon: 'utensils', label: 'Comida' },
      { id: 'transporte', icon: 'bus', label: 'Transporte' },
      { id: 'casa', icon: 'home', label: 'Casa' },
      { id: 'contas', icon: 'receipt', label: 'Contas' },
      { id: 'saude', icon: 'pill', label: 'Saúde' },
      { id: 'filhos', icon: 'backpack', label: 'Filhos' },
      { id: 'trabalho', icon: 'wrench', label: 'Trabalho' },
      { id: 'lazer', icon: 'smile', label: 'Lazer' },
      { id: 'outros', icon: 'package', label: 'Outros' },
    ],
    in: [
      { id: 'servico', icon: 'briefcase', label: 'Serviço' },
      { id: 'venda', icon: 'bag', label: 'Venda' },
      { id: 'recebimento', icon: 'banknote', label: 'Recebimento' },
      { id: 'extra', icon: 'sparkles', label: 'Extra' },
      { id: 'outros_in', icon: 'inbox', label: 'Outros' },
    ],
  };
  // Categoria interna (não aparece na lista): dinheiro guardado em metas.
  const META_CAT = { id: 'meta', icon: 'target', label: 'Guardado em meta' };
  const FALLBACK_CAT = { id: 'outros', icon: 'package', label: 'Outros' };

  function category(id) {
    if (id === META_CAT.id) return META_CAT;
    return CATEGORIES.out.concat(CATEGORIES.in).find((c) => c.id === id) || FALLBACK_CAT;
  }

  /* ---------- Estado ---------- */
  function defaultState() {
    return {
      version: 1,
      profile: { name: '', welcomed: false, createdAt: Date.now(), updatedAt: 0 }, // + pix, hideHelp, muteSound
      transactions: [], // {id,type:'in'|'out',amount,category,note,date,createdAt,billId?,goalId?}
      bills: [],        // {id,kind:'pay'|'receive',title,amount,dueDate,recurring,recurDay,status:'open'|'done',person,phone,paidAt,lastChargeAt,nextId,createdAt}
      goals: [],        // {id,title,target,saved,doneAt,createdAt}
      game: { xp: 0, achievements: {}, days: [], daily: { date: '', count: 0 }, chargesSent: 0 },
      // lápides de exclusão {k:'t'|'b'|'g', id, at}. Sem elas, a sincronização "ressuscitaria" o que foi apagado.
      deleted: [],
    };
    // Todo registro tem updatedAt (ms). A sincronização usa isso para saber qual versão é a mais nova.
  }

  let state = defaultState();
  const listeners = new Set();
  const handlers = {};

  function migrate(raw) {
    const base = defaultState();
    const s = Object.assign(base, raw || {});
    s.profile = Object.assign(base.profile, (raw && raw.profile) || {});
    s.game = Object.assign(defaultState().game, (raw && raw.game) || {});
    ['transactions', 'bills', 'goals', 'deleted'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    // dados antigos (sem updatedAt) passam a usar a data de criação
    ['transactions', 'bills', 'goals'].forEach((k) => s[k].forEach((r) => { if (!r.updatedAt) r.updatedAt = r.createdAt || 0; }));
    return s;
  }

  function load() {
    try {
      const raw = global.localStorage.getItem(KEY);
      if (raw) state = migrate(JSON.parse(raw));
    } catch (e) {
      console.warn('[Caderninho] não consegui ler os dados salvos', e);
      state = defaultState();
    }
    return state;
  }

  function save() {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[Caderninho] não consegui salvar', e);
      if (C.UI) C.UI.toast('Não consegui salvar neste aparelho', 'error');
    }
  }

  function change() {
    save();
    listeners.forEach((fn) => fn(state));
  }

  const get = () => state;
  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const on = (name, fn) => { (handlers[name] = handlers[name] || []).push(fn); };
  const emit = (name, payload) => (handlers[name] || []).forEach((fn) => fn(payload));

  /** Atalho para mexer no estado de qualquer lugar: Store.update(s => { ... }) */
  function update(fn) { fn(state); change(); }

  /** Marca o registro como alterado agora (a sincronização compara isso). */
  const touch = (o) => { o.updatedAt = Date.now(); return o; };

  /** Guarda a lápide de uma exclusão. k: 't' lançamento, 'b' conta, 'g' meta. */
  function tombstone(k, id) { state.deleted.push({ k, id, at: Date.now() }); }

  /**
   * Chamada depois de TROCAR todos os dados (restaurar backup, apagar tudo, exemplo):
   * o que sumiu vira exclusão e o que entrou vale como "alterado agora", assim a
   * sincronização entende que foi uma substituição e não mistura com a nuvem.
   */
  function finishReplace(old) {
    const now = Date.now();
    const deleted = (state.deleted || []).concat(old.deleted || []);
    [['transactions', 't'], ['bills', 'b'], ['goals', 'g']].forEach(([col, k]) => {
      const keep = new Set(state[col].map((r) => r.id));
      old[col].forEach((r) => { if (!keep.has(r.id)) deleted.push({ k, id: r.id, at: now }); });
      state[col].forEach((r) => { r.updatedAt = now; });
    });
    state.deleted = deleted;
    state.profile.updatedAt = now;
  }

  /* ---------- Lançamentos ---------- */
  function addTransaction(data, opts = {}) {
    const amount = Math.round(Number(data.amount));
    if (!(amount > 0)) throw new Error('Digite um valor maior que zero');
    const type = data.type === 'in' ? 'in' : 'out';
    const tx = {
      id: U.uid(),
      type,
      amount,
      category: data.category || (type === 'in' ? 'extra' : 'outros'),
      note: String(data.note || '').trim().slice(0, 80),
      date: data.date || U.today(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (data.billId) tx.billId = data.billId;
    if (data.goalId) tx.goalId = data.goalId;
    state.transactions.push(tx);
    if (!opts.silent) emit('transaction:added', tx);
    change();
    return tx;
  }

  const getTransaction = (id) => state.transactions.find((t) => t.id === id) || null;

  function updateTransaction(id, patch) {
    const tx = getTransaction(id);
    if (!tx) return null;
    if (patch.amount != null) {
      const a = Math.round(Number(patch.amount));
      if (!(a > 0)) throw new Error('Digite um valor maior que zero');
      tx.amount = a;
    }
    if (patch.type) tx.type = patch.type === 'in' ? 'in' : 'out';
    if (patch.category) tx.category = patch.category;
    if (patch.note != null) tx.note = String(patch.note).trim().slice(0, 80);
    if (patch.date) tx.date = patch.date;
    touch(tx);
    change();
    return tx;
  }

  function deleteTransaction(id) {
    state.transactions = state.transactions.filter((t) => t.id !== id);
    tombstone('t', id);
    change();
  }

  const sortTx = (a, b) => (b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const txInRange = (from, to) =>
    state.transactions.filter((t) => t.date >= from && t.date <= to).sort(sortTx);
  const recentTx = (n) => state.transactions.slice().sort(sortTx).slice(0, n);

  /** Totais de uma lista. "saved" = dinheiro guardado em metas (não conta como gasto). */
  function totals(list) {
    let inn = 0; let out = 0; let saved = 0;
    list.forEach((t) => {
      if (t.type === 'in') inn += t.amount;
      else if (t.category === 'meta') saved += t.amount;
      else out += t.amount;
    });
    return { in: inn, out, saved, net: inn - out - saved };
  }

  function byCategory(list, type) {
    const map = {};
    list.forEach((t) => {
      if (t.type !== type || t.category === 'meta') return;
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.keys(map)
      .map((id) => Object.assign({}, category(id), { id, total: map[id] }))
      .sort((a, b) => b.total - a.total);
  }

  /* ---------- Contas (a pagar / a receber) ---------- */
  function addBill(data) {
    const amount = Math.round(Number(data.amount));
    const title = String(data.title || '').trim();
    if (!title) throw new Error('Dê um nome para a conta');
    if (!(amount > 0)) throw new Error('Digite um valor maior que zero');
    const dueDate = data.dueDate || U.today();
    const bill = {
      id: U.uid(),
      kind: data.kind === 'receive' ? 'receive' : 'pay',
      title: title.slice(0, 50),
      amount,
      dueDate,
      recurring: !!data.recurring,
      recurDay: U.fromISO(dueDate).getDate(),
      status: 'open',
      person: String(data.person || '').trim().slice(0, 40),
      phone: String(data.phone || '').trim().slice(0, 20),
      paidAt: null,
      lastChargeAt: null,
      nextId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.bills.push(bill);
    change();
    return bill;
  }

  const getBill = (id) => state.bills.find((b) => b.id === id) || null;

  function updateBill(id, patch) {
    const b = getBill(id);
    if (!b) return null;
    if (patch.title != null) {
      const t = String(patch.title).trim();
      if (!t) throw new Error('Dê um nome para a conta');
      b.title = t.slice(0, 50);
    }
    if (patch.amount != null) {
      const a = Math.round(Number(patch.amount));
      if (!(a > 0)) throw new Error('Digite um valor maior que zero');
      b.amount = a;
    }
    if (patch.kind) b.kind = patch.kind === 'receive' ? 'receive' : 'pay';
    if (patch.dueDate) { b.dueDate = patch.dueDate; b.recurDay = U.fromISO(patch.dueDate).getDate(); }
    if (patch.recurring != null) b.recurring = !!patch.recurring;
    if (patch.person != null) b.person = String(patch.person).trim().slice(0, 40);
    if (patch.phone != null) b.phone = String(patch.phone).trim().slice(0, 20);
    touch(b);
    change();
    return b;
  }

  function deleteBill(id) {
    state.bills = state.bills.filter((b) => b.id !== id);
    tombstone('b', id);
    change();
  }

  /** Marca como paga/recebida, cria o lançamento correspondente e a próxima parcela (se recorrente). */
  function settleBill(id) {
    const b = getBill(id);
    if (!b || b.status === 'done') return null;
    const today = U.today();
    b.status = 'done';
    b.paidAt = today;
    touch(b);
    const tx = {
      id: U.uid(),
      type: b.kind === 'receive' ? 'in' : 'out',
      amount: b.amount,
      category: b.kind === 'receive' ? 'recebimento' : 'contas',
      note: b.title,
      date: today,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      billId: b.id,
    };
    state.transactions.push(tx);
    let next = null;
    if (b.recurring) {
      next = Object.assign({}, b, {
        id: U.uid(),
        dueDate: U.addMonths(b.dueDate, 1, b.recurDay),
        status: 'open',
        paidAt: null,
        lastChargeAt: null,
        nextId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      b.nextId = next.id;
      state.bills.push(next);
    }
    emit('bill:settled', { bill: b, tx, next });
    change();
    return { bill: b, tx, next };
  }

  /** Desfaz um pagamento: apaga o lançamento e a próxima parcela (se ainda estiver intocada). */
  function reopenBill(id) {
    const b = getBill(id);
    if (!b || b.status !== 'done') return null;
    state.transactions.filter((t) => t.billId === id).forEach((t) => tombstone('t', t.id));
    state.transactions = state.transactions.filter((t) => t.billId !== id);
    if (b.nextId) {
      const n = getBill(b.nextId);
      if (n && n.status === 'open') {
        state.bills = state.bills.filter((x) => x.id !== n.id);
        tombstone('b', n.id);
      }
    }
    b.status = 'open';
    b.paidAt = null;
    b.nextId = null;
    touch(b);
    change();
    return b;
  }

  function markChargeSent(id) {
    const b = getBill(id);
    if (!b) return;
    b.lastChargeAt = U.today();
    touch(b);
    state.game.chargesSent = (state.game.chargesSent || 0) + 1;
    emit('charge:sent', b);
    change();
  }

  const openBills = () =>
    state.bills.filter((b) => b.status === 'open').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const doneBills = (n) =>
    state.bills.filter((b) => b.status === 'done')
      .sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || '')).slice(0, n || 10);

  /* ---------- Metas ---------- */
  function addGoal(data) {
    const title = String(data.title || '').trim();
    const target = Math.round(Number(data.target));
    if (!title) throw new Error('Dê um nome para a meta');
    if (!(target > 0)) throw new Error('Digite quanto você quer juntar');
    const goal = { id: U.uid(), title: title.slice(0, 40), target, saved: 0, doneAt: null, createdAt: Date.now(), updatedAt: Date.now() };
    state.goals.push(goal);
    emit('goal:created', goal);
    change();
    return goal;
  }

  const getGoal = (id) => state.goals.find((g) => g.id === id) || null;

  function deleteGoal(id) {
    state.goals = state.goals.filter((g) => g.id !== id);
    tombstone('g', id);
    change();
  }

  /** Guarda dinheiro na meta. Vira uma "saída" na categoria interna 'meta'. */
  function depositGoal(id, amount) {
    const g = getGoal(id);
    const a = Math.round(Number(amount));
    if (!g) return null;
    if (!(a > 0)) throw new Error('Digite um valor maior que zero');
    g.saved += a;
    touch(g);
    state.transactions.push({
      id: U.uid(), type: 'out', amount: a, category: 'meta',
      note: `Guardado: ${g.title}`, date: U.today(), createdAt: Date.now(), updatedAt: Date.now(), goalId: g.id,
    });
    const justDone = !g.doneAt && g.saved >= g.target;
    if (justDone) g.doneAt = U.today();
    emit('goal:deposit', { goal: g, amount: a });
    if (justDone) emit('goal:done', g);
    change();
    return g;
  }

  /* ---------- Perfil / dados ---------- */
  function setProfile(patch) {
    Object.assign(state.profile, patch);
    state.profile.updatedAt = Date.now();
    change();
  }

  function exportJSON() {
    return JSON.stringify({ app: 'caderninho', exportedAt: new Date().toISOString(), data: state }, null, 2);
  }

  function importJSON(text) {
    const obj = JSON.parse(text);
    const data = obj && obj.data ? obj.data : obj;
    if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.bills)) {
      throw new Error('Esse arquivo não parece ser um backup do Caderninho');
    }
    const old = state;
    state = migrate(data);
    state.profile.welcomed = true;
    finishReplace(old);
    change();
  }

  function reset() {
    const old = state;
    state = defaultState();
    state.profile.welcomed = true;
    finishReplace(old);
    change();
  }

  /** Dados de exemplo para testar/demonstrar o app. Substitui os dados atuais (mantém nome, Pix e preferências). */
  function loadDemo() {
    const old = state;
    state = defaultState();
    state.profile = Object.assign({}, old.profile, { welcomed: true });
    const t = U.today();
    const d = (n) => U.addDays(t, -n);
    const rows = [
      ['in', 'servico', 18000, 'Faxina — Dona Lúcia', 0],
      ['out', 'mercado', 8450, 'Feira da semana', 0],
      ['out', 'transporte', 1200, 'Passagem ida e volta', 1],
      ['in', 'venda', 6500, 'Bolo de pote', 1],
      ['out', 'comida', 2800, 'Almoço na rua', 2],
      ['in', 'servico', 22000, 'Escova e unhas — cliente fixa', 3],
      ['out', 'trabalho', 4500, 'Produtos de limpeza', 3],
      ['out', 'casa', 9000, 'Gás de cozinha', 4],
      ['in', 'extra', 5000, 'Ajuda da mãe', 5],
      ['out', 'saude', 3200, 'Farmácia', 6],
      ['in', 'servico', 15000, 'Faxina — Sr. Paulo', 7],
      ['out', 'mercado', 12000, 'Compras do mês', 9],
      ['out', 'lazer', 3500, 'Sorvete com as crianças', 10],
      ['in', 'recebimento', 30000, 'Recebido de cliente', 12],
      ['out', 'filhos', 7500, 'Material escolar', 14],
    ];
    rows.forEach(([type, cat, amount, note, ago], i) => {
      state.transactions.push({ id: U.uid(), type, amount, category: cat, note, date: d(ago), createdAt: Date.now() - i * 1000 });
      if (!state.game.days.includes(d(ago))) state.game.days.push(d(ago));
    });
    const goal = { id: U.uid(), title: 'Reserva de emergência', target: 100000, saved: 25000, doneAt: null, createdAt: Date.now() };
    state.goals.push(goal);
    state.transactions.push({ id: U.uid(), type: 'out', amount: 25000, category: 'meta', note: `Guardado: ${goal.title}`, date: d(8), createdAt: Date.now() - 99999, goalId: goal.id });
    const bill = (kind, title, amount, due, extra) => Object.assign({
      id: U.uid(), kind, title, amount, dueDate: U.addDays(t, due), recurring: false,
      recurDay: U.fromISO(U.addDays(t, due)).getDate(), status: 'open', person: '', phone: '',
      paidAt: null, lastChargeAt: null, nextId: null, createdAt: Date.now(),
    }, extra || {});
    state.bills.push(
      bill('pay', 'Aluguel', 80000, -1, { recurring: true }),
      bill('pay', 'Conta de luz', 14290, 2, { recurring: true }),
      bill('pay', 'Internet', 9990, 9, { recurring: true }),
      bill('receive', 'Faxina da Dona Lúcia', 18000, 1, { person: 'Lúcia', phone: '(81) 90000-0000' }),
      bill('receive', 'Bolo de aniversário', 12000, -3, { person: 'Carla' }),
    );
    state.game.xp = 120;
    finishReplace(old);
    change();
  }

  /* ---------- Sincronização: mescla de dois estados ---------- */
  const TOMBSTONE_TTL = 90 * 24 * 3600 * 1000; // lápides com mais de 90 dias são descartadas

  const clone = (o) => JSON.parse(JSON.stringify(o));
  /** Ordem total e determinística: mais novo primeiro; empate decide pelo texto (assim A+B == B+A). */
  const newer = (x, y) => {
    if ((x.updatedAt || 0) !== (y.updatedAt || 0)) return (x.updatedAt || 0) > (y.updatedAt || 0);
    return JSON.stringify(x) > JSON.stringify(y);
  };

  /**
   * Junta dois estados SEM perder nada de nenhum dos lados (função pura, não mexe no app).
   *  • Lançamentos, contas e metas: junta pelo id; se os dois lados têm o mesmo registro, vale o mais novo.
   *  • Exclusão: vale se for mais nova que a última alteração do registro (senão o registro "volta").
   *  • Pontos (XP) e contadores: vale o maior. Conquistas e dias de sequência: união.
   *  • Perfil: campo a campo, o lado mais novo ganha.
   *  • Metas: o valor guardado é recalculado a partir dos depósitos (dois aparelhos podem depositar ao mesmo tempo).
   * mergeStates(a, b) é igual a mergeStates(b, a).
   */
  function mergeStates(a, b, now) {
    const A = migrate(clone(a));
    const B = migrate(clone(b));
    const out = defaultState();
    const clock = now || Date.now();

    const tombs = new Map();
    A.deleted.concat(B.deleted).forEach((d) => {
      const key = d.k + ':' + d.id;
      const cur = tombs.get(key);
      if (!cur || d.at > cur.at) tombs.set(key, d);
    });

    const survivors = new Set();
    [['transactions', 't'], ['bills', 'b'], ['goals', 'g']].forEach(([col, k]) => {
      const byId = new Map();
      A[col].concat(B[col]).forEach((r) => {
        const cur = byId.get(r.id);
        if (!cur || newer(r, cur)) byId.set(r.id, r);
      });
      out[col] = Array.from(byId.values()).filter((r) => {
        const t = tombs.get(k + ':' + r.id);
        if (t && t.at >= (r.updatedAt || 0)) return false; // apagado depois da última alteração
        survivors.add(k + ':' + r.id);
        return true;
      }).sort((x, y) => ((x.createdAt || 0) - (y.createdAt || 0)) || (x.id < y.id ? -1 : 1));
    });
    out.deleted = Array.from(tombs.values())
      .filter((d) => !survivors.has(d.k + ':' + d.id) && d.at > clock - TOMBSTONE_TTL)
      .sort((x, y) => (x.at - y.at) || (x.id < y.id ? -1 : 1));

    // metas: o guardado vem da soma dos depósitos que existem de fato
    out.goals.forEach((g) => {
      const deps = out.transactions.filter((t) => t.goalId === g.id && t.category === 'meta');
      if (!deps.length) return;
      g.saved = deps.reduce((s, t) => s + t.amount, 0);
      if (g.saved >= g.target && !g.doneAt) g.doneAt = deps.map((t) => t.date).sort().pop();
    });

    // jogo
    const ga = A.game; const gb = B.game;
    out.game.xp = Math.max(ga.xp || 0, gb.xp || 0);
    out.game.chargesSent = Math.max(ga.chargesSent || 0, gb.chargesSent || 0);
    const ach = {};
    [ga.achievements || {}, gb.achievements || {}].forEach((m) => Object.keys(m).forEach((id) => {
      if (!ach[id] || m[id] < ach[id]) ach[id] = m[id];
    }));
    out.game.achievements = ach;
    out.game.days = Array.from(new Set((ga.days || []).concat(gb.days || []))).sort().slice(-400);
    const da = ga.daily || { date: '', count: 0 }; const db = gb.daily || { date: '', count: 0 };
    out.game.daily = da.date !== db.date ? (da.date > db.date ? da : db) : { date: da.date, count: Math.max(da.count, db.count) };

    // perfil
    const [older, newerP] = newer(A.profile, B.profile) ? [B.profile, A.profile] : [A.profile, B.profile];
    out.profile = Object.assign({}, older, newerP);
    out.profile.welcomed = !!(A.profile.welcomed || B.profile.welcomed);
    out.profile.createdAt = Math.min(A.profile.createdAt || Infinity, B.profile.createdAt || Infinity);
    if (!Number.isFinite(out.profile.createdAt)) out.profile.createdAt = clock;
    out.profile.updatedAt = Math.max(A.profile.updatedAt || 0, B.profile.updatedAt || 0);
    return out;
  }

  /** Cópia independente dos dados atuais (é isso que vai para a nuvem). */
  const snapshot = () => clone(state);

  /** Troca o estado por `next` (já mesclado) e avisa as telas. */
  function replaceState(next) {
    state = migrate(clone(next));
    change();
  }

  C.Store = {
    CATEGORIES, category,
    load, save, get, subscribe, on, emit, update,
    snapshot, replaceState, merge: mergeStates,
    addTransaction, getTransaction, updateTransaction, deleteTransaction, txInRange, recentTx,
    totals, byCategory,
    addBill, getBill, updateBill, deleteBill, settleBill, reopenBill, markChargeSent, openBills, doneBills,
    addGoal, getGoal, deleteGoal, depositGoal,
    setProfile, exportJSON, importJSON, reset, loadDemo,
  };
})(typeof window !== 'undefined' ? window : globalThis);
