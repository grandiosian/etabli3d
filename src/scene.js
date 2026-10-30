
/* =========================================================
   Scene
   ========================================================= */
const stage=$('#stage');
const renderer=new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:false});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
renderer.domElement.className='gl';
stage.prepend(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(38,1,0.5,20000);
camera.up.set(0,0,1); camera.position.set(170,-240,180);
const orbit=new OrbitControls(camera, renderer.domElement);
orbit.target.set(0,0,10); orbit.enableDamping=true; orbit.dampingFactor=0.14;
orbit.mouseButtons={LEFT:THREE.MOUSE.ROTATE, MIDDLE:THREE.MOUSE.PAN, RIGHT:THREE.MOUSE.PAN};
orbit.screenSpacePanning=true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9690, 1.5));
const sun=new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(90,-120,260); scene.add(sun);
const fill=new THREE.DirectionalLight(0xffffff, 0.55); fill.position.set(-160,140,90); scene.add(fill);

/* the cutting mat */
const MAT=200;
function matTexture(){
  const N=2048, c=document.createElement('canvas'); c.width=c.height=N; const g=c.getContext('2d');
  const s=N/MAT;
  g.fillStyle='#2c7457'; g.fillRect(0,0,N,N);
  for(let i=0;i<=MAT;i++){
    const major=i%10===0, mid=i%5===0;
    g.strokeStyle= major? 'rgba(255,255,255,.55)' : mid? 'rgba(255,255,255,.26)':'rgba(255,255,255,.12)';
    g.lineWidth= major? 2.4 : mid? 1.6 : 1;
    g.beginPath(); g.moveTo(i*s,0); g.lineTo(i*s,N); g.moveTo(0,i*s); g.lineTo(N,i*s); g.stroke();
  }
  g.fillStyle='rgba(255,255,255,.75)'; g.font='600 22px "IBM Plex Mono",monospace';
  for(let i=10;i<MAT;i+=10){ const v=i-MAT/2; g.textAlign='center'; g.fillText(String(v), i*s, N-12); g.textAlign='left'; g.fillText(String(-v), 8, i*s+8); }
  g.strokeStyle='rgba(255,255,255,.9)'; g.lineWidth=5; g.strokeRect(2,2,N-4,N-4);
  g.font='700 30px "Saira Semi Condensed",sans-serif'; g.fillStyle='rgba(255,255,255,.55)'; g.textAlign='right'; g.fillText('mm', N-14, 36);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;
}
const mat=new THREE.Mesh(new THREE.PlaneGeometry(MAT,MAT), new THREE.MeshStandardMaterial({map:matTexture(), roughness:.95, metalness:0}));
mat.position.z=-0.05; mat.name='mat'; scene.add(mat);
const matEdge=new THREE.Mesh(new THREE.BoxGeometry(MAT+2,MAT+2,1.5), new THREE.MeshStandardMaterial({color:0x22604a, roughness:.9}));
matEdge.position.z=-1.2; scene.add(matEdge);
// axis tripod in the corner
const axes=new THREE.Group(); scene.add(axes); axes.position.set(-MAT/2+8,-MAT/2+8,0.1);
for(const [dir,col] of [[[1,0,0],0xd2453a],[[0,1,0],0x2f9a4a],[[0,0,1],0x3a6fd8]]){
  const a=new THREE.ArrowHelper(new THREE.Vector3(...dir), new THREE.Vector3(), 16, col, 4, 2.4); axes.add(a);
}

function sceneBg(){ scene.background=new THREE.Color(cssVar('--scene')||'#dde5e1'); }
sceneBg();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{ sceneBg(); sync(); });
new MutationObserver(()=>{ sceneBg(); sync(); }).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

