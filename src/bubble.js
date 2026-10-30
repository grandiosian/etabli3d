
/* =========================================================
   Bulle de simulation : un clic sur la structure ou la pièce ouvre une
   petite fenêtre accrochée au point cliqué, pour lancer l'animation,
   régler vite les paramètres et relancer.
   + Étiquettes de liaison (atelier Mécanique).
   ========================================================= */
const BUB={target:null, kind:null, x:0, y:0};
function placeBubble(x, y){
  const b=$('#bubble'), st=$('#stage').getBoundingClientRect(); const w=b.offsetWidth, hh=b.offsetHeight;
  const L=LAYOUT.bubble; if(L && L.x!=null){   // moved by the user: it stays where it was put
    setPos(b, clamp(L.x,0,Math.max(0,st.width-w)), clamp(L.y,0,Math.max(0,st.height-hh))); b.dataset.side=''; return; }
  let left=x+16, top=y-hh-14, side='bl';
  if(top<8){ top=y+16; side='tl'; }
  if(left+w>st.width-8){ left=x-w-16; side= side==='bl'? 'br' : 'tr'; }
  left=clamp(left,8,Math.max(8,st.width-w-8)); top=clamp(top,8,Math.max(8,st.height-hh-8));
  b.style.left=left+'px'; b.style.top=top+'px'; b.dataset.side=side;
}
function openBubble(kind, target, x, y, build){
  const b=$('#bubble'); BUB.kind=kind; BUB.target=target; BUB.x=x; BUB.y=y;
  b.innerHTML=''; build(b); hydrateIcons(b); b.hidden=false; placeBubble(x,y);
}
function closeBubble(){ const b=$('#bubble'); if(b){ b.hidden=true; } BUB.kind=null; BUB.target=null; }
function bubHead(icon, title, sub, chip){
  const head=h('div',{class:'bub-head',title:'Glisser pour déplacer la bulle'}, h('span',{class:'bub-grip','aria-hidden':'true'}, svgIcon('dots')), icon? svgIcon(icon) : null, h('div',{class:'bub-t'}, h('b',{},title), sub? h('small',{html:sub}) : null), chip||null,
    h('button',{class:'bub-pin',title:'Raccrocher la bulle à l’objet cliqué','aria-label':'Raccrocher la bulle à l’objet cliqué',onclick:unpinBubble}, svgIcon('pin')),
    h('button',{class:'bub-x',title:'Fermer','aria-label':'Fermer la bulle',onclick:closeBubble}, svgIcon('close')));
  head.addEventListener('pointerdown',e=>startPanelDrag(e, $('#bubble'), 'bubble'));
  return head;
}
function unpinBubble(){ delete LAYOUT.bubble; saveLayout(); const b=$('#bubble'); clearPos(b); placeBubble(BUB.x,BUB.y); }
/* slider row: label, range, value; onInput runs live, onChange once at the end */
function bubSlider(label, val, min, max, step, unit, onInput, onChange){
  const out=h('span',{class:'bub-v mono'}, `${fmt(val,step<1?1:0)} ${unit}`);
  const r=h('input',{type:'range',min,max,step,value:val,'aria-label':label});
  r.addEventListener('input',()=>{ const v=+r.value; out.textContent=`${fmt(v,step<1?1:0)} ${unit}`; onInput(v); });
  r.addEventListener('change',()=>onChange?.(+r.value));
  return h('div',{class:'bub-row'}, h('label',{},label), r, out);
}
function bubSeg(opts, val, on){ return h('div',{class:'seg bub-seg'}, ...opts.map(([v,l])=>h('button',{class:'btn'+(String(val)===String(v)?' on':''),onclick:()=>on(v)}, l))); }
function updateBubblePlay(){ const b=$('#bubPlay'); if(!b) return; const on= BUB.kind==='struct'? ST.anim.on : sim.playing; b.innerHTML=''; b.append(svgIcon(on?'pause':'play'), h('span',{}, on? 'Pause' : BUB.kind==='struct'? 'Animer' : 'Simuler')); }

