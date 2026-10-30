
/* =========================================================
   Examples
   ========================================================= */
function P_(kind, o){ const p=newPart(kind); if(o.params) Object.assign(p.params,o.params); delete o.params; Object.assign(p,o); return p; }
function J_(o){ // origin/axis given in world coordinates at rest
  const PR=restMatrix(o.parent??null), inv=PR.clone().invert(), rotInv=new THREE.Matrix4().extractRotation(inv);
  const og=new THREE.Vector3(...o.origin).applyMatrix4(inv), a=new THREE.Vector3(...AX[o.axis||'z']).applyMatrix4(rotInv).normalize();
  const j={id:state.nextId++, name:o.name, type:o.type, child:o.child, parent:o.parent??null, origin:[og.x,og.y,og.z], axis:[a.x,a.y,a.z], min:o.min??null, max:o.max??null, motor:o.motor||null, driver:o.driver||null};
  state.joints.push(j); return j;
}
function resetFor(name){ state.name=name; state.parts=[]; state.joints=[]; state.nextId=1; }
const EX={
  gears(){
    resetFor('Engrenages et crémaillère');
    const plate=P_('box',{name:'Platine',params:{L:170,l:80,h:5},color:'#f2f2ee',pos:[0,-8,0]});
    const g1=P_('gear',{name:'Roue menante Z20',params:{z:20,m:2,e:6,dh:5},color:'#e6a23a',pos:[0,0,5]});
    const g2=P_('gear',{name:'Pignon Z10',params:{z:10,m:2,e:6,dh:5},color:'#3d8bd0',pos:[30,0,5],rot:[0,0,18]});
    const rack=P_('rack',{name:'Crémaillère',params:{n:12,m:2,e:6,hb:6},color:'#8a6c55',pos:[0,-20,5]});
    const rail=P_('box',{name:'Guide',params:{L:170,l:4,h:6},color:'#6c7a89',pos:[0,-30.6,5]});
    const ax1=P_('cylinder',{name:'Axe 1',params:{d:5,h:14,seg:24},color:'#2c3331',pos:[0,0,5]});
    const ax2=P_('cylinder',{name:'Axe 2',params:{d:5,h:14,seg:24},color:'#2c3331',pos:[30,0,5]});
    const crank=P_('cylinder',{name:'Manivelle',params:{d:5,h:8,seg:24},color:'#e4574b',pos:[0,13,11]});
    state.parts.push(plate,g1,g2,rack,rail,ax1,ax2,crank);
    const j1=J_({name:'L1 Pivot roue menante',type:'pivot',child:g1.id,parent:plate.id,origin:[0,0,8],axis:'z',min:-90,max:90,motor:{mode:'alternatif',speed:45}});
    J_({name:'L2 Pivot pignon',type:'pivot',child:g2.id,parent:plate.id,origin:[30,0,8],axis:'z',driver:{joint:j1.id,ratio:-2}});
    J_({name:'L3 Glissière crémaillère',type:'glissiere',child:rack.id,parent:plate.id,origin:[0,-20,8],axis:'x',driver:{joint:j1.id,ratio:+(Math.PI*40/360).toFixed(5)}});
    J_({name:'L4 Manivelle',type:'fixe',child:crank.id,parent:g1.id,origin:[0,13,11]});
  },
  arm(){
    resetFor('Bras articulé');
    const base=P_('cylinder',{name:'Socle',params:{d:44,h:8,seg:64},color:'#6c7a89',pos:[0,0,0]});
    const tur=P_('cylinder',{name:'Tourelle',params:{d:24,h:22,seg:48},color:'#e6a23a',pos:[0,0,8]});
    const sh=P_('cylinder',{name:'Épaule',params:{d:14,h:16,seg:32},color:'#2c3331',pos:[0,8,32],rot:[90,0,0]});
    const a1=P_('box',{name:'Bras',params:{L:60,l:10,h:8},color:'#3a6fc4',pos:[25,0,28]});
    const el=P_('cylinder',{name:'Coude',params:{d:11,h:13,seg:32},color:'#2c3331',pos:[50,6.5,32],rot:[90,0,0]});
    const a2=P_('box',{name:'Avant-bras',params:{L:45,l:8,h:6},color:'#4aa36b',pos:[67.5,0,29]});
    const pince=P_('sphere',{name:'Pince',params:{d:12,seg:32},color:'#e4574b',pos:[90,0,26]});
    state.parts.push(base,tur,sh,a1,el,a2,pince);
    const j1=J_({name:'L1 Rotation tourelle',type:'pivot',child:tur.id,parent:base.id,origin:[0,0,10],axis:'z',min:-60,max:60,motor:{mode:'alternatif',speed:30}});
    J_({name:'L2 Épaule',type:'fixe',child:sh.id,parent:tur.id,origin:[0,0,32]});
    J_({name:'L3 Pivot épaule',type:'pivot',child:a1.id,parent:tur.id,origin:[0,0,32],axis:'y',min:-35,max:5,motor:{mode:'alternatif',speed:18}});
    J_({name:'L4 Coude',type:'fixe',child:el.id,parent:a1.id,origin:[50,0,32]});
    J_({name:'L5 Pivot coude',type:'pivot',child:a2.id,parent:a1.id,origin:[50,0,32],axis:'y',min:-50,max:10,motor:{mode:'alternatif',speed:35}});
    J_({name:'L6 Pince',type:'fixe',child:pince.id,parent:a2.id,origin:[90,0,32]});
    void j1;
  },
  crank(){
    resetFor('Poulies et perçages');
    const plate=P_('box',{name:'Support',params:{L:120,l:60,h:5},color:'#f2f2ee',pos:[20,0,0]});
    const pulley=(name,d,x,color)=>{ const G={id:state.nextId++,kind:'group',name,params:{},color,hole:false,pos:[x,0,5],rot:[0,0,0],children:[
        {id:state.nextId++,kind:'cylinder',name:'Disque',params:{d,h:8,seg:64},color,hole:false,pos:[0,0,0],rot:[0,0,0]},
        {id:state.nextId++,kind:'torus',name:'Gorge',params:{d,e:4,seg:64},color:'#7d8a86',hole:true,pos:[0,0,2],rot:[0,0,0]},
        {id:state.nextId++,kind:'cylinder',name:'Alésage',params:{d:5,h:20,seg:24},color:'#7d8a86',hole:true,pos:[0,0,-5],rot:[0,0,0]},
        {id:state.nextId++,kind:'cylinder',name:'Allègement',params:{d:d*0.2,h:20,seg:24},color:'#7d8a86',hole:true,pos:[d*0.27,0,-5],rot:[0,0,0]},
      ]}; return G; };
    const p1=pulley('Poulie menante Ø40',40,0,'#e4574b'), p2=pulley('Poulie menée Ø20',20,55,'#3d8bd0');
    const belt1=P_('box',{name:'Courroie (haut)',params:{L:55,l:2,h:3},color:'#2c3331',pos:[27.5,19,7.5],rot:[0,0,-10.47]});
    const belt2=P_('box',{name:'Courroie (bas)',params:{L:55,l:2,h:3},color:'#2c3331',pos:[27.5,-19,7.5],rot:[0,0,10.47]});
    belt1.pos=[27.5,15,7.5]; belt2.pos=[27.5,-15,7.5];
    const ax1=P_('cylinder',{name:'Axe 1',params:{d:5,h:16,seg:24},color:'#2c3331',pos:[0,0,5]});
    const ax2=P_('cylinder',{name:'Axe 2',params:{d:5,h:16,seg:24},color:'#2c3331',pos:[55,0,5]});
    state.parts.push(plate,p1,p2,belt1,belt2,ax1,ax2);
    const j1=J_({name:'L1 Moteur',type:'pivot',child:p1.id,parent:plate.id,origin:[0,0,9],axis:'z',motor:{mode:'continu',speed:60}});
    J_({name:'L2 Poulie menée',type:'pivot',child:p2.id,parent:plate.id,origin:[55,0,9],axis:'z',driver:{joint:j1.id,ratio:2}});
  },
  keyring(){
    resetFor('Porte-clés');
    const sk={nid:20,pts:[{id:1,x:0,y:0,fixed:true,origin:true},{id:2,x:50,y:0},{id:3,x:50,y:20},{id:4,x:0,y:20},{id:5,x:6,y:10}],
      lines:[{id:6,a:1,b:2},{id:7,a:2,b:3},{id:8,a:3,b:4},{id:9,a:4,b:1}], circles:[{id:10,c:5,r:2.5}],
      cons:[{id:11,type:'h',l:6},{id:12,type:'v',l:7},{id:13,type:'h',l:8},{id:14,type:'v',l:9},
        {id:15,type:'dx',a:1,b:2,value:50,sign:1,off:-5},{id:16,type:'dy',a:1,b:4,value:20,sign:1,off:-5},
        {id:17,type:'dx',a:1,b:5,value:6,sign:1,off:6},{id:18,type:'dy',a:1,b:5,value:10,sign:1,off:-1},{id:19,type:'diam',c:10,value:5,ang:0.8,off:3}]};
    const tag=P_('sketch',{name:'Plaque (esquisse)',params:{sk,mode:'extrude',h:3},color:'#3a6fc4',pos:[-25,-10,0]});
    const txt=P_('text',{name:'Texte',params:{txt:'TECHNO',size:6,h:1.5,font:'round'},color:'#f2f2ee',pos:[3,0,3]});
    state.parts.push(tag,txt);
  },
};
function loadExample(k){
  if(!EX[k]) return; simReset(true); EX[k](); selection=[]; selJoint=null; jf=null;
  $('#projName').value=state.name; sync(); commit(); renderInspector(); fitView();
  if(state.joints.length){ setTab('move'); toast('Exemple chargé. Lancez « Simuler » pour voir le mouvement.'); } else setTab('part');
}