function resize(){ const r=stage.getBoundingClientRect(); if(r.width<2||r.height<2) return; renderer.setSize(r.width,r.height,false); camera.aspect=r.width/r.height; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(stage);

/* TransformControls drives an invisible pivot; the selection follows it */
const pivot=new THREE.Object3D(); scene.add(pivot);
const tc=new TransformControls(camera, renderer.domElement);
tc.setSpace('world'); tc.setSize(0.85);
const tcHelper = tc.getHelper ? tc.getHelper() : tc; scene.add(tcHelper);
tc.addEventListener('dragging-changed', e=>{ orbit.enabled=!e.value; });

/* joint markers */
const markers=new THREE.Group(); markers.renderOrder=10; scene.add(markers);

/* =========================================================
   State, history, autosave
   ========================================================= */
let state={name:'Mon projet', parts:[], joints:[], nextId:1};
let selection=[];
let tab='part';
let selJoint=null;
const meshes=new Map();
const hist={stack:[],idx:-1};
function snapshot(){ return JSON.stringify({name:state.name,parts:state.parts,joints:state.joints,nextId:state.nextId}); }
function commit(){
  const s=snapshot(); if(hist.stack[hist.idx]===s) return;
  hist.stack=hist.stack.slice(0,hist.idx+1); hist.stack.push(s); if(hist.stack.length>80) hist.stack.shift(); hist.idx=hist.stack.length-1;
  autosave(); updateUndo();
}
function restore(s, keepSel=true){
  const o=JSON.parse(s); state.name=o.name||'Mon projet'; state.parts=o.parts||[]; state.joints=o.joints||[]; state.nextId=o.nextId||1;
  $('#projName').value=state.name;
  selection = keepSel? selection.filter(id=>findPart(id)) : [];
  if(selJoint && !state.joints.find(j=>j.id===selJoint)) selJoint=null;
  simReset(true); sync(); renderInspector(); autosave(); updateUndo();
}
function undo(){ if(hist.idx>0){ hist.idx--; restore(hist.stack[hist.idx]); } }
function redo(){ if(hist.idx<hist.stack.length-1){ hist.idx++; restore(hist.stack[hist.idx]); } }
function updateUndo(){ $('#bUndo').disabled=hist.idx<=0; $('#bRedo').disabled=hist.idx>=hist.stack.length-1; }
let saveTimer=0;
function autosave(){ clearTimeout(saveTimer); saveTimer=setTimeout(()=>{ try{ localStorage.setItem('etabli3d.autosave', snapshot()); }catch(e){} }, 400); }
function loadProject(obj, push=true){
  if(!obj || !Array.isArray(obj.parts)) throw new Error('format');
  state.name=obj.name||'Projet'; state.parts=obj.parts; state.joints=obj.joints||[]; state.nextId=obj.nextId|| (maxId(obj.parts)+1);
  $('#projName').value=state.name; selection=[]; selJoint=null; simReset(true); sync(); renderInspector();
  if(push){ hist.stack=[]; hist.idx=-1; commit(); }
  fitView();
}
function maxId(parts){ let m=0; for(const p of parts){ m=Math.max(m,p.id); if(p.children) m=Math.max(m,maxId(p.children)); } return m; }

/* =========================================================
   Parts
   ========================================================= */
const findPart=id=>state.parts.find(p=>p.id===id);
function newPart(kind, o={}){
  const K=KINDS[kind]; const n=state.parts.filter(p=>p.kind===kind).length+1;
  return {id:state.nextId++, kind, name:`${K.label} ${n}`, params:clone(K.params), color:K.color, hole:false, pos:[0,0,0], rot:[0,0,0], ...o};
}
function reId(p){ p.id=state.nextId++; if(p.children) p.children.forEach(reId); return p; }
function freeSpot(size){
  const boxes=[...meshes.values()].map(r=>new THREE.Box3().setFromObject(r.mesh));
  const step=Math.max(25, Math.ceil((Math.max(size.x,size.y)+8)/10)*10);
  const cand=[]; for(let i=-5;i<=5;i++) for(let j=-5;j<=5;j++) cand.push([i*step,j*step]);
  const score=([x,y])=>Math.max(Math.abs(x),Math.abs(y))*10 + (y>0?2:0) + (x<0?1:0) + Math.abs(y)/step*3;
  cand.sort((a,b)=>score(a)-score(b));
  for(const [x,y] of cand){
    const b=new THREE.Box3(new THREE.Vector3(x-size.x/2-2,y-size.y/2-2,-1), new THREE.Vector3(x+size.x/2+2,y+size.y/2+2,1e4));
    if(!boxes.some(o=>o.intersectsBox(b))) return [x,y];
  }
  return [0,0];
}
function addPart(kind, at=null, extra={}){
  if(simLocked()){ toast('Réinitialisez la simulation avant de modifier la scène.'); return null; }
  const p=newPart(kind, extra);
  const g=getGeometry(p); const s=new THREE.Vector3(); g.boundingBox.getSize(s);
  const [x,y]= at || freeSpot(s);
  p.pos=[Math.round(x*10)/10, Math.round(y*10)/10, 0];
  state.parts.push(p); selection=[p.id]; sync(); commit(); setTab('part'); renderInspector();
  return p;
}

/* =========================================================
   Scene sync
   ========================================================= */
const edgeCache=new WeakMap();
function edgesOf(g, boxOnly=false){ let e=edgeCache.get(g); if(!e){
  if(boxOnly){ const b=g.boundingBox, n=b.min, x=b.max; const v=[[n.x,n.y,n.z],[x.x,n.y,n.z],[x.x,x.y,n.z],[n.x,x.y,n.z],[n.x,n.y,x.z],[x.x,n.y,x.z],[x.x,x.y,x.z],[n.x,x.y,x.z]];
    const E=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]; e=new THREE.BufferGeometry(); e.setAttribute('position',new THREE.Float32BufferAttribute(E.flatMap(([a,c])=>[...v[a],...v[c]]),3)); }
  else e=new THREE.EdgesGeometry(g, 28);
  edgeCache.set(g,e);} return e; }