/* ---- Structures */
function structVerdict(){
  const S=SD(); const R= S.mod==='treillis'? ST.res : ST.mres; if(!R?.ok) return ['err', R?.reason? 'Instable' : '—', null];
  const sf= S.mod==='treillis'? (R.worst?.sf??Infinity) : R.sf; const [cls,txt]=verdict(sf); return [cls, txt, sf];
}
function liveStruct(){ computeStruct(); if(ST.mode3d) buildStruct3D(); stDraw(); refreshStructBubble(); }
function refreshStructBubble(){
  const box=$('#bubRead'); if(!box || BUB.kind!=='struct') return; box.innerHTML='';
  const S=SD(), t=BUB.target; const [cls,txt,sf]=structVerdict();
  const chip=$('#bubChip'); if(chip){ chip.className='bub-chip v-'+cls; chip.textContent=txt; }
  const kv=(k,v)=>box.append(h('span',{},k), h('b',{class:'mono'},v));
  if(S.mod==='treillis'){ const R=ST.res; if(!R?.ok){ box.append(h('span',{class:'bub-warn'},R?.reason||'')); return; }
    if(t.t==='bar'){ const e=R.bars.find(k=>k.b.id===t.id); if(e){ kv('Effort', e.mode==='detendu'?'câble détendu':`${e.N>=0?'traction':'compression'} ${fmt(Math.abs(e.N),0)} N`); if(e.mode!=='detendu') kv('Contrainte',`${fmt(Math.abs(e.sig),1)} MPa`); if(isFinite(e.sf)) kv(e.mode==='flambage'?'Sécurité (flambage)':'Sécurité', fmt(e.sf,2)); } }
    else if(t.t==='node'){ const d=R.disp.get(t.id); if(d) kv('Déplacement',`${fmt(Math.hypot(d[0],d[1]),2)} mm`); }
    kv('Flèche max',`${fmt(R.umax,2)} mm`); if(isFinite(sf)) kv('Sécurité mini', fmt(sf,2));
  } else { const R=ST.mres; if(!R?.ok){ box.append(h('span',{class:'bub-warn'},R?.reason||'')); return; }
    kv('Flèche max',`${fmt(R.umax,2)} mm`); kv('Contrainte max',`${fmt(R.vmMax,1)} MPa`); kv('Sécurité', fmt(R.sf,2)); }
}
function openStructBubble(target, x, y){
  const S=SD();
  openBubble('struct', target, x, y, b=>{
    let title, sub, icon;
    const T=S.truss, M=S.mesh;
    if(target.t==='bar'){ const bar=T.bars.find(k=>k.id===target.id); if(!bar) return closeBubble(); title=`Barre ${bar.id}`; sub=`${SECTIONS[bar.sec]} · ${MATERIALS[bar.mat]?.name}`; icon='truss'; }
    else if(target.t==='node'){ title=`Nœud ${target.id}`; sub='Appui et force'; icon='target'; }
    else { title=state.name||'Pièce'; sub=`${MATERIALS[M.mat].name} · ${SUPS[M.sup]?.toLowerCase()}`; icon='meshIc'; }
    const chip=h('span',{class:'bub-chip',id:'bubChip'});
    b.append(bubHead(icon,title,sub,chip));
    b.append(h('div',{class:'bub-actions'},
      h('button',{class:'btn primary',id:'bubPlay',onclick:()=>stAnimPlay(!ST.anim.on)}),
      h('button',{class:'btn',title:'Recalculer et relancer l’animation depuis le début',onclick:()=>{ computeStruct(); if(ST.mode3d) buildStruct3D(); stAnimPlay(true); refreshStructBubble(); }}, svgIcon('reset'),'Relancer')));
    const params=h('div',{class:'bub-params'}); b.append(params);
    const done=()=>{ commit(); renderInspector(); };
    if(target.t==='bar'){ const bar=T.bars.find(k=>k.id===target.id);
      params.append(bubSeg([['plein','Plein'],['tube','Tube'],['cable','Câble']], bar.sec, v=>{ bar.sec=v; if(v==='tube' && !(bar.d<bar.D)) bar.d=+(bar.D*0.75).toFixed(1); liveStruct(); done(); openStructBubble(target,x,y); }));
      params.append(bubSlider(bar.sec==='tube'?'Ø extérieur':'Diamètre', bar.D, 0.5, 40, 0.5, 'mm', v=>{ bar.D=v; if(bar.sec==='tube') bar.d=Math.min(bar.d,v-0.2); liveStruct(); }, done));
      if(bar.sec==='tube') params.append(bubSlider('Ø intérieur', bar.d, 0, Math.max(0.5,bar.D-0.2), 0.5, 'mm', v=>{ bar.d=Math.min(v,bar.D-0.2); liveStruct(); }, done));
      const ms=matSelect(bar.mat, v=>{ bar.mat=v; liveStruct(); done(); }); params.append(h('div',{class:'bub-row'}, h('label',{},'Matériau'), ms));
    } else if(target.t==='node'){ const n=T.nodes.find(k=>k.id===target.id); if(!n) return closeBubble();
      params.append(h('div',{class:'bub-row'}, h('label',{},'Appui'), bubSeg([['','Libre'],['fixe','Fixe'],['glissant','Glissant']], n.sup||'', v=>{ n.sup=v||null; liveStruct(); done(); openStructBubble(target,x,y); })));
      params.append(bubSlider('Force ↓', Math.max(0,-(+n.fy||0)), 0, Math.max(2000, -(+n.fy||0)*2), 10, 'N', v=>{ n.fy=-v; liveStruct(); }, done));
      params.append(bubSlider('Force →', +n.fx||0, -1000, 1000, 10, 'N', v=>{ n.fx=v; liveStruct(); }, done));
      params.append(h('div',{class:'bub-note'},'10 N ≈ le poids d’1 kg.'));
    } else {
      params.append(bubSlider('Force', M.F, 0, Math.max(1000, (+M.F||0)*3), Math.max(1,Math.round((+M.F||100)/100)), 'N', v=>{ M.F=v; liveStruct(); }, done));
      const dim= M.shape==='poutre'? ['Hauteur','h',5,Math.max(400,M.P.h*3)] : M.shape==='arc'? ['Épaisseur de l’arc','e',20,Math.max(800,M.P.e*2.5)] : M.shape==='L'? ['Hauteur du bras','ha',10,Math.max(300,M.P.ha*3)] : null;
      if(dim) params.append(bubSlider(dim[0], M.P[dim[1]], dim[2], dim[3], 1, 'mm', v=>{ M.P[dim[1]]=v; ST.fitted=true; liveStruct(); }, done));
      params.append(bubSlider('Profondeur', M.t, 5, Math.max(1200,M.t*2.5), 5, 'mm', v=>{ M.t=v; liveStruct(); }, done));
      const ms=matSelect(M.mat, v=>{ M.mat=v; liveStruct(); done(); }); params.append(h('div',{class:'bub-row'}, h('label',{},'Matériau'), ms));
      params.append(h('div',{class:'bub-row'}, h('label',{},'Couleurs'), bubSeg([['vm','Contrainte'],['tc','Tract./compr.'],['u','Dépl.']], M.view, v=>{ M.view=v; stDraw(); if(ST.mode3d) buildStruct3D(); done(); openStructBubble(target,x,y); })));
    }
    b.append(h('div',{class:'kv bub-read',id:'bubRead'}));
  });
  updateBubblePlay(); refreshStructBubble(); placeBubble(x,y);
}
function struct3DHit(ev){
  const r=renderer.domElement.getBoundingClientRect(); ndc.set(((ev.clientX-r.left)/r.width)*2-1, -((ev.clientY-r.top)/r.height)*2+1); ray.setFromCamera(ndc,camera);
  structGroup.updateMatrixWorld(true);   // the group may have been rebuilt since the last frame (e.g. first click of a double-click)
  return ray.intersectObjects(structGroup.children,true).find(h=>h.object.userData?.t && h.object.visible!==false)||null;
}
/* the whole bar (group) or load arrow rather than one of its sub-meshes */
function struct3DTarget(o){ while(o.parent && o.parent!==structGroup && o.parent.userData?.t===o.userData.t) o=o.parent; return o; }
function struct3DClick(ev){
  const hit=struct3DHit(ev);
  if(!hit) return closeBubble();
  const t=hit.object.userData; if(t.t!=='mesh') ST.sel={t:t.t,id:t.id};
  openStructBubble(t.t==='mesh'? {t:'mesh', i: t.i ?? meshNodeNear(hit.point.x, hit.point.z)} : {t:t.t,id:t.id}, ...evStage(ev)); renderInspector();
}