/* =========================================================
   Wiring
   ========================================================= */
hydrateIcons();
for(const [host,list] of [['#rackBasic',BASIC],['#rackMeca',MECA]]){
  for(const k of list){ const b=h('button',{class:'shape',title:`Ajouter : ${KINDS[k].label}`}, svgIcon(k), KINDS[k].label);
    b.addEventListener('pointerdown',e=>{ if(e.button!==0) return; e.preventDefault(); startPaletteDrag(k,e); });
    b.addEventListener('click',e=>{ if(e.detail===0) addPart(k); });
    $(host).append(b); }
}
$('#bSketch').addEventListener('click',()=>{ if(guard()) openSketch(null); });
$('#tMove').onclick=()=>setGizmoMode('translate'); $('#tRot').onclick=()=>setGizmoMode('rotate');
$('#tSolid').onclick=()=>setHole(false); $('#tHole').onclick=()=>setHole(true);
$('#tGroup').onclick=groupSel; $('#tUngroup').onclick=ungroupSel; $('#tDup').onclick=duplicateSel; $('#tDrop').onclick=dropSel; $('#tDel').onclick=deleteSel;
$$('#views [data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('#snapSel').onchange=applySnap;
$('#sPlay').onclick=simToggle; $('#sReset').onclick=()=>simReset(false);
$('#tabPart').onclick=()=>setTab('part'); $('#tabMove').onclick=()=>setTab('move');
$('#bUndo').onclick=undo; $('#bRedo').onclick=redo;
$('#bSave').onclick=saveProject; $('#bStl').onclick=exportStl;
$('#bOpen').onclick=()=>$('#fileIn').click();
$('#fileIn').onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ loadProject(JSON.parse(r.result), false); commit(); toast('Projet ouvert : '+state.name); }catch(err){ toast('Ce fichier n’est pas un projet Établi 3D (.json).'); } }; r.readAsText(f); e.target.value=''; };
$('#bNew').onclick=()=>{ simReset(true); resetFor('Nouveau projet'); selection=[]; jf=null; selJoint=null; $('#projName').value=state.name; sync(); commit(); setTab('part'); toast('Nouveau projet. Ctrl+Z pour revenir en arrière.'); };
$('#projName').onchange=()=>{ state.name=$('#projName').value.trim()||'Mon projet'; commit(); };
$('#bExamples').onclick=e=>{ e.stopPropagation(); $('#menuExamples').hidden=!$('#menuExamples').hidden; };
$$('#menuExamples [data-ex]').forEach(b=>b.onclick=()=>{ $('#menuExamples').hidden=true; loadExample(b.dataset.ex); });
document.addEventListener('pointerdown',e=>{ if(!e.target.closest('.menu-wrap')) $('#menuExamples').hidden=true; });
$('#mobileInsp').onclick=()=>$('#insp').classList.toggle('open');
$('#bHelp').onclick=()=>{ $('#help').hidden=false; };
$('#helpClose').onclick=()=>{ $('#help').hidden=true; };
$('#help').addEventListener('pointerdown',e=>{ if(e.target.id==='help') $('#help').hidden=true; });
// sketch editor
$$('#skbar [data-tool]').forEach(b=>b.onclick=()=>setSkTool(b.dataset.tool));
$('#skDel').onclick=skDelete; $('#skUndo').onclick=skUndo; $('#skRedo').onclick=skRedo; $('#skFit').onclick=skFit;
$('#skSnap').onchange=()=>skDraw();
$('#skModeExt').onclick=()=>setSkMode('extrude'); $('#skModeRev').onclick=()=>setSkMode('revolve');
$('#skH').onchange=()=>{ const v=parseNum($('#skH').value); if(isFinite(v)&&v>0) SK.h=v; $('#skH').value=fmtIn(SK.h); };
$('#skOk').onclick=()=>closeSketch(true); $('#skCancel').onclick=()=>closeSketch(false);

