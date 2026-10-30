
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
  const M=MATS[prefs.mat]||MATS.vert; const ink=a=>`rgba(${M.ink},${a})`;
  g.fillStyle=M.fill; g.fillRect(0,0,N,N);
  for(let i=0;i<=MAT;i++){
    const major=i%10===0, mid=i%5===0;
    g.strokeStyle= major? ink(.55) : mid? ink(.26):ink(.12);
    g.lineWidth= major? 2.4 : mid? 1.6 : 1;
    g.beginPath(); g.moveTo(i*s,0); g.lineTo(i*s,N); g.moveTo(0,i*s); g.lineTo(N,i*s); g.stroke();
  }
  g.fillStyle=ink(.75); g.font='600 22px "IBM Plex Mono",monospace';
  for(let i=10;i<MAT;i+=10){ const v=i-MAT/2; g.textAlign='center'; g.fillText(String(v), i*s, N-12); g.textAlign='left'; g.fillText(String(-v), 8, i*s+8); }
  g.strokeStyle=ink(.9); g.lineWidth=5; g.strokeRect(2,2,N-4,N-4);
  g.font='700 30px "Saira Semi Condensed",sans-serif'; g.fillStyle=ink(.55); g.textAlign='right'; g.fillText('mm', N-14, 36);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;
}
const mat=new THREE.Mesh(new THREE.PlaneGeometry(MAT,MAT), new THREE.MeshStandardMaterial({map:matTexture(), roughness:.95, metalness:0}));
mat.position.z=-0.05; mat.name='mat'; scene.add(mat);
const matEdge=new THREE.Mesh(new THREE.BoxGeometry(MAT+2,MAT+2,1.5), new THREE.MeshStandardMaterial({color:(MATS[prefs.mat]||MATS.vert).edge, roughness:.9}));
function refreshMat(){ const old=mat.material.map; mat.material.map=matTexture(); mat.material.needsUpdate=true; old?.dispose(); matEdge.material.color.setHex((MATS[prefs.mat]||MATS.vert).edge); }
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

/* The settings panel floats over the 3D view (see-through): the WebGL canvas extends under it by OVR.l / OVR.r px.
   STG is the visible stage size; toStage() projects a world point to stage coordinates. */
const OVR={l:0,r:0,t:0}, STG={w:0,h:0}; const _pv=new THREE.Vector3();
function resize(){ const r=stage.getBoundingClientRect(); if(r.width<2||r.height<2) return; STG.w=r.width; STG.h=r.height; const W=r.width+OVR.l+OVR.r, H=r.height+OVR.t;
  renderer.setSize(W,H,false); camera.aspect=W/H; camera.updateProjectionMatrix(); applyViewOffset(); }
function toStage(v){ _pv.copy(v).project(camera); const W=STG.w+OVR.l+OVR.r, H=STG.h+OVR.t;
  return {x:(_pv.x+1)/2*W-OVR.l, y:(1-_pv.y)/2*H-OVR.t, vis:_pv.z<1 && _pv.z>-1 && Math.abs(_pv.x)<1.2 && Math.abs(_pv.y)<1.2}; }
/* stage coordinates of a pointer event */
function evStage(ev){ const r=stage.getBoundingClientRect(); return [ev.clientX-r.left, ev.clientY-r.top]; }
/* On wide screens the demo card covers the left of the scene: shift the picture right by half its width. */
function applyViewOffset(){
  const r=stage.getBoundingClientRect(); if(r.width<2||r.height<2) return; const d=document.getElementById('demo');
  const shift = (d && !d.hidden && r.width>760 && !movedDemo() && d.parentElement===stage) ? Math.round((d.offsetWidth+10)/2) : 0;
  const W=r.width+OVR.l+OVR.r, H=r.height+OVR.t, x=(OVR.r-OVR.l)/2-shift+rightReserve()/2, y=-OVR.t/2;   // centre the picture in the part of the view left free
  if(x||y) camera.setViewOffset(W,H,x,y,W,H); else camera.clearViewOffset();
}
new ResizeObserver(resize).observe(stage);