/* ---- the line that ties the bubble to what was clicked (follows the camera, the animation and the bubble) */
const _bv=new THREE.Vector3();
function structAnchor(t){   // point of the structure plane, deformed like the drawing
  const S=SD();
  if(S.mod==='treillis'){ const R=ST.res, T=S.truss, b=structBox(); const amp=R?.ok? ampFactor(Math.max(40,b.maxx-b.minx,b.maxy-b.miny),R.umax,0.035)*ST.k : 0;
    const P=id=>{ const n=T.nodes.find(k=>k.id===id); if(!n) return null; const d=R?.ok? R.disp.get(id) : null; return d? [n.x+d[0]*amp, n.y+d[1]*amp] : [n.x,n.y]; };
    if(t.t==='node') return P(t.id);
    if(t.t==='bar'){ const bar=T.bars.find(k=>k.id===t.id); const A=bar&&P(bar.a), B=bar&&P(bar.b); return A&&B? [(A[0]+B[0])/2,(A[1]+B[1])/2] : null; }
    return null; }
  const R=ST.mres; if(!R?.mesh) return null; const n=R.mesh.nodes; let i=t.i; if(!(i>=0 && i<n.length)) i=R.uAt ?? 0;
  const b=R.mesh.box, amp=R.ok? ampFactor(Math.max(40,b.maxx-b.minx,b.maxy-b.miny),R.umax)*ST.k : 0;
  return [n[i][0]+(R.ok?R.u[2*i]*amp:0), n[i][1]+(R.ok?R.u[2*i+1]*amp:0)];
}
function bubbleAnchor(){   // stage coordinates {x,y,vis}
  const t=BUB.target; if(!t) return null;
  if(BUB.kind==='struct'){ const w=structAnchor(t); if(!w) return null; if(ST.mode3d) return toStage(_bv.set(w[0],0,w[1])); const [x,y]=sToS(w[0],w[1]); return {x:x-OVR.l, y:y-OVR.t, vis:true}; }
  if(BUB.kind==='mech'){
    if(t.j!=null){ const j=state.joints.find(k=>k.id===t.j); if(j) return toStage(jointWorld(j, simActive()).o); }
    const r=meshes.get(t.pid); if(!r) return null; r.mesh.updateWorldMatrix(true,false);
    if(!t.lp){ const g=r.mesh.geometry; if(!g.boundingBox) g.computeBoundingBox(); t.lp=g.boundingBox.getCenter(new THREE.Vector3()); }
    return toStage(r.mesh.localToWorld(_bv.copy(t.lp))); }
  return null;
}
function updateBubbleLink(){
  const svg=$('#bubLink'), b=$('#bubble'); if(!svg) return;
  const a= (!b.hidden && BUB.kind)? bubbleAnchor() : null;
  if(!a || !a.vis){ svg.style.display='none'; return; }
  const bx=b.offsetLeft, by=b.offsetTop, bw=b.offsetWidth, bh=b.offsetHeight;
  const ex=clamp(a.x,bx+6,bx+bw-6), ey=clamp(a.y,by+6,by+bh-6); const inside= a.x>bx && a.x<bx+bw && a.y>by && a.y<by+bh;
  svg.style.display='block'; const [line,dot]=svg.children;
  line.setAttribute('x1',a.x); line.setAttribute('y1',a.y); line.setAttribute('x2',ex); line.setAttribute('y2',ey); line.style.display= inside?'none':'';
  dot.setAttribute('cx',a.x); dot.setAttribute('cy',a.y);
}

