/* ==========================================================================
   Caderninho — pix.js
   Pix "copia e cola" (BR Code estático, padrão do Banco Central) para cobrar.

   • A chave Pix, o nome e a cidade do recebedor ficam em Store.get().profile.pix
       { type: 'cpf'|'cnpj'|'phone'|'email'|'random', key, name, city }
   • O código é ESTÁTICO: o app NÃO sabe se o cliente pagou. Quem confirma é a
     pessoa, tocando em "Recebi". (Confirmação automática exige a API de um banco/PSP.)

   Uso:  Caderninho.Pix.build({ key, name, city, amountCents, txid })  -> string
         Caderninho.Pix.forBill(bill) -> { code, svg, amountCents, txid } | null
   ========================================================================== */
(function (global) {
  'use strict';

  const C = (global.Caderninho = global.Caderninho || {});

  const KEY_TYPES = [
    { id: 'cpf', label: 'CPF', hint: '11 números', placeholder: '000.000.000-00' },
    { id: 'cnpj', label: 'CNPJ', hint: '14 números', placeholder: '00.000.000/0000-00' },
    { id: 'phone', label: 'Celular', hint: 'com DDD', placeholder: '(81) 90000-0000' },
    { id: 'email', label: 'E-mail', hint: '', placeholder: 'voce@exemplo.com' },
    { id: 'random', label: 'Chave aleatória', hint: 'a que o banco gera', placeholder: '123e4567-e12b-12d1-a456-426655440000' },
  ];

  /* ---------- CRC16/CCITT-FALSE (poly 0x1021, início 0xFFFF) ---------- */
  function crc16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
      crc ^= (str.charCodeAt(i) & 0xFF) << 8;
      for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /* ---------- Validação das chaves ---------- */
  function validCPF(d) {
    if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
    for (let t = 9; t < 11; t++) {
      let sum = 0;
      for (let i = 0; i < t; i++) sum += Number(d[i]) * (t + 1 - i);
      if (((sum * 10) % 11) % 10 !== Number(d[t])) return false;
    }
    return true;
  }

  function validCNPJ(d) {
    if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
    const calc = (len) => {
      let sum = 0; let pos = len - 7;
      for (let i = len; i >= 1; i--) { sum += Number(d[len - i]) * pos--; if (pos < 2) pos = 9; }
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
  }

  /** Devolve a chave no formato que vai dentro do código, ou lança Error com a mensagem para a pessoa. */
  function validateKey(type, raw) {
    const text = String(raw || '').trim();
    if (!text) throw new Error('Digite a sua chave Pix');
    const digits = text.replace(/\D/g, '');
    switch (type) {
      case 'cpf':
        if (!validCPF(digits)) throw new Error('Esse CPF não parece correto. Confira os números.');
        return digits;
      case 'cnpj':
        if (!validCNPJ(digits)) throw new Error('Esse CNPJ não parece correto. Confira os números.');
        return digits;
      case 'phone': {
        let d = digits;
        if (d.length === 13 && d.startsWith('55')) d = d.slice(2);
        if (!/^[1-9][1-9]9\d{8}$/.test(d)) throw new Error('Celular precisa ter DDD + 9 + número (11 números).');
        return '+55' + d;
      }
      case 'email':
        if (!/^[\x21-\x7E]+@[\x21-\x7E]+\.[\x21-\x7E]+$/.test(text) || text.length > 77) throw new Error('Esse e-mail não parece correto.');
        return text.toLowerCase();
      case 'random':
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) throw new Error('A chave aleatória tem o formato 123e4567-e12b-12d1-a456-426655440000.');
        return text.toLowerCase();
      default:
        throw new Error('Escolha o tipo da chave');
    }
  }

  /** Mostra só o final da chave (para não expor tudo na tela). */
  function maskKey(type, key) {
    if (!key) return '';
    if (type === 'email') { const [u, d] = key.split('@'); return (u.slice(0, 2) + '•••@' + d); }
    return '•••' + key.slice(-4);
  }

  /* ---------- Montagem do BR Code ---------- */
  function clean(text, max) {
    return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
  }

  function tlv(id, value) {
    if (value.length > 99) throw new Error('Campo grande demais para o Pix');
    return id + String(value.length).padStart(2, '0') + value;
  }

  /** opts: { key (já normalizada), name, city, amountCents?, txid?, description? } */
  function build(opts) {
    const name = clean(opts.name, 25);
    const city = clean(opts.city, 15);
    if (!opts.key) throw new Error('Cadastre a sua chave Pix');
    if (!name) throw new Error('Informe o seu nome como aparece no banco');
    if (!city) throw new Error('Informe a sua cidade');

    let account = tlv('00', 'br.gov.bcb.pix') + tlv('01', opts.key);
    const desc = clean(opts.description, 40);
    if (desc && account.length + 4 + desc.length <= 99) account += tlv('02', desc);

    const txid = String(opts.txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
    let out = tlv('00', '01') + tlv('26', account) + tlv('52', '0000') + tlv('53', '986');
    const cents = Math.round(Number(opts.amountCents) || 0);
    if (cents > 0) {
      if (cents > 99999999999) throw new Error('Valor alto demais para o Pix');
      out += tlv('54', Math.floor(cents / 100) + '.' + String(cents % 100).padStart(2, '0'));
    }
    out += tlv('58', 'BR') + tlv('59', name) + tlv('60', city) + tlv('62', tlv('05', txid));
    out += '6304';
    return out + crc16(out);
  }

  /** Lê o primeiro nível de campos do código. Lança erro se estiver mal formado. */
  function parse(code) {
    const out = {};
    let i = 0;
    while (i < code.length) {
      const id = code.slice(i, i + 2);
      const len = parseInt(code.slice(i + 2, i + 4), 10);
      if (!/^\d\d$/.test(id) || Number.isNaN(len) || i + 4 + len > code.length) throw new Error('Código Pix mal formado');
      out[id] = code.slice(i + 4, i + 4 + len);
      i += 4 + len;
    }
    return out;
  }

  /** O CRC do final confere com o resto do código? */
  function verify(code) {
    if (typeof code !== 'string' || code.length < 12) return false;
    const body = code.slice(0, -4);
    return body.endsWith('6304') && crc16(body) === code.slice(-4).toUpperCase();
  }

  /* ---------- Ligação com o app ---------- */
  const getConfig = () => {
    const st = C.Store && C.Store.get();
    const p = st && st.profile && st.profile.pix;
    return p && p.key && p.name && p.city ? p : null;
  };

  /** Pix para uma conta a receber (valor e identificador da própria conta). */
  function forBill(bill, opts) {
    const cfg = getConfig();
    if (!cfg || !bill) return null;
    const txid = ('CAD' + String(bill.id).replace(/[^A-Za-z0-9]/g, '')).slice(0, 25);
    const code = build({ key: cfg.key, name: cfg.name, city: cfg.city, amountCents: bill.amount, txid, description: bill.title });
    const wantQR = !(opts && opts.qr === false);
    return { code, amountCents: bill.amount, txid, svg: C.QR && wantQR ? safeSvg(code) : '' };
  }

  const typeLabel = (id) => (KEY_TYPES.find((t) => t.id === id) || {}).label || 'Chave';

  /** Copia para a área de transferência (com plano B para navegadores sem a API moderna). */
  async function copyText(text) {
    try {
      if (global.navigator && global.navigator.clipboard && global.isSecureContext) {
        await global.navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* cai no plano B */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (e) { return false; }
  }

  function safeSvg(code) {
    try { return C.QR.svg(code); } catch (e) { return ''; }
  }

  C.Pix = { KEY_TYPES, typeLabel, crc16, validateKey, maskKey, build, parse, verify, getConfig, forBill, copyText, validCPF, validCNPJ };
})(typeof window !== 'undefined' ? window : globalThis);
