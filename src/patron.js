/* =========================================================
   Patron (papercraft) — atelier Valider.
   1. Maillage de la pièce (getGeometry, géométrie finale du groupe) soudé ; refusé s'il n'est pas fermé.
   2. Les triangles d'un même plan forment une face (pas de pli à l'intérieur d'une face).
   3. Dépliage glouton : on part de la plus grande face et on ajoute une face voisine par l'arête commune
      (de préférence les plus longues : les petites arêtes deviennent les coupures). Une face qui
      chevaucherait le morceau ou le rendrait trop grand n'est pas ajoutée : l'arête devient une coupure.
      Les arêtes non pliées forment l'arbre de coupe, qui rejoint tous les sommets « en pointe ».
   4. Mode manuel : l'élève clique une arête dans la vue 3D pour la couper ou la recoller (PAT.forced).
   5. Mise en page : languettes sur les coutures, plis vallée / montagne, numéros, pages A4 en SVG
      à l'échelle réelle (1 unité = 1 mm).
   Les réglages et le résultat restent ici (pas dans params : le patron ne change pas la pièce).
   ========================================================= */
const PAT={pid:null, key:null, mode:'auto', maxSize:180, tab:8, scale:100, forced:{}, res:null, fn:null};
const A4={w:210, h:297, m:10, head:16};
const patGroup=new THREE.Group(); patGroup.renderOrder=14; patGroup.matrixAutoUpdate=false; patGroup.visible=false; scene.add(patGroup);

/* patron produit (et à jour) pour la pièce choisie : utilisé par le tuto (appelé deux fois par seconde) */
function patronGenerated(){
  if(!PAT.res?.ok || ws!=='check' || selection.length!==1 || selection[0]!==PAT.pid) return false;
  const p=findPart(PAT.pid); return !!p && PAT.key===vKey(p);
}

/* nouveau projet (exemple, tuto, fichier ouvert) : l'ancien patron ne vaut plus, même si une pièce reprend le même numéro */
function patReset(){ PAT.res=null; PAT.pid=null; PAT.key=null; PAT.forced={}; patManual(false); patSeams(); }

/* ---- maillage : sommets soudés (deux sommets à moins de 10 µm n'en font qu'un), triangles orientés vers l'extérieur */
const PAT_EPS=0.01;
function patMesh(g){
  const p=g.attributes.position, idx=g.index, n=idx?idx.count:p.count, map=new Map(), V=[];
  const vid=i=>{ const x=p.getX(i), y=p.getY(i), z=p.getZ(i); const gx=Math.floor(x/PAT_EPS), gy=Math.floor(y/PAT_EPS), gz=Math.floor(z/PAT_EPS);
    for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++) for(let c=-1;c<=1;c++){ const l=map.get((gx+a)+','+(gy+b)+','+(gz+c)); if(l) for(const v of l){ const q=V[v]; if((q.x-x)**2+(q.y-y)**2+(q.z-z)**2<PAT_EPS*PAT_EPS) return v; } }
    const v=V.length, k=gx+','+gy+','+gz; V.push(new THREE.Vector3(x,y,z)); if(!map.has(k)) map.set(k,[]); map.get(k).push(v); return v; };
  const T=[]; for(let t=0;t<n;t+=3){ const tr=patTri(V, vid(idx?idx.getX(t):t), vid(idx?idx.getX(t+1):t+1), vid(idx?idx.getX(t+2):t+2)); if(tr) T.push(tr); }
  return {V, T:patFixT(V,T)};
}
/* triangle (sommets a, b, c) ; null s’il est aplati (hauteur < 0,1 µm) */
function patTri(V,a,b,c){
  if(a===b||b===c||a===c) return null;
  const nn=new THREE.Vector3().subVectors(V[b],V[a]).cross(new THREE.Vector3().subVectors(V[c],V[a])); const ar=nn.length()/2;
  const L=Math.max(V[a].distanceTo(V[b]), V[b].distanceTo(V[c]), V[c].distanceTo(V[a]));
  if(ar<1e-9 || 2*ar/L<1e-4) return null;
  return {v:[a,b,c], n:nn.normalize(), area:ar};
}
/* Jonctions en T (sortie du CSG) : un sommet posé au milieu de l'arête d'un triangle voisin.
   On recoupe ce triangle en éventail par ces sommets, jusqu'à ce que chaque arête ait sa voisine. */
function patFixT(V,T){
  for(let pass=0; pass<6; pass++){
    const cnt=new Map(); for(const t of T) for(let i=0;i<3;i++){ const k=pk(t.v[i],t.v[(i+1)%3]); cnt.set(k,(cnt.get(k)||0)+1); }
    const ends=new Set(); for(const t of T) for(let i=0;i<3;i++){ const a=t.v[i], b=t.v[(i+1)%3]; if(cnt.get(pk(a,b))===1){ ends.add(a); ends.add(b); } }
    if(!ends.size) break;
    const cand=[...ends]; let changed=false; const out=[]; const d=new THREE.Vector3(), w=new THREE.Vector3();
    for(const t of T){
      let done=false;
      for(let i=0;i<3 && !done;i++){ const a=t.v[i], b=t.v[(i+1)%3], c=t.v[(i+2)%3]; if(cnt.get(pk(a,b))!==1) continue;
        d.subVectors(V[b],V[a]); const L2=d.lengthSq(); if(L2<1e-12) continue;
        const on=[]; for(const v of cand){ if(v===a||v===b||v===c) continue; w.subVectors(V[v],V[a]); const s=w.dot(d)/L2; if(s<=1e-6||s>=1-1e-6) continue;
          if(w.addScaledVector(d,-s).lengthSq()<PAT_EPS*PAT_EPS) on.push([s,v]); }
        if(!on.length) continue;
        on.sort((x,y)=>x[0]-y[0]); const chain=[a, ...on.map(q=>q[1]), b];
        for(let j=0;j<chain.length-1;j++){ const tr=patTri(V, chain[j], chain[j+1], c); if(tr) out.push(tr); }
        done=true; changed=true; }
      if(!done) out.push(t);
    }
    T=out; if(!changed) break;
  }
  return T;
}
const pk=(a,b)=> a<b? a*4194304+b : b*4194304+a;   // clé d'arête (moins de 4 millions de sommets)
function patEdgeName(V,a,b){ const s=v=>[v.x,v.y,v.z].map(c=>Math.round(c*100)).join(','); const A=s(V[a]), B=s(V[b]); return A<B? A+'|'+B : B+'|'+A; }

