/* =========================================================
   Tutos et exercices, rangés par catégorie (model, sketch, move, struct) et par niveau.
   - tuto : étapes guidées, chacune avec ok() qui la coche toute seule (ok:null = case à cocher) ;
   - exo  : une consigne, des critères de réussite vérifiés automatiquement et un indice.
   start() prépare la scène (sinon un projet vide). Le suivi (PROG) reste dans ce navigateur :
   « tuto:clé », « exo:clé », « ex:clé » (exemple) → terminé ; part[clé] = étapes faites.
   ========================================================= */
const PROG_KEY='etabli3d.progress';
const PROG=(()=>{ let p={}; try{ p=JSON.parse(localStorage.getItem(PROG_KEY)||'{}')||{}; }catch(e){} return {done:p.done||{}, seen:p.seen||{}, part:p.part||{}}; })();
function saveProg(){ try{ localStorage.setItem(PROG_KEY, JSON.stringify(PROG)); }catch(e){} }
function markDone(id){ if(PROG.done[id]) return false; PROG.done[id]=Date.now(); saveProg(); centraleProgres(id); return true; }
function resetProgress(){ PROG.done={}; PROG.seen={}; PROG.part={}; saveProg(); }

const skOpen=()=> !$('#sk').hidden;
function allParts(){ const out=[]; const walk=p=>{ out.push(p); (p.children||[]).forEach(walk); }; state.parts.forEach(walk); return out; }
const anyPart=f=> allParts().some(f);
const near=(a,b,t=0.6)=> Math.abs(a-b)<=t;
const isBox=(p,L,l,hh,t=0.6)=> p.kind==='box' && near(p.params.L,L,t) && near(p.params.l,l,t) && near(p.params.h,hh,t);
const groupHas=f=> allParts().some(g=>g.kind==='group' && f(g, (function flat(q){ return (q.children||[]).flatMap(c=>[c, ...flat(c)]); })(g)));
const truss=()=> SD().truss;
let SIM_SEEN=false;   // la simulation a tourné depuis le début de la leçon
/* scène de départ commune : projet vide */
function lessonReset(name){ simReset(true); resetFor(name); selection=[]; jf=null; selJoint=null; $('#projName').value=state.name; setWs('model'); sync(); commit(); }
function emptyTruss(){ const S=SD(); S.mod='treillis'; const T=S.truss; T.nodes=[]; T.bars=[]; ST.fitted=false; setWs('struct'); }
/* boîtes du monde de chaque pièce visible (pour « posée sur » et la hauteur totale) */
function worldBoxes(){ return state.parts.map(p=>{ const r=meshes.get(p.id); return r? {p, b:new THREE.Box3().setFromObject(r.mesh)} : null; }).filter(Boolean); }

