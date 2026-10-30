
/* =========================================================
   Atelier « Valider » : contrôle des pièces, complexité, proxy basse
   résolution et repères (locators) utilisés par l'atelier Mécanique.
   A part keeps:  p.valid = {key, level:'ok'|'warn'|'err', tris, proxy, issues:[{sev,title,msg}]}
                  p.locs  = [{id, name, kind:'centre'|'base'|'axe'|'face', pos:[x,y,z], dir:[x,y,z], auto}]
   Positions and directions are in the part's own frame, so moving the part keeps them valid.
   ========================================================= */
const TRI_LIGHT=1500, TRI_HEAVY=5000, PROXY_TARGET=1200;
function hashStr(s){ let h=0x811c9dc5; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193); } return (h>>>0).toString(16); }
const vKey=p=>hashStr(geomKey(p));
/* 'none' (jamais validée) | 'stale' (modifiée depuis) | 'ok' | 'warn' | 'err' */
function vState(p){ if(!p?.valid) return 'none'; if(p.valid.key!==vKey(p)) return 'stale'; return p.valid.level; }
const V_LABEL={none:'À valider', stale:'Modifiée depuis la validation', ok:'Validée', warn:'Validée avec remarques', err:'Erreur'};
const triCount=g=>(g.index? g.index.count : g.attributes.position.count)/3;
const CHK={showProxy:false};

/* ---- geometry checks */
function meshStats(g){ // closed surface test on welded vertices (exact for primitives, not for CSG output)
  const p=g.attributes.position, idx=g.index, n=idx?idx.count:p.count, map=new Map();
  const vid=i=>{ const k=Math.round(p.getX(i)*1e3)+','+Math.round(p.getY(i)*1e3)+','+Math.round(p.getZ(i)*1e3); let v=map.get(k); if(v===undefined){ v=map.size; map.set(k,v);} return v; };
  const E=new Map(); let finite=true;
  for(let i=0;i<p.count && finite;i++) if(!isFinite(p.getX(i))||!isFinite(p.getY(i))||!isFinite(p.getZ(i))) finite=false;
  for(let t=0;t<n;t+=3){ const a=vid(idx?idx.getX(t):t), b=vid(idx?idx.getX(t+1):t+1), c=vid(idx?idx.getX(t+2):t+2);
    if(a===b||b===c||a===c) continue;
    for(const [u,v] of [[a,b],[b,c],[c,a]]){ const k=u<v? u*1e7+v : v*1e7+u; E.set(k,(E.get(k)||0)+1); } }
  let open=0; for(const c of E.values()) if(c!==2) open++;
  return {open, finite};
}
function segCross(a,b,c,d){ const o=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const d1=o(c,d,a), d2=o(c,d,b), d3=o(a,b,c), d4=o(a,b,d); return ((d1>1e-9&&d2<-1e-9)||(d1<-1e-9&&d2>1e-9)) && ((d3>1e-9&&d4<-1e-9)||(d3<-1e-9&&d4>1e-9)); }
function sketchCrossings(sk){ // number of crossing segment pairs inside and between contours
  const {loops}=skProfiles(sk); const segs=[];
  loops.forEach((L,li)=>L.pts.forEach((q,i)=>segs.push({li,i,n:L.pts.length,a:q,b:L.pts[(i+1)%L.pts.length]})));
  if(segs.length>4000) return 0;
  let n=0; for(let i=0;i<segs.length;i++) for(let j=i+1;j<segs.length;j++){ const s=segs[i], t=segs[j];
    if(s.li===t.li && (Math.abs(s.i-t.i)<=1 || Math.abs(s.i-t.i)===s.n-1)) continue;
    if(segCross(s.a,s.b,t.a,t.b)) n++; }
  return n;
}