/* ---- géométrie 2D */
function triHit(P,Q,tol){ // deux triangles 2D se chevauchent-ils (intérieurs) ? séparation par les normales des arêtes
  for(const S of [P,Q]) for(let i=0;i<3;i++){ const a=S[i], b=S[(i+1)%3]; const nx=a[1]-b[1], ny=b[0]-a[0], L=Math.hypot(nx,ny)||1;
    let p0=Infinity,p1=-Infinity,q0=Infinity,q1=-Infinity;
    for(const v of P){ const d=(v[0]*nx+v[1]*ny)/L; p0=Math.min(p0,d); p1=Math.max(p1,d); }
    for(const v of Q){ const d=(v[0]*nx+v[1]*ny)/L; q0=Math.min(q0,d); q1=Math.max(q1,d); }
    if(p1<=q0+tol || q1<=p0+tol) return false; }
  return true;
}
function polyHit(A,B,tol){ // polygones convexes quelconques (languettes)
  for(const S of [A,B]) for(let i=0;i<S.length;i++){ const a=S[i], b=S[(i+1)%S.length]; const nx=a[1]-b[1], ny=b[0]-a[0], L=Math.hypot(nx,ny); if(L<1e-9) continue;
    let p0=Infinity,p1=-Infinity,q0=Infinity,q1=-Infinity;
    for(const v of A){ const d=(v[0]*nx+v[1]*ny)/L; p0=Math.min(p0,d); p1=Math.max(p1,d); }
    for(const v of B){ const d=(v[0]*nx+v[1]*ny)/L; q0=Math.min(q0,d); q1=Math.max(q1,d); }
    if(p1<=q0+tol || q1<=p0+tol) return false; }
  return true;
}
function hull2(pts){ const P=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]); if(P.length<3) return P;
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]); const lo=[], up=[];
  for(const p of P){ while(lo.length>=2 && cr(lo[lo.length-2],lo[lo.length-1],p)<=0) lo.pop(); lo.push(p); }
  for(const p of P.slice().reverse()){ while(up.length>=2 && cr(up[up.length-2],up[up.length-1],p)<=0) up.pop(); up.push(p); }
  return lo.slice(0,-1).concat(up.slice(0,-1)); }
/* grille pour retrouver vite les triangles déjà posés */
function Grid(cell){ const m=new Map(); const k=(i,j)=>i*100003+j;
  const span=(bb,f)=>{ for(let i=Math.floor(bb[0]/cell);i<=Math.floor(bb[2]/cell);i++) for(let j=Math.floor(bb[1]/cell);j<=Math.floor(bb[3]/cell);j++) f(k(i,j)); };
  return { add(bb,item){ span(bb,c=>{ let l=m.get(c); if(!l) m.set(c,l=[]); l.push(item); }); },
    near(bb){ const out=new Set(); span(bb,c=>{ const l=m.get(c); if(l) l.forEach(x=>out.add(x)); }); return out; } }; }
const bbOf=P=>{ let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity; for(const p of P){ a=Math.min(a,p[0]); b=Math.min(b,p[1]); c=Math.max(c,p[0]); d=Math.max(d,p[1]); } return [a,b,c,d]; };