/* ---- Mécanique */
const VERB={pivot:'tourne sur', glissiere:'glisse sur', fixe:'est fixée sur'};
function jointSentence(j){ return `${partName(j.child)} ${VERB[j.type]} ${partName(j.parent)}`; }
function openMechBubble(p, ev, anchor){
  if(!p) return closeBubble();
  const [x,y]=evStage(ev);
  // anchor: the clicked point (kept in the part's own frame so it follows the motion) or a joint
  const prev= BUB.kind==='mech' && BUB.target?.pid===p.id ? BUB.target : null; const tg={pid:p.id, lp:prev?.lp||null, j:prev?.j??null};
  if(anchor?.point){ const r=meshes.get(p.id); if(r){ r.mesh.updateWorldMatrix(true,false); tg.lp=r.mesh.worldToLocal(anchor.point.clone()); tg.j=null; } }
  if(anchor?.j!=null){ tg.j=anchor.j; }
  openBubble('mech', tg, x, y, b=>{
    const own=state.joints.find(j=>j.child===p.id), carried=state.joints.filter(j=>j.parent===p.id);
    b.append(bubHead(p.kind, p.name, own? `${jointLabel(own.type)} · ${jointSentence(own)}` : 'Pièce fixe (bâti)', null));
    b.append(h('div',{class:'bub-actions'},
      h('button',{class:'btn primary',id:'bubPlay',onclick:()=>{ simToggle(); updateBubblePlay(); }}),
      h('button',{class:'btn',title:'Revenir au départ et relancer',onclick:()=>{ simReset(true); simToggle(); updateBubblePlay(); }}, svgIcon('reset'),'Relancer')));
    const params=h('div',{class:'bub-params'}); b.append(params);
    if(own && own.type!=='fixe'){
      const u=unitOf(own);
      if(own.driver){ const d=state.joints.find(k=>k.id===own.driver.joint); params.append(h('div',{class:'bub-note',html:`Entraînée par <b>${d?.name||'?'}</b> (rapport ${fmt(own.driver.ratio,3)}).`}));
        params.append(bubSlider('Rapport', own.driver.ratio, -5, 5, 0.05, '', v=>{ own.driver.ratio=v; applyPoses(); refreshJointValues(); }, ()=>{ commit(); renderInspector(); })); }
      else {
        const mode= own.motor? own.motor.mode : 'manuel';
        params.append(h('div',{class:'bub-row'}, h('label',{},'Moteur'), bubSeg([['manuel','Main'],['continu','Continu'],['alternatif','Aller-retour']], mode, v=>{
          if(v==='manuel') own.motor=null; else own.motor={mode:v, speed: own.motor?.speed ?? (own.type==='pivot'?45:10)};
          commit(); renderInspector(); openMechBubble(p, ev); })));
        if(own.motor) params.append(bubSlider('Vitesse', own.motor.speed, own.type==='pivot'?-360:-100, own.type==='pivot'?360:100, own.type==='pivot'?5:1, u+'/s', v=>{ own.motor.speed=v; }, ()=>{ commit(); renderInspector(); }));
        else { const [lo,hi]=sliderRange(own); params.append(bubSlider('Position', jointValue(own), lo, hi, own.type==='glissiere'?0.5:1, u, v=>{ sim.values[own.id]=v; onSimTouched(); }, null)); }
        if(own.motor?.mode==='alternatif'){ const lo=own.min ?? (own.type==='pivot'?-45:0), hi=own.max ?? (own.type==='pivot'?45:20);
          params.append(bubSlider('Course max', hi, lo+1, own.type==='pivot'?360:200, 1, u, v=>{ own.max=v; }, ()=>{ commit(); renderInspector(); })); }
      }
      params.append(h('div',{class:'kv bub-read'}, h('span',{},'Valeur'), h('b',{class:'mono',id:'bubVal'},`${fmt(jointValue(own),1)} ${u}`)));
    }
    if(carried.length) params.append(h('div',{class:'bub-note',html:'Porte : '+carried.map(j=>`<b>${partName(j.child)}</b> (${jointLabel(j.type).toLowerCase()})`).join(', ')}));
    if(!own) params.append(h('button',{class:'btn',onclick:()=>{ closeBubble(); if(mechReady()){ openJointForm(null,p.id); renderInspector(); updateMarkers(); } }}, svgIcon('link'),'Ajouter une liaison'));
  });
  updateBubblePlay();
}
function tickBubble(){ if(BUB.kind==='mech'){ const p=findPart(BUB.target?.pid); const j=p&&state.joints.find(k=>k.child===p.id); const el=$('#bubVal'); if(j&&el) el.textContent=`${fmt(jointValue(j),1)} ${unitOf(j)}`; } }

