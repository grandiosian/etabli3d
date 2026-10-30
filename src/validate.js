
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
  p.locs=[...defaultLocators(p,g), ...(p.locs||[]).filter(l=>!l.auto)];
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

/* ---- locator display (schematic, drawn on top of the parts) */
const locGroup=new THREE.Group(); locGroup.renderOrder=15; scene.add(locGroup);
const LOC_COL={centre:0xdf9a00, base:0x7d8a86, axe:0x1d7656, face:0x8c5ac2};
function locGlyph(l, size, colorHex){
  const g=new THREE.Group(); g.userData.loc=l.id;
  const mat=new THREE.MeshBasicMaterial({color:colorHex, depthTest:false, transparent:true, opacity:.95});
  const lm=c=>new THREE.LineBasicMaterial({color:c, depthTest:false, transparent:true, opacity:.9});
  const s=clamp(size*0.045,0.8,3.2), L=Math.max(10,size*0.6);
  const o=new THREE.Vector3(...l.pos), d=new THREE.Vector3(...l.dir).normalize();
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), d);
  const add=m=>{ m.renderOrder=16; g.add(m); return m; };
  if(l.kind==='centre'){
    add(new THREE.Mesh(new THREE.OctahedronGeometry(s), mat)).position.copy(o);
    for(const [v,c] of [[[1,0,0],0xd2453a],[[0,1,0],0x2f9a4a],[[0,0,1],0x3a6fd8]]){ const e=new THREE.Vector3(...v).multiplyScalar(L*0.45);
      add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([o, o.clone().add(e)]), lm(c))); }
  } else if(l.kind==='base'){
    const ring=add(new THREE.Mesh(new THREE.TorusGeometry(s*1.4, s*0.25, 6, 24), mat)); ring.position.copy(o); ring.quaternion.copy(q);
    add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([o, o.clone().addScaledVector(d,L*0.3)]), lm(colorHex)));
  } else {
    const a=o.clone().addScaledVector(d,-L*0.5), b=o.clone().addScaledVector(d,L*0.5);
    const line=add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]), new THREE.LineDashedMaterial({color:colorHex,dashSize:s*1.4,gapSize:s,depthTest:false,transparent:true}))); line.computeLineDistances();
    const head=add(new THREE.Mesh(new THREE.ConeGeometry(s*0.8, s*2.4, 12), mat)); head.position.copy(b); head.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), d);
    add(new THREE.Mesh(l.kind==='face'? new THREE.OctahedronGeometry(s*0.9) : new THREE.SphereGeometry(s*0.8,12,8), mat)).position.copy(o);
  }
  g.traverse(m=>{ if(m.isMesh) m.userData.loc=l.id; });
  return g;
}
function rebuildLocators(){
  for(const c of [...locGroup.children]){ locGroup.remove(c); c.traverse(m=>{ m.geometry?.dispose(); m.material?.dispose(); }); }
  const show = (ws==='check' || ws==='mech') && lv(2);
  if(!show) return;
  const acc=parseInt((cssVar('--accent')||'#1d7656').slice(1),16);
  for(const p of state.parts){
    if(!p.locs?.length || isHidden(p) || p.hole) continue;
    if(ws==='check' && selection.length && !selection.includes(p.id)) continue;
    const g=getGeometry(p); const sz=new THREE.Vector3(); g.boundingBox.getSize(sz); const size=Math.max(sz.x,sz.y,sz.z);
    const pg=new THREE.Group(); pg.userData.pid=p.id; pg.matrixAutoUpdate=false;
    for(const l of p.locs){ if(ws==='mech' && l.kind==='base') continue; pg.add(locGlyph(l, size, l.kind==='axe'? acc : LOC_COL[l.kind]||0x8c5ac2)); }
    locGroup.add(pg);
  }
  updateLocatorPoses();
}
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
      h('div',{class:'loclist'}, (p.locs||[]).map(l=>h('div',{class:'locrow'}, h('i',{class:'lk lk-'+l.kind}), h('span',{},l.name), h('span',{class:'mono jsub'}, l.kind==='centre'||l.kind==='base'?'':`dir ${nearestAxis(new THREE.Vector3(...l.dir)).toUpperCase()}`),
        !l.auto? h('button',{class:'btn icon ghost danger',title:'Supprimer ce repère',onclick:()=>{ p.locs=p.locs.filter(k=>k!==l); sync(); commit(); renderInspector(); }}, svgIcon('trash')) : null))),
      minLvl(h('button',{class:'btn',style:'justify-content:center',onclick:()=>startLocPick(p)}, svgIcon('target'),'Ajouter un repère sur une face'),3));
    body.append(minLvl(lsec,2));
  }
}
