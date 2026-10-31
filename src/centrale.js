/* =========================================================
   Passerelle avec la Centrale (serveur de la classe : code élève, sauvegarde, progression, ateliers).
   Contrat : centrale.json (descripteur passerelle.atelier v1, à la racine du site) et PASSERELLE.md.
   - window.Etabli3D : point d'accès unique aux données d'Établi 3D (utilisé ici, par outils/ et par les tests) ;
   - le module de la Centrale (js/centrale-client.js) est chargé à la fin du démarrage ; s'il est injoignable,
     Établi 3D fonctionne seul (enregistrement dans le navigateur).
   ========================================================= */
const ETABLI_VERSION='1.0.0';   // = atelier.version de centrale.json
const PROJET_FORMAT=2;          // version du document « projet » (2 : matières p.mat et images textures)

/* ---- activités : tutos, exercices et exemples (identifiants stables : tuto-<clé>, exo-<clé>, ex-<clé>) */
const actKey=id=>{ const m=/^(tuto|exo|ex)-(.+)$/.exec(id||''); return m? m[1]+':'+m[2] : null; };   // id d'activité → clé de PROG
const catTitle=c=>(LCATS.find(x=>x[0]===c)||[c,c])[1];
function etabliCatalogue(){
  const L=Object.entries(LESSONS), out=[];
  for(const type of ['tuto','exo']) for(const [k,T] of L) if(T.type===type)
    out.push({id:`${type}-${k}`, titre:T.title, groupe:catTitle(T.cat), total:T.steps.length, type, niveau:T.level, categorie:T.cat, resume:T.desc||(T.brief||'').replace(/<[^>]+>/g,'')});
  for(const [k,S] of Object.entries(SAMPLES))
    out.push({id:`ex-${k}`, titre:S.title, groupe:catTitle(S.cat), total:Math.max(1, S.note?.try?.length||0), type:'exemple', niveau:S.level, categorie:S.cat, resume:S.desc||''});
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
const etabliProjet=()=>JSON.parse(JSON.stringify({app:'etabli3d', version:PROJET_FORMAT, name:state.name, parts:state.parts, joints:state.joints, nextId:state.nextId, note:state.note||null, tp:state.tp||null, struct:state.struct||null, textures:usedTextures()}));
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
  activites:()=>etabliCatalogue().map(({id,titre,groupe,total})=>({id,titre,groupe,total})),
  /** Catalogue détaillé (champs de activites.liste dans centrale.json). */
  catalogue:etabliCatalogue,
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
   Connexion à la Centrale (facultative) : bouton « Mon code », sauvegarde du projet, progression,
   activité demandée par le portail, fichiers de l'élève et dossier de projet des ateliers.
   ========================================================= */
const CZ={pret:false, bouton:null, fenetre:null, serveur:''};
function centraleInit(){
  CZ.serveur=window.CENTRALE_URL||'https://technoversailles.alwaysdata.net/';
  const js=document.createElement('script'); js.src=CZ.serveur+'js/centrale-client.js'; js.onload=centraleDemarrer;   // injoignable : rien ne change
  document.head.appendChild(js);
}
function centraleDemarrer(){
  if(!window.Centrale) return;
  Centrale.init({api:CZ.serveur+'api/', app:'etabli3d', activites:Etabli3D.activites(),
    surDeconnexion:()=>{ CZ.pret=false; centraleBouton(); centraleMenu(); toast('Session terminée : reconnecte-toi pour enregistrer ton travail.'); }});
  const btn=h('button',{class:'btn ghost',id:'bCentrale',type:'button',onclick:centraleClic}); $('#bGuide').before(btn); CZ.bouton=btn; centraleBouton();
  if(/(^|[#&])centrale=/.test(location.hash) || Centrale.connecte()) Centrale.afficherConnexion(centraleCorps(), {onConnecte:centraleConnecte});
}
function centraleBouton(){
  const b=CZ.bouton; if(!b) return; const s=window.Centrale?.connecte() && Centrale.session(); b.innerHTML='';
  b.append(svgIcon(s? 'user' : 'login'), h('span',{class:'hide-narrow'}, s? `${s.classe} · ${s.eleve}` : 'Mon code'));
  b.title= s? 'Ton travail est enregistré sur le serveur de la classe' : 'Se connecter avec son code pour enregistrer son travail et sa progression';
}
function centraleClic(){
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
    const projet=await Centrale.charger('projet', null);
    if(estProjet(projet)){ if(JSON.stringify(projet)!==JSON.stringify(etabliProjet())) ouvrirProjet(projet); }
    else Centrale.sauver('projet', etabliProjet());
    CZ.pret=true;
    // 3. atelier transversal : projet vide → on part du fichier fourni par l'étape
    const E= Centrale.contexteAtelier && Centrale.contexteAtelier()? await Centrale.etape().catch(()=>null) : null; CZ.etape=E;
    if(E?.etape && !state.parts.length){ const f=await atelierEntree(E); if(f) toast(`Fichier de l’atelier ouvert : ${f}.`); }
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
/* premier fichier .json de l'étape (entrées) qui soit un projet Établi 3D */
async function atelierEntree(E){
  for(const nom of E.etape.entrees||[]){ if(!/\.json$/i.test(nom)) continue; const o=await Centrale.projet.charger(nom, {format:'json'}).catch(()=>null); if(estProjet(o)){ ouvrirProjet(o); return nom; } }
  return null;
}
async function atelierDeposer(){
  const E=CZ.etape||await Centrale.etape().catch(()=>null); const noms=E?.etape?.sorties||[]; if(!noms.length) return toast('Cette étape de l’atelier n’attend pas de fichier.');
  let n=0; for(const nom of noms){ const b=await fichierPour(nom); if(!b) continue;
    try{ await Centrale.projet.sauver(nom, b); n++; }catch(e){ toast(e.conflit? `« ${nom} » a été modifié par ${e.auteur||'un coéquipier'} : rouvre le fichier puis recommence.` : 'Dépôt impossible : '+e.message); return; } }
  toast(n? `${n} fichier${n>1?'s':''} déposé${n>1?'s':''} dans le dossier de l’atelier : ${noms.join(', ')}.` : 'Aucun des fichiers demandés ne peut être produit ici.');
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
function centraleProgres(key){ if(!CZ.pret || !window.Centrale?.connecte()) return; const id=key.replace(':','-'), p=Etabli3D.progression(id); if(p) Centrale.progression(id, p); }