/* ---- Étiquettes de liaison : « L1 · Pivot — Roue menante tourne sur Platine » */
/* Labels are gathered in a movable group (#jlGroup) laid out in a row, a column, a square, a rectangle
   or a circle — or left next to their joint (« libre »), or spread on an oval around the moving system
   (« orbite », the default). All of them are placed around the moving system: see placeJointLabels. They shrink (full → compact → mini) to fit the view.
   A numbered dot at each joint matches the number on its label. */
const JL_LAYOUTS=[['orbite','Autour du mécanisme (auto)'],['libre','Près des liaisons'],['ligne','En ligne'],['colonne','En colonne'],['carre','En carré'],['rect','En rectangle'],['cercle','En cercle']];
const JL_ICON={
  orbite:'<ellipse cx="8" cy="8" rx="6.2" ry="4.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 1.6"/><circle cx="8" cy="3.4" r="1.9"/><circle cx="14.2" cy="8" r="1.9"/><circle cx="8" cy="12.6" r="1.9"/><circle cx="1.8" cy="8" r="1.9"/>',
  libre:'<circle cx="4" cy="5" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="8" cy="12" r="2"/>',
  ligne:'<rect x="1" y="6" width="4" height="4" rx="1"/><rect x="6" y="6" width="4" height="4" rx="1"/><rect x="11" y="6" width="4" height="4" rx="1"/>',
  colonne:'<rect x="6" y="1" width="4" height="4" rx="1"/><rect x="6" y="6" width="4" height="4" rx="1"/><rect x="6" y="11" width="4" height="4" rx="1"/>',
  carre:'<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>',
  rect:'<rect x="0.5" y="4" width="4" height="3.5" rx="1"/><rect x="6" y="4" width="4" height="3.5" rx="1"/><rect x="11.5" y="4" width="4" height="3.5" rx="1"/><rect x="0.5" y="9" width="4" height="3.5" rx="1"/><rect x="6" y="9" width="4" height="3.5" rx="1"/>',
  cercle:'<circle cx="8" cy="2.5" r="2"/><circle cx="13.2" cy="6.3" r="2"/><circle cx="11.2" cy="12.5" r="2"/><circle cx="4.8" cy="12.5" r="2"/><circle cx="2.8" cy="6.3" r="2"/>'};
const JT_ICON={pivot:'pivot', glissiere:'slide', fixe:'lock'};
function jlIcon(k){ return h('span',{class:'jl-li',html:`<svg viewBox="0 0 16 16" fill="currentColor">${JL_ICON[k]}</svg>`}); }
function setJlLayout(k){ prefs.jl=k; savePrefs(); buildJointLabels(); renderInspector(); }
function buildJointLabels(){
  const host=$('#jlabels'); if(!host) return; host.innerHTML='';
  const show = ws==='mech' && prefs.labels && state.joints.length;
  host.hidden=!show; if(!show) return;
  const C=axisColors(), lay=prefs.jl||'orbite'; ORB.pos.clear(); ORB.sz=null; ORB.n=0;
  host.dataset.lay=lay;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('class','jl-lines'); host.append(svg);
  const grp=h('div',{class:'float jl-group pfloat',id:'jlGroup','data-lay':lay});
  const tools=h('div',{class:'jl-tools',role:'group','aria-label':'Disposition des étiquettes'}, ...JL_LAYOUTS.map(([k,l])=>{ const b=h('button',{class:'jl-lay'+(k===lay?' on':''),title:l,'aria-label':l,'aria-pressed':String(k===lay),onclick:()=>setJlLayout(k)}); b.append(jlIcon(k)); return b; }));
  const body=h('div',{class:'jl-body'});
  grp.append(gripFor('jlGroup','Étiquettes des liaisons'), tools, body); host.append(grp);
  state.joints.forEach((j,i)=>{
    const ax=nearestAxis(jointWorld(j).a); const col= j.type==='fixe'? 'var(--ink-2)' : C[ax];
    const motor= j.motor? `<i class="jl-m">moteur ${j.motor.mode==='continu'?'continu':'aller-retour'}</i>` : j.driver? `<i class="jl-m">entraînée</i>` : '';
    const el=h('button',{class:'jl'+(selJoint===j.id?' sel':''), 'data-j':j.id, 'data-n':i+1, style:`--jc:${col}`, title:`${j.name} — ${jointSentence(j)}`, onclick:()=>{ const r=el.getBoundingClientRect(); const at={clientX:r.left+r.width/2, clientY:r.bottom}; selJoint=j.id; renderInspector(); updateMarkers(); openMechBubble(findPart(j.child), at, {j:j.id}); }});
    el.append(h('span',{class:'jl-n'},String(i+1)), svgIcon(JT_ICON[j.type]||'link'), h('span',{class:'jl-tx',html:`<b>${j.name}</b><span>${jointSentence(j)}${j.type!=='fixe'?` · axe ${ax.toUpperCase()}`:''}</span>${motor}`}));
    (FREE_LAY.has(lay)? host : body).append(el);
    const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('data-j',j.id);
    g.innerHTML=`<line></line><circle r="8"></circle><text text-anchor="middle" dominant-baseline="central">${i+1}</text>`; svg.append(g);
  });
  hydrateIcons(host); applyLayout('jlGroup'); layoutJointGroup(); positionJointLabels();
}
function layoutJointGroup(){   // the labels are placed every frame (freeJointLabels); here only the size level is reset
  const host=$('#jlabels'); if(!$('#jlGroup') || host.hidden) return;
  const W=STG.w||$('#stage').clientWidth;
  if((prefs.jl||'orbite')==='libre') host.dataset.sz= W<700? 'mini' : W<1000? 'compact' : 'full';
  else ORB.sz=null;
  applyLayout('jlGroup');
}
const FREE_LAY=new Set(['libre','orbite','ligne','colonne','carre','rect','cercle']);
/* « orbite » : the labels sit on an oval drawn around the screen box of the moving system (every part
   carried by a joint). Each label goes to the slot of the oval nearest to its joint's number, the slots
   being evenly spread; the size level (full / compact / mini) is the largest whose labels fit on the oval. */
