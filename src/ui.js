
/* =========================================================
   Inspector
   ========================================================= */
const fmtIn = v => String(+(+v).toFixed(3)).replace('.',',');
function numInput(label, val, unit, onSet, o={}){
  const inp=h('input',{type:'text',inputmode:'decimal',value:fmtIn(val),'aria-label':label, 'data-live':o.live||null, disabled:o.disabled||null});
  let last=val;
  const apply=()=>{ let v=parseNum(inp.value); if(!isFinite(v)){ inp.value=fmtIn(last); return; }
    if(o.min!=null) v=Math.max(o.min,v); if(o.max!=null) v=Math.min(o.max,v); if(o.int) v=Math.round(v);
    inp.value=fmtIn(v); if(v!==last){ last=v; onSet(v); } };
  inp.addEventListener('change',apply);
  inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){ apply(); inp.select(); }
    if(e.key==='ArrowUp'||e.key==='ArrowDown'){ e.preventDefault(); const st=(o.step||1)*(e.shiftKey?10:1); let v=parseNum(inp.value); if(!isFinite(v)) v=0; v+= e.key==='ArrowUp'?st:-st; inp.value=fmtIn(+v.toFixed(4)); apply(); }
  });
  inp.addEventListener('focus',()=>inp.select());
  return h('div',{class:'num'}, inp, unit? h('span',{},unit):null);
}
function row(label, ctrl){ return h('div',{class:'row'}, h('label',{},label), ctrl); }
function sec(title, ...kids){ return h('div',{class:'sec'}, title? h('h3',{},title):null, ...kids); }
const minLvl=(el,n)=>{ if(n>1) el.dataset.min=n; return el; };

/* kept for older calls: 'move' opens the Mécanique atelier, 'part' the Modéliser one */
function setTab(t){ if(t==='move') setWs('mech'); else if(ws==='mech'||ws==='struct') setWs('model'); else renderInspector(); }
function renderInspector(){
  const body=$('#inspBody'); const st=body.scrollTop; body.innerHTML='';
  if(ws==='check') renderValidation(body); else if(ws==='mech') renderMech(body); else if(ws==='struct') renderStruct(body); else renderPart(body);
  hydrateIcons(body); body.scrollTop=st;
}
function partChanged(p, rerender=false){ sync(); commit(); if(rerender) renderInspector(); else liveInspector(); }

function liveInspector(){
  const body=$('#inspBody');
  if(selection.length===1){ const p=findPart(selection[0]); if(p){ const r=meshes.get(p.id);
    let pos=p.pos, rot=p.rot;
    if(r && dragStart){ const tmp={pos:[0,0,0],rot:[0,0,0]}; r.mesh.updateMatrix(); setPartFromMatrix(tmp,r.mesh.matrix); pos=tmp.pos; rot=tmp.rot; }
    for(let i=0;i<3;i++){ const a=body.querySelector(`[data-live=pos${i}]`), b=body.querySelector(`[data-live=rot${i}]`);
      if(a&&a!==document.activeElement) a.value=fmtIn(pos[i]); if(b&&b!==document.activeElement) b.value=fmtIn(rot[i]); } } }
  const bb=body.querySelector('[data-live=bbox]'); if(bb) bb.innerHTML=bboxText();
}
function bboxText(){ const b=selBox(); if(b.isEmpty()) return ''; const s=new THREE.Vector3(); b.getSize(s); return `<b class="mono">${fmt(s.x,1)} × ${fmt(s.y,1)} × ${fmt(s.z,1)}</b> mm <span style="opacity:.7">(X × Y × Z)</span>`; }

