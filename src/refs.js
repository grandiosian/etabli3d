/* =========================================================
   Repères d'échelle : trois objets connus qui se suivent en taille (pièce, pomme, canette,
   personne, voiture, immeuble, avion) pour se rendre compte des tailles réelles.
   « Auto » choisit l'objet d'après la taille des pièces (plus grand si le modèle
   est plus grand). Ils sont en gris, loin derrière le plan de travail, toujours au même endroit, avec une
   plaque au sol « Référence d'échelle ». Ni cliquables, ni exportés, ni enregistrés.
   ========================================================= */
const REFS={
  piece:  {name:'Pièce de 1 €', size:'2,3 cm', dim:23},
  pomme:  {name:'Pomme',   size:'8 cm',   dim:80},
  canette:{name:'Canette', size:'12 cm',  dim:115},
  personne:{name:'Personne', size:'1,70 m', dim:1700},
  voiture:{name:'Voiture', size:'4,2 m',  dim:4200},
  immeuble:{name:'Immeuble', size:'12 m (4 étages)', dim:12000},
  avion:  {name:'Avion de ligne', size:'38 m', dim:37600},
};
const REF={group:new THREE.Group(), kind:null, objs:{}, lab:null};
REF.group.visible=false; scene.add(REF.group);

const refMat=(c,o={})=>new THREE.MeshStandardMaterial({color:c, roughness:.6, metalness:0, ...o});
const refBuild={
  piece(){ const g=new THREE.Group(); const m=refMat(0xb8a24a,{metalness:.4,roughness:.35});
    const c=new THREE.Mesh(new THREE.CylinderGeometry(11.6,11.6,2.3,48), m); c.rotation.x=Math.PI/2; c.position.z=1.15; g.add(c);
    const r=new THREE.Mesh(new THREE.TorusGeometry(8.2,0.5,8,48), refMat(0x8c8f93,{metalness:.4})); r.position.z=2.3; g.add(r); return g; },
  personne(){ const g=new THREE.Group(), M=refMat(0x8a9296), add=(geo,x,y,z,rx=Math.PI/2)=>{ const m=new THREE.Mesh(geo,M); m.rotation.x=rx; m.position.set(x,y,z); g.add(m); };
    for(const x of [-95,95]) add(new THREE.CylinderGeometry(70,60,820,16), x,0,410);
    add(new THREE.CapsuleGeometry(190,330,6,16), 0,0,1150); 
    for(const x of [-255,255]) add(new THREE.CylinderGeometry(50,45,620,12), x,0,1080);
    add(new THREE.CylinderGeometry(55,55,80,12), 0,0,1460); add(new THREE.SphereGeometry(115,24,16), 0,0,1585,0);
    g.children[2].scale.set(1,1,.62); return g; },
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
    c.fillStyle='#c4c8c6'; c.fillRect(0,0,256,256); c.fillStyle='#7f8784'; for(let f=0;f<4;f++) for(let i=0;i<5;i++) c.fillRect(14+i*49, 18+f*62, 30, 34);
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
const REF_ORDER=['piece','pomme','canette','personne','voiture','immeuble','avion'];
function refAuto(D){ return D<40? 'piece' : D<100? 'pomme' : D<600? 'canette' : D<2500? 'personne' : D<8000? 'voiture' : D<25000? 'immeuble' : 'avion'; }
/* trois objets qui se suivent en taille, autour de celui choisi (rapports d'échelle) */
function refSeries(k){ const i=REF_ORDER.indexOf(k), s=clamp(i-1, 0, REF_ORDER.length-3); return REF_ORDER.slice(s, s+3); }
function partsBox(){ const b=new THREE.Box3(); for(const [id,r] of meshes){ if(r.mesh.visible) b.union(new THREE.Box3().setFromObject(r.mesh)); } return b; }
/* en gris : l'objet repère ne se confond pas avec les pièces */
function refGrey(o){ o.traverse(m=>{ if(!m.isMesh) return; for(const M of [].concat(m.material)){ if(M.map){ M.color.set(0xffffff); continue; } const c=M.color, l=0.2126*c.r+0.7152*c.g+0.0722*c.b; const g=0.42+0.42*Math.min(1,l*1.6); c.setRGB(g,g,g); M.metalness=0; } }); }
/* plaque au sol, devant l'objet : « Référence d'échelle » et son nom */
function refPlaque(k, w){
  const R=REFS[k], cv=document.createElement('canvas'); cv.width=1024; cv.height=256; const c=cv.getContext('2d');
  c.fillStyle='rgba(60,70,66,.72)'; c.font='700 78px "Saira Semi Condensed",sans-serif'; c.textAlign='center'; c.fillText('RÉFÉRENCE D’ÉCHELLE', 512, 100);
  c.font='500 70px "IBM Plex Sans",sans-serif'; c.fillText(`${R.name} · ${R.size}`, 512, 200);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w, w/4), new THREE.MeshBasicMaterial({map:t, transparent:true, depthWrite:false})); m.renderOrder=2; return m;
}
/* un objet repère avec sa plaque et son ombre : centré en X, son devant à y = 0, la plaque devant lui (y < 0) */
function refItem(k){
  let o=REF.objs[k]; if(o) return o;
  const obj=refBuild[k](); refGrey(obj); obj.updateMatrixWorld(true); const ob=new THREE.Box3().setFromObject(obj), ow=ob.max.x-ob.min.x, od=ob.max.y-ob.min.y;
  obj.position.set(-(ob.max.x+ob.min.x)/2, -ob.min.y, 0);
  const pw=Math.max(ow, 70), ph=pw/4, pl=refPlaque(k, pw); pl.position.set(0, -ph/2-0.12*ph, 0.2);
  const big=Math.max(ow,od), sh=new THREE.Mesh(new THREE.CircleGeometry(0.62*big,48), new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:.1, depthWrite:false}));
  sh.scale.y=od/big; sh.position.set(0, od/2, 0.1);   // ombre au sol : l'objet est posé, pas en l'air
  o=REF.objs[k]=new THREE.Group(); o.add(obj, pl, sh); o.userData={w:Math.max(ow,pw), front:ph*1.15};
  o.traverse(m=>{ if(m.isMesh) m.userData.ref=true; }); REF.group.add(o); return o;
}
/* la série de trois repères, loin derrière le plan de travail, rangés du plus petit au plus grand ;
   toujours au même endroit pour une série donnée (ne suit pas les pièces) */
