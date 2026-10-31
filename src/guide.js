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
  if(demoClosed){ el.hidden=true; $('#bGuide')?.setAttribute('aria-pressed','false'); $('#bGuide')?.classList.remove('on'); applyViewOffset(); if(el.classList.contains('docked')) requestAnimationFrame(()=>fitWings()); return; }
  placeDemo(); el.hidden=false; el.classList.toggle('closed',!demoOpen); el.innerHTML='';
  $('#bGuide')?.setAttribute('aria-pressed','true'); $('#bGuide')?.classList.add('on');
  const src=guideSrc(), n=state.note;
  const T=src==='tuto' && GUIDE.tuto? LESSONS[GUIDE.tuto] : null;
  const title= src==='note'? n.title : src==='tp'? (state.tp?.title||'Consignes du TP') : T? T.title : 'Tutos pas à pas';
  const grip=h('span',{class:'pgrip demo-grip',title:'Glisser pour déplacer le guide'}, svgIcon('dots')); grip.addEventListener('pointerdown',e=>{ if(!el.classList.contains('in-sk')) startPanelDrag(e, el, 'demo'); });
  el.append(h('div',{class:'demo-head'}, grip,
    h('button',{class:'demo-toggle','aria-expanded':String(demoOpen),onclick:()=>{ demoOpen=!demoOpen; renderDemo(); }},
      h('span',{class:'demo-kicker'}, src==='note'? 'Guide · exemple' : src==='tp'? 'Guide · mon TP' : T?.type==='exo'? 'Guide · exercice' : 'Guide · tuto'), h('b',{},title), svgIcon(demoOpen?'chevUp':'chevDown')),
    h('button',{class:'btn icon ghost',title:'Fermer le guide (bouton Guide en haut pour le rouvrir)','aria-label':'Fermer le guide',onclick:()=>{ demoClosed=true; renderDemo(); }}, svgIcon('close'))));
  if(!demoOpen){ applyLayout('demo'); applyViewOffset(); return; }
  const tab=(k,label)=>h('button',{class:'btn'+(src===k?' on':''),'aria-pressed':String(src===k),onclick:()=>{ GUIDE.src=k; GUIDE.editing=false; if(k!=='tuto') GUIDE.step=0; renderDemo(); }}, label);
  el.append(h('div',{class:'seg gd-tabs'}, n? tab('note','Exemple') : null, tab('tuto','Tutos et exercices'), tab('tp','Mon TP')));
  const body=h('div',{class:'gd-body'}); el.append(body); const add=(...k)=>body.append(...k.filter(Boolean));
  if(src==='note'){
    GUIDE.noteDone.length=n.try.length;
    body.append(h('div',{class:'demo-sec'}, h('h4',{},'À observer'), h('ul',{}, n.observe.map(t=>h('li',{html:t})))),
      h('div',{class:'demo-sec'}, h('h4',{},'À essayer'), stepper(n.try, GUIDE.noteDone, GUIDE.step, {onDone:(i,v)=>{ GUIDE.noteDone[i]=v; if(v && i<n.try.length-1) GUIDE.step=i+1;
        if(n.key && n.try.every((t,k)=>GUIDE.noteDone[k]) && markDone('ex:'+n.key)) toast('Exemple terminé : tout est essayé !'); renderDemo(); }, onGo:i=>{ GUIDE.step=i; renderDemo(); }})),
      h('button',{class:'btn demo-more',onclick:openGallery}, svgIcon('book'),'Autres exemples'));
  }
  else if(src==='tuto' && T){
    const all=GUIDE.done.filter(Boolean).length===T.steps.length;
    if(T.type==='exo'){   // exercice : la consigne, puis les critères de réussite vérifiés tout seuls
      add(h('div',{class:'gd-brief',html:T.brief}),
        h('div',{class:'demo-sec'}, h('h4',{},'Critères de réussite'), h('ul',{class:'gd-crit'}, T.steps.map((c,i)=>h('li',{class:GUIDE.done[i]?'ok':'',html:c.t})))),
        T.hint? h('details',{class:'gd-tips'}, h('summary',{},'Un indice ?'), h('div',{class:'empty',html:T.hint})) : null,
        all? h('div',{class:'info gd-bravo',html:'<b>Exercice réussi !</b> Il est marqué terminé dans la bibliothèque.'}) : null);
    } else add(stepper(T.steps.map(s=>s.t), GUIDE.done, GUIDE.step, {manual:i=>!T.steps[i].ok,
        onDone:(i,v)=>{ GUIDE.done[i]=v; if(v && i<T.steps.length-1) GUIDE.step=i+1; lessonProgress(); renderDemo(); }, onGo:i=>{ GUIDE.step=i; renderDemo(); }}),
      all? h('div',{class:'info gd-bravo',html:'<b>Bravo, tuto terminé !</b> Choisissez-en un autre ou ouvrez un exemple.'}) : null);
    add(h('div',{class:'gd-nav'}, h('button',{class:'btn demo-more',onclick:()=>{ GUIDE.tuto=null; renderDemo(); }}, '‹ Tous les tutos'),
      h('button',{class:'btn demo-more',onclick:()=>openGallery('lesson')}, svgIcon('book'),'Bibliothèque')));
  }
  else if(src==='tuto'){   // liste courte : tutos et exercices jusqu'au niveau choisi
    const item=([k,t])=>h('button',{class:'gd-tuto',onclick:()=>startLesson(k)},
      h('b',{},t.title), h('span',{class:'gal-lvl l'+t.level}, LEVELS[t.level-1].name), h('small',{},t.desc+(t.type==='exo'? ' · exercice' : ` · ${t.steps.length} étapes`)), statusChip(lessonStatus('l',k)));
    const L=Object.entries(LESSONS).filter(([,t])=>t.level<=prefs.level);
    add(h('h4',{class:'gd-h'},'Tutos pas à pas'), h('div',{class:'gd-tutos'}, L.filter(([,t])=>t.type==='tuto').map(item)),
      h('h4',{class:'gd-h'},'Exercices'), h('div',{class:'gd-tutos'}, L.filter(([,t])=>t.type==='exo').map(item)),
      h('button',{class:'btn demo-more',onclick:()=>openGallery('lesson')}, svgIcon('book'),'Toute la bibliothèque'),
      h('details',{class:'gd-tips'}, h('summary',{},'Rappel des gestes'), h('div',{class:'empty',html:guideTips()})));
  }
  else renderTp(body);
  hydrateIcons(el); applyLayout('demo'); applyViewOffset();
}
function guideTips(){ return `Cliquez une forme de la barre du haut pour la poser sur le tapis, ou ouvrez un <b>exemple</b>.<br><br>Cliquez une pièce : des <b>poignées</b> apparaissent. Carrés blancs des coins : longueur et largeur ; petits carrés noirs : une cote ; carré du haut : hauteur ; cône : soulever ; flèches courbes : tourner. Glissez la pièce pour la déplacer. Double-clic sur un <b>groupe</b> : modifier ses pièces.<br><br><span class="kbd">Maj</span> + clic ou <span class="kbd">Maj</span> + glisser dans le vide (cadre) pour en choisir plusieurs ; cliquez encore au même endroit pour prendre la pièce de derrière.<br><br>${(LMB.find(x=>x[0]===(prefs.lmb||'orbit'))||LMB[1])[3]} Molette : zoom. Clic droit : menu.`; }
/* ouvrir un tuto ou un exercice : niveau si besoin, scène de départ (ou projet vide), guide ouvert dessus */
function startLesson(k){
  const T=LESSONS[k]; if(!T) return;
  if(T.level>prefs.level){ setLevel(T.level,true); toast(`Niveau ${LEVELS[T.level-1].name} activé pour ${T.type==='exo'?'cet exercice':'ce tuto'}.`); }
  if(!$('#sk').hidden) closeSketch(false);
  if(T.start) T.start(); else lessonReset(T.title);
  $('#gallery').hidden=true; SIM_SEEN=false;
  GUIDE.src='tuto'; GUIDE.tuto=k; GUIDE.step=0; GUIDE.done=T.steps.map(()=>false); demoClosed=false; demoOpen=true;
  PROG.seen[T.type+':'+k]=1; saveProg(); centraleProgres(T.type+':'+k);   // activité ouverte (faites = 0)
  guideCheck(true); renderDemo();
}
const startTuto=startLesson;
/* progression enregistrée : nombre d'étapes faites, puis « terminé » */
function lessonProgress(){ const k=GUIDE.tuto, T=LESSONS[k]; if(!T) return; const n=GUIDE.done.filter(Boolean).length; const before=PROG.part[k]||0; PROG.part[k]=Math.max(before, n); saveProg(); if(PROG.part[k]>before) centraleProgres(T.type+':'+k);
  if(n===T.steps.length && markDone(T.type+':'+k)) toast(T.type==='exo'? `Exercice « ${T.title} » réussi !` : `Tuto « ${T.title} » terminé, bravo !`, 3200); }
/* the tutorial steps tick themselves: checked twice a second, a step once done stays done */
function guideCheck(quiet=false){
  if(sim.playing) SIM_SEEN=true;
  if(GUIDE.src!=='tuto' || !GUIDE.tuto) return; const T=LESSONS[GUIDE.tuto]; if(!T) return; let changed=false;
  T.steps.forEach((s,i)=>{ if(!GUIDE.done[i] && s.ok){ let v=false; try{ v=!!s.ok(); }catch(e){} if(v){ GUIDE.done[i]=true; changed=true; } } });
  if(!changed) return;
  lessonProgress();
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
