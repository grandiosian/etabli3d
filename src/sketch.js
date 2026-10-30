
/* =========================================================
   Sketch editor: lines, rectangles, circles, dimensions, constraints
   ========================================================= */
const SK={part:null,plane:'xy',msel:[],filt:{pt:true,edge:true,con:true},space:false,d:null,tool:'rect',view:{cx:0,cy:0,s:5},hist:[],hidx:-1,sel:null,chain:null,pend:null,mouse:null,drag:null,mode:'extrude',h:10,labels:[],badges:[],err:0,editing:null,snapPt:null};
const skCanvas=$('#skCanvas'), skCtx=skCanvas.getContext('2d');
let skW=0, skH=0;
const toS=(x,y)=>[skW/2+(x-SK.view.cx)*SK.view.s, skH/2-(y-SK.view.cy)*SK.view.s];
const toW=(sx,sy)=>[(sx-skW/2)/SK.view.s+SK.view.cx, -(sy-skH/2)/SK.view.s+SK.view.cy];
const skP=id=>SK.d.pts.find(p=>p.id===id);
const skL=id=>SK.d.lines.find(l=>l.id===id);
const skC=id=>SK.d.circles.find(c=>c.id===id);
const skB=id=>SK.d.beziers.find(z=>z.id===id);

/* opts.plane : 'xy' | 'xz' | 'yz' (nouvelle esquisse) ; opts.tool : outil choisi à l'ouverture */
function openSketch(part=null, opts={}){
  closePlanePicker();
  SK.part=part?part.id:null;
  if(part){ SK.d=clone(part.params.sk); SK.mode=part.params.mode||'extrude'; SK.h=part.params.h||10; SK.plane=part.params.plane||null; }
  else { SK.d={nid:2,pts:[{id:1,x:0,y:0,fixed:true,origin:true}],lines:[],circles:[],beziers:[],cons:[]}; SK.mode='extrude'; SK.h=10; SK.plane=SKPLANES[opts.plane]? opts.plane : 'xy'; }
  SK.d.beziers ||= [];
  if(!lv(3) && SK.mode==='revolve') toast('Cette esquisse utilise la révolution, réservée au niveau Avancé.');
  SK.hist=[]; SK.hidx=-1; SK.sel=null; SK.msel=[]; SK.chain=null; SK.pend=null; SK.editing=null;
  const pl=SKPLANES[SK.plane||'xy']; $('#skPlane').textContent= SK.plane? pl.label : 'Plan XY · dessus';
  $('#sk').hidden=false; $('#skH').value=fmtIn(SK.h); setSkMode(SK.mode,false);
  skResize(); skFit(); skPush(); setSkTool(part?'select':(opts.tool||'rect')); renderDemo();
}
function closeSketch(apply){
  hideDimEdit(false);
  if(apply){
    skSolve();
    const pr=skProfiles(SK.d);
    if(!pr.shapes.length){ toast('Aucun contour fermé : reliez le dernier point au premier.'); return; }
    bzRefresh(SK.d);
    const params={sk:SK.d, mode:SK.mode, h:SK.h}; if(SK.plane) params.plane=SK.plane;
    if(SK.part!=null){ const p=findPart(SK.part); if(p){
        // a sketch drawn on a plane keeps that plane: switching extrusion / revolution turns the part if it was still at its place
        if(SK.plane && p.params.mode!==SK.mode && sameRot(p.rot, planeRot(SK.plane, p.params.mode||'extrude'))) p.rot=planeRot(SK.plane, SK.mode);
        p.params=params; selection=[p.id]; } }
    else { const p=newPart('sketch',{params, rot:planeRot(SK.plane, SK.mode)}); if(state.edit) p.inGroup=state.edit.gid; state.parts.push(p); selection=[p.id]; }
    sync(); commit(); setTab('part');
  }
  $('#sk').hidden=true; renderDemo();
}
function skPush(){ const s=JSON.stringify(SK.d); if(SK.hist[SK.hidx]===s) return; SK.hist=SK.hist.slice(0,SK.hidx+1); SK.hist.push(s); SK.hidx=SK.hist.length-1; }
function skUndo(){ if(SK.hidx>0){ SK.hidx--; SK.d=JSON.parse(SK.hist[SK.hidx]); SK.sel=null; SK.msel=[]; SK.chain=null; SK.pend=null; skSolve(); skDraw(); } }
function skRedo(){ if(SK.hidx<SK.hist.length-1){ SK.hidx++; SK.d=JSON.parse(SK.hist[SK.hidx]); SK.sel=null; SK.msel=[]; skSolve(); skDraw(); } }
function setSkMode(m, draw=true){
  SK.mode=m; $('#skModeExt').classList.toggle('on',m==='extrude'); $('#skModeRev').classList.toggle('on',m==='revolve'); $('#skHRow').hidden= m!=='extrude';
  const pl=SKPLANES[SK.plane||'xy'];
  $('#skModeInfo').innerHTML = m==='extrude' ? `Le profil ${pl.ext} sur la hauteur choisie. Un contour dessiné à l’intérieur d’un autre devient un <b>trou</b>.`
    : 'Le profil tourne autour de l’<b>axe vertical</b> de l’esquisse (pointillés). Dessinez le <b>demi-profil</b> à droite de l’axe.'
      + (SK.plane==='xy'? '<br>Sur le plan du <b>dessus</b>, cet axe est <b>Y</b> : la pièce sera couchée. Pour une pièce debout, choisissez le plan de <b>face</b> (XZ).' : SK.plane? ' Cet axe est l’axe <b>Z</b> : la pièce sera debout.' : ' Il devient l’axe Z de la pièce.');
  if(draw) skDraw();
}
const HINTS={
  select:'Cliquez un élément pour le choisir (<b>Maj</b> : en ajouter). <b>Glissez dans le vide</b> : cadre de sélection, selon le filtre en haut (points, arêtes, contraintes). Glissez un point ou une ligne pour déformer. <b>Suppr</b> efface. <b>Espace + glisser</b> : décaler la vue ; molette : zoom.',
  line:'Cliquez pour poser les points. Revenez sur le <b>premier point</b> pour fermer le contour. <b>Échap</b> ou double-clic pour arrêter. Les lignes presque horizontales ou verticales sont redressées.',
  rect:'Cliquez un premier coin, puis le coin opposé. Le rectangle reçoit des contraintes horizontales et verticales.',
  circle:'Cliquez le centre, puis un point du cercle.',
  bezier:'Point par point : un <b>clic</b> pose un point anguleux, <b>cliquer-glisser</b> pose un point et tire sa courbe (Alt : tangente cassée). Revenez au <b>premier point</b> pour fermer ; <b>Échap</b> ou double-clic pour arrêter. Les boutons en haut règlent le point en cours.',
  dim:'Cliquez une <b>ligne</b> (longueur), un <b>cercle</b> (diamètre) ou <b>deux points</b> (distance), puis tapez la valeur et <b>Entrée</b>.',
  dimh:'Cliquez une ligne ou deux points pour coter l’écart <b>horizontal</b>.',
  dimv:'Cliquez une ligne ou deux points pour coter l’écart <b>vertical</b>.',
  h:'Cliquez une ligne pour la rendre <b>horizontale</b>.', v:'Cliquez une ligne pour la rendre <b>verticale</b>.',
  par:'Cliquez deux lignes pour les rendre <b>parallèles</b>.', perp:'Cliquez deux lignes pour les rendre <b>perpendiculaires</b>.',
  eq:'Cliquez deux lignes (même longueur) ou deux cercles (même diamètre).',
  coinc:'Cliquez deux points pour les <b>réunir</b> en un seul (pour fermer un contour par exemple).',
  fix:'Cliquez un point pour le <b>bloquer</b> ou le débloquer. L’origine est toujours fixe.',
};
function setSkTool(t){ SK.tool=t; SK.chain=null; SK.pend=null; if(SK.d) skCleanup(); $$('#skbar [data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===t)); $('#skHint').innerHTML=HINTS[t]||''; skCanvas.style.cursor= t==='select'?'default':'crosshair'; skDraw(); }
function skResize(){ const r=$('#skCanvasWrap').getBoundingClientRect(); const dpr=Math.min(2,devicePixelRatio||1); skW=r.width; skH=r.height; skCanvas.width=Math.max(1,r.width*dpr); skCanvas.height=Math.max(1,r.height*dpr); skCtx.setTransform(dpr,0,0,dpr,0,0); skDraw(); }
new ResizeObserver(()=>{ if(!$('#sk').hidden) skResize(); }).observe($('#skCanvasWrap'));
function skFit(){
  const d=SK.d; let xs=d.pts.map(p=>p.x), ys=d.pts.map(p=>p.y);
  for(const c of d.circles){ const p=skP(c.c); xs.push(p.x-c.r,p.x+c.r); ys.push(p.y-c.r,p.y+c.r); }
  for(const z of d.beziers||[]){ for(const q of bezCtrl(d,z)){ xs.push(q[0]); ys.push(q[1]); } }
  let minx=Math.min(...xs), maxx=Math.max(...xs), miny=Math.min(...ys), maxy=Math.max(...ys);
  if(maxx-minx<40){ const m=(minx+maxx)/2; minx=Math.min(minx,m-20)-10; maxx=Math.max(maxx,m+20)+30; }
  if(maxy-miny<30){ const m=(miny+maxy)/2; miny=Math.min(miny,m-15)-10; maxy=Math.max(maxy,m+15)+20; }
  SK.view.cx=(minx+maxx)/2; SK.view.cy=(miny+maxy)/2;
  SK.view.s=clamp(Math.min(skW/((maxx-minx)*1.35), skH/((maxy-miny)*1.4)),0.3,60);
  skDraw();
}
function gridStep(){ const s=SK.view.s; for(const g of [0.5,1,2,5,10,20,50,100]) if(g*s>=7) return g; return 100; }
function snapStep(){ const g=gridStep(); return g<1?0.5:g<=1?1:g<=2?1:g<=5?5:g; }

/* ---------- solver: iterative projection (position-based) */
function skSolve(pin=null, iters=500){
  const d=SK.d; const P=new Map(d.pts.map(p=>[p.id,p])), L=new Map(d.lines.map(l=>[l.id,l])), C=new Map(d.circles.map(c=>[c.id,c]));
  const w=p=> (p.fixed||p.origin||p.id===pin)?0:1;
  const len=l=>{ const a=P.get(l.a), b=P.get(l.b); return Math.hypot(b.x-a.x,b.y-a.y); };
  const ang=l=>{ const a=P.get(l.a), b=P.get(l.b); return Math.atan2(b.y-a.y,b.x-a.x); };
  const movable=l=> w(P.get(l.a))+w(P.get(l.b))>0;
  const anchor=l=>{ const a=P.get(l.a), b=P.get(l.b); if(!w(a)) return [a.x,a.y]; if(!w(b)) return [b.x,b.y]; return [(a.x+b.x)/2,(a.y+b.y)/2]; };
  const rotate=(l,t)=>{ const [ox,oy]=anchor(l); const c=Math.cos(t), s=Math.sin(t); for(const p of [P.get(l.a),P.get(l.b)]){ if(!w(p)) continue; const x=p.x-ox, y=p.y-oy; p.x=ox+x*c-y*s; p.y=oy+x*s+y*c; } };
  const scaleTo=(l,T)=>{ const a=P.get(l.a), b=P.get(l.b); let dx=b.x-a.x, dy=b.y-a.y, n=Math.hypot(dx,dy); if(n<1e-9){ dx=1;dy=0;n=1; } const ux=dx/n, uy=dy/n;
    if(!w(a)&&!w(b)) return; if(!w(a)){ b.x=a.x+ux*T; b.y=a.y+uy*T; } else if(!w(b)){ a.x=b.x-ux*T; a.y=b.y-uy*T; } else { const mx=(a.x+b.x)/2, my=(a.y+b.y)/2; a.x=mx-ux*T/2; a.y=my-uy*T/2; b.x=mx+ux*T/2; b.y=my+uy*T/2; } };
  const pair=(a,b,key,target)=>{ // make b[key]-a[key] == target
    const wa=w(a), wb=w(b), cur=b[key]-a[key], diff=cur-target; if(wa+wb===0) return Math.abs(diff);
    a[key]+=diff*wa/(wa+wb); b[key]-=diff*wb/(wa+wb); return Math.abs(diff); };
  const fold=t=>{ t=Math.atan2(Math.sin(t),Math.cos(t)); if(t>Math.PI/2) t-=Math.PI; if(t<-Math.PI/2) t+=Math.PI; return t; };
  const proj=c=>{
    switch(c.type){
      case 'h': { const l=L.get(c.l); return pair(P.get(l.a),P.get(l.b),'y',0); }
      case 'v': { const l=L.get(c.l); return pair(P.get(l.a),P.get(l.b),'x',0); }
      case 'dx': return pair(P.get(c.a),P.get(c.b),'x',c.sign*c.value);
      case 'dy': return pair(P.get(c.a),P.get(c.b),'y',c.sign*c.value);
      case 'dist': { const a=P.get(c.a), b=P.get(c.b); const wa=w(a), wb=w(b); let dx=b.x-a.x, dy=b.y-a.y, n=Math.hypot(dx,dy); if(n<1e-9){ if(wb) b.x+=1e-3; else if(wa) a.x-=1e-3; return c.value; }
        const diff=n-c.value; if(wa+wb===0) return Math.abs(diff); const ux=dx/n, uy=dy/n;
        a.x+=ux*diff*wa/(wa+wb); a.y+=uy*diff*wa/(wa+wb); b.x-=ux*diff*wb/(wa+wb); b.y-=uy*diff*wb/(wa+wb); return Math.abs(diff); }
      case 'diam': { const ci=C.get(c.c); const e=Math.abs(ci.r*2-c.value); ci.r=c.value/2; return e; }
      case 'eqr': { const a=C.get(c.c1), b=C.get(c.c2); const e=Math.abs(a.r-b.r); const dA=d.cons.some(k=>k.type==='diam'&&k.c===a.id), dB=d.cons.some(k=>k.type==='diam'&&k.c===b.id);
        const t= dA&&!dB? a.r : dB&&!dA? b.r : (a.r+b.r)/2; if(!dA) a.r=t; if(!dB) b.r=t; return e; }
      case 'eq': { const l1=L.get(c.l1), l2=L.get(c.l2); const L1=len(l1), L2=len(l2); const m1=movable(l1), m2=movable(l2); if(!m1&&!m2) return Math.abs(L1-L2);
        const T= !m1? L1 : !m2? L2 : (L1+L2)/2; if(m1) scaleTo(l1,T); if(m2) scaleTo(l2,T); return Math.abs(L1-L2); }
      case 'par': case 'perp': { const l1=L.get(c.l1), l2=L.get(c.l2); const t=fold(ang(l2)-ang(l1)-(c.type==='perp'?Math.PI/2:0));
        const k1=movable(l1)?1:0, k2=movable(l2)?1:0; const e=Math.abs(t)*Math.max(len(l1),len(l2)); if(k1+k2===0) return e;
        rotate(l1, t*k1/(k1+k2)); rotate(l2, -t*k2/(k1+k2)); return e; }
    }
    return 0;
  };
  let err=0;
  for(let it=0;it<iters;it++){ err=0; for(const c of d.cons){ const e=proj(c); if(e>err) err=e; } if(err<1e-7) break; }
  SK.err = pin==null? err : SK.err;
  return err;
}
function skDOF(){ const d=SK.d; let n=d.pts.filter(p=>!p.fixed&&!p.origin).length*2 + d.circles.length; n-=d.cons.length; return n; }

/* ---------- editing helpers */
function skNewPoint(x,y){ const p={id:SK.d.nid++, x:+x.toFixed(4), y:+y.toFixed(4)}; SK.d.pts.push(p); return p; }
function skAddCon(c){ c.id=SK.d.nid++; SK.d.cons.push(c); return c; }
function skTry(fn, msg){ // apply a change, solve, revert when the constraints conflict
  const before=JSON.stringify(SK.d); const r=fn(); const err=skSolve();
  if(err>1e-3){ SK.d=JSON.parse(before); skSolve(); toast(msg||'Impossible : cette contrainte entre en conflit avec les autres.'); skDraw(); return null; }
  skPush(); skDraw(); return r;
}
function consRefs(c){ return { pts:['dist','dx','dy'].includes(c.type)?[c.a,c.b]:[], lines: c.l?[c.l]: (c.l1?[c.l1,c.l2]:[]), circles: c.c?[c.c]:(c.c1?[c.c1,c.c2]:[]) }; }
function skCleanup(){
  const d=SK.d;
  d.lines=d.lines.filter(l=>l.a!==l.b && d.pts.some(p=>p.id===l.a) && d.pts.some(p=>p.id===l.b));
  // duplicate lines
  const seen=new Set(); d.lines=d.lines.filter(l=>{ const k=[l.a,l.b].sort((x,y)=>x-y).join('-'); if(seen.has(k)) return false; seen.add(k); return true; });
  d.circles=d.circles.filter(c=>d.pts.some(p=>p.id===c.c));
  d.beziers=(d.beziers||[]).filter(z=>z.a!==z.b && d.pts.some(p=>p.id===z.a) && d.pts.some(p=>p.id===z.b));
  const LS=new Set(d.lines.map(l=>l.id)), CS=new Set(d.circles.map(c=>c.id)), PS=new Set(d.pts.map(p=>p.id));
  d.cons=d.cons.filter(c=>{ const r=consRefs(c); return r.lines.every(i=>LS.has(i)) && r.circles.every(i=>CS.has(i)) && r.pts.every(i=>PS.has(i)) && !(r.pts.length===2&&r.pts[0]===r.pts[1]) && !(r.lines.length===2&&r.lines[0]===r.lines[1]); });
  const used=new Set(); d.lines.forEach(l=>{used.add(l.a);used.add(l.b);}); d.circles.forEach(c=>used.add(c.c)); d.beziers.forEach(z=>{used.add(z.a);used.add(z.b);});
  for(const id of [SK.pend?.pen && SK.pend.first, SK.pend?.pen && SK.pend.last, SK.chain?.first, SK.chain?.last]) if(id!=null) used.add(id);   // the chain being drawn keeps its points
  d.pts=d.pts.filter(p=>p.origin||used.has(p.id));
}
function skDelete(){
  const list=skSelList(); if(!list.length) return; const d=SK.d;
  for(const s of list){
  if(s.type==='pt'){ const p=skP(s.id); if(!p || p.origin){ if(list.length===1) toast('L’origine ne peut pas être supprimée.'); continue; } d.lines=d.lines.filter(l=>l.a!==s.id&&l.b!==s.id); d.circles=d.circles.filter(c=>c.c!==s.id); d.beziers=d.beziers.filter(z=>z.a!==s.id&&z.b!==s.id); d.pts=d.pts.filter(p=>p.id!==s.id); }
  if(s.type==='line') d.lines=d.lines.filter(l=>l.id!==s.id);
  if(s.type==='circle') d.circles=d.circles.filter(c=>c.id!==s.id);
  if(s.type==='bez') d.beziers=d.beziers.filter(z=>z.id!==s.id);
  if(s.type==='con') d.cons=d.cons.filter(c=>c.id!==s.id);
  }
  SK.sel=null; SK.msel=[]; skCleanup(); skSolve(); skPush(); skDraw();
}
function skMerge(keepId, dropId){
  const d=SK.d; const k=skP(keepId), q=skP(dropId); if(!k||!q||k===q) return;
  if(q.origin||(q.fixed&&!k.fixed)) return skMerge(dropId, keepId);
  for(const l of d.lines){ if(l.a===dropId) l.a=keepId; if(l.b===dropId) l.b=keepId; }
  for(const c of d.circles) if(c.c===dropId) c.c=keepId;
  for(const z of d.beziers){ if(z.a===dropId) z.a=keepId; if(z.b===dropId) z.b=keepId; }
  for(const c of d.cons){ if(c.a===dropId) c.a=keepId; if(c.b===dropId) c.b=keepId; }
  d.pts=d.pts.filter(p=>p.id!==dropId); skCleanup();
}

/* ---------- hit testing (screen space) */
function hitPoint(sx,sy,r=10,exclude=null){ let best=null,bd=r; for(const p of SK.d.pts){ if(p.id===exclude) continue; const [x,y]=toS(p.x,p.y); const dd=Math.hypot(x-sx,y-sy); if(dd<bd){bd=dd;best=p;} } return best; }
function hitLine(sx,sy,r=7){ let best=null,bd=r; for(const l of SK.d.lines){ const [ax,ay]=toS(skP(l.a).x,skP(l.a).y), [bx,by]=toS(skP(l.b).x,skP(l.b).y); const vx=bx-ax, vy=by-ay, L2=vx*vx+vy*vy||1; const t=clamp(((sx-ax)*vx+(sy-ay)*vy)/L2,0,1); const dd=Math.hypot(ax+vx*t-sx, ay+vy*t-sy); if(dd<bd){bd=dd;best=l;} } return best; }
function hitCircle(sx,sy,r=7){ let best=null,bd=r; for(const c of SK.d.circles){ const p=skP(c.c); const [x,y]=toS(p.x,p.y); const dd=Math.abs(Math.hypot(x-sx,y-sy)-c.r*SK.view.s); if(dd<bd){bd=dd;best=c;} } return best; }
function bezScreen(z){ return bezCtrl(SK.d,z).map(q=>toS(q[0],q[1])); }
function hitBez(sx,sy,r=7){ let best=null,bd=r; for(const z of SK.d.beziers){ const c=bezScreen(z); let prev=c[0];
    for(let i=1;i<=40;i++){ const q=bezAt(c,i/40); const vx=q[0]-prev[0], vy=q[1]-prev[1], L2=vx*vx+vy*vy||1; const t=clamp(((sx-prev[0])*vx+(sy-prev[1])*vy)/L2,0,1); const dd=Math.hypot(prev[0]+vx*t-sx, prev[1]+vy*t-sy); if(dd<bd){bd=dd;best=z;} prev=q; } } return best; }
function hitHandle(sx,sy,r=8){ for(const z of SK.d.beziers){ const c=bezScreen(z);
    for(const [which,i,e] of [[1,1,0],[2,2,3]]){ if(!bzShowHandle(skP(which===1?z.a:z.b))) continue; if(Math.hypot(c[i][0]-c[e][0],c[i][1]-c[e][1])<6) continue; if(Math.hypot(c[i][0]-sx,c[i][1]-sy)<r) return {id:z.id,which}; } } return null; }
function hitLabel(sx,sy){ return SK.labels.find(b=>sx>=b.x-b.w/2-3&&sx<=b.x+b.w/2+3&&sy>=b.y-b.h/2-3&&sy<=b.y+b.h/2+3)||null; }
function hitBadge(sx,sy){ return SK.badges.find(b=>Math.abs(sx-b.x)<=9&&Math.abs(sy-b.y)<=9)||null; }
function snapW(sx,sy, exclude=null){
  const p=hitPoint(sx,sy,10,exclude); if(p){ SK.snapPt=p.id; return {x:p.x,y:p.y,pt:p}; }
  SK.snapPt=null; let [x,y]=toW(sx,sy);
  if($('#skSnap').checked){ const g=snapStep(); x=Math.round(x/g)*g; y=Math.round(y/g)*g; }
  return {x,y,pt:null};
}

/* ---------- dimensions */
function measure(c){ const a=skP(c.a), b=skP(c.b);
  if(c.type==='dist') return Math.hypot(b.x-a.x,b.y-a.y); if(c.type==='dx') return Math.abs(b.x-a.x); if(c.type==='dy') return Math.abs(b.y-a.y);
  if(c.type==='diam') return skC(c.c).r*2; return 0; }
function addDim(type, a, b){
  const d=SK.d;
  const exist=d.cons.find(c=>c.type===type && ((c.a===a&&c.b===b)||(c.a===b&&c.b===a)) ); if(exist){ showDimEdit(exist); return; }
  const pa=skP(a), pb=skP(b);
  if(type==='dist' && Math.hypot(pb.x-pa.x,pb.y-pa.y)<1e-6) return toast('Les deux points sont confondus.');
  const n=SK.d.pts.length||1, gx=SK.d.pts.reduce((s,p)=>s+p.x,0)/n, gy=SK.d.pts.reduce((s,p)=>s+p.y,0)/n;
  const mx=(pa.x+pb.x)/2, my=(pa.y+pb.y)/2;
  const c={type, a, b, value:0, off: 16/SK.view.s};
  if(type==='dist'){ const nx=-(pb.y-pa.y), ny=pb.x-pa.x; if(nx*(mx-gx)+ny*(my-gy)<0) c.off=-c.off; }
  if(type==='dx'){ c.sign=Math.sign(pb.x-pa.x)||1; c.off=(Math.abs(pa.y-pb.y)/2+18/SK.view.s)*(my>=gy?1:-1); }
  if(type==='dy'){ c.sign=Math.sign(pb.y-pa.y)||1; c.off=(Math.abs(pa.x-pb.x)/2+18/SK.view.s)*(mx>=gx?1:-1); }
  c.value=+measure(c).toFixed(2);
  if(type!=='dist' && c.value<1e-6) return toast('Les deux points sont déjà alignés sur cet axe.');
  const r=skTry(()=>skAddCon(c),'Impossible : cette cote est déjà imposée par d’autres contraintes.'); if(r) showDimEdit(r);
}
function addDiam(cid){ const exist=SK.d.cons.find(c=>c.type==='diam'&&c.c===cid); if(exist){ showDimEdit(exist); return; }
  const c={type:'diam', c:cid, value:+(skC(cid).r*2).toFixed(2), ang:Math.PI/4, off:12/SK.view.s};
  const r=skTry(()=>skAddCon(c)); if(r) showDimEdit(r); }
function dimLabelPos(c){ const L=SK.labels.find(b=>b.id===c.id); return L? [L.x,L.y] : [skW/2,skH/2]; }
function showDimEdit(c){
  skDraw(); const [x,y]=dimLabelPos(c); const e=$('#dimEdit'); SK.editing=c.id;
  e.hidden=false; e.style.left=x+'px'; e.style.top=y+'px'; e.value=fmtIn(c.value); e.focus(); e.select();
}
function hideDimEdit(apply){
  const e=$('#dimEdit'); if(e.hidden) return; const id=SK.editing; SK.editing=null; e.hidden=true;
  if(!apply) { skDraw(); return; }
  const c=SK.d.cons.find(k=>k.id===id); if(!c) return;
  const v=parseNum(e.value); if(!isFinite(v)||v<=0){ toast('Tapez une valeur positive en millimètres.'); skDraw(); return; }
  if(Math.abs(v-c.value)<1e-9){ skDraw(); return; }
  skTry(()=>{ c.value=v; }, 'Cette valeur est incompatible avec les autres contraintes.');
}
$('#dimEdit').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); hideDimEdit(true); } else if(e.key==='Escape'){ e.preventDefault(); hideDimEdit(false); } e.stopPropagation(); });
$('#dimEdit').addEventListener('blur',()=>hideDimEdit(true));

