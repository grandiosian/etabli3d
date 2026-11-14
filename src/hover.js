
/* =========================================================
   Survol et manipulation des pièces dans la vue 3D
   - survol : liseré autour de la pièce, son nom, pièce grisée (rien d'autre : les poignées
     apparaissent au clic, voir gizmo.js) ;
   - clic droit sans glisser : menu (préférence du clic gauche dans le vide, Tout voir…) ;
   - sélection par cadre : Maj + glisser dans le vide (ou toujours, en mode « Sélection »).
   ========================================================= */
const HOV={id:null, ev:null, dirty:false, overTools:false, leftAt:0};
const HOV_GREY=new THREE.Color('#9aa3a0');
/* outline: the part drawn again from behind, pushed out by a few pixels along smoothed normals */
const hullMat=new THREE.ShaderMaterial({
  uniforms:{ color:{value:new THREE.Color('#1d7656')}, w:{value:3}, res:{value:new THREE.Vector2(1,1)} },
  vertexShader:`uniform float w; uniform vec2 res;
    void main(){ vec4 c=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      vec4 cn=projectionMatrix*vec4(normalize(normalMatrix*normal),0.0); vec2 d=cn.xy; float l=length(d); if(l>1e-6) d/=l;
      c.xy+=d*w*2.0/res*c.w; gl_Position=c; }`,
  fragmentShader:`uniform vec3 color; void main(){ gl_FragColor=vec4(color,1.0); }`,
  side:THREE.BackSide });
const hull=new THREE.Mesh(new THREE.BufferGeometry(), hullMat); hull.matrixAutoUpdate=false; hull.visible=false; hull.frustumCulled=false; scene.add(hull);
const hullCache=new WeakMap();
function hullGeo(g){ let hg=hullCache.get(g); if(hg) return hg;
  const c=new THREE.BufferGeometry(); c.setAttribute('position', g.attributes.position.clone()); if(g.index) c.setIndex(g.index.clone());
  hg=mergeVertices(c, 1e-3); hg.computeVertexNormals(); hullCache.set(g,hg); return hg; }
const _hb=new THREE.Box3(), _hc=new THREE.Vector3();
function screenRectOf(obj){ _hb.setFromObject(obj); let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(let i=0;i<8;i++){ _hc.set(i&1?_hb.max.x:_hb.min.x, i&2?_hb.max.y:_hb.min.y, i&4?_hb.max.z:_hb.min.z); const p=toStage(_hc); x0=Math.min(x0,p.x); x1=Math.max(x1,p.x); y0=Math.min(y0,p.y); y1=Math.max(y1,p.y); }
  return {x0,y0,x1,y1}; }

function hoverSet(id){
  if(HOV.id===id) return;
  const r=HOV.id!=null && meshes.get(HOV.id), p=HOV.id!=null && findPart(HOV.id);
  if(r && p && !p.hole) r.mesh.material.color.set(p.color);   // no longer greyed
  hull.visible=false; $('#hovName').hidden=true;
  HOV.id=id; if(id!=null) hullMat.uniforms.color.value.set(cssVar('--accent')||'#1d7656');
}
function hoverActive(){ return ['model','check','mech'].includes(ws) && $('#sk').hidden && !(down && (down.drag||down.rect)) && !tc.dragging && !TG.drag && !RMB.down && $('#ctxMenu').hidden; }
function hoverTick(){
  if(!hoverActive()){ if(HOV.id!=null && !HOV.overTools) hoverSet(null); return; }
  if(HOV.dirty && HOV.ev && !HOV.overTools){ HOV.dirty=false; const hit=pickAt(HOV.ev); hoverSet(hit? hit.object.userData.id : null); }
  if(!HOV.ev && !HOV.overTools && HOV.id!=null && performance.now()-HOV.leftAt>160) hoverSet(null);
  const id=HOV.id; if(id==null) return; const r=meshes.get(id), p=findPart(id);
  if(!r || !p || !r.mesh.visible){ hoverSet(null); return; }
  if(!p.hole) r.mesh.material.color.set(p.color).lerp(HOV_GREY, 0.5);   // greyed while hovered
  r.mesh.updateWorldMatrix(true,false); hull.geometry=hullGeo(r.mesh.geometry); hull.matrix.copy(r.mesh.matrixWorld); hull.matrixWorld.copy(r.mesh.matrixWorld); hull.visible=true;
  renderer.getSize(hullMat.uniforms.res.value);
  const R=screenRectOf(r.mesh), cx=(R.x0+R.x1)/2, cy=(R.y0+R.y1)/2;
  const nm=$('#hovName'); nm.textContent= p.name + (p.hole? ' · perçage' : '') + (isLocked(p)? ' · verrouillée' : '');
  nm.hidden=false; nm.style.transform=`translate(${Math.round(clamp(cx,60,STG.w-60))}px,${Math.round(Math.max(26,R.y0-8))}px) translate(-50%,-100%)`;
}
(()=>{ const cv=renderer.domElement;
  cv.addEventListener('pointermove', ev=>{ HOV.ev={clientX:ev.clientX, clientY:ev.clientY}; HOV.dirty=true; }, {passive:true});
  cv.addEventListener('pointerleave', ()=>{ HOV.ev=null; HOV.leftAt=performance.now(); });
})();

