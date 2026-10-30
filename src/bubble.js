
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
function struct3DClick(ev){
  const r=renderer.domElement.getBoundingClientRect(); ndc.set(((ev.clientX-r.left)/r.width)*2-1, -((ev.clientY-r.top)/r.height)*2+1); ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects(structGroup.children,true).find(h=>h.object.userData?.t);
  if(!hit) return closeBubble();
  const t=hit.object.userData; if(t.t!=='mesh') ST.sel={t:t.t,id:t.id};
  openStructBubble(t.t==='mesh'? {t:'mesh'} : {t:t.t,id:t.id}, ev.clientX-r.left, ev.clientY-r.top); renderInspector();
}

/* ---- Mécanique */
const VERB={pivot:'tourne sur', glissiere:'glisse sur', fixe:'est fixée sur'};
function jointSentence(j){ return `${partName(j.child)} ${VERB[j.type]} ${partName(j.parent)}`; }
function openMechBubble(p, ev){
  if(!p) return closeBubble();
  const r=renderer.domElement.getBoundingClientRect(); const x=ev.clientX-r.left, y=ev.clientY-r.top;
  openBubble('mech', {pid:p.id}, x, y, b=>{
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
function buildJointLabels(){
  const host=$('#jlabels'); if(!host) return; host.innerHTML='';
  const show = ws==='mech' && prefs.labels && state.joints.length;
  host.hidden=!show; if(!show) return;
  const C=axisColors();
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('class','jl-lines'); host.append(svg);
  state.joints.forEach((j,i)=>{
    const ax=nearestAxis(jointWorld(j).a); const col= j.type==='fixe'? 'var(--ink-2)' : C[ax];
    const motor= j.motor? `<i class="jl-m">moteur ${j.motor.mode==='continu'?'continu':'aller-retour'}</i>` : j.driver? `<i class="jl-m">entraînée</i>` : '';
    const el=h('button',{class:'jl'+(selJoint===j.id?' sel':''), 'data-j':j.id, style:`--jc:${col}`, onclick:()=>{ const r=el.getBoundingClientRect(); const at={clientX:r.left+r.width/2, clientY:r.bottom}; selJoint=j.id; renderInspector(); updateMarkers(); openMechBubble(findPart(j.child), at); },
      html:`<b>${j.name}</b><span>${jointSentence(j)}${j.type!=='fixe'?` · axe ${ax.toUpperCase()}`:''}</span>${motor}`});
    host.append(el);
    const line=document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('data-j',j.id); svg.append(line);
    const dot=document.createElementNS('http://www.w3.org/2000/svg','circle'); dot.setAttribute('r','4'); dot.setAttribute('data-j',j.id); svg.append(dot);
  });
  positionJointLabels();
}
const _v3=new THREE.Vector3();
function positionJointLabels(){
  const host=$('#jlabels'); if(!host || host.hidden) return;
  const st=$('#stage').getBoundingClientRect(); const placed=[];
  curCache=simActive()? new Map() : null;
  for(const el of host.querySelectorAll('.jl')){
    const j=state.joints.find(k=>k.id===+el.dataset.j); if(!j) continue;
    const {o}=jointWorld(j, simActive()); _v3.copy(o).project(camera);
    const vis=_v3.z<1 && Math.abs(_v3.x)<1.1 && Math.abs(_v3.y)<1.1;
    const ax=(_v3.x+1)/2*st.width, ay=(1-_v3.y)/2*st.height;
    const w=el.offsetWidth, hh=el.offsetHeight;
    let lx=ax+26, ly=ay-hh-30; // default: above right; nudge down if it overlaps another label
    for(let k=0;k<8;k++){ const hit=placed.find(p=>lx<p.x+p.w+6 && lx+w+6>p.x && ly<p.y+p.h+4 && ly+hh+4>p.y); if(!hit) break; ly=hit.y-hh-6; if(ly<4){ ly=hit.y+hit.h+6; } }
    lx=clamp(lx,4,st.width-w-4); ly=clamp(ly,4,st.height-hh-4); placed.push({x:lx,y:ly,w,h:hh});
    el.style.transform=`translate(${lx}px,${ly}px)`; el.style.visibility=vis?'visible':'hidden';
    const line=host.querySelector(`line[data-j="${j.id}"]`), dot=host.querySelector(`circle[data-j="${j.id}"]`);
    const ex=clamp(ax, lx, lx+w), ey= ay<ly? ly : ly+hh;
    line.setAttribute('x1',ax); line.setAttribute('y1',ay); line.setAttribute('x2',ex); line.setAttribute('y2',ey); line.style.visibility=vis?'visible':'hidden'; line.style.stroke=getComputedStyle(el).getPropertyValue('--jc');
    dot.setAttribute('cx',ax); dot.setAttribute('cy',ay); dot.style.visibility=vis?'visible':'hidden'; dot.style.fill=getComputedStyle(el).getPropertyValue('--jc');
  }
  curCache=null;
}