/* ---- dépliage */
function patronCompute(p, opt){
  const g=getGeometry(p); const {V,T}=patMesh(g);
  if(T.length<4) return {ok:false, err:'La pièce est vide ou plate : pas de patron possible.'};
  // arêtes : chaque arête doit être partagée par exactement deux triangles
  const E=new Map();
  T.forEach((t,ti)=>{ for(let i=0;i<3;i++){ const a=t.v[i], b=t.v[(i+1)%3], k=pk(a,b); let e=E.get(k); if(!e) E.set(k,e={a:Math.min(a,b), b:Math.max(a,b), t:[]}); e.t.push(ti); } });
  // faces planes : triangles voisins dans le même plan. Après un CSG, l'intérieur d'une face plane peut garder des
  // arêtes mal raccordées (triangles superposés) : sans effet sur le dépliage tant que ces arêtes restent dans le plan.
  const planes=[], pb=new Map(), bk=(x,y,z)=>x+','+y+','+z;
  const plOf=T.map(t=>{ const d=t.n.dot(V[t.v[0]]), gx=Math.round(t.n.x*50), gy=Math.round(t.n.y*50), gz=Math.round(t.n.z*50); let k=-1;
    for(let a=-1;a<=1 && k<0;a++) for(let b=-1;b<=1 && k<0;b++) for(let c=-1;c<=1 && k<0;c++){ const l=pb.get(bk(gx+a,gy+b,gz+c)); if(l) k=l.find(i=>planes[i].n.dot(t.n)>0.99999 && Math.abs(planes[i].d-d)<PAT_EPS) ?? -1; }
    if(k<0){ k=planes.length; planes.push({n:t.n, d, tris:[]}); const K=bk(gx,gy,gz); if(!pb.has(K)) pb.set(K,[]); pb.get(K).push(k); }
    planes[k].tris.push(t); return k; });
  const par=T.map((_,i)=>i); const fnd=i=>{ while(par[i]!==i){ par[i]=par[par[i]]; i=par[i]; } return i; }; const uni=(a,b)=>{ par[fnd(a)]=fnd(b); };
  const inTri=(q,t)=>{ const [A,B,C]=t.v.map(v=>V[v]); const v0=C.clone().sub(A), v1=B.clone().sub(A), v2=q.clone().sub(A);
    const d00=v0.dot(v0), d01=v0.dot(v1), d02=v0.dot(v2), d11=v1.dot(v1), d12=v1.dot(v2), den=d00*d11-d01*d01; if(Math.abs(den)<1e-12) return false;
    const u=(d11*d02-d01*d12)/den, w=(d00*d12-d01*d02)/den; return u>=-1e-6 && w>=-1e-6 && u+w<=1+1e-6; };
  let open=0; const tix=new Map(T.map((t,i)=>[t,i]));
  for(const e of E.values()){
    if(e.t.length===2){ if(plOf[e.t[0]]===plOf[e.t[1]]) uni(e.t[0],e.t[1]); continue; }
    if(e.t.length>2){ if(e.t.every(i=>plOf[i]===plOf[e.t[0]])) e.t.forEach(i=>uni(i,e.t[0])); else open++; continue; }
    // arête seule : recouverte par un autre triangle du même plan, juste de l'autre côté ?
    const t=T[e.t[0]], c=V[t.v.find(v=>v!==e.a&&v!==e.b)], m=V[e.a].clone().add(V[e.b]).multiplyScalar(0.5);
    const out=m.clone().sub(c); out.addScaledVector(t.n,-out.dot(t.n)); const ab=V[e.b].clone().sub(V[e.a]).normalize(); out.addScaledVector(ab,-out.dot(ab)).normalize();
    const q=m.clone().addScaledVector(out, 2*PAT_EPS), o=planes[plOf[e.t[0]]].tris.find(u=>u!==t && inTri(q,u));
    if(o) uni(e.t[0], tix.get(o)); else open++;
  }
  if(open) return {ok:false, err: p.kind==='group'
    ? `Le calcul du groupe a laissé ${open} petit${open>1?'s':''} défaut${open>1?'s':''} dans la peau de la pièce : elle n’est pas assez bien fermée pour un patron. Essayez moins de facettes sur les cylindres percés (12 à 24), ou faites le patron de chaque pièce avant de grouper.`
    : `La pièce n’est pas fermée (${open} arête${open>1?'s':''} sans voisine). Un patron ne se fait que sur une pièce fermée, sans trou dans sa peau.`};
  if(signedVolume(g)<0) for(const t of T){ t.v.reverse(); t.n.negate(); }   // normales vers l'extérieur
  const fid=new Map(), F=[];
  T.forEach((t,ti)=>{ const r=fnd(ti); if(!fid.has(r)){ fid.set(r,F.length); F.push({tris:[], n:t.n.clone(), area:0}); } const f=F[fid.get(r)]; f.tris.push(ti); f.area+=t.area; t.f=fid.get(r); });
  // arêtes entre faces (coutures possibles), regroupées par paire de faces
  const D=new Map();   // 'fA|fB' → {fa, fb, edges:[clé], len, best:{a,b,len}, ang, convex}
  const ekeys=[];
  for(const [k,e] of E){ if(e.t.length!==2) continue; const fa=T[e.t[0]].f, fb=T[e.t[1]].f; if(fa===fb) continue;
    const len=V[e.a].distanceTo(V[e.b]); e.name=patEdgeName(V,e.a,e.b); ekeys.push(k);
    const lo=Math.min(fa,fb), hi=Math.max(fa,fb), dk=lo+'|'+hi; let d=D.get(dk);
    if(!d){ const ang=Math.acos(clamp(F[lo].n.dot(F[hi].n),-1,1));
      // convexe si la face voisine passe derrière le plan de la face
      const t2=T[e.t[1]], c=new THREE.Vector3(); t2.v.forEach(v=>c.add(V[v])); c.multiplyScalar(1/3);
      const convex= c.sub(V[e.a]).dot(T[e.t[0]].n) < 0;
      D.set(dk, d={fa:lo, fb:hi, edges:[], len:0, best:null, ang, convex}); }
    d.edges.push(k); d.len+=len; if(!d.best || len>d.best.len) d.best={a:e.a, b:e.b, len}; }
  const manual=opt.mode==='manuel';
  const forced=k=> manual? opt.forced[E.get(k).name] : undefined;
  for(const d of D.values()){ d.cut=d.edges.some(k=>forced(k)==='cut'); d.join=!d.cut && d.edges.some(k=>forced(k)==='join'); }
  const nbr=F.map(()=>[]); for(const d of D.values()){ nbr[d.fa].push(d); nbr[d.fb].push(d); }

  // taille d'un morceau sur le papier, page A4 portrait
  const s=opt.scale/100, tab=opt.tab;
  const pageW=A4.w-2*A4.m, pageH=A4.h-2*A4.m-A4.head;
  const maxS=Math.max(10, Math.min(opt.maxSize, pageW-2*tab, pageH-2*tab));
  // position 2D d'une face, posée sur l'arête (a,b) dont les positions sont connues (ou à plat pour la première)
  const faceVerts=f=>{ const set=new Set(); for(const ti of F[f].tris) T[ti].v.forEach(v=>set.add(v)); return [...set]; };
  const place=(f, a, b, A2, B2)=>{ const n=F[f].n, u=new THREE.Vector3().subVectors(V[b],V[a]).normalize(), w=n.clone().cross(u);
    const phi=Math.atan2(B2[1]-A2[1], B2[0]-A2[0]), c=Math.cos(phi), si=Math.sin(phi), q=new THREE.Vector3(), out=new Map();
    for(const v of faceVerts(f)){ q.subVectors(V[v],V[a]); const x=q.dot(u), y=q.dot(w); out.set(v,[A2[0]+x*c-y*si, A2[1]+x*si+y*c]); }
    return out; };
  const cellOf=Math.max(1, Math.sqrt(F.reduce((m,f)=>Math.max(m,f.area),0))*s);
  const pos=new Array(F.length).fill(null), isl=new Int32Array(F.length).fill(-1);
  const islands=[]; const hinge=new Set(); let rejOver=0, rejSize=0, rejForced=0;
  const order=F.map((_,i)=>i).sort((x,y)=>F[y].area-F[x].area);
  for(const seed of order){
    if(isl[seed]>=0) continue;
    const I={id:islands.length, faces:[], grid:Grid(cellOf), bb:[Infinity,Infinity,-Infinity,-Infinity]}; islands.push(I);
    const tri2=(f,P)=>F[f].tris.map(ti=>T[ti].v.map(v=>P.get(v)).map(q=>[q[0]*s,q[1]*s]));
    const put=(f,P)=>{ pos[f]=P; isl[f]=I.id; I.faces.push(f); for(const tr of tri2(f,P)){ const bb=bbOf(tr); I.grid.add(bb,tr); I.bb=[Math.min(I.bb[0],bb[0]),Math.min(I.bb[1],bb[1]),Math.max(I.bb[2],bb[2]),Math.max(I.bb[3],bb[3])]; } };
    const t0=T[F[seed].tris[0]]; put(seed, place(seed, t0.v[0], t0.v[1], [0,0], [V[t0.v[0]].distanceTo(V[t0.v[1]]),0]));
    const cand=[]; const push=f=>{ for(const d of nbr[f]){ if(d.cut) continue; const o=d.fa===f?d.fb:d.fa; if(isl[o]<0) cand.push({d,from:f,to:o,w:(d.join?1e9:0)+d.len}); } };
    push(seed);
    while(cand.length){
      let bi=0; for(let i=1;i<cand.length;i++) if(cand[i].w>cand[bi].w) bi=i;
      const c=cand[bi]; cand[bi]=cand[cand.length-1]; cand.pop();
      if(isl[c.to]>=0) continue;
      const {a,b}=c.d.best, P=place(c.to, a, b, pos[c.from].get(a), pos[c.from].get(b));
      const trs=tri2(c.to,P); let bb=I.bb.slice(); for(const tr of trs){ const q=bbOf(tr); bb=[Math.min(bb[0],q[0]),Math.min(bb[1],q[1]),Math.max(bb[2],q[2]),Math.max(bb[3],q[3])]; }
      if(bb[2]-bb[0]>maxS+1e-6 || bb[3]-bb[1]>maxS+1e-6){ rejSize++; if(c.d.join) rejForced++; continue; }
      const tol=1e-4*Math.max(1,cellOf); let hit=false;
      for(const tr of trs){ for(const o of I.grid.near(bbOf(tr))) if(triHit(tr,o,tol)){ hit=true; break; } if(hit) break; }
      if(hit){ rejOver++; if(c.d.join) rejForced++; continue; }
      hinge.add(c.d); put(c.to,P); push(c.to);
    }
  }
  // coupures : arêtes entre faces qui ne servent pas de charnière ; plis : arêtes des charnières
  const cuts=[], folds=[];
  for(const d of D.values()){ for(const k of d.edges){ const e=E.get(k); (hinge.has(d)? folds : cuts).push({k, e, d}); } }
  // côté de chaque arête coupée, orienté comme sa face (intérieur à gauche)
  const sideOf=(k,f)=>{ const e=E.get(k); for(const ti of e.t){ const t=T[ti]; if(t.f!==f) continue; const i=t.v.indexOf(e.a), j=t.v.indexOf(e.b); return (j===(i+1)%3)? [e.a,e.b] : [e.b,e.a]; } };
  const X=q=>[q[0]*s,q[1]*s];
  let num=0; const marks=islands.map(()=>({cuts:[], folds:[], tabs:[], nums:[]}));
  cuts.sort((x,y)=>Math.min(x.d.fa,x.d.fb)-Math.min(y.d.fa,y.d.fb));
  for(const c of cuts){ num++; c.n=num;
    for(const f of [c.d.fa, c.d.fb]){ const [a,b]=sideOf(c.k,f); const A=X(pos[f].get(a)), B=X(pos[f].get(b)); marks[isl[f]].cuts.push({A,B,n:num,f}); } }
  for(const c of folds){ const f=c.d.fa; const A=X(pos[f].get(c.e.a)), B=X(pos[f].get(c.e.b)); marks[isl[f]].folds.push({A,B,m:c.d.convex}); }
  // languettes : un seul côté par couture, retirée si elle chevauche le morceau
  const tabPoly=(A,B,w)=>{ const dx=B[0]-A[0], dy=B[1]-A[1], L=Math.hypot(dx,dy); if(L<1e-6) return null; const ux=dx/L, uy=dy/L, ox=uy, oy=-ux;   // dehors = à droite
    // côtés à 45° : sur un bord convexe, deux languettes voisines ne se gênent jamais ; petite arête = petite languette
    const hh=Math.min(w, L*0.45), k=hh; if(L-2*k<0.05) return [A, B, [(A[0]+B[0])/2+ox*L/2, (A[1]+B[1])/2+oy*L/2]];
    return [A, B, [B[0]+ox*hh-ux*k, B[1]+oy*hh-uy*k], [A[0]+ox*hh+ux*k, A[1]+oy*hh+uy*k]]; };
  let noTab=0; const done=new Set();
  const byNum=new Map(); marks.forEach((m,i)=>m.cuts.forEach(c=>{ if(!byNum.has(c.n)) byNum.set(c.n,[]); byNum.get(c.n).push({c,i}); }));
  for(const [n,list] of byNum){ if(done.has(n)) continue; done.add(n);
    let ok=false;
    for(const w of [tab, tab/2]){ for(const {c,i} of list){ const pl=tabPoly(c.A,c.B,w); if(!pl) continue;
        const bb=bbOf(pl), I=islands[i], tol=1e-4*Math.max(1,cellOf);
        // la languette ne doit couvrir ni le morceau ni une autre languette
        let bad=false; for(const o of I.grid.near(bb)){ if(polyHit(pl,o,tol)){ bad=true; break; } }
        if(!bad) for(const t2 of marks[i].tabs) if(polyHit(pl,t2.pl,tol)){ bad=true; break; }
        if(!bad){ marks[i].tabs.push({pl,n}); c.tab=true; ok=true; break; } }
      if(ok) break; }
    if(!ok) noTab++; }
  // assemblage du résultat
  const pieces=islands.map((I,i)=>{ const pts=[]; for(const f of I.faces) for(const v of pos[f].values()) pts.push(X(v));
    for(const t2 of marks[i].tabs) pts.push(...t2.pl);
    const tris=[]; for(const f of I.faces) for(const ti of F[f].tris) tris.push(T[ti].v.map(v=>X(pos[f].get(v))));
    const big=I.faces.reduce((m,f)=>F[f].area>F[m].area?f:m, I.faces[0]); const ctr=[0,0]; const bp=[...pos[big].values()].map(X); bp.forEach(q=>{ ctr[0]+=q[0]/bp.length; ctr[1]+=q[1]/bp.length; });
    return {n:i+1, tris, pts, ctr, ...marks[i]}; });
  // contour 3D des coupures (affiché sur la pièce)
  const seams=cuts.map(c=>({a:V[c.e.a], b:V[c.e.b], n:F[c.d.fa].n.clone().add(F[c.d.fb].n).normalize(), name:c.e.name, forced:forced(c.k)}));
  const joins=manual? folds.filter(c=>forced(c.k)==='join').map(c=>({a:V[c.e.a], b:V[c.e.b], n:F[c.d.fa].n.clone().add(F[c.d.fb].n).normalize()})) : [];
  const warn=[];
  if(rejOver) warn.push(`Pièce très courbée ou creuse : ${rejOver} coupure${rejOver>1?'s':''} ajoutée${rejOver>1?'s':''} pour que les morceaux ne se chevauchent pas.`);
  if(rejSize) warn.push(`Taille maximale ${fmt(maxS,0)} mm : ${rejSize} coupure${rejSize>1?'s':''} ajoutée${rejSize>1?'s':''} pour garder des morceaux plus petits.`);
  if(rejForced) warn.push(`${rejForced} arête${rejForced>1?'s':''} à recoller n’ont pas pu l’être (chevauchement ou taille).`);
  if(noTab) warn.push(`${noTab} couture${noTab>1?'s':''} sans languette (pas la place) : collez-les avec un ruban adhésif.`);
  const edgeList=ekeys.map(k=>{ const e=E.get(k); return {a:V[e.a], b:V[e.b], name:e.name}; });
  return {ok:true, pieces, nCuts:cuts.length, nFaces:F.length, warn, seams, joins, edges:edgeList, cutNames:new Set(cuts.map(c=>c.e.name)), maxS};
}

