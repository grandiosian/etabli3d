
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
/* panneaux qui peuvent se plaquer contre un côté oblique de la languette d'édition (Modéliser, grand écran).
   La rangée .ed-row est une grille à trois colonnes : aile gauche | languette | aile droite ; la languette reste
   centrée, chaque aile prend la place libre de son côté. Plusieurs panneaux par côté (LAYOUT[id].order), et
   fitWings() les adapte à la place : complet → compact (icônes) → languette resserrée (ed-tight : icônes seules, ed-tight2 : sans titres) → retour sur la vue. */
const DOCKABLE=['navBar','snapBox'];
const dockOn=()=> ws==='model' && WIDE.matches;
function dockTarget(r){   // côté où un panneau de rectangle r se plaquerait, ou null
  const tb=$('#toolbar'), ed=$('.ed-wrap'); if(!tb || !ed || !ed.offsetParent || !dockOn()) return null;
  const t=tb.getBoundingClientRect(), e=ed.getBoundingClientRect(); if(r.top > t.bottom+80 || r.bottom < t.top-30) return null;
  const cx=(r.left+r.right)/2, q=e.width*0.38;
  if(cx < e.left+q) return 'L';
  if(cx > e.right-q) return 'R';
  return null;
}
function dockIndex(w, cx, skip){   // rang d'insertion dans l'aile, de gauche à droite
  return [...w.children].filter(c=>c!==skip && c.classList.contains('docked')).filter(c=>{ const b=c.getBoundingClientRect(); return (b.left+b.right)/2 < cx; }).length;
}
function sortWing(w){ const kids=[...w.children].filter(c=>c.classList.contains('docked')); kids.sort((a,b)=>(LAYOUT[a.id]?.order??0)-(LAYOUT[b.id]?.order??0)); for(const k of kids) w.append(k); }
function applyLayout(id){
  const el=$('#'+id); if(!el) return; const L=LAYOUT[id];
  const dock= DOCKABLE.includes(id) && L?.dock && dockOn() && !el.dataset.noroom ? L.dock : null;
  if(dock){ const w=$('#edWing'+dock); if(el.parentElement!==w) w.append(el); el.classList.add('docked'); clearPos(el); el.classList.toggle('collapsed', !!L?.c); sortWing(w); return; }
  if(el.classList.contains('docked')){ $('#stage').append(el); el.classList.remove('docked'); }
  if(L && L.x!=null){ const st=$('#stage').getBoundingClientRect(); if(st.width>2){ const w=el.offsetWidth||80, hh=el.offsetHeight||30; setPos(el, clamp(L.x,0,Math.max(0,st.width-Math.min(w,st.width))), clamp(L.y,0,Math.max(0,st.height-Math.min(hh,st.height)))); } }
  else clearPos(el);
  if(id!=='demo') el.classList.toggle('collapsed', !!L?.c);
}
/* adapte les ailes à la place disponible ; appelé après placeViews() (le cube de vue peut monter à droite) */
let fitting=false;
function fitWings(keep){
  const row=$('.ed-row'); if(!row || fitting) return; fitting=true;
  try{
    const W={L:$('#edWingL'), R:$('#edWingR')};
    for(const id of DOCKABLE){ const el=$('#'+id); if(el?.dataset.noroom){ delete el.dataset.noroom; applyLayout(id); } }
    row.classList.remove('ed-tight','ed-tight2'); for(const k in W){ W[k].dataset.fit='full'; W[k].style.maxWidth=''; }
    if(!dockOn() || !row.offsetParent) return;
    // à droite, le cube de vue remonté dans la rangée réserve sa place
    const v=$('#views'), up= v && v.offsetParent && !v.hidden && v.style.top && LAYOUT.views?.x==null;
    const capR=()=>{ if(!up) return; const e=$('.ed-wrap').getBoundingClientRect(), vr=v.getBoundingClientRect(); W.R.style.maxWidth=Math.max(0, vr.left-10-(e.right-22))+'px'; };
    capR();
    const live=w=>[...w.children].filter(c=>c.classList.contains('docked') && !c.classList.contains('nav-off'));
    const over=w=> live(w).length>0 && w.scrollWidth > w.clientWidth+1;
    for(const k in W) if(over(W[k])) W[k].dataset.fit='compact';
    if(over(W.L) || over(W.R)){ row.classList.add('ed-tight'); capR(); }
    if(over(W.L) || over(W.R)){ row.classList.add('ed-tight2'); capR(); }
    for(const k in W){   // toujours trop étroit : les panneaux les plus éloignés de la languette reviennent sur la vue
      let guard=4; while(over(W[k]) && guard--){ const kids=live(W[k]); const pool= kids.length>1? kids.filter(c=>c.id!==keep) : kids; const out= k==='L'? pool[0] : pool[pool.length-1]; if(!out) break; out.dataset.noroom='1'; applyLayout(out.id); }
    }
  } finally { fitting=false; }
}
function startPanelDrag(e, el, id){
  if(e.button!==0 || e.target.closest('button,select,input')) return;
  e.preventDefault(); e.stopPropagation();
  const st=$('#stage').getBoundingClientRect();
  if(el.classList.contains('docked')){ const r0=el.getBoundingClientRect(); delete LAYOUT[id].dock; $('#stage').append(el); el.classList.remove('docked'); setPos(el, r0.left-st.left, Math.max(0, r0.top-st.top)); fitWings(); }   // décroché : il repart de là où il était
  delete el.dataset.noroom;
  const r=el.getBoundingClientRect(); const ox=e.clientX-r.left, oy=e.clientY-r.top;
  el.classList.add('dragging'); if(DOCKABLE.includes(id)){ document.body.append(el); el.classList.add('lifted'); }
  const row=$('.ed-row'), canDock=DOCKABLE.includes(id); let side=null, idx=0;
  const ghost=h('div',{class:'dock-ghost','aria-hidden':'true'}); ghost.style.width=Math.round(r.width)+'px';
  const move=ev=>{ const up0= canDock && ws==='model'? Math.max(0, st.top-($('#toolbar').getBoundingClientRect().top||st.top)) : 0;   // on peut monter dans la rangée de la languette pour s'y plaquer
    const x=clamp(ev.clientX-st.left-ox,0,Math.max(0,st.width-r.width)), y=clamp(ev.clientY-st.top-oy,-up0,Math.max(0,st.height-r.height));
    if(el.classList.contains('lifted')) setPos(el, x+st.left, y+st.top); else setPos(el, x, y);
    if(!canDock) return;
    const rr=el.getBoundingClientRect(); side=dockTarget(rr);
    row?.classList.toggle('snap-L', side==='L'); row?.classList.toggle('snap-R', side==='R');
    if(side){ const w=$('#edWing'+side); idx=dockIndex(w, (rr.left+rr.right)/2, ghost); const ref=[...w.children].filter(c=>c!==ghost && c.classList.contains('docked'))[idx]||null; if(ghost.parentElement!==w || ghost.nextSibling!==ref) w.insertBefore(ghost, ref); }
    else ghost.remove(); };
  const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); el.classList.remove('dragging'); row?.classList.remove('snap-L','snap-R'); ghost.remove();
    if(el.classList.contains('lifted')){ const b=el.getBoundingClientRect(); el.classList.remove('lifted'); $('#stage').append(el); setPos(el, b.left-st.left, Math.max(0, b.top-st.top)); }
    if(side){ const w=$('#edWing'+side), kids=[...w.children].filter(c=>c.classList.contains('docked')); kids.splice(idx,0,el);
      kids.forEach((k,i)=>{ LAYOUT[k.id]={...LAYOUT[k.id], order:i}; });
      LAYOUT[id]={c:LAYOUT[id]?.c, dock:side, order:idx}; saveLayout(); applyLayout(id);
      placeViews(); fitWings(id); placeInsp(); fitWings(id);
      const out=DOCKABLE.filter(k=>$('#'+k)?.dataset.noroom).map(k=>FLOATS.find(f=>f[0]===k)?.[1]||k);
      toast(el.dataset.noroom? 'Pas assez de place à côté de la barre d’édition : le panneau y reviendra quand la fenêtre sera plus large.'
        : out.length? `Panneau plaqué. Faute de place, « ${out.join(', ')} » revient sur la vue (il se replacera quand la place le permettra).`
        : 'Panneau plaqué contre la barre d’édition : il s’adapte à la place disponible. Glissez sa poignée pour le décrocher.'); return; }
    const rr=el.getBoundingClientRect(); LAYOUT[id]={...LAYOUT[id], x:Math.round(rr.left-st.left), y:Math.max(0,Math.round(rr.top-st.top))}; saveLayout(); applyLayout(id);
    if(id==='bubble') el.dataset.side='';
    if(id==='views') placeInsp();
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
/* le cube de vue remonte juste sous la barre de création, à droite de la languette d'édition (si la place le permet) */
function placeViews(){
  const v=$('#views'); if(!v) return; if(!WIDE.matches || LAYOUT.views?.x!=null){ if(LAYOUT.views?.x==null) v.style.top=''; return; }
  const tb=$('#toolbar'), th= tb && tb.offsetParent? tb.offsetHeight : 0; if(!th){ v.style.top=''; return; }
  const ed=$('.ed-wrap')?.getBoundingClientRect(), st=$('#stage').getBoundingClientRect(), left=st.right-10-v.offsetWidth;
  const wingR= dockOn() && DOCKABLE.some(k=>LAYOUT[k]?.dock==='R' && !$('#'+k)?.classList.contains('nav-off'));   // un panneau plaqué à droite garde sa place : le cube reste sur la vue
  v.style.top= (ed && ed.right+8<left && !wingR)? (2-th)+'px' : '';   // la poignée est posée dans les coins : le cube monte d'autant
}
function placeInsp(){
  const el=$('#insp'); if(!el) return; placeViews(); fitWings();
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
  const el=$('#insp'), r=el.getBoundingClientRect(), a=$('#app').getBoundingClientRect(), ox=e.clientX-r.left, oy=e.clientY-r.top; el.classList.add('dragging');
  const mv=ev=>{ LAYOUT.insp={x:ev.clientX-a.left-ox, y:ev.clientY-a.top-oy}; placeInsp(); };
  const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); el.classList.remove('dragging'); const rr=el.getBoundingClientRect(); LAYOUT.insp={x:Math.round(rr.left-a.left), y:Math.round(rr.top-a.top)}; saveLayout(); applyViewOffset(); };
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
function rightReserve(){ const el=$('#insp'); if(!WIDE.matches || !el || LAYOUT.insp?.x!=null || LAYOUT.inspMin) return 0; return el.offsetWidth+20; }
/* the guide floats at the left of the view (just right of the tree), or over the sketch canvas while sketching */
function placeDemo(){ const d=$('#demo'); if(!d) return; const host= !$('#sk').hidden? $('#skCanvasWrap') : $('#stage');
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
  for(const [id] of FLOATS){ const el=$('#'+id); if(el){ applyLayout(id); clearPos(el); el.classList.remove('collapsed'); } }
  clearPos($('#demo')); if(ws==='mech') buildJointLabels(); if(!$('#bubble').hidden) placeBubble(BUB.x,BUB.y); applyDock(); applyViewOffset(); if(ws==='struct'){ ST.fitted=false; stResize(); }
  toast('Disposition des panneaux réinitialisée.');
}
