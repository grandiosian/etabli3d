
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
function finishSelRect(R, ev){
  $('#selRect').hidden=true; orbit.enabled=true;
  const st=stage.getBoundingClientRect(); const x0=Math.min(R.x0,ev.clientX)-st.left, x1=Math.max(R.x0,ev.clientX)-st.left, y0=Math.min(R.y0,ev.clientY)-st.top, y1=Math.max(R.y0,ev.clientY)-st.top;
  if(x1-x0<4 && y1-y0<4){ if(!R.add && selection.length){ selection=[]; sync(); renderInspector(); } return; }
  const ids=[]; for(const p of state.parts){ const r=meshes.get(p.id); if(!r || !r.mesh.visible || isLocked(p)) continue;
    const c=toStage(_hb.setFromObject(r.mesh).getCenter(_hc)); if(c.x>=x0 && c.x<=x1 && c.y>=y0 && c.y<=y1) ids.push(p.id); }
  selection= R.add? [...new Set([...selection, ...ids])] : ids; sync(); renderInspector();
  if(ids.length) toast(`${ids.length} pièce${ids.length>1?'s':''} sélectionnée${ids.length>1?'s':''}${ids.length>1?' : vous pouvez les grouper (Ctrl+G).':'.'}`);
}

/* ---- left button preference + right-click menu */
const LMB=[['select','Sélection par cadre','selbox','Glisser dans le vide trace un cadre de sélection. Tourner la vue : clic droit + glisser.'],
  ['orbit','Tourner la vue (orbite)','orbit','Glisser dans le vide fait tourner la vue. Décaler : clic droit + glisser.'],
  ['pan','Décaler la vue (panoramique)','hand','Glisser dans le vide décale la vue. Tourner : clic droit + glisser.']];
function applyLmb(){
  const M=THREE.MOUSE, L=prefs.lmb||'orbit';
  orbit.mouseButtons= L==='pan'? {LEFT:M.PAN, MIDDLE:M.DOLLY, RIGHT:M.ROTATE} : L==='select'? {LEFT:M.ROTATE, MIDDLE:M.PAN, RIGHT:M.ROTATE} : {LEFT:M.ROTATE, MIDDLE:M.PAN, RIGHT:M.PAN};
  const b=$('#lmbBtn'); if(b){ const e=LMB.find(x=>x[0]===L); b.innerHTML=''; b.append(svgIcon('mouse'), h('span',{class:'lab'}, e[1].replace(/ \(.*\)/,''))); b.title=`Clic gauche dans le vide : ${e[1].toLowerCase()}. ${e[3]} (clic droit dans la vue pour changer)`; }
}
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
  const v=$('#views'); if(v){ const b=h('button',{class:'btn ghost',id:'lmbBtn',onclick:()=>{ if(!$('#ctxMenu').hidden) return closeCtxMenu(); const r=b.getBoundingClientRect(), st=stage.getBoundingClientRect(); openCtxMenu(r.left-st.left-230, r.bottom-st.top+4); }}); v.append(b); }
  applyLmb();
})();