function colorSec(parts){
  const cur=parts[0].color;
  const wrap=h('div',{class:'swatches'});
  for(const c of PALETTE) wrap.append(h('button',{class:'sw'+(parts.every(p=>p.color===c)?' on':''),style:`background:${c}`,title:c,'aria-label':'Couleur '+c,onclick:()=>{ if(!guard())return; parts.forEach(p=>p.color=c); partChanged(parts[0],true); }}));
  const ci=h('input',{type:'color',class:'sw-custom',value:cur,'aria-label':'Autre couleur'}); ci.addEventListener('change',()=>{ if(!guard())return; parts.forEach(p=>p.color=ci.value); partChanged(parts[0],true); });
  wrap.append(ci);
  return sec('Couleur', wrap);
}
/* ---- matière : aspect (motif, finition), couleur naturelle, masse ; image importée projetée sur la pièce */
const MAT_CHIP={1:'repeating-linear-gradient(0deg,#0000 0 3px,#0002 3px 4px)',2:'repeating-radial-gradient(circle at 20% 120%,#0000 0 3px,#5a32101f 3px 5px)',3:'repeating-linear-gradient(90deg,#fff3 0 1px,#0000 1px 3px)',5:'radial-gradient(#0002 1px,#0000 1.5px) 0 0/5px 5px',6:'radial-gradient(circle at 30% 30%,#0001 0 30%,#0000 31%) 0 0/9px 9px'};
function matChip(m, color){ const bg=m[5]||color||'#ccc'; return h('span',{class:'mat-chip',style:`background:${MAT_CHIP[m[2]]?MAT_CHIP[m[2]]+',':''}${bg}`+(m[7]<1?';opacity:.6':'')+(m[4]>.5?';box-shadow:inset 0 6px 8px #fff8, inset 0 -4px 6px #0002':'')}); }
function setMat(parts, k){
  if(!guard()) return; const M=MATIERES.find(m=>m[0]===k);
  for(const p of parts){ if(!k){ delete p.mat; continue; } p.mat={...(p.mat?.k==='image' && k==='image'? p.mat : {}), k}; if(M?.[5] && k!=='image') p.color=M[5]; }
  partChanged(parts[0], true);
}
function importTexture(parts){
  const inp=h('input',{type:'file',accept:'image/*',hidden:true}); document.body.append(inp);
  inp.onchange=()=>{ const f=inp.files[0]; inp.remove(); if(!f) return;
    const fr=new FileReader(); fr.onload=()=>{ const im=new Image(); im.onload=()=>{
      const S=512, k=Math.min(1, S/Math.max(im.width, im.height)), cv=document.createElement('canvas'); cv.width=Math.max(1,Math.round(im.width*k)); cv.height=Math.max(1,Math.round(im.height*k));
      cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);   // réduite à 512 px pour garder le projet léger
      const id='t'+Date.now().toString(36); state.textures ||= {}; state.textures[id]={name:f.name.replace(/\.[^.]+$/,'').slice(0,40)||'Image', src:cv.toDataURL('image/jpeg',0.85)};
      for(const p of parts){ p.mat={k:'image', img:id, size:p.mat?.size||40}; p.color='#ffffff'; }
      partChanged(parts[0], true); toast('Image appliquée : elle est projetée sur les faces de la pièce. Réglez la taille du motif.'); };
      im.onerror=()=>toast('Image illisible.'); im.src=fr.result; }; fr.readAsDataURL(f); };
  inp.click();
}
function matSec(parts){
  const p=parts[0], cur=parts.every(q=>(q.mat?.k||'')===(p.mat?.k||''))? (p.mat?.k||'') : null;
  const grid=h('div',{class:'mat-grid',role:'radiogroup','aria-label':'Matière'},
    h('button',{class:'mat-b'+(cur===''?' on':''),role:'radio','aria-checked':String(cur===''),title:'Sans matière : couleur unie',onclick:()=>setMat(parts,null)}, h('span',{class:'mat-chip',style:`background:${p.color}`}), 'Aucune'),
    ...MATIERES.filter(m=>m[0]!=='image').map(m=>h('button',{class:'mat-b'+(cur===m[0]?' on':''),role:'radio','aria-checked':String(cur===m[0]),title:m[1]+(m[6]?` · ${fmt(m[6],2)} g/cm³`:''),onclick:()=>setMat(parts,m[0])}, matChip(m, p.color), m[1].replace(' (impression 3D)','').replace(' (pin)','').replace('Médium (MDF)','MDF'))));
  const s=sec('Matière', grid);
  // image importée : choisir parmi celles du projet, en importer une autre, taille du motif
  const imgs=Object.entries(state.textures||{});
  const ib=h('div',{class:'mat-imgs'},
    ...imgs.map(([id,t])=>h('button',{class:'mat-img'+(p.mat?.k==='image' && p.mat.img===id?' on':''),title:t.name,'aria-label':'Image '+t.name,style:`background-image:url(${t.src})`,onclick:()=>{ if(!guard())return; parts.forEach(q=>{ q.mat={k:'image',img:id,size:q.mat?.size||40}; q.color='#ffffff'; }); partChanged(p,true); }})),
    h('button',{class:'btn mat-imp',title:'Importer une image (photo de bois, de tissu, logo…) projetée sur les faces de la pièce',onclick:()=>importTexture(parts)}, svgIcon('open'), imgs.length? 'Autre image…' : 'Importer une image…'));
  s.append(minLvl(h('div',{class:'mat-imgrow'}, h('small',{},'Image'), ib),2));
  if(p.mat?.k==='image') s.append(row('Taille du motif', numInput('Taille du motif', p.mat.size||40, 'mm', v=>{ if(!guard())return; parts.forEach(q=>{ if(q.mat?.k==='image') q.mat.size=v; }); partChanged(p); }, {min:1,max:5000,step:5})));
  // masse : volume × masse volumique (pièce seule)
  const M=matOf(p);
  if(parts.length===1 && M?.[6] && lv(2)){ const r=meshes.get(p.id), V= r? geoVolume(r.mesh.geometry)/1000 : 0;   // cm³
    if(V>0) s.append(h('div',{class:'info',html:`Volume ≈ <b>${fmt(V,V<10?2:1)} cm³</b> · masse volumique ${fmt(M[6],2)} g/cm³<br>Masse ≈ <b>${V*M[6]>=1000? fmt(V*M[6]/1000,2)+' kg' : fmt(V*M[6],1)+' g'}</b> <span style="opacity:.7">(m = ρ × V)</span>`})); }
  return s;
}
function modeSec(parts){
  const allHole=parts.every(p=>p.hole), allSolid=parts.every(p=>!p.hole);
  return sec('Type', h('div',{class:'mode2'},
    h('button',{class:'btn'+(allSolid?' on':''),onclick:()=>setHole(false)}, svgIcon('solid'),'Solide'),
    h('button',{class:'btn hole'+(allHole?' on':''),onclick:()=>setHole(true)}, svgIcon('hole'),'Perçage')),
    allHole? h('div',{class:'info',html:'Un perçage creuse les solides avec lesquels il est <b>groupé</b>.'}) : null);
}
function sceneList(){
  const list=h('div',{style:'display:flex;flex-direction:column;gap:2px'});
  for(const p of [...state.parts].reverse()){
    const j=state.joints.find(j=>j.child===p.id);
    const b=h('button',{class:'btn ghost',style:'justify-content:flex-start;padding:5px 6px;'+(selection.includes(p.id)?'background:var(--accent-soft)':''),onclick:e=>{ selection = e.shiftKey? (selection.includes(p.id)?selection.filter(i=>i!==p.id):[...selection,p.id]) : [p.id]; sync(); renderInspector(); }},
      (()=>{ const s=svgIcon(p.kind); s.style.width='20px'; s.style.height='20px'; return s; })(),
      h('span',{style:'flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis'},p.name),
      p.hole? h('span',{class:'badge fixe'},'perçage'):null, j? h('span',{class:'badge'},jointLabel(j.type)):null);
    list.append(b);
  }
  const s=sec(`Pièces de la scène (${state.parts.length})`, state.parts.length? list : h('p',{class:'empty'},'Le tapis est vide.')); s.dataset.max=2; return s;
}
function renderPart(body){
  const ps=selParts();
  if(!ps.length){
    body.append(h('p',{class:'empty insp-empty'},'Cliquez sur un objet pour voir et modifier ses propriétés dans ce panneau.'));
    body.append(sceneList()); return;
  }
  let lock=simLocked();
  if(ps.length>1){
    body.append(sec(null, h('div',{class:'kind-head'}, svgIcon('group'), h('div',{style:'font-family:var(--f-display);font-weight:600;font-size:17px'},`${ps.length} pièces sélectionnées`))));
    body.append(modeSec(ps)); body.append(colorSec(ps)); if(ps.every(q=>!q.hole)) body.append(matSec(ps));
    const g=h('div',{class:'align-grid'}, h('span'), h('small',{style:'text-align:center;color:var(--ink-2)'},'min'), h('small',{style:'text-align:center;color:var(--ink-2)'},'centre'), h('small',{style:'text-align:center;color:var(--ink-2)'},'max'));
    for(const ax of ['x','y','z']){ g.append(h('b',{class:ax},ax.toUpperCase())); for(const m of ['min','center','max']) g.append(h('button',{class:'btn',onclick:()=>alignSel(ax,m),title:`Aligner sur ${m==='center'?'le centre':m} en ${ax.toUpperCase()}`}, m==='min'?'⇤':m==='max'?'⇥':'⇹')); }
    body.append(minLvl(sec('Aligner', g),2));
    body.append(sec('Assembler', h('button',{class:'btn primary',style:'justify-content:center',onclick:groupSel}, svgIcon('group'),'Grouper la sélection'), h('div',{class:'info',html:'Grouper fusionne les solides et <b>retire la matière des perçages</b>.'})));
    body.append(sec('Encombrement', h('div',{class:'info','data-live':'bbox',html:bboxText()})));
    body.append(sceneList());
    return;
  }
  const p=ps[0]; const K=KINDS[p.kind]; lock = lock || isLocked(p);
  const nameIn=h('input',{value:p.name,'aria-label':'Nom de la pièce'}); nameIn.addEventListener('change',()=>{ p.name=nameIn.value.trim()||K.label; commit(); renderInspector(); });
  body.append(sec(null, h('div',{class:'kind-head'}, svgIcon(p.kind), nameIn)));
  if(isLocked(p)) body.append(h('div',{class:'info',html:'<b>Pièce verrouillée.</b> Cliquez le cadenas dans l’arborescence pour la modifier.'}));
  else if(lock) body.append(h('div',{class:'info',html:'Simulation en cours : réinitialisez (⟲) pour modifier.'}));
  body.append(modeSec([p]));
  if(!p.hole){ body.append(colorSec([p])); body.append(matSec([p])); }
  // dimensions
  const dims=sec(p.kind==='group'?'Groupe':'Dimensions');
  for(const f of K.fields){
    if(f.type==='text'){ const t=h('input',{class:'field',value:p.params[f.k],'aria-label':f.label,maxlength:'40',disabled:lock||null}); t.addEventListener('change',()=>{ p.params[f.k]=t.value; partChanged(p); }); dims.append(row(f.label,t)); }
    else if(f.type==='select'){ const s=h('select',{class:'field','aria-label':f.label,disabled:lock||null}, f.opts.map(([v,l])=>h('option',{value:v,selected:p.params[f.k]===v||null},l))); s.addEventListener('change',()=>{ p.params[f.k]=s.value; partChanged(p); }); dims.append(row(f.label,s)); }
    else dims.append(minLvl(row(f.label, numInput(f.label,p.params[f.k],f.unit,v=>{ if(!guard())return; p.params[f.k]=v; partChanged(p, p.kind==='gear'||p.kind==='rack'); }, {...f, disabled:lock})), f.lvl||1));
  }
  if(p.kind==='gear'){ const z=p.params.z, m=p.params.m; dims.append(h('div',{class:'info',html:`Diamètre primitif <b>d = m × Z = ${fmt(m*z)} mm</b><br>Diamètre extérieur ${fmt(m*(z+2))} mm · pas ${fmt(Math.PI*m)} mm<br>Deux roues engrènent si elles ont le <b>même module</b>. Entraxe = (d₁ + d₂) / 2.`})); }
  if(p.kind==='rack'){ const m=p.params.m; dims.append(h('div',{class:'info',html:`Pas <b>p = π × m = ${fmt(Math.PI*m)} mm</b> · longueur ${fmt(Math.PI*m*p.params.n,1)} mm<br>La ligne primitive passe par l'origine de la pièce (Y = 0) : placez-la à <b>d/2</b> du centre du pignon.`})); }
  if(p.kind==='text') dims.append(h('div',{class:'info'},'Les accents et chiffres sont acceptés. 40 caractères au maximum.'));
  if(p.kind==='sketch'){
    dims.append(h('div',{class:'info',html: p.params.mode==='revolve'? 'Volume obtenu par <b>révolution</b> du profil autour de l’axe vertical de l’esquisse (axe Z de la pièce).' : `Profil <b>extrudé</b> sur ${fmt(p.params.h)} mm.`}));
    if(p.params.mode!=='revolve') dims.append(row("Hauteur d'extrusion", numInput('Hauteur',p.params.h,'mm',v=>{ if(!guard())return; p.params.h=v; partChanged(p); },{min:0.1,step:1,disabled:lock})));
    dims.append(minLvl(h('button',{class:'btn',style:'justify-content:center',disabled:lock||null,onclick:()=>openSketch(p)}, svgIcon('edit'),"Modifier l'esquisse"),2));
  }
  if(p.kind==='group'){ const nh=p.children.filter(c=>c.hole).length; dims.append(h('div',{class:'info',html:`Assemblage de <b>${p.children.length} pièces</b>${nh?` dont ${nh} perçage${nh>1?'s':''}`:''}.`}), h('button',{class:'btn primary',style:'justify-content:center',disabled:lock||null,onclick:()=>enterGroupEdit(p.id),title:'Double-clic sur le groupe fait la même chose'}, svgIcon('group'),'Modifier l’intérieur'), h('button',{class:'btn',style:'justify-content:center',disabled:lock||null,onclick:ungroupSel}, svgIcon('ungroup'),'Dégrouper')); }
  if(K.fields.length||p.kind==='group'||p.kind==='sketch') body.append(dims);
  // position + rotation
  const xyz=(arr,unit,key,step)=>h('div',{class:'xyz'}, ...[0,1,2].map(i=>h('div',{}, h('b',{class:'xyz-l '+'xyz'[i]},'XYZ'[i]),
    numInput(key+'XYZ'[i], arr[i], unit, v=>{ if(!guard())return; p[key][i]=v; partChanged(p); },{min:-1e5,max:1e5,step,live:key+i,disabled:lock}))));
  body.append(sec('Position (mm)', xyz(p.pos,'','pos',1)));
  body.append(sec('Rotation (degrés)', xyz(p.rot,'°','rot',15)));
  body.append(sec('Encombrement', h('div',{class:'info','data-live':'bbox',html:bboxText()})));
  const j=state.joints.find(j=>j.child===p.id);
  const supports=state.joints.filter(j=>j.parent===p.id);
  body.append(minLvl(sec('Mouvement', h('div',{class:'info',html: j? `Reliée à <b>${partName(j.parent)}</b> par une liaison <b>${jointLabel(j.type).toLowerCase()}</b>.` : supports.length? `Support de ${supports.length} liaison${supports.length>1?'s':''}.` : 'Aucune liaison.'}),
    h('button',{class:'btn',style:'justify-content:center',onclick:()=>{ setWs('mech'); if(!j){ if(mechReady()) openJointForm(null,p.id); } else selJoint=j.id; renderInspector(); updateMarkers(); }}, svgIcon('link'), j?'Voir la liaison':'Ajouter une liaison')),2));
  body.append(sceneList());
}

