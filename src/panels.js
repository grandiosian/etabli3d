
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
/* barre Édition (#toolbar) : sur grand écran, une colonne à droite de la barre de création (même rangée, #bars) ;
   plus petit, pleine largeur sous la barre de création (ou au-dessus, sur téléphone). Rentrée quand rien n'est choisi,
   elle s'ouvre dès qu'une pièce est choisie (edSelChanged, appelé par updateToolButtons). L'onglet « Édition » (#edToggle,
   au bout des onglets de création) et la flèche #edFold l'ouvrent ou la rentrent à la main. Rentrée à la main alors qu'une
   pièce est choisie, elle ne s'ouvre plus toute seule (LAYOUT.edAuto=false) jusqu'à ce qu'on la rouvre à la main. */
let edOpen=false, edHadSel=false;
function setEdOpen(on){
  edOpen=!!on; const tb=$('#toolbar'); if(!tb) return; tb.classList.toggle('ed-closed', !edOpen);
  const t=$('#edToggle'); if(t){ t.setAttribute('aria-expanded', String(edOpen)); t.title= edOpen? 'Rentrer la barre Édition' : 'Ouvrir la barre Édition : convertir, grouper, dupliquer, poser, supprimer (elle s’ouvre toute seule quand une pièce est choisie)'; }
  fitEdBar(); requestAnimationFrame(()=>{ updateOverlay(); placeInsp(); applyViewOffset(); });
}
function edSelChanged(has){ if(has===edHadSel) return; edHadSel=has; if(LAYOUT.edAuto===false) return; setEdOpen(has); }
function edToggle(){
  const on=!edOpen;
  if(on){ if(LAYOUT.edAuto===false){ delete LAYOUT.edAuto; saveLayout(); } }
  else if(edHadSel && LAYOUT.edAuto!==false){ LAYOUT.edAuto=false; saveLayout(); toast('La barre Édition ne s’ouvrira plus toute seule : clique sur l’onglet « Édition » pour la rouvrir.'); }
  setEdOpen(on);
}
/* place réduite : la barre passe en icônes seules (ed-tight), puis sans titres (ed-tight2) */
function fitEdBar(){
  const bar=$('#edBar'); if(!bar) return; bar.classList.remove('ed-tight','ed-tight2');
  if(!bar.offsetParent) return; const box=[bar.querySelector('.ed-shape'), $('#tools')].filter(Boolean);   // sur grand écran, c'est #tools qui défile
  const over=()=> box.some(x=> x.clientWidth>0 && x.scrollWidth > x.clientWidth+1);
  if(over()){ bar.classList.add('ed-tight'); if(over()) bar.classList.add('ed-tight2'); }
}
function applyLayout(id){
  const el=$('#'+id); if(!el) return; const L=LAYOUT[id];
  if(id==='insp'){ placeInsp(); return; }
  if(id==='demo' && !$('#sk').hidden) return;   // pendant une esquisse, le guide est posé par placeDemo()
  if(L && L.x!=null){ const st=$('#stage').getBoundingClientRect(); if(st.width>2){ const w=el.offsetWidth||80, hh=el.offsetHeight||30; setPos(el, clamp(L.x,0,Math.max(0,st.width-Math.min(w,st.width))), clamp(L.y,0,Math.max(0,st.height-Math.min(hh,st.height)))); } }
  else clearPos(el);
  if(id!=='demo') el.classList.toggle('collapsed', !!L?.c);
}
function startPanelDrag(e, el, id){
  if(e.button!==0 || e.target.closest('button,select,input')) return;
  e.preventDefault(); e.stopPropagation();
  const st=$('#stage').getBoundingClientRect();
  const r=el.getBoundingClientRect(); const ox=e.clientX-r.left, oy=e.clientY-r.top;
  el.classList.add('dragging');
  const move=ev=>{ const x=clamp(ev.clientX-st.left-ox,0,Math.max(0,st.width-r.width)), y=clamp(ev.clientY-st.top-oy,0,Math.max(0,st.height-Math.min(r.height,80))); setPos(el, x, y); };
  const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); el.classList.remove('dragging');
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
  for(const k in LAYOUT) if(LAYOUT[k]?.dock){ const {dock, order, w, t, ...rest}=LAYOUT[k]; LAYOUT[k]=rest; saveLayout(); }   // les panneaux ne se plaquent plus contre la barre Édition
  for(const [id,title] of FLOATS){ const el=$('#'+id); if(!el) continue; el.classList.add('pfloat'); el.prepend(gripFor(id,title)); applyLayout(id); }
  $('#inspSide').onclick=()=>{ delete LAYOUT.insp; saveLayout(); placeInsp(); applyViewOffset(); };
  $('#insp .insp-head').addEventListener('pointerdown', startInspDrag);
  $('#inspMin').onclick=()=>{ LAYOUT.inspMin=!LAYOUT.inspMin; saveLayout(); applyDock(); };
  $('#rackMin').onclick=()=>{ LAYOUT.rackMin=!LAYOUT.rackMin; saveLayout(); applyDock(); };
  $('#treeMin').onclick=()=>{ LAYOUT.treeMin=!LAYOUT.treeMin; saveLayout(); treeChanged(); };
  $('#treeDock').onclick=()=>{ delete LAYOUT.tree; saveLayout(); treeChanged(); };
  $('#outliner .tree-head').addEventListener('pointerdown', startTreeDrag);
  $('#edToggle').onclick=edToggle; $('#edFold').onclick=edToggle;
  applyDock();
  new ResizeObserver(()=>updateOverlay()).observe($('#insp')); WIDE.addEventListener('change', ()=>{ updateOverlay(); placeInsp(); });
  { let q=0; new ResizeObserver(()=>{ if(!q) q=requestAnimationFrame(()=>{ q=0; fitEdBar(); }); }).observe($('#edSel')); }
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
/* le cube de vue reste dans le coin en haut à droite de la vue, juste sous la barre de création (ou sous la barre Édition ouverte) */
function placeViews(){ const v=$('#views'); if(!v) return; v.style.right=''; if(LAYOUT.views?.x==null) v.style.top=''; }
function placeInsp(){
  const el=$('#insp'); if(!el) return; placeViews(); fitEdBar();
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
  const r=el.getBoundingClientRect(), ox=e.clientX-r.left, oy=e.clientY-r.top; el.classList.add('dragging');
  const mv=ev=>{ LAYOUT.insp={x:ev.clientX-a.left-ox, y:ev.clientY-a.top-oy}; placeInsp(); };
  const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); el.classList.remove('dragging');
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
function rightReserve(){ const el=$('#insp'); if(!WIDE.matches || !el || LAYOUT.insp?.x!=null || LAYOUT.inspMin) return 0; return el.offsetWidth+20; }
/* the guide floats at the left of the view (just right of the tree), or over the sketch canvas while sketching */
function placeDemo(){ const d=$('#demo'); if(!d) return;
  const host= !$('#sk').hidden? $('#skCanvasWrap') : $('#stage');
  if(d.parentElement!==host){ host.append(d); d.style.transform=''; } d.classList.toggle('in-sk', host.id==='skCanvasWrap'); }
