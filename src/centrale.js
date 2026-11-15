/* =========================================================
   Passerelle avec la Centrale (serveur de la classe : code élève, sauvegarde, progression, ateliers).
   Contrat : centrale.json (descripteur passerelle.atelier v1, à la racine du site) et PASSERELLE.md.
   - window.Etabli3D : point d'accès unique aux données d'Établi 3D (utilisé ici, par outils/ et par les tests) ;
   - le module de la Centrale (js/centrale-client.js) est chargé à la fin du démarrage ; s'il est injoignable,
     Établi 3D fonctionne seul (enregistrement dans le navigateur).
   ========================================================= */
const ETABLI_VERSION='1.5.0';   // = atelier.version de centrale.json
const PROJET_FORMAT=2;          // version du document « projet » (2 : matières p.mat et images textures)

/* ---- compétences (référentiel de la Centrale : /passerelle/competences.json, programme de technologie cycle 4)
   capacités travaillées par catégorie d'activité, pour chaque niveau (la capacité envoyée suit la classe de l'élève) */
const COMP_CAT={
  model:  {5:['CCRI16.5.1'], 4:['CCRI16.4.1'], 3:['CCRI16.3.1']},                         // modélisation et fabrication
  sketch: {5:['CCRI16.5.1'], 4:['CCRI16.4.1'], 3:['CCRI16.3.1']},
  move:   {5:['SFC11.5.1','CCRI16.5.1'], 4:['SFC11.4.2','CCRI16.4.1'], 3:['SFC11.3.1','CCRI16.3.1']},   // chaîne d'énergie, transmission de mouvement
  struct: {5:['CCRI21.5.1'], 4:['CCRI21.4.1'], 3:['CCRI21.3.1']},                         // tenue mécanique par simulation
};
const competencesCat=c=>[...new Set([5,4,3].flatMap(n=>(COMP_CAT[c]||{})[n]||[]))];   // ordre 5e, 4e, 3e
/* niveau de l'élève connecté d'après sa classe (« 5A », « 4C-LHA ») ; 5 par défaut */
const niveauEleve=()=>{ const m=/^\s*([3-6])/.exec(window.Centrale?.session?.()?.classe||''); return m? +m[1] : 5; };