/* =========================================================
   Joints (liaisons) and simulation
   ========================================================= */
const JT={fixe:'Encastrement',pivot:'Pivot',glissiere:'Glissière'};
const jointLabel=t=>JT[t]||t;
const partName=id=> id==null? 'Bâti (fixe)' : (findPart(id)?.name||'?');
const unitOf=j=> j.type==='glissiere'?'mm':'°';
const AX={x:[1,0,0],y:[0,1,0],z:[0,0,1]};
let jf=null; // joint form state

function restMatrix(id){ const p=id==null?null:findPart(id); return p? partMatrix(p) : new THREE.Matrix4(); }
function jointWorld(j, useCurrent=false){
  const M = useCurrent && j.parent!=null ? curMatrix(j.parent) : restMatrix(j.parent);
  const o=new THREE.Vector3(...j.origin).applyMatrix4(M);
  const rot=new THREE.Matrix4().extractRotation(M);
  const a=new THREE.Vector3(...j.axis).applyMatrix4(rot).normalize();
  return {o,a};
}
function nearestAxis(a){ const ax=['x','y','z']; let best='z',bv=-1; ax.forEach((k,i)=>{ const v=Math.abs(a.getComponent(i)); if(v>bv){bv=v;best=k;} }); return best; }

function openJointForm(j=null, childId=null){
  if(j){ const {o,a}=jointWorld(j); jf={edit:j.id,name:j.name,type:j.type,child:j.child,parent:j.parent,axis:nearestAxis(a),origin:[o.x,o.y,o.z].map(v=>+v.toFixed(3)),
      min:j.min, max:j.max, motor:j.motor?.mode||'none', speed:j.motor?.speed??45, driver:j.driver?.joint??null, ratio:j.driver?.ratio??1, calc:'gear', loc:j.loc||null};
    if(j.loc){ const lp=findPart(j.loc.pid), l=lp?.locs?.find(k=>k.id===j.loc.lid); if(l){ jf.axis='loc'; jf.locDir=[a.x,a.y,a.z]; } else jf.loc=null; } }
  else {
    const free=state.parts.filter(p=>!state.joints.some(k=>k.child===p.id));
    const c = childId ?? (selection.find(id=>!state.joints.some(k=>k.child===id)) ?? free[0]?.id ?? null);
    jf={edit:null,name:'',type:'pivot',child:c,parent:null,axis:'z',origin:[0,0,0],min:null,max:null,motor:'none',speed:45,driver:null,ratio:1,calc:'gear',loc:null};
    centerOrigin(); defaultJointLoc();
  }
  updateMarkers();
}
function defaultJointLoc(){ if(!jf||jf.child==null) return; const p=findPart(jf.child); const l=p?.locs?.find(k=>k.kind==='axe') || p?.locs?.find(k=>k.kind==='centre'); if(l) setJointLoc(p.id,l.id,true); }
function setJointLoc(pid, lid, quiet=false){
  if(!jf) return; const p=findPart(pid), l=p?.locs?.find(k=>k.id===lid); if(!l) return;
  const {o,d}=locWorld(p,l); jf.loc={pid,lid}; jf.origin=[o.x,o.y,o.z].map(v=>+v.toFixed(3)); jf.axis='loc'; jf.locDir=[d.x,d.y,d.z];
  if(!quiet){ toast(`Repère choisi : ${l.name} (${p.name})`); renderInspector(); updateMarkers(); }
}
function centerOrigin(){ if(!jf||jf.child==null) return; const b=selBox([jf.child]); if(b.isEmpty()) return; const c=new THREE.Vector3(); b.getCenter(c); jf.origin=[c.x,c.y,c.z].map(v=>+v.toFixed(2)); }
let pickMode=null;
function startPick(){
  if(!jf) return;
  $('#pickHint').hidden=false; $('#pickHint').textContent='Cliquez un point sur une pièce pour placer l’axe — Échap pour annuler';
  pickMode=(pt)=>{ if(pt){ const s=+$('#snapSel').value; const r=v=> s>0? Math.round(v/s)*s : +v.toFixed(2); jf.origin=[r(pt.x),r(pt.y),r(pt.z)]; } cancelPick(); renderInspector(); updateMarkers(); };
  updateGizmo();
}
function cancelPick(){ pickMode=null; $('#pickHint').hidden=true; if(PP.open) closePlanePicker(); updateGizmo(); }

