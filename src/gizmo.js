
/* =========================================================
   Poignées de la sélection (à la manière de Tinkercad), atelier Modéliser
   - cadre pointillé au sol, autour de la boîte de la pièce ;
   - carrés blancs aux coins : largeur et longueur ensemble (Maj : garder les proportions) ;
   - petits carrés noirs au milieu des côtés : une seule cote ;
   - carré blanc en haut : hauteur ; cône noir au-dessus : soulever la pièce ;
   - flèches courbes : tourner autour d'un axe ; le rapporteur (affiché au survol et pendant la rotation) porte des
     graduations de 5°, 15° et 45° : près d'une graduation, l'angle s'y aimante (plus fort pour les grandes). Maj : libre, au degré ;
   - cotes affichées au survol d'une poignée de taille : cliquez une cote pour taper la valeur.
   Glisser la pièce elle-même la déplace sur le sol (scene.js).
   + Modifier l'intérieur d'un groupe (mode édition) : les pièces du groupe redeviennent séparées, le reste
     de la scène est caché ; « Terminer » recalcule le groupe (perçages compris).
   ========================================================= */
const TG={drag:null, dimUntil:0, el:null, ring:null, ticks:null};
const TG_BASE=[[-1,-1],[1,-1],[1,1],[-1,1]];
const TG_EDGE=[[0,-1],[1,0],[0,1],[-1,0]];
const _tv=new THREE.Vector3(), _tw=new THREE.Vector3();

