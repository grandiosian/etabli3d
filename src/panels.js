
/* =========================================================
   Panneaux mobiles : chaque panneau flottant de la vue a une poignée
   (glisser pour le déplacer) et un bouton pour le réduire. Le panneau
   latéral se réduit et change de côté ; la barre des formes se réduit.
   La disposition est mémorisée dans ce navigateur.
   ========================================================= */
const LAYOUT_KEY='etabli3d.layout';
let LAYOUT=(()=>{ try{ return JSON.parse(localStorage.getItem(LAYOUT_KEY)||'{}')||{}; }catch(e){ return {}; } })();
function saveLayout(){ try{ localStorage.setItem(LAYOUT_KEY, JSON.stringify(LAYOUT)); }catch(e){} }
const FLOATS=[['views','Vues'],['navBar','Navigation'],['snapBox','Grille'],['simbar','Simulation'],['stTools','Outils de structure'],['stLegendBox','Légende']];
const movedDemo=()=> !!LAYOUT.demo && LAYOUT.demo.x!=null && !$('#demo')?.classList.contains('in-sk');

function setPos(el,x,y){ el.style.left=x+'px'; el.style.top=y+'px'; el.style.right='auto'; el.style.bottom='auto'; el.style.transform='none'; }
function clearPos(el){ for(const k of ['left','top','right','bottom','transform']) el.style[k]=''; }
/* panneaux qui peuvent se plaquer contre un côté oblique de la languette d'édition (Modéliser, grand écran) :
   seulement la Grille, le Guide et les Propriétés (le cube de vue et la navigation restent sur la vue).
   La rangée .ed-row est une grille à trois colonnes : aile gauche | languette | aile droite ; la languette reste
   centrée, chaque aile prend la place libre de son côté. Plusieurs panneaux par côté (LAYOUT[id].order).
   - petit panneau (grille) : rangé dans l'aile, même hauteur que la languette, bords obliques ;
   - grands panneaux (TALL : guide, propriétés) : une cale .dock-sp leur réserve la place dans l'aile,
     le panneau lui-même est posé dans #app au même endroit (placeTall), son coin du haut suit l'oblique
     (liseré --ed-rim, le guide garde son liseré jaune à gauche) et il descend sur la vue à sa hauteur naturelle.
   fitWings() adapte à la place, en repartant chaque fois de l'état complet : ailes compactes (icônes) → grands
   panneaux rétrécis (TALL_MIN) → languette resserrée (ed-tight : icônes seules, ed-tight2 : sans titres) → le panneau
   plaqué depuis le plus longtemps revient sur la vue (data-noroom, LAYOUT[id].t), et revient quand la place le permet.
   À droite, le cube de vue reste dans le coin : l'aile droite s'arrête avant lui. */