/* TransformControls drives an invisible pivot; the selection follows it */
const pivot=new THREE.Object3D(); scene.add(pivot);
const tc=new TransformControls(camera, renderer.domElement);
tc.setSpace('world'); tc.setSize(0.85);
const tcHelper = tc.getHelper ? tc.getHelper() : tc; scene.add(tcHelper);
tc.addEventListener('dragging-changed', e=>{ orbit.enabled=!e.value; });
/* no free « camera plane » handle in the middle of the move gizmo: moving is done along the axes or on the floor */
{ const gz=tc._gizmo; if(gz) for(const set of [gz.gizmo?.translate, gz.picker?.translate, gz.helper?.translate]) if(set) for(const o of [...set.children]) if(o.name==='XYZ') set.remove(o); }

/* joint markers */
const markers=new THREE.Group(); markers.renderOrder=10; scene.add(markers);

/* =========================================================
   State, history, autosave
   ========================================================= */
let state={name:'Mon projet', parts:[], joints:[], nextId:1, note:null};
let selection=[];
let ws='model';   // atelier: model | check | mech | struct
let selJoint=null;
const meshes=new Map();
const hist={stack:[],idx:-1};
function snapshot(){ return JSON.stringify({name:state.name,parts:state.parts,joints:state.joints,nextId:state.nextId,note:state.note||null,struct:state.struct||null,edit:state.edit||null}); }
function commit(){
  const s=snapshot(); if(hist.stack[hist.idx]===s) return;
  hist.stack=hist.stack.slice(0,hist.idx+1); hist.stack.push(s); if(hist.stack.length>80) hist.stack.shift(); hist.idx=hist.stack.length-1;
  autosave(); updateUndo();
}
function restore(s, keepSel=true){
  const o=JSON.parse(s); state.name=o.name||'Mon projet'; state.parts=o.parts||[]; state.joints=o.joints||[]; state.nextId=o.nextId||1; state.note=o.note||null; state.struct=o.struct||null; state.edit=o.edit||null;
  $('#projName').value=state.name; updateGroupEditUI();
  selection = keepSel? selection.filter(id=>findPart(id)) : []; renderDemo();
  if(selJoint && !state.joints.find(j=>j.id===selJoint)) selJoint=null;
  simReset(true); sync(); renderInspector(); autosave(); updateUndo(); updateSteps();
  if(ws==='struct'){ computeStruct(); stDraw(); if(ST.mode3d) buildStruct3D(); }
}
function undo(){ if(hist.idx>0){ hist.idx--; restore(hist.stack[hist.idx]); } }
function redo(){ if(hist.idx<hist.stack.length-1){ hist.idx++; restore(hist.stack[hist.idx]); } }
function updateUndo(){ $('#bUndo').disabled=hist.idx<=0; $('#bRedo').disabled=hist.idx>=hist.stack.length-1; }
let saveTimer=0;
function autosave(){ clearTimeout(saveTimer); saveTimer=setTimeout(()=>{ try{ localStorage.setItem('etabli3d.autosave', snapshot()); }catch(e){} }, 400); }
function loadProject(obj, push=true){
  if(!obj || !Array.isArray(obj.parts)) throw new Error('format');
  state.name=obj.name||'Projet'; state.parts=obj.parts; state.joints=obj.joints||[]; state.nextId=obj.nextId|| (maxId(obj.parts)+1); state.note=obj.note||null; state.struct=obj.struct||null; state.edit=obj.edit||null; demoClosed=false;
  $('#projName').value=state.name; selection=[]; selJoint=null; simReset(true); sync(); renderInspector(); renderDemo();
  if(push){ hist.stack=[]; hist.idx=-1; commit(); }
  fitView();
}
function maxId(parts){ let m=0; for(const p of parts){ m=Math.max(m,p.id); if(p.children) m=Math.max(m,maxId(p.children)); } return m; }

/* =========================================================
   Parts
   ========================================================= */
