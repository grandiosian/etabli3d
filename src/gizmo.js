
/* =========================================================
   Poignées de la sélection (à la manière de Tinkercad), atelier Modéliser
   - cadre pointillé au sol, autour de la boîte de la pièce ;
   - carrés blancs aux coins : largeur et longueur ensemble (Maj : garder les proportions) ;
   - petits carrés noirs au milieu des côtés : une seule cote ;
   - carré blanc en haut : hauteur ; cône noir au-dessus : soulever la pièce ;
   - flèches courbes : tourner autour d'un axe, avec un rapporteur gradué tous les 15° (Maj : 1°) ;
   - cotes affichées au survol d'une poignée de taille : cliquez une cote pour taper la valeur.
   Glisser la pièce elle-même la déplace sur le sol (scene.js).
   + Modifier l'intérieur d'un groupe : les pièces du groupe redeviennent séparées, le reste
     de la scène est estompé ; « Terminer » recalcule le groupe (perçages compris).
   ========================================================= */
const TG={drag:null, dimUntil:0, el:null, ring:null, ticks:null};
const TG_BASE=[[-1,-1],[1,-1],[1,1],[-1,1]];
const TG_EDGE=[[0,-1],[1,0],[0,1],[-1,0]];
const _tv=new THREE.Vector3(), _tw=new THREE.Vector3();

function tgBuild(){
  const root=h('div',{id:'tg',hidden:true});
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('class','tg-lines');
  svg.innerHTML='<path class="tg-base"/><path class="tg-axes"/><path class="tg-dim"/><path class="tg-snap"/>'; root.append(svg);
  const mk=(cls,data,title,html='')=>{ const e=h('div',{class:'tg-h '+cls,title,...data,html}); root.append(e); return e; };
  TG.corners=TG_BASE.map((s,i)=>mk('tg-corner',{'data-k':'c'+i},'Tirer pour changer la longueur et la largeur (Maj : garder les proportions)'));
  TG.edges=TG_EDGE.map((s,i)=>mk('tg-edge',{'data-k':'e'+i},'Tirer pour changer cette cote'));
  TG.top=mk('tg-corner',{'data-k':'top'},'Tirer pour changer la hauteur');
  TG.lift=mk('tg-lift',{'data-k':'lift'},'Tirer pour soulever ou descendre la pièce','<svg viewBox="0 0 16 16"><path d="M8 2 13 12H3z" fill="currentColor"/></svg>');
  const arc='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 15.5a8.5 8.5 0 0 1 15 0"/><path d="M3 11.5l1.5 4.2 4.2-1.4M21 11.5l-1.5 4.2-4.2-1.4"/></svg>';
  TG.rot={x:mk('tg-rot',{'data-k':'rx'},'Tourner autour de l’axe X (rouge)',arc), y:mk('tg-rot',{'data-k':'ry'},'Tourner autour de l’axe Y (vert)',arc), z:mk('tg-rot',{'data-k':'rz'},'Tourner autour de l’axe vertical Z (bleu)',arc)};
  TG.dims={x:h('button',{class:'tg-dimv','data-a':'x'}), y:h('button',{class:'tg-dimv','data-a':'y'}), z:h('button',{class:'tg-dimv','data-a':'z'})};
  for(const b of Object.values(TG.dims)){ root.append(b); b.onclick=()=>tgEditDim(b.dataset.a); b.addEventListener('pointerenter',()=>{ TG.dimUntil=performance.now()+4000; }); }
  TG.ang=h('div',{class:'tg-ang',hidden:true}); root.append(TG.ang);
  TG.svg=svg; TG.el=root; $('#stage').append(root);
  for(const e of root.querySelectorAll('.tg-h')){
    e.addEventListener('pointerdown', ev=>tgStart(ev, e.dataset.k));
    if(/^(c|e)\d$|^top$/.test(e.dataset.k)) e.addEventListener('pointerenter', ()=>{ TG.dimUntil=performance.now()+4000; });
  }
  // the protractor shown while turning
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.82,1,96), new THREE.MeshBasicMaterial({color:0x3d8bd0, transparent:true, opacity:.28, side:THREE.DoubleSide, depthTest:false}));
  const tk=[]; for(let i=0;i<24;i++){ const a=i/24*Math.PI*2, r0= i%6? 0.86 : 0.78; tk.push(Math.cos(a)*r0,Math.sin(a)*r0,0, Math.cos(a),Math.sin(a),0); }
  const tg=new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tk,3));
  const ticks=new THREE.LineSegments(tg, new THREE.LineBasicMaterial({color:0x2c6fa8, transparent:true, opacity:.8, depthTest:false}));
  const needle=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(1.05,0,0)]), new THREE.LineBasicMaterial({color:0xd64035, depthTest:false}));
  TG.ring=new THREE.Group(); TG.ring.add(ring, ticks, needle); TG.needle=needle; TG.ring.visible=false; TG.ring.renderOrder=20; scene.add(TG.ring);
}

