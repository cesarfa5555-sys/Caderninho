/* ==========================================================================
   Caderninho — qr.js
   Gerador de QR Code (sem bibliotecas). Modo byte, versões 1 a 10, correção
   de erro M (cai para L se o texto não couber). Cobre com folga um código
   Pix "copia e cola" (até ~270 caracteres).

   Uso:  Caderninho.QR.svg('texto')   -> string <svg> (preto no branco, com margem)
         Caderninho.QR.encode('texto') -> { size, version, ecc, mask, modules[y][x] }
   ========================================================================== */
(function (global) {
  'use strict';

  const C = (global.Caderninho = global.Caderninho || {});

  /* ---------- Aritmética em GF(256) e Reed-Solomon ---------- */
  const EXP = new Array(512);
  const LOG = new Array(256);
  (function init() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

  function generator(deg) {
    let poly = [1];
    for (let i = 0; i < deg; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function remainder(data, deg) {
    const gen = generator(deg);
    const rem = new Array(deg).fill(0);
    data.forEach((b) => {
      const factor = b ^ rem.shift();
      rem.push(0);
      for (let i = 0; i < deg; i++) rem[i] ^= gmul(gen[i + 1], factor);
    });
    return rem;
  }

  /* ---------- Tabelas (ISO 18004): EC por bloco e grupos [qtd, bytes de dados] ---------- */
  const SPEC = {
    M: [null,
      { ec: 10, g: [[1, 16]] }, { ec: 16, g: [[1, 28]] }, { ec: 26, g: [[1, 44]] }, { ec: 18, g: [[2, 32]] },
      { ec: 24, g: [[2, 43]] }, { ec: 16, g: [[4, 27]] }, { ec: 18, g: [[4, 31]] }, { ec: 22, g: [[2, 38], [2, 39]] },
      { ec: 22, g: [[3, 36], [2, 37]] }, { ec: 26, g: [[4, 43], [1, 44]] }],
    L: [null,
      { ec: 7, g: [[1, 19]] }, { ec: 10, g: [[1, 34]] }, { ec: 15, g: [[1, 55]] }, { ec: 20, g: [[1, 80]] },
      { ec: 26, g: [[1, 108]] }, { ec: 18, g: [[2, 68]] }, { ec: 20, g: [[2, 78]] }, { ec: 24, g: [[2, 97]] },
      { ec: 30, g: [[2, 116]] }, { ec: 18, g: [[2, 68], [2, 69]] }],
  };
  const ECC_BITS = { L: 1, M: 0 };
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  const REMAINDER_BITS = [0, 0, 7, 7, 7, 7, 7, 0, 0, 0, 0];

  const dataCodewords = (spec) => spec.g.reduce((s, [n, size]) => s + n * size, 0);

  function toBytes(text) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
    const out = [];
    unescape(encodeURIComponent(text)).split('').forEach((ch) => out.push(ch.charCodeAt(0)));
    return out;
  }

  /** Escolhe a menor versão (e nível) em que os bytes cabem. */
  function pickVersion(len, eccOrder) {
    for (const ecc of eccOrder) {
      for (let v = 1; v <= 10; v++) {
        const bits = 4 + (v <= 9 ? 8 : 16) + len * 8;
        if (bits <= dataCodewords(SPEC[ecc][v]) * 8) return { version: v, ecc };
      }
    }
    return null;
  }

  /* ---------- Dados -> palavras-código (com EC e intercalação) ---------- */
  function buildCodewords(bytes, version, ecc) {
    const spec = SPEC[ecc][version];
    const capacity = dataCodewords(spec) * 8;
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(0x4, 4);
    push(bytes.length, version <= 9 ? 8 : 16);
    bytes.forEach((b) => push(b, 8));
    push(0, Math.min(4, capacity - bits.length));
    while (bits.length % 8) bits.push(0);
    for (let pad = 0xEC; bits.length < capacity; pad ^= 0xEC ^ 0x11) push(pad, 8);

    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0;
      for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      data.push(v);
    }

    const blocks = [];
    let pos = 0;
    spec.g.forEach(([count, size]) => {
      for (let k = 0; k < count; k++) {
        const d = data.slice(pos, pos + size);
        pos += size;
        blocks.push({ d, e: remainder(d, spec.ec) });
      }
    });

    const out = [];
    const maxLen = Math.max(...blocks.map((b) => b.d.length));
    for (let i = 0; i < maxLen; i++) blocks.forEach((b) => { if (i < b.d.length) out.push(b.d[i]); });
    for (let i = 0; i < spec.ec; i++) blocks.forEach((b) => out.push(b.e[i]));
    return out;
  }

  /* ---------- Matriz ---------- */
  function makeMatrix(version) {
    const size = 17 + 4 * version;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const setFn = (x, y, dark) => { modules[y][x] = dark; fn[y][x] = true; };
    return { size, modules, fn, setFn };
  }

  function drawFunctionPatterns(m, version) {
    const { size, setFn } = m;
    for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx; const y = cy + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          setFn(x, y, dist !== 2 && dist !== 4);
        }
      }
    });
    const pos = ALIGN[version];
    pos.forEach((cy, i) => pos.forEach((cx, j) => {
      const corner = (i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0);
      if (corner) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    drawFormat(m, 'M', 0); // só reserva o espaço; o valor final entra depois da máscara
    if (version >= 7) {
      let rem = version;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const bits = (version << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = ((bits >>> i) & 1) === 1;
        const a = size - 11 + (i % 3); const b = Math.floor(i / 3);
        setFn(a, b, bit); setFn(b, a, bit);
      }
    }
  }

  function drawFormat(m, ecc, mask) {
    const { size, setFn } = m;
    const data = (ECC_BITS[ecc] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
    setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
    setFn(8, size - 8, true);
  }

  function placeData(m, codewords, version) {
    const { size, modules, fn } = m;
    const bits = [];
    codewords.forEach((cw) => { for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1); });
    for (let i = 0; i < REMAINDER_BITS[version]; i++) bits.push(0);
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!fn[y][x] && i < bits.length) { modules[y][x] = bits[i] === 1; i++; }
        }
      }
    }
  }

  const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];

  function applyMask(m, mask) {
    const { size, modules, fn } = m;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) modules[y][x] = !modules[y][x];
  }

  /** Pontuação de penalidade (regras N1–N4 da norma). Menor = melhor. */
  function penalty(modules) {
    const size = modules.length;
    let score = 0;
    const lines = [];
    for (let i = 0; i < size; i++) {
      lines.push(modules[i]);
      lines.push(modules.map((row) => row[i]));
    }
    lines.forEach((line) => {
      let run = 1;
      for (let i = 1; i <= size; i++) {
        if (i < size && line[i] === line[i - 1]) run++;
        else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      const s = line.map((v) => (v ? '1' : '0')).join('');
      const re = /(?=(0000101110|0111010000))/g;
      while (re.exec(s)) { score += 40; re.lastIndex++; }
    });
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const v = modules[y][x];
      if (v === modules[y][x + 1] && v === modules[y + 1][x] && v === modules[y + 1][x + 1]) score += 3;
    }
    const dark = modules.reduce((n, row) => n + row.filter(Boolean).length, 0);
    const total = size * size;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }

  /* ---------- API ---------- */
  function encode(text, opts) {
    opts = opts || {};
    const bytes = toBytes(String(text));
    const order = opts.ecc === 'L' ? ['L'] : ['M', 'L'];
    const pick = pickVersion(bytes.length, order);
    if (!pick) throw new Error('Texto grande demais para o QR Code');
    const { version, ecc } = pick;
    const codewords = buildCodewords(bytes, version, ecc);

    let best = null;
    for (let mask = 0; mask < 8; mask++) {
      const m = makeMatrix(version);
      drawFunctionPatterns(m, version);
      placeData(m, codewords, version);
      applyMask(m, mask);
      drawFormat(m, ecc, mask);
      const p = penalty(m.modules);
      if (!best || p < best.p) best = { p, m, mask };
    }
    return { size: best.m.size, version, ecc, mask: best.mask, modules: best.m.modules };
  }

  /** SVG preto no branco, com margem ("zona silenciosa") de 4 módulos. */
  function svg(text, opts) {
    const q = encode(text, opts);
    const margin = 4;
    const n = q.size + margin * 2;
    let d = '';
    q.modules.forEach((row, y) => {
      let x = 0;
      while (x < q.size) {
        if (!row[x]) { x++; continue; }
        let len = 0;
        while (x + len < q.size && row[x + len]) len++;
        d += `M${x + margin},${y + margin}h${len}v1h-${len}z`;
        x += len;
      }
    });
    return `<svg class="qr" viewBox="0 0 ${n} ${n}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="QR Code para pagamento">` +
      `<rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  C.QR = { encode, svg };
})(typeof window !== 'undefined' ? window : globalThis);