/* ---- activités : tutos, exercices et exemples (identifiants stables : tuto-<clé>, exo-<clé>, ex-<clé>) */
const actKey=id=>{ const m=/^(tuto|exo|ex)-(.+)$/.exec(id||''); return m? m[1]+':'+m[2] : null; };   // id d'activité → clé de PROG
const catTitle=c=>(LCATS.find(x=>x[0]===c)||[c,c])[1];
function etabliCatalogue(){
  const L=Object.entries(LESSONS), out=[];
  for(const type of ['tuto','exo']) for(const [k,T] of L) if(T.type===type)
    out.push({id:`${type}-${k}`, titre:T.title, groupe:catTitle(T.cat), total:T.steps.length, competences:competencesCat(T.cat), type, niveau:T.level, categorie:T.cat, resume:T.desc||(T.brief||'').replace(/<[^>]+>/g,'')});
  for(const [k,S] of Object.entries(SAMPLES))
    out.push({id:`ex-${k}`, titre:S.title, groupe:catTitle(S.cat), total:Math.max(1, S.note?.try?.length||0), competences:competencesCat(S.cat), type:'exemple', niveau:S.level, categorie:S.cat, resume:S.desc||''});
  return out;
}
function etabliProgression(id){
  const key=actKey(id), cat=etabliCatalogue().find(a=>a.id===id); if(!key || !cat) return null;
  const k=key.split(':')[1], done=!!PROG.done[key];
  const faites= done? cat.total : key.startsWith('ex:')? 0 : Math.min(cat.total, PROG.part[k]||0);
  if(!done && !faites && !PROG.seen[key]) return null;
  return {titre:cat.titre, faites, total:cat.total, statut: done? 'termine' : 'commence'};
}
function etabliFusionner(serveur){
  const ids=new Set(etabliCatalogue().map(a=>a.id));
  for(const [id,p] of Object.entries(serveur||{})){ if(!ids.has(id)) continue; const key=actKey(id), k=key.split(':')[1];
    PROG.seen[key]=1; if(!key.startsWith('ex:')) PROG.part[k]=Math.max(PROG.part[k]||0, p.faites||0);
    if(p.statut==='termine' && !PROG.done[key]) PROG.done[key]=Date.now(); }
  saveProg();
}
/* ---- le projet (clé de données « projet ») */
const etabliProjet=()=>JSON.parse(JSON.stringify({app:'etabli3d', version:PROJET_FORMAT, name:state.name, parts:state.parts, joints:state.joints, nextId:state.nextId, note:state.note||null, tp:state.tp||null, struct:state.struct||null, textures:usedTextures(), tuto:tutoEnCours()}));
function estProjet(o){
  if(!o || typeof o!=='object' || !Array.isArray(o.parts) || (o.app && o.app!=='etabli3d') || (o.version||1)>PROJET_FORMAT) return false;
  const ok=ps=>ps.every(p=>p && Number.isInteger(p.id) && KINDS[p.kind] && Array.isArray(p.pos) && p.pos.length===3 && Array.isArray(p.rot) && p.rot.length===3 && (p.kind!=='group' || (Array.isArray(p.children) && ok(p.children))));
  return ok(o.parts);
}
/* ouvre un projet en gardant l'ancien dans l'historique (« Annuler » y revient) */
function ouvrirProjet(o){ if(state.edit) finishGroupEdit(); $('#gallery').hidden=true; loadProject(JSON.parse(JSON.stringify(o)), false); commit(); }
/* ---- fichiers produits */
function fichierStl(){
  if(state.edit) finishGroupEdit();
  const list=state.parts.map(p=>({p, r:meshes.get(p.id)})).filter(x=>x.r && !x.p.hole && !isHidden(x.p)); if(!list.length) return null;
  list.forEach(x=>x.r.mesh.updateMatrixWorld(true)); return new Blob([stlBinary(list.map(x=>x.r))], {type:'model/stl'});
}
function apercu(largeur=640){
  renderer.render(scene, camera); const src=renderer.domElement, w=largeur, hh=Math.round(w*src.height/Math.max(1,src.width));
  const c=document.createElement('canvas'); c.width=w; c.height=hh; c.getContext('2d').drawImage(src,0,0,w,hh);
  return new Promise(ok=>c.toBlob(ok,'image/png'));
}
function etabliResume(){
  const parts=state.parts.map(p=>{ const r=meshes.get(p.id), b=r? new THREE.Box3().setFromObject(r.mesh) : null, s=b&&!b.isEmpty()? b.getSize(new THREE.Vector3()) : null, M=matOf(p);
    const V= r && !p.hole? geoVolume(r.mesh.geometry)/1000 : 0;
    return {id:p.id, nom:p.name, forme:p.kind, percage:!!p.hole, matiere:p.mat?.k||null, taille: s? [s.x,s.y,s.z].map(v=>+v.toFixed(2)) : null,
      volume:+V.toFixed(3), masse: M?.[6] && V? +(V*M[6]).toFixed(2) : null, validation:vState(p)}; });
  return {nom:state.name, unites:{longueur:'mm', volume:'cm3', masse:'g'}, pieces:parts,
    liaisons:state.joints.map(j=>({id:j.id, nom:j.name, type:j.type, mobile:j.child, support:j.parent, moteur:j.motor?.mode||null, entrainee:!!j.driver})),
    totaux:{pieces:parts.length, solides:parts.filter(p=>!p.percage).length, percages:parts.filter(p=>p.percage).length, liaisons:state.joints.length, masse:+parts.reduce((a,p)=>a+(p.masse||0),0).toFixed(2)}};
}
/* fichiers produits, reconnus par leur extension (centrale.json → fichiers.produit) */
async function fichierPour(nom){
  const ext=(/\.([a-z0-9]+)$/i.exec(nom||'')||[])[1]?.toLowerCase();
  if(/resume\.json$/i.test(nom)) return new Blob([JSON.stringify(etabliResume(),null,1)], {type:'application/json'});
  if(ext==='json') return new Blob([JSON.stringify(etabliProjet())], {type:'application/json'});
  if(ext==='stl') return fichierStl();
  if(ext==='png') return apercu();
  return null;
}

window.Etabli3D=Object.freeze({
  app:'etabli3d',
  version:ETABLI_VERSION,
  descripteur:'centrale.json',
  /** Activités déclarées à la Centrale (colonnes du suivi) : [{id, titre, groupe, total}]. */
  activites:()=>etabliCatalogue().map(({id,titre,groupe,total,competences})=>({id,titre,groupe,total,competences})),
  /** Catalogue détaillé (champs de activites.liste dans centrale.json). */
  catalogue:etabliCatalogue,
  /** Catalogue des ateliers (ateliers.json, format catalogue.ateliers v1) : un tuto, un exercice ou un exemple = un atelier. */
  ateliers:()=>({format:'catalogue.ateliers', version:1, app:'etabli3d', app_version:ETABLI_VERSION, referentiel:'technologie-c4-2024',
    ateliers:etabliCatalogue().map(a=>({id:a.id, titre:a.titre, niveau:'', resume:a.resume, competences:a.competences,
      activites:[{id:a.id, titre:a.titre, total:a.total, competences:a.competences}], ouvrir:a.id, etiquettes:[a.type, a.groupe],
      interface:interfaceAtelier(a.id)}))}),   // ce que l'élève peut ouvrir quand l'atelier est lancé depuis la Centrale
  /** Progression d'une activité au format de la Centrale, ou null si jamais ouverte. */
  progression:etabliProgression,
  /** Fusionne le résultat de Centrale.mesProgressions() (le meilleur est gardé). */
  fusionnerProgression:etabliFusionner,
  /** Valeurs des clés enregistrées (centrale.json → donnees). */
  donnees:()=>({projet:etabliProjet()}),
  /** true si l'objet est un projet Établi 3D chargeable. */
  estProjet,
  /** Ouvre un projet (l'ancien reste accessible avec Annuler). */
  ouvrirProjet:o=>{ if(!estProjet(o)) throw new Error('Ce n’est pas un projet Établi 3D.'); ouvrirProjet(o); },
  /** Résumé calculé : pièces (taille, volume, matière, masse), liaisons, totaux. */
  resume:etabliResume,
  /** Fichier produit d'après son nom : .json (projet ; resume.json = résumé), .stl, .png. Promise<Blob|null>. */
  fichier:fichierPour,
});

