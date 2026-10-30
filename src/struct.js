
/* =========================================================
   Atelier « Structures » : simulation de déformation.
   - Treillis : barres articulées (cylindre plein, tube = cylindres imbriqués, câble).
   - Maillage : éléments finis 2D simplifiés (contraintes planes, triangles).
   Unités : mm, N, MPa (= N/mm²). Le plan de calcul est vertical : x horizontal, y vertical
   (y devient Z dans la vue 3D).
   ========================================================= */
const MATERIALS={
  bois:  {name:'Bois (pin)',          E:11000,  nu:0.30, rho:500,  st:40,  sc:30,  col:'#c9a36b'},
  acier: {name:'Acier',               E:210000, nu:0.30, rho:7850, st:235, sc:235, col:'#8d99a6'},
  alu:   {name:'Aluminium',           E:70000,  nu:0.33, rho:2700, st:150, sc:150, col:'#b8c2cc'},
  pla:   {name:'PLA (impression 3D)', E:3500,   nu:0.35, rho:1240, st:50,  sc:60,  col:'#e6a23a'},
  pierre:{name:'Pierre',              E:20000,  nu:0.20, rho:2500, st:2,   sc:40,  col:'#cbbf9f'},
  beton: {name:'Béton',               E:30000,  nu:0.20, rho:2400, st:2.5, sc:25,  col:'#a9aba7'},
};
const GRAV=9.81e-9; // poids (N) = rho (kg/m³) × volume (mm³) × 9,81e-9
const SECTIONS={plein:'Cylindre plein', tube:'Tube (cylindres imbriqués)', cable:'Câble (traction seule)'};
function secProps(b){ const D=Math.max(0.1,+b.D||1), d=b.sec==='tube'? clamp(+b.d||0,0,D-0.05) : 0;
  return {A:Math.PI/4*(D*D-d*d), I:b.sec==='cable'?0:Math.PI/64*(D**4-d**4), D, d}; }

function defaultStruct(){ return {mod:'treillis', truss:{nodes:[], bars:[], nid:1, mat:'bois', sec:'plein', D:6, d:4, grav:true, labels:true},
  mesh:{shape:'poutre', P:{L:2400,h:60,Ri:1500,e:300,H:1200,w:80,La:900,ha:80}, t:500, mat:'bois', sup:'encastre', load:'pointe', F:800, grav:true, dens:2, view:'vm', part:null}}; }
const ST={tool:'select', sel:null, view:{cx:0,cy:0,s:1}, fitted:false, mode3d:false, amp:'auto', res:null, mres:null, chain:null, drag:null, mouse:null};
function SD(){ if(!state.struct) state.struct=defaultStruct(); return state.struct; }

/* =========================================================
   Treillis : méthode des déplacements, barres articulées.
   ========================================================= */
function solveTruss(T){
  const N=new Map(T.nodes.map(n=>[n.id,n]));
  const bars=T.bars.filter(b=>N.has(b.a)&&N.has(b.b)&&b.a!==b.b);
  const used=[...new Set(bars.flatMap(b=>[b.a,b.b]))]; const ix=new Map(used.map((id,i)=>[id,i]));
  const n=used.length*2; if(!bars.length) return {ok:false, empty:true};
  const info=bars.map(b=>{ const A=N.get(b.a), B=N.get(b.b); const dx=B.x-A.x, dy=B.y-A.y, L=Math.hypot(dx,dy)||1e-9; const m=MATERIALS[b.mat]||MATERIALS[T.mat]||MATERIALS.bois; const sp=secProps(b);
    return {b, L, c:dx/L, s:dy/L, m, ...sp, active:true}; });
  const fixed=new Set(); for(const id of used){ const nd=N.get(id); const i=ix.get(id); if(nd.sup==='fixe'){ fixed.add(2*i); fixed.add(2*i+1); } else if(nd.sup==='glissant') fixed.add(2*i+1); }
  if(!fixed.size) return {ok:false, reason:'Aucun appui : ajoutez au moins un appui fixe et un appui glissant.'};
  let u=null, slack=0, mech=null;
  for(let it=0; it<15; it++){
    const K=new Float64Array(n*n), F=new Float64Array(n);
    for(const id of used){ const nd=N.get(id), i=ix.get(id); F[2*i]+=+nd.fx||0; F[2*i+1]+=+nd.fy||0; }
    for(const e of info){ const ia=ix.get(e.b.a), ib=ix.get(e.b.b);
      if(T.grav){ const w=e.m.rho*e.A*e.L*GRAV; F[2*ia+1]-=w/2; F[2*ib+1]-=w/2; }
      if(!e.active) continue;
      const k=e.m.E*e.A/e.L, cc=e.c*e.c*k, ss=e.s*e.s*k, cs=e.c*e.s*k;
      const d=[2*ia,2*ia+1,2*ib,2*ib+1], km=[[cc,cs,-cc,-cs],[cs,ss,-cs,-ss],[-cc,-cs,cc,cs],[-cs,-ss,cs,ss]];
      for(let r=0;r<4;r++) for(let q=0;q<4;q++) K[d[r]*n+d[q]]+=km[r][q]; }
    const free=[...Array(n).keys()].filter(d=>!fixed.has(d)); const m=free.length;
    const A=new Float64Array(m*(m+1)); let maxd=0;
    free.forEach((di,r)=>{ free.forEach((dj,q)=>{ A[r*(m+1)+q]=K[di*n+dj]; }); A[r*(m+1)+m]=F[di]; maxd=Math.max(maxd,Math.abs(K[di*n+di])); });
    // Gauss–Jordan with partial pivoting; a tiny pivot means a mechanism
    mech=null;
    for(let c=0;c<m;c++){ let p=c, pv=Math.abs(A[c*(m+1)+c]); for(let r=c+1;r<m;r++){ const v=Math.abs(A[r*(m+1)+c]); if(v>pv){pv=v;p=r;} }
      if(pv<1e-10*maxd){ mech=free[c]; break; }
      if(p!==c) for(let q=c;q<=m;q++){ const t=A[c*(m+1)+q]; A[c*(m+1)+q]=A[p*(m+1)+q]; A[p*(m+1)+q]=t; }
      const piv=A[c*(m+1)+c];
      for(let r=0;r<m;r++){ if(r===c) continue; const f=A[r*(m+1)+c]/piv; if(!f) continue; for(let q=c;q<=m;q++) A[r*(m+1)+q]-=f*A[c*(m+1)+q]; } }
    if(mech!=null){ const nodeId=used[Math.floor(mech/2)]; return {ok:false, reason: slack? 'Instable : un câble est détendu et ne retient plus la structure.' : 'Structure instable : elle peut bouger sans se déformer. Ajoutez une barre (un triangle) ou un appui.', node:nodeId}; }
    u=new Float64Array(n); free.forEach((d,r)=>{ u[d]=A[r*(m+1)+m]/A[r*(m+1)+r]; });
    let changed=false; slack=0;
    for(const e of info){ const ia=ix.get(e.b.a), ib=ix.get(e.b.b);
      e.N=e.m.E*e.A/e.L*((u[2*ib]-u[2*ia])*e.c+(u[2*ib+1]-u[2*ia+1])*e.s);
      if(e.b.sec==='cable'){ if(e.active && e.N< -1e-6){ e.active=false; changed=true; } if(!e.active){ e.N=0; slack++; } } }
    if(!changed) break;
  }
  // results per bar
  let worst=null, mass=0;
  for(const e of info){ mass+=e.m.rho*e.A*e.L*1e-6; // g
    e.sig=e.N/e.A;
    if(e.b.sec==='cable' && !e.active){ e.mode='detendu'; e.sf=Infinity; continue; }
    if(e.N>=0){ e.mode='traction'; e.sf= e.N>1e-9? e.m.st*e.A/e.N : Infinity; }
    else { e.Pcr = e.I>0? Math.PI**2*e.m.E*e.I/(e.L*e.L) : 0; const crush=e.m.sc*e.A;
      e.buck = e.Pcr<crush; e.mode=e.buck?'flambage':'compression'; e.sf=Math.min(crush,e.Pcr)/(-e.N); }
    if(!worst || e.sf<worst.sf) worst=e; }
  const disp=new Map(used.map((id,i)=>[id,[u[2*i],u[2*i+1]]])); let umax=0, umaxNode=null;
  for(const [id,d] of disp){ const v=Math.hypot(d[0],d[1]); if(v>umax){umax=v; umaxNode=id;} }
  // reactions = -(sum of member forces on the node + external loads)
  const reac=new Map();
  for(const id of used){ const nd=N.get(id); if(!nd.sup) continue; let rx=-(+nd.fx||0), ry=-(+nd.fy||0);
    for(const e of info){ const end= e.b.a===id? 1 : e.b.b===id? -1 : 0; if(!end) continue; rx-=e.N*e.c*end; ry-=e.N*e.s*end; if(T.grav) ry+=e.m.rho*e.A*e.L*GRAV/2; }
    reac.set(id,[rx,ry]); }
  return {ok:true, bars:info, disp, umax, umaxNode, worst, mass, reac, slack};
}

/* =========================================================
   Maillage : triangles à déformation constante, contraintes planes.
   ========================================================= */