function tgBuild(){
  const root=h('div',{id:'tg',hidden:true});
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('class','tg-lines');
  svg.innerHTML='<path class="tg-base"/><path class="tg-axes"/><path class="tg-dim"/><path class="tg-snap"/>'+['rx','ry','rz'].map(k=>`<g class="tg-arcg" data-k="${k}"><path class="tg-arcw"/><path class="tg-arc"/><path class="tg-arch" data-k="${k}"/></g>`).join(''); root.append(svg);
  const mk=(cls,data,title,html='')=>{ const e=h('div',{class:'tg-h '+cls,title,...data,html}); root.append(e); return e; };
  TG.corners=TG_BASE.map((s,i)=>mk('tg-corner',{'data-k':'c'+i},'Tirer pour changer la longueur et la largeur (Maj : garder les proportions)'));
  TG.edges=TG_EDGE.map((s,i)=>mk('tg-edge',{'data-k':'e'+i},'Tirer pour changer cette cote'));
  TG.top=mk('tg-corner',{'data-k':'top'},'Tirer pour changer la hauteur');
  TG.lift=mk('tg-lift',{'data-k':'lift'},'Tirer pour soulever ou descendre la pièce','<svg viewBox="0 0 16 16"><path d="M8 2 13 12H3z" fill="currentColor"/></svg>');
  const arc='';   // the arrow itself is an arc drawn in the rotation plane (tgArc); this is the round grip on it
  TG.rot={x:mk('tg-rot',{'data-k':'rx'},'Tourner autour de l’axe X (rouge)',arc), y:mk('tg-rot',{'data-k':'ry'},'Tourner autour de l’axe Y (vert)',arc), z:mk('tg-rot',{'data-k':'rz'},'Tourner autour de l’axe vertical Z (bleu)',arc)};
  TG.dims={x:h('button',{class:'tg-dimv','data-a':'x'}), y:h('button',{class:'tg-dimv','data-a':'y'}), z:h('button',{class:'tg-dimv','data-a':'z'})};
  for(const b of Object.values(TG.dims)){ root.append(b); b.onclick=()=>tgEditDim(b.dataset.a); b.addEventListener('pointerenter',()=>{ TG.dimUntil=performance.now()+4000; }); }
  TG.ang=h('div',{class:'tg-ang',hidden:true}); root.append(TG.ang);
  TG.svg=svg; TG.el=root; $('#stage').append(root);
  for(const p of svg.querySelectorAll('.tg-arch')){ p.addEventListener('pointerdown', ev=>tgStart(ev, p.dataset.k));
    p.addEventListener('pointerenter',()=>p.parentNode.classList.add('hot')); p.addEventListener('pointerleave',()=>p.parentNode.classList.remove('hot')); }
  for(const k of ['x','y','z']){ const e=TG.rot[k], g=svg.querySelector(`.tg-arcg[data-k="r${k}"]`); e.addEventListener('pointerenter',()=>g.classList.add('hot')); e.addEventListener('pointerleave',()=>g.classList.remove('hot')); }
  for(const e of root.querySelectorAll('.tg-h')){
    e.addEventListener('pointerdown', ev=>tgStart(ev, e.dataset.k));
    if(/^(c|e)\d$|^top$/.test(e.dataset.k)) e.addEventListener('pointerenter', ()=>{ TG.dimUntil=performance.now()+4000; });
  }
  // the protractor shown while turning
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.82,1,96), new THREE.MeshBasicMaterial({color:0x3d8bd0, transparent:true, opacity:.28, side:THREE.DoubleSide, depthTest:false}));
  // graduations sombres par-dessus : petites tous les 5°, moyennes tous les 15°, grandes tous les 45° (quadrilatères fins, plus épais quand ils sont grands)
  // crans noirs ; seul le cran sous le pointeur (ou attrapé) reçoit un liseré blanc (TG.hi)
  const tick=(lvl, a, grow)=>{ const r0=[0.88,0.78,0.66][lvl]-grow, r1=1.02+grow, w=[0.005,0.009,0.016][lvl]+grow; const c=Math.cos(a), s=Math.sin(a), px=-s*w, py=c*w;
    const A=[c*r0+px,s*r0+py], B=[c*r0-px,s*r0-py], C=[c*r1-px,s*r1-py], D=[c*r1+px,s*r1+py]; return [...A,0, ...B,0, ...C,0, ...A,0, ...C,0, ...D,0]; };
  const lvlOf=i=> i%9===0? 2 : i%3===0? 1 : 0;
  const geo=arr=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr,3)); return g; };
  const mat=(c,o)=>new THREE.MeshBasicMaterial({color:c, transparent:true, opacity:o, side:THREE.DoubleSide, depthTest:false});
  const all=g=>{ const t=[]; for(let i=0;i<72;i++) t.push(...tick(lvlOf(i), i/72*Math.PI*2, g)); return t; };
  const ticks=new THREE.Mesh(geo(all(0)), mat(0x000000,1)); ticks.renderOrder=23;
  // graduation sous le pointeur (ou attrapée) : liseré plus épais
  TG.hi=new THREE.Group(); TG.hiL=[0,1,2].map(l=>{ const g=new THREE.Group(); const w=new THREE.Mesh(geo(tick(l,0,0.02)), mat(0xffffff,1)); w.renderOrder=24; const k=new THREE.Mesh(geo(tick(l,0,0.004)), mat(0x000000,1)); k.renderOrder=25; g.add(w,k); g.visible=false; TG.hi.add(g); return g; });
  const needle=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(1.05,0,0)]), new THREE.LineBasicMaterial({color:0xd64035, depthTest:false}));
  needle.renderOrder=26; ring.renderOrder=21;
  window.addEventListener('pointermove', e=>{ TG.ptr={clientX:e.clientX, clientY:e.clientY}; }, {passive:true});
  TG.ring=new THREE.Group(); TG.ring.add(ring, ticks, needle, TG.hi); TG.needle=needle; TG.ring.visible=false; TG.ring.renderOrder=20; scene.add(TG.ring);
  TG.marks=[0,45,90,135,180,-135,-90,-45].map(a=>{ const e=h('span',{class:'tg-mark',hidden:true},`${a}°`); e.dataset.a=a; root.append(e); return e; });
  for(const k of ['x','y','z']){ for(const e of [TG.rot[k], svg.querySelector(`.tg-arch[data-k="r${k}"]`)]){ e.addEventListener('pointerenter',()=>{ TG.hover=k; }); e.addEventListener('pointerleave',()=>{ if(TG.hover===k) TG.hover=null; }); } }
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
  TG.el.hidden=!F; if(!F){ TG.ring.visible=false; TG.hover=null; return; }
  TG.frame=F; const b=F.b, cx=(b.min.x+b.max.x)/2, cy=(b.min.y+b.max.y)/2, z0=b.min.z, z1=b.max.z;
  const X=[b.min.x,b.max.x], Y=[b.min.y,b.max.y], S=(x,y,z)=>toStage(tgW(F,x,y,z));
  const base=TG_BASE.map(([sx,sy])=>S(X[(sx+1)/2],Y[(sy+1)/2],z0));
  TG.svg.querySelector('.tg-base').setAttribute('d', 'M'+base.map(p=>`${p.x},${p.y}`).join('L')+'Z');
  const c0=S(cx,cy,z0), cT=S(cx,cy,z1), mids=TG_EDGE.map(([sx,sy])=>S(sx? X[(sx+1)/2]:cx, sy? Y[(sy+1)/2]:cy, z0));
  TG.svg.querySelector('.tg-axes').setAttribute('d', `M${mids[0].x},${mids[0].y}L${mids[2].x},${mids[2].y}M${mids[1].x},${mids[1].y}L${mids[3].x},${mids[3].y}M${c0.x},${c0.y}L${cT.x},${cT.y}`);
  const turning= TG.drag?.kind==='rot' ? TG.drag.ax : null;   // pendant une rotation, seule la poignée utilisée reste affichée
  TG.el.classList.toggle('turning', !!turning);
  const scal= F.single && !!SCALE_MAP[F.p.kind] && !turning;
  TG.corners.forEach((e,i)=>tgPlace(e, base[i], scal)); TG.edges.forEach((e,i)=>tgPlace(e, mids[i], scal)); tgPlace(TG.top, cT, scal);
  tgPlace(TG.lift, {x:cT.x, y:cT.y-26, vis:cT.vis}, !turning);
  // rotation arrows: short arcs lying in the plane of each rotation, on the edges nearest to the camera
  const cam=camera.position, near=(a,b2)=>tgW(F,...a).distanceTo(cam) < tgW(F,...b2).distanceTo(cam);
  const fy= near([cx,Y[0],z1],[cx,Y[1],z1])? Y[0] : Y[1], fx= near([X[0],cy,z1],[X[1],cy,z1])? X[0] : X[1];
  const xz= S(X[1],fy,z0).x > S(X[0],fy,z0).x ? X[1] : X[0], cz=(z0+z1)/2, C=axisColors();
  tgArc('z', a=>[cx+Math.cos(a), cy+Math.sin(a), z0], [cx,cy,z0], [xz,fy,z0], C.z, turning && turning!=='z');
  tgArc('x', a=>[cx, cy+Math.cos(a), cz+Math.sin(a)], [cx,cy,cz], [cx,fy,z1], C.x, turning && turning!=='x');
  tgArc('y', a=>[cx+Math.cos(a), cy, cz+Math.sin(a)], [cx,cy,cz], [fx,cy,z1], C.y, turning && turning!=='y');
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
  if(TG.drag?.kind==='rot'){ const d=TG.drag, a=d.as||0; const tip=toStage(d.c.clone().add(d.u.clone().multiplyScalar(Math.cos(a)*d.R*0.5)).add(d.v.clone().multiplyScalar(Math.sin(a)*d.R*0.5)));   // the angle sits on the needle, inside the protractor
    TG.ang.hidden=false; TG.ang.textContent=`${Math.round(a/DEG)}°`; TG.ang.classList.toggle('snap', !!d.lvl); tgHi(a, d.lvl||0); TG.ang.style.transform=`translate(${Math.round(tip.x)}px,${Math.round(tip.y)}px) translate(-50%,-50%)`; tgMarks(d, a); }
  else { TG.ang.hidden=true;
    if(TG.hover && !TG.drag){ const g=tgRingSetup(F, TG.hover); tgMarks(g, null); tgHoverTick(g); }   // survol d'une flèche : le rapporteur et ses graduations apparaissent
    else { TG.ring.visible=false; for(const e of TG.marks) e.hidden=true; } }
}