/* =========================================================
   Connexion à la Centrale (facultative) : widget de l'élève (« Visiteur »), sauvegarde du projet, progression,
   activité demandée par le portail, fichiers de l'élève et dossier de projet des ateliers.
   ========================================================= */
const CZ={pret:false, bouton:null, precedent:null, fenetre:null, serveur:'', constate:new Set(), indices:{}};
/* adresse du portail quand Établi 3D a été ouvert depuis la Centrale (gardée par le module de la Centrale) */
const adresseRetourCentrale=()=>{ try{ return sessionStorage.getItem('centrale-retour'); }catch(e){ return null; } };
/* ouvert depuis le portail de la Centrale : l'adresse est lue au chargement (le module en retire aussitôt le jeton), puis le retour gardé */
var OUVERT_DEPUIS_PORTAIL=/(^|[#&])(centrale|retour)=/.test(location.hash);
/* retour au portail de la Centrale (clic sur la pastille de l'atelier) : enregistre d'abord, comme « ← Mes ateliers » */
function allerPortailCentrale(){
  const C=window.Centrale;
  if(C && C.allerPortail && C.allerPortail()) return;
  if(C && C.retour && C.retour()!==false) return;
  const r=adresseRetourCentrale(); if(r) location.href=r;
}
/* ---- Mode atelier : Établi 3D ouvert depuis le portail de la Centrale. L'élève reste sur l'atelier demandé.
   Règles par défaut : pas de menu du logo (Fichier, Ctrl+S), pas de bibliothèque ni d'autre tuto ou exemple (onglets et
   boutons du Guide), pas de changement de niveau. Un atelier peut en rouvrir avec un champ interface:{menu, bibliotheque,
   niveau} (tuto ou exercice : LESSONS ; exemple : SAMPLES) ; il est publié dans ateliers.json. */
var INTERFACE_ATELIER={menu:false, bibliotheque:false, niveau:false};
function interfaceAtelier(id){   // règles complètes d'un atelier du catalogue (tuto-…, exo-…, ex-…)
  const [t,k]=[id.split('-')[0], id.slice(id.indexOf('-')+1)], def= t==='ex'? SAMPLES[k] : LESSONS[k];
  return Object.assign({}, INTERFACE_ATELIER, def?.interface||{});
}
function atelierDemande(){   // le tuto, l'exercice ou l'exemple ouvert par la Centrale
  if(GUIDE.src==='tuto' && GUIDE.tuto && LESSONS[GUIDE.tuto]) return LESSONS[GUIDE.tuto];
  return state.note?.key ? SAMPLES[state.note.key] || null : null;
}
/* Vue enseignant d'un essai (« Tester à la place d'un élève », interrupteur Élève | Enseignant du module de la Centrale) :
   aucune règle d'atelier (menu, bibliothèque, niveau) ; la pastille de l'atelier ouvre la bibliothèque. Gardée par la
   Centrale avec la session (Centrale.vue) : le portail et les autres applications la retrouvent. */
function vueProfEtabli(){ return !!(window.Centrale?.vue && Centrale.connecte() && Centrale.vue()==='enseignant'); }
let vueEtabli=false;
function appliquerVueEtabli(){
  const v=vueProfEtabli(); if(v===vueEtabli) return; vueEtabli=v;   // seulement quand la vue change
  document.documentElement.classList.toggle('vue-prof', v);
  majModeAtelier(); document.querySelectorAll('.menu').forEach(m=>{ m.hidden=true; });
}
function regleAtelier(cle){   // true : permis (hors mode atelier, tout est permis)
  if(!depuisPortail() || vueProfEtabli()) return true;
  const r=Object.assign({}, INTERFACE_ATELIER, atelierDemande()?.interface||{});
  return r[cle]!==false;
}
function majModeAtelier(){   // classes de <html> lues par la feuille de style
  const d=document.documentElement, at=depuisPortail();
  d.classList.toggle('mode-atelier', at);
  for(const k of Object.keys(INTERFACE_ATELIER)) d.classList.toggle('sans-'+k, at && !regleAtelier(k));
}
function depuisPortail(){   // déclaration de fonction : utilisable aussi depuis guide.js, chargé avant
  if(OUVERT_DEPUIS_PORTAIL || /(^|[#&])(centrale|retour)=/.test(location.hash)) return true;
  try{ return !!sessionStorage.getItem('centrale-retour'); }catch(e){ return false; }
}
function centraleInit(){
  // Le widget de l'élève (barre du haut) existe dès l'ouverture : « Visiteur » tant que la Centrale n'est pas connectée ou joignable
  CZ.bouton=$('#bCentrale'); if(CZ.bouton) CZ.bouton.onclick=e=>{ e.stopPropagation(); centraleClic(); };
  centraleBouton();
  // Copie servie par une Centrale (…/miroir/etabli3d/) : on parle à cette Centrale-là (ex. Centrale locale)
  const miroir=/^https?:$/.test(location.protocol)&&location.pathname.match(/^(.*?\/)miroir\/[^/]+\//);
  CZ.serveur=window.CENTRALE_URL||(miroir?location.origin+miroir[1]:'https://technoversailles.alwaysdata.net/');
  const js=document.createElement('script'); js.src=CZ.serveur+'js/centrale-client.js'; js.onload=centraleDemarrer;   // injoignable : rien ne change
  document.head.appendChild(js);
}
function centraleDemarrer(){
  if(!window.Centrale) return;
  const avecJeton=/(^|[#&])centrale=/.test(location.hash);   // à lire AVANT init : le module retire aussitôt le jeton de l'adresse
  Centrale.init({api:CZ.serveur+'api/', app:'etabli3d', activites:Etabli3D.activites(), avantDeQuitter:centraleAvantDeQuitter,
    boutonRetour:false,   // « ← Étape précédente » / « ← Mes ateliers » est dans le widget de la barre du haut
    // module récent : « Suivant » est dans le pied du Guide (Centrale.navigation, plus bas) ; pas de bouton flottant
    // (une première version du module le dessinait encore si navigation() était appelé après init())
    ...(Centrale.navigation? {boutonSuivant:false} : {}),
    surDeconnexion:()=>{ CZ.pret=false; centraleBouton(); centraleMenu(); toast('Session terminée : reconnecte-toi pour enregistrer ton travail.'); }});
  // « ← » et « Suivant → » en pied du Guide (le module retire alors ses boutons flottants) ; module plus ancien : ses boutons restent
  if(Centrale.navigation) CZ.navigation=Centrale.navigation(nav=>{ CZ.nav=nav||null; majPiedGuide(); }, {activite:activiteOuverte});
  // vue Enseignant d'un essai : le widget montre le nom de l'élève (Centrale.nomAffiche)
  if(Centrale.surChangementVue) Centrale.surChangementVue(()=>centraleBouton());
  centraleBouton();
  if(avecJeton || Centrale.connecte()) Centrale.afficherConnexion(centraleCorps(), {onConnecte:centraleConnecte});
}
/* ---- Navigation intégrée : pied du Guide (le panneau consigne), « ← » et « Suivant → ».
   Le module de la Centrale calcule quoi afficher (Centrale.navigation, SPECIFICATION §2.6) : étape d'un parcours,
   activité suivante d'un atelier du calendrier, ou portail. CZ.nav vaut null hors de la Centrale : pas de pied. */
function activiteOuverte(){   // id de l'activité ouverte (tuto-…, exo-…, ex-…), '' sinon
  const T=GUIDE.tuto && LESSONS[GUIDE.tuto], n=state.note?.key && SAMPLES[state.note.key]? 'ex-'+state.note.key : '';
  if(T && (GUIDE.src==='tuto' || !n)) return T.type+'-'+GUIDE.tuto;
  return n;
}
function piedGuide(){
  const a=activiteOuverte();   // l'élève a changé d'activité dans Établi 3D : le module recalcule la suite
  if(CZ.navigation && a!==CZ.navAct) CZ.navigation.maj();   // aussi à la première activité ouverte : position juste tout de suite
  CZ.navAct=a;
  const nav=CZ.nav; if(!nav || (!nav.precedent && !nav.suivant)) return null;
  const p=nav.precedent, pos=nav.position;
  // activité inconnue du module (sans position) : « Suivant » mènerait aussi au portail, le « ← Mes ateliers » suffit
  const s= nav.suivant && !(nav.suivant.cible==='portail' && !nav.suivant.fin && !pos && p?.cible==='portail')? nav.suivant : null;
  const partir=async(x, b)=>{
    if(x.verrou) return toast(x.raison||'Pas encore ouvert.', 3200);
    b.disabled=true; b.classList.add('attente');
    const ok=await Promise.resolve(x.aller()).catch(()=>false);
    if(ok===false){ b.disabled=false; b.classList.remove('attente'); toast(x.raison||'Pas encore : termine d’abord cette étape.', 3200); CZ.navigation?.maj(); }
  };
  const bp= p? h('button',{type:'button',class:'btn gd-prec',title:p.titre||p.libelle||'','aria-label':p.libelle||p.court||'Revenir'},
    h('span',{'aria-hidden':'true'},'←'), h('span',{class:'gd-pied-txt'}, p.court||p.libelle)) : null;
  if(bp) bp.onclick=()=>partir(p, bp);
  const vers= s && s.cible!=='portail';   // étape ou activité suivante ; sinon retour au portail (« Mes ateliers → »)
  const bs= s? h('button',{type:'button',class:'btn gd-suiv'+(s.verrou?' verrou':' primary'),title:s.titre||s.libelle||'','aria-disabled':s.verrou? 'true' : null},
    s.verrou? svgIcon('lock') : null,
    h('span',{class:'gd-suiv-t'}, h('b',{}, vers? 'Suivant' : s.libelle), vers && s.libelle? h('small',{}, s.libelle) : null),
    vers && !s.verrou? h('span',{'aria-hidden':'true'},'→') : null) : null;   // « Mes ateliers → » porte déjà sa flèche
  if(bs) bs.onclick=()=>partir(s, bs);
  return h('div',{class:'gd-pied'},
    pos? h('div',{class:'gd-pied-pos'}, (nav.contexte==='atelier'? 'Atelier · ' : nav.contexte==='parcours'? 'Parcours · ' : '')+`étape ${pos.numero} / ${pos.total}`, pos.titre? h('span',{}, ' · '+pos.titre) : null) : null,   // à ne pas confondre avec les étapes du tuto
    h('div',{class:'gd-pied-nav'}, bp||h('span'), bs),
    s?.verrou && s.raison? h('p',{class:'gd-pied-raison'}, s.raison) : null);
}
function majPiedGuide(){   // seulement le pied : le reste du guide (et son défilement) ne bouge pas
  const el=$('#demo'); if(!el || el.hidden) return;
  const ancien=el.querySelector(':scope > .gd-pied'), neuf=piedGuide();
  if(!!ancien!==!!neuf) return renderDemo();   // le pied apparaît ou disparaît : bouton Fermer, message de fin
  if(ancien){ ancien.replaceWith(neuf); hydrateIcons(neuf); }
}
/* Widget de l'élève : « Visiteur », ou son identifiant une fois connecté, précédé du bouton « ← » de la Centrale */
function centraleBouton(){
  const b=CZ.bouton; if(!b) return; const s=window.Centrale?.connecte() && Centrale.session(); b.innerHTML='';
  // vue Enseignant d'un essai : le nom gardé sur l'ordinateur de l'enseignant, ou « pas désanonymisé » (en italique)
  const nomProf= s && Centrale.nomEnseignant? Centrale.nomEnseignant() : null;
  const nom= s? ((Centrale.nomAffiche && Centrale.nomAffiche()) || s.identifiant || s.eleve) : 'Visiteur';
  b.append(svgIcon('user'), h('span',{class:nomProf===''? 'anonyme' : null}, nom));
  b.title= nomProf!=null? `Vue enseignant : ${nomProf? 'nom gardé sur cet ordinateur' : 'élève pas désanonymisé sur cet ordinateur'} (identifiant ${s.identifiant||s.eleve}). Clic : retour sur la Centrale`
    : s? 'Connecté : ton travail est enregistré sur le serveur de la classe. Clic : retour sur la Centrale' : 'Visiteur : clique pour te connecter avec ton code et enregistrer ton travail';
  centraleRetourBouton(); centraleVueBouton(); majAtelier();
}
/* Interrupteur Élève | Enseignant (essai de l'enseignant), juste après l'activité au centre de la barre ; caché hors essai */
function centraleVueBouton(){
  if(!window.Centrale?.boutonVue) return;
  if(!CZ.vue){ CZ.vue=Centrale.boutonVue({classe:'tb-vue', onChange:appliquerVueEtabli}); $('#tbAtelier')?.after(CZ.vue.bouton); }
  CZ.vue.maj(); appliquerVueEtabli();
}
function centraleRetourBouton(){
  const w=$('#widgetCentrale'); if(!w) return; let ret=$('#bRetourCentrale');
  // Centrale récente : bouton commun « ← Étape précédente » (parcours, quelle que soit l'application) ou « ← Mes ateliers » (portail),
  // caché hors de la Centrale ; il se met aussi à jour tout seul
  if(window.Centrale?.boutonPrecedent){
    if(!CZ.precedent){
      if(ret) ret.remove();   // bouton de secours posé avant le chargement du module
      CZ.precedent=Centrale.boutonPrecedent({classe:'tbid-ret'}); CZ.precedent.bouton.id='bRetourCentrale';
      // en attendant la réponse du module (étape du parcours) : pas de pastille vide ni de clignotement
      if(adresseRetourCentrale()){ const t=CZ.precedent.bouton.querySelector('.centrale-precedent-txt'); if(t && !t.textContent) t.textContent='Mes ateliers'; CZ.precedent.bouton.hidden=false; }
      w.prepend(CZ.precedent.bouton);
    }
    CZ.precedent.maj(); return;
  }
  // Centrale plus ancienne (ou module pas encore chargé) : retour au portail seulement
  const adresse=adresseRetourCentrale();
  if(!adresse){ ret?.remove(); return; }
  if(!ret) w.prepend(h('button',{type:'button',id:'bRetourCentrale',class:'tbid-ret',title:'Revenir à tous tes ateliers sur la Centrale (ton travail est enregistré)','aria-label':'Mes ateliers',
    onclick:e=>{ e.stopPropagation(); if(!(window.Centrale?.retour && Centrale.retour())) location.href=adresse; }},
    h('span',{'aria-hidden':'true'},'←'), h('span',{class:'tbid-txt'},'Mes ateliers')));
}
function centraleClic(){
  if(!window.Centrale) return toast('La Centrale est injoignable pour le moment : Établi 3D fonctionne sans connexion.');
  // connecté : retour sur la Centrale (le compte et le surnom se gèrent sur le portail) ;
  // module plus ancien : menu de l'élève commun, sinon l'ancienne confirmation
  if(Centrale.connecte() && Centrale.allerPortail && Centrale.allerPortail()) return;
  if(Centrale.connecte() && Centrale.menuEleve){
    Centrale.menuEleve(CZ.bouton,{onChange:centraleBouton, onDeconnexion:()=>{ CZ.pret=false; centraleBouton(); centraleMenu(); toast('Déconnecté. Établi 3D enregistre de nouveau dans ce navigateur seulement.'); }});
    return; }
  if(Centrale.connecte()){ const s=Centrale.session();
    if(confirm(`Connecté : ${s.classe} · élève ${s.eleve}.\nTon travail est enregistré automatiquement.\n\nSe déconnecter ?`)){ Centrale.deconnexion(); CZ.pret=false; centraleBouton(); centraleMenu(); toast('Déconnecté. Établi 3D enregistre de nouveau dans ce navigateur seulement.'); }
    return; }
  const corps=centraleCorps(); centraleMontrer(true); Centrale.afficherConnexion(corps, {onConnecte:centraleConnecte});
}
function centraleCorps(){
  if(CZ.fenetre) return CZ.fenetre.querySelector('.cz-corps');
  const f=CZ.fenetre=h('div',{class:'overlay',id:'centraleFenetre',hidden:true},
    h('div',{class:'cz-card',role:'dialog','aria-label':'Connexion de la classe'},
      h('div',{class:'cz-head'}, h('b',{},'Connexion de la classe'), h('button',{class:'btn icon ghost','aria-label':'Fermer','data-fermer':'1'}, svgIcon('close'))),
      h('p',{},'Avec ton code, ton projet et ta progression sont enregistrés : tu les retrouves sur n’importe quel ordinateur, et ton professeur voit ton avancement.'),
      h('div',{class:'cz-corps'})));
  f.addEventListener('click',e=>{ if(e.target===f || e.target.closest('[data-fermer]')) centraleMontrer(false); });
  document.body.append(f); return f.querySelector('.cz-corps');
}
function centraleMontrer(oui){ if(CZ.fenetre) CZ.fenetre.hidden=!oui; }
async function centraleConnecte(infos){
  centraleMontrer(false); centraleBouton();
  try{
    // 1. progression : le meilleur entre ce navigateur et le serveur, puis on renvoie ce qui est en avance ici
    const serveur=await Centrale.mesProgressions(); Etabli3D.fusionnerProgression(serveur);
    for(const a of Etabli3D.activites()){ const l=Etabli3D.progression(a.id), p=serveur?.[a.id]; if(l && (!p || l.faites>(p.faites||0) || (l.statut==='termine' && p.statut!=='termine'))) Centrale.progression(a.id, l); }
    // 2. projet : celui du serveur s'il existe (l'ancien reste dans Annuler), sinon on envoie celui du navigateur
    //    (dans un atelier : date du projet du serveur AVANT cet envoi, pour la comparer aux dépôts de l'étape)
    CZ.projetMaj= Centrale.contexteAtelier?.()? ((await Centrale.listeDonnees().catch(()=>[])).find(c=>c.cle==='projet')?.maj||0) : 0;
    const projet=await Centrale.charger('projet', null);
    if(estProjet(projet)){ if(JSON.stringify(projet)!==JSON.stringify(etabliProjet())) ouvrirProjet(projet); }
    else Centrale.sauver('projet', etabliProjet());
    CZ.pret=true;
    // 3. atelier transversal : on reprend le projet de l'étape (dépôt de l'élève, sinon fichier reçu)
    const E= Centrale.contexteAtelier && Centrale.contexteAtelier()? await Centrale.etape().catch(()=>null) : null; CZ.etape=E;
    if(E?.etape){ const f=await atelierArrivee(E).catch(()=>null); if(f) toast(`Fichier de l’atelier ouvert : ${f}. Ton projet précédent reste dans Annuler.`); }
    // 4. activité demandée depuis le portail
    const dem=Centrale.activiteDemandee(); if(dem) centraleOuvrirActivite(dem);
    centraleMenu(); toast(`Connecté : ${infos.classe} · élève ${infos.eleve}. Ton travail est enregistré automatiquement.`);
  }catch(e){ toast('Connexion au serveur impossible : '+e.message); }
}
function centraleOuvrirActivite(id){
  const key=actKey(id); if(!key) return; const [type,k]=key.split(':');
  if(type==='ex'){ if(SAMPLES[k] && state.note?.key!==k) loadExample(k); }
  else if(LESSONS[k] && !(GUIDE.src==='tuto' && GUIDE.tuto===k)) startLesson(k);
}
/* Ouverture directe par l'adresse (#activite=exo-de), même sans la Centrale. Depuis le portail (#centrale=…&activite=…),
   c'est la connexion qui ouvre l'activité demandée (centraleConnecte). */
function etabliOuvrirAdresse(){
  const h=location.hash.replace(/^#/,''); if(/(^|&)centrale=/.test(h)) return;
  const m=/(?:^|&)activite=([^&]+)/.exec(h); if(!m) return;
  let id; try{ id=decodeURIComponent(m[1]); }catch(e){ return; }
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
  if(!etabliCatalogue().some(a=>a.id===id)) return toast('Activité inconnue : '+id);
  $('#gallery').hidden=true; centraleOuvrirActivite(id);
}
/* Sauvegarde de secours : le projet dans un fichier, puis le dossier Nuage de la classe
   (lien donné par la Centrale si l'élève est connecté, sinon lien collé sur ce poste par le professeur). */
const CLE_NUAGE='etabli3d.nuage';
const lienNuageLocal=()=>{ try{ return localStorage.getItem(CLE_NUAGE)||''; }catch(e){ return ''; } };
function nomFichierSecours(){
  const s=window.Centrale?.connecte?.()? Centrale.session() : null;
  return ((s? `${s.classe}-${s.eleve}-` : '')+slug(state.name)).replace(/[^A-Za-z0-9_.-]/g,'-')+'.json';
}
async function deposerSurNuage(){
  if(state.edit) finishGroupEdit();
  await offerFile(nomFichierSecours(), JSON.stringify(etabliProjet()));
  const s=window.Centrale?.connecte?.()? Centrale.session() : null, lien=s?.depot?.url||lienNuageLocal();
  if(!lien) return nuageFenetre();
  window.open(lien,'_blank','noopener');
  toast('Projet enregistré : glisse le fichier dans la page Nuage qui vient de s’ouvrir.'+(s?.depot?.mot_de_passe? ' Mot de passe : '+s.depot.mot_de_passe : ''), 6000);
}
function nuageFenetre(){
  $('#nuageFenetre')?.remove();
  const champ=h('input',{type:'url',placeholder:'https://nuage03.apps.education.fr/s/…','aria-label':'Lien du dossier Nuage de la classe',value:lienNuageLocal()});
  const f=h('div',{class:'overlay',id:'nuageFenetre'},
    h('div',{class:'cz-card',role:'dialog','aria-label':'Dépôt Nuage'},
      h('div',{class:'cz-head'}, h('b',{},'Dépôt Nuage'), h('button',{class:'btn icon ghost','aria-label':'Fermer','data-fermer':'1'}, svgIcon('close'))),
      h('p',{},'Ton projet est enregistré dans tes téléchargements. Aucun dossier Nuage n’est réglé sur cet ordinateur : demande le lien à ton professeur.'),
      h('p',{},h('b',{},'Professeur : '),'collez le lien de partage du dossier Nuage de la classe. Il est gardé sur cet ordinateur.'), champ,
      h('div',{class:'cz-actions'},
        h('button',{class:'btn primary',onclick:()=>{ const v=champ.value.trim(); if(!/^https:\/\/\S+$/.test(v)) return toast('Le lien doit commencer par https://');
          try{ localStorage.setItem(CLE_NUAGE, v); }catch(e){} f.remove(); window.open(v,'_blank','noopener'); toast('Lien gardé. Glisse le fichier dans la page Nuage.', 5000); }}, 'Garder et ouvrir'),
        h('button',{class:'btn ghost','data-fermer':'1'}, 'Fermer'))));
  f.addEventListener('click',e=>{ if(e.target===f || e.target.closest('[data-fermer]')) f.remove(); });
  document.body.append(f); champ.focus();
}
/* Fichiers projet (.json, sauf resume.json) d'une étape : d'abord ses sorties (ce que l'élève y a déjà déposé), puis ses entrées */
const estJsonProjet=nom=>/\.json$/i.test(nom||'') && !/resume\.json$/i.test(nom);
function atelierNoms(E){ return [...new Set([...(E.etape.sorties||[]), ...(E.etape.entrees||[])].filter(estJsonProjet))]; }
/* premier fichier .json de l'étape qui soit un projet Établi 3D : le dépôt de l'élève (sorties), sinon le fichier reçu (entrées) */
async function atelierEntree(E, noms=atelierNoms(E)){
  for(const nom of noms){ const o=await Centrale.projet.charger(nom, {format:'json'}).catch(()=>null); if(estProjet(o)){ ouvrirProjet(o); return nom; } }
  return null;
}
/* Arrivée dans une étape. On ouvre le fichier de l'atelier, sauf si le projet en cours est plus récent :
   - l'élève (ou son équipe) a déjà déposé un projet à cette étape → on le reprend, sauf si le projet que l'élève
     avait sur le serveur en arrivant (CZ.projetMaj) a été modifié après ce dépôt (travail continué puis onglet fermé) ;
   - rien de déposé → fichier reçu, sauf si l'élève a déjà commencé cette étape sur ce poste (repère local). */
async function atelierArrivee(E){
  const noms=atelierNoms(E); if(!noms.length) return null;
  const fichiers=E.fichiers||[], repere=`etabli3d.atelier:${E.parcours?.id}:${E.numero}`;
  const depot=fichiers.find(f=>!f.fourni && (E.etape.sorties||[]).includes(f.nom) && estJsonProjet(f.nom));
  let ouvrir=!state.parts.length;
  if(!ouvrir && depot) ouvrir=!(CZ.projetMaj > depot.maj+5);
  else if(!ouvrir){ try{ ouvrir=!localStorage.getItem(repere); }catch(e){ ouvrir=true; } }
  try{ localStorage.setItem(repere, '1'); }catch(e){}
  if(!ouvrir) return null;
  const avant=JSON.stringify(etabliProjet().parts), f=await atelierEntree(E, depot? [depot.nom, ...noms.filter(n=>n!==depot.nom)] : noms);
  return f && JSON.stringify(etabliProjet().parts)!==avant? f : null;
}
/* Dépose chaque sortie de l'étape, produite d'après son extension, de la plus rapide à la plus lente à produire
   (projet .json, resume.json, .stl, puis l'aperçu .png qui demande un rendu). Renvoie le nombre de fichiers déposés. */
const coutSortie=nom=>/\.png$/i.test(nom)? 3 : /\.stl$/i.test(nom)? 2 : /resume\.json$/i.test(nom)? 1 : 0;
async function atelierDepot(E, silencieux){
  const noms=[...(E?.etape?.sorties||[])].sort((a,b)=>coutSortie(a)-coutSortie(b)); let n=0;
  for(const nom of noms){ const b=await fichierPour(nom); if(!b) continue;
    try{ await Centrale.projet.sauver(nom, b); n++; }
    catch(e){ if(!silencieux) toast(e.conflit? `« ${nom} » a été modifié par ${e.auteur||'un coéquipier'} : rouvre le fichier puis recommence.` : 'Dépôt impossible : '+e.message); throw e; } }
  CZ.depose=JSON.stringify(etabliProjet());
  return n;
}
async function atelierDeposer(){
  const E=CZ.etape||await Centrale.etape().catch(()=>null); const noms=E?.etape?.sorties||[]; if(!noms.length) return toast('Cette étape de l’atelier n’attend pas de fichier.');
  let n; try{ n=await atelierDepot(E, false); }catch(e){ return; }
  toast(n? `${n} fichier${n>1?'s':''} déposé${n>1?'s':''} dans le dossier de l’atelier : ${noms.join(', ')}.` : 'Aucun des fichiers demandés ne peut être produit ici.');
}
/* Appelé par le module avant « ← Mes ateliers » et « Étape suivante » (5 s au plus) : dépose les sorties de l'étape
   si le projet a changé depuis le dernier dépôt. Sans atelier ou sans connexion : rien. */
async function centraleAvantDeQuitter(){
  if(!CZ.pret || !window.Centrale?.connecte() || !Centrale.contexteAtelier?.()) return;
  if(state.edit) finishGroupEdit();
  centraleTravail();
  const E=await Centrale.etape().catch(()=>CZ.etape); if(!E?.etape?.sorties?.length || !E.etape.ouverte) return;
  if(CZ.depose===JSON.stringify(etabliProjet()) && E.etape.sorties.every(n=>(E.etape.deposees||[]).includes(n))) return;
  await atelierDepot(E, true).catch(()=>{});
}
async function envoyerStl(){
  const b=fichierStl(); if(!b) return toast('Rien à envoyer : il faut au moins une pièce solide visible.');
  try{ const f=await Centrale.envoyerFichier(b, Centrale.nomFichier('stl', state.name)); toast(`Fichier envoyé au professeur : ${f?.nom||'STL'}.`); }catch(e){ toast('Envoi impossible : '+e.message); }
}
/* entrées du menu Fichier, seulement une fois connecté */
function centraleMenu(){
  $$('#menuFile .cz-item').forEach(e=>e.remove()); if(!CZ.pret || !window.Centrale?.connecte()) return;
  const item=(ic,t,f)=>{ const b=h('button',{role:'menuitem',class:'cz-item',onclick:()=>{ closeFileMenu(); f(); }}, svgIcon(ic), h('span',{},t)); return b; };
  const hr=$('#menuFile hr'); hr.before(item('send','Envoyer le STL au professeur', envoyerStl));
  if(Centrale.contexteAtelier && Centrale.contexteAtelier()){
    hr.before(item('folder','Reprendre le fichier de l’atelier', async()=>{ const E=CZ.etape||await Centrale.etape().catch(()=>null); const f=E? await atelierEntree(E) : null; toast(f? `Fichier de l’atelier ouvert : ${f}.` : 'Pas de projet Établi 3D dans les fichiers de cette étape.'); }));
    hr.before(item('send','Déposer dans le dossier de l’atelier', atelierDeposer)); }
}
/* appelés par Établi 3D : le projet a changé (commit), une activité a avancé (PROG) */
function centraleTravail(){ if(CZ.pret && window.Centrale?.connecte()) Centrale.sauver('projet', etabliProjet()); }
function centraleProgres(key){ if(!CZ.pret || !window.Centrale?.connecte()) return; const id=key.replace(':','-'), p=Etabli3D.progression(id); if(!p) return;
  const c=constatsActivite(key); if(c.length) p.constats=c; Centrale.progression(id, p); }
/* Constats de compétences, une fois par activité terminée dans cette session : tuto réussi (guidé : compte comme 1 indice),
   exercice réussi (indices = « Un indice ? » ouverts). Les exemples n'en envoient pas (on y observe, on n'y est pas évalué). */
function constatsActivite(key){
  const [type,k]=key.split(':'); if(!PROG.done[key] || type==='ex' || CZ.constate.has(key)) return [];
  const T=LESSONS[k]; const codes=(COMP_CAT[T?.cat]||{})[niveauEleve()]||[]; if(!codes.length) return [];
  CZ.constate.add(key);
  const indices= type==='tuto'? 1 : (CZ.indices[k]||0);
  return codes.map(competence=>({competence, reussi:true, indices, essais:1, preuve:`${type==='tuto'?'Tuto':'Exercice'} « ${T.title} » : ${T.steps.length}/${T.steps.length}`}));
}
/* « Un indice ? » ouvert pendant un exercice : compté dans son constat */
document.addEventListener('toggle', e=>{ if(e.target.matches?.('details.gd-tips') && e.target.open && GUIDE.tuto) CZ.indices[GUIDE.tuto]=1; }, true);