function arrowDir(key){
  const f=orbit.target.clone().sub(camera.position); f.z=0; if(f.lengthSq()<1e-6) f.set(0,1,0); f.normalize();
  const snapA=v=> Math.abs(v.x)>Math.abs(v.y)? new THREE.Vector3(Math.sign(v.x),0,0) : new THREE.Vector3(0,Math.sign(v.y),0);
  const fwd=snapA(f), right=new THREE.Vector3(fwd.y,-fwd.x,0);
  return {arrowup:fwd, arrowdown:fwd.clone().negate(), arrowright:right, arrowleft:right.clone().negate()}[key];
}
document.addEventListener('keydown', e=>{
  const k=e.key.toLowerCase(); const mod=e.ctrlKey||e.metaKey;
  if(!$('#sk').hidden){
    if(e.target===$('#dimEdit') || e.target.closest?.('input:not([type=checkbox]),select')) return;
    if(mod&&k==='z'){ e.preventDefault(); e.shiftKey?skRedo():skUndo(); return; }
    if(mod&&k==='y'){ e.preventDefault(); skRedo(); return; }
    if(mod) return;
    if(k==='escape'){ if(SK.chain) finishChain(); else if(SK.pend){ SK.pend=null; SK.sel=null; skDraw(); } else if(SK.tool!=='select') setSkTool('select'); return; }
    if(k==='delete'||k==='backspace'){ e.preventDefault(); skDelete(); return; }
    const map={v:'select',l:'line',r:'rect',c:'circle',d:'dim'}; if(map[k]) setSkTool(map[k]);
    return;
  }
  if(!$('#help').hidden){ if(k==='escape') $('#help').hidden=true; return; }
  if(e.target.closest?.('input,select,textarea')) return;
  if(mod&&k==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); }
  else if(mod&&k==='y'){ e.preventDefault(); redo(); }
  else if(mod&&k==='g'){ e.preventDefault(); e.shiftKey?ungroupSel():groupSel(); }
  else if(mod&&k==='d'){ e.preventDefault(); duplicateSel(); }
  else if(mod&&k==='s'){ e.preventDefault(); saveProject(); }
  else if(mod&&k==='a'){ e.preventDefault(); selection=state.parts.map(p=>p.id); sync(); renderInspector(); }
  else if(mod) return;
  else if(k==='delete'||k==='backspace'){ e.preventDefault(); deleteSel(); }
  else if(k==='escape'){ if(pickMode) cancelPick(); else { selection=[]; sync(); renderInspector(); } }
  else if(k==='m') setGizmoMode('translate');
  else if(k==='r') setGizmoMode('rotate');
  else if(k==='h') setHole(true);
  else if(k==='s') setHole(false);
  else if(k==='d') dropSel();
  else if(k==='f') setView('fit');
  else if(k==='pageup'||k==='pagedown'){ e.preventDefault(); const st=(+$('#snapSel').value||1)*(e.shiftKey?10:1); nudge(0,0,k==='pageup'?st:-st); }
  else if(k.startsWith('arrow')){ if(!selection.length) return; e.preventDefault(); const st=(+$('#snapSel').value||1)*(e.shiftKey?10:1); const v=arrowDir(k); nudge(v.x*st,v.y*st,0); }
});

