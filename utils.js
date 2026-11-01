/* ==========================================================================
   Caderninho — utils.js
   Funções puras e reutilizáveis (dinheiro, datas, texto).
   Convenções do projeto:
     • Dinheiro SEMPRE em centavos (inteiro). Ex.: R$ 12,50 => 1250
     • Datas SEMPRE como string ISO local "AAAA-MM-DD" (sem fuso/hora)
   ========================================================================== */
(function (global) {
  'use strict';

  const C = (global.Caderninho = global.Caderninho || {});
  C.Actions = C.Actions || {}; // registro de ações disparadas por data-action="..."
  C.Views = C.Views || {};

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const pad = (n) => String(n).padStart(2, '0');
  const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MONTHS_FULL = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];

  /* ---------- Texto ---------- */
  function escapeHTML(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const firstName = (s) => String(s || '').trim().split(/\s+/)[0] || '';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ---------- Dinheiro (centavos) ---------- */
  function formatMoney(cents) {
    return brl.format((cents || 0) / 100);
  }

  /** Converte o que a pessoa digita ("1.250,50", "12,5", "12.50", "R$ 8") em centavos. */
  function parseMoney(input) {
    if (typeof input === 'number') return Math.round(input * 100);
    let s = String(input || '').replace(/[^\d.,]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // "1.250" = mil duzentos e cinquenta
    const n = parseFloat(s);
    return Number.isFinite(n) ? Math.round(n * 100 + 1e-9) : 0;
  }

  const centsToInput = (c) => (c / 100).toFixed(2).replace('.', ',');
  const sum = (list, fn) => list.reduce((acc, x) => acc + fn(x), 0);

  /* ---------- Datas ---------- */
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const today = () => toISO(new Date());

  function addDays(iso, n) {
    const d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  /** Soma meses sem estourar o dia (31/jan + 1 mês = 28/fev). `dayOverride` mantém o dia original em contas recorrentes. */
  function addMonths(iso, n, dayOverride) {
    const d = fromISO(iso);
    const day = dayOverride || d.getDate();
    const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return toISO(new Date(first.getFullYear(), first.getMonth(), Math.min(day, last)));
  }

  /** Diferença em dias (b - a). */
  const diffDays = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
  const monthKey = (iso) => iso.slice(0, 7);

  function monthRange(key) {
    const from = key + '-01';
    return { from, to: addDays(addMonths(from, 1, 1), -1) };
  }

  /** Semana começando na segunda-feira. */
  function startOfWeek(iso) {
    const back = (fromISO(iso).getDay() + 6) % 7;
    return addDays(iso, -back);
  }

  const monthName = (key) => MONTHS_FULL[Number(key.slice(5, 7)) - 1];
  const monthLabel = (key) => `${cap(monthName(key))} de ${key.slice(0, 4)}`;
  const formatDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  function formatDateFull(iso) {
    const d = fromISO(iso);
    return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
  }

  function relativeDay(iso) {
    const n = diffDays(today(), iso);
    if (n === 0) return 'Hoje';
    if (n === -1) return 'Ontem';
    if (n === 1) return 'Amanhã';
    return cap(formatDateFull(iso));
  }

  function dueLabel(iso) {
    const n = diffDays(today(), iso);
    if (n === 0) return 'vence hoje';
    if (n === 1) return 'vence amanhã';
    if (n > 1) return `vence em ${n} dias (${formatDate(iso)})`;
    if (n === -1) return 'venceu ontem';
    return `venceu há ${-n} dias`;
  }

  /* ---------- Telefone / WhatsApp ---------- */
  /** Devolve só dígitos com DDI 55, ou '' se não parecer um número brasileiro válido. */
  function normalizePhoneBR(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 10 || d.length === 11) d = '55' + d;
    return d.length >= 12 && d.length <= 13 && d.startsWith('55') ? d : '';
  }

  /* ---------- Arquivos ---------- */
  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  C.Utils = {
    escapeHTML, cap, firstName, uid,
    formatMoney, parseMoney, centsToInput, sum,
    toISO, fromISO, today, addDays, addMonths, diffDays, monthKey, monthRange, startOfWeek,
    monthName, monthLabel, formatDate, formatDateFull, relativeDay, dueLabel,
    normalizePhoneBR, download, WEEKDAYS, MONTHS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
