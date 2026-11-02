/* ==========================================================================
   Caderninho — views/profile.js  (#/perfil)
   Nível, conquistas, conta e nuvem, modo offline, metas, backup dos dados e configurações.
   ========================================================================== */
(function (global) {
  'use strict';

  const C = global.Caderninho;
  const U = C.Utils;
  const Store = C.Store;
  const Game = C.Game;
  const UI = C.UI;
  const esc = U.escapeHTML;
  const I = C.Icons.svg;


  /** "há 5 min", "há 2 h"… para mostrar quando foi a última sincronização. */
  function ago(ms) {
    if (!ms) return '';
    const min = Math.floor((Date.now() - ms) / 60000);
    if (min < 1) return 'agora há pouco';
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h} h`;
    return `em ${U.formatDate(U.toISO(new Date(ms)))}`;
  }

  function syncLine(st) {
    if (st.state === 'syncing') return 'Sincronizando…';
    if (st.state === 'offline') return 'Sem internet. Sincroniza quando voltar.';
    if (st.state === 'error') return st.error || 'Não consegui sincronizar. Vamos tentar de novo.';
    return st.lastSyncAt ? `Sincronizado ${ago(st.lastSyncAt)}` : 'Conectado';
  }

  function accountSection() {
    const Sync = C.Sync;
    const off = C.Offline.info();
    const net = `
      <div class="row static">
        <span class="row-ico ${off.state === 'ready' ? 'in' : ''}" aria-hidden="true">${I(off.state === 'ready' ? 'check-circle' : 'wifi-off')}</span>
        <span class="row-main"><b>Funciona sem internet</b><small>${esc(off.text)}</small></span>
        ${off.state === 'ready' ? `<button type="button" class="btn ghost small" data-action="offline:check">Atualizar</button>` : ''}
      </div>`;

    let cloud;
    if (!Sync || !Sync.isConfigured()) {
      cloud = `
        <div class="row static">
          <span class="row-ico" aria-hidden="true">${I('cloud')}</span>
          <span class="row-main"><b>Conta e nuvem</b><small>Em breve: guarde seus dados e use em outros aparelhos</small></span>
        </div>`;
    } else if (!Sync.isLoggedIn()) {
      const st = Sync.status();
      cloud = `
        <div class="row static">
          <span class="row-ico" aria-hidden="true">${I('cloud-off')}</span>
          <span class="row-main"><b>Sem conta</b><small>${st.error ? esc(st.error) : 'Seus dados estão só neste aparelho'}</small></span>
        </div>
        <div class="card-actions"><button type="button" class="btn primary block" data-action="account:open">${I('log-in')} Entrar ou criar conta</button></div>`;
    } else {
      const st = Sync.status();
      cloud = `
        <div class="row static">
          <span class="row-ico ${st.state === 'error' ? 'late' : 'in'}" aria-hidden="true">${I(st.state === 'error' ? 'cloud-off' : st.state === 'syncing' ? 'refresh' : 'cloud')}</span>
          <span class="row-main"><b>${esc(st.email)}</b><small data-sync-line>${esc(syncLine(st))}</small></span>
        </div>
        <div class="card-actions two">
          <button type="button" class="btn ghost" data-action="account:sync" ${st.state === 'syncing' ? 'disabled' : ''}>${I('refresh')} Sincronizar</button>
          <button type="button" class="btn danger-ghost" data-action="account:signout">${I('log-out')} Sair</button>
        </div>`;
    }
    return `
      <h2 class="section-title">${I('cloud')} Conta e nuvem</h2>
      <section class="card list">${cloud}${net}</section>`;
  }

  function render() {
    const s = Store.get();
    const lvl = Game.levelFor(s.game.xp);
    const st = Game.streak(s);
    const unlocked = Game.ACHIEVEMENTS.filter((a) => s.game.achievements[a.id]).length;
    const pix = C.Pix.getConfig();

    return `
      <div>
        <h1 class="page-title">${s.profile.name ? esc(s.profile.name) : 'Seu perfil'}</h1>
        <p class="page-sub">Nível ${lvl.level} · ${esc(lvl.title)}</p>
      </div>

      ${UI.help('Aqui você acompanha seu progresso e cuida dos seus dados. Cada vez que você usa o app, ganha <b>XP</b> (pontos). Juntando XP você sobe de <b>nível</b>.', { title: 'Seu perfil' })}

      <section class="card">
        <div class="lvl-head"><b>${I('star')} ${s.game.xp} XP</b><small>${lvl.into}/${lvl.span} para o nível ${lvl.level + 1}</small></div>
        ${UI.progressBar(lvl.progress)}
        <hr class="soft">
        <div class="two-up">
          <div class="stat"><small>Sequência</small><b>${I('flame')} ${st.count} ${st.count === 1 ? 'dia' : 'dias'}</b></div>
          <div class="stat"><small>Conquistas</small><b>${I('medal')} ${unlocked}/${Game.ACHIEVEMENTS.length}</b></div>
        </div>
      </section>

      ${accountSection()}

      <h2 class="section-title">${I('medal')} Conquistas</h2>
      ${UI.help('Conquistas são medalhas por bons hábitos, como anotar todo dia ou bater uma meta. As apagadas ainda estão bloqueadas; o texto de cada uma diz o que falta fazer.', { tone: 'tip' })}
      <div class="ach-grid">
        ${Game.ACHIEVEMENTS.map((a) => {
          const when = s.game.achievements[a.id];
          return `
            <div class="ach ${when ? 'done' : 'locked'}">
              <span class="ico" aria-hidden="true">${I(a.icon)}</span>
              <b>${esc(a.title)}</b>
              <small>${when ? 'Desbloqueada em ' + U.formatDate(when) : esc(a.desc)}</small>
            </div>`;
        }).join('')}
      </div>

      <h2 class="section-title">${I('settings')} Configurações</h2>
      ${C.Sync && C.Sync.isLoggedIn()
        ? UI.help('Seus dados também ficam guardados na sua conta. Mesmo assim, de vez em quando use <b>Salvar backup</b>: é uma cópia só sua.', { tone: 'tip', title: 'Seus dados' })
        : UI.help('Seus dados ficam <b>só neste aparelho</b>. Se trocar de celular ou limpar o navegador, eles somem. Por isso, de vez em quando use <b>Salvar backup</b>.', { tone: 'warn', title: 'Importante' })}
      <section class="card list">
        <a class="row" href="#/metas"><span class="row-ico" aria-hidden="true">${I('target')}</span><span class="row-main"><b>Minhas metas</b><small>${s.goals.length} ${s.goals.length === 1 ? 'meta' : 'metas'}</small></span>${I('chevron-right')}</a>
        <button type="button" class="row" data-action="profile:name"><span class="row-ico" aria-hidden="true">${I('pencil')}</span><span class="row-main"><b>Mudar meu nome</b><small>${s.profile.name ? esc(s.profile.name) : 'Ainda sem nome'}</small></span>${I('chevron-right')}</button>
        <button type="button" class="row" data-action="pix:settings"><span class="row-ico" aria-hidden="true">${I('qr')}</span><span class="row-main"><b>Meu Pix</b><small>${pix ? esc(C.Pix.typeLabel(pix.type)) + ' ' + esc(C.Pix.maskKey(pix.type, pix.key)) : 'Cadastre sua chave para cobrar por Pix'}</small></span>${I('chevron-right')}</button>
        <button type="button" class="row" data-action="data:export"><span class="row-ico" aria-hidden="true">${I('save')}</span><span class="row-main"><b>Salvar backup</b><small>Baixa um arquivo com todos os seus dados</small></span>${I('chevron-right')}</button>
        <button type="button" class="row" data-action="data:import"><span class="row-ico" aria-hidden="true">${I('folder')}</span><span class="row-main"><b>Restaurar backup</b><small>Volta os dados de um arquivo salvo</small></span>${I('chevron-right')}</button>
        <button type="button" class="row" data-action="help:toggle"><span class="row-ico" aria-hidden="true">${I('help')}</span><span class="row-main"><b>Mostrar explicações</b><small>${s.profile.hideHelp ? 'Desligado: toque para ligar' : 'Ligado: toque para esconder os cardzinhos'}</small></span>${I('chevron-right')}</button>
        <button type="button" class="row" data-action="sound:toggle"><span class="row-ico" aria-hidden="true">${I(s.profile.muteSound ? 'volume-off' : 'volume')}</span><span class="row-main"><b>Som de abertura</b><small>${s.profile.muteSound ? 'Desligado: toque para ligar' : 'Ligado: toque para deixar sem som'}</small></span>${I('chevron-right')}</button>
        <button type="button" class="row" data-action="demo:load"><span class="row-ico" aria-hidden="true">${I('dice')}</span><span class="row-main"><b>Carregar dados de exemplo</b><small>Para testar o app</small></span>${I('chevron-right')}</button>
        <button type="button" class="row" data-action="data:reset"><span class="row-ico late" aria-hidden="true">${I('trash')}</span><span class="row-main"><b class="neg">Apagar tudo</b><small>Remove seus dados deste aparelho</small></span>${I('chevron-right')}</button>
      </section>
      <input type="file" id="importFile" accept="application/json,.json" hidden data-change="data:import-file">

      <p class="hint" style="text-align:center">Caderninho · feito pela Purytalent · v3<br>${C.Sync && C.Sync.isLoggedIn() ? 'Seus dados estão neste aparelho e na sua conta.' : 'Seus dados ficam só neste aparelho.'}</p>`;
  }

  /* ---------- Ações ---------- */
  /** Quando há conta conectada, trocar/apagar dados aqui também muda a nuvem. */
  const cloudNote = () => (C.Sync && C.Sync.isLoggedIn() ? ' Como você está conectado, isso também vale para os dados da sua conta na nuvem.' : '');

  /**
   * Antes de TROCAR todos os dados (apagar tudo, restaurar backup) com conta conectada: sincroniza,
   * para este aparelho conhecer tudo o que já está na nuvem. Sem isso, o que outro aparelho anotou
   * e este ainda não viu sobreviveria à "limpeza" (exclusão só vale para registros que se conhece).
   */
  async function prepareReplace() {
    if (C.Sync && C.Sync.isLoggedIn() && C.Offline.isOnline()) { try { await C.Sync.syncNow(); } catch (e) { /* segue mesmo assim */ } }
  }
  C.prepareReplace = prepareReplace;

  C.Actions['profile:name'] = () => C.Forms.openNameForm();
  C.Actions['sound:toggle'] = () => {
    const mute = !Store.get().profile.muteSound;
    Store.setProfile({ muteSound: mute });
    UI.toast(mute ? 'Som de abertura desligado' : 'Som de abertura ligado', 'info');
  };
  C.Actions['help:toggle'] = () => {
    const hide = !Store.get().profile.hideHelp;
    Store.setProfile({ hideHelp: hide });
    UI.toast(hide ? 'Explicações escondidas' : 'Explicações ligadas', 'info');
  };

  C.Actions['data:export'] = () => {
    U.download(`caderninho-backup-${U.today()}.json`, Store.exportJSON(), 'application/json');
    UI.toast('Backup salvo', 'success');
  };

  C.Actions['data:import'] = () => {
    const input = document.getElementById('importFile');
    if (input) input.click();
  };

  C.Actions['data:import-file'] = async (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const yes = await UI.confirmDialog({ title: 'Restaurar backup?', message: 'Isso substitui tudo o que está salvo agora neste aparelho.' + cloudNote(), okLabel: 'Restaurar', danger: true });
      if (yes) {
        await prepareReplace();
        Store.importJSON(text);
        Game.evaluate({ silent: true });
        UI.toast('Backup restaurado', 'success');
      }
    } catch (e) {
      UI.toast(e.message || 'Não consegui ler esse arquivo', 'error');
    } finally {
      el.value = '';
    }
  };

  C.Actions['data:reset'] = async () => {
    const yes = await UI.confirmDialog({ title: 'Apagar tudo?', message: 'Anotações, contas, metas e pontos serão removidos deste aparelho.' + cloudNote() + ' Não dá para desfazer (salve um backup antes!).', okLabel: 'Apagar tudo', danger: true });
    if (yes) { await prepareReplace(); Store.reset(); UI.toast('Tudo limpo. Começando do zero', 'info'); }
  };

  C.Views.perfil = { render };
})(typeof window !== 'undefined' ? window : globalThis);