const findPart=id=>state.parts.find(p=>p.id===id);
/* Hiding and locking are advanced features: below level 3 every part is visible and free. */
const isHidden=p=> lv(3) && !!p?.hidden;
const isLocked=p=> lv(3) && !!p?.locked;
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
  if(state.edit) p.inGroup=state.edit.gid;
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
    const px=usesProxy(p); const key=geomKey(p)+(px?'#proxy':'');
    if(r.key!==key){ r.mesh.geometry= px? getProxyGeo(p) : getGeometry(p); r.key=key; if(r.line){ r.mesh.remove(r.line); r.line=null; } r.mesh.material.flatShading=px; r.mesh.material.needsUpdate=true; }
    const mt=r.mesh.material; const sel=selection.includes(p.id);
    if(p.hole){ mt.color.set(holeCol); mt.transparent=true; mt.opacity=.36; mt.depthWrite=false; }
    else { mt.color.set(p.color); mt.transparent=false; mt.opacity=1; mt.depthWrite=true; }
    if(state.edit && p.inGroup!==state.edit.gid && ws==='model'){ mt.transparent=true; mt.opacity=p.hole? .12 : .18; mt.depthWrite=false; }   // outside the group being edited
    mt.emissive.set(sel? markCol : '#000000'); mt.emissiveIntensity= sel? .16:0;
    r.mesh.renderOrder = p.hole? 2:0;
    const wantLine = sel || p.hole;
    if(wantLine){ if(!r.line){ r.line=new THREE.LineSegments(edgesOf(r.mesh.geometry, p.kind==='group'), selLineMat); r.mesh.add(r.line); } r.line.material= sel? selLineMat : holeLineMat; }
    else if(r.line){ r.mesh.remove(r.line); r.line=null; }
    r.mesh.visible=!isHidden(p) && ws!=='struct';
    if(!simActive()){ partMatrix(p, r.mesh.matrix); r.mesh.matrix.decompose(r.mesh.position, r.mesh.quaternion, r.mesh.scale); }
  }
  for(const [id,r] of meshes) if(!ids.has(id)){ scene.remove(r.mesh); r.mesh.material.dispose(); meshes.delete(id); }
  if(simActive()) applyPoses();
  updateGizmo(); updateMarkers(); updateToolButtons();
  rebuildLocators(); updateSteps();
  renderOutliner();
}
function updateGizmo(){
  if(ws!=='model' || !selection.length || !GZ.mode || simLocked() || pickMode || selParts().some(isLocked) || (GZ.mode==='scale' && selParts().some(p=>!SCALE_MAP[p.kind]))){ tc.detach(); return; }
  resetPivot(); tc.attach(pivot);
}
function selBox(ids=selection){ const b=new THREE.Box3(); for(const id of ids){ const r=meshes.get(id); if(r) b.union(new THREE.Box3().setFromObject(r.mesh, true)); } return b; }
function resetPivot(){ const b=selBox(); if(b.isEmpty()) return; const c=new THREE.Vector3(); b.getCenter(c); pivot.position.set(c.x,c.y,b.min.z); pivot.quaternion.identity(); pivot.scale.set(1,1,1); pivot.updateMatrixWorld(true); }

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
  const scaling= tc.mode==='scale'; const s=pivot.scale.clone();
  for(const it of dragStart.items){ const p=findPart(it.id), r=meshes.get(it.id); if(!p||!r) continue; r.mesh.updateMatrix();
    if(scaling){ const pos=new THREE.Vector3(), q=new THREE.Quaternion(), sc=new THREE.Vector3(); r.mesh.matrix.decompose(pos,q,sc);
      const R=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...p.rot.map(a=>a*DEG),'XYZ')); const ax=[0,1,2].map(i=>new THREE.Vector3().setFromMatrixColumn(R,i));
      const f=ax.map(u=>Math.hypot(u.x*s.x,u.y*s.y,u.z*s.z));   // how much each of the part's own axes was stretched
      scaleParams(p,f); p.pos=[+pos.x.toFixed(3),+pos.y.toFixed(3),+pos.z.toFixed(3)]; }
    else setPartFromMatrix(p, r.mesh.matrix); }
  pivot.scale.set(1,1,1); dragStart=null; sync(); commit(); renderInspector();
});
/* the manipulation gizmo only appears once a manipulation is chosen (hover icons, toolbar, M / R / T keys) */
const GZ={mode:null};   // the three.js TransformControls are no longer shown: see gizmo.js (Tinkercad-like handles)
function setGizmoMode(m){ GZ.mode=null; updateGizmo(); }
/* resizing with the gizmo changes the part's own dimensions (rounded to 0.1 mm) */
const SCALE_MAP={box:{L:'x',l:'y',h:'z'}, pyramid:{L:'x',l:'y',h:'z'}, wedge:{L:'x',l:'y',h:'z'}, cylinder:{d:'xy',h:'z'}, cone:{d:'xy',d2:'xy',h:'z'},
  tube:{d:'xy',di:'xy',h:'z'}, sphere:{d:'xyz'}, torus:{d:'xy',e:'z'}, text:{size:'xy',h:'z'}, gear:{m:'xy',dh:'xy',e:'z'}, rack:{m:'x',hb:'y',e:'z'}, sketch:{h:'z'}};