/* ---- mise en page sur des pages A4 (rangées) et SVG */
function patLayout(res, name){
  const tab=PAT.tab, W=A4.w-2*A4.m, H=A4.h-2*A4.m-A4.head;
  // orientation : on tourne chaque morceau pour qu'il prenne le moins de place
  const items=res.pieces.map(P=>{ const hl=hull2(P.pts); let best=null;
    const angs=[0]; for(let i=0;i<hl.length;i++){ const a=hl[i], b=hl[(i+1)%hl.length]; angs.push(Math.atan2(b[1]-a[1], b[0]-a[0])); }
    for(const t of angs) for(const add of [0, Math.PI/2]){ const th=-t+add, c=Math.cos(th), si=Math.sin(th);
      const R=hl.map(q=>[q[0]*c-q[1]*si, q[0]*si+q[1]*c]); const bb=bbOf(R), w=bb[2]-bb[0], h=bb[3]-bb[1];
      const fits= w+2<=W && h+2<=H, score=(fits?0:1e9)+Math.max(w,h)*1000+w*h/1000;
      if(!best || score<best.score) best={score, th, bb, w, h, fits}; }
    return {P, ...best}; });
  items.sort((x,y)=>y.h-x.h);
  const pages=[]; let pg=null, x=0, y=0, rowH=0; const gap=3;
  for(const it of items){
    const w=it.w, h=it.h;
    if(pg && x>0 && x+w>W+1e-6){ y+=rowH+gap; x=0; rowH=0; }   // rangée suivante
    if(!pg || (y>0 && y+h>H+1e-6)){ pg=[]; pages.push(pg); x=0; y=0; rowH=0; }   // page suivante
    pg.push({it, x, y}); x+=w+gap; rowH=Math.max(rowH,h);
  }
  const svgs=pages.map((list,i)=>patSvg(list, i, pages.length, name));
  return {svgs, big:items.filter(it=>!it.fits).map(it=>it.P.n)};
}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function patSvg(list, i, n, name){
  const f2=v=>+v.toFixed(2);
  const out=[]; const col=cssVar('--accent')||'#1d7656';
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297" font-family="Arial, sans-serif">`);
  out.push(`<rect width="210" height="297" fill="#fff"/>`);
  out.push(`<text x="${A4.m}" y="${A4.m+4}" font-size="4.2" font-weight="bold" fill="#222">Patron : ${esc(name)}</text>`);
  out.push(`<text x="${A4.w-A4.m}" y="${A4.m+4}" font-size="3.4" text-anchor="end" fill="#222">page ${i+1} / ${n} · échelle ${fmt(PAT.scale,0)} %</text>`);
  // barre de contrôle : 50 mm à vérifier à la règle
  const by=A4.m+9;
  out.push(`<path d="M${A4.m} ${by}h50M${A4.m} ${by-1.5}v3M${A4.m+50} ${by-1.5}v3" stroke="#222" stroke-width="0.4" fill="none"/>`);
  out.push(`<text x="${A4.m+52}" y="${by+1.2}" font-size="2.8" fill="#222">50 mm : imprimez à 100 % (taille réelle) et vérifiez ce trait à la règle</text>`);
  out.push(`<g font-size="2.6" fill="#222"><path d="M${A4.m} ${by+5}h7" stroke="#222" stroke-width="0.35"/><text x="${A4.m+8.5}" y="${by+6}">couper</text>`
    +`<path d="M${A4.m+25} ${by+5}h7" stroke="#222" stroke-width="0.3" stroke-dasharray="1.6 1"/><text x="${A4.m+33.5}" y="${by+6}">pli vallée (en creux)</text>`
    +`<path d="M${A4.m+65} ${by+5}h7" stroke="#222" stroke-width="0.3" stroke-dasharray="2.4 0.8 0.4 0.8"/><text x="${A4.m+73.5}" y="${by+6}">pli montagne (en bosse)</text>`
    +`<rect x="${A4.m+110}" y="${by+3.6}" width="7" height="2.8" fill="#eceae4" stroke="#222" stroke-width="0.25"/><text x="${A4.m+118.5}" y="${by+6}">languette à coller sous le même numéro</text></g>`);
  const oy=A4.m+A4.head;
  for(const {it, x, y} of list){
    const c=Math.cos(it.th), s=Math.sin(it.th);
    const T=q=>{ const rx=q[0]*c-q[1]*s, ry=q[0]*s+q[1]*c; return [f2(A4.m+x+rx-it.bb[0]), f2(oy+y+it.bb[3]-ry)]; };
    const P=it.P; const pts=a=>a.map(T).map(q=>q.join(',')).join(' ');
    out.push(`<g>`);
    for(const t of P.tabs) out.push(`<polygon points="${pts(t.pl)}" fill="#eceae4" stroke="#222" stroke-width="0.25"/>`);
    for(const tr of P.tris) out.push(`<polygon points="${pts(tr)}" fill="#f6fbf8" stroke="#f6fbf8" stroke-width="0.12"/>`);
    for(const fo of P.folds){ const A=T(fo.A), B=T(fo.B); out.push(`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="#222" stroke-width="0.3" stroke-dasharray="${fo.m?'2.4 0.8 0.4 0.8':'1.6 1'}"/>`); }
    for(const cu of P.cuts){ const A=T(cu.A), B=T(cu.B); out.push(`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="#222" stroke-width="0.35" stroke-linecap="round"/>`);
      // numéro d'assemblage, à l'intérieur de la face, le long de l'arête
      const L=Math.hypot(B[0]-A[0],B[1]-A[1]); if(L<1) continue; const ux=(B[0]-A[0])/L, uy=(B[1]-A[1])/L; const fs=clamp(L*0.3,1.4,3);
      const nx=uy, ny=-ux;   // en SVG (y vers le bas), l'intérieur est de ce côté
      const mx=(A[0]+B[0])/2+nx*fs*0.9, my=(A[1]+B[1])/2+ny*fs*0.9; let ang=Math.atan2(uy,ux)*180/Math.PI; if(ang>90) ang-=180; if(ang<-90) ang+=180;
      out.push(`<text x="${f2(mx)}" y="${f2(my)}" font-size="${f2(fs)}" text-anchor="middle" dominant-baseline="middle" fill="${cu.tab?'#a33':'#235'}" transform="rotate(${f2(ang)} ${f2(mx)} ${f2(my)})">${cu.n}</text>`); }
    const C=T(P.ctr); out.push(`<circle cx="${C[0]}" cy="${C[1]}" r="3.2" fill="#fff" stroke="${col}" stroke-width="0.4"/><text x="${C[0]}" y="${C[1]}" font-size="3.6" font-weight="bold" text-anchor="middle" dominant-baseline="central" fill="${col}">${P.n}</text>`);
    out.push(`</g>`);
  }
  out.push(`</svg>`);
  return out.join('\n');
}

