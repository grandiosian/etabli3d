/* Fausse Centrale pour les tests : mêmes fonctions que le vrai module (centrale-client.js de la Centrale),
   réponses réglées par window.__CZ_TEST, et tout ce qu'envoie Établi 3D noté dans window.__cz. */
(function(){
  const T=window.__CZ_TEST||{}, rec=window.__cz={init:null, sauve:[], progres:[], fichiers:[], depots:[]};
  let on=false;
  window.Centrale={
    init(o){ rec.init=o; return this; },
    connecte:()=>on, session:()=>on? {classe:'5A', eleve:'07'} : null,
    deconnexion(){ on=false; },
    afficherConnexion(el, opt){ el.innerHTML=''; const b=document.createElement('button'); b.id='czFaux'; b.textContent='Se connecter (essai)';
      b.onclick=()=>{ on=true; opt.onConnecte({classe:'5A', eleve:'07'}); }; el.append(b); },
    async mesProgressions(){ return T.progressions||{}; },
    async charger(cle, def){ return cle==='projet' && T.projet? JSON.parse(JSON.stringify(T.projet)) : def; },
    sauver(cle, v){ rec.sauve.push([cle, v]); return Promise.resolve(); },
    progression(id, p){ rec.progres.push([id, p]); return Promise.resolve(); },
    activiteDemandee(){ const a=T.activite||null; T.activite=null; return a; },
    async envoyerFichier(b, nom){ rec.fichiers.push({nom, type:b.type, taille:b.size}); return {nom}; },
    nomFichier:(ext, suf)=>`5A_07_etabli3d_${suf? suf.replace(/\W+/g,'-')+'_' : ''}2026.${ext}`,
    contexteAtelier:()=>T.atelier? {parcours:1, etape:0} : null,
    async etape(){ return T.atelier? {numero:0, etape:T.atelier} : null; },
    projet:{ async charger(nom){ return T.fichiers?.[nom]? JSON.parse(JSON.stringify(T.fichiers[nom])) : null; },
      async sauver(nom, b){ rec.depots.push({nom, type:b.type, taille:b.size}); return {nom, version:1}; } },
  };
})();
