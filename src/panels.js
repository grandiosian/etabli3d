
/* =========================================================
   Panneaux mobiles : chaque panneau flottant de la vue a une poignée
   (glisser pour le déplacer) et un bouton pour le réduire. Le panneau
   latéral se réduit et change de côté ; la barre des formes se réduit.
   La disposition est mémorisée dans ce navigateur.
   ========================================================= */
const LAYOUT_KEY='etabli3d.layout';
let LAYOUT=(()=>{ try{ return JSON.parse(localStorage.getItem(LAYOUT_KEY)||'{}')||{}; }catch(e){ return {}; } })();
function saveLayout(){ try{ localStorage.setItem(LAYOUT_KEY, JSON.stringify(LAYOUT)); }catch(e){} }
const FLOATS=[['tools','Outils'],['views','Vues'],['snapBox','Grille'],['simbar','Simulation'],['stTools','Outils de structure'],['stLegendBox','Légende']];
const movedDemo=()=> !!LAYOUT.demo && LAYOUT.demo.x!=null;

function setPos(el,x,y){ el.style.left=x+'px'; el.style.top=y+'px'; el.style.right='auto'; el.style.bottom='auto'; el.style.transform='none'; }
function clearPos(el){ for(const k of ['left','top','right','bottom','transform']) el.style[k]=''; }
function applyLayout(id){
  const el=$('#'+id); if(!el) return; const L=LAYOUT[id];
  if(L && L.x!=null){ const st=$('#stage').getBoundingClientRect(); if(st.width>2){ const w=el.offsetWidth||80, hh=el.offsetHeight||30; setPos(el, clamp(L.x,0,Math.max(0,st.width-Math.min(w,st.width))), clamp(L.y,0,Math.max(0,st.height-Math.min(hh,st.height)))); } }
  else clearPos(el);
  if(id!=='demo') el.classList.toggle('collapsed', !!L?.c);
}
function startPanelDrag(e, el, id){
  if(e.button!==0 || e.target.closest('button,select,input')) return;
  e.preventDefault(); e.stopPropagation();
  const st=$('#stage').getBoundingClientRect(), r=el.getBoundingClientRect(); const ox=e.clientX-r.left, oy=e.clientY-r.top;
  el.classList.add('dragging');
  const move=ev=>{ setPos(el, clamp(ev.clientX-st.left-ox,0,Math.max(0,st.width-r.width)), clamp(ev.clientY-st.top-oy,0,Math.max(0,st.height-r.height))); };
  const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); el.classList.remove('dragging');
    const rr=el.getBoundingClientRect(); LAYOUT[id]={...LAYOUT[id], x:Math.round(rr.left-st.left), y:Math.round(rr.top-st.top)}; saveLayout();
    if(id==='bubble') el.dataset.side='';
    if(id==='demo'){ applyViewOffset(); if(ws==='struct'){ ST.fitted=false; stFit(); stDraw(); } } };
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
}
function togglePanel(id){ LAYOUT[id]={...LAYOUT[id], c:!LAYOUT[id]?.c}; saveLayout(); applyLayout(id); }
function gripFor(id, title, withMin=true){
  const g=h('div',{class:'pgrip',title:`Glisser pour déplacer : ${title}`}, svgIcon('dots'),
    withMin? h('button',{class:'pmin',title:'Réduire ou agrandir','aria-label':`Réduire ou agrandir : ${title}`,onclick:e=>{ e.stopPropagation(); togglePanel(id); }}, svgIcon('chevUp')) : null);
  g.addEventListener('pointerdown',e=>startPanelDrag(e, $('#'+id), id));
  return g;
}
function initPanels(){
  for(const [id,title] of FLOATS){ const el=$('#'+id); if(!el) continue; el.classList.add('pfloat'); el.prepend(gripFor(id,title)); applyLayout(id); }
  $('#inspSide').onclick=()=>{ LAYOUT.inspLeft=!LAYOUT.inspLeft; saveLayout(); applyDock(); };
  $('#inspMin').onclick=()=>{ LAYOUT.inspMin=!LAYOUT.inspMin; saveLayout(); applyDock(); };
  $('#rackMin').onclick=()=>{ LAYOUT.rackMin=!LAYOUT.rackMin; saveLayout(); applyDock(); };
  applyDock();
  new ResizeObserver(()=>{ for(const [id] of FLOATS) if(LAYOUT[id]?.x!=null) applyLayout(id); if(movedDemo()) applyLayout('demo'); }).observe($('#stage'));
}
function applyDock(){
  const app=$('#app'); app.classList.toggle('insp-left', !!LAYOUT.inspLeft); app.classList.toggle('insp-min', !!LAYOUT.inspMin); app.classList.toggle('rack-min', !!LAYOUT.rackMin);
  $('#inspMin').title= LAYOUT.inspMin? 'Agrandir le panneau' : 'Réduire le panneau';
  $('#inspSide').title= LAYOUT.inspLeft? 'Placer le panneau à droite' : 'Placer le panneau à gauche';
  $('#rackMin').title= LAYOUT.rackMin? 'Agrandir la barre des formes' : 'Réduire la barre des formes';
}
function resetLayout(){
  LAYOUT={}; saveLayout();
  for(const [id] of FLOATS){ const el=$('#'+id); if(el){ clearPos(el); el.classList.remove('collapsed'); } }
  clearPos($('#demo')); if(!$('#bubble').hidden) placeBubble(BUB.x,BUB.y); applyDock(); applyViewOffset(); if(ws==='struct'){ ST.fitted=false; stResize(); }
  toast('Disposition des panneaux réinitialisée.');
}