/* ---------- pointer interaction */
function skEvt(ev){ const r=skCanvas.getBoundingClientRect(); return [ev.clientX-r.left, ev.clientY-r.top]; }
function finishChain(){ if(!SK.chain) return; const st=skP(SK.chain.first); if(st && !st.origin && !SK.d.lines.some(l=>l.a===st.id||l.b===st.id) && !SK.d.circles.some(c=>c.c===st.id)) SK.d.pts=SK.d.pts.filter(p=>p!==st); SK.chain=null; skPush(); skDraw(); }
function axisLock(from, sx, sy){ // straighten nearly horizontal / vertical segments
  let s=snapW(sx,sy, null); if(s.pt) return {...s, lock:null};
  const dx=s.x-from.x, dy=s.y-from.y; const tol=Math.tan(4*DEG);
  if(Math.abs(dx)>1e-6 && Math.abs(dy)<=Math.abs(dx)*tol) return {x:s.x,y:from.y,pt:null,lock:'h'};
  if(Math.abs(dy)>1e-6 && Math.abs(dx)<=Math.abs(dy)*tol) return {x:from.x,y:s.y,pt:null,lock:'v'};
  return {...s, lock:null};
}
skCanvas.addEventListener('contextmenu',e=>e.preventDefault());
skCanvas.addEventListener('pointerdown', ev=>{
  ev.preventDefault();
  if(!$('#dimEdit').hidden) hideDimEdit(true);
  const [sx,sy]=skEvt(ev); skCanvas.setPointerCapture(ev.pointerId);
  if(ev.button===1||ev.button===2||(ev.button===0 && SK.space)){ if(ev.button===2 && SK.chain){ finishChain(); return; } if(ev.button===2 && SK.pend?.pen){ bzEndChain(); return; } SK.drag={kind:'pan',sx,sy,cx:SK.view.cx,cy:SK.view.cy}; return; }
  const t=SK.tool, d=SK.d;
  if(t==='select'){
    const F=SK.filt, [wx,wy]=toW(sx,sy);
    const pick=(item)=>{   // Maj : ajouter / retirer ; un élément déjà dans la sélection multiple la déplace en bloc
      if(ev.shiftKey){ const L=skSelList(), k=L.findIndex(e=>e.type===item.type&&e.id===item.id); if(k>=0) L.splice(k,1); else L.push(item); SK.msel=L; SK.sel= L.length===1? L[0] : null; skDraw(); return true; }
      if(SK.msel.length>1 && skIsSel(item.type,item.id) && item.type!=='con'){ SK.drag={kind:'multi',wx,wy,orig:skSelPoints().map(p=>({id:p.id,x:p.x,y:p.y})),moved:false}; skDraw(); return true; }
      SK.msel=[]; SK.sel=item; return false; };
    const lb=F.con && hitLabel(sx,sy); if(lb){ if(pick({type:'con',id:lb.id})) return; SK.drag={kind:'label',id:lb.id,moved:false}; skDraw(); return; }
    const bg=F.con && hitBadge(sx,sy); if(bg){ pick({type:'con',id:bg.id}); skDraw(); return; }
    const hd=F.pt && hitHandle(sx,sy); if(hd){ const z=skB(hd.id); SK.msel=[]; SK.sel={type:'pt',id:hd.which===1?z.a:z.b}; SK.drag={kind:'handle',...hd,moved:false}; skDraw(); return; }
    const p=F.pt && hitPoint(sx,sy); if(p){ if(pick({type:'pt',id:p.id})) return; if(!p.fixed&&!p.origin) SK.drag={kind:'pt',id:p.id,moved:false}; skDraw(); return; }
    const l=F.edge && hitLine(sx,sy); if(l){ if(pick({type:'line',id:l.id})) return; SK.drag={kind:'line',id:l.id,wx,wy,a:{...skP(l.a)},b:{...skP(l.b)},moved:false}; skDraw(); return; }
    const z=F.edge && hitBez(sx,sy); if(z){ if(pick({type:'bez',id:z.id})) return; SK.drag={kind:'line',bez:true,id:z.id,wx,wy,a:{...skP(z.a)},b:{...skP(z.b)},moved:false}; skDraw(); return; }
    const c=F.edge && hitCircle(sx,sy); if(c){ if(pick({type:'circle',id:c.id})) return; SK.drag={kind:'circle',id:c.id,moved:false}; skDraw(); return; }
    SK.drag={kind:'box',sx,sy,x1:sx,y1:sy,add:ev.shiftKey,moved:false}; skDraw(); return;
  }
  if(t==='line'){
    if(!SK.chain){ const s=snapW(sx,sy); const p=s.pt||skNewPoint(s.x,s.y); SK.chain={first:p.id,last:p.id}; skDraw(); return; }
    const last=skP(SK.chain.last); const s=axisLock(last,sx,sy);
    if(s.pt && s.pt.id===last.id) return;
    const existed=!!s.pt; const q=s.pt||skNewPoint(s.x,s.y);
    const l={id:d.nid++, a:last.id, b:q.id}; d.lines.push(l);
    const dx=q.x-last.x, dy=q.y-last.y;
    if(s.lock==='h' || (existed && Math.abs(dy)<1e-6 && Math.abs(dx)>1e-6)) skAddCon({type:'h',l:l.id});
    else if(s.lock==='v' || (existed && Math.abs(dx)<1e-6 && Math.abs(dy)>1e-6)) skAddCon({type:'v',l:l.id});
    if(existed){ SK.chain=null; } else SK.chain.last=q.id;
    skCleanup(); skSolve(); skPush(); skDraw(); return;
  }
  if(t==='bezier'){   // pen: a click places a corner point, a click-drag places a point and pulls its tangent
    const s=snapW(sx,sy);
    if(!SK.pend){ const p=s.pt||skNewPoint(s.x,s.y); if(!s.pt || (!p.it && !bzOnCurve(p.id))) p.it='lin';
      SK.pend={pen:true, first:p.id, last:p.id, out:null}; SK.sel={type:'pt',id:p.id}; SK.drag={kind:'pen',id:p.id,sx,sy,moved:false,close:false}; skDraw(); return; }
    const last=skP(SK.pend.last); if(!last){ SK.pend=null; skDraw(); return; }
    if(s.pt && s.pt.id===last.id){ SK.drag={kind:'pen',id:last.id,sx,sy,moved:false,close:false,again:true}; return; }   // drag again on the current point: re-pull its tangent
    if(s.pt && d.beziers.filter(z=>(z.a===last.id&&z.b===s.pt.id)||(z.b===last.id&&z.a===s.pt.id)).length>1) return;
    const q=s.pt||skNewPoint(s.x,s.y); if(!s.pt || (!q.it && !bzOnCurve(q.id))) q.it='lin';
    const out= SK.pend.out || (bzType(last).it==='bez' ? bzMirror(last) : null);
    d.beziers.push({id:d.nid++, a:last.id, b:q.id, t1:out? out.map(v=>+v.toFixed(4)) : [0,0], t2:[0,0]});
    if(s.pt){ const Q=bzType(q); const o=bzRefs(d,q.id).find(r=>r.key==='t1' && r.z!==d.beziers[d.beziers.length-1]);
      if(Q.it==='bez' && Q.tm!=='free' && o){ const h=o.z.t1, n=Math.hypot(h[0],h[1]); const L= Q.tm==='sym'? n : Math.hypot(last.x-q.x,last.y-q.y)/3;
        if(n>1e-9) d.beziers[d.beziers.length-1].t2=[-h[0]/n*L, -h[1]/n*L]; } }
    SK.pend.last=q.id; SK.pend.out=null; SK.sel={type:'pt',id:q.id};
    SK.drag={kind:'pen',id:q.id,sx,sy,moved:false,close:!!s.pt};
    bzRefresh(d); skDraw(); return;
  }
  if(t==='rect'){
    const s=snapW(sx,sy);
    if(!SK.pend){ SK.pend={x:s.x,y:s.y,pt:s.pt?.id??null}; skDraw(); return; }
    const A=SK.pend; SK.pend=null; if(Math.abs(s.x-A.x)<1e-6||Math.abs(s.y-A.y)<1e-6){ toast('Le rectangle doit avoir une largeur et une hauteur.'); skDraw(); return; }
    const p1=A.pt!=null?skP(A.pt):skNewPoint(A.x,A.y), p3=s.pt||skNewPoint(s.x,s.y);
    const p2=skNewPoint(p3.x,p1.y), p4=skNewPoint(p1.x,p3.y);
    const L=[[p1,p2],[p2,p3],[p3,p4],[p4,p1]].map(([a,b])=>{ const l={id:d.nid++,a:a.id,b:b.id}; d.lines.push(l); return l; });
    skAddCon({type:'h',l:L[0].id}); skAddCon({type:'v',l:L[1].id}); skAddCon({type:'h',l:L[2].id}); skAddCon({type:'v',l:L[3].id});
    skSolve(); skPush(); skDraw(); return;
  }
  if(t==='circle'){
    const s=snapW(sx,sy);
    if(!SK.pend){ SK.pend={x:s.x,y:s.y,pt:s.pt?.id??null}; skDraw(); return; }
    const A=SK.pend; SK.pend=null; let r=Math.hypot(s.x-A.x,s.y-A.y); if($('#skSnap').checked){ const g=snapStep()/2; r=Math.max(g,Math.round(r/g)*g); }
    if(r<1e-3){ skDraw(); return; }
    const c0=A.pt!=null?skP(A.pt):skNewPoint(A.x,A.y);
    d.circles.push({id:d.nid++, c:c0.id, r}); skPush(); skDraw(); return;
  }
  // constraint & dimension tools
  const p=hitPoint(sx,sy), l=p?null:hitLine(sx,sy), c=(p||l)?null:hitCircle(sx,sy);
  if(!p && !l && !c && hitBez(sx,sy)){ toast(t.startsWith('dim')? 'Pour coter une courbe, cliquez ses deux extrémités.' : 'Les contraintes s’appliquent aux lignes et aux cercles, pas aux courbes.'); return; }
  if(t==='dim'||t==='dimh'||t==='dimv'){
    const type= t==='dim'?'dist': t==='dimh'?'dx':'dy';
    if(p){ if(SK.pend && SK.pend.pt!==p.id){ const a=SK.pend.pt; SK.pend=null; addDim(type,a,p.id); } else { SK.pend={pt:p.id}; skDraw(); } return; }
    SK.pend=null;
    if(l){ addDim(type,l.a,l.b); return; }
    if(c && t==='dim'){ addDiam(c.id); return; }
    const lb=hitLabel(sx,sy); if(lb){ showDimEdit(SK.d.cons.find(k=>k.id===lb.id)); return; }
    skDraw(); return;
  }
  if(t==='h'||t==='v'){
    if(!l){ toast('Cliquez une ligne.'); return; }
    if(d.cons.some(k=>(k.type==='h'||k.type==='v')&&k.l===l.id)){ toast(d.cons.some(k=>k.type===t&&k.l===l.id)?'Cette ligne a déjà cette contrainte.':'Cette ligne est déjà '+(t==='h'?'verticale':'horizontale')+'.'); return; }
    skTry(()=>skAddCon({type:t,l:l.id})); return;
  }
  if(t==='par'||t==='perp'||t==='eq'){
    const target = l? {k:'line',id:l.id} : (c && t==='eq')? {k:'circle',id:c.id} : null;
    if(!target){ toast(t==='eq'?'Cliquez une ligne ou un cercle.':'Cliquez une ligne.'); return; }
    if(!SK.pend){ SK.pend={sel:target}; SK.sel={type:target.k,id:target.id}; skDraw(); return; }
    const A=SK.pend.sel; SK.pend=null; SK.sel=null;
    if(A.k!==target.k){ toast('Choisissez deux éléments de même nature.'); skDraw(); return; }
    if(A.id===target.id){ skDraw(); return; }
    if(target.k==='circle') skTry(()=>skAddCon({type:'eqr',c1:A.id,c2:target.id}));
    else skTry(()=>skAddCon({type:t,l1:A.id,l2:target.id}));
    return;
  }
  if(t==='coinc'){
    if(!p){ toast('Cliquez un point.'); return; }
    if(!SK.pend){ SK.pend={pt:p.id}; skDraw(); return; }
    const a=SK.pend.pt; SK.pend=null; if(a===p.id){ skDraw(); return; }
    skTry(()=>skMerge(a,p.id),'Impossible de réunir ces points avec les contraintes actuelles.'); return;
  }
  if(t==='fix'){
    if(!p){ toast('Cliquez un point.'); return; }
    if(p.origin){ toast('L’origine est toujours fixe.'); return; }
    if(p.fixed){ p.fixed=false; skPush(); skDraw(); } else skTry(()=>{ p.fixed=true; });
    return;
  }
});
skCanvas.addEventListener('pointermove', ev=>{
  const [sx,sy]=skEvt(ev); SK.mouse={sx,sy};
  const dr=SK.drag;
  if(dr){
    if(dr.kind==='pan'){ SK.view.cx=dr.cx-(sx-dr.sx)/SK.view.s; SK.view.cy=dr.cy+(sy-dr.sy)/SK.view.s; skDraw(); return; }
    if(dr.kind==='box'){ dr.x1=sx; dr.y1=sy; if(Math.hypot(sx-dr.sx,sy-dr.sy)>3) dr.moved=true; skDraw(); return; }
    if(dr.kind==='multi'){ const [wx,wy]=toW(sx,sy); let dx=wx-dr.wx, dy=wy-dr.wy; if($('#skSnap').checked){ const g=snapStep(); dx=Math.round(dx/g)*g; dy=Math.round(dy/g)*g; }
      dr.moved=true; for(const o of dr.orig){ const p=skP(o.id); if(p && !p.fixed && !p.origin){ p.x=o.x+dx; p.y=o.y+dy; } } skSolve(null,200); skDraw(); return; }
    dr.moved=true;
    if(dr.kind==='pt'){ const s=snapW(sx,sy,dr.id); const p=skP(dr.id); p.x=s.x; p.y=s.y; skSolve(dr.id,200); skDraw(); return; }
    if(dr.kind==='line'){ const [wx,wy]=toW(sx,sy); let dx=wx-dr.wx, dy=wy-dr.wy; if($('#skSnap').checked){ const g=snapStep(); dx=Math.round(dx/g)*g; dy=Math.round(dy/g)*g; }
      const l=dr.bez? skB(dr.id) : skL(dr.id), a=skP(l.a), b=skP(l.b); if(!a.fixed&&!a.origin){ a.x=dr.a.x+dx; a.y=dr.a.y+dy; } if(!b.fixed&&!b.origin){ b.x=dr.b.x+dx; b.y=dr.b.y+dy; }
      skSolve(null,200); skDraw(); return; }
    if(dr.kind==='handle'){ const z=skB(dr.id); let [wx,wy]=toW(sx,sy); if($('#skSnap').checked){ const g=snapStep()/2; wx=Math.round(wx/g)*g; wy=Math.round(wy/g)*g; }
      const E=skP(dr.which===1? z.a : z.b); bzDragHandle(E, z, dr.which===1?'t1':'t2', [wx-E.x, wy-E.y], ev.altKey);
      skDraw(); return; }
    if(dr.kind==='pen'){ const E=skP(dr.id); if(!E) return; let [wx,wy]=toW(sx,sy);
      if(Math.hypot(sx-dr.sx, sy-dr.sy)<5){ dr.moved=false; return; }
      if($('#skSnap').checked){ const g=snapStep()/2; wx=Math.round(wx/g)*g; wy=Math.round(wy/g)*g; }
      bzPenPull(E, [wx-E.x, wy-E.y], ev.altKey, dr); skDraw(); return; }
    if(dr.kind==='circle'){ const c=skC(dr.id); if(SK.d.cons.some(k=>k.type==='diam'&&k.c===c.id)) return; const p=skP(c.c); let [wx,wy]=toW(sx,sy); let r=Math.hypot(wx-p.x,wy-p.y); if($('#skSnap').checked){ const g=snapStep()/2; r=Math.max(g,Math.round(r/g)*g); } c.r=r; skSolve(null,200); skDraw(); return; }
    if(dr.kind==='label'){ const c=SK.d.cons.find(k=>k.id===dr.id); const [wx,wy]=toW(sx,sy);
      if(c.type==='dist'){ const a=skP(c.a), b=skP(c.b); const L=Math.hypot(b.x-a.x,b.y-a.y)||1; const nx=-(b.y-a.y)/L, ny=(b.x-a.x)/L; c.off=(wx-(a.x+b.x)/2)*nx+(wy-(a.y+b.y)/2)*ny; }
      if(c.type==='dx'){ const a=skP(c.a), b=skP(c.b); c.off=wy-(a.y+b.y)/2; }
      if(c.type==='dy'){ const a=skP(c.a), b=skP(c.b); c.off=wx-(a.x+b.x)/2; }
      if(c.type==='diam'){ const p=skP(skC(c.c).c); c.ang=Math.atan2(wy-p.y,wx-p.x); c.off=Math.max(2/SK.view.s, Math.hypot(wx-p.x,wy-p.y)-skC(c.c).r); }
      skDraw(); return; }
  }
  // hover snapping preview
  if(['line','rect','circle','bezier'].includes(SK.tool)) snapW(sx,sy); else SK.snapPt=null;
  skDraw();
});
skCanvas.addEventListener('pointerup', ()=>{
  const dr=SK.drag; SK.drag=null;
  if(dr && dr.kind==='box'){ if(dr.moved) skBoxSelect(dr); else if(!dr.add){ SK.sel=null; SK.msel=[]; } skDraw(); return; }
  if(dr && dr.kind==='pen'){ if(dr.close) bzEndChain(); else { skCleanup(); skPush(); } skDraw(); return; }
  if(dr && dr.moved && dr.kind!=='pan'){ skSolve(); skPush(); }
  skDraw();
});
skCanvas.addEventListener('dblclick', ev=>{
  const [sx,sy]=skEvt(ev);
  const lb=hitLabel(sx,sy); if(lb){ showDimEdit(SK.d.cons.find(k=>k.id===lb.id)); return; }
  if(SK.tool==='line') finishChain();
  if(SK.tool==='bezier') bzEndChain();
});
skCanvas.addEventListener('wheel', ev=>{ ev.preventDefault(); const [sx,sy]=skEvt(ev); const [wx,wy]=toW(sx,sy); SK.view.s=clamp(SK.view.s*Math.exp(-ev.deltaY*0.0015),0.3,80); const [nx,ny]=toW(sx,sy); SK.view.cx+=wx-nx; SK.view.cy+=wy-ny; skDraw(); },{passive:false});