function shapeOf(M){
  const P=M.P;
  if(M.shape==='poutre') return {kind:'rects', rects:[[0,0,P.L,P.h]]};
  if(M.shape==='L') return {kind:'rects', rects:[[0,0,P.w,P.H],[0,P.H-P.ha,P.La,P.H]]};
  if(M.shape==='arc') return {kind:'arc', Ri:P.Ri, e:P.e};
  if(M.shape==='esquisse'){ const p=findPart(M.part); if(p?.kind==='sketch'){ const {loops}=skProfiles(p.params.sk); if(loops.length) return {kind:'loops', loops:loops.map(L=>L.pts)}; } }
  return {kind:'rects', rects:[[0,0,P.L,P.h]]};
}
function buildMesh(M){
  const S=shapeOf(M), dens=[4,6,8,12][M.dens??2]||8;
  let nodes=[], tris=[];
  if(S.kind==='arc'){
    const nr=Math.max(3,Math.round(dens*0.75)), Rm=S.Ri+S.e/2, nt=clamp(Math.round(Math.PI*Rm/(S.e/nr)),24,360);
    for(let j=0;j<=nt;j++){ const th=Math.PI - j*Math.PI/nt; for(let i=0;i<=nr;i++){ const r=S.Ri+S.e*i/nr; nodes.push([r*Math.cos(th), r*Math.sin(th)]); } }
    const id=(j,i)=>j*(nr+1)+i;
    for(let j=0;j<nt;j++) for(let i=0;i<nr;i++){ const a=id(j,i),b=id(j+1,i),c=id(j+1,i+1),d=id(j,i+1); if((i+j)%2){ tris.push([a,b,c],[a,c,d]); } else { tris.push([a,b,d],[b,c,d]); } }
    return finishMesh(nodes,tris,S.e/nr);
  }
  // structured grid over the bounding box, keeping cells inside the shape
  let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity, inside;
  if(S.kind==='rects'){ for(const [x0,y0,x1,y1] of S.rects){ minx=Math.min(minx,x0); miny=Math.min(miny,y0); maxx=Math.max(maxx,x1); maxy=Math.max(maxy,y1); }
    inside=(x,y)=>S.rects.some(([x0,y0,x1,y1])=>x>=x0&&x<=x1&&y>=y0&&y<=y1); }
  else { for(const L of S.loops) for(const [x,y] of L){ minx=Math.min(minx,x); miny=Math.min(miny,y); maxx=Math.max(maxx,x); maxy=Math.max(maxy,y); }
    const inPoly=(x,y,poly)=>{ let ins=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const a=poly[i],b=poly[j]; if(((a[1]>y)!==(b[1]>y)) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) ins=!ins; } return ins; };
    inside=(x,y)=>S.loops.reduce((acc,L)=>acc!==inPoly(x,y,L), false); }
  const W=maxx-minx, H=maxy-miny;
  let cell = S.kind==='rects'? Math.min(...S.rects.map(r=>Math.min(r[2]-r[0], r[3]-r[1])))/dens : Math.min(W,H)/(dens*1.5);
  cell=Math.max(cell, Math.sqrt(W*H/5000));            // keep the model light (≈ 10 000 triangles max)
  const nx=Math.max(1,Math.round(W/cell)), ny=Math.max(1,Math.round(H/cell)), cx=W/nx, cy=H/ny;
  const map=new Map(); const nid=(i,j)=>{ const k=i*(ny+1)+j; let v=map.get(k); if(v===undefined){ v=nodes.length; map.set(k,v); nodes.push([minx+i*cx, miny+j*cy]); } return v; };
  for(let i=0;i<nx;i++) for(let j=0;j<ny;j++){
    if(!inside(minx+(i+0.5)*cx, miny+(j+0.5)*cy)) continue;
    const a=nid(i,j), b=nid(i+1,j), c=nid(i+1,j+1), d=nid(i,j+1);
    if((i+j)%2) tris.push([a,b,c],[a,c,d]); else tris.push([a,b,d],[b,c,d]);
  }
  return finishMesh(nodes,tris,Math.min(cx,cy));
}
function finishMesh(nodes, tris, cell){
  // renumber along the longest direction to keep the stiffness matrix narrow (banded)
  let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity; for(const [x,y] of nodes){ minx=Math.min(minx,x); maxx=Math.max(maxx,x); miny=Math.min(miny,y); maxy=Math.max(maxy,y); }
  const wide=(maxx-minx)>=(maxy-miny);
  const ord=nodes.map((p,i)=>i).sort((a,b)=> wide? (nodes[a][0]-nodes[b][0])||(nodes[a][1]-nodes[b][1]) : (nodes[a][1]-nodes[b][1])||(nodes[a][0]-nodes[b][0]));
  const re=new Int32Array(nodes.length); ord.forEach((o,i)=>re[o]=i);
  const N2=ord.map(o=>nodes[o]), T2=tris.map(t=>t.map(i=>re[i]));
  // boundary edges (used once) for outlines and the 3D preview
  const E=new Map(); for(const t of T2) for(const [a,b] of [[t[0],t[1]],[t[1],t[2]],[t[2],t[0]]]){ const k=a<b?a+'_'+b:b+'_'+a; E.set(k,(E.get(k)||0)+1); }
  const bnd=[]; for(const [k,c] of E) if(c===1) bnd.push(k.split('_').map(Number));
  return {nodes:N2, tris:T2, cell, bnd, box:{minx,maxx,miny,maxy}};
}
/* supports and loads chosen by simple rules on the shape's outline */
function surfNodes(mesh, side){ // top or bottom surface: extreme node per column of width ≈ cell
  const bins=new Map(), w=mesh.cell*0.999;
  mesh.nodes.forEach(([x,y],i)=>{ const k=Math.round((x-mesh.box.minx)/w); const cur=bins.get(k); if(cur===undefined || (side==='top'? y>mesh.nodes[cur][1] : y<mesh.nodes[cur][1])) bins.set(k,i); });
  return [...bins.values()].sort((a,b)=>mesh.nodes[a][0]-mesh.nodes[b][0]);
}
const SUPS={encastre:'Encastré à gauche', appuis:'Deux appuis (aux extrémités du dessous)', pieds:'Pieds encastrés (dessous)'};
const LOADS={pointe:'Force au bout (à droite)', centre:'Force au milieu', reparti:'Charge répartie sur le dessus', suspendu:'Charge suspendue sous le bout', aucune:'Poids propre seulement'};
function meshBC(mesh, M){
  const tol=mesh.cell*0.01, b=mesh.box, nodes=mesh.nodes; const fix=new Map(); // node -> [fx,fy] booleans
  if(M.sup==='encastre') nodes.forEach(([x],i)=>{ if(x<=b.minx+tol) fix.set(i,[1,1]); });
  else if(M.sup==='pieds') nodes.forEach(([,y],i)=>{ if(y<=b.miny+tol) fix.set(i,[1,1]); });
  else { const bot=surfNodes(mesh,'bottom'); const lowest=bot.filter(i=>nodes[i][1]<=b.miny+mesh.cell*0.6); const L=lowest.length?lowest:bot; fix.set(L[0],[1,1]); fix.set(L[L.length-1],[0,1]); }
  const loads=new Map(); const F=+M.F||0;
  if(M.load!=='aucune' && F){
    const top=surfNodes(mesh,'top');
    if(M.load==='reparti'){ const w=top.map((n,k)=>{ const xl=k?nodes[top[k-1]][0]:nodes[n][0], xr=k<top.length-1?nodes[top[k+1]][0]:nodes[n][0]; return (xr-xl)/2; }); const s=w.reduce((a,c)=>a+c,0)||1; top.forEach((n,k)=>loads.set(n,[0,-F*w[k]/s])); }
    else if(M.load==='centre'){ const mid=(b.minx+b.maxx)/2; let best=top[0]; for(const n of top) if(Math.abs(nodes[n][0]-mid)<Math.abs(nodes[best][0]-mid)) best=n; loads.set(best,[0,-F]); }
    else if(M.load==='suspendu'){ let best=0; nodes.forEach(([x,y],i)=>{ const [bx,by]=nodes[best]; if(x>bx+tol || (Math.abs(x-bx)<=tol && y<by)) best=i; }); loads.set(best,[0,-F]); }
    else { loads.set(top[top.length-1],[0,-F]); }
  }
  return {fix, loads};
}
function solvePlane(mesh, M){
  const mat=MATERIALS[M.mat]||MATERIALS.bois, t=Math.max(0.1,+M.t||1), E=mat.E, nu=mat.nu;
  const nodes=mesh.nodes, tris=mesh.tris, nn=nodes.length, n=2*nn;
  let bw=0; for(const tr of tris){ const mn=Math.min(...tr), mx=Math.max(...tr); bw=Math.max(bw, 2*(mx-mn)+1); }
  const W=bw+1, K=new Float64Array(n*W), F=new Float64Array(n);
  const k0=E/(1-nu*nu), D=[k0,k0*nu,0, k0*nu,k0,0, 0,0,k0*(1-nu)/2];
  const Bs=[];
  for(const tr of tris){
    const [x1,y1]=nodes[tr[0]], [x2,y2]=nodes[tr[1]], [x3,y3]=nodes[tr[2]];
    const A2=(x2-x1)*(y3-y1)-(x3-x1)*(y2-y1), A=Math.abs(A2)/2;
    const b=[y2-y3,y3-y1,y1-y2].map(v=>v/A2), c=[x3-x2,x1-x3,x2-x1].map(v=>v/A2);
    const B=[ [b[0],0,b[1],0,b[2],0], [0,c[0],0,c[1],0,c[2]], [c[0],b[0],c[1],b[1],c[2],b[2]] ];
    Bs.push(B);
    const DB=[0,1,2].map(r=>[0,1,2,3,4,5].map(q=>D[r*3]*B[0][q]+D[r*3+1]*B[1][q]+D[r*3+2]*B[2][q]));
    const dof=[2*tr[0],2*tr[0]+1,2*tr[1],2*tr[1]+1,2*tr[2],2*tr[2]+1];
    for(let r=0;r<6;r++) for(let q=0;q<6;q++){ const i=dof[r], j=dof[q]; if(j<i) continue;
      K[i*W+(j-i)] += t*A*(B[0][r]*DB[0][q]+B[1][r]*DB[1][q]+B[2][r]*DB[2][q]); }
    if(M.grav){ const w=mat.rho*A*t*GRAV/3; for(const v of tr) F[2*v+1]-=w; }
  }
  const {fix,loads}=meshBC(mesh,M);
  for(const [i,[fx,fy]] of loads){ F[2*i]+=fx; F[2*i+1]+=fy; }
  if(!fix.size) return {ok:false, reason:'Aucun appui.'};
  for(const [i,f] of fix) f.forEach((on,k)=>{ if(!on) return; const d=2*i+k; for(let q=1;q<W;q++){ if(d+q<n) K[d*W+q]=0; if(d-q>=0) K[(d-q)*W+q]=0; } K[d*W]=1; F[d]=0; });
  // banded Cholesky  K = Uᵀ U
  for(let i=0;i<n;i++){
    const jmax=Math.min(n-1,i+bw);
    for(let j=i;j<=jmax;j++){
      let s=K[i*W+(j-i)]; const k0=Math.max(0,j-bw);
      for(let k=k0;k<i;k++) s-=K[k*W+(i-k)]*K[k*W+(j-k)];
      if(j===i){ if(s<=1e-12){ return {ok:false, reason:'Calcul impossible : la pièce n’est pas assez tenue par ses appuis.'}; } K[i*W]=Math.sqrt(s); }
      else K[i*W+(j-i)]=s/K[i*W];
    }
  }
  const y=new Float64Array(n); for(let i=0;i<n;i++){ let s=F[i]; for(let k=Math.max(0,i-bw);k<i;k++) s-=K[k*W+(i-k)]*y[k]; y[i]=s/K[i*W]; }
  const u=new Float64Array(n); for(let i=n-1;i>=0;i--){ let s=y[i]; for(let j=i+1;j<=Math.min(n-1,i+bw);j++) s-=K[i*W+(j-i)]*u[j]; u[i]=s/K[i*W]; }
  // stresses
  const vmE=new Float64Array(tris.length), spE=new Float64Array(tris.length); let s1max=-Infinity, s3min=Infinity, vmMax=0, vmAt=0;
  tris.forEach((tr,e)=>{ const B=Bs[e]; const ue=[u[2*tr[0]],u[2*tr[0]+1],u[2*tr[1]],u[2*tr[1]+1],u[2*tr[2]],u[2*tr[2]+1]];
    const eps=[0,1,2].map(r=>B[r].reduce((s,v,q)=>s+v*ue[q],0));
    const sx=D[0]*eps[0]+D[1]*eps[1], sy=D[3]*eps[0]+D[4]*eps[1], txy=D[8]*eps[2];
    const m=(sx+sy)/2, R=Math.hypot((sx-sy)/2,txy), s1=m+R, s3=m-R;
    vmE[e]=Math.sqrt(sx*sx-sx*sy+sy*sy+3*txy*txy); spE[e]= Math.abs(s1)>=Math.abs(s3)? s1 : s3;
    if(vmE[e]>vmMax){ vmMax=vmE[e]; vmAt=e; } s1max=Math.max(s1max,s1); s3min=Math.min(s3min,s3); });
  // nodal averages for smooth colours
  const cnt=new Float64Array(nn), vmN=new Float64Array(nn), spN=new Float64Array(nn), uN=new Float64Array(nn);
  tris.forEach((tr,e)=>{ for(const v of tr){ vmN[v]+=vmE[e]; spN[v]+=spE[e]; cnt[v]++; } });
  let umax=0, uAt=0; for(let i=0;i<nn;i++){ if(cnt[i]){ vmN[i]/=cnt[i]; spN[i]/=cnt[i]; } uN[i]=Math.hypot(u[2*i],u[2*i+1]); if(uN[i]>umax){ umax=uN[i]; uAt=i; } }
  // safety: ductile materials compare von Mises, brittle ones (stone, concrete) compare traction and compression separately
  const brittle=mat.st<0.2*mat.sc;
  let sf, crit;
  if(brittle){ const ft= s1max>0? mat.st/s1max : Infinity, fc= s3min<0? mat.sc/(-s3min) : Infinity; sf=Math.min(ft,fc); crit= ft<fc? 'traction' : 'compression'; }
  else { sf= vmMax>0? Math.min(mat.st,mat.sc)/vmMax : Infinity; crit='von Mises'; }
  const weight=tris.reduce((s,tr)=>{ const [a,b,c]=tr.map(i=>nodes[i]); return s+Math.abs((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]))/2; },0)*t*mat.rho*1e-6; // grams
  return {ok:true, u, vmN, spN, uN, vmMax, vmAt, umax, uAt, s1max, s3min, sf, crit, brittle, fix, loads, mat, weight};
}
/* hand formula for the classic beam cases, shown next to the simulation */
function beamTheory(M){
  if(M.shape!=='poutre') return null; const mat=MATERIALS[M.mat], L=M.P.L, h=M.P.h, b=M.t, I=b*h**3/12, E=mat.E, F=+M.F||0;
  const W= M.grav? mat.rho*L*h*b*GRAV : 0;   // poids propre, réparti
  const wtxt= W? ` + poids propre ${fmt(W,0)} N` : '';
  if(M.sup==='encastre' && (M.load==='pointe'||M.load==='aucune')){ const Fp=M.load==='pointe'?F:0; return {f:Fp*L**3/(3*E*I)+W*L**3/(8*E*I), txt:'f = F·L³ / (3·E·I)'+(W?' + P·L³ / (8·E·I)':''), wtxt}; }
  if(M.sup==='appuis' && M.load==='centre') return {f:F*L**3/(48*E*I)+5*W*L**3/(384*E*I), txt:'f = F·L³ / (48·E·I)'+(W?' + 5·P·L³ / (384·E·I)':''), wtxt};
  if(M.sup==='appuis' && (M.load==='reparti'||M.load==='aucune')){ const Fr=M.load==='reparti'?F:0; return {f:5*(Fr+W)*L**3/(384*E*I), txt:'f = 5·F·L³ / (384·E·I)', wtxt}; }
  return null;
}
function computeStruct(){
  const S=SD();
  if(S.mod==='treillis'){ ST.res=solveTruss(S.truss); ST.mres=null; }
  else { try{ const mesh=buildMesh(S.mesh); ST.mres={mesh, ...solvePlane(mesh,S.mesh)}; } catch(e){ console.error(e); ST.mres={ok:false, reason:'Calcul impossible avec cette forme.'}; } ST.res=null; }
}

