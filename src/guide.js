/* =========================================================
   Guide (#demo) : panneau à gauche de la vue, à droite de l'arborescence.
   Trois contenus, au choix par onglets :
   - Exemple : la fiche « À observer / À essayer » de l'exemple ouvert (À essayer en pas à pas) ;
   - Tutos : tutoriels pas à pas dont les étapes se cochent seules quand l'élève a fait l'action ;
   - Mon TP : consignes du TP écrites par le professeur (une par ligne), cochées par l'élève,
     enregistrées dans le projet (state.tp).
   Pendant une esquisse, le guide passe au-dessus de l'éditeur (placeDemo).
   ========================================================= */
let demoClosed=false, demoOpen=true;
const GUIDE={src:null, tuto:null, step:0, done:[], noteDone:[], editing:false};

const skOpen=()=> !$('#sk').hidden;
const anyPart=f=> state.parts.some(function walk(p){ return f(p) || (p.children||[]).some(walk); });
const TUTOS={
  premiers:{title:'Premiers pas', level:1, desc:'Poser un cube, le percer, l’exporter.', steps:[
    {t:'Cliquez <b>Cube</b> dans la barre du haut : un cube apparaît sur le tapis.', ok:()=>anyPart(p=>p.kind==='box')},
    {t:'Cliquez le cube, puis tirez un <b>carré blanc</b> d’un coin pour l’agrandir (plus de 30 mm).', ok:()=>anyPart(p=>p.kind==='box' && Math.max(p.params.L,p.params.l)>=30)},
    {t:'Ajoutez un <b>Cylindre</b> et glissez-le au milieu du cube.', ok:()=>anyPart(p=>p.kind==='cylinder')},
    {t:'Cylindre choisi, cliquez <b>Perçage</b> : il devient transparent et hachuré.', ok:()=>anyPart(p=>p.kind==='cylinder' && p.hole)},
    {t:'Choisissez les deux pièces (<b>Maj</b> + clic), puis <b>Grouper</b> : le trou creuse le cube.', ok:()=>state.parts.some(p=>p.kind==='group' && p.children.some(c=>c.hole))},
    {t:'Cliquez <b>STL</b> en haut pour obtenir le fichier à imprimer.', ok:null},
  ]},
  esquisse:{title:'Ma première esquisse', level:2, desc:'Un rectangle coté avec un trou, extrudé.', steps:[
    {t:'Cliquez <b>Rectangle</b> à droite de la barre du haut, puis choisissez le plan <b>Dessus</b>.', ok:()=>skOpen()},
    {t:'Tracez un rectangle : un clic pour un coin, un clic pour le coin opposé.', ok:()=>skOpen() && SK.d.lines.length>=4},
    {t:'Prenez <b>Cote</b>, cliquez le bas du rectangle et tapez <b>50</b> puis Entrée.', ok:()=>skOpen() && SK.d.cons.some(c=>['dist','dx'].includes(c.type) && Math.abs(c.value-50)<0.01)},
    {t:'Prenez <b>Cercle</b> et tracez-en un à l’intérieur : il deviendra un trou.', ok:()=>skOpen() && SK.d.circles.length>0},
    {t:'Cliquez <b>Valider l’esquisse</b> : le profil devient un volume.', ok:()=>anyPart(p=>p.kind==='sketch' && (p.params.sk?.circles||[]).length>0)},
  ]},
  bezier:{title:'Courbes de Bézier', level:2, desc:'Tracer une forme courbe point par point.', steps:[
    {t:'Cliquez <b>Bézier</b> à droite de la barre du haut, puis le plan <b>Face</b>.', ok:()=>skOpen() && SK.plane==='xz'},
    {t:'Cliquez une fois sur la grille : c’est le <b>premier point</b> (anguleux).', ok:()=>skOpen() && SK.d.pts.some(p=>!p.origin && p.it)},
    {t:'Plus loin, <b>cliquez et glissez</b> : le point devient lisse et la courbe suit la souris.', ok:()=>skOpen() && SK.d.pts.some(p=>p.it==='bez' && bzOnCurve(p.id))},
    {t:'Posez un ou deux autres points, puis cliquez le <b>premier point</b> pour fermer.', ok:()=>skOpen() && SK.d.beziers.length>=2 && skProfiles(SK.d).loops.some(l=>l.kind==='poly')},
    {t:'Outil <b>Sélection</b> : cliquez un point lisse, puis <b>Casser</b> et tirez une poignée.', ok:()=>skOpen() && SK.d.pts.some(p=>p.it==='bez' && p.tm==='free' && bzOnCurve(p.id))},
    {t:'Cliquez <b>Valider l’esquisse</b> : la pièce est debout, dans le plan de face.', ok:()=>anyPart(p=>p.kind==='sketch' && p.params.plane==='xz' && (p.params.sk?.beziers||[]).length>0)},
  ]},
};

