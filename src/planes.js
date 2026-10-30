/* =========================================================
   Plan d'esquisse : avant d'ouvrir l'éditeur d'esquisse, l'élève choisit
   le plan (dessus XY, face XZ, côté YZ). Les trois plans s'affichent dans
   la vue 3D (cliquables) et dans un petit panneau.
   ========================================================= */
/* u, v : axes monde des axes horizontal et vertical de l'esquisse ; n : axe monde de l'extrusion (u × v) */
const SKPLANES={
  xy:{name:'Dessus', label:'Plan XY · dessus', u:[1,0,0], v:[0,1,0], axes:['X','Y'], nrm:'z', ext:'monte en <b>Z</b>'},
  xz:{name:'Face',   label:'Plan XZ · face',   u:[1,0,0], v:[0,0,1], axes:['X','Z'], nrm:'y', ext:'avance vers l’avant (<b>−Y</b>)'},
  yz:{name:'Côté',   label:'Plan YZ · côté',   u:[0,1,0], v:[0,0,1], axes:['Y','Z'], nrm:'x', ext:'avance vers la droite (<b>+X</b>)'},
};
/* Rotation (degrés, XYZ) d'une pièce esquisse pour qu'elle soit dans son plan.
   Extrusion : le profil (x, y) va sur (u, v), l'épaisseur suit u × v.
   Révolution : l'axe de révolution est l'axe vertical de l'esquisse (v) ; la géométrie tourne autour de son Z local. */
function planeRot(plane, mode='extrude'){
  const P=SKPLANES[plane]; if(!P) return [0,0,0];
  const u=new THREE.Vector3(...P.u), v=new THREE.Vector3(...P.v);
  let m;
  if(mode==='revolve'){ const z=v.clone(), x=u.clone(), y=z.clone().cross(x); m=new THREE.Matrix4().makeBasis(x,y,z); }
  else m=new THREE.Matrix4().makeBasis(u, v, u.clone().cross(v));
  const tmp={pos:[0,0,0],rot:[0,0,0]}; setPartFromMatrix(tmp, m); return tmp.rot;
}
const sameRot=(a,b)=> a && b && a.every((x,i)=>Math.abs(((x-b[i])%360+540)%360-180)<0.01);

const PP={open:false, tool:'rect', hot:null, group:null, meshes:{}, labels:{}, fn:null};
function ppBuild(){
  if(PP.group) return;
  PP.group=new THREE.Group(); PP.group.renderOrder=12; PP.group.visible=false; scene.add(PP.group);
  for(const k of Object.keys(SKPLANES)){
    const P=SKPLANES[k];
    const g=new THREE.PlaneGeometry(1,1); g.translate(0.5,0.5,0);   // un carré dans le quart positif (u ≥ 0, v ≥ 0), comme le tapis
    const m=new THREE.Mesh(g, new THREE.MeshBasicMaterial({transparent:true, opacity:.16, side:THREE.DoubleSide, depthWrite:false, depthTest:false}));
    const u=new THREE.Vector3(...P.u), v=new THREE.Vector3(...P.v); m.matrixAutoUpdate=false; m.userData.plane=k;
    m.userData.basis=new THREE.Matrix4().makeBasis(u, v, u.clone().cross(v));
    const e=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[0,0],[1,0],[1,1],[0,1]].map(([a,b])=>new THREE.Vector3(a,b,0))), new THREE.LineBasicMaterial({transparent:true, opacity:.9, depthTest:false}));
    m.add(e); m.userData.edge=e; PP.group.add(m); PP.meshes[k]=m;
    const lab=h('div',{class:'pp-lab','data-plane':k}, h('b',{},P.name), ' ', P.axes.join('')); lab.hidden=true; $('#stage').append(lab); PP.labels[k]=lab;
  }
}
function ppColors(){ const A=axisColors(); for(const k of Object.keys(SKPLANES)){ const c=A[SKPLANES[k].nrm]; PP.meshes[k].material.color.set(c); PP.meshes[k].userData.edge.material.color.set(c);
  PP.labels[k].style.setProperty('--pp-c', c); $(`#planePick [data-plane="${k}"]`)?.style.setProperty('--pp-c', c); } }
