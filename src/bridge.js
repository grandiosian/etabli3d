/* =========================================================
   Passerelle : connexion avec une application centralisatrice (ENT, tableau de bord du professeur,
   portail de classe…) par window.postMessage. Contrat décrit dans PASSERELLE.md et passerelle/manifest.json
   (injecté ici par build.py dans BRIDGE_MANIFEST).
   Enveloppe : {protocol:'passerelle', v:1, app:'etabli3d', id, type, data}  ;  réponse : {…, type:'reply', replyTo, ok, data | error:{code, message}}
   ========================================================= */
const BRIDGE_MANIFEST=/*@MANIFEST@*/null;
const BRIDGE_FORMAT=2;   // version du document etabli3d.project (2 : matières p.mat et images state.textures)
var BR=null;             // état de la passerelle (var : peut être lu avant l'initialisation de ce fichier)
function bridgeInit(){
  const host= window.parent!==window? window.parent : window.opener; if(!host) return;   // page autonome : rien à faire
  const qs=new URLSearchParams(location.search), hub=qs.get('hub');
  let saved=[]; try{ saved=JSON.parse(localStorage.getItem('etabli3d.hubs')||'[]'); }catch(e){}
  BR={host, allowed:new Set([...(BRIDGE_MANIFEST?.security?.trustedHubs||[]), ...saved, ...(hub? [hub] : []), location.origin]), hubPinned:hub||null,
    origin:null, subs:new Set(), withProject:false, rev:0, lastSel:'', lastProg:'', seq:0, asking:null};
  window.addEventListener('message', bridgeOnMessage);
    if(hub) try{ host.postMessage(bridgeEnv('ready', {manifest:BRIDGE_MANIFEST}), hub); }catch(e){}   // sans ?hub=, rien n'est envoyé tant que le centralisateur n'a pas dit « hello »
  setInterval(bridgePoll, 500);
}
function bridgeEnv(type, data, extra={}){ return {protocol:'passerelle', v:1, app:'etabli3d', id:'e'+(BR? ++BR.seq : 0), type, data, ...extra}; }
function bridgeSend(type, data, extra){ if(!BR?.origin) return; try{ BR.host.postMessage(bridgeEnv(type, data, extra), BR.origin); }catch(e){} }
function bridgeReply(ev, msg, ok, data){ try{ ev.source.postMessage(bridgeEnv('reply', ok? data : undefined, {replyTo:msg.id, ok, ...(ok? {} : {error:data})}), ev.origin); }catch(e){} }
const bridgeErr=(code, message)=>({code, message});
const hostOf=o=>{ try{ return new URL(o).host||o; }catch(e){ return o; } };
function bridgeOnMessage(ev){
  const m=ev.data; if(!BR || !m || m.protocol!=='passerelle' || typeof m.type!=='string' || m.type==='reply') return;
  if(ev.source!==BR.host) return;   // seulement la fenêtre parente ou d'ouverture
  if(BR.hubPinned && ev.origin!==BR.hubPinned) return;
  if(m.type==='hello'){ if(BR.allowed.has(ev.origin)) return bridgeAccept(ev, m);
    return bridgeAsk(ev.origin, ok=>{ if(!ok) return bridgeReply(ev, m, false, bridgeErr('refused','Connexion refusée par l’utilisateur.'));
      BR.allowed.add(ev.origin); try{ localStorage.setItem('etabli3d.hubs', JSON.stringify([...BR.allowed].filter(o=>o!==location.origin))); }catch(e){} bridgeAccept(ev, m); }); }
  if(ev.origin!==BR.origin) return bridgeReply(ev, m, false, bridgeErr('not-connected','Envoyez d’abord « hello ».'));
  try{ const r=bridgeHandle(m.type, m.data||{}); if(r instanceof Promise) r.then(d=>bridgeReply(ev,m,true,d), e=>bridgeReply(ev,m,false,bridgeErr('failed', String(e?.message||e)))); else bridgeReply(ev, m, true, r); }
  catch(e){ bridgeReply(ev, m, false, e?.code? e : bridgeErr('failed', String(e?.message||e))); }
}
function bridgeAccept(ev, m){ BR.origin=ev.origin; bridgeReply(ev, m, true, {manifest:BRIDGE_MANIFEST, formatVersion:BRIDGE_FORMAT, revision:BR.rev});
  toast(`Connecté à ${m.data?.hub?.name? m.data.hub.name+' ('+hostOf(ev.origin)+')' : hostOf(ev.origin)}.`); }