function guideSrc(){
  let s=GUIDE.src;
  if(s==='note' && !state.note) s=null;
  if(!s) s= state.note? 'note' : (state.tp?.tasks?.length? 'tp' : 'tuto');
  return GUIDE.src=s;
}
/* a list of steps shown one at a time, with a check box, previous / next and the whole list below */
function stepper(items, done, cur, {onDone, onGo, manual=()=>true}){
  const n=items.length; if(!n) return h('p',{class:'empty'},'Aucune étape.');
  cur=clamp(cur,0,n-1); const nd=done.filter(Boolean).length;
  const box=h('div',{class:'gd-step'+(done[cur]?' ok':'')},
    h('div',{class:'gd-n'}, `Étape ${cur+1} / ${n}`, h('span',{class:'gd-prog'}, h('i',{style:`width:${Math.round(nd/n*100)}%`}))),
    h('div',{class:'gd-t',html:items[cur]}),
    h('div',{class:'gd-nav'},
      h('button',{class:'btn',disabled:cur===0||null,onclick:()=>onGo(cur-1),'aria-label':'Étape précédente'}, '‹ Précédent'),
      manual(cur)? h('label',{class:'gd-done'}, h('input',{type:'checkbox',checked:done[cur]||null,onchange:e=>onDone(cur,e.target.checked)}), 'Fait')
        : h('span',{class:'gd-auto'}, done[cur]? '✓ Réussi' : 'Se coche tout seul'),
      h('button',{class:'btn'+(done[cur]&&cur<n-1?' primary':''),disabled:cur===n-1||null,onclick:()=>onGo(cur+1),'aria-label':'Étape suivante'}, 'Suivant ›')));
  const list=h('ol',{class:'gd-list'}, items.map((t,i)=>h('li',{class:(i===cur?'cur ':'')+(done[i]?'ok':''),onclick:()=>onGo(i),html:t})));
  return h('div',{class:'gd-stepper'}, box, list);
}
function renderDemo(){
  const el=$('#demo'); if(!el) return;
  if(demoClosed){ el.hidden=true; $('#bGuide')?.setAttribute('aria-pressed','false'); $('#bGuide')?.classList.remove('on'); applyViewOffset(); return; }
  placeDemo(); el.hidden=false; el.classList.toggle('closed',!demoOpen); el.innerHTML='';
  $('#bGuide')?.setAttribute('aria-pressed','true'); $('#bGuide')?.classList.add('on');
  const src=guideSrc(), n=state.note;
  const T=src==='tuto' && GUIDE.tuto? TUTOS[GUIDE.tuto] : null;
  const title= src==='note'? n.title : src==='tp'? (state.tp?.title||'Consignes du TP') : T? T.title : 'Tutos pas à pas';
  const grip=h('span',{class:'pgrip demo-grip',title:'Glisser pour déplacer le guide'}, svgIcon('dots')); grip.addEventListener('pointerdown',e=>{ if(!el.classList.contains('in-sk')) startPanelDrag(e, el, 'demo'); });
  el.append(h('div',{class:'demo-head'}, grip,
    h('button',{class:'demo-toggle','aria-expanded':String(demoOpen),onclick:()=>{ demoOpen=!demoOpen; renderDemo(); }},
      h('span',{class:'demo-kicker'}, src==='note'? 'Guide · exemple' : src==='tp'? 'Guide · mon TP' : 'Guide · tuto'), h('b',{},title), svgIcon(demoOpen?'chevUp':'chevDown')),
    h('button',{class:'btn icon ghost',title:'Fermer le guide (bouton Guide en haut pour le rouvrir)','aria-label':'Fermer le guide',onclick:()=>{ demoClosed=true; renderDemo(); }}, svgIcon('close'))));
  if(!demoOpen){ applyLayout('demo'); applyViewOffset(); return; }
  const tab=(k,label)=>h('button',{class:'btn'+(src===k?' on':''),'aria-pressed':String(src===k),onclick:()=>{ GUIDE.src=k; GUIDE.editing=false; GUIDE.step=0; renderDemo(); }}, label);
  el.append(h('div',{class:'seg gd-tabs'}, n? tab('note','Exemple') : null, tab('tuto','Tutos'), tab('tp','Mon TP')));
  const body=h('div',{class:'gd-body'}); el.append(body); const add=(...k)=>body.append(...k.filter(Boolean));
  if(src==='note'){
    GUIDE.noteDone.length=n.try.length;
    body.append(h('div',{class:'demo-sec'}, h('h4',{},'À observer'), h('ul',{}, n.observe.map(t=>h('li',{html:t})))),
      h('div',{class:'demo-sec'}, h('h4',{},'À essayer'), stepper(n.try, GUIDE.noteDone, GUIDE.step, {onDone:(i,v)=>{ GUIDE.noteDone[i]=v; if(v && i<n.try.length-1) GUIDE.step=i+1; renderDemo(); }, onGo:i=>{ GUIDE.step=i; renderDemo(); }})),
      h('button',{class:'btn demo-more',onclick:openGallery}, svgIcon('book'),'Autres exemples'));
  }
  else if(src==='tuto' && T){
    add(stepper(T.steps.map(s=>s.t), GUIDE.done, GUIDE.step, {manual:i=>!T.steps[i].ok,
      onDone:(i,v)=>{ GUIDE.done[i]=v; if(v && i<T.steps.length-1) GUIDE.step=i+1; renderDemo(); }, onGo:i=>{ GUIDE.step=i; renderDemo(); }}),
      GUIDE.done.filter(Boolean).length===T.steps.length? h('div',{class:'info gd-bravo',html:'<b>Bravo, tuto terminé !</b> Choisissez-en un autre ou ouvrez un exemple.'}) : null,
      h('button',{class:'btn demo-more',onclick:()=>{ GUIDE.tuto=null; renderDemo(); }}, '‹ Tous les tutos'));
  }
  else if(src==='tuto'){
    body.append(h('div',{class:'gd-tutos'}, Object.entries(TUTOS).map(([k,t])=>h('button',{class:'gd-tuto',onclick:()=>startTuto(k)},
      h('b',{},t.title), h('span',{class:'gal-lvl l'+t.level}, LEVELS[t.level-1].name), h('small',{},t.desc+` · ${t.steps.length} étapes`)))),
      h('details',{class:'gd-tips'}, h('summary',{},'Rappel des gestes'), h('div',{class:'empty',html:guideTips()})));
  }
  else renderTp(body);
  hydrateIcons(el); applyLayout('demo'); applyViewOffset();
}
function guideTips(){ return `Cliquez une forme de la barre du haut pour la poser sur le tapis, ou ouvrez un <b>exemple</b>.<br><br>Cliquez une pièce : des <b>poignées</b> apparaissent. Carrés blancs des coins : longueur et largeur ; petits carrés noirs : une cote ; carré du haut : hauteur ; cône : soulever ; flèches courbes : tourner. Glissez la pièce pour la déplacer. Double-clic sur un <b>groupe</b> : modifier ses pièces.<br><br><span class="kbd">Maj</span> + clic ou <span class="kbd">Maj</span> + glisser dans le vide (cadre) pour en choisir plusieurs ; cliquez encore au même endroit pour prendre la pièce de derrière.<br><br>${(LMB.find(x=>x[0]===(prefs.lmb||'orbit'))||LMB[1])[3]} Molette : zoom. Clic droit : menu.`; }
function startTuto(k){
  const T=TUTOS[k]; if(!T) return;
  if(T.level>prefs.level){ setLevel(T.level,true); toast(`Niveau ${LEVELS[T.level-1].name} activé pour ce tuto.`); }
  GUIDE.src='tuto'; GUIDE.tuto=k; GUIDE.step=0; GUIDE.done=T.steps.map(()=>false); demoClosed=false; demoOpen=true;
  guideCheck(true); renderDemo();
}
/* the tutorial steps tick themselves: checked twice a second, a step once done stays done */
function guideCheck(quiet=false){
  if(GUIDE.src!=='tuto' || !GUIDE.tuto) return; const T=TUTOS[GUIDE.tuto]; let changed=false;
  T.steps.forEach((s,i)=>{ if(!GUIDE.done[i] && s.ok){ let v=false; try{ v=!!s.ok(); }catch(e){} if(v){ GUIDE.done[i]=true; changed=true; } } });
  if(!changed) return;
  const next=GUIDE.done.findIndex(d=>!d); if(GUIDE.done[GUIDE.step]) GUIDE.step= next<0? T.steps.length-1 : next;
  if(!quiet){ renderDemo(); const b=$('#demo .gd-step'); b?.classList.add('flash'); }
}
setInterval(()=>guideCheck(), 500);

