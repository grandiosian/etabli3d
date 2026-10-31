/* =========================================================
   Centrale élèves (facultatif) : connexion avec le code personnel de l'élève,
   sauvegarde du projet sur le serveur de la classe, suivi des tutos et exercices,
   et ateliers transversaux (parcours en plusieurs logiciels).

   - Ouvert normalement : rien ne change. Le bouton « Mon code » permet de se connecter ;
     le projet est alors enregistré sur le serveur et retrouvé sur n'importe quel ordinateur.
   - Ouvert depuis une étape d'atelier (portail de la Centrale) : le projet de départ vient du
     dossier de projet (ce que l'élève ou son équipe a déjà fait, sinon le fichier reçu de l'étape
     précédente ou fourni par le professeur), la consigne arrive dans « Mon TP », et les fichiers
     attendus (.json : le projet, .stl : l'export pour l'impression) sont déposés dans le dossier.
   Sans réseau, ou si le serveur ne répond pas, Établi 3D fonctionne exactement comme avant.
   ========================================================= */
var CZ = null;   // var (et non const) : autosave() peut l'interroger avant que ce fichier soit exécuté
const CZ_SERVEUR = (window.CENTRALE_URL || 'https://technoversailles.alwaysdata.net/').replace(/\/?$/, '/');
const CZ_JETON = /(^|[#&])centrale=/.test(location.hash);   // ouvert depuis le portail (jeton dans l'adresse)

CZ = { pret: false, atelier: null, bouton: null, fenetre: null, panneau: null, minuteur: 0, etat: '', conflit: null };
(function czCharger(){
  const js = document.createElement('script');
  js.src = CZ_SERVEUR + 'js/centrale-client.js';
  js.onload = czDemarrer;
  js.onerror = () => {};   // serveur injoignable : Établi 3D reste en mode navigateur seul
  document.head.appendChild(js);
})();

/** Identifiant d'activité pour la Centrale : « tuto-premiers » (le « : » d'Établi 3D n'y est pas accepté). */
const czId = id => String(id).replace(':', '-');

function czActivites(){
  return Object.entries(LESSONS).map(([k, T]) => ({
    id: T.type + '-' + k, titre: T.title,
    groupe: (T.type === 'exo' ? 'Exercices' : 'Tutos') + ' · ' + ((LCATS.find(c => c[0] === T.cat) || [])[1] || ''),
  }));
}

function czDemarrer(){
  if (!window.Centrale) return;
  Centrale.init({
    api: CZ_SERVEUR + 'api/', app: 'etabli3d', activites: czActivites(),
    surDeconnexion: () => { CZ.pret = false; czMajBouton(); toast('Session terminée : reconnecte-toi pour enregistrer ton travail.'); },
  });
  czStyle();
  czCreerBouton();
  if (CZ_JETON || Centrale.connecte()) Centrale.afficherConnexion(document.createElement('div'), { onConnecte: czConnecte });
}

/* ---------- Projet au format « Enregistrer » ---------- */
function czProjet(){
  return { app: 'etabli3d', version: 1, name: state.name, parts: state.parts, joints: state.joints, nextId: state.nextId,
           note: state.note || null, tp: state.tp || null, struct: state.struct || null };
}
const czEsc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const czEstProjet = o => !!o && typeof o === 'object' && Array.isArray(o.parts);

/* ---------- Bouton « Mon code » dans la barre du haut ---------- */
function czCreerBouton(){
  const b = h('button', { class: 'btn ghost', id: 'bCentrale', type: 'button' });
  b.onclick = () => {
    if (Centrale.connecte()) {
      const id = Centrale.identifiant();
      czFenetre(`<p>Connecté : <strong>${czEsc(id || Centrale.session().classe)}</strong>.<br>Ton travail est enregistré automatiquement sur le serveur de la classe.</p>`
        + `<button class="btn" data-sortir type="button">Se déconnecter</button>`, corps => {
        corps.querySelector('[data-sortir]').onclick = () => {
          Centrale.deconnexion(); CZ.pret = false; CZ.atelier = null; czPanneau(); czMajBouton(); czMontrer(false);
          toast('Déconnecté. Établi 3D enregistre de nouveau dans ce navigateur seulement.');
        };
      });
      return;
    }
    czFenetre('<p>Avec ton code, ton projet est enregistré sur le serveur de la classe et ton professeur voit tes tutos et exercices réussis.</p><div class="cz-connexion"></div>',
      corps => Centrale.afficherConnexion(corps.querySelector('.cz-connexion'), { onConnecte: czConnecte }));
  };
  const ref = $('#bGuide');
  ref.parentNode.insertBefore(b, ref);
  CZ.bouton = b;
  czMajBouton();
}
function czMajBouton(){
  if (!CZ.bouton) return;
  const s = window.Centrale && Centrale.connecte();
  CZ.bouton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>'
    + `<span class="hide-narrow">${czEsc(s ? (Centrale.identifiant() || Centrale.session().classe) : 'Mon code')}</span>`;
  CZ.bouton.title = s ? 'Ton travail est enregistré sur le serveur de la classe' : 'Se connecter avec son code pour enregistrer son travail';
}

/* ---------- Petite fenêtre ---------- */
function czFenetre(html, prep){
  if (!CZ.fenetre) {
    CZ.fenetre = h('div', { id: 'czFenetre', hidden: '' });
    CZ.fenetre.innerHTML = '<div class="cz-boite" role="dialog" aria-label="Connexion de la classe"><div class="cz-tete"><strong>Connexion de la classe</strong>'
      + '<button class="btn icon ghost" type="button" data-fermer aria-label="Fermer">✕</button></div><div class="cz-corps"></div></div>';
    CZ.fenetre.addEventListener('click', e => { if (e.target === CZ.fenetre || e.target.closest('[data-fermer]')) czMontrer(false); });
    document.body.appendChild(CZ.fenetre);
  }
  const corps = CZ.fenetre.querySelector('.cz-corps');
  corps.innerHTML = html;
  if (prep) prep(corps);
  czMontrer(true);
}
function czMontrer(oui){ if (CZ.fenetre) CZ.fenetre.hidden = !oui; }

/* ---------- Une fois connecté ---------- */
async function czConnecte(infos){
  czMontrer(false); czMajBouton();
  try {
    await czEnvoyerProgression();
    const info = await Centrale.etape();
    if (info && info.etape) {
      await czOuvrirAtelier(info);
    } else {
      const p = await Centrale.charger('projet', null);
      if (czEstProjet(p)) {
        if (JSON.stringify(p) !== JSON.stringify(czProjet())) { loadProject(p, true); renderInspector(); renderDemo(); }
      } else {
        Centrale.sauver('projet', czProjet());
      }
      CZ.pret = true;
      const d = Centrale.activiteDemandee();   // « Ouvrir » sur un tuto ou un exercice dans le portail
      const k = d && d.replace(/^(tuto|exo)-/, '');
      if (k && LESSONS[k]) startLesson(k);
      toast(`Connecté : ${Centrale.identifiant() || infos.classe}. Ton projet est enregistré automatiquement.`, 3200);
    }
  } catch (e) {
    toast('Connexion au serveur impossible : ' + e.message, 3600);
  }
}

/** Tutos et exercices réussis dans ce navigateur, que le serveur ne connaît pas encore. */
async function czEnvoyerProgression(){
  const serveur = await Centrale.mesProgressions().catch(() => ({}));
  for (const id of Object.keys(PROG.done)) {
    const [type, k] = id.split(':');
    if ((type === 'tuto' || type === 'exo') && LESSONS[k] && serveur[czId(id)]?.statut !== 'termine') {
      Centrale.progression(czId(id), { titre: LESSONS[k].title, statut: 'termine' });
    }
  }
}

/** Appelé par markDone() (lessons.js) : un tuto ou un exercice vient d'être réussi. */
function czProgres(id){
  if (!CZ || !CZ.pret || !window.Centrale || !Centrale.connecte()) return;
  const [type, k] = String(id).split(':');
  if ((type === 'tuto' || type === 'exo') && LESSONS[k]) Centrale.progression(czId(id), { titre: LESSONS[k].title, statut: 'termine' });
}

/** Appelé par autosave() (scene.js) à chaque modification du projet. */
function czTravail(){
  if (!CZ || !CZ.pret || !window.Centrale || !Centrale.connecte()) return;
  if (CZ.atelier) {   // atelier : le projet (.json) va dans le dossier de projet, quelques secondes après la dernière modification
    clearTimeout(CZ.minuteur);
    CZ.minuteur = setTimeout(() => czDeposer(false), 4000);
    czEtat('modifie');
  } else {
    Centrale.sauver('projet', czProjet());
  }
}

/* =========================================================
   Atelier transversal
   ========================================================= */
async function czOuvrirAtelier(info){
  const et = info.etape;
  CZ.atelier = info;
  if (!$('#gallery').hidden) $('#galleryClose').click();   // première visite : la bibliothèque ne doit pas cacher l'atelier
  // Projet de départ : ce qui a déjà été déposé à cette étape, sinon ce que l'étape reçoit (étape précédente, fichier fourni)
  let projet = null;
  for (const n of [...et.sorties, ...et.entrees].filter(n => /\.json$/i.test(n))) {
    const c = await Centrale.projet.charger(n, { format: 'json' }).catch(() => null);
    if (czEstProjet(c)) { projet = c; break; }
  }
  simReset(true); selection = []; selJoint = null;
  if (projet) loadProject(projet, true);
  else { resetFor(et.titre); sync(); hist.stack = []; hist.idx = -1; commit(); }
  if (!projet || !projet.name || projet.name === 'Mon projet') { state.name = et.titre; $('#projName').value = state.name; }
  // La consigne de l'étape devient « Mon TP » dans le Guide (si le projet n'a pas déjà ses consignes)
  if (et.consigne && !(state.tp && state.tp.tasks && state.tp.tasks.length)) {
    state.tp = { title: et.titre, tasks: et.consigne.split('\n').map(s => s.trim()).filter(Boolean).map(t => ({ t, done: false })) };
    GUIDE.src = 'tp'; GUIDE.step = 0; demoClosed = false; commit();
  }
  renderInspector(); renderDemo(); updateSteps();
  CZ.pret = true;
  czPanneau();
  const ou = info.proprietaire.type === 'equipe' ? `le dossier de projet de ton équipe (${info.proprietaire.equipe})` : 'ton dossier de projet';
  toast(`Atelier « ${info.parcours.nom} » : ${et.titre}. Ton travail est enregistré dans ${ou}.`, 4000);
}

/** Dépose les fichiers attendus. tout = false : seulement le projet (.json), sans message s'il n'y a rien de nouveau. */
async function czDeposer(tout = true){
  const info = CZ.atelier;
  if (!info) return;
  clearTimeout(CZ.minuteur);
  if (state.edit) finishGroupEdit();
  const faits = [], ignores = [];
  czEtat('envoi');
  try {
    for (const n of info.etape.sorties) {
      if (/\.json$/i.test(n)) {
        await Centrale.projet.sauver(n, czProjet());
        faits.push(n);
      } else if (/\.stl$/i.test(n)) {
        if (!tout) continue;
        const stl = czStl();
        if (!stl) { ignores.push(n + ' (aucune pièce à imprimer)'); continue; }
        await Centrale.projet.sauver(n, new Blob([stl], { type: 'model/stl' }));
        faits.push(n);
      } else if (tout) {
        ignores.push(n + ' (format que Établi 3D ne sait pas produire)');
      }
    }
    CZ.conflit = null;
    czEtat('ok');
    if (tout) toast(faits.length ? `Déposé dans le dossier de projet : ${faits.join(', ')}.` : 'Rien à déposer pour cette étape.', 3200);
    if (ignores.length) setTimeout(() => toast('Non déposé : ' + ignores.join(' ; '), 4200), tout ? 3300 : 0);
  } catch (e) {
    if (e.conflit) { CZ.conflit = e; czEtat('conflit'); } else czEtat('erreur', e.message);
    if (tout || e.conflit) toast(e.message, 4200);
  }
  czMajDossier();
}

/** Toutes les pièces imprimables (pas les perçages seuls ni les pièces masquées), en STL binaire. */
function czStl(){
  const list = state.parts.map(p => ({ p, r: meshes.get(p.id) })).filter(x => x.r && !x.p.hole && !isHidden(x.p));
  if (!list.length) return null;
  list.forEach(x => x.r.mesh.updateMatrixWorld(true));
  return stlBinary(list.map(x => x.r));
}

/** Un coéquipier a modifié le projet : on recharge sa version (l'ancienne reste dans « Annuler »). */
async function czRecharger(){
  const info = CZ.atelier;
  const n = info && info.etape.sorties.find(n => /\.json$/i.test(n));
  if (!n) return;
  const c = await Centrale.projet.charger(n, { format: 'json' }).catch(() => null);
  if (czEstProjet(c)) { loadProject(c, false); commit(); renderInspector(); renderDemo(); }
  CZ.conflit = null; czEtat('ok'); toast('Version de ton équipe chargée. Ctrl+Z pour revenir à la tienne.', 3600);
}

/* ---------- Panneau « Atelier » ---------- */
function czPanneau(){
  const info = CZ.atelier;
  if (!info) { if (CZ.panneau) CZ.panneau.hidden = true; return; }
  const et = info.etape;
  if (!CZ.panneau) { CZ.panneau = h('aside', { id: 'czAtelier', 'aria-label': 'Atelier' }); $('#app').appendChild(CZ.panneau); }
  const p = CZ.panneau;
  p.hidden = false;
  const equipe = info.proprietaire.type === 'equipe'
    ? `<p class="cz-equipe">${czEsc(info.proprietaire.equipe)}${info.proprietaire.membres.length > 1 ? ' · ' + info.proprietaire.membres.map(esc).join(', ') : ''}</p>` : '';
  p.innerHTML = `<div class="cz-ptete"><span class="cz-etape">Étape ${info.numero + 1}/${info.etapes.length}</span>`
    + `<strong>${czEsc(et.titre)}</strong><button class="btn icon ghost" type="button" data-reduire aria-expanded="true" title="Afficher ou masquer les fichiers">▾</button></div>`
    + `<div class="cz-pcorps"><p class="cz-parcours">${czEsc(info.parcours.nom)}</p>${equipe}`
    + (et.entrees.length ? `<p class="cz-lbl">Reçoit</p><ul class="cz-fichiers" data-entrees></ul>` : '')
    + (et.sorties.length ? `<p class="cz-lbl">À déposer</p><ul class="cz-fichiers" data-sorties></ul>` : '')
    + `</div><div class="cz-ppied"><div class="cz-conflit" hidden></div>`
    + `<div class="cz-actions"><button class="btn" type="button" data-deposer>Déposer dans le dossier</button><span class="cz-etat"></span></div></div>`;
  // Le Guide (consignes) est aussi à gauche : quand il est ouvert, on ne garde que l'essentiel
  const reduire = oui => { p.classList.toggle('reduit', oui); p.querySelector('[data-reduire]').setAttribute('aria-expanded', String(!oui)); };
  reduire(!demoClosed);
  p.querySelector('[data-reduire]').onclick = () => reduire(!p.classList.contains('reduit'));
  p.querySelector('[data-deposer]').onclick = () => czDeposer(true);
  czMajDossier();
  czEtat(CZ.conflit ? 'conflit' : CZ.etat || 'ok');
}

/** Liste des fichiers de l'étape, avec ce qui est déjà dans le dossier. */
async function czMajDossier(){
  const info = CZ.atelier, p = CZ.panneau;
  if (!info || !p) return;
  let presents = {};
  try { (await Centrale.projet.liste()).forEach(f => { presents[f.nom] = f; }); } catch (e) { /* hors ligne */ }
  const ligne = (n, sortie) => {
    const f = presents[n];
    const li = h('li', { class: f ? 'present' : '' });
    li.append(h('span', { class: 'cz-nom' }, (f ? '✓ ' : sortie ? '○ ' : '– ') + n));
    if (f) li.append(h('small', {}, f.fourni ? 'fourni' : (f.auteur || '')));
    // Un fichier reçu qui n'est pas un projet Établi 3D (questionnaire, cahier des charges…) : on peut le lire
    if (!sortie && f && /\.(json|txt|csv|md)$/i.test(n)) {
      const b = h('button', { class: 'btn ghost cz-voir', type: 'button' }, 'Voir');
      b.onclick = async () => {
        const c = await Centrale.projet.charger(n, { format: 'texte' }).catch(() => '');
        let txt = c;
        try { const o = JSON.parse(c); if (czEstProjet(o)) txt = 'Projet Établi 3D (' + o.parts.length + ' pièce' + (o.parts.length > 1 ? 's' : '') + ')'; else txt = JSON.stringify(o, null, 2); } catch (e) { /* texte */ }
        czFenetre(`<p><strong>${czEsc(n)}</strong></p><pre class="cz-pre"></pre>`, corps => { corps.querySelector('pre').textContent = txt; });
        CZ.fenetre.querySelector('.cz-tete strong').textContent = 'Fichier reçu';
      };
      li.append(b);
    }
    return li;
  };
  const ue = p.querySelector('[data-entrees]'), us = p.querySelector('[data-sorties]');
  if (ue) ue.replaceChildren(...info.etape.entrees.map(n => ligne(n, false)));
  if (us) us.replaceChildren(...info.etape.sorties.map(n => ligne(n, true)));
}

function czEtat(etat, message){
  CZ.etat = etat;
  const p = CZ.panneau;
  if (!p) return;
  const txt = { modifie: 'Modifications non déposées…', envoi: 'Envoi…', ok: CZ.atelier && CZ.atelier.etape.sorties.some(n => /\.json$/i.test(n)) ? 'Projet déposé automatiquement' : '',
                conflit: '', erreur: '⚠ ' + (message || 'Erreur') }[etat] ?? '';
  p.querySelector('.cz-etat').textContent = txt;
  const c = p.querySelector('.cz-conflit');
  c.hidden = etat !== 'conflit';
  if (etat === 'conflit' && CZ.conflit) {
    c.innerHTML = '';
    c.append(h('p', {}, CZ.conflit.message),
      h('button', { class: 'btn', type: 'button', onclick: czRecharger }, 'Prendre la version de l’équipe'),
      h('button', { class: 'btn ghost', type: 'button', onclick: async () => {
        const n = CZ.atelier.etape.sorties.find(n => /\.json$/i.test(n));
        try { await Centrale.projet.sauver(n, czProjet(), { forcer: true }); CZ.conflit = null; czEtat('ok'); czMajDossier(); toast('Ta version remplace celle de l’équipe.'); }
        catch (e) { toast(e.message); }
      } }, 'Garder la mienne'));
  }
}

function czStyle(){
  const st = document.createElement('style');
  st.textContent = `
#czFenetre{position:fixed;inset:0;z-index:200;display:grid;place-items:center;background:rgba(0,0,0,.35);padding:16px}
#czFenetre[hidden]{display:none}
#czFenetre .cz-boite{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:16px 18px;width:min(440px,100%);box-shadow:var(--shadow);max-height:85vh;overflow:auto}
#czFenetre .cz-tete{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-family:var(--f-display);font-size:18px}
#czFenetre p{margin:0 0 12px;color:var(--ink-2)}
#czFenetre .cz-pre{white-space:pre-wrap;font:12px/1.45 var(--f-mono);background:var(--panel-2);padding:10px;border-radius:8px;max-height:50vh;overflow:auto;color:var(--ink)}
#czAtelier{position:absolute;left:12px;bottom:64px;z-index:25;width:min(300px,calc(100% - 24px));background:var(--panel);color:var(--ink);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:10px;box-shadow:var(--shadow);font-size:13px}
#czAtelier[hidden]{display:none}
#czAtelier .cz-ptete{display:flex;align-items:center;gap:8px;padding:8px 8px 8px 12px}
#czAtelier .cz-ptete strong{flex:1;font-family:var(--f-display);font-size:15px;line-height:1.2}
#czAtelier .cz-etape{font:600 11px var(--f-mono);color:var(--accent-ink);background:var(--accent);border-radius:4px;padding:1px 6px;white-space:nowrap}
#czAtelier.reduit .cz-pcorps{display:none}
#czAtelier.reduit [data-reduire]{transform:rotate(180deg)}
#czAtelier .cz-pcorps{padding:0 12px 4px}
#czAtelier .cz-ppied{padding:0 12px 10px}
#czAtelier .cz-parcours,#czAtelier .cz-equipe{margin:0 0 6px;color:var(--ink-2)}
#czAtelier .cz-lbl{margin:8px 0 2px;font-weight:600}
#czAtelier .cz-fichiers{list-style:none;margin:0;padding:0}
#czAtelier .cz-fichiers li{display:flex;align-items:center;gap:6px;padding:2px 0}
#czAtelier .cz-nom{font-family:var(--f-mono);font-size:12px}
#czAtelier li.present .cz-nom{color:var(--accent)}
#czAtelier li small{color:var(--ink-2);margin-left:auto;font-size:11px}
#czAtelier .cz-voir{padding:1px 8px;font-size:12px;min-height:0}
#czAtelier .cz-actions{display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap}
#czAtelier .cz-etat{color:var(--ink-2);font-size:12px}
#czAtelier .cz-conflit{margin-top:8px;padding:8px;border-radius:8px;background:var(--mark-soft)}
#czAtelier .cz-conflit p{margin:0 0 6px}
#czAtelier .cz-conflit .btn{margin:2px 4px 2px 0}
#bCentrale svg{width:18px;height:18px}`;
  document.head.appendChild(st);
}