const ORB={pos:new Map(), sz:null, n:0, sizes:null};
const _ob=new THREE.Box3(), _ob2=new THREE.Box3(), _oc=new THREE.Vector3();
function systemScreenBox(){
  // the moving system: parts turned or slid by a joint, plus everything they carry (not the fixed frame)
  const ids=new Set(state.joints.filter(j=>j.type!=='fixe').map(j=>j.child));
  for(let k=0;k<state.joints.length;k++) for(const j of state.joints) if(ids.has(j.parent)) ids.add(j.child);
  if(!ids.size) for(const j of state.joints) ids.add(j.child);
  _ob.makeEmpty(); for(const id of ids){ const r=meshes.get(id); if(!r || !r.mesh.visible) continue; _ob2.setFromObject(r.mesh); _ob.union(_ob2); }
  if(_ob.isEmpty()) return null;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(let i=0;i<8;i++){ _oc.set(i&1?_ob.max.x:_ob.min.x, i&2?_ob.max.y:_ob.min.y, i&4?_ob.max.z:_ob.min.z); const p=toStage(_oc); x0=Math.min(x0,p.x); x1=Math.max(x1,p.x); y0=Math.min(y0,p.y); y1=Math.max(y1,p.y); }
  return {x0,y0,x1,y1};
}
function measureJl(host, els){ const keep=host.dataset.sz, out={}; for(const sz of ['full','compact','mini']){ host.dataset.sz=sz; out[sz]=els.map(e=>[e.offsetWidth,e.offsetHeight]); } host.dataset.sz=keep; return out; }
function angDiff(a,b){ let d=a-b; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI; return d; }
/* Every layout is placed around the screen box of the moving system, each frame:
   orbite = oval, cercle = circle, ligne = row above (or below), colonne = column on the roomier side,
   carre / rect = grid on the roomier side. Labels are sorted so that leader lines cross as little as possible. */