/* ---------- drawing */
function skDraw(){
  if($('#sk').hidden || !SK.d) return;
  const g=skCtx, d=SK.d, s=SK.view.s;
  bzRefresh(d);
  const col={bg:cssVar('--bg'),panel:cssVar('--panel'),line:cssVar('--line'),ink:cssVar('--ink'),ink2:cssVar('--ink-2'),acc:cssVar('--accent'),soft:cssVar('--accent-soft'),mark:cssVar('--mark'),danger:cssVar('--danger')};
  g.clearRect(0,0,skW,skH); g.fillStyle=col.bg; g.fillRect(0,0,skW,skH);
  // grid
  const gs=gridStep(); const major=gs<10?10:gs*5;
  const [x0,y1]=toW(0,0), [x1,y0]=toW(skW,skH);
  g.lineWidth=1;
  for(let pass=0;pass<2;pass++){
    const st= pass? major: gs; g.strokeStyle=col.line; g.globalAlpha= pass? .9 : .45; g.beginPath();
    for(let x=Math.ceil(x0/st)*st;x<=x1;x+=st){ const [X]=toS(x,0); g.moveTo(Math.round(X)+.5,0); g.lineTo(Math.round(X)+.5,skH); }
    for(let y=Math.ceil(y0/st)*st;y<=y1;y+=st){ const [,Y]=toS(0,y); g.moveTo(0,Math.round(Y)+.5); g.lineTo(skW,Math.round(Y)+.5); }
    g.stroke();
  }
  g.globalAlpha=1;
  const [ox,oy]=toS(0,0);
  const AX=axisColors(), PL=SKPLANES[SK.plane||'xy'], [an,bn]=PL.axes, ca=AX[an.toLowerCase()], cb=AX[bn.toLowerCase()];
  g.lineWidth=1.5; g.strokeStyle=ca; g.globalAlpha=.6; g.beginPath(); g.moveTo(0,oy); g.lineTo(skW,oy); g.stroke();
  g.strokeStyle=cb; g.beginPath(); g.moveTo(ox,0); g.lineTo(ox,skH); g.stroke(); g.globalAlpha=1;
  g.font='700 13px '+cssVar('--f-mono'); g.fillStyle=ca; g.textAlign='right'; g.fillText(an, skW-10, clamp(oy-6,16,skH-24)); g.textAlign='right'; g.fillStyle=cb; g.fillText(bn, clamp(ox-6,16,skW-4), 16); g.textAlign='left';
  if(SK.mode==='revolve'){ g.save(); g.setLineDash([10,5,2,5]); g.strokeStyle=col.mark; g.lineWidth=2.5; g.beginPath(); g.moveTo(ox,0); g.lineTo(ox,skH); g.stroke(); g.restore();
    g.fillStyle=col.mark; g.font='600 12px '+cssVar('--f-body'); g.fillText('axe de révolution', ox+6, 18); }
  // grid scale caption
  g.fillStyle=col.ink2; g.font='500 11px '+cssVar('--f-mono'); g.textAlign='right'; g.fillText(`carreau ${fmt(gs)} mm`, skW-10, skH-10); g.textAlign='left';
  // profiles
  const pr=skProfiles(d);
  if(pr.loops.length){ g.beginPath(); for(const L of pr.loops){ L.pts.forEach((q,i)=>{ const [X,Y]=toS(q[0],q[1]); i?g.lineTo(X,Y):g.moveTo(X,Y); }); g.closePath(); } g.fillStyle=col.acc; g.globalAlpha=.17; g.fill('evenodd'); g.globalAlpha=1; }
  // lines & circles
  const isSel=skIsSel;
  for(const l of d.lines){ const a=skP(l.a), b=skP(l.b); const [ax,ay]=toS(a.x,a.y), [bx,by]=toS(b.x,b.y);
    g.strokeStyle=isSel('line',l.id)? col.mark : col.ink; g.lineWidth=isSel('line',l.id)?3.5:2; g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx,by); g.stroke(); }
  const showHandles = SK.tool==='select' || SK.tool==='bezier';
  for(const z of d.beziers){ const c=bezScreen(z); const sel=isSel('bez',z.id);
    g.strokeStyle=sel? col.mark : col.ink; g.lineWidth=sel?3.5:2; g.beginPath(); g.moveTo(c[0][0],c[0][1]); g.bezierCurveTo(c[1][0],c[1][1],c[2][0],c[2][1],c[3][0],c[3][1]); g.stroke();
    if(showHandles){ g.save(); g.lineWidth=1.2;
      for(const [i,e,pid] of [[1,0,z.a],[2,3,z.b]]){ const E=skP(pid); if(!bzShowHandle(E) || Math.hypot(c[i][0]-c[e][0],c[i][1]-c[e][1])<6) continue;
        const cur= SK.sel?.type==='pt' && SK.sel.id===pid; const auto=bzType(E).it==='auto';
        g.strokeStyle= cur||sel? col.mark : col.acc; g.globalAlpha= cur||sel? 1 : auto? .35 : .6; g.setLineDash([4,3]);
        g.beginPath(); g.moveTo(c[e][0],c[e][1]); g.lineTo(c[i][0],c[i][1]); g.stroke(); g.setLineDash([]);
        g.fillStyle= cur? col.mark : col.panel; g.beginPath(); g.arc(c[i][0],c[i][1],4.5,0,Math.PI*2); g.fill(); g.stroke(); }
      g.restore(); } }
  for(const c of d.circles){ const p=skP(c.c); const [X,Y]=toS(p.x,p.y); g.strokeStyle=isSel('circle',c.id)?col.mark:col.ink; g.lineWidth=isSel('circle',c.id)?3.5:2; g.beginPath(); g.arc(X,Y,c.r*s,0,Math.PI*2); g.stroke(); }
  // previews
  g.save(); g.setLineDash([6,4]); g.strokeStyle=col.acc; g.lineWidth=1.8;
  const m=SK.mouse;
  if(m && SK.tool==='line' && SK.chain){ const last=skP(SK.chain.last); const s2=axisLock(last,m.sx,m.sy); const [ax,ay]=toS(last.x,last.y), [bx,by]=toS(s2.x,s2.y); g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx,by); g.stroke(); tag(`${fmt(Math.hypot(s2.x-last.x,s2.y-last.y),1)} mm${s2.lock?' · '+s2.lock.toUpperCase():''}`, bx+12, by-12); }
  if(m && SK.tool==='bezier' && SK.pend?.pen && !SK.drag){ const A=skP(SK.pend.last); if(A){ const s2=snapW(m.sx,m.sy);
    const out= SK.pend.out || (bzType(A).it==='bez'? bzMirror(A) : null) || [(s2.x-A.x)/3,(s2.y-A.y)/3];
    const c=[[A.x,A.y],[A.x+out[0],A.y+out[1]],[s2.x,s2.y],[s2.x,s2.y]].map(q=>toS(q[0],q[1]));
    g.beginPath(); g.moveTo(c[0][0],c[0][1]); g.bezierCurveTo(c[1][0],c[1][1],c[2][0],c[2][1],c[3][0],c[3][1]); g.stroke();
    const closing= s2.pt && s2.pt.id===SK.pend.first && SK.pend.first!==SK.pend.last;
    tag(closing? 'Cliquez pour fermer' : 'Clic : point anguleux · Glisser : courbe', m.sx+12, m.sy-12); } }
  if(m && SK.tool==='rect' && SK.pend){ const s2=snapW(m.sx,m.sy); const [ax,ay]=toS(SK.pend.x,SK.pend.y), [bx,by]=toS(s2.x,s2.y); g.strokeRect(Math.min(ax,bx),Math.min(ay,by),Math.abs(bx-ax),Math.abs(by-ay)); tag(`${fmt(Math.abs(s2.x-SK.pend.x),1)} × ${fmt(Math.abs(s2.y-SK.pend.y),1)} mm`, bx+12, by-12); }
  if(m && SK.tool==='circle' && SK.pend){ const s2=snapW(m.sx,m.sy); const [ax,ay]=toS(SK.pend.x,SK.pend.y); let r=Math.hypot(s2.x-SK.pend.x,s2.y-SK.pend.y); if($('#skSnap').checked){ const gg=snapStep()/2; r=Math.max(gg,Math.round(r/gg)*gg); } g.beginPath(); g.arc(ax,ay,r*s,0,Math.PI*2); g.stroke(); tag(`Ø ${fmt(2*r,1)} mm`, m.sx+12, m.sy-12); }
  g.restore();
  // dimensions
  SK.labels=[];
  for(const c of d.cons) if(['dist','dx','dy','diam'].includes(c.type)) drawDim(c,col);
  // constraint badges
  SK.badges=[];
  const pairNo=new Map(); let k=1; for(const c of d.cons) if(['par','perp','eq','eqr'].includes(c.type)) pairNo.set(c.id,k++);
  const perLine=new Map(); const push=(lid,b)=>{ if(!perLine.has(lid)) perLine.set(lid,[]); perLine.get(lid).push(b); };
  for(const c of d.cons){
    if(c.type==='h'||c.type==='v') push(c.l,{id:c.id,txt:c.type.toUpperCase()});
    if(c.type==='par'||c.type==='perp'||c.type==='eq'){ const t=(c.type==='par'?'∥':c.type==='perp'?'⊥':'=')+pairNo.get(c.id); push(c.l1,{id:c.id,txt:t}); push(c.l2,{id:c.id,txt:t}); }
  }
  g.font='600 11px '+cssVar('--f-mono'); g.textAlign='center'; g.textBaseline='middle';
  const nP=d.pts.length||1; const [gcx,gcy]=toS(d.pts.reduce((a,p)=>a+p.x,0)/nP, d.pts.reduce((a,p)=>a+p.y,0)/nP);
  for(const [lid,list] of perLine){ const l=skL(lid); if(!l) continue; const a=skP(l.a), b=skP(l.b); const [ax,ay]=toS(a.x,a.y), [bx,by]=toS(b.x,b.y);
    const L=Math.hypot(bx-ax,by-ay)||1; const ux=(bx-ax)/L, uy=(by-ay)/L; let nx=-uy, ny=ux; if(nx*(gcx-(ax+bx)/2)+ny*(gcy-(ay+by)/2)<0){ nx=-nx; ny=-ny; }
    list.forEach((bd,i)=>{ const off=(i-(list.length-1)/2)*20; const X=(ax+bx)/2+ux*off+nx*14, Y=(ay+by)/2+uy*off+ny*14;
      const sel=skIsSel('con',bd.id); g.fillStyle=sel?col.mark:col.panel; g.strokeStyle=sel?col.mark:col.acc; g.lineWidth=1.2;
      roundRect(g,X-9,Y-8,18+(bd.txt.length>1?6:0),16,4); g.fill(); g.stroke(); g.fillStyle=sel?'#000':col.acc; g.fillText(bd.txt, X+(bd.txt.length>1?3:0), Y+.5);
      SK.badges.push({id:bd.id,x:X,y:Y}); }); }
  for(const c of d.cons) if(c.type==='eqr'){ for(const cid of [c.c1,c.c2]){ const ci=skC(cid), p=skP(ci.c); const [X,Y]=toS(p.x+ci.r*0.71,p.y+ci.r*0.71); const t='='+pairNo.get(c.id); const sel=skIsSel('con',c.id); g.fillStyle=sel?col.mark:col.panel; g.strokeStyle=col.acc; roundRect(g,X-6,Y-8,24,16,4); g.fill(); g.stroke(); g.fillStyle=sel?'#000':col.acc; g.fillText(t,X+6,Y+.5); SK.badges.push({id:c.id,x:X+6,y:Y}); } }
  g.textAlign='left'; g.textBaseline='alphabetic';
  // points
  for(const p of d.pts){ const [X,Y]=toS(p.x,p.y); const sel=isSel('pt',p.id)||SK.pend?.pt===p.id||SK.pend?.a===p.id||(SK.pend?.pen&&SK.pend.last===p.id)||SK.chain?.last===p.id;
    if(p.origin){ g.strokeStyle=col.ink; g.lineWidth=1.5; g.beginPath(); g.arc(X,Y,6,0,Math.PI*2); g.moveTo(X-10,Y); g.lineTo(X+10,Y); g.moveTo(X,Y-10); g.lineTo(X,Y+10); g.stroke(); continue; }
    g.fillStyle= sel? col.mark : col.panel; g.strokeStyle= sel? col.mark : col.ink; g.lineWidth=1.5;
    if(bzSmooth(p)){ g.beginPath(); g.arc(X,Y,4.2,0,Math.PI*2); g.fill(); g.stroke(); } else { g.fillRect(X-3.5,Y-3.5,7,7); g.strokeRect(X-3.5,Y-3.5,7,7); }
    if(p.fixed){ g.strokeStyle=col.danger; g.lineWidth=1.5; g.beginPath(); g.moveTo(X,Y+5); g.lineTo(X-6,Y+13); g.lineTo(X+6,Y+13); g.closePath(); g.stroke(); for(let i=-6;i<=4;i+=4){ g.moveTo(X+i,Y+13); g.lineTo(X+i+3,Y+17); } g.stroke(); } }
  if(SK.snapPt!=null){ const p=skP(SK.snapPt); if(p){ const [X,Y]=toS(p.x,p.y); g.strokeStyle=col.mark; g.lineWidth=2; g.beginPath(); g.arc(X,Y,9,0,Math.PI*2); g.stroke(); } }
  // selection of the first element for 2-step tools
  if(SK.pend?.sel){ const e=SK.pend.sel; if(e.k==='line'){ const l=skL(e.id); const a=skP(l.a), b=skP(l.b); const [ax,ay]=toS(a.x,a.y),[bx,by]=toS(b.x,b.y); g.strokeStyle=col.mark; g.lineWidth=4; g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx,by); g.stroke(); } }
  if(SK.drag?.kind==='box' && SK.drag.moved){ const b=SK.drag; g.save(); g.setLineDash([5,4]); g.strokeStyle=col.acc; g.lineWidth=1.3; g.fillStyle=col.acc; g.globalAlpha=.1;
    g.fillRect(Math.min(b.sx,b.x1),Math.min(b.sy,b.y1),Math.abs(b.x1-b.sx),Math.abs(b.y1-b.sy)); g.globalAlpha=1; g.strokeRect(Math.min(b.sx,b.x1),Math.min(b.sy,b.y1),Math.abs(b.x1-b.sx),Math.abs(b.y1-b.sy)); g.restore(); }
  skStatus(pr); bzUpdateOpts();
  function tag(txt,x,y){ g.save(); g.setLineDash([]); g.font='500 12px '+cssVar('--f-mono'); const w=g.measureText(txt).width+10; g.fillStyle=col.panel; g.strokeStyle=col.line; roundRect(g,x,y-10,w,20,5); g.fill(); g.stroke(); g.fillStyle=col.ink; g.fillText(txt,x+5,y+4); g.restore(); }
}
function roundRect(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function arrow(g,x,y,ux,uy){ g.beginPath(); g.moveTo(x,y); g.lineTo(x-ux*9-uy*3.5, y-uy*9+ux*3.5); g.lineTo(x-ux*9+uy*3.5, y-uy*9-ux*3.5); g.closePath(); g.fill(); }
function drawDim(c,col){
  const g=skCtx; const sel=skIsSel('con',c.id); const color= sel? col.mark : col.acc;
  g.strokeStyle=color; g.fillStyle=color; g.lineWidth=1.2;
  let A,B,lx,ly,txt=fmt(c.value);
  if(c.type==='diam'){
    const ci=skC(c.c), p=skP(ci.c); const ux=Math.cos(c.ang), uy=Math.sin(c.ang);
    const [p1x,p1y]=toS(p.x-ux*ci.r,p.y-uy*ci.r), [p2x,p2y]=toS(p.x+ux*ci.r,p.y+uy*ci.r), [lx0,ly0]=toS(p.x+ux*(ci.r+c.off),p.y+uy*(ci.r+c.off));
    g.beginPath(); g.moveTo(p1x,p1y); g.lineTo(lx0,ly0); g.stroke();
    const L=Math.hypot(p2x-p1x,p2y-p1y)||1; const sx=(p2x-p1x)/L, sy=(p2y-p1y)/L; arrow(g,p2x,p2y,sx,sy); arrow(g,p1x,p1y,-sx,-sy);
    lx=lx0; ly=ly0; txt='Ø '+txt;
  } else {
    const a=skP(c.a), b=skP(c.b);
    if(c.type==='dist'){ const L=Math.hypot(b.x-a.x,b.y-a.y)||1; const nx=-(b.y-a.y)/L, ny=(b.x-a.x)/L; A=[a.x+nx*c.off,a.y+ny*c.off]; B=[b.x+nx*c.off,b.y+ny*c.off]; }
    if(c.type==='dx'){ const yl=(a.y+b.y)/2+c.off; A=[a.x,yl]; B=[b.x,yl]; }
    if(c.type==='dy'){ const xl=(a.x+b.x)/2+c.off; A=[xl,a.y]; B=[xl,b.y]; }
    const [as,ay]=toS(a.x,a.y), [bs,by]=toS(b.x,b.y), [As,Ay]=toS(...A), [Bs,By]=toS(...B);
    g.globalAlpha=.7; g.beginPath(); g.moveTo(as,ay); g.lineTo(As,Ay); g.moveTo(bs,by); g.lineTo(Bs,By); g.stroke(); g.globalAlpha=1;
    const L=Math.hypot(Bs-As,By-Ay); if(L>1){ const ux=(Bs-As)/L, uy=(By-Ay)/L; g.beginPath(); g.moveTo(As,Ay); g.lineTo(Bs,By); g.stroke(); if(L>22){ arrow(g,Bs,By,ux,uy); arrow(g,As,Ay,-ux,-uy); } }
    lx=(As+Bs)/2; ly=(Ay+By)/2;
  }
  g.font='600 12.5px '+cssVar('--f-mono'); const w=g.measureText(txt).width+12, hh=20;
  if(SK.editing!==c.id){ g.fillStyle= sel? col.mark : col.panel; g.strokeStyle=color; roundRect(g,lx-w/2,ly-hh/2,w,hh,5); g.fill(); g.stroke(); g.fillStyle= sel? '#111' : col.ink; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,lx,ly+.5); g.textAlign='left'; g.textBaseline='alphabetic'; }
  SK.labels.push({id:c.id,x:lx,y:ly,w,h:hh});
}
function skStatus(pr){
  const el=$('#skStatus'); const nC=pr.loops.length, nO=pr.open; const dof=Math.max(0,skDOF());
  let cls='ok', html='';
  if(SK.err>1e-3){ cls='err'; html='<b>Contraintes incompatibles.</b> Annulez la dernière action (Ctrl+Z) ou supprimez une contrainte.'; }
  else if(!nC){ cls='warn'; html= nO? `<b>Contour ouvert.</b> Revenez sur le premier point pour le fermer, ou utilisez l’outil ⦿ pour réunir deux extrémités.` : 'Tracez un contour fermé : rectangle, cercle, suite de lignes ou de courbes.'; }
  else { html=`<b>${nC} contour${nC>1?'s':''} fermé${nC>1?'s':''}</b>${nO?` · ${nO} tracé${nO>1?'s':''} ouvert${nO>1?'s':''} ignoré${nO>1?'s':''}`:''}.`; }
  const nb=SK.d.beziers.length; if(nb) html+=`<br>Courbes de Bézier : <b>${nb}</b> (forme réglée par les poignées)`;
  html+= `<br>Contraintes et cotes : <b>${SK.d.cons.length}</b><br>Degrés de liberté restants ≈ <b>${dof}</b>${dof===0&&SK.err<=1e-3&&nC?' · esquisse totalement contrainte':''}`;
  if(SK.mode==='revolve' && SK.d.pts.some(p=>p.x<-1e-3) && cls!=='err'){ cls='warn'; html+='<br><b>Révolution :</b> la partie à gauche de l’axe sera ignorée.'; }
  el.className='status '+cls; el.innerHTML=html; $('#skOk').disabled=!nC;
}