/* ---- rectangle selection */
function drawSelRect(R, ev){
  const el=$('#selRect'), st=stage.getBoundingClientRect();
  const x0=Math.min(R.x0,ev.clientX)-st.left, y0=Math.min(R.y0,ev.clientY)-st.top, w=Math.abs(ev.clientX-R.x0), hh=Math.abs(ev.clientY-R.y0);
  if(w<4 && hh<4) return; el.hidden=false; el.style.cssText=`left:${x0}px;top:${y0}px;width:${w}px;height:${hh}px`;
}
function partInRect(mesh, x0,y0,x1,y1, st){
  const R=screenRectOf(mesh); if(R.x1<x0 || R.x0>x1 || R.y1<y0 || R.y0>y1) return false;   // its box does not even touch the frame
  if(R.x0>=x0 && R.x1<=x1 && R.y0>=y0 && R.y1<=y1) return true;                          // wholly inside
  const pos=mesh.geometry.attributes.position, n=pos.count, step=Math.max(1, Math.floor(n/600));   // one of its points inside?
  mesh.updateWorldMatrix(true,false);
  for(let i=0;i<n;i+=step){ _hc.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld); const q=toStage(_hc); if(q.x>=x0 && q.x<=x1 && q.y>=y0 && q.y<=y1) return true; }
  // or the frame lies on one of its faces: try rays through a grid of points of the frame
  for(let i=0;i<=4;i++) for(let j=0;j<=4;j++){ const ev={clientX:st.left+x0+(x1-x0)*i/4, clientY:st.top+y0+(y1-y0)*j/4};
    if(pickAll(ev).some(hh=>hh.object===mesh)) return true; }
  return false;
}
function finishSelRect(R, ev){
  $('#selRect').hidden=true; orbit.enabled=true;
  const st=stage.getBoundingClientRect(); const x0=Math.min(R.x0,ev.clientX)-st.left, x1=Math.max(R.x0,ev.clientX)-st.left, y0=Math.min(R.y0,ev.clientY)-st.top, y1=Math.max(R.y0,ev.clientY)-st.top;
  if(x1-x0<4 && y1-y0<4){ if(!R.add && selection.length){ selection=[]; sync(); renderInspector(); } return; }
  // a part is taken as soon as any piece of it is inside the frame
  const ids=[]; for(const p of state.parts){ const r=meshes.get(p.id); if(!r || !r.mesh.visible || isLocked(p) || !editable(p)) continue;
    if(partInRect(r.mesh, x0,y0,x1,y1, st)) ids.push(p.id); }
  selection= R.add? [...new Set([...selection, ...ids])] : ids; sync(); renderInspector();
  if(ids.length) toast(`${ids.length} pièce${ids.length>1?'s':''} sélectionnée${ids.length>1?'s':''}${ids.length>1?' : vous pouvez les grouper (Ctrl+G).':'.'}`);
}

/* ---- left button preference + right-click menu */
const LMB=[['select','Sélection par cadre','selbox','Glisser dans le vide trace un cadre de sélection. Tourner la vue : Alt + glisser ; décaler : Espace + glisser.'],
  ['orbit','Tourner la vue (orbite)','orbit','Glisser dans le vide fait tourner la vue. Alt + glisser : tourner ; Espace + glisser : décaler.'],
  ['pan','Décaler la vue (panoramique)','hand','Glisser dans le vide décale la vue. Alt + glisser : tourner ; Espace + glisser : décaler.']];
