
/* =========================================================
   Wiring
   ========================================================= */
hydrateIcons();
for(const [host,list] of [['#rackBasic',BASIC],['#rackMeca',MECA]]){
  for(const k of list){ const b=h('button',{class:'shape',title:`Ajouter : ${KINDS[k].label}`,'data-min':KIND_LVL[k]>1?String(KIND_LVL[k]):null}, svgIcon(k), KINDS[k].label);
    b.addEventListener('pointerdown',e=>{ if(e.button!==0) return; e.preventDefault(); startPaletteDrag(k,e); });
    b.addEventListener('click',e=>{ if(e.detail===0) addPart(k); });
    $(host).append(b); }
}
$('#bSketch').addEventListener('click',()=>{ if(simLocked()){ toast('Réinitialisez la simulation (bouton ⟲) pour modifier les pièces.'); return; } openSketch(null); });

/* ---- level */
function setLevel(n, quiet=false){
  const prev=prefs.level; prefs.level=n; savePrefs(); applyLevelAttr();
  $$('#lvl [data-lvl]').forEach(b=>b.setAttribute('aria-checked', String(+b.dataset.lvl===n)));
  if(!lv(2)){ if(simActive()) simReset(true); if(!$('#sk').hidden) closeSketch(false); jf=null; }
  if((WS.find(w=>w.k===ws)?.lvl||1)>n) setWs('model');
  if(!lv(3) && SK.tool==='bezier') setSkTool('select');
  if(lv(3) && prefs.tree && !$('#app').classList.contains('with-tree') && !matchMedia('(max-width: 860px)').matches) setTreeOpen(true);
  sync(); renderInspector(); applyViewOffset(); updateSteps();
  if(!quiet && n!==prev) toast(`Niveau ${LEVELS[n-1].name} : ${LEVELS[n-1].desc}`, 3400);
}
$$('#lvl [data-lvl]').forEach(b=>b.onclick=()=>setLevel(+b.dataset.lvl));
$('#lvl').addEventListener('keydown',e=>{ if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft') return; e.preventDefault(); const n=clamp(prefs.level+(e.key==='ArrowRight'?1:-1),1,3); setLevel(n); $(`#lvl [data-lvl="${n}"]`).focus(); });

/* ---- outliner */
$('#bTree').onclick=()=>setTreeOpen(!$('#app').classList.contains('with-tree'));
$('#treeClose').onclick=()=>setTreeOpen(false);
$$('#treeMode [data-mode]').forEach(b=>b.onclick=()=>{ tree.mode=b.dataset.mode; renderOutliner(); });

/* ---- appearance */
function renderLook(){
  const m=$('#menuLook'); m.innerHTML='';
  const seg=h('div',{class:'seg'}, ...[['auto','Auto'],['light','Clair'],['dark','Sombre']].map(([v,l])=>h('button',{class:'btn'+(prefs.theme===v?' on':''),'aria-pressed':String(prefs.theme===v),onclick:()=>{ prefs.theme=v; savePrefs(); applyTheme(); renderLook(); afterLook(); }}, l)));
  const acc=h('div',{class:'look-sw'}, ...Object.entries(ACCENTS).map(([k,A])=>h('button',{'aria-pressed':String(prefs.accent===k),onclick:()=>{ prefs.accent=k; savePrefs(); applyTheme(); renderLook(); afterLook(); }}, h('i',{style:`background:${A.light[0]}`}), A.name)));
  const mats=h('div',{class:'look-sw'}, ...Object.entries(MATS).map(([k,M])=>h('button',{'aria-pressed':String(prefs.mat===k),onclick:()=>{ prefs.mat=k; savePrefs(); refreshMat(); renderLook(); }}, h('i',{style:`background:${M.fill}`}), M.name)));
  const axs=h('div',{class:'look-sw'}, ...Object.entries(AXCOL_SETS).map(([k,A])=>h('button',{'aria-pressed':String(prefs.axes===k),onclick:()=>{ prefs.axes=k; savePrefs(); renderLook(); rebuildLocators(); buildJointLabels(); }}, h('i',{style:`background:linear-gradient(90deg,${A.x} 0 33%,${A.y} 33% 66%,${A.z} 66%)`}), A.name)));
  m.append(h('div',{}, h('h4',{},'Thème'), seg), h('div',{}, h('h4',{},'Couleur principale'), acc), h('div',{}, h('h4',{},'Plan de travail'), mats), h('div',{}, h('h4',{},'Couleurs des axes X Y Z'), axs),
    h('div',{}, h('h4',{},'Panneaux'), h('div',{class:'seg',style:'margin-bottom:6px'}, ...[['transparent','Transparents'],['leger','Peu transparents'],['opaque','Opaques']].map(([v,l])=>h('button',{class:'btn'+(prefs.glass===v?' on':''),'aria-pressed':String(prefs.glass===v),onclick:()=>{ prefs.glass=v; savePrefs(); applyGlass(); renderLook(); }}, l))), h('button',{class:'btn',style:'width:100%;justify-content:center',onclick:()=>{ resetLayout(); $('#menuLook').hidden=true; }}, svgIcon('reset'),'Remettre les panneaux à leur place')),
    h('p',{class:'jsub',style:'margin:0'},'Ces réglages restent dans ce navigateur.'));
}
function afterLook(){ sceneBg(); sync(); skDraw(); }
$('#bLook').onclick=e=>{ e.stopPropagation(); const m=$('#menuLook'); if(m.hidden) renderLook(); m.hidden=!m.hidden; };
document.addEventListener('pointerdown',e=>{ if(!e.target.closest('.menu-wrap')) $('#menuLook').hidden=true; });
$('#tMove').onclick=()=>setGizmoMode('translate'); $('#tRot').onclick=()=>setGizmoMode('rotate');
$('#tSolid').onclick=()=>setHole(false); $('#tHole').onclick=()=>setHole(true);
$('#tGroup').onclick=groupSel; $('#tUngroup').onclick=ungroupSel; $('#tDup').onclick=duplicateSel; $('#tDrop').onclick=dropSel; $('#tDel').onclick=deleteSel;
$$('#views [data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('#snapSel').onchange=applySnap;
$('#sPlay').onclick=simToggle; $('#sReset').onclick=()=>simReset(false);
$$('#stTools [data-st]').forEach(b=>b.onclick=()=>stSetTool(b.dataset.st));
$$('#stTools [data-v3]').forEach(b=>b.onclick=()=>setStructView3D(b.dataset.v3==='1'));
$('#stFit').onclick=()=>{ if(ST.mode3d) setStructView3D(true); else { ST.fitted=false; stFit(); stDraw(); } };
$('#bUndo').onclick=undo; $('#bRedo').onclick=redo;
$('#bSave').onclick=saveProject; $('#bStl').onclick=exportStl;
$('#bOpen').onclick=()=>$('#fileIn').click();
$('#fileIn').onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ loadProject(JSON.parse(r.result), false); commit(); toast('Projet ouvert : '+state.name); }catch(err){ toast('Ce fichier n’est pas un projet Établi 3D (.json).'); } }; r.readAsText(f); e.target.value=''; };
$('#bNew').onclick=()=>{ simReset(true); resetFor('Nouveau projet'); selection=[]; jf=null; selJoint=null; $('#projName').value=state.name; sync(); commit(); renderDemo(); setTab('part'); toast('Nouveau projet. Ctrl+Z pour revenir en arrière.'); };
$('#projName').onchange=()=>{ state.name=$('#projName').value.trim()||'Mon projet'; commit(); };
$('#bExamples').onclick=openGallery;
$('#galleryClose').onclick=()=>{ $('#gallery').hidden=true; };
$('#gallery').addEventListener('pointerdown',e=>{ if(e.target.id==='gallery') $('#gallery').hidden=true; });
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
    if(k==='escape'){ if(SK.chain) finishChain(); else if(SK.pend){ SK.pend=null; SK.sel=null; skCleanup(); skPush(); skDraw(); } else if(SK.tool!=='select') setSkTool('select'); return; }
    if(k==='delete'||k==='backspace'){ e.preventDefault(); skDelete(); return; }
    const map={v:'select',l:'line',r:'rect',c:'circle',d:'dim',b:'bezier'}; if(map[k] && (k!=='b'||lv(3))) setSkTool(map[k]);
    return;
  }
  if(!$('#help').hidden){ if(k==='escape') $('#help').hidden=true; return; }
  if(k==='escape' && !$('#bubble').hidden){ closeBubble(); return; }
  if(!$('#gallery').hidden){ if(k==='escape') $('#gallery').hidden=true; return; }
  if(k==='escape' && !$('#menuLook').hidden){ $('#menuLook').hidden=true; return; }
  if(e.target.closest?.('input,select,textarea')) return;
  if(ws!=='model' && !mod){
    if(k==='escape'){ if(locPick!=null){ locPick=null; $('#pickHint').hidden=true; } else if(pickMode) cancelPick(); else if(ws==='struct'){ ST.chain=null; ST.sel=null; renderInspector(); stDraw(); } else { selection=[]; sync(); renderInspector(); } }
    else if(ws==='struct' && (k==='delete'||k==='backspace') && ST.sel){ e.preventDefault(); const T=SD().truss; if(ST.sel.t==='node'){ T.bars=T.bars.filter(b=>b.a!==ST.sel.id&&b.b!==ST.sel.id); T.nodes=T.nodes.filter(n=>n.id!==ST.sel.id); } else T.bars=T.bars.filter(b=>b.id!==ST.sel.id); ST.sel=null; structChanged(); }
    else if(k==='f' && ws!=='struct') setView('fit');
    return;
  }
  if(ws!=='model' && mod && !['z','y','s'].includes(k)) return;
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
initPanels();
(function boot(){
  document.documentElement.dataset.ws='model';
  $$('#lvl [data-lvl]').forEach(b=>b.setAttribute('aria-checked', String(+b.dataset.lvl===prefs.level)));
  if(lv(3) && prefs.tree && !matchMedia('(max-width: 860px)').matches) $('#app').classList.add('with-tree');
  $('#bTree').classList.toggle('on', $('#app').classList.contains('with-tree'));
  let loaded=false;
  try{ const s=localStorage.getItem('etabli3d.autosave'); if(s){ const o=JSON.parse(s); if(o.parts && o.parts.length){ loadProject(o,true); loaded=true; } } }catch(e){}
  if(!loaded){ loadExample('maison'); hist.stack=[hist.stack[hist.stack.length-1]]; hist.idx=0; openGallery(); }
  else { renderInspector(); renderDemo(); }
  simUI(); updateUndo(); updateSteps();
})();
resize();
let lastT=performance.now(), frame=0;
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min(0.05,(now-lastT)/1000); lastT=now; frame++;
  if(sim.playing){ simStep(dt*(+$('#sSpeed').value||1)); applyPoses(); if(ws==='mech') updateMarkerPoses(); if(frame%4===0){ refreshJointValues(); tickBubble(); $('#sTime').textContent=fmt(sim.t,1)+' s'; } }
  if(ws==='struct') stAnimTick(now);
  if(ws==='check') locTestTick(now);
  if(!$('#sk').hidden) return;
  if(!(ws==='struct' && !ST.mode3d)){ stepCam(now); orbit.update(); renderer.render(scene,camera); }
  // overlays projected with this frame's camera
  if(ws==='mech') positionJointLabels();
  if(ws==='struct' && ST.mode3d) positionStruct3DLabels();
  updateBubbleLink();
}
requestAnimationFrame(loop);
window.__etabli={state, SAMPLES, LAYOUT:()=>LAYOUT, resetLayout, togglePanel, CHK, startLocTest, stopLocTest, openStructBubble, openMechBubble, closeBubble, BUB, stAnimPlay, locEdit, locFrame, LOCV, applyStruct3DK, camera, orbit, structGroup, struct3DHit, renderer, ampFactor, structBox, stDraw, arrowHits:()=>stArrowHits, setWs, ws:()=>ws, validateAll, validatePart, vState, mechReady, setJointLoc, ST, SD, computeStruct, solveTruss, buildMesh, solvePlane, beamTheory, makeProxy, getProxyGeo, locGroup, loadExample, openGallery, addPart, groupSel, openSketch, closeSketch, SK, skSolve, sim, simToggle, simReset, exportStl, stlBinary, zipStore, meshes, selection:()=>selection, setSel:(ids)=>{selection=ids; sync(); renderInspector();}, setTab, openJointForm, saveJoint, jf:()=>jf, skProfiles, getGeometry};