function scaleParams(p, f){ const M=SCALE_MAP[p.kind]; if(!M) return;
  const one=v=>Math.abs(v-1)<1e-9, xy= one(f[0])? f[1] : one(f[1])? f[0] : (f[0]+f[1])/2;   // a round part dragged on one side follows that side
  const F={x:f[0],y:f[1],z:f[2],xy,xyz: one(f[0])&&one(f[1])? f[2] : one(f[2])? xy : (f[0]+f[1]+f[2])/3};
  for(const [k,a] of Object.entries(M)) if(typeof p.params[k]==='number' && p.params[k]>0) p.params[k]=Math.max(0.1, Math.round(p.params[k]*F[a]*10)/10);
  if(p.kind==='sketch' && p.params.sk && (!one(f[0]) || !one(f[1]))) scaleSketch(p.params.sk, f[0], f[1]); }
/* stretch a sketch: points, circles, Bézier handles, and the values of its dimensions so that it stays solved */
function scaleSketch(sk, fx, fy){
  for(const q of sk.pts){ q.x=+(q.x*fx).toFixed(4); q.y=+(q.y*fy).toFixed(4); }
  const g=Math.sqrt(fx*fy); for(const c of sk.circles) c.r=+(c.r*g).toFixed(4);
  for(const z of sk.beziers||[]) for(const t of ['t1','t2']) if(z[t]) z[t]=[z[t][0]*fx, z[t][1]*fy];
  const P=new Map(sk.pts.map(q=>[q.id,q])), C=new Map(sk.circles.map(c=>[c.id,c]));
  for(const c of sk.cons){
    if(c.type==='dx'){ const a=P.get(c.a), b=P.get(c.b); if(a&&b) c.value=+Math.abs(b.x-a.x).toFixed(4); }
    else if(c.type==='dy'){ const a=P.get(c.a), b=P.get(c.b); if(a&&b) c.value=+Math.abs(b.y-a.y).toFixed(4); }
    else if(c.type==='dist'){ const a=P.get(c.a), b=P.get(c.b); if(a&&b) c.value=+Math.hypot(b.x-a.x,b.y-a.y).toFixed(4); }
    else if(c.type==='diam'){ const ci=C.get(c.c); if(ci) c.value=+(ci.r*2).toFixed(4); }
    if(typeof c.off==='number') c.off*=g;
  }
}
function applySnap(){ const v=+$('#snapSel').value; tc.setTranslationSnap(v>0?v:null); tc.setRotationSnap(v>0? 15*DEG : null); }

/* =========================================================
   Picking and dragging parts on the mat
   ========================================================= */