function driverChainHas(startId, target){ let id=startId, guard=0; while(id!=null && guard++<50){ if(id===target) return true; const k=state.joints.find(x=>x.id===id); id=k?.driver?.joint??null; } return false; }
function saveJoint(){
  const f=jf; if(!f) return;
  if(f.child==null) return toast('Choisissez la pièce mobile.');
  if(f.child===f.parent) return toast('La pièce mobile et son support doivent être différents.');
  if(state.joints.some(k=>k.child===f.child && k.id!==f.edit)) return toast("Cette pièce a déjà une liaison : une pièce mobile n'a qu'un seul support.");
  // cycle: walk up from the support
  let up=f.parent, g=0; while(up!=null && g++<100){ if(up===f.child) return toast('Impossible : le support est déjà entraîné par cette pièce.'); up=state.joints.find(k=>k.child===up)?.parent??null; }
  if(f.driver!=null && f.edit!=null && driverChainHas(f.driver, f.edit)) return toast('Impossible : ces liaisons s’entraîneraient en boucle.');
  if(f.min!=null && f.max!=null && f.min>f.max) [f.min,f.max]=[f.max,f.min];
  const PR=restMatrix(f.parent), inv=PR.clone().invert(), rotInv=new THREE.Matrix4().extractRotation(inv);
  const o=new THREE.Vector3(...f.origin).applyMatrix4(inv); const a=new THREE.Vector3(...(f.axis==='loc'&&f.locDir? f.locDir : AX[f.axis])).applyMatrix4(rotInv).normalize();
  const data={type:f.type, child:f.child, parent:f.parent, origin:[o.x,o.y,o.z].map(v=>+v.toFixed(5)), axis:[a.x,a.y,a.z].map(v=>+v.toFixed(6)),
    min:f.type==='fixe'?null:f.min, max:f.type==='fixe'?null:f.max,
    motor: f.type!=='fixe' && f.driver==null && f.motor!=='none' ? {mode:f.motor, speed:+f.speed||0} : null,
    driver: f.type!=='fixe' && f.driver!=null ? {joint:f.driver, ratio:+f.ratio||0} : null, loc: f.axis==='loc'? f.loc : null};
  if(f.edit!=null){ const j=state.joints.find(k=>k.id===f.edit); Object.assign(j,data); if(f.name) j.name=f.name; selJoint=j.id; }
  else { const n=state.joints.length+1; const j={id:state.nextId++, name:f.name||`L${n} ${jointLabel(f.type)}`, ...data}; state.joints.push(j); selJoint=j.id; }
  jf=null; simReset(true); sync(); commit(); renderInspector();
}
function deleteJoint(id){ state.joints=state.joints.filter(j=>j.id!==id); for(const j of state.joints) if(j.driver?.joint===id) j.driver=null; if(selJoint===id) selJoint=null; simReset(true); sync(); commit(); renderInspector(); }