/* =========================================================
   Start
   ========================================================= */
setGizmoMode('translate'); applySnap();
csgReady.then(()=>{ for(const k of [...geoCache.keys()]) if(k.startsWith('g:')) geoCache.delete(k); for(const r of meshes.values()) r.key=null; sync(); });
(function boot(){
  let loaded=false;
  try{ const s=localStorage.getItem('etabli3d.autosave'); if(s){ const o=JSON.parse(s); if(o.parts && o.parts.length){ loadProject(o,true); loaded=true; } } }catch(e){}
  if(!loaded){ EX.gears(); $('#projName').value=state.name; sync(); hist.stack=[]; hist.idx=-1; commit(); renderInspector(); fitView(); setTab('move'); }
  else { renderInspector(); }
  simUI(); updateUndo();
})();
resize();
let lastT=performance.now(), frame=0;
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min(0.05,(now-lastT)/1000); lastT=now; frame++;
  if(sim.playing){ simStep(dt*(+$('#sSpeed').value||1)); applyPoses(); if(tab==='move') updateMarkers(); if(frame%4===0){ refreshJointValues(); $('#sTime').textContent=fmt(sim.t,1)+' s'; } }
  if(!$('#sk').hidden) return;
  stepCam(now); orbit.update(); renderer.render(scene,camera);
}
requestAnimationFrame(loop);
window.__etabli={state, EX, loadExample, addPart, groupSel, openSketch, closeSketch, SK, skSolve, sim, simToggle, simReset, exportStl, stlBinary, zipStore, meshes, selection:()=>selection, setSel:(ids)=>{selection=ids; sync(); renderInspector();}, setTab, openJointForm, saveJoint, jf:()=>jf, skProfiles, getGeometry};