const ray=new THREE.Raycaster(); const ndc=new THREE.Vector2();
/* while a group is open for editing, only its pieces can be picked (in Modéliser) */
const editable=p=> !state.edit || ws!=='model' || p?.inGroup===state.edit.gid;
function pickAt(ev){
  const r=renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX-r.left)/r.width)*2-1, -((ev.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects([...meshes.entries()].filter(([id,r])=>{ const p=findPart(id); return r.mesh.visible && !isLocked(p) && editable(p); }).map(([,r])=>r.mesh), false);
  return hits[0]||null;
}
/* every part under the cursor, front to back (one entry per part) */
function pickAll(ev){
  const r=renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX-r.left)/r.width)*2-1, -((ev.clientY-r.top)/r.height)*2+1); ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects([...meshes.entries()].filter(([id,r])=>r.mesh.visible && !isLocked(findPart(id)) && editable(findPart(id))).map(([,r])=>r.mesh), false);
  const seen=new Set(); return hits.filter(h=>{ const id=h.object.userData.id; if(seen.has(id)) return false; seen.add(id); return true; });
}
function planeHit(ev, z){
  const r=renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX-r.left)/r.width)*2-1, -((ev.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera);
  const pt=new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1), -z), pt) ? pt : null;
}
let down=null;
/* ---- smart snapping while a part is dragged on the floor: its edges and centre line up with those of
   the other parts (or touch them), within a few pixels; dashed guides show what it lines up with. Alt: off. */
