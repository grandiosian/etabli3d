/* =========================================================
   Tôle pliée : une ligne médiane OUVERTE tracée dans l'esquisse (suite de segments droits),
   épaisseur t, largeur W, rayon de pli intérieur r. Chaque sommet de la ligne est un pli.
   params = {t, W, r, sk, plane?} (sk : même format que les esquisses).
   La section = la ligne médiane décalée de +t/2 et −t/2, avec des arcs aux plis
   (rayon intérieur r, extérieur r + t) ; elle est extrudée sur W selon Z local (base à z = 0).
   ========================================================= */
const TOLE_MAX_ANGLE=175;   // au-delà, le pli replierait la tôle sur elle-même
/* rayon réellement utilisé : au moins l'épaisseur (règle d'atelier pour ne pas fissurer le pli) */
const toleRadius=p=> Math.max(+p.r||0, P(p.t,0.1));
/* la ligne médiane, dans l'ordre : [[x,y],…] ou {err} */
function toleChain(sk){
  if(!sk) return {err:'Pas de ligne médiane : ouvrez l’esquisse et tracez une ligne.'};
  if((sk.beziers||[]).length || (sk.circles||[]).length) return {err:'Une tôle se trace avec des lignes droites seulement : retirez les courbes et les cercles.'};
  const lines=sk.lines||[]; if(!lines.length) return {err:'Tracez une ligne ouverte (au moins un segment).'};
  const P_=new Map(sk.pts.map(q=>[q.id,q])), adj=new Map();
  for(const l of lines){ if(!P_.has(l.a)||!P_.has(l.b)) return {err:'Esquisse abîmée : un segment n’a pas ses deux points.'};
    for(const [u,v] of [[l.a,l.b],[l.b,l.a]]){ if(!adj.has(u)) adj.set(u,[]); adj.get(u).push(v); } }
  if([...adj.values()].some(n=>n.length>2)) return {err:'La ligne a une branche : une tôle est une seule suite de segments, sans fourche.'};
  const ends=[...adj.keys()].filter(k=>adj.get(k).length===1);
  if(ends.length!==2) return {err: ends.length? 'La ligne doit être en un seul morceau.' : 'La ligne est fermée : une tôle a deux bouts libres. Retirez un segment.'};
  const ids=[ends[0]]; let prev=null, cur=ends[0];
  while(ids.length<=lines.length){ const nx=adj.get(cur).find(v=>v!==prev); if(nx==null) break; ids.push(nx); prev=cur; cur=nx; }
  if(ids.length!==lines.length+1) return {err:'La ligne doit être en un seul morceau.'};
  const pts=ids.map(id=>[P_.get(id).x, P_.get(id).y]);
  // points confondus et sommets alignés : pas de pli
  const out=[pts[0]];
  for(let i=1;i<pts.length;i++){ const q=pts[i], l=out[out.length-1]; if(Math.hypot(q[0]-l[0],q[1]-l[1])<1e-6) continue;
    if(out.length>=2){ const a=out[out.length-2]; const cr=(l[0]-a[0])*(q[1]-l[1])-(l[1]-a[1])*(q[0]-l[0]), dt=(l[0]-a[0])*(q[0]-l[0])+(l[1]-a[1])*(q[1]-l[1]);
      if(Math.abs(Math.atan2(cr,dt))<0.1*DEG){ out[out.length-1]=q; continue; } }
    out.push(q); }
  if(out.length<2) return {err:'La ligne est trop courte.'};
  return {pts:out};
}
function segDist(a,b,c,d){ // distance entre deux segments 2D
  if(segCross(a,b,c,d)) return 0;
  const pd=(p,u,v)=>{ const vx=v[0]-u[0], vy=v[1]-u[1], L2=vx*vx+vy*vy||1e-12; const k=clamp(((p[0]-u[0])*vx+(p[1]-u[1])*vy)/L2,0,1); return Math.hypot(u[0]+vx*k-p[0], u[1]+vy*k-p[1]); };
  return Math.min(pd(a,c,d),pd(b,c,d),pd(c,a,b),pd(d,a,b));
}
/* contrôle complet + section : {ok, err?, warn?, pts (section fermée, sens trigo), chain, bends, flat} */
const toleCache=new Map();
function toleCheck(p){
  const key=JSON.stringify([p.t,p.W,p.r,p.sk]); if(toleCache.has(key)) return toleCache.get(key);
  const res=toleCompute(p); toleCache.set(key,res); if(toleCache.size>60) toleCache.delete(toleCache.keys().next().value); return res;
}
function toleCompute(p){
  const t=P(p.t,0.1), r=toleRadius(p), R=r+t/2;
  const warn= (+p.r||0)<t-1e-9 ? `Rayon trop petit pour cette épaisseur : les plis sont calculés avec r = ${fmt(r)} mm (au moins l’épaisseur).` : null;
  const ch=toleChain(p.sk); if(ch.err) return {ok:false, err:ch.err};
  const pts=ch.pts, n=pts.length-1;
  const dir=i=>{ const a=pts[i], b=pts[i+1], L=Math.hypot(b[0]-a[0],b[1]-a[1]); return [(b[0]-a[0])/L,(b[1]-a[1])/L,L]; };
  const D=[]; for(let i=0;i<n;i++) D.push(dir(i));
  // la ligne ne doit pas se recouper (segments non voisins)
  for(let i=0;i<n;i++) for(let j=i+2;j<n;j++){ const dd=segDist(pts[i],pts[i+1],pts[j],pts[j+1]);
    if(dd<1e-6) return {ok:false, err:`La ligne se recoupe (segments ${i+1} et ${j+1}) : une tôle ne peut pas se traverser.`};
    if(dd<t) return {ok:false, err:`Les segments ${i+1} et ${j+1} sont trop proches : écartez-les d’au moins l’épaisseur (${fmt(t)} mm).`}; }
  // plis : angle signé, retrait le long de chaque segment
  const bends=[null]; const setback=[0];
  for(let i=1;i<n;i++){ const a=D[i-1], b=D[i]; const th=Math.atan2(a[0]*b[1]-a[1]*b[0], a[0]*b[0]+a[1]*b[1]);
    if(Math.abs(th)>TOLE_MAX_ANGLE*DEG) return {ok:false, err:`Pli ${i} trop fermé (plus de ${TOLE_MAX_ANGLE}°) : la tôle se replierait sur elle-même.`};
    bends.push(th); setback.push(R*Math.tan(Math.abs(th)/2)); }
  setback.push(0);
  for(let i=0;i<n;i++){ const L=D[i][2], need=Math.max(r+t, setback[i]+setback[i+1]);
    if(L<need-1e-6) return {ok:false, err:`Segment ${i+1} trop court (${fmt(L)} mm) : il faut au moins ${fmt(Math.ceil(need*10)/10,1)} mm avec cette épaisseur et ce rayon.`}; }
  // côtés gauche (+t/2) et droit (−t/2), arcs concentriques aux plis
  const left=[], right=[]; let flat=0;
  const nrm=d=>[-d[1],d[0]];
  for(let i=0;i<n;i++){
    const d=D[i], N=nrm(d), a=pts[i], b=pts[i+1];
    const s=[a[0]+d[0]*setback[i], a[1]+d[1]*setback[i]], e=[b[0]-d[0]*setback[i+1], b[1]-d[1]*setback[i+1]];
    flat+=Math.hypot(e[0]-s[0],e[1]-s[1]);
    for(const [side,o] of [[left,t/2],[right,-t/2]]){ side.push([s[0]+N[0]*o, s[1]+N[1]*o]); side.push([e[0]+N[0]*o, e[1]+N[1]*o]); }
    if(i<n-1){ const th=bends[i+1], sg=Math.sign(th), C=[e[0]+N[0]*R*sg, e[1]+N[1]*R*sg];
      flat+=R*Math.abs(th);
      const steps=Math.max(2, Math.ceil(Math.abs(th)/(Math.PI/2)*12));
      for(const [side,o] of [[left,t/2],[right,-t/2]]){ const st=[e[0]+N[0]*o-C[0], e[1]+N[1]*o-C[1]];
        for(let k=1;k<steps;k++){ const f=th*k/steps, c=Math.cos(f), si=Math.sin(f); side.push([C[0]+st[0]*c-st[1]*si, C[1]+st[0]*si+st[1]*c]); } } }
  }
  const poly=[]; for(const q of [...left, ...right.reverse()]){ const l=poly[poly.length-1]; if(!l || Math.hypot(q[0]-l[0],q[1]-l[1])>1e-7) poly.push(q); }
  if(Math.hypot(poly[0][0]-poly.at(-1)[0], poly[0][1]-poly.at(-1)[1])<1e-7) poly.pop();
  // la section ne doit jamais se croiser (deux parties trop proches)
  const m=poly.length;
  for(let i=0;i<m;i++) for(let j=i+2;j<m;j++){ if(i===0 && j===m-1) continue;
    if(segCross(poly[i],poly[(i+1)%m],poly[j],poly[(j+1)%m])) return {ok:false, err:'Deux parties de la tôle se touchent : écartez-les d’au moins l’épaisseur.'}; }
  let A=0; for(let i=0;i<m;i++){ const a=poly[i], b=poly[(i+1)%m]; A+=a[0]*b[1]-b[0]*a[1]; }
  return {ok:true, warn, pts: A<0? poly.reverse() : poly, chain:pts, bends:n-1, flat};
}
function toleGeometry(p){
  const c=toleCheck(p); if(!c.ok) return null;
  const sh=new THREE.Shape(c.pts.map(q=>new THREE.Vector2(q[0],q[1])));
  return new THREE.ExtrudeGeometry(sh,{depth:P(p.W,0.1),bevelEnabled:false,curveSegments:1});
}
