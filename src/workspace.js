
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
  const prev=ws; closeBubble();
  if(prev==='struct' && k!=='struct' && ST.anim.on) stAnimPlay(false);
  if(prev==='mech' && k!=='mech'){ if(simActive()) simReset(true); jf=null; cancelPick(); }
  if(locPick!=null){ locPick=null; $('#pickHint').hidden=true; }
  ws=k; document.documentElement.dataset.ws=k;
  const struct=k==='struct';
  mat.visible=!struct; matEdge.visible=!struct; axes.visible=!struct;
  structGroup.visible= struct && ST.mode3d;
  $('#stWrap').hidden= struct && ST.mode3d;
  if(struct){ computeStruct(); ST.fitted=false; ST.sel=null; stSetTool(ST.tool); $('#stTools').dataset.mod=SD().mod; requestAnimationFrame(()=>{ stResize(); if(ST.mode3d) setStructView3D(true); }); }
  sync(); renderInspector(); updateSteps(); applyViewOffset(); updateMarkers();
  if(prev!==k && k==='mech' && !mechReady()) toast('Validez d’abord vos pièces : la Mécanique utilise leurs repères.');
}
function updateSteps(){
  const host=$('#steps'); if(!host) return;
  const parts=state.parts.filter(p=>!p.hole);
  const todo=parts.filter(p=>!['ok','warn'].includes(vState(p))).length;
  host.innerHTML='';
  WS.forEach((W,i)=>{
    let badge='';
    if(W.k==='check') badge= !parts.length? '' : todo? `${todo} à valider` : '✓ validé';
    if(W.k==='mech') badge= !mechReady()&&parts.length? 'verrouillé' : `${state.joints.length} liaison${state.joints.length>1?'s':''}`;
    if(W.k==='struct') badge= SD().mod==='treillis'? 'treillis' : 'maillage';
    const b=h('button',{class:'step'+(ws===W.k?' on':'')+(W.k==='check'&&todo?' todo':'')+(W.k==='mech'&&!mechReady()&&parts.length?' locked':''),'data-wsk':W.k,'aria-current':ws===W.k?'step':null,'data-min':W.lvl>1?String(W.lvl):null,onclick:()=>setWs(W.k)},
      h('span',{class:'step-n'},String(W.n)), h('span',{class:'step-t'}, h('b',{},W.name), h('small',{},W.sub)), badge? h('span',{class:'step-b'},badge) : null);
    host.append(b);
    if(i<WS.length-1) host.append(h('span',{class:'step-sep','aria-hidden':'true','data-min':WS[i+1].lvl>1?String(WS[i+1].lvl):null}, i===2? '·' : '›'));
  });
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
