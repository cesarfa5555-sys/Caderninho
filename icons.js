/* ==========================================================================
   Caderninho — icons.js
   Biblioteca de ícones SVG (traço, 24x24, cor = currentColor).
   Substitui TODOS os emojis do app: o ícone herda a cor e o tamanho do texto.

   Uso em JS:    Caderninho.Icons.svg('flame')            -> string <svg>
   Uso em HTML:  <i data-ic="home"></i>                    -> preenchido ao carregar
   Novo ícone:   adicione uma linha em PATHS (só o conteúdo interno do <svg>).
   ========================================================================== */
(function (global) {
  'use strict';

  const C = (global.Caderninho = global.Caderninho || {});

  const PATHS = {
    /* ações */
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    'chevron-right': '<path d="M9 6l6 6-6 6"/>',
    'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
    pencil: '<path d="M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19l-4 1z"/><path d="M14.5 6.5l3 3"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/>',
    save: '<path d="M5 4h11l3 3v13H5V4z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01"/>',
    message: '<path d="M20 11.5a8 8 0 01-11.8 7L4 20l1.5-4.2A8 8 0 1120 11.5z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.5a2.5 2.5 0 114 2c-.9.6-1.6 1.1-1.6 2.2M12 17h.01"/>',
    lightbulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z"/>',
    volume: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 9a4 4 0 010 6M19 6.5a8 8 0 010 11"/>',
    'volume-off': '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M12 4l9 16H3L12 4z"/><path d="M12 10v4M12 17h.01"/>',

    /* navegação */
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9a1 1 0 001 1h3v-6h4v6h3a1 1 0 001-1v-9"/>',
    book: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4z"/><path d="M5 17a3 3 0 013-3h11"/><path d="M9 8h6"/>',
    notebook: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12.5 8h3M12.5 12h3"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>',
    chart: '<path d="M5 20V11M12 20V5M19 20v-6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',

    /* tempo */
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    'calendar-days': '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M8.5 14h.01M12 14h.01M15.5 14h.01M8.5 17h.01M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',

    /* dinheiro e metas */
    banknote: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 12h.01M17.5 12h.01"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    trophy: '<path d="M8 4h8v6a4 4 0 01-8 0V4z"/><path d="M8 6H5v2a3 3 0 003 3M16 6h3v2a3 3 0 01-3 3M12 14v4M8.5 20h7"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5z"/>',
    medal: '<circle cx="12" cy="9" r="5.5"/><path d="M8.7 13.6L7.5 21l4.5-2.7 4.5 2.7-1.2-7.4"/>',
    'trending-down': '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',

    /* gamificação */
    flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 .3 1.2 1 2 2 2 0-3-.5-5 1-8z"/>',
    sprout: '<path d="M12 21v-9"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/>',
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z"/>',
    crown: '<path d="M4 8l4 4 4-6 4 6 4-4-1.5 10h-13L4 8z"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
    sparkles: '<path d="M11 4l1.8 4.7 4.7 1.8-4.7 1.8L11 17l-1.8-4.7L4.5 10.5l4.7-1.8L11 4z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7L19 15z"/>',
    library: '<rect x="4" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><path d="M16.5 6.5L20 20"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 007 0M9 9.5h.01M15 9.5h.01"/>',

    /* categorias */
    cart: '<path d="M3 4h2.5l2 11h10l2-8H7"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
    utensils: '<path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10"/>',
    bus: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 12h14M8 21v-3M16 21v-3M8.5 15h.01M15.5 15h.01"/>',
    pill: '<g transform="rotate(-45 12 12)"><rect x="3" y="8.5" width="18" height="7" rx="3.5"/><path d="M12 8.5v7"/></g>',
    backpack: '<path d="M8 8a4 4 0 018 0v12H8V8z"/><path d="M8 14h8M10 11h4"/>',
    wrench: '<path d="M15 5a4 4 0 00-4.8 5.2L4 16.5 7.5 20l6.3-6.2A4 4 0 0019 9l-2.5 2.5-2.5-.5-.5-2.5L16 6a4 4 0 00-1-1z"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M3 13h18"/>',
    bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
    package: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    inbox: '<path d="M4 13l2-8h12l2 8v6H4v-6z"/><path d="M4 13h5a3 3 0 006 0h5"/>',

    /* pix, conta na nuvem e modo offline */
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M17 20h3v-3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
    cloud: '<path d="M7 18a4 4 0 01-.6-7.95A5.5 5.5 0 0117 9.5a4.25 4.25 0 01.5 8.5H7z"/>',
    'cloud-off': '<path d="M3 3l18 18"/><path d="M8.2 6.6A5.5 5.5 0 0117 9.5a4.25 4.25 0 011.9 8M7 18a4 4 0 01-1.4-7.7"/>',
    'wifi-off': '<path d="M3 3l18 18"/><path d="M8.5 16.4a5 5 0 017 0M5 12.9a10 10 0 015-2.7M19 12.9a10 10 0 00-2.7-2M12 20h.01"/>',
    refresh: '<path d="M20 11a8 8 0 00-14.5-3.5M4 4v4h4M4 13a8 8 0 0014.5 3.5M20 20v-4h-4"/>',
    'log-in': '<path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4M14 8l4 4-4 4M18 12H9"/>',
    'log-out': '<path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4M10 8l-4 4 4 4M6 12h9"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  };

  /** Devolve o <svg> do ícone (herda cor e tamanho do texto ao redor). */
  function svg(name, cls) {
    const body = PATHS[name] || PATHS.package;
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      body + '</svg>';
  }

  /** Troca cada <i data-ic="nome"> do HTML estático pelo SVG correspondente. */
  function hydrate(root) {
    (root || document).querySelectorAll('i[data-ic]').forEach((el) => {
      el.outerHTML = svg(el.getAttribute('data-ic'), el.getAttribute('data-cls') || '');
    });
  }

  C.Icons = { svg, hydrate, names: Object.keys(PATHS) };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => hydrate(document));
    else hydrate(document);
  }
})(typeof window !== 'undefined' ? window : globalThis);