function sliderRange(j){ const d= j.type==='glissiere'? [-50,50] : [-180,180]; return [j.min??d[0], j.max??d[1]]; }
function renderJoints(body){
  const lock=simLocked();
  if(!state.joints.length && !jf){
    body.append(sec('Mettre en mouvement', h('div',{class:'empty',html:'Une <b>liaison</b> relie une pièce mobile à son support :<br>• <b>Encastrement</b> : la pièce suit son support.<br>• <b>Pivot</b> : rotation autour d’un axe.<br>• <b>Glissière</b> : translation le long d’un axe.<br><br>Donnez un <b>moteur</b> à une liaison, ou faites-la entraîner par une autre (engrenages, poulies, pignon-crémaillère), puis lancez <b>Simuler</b>.'})));
  }
  for(const j of state.joints){
    const val=jointValue(j);
    const card=h('div',{class:'jcard'+(selJoint===j.id?' sel':''),onclick:e=>{ if(e.target.closest('button,input,select')) return; selJoint=j.id; renderInspector(); updateMarkers(); }});
    card.append(h('div',{class:'jhead'}, h('span',{class:'badge'+(j.type==='fixe'?' fixe':'')},jointLabel(j.type)), h('span',{class:'jname'},j.name),
      h('button',{class:'btn icon ghost',title:'Modifier',disabled:lock||null,onclick:()=>{ openJointForm(j); renderInspector(); }}, svgIcon('edit')),
      h('button',{class:'btn icon ghost danger',title:'Supprimer la liaison',disabled:lock||null,onclick:()=>deleteJoint(j.id)}, svgIcon('trash'))));
    const ax=nearestAxis(jointWorld(j).a).toUpperCase();
    const lp=j.loc? findPart(j.loc.pid)?.locs?.find(l=>l.id===j.loc.lid) : null;
    card.append(h('div',{class:'jsub',html:`<b>${partName(j.child)}</b> sur ${partName(j.parent)}${j.type!=='fixe'?` · axe ${ax}`:''}${lp?` · repère « ${lp.name} »`:''}`}));
    if(j.type!=='fixe'){
      if(j.driver){ const d=state.joints.find(k=>k.id===j.driver.joint); card.append(h('div',{class:'jsub',html:`Entraînée par <b>${d?.name||'?'}</b> · rapport <span class="mono">${fmt(j.driver.ratio,4)}</span> ${j.type==='glissiere'?(d?.type==='glissiere'?'mm/mm':'mm/°'):(d?.type==='glissiere'?'°/mm':'')}`}));
        card.append(h('div',{class:'jslider'}, h('span',{class:'jsub'},'Valeur'), h('span',{class:'jval','data-jv':j.id},`${fmt(val,1)} ${unitOf(j)}`))); }
      else {
        if(j.motor) card.append(h('div',{class:'jsub',html:`Moteur : <b>${j.motor.mode==='continu'?'continu':'aller-retour'}</b> à ${fmt(j.motor.speed)} ${unitOf(j)}/s`}));
        const [lo,hi]=sliderRange(j);
        const r=h('input',{type:'range',min:lo,max:hi,step:j.type==='glissiere'?0.5:1,value:val,'aria-label':'Position de '+j.name,'data-js':j.id});
        r.addEventListener('input',()=>{ sim.values[j.id]=+r.value; onSimTouched(); });
        card.append(h('div',{class:'jslider'}, r, h('span',{class:'jval','data-jv':j.id},`${fmt(val,1)} ${unitOf(j)}`)));
      }
      if(j.min!=null||j.max!=null) card.append(h('div',{class:'jsub'},`Butées : ${j.min!=null?fmt(j.min):'—'} à ${j.max!=null?fmt(j.max):'—'} ${unitOf(j)}`));
    }
    body.append(card);
  }
  if(jf) body.append(jointForm());
  else body.append(h('button',{class:'btn primary',style:'justify-content:center;padding:9px',disabled:(lock||state.parts.length<1)||null,onclick:()=>{ openJointForm(); renderInspector(); }}, svgIcon('plus'),'Ajouter une liaison'));
  if(lock && !jf) body.append(h('div',{class:'info'},'Réinitialisez la simulation (⟲) pour ajouter ou modifier des liaisons.'));
  const lab=h('input',{type:'checkbox',checked:prefs.labels||null}); lab.onchange=()=>{ prefs.labels=lab.checked; savePrefs(); buildJointLabels(); };
  const lm=h('select',{class:'field','aria-label':'Repères affichés'}, [['auto','Utilisés par les liaisons'],['tous','Tous'],['aucun','Aucun']].map(([v,l])=>h('option',{value:v,selected:LOCV.mode===v||null},l))); lm.onchange=()=>{ LOCV.mode=lm.value; rebuildLocators(); };
  const jl=h('select',{class:'field','aria-label':'Disposition des étiquettes'}, JL_LAYOUTS.map(([v,l])=>h('option',{value:v,selected:prefs.jl===v||null},l))); jl.onchange=()=>setJlLayout(jl.value);
  body.append(sec('Affichage', h('label',{class:'chk'}, lab, 'Étiquettes des liaisons'), prefs.labels? row('Disposition', jl) : null, minLvl(row('Repères', lm),2), minLvl(locLegend(),2),
    h('div',{class:'jsub'},'Cliquez une pièce dans la vue pour ouvrir sa bulle : moteur, vitesse, relancer.')));
}
function jointForm(){
  const f=jf; const form=h('div',{class:'jform'});
  const rer=()=>{ renderInspector(); updateMarkers(); };
  const sel=(opts,val,on,label)=>{ const s=h('select',{class:'field','aria-label':label}, opts.map(([v,l])=>h('option',{value:String(v),selected:String(v)===String(val)||null},l))); s.addEventListener('change',()=>on(s.value)); return s; };
  form.append(h('h3',{style:'margin:0;font-family:var(--f-display);font-size:15px'}, f.edit!=null?'Modifier la liaison':'Nouvelle liaison'));
  const typeBtns=h('div',{style:'display:grid;grid-template-columns:repeat(3,1fr);gap:4px'}, ...['fixe','pivot','glissiere'].map(t=>h('button',{class:'btn'+(f.type===t?' on':''),style:'justify-content:center;flex-direction:column;gap:2px;padding:6px 2px;font-size:12px',onclick:()=>{ f.type=t; if(t==='glissiere'&&f.speed===45) f.speed=10; if(t==='pivot'&&f.speed===10) f.speed=45; rer(); }}, svgIcon(t==='fixe'?'link':t==='pivot'?'pivot':'slide'), jointLabel(t))));
  form.append(typeBtns);
  const partOpts=state.parts.map(p=>[p.id,p.name]);
  form.append(row('Pièce mobile', sel(partOpts, f.child, v=>{ f.child=+v; f.loc=null; f.axis='z'; centerOrigin(); defaultJointLoc(); rer(); }, 'Pièce mobile')));
  form.append(row('Support', sel([['null','Bâti (fixe)'],...partOpts.filter(([id])=>id!==f.child)], f.parent, v=>{ f.parent= v==='null'?null:+v; rer(); }, 'Support')));
  if(f.type!=='fixe'){
    const locOpts=[]; for(const pid of [f.child, f.parent]){ const p=pid!=null? findPart(pid):null; if(!p?.locs) continue; for(const l of p.locs) if(l.kind!=='base') locOpts.push([pid+':'+l.id, (pid===f.child?'':'Support · ')+l.name]); }
    locOpts.push(['libre', lv(3)? 'Point et axe libres' : 'Aucun repère']);
    form.append(row('Repère', sel(locOpts, f.loc && f.axis==='loc'? f.loc.pid+':'+f.loc.lid : 'libre', v=>{ if(v==='libre'){ f.loc=null; if(f.axis==='loc') f.axis=nearestAxis(new THREE.Vector3(...f.locDir)); rer(); return; } const [pid,lid]=v.split(':'); setJointLoc(+pid,lid); }, 'Repère')));
    form.append(h('div',{class:'jsub'},'Astuce : cliquez directement un repère (rond, flèche) dans la vue 3D.'));
    form.append(row('Axe', h('div',{class:'seg'}, ...(f.loc?[['loc','Repère']]:[]).concat([['x','X'],['y','Y'],['z','Z']]).map(([a,l])=>h('button',{class:'btn'+(f.axis===a?' on':''),style:'flex:1;justify-content:center;padding:6px 4px',onclick:()=>{ f.axis=a; rer(); }}, l)))));
    if(!f.loc || lv(3)) form.append(h('div',{class:'sec'}, h('label',{style:'color:var(--ink-2);font-size:13px'}, f.type==='pivot'?'Centre de rotation (mm)':'Point de l’axe (mm)'),
      h('div',{class:'xyz'}, ...[0,1,2].map(i=>h('div',{}, h('b',{class:'xyz'[i]},'XYZ'[i]), numInput('Origine '+'XYZ'[i], f.origin[i],'', v=>{ f.origin[i]=v; updateMarkers(); },{min:-1e5,max:1e5,step:1})))),
      h('div',{style:'display:flex;flex-wrap:wrap;gap:6px'}, h('button',{class:'btn',style:'flex:1 1 auto;justify-content:center;font-size:12.5px',onclick:()=>{ centerOrigin(); rer(); }}, 'Centre de la pièce'), h('button',{class:'btn',style:'flex:1 1 auto;justify-content:center;font-size:12.5px',onclick:startPick}, svgIcon('target'),'Cliquer un point'))));
    const u=f.type==='glissiere'?'mm':'°';
    const opt=(v,on)=>{ const inp=h('input',{type:'text',inputmode:'decimal',value:v==null?'':fmtIn(v),placeholder:'libre','aria-label':'Butée'}); inp.addEventListener('change',()=>{ const x=parseNum(inp.value); on(isFinite(x)?x:null); }); return h('div',{class:'num'},inp,h('span',{},u)); };
    form.append(row('Butée min', opt(f.min,v=>f.min=v)), row('Butée max', opt(f.max,v=>f.max=v)));
    const others=state.joints.filter(k=>k.id!==f.edit && k.type!=='fixe');
    form.append(row('Mise en mouvement', sel([['none','Manuelle (curseur)'],['continu','Moteur continu'],['alternatif','Moteur aller-retour'],...(others.length&&(lv(3)||f.driver!=null)?[['driven','Entraînée par une liaison']]:[])], f.driver!=null?'driven':f.motor, v=>{ if(v==='driven'){ f.driver=others[0].id; f.motor='none'; suggestRatio(); } else { f.driver=null; f.motor=v; } rer(); }, 'Mise en mouvement')));
    if(f.driver==null && f.motor!=='none') form.append(row('Vitesse', numInput('Vitesse', f.speed, u+'/s', v=>f.speed=v, {min:-1e4,max:1e4,step:5})));
    if(f.motor==='alternatif' && f.driver==null) form.append(h('div',{class:'info'},`L’aller-retour se fait entre les butées (par défaut ${f.type==='pivot'?'−45° et 45°':'0 et 20 mm'}).`));
    if(f.driver!=null){
      form.append(row('Menante', sel(others.map(k=>[k.id,k.name]), f.driver, v=>{ f.driver=+v; suggestRatio(); rer(); }, 'Liaison menante')));
      form.append(row('Rapport', numInput('Rapport', f.ratio, '', v=>f.ratio=v, {min:-1e4,max:1e4,step:0.1})));
      if(lv(3)) form.append(transmissionCalc());
    }
  }
  form.append(h('div',{style:'display:flex;gap:6px'}, h('button',{class:'btn primary',style:'flex:1;justify-content:center',onclick:saveJoint}, svgIcon('check'), f.edit!=null?'Enregistrer':'Créer la liaison'), h('button',{class:'btn',onclick:()=>{ jf=null; cancelPick(); renderInspector(); updateMarkers(); }},'Annuler')));
  return form;
}
function suggestRatio(){
  const f=jf; const d=state.joints.find(k=>k.id===f.driver); if(!d) return;
  const a=findPart(d.child), b=findPart(f.child);
  if(d.type==='pivot' && f.type==='pivot' && a?.kind==='gear' && b?.kind==='gear'){ f.calc='gear'; f.c1=a.params.z; f.c2=b.params.z; f.ratio=+(-a.params.z/b.params.z).toFixed(5); }
  else if(d.type==='pivot' && f.type==='glissiere' && a?.kind==='gear'){ f.calc='rack'; f.c1=a.params.m*a.params.z; f.ratio=+(Math.PI*f.c1/360).toFixed(5); }
  else if(d.type==='pivot' && f.type==='pivot'){ f.calc= (a?.kind==='cylinder'&&b?.kind==='cylinder')?'pulley':'gear'; if(f.calc==='pulley'){ f.c1=a.params.d; f.c2=b.params.d; f.ratio=+(a.params.d/b.params.d).toFixed(5); } }
  else if(d.type==='pivot' && f.type==='glissiere'){ f.calc='rack'; }
}
function transmissionCalc(){
  const f=jf; const box=h('div',{class:'calc'});
  const types=[['gear','Engrenage (roues dentées)'],['pulley','Poulies et courroie'],['rack','Pignon et crémaillère'],['screw','Vis et écrou']];
  const s=h('select',{class:'field','aria-label':'Calcul du rapport'}, types.map(([v,l])=>h('option',{value:v,selected:f.calc===v||null},l))); s.addEventListener('change',()=>{ f.calc=s.value; renderInspector(); });
  box.append(h('label',{style:'font-size:12.5px;color:var(--ink-2)'},'Calculer le rapport'), s);
  const n=(lab,k,def)=>{ if(f[k]==null) f[k]=def; return h('div',{}, h('small',{style:'color:var(--ink-2)'},lab), numInput(lab,f[k],'',v=>f[k]=v,{min:0.01,step:1})); };
  let r3, formula;
  if(f.calc==='gear'){ r3=[n('Z menante','c1',20),n('Z menée','c2',10)]; formula=()=>-f.c1/f.c2; box.append(h('div',{class:'jsub'},'r = − Z menante / Z menée (le sens s’inverse)')); }
  else if(f.calc==='pulley'){ r3=[n('Ø menante','c1',20),n('Ø menée','c2',40)]; formula=()=>f.c1/f.c2; box.append(h('div',{class:'jsub'},'r = Ø menante / Ø menée (même sens)')); }
  else if(f.calc==='rack'){ r3=[n('Ø primitif pignon (mm)','c1',40)]; formula=()=>Math.PI*f.c1/360; box.append(h('div',{class:'jsub'},'déplacement par degré = π × d / 360')); }
  else { r3=[n('Pas de la vis (mm)','c1',2)]; formula=()=>f.c1/360; box.append(h('div',{class:'jsub'},'déplacement par degré = pas / 360')); }
  box.append(h('div',{class:'r3'}, ...r3, h('button',{class:'btn',style:'align-self:end',onclick:()=>{ f.ratio=+formula().toFixed(5); renderInspector(); }},'Appliquer')));
  return box;
}