/* =========================================================
   2D editor and display
   ========================================================= */
const stCanvas=$('#stCanvas'), stCtx=stCanvas.getContext('2d'); let stW=0, stH=0;
const sToS=(x,y)=>[stW/2+(x-ST.view.cx)*ST.view.s, stH/2-(y-ST.view.cy)*ST.view.s];
const sToW=(sx,sy)=>[(sx-stW/2)/ST.view.s+ST.view.cx, -(sy-stH/2)/ST.view.s+ST.view.cy];
function stResize(){ const r=$('#stWrap').getBoundingClientRect(); if(r.width<2) return; const dpr=Math.min(2,devicePixelRatio||1); stW=r.width; stH=r.height; stCanvas.width=r.width*dpr; stCanvas.height=r.height*dpr; stCtx.setTransform(dpr,0,0,dpr,0,0); if(!ST.fitted) stFit(); stDraw(); }
new ResizeObserver(()=>{ if(ws==='struct') stResize(); }).observe($('#stWrap'));
function structBox(){
  const S=SD(); let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;
  if(S.mod==='treillis') for(const n of S.truss.nodes){ minx=Math.min(minx,n.x); maxx=Math.max(maxx,n.x); miny=Math.min(miny,n.y); maxy=Math.max(maxy,n.y); }
  else if(ST.mres?.mesh){ const b=ST.mres.mesh.box; minx=b.minx; maxx=b.maxx; miny=b.miny; maxy=b.maxy; }
  if(!isFinite(minx)){ minx=-100; maxx=300; miny=-50; maxy=150; }
  return {minx,maxx,miny,maxy};
}
function stFit(){ const b=structBox(); const w=Math.max(40,b.maxx-b.minx), hh=Math.max(40,b.maxy-b.miny);
  const d=$('#demo'); const left= (d && !d.hidden && stW>760)? d.offsetWidth+20 : 0;   // keep clear of the demo card
  ST.view.s=Math.min((stW-left-110)/(w*1.12), (stH-190)/(hh*1.45)); if(!(ST.view.s>0)) ST.view.s=1;
  ST.view.cx=(b.minx+b.maxx)/2 - left/2/ST.view.s; ST.view.cy=(b.miny+b.maxy)/2 - hh*0.05; ST.fitted=true; }