/* the panels around the view (creation bar on top, settings and tree on the sides) are see-through on wide
   screens: the canvas extends under them by OVR.t / OVR.l / OVR.r px, measured from the actual layout */
const WIDE=matchMedia('(min-width: 861px)');
function updateOverlay(){
  let l=0, r=0, t=0;
  if(WIDE.matches){ const a=$('#app').getBoundingClientRect(), st=$('#stage').getBoundingClientRect(), top=$('#top').getBoundingClientRect();
    l=Math.max(0,Math.round(st.left-a.left)); r=Math.max(0,Math.round(a.right-st.right)); t=Math.max(0,Math.round(st.top-top.bottom)); }
  if(l===OVR.l && r===OVR.r && t===OVR.t) return;
  OVR.l=l; OVR.r=r; OVR.t=t; const st=$('#stage'); st.style.setProperty('--ovr-l', l+'px'); st.style.setProperty('--ovr-r', r+'px'); st.style.setProperty('--ovr-t', t+'px');
  resize(); if(ws==='struct'){ ST.fitted=false; stResize(); }
}
function resetLayout(){
  LAYOUT={}; saveLayout();
  setEdOpen(edHadSel);
  for(const [id] of FLOATS){ const el=$('#'+id); if(el){ applyLayout(id); clearPos(el); el.classList.remove('collapsed'); } }
  clearPos($('#demo')); if(ws==='mech') buildJointLabels(); if(!$('#bubble').hidden) placeBubble(BUB.x,BUB.y); applyDock(); applyViewOffset(); if(ws==='struct'){ ST.fitted=false; stResize(); }
  toast('Disposition des panneaux réinitialisée.');
}