/* ---- low-resolution proxy by vertex clustering */
function makeProxy(g, target=PROXY_TARGET){
  const p=g.attributes.position, idx=g.index, n=idx?idx.count:p.count;
  g.computeBoundingBox(); const sz=new THREE.Vector3(); g.boundingBox.getSize(sz); const mn=g.boundingBox.min;
  let cell=Math.max(sz.x,sz.y,sz.z)/Math.max(6,Math.sqrt(target)/1.6), best=null;
  for(let it=0; it<10; it++){
    const cl=new Map(), acc=[];
    const cid=i=>{ const x=p.getX(i), y=p.getY(i), z=p.getZ(i); const k=Math.floor((x-mn.x)/cell)+'|'+Math.floor((y-mn.y)/cell)+'|'+Math.floor((z-mn.z)/cell);
      let c=cl.get(k); if(c===undefined){ c=acc.length/4; cl.set(k,c); acc.push(0,0,0,0); } acc[c*4]+=x; acc[c*4+1]+=y; acc[c*4+2]+=z; acc[c*4+3]++; return c; };
    const tris=[], seen=new Set();
    for(let t=0;t<n;t+=3){ const a=cid(idx?idx.getX(t):t), b=cid(idx?idx.getX(t+1):t+1), c=cid(idx?idx.getX(t+2):t+2);
      if(a===b||b===c||a===c) continue; const k=[a,b,c].sort((u,v)=>u-v).join(','); if(seen.has(k)) continue; seen.add(k); tris.push(a,b,c); }
    best={acc,tris};
    if(tris.length/3<=target) break;
    cell*=1.35;
  }
  const {acc,tris}=best; const pos=new Float32Array(tris.length*3);
  tris.forEach((c,i)=>{ const w=acc[c*4+3]; pos[i*3]=acc[c*4]/w; pos[i*3+1]=acc[c*4+1]/w; pos[i*3+2]=acc[c*4+2]/w; });
  const out=new THREE.BufferGeometry(); out.setAttribute('position',new THREE.BufferAttribute(pos,3)); out.computeVertexNormals(); ensureAttrs(out);
  out.computeBoundingBox(); out.computeBoundingSphere(); return out;
}
const proxyCache=new Map();
function getProxyGeo(p){ const k=vKey(p); let g=proxyCache.get(k); if(!g){ g=makeProxy(getGeometry(p)); proxyCache.set(k,g); } return g; }
const usesProxy=p=> !!p.valid?.proxy && ['ok','warn'].includes(vState(p)) && (ws==='mech' || (ws==='check' && CHK.showProxy));

/* ---- default locators */
function defaultLocators(p, g){
  g.computeBoundingBox(); const b=g.boundingBox, c=new THREE.Vector3(); b.getCenter(c);
  const r=v=>+(+v).toFixed(3), V=v=>[r(v.x),r(v.y),r(v.z)];
  const L=[{id:'centre',name:'Centre',kind:'centre',pos:V(c),dir:[0,0,1]}, {id:'base',name:'Centre de la base',kind:'base',pos:[r(c.x),r(c.y),r(b.min.z)],dir:[0,0,1]}];
  const axisKinds={cylinder:'Axe du cylindre',cone:'Axe du cône',tube:'Axe du tube',torus:'Axe du tore',gear:'Axe de la roue',sphere:'Axe vertical'};
  if(axisKinds[p.kind] || (p.kind==='sketch' && p.params.mode==='revolve')) L.push({id:'axe',name:axisKinds[p.kind]||'Axe de révolution',kind:'axe',pos:[0,0,r(b.min.z)],dir:[0,0,1]});
  if(p.kind==='rack') L.push({id:'axe',name:'Direction de la crémaillère',kind:'axe',pos:[r(c.x),0,r(c.z)],dir:[1,0,0]});
  if(['box','wedge','pyramid','text'].includes(p.kind)){ L.push({id:'axeX',name:'Axe de la longueur (X)',kind:'axe',pos:V(c),dir:[1,0,0]}); L.push({id:'dessus',name:'Dessus',kind:'base',pos:[r(c.x),r(c.y),r(b.max.z)],dir:[0,0,1]}); }
  if(p.kind==='group'){ const seen=[]; let k=0;
    const walk=(ch, M)=>{ for(const q of ch){ const Mq=M.clone().multiply(partMatrix(q));
      if(['cylinder','tube','gear','cone','torus'].includes(q.kind)){ const o=new THREE.Vector3().applyMatrix4(Mq), d=new THREE.Vector3(0,0,1).applyMatrix4(new THREE.Matrix4().extractRotation(Mq)).normalize();
        if(!seen.some(s=>s.o.distanceTo(o)<0.5 && Math.abs(s.d.dot(d))>0.999)){ seen.push({o,d}); L.push({id:'axe'+(k++),name:(q.hole?'Axe du perçage : ':'Axe : ')+q.name,kind:'axe',pos:V(o),dir:V(d)}); } }
      if(q.kind==='group') walk(q.children, Mq); } };
    walk(p.children, new THREE.Matrix4()); }
  return L.map(l=>({...l,auto:true}));
}