const DOCKABLE=['snapBox','demo','insp'];
const TALL=['demo','insp'];
const TALL_MIN=270;
const tallW=id=> Math.max(TALL_MIN, LAYOUT[id]?.w||300);
const isTall=id=>TALL.includes(id);
const dockOn=()=> ws==='model' && WIDE.matches && !!$('#sk')?.hidden;
const homeOf=id=> id==='insp'? $('#app') : id==='demo' && !$('#sk').hidden? $('#skCanvasWrap') : $('#stage');
const panelShown=el=> !!el && !el.hidden && !el.classList.contains('nav-off') && getComputedStyle(el).display!=='none';
const PANEL_NAME={snapBox:'Grille', demo:'Guide', insp:'Propriétés'};
const itemId=c=> c.dataset.for || c.id;
const wingItems=w=> [...w.children].filter(c=>c.classList.contains('docked') || c.classList.contains('dock-sp'));
function dockTarget(r){   // côté où un panneau de rectangle r se plaquerait, ou null
  const tb=$('#toolbar'), ed=$('.ed-wrap'); if(!tb || !ed || !ed.offsetParent || !dockOn()) return null;
  const t=tb.getBoundingClientRect(), e=ed.getBoundingClientRect(); if(r.top > t.bottom+80 || r.bottom < t.top-30) return null;
  const cx=(r.left+r.right)/2, q=e.width*0.38;
  if(cx < e.left+q) return 'L';
  if(cx > e.right-q) return 'R';
  return null;
}
function dockIndex(w, cx){   // rang d'insertion dans l'aile, de gauche à droite
  return wingItems(w).filter(c=>{ const b=c.getBoundingClientRect(); return (b.left+b.right)/2 < cx; }).length;
}
function sortWing(w){ const kids=wingItems(w); kids.sort((a,b)=>(LAYOUT[itemId(a)]?.order??0)-(LAYOUT[itemId(b)]?.order??0)); for(const k of kids) w.append(k); }
function undockEl(el, id){   // retire un panneau de l'aile (sans toucher à LAYOUT)
  $('#dsp-'+id)?.remove();
  if(!el.classList.contains('docked')) return;
  const tall=el.classList.contains('docked-tall'); el.classList.remove('docked','docked-tall');
  if(tall){ delete el.dataset.side; for(const k of ['width','maxHeight','left','top','right','bottom']) el.style[k]=''; el.style.removeProperty('--band'); }
  homeOf(id).append(el);
}
function applyLayout(id){
  const el=$('#'+id); if(!el) return; const L=LAYOUT[id];
  const dock= DOCKABLE.includes(id) && L?.dock && dockOn() && !el.dataset.noroom ? L.dock : null;
  if(dock){ const w=$('#edWing'+dock);
    if(isTall(id)){   // grand panneau : une cale dans l'aile, le panneau posé par-dessus dans #app
      let sp=$('#dsp-'+id); if(!sp) sp=h('div',{class:'dock-sp',id:'dsp-'+id,'data-for':id,'aria-hidden':'true'});
      if(sp.parentElement!==w) w.append(sp);
      if(!sp.style.width) sp.style.width=tallW(id)+'px';
      if(el.parentElement!==$('#app')) $('#app').append(el);
      el.classList.add('docked','docked-tall'); el.dataset.side=dock; clearPos(el);
      sortWing(w); placeTall(); return; }
    if(el.parentElement!==w) w.append(el); el.classList.add('docked'); clearPos(el); el.classList.toggle('collapsed', !!L?.c); sortWing(w); return; }
  undockEl(el, id);
  if(id==='insp'){ placeInsp(); return; }
  if(id==='demo' && !$('#sk').hidden) return;   // pendant une esquisse, le guide est posé par placeDemo()
  if(L && L.x!=null){ const st=$('#stage').getBoundingClientRect(); if(st.width>2){ const w=el.offsetWidth||80, hh=el.offsetHeight||30; setPos(el, clamp(L.x,0,Math.max(0,st.width-Math.min(w,st.width))), clamp(L.y,0,Math.max(0,st.height-Math.min(hh,st.height)))); } }
  else clearPos(el);
  if(id!=='demo') el.classList.toggle('collapsed', !!L?.c);
}
/* les grands panneaux plaqués suivent leur cale */
function placeTall(){
  const app=$('#app'); if(!app) return; const a=app.getBoundingClientRect(), band=$('.ed-wrap')?.getBoundingClientRect().height||64;
  for(const id of TALL){ const el=$('#'+id), sp=$('#dsp-'+id); if(!el?.classList.contains('docked-tall') || !sp) continue;
    const r=sp.getBoundingClientRect(), L=el.dataset.side==='L';   // 2,5 px de plus côté languette : le panneau recouvre le liseré oblique de l'aile
    el.style.left=(Math.round(r.left-a.left)-(L? 0 : 2.5))+'px'; el.style.top=Math.round(r.top-a.top)+'px'; el.style.right='auto'; el.style.bottom='auto';
    el.style.width=(Math.round(r.width)+2.5)+'px';
    el.style.maxHeight=Math.max(120, Math.round(a.bottom-r.top-10))+'px'; el.style.setProperty('--band', Math.round(band)+'px'); }
}
/* adapte les ailes à la place disponible ; appelé après placeViews(). Chaque calcul repart de l'état complet. */
let fitting=false;
function fitWings(keep){
  const row=$('.ed-row'); if(!row || fitting) return; fitting=true;
  try{
    const W={L:$('#edWingL'), R:$('#edWingR')};
    for(const id of DOCKABLE){ const el=$('#'+id); if(el?.dataset.noroom){ delete el.dataset.noroom; applyLayout(id); } }
    for(const id of TALL){ const sp=$('#dsp-'+id); if(sp) sp.hidden=!panelShown($('#'+id)); }
    const tallsOf=k=> TALL.filter(id=>$('#dsp-'+id)?.parentElement===W[k]);
    const reset=()=>{ row.classList.remove('ed-tight','ed-tight2'); for(const k in W){ W[k].dataset.fit='full'; W[k].style.maxWidth=''; for(const id of tallsOf(k)) $('#dsp-'+id).style.width=tallW(id)+'px'; } };
    reset();
    if(!dockOn() || !row.offsetParent) return;
    // à droite, le cube de vue (à sa place, dans le coin) réserve la sienne : l'aile droite s'arrête avant lui
    const v=$('#views'), cube= v && v.offsetParent && !v.hidden && LAYOUT.views?.x==null;
    const capR=()=>{ if(!cube) return; const e=$('.ed-wrap').getBoundingClientRect(), vr=v.getBoundingClientRect(); W.R.style.maxWidth=Math.max(0, vr.left-10-(e.right-22))+'px'; };
    const live=w=>wingItems(w).filter(c=> c.classList.contains('dock-sp')? !c.hidden : !c.classList.contains('nav-off'));
    const over=w=> live(w).length>0 && w.scrollWidth > w.clientWidth+1;
    const shrink=k=>{ const ids=tallsOf(k).filter(id=>!$('#dsp-'+id).hidden); if(!ids.length) return;   // les grands panneaux rétrécissent juste ce qu'il faut (TALL_MIN au plus)
      const d=Math.ceil((W[k].scrollWidth-W[k].clientWidth)/ids.length); for(const id of ids){ const sp=$('#dsp-'+id); sp.style.width=Math.max(TALL_MIN, tallW(id)-d)+'px'; } };
    const fits=()=>{ capR(); for(const k in W){ W[k].dataset.fit='full'; for(const id of tallsOf(k)) $('#dsp-'+id).style.width=tallW(id)+'px'; if(over(W[k])){ W[k].dataset.fit='compact'; if(over(W[k])) shrink(k); } } return !over(W.L) && !over(W.R); };
    for(let guard=8; guard--; ){
      reset();
      if(!fits()){ row.classList.add('ed-tight'); if(!fits()){ row.classList.add('ed-tight2'); fits(); } }   // puis la languette se resserre
      const k= over(W.L)? 'L' : over(W.R)? 'R' : null; if(!k) break;
      // toujours trop étroit : le panneau plaqué depuis le plus longtemps revient sur la vue, puis on recommence
      const kids=live(W[k]), pool=kids.filter(c=>kids.length<2 || itemId(c)!==keep).sort((x,y)=>(LAYOUT[itemId(x)]?.t||0)-(LAYOUT[itemId(y)]?.t||0));
      const out=pool[0]; if(!out) break;
      const oid=itemId(out); $('#'+oid).dataset.noroom='1'; applyLayout(oid);
    }
  } finally { fitting=false; placeTall(); }
}
/* pendant le glisser : le côté visé s'éclaire et l'emplacement apparaît en pointillé */
function dockFeedback(D, rr){
  D.side=dockTarget(rr); D.row?.classList.toggle('snap-L', D.side==='L'); D.row?.classList.toggle('snap-R', D.side==='R');
  if(!D.side){ D.ghost.remove(); return; }
  const w=$('#edWing'+D.side); D.ghost.remove(); D.idx=dockIndex(w, (rr.left+rr.right)/2); const ref=wingItems(w)[D.idx]||null; w.insertBefore(D.ghost, ref);
}
function dockStart(id, r){ const ghost=h('div',{class:'dock-ghost','aria-hidden':'true'}); ghost.style.width=Math.round(Math.min(r.width, 360))+'px'; return {id, row:$('.ed-row'), ghost, side:null, idx:0, w:Math.round(r.width)}; }
function dockEnd(D){ D.row?.classList.remove('snap-L','snap-R'); D.ghost.remove(); }
/* le panneau lâché sur un côté : il s'y range à la place montrée */
function dockCommit(D){
  const id=D.id, el=$('#'+id), w=$('#edWing'+D.side), ids=wingItems(w).map(itemId).filter(k=>k!==id); ids.splice(D.idx,0,id);
  ids.forEach((k,i)=>{ LAYOUT[k]={...LAYOUT[k], order:i}; });
  LAYOUT[id]={c:LAYOUT[id]?.c, dock:D.side, order:D.idx, w:D.w, t:Date.now()}; saveLayout(); applyLayout(id);
  placeViews(); fitWings(id); placeInsp(); fitWings(id); applyViewOffset();
  const out=DOCKABLE.filter(k=>k!==id && $('#'+k)?.dataset.noroom).map(k=>PANEL_NAME[k]||k);
  toast(el.dataset.noroom? 'Pas assez de place à côté de la barre d’édition : le panneau y reviendra quand la fenêtre sera plus large.'
    : out.length? `Panneau plaqué. Faute de place, « ${out.join(', ')} » revient sur la vue (il se replacera quand la place le permettra).`
    : 'Panneau plaqué contre la barre d’édition : il s’adapte à la place disponible. Glissez sa poignée pour le décrocher.');
}
function startPanelDrag(e, el, id){
  if(e.button!==0 || e.target.closest('button,select,input')) return;
  e.preventDefault(); e.stopPropagation();
  const st=$('#stage').getBoundingClientRect();
  if(el.classList.contains('docked')){ const r0=el.getBoundingClientRect(); delete LAYOUT[id].dock; undockEl(el, id); setPos(el, r0.left-st.left, Math.max(0, r0.top-st.top)); fitWings(); }   // décroché : il repart de là où il était
  delete el.dataset.noroom;
  const r=el.getBoundingClientRect(); const ox=e.clientX-r.left, oy=e.clientY-r.top;
  const canDock=DOCKABLE.includes(id) && dockOn();
  el.classList.add('dragging'); if(canDock){ document.body.append(el); el.classList.add('lifted'); }
  const D=canDock? dockStart(id, r) : null;
  const move=ev=>{ const up0= canDock? Math.max(0, st.top-($('#toolbar').getBoundingClientRect().top||st.top)) : 0;   // on peut monter dans la rangée de la languette pour s'y plaquer
    const x=clamp(ev.clientX-st.left-ox,0,Math.max(0,st.width-r.width)), y=clamp(ev.clientY-st.top-oy,-up0,Math.max(0,st.height-Math.min(r.height,80)));
    if(el.classList.contains('lifted')) setPos(el, x+st.left, y+st.top); else setPos(el, x, y);
    if(D) dockFeedback(D, el.getBoundingClientRect()); };
  const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); el.classList.remove('dragging'); if(D) dockEnd(D);
    if(el.classList.contains('lifted')){ const b=el.getBoundingClientRect(); el.classList.remove('lifted'); homeOf(id).append(el); setPos(el, b.left-st.left, Math.max(0, b.top-st.top)); }
    if(D?.side){ dockCommit(D); return; }
    const rr=el.getBoundingClientRect(); LAYOUT[id]={...LAYOUT[id], x:Math.round(rr.left-st.left), y:Math.max(0,Math.round(rr.top-st.top))}; saveLayout(); applyLayout(id);
    if(id==='bubble') el.dataset.side='';
    if(id==='views'){ placeInsp(); fitWings(); }
    if(id==='demo'){ applyViewOffset(); if(ws==='struct'){ ST.fitted=false; stFit(); stDraw(); } } };
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
}
function togglePanel(id){ LAYOUT[id]={...LAYOUT[id], c:!LAYOUT[id]?.c}; saveLayout(); applyLayout(id); if(id==='views') placeInsp(); }
function gripFor(id, title, withMin=true){
  const g=h('div',{class:'pgrip',title:`Glisser pour déplacer : ${title}`}, svgIcon('dots'),
    withMin? h('button',{class:'pmin',title:'Réduire ou agrandir','aria-label':`Réduire ou agrandir : ${title}`,onclick:e=>{ e.stopPropagation(); togglePanel(id); }}, svgIcon('chevUp')) : null);
  g.addEventListener('pointerdown',e=>startPanelDrag(e, $('#'+id), id));
  return g;
}
function initPanels(){
  for(const k of ['views','navBar']) if(LAYOUT[k]?.dock){ const {dock, order, w, t, ...rest}=LAYOUT[k]; LAYOUT[k]=rest; saveLayout(); }   // ne se plaquent plus
  for(const [id,title] of FLOATS){ const el=$('#'+id); if(!el) continue; el.classList.add('pfloat'); el.prepend(gripFor(id,title)); applyLayout(id); }
  $('#inspSide').onclick=()=>{ delete LAYOUT.insp; saveLayout(); placeInsp(); applyViewOffset(); };
  $('#insp .insp-head').addEventListener('pointerdown', startInspDrag);
  $('#inspMin').onclick=()=>{ LAYOUT.inspMin=!LAYOUT.inspMin; saveLayout(); applyDock(); };
  $('#rackMin').onclick=()=>{ LAYOUT.rackMin=!LAYOUT.rackMin; saveLayout(); applyDock(); };
  $('#treeMin').onclick=()=>{ LAYOUT.treeMin=!LAYOUT.treeMin; saveLayout(); treeChanged(); };
  $('#treeDock').onclick=()=>{ delete LAYOUT.tree; saveLayout(); treeChanged(); };
  $('#outliner .tree-head').addEventListener('pointerdown', startTreeDrag);
  applyDock();
  new ResizeObserver(()=>updateOverlay()).observe($('#insp')); WIDE.addEventListener('change', ()=>{ for(const id of DOCKABLE) applyLayout(id); updateOverlay(); placeInsp(); });
  { let q=0; new ResizeObserver(()=>{ if(!q) q=requestAnimationFrame(()=>{ q=0; placeViews(); fitWings(); }); }).observe($('#edSel')); }
  new ResizeObserver(()=>{ for(const [id] of FLOATS) if(LAYOUT[id]?.x!=null) applyLayout(id); if(movedDemo()) applyLayout('demo'); if(ws==='mech') layoutJointGroup(); updateOverlay(); placeInsp(); }).observe($('#stage'));
}
function applyDock(){
  const app=$('#app'); app.classList.toggle('insp-min', !!LAYOUT.inspMin); app.classList.toggle('rack-min', !!LAYOUT.rackMin);
  applyTree();
  updateOverlay();
  $('#inspMin').title= LAYOUT.inspMin? 'Agrandir le panneau' : 'Réduire le panneau';
  placeInsp();
  $('#rackMin').title= LAYOUT.rackMin? 'Agrandir la barre des formes' : 'Réduire la barre des formes';
}
/* ---- the properties panel floats over the view: by default under the view cube, on the right.
   Its header drags it (LAYOUT.insp, in #app coordinates); the arrow folds it; the round arrow puts it back. */
