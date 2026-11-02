/* ==========================================================================
   Caderninho — sw.js  (Service Worker: modo offline)
   Guarda todos os arquivos do app no aparelho. Depois da 1ª visita o app abre e
   funciona sem internet (as anotações já ficam no aparelho, em localStorage).

   ESTRATÉGIA: "cache primeiro, versão fechada"
   • Todos os arquivos da lista FILES são baixados juntos, numa versão (VERSION).
     Nunca se mistura arquivo novo com antigo (o app depende da ordem dos scripts).
   • Responde do cache; se o arquivo não estiver lá, tenta a rede.
   • Só cuida de pedidos GET do próprio endereço do app. Pedidos para outros
     endereços (servidor de conta, WhatsApp…) passam direto, sem cache.

   QUANDO MEXER NESTE ARQUIVO (toda entrega!)
   1) Mudou qualquer arquivo do app? Troque o número em VERSION. Sem isso, quem já
      instalou continua vendo a versão velha. É a única coisa que dispara a atualização.
   2) Criou um arquivo novo (.js, .css, imagem)? Coloque na lista FILES.
      Esquecer só faz o arquivo não funcionar offline; o teste automatico avisa.
   Quem usa o app vê a faixa "Nova versão disponível" e atualiza com um toque.

   EM DESENVOLVIMENTO: abra o app com ?sw=off no endereço para desligar o modo
   offline e apagar o cache (ou use DevTools > Application > Service Workers >
   "Update on reload").
   ========================================================================== */
const VERSION = 'caderninho-v3.0.0';

const FILES = [
  './',
  'index.html',
  'style.css',
  'features.css',
  'config.js',
  'utils.js',
  'icons.js',
  'store.js',
  'game.js',
  'ui.js',
  'qr.js',
  'pix.js',
  'forms.js',
  'home.js',
  'transactions.js',
  'bills.js',
  'summary.js',
  'goals.js',
  'profile.js',
  'sync.js',
  'offline.js',
  'app.js',
  'manifest.json',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      // cache: 'reload' ignora o cache do navegador, para não guardar arquivo velho como se fosse novo
      cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))
    )
  );
  // NÃO chama skipWaiting aqui: a versão nova só assume quando a pessoa tocar em "Atualizar".
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('caderninho-') && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SKIP_WAITING') self.skipWaiting();
  if (msg.type === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'VERSION', version: VERSION });
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    // caches.match com cacheName NÃO cria o cache se ele não existir (caches.open criaria um vazio,
    // e ele voltaria a aparecer depois de apagado pelo ?sw=off)
    // ignoreSearch: "index.html?x=1" e "/#/contas" usam o mesmo arquivo guardado
    const hit = await caches.match(req, { cacheName: VERSION, ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      if (req.mode === 'navigate') {
        const home = await caches.match('index.html', { cacheName: VERSION });
        if (home) return home;
      }
      return new Response('Sem internet e este arquivo ainda não foi guardado.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