function placeJointLabels(lay, bx, S, pts, W, H, top, m){
  const n=S.length, gap=8, wm=Math.max(...S.map(s=>s[0])), hm=Math.max(...S.map(s=>s[1]));
  const cx=(bx.x0+bx.x1)/2, cy=(bx.y0+bx.y1)/2, R=new Array(n);
  const byKey=f=>S.map((s,i)=>i).sort((a,b)=>f(a)-f(b));
  const ring=(A0,B0,pull)=>{   // labels on an ellipse, evenly spread, turned to match the joints
    const A=Math.max(30,Math.min(A0,(W-2*m-wm)/2)), B=Math.max(24,Math.min(B0,(H-top-m-hm)/2));
    const ex=clamp(cx, m+wm/2+A, W-m-wm/2-A), ey=clamp(cy, top+hm/2+B, H-m-hm/2-B);
    const th=pts.map(p=>Math.atan2((p.y-ey)/B,(p.x-ex)/A)), idx=th.map((t,i)=>i).sort((i,k)=>th[i]-th[k]), step=2*Math.PI/n;
    let sx=0, sy=0; idx.forEach((i,k)=>{ const d=th[i]-k*step; sx+=Math.cos(d); sy+=Math.sin(d); });
    const phi= n>1? Math.atan2(sy,sx) : th[0];
    idx.forEach((i,k)=>{ const slot=phi+k*step, al=slot+pull*angDiff(th[i],slot); R[i]={x:ex+A*Math.cos(al)-S[i][0]/2, y:ey+B*Math.sin(al)-S[i][1]/2}; });
    const P=Math.PI*(3*(A+B)-Math.sqrt((3*A+B)*(A+3*B))), need=S.reduce((t,[w,h])=>t+Math.max(w*0.8,h*1.6)+12,0);
    return {fill:need/P, room:Math.min(A/A0, B/B0)};
  };
  let fill=0, room=1;   // fill: share of the available length used (≤ 1 fits); room: how much of the wanted clearance we got
  if(lay==='orbite'){ const a=Math.max(24,(bx.x1-bx.x0)/2), b=Math.max(24,(bx.y1-bx.y0)/2); ({fill,room}=ring(a*1.2+wm/2+14, b*1.2+hm/2+12, 0.3)); }
  else if(lay==='cercle'){ const r=Math.hypot(bx.x1-bx.x0,bx.y1-bx.y0)/2+Math.hypot(wm,hm)/2+12, rc= n>1? (Math.hypot(wm,hm)*0.62+6)/(2*Math.sin(Math.PI/n)) : 0; const Rr=Math.max(r,rc);
    const Rm=Math.min((W-2*m-wm)/2,(H-top-m-hm)/2); const Rf=Math.max(24,Math.min(Rr,Rm)); ({fill}=ring(Rf,Rf,0)); room=Rf/Rr; fill=Math.max(fill, rc/Rf); }
  else if(lay==='ligne'){ const idx=byKey(i=>pts[i].x), tw=S.reduce((t,s)=>t+s[0],0)+gap*(n-1);
    let y=bx.y0-26-hm; if(y<top) y=bx.y1+26; const clear= y+hm<=bx.y0-6 || y>=bx.y1+6; y=clamp(y,top,H-m-hm);
    let x=clamp(cx-tw/2,m,Math.max(m,W-m-tw)); idx.forEach(i=>{ R[i]={x, y:y+(hm-S[i][1])/2}; x+=S[i][0]+gap; });
    fill=tw/(W-2*m); room= clear? 1 : 0.5; }
  else if(lay==='colonne'){ const idx=byKey(i=>pts[i].y), th=S.reduce((t,s)=>t+s[1],0)+gap*(n-1);
    const rr=W-m-bx.x1, rl=bx.x0-m, right= rr>=rl; let x= right? bx.x1+28 : bx.x0-28-wm; room=Math.min(1,Math.max(right?rr:rl,0)/(wm+28)); x=clamp(x,m,W-m-wm);
    let y=clamp(cy-th/2,top,Math.max(top,H-m-th)); idx.forEach(i=>{ R[i]={x: right? x : x+wm-S[i][0], y}; y+=S[i][1]+gap; });
    fill=th/(H-top-m); }
  else {   // carre / rect: grid, rows sorted top → bottom, then left → right
    const c= lay==='carre'? Math.ceil(Math.sqrt(n)) : Math.min(n, Math.ceil(Math.sqrt(n))+1), rows=Math.ceil(n/c);
    const byY=byKey(i=>pts[i].y), cells=[]; for(let r=0;r<rows;r++){ const row=byY.slice(r*c,(r+1)*c).sort((a,b)=>pts[a].x-pts[b].x); cells.push(row); }
    const colW=[...Array(c)].map((_,j)=>Math.max(0,...cells.map(row=>row[j]!=null? S[row[j]][0] : 0))), rowH=cells.map(row=>Math.max(...row.map(i=>S[i][1])));
    const gw=colW.reduce((a,b)=>a+b,0)+gap*(c-1), gh=rowH.reduce((a,b)=>a+b,0)+gap*(rows-1);
    const sides=[['r',W-m-bx.x1-28-gw],['l',bx.x0-m-28-gw],['b',H-m-bx.y1-26-gh],['t',bx.y0-top-26-gh]].sort((a,b)=>b[1]-a[1]);
    const sd=sides[0][0]; room= sides[0][1]>=0? 1 : 0.5;
    let gx= sd==='r'? bx.x1+28 : sd==='l'? bx.x0-28-gw : cx-gw/2, gy= sd==='b'? bx.y1+26 : sd==='t'? bx.y0-26-gh : cy-gh/2;
    gx=clamp(gx,m,Math.max(m,W-m-gw)); gy=clamp(gy,top,Math.max(top,H-m-gh));
    let yy=gy; cells.forEach((row,r)=>{ let xx=gx; row.forEach((i,j)=>{ R[i]={x:xx, y:yy+(rowH[r]-S[i][1])/2}; xx+=colW[j]+gap; }); yy+=rowH[r]+gap; });
    fill=Math.max(gw/(W-2*m), gh/(H-top-m)); }
  return {R, fill, room};
}
function freeJointLabels(host, lay){
  const els=[...host.querySelectorAll(':scope > .jl')], n=els.length; if(!n) return new Map();
  if(!ORB.sizes || ORB.n!==n){ ORB.sizes=measureJl(host, els); ORB.n=n; }
  const H=STG.h, m=8, top=54;   // keep clear of the layout buttons at the top
  const d=$('#demo'); const L0= (d && !d.hidden && !movedDemo() && STG.w>760)? d.offsetLeft+d.offsetWidth : 0;   // not under the demo card
  const v=$('#views'); const R0= (v && v.offsetParent && LAYOUT.views?.x==null && !LAYOUT.views?.c)? v.offsetWidth+14 : 0;   // nor under the view buttons
  const W=STG.w-L0-R0;
  const sb=systemScreenBox(); const bx= sb? {x0:sb.x0-L0, x1:sb.x1-L0, y0:sb.y0, y1:sb.y1} : {x0:W*.35,x1:W*.65,y0:H*.35,y1:H*.65};
  const pts=els.map(el=>{ const j=state.joints.find(k=>k.id===+el.dataset.j); const p= j? toStage(jointWorld(j, simActive()).o) : {x:W/2+L0,y:H/2}; return {x:p.x-L0, y:p.y}; });
  const fit=sz=>{ const r=placeJointLabels(lay, bx, ORB.sizes[sz], pts, W, H, top, m); r.ok= r.fill<=1 && r.room>=0.6; r.roomy= r.fill<=0.87 && r.room>=0.7; r.S=ORB.sizes[sz]; return r; };
  // the largest size level that fits, with a little hysteresis so it does not flicker while the camera moves
  const order=['full','compact','mini']; let sz=ORB.sz||'full', F=fit(sz);
  const k=order.indexOf(sz), up= k>0? fit(order[k-1]) : null;
  if(up && up.roomy){ sz=order[k-1]; F=up; }
  while(!F.ok && sz!=='mini'){ sz=order[order.indexOf(sz)+1]; F=fit(sz); }
  if(ORB.sz!==sz){ ORB.sz=sz; host.dataset.sz=sz; }
  const out=new Map();
  els.forEach((el,i)=>{ const [w,h]=F.S[i]; let x=clamp(F.R[i].x,m,W-m-w)+L0, y=clamp(F.R[i].y,m,H-m-h);
    const prev=ORB.pos.get(el); if(prev && prev.w===w){ x=prev.x+(x-prev.x)*0.3; y=prev.y+(y-prev.y)*0.3; }   // glide, no jumps
    const p={x,y,w,h}; ORB.pos.set(el,p); out.set(el,p); });
  return out;
}
function positionJointLabels(){
  const host=$('#jlabels'); if(!host || host.hidden) return;
  const st=$('#stage').getBoundingClientRect(); const placed=[]; const lay=host.dataset.lay;
  const grp=$('#jlGroup'), folded= lay!=='libre' && grp?.classList.contains('collapsed');
  curCache=simActive()? new Map() : null;
  const orb= lay!=='libre' && !folded ? freeJointLabels(host, lay) : null;
  for(const el of host.querySelectorAll('.jl')){
    const j=state.joints.find(k=>k.id===+el.dataset.j); if(!j) continue;
    const {o}=jointWorld(j, simActive()); const a=toStage(o); const vis=a.vis;
    let lx, ly, w=el.offsetWidth, hh=el.offsetHeight;
    if(orb){ const p=orb.get(el); if(!p) continue; lx=p.x; ly=p.y; w=p.w; hh=p.h; el.style.transform=`translate(${Math.round(lx)}px,${Math.round(ly)}px)`; el.style.visibility='visible'; }
    else if(lay!=='libre'){ el.style.visibility='hidden'; lx=a.x; ly=a.y; w=0; hh=0; }
    else if(lay==='libre'){
      lx=a.x+26; ly=a.y-hh-30; // default: above right; nudge if it overlaps another label
      for(let k=0;k<8;k++){ const hit=placed.find(p=>lx<p.x+p.w+6 && lx+w+6>p.x && ly<p.y+p.h+4 && ly+hh+4>p.y); if(!hit) break; ly=hit.y-hh-6; if(ly<4){ ly=hit.y+hit.h+6; } }
      lx=clamp(lx,4,st.width-w-4); ly=clamp(ly,4,st.height-hh-4); placed.push({x:lx,y:ly,w,h:hh});
      el.style.transform=`translate(${lx}px,${ly}px)`; el.style.visibility=vis?'visible':'hidden';
    } else { const r=el.getBoundingClientRect(); lx=r.left-st.left; ly=r.top-st.top; w=r.width; hh=r.height; }
    const g=host.querySelector(`g[data-j="${j.id}"]`); if(!g) continue; const [line,dot,txt]=g.children;
    const col=getComputedStyle(el).getPropertyValue('--jc');
    const ex=clamp(a.x, lx, lx+w), ey=clamp(a.y, ly, ly+hh);
    line.setAttribute('x1',a.x); line.setAttribute('y1',a.y); line.setAttribute('x2',ex); line.setAttribute('y2',ey);
    dot.setAttribute('cx',a.x); dot.setAttribute('cy',a.y); txt.setAttribute('x',a.x); txt.setAttribute('y',a.y);
    g.style.visibility= vis? 'visible':'hidden'; line.style.visibility= folded? 'hidden' : ''; line.style.stroke=col; dot.style.stroke=col; txt.style.fill=col;
  }
  curCache=null;
}