/* ---- simulation */
const sim={playing:false,t:0,values:{}};
function simActive(){ return sim.playing || sim.t>0 || Object.values(sim.values).some(v=>Math.abs(v)>1e-9); }
const simLocked=simActive;
function jointValue(j, depth=0){
  if(depth>30) return 0;
  if(j.driver){ const d=state.joints.find(k=>k.id===j.driver.joint); return d? j.driver.ratio*jointValue(d,depth+1) : 0; }
  return sim.values[j.id]||0;
}
function jointMatrix(j, v){
  const o=new THREE.Vector3(...j.origin), a=new THREE.Vector3(...j.axis).normalize();
  if(j.type==='pivot') return new THREE.Matrix4().makeTranslation(o.x,o.y,o.z).multiply(new THREE.Matrix4().makeRotationAxis(a, v*DEG)).multiply(new THREE.Matrix4().makeTranslation(-o.x,-o.y,-o.z));
  if(j.type==='glissiere') return new THREE.Matrix4().makeTranslation(a.x*v,a.y*v,a.z*v);
  return new THREE.Matrix4();
}
let curCache=null;
function curMatrix(id, depth=0){
  if(curCache && curCache.has(id)) return curCache.get(id);
  const p=findPart(id); if(!p) return new THREE.Matrix4();
  const rest=partMatrix(p); const j=state.joints.find(k=>k.child===id);
  let M=rest;
  if(j && depth<60){
    const PC = j.parent==null? new THREE.Matrix4() : curMatrix(j.parent, depth+1);
    const PR = restMatrix(j.parent);
    M = PC.clone().multiply(jointMatrix(j, jointValue(j))).multiply(PR.clone().invert()).multiply(rest);
  }
  curCache?.set(id,M); return M;
}
function applyPoses(){
  curCache=new Map();
  for(const p of state.parts){ const r=meshes.get(p.id); if(!r) continue; const M=curMatrix(p.id); M.decompose(r.mesh.position,r.mesh.quaternion,r.mesh.scale); r.mesh.updateMatrix(); }
  curCache=null; updateLocatorPoses();
}
function simStep(dt){
  sim.t+=dt;
  for(const j of state.joints){
    if(!j.motor || j.driver || j.type==='fixe') continue;
    const sp=j.motor.speed||0;
    if(j.motor.mode==='continu'){
      let v=(sim.values[j.id]||0)+sp*dt;
      if(j.min!=null) v=Math.max(j.min,v); if(j.max!=null) v=Math.min(j.max,v);
      sim.values[j.id]=v;
    } else {
      const lo=j.min ?? (j.type==='pivot'?-45:0), hi=j.max ?? (j.type==='pivot'?45:20); const range=Math.max(1e-6,hi-lo);
      const start=clamp(0,lo,hi)-lo;
      const a=((start+Math.abs(sp)*sim.t)%(2*range)+2*range)%(2*range);
      sim.values[j.id]= lo + (a<=range? a : 2*range-a);
    }
  }
}
function onSimTouched(){ if(!simActive()) { simReset(true); updateGizmo(); updateMarkers(); refreshJointValues(); return; } tc.detach(); applyPoses(); updateMarkers(); simUI(); refreshJointValues(); }
function refreshJointValues(){
  for(const j of state.joints){ const v=jointValue(j); $$(`[data-jv="${j.id}"]`).forEach(e=>e.textContent=`${fmt(v,1)} ${unitOf(j)}`); const s=$(`[data-js="${j.id}"]`); if(s && s!==document.activeElement) s.value=v; }
}
function simUI(){
  const act=simActive();
  const b=$('#sPlay'); b.innerHTML=''; b.append(svgIcon(sim.playing?'pause':'play'), h('span',{}, sim.playing?'Pause':(act?'Reprendre':'Simuler')));
  $('#sTime').textContent=fmt(sim.t,1)+' s';
  $('#banner').hidden=!act; $('#banner').textContent= sim.playing? 'Simulation en cours · pièces verrouillées · ⟲ pour revenir au départ' : 'Position simulée · ⟲ pour revenir au départ et modifier';
  updateToolButtons();
}
function simToggle(){
  if(!mechReady()){ toast('Validez d’abord les pièces (atelier 2 · Valider).'); return; }
  if(!state.joints.length){ toast('Ajoutez d’abord une liaison.'); return; }
  if(!sim.playing && !state.joints.some(j=>j.motor && !j.driver)) toast('Aucun moteur : utilisez les curseurs, ou ajoutez un moteur à une liaison.');
  cancelPick(); sim.playing=!sim.playing; tc.detach(); simUI(); renderInspector();
}
function simReset(silent=false){
  sim.playing=false; sim.t=0; sim.values={};
  for(const p of state.parts){ const r=meshes.get(p.id); if(r){ partMatrix(p,r.mesh.matrix); r.mesh.matrix.decompose(r.mesh.position,r.mesh.quaternion,r.mesh.scale); } }
  if(!silent){ updateGizmo(); renderInspector(); updateMarkers(); }
  simUI();
}

