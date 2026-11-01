/* ==========================================================================
   Caderninho — game.js
   Gamificação: XP, níveis, sequência diária (streak) e conquistas.
   É a "marca" da Purytalent no app: finanças com cara de jogo.

   Para criar uma conquista nova, basta adicionar um item em ACHIEVEMENTS.
   ========================================================================== */
(function (global) {
  'use strict';

  const C = (global.Caderninho = global.Caderninho || {});
  const U = C.Utils;
  const Store = C.Store;

  const TITLES = ['Iniciante', 'Anotador', 'Organizado', 'Controlado', 'Craque do Caderno', 'Mestre das Contas', 'Lenda do Caderninho'];
  const XP = { transaction: 10, bill: 20, charge: 15, goalCreated: 10, goalDeposit: 10, achievement: 30 };
  const DAILY_TX_XP_CAP = 5; // só as 5 primeiras anotações do dia valem XP (evita "farmar")

  /* ---------- Níveis ---------- */
  const xpAt = (level) => 50 * level * (level - 1); // nível 2 = 100xp, 3 = 300xp, 4 = 600xp...

  function levelFor(xp) {
    let level = 1;
    while (xp >= xpAt(level + 1)) level += 1;
    const base = xpAt(level);
    const next = xpAt(level + 1);
    return {
      level,
      title: TITLES[Math.min(level, TITLES.length) - 1],
      xp, base, next,
      into: xp - base,
      span: next - base,
      progress: (xp - base) / (next - base),
    };
  }

  /* ---------- Sequência ---------- */
  /** Dias seguidos em que a pessoa anotou algo (baseado no dia real, não na data do lançamento). */
  function streak(state) {
    const days = new Set(state.game.days || []);
    const today = U.today();
    const loggedToday = days.has(today);
    let cursor = loggedToday ? today : U.addDays(today, -1);
    let count = 0;
    while (days.has(cursor)) { count += 1; cursor = U.addDays(cursor, -1); }
    return { count, loggedToday, atRisk: !loggedToday && count > 0 };
  }

  /* ---------- Conquistas ---------- */
  const ACHIEVEMENTS = [
    { id: 'first_tx', icon: 'pencil', title: 'Primeira anotação', desc: 'Anote seu primeiro lançamento.', check: (s) => s.transactions.length >= 1 },
    { id: 'tx_10', icon: 'notebook', title: 'Caderno cheio', desc: 'Chegue a 10 anotações.', check: (s) => s.transactions.length >= 10 },
    { id: 'tx_50', icon: 'library', title: 'Biblioteca', desc: 'Chegue a 50 anotações.', check: (s) => s.transactions.length >= 50 },
    { id: 'streak_3', icon: 'flame', title: 'Pegando o ritmo', desc: 'Anote 3 dias seguidos.', check: (s, x) => x.streak >= 3 },
    { id: 'streak_7', icon: 'bolt', title: 'Semana perfeita', desc: 'Anote 7 dias seguidos.', check: (s, x) => x.streak >= 7 },
    { id: 'streak_30', icon: 'crown', title: 'Hábito de ferro', desc: 'Anote 30 dias seguidos.', check: (s, x) => x.streak >= 30 },
    { id: 'first_paid', icon: 'check-circle', title: 'Conta em dia', desc: 'Pague uma conta pelo app.', check: (s) => s.bills.some((b) => b.status === 'done' && b.kind === 'pay') },
    { id: 'first_received', icon: 'banknote', title: 'Dinheiro na mão', desc: 'Receba uma conta pelo app.', check: (s) => s.bills.some((b) => b.status === 'done' && b.kind === 'receive') },
    { id: 'first_charge', icon: 'message', title: 'Cobrança enviada', desc: 'Cobre alguém pelo WhatsApp.', check: (s) => (s.game.chargesSent || 0) >= 1 },
    { id: 'first_goal', icon: 'target', title: 'Sonhando alto', desc: 'Crie sua primeira meta.', check: (s) => s.goals.length >= 1 },
    { id: 'goal_done', icon: 'trophy', title: 'Meta batida!', desc: 'Complete uma meta.', check: (s) => s.goals.some((g) => g.doneAt) },
    {
      id: 'blue_month', icon: 'heart', title: 'Mês no azul', desc: 'Ganhe mais do que gasta no mês (mín. 5 anotações).',
      check: (s) => {
        const list = s.transactions.filter((t) => t.date.startsWith(U.monthKey(U.today())));
        const t = Store.totals(list);
        return list.length >= 5 && t.in > t.out;
      },
    },
  ];

  /* ---------- XP ---------- */
  const api = { lastGain: 0, ACHIEVEMENTS, XP, TITLES };

  function gain(amount) {
    const before = levelFor(Store.get().game.xp);
    Store.update((s) => { s.game.xp += amount; });
    api.lastGain += amount;
    const after = levelFor(Store.get().game.xp);
    if (after.level > before.level && C.UI) C.UI.toast(`Nível ${after.level}: ${after.title}!`, 'gold');
  }

  function markActiveToday() {
    Store.update((s) => {
      const t = U.today();
      if (!s.game.days.includes(t)) s.game.days.push(t);
      s.game.days = s.game.days.slice(-400);
    });
  }

  /** Confere conquistas novas. Devolve a lista desbloqueada agora. */
  function evaluate(opts) {
    const silent = opts && opts.silent;
    const s = Store.get();
    const ctx = { streak: streak(s).count };
    const fresh = ACHIEVEMENTS.filter((a) => !s.game.achievements[a.id] && a.check(s, ctx));
    if (!fresh.length) return [];
    Store.update((st) => { fresh.forEach((a) => { st.game.achievements[a.id] = U.today(); }); });
    gain(fresh.length * XP.achievement);
    if (!silent && C.UI) fresh.forEach((a) => C.UI.toast(`Conquista: ${a.title}`, 'gold'));
    return fresh;
  }

  function init() {
    Store.on('transaction:added', () => {
      let earns = false;
      Store.update((s) => {
        const t = U.today();
        if (!s.game.days.includes(t)) s.game.days.push(t);
        s.game.days = s.game.days.slice(-400);
        if (s.game.daily.date !== t) s.game.daily = { date: t, count: 0 };
        s.game.daily.count += 1;
        earns = s.game.daily.count <= DAILY_TX_XP_CAP;
      });
      if (earns) gain(XP.transaction);
      evaluate();
    });
    Store.on('bill:settled', () => { markActiveToday(); gain(XP.bill); evaluate(); });
    Store.on('charge:sent', () => { gain(XP.charge); evaluate(); });
    Store.on('goal:created', () => { gain(XP.goalCreated); evaluate(); });
    Store.on('goal:deposit', () => { markActiveToday(); gain(XP.goalDeposit); evaluate(); });
  }

  Object.assign(api, { levelFor, streak, evaluate, init, gain });
  C.Game = api;
})(typeof window !== 'undefined' ? window : globalThis);