const selLineMat=new THREE.LineBasicMaterial({color:0xdf9a00, depthTest:true});
const holeLineMat=new THREE.LineBasicMaterial({color:0x37413e, transparent:true, opacity:.55});
function sync(){
  const ids=new Set();
  const markCol=cssVar('--mark')||'#df9a00'; selLineMat.color.set(markCol);
  const holeCol=cssVar('--hole')||'#7b8985';
  for(const p of state.parts){
    ids.add(p.id);
    let r=meshes.get(p.id);
    if(!r){ const m=new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({roughness:.5,metalness:.04})); m.userData.id=p.id; m.matrixAutoUpdate=true; scene.add(m); r={mesh:m,key:null,line:null}; meshes.set(p.id,r); }
    const key=geomKey(p);
    if(r.key!==key){ r.mesh.geometry=getGeometry(p); r.key=key; if(r.line){ r.mesh.remove(r.line); r.line=null; } }
    const mt=r.mesh.material; const sel=selection.includes(p.id);
    if(p.hole){ mt.color.set(holeCol); mt.transparent=true; mt.opacity=.36; mt.depthWrite=false; }
    else { mt.color.set(p.color); mt.transparent=false; mt.opacity=1; mt.depthWrite=true; }
    mt.emissive.set(sel? markCol : '#000000'); mt.emissiveIntensity= sel? .16:0;
    r.mesh.renderOrder = p.hole? 2:0;
    const wantLine = sel || p.hole;
    if(wantLine){ if(!r.line){ r.line=new THREE.LineSegments(edgesOf(r.mesh.geometry, p.kind==='group'), selLineMat); r.mesh.add(r.line); } r.line.material= sel? selLineMat : holeLineMat; }
    else if(r.line){ r.mesh.remove(r.line); r.line=null; }
    if(!simActive()){ partMatrix(p, r.mesh.matrix); r.mesh.matrix.decompose(r.mesh.position, r.mesh.quaternion, r.mesh.scale); }
  }
  for(const [id,r] of meshes) if(!ids.has(id)){ scene.remove(r.mesh); r.mesh.material.dispose(); meshes.delete(id); }
  if(simActive()) applyPoses();
  updateGizmo(); updateMarkers(); updateToolButtons(); $('#jCount').textContent=state.joints.length;
}
function updateGizmo(){
  if(!selection.length || simLocked() || pickMode){ tc.detach(); return; }
  resetPivot(); tc.attach(pivot);
}
function selBox(ids=selection){ const b=new THREE.Box3(); for(const id of ids){ const r=meshes.get(id); if(r) b.union(new THREE.Box3().setFromObject(r.mesh, true)); } return b; }
function resetPivot(){ const b=selBox(); if(b.isEmpty()) return; const c=new THREE.Vector3(); b.getCenter(c); pivot.position.set(c.x,c.y,b.min.z); pivot.quaternion.identity(); pivot.updateMatrixWorld(true); }