/* ---------- Bézier points: interpolation and tangents
   Each point of a curve has an interpolation p.it — 'lin' (anguleux : poignée vers le voisin, à 1/3),
   'auto' (lisse automatique, d'après les deux voisins) or 'bez' (poignées réglées à la main) — and, for 'bez',
   a tangent mode p.tm : 'sym' (alignées, même longueur), 'align' (alignées, longueurs libres) or 'free' (cassées).
   Handles are stored on the curves: t1 = handle at a (outgoing), t2 = handle at b (incoming).
   Older sketches have neither field: they behave as 'bez' / 'free'. */
const bzType=p=>({it:p?.it||'bez', tm:p?.tm||'free'});
const bzRefs=(d,pid)=>{ const out=[]; for(const z of d.beziers||[]){ if(z.a===pid) out.push({z,key:'t1',other:z.b}); if(z.b===pid) out.push({z,key:'t2',other:z.a}); } return out; };
const bzOnCurve=pid=> (SK.d.beziers||[]).some(z=>z.a===pid||z.b===pid);
const bzShowHandle=p=> !!p && bzType(p).it!=='lin';
const bzSmooth=p=>{ if(!p || !bzOnCurve(p.id)) return false; const T=bzType(p); return T.it==='auto' || (T.it==='bez' && T.tm!=='free'); };
const vlen=v=>Math.hypot(v[0],v[1]);
const r4=v=>[+v[0].toFixed(4), +v[1].toFixed(4)];
function bzRefresh(d){
  if(!d.beziers?.length) return;
  const P=new Map(d.pts.map(p=>[p.id,p]));
  for(const p of d.pts){
    const it=p.it; if(it!=='lin' && it!=='auto') continue;
    const refs=bzRefs(d,p.id); if(!refs.length) continue;
    const nb=[...refs.map(r=>({q:P.get(r.other), r})), ...d.lines.filter(l=>l.a===p.id||l.b===p.id).map(l=>({q:P.get(l.a===p.id?l.b:l.a), line:true}))].filter(n=>n.q);
    const toward=n=>[(n.q.x-p.x)/3, (n.q.y-p.y)/3];
    let done=false;
    if(it==='auto' && nb.length===2){ const [n1,n2]=nb; let dir=null;
      if(n1.line && n2.line) dir=null;
      else if(n1.line||n2.line){ const L=n1.line?n1:n2; const v=[p.x-L.q.x, p.y-L.q.y], n=vlen(v); if(n>1e-9) dir=[v[0]/n, v[1]/n];   // continue the straight line smoothly
        const B=n1.line?n2:n1; if(dir){ const k=vlen([B.q.x-p.x,B.q.y-p.y])/3; B.r.z[B.r.key]=r4([dir[0]*k, dir[1]*k]); done=true; } }
      else { const v=[n2.q.x-n1.q.x, n2.q.y-n1.q.y], n=vlen(v); if(n>1e-9){ dir=[v[0]/n, v[1]/n];
          const k1=vlen([n1.q.x-p.x,n1.q.y-p.y])/3, k2=vlen([n2.q.x-p.x,n2.q.y-p.y])/3;
          n1.r.z[n1.r.key]=r4([-dir[0]*k1, -dir[1]*k1]); n2.r.z[n2.r.key]=r4([dir[0]*k2, dir[1]*k2]); done=true; } } }
    if(!done) for(const n of nb) if(n.r) n.r.z[n.r.key]=r4(toward(n));
  }
}
/* outgoing tangent continuing the incoming one (pen tool: the next curve starts smoothly) */
function bzMirror(p){ const T=bzType(p); if(T.it!=='bez' || T.tm==='free') return null; const i=bzRefs(SK.d,p.id).find(r=>r.key==='t2'); if(!i) return null; const h=i.z.t2; return vlen(h)>1e-9? [-h[0],-h[1]] : null; }
/* a handle dragged with the Selection tool; the other handle of the point follows its tangent mode (Alt: break) */
function bzDragHandle(E, z, key, v, alt){
  const T=bzType(E); if(T.it!=='bez'){ E.tm= T.it==='auto'? 'align' : 'free'; E.it='bez'; }
  if(alt) E.tm='free';
  z[key]=r4(v);
  const opp=bzRefs(SK.d,E.id).filter(r=>!(r.z===z && r.key===key)); if(opp.length!==1) return;
  const o=opp[0], n=vlen(v); if(n<1e-9) return; const tm=bzType(E).tm;
  if(tm==='sym') o.z[o.key]=r4([-v[0],-v[1]]);
  else if(tm==='align'){ const L=vlen(o.z[o.key])||n; o.z[o.key]=r4([-v[0]/n*L, -v[1]/n*L]); }
}
/* pen tool: dragging from the point just placed pulls its tangent (symmetric; Alt: only the outgoing handle) */
function bzPenPull(E, v, alt, dr){
  dr.moved=true; E.it='bez'; E.tm= alt? 'free' : 'sym';
  const refs=bzRefs(SK.d,E.id), outs=refs.filter(r=>r.key==='t1'), ins=refs.filter(r=>r.key==='t2');
  for(const r of outs) r.z.t1=r4(v);
  if(!alt) for(const r of ins) r.z.t2=r4([-v[0],-v[1]]);
  if(SK.pend?.pen && SK.pend.last===E.id && !outs.length) SK.pend.out=r4(v);
}
function bzEndChain(){ SK.pend=null; skCleanup(); skPush(); skDraw(); }
/* the point the option buttons act on: the point being drawn, or the selected point of a curve */
function bzTarget(){
  if(SK.tool==='bezier' && SK.pend?.pen) return SK.pend.last;
  if(SK.sel?.type==='pt' && bzOnCurve(SK.sel.id)) return SK.sel.id;
  return null;
}
function bzSetInterp(pid, it){
  const E=skP(pid); if(!E) return; const prev=bzType(E).it;
  if(it==='bez'){ if(prev==='lin'){ E.it='auto'; bzRefresh(SK.d); } if(prev!=='bez'){ E.it='bez'; E.tm='align'; } }
  else { E.it=it; if(SK.pend?.pen && SK.pend.last===pid) SK.pend.out=null; }
  bzRefresh(SK.d); skPush(); skDraw();
}
function bzSetType(pid, tm){
  const E=skP(pid); if(!E) return; const d=SK.d;
  if(bzType(E).it==='lin'){ E.it='auto'; bzRefresh(d); }
  E.it='bez'; E.tm=tm;
  const refs=bzRefs(d,pid);
  if(tm!=='free' && refs.length===2){
    const [r1,r2]=refs, h1=r1.z[r1.key], h2=r2.z[r2.key], O1=skP(r1.other), O2=skP(r2.other);
    let v=[h1[0]-h2[0], h1[1]-h2[1]]; if(vlen(v)<1e-9) v=[O1.x-O2.x, O1.y-O2.y]; const n=vlen(v);
    if(n>1e-9){ const u=[v[0]/n, v[1]/n];
      let L1=vlen(h1)||vlen([O1.x-E.x,O1.y-E.y])/3, L2=vlen(h2)||vlen([O2.x-E.x,O2.y-E.y])/3;
      if(tm==='sym'){ L1=L2=(L1+L2)/2; }
      r1.z[r1.key]=r4([u[0]*L1, u[1]*L1]); r2.z[r2.key]=r4([-u[0]*L2, -u[1]*L2]); } }
  if(tm!=='free' && refs.length===1 && SK.pend?.pen && SK.pend.last===pid && SK.pend.out==null){ const h=refs[0].z[refs[0].key]; if(refs[0].key==='t2' && vlen(h)>1e-9) SK.pend.out=r4([-h[0],-h[1]]); }
  skPush(); skDraw();
}
function bzUpdateOpts(){
  const bar=$('#bzOpts'); if(!bar) return; const id=bzTarget(); const E= id!=null? skP(id) : null;
  bar.hidden=!E; if(!E) return;
  const T=bzType(E);
  $('#bzTitle').textContent= SK.tool==='bezier' && SK.pend?.pen ? 'Point en cours' : 'Point de la courbe';
  $$('#bzOpts [data-it]').forEach(b=>{ const on=b.dataset.it===T.it; b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on)); });
  $$('#bzOpts [data-tm]').forEach(b=>{ const on=T.it==='bez' && b.dataset.tm===T.tm; b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on)); });
}
$$('#bzOpts [data-it]').forEach(b=>b.addEventListener('click',()=>{ const id=bzTarget(); if(id!=null) bzSetInterp(id, b.dataset.it); }));
$$('#bzOpts [data-tm]').forEach(b=>b.addEventListener('click',()=>{ const id=bzTarget(); if(id!=null) bzSetType(id, b.dataset.tm); }));

