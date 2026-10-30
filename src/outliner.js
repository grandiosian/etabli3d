
/* =========================================================
   Outliner (arborescence) — advanced level only.
   Two views: parts (groups unfold into their pieces) and joints
   (kinematic tree: each support carries the parts linked to it).
   ========================================================= */
const tree={mode:'parts', open:new Set(), closedKin:new Set(), renaming:null};
const treeVisible=()=> lv(3) && $('#app').classList.contains('with-tree');

function setTreeOpen(v){
  $('#app').classList.toggle('with-tree', v);
  if(!matchMedia('(max-width: 860px)').matches){ prefs.tree=v; savePrefs(); }
  $('#bTree').classList.toggle('on', v); $('#bTree').setAttribute('aria-pressed', String(v));
  renderOutliner();
}
function selectFromTree(id, e){
  if(e?.shiftKey) selection = selection.includes(id)? selection.filter(i=>i!==id) : [...selection,id];
  else selection=[id];
  sync(); setTab('part');
}
function startRename(obj, span){
  const inp=h('input',{class:'tr-rename',value:obj.name,'aria-label':'Nouveau nom'});
  const done=ok=>{ if(ok){ const v=inp.value.trim(); if(v && v!==obj.name){ obj.name=v; commit(); } } tree.renaming=null; renderOutliner(); renderInspector(); };
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter') done(true); if(e.key==='Escape') done(false); });
  inp.addEventListener('blur',()=>done(true));
  span.replaceWith(inp); inp.focus(); inp.select(); tree.renaming=obj.id;
}
function treeRow({depth, obj, top, kind, name, badges=[], expandable=false, open=false, onToggle, info=false, joint=null}){
  const isTop = top===obj;
  const row=h('div',{class:'tr'+(selection.includes(top?.id)&&isTop?' sel':'')+(top&&selection.includes(top.id)&&!isTop?' sel-child':'')+(info?' tr-info':'')+(isTop&&isHidden(obj)?' off':''),
    style:`--d:${depth}`, role:'treeitem', 'aria-level':String(depth+1), 'aria-expanded':expandable? String(open) : null});
  row.append(expandable? h('button',{class:'tr-caret'+(open?' open':''),'aria-label':open?'Replier':'Déplier',onclick:e=>{ e.stopPropagation(); onToggle(); }}, svgIcon('caret')) : h('span',{class:'tr-caret-sp'}));
  if(kind){ const ic=svgIcon(kind); ic.classList.add('tr-ic'); row.append(ic); }
  const nm=h('span',{class:'tr-name',title:info?null:'Double-clic pour renommer'}, name);
  row.append(nm, ...badges);
  if(joint){ row.append(h('button',{class:'badge tr-joint'+(joint.type==='fixe'?' fixe':''),title:'Voir la liaison '+joint.name,onclick:e=>{ e.stopPropagation(); selJoint=joint.id; jf=null; setTab('move'); }}, jointLabel(joint.type))); }
  if(isTop && !info){
    const hid=!!obj.hidden, lk=!!obj.locked;
    row.append(h('span',{class:'tr-act'},
      h('button',{class:'tr-btn'+(hid?' on':''),title:hid?'Afficher':'Masquer','aria-label':(hid?'Afficher ':'Masquer ')+obj.name,onclick:e=>{ e.stopPropagation(); obj.hidden=!hid; if(!hid) selection=selection.filter(i=>i!==obj.id); sync(); commit(); renderInspector(); }}, svgIcon(hid?'eyeOff':'eye')),
      h('button',{class:'tr-btn'+(lk?' on':''),title:lk?'Déverrouiller':'Verrouiller','aria-label':(lk?'Déverrouiller ':'Verrouiller ')+obj.name,onclick:e=>{ e.stopPropagation(); obj.locked=!lk; sync(); commit(); renderInspector(); }}, svgIcon(lk?'lock':'unlock'))));
  }
  if(!info){
    row.addEventListener('click',e=>{ if(e.target.closest('button,input')) return; if(top && !isHidden(top)) selectFromTree(top.id,e); });
    nm.addEventListener('dblclick',e=>{ e.stopPropagation(); startRename(obj,nm); });
  }
  return row;
}
function partRows(p, depth, top, out){
  const exp = p.kind==='group' || p.kind==='sketch';
  const key=(top===p?'':top.id+'/')+p.id, open=tree.open.has(key);
  const badges=[]; if(p.hole) badges.push(h('span',{class:'badge fixe'},'perçage'));
  const j = top===p ? state.joints.find(k=>k.child===p.id) : null;
  out.push(treeRow({depth, obj:p, top, kind:(p.hole&&top!==p)?'hole':p.kind, name:p.name, badges, expandable:exp, open, joint:j, onToggle:()=>{ open? tree.open.delete(key) : tree.open.add(key); renderOutliner(); }}));
  if(!open) return;
  if(p.kind==='group') for(const c of p.children) partRows(c, depth+1, top, out);
  if(p.kind==='sketch'){ const sk=p.params.sk||{}; const n=(a)=>(a||[]).length;
    const txt=[`${n(sk.lines)} ligne${n(sk.lines)>1?'s':''}`, n(sk.beziers)?`${n(sk.beziers)} courbe${n(sk.beziers)>1?'s':''}`:null, n(sk.circles)?`${n(sk.circles)} cercle${n(sk.circles)>1?'s':''}`:null, `${n(sk.cons)} cote${n(sk.cons)>1?'s':''} et contraintes`].filter(Boolean).join(' · ');
    out.push(treeRow({depth:depth+1, obj:p, top, kind:null, name:(p.params.mode==='revolve'?'Révolution — ':'Extrusion — ')+txt, info:true})); }
}
function kinRows(out){
  const jointsOf=pid=>state.joints.filter(j=>j.parent===pid);
  const node=(p, depth, via)=>{
    const kids=jointsOf(p.id), open=!tree.closedKin.has(p.id);
    out.push(treeRow({depth, obj:p, top:p, kind:p.kind, name:p.name, joint:via, expandable:kids.length>0, open, onToggle:()=>{ open? tree.closedKin.add(p.id) : tree.closedKin.delete(p.id); renderOutliner(); }}));
    if(open) for(const j of kids){ const c=findPart(j.child); if(c) node(c, depth+1, j); }
  };
  const ground=jointsOf(null);
  if(ground.length){
    const open=!tree.closedKin.has('bati');
    out.push(treeRow({depth:0, obj:{id:'bati',name:'Bâti (fixe)'}, top:null, kind:'link', name:'Bâti (fixe)', info:true, expandable:true, open, onToggle:()=>{ open? tree.closedKin.add('bati') : tree.closedKin.delete('bati'); renderOutliner(); }}));
    if(open) for(const j of ground){ const c=findPart(j.child); if(c) node(c,1,j); }
  }
  for(const p of state.parts) if(!state.joints.some(j=>j.child===p.id)) node(p,0,null);
}
function renderOutliner(){
  const panel=$('#outliner'); if(!panel || !treeVisible()) return;
  $$('#treeMode [data-mode]').forEach(b=>{ const on=b.dataset.mode===tree.mode; b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on)); });
  const nh=state.parts.filter(p=>p.hidden).length, nl=state.parts.filter(p=>p.locked).length;
  $('#treeCount').textContent=`${state.parts.length} pièce${state.parts.length>1?'s':''} · ${state.joints.length} liaison${state.joints.length>1?'s':''}`+(nh?` · ${nh} masquée${nh>1?'s':''}`:'')+(nl?` · ${nl} verrouillée${nl>1?'s':''}`:'');
  if(tree.renaming!=null) return;
  const body=$('#treeBody'); const st=body.scrollTop; body.innerHTML='';
  if(!state.parts.length){ body.append(h('p',{class:'empty tr-empty'},'Le tapis est vide. Ajoutez une forme pour la voir ici.')); return; }
  const out=[];
  if(tree.mode==='parts') for(const p of state.parts) partRows(p,0,p,out); else kinRows(out);
  body.append(...out); hydrateIcons(body); body.scrollTop=st;
}