/* one rotation arrow: an arc of the circle around the axis through the box centre, passing just outside the
   anchor edge, about 60 px long on screen, with arrowheads at both ends and a round grip in the middle */
function tgArc(k, unit, c, anchor, color, off=false){
  const F=TG.frame; const g=TG.svg.querySelector(`.tg-arcg[data-k="r${k}"]`); const grip=TG.rot[k];
  if(off){ g.style.display='none'; grip.hidden=true; return; }
  // circle parameters in the frame: unit(a) gives c + (cos a, sin a) along the two plane axes when c is subtracted
  const u0=unit(0), u1=unit(Math.PI/2); const ax=[u0[0]-c[0],u0[1]-c[1],u0[2]-c[2]], ay=[u1[0]-c[0],u1[1]-c[1],u1[2]-c[2]];
  const d=[anchor[0]-c[0],anchor[1]-c[1],anchor[2]-c[2]], px=d[0]*ax[0]+d[1]*ax[1]+d[2]*ax[2], py=d[0]*ay[0]+d[1]*ay[1]+d[2]*ay[2];
  const r=Math.max(1, Math.hypot(px,py))*1.14+1.5, a0=Math.atan2(py,px);
  const P=a=>toStage(tgW(F, c[0]+r*(Math.cos(a)*ax[0]+Math.sin(a)*ay[0]), c[1]+r*(Math.cos(a)*ax[1]+Math.sin(a)*ay[1]), c[2]+r*(Math.cos(a)*ax[2]+Math.sin(a)*ay[2])));
  const m=P(a0), q=P(a0+0.05), ppr=Math.max(1, Math.hypot(q.x-m.x,q.y-m.y)/0.05), da=clamp(30/ppr, 0.08, 0.9);
  const pts=[]; for(let i=0;i<=14;i++) pts.push(P(a0-da+2*da*i/14));
  if(!m.vis){ g.style.display='none'; grip.hidden=true; return; } g.style.display='';
  let dpath='M'+pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L');
  for(const [e,f] of [[pts[14],pts[12]],[pts[0],pts[2]]]){ const vx=e.x-f.x, vy=e.y-f.y, l=Math.hypot(vx,vy)||1, ux=vx/l, uy=vy/l;   // arrowheads
    for(const s of [1,-1]){ const cs=Math.cos(0.5), sn=s*Math.sin(0.5); dpath+=`M${e.x.toFixed(1)},${e.y.toFixed(1)}l${(-(ux*cs-uy*sn)*8).toFixed(1)},${(-(uy*cs+ux*sn)*8).toFixed(1)}`; } }
  for(const p of g.children) p.setAttribute('d', dpath); g.children[1].style.stroke=color;
  tgPlace(grip, m);
  (TG.gripW||(TG.gripW={}))[k]=tgW(F, c[0]+r*(Math.cos(a0)*ax[0]+Math.sin(a0)*ay[0]), c[1]+r*(Math.cos(a0)*ax[1]+Math.sin(a0)*ay[1]), c[2]+r*(Math.cos(a0)*ax[2]+Math.sin(a0)*ay[2]));   // where the grip is, in the world
}
/* the protractor around axis ax of the frame: centre, axis, start direction u, radius; also measures how many
   screen pixels one radian makes on its rim (used to make the graduations magnetic at a distance in pixels) */