/* ---------- selection: one element (SK.sel) or several (SK.msel, box or Maj + clic), filtered by SK.filt */
function skSelList(){ return SK.msel.length? SK.msel.slice() : SK.sel? [SK.sel] : []; }
function skIsSel(type,id){ if(SK.sel && SK.sel.type===type && SK.sel.id===id) return true; return SK.msel.some(e=>e.type===type&&e.id===id); }
function skSelPoints(){ const ids=new Set(); for(const e of skSelList()){
    if(e.type==='pt') ids.add(e.id);
    if(e.type==='line'){ const l=skL(e.id); if(l){ ids.add(l.a); ids.add(l.b); } }
    if(e.type==='bez'){ const z=skB(e.id); if(z){ ids.add(z.a); ids.add(z.b); } }
    if(e.type==='circle'){ const c=skC(e.id); if(c) ids.add(c.c); } }
  return [...ids].map(skP).filter(Boolean); }
function skBoxSelect(b){
  const x0=Math.min(b.sx,b.x1), x1=Math.max(b.sx,b.x1), y0=Math.min(b.sy,b.y1), y1=Math.max(b.sy,b.y1);
  const inR=(x,y)=> x>=x0&&x<=x1&&y>=y0&&y<=y1, inW=p=>{ const [x,y]=toS(p.x,p.y); return inR(x,y); };
  const d=SK.d, F=SK.filt, out=[];
  if(F.pt) for(const p of d.pts) if(!p.origin && inW(p)) out.push({type:'pt',id:p.id});
  if(F.edge){
    for(const l of d.lines) if(inW(skP(l.a)) && inW(skP(l.b))) out.push({type:'line',id:l.id});
    for(const z of d.beziers) if(bezScreen(z).every(q=>inR(q[0],q[1])) || (inW(skP(z.a)) && inW(skP(z.b)))) out.push({type:'bez',id:z.id});
    for(const c of d.circles){ const p=skP(c.c), [x,y]=toS(p.x,p.y), r=c.r*SK.view.s; if(inR(x-r,y-r) && inR(x+r,y+r)) out.push({type:'circle',id:c.id}); } }
  if(F.con){ const ids=new Set(); for(const L of [...SK.labels, ...SK.badges]) if(inR(L.x,L.y)) ids.add(L.id); for(const id of ids) out.push({type:'con',id}); }
  let L= b.add? skSelList() : []; for(const e of out) if(!L.some(k=>k.type===e.type&&k.id===e.id)) L.push(e);
  SK.msel=L; SK.sel= L.length===1? L[0] : null;
  if(L.length>1) $('#skHint').innerHTML=`<b>${L.length} éléments</b> sélectionnés : <b>Suppr</b> pour les effacer, glissez l’un d’eux pour tout déplacer.`;
}
function skSetFilter(k){ SK.filt[k]=!SK.filt[k]; if(!SK.filt.pt && !SK.filt.edge && !SK.filt.con) SK.filt[k]=true;
  $$('#skFilt [data-f]').forEach(b=>{ const on=!!SK.filt[b.dataset.f]; b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on)); });
  SK.msel=SK.msel.filter(e=> e.type==='pt'? SK.filt.pt : e.type==='con'? SK.filt.con : SK.filt.edge); if(SK.sel && !SK.msel.length && !(SK.sel.type==='pt'? SK.filt.pt : SK.sel.type==='con'? SK.filt.con : SK.filt.edge)) SK.sel=null; skDraw(); }
$$('#skFilt [data-f]').forEach(b=>b.addEventListener('click',()=>skSetFilter(b.dataset.f)));
/* Espace maintenu : le clic gauche décale la vue */
function skSpace(on){ if(SK.space===on) return; SK.space=on; skCanvas.style.cursor= on? 'grab' : (SK.tool==='select'?'default':'crosshair'); }