/* ---- Mon TP : consignes écrites par le professeur, cochées par l'élève, enregistrées avec le projet */
function renderTp(body){
  const tp=state.tp;
  if(GUIDE.editing || !tp?.tasks?.length){
    const ti=h('input',{class:'field',value:tp?.title||'','aria-label':'Titre du TP',placeholder:'Titre du TP (par ex. « Porte-clés personnalisé »)'});
    const ta=h('textarea',{class:'field gd-ta',rows:7,'aria-label':'Consignes, une par ligne',placeholder:'Une consigne par ligne, par exemple :\nDessiner une plaque de 50 × 20 mm\nAjouter un trou de 5 mm pour l’anneau\nÉcrire son prénom en relief\nExporter le fichier STL'}, (tp?.tasks||[]).map(t=>t.t).join('\n'));
    for(const e of [ti,ta]) e.addEventListener('keydown',ev=>ev.stopPropagation());
    body.append(h('p',{class:'empty',style:'margin:0'}, tp?.tasks?.length? 'Modifiez les consignes, une par ligne.' : 'Écrivez les consignes du TP, une par ligne : elles s’afficheront ici en pas à pas et seront enregistrées avec le projet.'),
      ti, ta, h('div',{class:'gd-nav'},
        tp?.tasks?.length? h('button',{class:'btn',onclick:()=>{ GUIDE.editing=false; renderDemo(); }}, 'Annuler') : null,
        h('button',{class:'btn primary',onclick:()=>saveTp(ti.value, ta.value)}, svgIcon('check'),'Enregistrer les consignes')));
    return;
  }
  body.append(...[stepper(tp.tasks.map(t=>t.t.replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))), tp.tasks.map(t=>!!t.done), GUIDE.step,
    {onDone:(i,v)=>{ tp.tasks[i].done=v; if(v && i<tp.tasks.length-1) GUIDE.step=i+1; commit(); renderDemo(); }, onGo:i=>{ GUIDE.step=i; renderDemo(); }}),
    tp.tasks.every(t=>t.done)? h('div',{class:'info gd-bravo',html:'<b>Toutes les consignes sont faites.</b> Pensez à enregistrer le projet.'}) : null,
    h('button',{class:'btn demo-more',onclick:()=>{ GUIDE.editing=true; renderDemo(); }}, svgIcon('edit'),'Modifier les consignes')].filter(Boolean));
}
function saveTp(title, text){
  const old=new Map((state.tp?.tasks||[]).map(t=>[t.t,t.done]));
  const tasks=text.split('\n').map(s=>s.trim()).filter(Boolean).map(t=>({t, done:!!old.get(t)}));
  state.tp= tasks.length? {title:title.trim()||'Consignes du TP', tasks} : null;
  GUIDE.editing=false; GUIDE.step=Math.max(0,tasks.findIndex(t=>!t.done)); GUIDE.src='tp'; commit(); renderDemo();
}
function toggleGuide(){ demoClosed=!demoClosed; if(!demoClosed) demoOpen=true; renderDemo(); }