let dragStart=null;
tc.addEventListener('mouseDown', ()=>{ if(down){ down.drag=null; down.gizmo=true; } pivot.updateMatrixWorld(true); dragStart={pm:pivot.matrixWorld.clone(), items:selection.map(id=>({id, m:meshes.get(id).mesh.matrix.clone()}))}; });
tc.addEventListener('objectChange', ()=>{
  if(!dragStart) return; pivot.updateMatrixWorld(true);
  const d=pivot.matrixWorld.clone().multiply(dragStart.pm.clone().invert());
  for(const it of dragStart.items){ const r=meshes.get(it.id); const m=d.clone().multiply(it.m); m.decompose(r.mesh.position,r.mesh.quaternion,r.mesh.scale); r.mesh.updateMatrix(); }
  liveInspector();
});
tc.addEventListener('mouseUp', ()=>{
  if(!dragStart) return;
  for(const it of dragStart.items){ const p=findPart(it.id), r=meshes.get(it.id); if(p&&r){ r.mesh.updateMatrix(); setPartFromMatrix(p, r.mesh.matrix); } }
  dragStart=null; sync(); commit(); renderInspector();
});
function setGizmoMode(m){ tc.setMode(m); $('#tMove').classList.toggle('on',m==='translate'); $('#tRot').classList.toggle('on',m==='rotate'); }
function applySnap(){ const v=+$('#snapSel').value; tc.setTranslationSnap(v>0?v:null); tc.setRotationSnap(v>0? 15*DEG : null); }

/* =========================================================
   Picking and dragging parts on the mat
   ========================================================= */
const ray=new THREE.Raycaster(); const ndc=new THREE.Vector2();
function pickAt(ev){
  const r=renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX-r.left)/r.width)*2-1, -((ev.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects([...meshes.values()].map(r=>r.mesh), false);
  // prefer solids over holes when a solid is in front
  return hits[0]||null;
}
function planeHit(ev, z){
  const r=renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX-r.left)/r.width)*2-1, -((ev.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera);
  const pt=new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1), -z), pt) ? pt : null;
}
let down=null;
renderer.domElement.addEventListener('pointerdown', ev=>{
  if(ev.button!==0){ down=null; return; }
  const onGizmo = tc.axis!==null && tc.object;
  down={x:ev.clientX,y:ev.clientY,gizmo:onGizmo,drag:null,moved:false};
  if(onGizmo || pickMode) return;
  const hit=pickAt(ev);
  if(hit && !simLocked()){
    const id=hit.object.userData.id;
    if(!selection.includes(id) && !ev.shiftKey){ selection=[id]; sync(); renderInspector(); }
    if(selection.includes(id)){
      orbit.enabled=false;
      down.drag={z:hit.point.z, start:hit.point.clone(), items:selection.map(i=>({id:i, pos:[...findPart(i).pos]}))};
      renderer.domElement.setPointerCapture(ev.pointerId);
    }
  }
}, true);
renderer.domElement.addEventListener('pointermove', ev=>{
  if(!down||!down.drag) return;
  if(!down.moved && Math.hypot(ev.clientX-down.x, ev.clientY-down.y)<4) return;
  down.moved=true;
  const pt=planeHit(ev, down.drag.z); if(!pt) return;
  const snap=+$('#snapSel').value;
  let dx=pt.x-down.drag.start.x, dy=pt.y-down.drag.start.y;
  if(snap>0){ dx=Math.round(dx/snap)*snap; dy=Math.round(dy/snap)*snap; }
  for(const it of down.drag.items){ const p=findPart(it.id); p.pos=[+(it.pos[0]+dx).toFixed(4), +(it.pos[1]+dy).toFixed(4), it.pos[2]]; const r=meshes.get(it.id); r.mesh.position.set(...p.pos); }
  resetPivot(); liveInspector();
});
renderer.domElement.addEventListener('pointerup', ev=>{
  orbit.enabled=true;
  if(!down) return; const d=down; down=null;
  if(d.drag && d.moved){ sync(); commit(); renderInspector(); return; }
  if(d.gizmo) return;
  if(Math.hypot(ev.clientX-d.x, ev.clientY-d.y)>4) return;
  const hit=pickAt(ev);
  if(pickMode){ pickMode(hit?hit.point:null, hit); return; }
  if(!hit){ if(!ev.shiftKey && selection.length){ selection=[]; sync(); renderInspector(); } return; }
  const id=hit.object.userData.id;
  if(ev.shiftKey){ selection = selection.includes(id)? selection.filter(i=>i!==id) : [...selection,id]; }
  else selection=[id];
  sync(); renderInspector();
});
renderer.domElement.addEventListener('dblclick', ev=>{
  const hit=pickAt(ev); if(!hit) return; const p=findPart(hit.object.userData.id);
  if(p && p.kind==='sketch' && !simLocked()) openSketch(p);
});