function snapTargets(){ const out=[]; for(const p of state.parts){ if(selection.includes(p.id) || !editable(p)) continue; const r=meshes.get(p.id); if(!r || !r.mesh.visible) continue; out.push(new THREE.Box3().setFromObject(r.mesh)); } return out; }
const guideMat=new THREE.LineDashedMaterial({color:0xd6457a, dashSize:2, gapSize:1.5, depthTest:false, transparent:true});
const guides=new THREE.LineSegments(new THREE.BufferGeometry(), guideMat); guides.renderOrder=15; guides.frustumCulled=false; scene.add(guides);
let SNAPSEG=[];   // drawn as dashed lines over the view by tgTick (gizmo.js)
function showGuides(segs){
  SNAPSEG=segs; guides.visible=false; if(!segs.length) return;
  const pos=[]; for(const [a,b] of segs) pos.push(a.x,a.y,a.z,b.x,b.y,b.z);
  guides.geometry.dispose(); guides.geometry=new THREE.BufferGeometry(); guides.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); guides.computeLineDistances();
  guideMat.color.set(cssVar('--mark')||'#df9a00');
}
function smartSnap(D, dx, dy){
  const B=D.box0; if(!B || B.isEmpty() || !D.others.length) return {dx,dy};
  const c=B.getCenter(new THREE.Vector3()).add(new THREE.Vector3(dx,dy,0));
  const wpp=2*camera.position.distanceTo(c)*Math.tan(camera.fov*DEG/2)/Math.max(1,renderer.domElement.clientHeight);   // mm per pixel there
  const thr=9*wpp, segs=[], z=Math.max(0.05, B.min.z+0.05);
  const axis=(k, d)=>{   // k: 'x' | 'y'
    const lo=B.min[k]+d, hi=B.max[k]+d, refs=[lo,(lo+hi)/2,hi]; let best=null;
    for(const O of D.others){ const t=[O.min[k],(O.min[k]+O.max[k])/2,O.max[k]];
      for(let i=0;i<3;i++) for(let j=0;j<3;j++){ if((i===1)!==(j===1)) continue;   // centre with centre, sides with sides
        const e=t[j]-refs[i]; if(Math.abs(e)<thr && (!best || Math.abs(e)<Math.abs(best.e))) best={e, v:t[j], O}; } }
    if(!best) return d;
    const o= k==='x'? 'y' : 'x', a=Math.min(B.min[o]+(o==='x'?dx:dy), best.O.min[o]), b=Math.max(B.max[o]+(o==='x'?dx:dy), best.O.max[o]);
    const P=(u,w)=> k==='x'? new THREE.Vector3(u,w,z) : new THREE.Vector3(w,u,z);
    segs.push([P(best.v,a-3), P(best.v,b+3)]); return d+best.e;
  };
  dx=axis('x',dx); dy=axis('y',dy); showGuides(segs); return {dx,dy};
}
renderer.domElement.addEventListener('pointerdown', ev=>beginPointer(ev), true);
/* also used when a drag starts on the hover buttons in the middle of a part (see hover.js) */
function beginPointer(ev){
  if(ev.button!==0){ down=null; return; }
  const onGizmo = tc.axis!==null && tc.object;
  down={x:ev.clientX,y:ev.clientY,gizmo:onGizmo,drag:null,moved:false};
  if(onGizmo || pickMode) return;
  const all=pickAll(ev); const hit= all.find(h=>selection.includes(h.object.userData.id)) || all[0] || null;   // an already selected part, even behind another, is the one dragged
  if(hit && !simLocked() && ws==='model'){
    const id=hit.object.userData.id;
    down.pre=selection.slice();
    if(!selection.includes(id) && !ev.shiftKey){ selection=[id]; GZ.mode=null; sync(); renderInspector(); }
    if(selection.includes(id)){
      orbit.enabled=false;   // drag on the floor plane (horizontal, at the height of the point grabbed)
      down.drag={z:hit.point.z, start:hit.point.clone(), items:selection.map(i=>({id:i, pos:[...findPart(i).pos]})), box0:selBox(), others:snapTargets()};
      renderer.domElement.setPointerCapture(ev.pointerId);
    }
  } else if(!hit && ws==='model' && !simLocked() && (ev.shiftKey || prefs.lmb==='select')){
    orbit.enabled=false; down.rect={x0:ev.clientX, y0:ev.clientY, add:ev.shiftKey}; renderer.domElement.setPointerCapture(ev.pointerId);
  }
}
renderer.domElement.addEventListener('pointermove', ev=>{
  if(down?.rect){ drawSelRect(down.rect, ev); return; }
  if(!down||!down.drag) return;
  if(!down.moved && Math.hypot(ev.clientX-down.x, ev.clientY-down.y)<4) return;
  down.moved=true;
  const pt=planeHit(ev, down.drag.z); if(!pt) return;
  const snap=+$('#snapSel').value;
  let dx=pt.x-down.drag.start.x, dy=pt.y-down.drag.start.y;
  if(snap>0){ dx=Math.round(dx/snap)*snap; dy=Math.round(dy/snap)*snap; }
  if(!ev.altKey){ const sn=smartSnap(down.drag, dx, dy); dx=sn.dx; dy=sn.dy; } else showGuides([]);   // Alt: no smart snapping
  for(const it of down.drag.items){ const p=findPart(it.id); p.pos=[+(it.pos[0]+dx).toFixed(4), +(it.pos[1]+dy).toFixed(4), it.pos[2]]; const r=meshes.get(it.id); r.mesh.position.set(...p.pos); }
  resetPivot(); liveInspector();
});
renderer.domElement.addEventListener('pointerup', ev=>{
  orbit.enabled=true;
  if(!down) return; const d=down; down=null;
  if(d.rect){ finishSelRect(d.rect, ev); return; }
  if(d.drag){ showGuides([]); }
  if(d.drag && d.moved){ sync(); commit(); renderInspector(); return; }
  if(d.gizmo) return;
  if(Math.hypot(ev.clientX-d.x, ev.clientY-d.y)>4) return;
  if(ws==='struct'){ if(ST.mode3d) struct3DClick(ev); return; }
  const hit=pickAt(ev);
  if(locPick!=null){ finishLocPick(hit); return; }
  if(ws==='mech' && jf){ const L=pickLocator(ev); if(L){ setJointLoc(L.pid,L.lid); return; } }
  if(pickMode){ pickMode(hit?hit.point:null, hit); return; }
  if(ws==='mech' && !jf){ if(hit){ const id=hit.object.userData.id; selection=[id]; sync(); renderInspector(); openMechBubble(findPart(id), ev, {point:hit.point}); } else { closeBubble(); if(selection.length){ selection=[]; sync(); renderInspector(); } } return; }
  if(!hit){ if(!ev.shiftKey && selection.length){ selection=[]; GZ.mode=null; sync(); renderInspector(); } return; }
  // clicking again on the same spot picks the next part behind (a hole inside a solid, overlapping parts)
  const ids=pickAll(ev).map(h=>h.object.userData.id); let id=ids[0];
  if(ev.shiftKey){ id=ids.find(i=>!selection.includes(i)); if(id==null){ id=ids[0]; selection=selection.filter(i=>i!==id); } else selection=[...selection,id]; }
  else { const pre=d.pre||selection; if(pre.length===1 && ids.length>1 && ids.includes(pre[0])) id=ids[(ids.indexOf(pre[0])+1)%ids.length];
    if(selection.length!==1 || selection[0]!==id) GZ.mode=null; selection=[id];
    if(ids.length>1 && id!==ids[0]) toast(`Pièce derrière : ${findPart(id)?.name} (cliquez encore pour la suivante)`); }
  sync(); renderInspector();
});
/* double-click: frame the object under the cursor (empty space: frame everything).
   In Modéliser, a sketch part opens its sketch instead. */