function stGrid(){ const s=ST.view.s; for(const g of [1,2,5,10,20,50,100,200,500,1000]) if(g*s>=14) return g; return 2000; }
function ampFactor(span, umax, k=0.06){ if(ST.amp==='reel' || !(umax>0)) return 1; if(ST.amp!=='auto') return +ST.amp; return Math.max(1, k*span/umax); }
function colorTC(v, lim){ // traction blue, compression red
  const k=clamp(Math.abs(v)/lim,0,1); const a=v>=0? [47,111,214] : [214,64,53]; const base=[190,198,195];
  return `rgb(${a.map((c,i)=>Math.round(base[i]+(c-base[i])*Math.sqrt(k))).join(',')})`; }
const RAMP=[[48,92,196],[62,169,201],[103,190,107],[240,200,60],[226,92,52],[170,30,40]];
function ramp(k){ k=clamp(k,0,1)*(RAMP.length-1); const i=Math.min(RAMP.length-2,Math.floor(k)), f=k-i; return RAMP[i].map((c,j)=>Math.round(c+(RAMP[i+1][j]-c)*f)); }
function divergent(v, lim){ const k=clamp(v/lim,-1,1); const w=[236,238,236], r=[200,52,44], b=[44,96,200]; const t=Math.abs(k), c=k>=0? b : r; return w.map((x,i)=>Math.round(x+(c[i]-x)*Math.pow(t,0.7))); }