function refUpdate(){
  const mode=prefs.ref||'auto', show= mode!=='aucun' && ws==='model' && $('#sk').hidden;
  const b=partsBox(), D= b.isEmpty()? 50 : Math.max(b.max.x-b.min.x, b.max.y-b.min.y, b.max.z-b.min.z);
  const k= !show? null : (mode==='auto' || !REFS[mode])? refAuto(D) : mode;
  REF.group.visible=!!k; REF.kind=k; if(!k) return;
  const ser=refSeries(k); REF.series=ser;
  for(const [kk,o] of Object.entries(REF.objs)) o.visible= ser.includes(kk);
  const items=ser.map(refItem), gaps=items.slice(1).map((o,i)=>0.3*Math.max(o.userData.w, items[i].userData.w));
  const total=items.reduce((s,o)=>s+o.userData.w,0)+gaps.reduce((s,g)=>s+g,0), y0=MAT/2+30+Math.max(...items.map(o=>o.userData.front));
  let x=-total/2; items.forEach((o,i)=>{ o.visible=true; o.position.set(x+o.userData.w/2, y0, 0); x+=o.userData.w+(gaps[i]||0); });
}
function refTick(){}   // le texte est maintenant une plaque au sol (refPlaque)
function setRef(mode){
  prefs.ref=mode; savePrefs(); refUpdate(); closeRefMenu();
  toast(mode==='aucun'? 'Repères d’échelle masqués.' : `Repères d’échelle : ${(REF.series||[]).map(k=>REFS[k].name.toLowerCase()).join(', ')}${mode==='auto'?' — choisis selon la taille des pièces':''}. Ils sont derrière le plan de travail.`, 3200);
}
function closeRefMenu(){ const m=$('#refMenu'); if(m) m.hidden=true; }
function openRefMenu(btn){
  let m=$('#refMenu'); if(!m){ m=h('div',{id:'refMenu',class:'ctx',role:'menu','aria-label':'Repère d’échelle',hidden:true}); document.body.append(m); }   // hors de la vue : passe au-dessus des panneaux
  if(!m.hidden){ closeRefMenu(); return; }
  const cur=prefs.ref||'auto'; m.innerHTML='';
  m.append(h('h5',{},'Repères d’échelle (3 objets)'));
  for(const [k,l] of [['auto','Automatique (selon la taille des pièces)'], ...REF_ORDER.map(k=>[k,`Autour de : ${REFS[k].name} · ${REFS[k].size}`]), ['aucun','Aucun']])
    m.append(h('button',{role:'menuitemradio','aria-checked':String(cur===k),onclick:()=>setRef(k)}, h('span',{},l)));
  m.hidden=false; const r=btn.getBoundingClientRect();
  m.style.left=clamp(r.left-m.offsetWidth-6, 4, innerWidth-m.offsetWidth-4)+'px'; m.style.top=clamp(r.top, 4, innerHeight-m.offsetHeight-4)+'px';
}
document.addEventListener('pointerdown', e=>{ const m=$('#refMenu'); if(m && !m.hidden && !e.target.closest('#refMenu,#refBtn')) closeRefMenu(); }, true);

var REF_ON=true;   // sync() met le repère à jour une fois ce fichier chargé