renderer.domElement.addEventListener('dblclick', ev=>{
  if(ws==='struct'){ if(!ST.mode3d) return; const hit=struct3DHit(ev); if(hit) frameObject(struct3DTarget(hit.object), 60); else frameObject(structGroup); return; }
  const hit=pickAt(ev); if(!hit){ if(ws==='model' && state.edit) finishGroupEdit(); else setView('fit'); return; } const p=findPart(hit.object.userData.id);
  if(ws==='model' && p && p.kind==='sketch' && !simLocked() && lv(2)){ openSketch(p); return; }
  if(ws==='model' && p && p.kind==='group' && !simLocked() && !isLocked(p)){ enterGroupEdit(p.id); return; }
  frameObject(hit.object);
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
function guard(){ if(ws!=='model'){ toast('Pour modifier les pièces, revenez à l’atelier 1 · Modéliser.'); return false; }
  if(simLocked()){ toast('Réinitialisez la simulation (bouton ⟲) pour modifier les pièces.'); return false; }
  if(selParts().some(isLocked)){ toast('Pièce verrouillée : déverrouillez-la dans l’arborescence (cadenas).'); return false; } return true; }
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
  for(const p of parts){ const ch=clone(p); delete ch.inGroup; setPartFromMatrix(ch, inv.clone().multiply(partMatrix(p))); G.children.push(ch); }
  if(state.edit) G.inGroup=state.edit.gid;
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
  for(const G of gs){ const M=partMatrix(G); for(const ch of G.children){ const c=clone(ch); setPartFromMatrix(c, M.clone().multiply(partMatrix(ch))); if(G.inGroup!=null) c.inGroup=G.inGroup; out.push(c); } }
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
  set('#tDup',!n||lock); set('#tDrop',!n||lock); set('#tDel',!n||lock);
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
/* zoom the camera onto a bounding box, keeping the current viewing direction */
function frameBox(b, minR=30){
  if(!b || b.isEmpty()) return; const c=new THREE.Vector3(); b.getCenter(c); const s=new THREE.Vector3(); b.getSize(s);
  const R=Math.max(minR, s.length()*0.6), dist=R/Math.sin(camera.fov*DEG/2)*1.05;
  const d=camera.position.clone().sub(orbit.target); if(d.lengthSq()<1e-9) d.set(0.55,-0.75,0.6); d.normalize();
  animateCam(c, c.clone().add(d.multiplyScalar(dist)));
}
function frameObject(o, minR=30){ if(!o) return; o.updateWorldMatrix(true,true); frameBox(new THREE.Box3().setFromObject(o, true), minR); }
function fitView(){ const c=new THREE.Vector3(); const b=sceneBox(); b.getCenter(c); const s=new THREE.Vector3(); b.getSize(s); const R=Math.max(35,s.length()*0.6); const dist=R/Math.sin(camera.fov*DEG/2); camera.position.copy(c.clone().add(new THREE.Vector3(0.55,-0.75,0.62).normalize().multiplyScalar(dist))); orbit.target.copy(c); orbit.update(); }
let camAnim=null;
function animateCam(target, pos){ camAnim={t0:performance.now(), ft:orbit.target.clone(), fp:camera.position.clone(), tt:target, tp:pos}; }
function stepCam(now){
  if(!camAnim) return; const k=clamp((now-camAnim.t0)/420,0,1); const e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
  orbit.target.lerpVectors(camAnim.ft,camAnim.tt,e); camera.position.lerpVectors(camAnim.fp,camAnim.tp,e); if(k>=1) camAnim=null;
}