/* palette drag & drop onto the mat */
function startPaletteDrag(kind, ev){
  const ghost=$('#dropGhost'); let moved=false; const sx=ev.clientX, sy=ev.clientY;
  const move=e=>{ if(!moved && Math.hypot(e.clientX-sx,e.clientY-sy)>6){ moved=true; ghost.hidden=false; icon(kind,ghost); }
    if(moved){ ghost.style.left=e.clientX+'px'; ghost.style.top=e.clientY+'px'; } };
  const up=e=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); ghost.hidden=true;
    if(!moved){ addPart(kind); return; }
    const r=renderer.domElement.getBoundingClientRect();
    if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){
      const pt=planeHit(e,0); if(pt){ const s=+$('#snapSel').value||1; addPart(kind,[Math.round(pt.x/s)*s, Math.round(pt.y/s)*s]); }
    } };
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
}

/* =========================================================
   Editing operations
   ========================================================= */
function guard(){ if(simLocked()){ toast('Réinitialisez la simulation (bouton ⟲) pour modifier les pièces.'); return false; } return true; }
function selParts(){ return selection.map(findPart).filter(Boolean); }
function removeJointsOf(ids){
  const before=state.joints.length;
  state.joints=state.joints.filter(j=>!ids.includes(j.child) && !ids.includes(j.parent));
  // drop broken transmissions
  for(const j of state.joints) if(j.driver && !state.joints.find(k=>k.id===j.driver.joint)) j.driver=null;
  return before-state.joints.length;
}
function deleteSel(){
  if(!selection.length||!guard()) return;
  const n=removeJointsOf(selection);
  state.parts=state.parts.filter(p=>!selection.includes(p.id)); selection=[]; sync(); commit(); renderInspector();
  if(n) toast(`${n} liaison${n>1?'s':''} supprimée${n>1?'s':''} avec la pièce.`);
}
function duplicateSel(){
  if(!selection.length||!guard()) return;
  const copies=selParts().map(p=>{ const c=reId(clone(p)); c.pos=[c.pos[0]+10,c.pos[1]+10,c.pos[2]]; c.name=p.name+' (copie)'; return c; });
  state.parts.push(...copies); selection=copies.map(c=>c.id); sync(); commit(); renderInspector();
}
function setHole(v){
  if(!selection.length||!guard()) return;
  selParts().forEach(p=>p.hole=v); sync(); commit(); renderInspector();
}
function dropSel(){
  if(!selection.length||!guard()) return;
  for(const p of selParts()){ const b=new THREE.Box3().setFromObject(meshes.get(p.id).mesh,true); p.pos[2]=+(p.pos[2]-b.min.z).toFixed(4); }
  sync(); commit(); renderInspector();
}
function nudge(dx,dy,dz){
  if(!selection.length||!guard()) return;
  for(const p of selParts()){ p.pos=[+(p.pos[0]+dx).toFixed(4),+(p.pos[1]+dy).toFixed(4),+(p.pos[2]+dz).toFixed(4)]; }
  sync(); commit(); liveInspector();
}
function groupSel(){
  if(selection.length<2){ toast('Sélectionnez au moins deux pièces (Maj + clic) pour les grouper.'); return; }
  if(!guard()) return;
  const parts=selParts();
  const n=removeJointsOf(selection);
  const solids=parts.filter(p=>!p.hole);
  const b=selBox((solids.length?solids:parts).map(p=>p.id)); const c=new THREE.Vector3(); b.getCenter(c);
  const G={id:state.nextId++, kind:'group', name:`Groupe ${state.parts.filter(p=>p.kind==='group').length+1}`, params:{}, color:(solids[0]||parts[0]).color,
    hole: solids.length===0, pos:[+c.x.toFixed(3),+c.y.toFixed(3),+b.min.z.toFixed(3)], rot:[0,0,0], children:[]};
  const inv=partMatrix(G).invert();
  for(const p of parts){ const ch=clone(p); setPartFromMatrix(ch, inv.clone().multiply(partMatrix(p))); G.children.push(ch); }
  state.parts=state.parts.filter(p=>!selection.includes(p.id)); state.parts.push(G); selection=[G.id];
  sync(); commit(); renderInspector();
  const holes=parts.length-solids.length;
  toast(holes&&solids.length? `Groupe créé : ${holes} perçage${holes>1?'s':''} retiré${holes>1?'s':''} de la matière.` : 'Groupe créé.');
  if(n) setTimeout(()=>toast(`${n} liaison${n>1?'s':''} supprimée${n>1?'s':''} : recréez-les sur le groupe.`),2700);
}
function ungroupSel(){
  const gs=selParts().filter(p=>p.kind==='group'); if(!gs.length){ toast('Sélectionnez un groupe à dégrouper.'); return; }
  if(!guard()) return;
  removeJointsOf(gs.map(g=>g.id));
  const out=[];
  for(const G of gs){ const M=partMatrix(G); for(const ch of G.children){ const c=clone(ch); setPartFromMatrix(c, M.clone().multiply(partMatrix(ch))); out.push(c); } }
  state.parts=state.parts.filter(p=>!gs.includes(p)); state.parts.push(...out); selection=out.map(c=>c.id);
  sync(); commit(); renderInspector();
}
function alignSel(axis, mode){
  if(selection.length<2||!guard()) return;
  const all=selBox(); const ai={x:0,y:1,z:2}[axis];
  const target= mode==='min'? all.min[axis] : mode==='max'? all.max[axis] : (all.min[axis]+all.max[axis])/2;
  for(const p of selParts()){ const b=selBox([p.id]); const v= mode==='min'? b.min[axis] : mode==='max'? b.max[axis] : (b.min[axis]+b.max[axis])/2; p.pos[ai]=+(p.pos[ai]+target-v).toFixed(4); }
  sync(); commit(); renderInspector();
}
function updateToolButtons(){
  const n=selection.length, lock=simLocked(); const ps=selParts();
  const set=(id,dis)=>{ $(id).disabled=dis; };
  set('#tSolid',!n||lock); set('#tHole',!n||lock); set('#tGroup',n<2||lock); set('#tUngroup',!ps.some(p=>p.kind==='group')||lock);
  set('#tDup',!n||lock); set('#tDrop',!n||lock); set('#tDel',!n||lock); set('#tMove',lock); set('#tRot',lock);
  $('#tHole').classList.toggle('on', n>0 && ps.every(p=>p.hole)); $('#tSolid').classList.toggle('on', n>0 && ps.every(p=>!p.hole));
}