function applyLmb(){
  const M=THREE.MOUSE, L=prefs.lmb||'orbit';
  orbit.mouseButtons= L==='pan'? {LEFT:M.PAN, MIDDLE:M.DOLLY, RIGHT:M.ROTATE} : L==='select'? {LEFT:M.ROTATE, MIDDLE:M.PAN, RIGHT:M.ROTATE} : {LEFT:M.ROTATE, MIDDLE:M.PAN, RIGHT:M.PAN};
  const b=$('#lmbBtn'); if(b){ const e=LMB.find(x=>x[0]===L); b.innerHTML=''; b.append(svgIcon('mouse'), h('span',{class:'lab'}, e[1].replace(/ \(.*\)/,''))); b.title=`Clic gauche dans le vide : ${e[1].toLowerCase()}. ${e[3]} (clic droit dans la vue pour changer)`; }
}
/* navigation au clavier + souris : Alt + clic gauche = tourner la vue, Espace + clic gauche = décaler la vue (partout dans la vue 3D) */
/* barre de navigation (tactile) : NAV.lock = 'orbit' | 'pan' | 'zoom' fixe ce que fait le glisser (doigt ou clic gauche), même sur une pièce */
const NAV={space:false, alt:false, lock:null};
function navKeys(){ const M=THREE.MOUSE, T=THREE.TOUCH;
  if(NAV.space) orbit.mouseButtons={...orbit.mouseButtons, LEFT:M.PAN}; else if(NAV.alt) orbit.mouseButtons={...orbit.mouseButtons, LEFT:M.ROTATE};
  else if(NAV.lock==='orbit'||NAV.lock==='pan'){ applyLmb(); orbit.mouseButtons={...orbit.mouseButtons, LEFT: NAV.lock==='pan'? M.PAN : M.ROTATE}; }
  else applyLmb();
  orbit.touches={ONE: NAV.lock==='pan'? T.PAN : T.ROTATE, TWO:T.DOLLY_PAN};
  renderer.domElement.style.cursor= NAV.space||NAV.alt||NAV.lock==='orbit'||NAV.lock==='pan'? 'grab' : NAV.lock==='zoom'? 'zoom-in' : ''; }
function setNavLock(k){ NAV.lock= NAV.lock===k? null : k; $$('#navBar [data-nav]').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.nav===NAV.lock))); navKeys(); }
/* rapprocher (f < 1) ou éloigner (f > 1) la caméra de la cible ; en orthographique la largeur vue suit la distance */
function zoomBy(f){ const off=camera.position.clone().sub(orbit.target); const d=clamp(off.length()*f, 5, 15000); camera.position.copy(orbit.target).add(off.setLength(d)); orbit.update(); }
function navShown(){ return prefs.nav==='show' || (prefs.nav!=='hide' && (matchMedia('(any-pointer: coarse)').matches || navigator.maxTouchPoints>0)); }
function applyNavBar(){ $('#navBar')?.classList.toggle('nav-off', !navShown()); if(!navShown() && NAV.lock) setNavLock(NAV.lock); }
(()=>{ const cv=renderer.domElement; let zd=null;
  cv.addEventListener('pointerdown', ev=>{ if(NAV.lock!=='zoom' || (ev.pointerType==='mouse' && ev.button!==0) || !ev.isPrimary) return;
    orbit.enabled=false; zd={y:ev.clientY, off:camera.position.clone().sub(orbit.target)}; cv.setPointerCapture(ev.pointerId); }, true);
  cv.addEventListener('pointermove', ev=>{ if(!zd) return; const f=Math.exp((ev.clientY-zd.y)*0.006); const d=clamp(zd.off.length()*f, 5, 15000); camera.position.copy(orbit.target).add(zd.off.clone().setLength(d)); });
  const end=()=>{ if(zd){ zd=null; orbit.enabled=true; } }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  $$('#navBar [data-nav]').forEach(b=>b.onclick=()=>setNavLock(b.dataset.nav));
  $$('#navBar [data-zoom]').forEach(b=>b.onclick=()=>zoomBy(+b.dataset.zoom));
  $('#orthoBtn').onclick=()=>setOrtho(camera!==camO);
})();
function navTarget(e){ return $('#sk').hidden && $('#gallery').hidden && $('#help').hidden && !e.target.closest?.('input,textarea,select,[contenteditable]'); }
document.addEventListener('keydown', e=>{ if(!navTarget(e)) return;
  if(e.key===' '){ e.preventDefault(); if(!NAV.space){ NAV.space=true; navKeys(); } }
  else if(e.key==='Alt'){ e.preventDefault(); if(!NAV.alt){ NAV.alt=true; navKeys(); } } });