/* ---- action « Patron » */
function patronMake(p, quiet=false){
  if(!p || p.hole){ toast('Choisissez une pièce (pas un perçage).'); return; }
  const key=vKey(p);
  if(PAT.pid!==p.id || PAT.key!==key){ if(PAT.pid!==p.id) PAT.forced={}; }
  PAT.pid=p.id; PAT.key=key;
  let res; try{ res=patronCompute(p, {mode:PAT.mode, forced:PAT.forced, maxSize:PAT.maxSize, tab:PAT.tab, scale:PAT.scale}); }
  catch(err){ console.error(err); res={ok:false, err:'Le patron n’a pas pu être calculé pour cette pièce.'}; }
  if(res.ok){ const L=patLayout(res, p.name); res.svgs=L.svgs; if(L.big.length) res.warn.push(`Morceau${L.big.length>1?'x':''} ${L.big.join(', ')} plus grand${L.big.length>1?'s':''} qu’une page : réduisez l’échelle ou la taille maximale.`); }
  PAT.res=res; patSeams(); renderInspector();
  if(!quiet) toast(res.ok? `Patron : ${res.pieces.length} morceau${res.pieces.length>1?'x':''} sur ${res.svgs.length} page${res.svgs.length>1?'s':''}.` : res.err, res.ok?2600:4200);
}
/* coutures sur la pièce en 3D (rouge : coupée ; vert : recollée à la main) */
function patSeams(){
  for(const c of [...patGroup.children]){ patGroup.remove(c); c.geometry.dispose(); c.material.dispose(); }
  const R=PAT.res; if(!R?.ok) return;
  const p=findPart(PAT.pid); const g=p&&getGeometry(p); const sz=new THREE.Vector3(); g?.boundingBox.getSize(sz); const off=Math.max(0.05, Math.max(sz.x,sz.y,sz.z)*0.004);
  const seg=(list,color)=>{ if(!list.length) return; const pos=[]; for(const e of list) for(const v of [e.a,e.b]) pos.push(v.x+e.n.x*off, v.y+e.n.y*off, v.z+e.n.z*off);
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
    const l=new THREE.LineSegments(geo, new THREE.LineBasicMaterial({color, transparent:true, opacity:.95})); l.renderOrder=14; patGroup.add(l); };
  seg(R.seams.filter(e=>e.forced!=='cut'), '#e4574b'); seg(R.seams.filter(e=>e.forced==='cut'), '#b0261b'); seg(R.joins, '#30a46c');
}
function patTick(){
  const on= ws==='check' && !!PAT.res?.ok && selection.length===1 && selection[0]===PAT.pid && patronGenerated();
  patGroup.visible=on;
  if(on){ const r=meshes.get(PAT.pid); if(r){ r.mesh.updateMatrix(); patGroup.matrix.copy(r.mesh.matrix); patGroup.matrixWorldNeedsUpdate=true; } }
  if(PAT.fn && pickMode===PAT.fn && (!on || PAT.mode!=='manuel')) patManual(false);
}
/* mode manuel : un clic sur une arête de la pièce la coupe ou la recolle */
function patManual(on){
  if(on){ if(pickMode && pickMode!==PAT.fn) return; PAT.fn=(pt, hit)=>patClick(hit); pickMode=PAT.fn; $('#pickHint').hidden=false; $('#pickHint').textContent='Coupe manuelle : cliquez une arête de la pièce pour la couper (rouge) ou la recoller (verte).'; }
  else if(PAT.fn){ if(pickMode===PAT.fn) pickMode=null; PAT.fn=null; $('#pickHint').hidden=true; }
}
function patClick(hit){
  const p=findPart(PAT.pid); if(!p || !PAT.res?.ok) return;
  if(!hit || hit.object.userData.id!==p.id){ toast('Cliquez sur une arête de la pièce dont vous faites le patron.'); return; }
  const q=hit.point.clone().applyMatrix4(partMatrix(p).invert());
  const g=getGeometry(p), sz=new THREE.Vector3(); g.boundingBox.getSize(sz); const tol=Math.max(1.5, Math.max(sz.x,sz.y,sz.z)*0.05);
  let best=null, bd=tol; const ln=new THREE.Line3(), cp=new THREE.Vector3();
  for(const e of PAT.res.edges){ ln.set(e.a,e.b); ln.closestPointToPoint(q,true,cp); const d=cp.distanceTo(q); if(d<bd){ bd=d; best=e; } }
  if(!best){ toast('Cliquez plus près d’une arête (un bord entre deux faces).'); return; }
  const F=PAT.forced, k=best.name, cut=PAT.res.cutNames.has(k);
  if(cut){ if(F[k]==='cut') delete F[k]; else F[k]='join'; } else { if(F[k]==='join') delete F[k]; else F[k]='cut'; }
  patronMake(p, true);
  const now=PAT.res.cutNames?.has(k);
  toast(now? (F[k]==='join'? 'Impossible de recoller cette arête : les morceaux se chevaucheraient.' : 'Arête coupée.') : 'Arête recollée : elle devient un pli.');
}