/* ---- validation */
function validatePart(p){
  const issues=[]; const add=(sev,title,msg)=>issues.push({sev,title,msg});
  const g=getGeometry(p); const tris=triCount(g); const st=meshStats(g);
  g.computeBoundingBox(); const sz=new THREE.Vector3(); g.boundingBox.getSize(sz);
  const vol=Math.abs(signedVolume(g));
  if(!st.finite || tris<4 || Math.min(sz.x,sz.y,sz.z)<0.05) add('err','Forme vide ou plate','La pièce n’a pas d’épaisseur. Vérifiez ses dimensions.');
  else if(vol<0.01) add('err','Volume nul','La pièce n’enferme aucune matière.');
  else add('ok','Forme valide',`Volume ≈ ${fmt(vol/1000,2)} cm³`);
  if(p.kind==='sketch'){ const n=sketchCrossings(p.params.sk); if(n) add('err','Contour qui se croise',`${n} croisement${n>1?'s':''} dans l’esquisse : le volume peut être faux. Ouvrez l’esquisse et décroisez les traits.`);
    if(p.params.mode==='revolve' && p.params.sk.pts.some(q=>q.x<-1e-3)) add('warn','Profil à gauche de l’axe','La partie à gauche de l’axe est ignorée par la révolution.'); }
  if(p.kind!=='group' && st.finite){ if(st.open) add('warn','Surface non fermée',`${st.open} arête${st.open>1?'s':''} ouverte${st.open>1?'s':''} : la pièce n’est pas étanche pour l’impression.`); else add('ok','Surface fermée','La pièce est étanche.'); }
  const thin=Math.min(sz.x,sz.y,sz.z); if(thin>=0.05 && thin<1) add('warn','Très fine',`Épaisseur minimale ${fmt(thin,2)} mm : moins de 1 mm risque de casser à l’impression.`);
  if(p.hole) add('warn','Perçage seul','Ce perçage n’est groupé avec aucun solide : il ne creuse rien et ne sera pas imprimé.');
  // position on the build plate
  const r=meshes.get(p.id); if(r && !p.hole){ const M=partMatrix(p), wb=g.boundingBox.clone().applyMatrix4(M);
    if(wb.min.z < -0.05) add('warn','Traverse le plan',`La pièce descend ${fmt(-wb.min.z,1)} mm sous le plan de travail. Utilisez « Poser sur le plan ».`);
    else if(wb.min.z > 0.05){ const support=state.parts.some(q=>q!==p && !q.hole && meshes.get(q.id) && (()=>{ const qb=getGeometry(q).boundingBox.clone().applyMatrix4(partMatrix(q)); return qb.max.z>=wb.min.z-0.2 && qb.min.z<wb.min.z && qb.min.x<wb.max.x && qb.max.x>wb.min.x && qb.min.y<wb.max.y && qb.max.y>wb.min.y; })());
      if(!support) add('info','En l’air',`La pièce flotte à ${fmt(wb.min.z,1)} mm au-dessus du plan : à poser avant d’imprimer.`); }
    if(Math.max(Math.abs(wb.min.x),Math.abs(wb.max.x),Math.abs(wb.min.y),Math.abs(wb.max.y))>MAT/2) add('info','Dépasse du plateau',`La pièce sort du plateau de ${MAT} × ${MAT} mm.`); }
  // complexity and proxy
  const heavy=tris>=TRI_HEAVY;
  add(heavy?'info':'ok','Complexité', `${Math.round(tris).toLocaleString('fr-FR')} triangles : ${tris<TRI_LIGHT?'pièce légère':heavy?'pièce lourde, un proxy allégé est créé pour la simulation':'complexité moyenne'}.`);
  const level = issues.some(i=>i.sev==='err')?'err' : issues.some(i=>i.sev==='warn')?'warn':'ok';
  const keepProxy = p.valid?.proxy && p.valid.key===vKey(p);
  p.valid={key:vKey(p), level, tris:Math.round(tris), proxy: heavy || !!keepProxy, issues};
  if(p.valid.proxy) p.valid.proxyTris=Math.round(triCount(getProxyGeo(p)));
  const old=new Map((p.locs||[]).filter(l=>l.auto&&l.edited).map(l=>[l.id,l]));
  p.locs=[...defaultLocators(p,g).map(l=>old.has(l.id)? {...l, dir:old.get(l.id).dir, x:old.get(l.id).x, edited:true} : l), ...(p.locs||[]).filter(l=>!l.auto)];
  return level;
}
function validateAll(quiet=false){
  const list=state.parts.filter(p=>vState(p)==='none'||vState(p)==='stale');
  const todo=list.length? list : state.parts;
  for(const p of todo) validatePart(p);
  sync(); commit(); renderInspector(); updateSteps();
  if(!quiet){ const e=state.parts.filter(p=>vState(p)==='err').length, w=state.parts.filter(p=>vState(p)==='warn').length;
    toast(e? `${e} pièce${e>1?'s':''} en erreur : corrigez-la${e>1?'s':''} dans l’atelier Modéliser.` : w? `Pièces validées, ${w} avec remarques.` : 'Toutes les pièces sont validées.'); }
}
function toggleProxy(p){ if(!p.valid) return; p.valid.proxy=!p.valid.proxy; if(p.valid.proxy) p.valid.proxyTris=Math.round(triCount(getProxyGeo(p))); sync(); commit(); renderInspector(); }
function mechReady(){ return state.parts.filter(p=>!p.hole).every(p=>['ok','warn'].includes(vState(p))); }
function locWorld(p, l, cur=false){
  const M = cur && simActive()? curMatrix(p.id) : partMatrix(p);
  return {o:new THREE.Vector3(...l.pos).applyMatrix4(M), d:new THREE.Vector3(...l.dir).applyMatrix4(new THREE.Matrix4().extractRotation(M)).normalize()};
}