/* demande d'accord à l'utilisateur pour une origine inconnue */
function bridgeAsk(origin, done){
  if(BR.asking?.origin===origin){ BR.asking.cbs.push(done); return; }   // le centralisateur réessaie « hello » : une seule question
  BR.asking?.box.remove(); const cbs=[done];
  const end=ok=>{ box.remove(); BR.asking=null; cbs.forEach(cb=>cb(ok)); };
  const box=h('div',{class:'bridge-ask',role:'alertdialog','aria-label':'Demande de connexion'},
    h('div',{}, h('b',{},'Connexion demandée'), h('span',{},` ${hostOf(origin)} veut lire et ouvrir vos projets.`)),
    h('button',{class:'btn primary',onclick:()=>end(true)},'Autoriser'),
    h('button',{class:'btn',onclick:()=>end(false)},'Refuser'));
  document.body.append(box); BR.asking={origin, box, cbs};
}
const bridgeProject=()=>({app:'etabli3d', version:BRIDGE_FORMAT, name:state.name, parts:state.parts, joints:state.joints, nextId:state.nextId, note:state.note||null, tp:state.tp||null, struct:state.struct||null, textures:usedTextures()});
function bridgeCheckProject(o){
  if(!o || typeof o!=='object' || !Array.isArray(o.parts)) throw bridgeErr('bad-project','Le projet doit avoir un tableau « parts ».');
  if(o.app && o.app!=='etabli3d') throw bridgeErr('bad-project',`Ce document vient de « ${o.app} », pas d’Établi 3D.`);
  if(o.version>BRIDGE_FORMAT) throw bridgeErr('too-new',`Format ${o.version} plus récent que celui de cette version (${BRIDGE_FORMAT}).`);
  const bad=[]; const walk=(ps,path)=>ps.forEach((p,i)=>{ const at=`${path}[${i}]`;
    if(!Number.isInteger(p?.id)) bad.push(at+'.id'); if(!KINDS[p?.kind]) bad.push(at+'.kind'); if(!Array.isArray(p?.pos)||p.pos.length!==3) bad.push(at+'.pos'); if(!Array.isArray(p?.rot)||p.rot.length!==3) bad.push(at+'.rot');
    if(p?.kind==='group') Array.isArray(p.children)? walk(p.children, at+'.children') : bad.push(at+'.children'); });
  walk(o.parts,'parts'); if(bad.length) throw bridgeErr('bad-project','Champs invalides : '+bad.slice(0,6).join(', ')+(bad.length>6?'…':''));
}
function bridgeSummary(){
  const parts=state.parts.map(p=>{ const r=meshes.get(p.id), b=r? new THREE.Box3().setFromObject(r.mesh) : null, s=b&&!b.isEmpty()? b.getSize(new THREE.Vector3()) : null, M=matOf(p);
    const V= r && !p.hole? geoVolume(r.mesh.geometry)/1000 : 0;
    return {id:p.id, name:p.name, kind:p.kind, hole:!!p.hole, color:p.color, material:p.mat?.k||null, size: s? [s.x,s.y,s.z].map(v=>+v.toFixed(2)) : null,
      volume:+V.toFixed(3), mass: M?.[6] && V? +(V*M[6]).toFixed(2) : null, validation:vState(p), children:p.children?.length||0}; });
  return {name:state.name, revision:BR?.rev||0, level:prefs.level, workspace:ws, units:{length:'mm', volume:'cm3', mass:'g'},
    parts, joints:state.joints.map(j=>({id:j.id, name:j.name, type:j.type, child:j.child, parent:j.parent, motor:j.motor?.mode||null, driven:!!j.driver})),
    totals:{parts:parts.length, solids:parts.filter(p=>!p.hole).length, holes:parts.filter(p=>p.hole).length, joints:state.joints.length, mass:+parts.reduce((a,p)=>a+(p.mass||0),0).toFixed(2), mechReady:mechReady()},
    struct: state.struct? {module:state.struct.mod, nodes:state.struct.truss?.nodes?.length||0, bars:state.struct.truss?.bars?.length||0} : null};
}
function bridgeHandle(type, d){
  switch(type){
    case 'project.get': if(state.edit) finishGroupEdit(); return {project:bridgeProject(), revision:BR.rev};
    case 'project.load': { const o=d.project; bridgeCheckProject(o); if(state.edit) finishGroupEdit(); $('#gallery').hidden=true;
      loadProject(JSON.parse(JSON.stringify({...o, name:d.name||o.name})), true); BR.rev++; return {ok:true, parts:state.parts.length, revision:BR.rev}; }
    case 'project.new': if(state.edit) finishGroupEdit(); $('#gallery').hidden=true; loadProject({name:d.name||'Mon projet', parts:[], joints:[], nextId:1}, true); BR.rev++; return {revision:BR.rev};
    case 'summary.get': return bridgeSummary();
    case 'export.stl': { if(state.edit) finishGroupEdit(); const ids= d.selection && selection.length? selection : state.parts.map(p=>p.id);
      const list=ids.map(id=>({p:findPart(id), r:meshes.get(id)})).filter(x=>x.p&&x.r&&!x.p.hole&&!isHidden(x.p)); if(!list.length) throw bridgeErr('empty','Aucune pièce solide à exporter.');
      list.forEach(x=>x.r.mesh.updateMatrixWorld(true)); const buf=stlBinary(list.map(x=>x.r)), u8=new Uint8Array(buf instanceof ArrayBuffer? buf : buf.buffer||buf);
      let bin=''; for(let i=0;i<u8.length;i+=0x8000) bin+=String.fromCharCode.apply(null, u8.subarray(i,i+0x8000));
      return {name:slug(state.name)+'.stl', mime:'model/stl', base64:btoa(bin), triangles:new DataView(u8.buffer, u8.byteOffset).getUint32(80,true)}; }
    case 'view.thumbnail': { renderer.render(scene, camera); const src=renderer.domElement, w=clamp(+d.width||320,16,2048), hh=clamp(+d.height||Math.round(w*src.height/Math.max(1,src.width)),16,2048);
      const c=document.createElement('canvas'); c.width=w; c.height=hh; const g=c.getContext('2d'); const k=Math.max(w/src.width, hh/src.height);
      g.drawImage(src, (w-src.width*k)/2, (hh-src.height*k)/2, src.width*k, src.height*k); return {mime:'image/png', dataUrl:c.toDataURL('image/png'), width:w, height:hh}; }
    case 'selection.get': return {ids:[...selection]};
    case 'selection.set': { const ids=(d.ids||[]).filter(id=>findPart(id)); selection=ids; sync(); renderInspector(); return {ids}; }
    case 'ui.set': { if([1,2,3].includes(d.level)) setLevel(d.level, true); if(['model','check','mech','struct'].includes(d.workspace)) setWs(d.workspace);
      return {level:prefs.level, workspace:ws}; }
    case 'progress.get': return {done:{...PROG.done}};
    case 'events.subscribe': { BR.subs=new Set((d.events||[]).filter(e=>BRIDGE_MANIFEST?.events?.[e])); BR.withProject=!!d.withProject; return {events:[...BR.subs]}; }
    default: throw bridgeErr('unknown-type',`Message inconnu : ${type}`);
  }
}
/* appelé par commit() et restore() (scene.js) : le projet a changé */
let bridgeTimer=0;
function bridgeChanged(){ if(!BR) return; BR.rev++; if(!BR.origin || !BR.subs.has('project.changed')) return;
  clearTimeout(bridgeTimer); bridgeTimer=setTimeout(()=>bridgeSend('project.changed', {revision:BR.rev, ...(BR.withProject? {project:bridgeProject()} : {})}), 300); }
function bridgeSaved(name){ if(BR?.subs.has('project.saved')) bridgeSend('project.saved', {name}); }
function bridgePoll(){ if(!BR?.origin) return;
  const s=selection.join(','); if(s!==BR.lastSel){ BR.lastSel=s; if(BR.subs.has('selection.changed')) bridgeSend('selection.changed', {ids:[...selection]}); }
  const g=JSON.stringify(PROG.done); if(g!==BR.lastProg){ const first=!BR.lastProg; BR.lastProg=g; if(!first && BR.subs.has('progress.changed')) bridgeSend('progress.changed', {done:{...PROG.done}}); } }