const LESSONS={
  /* ---------- Modéliser (niveau 1) */
  premiers:{type:'tuto', cat:'model', level:1, title:'Premiers pas', desc:'Poser un cube, le percer, l’exporter.', steps:[
    {t:'Cliquez <b>Cube</b> dans la barre du haut : un cube apparaît sur le tapis.', ok:()=>anyPart(p=>p.kind==='box')},
    {t:'Cliquez le cube, puis tirez un <b>carré blanc</b> d’un coin pour l’agrandir (plus de 30 mm).', ok:()=>anyPart(p=>p.kind==='box' && Math.max(p.params.L,p.params.l)>=30)},
    {t:'Ajoutez un <b>Cylindre</b> et glissez-le au milieu du cube.', ok:()=>anyPart(p=>p.kind==='cylinder')},
    {t:'Cylindre choisi, cliquez <b>Perçage</b> : il devient transparent et hachuré.', ok:()=>anyPart(p=>p.kind==='cylinder' && p.hole)},
    {t:'Choisissez les deux pièces (<b>Maj</b> + clic), puis <b>Grouper</b> : le trou creuse le cube.', ok:()=>state.parts.some(p=>p.kind==='group' && p.children.some(c=>c.hole))},
    {t:'Cliquez <b>STL</b> en haut pour obtenir le fichier à imprimer.', ok:null},
  ]},
  mesures:{type:'tuto', cat:'model', level:1, title:'Tailles et positions au millimètre', desc:'Taper des cotes, placer et tourner une pièce.', steps:[
    {t:'Ajoutez un <b>Cube</b>.', ok:()=>anyPart(p=>p.kind==='box')},
    {t:'Dans <b>Propriétés</b>, tapez Longueur <b>40</b>, Largeur <b>20</b>, Hauteur <b>10</b>.', ok:()=>anyPart(p=>isBox(p,40,20,10,0.05))},
    {t:'Toujours dans Propriétés, placez-le à <b>X = 30</b> mm (Position).', ok:()=>anyPart(p=>isBox(p,40,20,10,0.05) && near(p.pos[0],30,0.05))},
    {t:'Tournez-le de <b>45°</b> avec la flèche bleue : le rapporteur s’aimante sur le cran de 45°.', ok:()=>anyPart(p=>p.kind==='box' && near(Math.abs(((p.rot[2]%360)+360)%360-180),135,0.5))},
    {t:'Repère d’échelle (bouton pomme près du cube de vue) : comparez votre pièce à une vraie pomme.', ok:null},
  ]},
  empiler:{type:'tuto', cat:'model', level:1, title:'Empiler et aligner', desc:'Soulever, aimanter au centre, grouper.', steps:[
    {t:'Ajoutez un <b>Cube</b> puis un <b>Cylindre</b>.', ok:()=>anyPart(p=>p.kind==='box') && anyPart(p=>p.kind==='cylinder')},
    {t:'Cylindre choisi, tirez le <b>cône noir</b> vers le haut pour le poser <b>sur</b> le cube.', ok:()=>{ const B=state.parts.filter(p=>p.kind==='box'); return state.parts.some(c=>c.kind==='cylinder' && B.some(b=>near(c.pos[2], b.pos[2]+b.params.h))); }},
    {t:'Glissez le cylindre : il s’<b>aimante</b> au centre du cube (traits roses).', ok:()=>{ const B=state.parts.filter(p=>p.kind==='box'); return state.parts.some(c=>c.kind==='cylinder' && B.some(b=>near(c.pos[0],b.pos[0]) && near(c.pos[1],b.pos[1]) && near(c.pos[2], b.pos[2]+b.params.h))); }},
    {t:'Choisissez les deux pièces, puis <b>Grouper</b>.', ok:()=>groupHas((g,k)=>k.some(c=>c.kind==='box') && k.some(c=>c.kind==='cylinder'))},
  ]},
  /* ---------- Esquisser (niveau 2) */
  esquisse:{type:'tuto', cat:'sketch', level:2, title:'Ma première esquisse', desc:'Un rectangle coté avec un trou, extrudé.', steps:[
    {t:'Cliquez <b>Rectangle</b> à droite de la barre du haut, puis choisissez le plan <b>Dessus</b>.', ok:()=>skOpen()},
    {t:'Tracez un rectangle : un clic pour un coin, un clic pour le coin opposé.', ok:()=>skOpen() && SK.d.lines.length>=4},
    {t:'Prenez <b>Cote</b>, cliquez le bas du rectangle et tapez <b>50</b> puis Entrée.', ok:()=>skOpen() && SK.d.cons.some(c=>['dist','dx'].includes(c.type) && Math.abs(c.value-50)<0.01)},
    {t:'Prenez <b>Cercle</b> et tracez-en un à l’intérieur : il deviendra un trou.', ok:()=>skOpen() && SK.d.circles.length>0},
    {t:'Cliquez <b>Valider l’esquisse</b> : le profil devient un volume.', ok:()=>anyPart(p=>p.kind==='sketch' && (p.params.sk?.circles||[]).length>0)},
  ]},
  debout:{type:'tuto', cat:'sketch', level:2, title:'Esquisser debout', desc:'Dessiner sur le plan de face et extruder vers l’avant.', steps:[
    {t:'Cliquez <b>Ligne</b> à droite de la barre du haut, puis le plan <b>Face (XZ)</b>.', ok:()=>skOpen() && SK.plane==='xz'},
    {t:'Tracez un <b>L</b> : six lignes, puis revenez cliquer le premier point pour fermer.', ok:()=>skOpen() && SK.d.lines.length>=6 && skProfiles(SK.d).loops.length>0},
    {t:'Cliquez <b>Valider l’esquisse</b> : la pièce est debout.', ok:()=>anyPart(p=>p.kind==='sketch' && p.params.plane==='xz')},
    {t:'<b>Alt</b> + glisser (ou le cube de vue) : regardez-la de côté.', ok:null},
  ]},
  bezier:{type:'tuto', cat:'sketch', level:2, title:'Courbes de Bézier', desc:'Tracer une forme courbe point par point.', steps:[
    {t:'Cliquez <b>Bézier</b> à droite de la barre du haut, puis le plan <b>Face</b>.', ok:()=>skOpen() && SK.plane==='xz'},
    {t:'Cliquez une fois sur la grille : c’est le <b>premier point</b> (anguleux).', ok:()=>skOpen() && SK.d.pts.some(p=>!p.origin && p.it)},
    {t:'Plus loin, <b>cliquez et glissez</b> : le point devient lisse et la courbe suit la souris.', ok:()=>skOpen() && SK.d.pts.some(p=>p.it==='bez' && bzOnCurve(p.id))},
    {t:'Posez un ou deux autres points, puis cliquez le <b>premier point</b> pour fermer.', ok:()=>skOpen() && SK.d.beziers.length>=2 && skProfiles(SK.d).loops.some(l=>l.kind==='poly')},
    {t:'Outil <b>Sélection</b> : cliquez un point lisse, puis <b>Casser</b> et tirez une poignée.', ok:()=>skOpen() && SK.d.pts.some(p=>p.it==='bez' && p.tm==='free' && bzOnCurve(p.id))},
    {t:'Cliquez <b>Valider l’esquisse</b> : la pièce est debout, dans le plan de face.', ok:()=>anyPart(p=>p.kind==='sketch' && p.params.plane==='xz' && (p.params.sk?.beziers||[]).length>0)},
  ]},
  /* ---------- Mouvement */
  pivot:{type:'tuto', cat:'move', level:2, title:'Faire tourner une pièce', desc:'Valider, poser une liaison pivot, ajouter un moteur, simuler.',
    start(){ lessonReset('Bras pivotant'); const a=newPart('box',{name:'Socle',params:{L:60,l:30,h:10},color:'#7d8a86'}); const b=newPart('box',{name:'Bras',params:{L:80,l:10,h:6},color:'#e6a23a',pos:[25,0,10]}); state.parts.push(a,b); sync(); commit(); },
    steps:[
    {t:'Cliquez <b>Valider pour simulation</b> en haut.', ok:()=>ws==='check'||ws==='mech'},
    {t:'Cliquez <b>Valider toutes les pièces</b>.', ok:()=>state.parts.length>0 && state.parts.every(p=>['ok','warn'].includes(vState(p)))},
    {t:'Cliquez <b>Mouvement</b> en haut.', ok:()=>ws==='mech'},
    {t:'<b>Ajouter une liaison</b> : pièce mobile = Bras, type <b>Pivot</b>, puis cliquez un repère.', ok:()=>state.joints.some(j=>j.type==='pivot')},
    {t:'Mise en mouvement : <b>Moteur continu</b>, puis <b>Créer la liaison</b>.', ok:()=>state.joints.some(j=>j.motor)},
    {t:'Cliquez <b>Simuler</b> : le bras tourne.', ok:()=>SIM_SEEN},
  ]},
  engrenages:{type:'tuto', cat:'move', level:3, title:'Deux roues dentées', desc:'Une roue motrice en entraîne une autre.', steps:[
    {t:'Onglet <b>Simulation mécanique</b> de la barre du haut : ajoutez deux <b>Roues dentées</b>.', ok:()=>state.parts.filter(p=>p.kind==='gear').length>=2},
    {t:'Placez-les côte à côte : l’entraxe vaut (Z1 + Z2) × m ÷ 2 (40 mm pour deux roues de 20 dents, module 2).', ok:null},
    {t:'<b>Valider pour simulation</b>, validez les pièces, puis <b>Mouvement</b>.', ok:()=>ws==='mech'},
    {t:'Liaison <b>pivot</b> avec <b>moteur continu</b> sur la première roue.', ok:()=>state.joints.some(j=>j.type==='pivot' && j.motor && findPart(j.child)?.kind==='gear')},
    {t:'Liaison <b>pivot</b> sur la seconde, mise en mouvement <b>entraînée</b> par la première.', ok:()=>state.joints.some(j=>j.driver)},
    {t:'<b>Simuler</b> : les roues tournent en sens inverse.', ok:()=>SIM_SEEN && state.joints.some(j=>j.driver)},
  ]},
  /* ---------- Structures */
  treillis:{type:'tuto', cat:'struct', level:2, title:'Calculer un petit pont', desc:'Tracer un treillis, poser les appuis et une charge.',
    start(){ lessonReset('Petit pont'); emptyTruss(); }, steps:[
    {t:'Outil <b>Barre</b> : cliquez trois points puis revenez au premier pour tracer un <b>triangle</b>.', ok:()=>ws==='struct' && truss().bars.length>=3},
    {t:'Outil <b>Appui fixe</b> : cliquez un nœud du bas.', ok:()=>truss().nodes.some(n=>n.sup==='fixe')},
    {t:'Outil <b>Glissant</b> : cliquez l’autre nœud du bas.', ok:()=>truss().nodes.some(n=>n.sup==='glissant')},
    {t:'Outil <b>Charge</b> : cliquez le sommet.', ok:()=>truss().nodes.some(n=>+n.fy||+n.fx)},
    {t:'Lisez le résultat : <b>bleu</b> = traction, <b>rouge</b> = compression. Cliquez la structure pour animer.', ok:()=>!!ST.res?.ok},
  ]},

  /* ---------- Exercices */
  de:{type:'exo', cat:'model', level:1, title:'Dé à jouer', desc:'Un cube de 20 mm avec ses points creusés.',
    brief:'Fabriquez un <b>dé de 20 mm</b> : un cube dont les faces portent des points creusés (des perçages).',
    hint:'Des sphères de 4 mm en <b>Perçage</b>, à moitié enfoncées dans les faces ; choisissez tout puis <b>Grouper</b>.', steps:[
    {t:'Un cube de <b>20 × 20 × 20</b> mm', ok:()=>anyPart(p=>isBox(p,20,20,20))},
    {t:'Au moins <b>6 perçages</b>', ok:()=>allParts().filter(p=>p.hole && p.kind!=='group').length>=6},
    {t:'Les perçages sont <b>groupés</b> avec le cube', ok:()=>groupHas((g,k)=>k.some(c=>isBox(c,20,20,20)) && k.filter(c=>c.hole).length>=6)},
  ]},
  plaque:{type:'exo', cat:'model', level:1, title:'Plaque percée', desc:'Une plaque de fixation avec deux trous de vis.',
    brief:'Une plaque de <b>60 × 30 × 4 mm</b> avec <b>2 trous de Ø 5 mm</b> pour des vis.',
    hint:'Cube 60 × 30 × 4, deux cylindres de diamètre 5 en <b>Perçage</b> qui traversent la plaque, puis <b>Grouper</b>.', steps:[
    {t:'Une plaque de <b>60 × 30 × 4</b> mm', ok:()=>anyPart(p=>isBox(p,60,30,4))},
    {t:'Deux cylindres de <b>Ø 5</b> en perçage', ok:()=>allParts().filter(p=>p.kind==='cylinder' && p.hole && near(p.params.d,5,0.2)).length>=2},
    {t:'Les trous sont <b>groupés</b> avec la plaque', ok:()=>groupHas((g,k)=>k.some(c=>isBox(c,60,30,4)) && k.filter(c=>c.kind==='cylinder' && c.hole && near(c.params.d,5,0.2)).length>=2)},
  ]},
  tour:{type:'exo', cat:'model', level:1, title:'Tour de 3 étages', desc:'Empiler des volumes sans qu’aucun ne flotte.',
    brief:'Construisez une <b>tour</b> d’au moins <b>3 étages</b> et <b>60 mm</b> de haut. Aucune pièce ne doit flotter en l’air.',
    hint:'Soulevez chaque étage avec le <b>cône noir</b> jusqu’à ce qu’il touche celui du dessous.', steps:[
    {t:'Au moins <b>3 pièces</b>', ok:()=>state.parts.filter(p=>!p.hole).length>=3},
    {t:'Hauteur totale d’au moins <b>60 mm</b>', ok:()=>{ const b=partsBox(); return !b.isEmpty() && b.max.z>=60-0.5; }},
    {t:'Chaque étage <b>repose</b> sur le sol ou sur une autre pièce', ok:()=>{ const W=worldBoxes().filter(w=>!w.p.hole); return W.length>=3 && W.every(w=>w.b.min.z<0.6 || W.some(o=>o!==w && near(o.b.max.z,w.b.min.z) && o.b.max.x>w.b.min.x && o.b.min.x<w.b.max.x && o.b.max.y>w.b.min.y && o.b.min.y<w.b.max.y)); }},
  ]},
  equerre:{type:'exo', cat:'sketch', level:2, title:'Équerre de fixation', desc:'Un profil en L coté, avec deux trous.',
    brief:'Esquissez une <b>équerre en L</b> de 40 × 40 mm, épaisseur 5 mm, avec <b>2 trous</b>, extrudée de <b>20 mm</b>.',
    hint:'Outil <b>Ligne</b> pour le L (6 lignes), <b>Cercle</b> pour les trous, <b>Cote</b> pour les longueurs, hauteur d’extrusion 20.', steps:[
    {t:'Un profil fermé d’au moins <b>6 lignes</b>', ok:()=>anyPart(p=>p.kind==='sketch' && (p.params.sk?.lines||[]).length>=6)},
    {t:'Au moins <b>2 trous</b> (cercles)', ok:()=>anyPart(p=>p.kind==='sketch' && (p.params.sk?.circles||[]).length>=2)},
    {t:'Au moins <b>2 cotes</b>', ok:()=>anyPart(p=>p.kind==='sketch' && (p.params.sk?.cons||[]).filter(c=>['dist','dx','dy'].includes(c.type)).length>=2)},
    {t:'Extrusion de <b>20 mm</b>', ok:()=>anyPart(p=>p.kind==='sketch' && p.params.mode!=='revolve' && near(p.params.h,20,0.05) && (p.params.sk?.lines||[]).length>=6)},
  ]},
  vase:{type:'exo', cat:'sketch', level:3, title:'Vase en révolution', desc:'Un demi-profil courbe tourné sur 360°.',
    brief:'Dessinez le <b>demi-profil</b> d’un vase (à droite de l’axe) avec au moins une <b>courbe de Bézier</b>, puis transformez-le par <b>révolution</b>.',
    hint:'Plan de face, outil Bézier pour la paroi, lignes pour le fond et l’axe ; dans l’esquisse, choisissez <b>Révolution</b>.', steps:[
    {t:'Une esquisse avec au moins une <b>courbe de Bézier</b>', ok:()=>anyPart(p=>p.kind==='sketch' && (p.params.sk?.beziers||[]).length>0)},
    {t:'Transformée par <b>révolution</b>', ok:()=>anyPart(p=>p.kind==='sketch' && p.params.mode==='revolve' && (p.params.sk?.beziers||[]).length>0)},
  ]},
  barriere:{type:'exo', cat:'move', level:2, title:'Barrière qui se lève', desc:'Une lisse qui pivote de 0 à 90° et revient.',
    brief:'Un <b>poteau</b> et une <b>lisse</b> qui pivote de <b>0 à 90°</b> avec un <b>moteur aller-retour</b>.',
    hint:'Liaison pivot d’axe horizontal sur la lisse, butées min 0 et max 90, mise en mouvement « Moteur aller-retour ».', steps:[
    {t:'Au moins <b>2 pièces</b> validées', ok:()=>state.parts.length>=2 && state.parts.every(p=>p.hole || ['ok','warn'].includes(vState(p)))},
    {t:'Un <b>pivot</b> avec un <b>moteur aller-retour</b>', ok:()=>state.joints.some(j=>j.type==='pivot' && j.motor?.mode==='alternatif')},
    {t:'Des <b>butées</b> qui laissent environ <b>90°</b>', ok:()=>state.joints.some(j=>j.type==='pivot' && j.min!=null && j.max!=null && Math.abs(j.max-j.min)>=80 && Math.abs(j.max-j.min)<=100)},
    {t:'La simulation a <b>tourné</b>', ok:()=>SIM_SEEN && state.joints.some(j=>j.motor?.mode==='alternatif')},
  ]},
  reducteur:{type:'exo', cat:'move', level:3, title:'Réducteur 1/3', desc:'Diviser la vitesse par 3 avec deux roues.',
    brief:'Avec deux <b>roues dentées</b>, faites tourner la roue de sortie <b>3 fois moins vite</b> que la roue motrice.',
    hint:'Rapport = − Z motrice ÷ Z menée : 15 dents et 45 dents donnent 1/3.', steps:[
    {t:'Deux roues dont les dents sont dans le rapport <b>1 à 3</b>', ok:()=>{ const G=state.parts.filter(p=>p.kind==='gear').map(p=>p.params.z); return G.some(a=>G.some(b=>near(b,3*a,0.01))); }},
    {t:'Une roue <b>motrice</b> (pivot avec moteur)', ok:()=>state.joints.some(j=>j.motor && findPart(j.child)?.kind==='gear')},
    {t:'Une roue <b>entraînée</b> au rapport <b>1/3</b>', ok:()=>state.joints.some(j=>j.driver && near(Math.abs(j.driver.ratio),1/3,0.02))},
  ]},
  pont:{type:'exo', cat:'struct', level:2, title:'Pont de 400 mm', desc:'Un treillis qui porte 500 N sans casser.',
    brief:'Tracez un <b>pont en treillis</b> d’au moins <b>400 mm</b> entre ses appuis, qui porte <b>500 N</b> avec un coefficient de sécurité d’au moins 1.',
    hint:'Des triangles ! Un appui fixe à un bout, un glissant à l’autre, la charge au milieu. Grossissez les barres (diamètre) si besoin.',
    start(){ lessonReset('Pont de 400 mm'); emptyTruss(); }, steps:[
    {t:'Portée d’au moins <b>400 mm</b> entre les appuis', ok:()=>{ const S=truss().nodes.filter(n=>n.sup); if(S.length<2) return false; const xs=S.map(n=>n.x); return Math.max(...xs)-Math.min(...xs)>=400-0.5; }},
    {t:'Charges d’au moins <b>500 N</b> au total', ok:()=>truss().nodes.reduce((s,n)=>s+Math.hypot(+n.fx||0,+n.fy||0),0)>=500-0.5},
    {t:'Le calcul tient : coefficient de sécurité <b>≥ 1</b>', ok:()=>!!(ST.res?.ok && ST.res.worst && ST.res.worst.sf>=1 && truss().nodes.reduce((s,n)=>s+Math.hypot(+n.fx||0,+n.fy||0),0)>=500-0.5)},
  ]},
};
const LCATS=[['model','Modéliser avec des volumes'],['sketch','Esquisser et coter'],['move','Mettre en mouvement'],['struct','Simuler la déformation']];
/* statut d'un élément de la bibliothèque : done | part (avec n / total) | seen | new */
function lessonStatus(type, k){
  if(type==='ex'){ return PROG.done['ex:'+k]? {s:'done'} : PROG.seen['ex:'+k]? {s:'seen'} : {s:'new'}; }
  const L=LESSONS[k], id=L.type+':'+k; if(PROG.done[id]) return {s:'done'};
  const n=PROG.part[k]||0; return n? {s:'part', n, t:L.steps.length} : {s:'new'};
}
function statusChip(st){
  if(st.s==='done') return h('span',{class:'lb-st done'},'✓ Terminé');
  if(st.s==='part') return h('span',{class:'lb-st part'},`En cours ${st.n} / ${st.t}`);
  if(st.s==='seen') return h('span',{class:'lb-st seen'},'Ouvert');
  return null;
}