/* le cube de vue reste dans le coin en haut à droite de la vue, juste sous la barre de création ; en Modéliser, il remonte
   dans la rangée de la languette d'édition dès que celle-ci lui laisse la place (l'aile droite s'arrête avant lui : fitWings) */
function placeViews(){
  const v=$('#views'); if(!v) return; v.style.right='';
  if(!WIDE.matches || LAYOUT.views?.x!=null){ if(LAYOUT.views?.x==null) v.style.top=''; return; }
  const st=$('#stage').getBoundingClientRect(), tb=$('#toolbar'), th= tb && tb.offsetParent? tb.offsetHeight : 0; if(!th){ v.style.top=''; return; }
  const ed=$('.ed-wrap')?.getBoundingClientRect(), left=st.right-10-v.offsetWidth;
  v.style.top= (ed && ed.width && ed.right+8<left)? (2-th)+'px' : '';   // la poignée est posée dans les coins : le cube monte d'autant
}
function placeInsp(){
  const el=$('#insp'); if(!el) return; placeViews(); fitWings();
  if(el.classList.contains('docked')) return;   // plaqué contre la languette : placé par placeTall()
  if(!WIDE.matches){ for(const k of ['left','top','maxHeight']) el.style[k]=''; return; }
  const app=$('#app').getBoundingClientRect(), st=$('#stage').getBoundingClientRect(), w=el.offsetWidth||300, L=LAYOUT.insp; let x, y;
  if(L && L.x!=null){ x=L.x; y=L.y; }
  else { const v=$('#views'); const vr=(v && v.offsetParent && !v.hidden && LAYOUT.views?.x==null)? v.getBoundingClientRect() : null;
    x=st.right-app.left-w-10; y= vr? vr.bottom-app.top+6 : st.top-app.top+10; }
  x=clamp(x, 0, Math.max(0,app.width-w)); y=clamp(y, st.top-app.top, Math.max(st.top-app.top, app.height-60));
  el.style.left=x+'px'; el.style.top=y+'px'; el.style.maxHeight=Math.max(120, app.height-y-10)+'px';
}
function startInspDrag(e){
  if(e.button!==0 || e.target.closest('button,select,input') || !WIDE.matches) return; e.preventDefault();
  const el=$('#insp'), a=$('#app').getBoundingClientRect();
  if(el.classList.contains('docked')){ const r0=el.getBoundingClientRect(); LAYOUT.insp={x:Math.round(r0.left-a.left), y:Math.round(r0.top-a.top)}; delete el.dataset.noroom; applyLayout('insp'); fitWings(); }
  const r=el.getBoundingClientRect(), ox=e.clientX-r.left, oy=e.clientY-r.top; el.classList.add('dragging');
  const D= dockOn()? dockStart('insp', r) : null;
  const mv=ev=>{ LAYOUT.insp={x:ev.clientX-a.left-ox, y:ev.clientY-a.top-oy}; placeInsp(); if(D) dockFeedback(D, el.getBoundingClientRect()); };
  const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); el.classList.remove('dragging'); if(D) dockEnd(D);
    if(D?.side){ dockCommit(D); return; }
    const rr=el.getBoundingClientRect(); LAYOUT.insp={x:Math.round(rr.left-a.left), y:Math.round(rr.top-a.top)}; saveLayout(); applyViewOffset(); };
  window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up);
}
/* ---- arborescence : réduire (rail étroit), déplacer (flottante au-dessus de la vue), remettre à gauche */
function applyTree(){
  const app=$('#app'), el=$('#outliner'); if(!el) return; const L=LAYOUT.tree, fl= WIDE.matches && L && L.x!=null;
  app.classList.toggle('tree-min', !!LAYOUT.treeMin); app.classList.toggle('tree-float', !!fl);
  if(fl){ const a=app.getBoundingClientRect(); el.style.left=clamp(L.x,0,Math.max(0,a.width-80))+'px'; el.style.top=clamp(L.y,0,Math.max(0,a.height-60))+'px'; }
  else { el.style.left=''; el.style.top=''; }
  $('#treeMin').title= LAYOUT.treeMin? 'Agrandir l’arborescence' : 'Réduire l’arborescence';
}
function treeChanged(){ applyTree(); requestAnimationFrame(()=>{ updateOverlay(); placeInsp(); applyViewOffset(); placeDemo(); }); }
function startTreeDrag(e){
  if(e.button!==0 || e.target.closest('button') || !WIDE.matches) return; e.preventDefault();
  const el=$('#outliner'), r=el.getBoundingClientRect(), a=$('#app').getBoundingClientRect(), ox=e.clientX-r.left, oy=e.clientY-r.top; let moved=false;
  const mv=ev=>{ if(!moved && Math.hypot(ev.clientX-e.clientX, ev.clientY-e.clientY)<4) return; moved=true; el.classList.add('dragging');
    LAYOUT.tree={x:Math.round(ev.clientX-a.left-ox), y:Math.round(ev.clientY-a.top-oy)}; applyTree(); };
  const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); el.classList.remove('dragging'); if(moved){ saveLayout(); treeChanged(); } };
  window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up);
}
/* width kept free on the right of the view for the properties panel when it sits at its place */
function rightReserve(){ const el=$('#insp'); if(!WIDE.matches || !el || LAYOUT.insp?.x!=null || LAYOUT.inspMin || el.classList.contains('docked')) return 0; return el.offsetWidth+20; }
/* the guide floats at the left of the view (just right of the tree), or over the sketch canvas while sketching */
function placeDemo(){ const d=$('#demo'); if(!d) return;
  if(dockOn() && LAYOUT.demo?.dock && !d.dataset.noroom){ applyLayout('demo'); requestAnimationFrame(()=>fitWings()); return; }   // plaqué contre la languette
  if(d.classList.contains('docked')) undockEl(d, 'demo');
  const host= !$('#sk').hidden? $('#skCanvasWrap') : $('#stage');
  if(d.parentElement!==host){ host.append(d); d.style.transform=''; } d.classList.toggle('in-sk', host.id==='skCanvasWrap'); }