/* ---- joint markers */
const MK={ ring:new THREE.TorusGeometry(7,0.55,8,40,Math.PI*1.6), shaft:new THREE.CylinderGeometry(0.55,0.55,40,10).rotateX(Math.PI/2), cone:new THREE.ConeGeometry(1.8,4,14), oct:new THREE.OctahedronGeometry(3.2), sleeve:new THREE.BoxGeometry(5,5,6) };
const mkMat=c=>new THREE.MeshBasicMaterial({color:c,depthTest:false,transparent:true,opacity:.92});
/* joint markers: the gradient and the arrow head show the positive sense (right-hand rule for a pivot) */
function gradRing(R, r, color, arc){
  const c=new THREE.Color(color), pale=c.clone().lerp(new THREE.Color(0xffffff),0.55), g=new THREE.Group();
  const geo=new THREE.TorusGeometry(R, r, 8, 48, arc); const pos=geo.attributes.position, col=new Float32Array(pos.count*4);
  for(let i=0;i<pos.count;i++){ let th=Math.atan2(pos.getY(i),pos.getX(i)); if(th<-1e-6) th+=Math.PI*2; const t=clamp(th/arc,0,1); const m=pale.clone().lerp(c,t); col.set([m.r,m.g,m.b,0.1+0.9*t],i*4); }
  geo.setAttribute('color',new THREE.BufferAttribute(col,4));
  g.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthTest:false})));
  const cone=new THREE.Mesh(MK.cone, new THREE.MeshBasicMaterial({color:c,depthTest:false,transparent:true})); cone.position.set(R*Math.cos(arc),R*Math.sin(arc),0); cone.rotation.z=arc; g.add(cone);
  return g;
}
function markerFor(type, o, a, color){
  const g=new THREE.Group(); g.position.copy(o); g.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), a);
  if(type==='fixe'){ g.add(new THREE.Mesh(MK.oct,mkMat(color))); }
  else if(type==='pivot'){ g.add(gradShaft(22,0.5,color)); const back=gradShaft(16,0.45,color,{head:false,alpha0:0.04}); back.rotation.x=Math.PI; g.add(back); g.add(gradRing(7,0.6,color,Math.PI*1.6)); }
  else { g.add(gradShaft(22,0.55,color)); const back=gradShaft(22,0.55,color,{head:false,alpha0:0.04}); back.rotation.x=Math.PI; g.add(back); g.add(new THREE.Mesh(MK.sleeve,mkMat(color))); }
  g.traverse(x=>x.renderOrder=20); return g;
}
function updateMarkers(){
  const shared=new Set(Object.values(MK));
  for(const c of [...markers.children]){ markers.remove(c); c.traverse(x=>{ x.material?.dispose?.(); if(x.geometry && !shared.has(x.geometry)) x.geometry.dispose(); }); }
  buildJointLabels();
  if(ws!=='mech') return;
  const acc=cssVar('--accent')||'#1d7656', mark=cssVar('--mark')||'#df9a00';
  curCache=simActive()? new Map(): null;
  for(const j of state.joints){ if(jf && jf.edit===j.id) continue; const {o,a}=jointWorld(j, simActive()); const m=markerFor(j.type,o,a, selJoint===j.id? mark : acc); m.userData.j=j.id; markers.add(m); }
  curCache=null;
  if(jf && jf.child!=null) markers.add(markerFor(jf.type, new THREE.Vector3(...jf.origin), new THREE.Vector3(...(jf.axis==='loc'&&jf.locDir? jf.locDir : AX[jf.axis])).normalize(), mark));
}
/* during the simulation only the poses change: move the markers instead of rebuilding them */
function updateMarkerPoses(){
  curCache=new Map(); const Z=new THREE.Vector3(0,0,1);
  for(const m of markers.children){ const j=m.userData.j!=null && state.joints.find(k=>k.id===m.userData.j); if(!j) continue; const {o,a}=jointWorld(j,true); m.position.copy(o); m.quaternion.setFromUnitVectors(Z,a); }
  curCache=null;
}