function ppSize(){ const b=sceneBox(), s=new THREE.Vector3(); b.getSize(s); return Math.max(60, Math.ceil(Math.max(b.max.x, b.max.y, b.max.z, s.x*0.6, s.y*0.6, s.z)/10)*10); }
function ppSetHot(k){
  PP.hot=k||null;
  for(const [kk,m] of Object.entries(PP.meshes)){ const on=kk===PP.hot; m.material.opacity= on? .42 : (PP.hot? .08 : .16); m.userData.edge.material.opacity= on? 1 : (PP.hot? .35 : .9); PP.labels[kk].classList.toggle('hot', on); }
  $$('#planePick [data-plane]').forEach(b=>b.classList.toggle('hot', b.dataset.plane===PP.hot));
  renderer.domElement.style.cursor= PP.hot? 'pointer' : '';
}
function ppHit(ev){
  const r=renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX-r.left)/r.width)*2-1, -((ev.clientY-r.top)/r.height)*2+1); ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects(Object.values(PP.meshes), false)[0]; return hit? hit.object.userData.plane : null;
}
/* tool : outil de l'éditeur à sélectionner à l'ouverture (rect, line, circle, bezier) */
function openPlanePicker(tool='rect'){
  if(simLocked()){ toast('Réinitialisez la simulation (bouton ⟲) pour modifier les pièces.'); return; }
  if(!lv(2)) return;
  if(pickMode && !PP.open) cancelPick();
  ppBuild(); ppColors();
  const S=ppSize(); for(const m of Object.values(PP.meshes)){ m.matrix.copy(m.userData.basis).multiply(new THREE.Matrix4().makeScale(S,S,1)); m.matrixWorldNeedsUpdate=true; }
  PP.open=true; PP.tool=tool; PP.group.visible=true; $('#planePick').hidden=false; ppSetHot(null);
  if(selection.length){ selection=[]; sync(); renderInspector(); }
  const d=camera.position.clone().sub(orbit.target).normalize();
  if(Math.max(Math.abs(d.x),Math.abs(d.y),Math.abs(d.z))>0.94) setView('iso');   // vue de face, de dessus… : un des plans serait vu par la tranche
  PP.fn=(pt, hit, ev)=>{ const k= ev? ppHit(ev) : null; if(k) choosePlane(k); };
  pickMode=PP.fn; updateGizmo();
  $$('#rack [data-sktool]').forEach(b=>b.classList.toggle('on', b.dataset.sktool===tool && b.id!=='bSketch'));
  $('#bSketch').classList.toggle('on', true);
}
function closePlanePicker(){
  if(!PP.open) return; PP.open=false;
  if(PP.group) PP.group.visible=false; for(const l of Object.values(PP.labels)) l.hidden=true;
  $('#planePick').hidden=true; renderer.domElement.style.cursor='';
  $$('#rack [data-sktool]').forEach(b=>b.classList.remove('on'));
  if(pickMode===PP.fn){ pickMode=null; updateGizmo(); }
}
function choosePlane(k){ const tool=PP.tool; closePlanePicker(); openSketch(null, {plane:k, tool}); }
/* étiquettes des plans, placées chaque image près du coin opposé à l'origine */
const _ppv=new THREE.Vector3();
function ppTick(){
  if(!PP.open) return;
  for(const [k,m] of Object.entries(PP.meshes)){ _ppv.set(0.82,0.9,0).applyMatrix4(m.matrix); const s=toStage(_ppv), l=PP.labels[k];
    l.hidden=!s.vis; if(s.vis){ l.style.left=s.x+'px'; l.style.top=s.y+'px'; } }
}
function initPlanes(){
  $$('#rack [data-sktool]').forEach(b=>b.addEventListener('click',()=>{ if(PP.open && PP.tool===b.dataset.sktool) closePlanePicker(); else openPlanePicker(b.dataset.sktool); }));
  $$('#planePick [data-plane]').forEach(b=>{ b.onclick=()=>choosePlane(b.dataset.plane); b.onpointerenter=()=>ppSetHot(b.dataset.plane); b.onpointerleave=()=>ppSetHot(null); });
  $('#planeCancel').onclick=closePlanePicker;
  renderer.domElement.addEventListener('pointermove', ev=>{ if(PP.open && !ev.buttons) ppSetHot(ppHit(ev)); });
}