function tgRingSetup(F, ax, toward=null){
  const b=F.b, i='xyz'.indexOf(ax); const R=new THREE.Matrix4().extractRotation(F.M); const axis=new THREE.Vector3().setFromMatrixColumn(R,i).normalize();
  const c=new THREE.Vector3((b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2).applyMatrix4(F.M);
  // 0° du rapporteur sous la poignée (ou le point attrapé) : les crans vus sous le pointeur sont ceux où l'angle s'aimante
  let u=null; const pt= toward || TG.gripW?.[ax];
  if(pt){ u=pt.clone().sub(c); u.addScaledVector(axis, -u.dot(axis)); if(u.lengthSq()<1e-9) u=null; else u.normalize(); }
  if(!u) u=new THREE.Vector3().setFromMatrixColumn(R,(i+1)%3).normalize();
  const v=new THREE.Vector3().crossVectors(axis,u);
  const Rr=new THREE.Vector3().subVectors(b.max,b.min).length()*0.62+2;
  TG.ring.position.copy(c); TG.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), axis); TG.ring.scale.setScalar(Rr); TG.ring.visible=true;
  TG.ring.children[0].material.color.set(axisColors()[ax]); TG.needle.rotation.z=0;
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0).applyQuaternion(TG.ring.quaternion), u); TG.ring.quaternion.premultiply(q);   // the needle starts along u
  let ppr=0; for(let k=0;k<8;k++){ const a=k*Math.PI/4, p=(t)=>toStage(c.clone().addScaledVector(u,Math.cos(t)*Rr).addScaledVector(v,Math.sin(t)*Rr)); const A=p(a), B=p(a+0.02); ppr=Math.max(ppr, Math.hypot(B.x-A.x,B.y-A.y)/0.02); }
  return {axis, c, u, v, R:Rr, ppr, ax};
}
/* magnetic graduations: within 16 px of a 45° mark, 10 px of a 15° mark or 6 px of a 5° mark the angle snaps to it;
   elsewhere it moves freely by whole degrees. free (Maj) : no snapping. Returns the angle and the level caught. */
const TG_SNAP=[[45,16,3],[15,10,2],[5,6,1]];
function tgSnapAngle(a, ppr, free=false){
  if(!free) for(const [st,px,lvl] of TG_SNAP){ const t=Math.round(a/(st*DEG))*st*DEG; if(Math.abs(a-t)*ppr<=px) return {a:t, lvl}; }
  return {a:Math.round(a/DEG)*DEG, lvl:0};
}
/* thicker outline on graduation lvl (1 small, 2 medium, 3 big) at angle a, none when lvl is 0 */
function tgHi(a, lvl){ TG.hiL.forEach((g,i)=>{ g.visible= lvl===i+1; if(g.visible) g.rotation.z=a; }); }
/* the graduation nearest the pointer on the protractor g (hover preview) */
function tgHoverTick(g){ if(!TG.ptr) return tgHi(0,0); const hp=tgHit(TG.ptr, new THREE.Plane().setFromNormalAndCoplanarPoint(g.axis,g.c)); if(!hp) return tgHi(0,0);
  const v=hp.sub(g.c), a=Math.atan2(v.dot(g.v), v.dot(g.u)); let best=null;
  for(const [st,px,lvl] of TG_SNAP){ const t=Math.round(a/(st*DEG))*st*DEG; if(Math.abs(a-t)*g.ppr<=px*1.6){ best={t,lvl}; break; } }
  if(best) tgHi(best.t, best.lvl); else tgHi(0,0); }
