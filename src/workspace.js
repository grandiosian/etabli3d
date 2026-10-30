
/* =========================================================
   Ateliers : 1 Modéliser → 2 Valider → 3 Mécanique · 4 Structures.
   <html data-ws="model|check|mech|struct">; elements carrying data-ws="model mech"
   are only shown in the listed ateliers.
   ========================================================= */
const WS=[
  {k:'model',  n:1, name:'Modéliser',  sub:'Créer et assembler les pièces',      lvl:1},
  {k:'check',  n:2, name:'Valider',    sub:'Contrôler, alléger, poser des repères', lvl:1},
  {k:'mech',   n:3, name:'Mécanique',  sub:'Liaisons et mouvements',              lvl:2},
  {k:'struct', n:4, name:'Structures', sub:'Treillis et déformation',             lvl:2},
];
function setWs(k){
  const W=WS.find(w=>w.k===k)||WS[0]; if(!lv(W.lvl)) k='model';
  const prev=ws; closeBubble(); if(CHK.test.on){ CHK.test.on=false; }
  if(prev==='struct' && k!=='struct' && ST.anim.on) stAnimPlay(false);
  if(prev==='mech' && k!=='mech'){ if(simActive()) simReset(true); jf=null; cancelPick(); }
  if(locPick!=null){ locPick=null; $('#pickHint').hidden=true; }
  ws=k; document.documentElement.dataset.ws=k;
  const struct=k==='struct';
  mat.visible=!struct; matEdge.visible=!struct; axes.visible=!struct;
  structGroup.visible= struct && ST.mode3d;
  $('#stWrap').hidden= struct && ST.mode3d; $('#st3d').hidden= !(struct && ST.mode3d);
  if(struct){ computeStruct(); ST.fitted=false; ST.sel=null; stSetTool(ST.tool); $('#stTools').dataset.mod=SD().mod; requestAnimationFrame(()=>{ stResize(); if(ST.mode3d) setStructView3D(true); }); }
  sync(); renderInspector(); updateSteps(); applyViewOffset(); updateMarkers();
  if(prev!==k && k==='mech' && !mechReady()) toast('Validez d’abord vos pièces : la Mécanique utilise leurs repères.');
}
/* Contextual navigation in the top bar (no permanent banner):
   Modéliser → « Valider pour simulation » → Validation → Mécanique / Structures, with back buttons. */
function updateSteps(){
  const host=$('#flow'); if(!host) return;
  const parts=state.parts.filter(p=>!p.hole);
  const todo=parts.filter(p=>!['ok','warn'].includes(vState(p))).length;
  const ready=parts.length>0 && mechReady();
  const go=(k,label,icon,cls,opt={})=>h('button',{class:'btn '+(cls||''),'data-go':k,disabled:opt.off||null,title:opt.title||null,onclick:()=>setWs(k)},
    icon? svgIcon(icon) : null, opt.shortLabel? h('span',{}, h('span',{class:'lfull'},label), h('span',{class:'lshort'},opt.shortLabel)) : h('span',{class:opt.short?'hide-mid':null},label), opt.badge? h('span',{class:'flow-b'},opt.badge) : null);
  host.innerHTML='';
  if(ws==='model'){
    host.append(lv(2)? go('check','Valider pour simulation','check','primary',{shortLabel:'Valider', badge: parts.length? (todo? String(todo) : '✓') : null, title:'Contrôler les pièces, poser les repères, puis simuler'})
                      : go('check','Vérifier pour l’impression','check','primary',{shortLabel:'Vérifier', title:'Contrôler les pièces avant de les imprimer'}));
  } else {
    host.append(go('model','Modélisation','back','ghost',{title:'Revenir à la modélisation'}));
    if(ws!=='check' && parts.length) host.append(go('check','Validation','check','ghost',{short:true,title:'Revenir à la validation'}));
    const W=WS.find(w=>w.k===ws);
    host.append(h('span',{class:'flow-t'}, h('span',{class:'step-n'},String(W.n)), h('b',{},W.name)));
    if(lv(2)){
      if(ws==='check'){ host.append(go('mech','Mouvement','pivot', ready?'primary':'', {off:!ready, title: ready? 'Simuler le mouvement (atelier Mécanique)' : 'Validez toutes les pièces pour débloquer la simulation du mouvement'}));
        host.append(go('struct','Déformation','truss','', {title:'Simuler la déformation (atelier Structures)'})); }
      if(ws==='mech') host.append(go('struct','Déformation','truss','ghost',{title:'Passer à l’atelier Structures'}));
      if(ws==='struct') host.append(go('mech','Mouvement','pivot','ghost',{off:!ready, title: ready? 'Passer à l’atelier Mécanique' : 'Validez d’abord les pièces'}));
    }
  }
  const W=WS.find(w=>w.k===ws); $('#inspStep').textContent=W.n; $('#inspTitle').textContent=W.name; $('#inspSub').textContent=W.sub;
}
function renderMech(body){
  if(!mechReady()){
    const bad=state.parts.filter(p=>!p.hole && !['ok','warn'].includes(vState(p)));
    const errs=bad.filter(p=>vState(p)==='err');
    body.append(sec('Avant de simuler', h('div',{class:'info',html:'Les liaisons s’accrochent aux <b>repères</b> (centres, axes) posés pendant la validation, et les pièces lourdes sont remplacées par un <b>proxy</b> allégé. Validez d’abord vos pièces.'}),
      h('div',{class:'vlist'}, bad.map(p=>h('div',{class:'vrow'}, vChip(vState(p)), h('span',{class:'vname'},p.name), h('span',{class:'vtri'},V_LABEL[vState(p)])))),
      errs.length? h('button',{class:'btn',style:'justify-content:center',onclick:()=>{ selection=[errs[0].id]; setWs('check'); }}, 'Voir les erreurs dans Valider')
        : h('button',{class:'btn primary',style:'justify-content:center;padding:9px',onclick:()=>{ validateAll(); renderInspector(); }}, svgIcon('check'),'Valider toutes les pièces')));
    return;
  }
  renderJoints(body);
}
