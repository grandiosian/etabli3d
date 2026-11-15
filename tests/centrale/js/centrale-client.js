/* Fausse Centrale pour les tests : mêmes fonctions que le vrai module (centrale-client.js de la Centrale),
   réponses réglées par window.__CZ_TEST, et tout ce qu'envoie Établi 3D noté dans window.__cz.
   Comme le vrai module, init() lit le jeton passé par le portail (#centrale=…) et le RETIRE de l'adresse :
   l'application doit donc le repérer avant d'appeler init(). */
(function(){
  const T=window.__CZ_TEST||{}, rec=window.__cz={init:null, sauve:[], progres:[], fichiers:[], depots:[]};
  let on=false, jeton=null;
  window.Centrale={
    init(o){ rec.init=o;
      if(/(^|[#&])centrale=/.test(location.hash)){ jeton='essai'; history.replaceState(null, '', location.pathname+location.search); }
      return this; },
    connecte:()=>on, session:()=>on? {classe:'5A', eleve:T.eleve||'07'} : null,
    deconnexion(){ on=false; },
    afficherConnexion(el, opt){
      if(jeton){ jeton=null; on=true; rec.nav?.relancer(); setTimeout(()=>opt.onConnecte({classe:'5A', eleve:T.eleve||'07'}), 50); return; }   // ouvert depuis le portail
      el.innerHTML=''; const b=document.createElement('button'); b.id='czFaux'; b.textContent='Se connecter (essai)';
      b.onclick=()=>{ on=true; rec.nav?.relancer(); opt.onConnecte({classe:'5A', eleve:T.eleve||'07'}); }; el.append(b); },
    async mesProgressions(){ return T.progressions||{}; },
    async charger(cle, def){ rec.charges=(rec.charges||0)+1; return cle==='projet' && T.projet? JSON.parse(JSON.stringify(T.projet)) : def; },
    sauver(cle, v){ rec.sauve.push([cle, v]); return Promise.resolve(); },
    async listeDonnees(){ return T.donnees||(T.projet? [{cle:'projet', maj:1}] : []); },
    progression(id, p){ rec.progres.push([id, p]); return Promise.resolve(); },
    activiteDemandee(){ const a=T.activite||null; T.activite=null; return a; },
    async envoyerFichier(b, nom){ rec.fichiers.push({nom, type:b.type, taille:b.size}); return {nom}; },
    nomFichier:(ext, suf)=>`5A_07_etabli3d_${suf? suf.replace(/\W+/g,'-')+'_' : ''}2026.${ext}`,
    contexteAtelier:()=>T.atelier? {parcours:1, etape:0} : null,
    async etape(){ return T.atelier? {numero:0, parcours:{id:1}, fichiers:T.dossier||[], etape:{ouverte:true, deposees:[...new Set(rec.depots.map(d=>d.nom))], ...T.atelier}} : null; },
    // bouton « ← » du widget de l'élève (Centrale récente) : seulement si le test le demande, pour essayer aussi le bouton de secours
    boutonPrecedent: T.precedent? (o)=>{ const b=document.createElement('button'); b.type='button'; b.className=o.classe||'centrale-precedent'; b.hidden=true;
      b.innerHTML='<span aria-hidden="true">←</span><span class="centrale-precedent-txt"></span>'; rec.precedent={maj:0, clic:0};
      b.addEventListener('click', ()=>{ rec.precedent.clic++; });
      const maj=()=>{ rec.precedent.maj++; b.hidden=false; b.querySelector('.centrale-precedent-txt').textContent= on? 'Étape précédente' : 'Mes ateliers'; };
      maj(); return {bouton:b, maj}; } : undefined,
    // navigation intégrée (Centrale récente) : seulement si le test donne T.nav ; aller() est noté dans __cz.allers
    navigation: T.nav? (rappel, o)=>{ rec.nav={options:o, appels:0, maj:0};
      const nav=()=>{ if(!on) return null; const x=JSON.parse(JSON.stringify(T.nav));
        for(const k of ['precedent','suivant']) if(x[k]) x[k].aller=async()=>{ (rec.allers=rec.allers||[]).push(k); if(x[k].verrou) return false; await rec.init?.avantDeQuitter?.(); return true; };
        return x; };
      const appel=()=>setTimeout(()=>{ rec.nav.appels++; rappel(nav()); }, 0);
      appel(); rec.nav.relancer=appel; return {maj:()=>{ rec.nav.maj++; appel(); }, arreter(){}}; } : undefined,
    surChangementVue: T.nav? (f)=>{ (rec.vue=rec.vue||[]).push(f); } : undefined,
    nomAffiche: T.nom!==undefined? ()=>T.nom===null? '07' : (T.nom||'pas désanonymisé') : undefined,
    nomEnseignant: T.nom!==undefined? ()=>T.nom : undefined,
    projet:{ async charger(nom){ return T.fichiers?.[nom]? JSON.parse(JSON.stringify(T.fichiers[nom])) : null; },
      async sauver(nom, b){ rec.depots.push({nom, type:b.type, taille:b.size}); return {nom, version:1}; } },
  };
})();
