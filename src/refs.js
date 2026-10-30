/* =========================================================
   Repères d'échelle : un objet connu posé à côté des pièces (pomme, canette,
   voiture, immeuble, avion) pour se rendre compte des tailles réelles.
   « Auto » choisit l'objet d'après la taille des pièces (plus grand si le modèle
   est plus grand). Ces objets ne sont ni cliquables, ni exportés, ni enregistrés.
   ========================================================= */
const REFS={
  pomme:  {name:'Pomme',   size:'8 cm',   dim:80},
  canette:{name:'Canette', size:'12 cm',  dim:115},
  voiture:{name:'Voiture', size:'4,2 m',  dim:4200},
  immeuble:{name:'Immeuble', size:'12 m (4 étages)', dim:12000},
  avion:  {name:'Avion de ligne', size:'38 m', dim:37600},
};
const REF={group:new THREE.Group(), kind:null, objs:{}, lab:null};
REF.group.visible=false; scene.add(REF.group);

const refMat=(c,o={})=>new THREE.MeshStandardMaterial({color:c, roughness:.6, metalness:0, ...o});
const refBuild={
  pomme(){ const g=new THREE.Group();
    const b=new THREE.Mesh(new THREE.SphereGeometry(40,32,20), refMat(0xd64035)); b.scale.set(1,1,.9); b.position.z=36; g.add(b);
    const s=new THREE.Mesh(new THREE.CylinderGeometry(2,2.5,14,8), refMat(0x6b4a2b)); s.rotation.x=Math.PI/2; s.position.set(0,0,74); g.add(s);
    const l=new THREE.Mesh(new THREE.SphereGeometry(9,12,8), refMat(0x4c9a3b)); l.scale.set(1.4,.6,.25); l.position.set(9,0,76); l.rotation.y=-0.5; g.add(l); return g; },
  canette(){ const g=new THREE.Group(); const cyl=(r,h,z,c,o)=>{ const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,40), refMat(c,o)); m.rotation.x=Math.PI/2; m.position.z=z+h/2; g.add(m); };
    cyl(30,6,0,0xc9cfd2,{metalness:.6,roughness:.3}); cyl(33,103,6,0xc9cfd2,{metalness:.6,roughness:.3}); cyl(33.4,62,22,0xc4302b); cyl(29,6,109,0xc9cfd2,{metalness:.6,roughness:.3}); return g; },
  voiture(){ const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(4200,1750,650), refMat(0x2f6fd6)); body.position.z=300+325; g.add(body);
    const sh=new THREE.Shape([new THREE.Vector2(-1350,0),new THREE.Vector2(1150,0),new THREE.Vector2(650,520),new THREE.Vector2(-950,520)]);
    const cab=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:1560,bevelEnabled:false}), refMat(0x9fc3e0,{metalness:.2,roughness:.2})); cab.rotation.x=Math.PI/2; cab.position.set(0,780,950); g.add(cab);
    for(const x of [-1350,1350]) for(const y of [-820,820]){ const w=new THREE.Mesh(new THREE.CylinderGeometry(330,330,230,24), refMat(0x222629)); w.position.set(x,y,330); g.add(w); }
    return g; },
  immeuble(){ const g=new THREE.Group();
    const cv=document.createElement('canvas'); cv.width=256; cv.height=256; const c=cv.getContext('2d');
    c.fillStyle='#d9c7a6'; c.fillRect(0,0,256,256); c.fillStyle='#4d5d6b'; for(let f=0;f<4;f++) for(let i=0;i<5;i++) c.fillRect(14+i*49, 18+f*62, 30, 34);
    const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
    const side=new THREE.MeshStandardMaterial({map:tex, roughness:.8}), top=refMat(0x8d8478);
    const b=new THREE.Mesh(new THREE.BoxGeometry(10000,8000,12000), [side,side,side,side,top,top]); b.position.z=6000; g.add(b); return g; },
  avion(){ const g=new THREE.Group(), W=refMat(0xeef1f3), G=refMat(0x9aa4ab), B=refMat(0x2f5f9e);
    const f=new THREE.Mesh(new THREE.CylinderGeometry(2000,2000,28000,32), W); f.rotation.z=Math.PI/2; f.position.set(0,0,4000); g.add(f);
    const n=new THREE.Mesh(new THREE.SphereGeometry(2000,32,16), W); n.scale.set(2,.985,.985); n.position.set(14000,0,4000); g.add(n);
    const t=new THREE.Mesh(new THREE.ConeGeometry(1985,6000,32), W); t.rotation.z=Math.PI/2; t.position.set(-17000,0,4400); g.add(t);
    const wing=new THREE.Mesh(new THREE.BoxGeometry(4000,34000,400), G); wing.position.set(-1000,0,3000); g.add(wing);
    const ht=new THREE.Mesh(new THREE.BoxGeometry(2400,12000,300), G); ht.position.set(-17500,0,4800); g.add(ht);
    const fin=new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-1500,0),new THREE.Vector2(3500,0),new THREE.Vector2(1500,6500),new THREE.Vector2(-500,6500)]),{depth:300,bevelEnabled:false}), B);
    fin.rotation.x=Math.PI/2; fin.position.set(-19500,150,5800); g.add(fin);
    for(const y of [-5800,5800]){ const e=new THREE.Mesh(new THREE.CylinderGeometry(1000,1000,4500,24), G); e.rotation.z=Math.PI/2; e.position.set(1200,y,1900); g.add(e); }
    for(const [x,y] of [[11000,0],[-1500,-3000],[-1500,3000]]){ const l=new THREE.Mesh(new THREE.CylinderGeometry(150,150,2000,8), G); l.rotation.x=Math.PI/2; l.position.set(x,y,1000); g.add(l);
      const w=new THREE.Mesh(new THREE.CylinderGeometry(500,500,400,16), refMat(0x222629)); w.position.set(x,y,500); g.add(w); }
    return g; },
};
/* the object that fits the size of the model (largest dimension D, in mm) */
function refAuto(D){ return D<100? 'pomme' : D<600? 'canette' : D<8000? 'voiture' : D<25000? 'immeuble' : 'avion'; }
function partsBox(){ const b=new THREE.Box3(); for(const [id,r] of meshes){ if(r.mesh.visible) b.union(new THREE.Box3().setFromObject(r.mesh)); } return b; }
/* place the reference next to the parts (to their right, on the floor) */
function refUpdate(){
  const mode=prefs.ref||'auto', show= mode!=='aucun' && ws==='model' && $('#sk').hidden;
  const b=partsBox(), D= b.isEmpty()? 50 : Math.max(b.max.x-b.min.x, b.max.y-b.min.y, b.max.z-b.min.z);
  const k= !show? null : mode==='auto'? refAuto(D) : mode;
  REF.group.visible=!!k; REF.kind=k; if(!k){ if(REF.lab) REF.lab.hidden=true; return; }
  for(const [kk,o] of Object.entries(REF.objs)) o.visible= kk===k;
  let o=REF.objs[k]; if(!o){ o=REF.objs[k]=refBuild[k](); o.traverse(m=>{ if(m.isMesh){ m.castShadow=false; m.userData.ref=true; } }); REF.group.add(o); }
  REF.group.position.set(0,0,0); REF.group.updateMatrixWorld(true); const ob=new THREE.Box3().setFromObject(o), ow=ob.max.x-ob.min.x;   // boîte de l'objet seul, à l'origine
  const bb= b.isEmpty()? new THREE.Box3(new THREE.Vector3(-25,-25,0), new THREE.Vector3(25,25,0)) : b;
  const gap=Math.max(8, 0.12*Math.min(ow, Math.max(bb.max.x-bb.min.x, 20)));
  REF.group.position.set(bb.max.x+gap+ow/2-(ob.max.x+ob.min.x)/2, (bb.min.y+bb.max.y)/2-(ob.max.y+ob.min.y)/2, 0);
  REF.top=new THREE.Vector3(REF.group.position.x+(ob.max.x+ob.min.x)/2, REF.group.position.y+(ob.max.y+ob.min.y)/2, ob.max.z);
}
function refTick(){
  if(!REF.lab){ REF.lab=h('div',{class:'ref-lab',hidden:true}); $('#stage').append(REF.lab); }
  if(!REF.group.visible || !REF.kind){ REF.lab.hidden=true; return; }
  const s=toStage(REF.top); REF.lab.hidden=!s.vis; if(!s.vis) return;
  const R=REFS[REF.kind]; if(REF.lab.dataset.k!==REF.kind){ REF.lab.dataset.k=REF.kind; REF.lab.innerHTML=`<b>${R.name}</b> · ${R.size}`; }
  REF.lab.style.transform=`translate(${Math.round(s.x)}px,${Math.round(s.y-14)}px) translate(-50%,-100%)`;
}
function setRef(mode){
  prefs.ref=mode; savePrefs(); refUpdate(); closeRefMenu();
  if(mode!=='aucun' && mode!=='auto' && REF.group.visible){ const b=partsBox().union(new THREE.Box3().setFromObject(REF.group)); frameBox(b, 30); }   // un objet choisi à la main : on le montre avec les pièces
  const R=REFS[REF.kind]; toast(mode==='aucun'? 'Repère d’échelle masqué.' : `Repère d’échelle : ${R? R.name.toLowerCase()+' ('+R.size+')' : ''}${mode==='auto'?' — choisi selon la taille des pièces':''}.`);
}
function closeRefMenu(){ const m=$('#refMenu'); if(m) m.hidden=true; }
function openRefMenu(btn){
  let m=$('#refMenu'); if(!m){ m=h('div',{id:'refMenu',class:'ctx',role:'menu','aria-label':'Repère d’échelle',hidden:true}); document.body.append(m); }   // hors de la vue : passe au-dessus des panneaux
  if(!m.hidden){ closeRefMenu(); return; }
  const cur=prefs.ref||'auto'; m.innerHTML='';
  m.append(h('h5',{},'Repère d’échelle'));
  for(const [k,l] of [['auto','Automatique (selon la taille)'], ...Object.entries(REFS).map(([k,R])=>[k,`${R.name} · ${R.size}`]), ['aucun','Aucun']])
    m.append(h('button',{role:'menuitemradio','aria-checked':String(cur===k),onclick:()=>setRef(k)}, h('span',{},l)));
  m.hidden=false; const r=btn.getBoundingClientRect();
  m.style.left=clamp(r.left-m.offsetWidth-6, 4, innerWidth-m.offsetWidth-4)+'px'; m.style.top=clamp(r.top, 4, innerHeight-m.offsetHeight-4)+'px';
}
document.addEventListener('pointerdown', e=>{ const m=$('#refMenu'); if(m && !m.hidden && !e.target.closest('#refMenu,#refBtn')) closeRefMenu(); }, true);

var REF_ON=true;   // sync() met le repère à jour une fois ce fichier chargé