function stDraw(){
  if(ws!=='struct') return;   // in 3D the hidden canvas is still drawn so the legend stays right
  const g=stCtx, S=SD(); const col={bg:cssVar('--scene'),line:cssVar('--line'),ink:cssVar('--ink'),ink2:cssVar('--ink-2'),acc:cssVar('--accent'),mark:cssVar('--mark'),panel:cssVar('--panel'),danger:cssVar('--danger')};
  g.clearRect(0,0,stW,stH); g.fillStyle=col.bg; g.fillRect(0,0,stW,stH);
  const gs=stGrid(); const [x0,y1]=sToW(0,0), [x1,y0]=sToW(stW,stH);
  g.strokeStyle=col.line; g.lineWidth=1; g.globalAlpha=.55; g.beginPath();
  for(let x=Math.ceil(x0/gs)*gs;x<=x1;x+=gs){ const [X]=sToS(x,0); g.moveTo(Math.round(X)+.5,0); g.lineTo(Math.round(X)+.5,stH); }
  for(let y=Math.ceil(y0/gs)*gs;y<=y1;y+=gs){ const [,Y]=sToS(0,y); g.moveTo(0,Math.round(Y)+.5); g.lineTo(stW,Math.round(Y)+.5); }
  g.stroke(); g.globalAlpha=1;
  g.fillStyle=col.ink2; g.font='500 11px '+cssVar('--f-mono'); g.textAlign='right'; g.fillText(`carreau ${gs} mm`, stW-12, stH-12); g.textAlign='left';
  if(S.mod==='treillis') drawTruss(g,S.truss,col); else drawMeshRes(g,S.mesh,col);
}
function arrowS(g, x, y, dx, dy, color, label){ // arrow ending at (x,y) coming from direction (dx,dy) in screen space
  const L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L, len=46; const sx=x-ux*len, sy=y-uy*len;
  g.strokeStyle=color; g.fillStyle=color; g.lineWidth=2.4; g.beginPath(); g.moveTo(sx,sy); g.lineTo(x-ux*8,y-uy*8); g.stroke();
  g.beginPath(); g.moveTo(x,y); g.lineTo(x-ux*11-uy*5, y-uy*11+ux*5); g.lineTo(x-ux*11+uy*5, y-uy*11-ux*5); g.closePath(); g.fill();
  if(label){ g.font='600 12px '+cssVar('--f-mono'); g.textAlign='center'; g.fillText(label, sx-ux*10, sy-uy*10 - 4); g.textAlign='left'; }
}
function supGlyph(g, X, Y, type, col){
  g.strokeStyle=col.ink; g.fillStyle=col.panel; g.lineWidth=1.6;
  g.beginPath(); g.moveTo(X,Y); g.lineTo(X-10,Y+15); g.lineTo(X+10,Y+15); g.closePath(); g.fill(); g.stroke();
  if(type==='glissant'){ for(const dx of [-6,6]){ g.beginPath(); g.arc(X+dx,Y+19,3.2,0,Math.PI*2); g.stroke(); } g.beginPath(); g.moveTo(X-14,Y+23.5); g.lineTo(X+14,Y+23.5); g.stroke(); }
  else { g.beginPath(); g.moveTo(X-14,Y+15); g.lineTo(X+14,Y+15); for(let i=-12;i<=10;i+=5){ g.moveTo(X+i,Y+15); g.lineTo(X+i-4,Y+21); } g.stroke(); }
}
function drawTruss(g, T, col){
  const R=ST.res, N=new Map(T.nodes.map(n=>[n.id,n]));
  const b=structBox(); const amp= R?.ok? ampFactor(Math.max(b.maxx-b.minx,b.maxy-b.miny), R.umax, 0.035) : 1;
  const P=id=>{ const n=N.get(id); const d=R?.ok? R.disp.get(id) : null; return d? [n.x+d[0]*amp, n.y+d[1]*amp] : [n.x,n.y]; };
  // undeformed ghost
  if(R?.ok){ g.strokeStyle=col.ink2; g.globalAlpha=.25; g.lineWidth=1; g.setLineDash([4,4]); g.beginPath(); for(const bar of T.bars){ const a=N.get(bar.a), c=N.get(bar.b); if(!a||!c) continue; const [ax,ay]=sToS(a.x,a.y), [cx,cy]=sToS(c.x,c.y); g.moveTo(ax,ay); g.lineTo(cx,cy); } g.stroke(); g.setLineDash([]); g.globalAlpha=1; }
  const info=new Map((R?.ok? R.bars:[]).map(e=>[e.b.id,e]));
  for(const bar of T.bars){ const a=N.get(bar.a), c=N.get(bar.b); if(!a||!c) continue;
    const [ax,ay]=sToS(...P(bar.a)), [cx,cy]=sToS(...P(bar.b)); const e=info.get(bar.id); const sp=secProps(bar);
    const w=clamp(sp.D*ST.view.s,2,12); let color=col.ink2; let dash=null;
    if(e){ if(e.mode==='detendu'){ color='#9aa5a1'; dash=[6,4]; } else { const lim= e.N>=0? e.m.st : Math.min(e.m.sc, e.Pcr/e.A||e.m.sc); color=colorTC(e.N/e.A, lim); } }
    if(bar.sec==='cable'){ g.lineWidth=Math.max(1.5,w*0.6); } else g.lineWidth=w;
    if(bar.sec==='tube'){ g.strokeStyle=color; g.lineCap='round'; g.beginPath(); g.moveTo(ax,ay); g.lineTo(cx,cy); g.stroke(); g.strokeStyle=col.bg; g.lineWidth=Math.max(1,w*sp.d/sp.D); g.beginPath(); g.moveTo(ax,ay); g.lineTo(cx,cy); g.stroke(); }
    else { g.strokeStyle=color; g.lineCap='round'; if(dash) g.setLineDash(dash); g.beginPath(); g.moveTo(ax,ay); g.lineTo(cx,cy); g.stroke(); g.setLineDash([]); }
    if(e && e.sf<1){ g.strokeStyle=col.danger; g.lineWidth=2; g.setLineDash([3,3]); g.strokeRect(Math.min(ax,cx)-4,Math.min(ay,cy)-4,Math.abs(cx-ax)+8,Math.abs(cy-ay)+8); g.setLineDash([]); }
    if(ST.sel?.t==='bar' && ST.sel.id===bar.id){ g.strokeStyle=col.mark; g.lineWidth=2; g.globalAlpha=.9; g.beginPath(); g.moveTo(ax,ay); g.lineTo(cx,cy); g.stroke(); g.globalAlpha=1; }
    if(T.labels && e && e.mode!=='detendu' && Math.hypot(cx-ax,cy-ay)>46){ const txt=`${e.N>=0?'+':'−'}${fmt(Math.abs(e.N),0)} N`; g.font='600 11px '+cssVar('--f-mono'); const tw=g.measureText(txt).width+8;
      const mx=(ax+cx)/2, my=(ay+cy)/2; g.fillStyle=col.panel; g.globalAlpha=.88; g.fillRect(mx-tw/2,my-8,tw,16); g.globalAlpha=1; g.fillStyle=e.N>=0?'#2f6fd6':'#d64035'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,mx,my+.5); g.textAlign='left'; g.textBaseline='alphabetic'; }
  }
  // chain preview
  if(ST.tool==='bar' && ST.chain!=null && ST.mouse){ const a=N.get(ST.chain); if(a){ const [ax,ay]=sToS(a.x,a.y); const s=stSnap(ST.mouse.sx,ST.mouse.sy); const [bx,by]=sToS(s.x,s.y); g.strokeStyle=col.acc; g.lineWidth=2; g.setLineDash([6,4]); g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx,by); g.stroke(); g.setLineDash([]);
    g.font='500 12px '+cssVar('--f-mono'); g.fillStyle=col.ink; g.fillText(`${fmt(Math.hypot(s.x-a.x,s.y-a.y),0)} mm`, bx+10, by-10); } }
  // nodes, supports, loads
  for(const n of T.nodes){ const [X,Y]=sToS(...P(n.id));
    if(n.sup) supGlyph(g,X,Y,n.sup,col);
    const sel=ST.sel?.t==='node'&&ST.sel.id===n.id, mech=ST.res && !ST.res.ok && ST.res.node===n.id;
    g.fillStyle= sel? col.mark : mech? col.danger : col.panel; g.strokeStyle= mech? col.danger : col.ink; g.lineWidth=1.8; g.beginPath(); g.arc(X,Y,sel?6:5,0,Math.PI*2); g.fill(); g.stroke();
    const fx=+n.fx||0, fy=+n.fy||0; if(fx||fy) arrowS(g,X,Y,fx,-fy,col.acc,`${fmt(Math.hypot(fx,fy),0)} N`);
    const rc=R?.ok? R.reac.get(n.id) : null; if(rc && Math.hypot(rc[0],rc[1])>0.5){ g.font='500 11px '+cssVar('--f-mono'); g.fillStyle=col.ink2; g.textAlign='center'; g.fillText(`R = ${fmt(Math.hypot(rc[0],rc[1]),0)} N`, X, Y+40); g.textAlign='left'; }
    if(ST.chain===n.id){ g.strokeStyle=col.acc; g.lineWidth=2; g.beginPath(); g.arc(X,Y,10,0,Math.PI*2); g.stroke(); }
  }
  if(R?.ok && R.umaxNode!=null && R.umax>1e-6){ const [X,Y]=sToS(...P(R.umaxNode)); g.strokeStyle=col.mark; g.lineWidth=2; g.beginPath(); g.arc(X,Y,12,0,Math.PI*2); g.stroke();
    g.font='600 12px '+cssVar('--f-mono'); g.fillStyle=col.ink; g.fillText(`flèche ${fmt(R.umax,2)} mm`, X+16, Y-14); }
  $('#stLegend').innerHTML = R?.ok ? `<span class="lg"><i style="background:#2f6fd6"></i>Traction</span><span class="lg"><i style="background:#d64035"></i>Compression</span><span class="lg"><i class="dash"></i>Câble détendu</span><span class="lg mono">déformée ×${fmt(amp,amp<10?1:0)}</span>`
    : R && !R.ok && !R.empty ? `<span class="lg warn">${R.reason}</span>` : `<span class="lg">Tracez des barres avec l’outil « Barre », posez des appuis et une charge.</span>`;
}
function drawMeshRes(g, M, col){
  const R=ST.mres; if(!R?.mesh) return; const mesh=R.mesh, nodes=mesh.nodes;
  const b=mesh.box, span=Math.max(b.maxx-b.minx,b.maxy-b.miny); const amp=R.ok? ampFactor(span,R.umax) : 1;
  const P=i=> R.ok? [nodes[i][0]+R.u[2*i]*amp, nodes[i][1]+R.u[2*i+1]*amp] : nodes[i];
  // outline of the shape at rest
  g.strokeStyle=col.ink2; g.globalAlpha=.4; g.lineWidth=1; g.setLineDash([4,4]); g.beginPath(); for(const [a,c] of mesh.bnd){ const [ax,ay]=sToS(...nodes[a]), [cx,cy]=sToS(...nodes[c]); g.moveTo(ax,ay); g.lineTo(cx,cy); } g.stroke(); g.setLineDash([]); g.globalAlpha=1;
  const view=M.view; let val, lim, unit, title;
  if(R.ok){ if(view==='u'){ val=R.uN; lim=R.umax||1; unit='mm'; title='Déplacement'; }
    else if(view==='tc'){ val=R.spN; lim=Math.max(Math.abs(R.s1max),Math.abs(R.s3min))||1; unit='MPa'; title='Traction / compression'; }
    else { val=R.vmN; lim=R.vmMax||1; unit='MPa'; title='Contrainte (von Mises)'; } }
  const showMesh = mesh.tris.length<4000 && ST.view.s*mesh.cell>7;
  for(const tr of mesh.tris){ const pts=tr.map(i=>sToS(...P(i)));
    let c=[150,160,156]; if(R.ok){ const v=(val[tr[0]]+val[tr[1]]+val[tr[2]])/3; c= view==='tc'? divergent(v,lim) : ramp(v/lim); }
    g.fillStyle=`rgb(${c.join(',')})`; g.beginPath(); g.moveTo(...pts[0]); g.lineTo(...pts[1]); g.lineTo(...pts[2]); g.closePath(); g.fill();
    if(showMesh){ g.strokeStyle='rgba(0,0,0,.13)'; g.lineWidth=.6; g.stroke(); } else { g.strokeStyle=g.fillStyle; g.lineWidth=.5; g.stroke(); } }
  g.strokeStyle=col.ink; g.lineWidth=1.4; g.beginPath(); for(const [a,c] of mesh.bnd){ const [ax,ay]=sToS(...P(a)), [cx,cy]=sToS(...P(c)); g.moveTo(ax,ay); g.lineTo(cx,cy); } g.stroke();
  const bc=R.ok? {fix:R.fix, loads:R.loads} : meshBC(mesh,M);
  // supports: draw a few glyphs along the fixed boundary
  const fixed=[...bc.fix.keys()]; const step=Math.max(1,Math.ceil(fixed.length/8));
  fixed.forEach((i,k)=>{ if(k%step && k!==fixed.length-1) return; const [X,Y]=sToS(...P(i)); const f=bc.fix.get(i);
    if(M.sup==='encastre'){ g.strokeStyle=col.ink; g.lineWidth=1.4; g.beginPath(); g.moveTo(X-3,Y); g.lineTo(X-12,Y+7); g.stroke(); g.beginPath(); g.moveTo(X-3,Y-6); g.lineTo(X-3,Y+6); g.stroke(); }
    else supGlyph(g,X,Y, f[0]? 'fixe':'glissant', col); });
  const loads=[...bc.loads]; const ls=Math.max(1,Math.ceil(loads.length/14)); const tot=loads.reduce((s,[,f])=>s+Math.hypot(f[0],f[1]),0);
  loads.forEach(([i,f],k)=>{ if(k%ls) return; const [X,Y]=sToS(...P(i)); arrowS(g,X,Y,f[0],-f[1],col.acc, loads.length===1? `${fmt(tot,0)} N` : (k===0?`${fmt(tot,0)} N au total`:null)); });
  if(R.ok && R.umax>0){ const [X,Y]=sToS(...P(R.uAt)); g.strokeStyle=col.ink; g.lineWidth=2; g.beginPath(); g.arc(X,Y,8,0,Math.PI*2); g.stroke(); g.font='600 12px '+cssVar('--f-mono'); g.fillStyle=col.ink; g.fillText(`${fmt(R.umax,2)} mm`, X+12, Y+18); }
  // legend
  if(R.ok){ const stops=view==='tc'? [-1,-.5,0,.5,1].map(k=>`rgb(${divergent(k*lim,lim).join(',')})`) : [0,.2,.4,.6,.8,1].map(k=>`rgb(${ramp(k).join(',')})`);
    const lo= view==='tc'? `−${fmt(lim,lim<10?2:1)} (compression)` : '0', hi= view==='tc'? `+${fmt(lim,lim<10?2:1)} (traction)` : fmt(lim,lim<10?2:1);
    $('#stLegend').innerHTML=`<span class="lg"><b>${title}</b></span><span class="cbar2" style="background:linear-gradient(90deg,${stops.join(',')})"></span><span class="lg mono">${lo} … ${hi} ${unit}</span>${view==='vm'?`<span class="lg mono">limite du matériau ${fmt(Math.min(R.mat.st,R.mat.sc),1)} MPa</span>`:''}<span class="lg mono">déformée ×${fmt(amp,amp<10?1:0)}</span>`; }
  else $('#stLegend').innerHTML=`<span class="lg warn">${R.reason}</span>`;
}

/* ---- truss editing */
function stSnap(sx,sy){ const T=SD().truss; for(const n of T.nodes){ const [X,Y]=sToS(n.x,n.y); if(Math.hypot(X-sx,Y-sy)<10) return {x:n.x,y:n.y,node:n}; }
  let [x,y]=sToW(sx,sy); const g=+$('#stSnapSel').value||0; if(g){ x=Math.round(x/g)*g; y=Math.round(y/g)*g; } return {x:+x.toFixed(2),y:+y.toFixed(2),node:null}; }