/* ---- locator display: a local frame (X, Y, Z) whose axes fade in towards an arrow head,
        so the eye reads the positive direction. Z is the main direction (`dir`). */
const locGroup=new THREE.Group(); locGroup.renderOrder=15; scene.add(locGroup);
const AXCOL_SETS={
  classique:{name:'Classique',  x:'#e5484d', y:'#30a46c', z:'#3e63dd'},
  contraste:{name:'Contrastée', x:'#f76b15', y:'#8e4ec6', z:'#0b9fc0'},
  doux:     {name:'Pastel',     x:'#f08a84', y:'#7fcf9e', z:'#86a6f0'},
};
const axisColors=()=>AXCOL_SETS[prefs.axes]||AXCOL_SETS.classique;
const LOCV={mode:'auto'};   // Mécanique: 'auto' (repères utilisés + pièce choisie), 'tous', 'aucun'
const LOC_KIND={centre:'Centre', base:'Base', axe:'Axe', face:'Face'};
function locX(l){ // local X of the frame, perpendicular to dir
  const z=new THREE.Vector3(...l.dir).normalize();
  let x= l.x? new THREE.Vector3(...l.x) : (Math.abs(z.x)<0.9? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0));
  x.addScaledVector(z,-x.dot(z)); if(x.lengthSq()<1e-9) x=new THREE.Vector3(0,1,0).addScaledVector(z,-z.y); return x.normalize();
}
function locFrame(l){ const z=new THREE.Vector3(...l.dir).normalize(), x=locX(l), y=z.clone().cross(x).normalize(); return {o:new THREE.Vector3(...l.pos), x, y, z}; }
/* a shaft from 0 to len along +Z, coloured from faint to full, with a cone at the tip */
function gradShaft(len, r, colorHex, {head=true, from=0, alpha0=0.12}={}){
  const g=new THREE.Group(); const c=new THREE.Color(colorHex), pale=c.clone().lerp(new THREE.Color(0xffffff),0.55);
  const geo=new THREE.CylinderGeometry(r, r, len-from, 10, 8, true); geo.rotateX(Math.PI/2); geo.translate(0,0,from+(len-from)/2);
  const pos=geo.attributes.position, col=new Float32Array(pos.count*4);
  for(let i=0;i<pos.count;i++){ const t=clamp((pos.getZ(i)-from)/(len-from),0,1), k=Math.pow(t,0.8); const m=pale.clone().lerp(c,k); col.set([m.r,m.g,m.b, alpha0+(1-alpha0)*k], i*4); }
  geo.setAttribute('color', new THREE.BufferAttribute(col,4));
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, depthTest:false, side:THREE.DoubleSide})));
  if(head){ const cone=new THREE.Mesh(new THREE.ConeGeometry(r*2.7, r*7, 14), new THREE.MeshBasicMaterial({color:c, depthTest:false, transparent:true})); cone.rotation.x=Math.PI/2; cone.position.z=len+r*3.2; g.add(cone); }
  g.traverse(m=>m.renderOrder=17); return g;
}
function locGlyph(l, size, emph=false){
  const g=new THREE.Group(); g.userData.loc=l.id; const C=axisColors(); const F=locFrame(l);
  const s=clamp(size*0.035,0.7,2.6)*(emph?1.35:1), L=Math.max(9,size*0.5)*(emph?1.25:1);
  g.position.copy(F.o); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(F.x,F.y,F.z));
  const ax=(v,len,col)=>{ const sh=gradShaft(len, s*0.32, col); sh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), v); g.add(sh); };
  ax(new THREE.Vector3(1,0,0), L*0.55, C.x); ax(new THREE.Vector3(0,1,0), L*0.55, C.y);
  if(l.kind==='axe'){ const back=gradShaft(L*0.5, s*0.26, C.z, {head:false, alpha0:0.05}); back.rotation.x=Math.PI; g.add(back); }
  ax(new THREE.Vector3(0,0,1), L*(l.kind==='axe'?0.95:0.75), C.z);
  const om=new THREE.MeshBasicMaterial({color: emph? 0xffffff : 0xf4f6f5, depthTest:false, transparent:true, opacity:.95});
  const ring=new THREE.MeshBasicMaterial({color:0x2c3331, depthTest:false, transparent:true, opacity:.85});
  const shape = l.kind==='centre'? new THREE.OctahedronGeometry(s*1.1) : l.kind==='face'? new THREE.OctahedronGeometry(s*0.9) : l.kind==='base'? new THREE.TorusGeometry(s*1.2,s*0.3,6,24) : new THREE.SphereGeometry(s*0.85,14,10);
  const core=new THREE.Mesh(shape, l.kind==='base'? ring : om); g.add(core);
  if(l.kind!=='base'){ const halo=new THREE.Mesh(new THREE.SphereGeometry(s*1.25,14,10), new THREE.MeshBasicMaterial({color:0x2c3331, depthTest:false, transparent:true, opacity:.35, side:THREE.BackSide})); g.add(halo); }
  g.traverse(m=>{ m.renderOrder=17; if(m.isMesh) m.userData.loc=l.id; });
  return g;
}
function usedLocs(){ const s=new Set(); for(const j of state.joints) if(j.loc) s.add(j.loc.pid+':'+j.loc.lid); if(jf?.loc) s.add(jf.loc.pid+':'+jf.loc.lid); return s; }
function rebuildLocators(){
  for(const c of [...locGroup.children]){ locGroup.remove(c); c.traverse(m=>{ m.geometry?.dispose(); m.material?.dispose(); }); }
  const show = (ws==='check' || ws==='mech') && lv(2);
  if(!show || (ws==='mech' && LOCV.mode==='aucun')) return;
  const used=usedLocs();
  for(const p of state.parts){
    if(!p.locs?.length || isHidden(p) || p.hole) continue;
    if(ws==='check' && selection.length && !selection.includes(p.id)) continue;
    const g=getGeometry(p); const sz=new THREE.Vector3(); g.boundingBox.getSize(sz); const size=Math.max(sz.x,sz.y,sz.z);
    const pg=new THREE.Group(); pg.userData.pid=p.id; pg.matrixAutoUpdate=false;
    for(const l of p.locs){
      const key=p.id+':'+l.id, isUsed=used.has(key);
      if(ws==='mech'){ if(l.kind==='base') continue;
        if(LOCV.mode==='auto' && !jf && !isUsed && !selection.includes(p.id)) continue; }
      pg.add(locGlyph(l, size, ws==='mech' && isUsed));
    }
    if(pg.children.length) locGroup.add(pg);
  }
  updateLocatorPoses();
}
/* ---- orientation of a locator (rotate, flip, swap the main axis) — joints hooked to it follow */
function locEdit(p, l, op){
  const F=locFrame(l); const r=v=>v.toArray().map(c=>+c.toFixed(6));
  if(op==='rot'){ l.x=r(F.y); }                              // quart de tour autour de Z
  else if(op==='flip'){ l.dir=r(F.z.clone().negate()); l.x=r(F.x); }   // inverser le sens de Z
  else if(op==='swap'){ l.dir=r(F.x); l.x=r(F.z.clone().negate()); }   // X devient l'axe principal
  l.edited=true; updateJointsForLoc(p,l); sync(); commit(); renderInspector();
}
function updateJointsForLoc(p,l){
  for(const j of state.joints){ if(!j.loc || j.loc.pid!==p.id || j.loc.lid!==l.id) continue;
    const {o,d}=locWorld(p,l); const PR=restMatrix(j.parent), inv=PR.clone().invert(), rotInv=new THREE.Matrix4().extractRotation(inv);
    o.applyMatrix4(inv); d.applyMatrix4(rotInv).normalize(); j.origin=o.toArray().map(v=>+v.toFixed(5)); j.axis=d.toArray().map(v=>+v.toFixed(6)); }
  if(jf?.loc && jf.loc.pid===p.id && jf.loc.lid===l.id) setJointLoc(p.id,l.id,true);
}
function locLegend(){ const C=axisColors(); return h('div',{class:'axleg'}, ...['x','y','z'].map(a=>h('span',{}, h('i',{style:`background:linear-gradient(90deg,transparent,${C[a]})`}), a.toUpperCase()))); }
function updateLocatorPoses(){ for(const pg of locGroup.children){ const r=meshes.get(pg.userData.pid); if(r){ r.mesh.updateMatrix(); pg.matrix.copy(r.mesh.matrix); pg.matrixWorldNeedsUpdate=true; } } }
function pickLocator(ev){
  if(!locGroup.children.length) return null;
  const r=renderer.domElement.getBoundingClientRect(); ndc.set(((ev.clientX-r.left)/r.width)*2-1, -((ev.clientY-r.top)/r.height)*2+1); ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects(locGroup.children, true).filter(h=>h.object.isMesh);
  if(!hits.length) return null; const o=hits[0].object; let pg=o; while(pg && pg.parent!==locGroup) pg=pg.parent;
  return pg? {pid:pg.userData.pid, lid:o.userData.loc} : null;
}