/* ---- sorties : fichiers SVG, impression, grand aperçu */
function patFileBase(){ const p=findPart(PAT.pid); return slug(p?.name||state.name)+'-patron'; }
async function patSaveSvg(){
  const R=PAT.res; if(!R?.ok) return; const base=patFileBase(), enc=new TextEncoder();
  if(R.svgs.length===1) offerFile(base+'.svg', new Blob([R.svgs[0]],{type:'image/svg+xml'}));
  else offerFile(base+'-svg.zip', zipStore(R.svgs.map((s,i)=>({name:`${base}-page${i+1}.svg`, data:enc.encode(s)}))));
}
function patPrint(){
  const R=PAT.res; if(!R?.ok) return;
  const f=h('iframe',{style:'position:fixed;width:0;height:0;border:0;left:-9999px','aria-hidden':'true'});
  f.srcdoc='<!doctype html><html><head><meta charset="utf-8"><title>Patron</title><style>@page{size:A4 portrait;margin:0}html,body{margin:0}svg{display:block;width:210mm;height:297mm;break-after:page}</style></head><body>'+R.svgs.join('')+'</body></html>';
  f.onload=()=>{ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ toast('Impression bloquée ici : enregistrez le SVG et imprimez-le à 100 %.'); } setTimeout(()=>f.remove(), 60000); };
  document.body.append(f);
}
function patOpenView(){
  const R=PAT.res; if(!R?.ok) return; patCloseView();
  const v=h('div',{id:'patView',role:'dialog','aria-label':'Patron à imprimer'},
    h('div',{class:'pat-bar'}, h('b',{},`Patron : ${R.pieces.length} morceau${R.pieces.length>1?'x':''}, ${R.svgs.length} page${R.svgs.length>1?'s':''} A4`),
      h('span',{class:'pat-sp'}),
      h('button',{class:'btn',onclick:patSaveSvg}, svgIcon('save'),'SVG'), h('button',{class:'btn',onclick:patPrint}, svgIcon('print'),'Imprimer'),
      h('button',{class:'btn primary',id:'patClose',onclick:patCloseView},'Fermer')),
    h('div',{class:'pat-pages'}, R.svgs.map(s=>h('div',{class:'pat-page',html:s}))));
  v.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.stopPropagation(); patCloseView(); } });
  document.body.append(v); $('#patClose').focus();
}
function patCloseView(){ $('#patView')?.remove(); }