document.addEventListener('keyup', e=>{ if(e.key===' ' && NAV.space){ e.preventDefault(); NAV.space=false; navKeys(); } if(e.key==='Alt' && NAV.alt){ e.preventDefault(); NAV.alt=false; navKeys(); } });
window.addEventListener('blur', ()=>{ if(NAV.space||NAV.alt){ NAV.space=NAV.alt=false; navKeys(); } });
function setLmb(k){ prefs.lmb=k; savePrefs(); applyLmb(); closeCtxMenu(); const e=LMB.find(x=>x[0]===k); toast(`Clic gauche : ${e[1].toLowerCase()}. ${e[3]}`); if(ws==='model') renderInspector(); }
const RMB={down:null};
function closeCtxMenu(){ $('#ctxMenu').hidden=true; }
function openCtxMenu(x, y){   // stage coordinates
  const m=$('#ctxMenu'); m.innerHTML=''; const L=prefs.lmb||'orbit';
  m.append(h('h5',{},'Clic gauche dans le vide'));
  for(const [k,l,ic] of LMB) m.append(h('button',{role:'menuitemradio','aria-checked':String(L===k),onclick:()=>setLmb(k)}, svgIcon(ic), h('span',{},l)));
  m.append(h('hr'));
  const id=HOV.id ?? (selection.length===1? selection[0] : null), p=id!=null && findPart(id);
  if(ws==='model' && state.edit) m.append(h('button',{role:'menuitem',onclick:()=>{ closeCtxMenu(); finishGroupEdit(); }}, svgIcon('check'), h('span',{},'Sortir du groupe')), h('hr'));
  else if(ws==='model' && p && p.kind==='group' && !isLocked(p) && !simLocked()) m.append(h('button',{role:'menuitem',onclick:()=>{ closeCtxMenu(); enterGroupEdit(p.id); }}, svgIcon('group'), h('span',{},`Modifier l’intérieur de « ${p.name} »`)), h('hr'));
  m.append(h('button',{role:'menuitem',onclick:()=>{ closeCtxMenu(); setView('fit'); }}, svgIcon('fit'), h('span',{},'Tout voir')));
  hydrateIcons(m); m.hidden=false;
  const w=m.offsetWidth, hh=m.offsetHeight; m.style.left=clamp(x,4,STG.w-w-4)+'px'; m.style.top=clamp(y,4,STG.h-hh-4)+'px';
}
(()=>{ const cv=renderer.domElement;
  cv.addEventListener('contextmenu', e=>e.preventDefault());
  cv.addEventListener('pointerdown', ev=>{ if(ev.button===2) RMB.down={x:ev.clientX,y:ev.clientY}; });
  window.addEventListener('pointerup', ev=>{ if(ev.button!==2 || !RMB.down) return; const d=RMB.down; RMB.down=null;
    if(Math.hypot(ev.clientX-d.x, ev.clientY-d.y)<5 && ev.target===cv){ const [x,y]=evStage(ev); openCtxMenu(x,y); } });
  document.addEventListener('pointerdown', e=>{ if(!$('#ctxMenu').hidden && !e.target.closest('#ctxMenu,#lmbBtn')) closeCtxMenu(); }, true);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeCtxMenu(); });
  const v=$('#views .vc-wrap'); if(v){ const b=h('button',{class:'vc-b vc-br',id:'lmbBtn',onclick:()=>{ if(!$('#ctxMenu').hidden) return closeCtxMenu(); const r=b.getBoundingClientRect(), st=stage.getBoundingClientRect(); openCtxMenu(r.left-st.left-230, r.bottom-st.top+4); }}); v.append(b); }
  applyLmb();
})();
