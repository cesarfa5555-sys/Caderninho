/* ==========================================================================
   Caderninho — config.js
   Único arquivo que o time mexe para ligar a conta e a sincronização.

   Enquanto `url` e `anonKey` estiverem vazios, o app funciona 100% neste
   aparelho (sem login) e a tela de Perfil mostra "Conta: em breve".

   Como ligar (passo a passo no README, seção "Conta e sincronização"):
     1) Crie um projeto no Supabase (supabase.com).
     2) Rode o arquivo supabase.sql no "SQL Editor" do projeto.
     3) Copie "Project URL" e a chave "anon public" (Settings > API) para cá.

   A chave `anon` é PÚBLICA por desenho: ela pode ir no código. O que protege os
   dados é a regra de acesso por usuário (RLS) criada pelo supabase.sql.
   NUNCA coloque aqui a chave `service_role`.

   Para usar outro servidor (Firebase, API própria…), crie um adaptador em
   sync.js (veja "Adaptadores" lá) e troque `provider`.
   ========================================================================== */
(function (global) {
  'use strict';

  const C = (global.Caderninho = global.Caderninho || {});

  const defaults = {
    sync: {
      provider: 'supabase',
      url: '',        // ex.: 'https://abcdxyz.supabase.co'  (precisa ser https)
      anonKey: '',    // ex.: 'eyJhbGciOi...'
      table: 'caderninho_data',
    },
  };

  // window.CADERNINHO_CONFIG (opcional, definido antes deste arquivo) sobrescreve os valores:
  // útil para testes e para ambientes diferentes (staging x produção) sem editar este arquivo.
  const extra = global.CADERNINHO_CONFIG || {};
  C.Config = { sync: Object.assign({}, defaults.sync, extra.sync || {}) };
})(typeof window !== 'undefined' ? window : globalThis);