/* ---- section du panneau Valider */
function patronSec(p){
  const R=PAT.pid===p.id? PAT.res : null, fresh=R && PAT.key===vKey(p);
  const again=()=>{ if(PAT.pid===p.id && PAT.res) patronMake(p, true); else renderInspector(); };
  const num=(lab,k,unit,o)=>row(lab, numInput(lab, PAT[k], unit, v=>{ PAT[k]=v; again(); }, o));
  const s=sec('Patron à imprimer', h('div',{class:'info',html:'Le patron est la <b>peau</b> de la pièce mise à plat : imprimez-le, découpez, pliez et collez les <b>languettes</b> sous les numéros identiques.'}),
    h('div',{class:'pat-mode'}, h('small',{},'Mode de coupe'), bubSeg([['auto','Automatique'],['manuel','Manuelle']], PAT.mode, v=>{ PAT.mode=v; if(v!=='manuel') patManual(false); again(); })),
    num('Taille max. d’un morceau','maxSize','mm',{min:20,max:277,step:10}),
    num('Largeur des languettes','tab','mm',{min:0,max:20,step:1}),
    num('Échelle','scale','%',{min:5,max:400,step:10}),
    h('button',{class:'btn primary',id:'patBtn',style:'justify-content:center;padding:9px',onclick:()=>patronMake(p)}, svgIcon('print'), fresh? 'Refaire le patron' : 'Patron'));
  if(R && !fresh) s.append(h('div',{class:'status warn',html:'La pièce a changé : refaites le patron.'}));
  else if(R && !R.ok) s.append(h('div',{class:'status err',html:'<b>Pas de patron.</b> '+esc(R.err)}));
  else if(R){
    s.append(h('div',{class:'status '+(R.warn.length?'warn':'ok'),html:`<b>${R.pieces.length} morceau${R.pieces.length>1?'x':''}</b> sur <b>${R.svgs.length} page${R.svgs.length>1?'s':''} A4</b> · ${R.nCuts} arête${R.nCuts>1?'s':''} coupée${R.nCuts>1?'s':''} (en rouge sur la pièce).`+R.warn.map(w=>'<br>'+esc(w)).join('')}));
    s.append(h('div',{class:'pat-thumbs'}, R.svgs.map((sv,i)=>h('button',{class:'pat-thumb',title:`Page ${i+1} : agrandir`,html:sv,onclick:patOpenView}))));
    s.append(h('div',{style:'display:flex;gap:6px;flex-wrap:wrap'},
      h('button',{class:'btn',onclick:patOpenView}, svgIcon('zoom'),'Agrandir'), h('button',{class:'btn',id:'patSvg',onclick:patSaveSvg}, svgIcon('save'),'SVG'), h('button',{class:'btn',id:'patPrint',onclick:patPrint}, svgIcon('print'),'Imprimer')));
    if(PAT.mode==='manuel'){ s.append(h('div',{class:'info',html:'<b>Coupe manuelle</b> : cliquez une arête de la pièce dans la vue. Rouge = coupée, vert = recollée.'})); if(!PAT.fn) setTimeout(()=>patManual(true)); }
  }
  return minLvl(s,3);
}