/* =========================================================
   Files: project JSON, STL (zipped)
   ========================================================= */
let dlCap; async function downloadsCap(){ if(dlCap!==undefined) return dlCap; try{ dlCap = window.claude?.use ? await Promise.race([window.claude.use('downloads'), new Promise(r=>setTimeout(()=>r(null),4000))]) : null; }catch(e){ dlCap=null; } return dlCap; }
async function offerFile(filename, data){
  const d=await downloadsCap();
  if(d){ try{ await d.save({filename, data}); toast('Fichier enregistré : '+filename); } catch(e){ if(e?.code!=='declined') toast('Enregistrement impossible ici ('+(e?.code||'erreur')+').'); } return; }
  try{ const blob=data instanceof Blob?data:new Blob([data]); const a=h('a',{href:URL.createObjectURL(blob),download:filename}); document.body.append(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000); }
  catch(e){ toast('Le téléchargement est bloqué dans cette fenêtre.'); }
}
const slug=s=>(s||'projet').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase()||'projet';
function saveProject(){ if(state.edit) finishGroupEdit(); offerFile(slug(state.name)+'.json', JSON.stringify({app:'etabli3d',version:PROJET_FORMAT,name:state.name,parts:state.parts,joints:state.joints,nextId:state.nextId,note:state.note||null,tp:state.tp||null,struct:state.struct||null,textures:usedTextures()})); }
function stlBinary(list){
  let tris=0; const geos=list.map(r=>{ const g=r.mesh.geometry; const n=g.index?g.index.count/3:g.attributes.position.count/3; tris+=n; return {g, m:r.mesh.matrixWorld}; });
  const buf=new ArrayBuffer(84+tris*50), dv=new DataView(buf);
  const head='Etabli 3D - STL - unites : mm'; for(let i=0;i<head.length;i++) dv.setUint8(i,head.charCodeAt(i));
  dv.setUint32(80,tris,true); let off=84;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3();
  for(const {g,m} of geos){ const p=g.attributes.position, idx=g.index; const cnt=idx?idx.count:p.count;
    for(let i=0;i<cnt;i+=3){ const i0=idx?idx.getX(i):i, i1=idx?idx.getX(i+1):i+1, i2=idx?idx.getX(i+2):i+2;
      a.fromBufferAttribute(p,i0).applyMatrix4(m); b.fromBufferAttribute(p,i1).applyMatrix4(m); c.fromBufferAttribute(p,i2).applyMatrix4(m);
      n.subVectors(c,b).cross(new THREE.Vector3().subVectors(a,b)).normalize();
      for(const v of [n,a,b,c]){ dv.setFloat32(off,v.x,true); dv.setFloat32(off+4,v.y,true); dv.setFloat32(off+8,v.z,true); off+=12; }
      dv.setUint16(off,0,true); off+=2; } }
  return new Uint8Array(buf);
}
const CRC=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c= c&1? 0xEDB88320^(c>>>1) : c>>>1; t[n]=c>>>0; } return t; })();
function crc32(u8){ let c=0xFFFFFFFF; for(let i=0;i<u8.length;i++) c=CRC[(c^u8[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function zipStore(files){ // [{name, data:Uint8Array}]
  const enc=new TextEncoder(); const parts=[]; const central=[]; let offset=0;
  for(const f of files){ const nm=enc.encode(f.name), crc=crc32(f.data), sz=f.data.length;
    const lh=new DataView(new ArrayBuffer(30)); lh.setUint32(0,0x04034b50,true); lh.setUint16(4,20,true); lh.setUint16(6,0x0800,true); lh.setUint16(8,0,true); lh.setUint16(10,0,true); lh.setUint16(12,0x21,true); lh.setUint32(14,crc,true); lh.setUint32(18,sz,true); lh.setUint32(22,sz,true); lh.setUint16(26,nm.length,true); lh.setUint16(28,0,true);
    parts.push(new Uint8Array(lh.buffer), nm, f.data);
    const ch=new DataView(new ArrayBuffer(46)); ch.setUint32(0,0x02014b50,true); ch.setUint16(4,20,true); ch.setUint16(6,20,true); ch.setUint16(8,0x0800,true); ch.setUint16(10,0,true); ch.setUint16(12,0,true); ch.setUint16(14,0x21,true); ch.setUint32(16,crc,true); ch.setUint32(20,sz,true); ch.setUint32(24,sz,true); ch.setUint16(28,nm.length,true); ch.setUint32(42,offset,true);
    central.push(new Uint8Array(ch.buffer), nm); offset+=30+nm.length+sz; }
  const cdSize=central.reduce((s,a)=>s+a.length,0);
  const end=new DataView(new ArrayBuffer(22)); end.setUint32(0,0x06054b50,true); end.setUint16(8,files.length,true); end.setUint16(10,files.length,true); end.setUint32(12,cdSize,true); end.setUint32(16,offset,true);
  return new Blob([...parts,...central,new Uint8Array(end.buffer)],{type:'application/zip'});
}
async function exportStl(){
  if(state.edit) finishGroupEdit();
  const ids = selection.length? selection : state.parts.map(p=>p.id);
  const list=ids.map(id=>({p:findPart(id), r:meshes.get(id)})).filter(x=>x.p&&x.r&&!x.p.hole&&!isHidden(x.p));
  const skipped=ids.length-list.length;
  if(!list.length){ toast('Rien à exporter : les perçages seuls et les pièces masquées ne sont pas imprimés.'); return; }
  list.forEach(x=>x.r.mesh.updateMatrixWorld(true));
  const base=slug(state.name)+(selection.length?'-selection':'');
  const stl=stlBinary(list.map(x=>x.r));
  // Inside claude.ai the save dialog refuses the .stl extension, so the file travels in a .zip there.
  if(await downloadsCap()) offerFile(base+'-stl.zip', zipStore([{name:base+'.stl', data:stl}]));
  else offerFile(base+'.stl', new Blob([stl],{type:'model/stl'}));
  if(skipped) setTimeout(()=>toast(`${skipped} perçage${skipped>1?'s':''} non groupé${skipped>1?'s':''} ignoré${skipped>1?'s':''} dans l’export.`),2700);
}