/* =========================================================
   Camera
   ========================================================= */
function sceneBox(){ const b=new THREE.Box3(); for(const r of meshes.values()) b.union(new THREE.Box3().setFromObject(r.mesh)); if(b.isEmpty()) b.set(new THREE.Vector3(-40,-40,0), new THREE.Vector3(40,40,20)); return b; }
function setView(kind){
  const b = kind==='fit'||!selection.length ? sceneBox() : selBox();
  const c=new THREE.Vector3(); b.getCenter(c); const s=new THREE.Vector3(); b.getSize(s);
  const R=Math.max(30, s.length()*0.6);
  const dist=R/Math.sin(camera.fov*DEG/2)*1.05;
  const dirs={iso:[0.55,-0.75,0.6], top:[0,-0.0001,1], front:[0,-1,0.0001], right:[1,0,0.0001], fit:null};
  let d = dirs[kind] ? new THREE.Vector3(...dirs[kind]).normalize() : camera.position.clone().sub(orbit.target).normalize();
  animateCam(c, c.clone().add(d.multiplyScalar(dist)));
}
function fitView(){ const c=new THREE.Vector3(); const b=sceneBox(); b.getCenter(c); const s=new THREE.Vector3(); b.getSize(s); const R=Math.max(35,s.length()*0.5); const dist=R/Math.sin(camera.fov*DEG/2); camera.position.copy(c.clone().add(new THREE.Vector3(0.55,-0.75,0.62).normalize().multiplyScalar(dist))); orbit.target.copy(c); orbit.update(); }
let camAnim=null;
function animateCam(target, pos){ camAnim={t0:performance.now(), ft:orbit.target.clone(), fp:camera.position.clone(), tt:target, tp:pos}; }
function stepCam(now){
  if(!camAnim) return; const k=clamp((now-camAnim.t0)/420,0,1); const e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
  orbit.target.lerpVectors(camAnim.ft,camAnim.tt,e); camera.position.lerpVectors(camAnim.fp,camAnim.tp,e); if(k>=1) camAnim=null;
}