function hitNode(sx,sy){ const T=SD().truss; let best=null,bd=11; for(const n of T.nodes){ const [X,Y]=sToS(n.x,n.y); const d=Math.hypot(X-sx,Y-sy); if(d<bd){bd=d;best=n;} } return best; }
function hitBar(sx,sy){ const T=SD().truss; const N=new Map(T.nodes.map(n=>[n.id,n])); let best=null,bd=8;
  for(const b of T.bars){ const a=N.get(b.a), c=N.get(b.b); if(!a||!c) continue; const [ax,ay]=sToS(a.x,a.y), [cx,cy]=sToS(c.x,c.y); const vx=cx-ax, vy=cy-ay, L2=vx*vx+vy*vy||1; const t=clamp(((sx-ax)*vx+(sy-ay)*vy)/L2,0,1); const d=Math.hypot(ax+vx*t-sx, ay+vy*t-sy); if(d<bd){bd=d;best=b;} } return best; }
function newNode(x,y){ const T=SD().truss; const n={id:T.nid++, x, y, sup:null, fx:0, fy:0}; T.nodes.push(n); return n; }
function newBar(a,b){ const T=SD().truss; if(a===b || T.bars.some(k=>(k.a===a&&k.b===b)||(k.a===b&&k.b===a))) return null; const bar={id:T.nid++, a, b, sec:T.sec, D:T.D, d:T.d, mat:T.mat}; T.bars.push(bar); return bar; }
function structChanged(push=true){ computeStruct(); stDraw(); if(ST.mode3d) buildStruct3D(); if(push) commit(); renderInspector(); }
function stSetTool(t){ ST.tool=t; ST.chain=null; $$('#stTools [data-st]').forEach(b=>b.classList.toggle('on',b.dataset.st===t)); stCanvas.style.cursor= t==='select'?'default':'crosshair';
  const H={select:'Cliquez un nœud ou une barre pour le régler. Glissez un nœud pour le déplacer.',bar:'Cliquez pour poser des nœuds reliés par des barres. Échap pour arrêter la chaîne.',fixe:'Cliquez un nœud : appui fixe (bloqué dans les deux directions).',glissant:'Cliquez un nœud : appui glissant (bloqué verticalement seulement).',charge:'Cliquez un nœud pour lui ajouter une force de 100 N vers le bas.',del:'Cliquez un nœud ou une barre pour le supprimer.'};
  $('#stHint').textContent=H[t]||''; stDraw(); }
function stEvt(ev){ const r=stCanvas.getBoundingClientRect(); return [ev.clientX-r.left, ev.clientY-r.top]; }
stCanvas.addEventListener('contextmenu',e=>e.preventDefault());
stCanvas.addEventListener('pointerdown',ev=>{
  ev.preventDefault(); const [sx,sy]=stEvt(ev); stCanvas.setPointerCapture(ev.pointerId);
  const S=SD(); const panStart=()=>{ ST.drag={kind:'pan',sx,sy,cx:ST.view.cx,cy:ST.view.cy}; };
  if(ev.button===1||ev.button===2||S.mod!=='treillis'){ if(ev.button===2 && ST.chain!=null){ ST.chain=null; stDraw(); return; } panStart(); return; }
  const T=S.truss, t=ST.tool;
  if(t==='select'){ const n=hitNode(sx,sy); if(n){ ST.sel={t:'node',id:n.id}; ST.drag={kind:'node',id:n.id,moved:false}; renderInspector(); stDraw(); return; }
    const b=hitBar(sx,sy); if(b){ ST.sel={t:'bar',id:b.id}; renderInspector(); stDraw(); return; }
    ST.sel=null; renderInspector(); panStart(); stDraw(); return; }
  if(t==='bar'){ const s=stSnap(sx,sy); const n=s.node||newNode(s.x,s.y);
    if(ST.chain!=null && ST.chain!==n.id) newBar(ST.chain,n.id);
    ST.chain=n.id; ST.sel={t:'node',id:n.id}; structChanged(); return; }
  const n=hitNode(sx,sy), b=n?null:hitBar(sx,sy);
  if(t==='fixe'||t==='glissant'){ if(!n) return toast('Cliquez un nœud.'); n.sup= n.sup===t? null : t; ST.sel={t:'node',id:n.id}; structChanged(); return; }
  if(t==='charge'){ if(!n) return toast('Cliquez un nœud.'); if(!(+n.fy) && !(+n.fx)) n.fy=-100; ST.sel={t:'node',id:n.id}; structChanged(); return; }
  if(t==='del'){ if(n){ T.bars=T.bars.filter(k=>k.a!==n.id&&k.b!==n.id); T.nodes=T.nodes.filter(k=>k!==n); }
    else if(b) T.bars=T.bars.filter(k=>k!==b); else return;
    ST.sel=null; structChanged(); return; }
});
stCanvas.addEventListener('pointermove',ev=>{
  const [sx,sy]=stEvt(ev); ST.mouse={sx,sy}; const dr=ST.drag;
  if(dr?.kind==='pan'){ ST.view.cx=dr.cx-(sx-dr.sx)/ST.view.s; ST.view.cy=dr.cy+(sy-dr.sy)/ST.view.s; stDraw(); return; }
  if(dr?.kind==='node'){ const n=SD().truss.nodes.find(k=>k.id===dr.id); if(!n) return; const g=+$('#stSnapSel').value||0; let [x,y]=sToW(sx,sy); if(g){ x=Math.round(x/g)*g; y=Math.round(y/g)*g; }
    if(x!==n.x||y!==n.y){ n.x=+x.toFixed(2); n.y=+y.toFixed(2); dr.moved=true; computeStruct(); stDraw(); } return; }
  if(ST.tool==='bar' && ST.chain!=null) stDraw();
});
stCanvas.addEventListener('pointerup',()=>{ const dr=ST.drag; ST.drag=null; if(dr?.kind==='node' && dr.moved) structChanged(); });
stCanvas.addEventListener('wheel',ev=>{ ev.preventDefault(); const [sx,sy]=stEvt(ev); const [wx,wy]=sToW(sx,sy); ST.view.s=clamp(ST.view.s*Math.exp(-ev.deltaY*0.0015),0.01,60); const [nx,ny]=sToW(sx,sy); ST.view.cx+=wx-nx; ST.view.cy+=wy-ny; stDraw(); },{passive:false});

/* ---- 3D preview: bars become cylinders (tubes are hollow), plates become coloured slabs */
const structGroup=new THREE.Group(); structGroup.visible=false; scene.add(structGroup);
function buildStruct3D(){
  for(const c of [...structGroup.children]){ structGroup.remove(c); c.traverse(m=>{ m.geometry?.dispose(); m.material?.dispose?.(); }); }
  const S=SD(); const toV=(x,y,z=0)=>new THREE.Vector3(x,z,y);
  if(S.mod==='treillis'){ const T=S.truss, R=ST.res, N=new Map(T.nodes.map(n=>[n.id,n])); const b=structBox(); const amp=R?.ok? ampFactor(Math.max(b.maxx-b.minx,b.maxy-b.miny),R.umax,0.035):1;
    const P=id=>{ const n=N.get(id); const d=R?.ok?R.disp.get(id):null; return d? toV(n.x+d[0]*amp, n.y+d[1]*amp) : toV(n.x,n.y); };
    const info=new Map((R?.ok?R.bars:[]).map(e=>[e.b.id,e]));
    for(const bar of T.bars){ if(!N.has(bar.a)||!N.has(bar.b)) continue; const A=P(bar.a), B=P(bar.b), L=A.distanceTo(B); if(L<1e-6) continue; const sp=secProps(bar), e=info.get(bar.id);
      let color=new THREE.Color(MATERIALS[bar.mat]?.col||'#999'); if(e && e.mode!=='detendu'){ const lim=e.N>=0?e.m.st:Math.min(e.m.sc,e.Pcr/e.A||e.m.sc); color=new THREE.Color(colorTC(e.N/e.A,lim)); }
      const r=bar.sec==='cable'? Math.max(0.4,sp.D/2) : sp.D/2;
      const grp=new THREE.Group(); grp.position.copy(A).add(B).multiplyScalar(0.5); grp.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), B.clone().sub(A).normalize());
      grp.add(new THREE.Mesh(new THREE.CylinderGeometry(r,r,L,20,1,bar.sec==='tube'), new THREE.MeshStandardMaterial({color,roughness:.45,metalness:.1,side:THREE.DoubleSide})));
      if(bar.sec==='tube') grp.add(new THREE.Mesh(new THREE.CylinderGeometry(sp.d/2,sp.d/2,L,20,1,true), new THREE.MeshStandardMaterial({color:color.clone().multiplyScalar(.55),side:THREE.BackSide})));
      structGroup.add(grp); }
    const nr=Math.max(1.5,Math.max(...T.bars.map(b=>secProps(b).D),4)*0.7);
    for(const n of T.nodes){ const m=new THREE.Mesh(new THREE.SphereGeometry(nr,16,10), new THREE.MeshStandardMaterial({color:n.sup?0x2c3331:0xdddddd})); m.position.copy(P(n.id)); structGroup.add(m);
      if(n.sup){ const c=new THREE.Mesh(new THREE.ConeGeometry(nr*2.2,nr*3,4), new THREE.MeshStandardMaterial({color:n.sup==='fixe'?0x6c7a89:0xe6a23a})); c.position.copy(P(n.id)).add(new THREE.Vector3(0,0,-nr*2.2)); c.rotation.x=Math.PI/2; c.rotation.y=Math.PI/4; c.rotateX(Math.PI); structGroup.add(c); }
      if(+n.fx||+n.fy){ const d=new THREE.Vector3(+n.fx||0,0,+n.fy||0).normalize(); structGroup.add(new THREE.ArrowHelper(d, P(n.id).clone().addScaledVector(d,-nr*12), nr*11, 0x2f6fd6, nr*3, nr*2)); } }
  } else { const R=ST.mres; if(!R?.mesh) return; const mesh=R.mesh, nodes=mesh.nodes, t=SD().mesh.t; const b=mesh.box; const amp=R.ok? ampFactor(Math.max(b.maxx-b.minx,b.maxy-b.miny),R.umax):1;
    const view=SD().mesh.view; const lim= !R.ok?1 : view==='u'? (R.umax||1) : view==='tc'? Math.max(Math.abs(R.s1max),Math.abs(R.s3min))||1 : R.vmMax||1;
    const val= !R.ok? null : view==='u'? R.uN : view==='tc'? R.spN : R.vmN;
    const pos=[], colr=[]; const P=(i,z)=>{ const x=nodes[i][0]+(R.ok?R.u[2*i]*amp:0), y=nodes[i][1]+(R.ok?R.u[2*i+1]*amp:0); return [x,z,y]; };
    const C=i=>{ const c= !val? [150,160,156] : view==='tc'? divergent(val[i],lim) : ramp(val[i]/lim); return c.map(v=>v/255); };
    const tri=(a,b,c,za,zb,zc)=>{ for(const [i,z] of [[a,za],[b,zb],[c,zc]]){ pos.push(...P(i,z)); colr.push(...C(i)); } };
    const h2=t/2;
    for(const [a,b,c] of mesh.tris){ tri(a,b,c,-h2,-h2,-h2); tri(a,c,b,h2,h2,h2); }
    for(const [a,b] of mesh.bnd){ tri(a,b,b,-h2,-h2,h2); tri(a,b,a,-h2,h2,h2); }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(colr,3)); g.computeVertexNormals();
    structGroup.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6,side:THREE.DoubleSide})));
  }
}
function setStructView3D(v){
  ST.mode3d=v; $('#stCanvas').hidden=v; $$('#stTools [data-v3]').forEach(b=>b.classList.toggle('on', (b.dataset.v3==='1')===v));
  structGroup.visible=v; if(v){ buildStruct3D(); const bx=new THREE.Box3().setFromObject(structGroup); const c=new THREE.Vector3(); bx.getCenter(c); const s=new THREE.Vector3(); bx.getSize(s); const R=Math.max(40,s.length()*0.6), dist=R/Math.sin(camera.fov*DEG/2);
    animateCam(c, c.clone().add(new THREE.Vector3(0.35,-1,0.35).normalize().multiplyScalar(dist))); }
  stDraw();
}