/* frame of the selection: one part → its own box and axes; several → the box around them */
function tgFrame(){
  const ps=selParts(); if(!ps.length) return null;
  if(ps.length===1){ const r=meshes.get(ps[0].id); if(!r) return null; const g=r.mesh.geometry; if(!g.boundingBox) g.computeBoundingBox();
    r.mesh.updateMatrixWorld(true); return {single:true, p:ps[0], M:r.mesh.matrixWorld.clone(), b:g.boundingBox.clone()}; }
  const b=selBox(); if(b.isEmpty()) return null; return {single:false, M:new THREE.Matrix4(), b};
}
const tgW=(F,x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(F.M);
function tgVisible(){ return ws==='model' && selection.length && $('#sk').hidden && !simLocked() && !pickMode && !selParts().some(isLocked) && !(down && down.rect); }
function tgPlace(el, p, show=true){ el.hidden=!show || !p.vis; if(!el.hidden) el.style.transform=`translate(${Math.round(p.x)}px,${Math.round(p.y)}px) translate(-50%,-50%)`; }
function tgTick(){
  if(!TG.el) tgBuild();
  const F= tgVisible()? tgFrame() : null;
  TG.el.hidden=!F; if(!F){ TG.ring.visible=false; return; }
  const b=F.b, cx=(b.min.x+b.max.x)/2, cy=(b.min.y+b.max.y)/2, z0=b.min.z, z1=b.max.z;
  const X=[b.min.x,b.max.x], Y=[b.min.y,b.max.y], S=(x,y,z)=>toStage(tgW(F,x,y,z));
  const base=TG_BASE.map(([sx,sy])=>S(X[(sx+1)/2],Y[(sy+1)/2],z0));
  TG.svg.querySelector('.tg-base').setAttribute('d', 'M'+base.map(p=>`${p.x},${p.y}`).join('L')+'Z');
  const c0=S(cx,cy,z0), cT=S(cx,cy,z1), mids=TG_EDGE.map(([sx,sy])=>S(sx? X[(sx+1)/2]:cx, sy? Y[(sy+1)/2]:cy, z0));
  TG.svg.querySelector('.tg-axes').setAttribute('d', `M${mids[0].x},${mids[0].y}L${mids[2].x},${mids[2].y}M${mids[1].x},${mids[1].y}L${mids[3].x},${mids[3].y}M${c0.x},${c0.y}L${cT.x},${cT.y}`);
  const scal= F.single && !!SCALE_MAP[F.p.kind];
  TG.corners.forEach((e,i)=>tgPlace(e, base[i], scal)); TG.edges.forEach((e,i)=>tgPlace(e, mids[i], scal)); tgPlace(TG.top, cT, scal);
  tgPlace(TG.lift, {x:cT.x, y:cT.y-26, vis:cT.vis});
  // rotation arrows on the edges nearest to the camera, pushed a little outside the box
  const cam=camera.position, near=(a,b2)=>tgW(F,...a).distanceTo(cam) < tgW(F,...b2).distanceTo(cam);
  const fy= near([cx,Y[0],z1],[cx,Y[1],z1])? Y[0] : Y[1], fx= near([X[0],cy,z1],[X[1],cy,z1])? X[0] : X[1];
  const cc=S(cx,cy,(z0+z1)/2), out=(p,d=30)=>{ const vx=p.x-cc.x, vy=p.y-cc.y, l=Math.hypot(vx,vy)||1; return {x:p.x+vx/l*d, y:p.y+vy/l*d, vis:p.vis}; };
  tgPlace(TG.rot.x, out(S(cx,fy,z1))); tgPlace(TG.rot.y, out(S(fx,cy,z1)));
  const cornerZ=[[X[1],fy],[X[0],fy]].map(([x,y])=>S(x,y,z0)).sort((a,c)=>c.x-a.x)[0]; tgPlace(TG.rot.z, out(cornerZ,26));
  // dimensions
  const showDim= scal && (performance.now()<TG.dimUntil || (TG.drag && TG.drag.kind==='scale') || TG.editing);
  let dpath='';
  if(showDim){ const sz=new THREE.Vector3().subVectors(b.max,b.min), o=Math.max(4, 0.18*Math.max(sz.x,sz.y));
    const ox= fx===X[1]? 1 : -1, oy= fy===Y[0]? -1 : 1;
    const ax=S(X[0],fy+oy*o,z0), bx=S(X[1],fy+oy*o,z0), ay=S(fx+ox*o,Y[0],z0), by=S(fx+ox*o,Y[1],z0), az=S(fx+ox*o,fy+oy*o,z0), bz=S(fx+ox*o,fy+oy*o,z1);
    for(const [a,c] of [[ax,bx],[ay,by],[az,bz]]) dpath+=`M${a.x},${a.y}L${c.x},${c.y}`;
    const lab=(el,a,c,v)=>{ if(TG.editing===el.dataset.a) return; el.textContent=fmt(v,2); tgPlace(el,{x:(a.x+c.x)/2, y:(a.y+c.y)/2, vis:a.vis&&c.vis}); };
    lab(TG.dims.x,ax,bx,sz.x); lab(TG.dims.y,ay,by,sz.y); lab(TG.dims.z,az,bz,sz.z);
  } else for(const e of Object.values(TG.dims)) if(TG.editing!==e.dataset.a) e.hidden=true;
  TG.svg.querySelector('.tg-dim').setAttribute('d', dpath);
  TG.svg.querySelector('.tg-snap').setAttribute('d', SNAPSEG.map(([a,c])=>{ const p=toStage(a), q=toStage(c); return `M${p.x},${p.y}L${q.x},${q.y}`; }).join(''));   // smart-snap guides
  if(TG.drag?.kind==='rot'){ const d=TG.drag, a=d.as||0; const tip=toStage(d.c.clone().add(d.u.clone().multiplyScalar(Math.cos(a)*d.R*1.15)).add(d.v.clone().multiplyScalar(Math.sin(a)*d.R*1.15)));
    TG.ang.hidden=false; TG.ang.textContent=`${Math.round(a/DEG)}°`; TG.ang.style.transform=`translate(${Math.round(tip.x)}px,${Math.round(tip.y)}px) translate(-50%,-50%)`; }
  else TG.ang.hidden=true;
}

/* ---- dragging a handle */
function tgRay(ev){ const r=renderer.domElement.getBoundingClientRect(); ndc.set(((ev.clientX-r.left)/r.width)*2-1, -((ev.clientY-r.top)/r.height)*2+1); ray.setFromCamera(ndc,camera); return ray.ray; }
function tgHit(ev, plane){ const p=new THREE.Vector3(); return tgRay(ev).intersectPlane(plane,p)? p : null; }
function tgFacingPlane(axis, through){ const d=camera.position.clone().sub(through); d.addScaledVector(axis, -d.dot(axis)); if(d.lengthSq()<1e-9) d.set(0,-1,0); return new THREE.Plane().setFromNormalAndCoplanarPoint(d.normalize(), through); }
function tgStart(ev, k){
  if(ev.button!==0) return; ev.preventDefault(); ev.stopPropagation();
  const F=tgFrame(); if(!F) return; const b=F.b;
  const snap=()=>+$('#snapSel').value||0;
  const items=selParts().map(p=>({p, pos:[...p.pos], rot:[...p.rot], params:clone(p.params), M:partMatrix(p)}));
  let d={k, F, items, ev0:ev, moved:false};
  if(k==='lift'){ const c=tgW(F,(b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,b.max.z); d.kind='lift'; d.plane=tgFacingPlane(new THREE.Vector3(0,0,1), c); d.h0=tgHit(ev,d.plane); }
  else if(k[0]==='r'){ const ax=k[1], i='xyz'.indexOf(ax); const R=new THREE.Matrix4().extractRotation(F.M); const axis=new THREE.Vector3().setFromMatrixColumn(R,i).normalize();
    const c=new THREE.Vector3((b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2).applyMatrix4(F.M);
    const u=new THREE.Vector3().setFromMatrixColumn(R,(i+1)%3).normalize(), v=new THREE.Vector3().crossVectors(axis,u);
    const Rr=new THREE.Vector3().subVectors(b.max,b.min).length()*0.62+2;
    d.kind='rot'; d.axis=axis; d.c=c; d.u=u; d.v=v; d.R=Rr; d.ang=0; d.plane=new THREE.Plane().setFromNormalAndCoplanarPoint(axis,c); d.h0=tgHit(ev,d.plane);
    TG.ring.position.copy(c); TG.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), axis); TG.ring.scale.setScalar(Rr); TG.ring.visible=true;
    TG.ring.children[0].material.color.set(axisColors()[ax]); TG.needle.rotation.z=0;
    // the needle starts along u: turn the group so its local x matches u
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0).applyQuaternion(TG.ring.quaternion), u); TG.ring.quaternion.premultiply(q); }
  else { if(!F.single || !SCALE_MAP[F.p.kind]) return;
    const s= k==='top'? [0,0,1] : k[0]==='c'? [...TG_BASE[+k[1]],0] : [...TG_EDGE[+k[1]],0];
    d.kind='scale'; d.s=s; d.b0=b.clone(); d.Minv=F.M.clone().invert(); d.R=new THREE.Matrix4().extractRotation(F.M);
    if(k==='top'){ const top=tgW(F,(b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,b.max.z); d.plane=tgFacingPlane(new THREE.Vector3().setFromMatrixColumn(d.R,2).normalize(), top); }
    else d.plane=new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3().setFromMatrixColumn(d.R,2).normalize(), tgW(F,0,0,b.min.z)); }
  if(!d.h0 && d.kind!=='scale'){ TG.ring.visible=false; return; }
  TG.drag=d; orbit.enabled=false; d.snap=snap();
  const move=e=>tgMove(e), up=e=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); tgEnd(e); };
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
}
function tgMove(ev){
  const d=TG.drag; if(!d) return; d.moved=true;
  if(d.kind==='lift'){ const hp=tgHit(ev,d.plane); if(!hp) return; let dz=hp.z-d.h0.z; if(d.snap>0) dz=Math.round(dz/d.snap)*d.snap;
    for(const it of d.items){ it.p.pos=[it.pos[0],it.pos[1],+(it.pos[2]+dz).toFixed(3)]; const r=meshes.get(it.p.id); if(r) r.mesh.position.z=it.p.pos[2]; }
    liveInspector(); return; }
  if(d.kind==='rot'){ const hp=tgHit(ev,d.plane); if(!hp) return; const v0=d.h0.clone().sub(d.c), v1=hp.clone().sub(d.c);
    let a=Math.atan2(d.axis.dot(new THREE.Vector3().crossVectors(v0,v1)), v0.dot(v1));
    // keep turning past ±180° smoothly
    const prev=d.ang; let k=Math.round((prev-a)/(2*Math.PI)); a+=k*2*Math.PI;
    const st= ev.shiftKey? 1*DEG : 15*DEG; const as=Math.round(a/st)*st; d.ang=a;
    const R=new THREE.Matrix4().makeTranslation(d.c.x,d.c.y,d.c.z).multiply(new THREE.Matrix4().makeRotationAxis(d.axis,as)).multiply(new THREE.Matrix4().makeTranslation(-d.c.x,-d.c.y,-d.c.z));
    d.as=as; for(const it of d.items){ const r=meshes.get(it.p.id); if(!r) continue; const m=R.clone().multiply(it.M); m.decompose(r.mesh.position,r.mesh.quaternion,r.mesh.scale); }
    TG.needle.rotation.z=as; d.ang=as+(a-as); return; }
  // scale: the dragged side follows the pointer, the opposite side stays put
  const hp=tgHit(ev,d.plane); if(!hp) return; const q=hp.applyMatrix4(d.Minv), b=d.b0, s=d.s, it=d.items[0], p=it.p;
  const size0=new THREE.Vector3().subVectors(b.max,b.min), f=[1,1,1], sn=v=> d.snap>0? Math.max(d.snap, Math.round(v/d.snap)*d.snap) : Math.max(0.5, v);
  if(s[0]) f[0]=sn(s[0]>0? q.x-b.min.x : b.max.x-q.x)/size0.x;
  if(s[1]) f[1]=sn(s[1]>0? q.y-b.min.y : b.max.y-q.y)/size0.y;
  if(s[2]) f[2]=sn(q.z-b.min.z)/size0.z;
  if(ev.shiftKey){ const m=s[2]? f[2] : Math.max(s[0]?f[0]:0, s[1]?f[1]:0); f[0]=f[1]=f[2]=m; }   // keep the proportions
  p.params=clone(it.params); scaleParams(p,f);
  const g=getGeometry(p); if(!g.boundingBox) g.computeBoundingBox(); const nb=g.boundingBox;
  const off=new THREE.Vector3(
    s[0]>0? b.min.x-nb.min.x : s[0]<0? b.max.x-nb.max.x : (b.min.x+b.max.x-nb.min.x-nb.max.x)/2,
    s[1]>0? b.min.y-nb.min.y : s[1]<0? b.max.y-nb.max.y : (b.min.y+b.max.y-nb.min.y-nb.max.y)/2,
    b.min.z-nb.min.z).applyMatrix4(d.R);
  p.pos=[+(it.pos[0]+off.x).toFixed(3), +(it.pos[1]+off.y).toFixed(3), +(it.pos[2]+off.z).toFixed(3)];
  sync(); liveInspector();
}
function tgEnd(ev){
  const d=TG.drag; TG.drag=null; orbit.enabled=true; TG.ring.visible=false; if(!d) return;
  if(d.kind==='rot' && d.as){ const R=new THREE.Matrix4().makeTranslation(d.c.x,d.c.y,d.c.z).multiply(new THREE.Matrix4().makeRotationAxis(d.axis,d.as)).multiply(new THREE.Matrix4().makeTranslation(-d.c.x,-d.c.y,-d.c.z));
    for(const it of d.items) setPartFromMatrix(it.p, R.clone().multiply(it.M)); toast(`Tourné de ${Math.round(d.as/DEG)}°`); }
  if(d.kind==='scale') TG.dimUntil=performance.now()+2500;
  if(d.moved){ sync(); commit(); renderInspector(); }
}
/* type a dimension: click on the value */
function tgEditDim(a){
  const F=tgFrame(); if(!F || !F.single || !SCALE_MAP[F.p.kind]) return; const el=TG.dims[a];
  const b=F.b, size=new THREE.Vector3().subVectors(b.max,b.min)[a]; TG.editing=a;
  const inp=h('input',{class:'tg-dimin',type:'text',inputmode:'decimal',value:fmt(size,2),'aria-label':`Cote ${a.toUpperCase()} en mm`});
  el.replaceChildren(inp); inp.focus(); inp.select();
  const done=ok=>{ if(TG.editing!==a) return; TG.editing=null; el.textContent=''; const v=parseFloat(String(inp.value).replace(',','.'));
    if(ok && v>0 && Math.abs(v-size)>1e-6){ const p=F.p, f=[1,1,1]; f['xyz'.indexOf(a)]=v/size; const ctr=new THREE.Vector3((b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,b.min.z);
      scaleParams(p,f); const g=getGeometry(p); if(!g.boundingBox) g.computeBoundingBox(); const nb=g.boundingBox;
      const off=new THREE.Vector3(ctr.x-(nb.min.x+nb.max.x)/2, ctr.y-(nb.min.y+nb.max.y)/2, ctr.z-nb.min.z).applyMatrix4(new THREE.Matrix4().extractRotation(F.M));
      p.pos=[+(p.pos[0]+off.x).toFixed(3), +(p.pos[1]+off.y).toFixed(3), +(p.pos[2]+off.z).toFixed(3)]; sync(); commit(); renderInspector(); }
    TG.dimUntil=performance.now()+2000; };
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter') done(true); if(e.key==='Escape') done(false); });
  inp.addEventListener('blur',()=>done(true));
}

/* =========================================================
   Modifier l'intérieur d'un groupe
   ========================================================= */
function enterGroupEdit(gid){
  const G=findPart(gid); if(!G || G.kind!=='group' || !guard()) return;
  if(state.edit){ toast('Terminez d’abord le groupe en cours.'); return; }
  const M=partMatrix(G), at=state.parts.indexOf(G), kids=[];
  for(const ch of G.children){ const c=clone(ch); setPartFromMatrix(c, M.clone().multiply(partMatrix(ch))); c.inGroup=gid; kids.push(c); }
  state.parts.splice(at,1,...kids);
  state.edit={gid, name:G.name, color:G.color, hole:!!G.hole, pos:[...G.pos], rot:[...G.rot], at, locked:G.locked||false, hidden:G.hidden||false};
  selection=[]; sync(); commit(); renderInspector(); updateGroupEditUI(); closeBubble();
  toast(`Vous êtes dans « ${G.name} » : modifiez, ajoutez ou supprimez des pièces, puis Terminer.`);
}
function finishGroupEdit(){
  const E=state.edit; if(!E) return;
  const kids=state.parts.filter(p=>p.inGroup===E.gid);
  state.parts=state.parts.filter(p=>p.inGroup!==E.gid); state.edit=null;
  if(kids.length){
    const G={id:E.gid, kind:'group', name:E.name, params:{}, color:E.color, hole: kids.every(k=>k.hole), pos:E.pos, rot:E.rot, children:[]};
    if(E.locked) G.locked=true; if(E.hidden) G.hidden=true;
    const inv=partMatrix(G).invert();
    for(const p of kids){ const ch=clone(p); delete ch.inGroup; setPartFromMatrix(ch, inv.clone().multiply(partMatrix(p))); G.children.push(ch); }
    state.parts.splice(Math.min(E.at, state.parts.length), 0, G); selection=[G.id];
    const holes=kids.filter(k=>k.hole).length;
    toast(holes && holes<kids.length? `Groupe recalculé : ${holes} perçage${holes>1?'s':''} retiré${holes>1?'s':''} de la matière.` : 'Groupe recalculé.');
  } else { selection=[]; toast('Le groupe était vide : il a été supprimé.'); }
  sync(); commit(); renderInspector(); updateGroupEditUI();
}
function updateGroupEditUI(){
  let bar=$('#grpEdit'); const E=ws==='model' && state.edit;
  if(!bar){ bar=h('div',{id:'grpEdit',hidden:true}); $('#stage').append(bar); }
  bar.hidden=!E; if(!E) return;
  bar.replaceChildren(svgIcon('group'), h('span',{html:`Intérieur de <b>${E.name}</b> : les autres pièces sont estompées.`}),
    h('button',{class:'btn primary',onclick:finishGroupEdit}, svgIcon('check'), 'Terminer le groupe'));
}
