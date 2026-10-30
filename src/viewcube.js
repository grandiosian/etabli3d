
/* =========================================================
   Cube de vue (coin haut droit) : il tourne avec la caméra.
   Clic sur une face, une arête ou un coin : la vue se place dans cette direction.
   Glisser sur le cube : tourner la vue. Boutons autour : vue de départ, tout voir,
   zoomer sur la sélection, préférence du clic gauche (hover.js).
   ========================================================= */
const VC={r:null, scene:null, cam:null, cube:null, hl:null, down:null, dir:null};
function vcFaceTex(label, rot=0){
  const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
  g.fillStyle='#f4f7f5'; g.fillRect(0,0,128,128); g.strokeStyle='#9aa8a2'; g.lineWidth=6; g.strokeRect(3,3,122,122);
  g.translate(64,64); g.rotate(rot); g.fillStyle='#2b3330'; g.font='700 27px system-ui, sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(label,0,1);
  const t=new THREE.CanvasTexture(c); t.anisotropy=4; return t;
}
function vcInit(){
  const cv=$('#vcube'); if(!cv || VC.r) return;
  VC.r=new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true}); VC.r.setPixelRatio(Math.min(2,window.devicePixelRatio||1)); VC.r.setSize(116,116,false);
  VC.scene=new THREE.Scene(); VC.cam=new THREE.OrthographicCamera(-1,1,1,-1,0.1,10); VC.cam.up.set(0,0,1);
  VC.scene.add(new THREE.AmbientLight(0xffffff,1.6)); const dl=new THREE.DirectionalLight(0xffffff,1.2); dl.position.set(1,-2,3); VC.scene.add(dl);
  // BoxGeometry material order: +X, −X, +Y, −Y, +Z, −Z (texts turned so they read upright with Z up)
  const F=[['Droite',-Math.PI/2],['Gauche',Math.PI/2],['Arrière',Math.PI],['Face',0],['Dessus',0],['Dessous',Math.PI]];
  VC.cube=new THREE.Mesh(new THREE.BoxGeometry(1,1,1), F.map(([l,r],i)=>new THREE.MeshLambertMaterial({map:vcFaceTex(l,r)})));
  VC.scene.add(VC.cube);
  VC.scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(VC.cube.geometry), new THREE.LineBasicMaterial({color:0x6c7a74})));
  VC.hl=new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial({color:0x1d7656, transparent:true, opacity:.55, depthTest:false}));
  VC.hl.visible=false; VC.hl.renderOrder=5; VC.scene.add(VC.hl);
  // little axis tripod at a corner
  const ax=(d,c)=>{ const a=new THREE.ArrowHelper(new THREE.Vector3(...d), new THREE.Vector3(-0.62,-0.62,-0.62), 0.42, c, 0.12, 0.08); VC.scene.add(a); };
  ax([1,0,0],0xd64035); ax([0,1,0],0x3aa35b); ax([0,0,1],0x2f6fd6);
  cv.addEventListener('pointermove', vcMove); cv.addEventListener('pointerleave', ()=>{ if(!VC.down){ VC.hl.visible=false; VC.dir=null; } });
  cv.addEventListener('pointerdown', ev=>{ if(ev.button!==0) return; ev.preventDefault(); cv.setPointerCapture(ev.pointerId); VC.down={x:ev.clientX, y:ev.clientY, moved:false}; });
  cv.addEventListener('pointerup', ev=>{ const d=VC.down; VC.down=null; if(!d) return; if(!d.moved && VC.dir) vcGo(VC.dir); });
  cv.addEventListener('dblclick', ev=>ev.preventDefault());
}
/* which part of the cube is under the pointer: a face, an edge or a corner → a direction */
function vcPick(ev){
  const cv=$('#vcube'), r=cv.getBoundingClientRect(); ndc.set(((ev.clientX-r.left)/r.width)*2-1, -((ev.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc, VC.cam); const hit=ray.intersectObject(VC.cube,false)[0]; if(!hit) return null;
  const p=hit.point, e=0.5-0.2; const d=new THREE.Vector3(Math.abs(p.x)>e? Math.sign(p.x):0, Math.abs(p.y)>e? Math.sign(p.y):0, Math.abs(p.z)>e? Math.sign(p.z):0);
  return d.lengthSq()? d : null;
}
function vcMove(ev){
  const d=VC.down;
  if(d){ const dx=ev.clientX-d.x, dy=ev.clientY-d.y; if(!d.moved && Math.hypot(dx,dy)<3) return; d.moved=true; d.x=ev.clientX; d.y=ev.clientY; VC.hl.visible=false; vcOrbit(dx,dy); return; }
  const dir=vcPick(ev); VC.dir=dir; VC.hl.visible=!!dir;
  if(dir){ const n=Math.abs(dir.x)+Math.abs(dir.y)+Math.abs(dir.z);
    VC.hl.scale.set(dir.x? 0.2 : (n===1? 0.62 : 0.6), dir.y? 0.2 : (n===1? 0.62 : 0.6), dir.z? 0.2 : (n===1? 0.62 : 0.6));
    if(n===1) VC.hl.scale.set(dir.x? 0.04 : 0.62, dir.y? 0.04 : 0.62, dir.z? 0.04 : 0.62);
    VC.hl.position.set(dir.x*(n===1? 0.51 : 0.41), dir.y*(n===1? 0.51 : 0.41), dir.z*(n===1? 0.51 : 0.41));
    const names={'0,0,1':'Dessus','0,0,-1':'Dessous','0,-1,0':'Face','0,1,0':'Arrière','1,0,0':'Droite','-1,0,0':'Gauche'};
    $('#vcube').title= names[`${dir.x},${dir.y},${dir.z}`]? `Vue de ${names[`${dir.x},${dir.y},${dir.z}`].toLowerCase()}` : 'Vue en biais (arête ou coin)'; }
}
function vcGo(dir){
  const t=orbit.target.clone(), dist=camera.position.distanceTo(t), d=dir.clone().normalize();
  if(Math.abs(d.z)>0.999) d.set(0,-0.0001*Math.sign(d.z||1),Math.sign(d.z));   // straight down/up: keep a forward direction for the camera
  animateCam(t, t.clone().add(d.normalize().multiplyScalar(dist)));
}
const _vs=new THREE.Spherical(), _vq=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), new THREE.Vector3(0,1,0)), _vqi=_vq.clone().invert();
function vcOrbit(dx, dy){
  const off=camera.position.clone().sub(orbit.target).applyQuaternion(_vq); _vs.setFromVector3(off);
  _vs.theta-=dx*0.012; _vs.phi=clamp(_vs.phi-dy*0.012, 0.02, Math.PI-0.02);
  off.setFromSpherical(_vs).applyQuaternion(_vqi); camera.position.copy(orbit.target).add(off); camera.lookAt(orbit.target); orbit.update();
}
function vcTick(){
  if(!VC.r){ vcInit(); if(!VC.r) return; }
  const v=$('#views'); if(!v || !v.offsetParent || v.classList.contains('collapsed')) return;
  VC.cam.position.copy(camera.position).sub(orbit.target).normalize().multiplyScalar(3);
  const key=VC.cam.position.toArray().map(v=>v.toFixed(4)).join()+(VC.hl.visible? VC.hl.position.toArray().join()+VC.hl.scale.toArray().join() : '');
  if(key===VC.key) return; VC.key=key;   // draw only when the view or the highlight changed
  VC.cam.up.copy(camera.up); VC.cam.lookAt(0,0,0);
  if((VC.n=(VC.n||0)+1)%90===1) VC.hl.material.color.set(cssVar('--accent')||'#1d7656');
  VC.r.render(VC.scene, VC.cam);
}