/* ---- inspector panel */
function renderStruct(body){
  const S=SD();
  body.append(sec('Module', h('div',{class:'mode2'},
    h('button',{class:'btn'+(S.mod==='treillis'?' on':''),onclick:()=>{ S.mod='treillis'; ST.sel=null; ST.fitted=false; computeStruct(); stResize(); if(ST.mode3d) buildStruct3D(); commit(); renderInspector(); }}, svgIcon('truss'),'Treillis'),
    h('button',{class:'btn'+(S.mod==='maillage'?' on':''),onclick:()=>{ S.mod='maillage'; ST.sel=null; ST.fitted=false; computeStruct(); stResize(); if(ST.mode3d) buildStruct3D(); commit(); renderInspector(); }}, svgIcon('meshIc'),'Maillage')),
    h('div',{class:'info',html: S.mod==='treillis'? 'Des <b>barres</b> articulées aux <b>nœuds</b>. Chaque barre travaille en traction ou en compression ; une barre comprimée trop longue <b>flambe</b>.' : 'La pièce est découpée en petits <b>triangles</b> (un maillage). On calcule comment chacun se déforme pour trouver la <b>flèche</b> et les <b>contraintes</b>.'})));
  const ex=Object.entries(SAMPLES).filter(([,s])=>s.cat==='struct' && s.mod===S.mod);
  body.append(sec('Exemples', h('div',{class:'exlist'}, ex.map(([k,s])=>h('button',{class:'btn',onclick:()=>loadExample(k)}, svgIcon(s.icon), s.title)))));
  if(S.mod==='treillis') renderTrussPanel(body,S.truss); else renderMeshPanel(body,S.mesh);
}
const verdict=(sf)=> sf>=2? ['ok','Résiste largement'] : sf>=1.2? ['ok','Résiste'] : sf>=1? ['warn','À la limite'] : ['err','Casse'];
function matSelect(val,on){ const s=h('select',{class:'field','aria-label':'Matériau'}, Object.entries(MATERIALS).map(([k,m])=>h('option',{value:k,selected:val===k||null},m.name))); s.onchange=()=>on(s.value); return s; }
function renderTrussPanel(body,T){
  const R=ST.res;
  if(R?.ok){ const w=R.worst; const [cls,txt]=verdict(w?.sf??Infinity);
    body.append(sec('Résultat', h('div',{class:'verdict v-'+cls}, h('b',{},txt), w&&isFinite(w.sf)? h('span',{},`coefficient de sécurité ${fmt(w.sf,2)}`):null),
      h('div',{class:'kv'}, h('span',{},'Flèche maximale'), h('b',{class:'mono'},`${fmt(R.umax,2)} mm`), h('span',{},'Masse des barres'), h('b',{class:'mono'},`${fmt(R.mass,1)} g`),
        h('span',{},'Barre la plus sollicitée'), h('b',{class:'mono'}, w? `${w.mode==='traction'?'traction':w.mode==='flambage'?'flambage':'compression'} ${fmt(Math.abs(w.N),0)} N`:'—'),
        R.slack? h('span',{},'Câbles détendus') : null, R.slack? h('b',{class:'mono'},String(R.slack)) : null),
      w && w.mode==='flambage' && w.sf<1.5? h('div',{class:'info',html:'Une barre comprimée <b>flambe</b> : raccourcissez-la, augmentez son diamètre ou utilisez un <b>tube</b> (plus rigide à masse égale).'}) : null)); }
  else if(R && !R.empty) body.append(sec('Résultat', h('div',{class:'verdict v-err'}, h('b',{},'Calcul impossible'), h('span',{},R.reason))));
  const sel=ST.sel; const N=new Map(T.nodes.map(n=>[n.id,n]));
  if(sel?.t==='node' && N.get(sel.id)){ const n=N.get(sel.id);
    const sup=h('select',{class:'field','aria-label':'Appui'}, [['','Aucun (nœud libre)'],['fixe','Appui fixe'],['glissant','Appui glissant']].map(([v,l])=>h('option',{value:v,selected:(n.sup||'')===v||null},l))); sup.onchange=()=>{ n.sup=sup.value||null; structChanged(); };
    const d=R?.ok? R.disp.get(n.id) : null;
    body.append(sec(`Nœud ${n.id}`, row('X (mm)', numInput('X',n.x,'mm',v=>{ n.x=v; structChanged(); },{min:-1e5,max:1e5,step:10})), row('Y (mm)', numInput('Y',n.y,'mm',v=>{ n.y=v; structChanged(); },{min:-1e5,max:1e5,step:10})),
      row('Appui', sup), row('Force Fx', numInput('Fx',+n.fx||0,'N',v=>{ n.fx=v; structChanged(); },{min:-1e7,max:1e7,step:10})), row('Force Fy', numInput('Fy',+n.fy||0,'N',v=>{ n.fy=v; structChanged(); },{min:-1e7,max:1e7,step:10})),
      h('div',{class:'jsub'},'Fy négatif = vers le bas. 10 N ≈ le poids d’1 kg.'), d? h('div',{class:'jsub mono'},`Déplacement : ${fmt(Math.hypot(d[0],d[1]),3)} mm`) : null)); }
  if(sel?.t==='bar'){ const b=T.bars.find(k=>k.id===sel.id); if(b){ const e=R?.ok? R.bars.find(k=>k.b===b) : null; const sp=secProps(b);
    const sc=h('select',{class:'field','aria-label':'Section'}, Object.entries(SECTIONS).map(([k,l])=>h('option',{value:k,selected:b.sec===k||null},l))); sc.onchange=()=>{ b.sec=sc.value; if(b.sec==='tube' && !(b.d<b.D)) b.d=+(b.D*0.75).toFixed(1); structChanged(); };
    body.append(sec(`Barre ${b.id}`, row('Section', sc), row(b.sec==='tube'?'Ø extérieur':'Diamètre', numInput('D',b.D,'mm',v=>{ b.D=v; structChanged(); },{min:0.2,max:500,step:1})),
      b.sec==='tube'? row('Ø intérieur', numInput('d',b.d,'mm',v=>{ b.d=Math.min(v,b.D-0.1); structChanged(); },{min:0,max:500,step:1})) : null,
      row('Matériau', matSelect(b.mat,v=>{ b.mat=v; structChanged(); })),
      h('div',{class:'kv'}, h('span',{},'Longueur'), h('b',{class:'mono'},`${fmt(Math.hypot(N.get(b.b).x-N.get(b.a).x,N.get(b.b).y-N.get(b.a).y),1)} mm`), h('span',{},'Section'), h('b',{class:'mono'},`${fmt(sp.A,1)} mm²`),
        e? h('span',{},'Effort') : null, e? h('b',{class:'mono'}, e.mode==='detendu'?'câble détendu' : `${e.N>=0?'traction':'compression'} ${fmt(Math.abs(e.N),1)} N`) : null,
        e&&e.mode!=='detendu'? h('span',{},'Contrainte') : null, e&&e.mode!=='detendu'? h('b',{class:'mono'},`${fmt(Math.abs(e.sig),2)} MPa`) : null,
        e&&e.N<0&&e.Pcr? h('span',{},'Charge de flambage') : null, e&&e.N<0&&e.Pcr? h('b',{class:'mono'},`${fmt(e.Pcr,0)} N`) : null,
        e&&isFinite(e.sf)? h('span',{},'Sécurité') : null, e&&isFinite(e.sf)? h('b',{class:'mono'},fmt(e.sf,2)) : null),
      h('button',{class:'btn',onclick:()=>{ for(const k of T.bars){ k.sec=b.sec; k.D=b.D; k.d=b.d; k.mat=b.mat; } structChanged(); }}, 'Appliquer à toutes les barres'))); } }
  const dsec=h('select',{class:'field','aria-label':'Section des nouvelles barres'}, Object.entries(SECTIONS).map(([k,l])=>h('option',{value:k,selected:T.sec===k||null},l))); dsec.onchange=()=>{ T.sec=dsec.value; commit(); renderInspector(); };
  const lab=h('input',{type:'checkbox',checked:T.labels||null}); lab.onchange=()=>{ T.labels=lab.checked; commit(); stDraw(); };
  const gr=h('input',{type:'checkbox',checked:T.grav||null}); gr.onchange=()=>{ T.grav=gr.checked; structChanged(); };
  body.append(sec('Nouvelles barres', row('Section', dsec), row(T.sec==='tube'?'Ø ext. / Ø int.':'Diamètre', h('div',{style:'display:flex;gap:4px'}, numInput('D',T.D,'',v=>{ T.D=v; commit(); },{min:0.2,max:500,step:1}), T.sec==='tube'? numInput('d',T.d,'',v=>{ T.d=v; commit(); },{min:0,max:500,step:1}):null)),
    row('Matériau', matSelect(T.mat,v=>{ T.mat=v; commit(); }))));
  body.append(sec('Affichage et calcul', h('label',{class:'chk'}, lab, 'Afficher les efforts (N) sur les barres'), h('label',{class:'chk'}, gr, 'Compter le poids des barres'), ampRow()));
}
function ampRow(){ const s=h('select',{class:'field','aria-label':'Échelle de la déformée'}, [['auto','Amplifiée (lisible)'],['reel','Réelle (×1)'],['10','×10'],['100','×100']].map(([v,l])=>h('option',{value:v,selected:ST.amp===v||null},l))); s.onchange=()=>{ ST.amp=s.value; stDraw(); if(ST.mode3d) buildStruct3D(); }; return row('Déformée', s); }
function renderMeshPanel(body,M){
  const R=ST.mres;
  if(R?.ok){ const [cls,txt]=verdict(R.sf); const th=beamTheory(M);
    body.append(sec('Résultat', h('div',{class:'verdict v-'+cls}, h('b',{},txt), isFinite(R.sf)? h('span',{},`coefficient de sécurité ${fmt(R.sf,2)} (${R.crit})`):null),
      h('div',{class:'kv'}, h('span',{},'Flèche maximale'), h('b',{class:'mono'},`${fmt(R.umax,2)} mm`),
        h('span',{},'Contrainte max (von Mises)'), h('b',{class:'mono'},`${fmt(R.vmMax,2)} MPa`),
        h('span',{},'Traction max'), h('b',{class:'mono'},`${fmt(Math.max(0,R.s1max),2)} MPa`), h('span',{},'Compression max'), h('b',{class:'mono'},`${fmt(Math.max(0,-R.s3min),2)} MPa`),
        h('span',{},'Masse'), h('b',{class:'mono'}, R.weight>2000? `${fmt(R.weight/1000,1)} kg` : `${fmt(R.weight,0)} g`),
        h('span',{},'Maillage'), h('b',{class:'mono'},`${R.mesh.tris.length} triangles`)),
      th? h('div',{class:'info',html:`Calcul à la main (RDM) : <b>${th.txt}</b>${th.wtxt} → <b>${fmt(th.f,2)} mm</b>.<br>Le maillage donne ${fmt(R.umax,2)} mm. L’écart vient des approximations des deux méthodes ; il diminue avec un maillage plus fin.`}) : null,
      R.brittle? h('div',{class:'info',html:`La ${R.mat.name.toLowerCase()} résiste bien en <b>compression</b> (${R.mat.sc} MPa) mais très peu en <b>traction</b> (${R.mat.st} MPa). Regardez la vue <b>Traction / compression</b>.`}) : null)); }
  else if(R) body.append(sec('Résultat', h('div',{class:'verdict v-err'}, h('b',{},'Calcul impossible'), h('span',{},R.reason))));
  const ch=fn=>v=>{ fn(v); ST.fitted=false; structChanged(); stResize(); };
  const shapes=[['poutre','Poutre (rectangle)'],['arc','Voûte (demi-cercle)'],['L','Potence en L'],...(lv(3)?[['esquisse','Une de mes esquisses']]:[])];
  const shp=h('select',{class:'field','aria-label':'Forme'}, shapes.map(([v,l])=>h('option',{value:v,selected:M.shape===v||null},l))); shp.onchange=()=>ch(v=>{ M.shape=v; if(v==='arc'){ M.sup='pieds'; } if(v==='esquisse' && !M.part) M.part=state.parts.find(p=>p.kind==='sketch')?.id??null; })(shp.value);
  const P=M.P, n=(lab,k,step=10)=>row(lab, numInput(lab,P[k],'mm',ch(v=>{ P[k]=v; }),{min:1,max:1e5,step}));
  const s=sec('Pièce étudiée', row('Forme', shp));
  if(M.shape==='poutre') s.append(n('Longueur','L',100), n('Hauteur','h',5));
  if(M.shape==='arc') s.append(n('Rayon intérieur','Ri',50), n('Épaisseur de l’arc','e',10));
  if(M.shape==='L') s.append(n('Hauteur du poteau','H',50), n('Largeur du poteau','w',5), n('Longueur du bras','La',50), n('Hauteur du bras','ha',5));
  if(M.shape==='esquisse'){ const sk=state.parts.filter(p=>p.kind==='sketch'); const ps=h('select',{class:'field','aria-label':'Esquisse'}, sk.length? sk.map(p=>h('option',{value:p.id,selected:M.part===p.id||null},p.name)) : [h('option',{value:''},'Aucune esquisse')]); ps.onchange=()=>ch(v=>{ M.part=+v; })(ps.value);
    s.append(row('Esquisse', ps), h('div',{class:'jsub'},'Le profil de l’esquisse est vu de face : X horizontal, Y vertical.')); }
  s.append(row('Profondeur', numInput('Profondeur',M.t,'mm',ch(v=>{ M.t=v; }),{min:0.5,max:1e5,step:10})), row('Matériau', matSelect(M.mat,ch(v=>{ M.mat=v; }))));
  body.append(s);
  const sp=h('select',{class:'field','aria-label':'Appuis'}, Object.entries(SUPS).map(([k,l])=>h('option',{value:k,selected:M.sup===k||null},l))); sp.onchange=()=>ch(v=>{ M.sup=v; })(sp.value);
  const ld=h('select',{class:'field','aria-label':'Charge'}, Object.entries(LOADS).map(([k,l])=>h('option',{value:k,selected:M.load===k||null},l))); ld.onchange=()=>ch(v=>{ M.load=v; })(ld.value);
  const gr=h('input',{type:'checkbox',checked:M.grav||null}); gr.onchange=()=>{ M.grav=gr.checked; structChanged(); };
  body.append(sec('Appuis et charges', row('Appuis', sp), row('Charge', ld), M.load!=='aucune'? row('Force totale', numInput('Force',M.F,'N',v=>{ M.F=v; structChanged(); },{min:0,max:1e8,step:100})) : null,
    h('div',{class:'jsub'},'100 N ≈ le poids de 10 kg.'), h('label',{class:'chk'}, gr, 'Compter le poids propre')));
  const vw=h('select',{class:'field','aria-label':'Affichage'}, [['vm','Contrainte (von Mises)'],['tc','Traction / compression'],['u','Déplacement']].map(([v,l])=>h('option',{value:v,selected:M.view===v||null},l))); vw.onchange=()=>{ M.view=vw.value; commit(); stDraw(); if(ST.mode3d) buildStruct3D(); };
  const dn=h('select',{class:'field','aria-label':'Finesse du maillage'}, ['Grossier','Moyen','Fin','Très fin'].map((l,i)=>h('option',{value:i,selected:(M.dens??2)===i||null},l))); dn.onchange=()=>{ M.dens=+dn.value; structChanged(); };
  body.append(sec('Affichage', row('Couleurs', vw), ampRow(), row('Maillage', dn)));
}