/* degree labels at the big marks of the visible protractor */
function tgMarks(g, as){
  for(const e of TG.marks){ const t=+e.dataset.a*DEG, r=g.R*1.12; const p=toStage(g.c.clone().addScaledVector(g.u,Math.cos(t)*r).addScaledVector(g.v,Math.sin(t)*r));
    e.hidden=!p.vis; if(!e.hidden){ e.style.transform=`translate(${Math.round(p.x)}px,${Math.round(p.y)}px) translate(-50%,-50%)`; e.classList.toggle('on', as!=null && Math.abs(as-t)<1e-6); } }
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
  else if(k[0]==='r'){ let g=tgRingSetup(F, k[1]); const h0=tgHit(ev, new THREE.Plane().setFromNormalAndCoplanarPoint(g.axis,g.c)); if(h0) g=tgRingSetup(F, k[1], h0);
    d.kind='rot'; Object.assign(d, g); d.ang=0; d.plane=new THREE.Plane().setFromNormalAndCoplanarPoint(g.axis,g.c); d.h0=h0; }
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
    const S=tgSnapAngle(a, d.ppr, ev.shiftKey), as=S.a; d.ang=a; d.lvl=S.lvl;
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
  if(p.kind==='group'){   // aperçu : le maillage est étiré ; les pièces du groupe ne sont recalculées qu'au relâchement
    d.f=f; const nb={min:b.min.clone().multiply(new THREE.Vector3(...f)), max:b.max.clone().multiply(new THREE.Vector3(...f))};
    const off=new THREE.Vector3(s[0]>0? b.min.x-nb.min.x : s[0]<0? b.max.x-nb.max.x : (b.min.x+b.max.x-nb.min.x-nb.max.x)/2,
      s[1]>0? b.min.y-nb.min.y : s[1]<0? b.max.y-nb.max.y : (b.min.y+b.max.y-nb.min.y-nb.max.y)/2, b.min.z-nb.min.z).applyMatrix4(d.R);
    p.pos=[+(it.pos[0]+off.x).toFixed(3), +(it.pos[1]+off.y).toFixed(3), +(it.pos[2]+off.z).toFixed(3)];
    const r=meshes.get(p.id); if(r){ r.mesh.position.set(...p.pos); r.mesh.scale.set(...f); r.mesh.updateMatrix(); }
    liveInspector(); return; }
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
  const d=TG.drag; TG.drag=null; orbit.enabled=true; TG.ring.visible=false; for(const e of TG.marks) e.hidden=true; if(!d) return;
  if(d.kind==='rot' && d.as){ const R=new THREE.Matrix4().makeTranslation(d.c.x,d.c.y,d.c.z).multiply(new THREE.Matrix4().makeRotationAxis(d.axis,d.as)).multiply(new THREE.Matrix4().makeTranslation(-d.c.x,-d.c.y,-d.c.z));
    for(const it of d.items) setPartFromMatrix(it.p, R.clone().multiply(it.M)); toast(`Tourné de ${Math.round(d.as/DEG)}°`); }
  if(d.kind==='scale' && d.f && d.items[0].p.kind==='group'){ scaleParams(d.items[0].p, d.f); const r=meshes.get(d.items[0].p.id); if(r) r.mesh.scale.set(1,1,1); }
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
  const b=new THREE.Box3(); for(const k of kids){ const r=meshes.get(k.id); if(r) b.union(new THREE.Box3().setFromObject(r.mesh)); } frameBox(b, 25);   // la vue cadre le groupe isolé
  toast(`Mode édition de « ${G.name} » : seules ses pièces sont affichées. Modifiez-les, puis Terminer.`);
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
  bar.replaceChildren(svgIcon('group'), h('span',{html:`<b>Mode édition du groupe</b> « ${E.name} » : les autres pièces sont cachées.`}),
    h('button',{class:'btn primary',onclick:finishGroupEdit}, svgIcon('check'), 'Terminer le groupe'));
}