/* the panels around the view (creation bar on top, settings and tree on the sides) are see-through on wide
   screens: the canvas extends under them by OVR.t / OVR.l / OVR.r px, measured from the actual layout */
const WIDE=matchMedia('(min-width: 861px)');
function updateOverlay(){
  { const o=$('#outliner'), app=$('#app'); const tw=(WIDE.matches && o && o.offsetParent && !app.classList.contains('tree-float'))? o.offsetWidth : 0;
    app.style.setProperty('--tree-w', tw+'px'); }   // la languette se centre sur la vue, à droite de l'arborescence
  let l=0, r=0, t=0;
  if(WIDE.matches){ const a=$('#app').getBoundingClientRect(), st=$('#stage').getBoundingClientRect(), top=$('#top').getBoundingClientRect();
    l=Math.max(0,Math.round(st.left-a.left)); r=Math.max(0,Math.round(a.right-st.right)); t=Math.max(0,Math.round(st.top-top.bottom)); }
  if(l===OVR.l && r===OVR.r && t===OVR.t) return;
  OVR.l=l; OVR.r=r; OVR.t=t; const st=$('#stage'); st.style.setProperty('--ovr-l', l+'px'); st.style.setProperty('--ovr-r', r+'px'); st.style.setProperty('--ovr-t', t+'px');
  resize(); if(ws==='struct'){ ST.fitted=false; stResize(); }
}
function resetLayout(){
  LAYOUT={}; saveLayout();
  for(const id of DOCKABLE){ const el=$('#'+id); if(el){ delete el.dataset.noroom; applyLayout(id); } }
  for(const [id] of FLOATS){ const el=$('#'+id); if(el){ applyLayout(id); clearPos(el); el.classList.remove('collapsed'); } }
  clearPos($('#demo')); if(ws==='mech') buildJointLabels(); if(!$('#bubble').hidden) placeBubble(BUB.x,BUB.y); applyDock(); applyViewOffset(); if(ws==='struct'){ ST.fitted=false; stResize(); }
  toast('Disposition des panneaux réinitialisée.');
}