/* ---- custom locator on a face (advanced) */
let locPick=null;
function startLocPick(p){
  locPick=p.id; $('#pickHint').hidden=false; $('#pickHint').textContent='Cliquez sur la pièce pour poser un repère (direction = face cliquée) — Échap pour annuler';
}
function finishLocPick(hit){
  const p=findPart(locPick); locPick=null; $('#pickHint').hidden=true;
  if(!p || !hit || hit.object.userData.id!==p.id){ toast('Cliquez sur la pièce sélectionnée.'); return; }
  const inv=partMatrix(p).invert(); const pos=hit.point.clone().applyMatrix4(inv);
  const n=hit.face? hit.face.normal.clone().normalize() : new THREE.Vector3(0,0,1);
  const k=(p.locs||[]).filter(l=>!l.auto).length+1; const r=v=>+v.toFixed(3);
  p.locs=[...(p.locs||[]), {id:'f'+Date.now().toString(36), name:'Repère '+k, kind:'face', pos:[r(pos.x),r(pos.y),r(pos.z)], dir:[r(n.x),r(n.y),r(n.z)], auto:false}];
  sync(); commit(); renderInspector();
}

/* ---- inspector panel */
const V_ICON={ok:'✓', warn:'!', err:'✕', none:'○', stale:'↻', info:'i'};
function vChip(state){ return h('span',{class:'vchip v-'+state, title:V_LABEL[state]||''}, V_ICON[state]); }
function renderValidation(body){
  const parts=state.parts; const n=parts.length;
  const cnt=k=>parts.filter(p=>vState(p)===k).length;
  const todo=cnt('none')+cnt('stale'), err=cnt('err');
  body.append(sec('Valider les pièces', h('div',{class:'info',html:'La validation <b>contrôle</b> chaque pièce, mesure sa <b>complexité</b>, crée un <b>proxy</b> allégé si elle est trop lourde et place des <b>repères</b> (centres, axes). L’atelier Mécanique s’appuie sur ces repères.'}),
    h('div',{class:'vsum'}, h('span',{},vChip('ok'),` ${cnt('ok')+cnt('warn')} validée${cnt('ok')+cnt('warn')>1?'s':''}`), h('span',{},vChip('none'),` ${todo} à valider`), err?h('span',{},vChip('err'),` ${err} en erreur`):null),
    h('button',{class:'btn primary',style:'justify-content:center;padding:9px',disabled:n?null:true,onclick:()=>validateAll()}, svgIcon('check'), todo? `Valider ${todo>1?'les '+todo+' pièces':'la pièce'}` : 'Tout revalider')));
  const list=h('div',{class:'vlist'});
  for(const p of parts){ const s=vState(p);
    list.append(h('button',{class:'vrow'+(selection.includes(p.id)?' sel':''),onclick:()=>{ selection=[p.id]; sync(); renderInspector(); }},
      vChip(s), (()=>{ const i=svgIcon(p.kind); i.classList.add('vic'); return i; })(), h('span',{class:'vname'},p.name), h('span',{class:'vtri mono'}, p.valid? `${(p.valid.proxy?p.valid.proxyTris:p.valid.tris).toLocaleString('fr-FR')} △${p.valid.proxy?' proxy':''}`:'')));
  }
  body.append(sec(`Pièces (${n})`, n? list : h('p',{class:'empty'},'Aucune pièce : créez-en dans l’atelier Modéliser.')));
  const p=selection.length===1? findPart(selection[0]) : null; if(!p) return;
  const s=vState(p);
  const d=sec(p.name, h('div',{class:'vstate v-'+s}, vChip(s), V_LABEL[s]));
  if(s==='none'||s==='stale') d.append(h('button',{class:'btn',style:'justify-content:center',onclick:()=>{ validatePart(p); sync(); commit(); renderInspector(); updateSteps(); }}, svgIcon('check'),'Valider cette pièce'));
  if(p.valid){
    d.append(h('ul',{class:'vchecks'}, p.valid.issues.map(i=>h('li',{class:'s-'+i.sev}, vChip(i.sev), h('div',{}, h('b',{},i.title), h('span',{},i.msg))))));
    const t=p.valid.tris, pct=Math.min(100, t/TRI_HEAVY*100);
    d.append(h('div',{class:'cbar',title:`${t} triangles`}, h('i',{style:`width:${pct}%`,class: t<TRI_LIGHT?'c1':t<TRI_HEAVY?'c2':'c3'})), h('div',{class:'cleg'}, h('span',{},'légère'), h('span',{},'moyenne'), h('span',{},'lourde')));
  }
  body.append(d);
  if(p.valid && s!=='stale'){
    const px=sec('Proxy basse résolution', p.valid.proxy
      ? h('div',{class:'info',html:`Proxy de <b>${p.valid.proxyTris.toLocaleString('fr-FR')}</b> triangles au lieu de ${p.valid.tris.toLocaleString('fr-FR')} (−${Math.max(0,Math.round(100-p.valid.proxyTris/p.valid.tris*100))} %). L’atelier Mécanique l’affiche à la place de la pièce.`})
      : h('div',{class:'info'},'Pas de proxy : la pièce est assez légère pour être simulée telle quelle.'),
      h('div',{style:'display:flex;gap:6px;flex-wrap:wrap'},
        h('button',{class:'btn',onclick:()=>toggleProxy(p)}, p.valid.proxy?'Supprimer le proxy':'Créer un proxy'),
        p.valid.proxy? h('label',{class:'chk'}, (()=>{ const c=h('input',{type:'checkbox',checked:CHK.showProxy||null}); c.onchange=()=>{ CHK.showProxy=c.checked; sync(); }; return c; })(), 'Voir le proxy') : null));
    body.append(minLvl(px,2));
    const lsec=sec(`Repères (${(p.locs||[]).length})`, h('div',{class:'info',html:'Les repères marquent les <b>centres</b> et les <b>directions</b> de la pièce. En Mécanique, on accroche les liaisons à ces repères : c’est plus léger que de viser la pièce elle-même.'}),
      locLegend(),
      h('div',{class:'loclist'}, (p.locs||[]).map(l=>{ const F=locFrame(l); const C=axisColors();
        return h('div',{class:'locrow'}, h('i',{class:'lk lk-'+l.kind}), h('span',{class:'locname'},l.name, h('small',{}, `Z ≈ ${nearestAxis(F.z).toUpperCase()}${F.z.getComponent('xyz'.indexOf(nearestAxis(F.z)))<0?'−':'+'}`)),
          h('span',{class:'locbtns'},
            h('button',{class:'tr-btn',title:'Tourner d’un quart de tour autour de Z','aria-label':'Tourner '+l.name,onclick:()=>locEdit(p,l,'rot')},'↻'),
            h('button',{class:'tr-btn',title:'Inverser le sens de Z','aria-label':'Inverser '+l.name,onclick:()=>locEdit(p,l,'flip')},'⇅'),
            h('button',{class:'tr-btn',title:'Prendre X comme axe principal','aria-label':'Basculer '+l.name,onclick:()=>locEdit(p,l,'swap')},'⤨'),
            !l.auto? h('button',{class:'tr-btn danger',title:'Supprimer ce repère','aria-label':'Supprimer '+l.name,onclick:()=>{ p.locs=p.locs.filter(k=>k!==l); sync(); commit(); renderInspector(); }}, svgIcon('trash')) : null)); })),
      minLvl(h('button',{class:'btn',style:'justify-content:center',onclick:()=>startLocPick(p)}, svgIcon('target'),'Ajouter un repère sur une face'),3));
    body.append(minLvl(lsec,2));
  }
}
