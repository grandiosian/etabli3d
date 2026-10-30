
/* =========================================================
   Demonstration samples
   Each sample: category, title, short description, feature tags, gallery icon,
   a build() that fills `state`, and a "fiche" (what to observe / what to try).
   Positions are given in world millimetres, Z up.
   ========================================================= */
function P_(kind, o){ const p=newPart(kind); if(o.params) Object.assign(p.params,o.params); delete o.params; Object.assign(p,o); return p; }
function G_(name, color, pos, children, o={}){ // children positions are relative to the group origin `pos`
  return {id:state.nextId++, kind:'group', name, params:{}, color, hole:false, pos, rot:[0,0,0], children, ...o};
}
function J_(o){ // origin/axis given in world coordinates at rest
  const PR=restMatrix(o.parent??null), inv=PR.clone().invert(), rotInv=new THREE.Matrix4().extractRotation(inv);
  const og=new THREE.Vector3(...o.origin).applyMatrix4(inv), a=new THREE.Vector3(...AX[o.axis||'z']).applyMatrix4(rotInv).normalize();
  const j={id:state.nextId++, name:o.name, type:o.type, child:o.child, parent:o.parent??null, origin:[og.x,og.y,og.z], axis:[a.x,a.y,a.z], min:o.min??null, max:o.max??null, motor:o.motor||null, driver:o.driver||null};
  state.joints.push(j); return j;
}
function resetFor(name){ state.name=name; state.parts=[]; state.joints=[]; state.nextId=1; state.note=null; state.struct=defaultStruct(); }

/* Sketch builder: points, closed polylines (automatic H / V), circles, dimensions. */
function SKB(){
  const d={nid:2, pts:[{id:1,x:0,y:0,fixed:true,origin:true}], lines:[], circles:[], beziers:[], cons:[]};
  const P=id=>d.pts.find(p=>p.id===id);
  const con=c=>{ c.id=d.nid++; d.cons.push(c); return c; };
  const api={ d,
    pt(x,y){ const ex=d.pts.find(p=>Math.abs(p.x-x)<1e-9&&Math.abs(p.y-y)<1e-9); if(ex) return ex.id; const p={id:d.nid++,x,y}; d.pts.push(p); return p.id; },
    poly(coords){ const ids=coords.map(([x,y])=>api.pt(x,y)); ids.forEach((a,i)=>{ const b=ids[(i+1)%ids.length]; const l={id:d.nid++,a,b}; d.lines.push(l);
        if(Math.abs(P(a).y-P(b).y)<1e-9) con({type:'h',l:l.id}); else if(Math.abs(P(a).x-P(b).x)<1e-9) con({type:'v',l:l.id}); }); return ids; },
    line(a,b){ const l={id:d.nid++,a,b}; d.lines.push(l); if(Math.abs(P(a).y-P(b).y)<1e-9) con({type:'h',l:l.id}); else if(Math.abs(P(a).x-P(b).x)<1e-9) con({type:'v',l:l.id}); return l.id; },
    bez(a,b,t1,t2){ const z={id:d.nid++,a,b,t1,t2}; d.beziers.push(z); return z.id; },
    circle(x,y,diam){ const c={id:d.nid++, c:api.pt(x,y), r:diam/2}; d.circles.push(c); return c.id; },
    dx(a,b,off){ const v=P(b).x-P(a).x; return con({type:'dx',a,b,value:Math.abs(v),sign:Math.sign(v)||1,off}); },
    dy(a,b,off){ const v=P(b).y-P(a).y; return con({type:'dy',a,b,value:Math.abs(v),sign:Math.sign(v)||1,off}); },
    diam(cid,ang,off){ const c=d.circles.find(k=>k.id===cid); return con({type:'diam',c:cid,value:c.r*2,ang,off}); },
    eqr(c1,c2){ return con({type:'eqr',c1,c2}); },
    centre(cid){ return d.circles.find(k=>k.id===cid).c; },
  };
  return api;
}

const DARK='#2c3331', WHITE='#f2f2ee', GREY='#6c7a89';
const SAMPLES={
  /* ---------------- Modéliser ---------------- */
  maison:{level:1, cat:'model', title:'Maison', icon:'ex_house', tags:['Perçage','Groupe','Coin'],
    desc:'Murs creusés par des perçages, toit fait de deux coins.',
    build(){
      resetFor('Maison');
      const body=G_('Maison (murs)', '#e6a23a', [0,0,2], [
        P_('box',{name:'Murs',params:{L:40,l:30,h:24},pos:[0,0,0]}),
        P_('box',{name:'Intérieur',params:{L:36,l:26,h:21},hole:true,pos:[0,0,2]}),
        P_('box',{name:'Porte',params:{L:9,l:6,h:15},hole:true,pos:[0,-15,1]}),
        P_('box',{name:'Fenêtre gauche',params:{L:8,l:6,h:7},hole:true,pos:[-12,-15,10]}),
        P_('box',{name:'Fenêtre droite',params:{L:8,l:6,h:7},hole:true,pos:[12,-15,10]}),
        P_('box',{name:'Fenêtre arrière',params:{L:10,l:6,h:8},hole:true,pos:[0,15,10]}),
      ]);
      const roof=G_('Toit', '#c4473c', [0,0,26], [
        P_('wedge',{name:'Pan droit',params:{L:22,l:36,h:15},pos:[11,0,0]}),
        P_('wedge',{name:'Pan gauche',params:{L:22,l:36,h:15},pos:[-11,0,0],rot:[0,0,180]}),
        P_('box',{name:'Cheminée',params:{L:5,l:5,h:14},pos:[11,7,2]}),
      ]);
      const ground=P_('box',{name:'Terrain',params:{L:70,l:56,h:2},color:'#4aa36b',pos:[0,-6,0]});
      const path=P_('box',{name:'Allée',params:{L:9,l:13,h:1},color:WHITE,pos:[0,-21.5,2]});
      state.parts.push(ground,path,body,roof);
    },
    note:{observe:['La maison est un <b>groupe</b> : un cube plein et cinq <b>perçages</b> (intérieur, porte, fenêtres).','Le toit est un autre groupe : deux <b>coins</b> dos à dos et une cheminée.'],
      try:['Sélectionnez les murs puis <b>Dégrouper</b> : les perçages apparaissent en gris transparent.','Agrandissez une fenêtre dans le panneau des propriétés, puis regroupez avec <span class="kbd">Ctrl</span>+<span class="kbd">G</span>.']}},

  crayons:{level:1, cat:'model', title:'Pot à crayons gravé', icon:'ex_cup', tags:['Texte','Perçage','Gravure'],
    desc:'Un bloc percé de cinq trous, avec un nom gravé en creux.',
    build(){
      resetFor('Pot à crayons');
      const cup=G_('Pot à crayons', '#3d8bd0', [0,0,0], [
        P_('box',{name:'Bloc',params:{L:60,l:40,h:45},pos:[0,0,0]}),
        P_('cylinder',{name:'Trou Ø16',params:{d:16,h:50,seg:48},hole:true,pos:[-17,3,4]}),
        P_('cylinder',{name:'Trou Ø14',params:{d:14,h:50,seg:48},hole:true,pos:[2,3,4]}),
        P_('cylinder',{name:'Trou Ø10 (1)',params:{d:10,h:50,seg:40},hole:true,pos:[20,8,4]}),
        P_('cylinder',{name:'Trou Ø10 (2)',params:{d:10,h:50,seg:40},hole:true,pos:[20,-6,4]}),
        P_('cylinder',{name:'Trou Ø7',params:{d:7,h:50,seg:32},hole:true,pos:[-17,-12,4]}),
        P_('text',{name:'Gravure',params:{txt:'TECHNO',size:8,h:2,font:'sans'},hole:true,pos:[0,-19,22],rot:[90,0,0]}),
      ]);
      state.parts.push(cup);
    },
    note:{observe:['Le mot <b>TECHNO</b> est un texte transformé en <b>perçage</b> : il creuse 1 mm dans la face avant.','Les trous ne descendent pas jusqu’en bas : ils commencent à Z = 4 mm pour garder un fond.'],
      try:['Dégroupez, cliquez sur la gravure et écrivez votre prénom.','Passez la gravure en <b>Solide</b> : le texte ressort au lieu d’être creusé.']}},

  de:{level:1, cat:'model', title:'Dé à jouer', icon:'ex_die', tags:['Sphère','Perçage','Positions'],
    desc:'Un cube de 20 mm et 21 sphères en perçage pour les points.',
    build(){
      resetFor('Dé à jouer');
      const r=2.2, c=[]; const dot=(x,y,z)=>c.push(P_('sphere',{name:'Point',params:{d:2*r,seg:20},hole:true,pos:[x,y,z-r]}));
      dot(0,0,20);                                                     // 1 dessus
      for(const x of [-5,5]) for(const y of [-5,0,5]) dot(x,y,0);      // 6 dessous
      dot(-5,-10,15); dot(5,-10,5);                                    // 2 devant
      for(const [x,z] of [[-5,5],[-5,15],[5,5],[5,15],[0,10]]) dot(x,10,z);  // 5 derrière
      for(const [y,z] of [[-5,15],[0,10],[5,5]]) dot(10,y,z);          // 3 droite
      for(const [y,z] of [[-5,5],[-5,15],[5,5],[5,15]]) dot(-10,y,z); // 4 gauche
      state.parts.push(G_('Dé', WHITE, [0,0,0], [P_('box',{name:'Cube',params:{L:20,l:20,h:20},pos:[0,0,0]}), ...c]));
    },
    note:{observe:['Chaque point est une <b>sphère</b> dont le centre est posé sur une face : elle creuse une demi-sphère.','Les faces opposées font toujours 7 : 1 et 6, 2 et 5, 3 et 4.'],
      try:['Dégroupez et regardez la position X, Y, Z d’un point.','Changez le diamètre des points puis regroupez tout (<span class="kbd">Ctrl</span>+<span class="kbd">A</span> puis <span class="kbd">Ctrl</span>+<span class="kbd">G</span>).']}},

  porteCles:{level:2, cat:'model', title:'Porte-clés', icon:'ex_key', tags:['Esquisse','Texte'],
    desc:'Une plaque dessinée en esquisse cotée, avec un texte en relief.',
    build(){
      resetFor('Porte-clés');
      const s=SKB(); const [o,p2,,p4]=s.poly([[0,0],[50,0],[50,20],[0,20]]);
      s.dx(o,p2,-5); s.dy(o,p4,-5);
      const h=s.circle(6,10,5); s.dx(p4,s.centre(h),9); s.dy(o,s.centre(h),-9); s.diam(h,0.8,3);
      state.parts.push(P_('sketch',{name:'Plaque (esquisse)',params:{sk:s.d,mode:'extrude',h:3},color:'#3a6fc4',pos:[-25,-10,0]}),
        P_('text',{name:'Texte',params:{txt:'TECHNO',size:6,h:1.5,font:'round'},color:WHITE,pos:[3,0,3]}));
    },
    note:{observe:['La plaque est une <b>esquisse</b> : un rectangle de 50 × 20 mm et un cercle de 5 mm qui devient un trou.','Le texte est posé à Z = 3 mm, exactement sur la plaque.'],
      try:['Double-cliquez la plaque pour ouvrir l’esquisse, puis double-cliquez la cote 50 et tapez 60.','Changez le texte dans le panneau des propriétés.']}},

  /* ---------------- Esquisser ---------------- */
  plaque:{level:2, cat:'sketch', title:'Plaque de fixation', icon:'ex_plate', tags:['Cotes','Contraintes','Extrusion'],
    desc:'Esquisse totalement contrainte : cotes en chaîne et cercles égaux.',
    build(){
      resetFor('Plaque de fixation');
      const s=SKB(); const [o,p2,,p4]=s.poly([[0,0],[60,0],[60,30],[0,30]]);
      s.dx(o,p2,-7); s.dy(o,p4,-14);
      const h1=s.circle(8,15,5), c=s.circle(30,15,14), h2=s.circle(52,15,5);
      const H1=s.centre(h1), C=s.centre(c), H2=s.centre(h2);
      s.dx(p4,H1,13.5); s.dx(H1,C,21); s.dx(C,H2,21);
      s.dy(o,H1,-11); s.dy(p2,C,29); s.dy(p2,H2,11);
      s.diam(h1,2.4,4); s.eqr(h1,h2); s.diam(c,0.7,6);
      state.parts.push(P_('sketch',{name:'Plaque (esquisse)',params:{sk:s.d,mode:'extrude',h:4},color:'#2b9a8a',pos:[-30,-15,0]}));
    },
    note:{observe:['Ouvrez l’esquisse (double-clic) : l’état indique <b>0 degré de liberté</b>, tout est défini.','Les deux petits trous portent la contrainte <b>=</b> : changer l’un change l’autre.'],
      try:['Double-cliquez la cote Ø 5 et tapez 6 : les deux trous grandissent.','Changez la cote 60 en 80 : les trous gardent leur distance au bord gauche.','Avec l’outil Sélection, essayez de déplacer un point : il reste bloqué.']},
    },

  pion:{level:3, cat:'sketch', title:'Pion d’échecs', icon:'ex_pawn', tags:['Révolution','Cotes','Profil'],
    desc:'Un demi-profil dessiné à droite de l’axe, tourné sur 360°.',
    build(){
      resetFor('Pion d’échecs');
      const s=SKB();
      const ids=s.poly([[0,0],[12,0],[12,4],[8,6],[5,10],[4,22],[8,24],[8,26],[4,27],[6,30],[6.5,33],[5.5,36],[3,39],[0,40]]);
      const [o,base,,,,,col]=ids; const top=ids[ids.length-1];
      s.dx(o,base,-5); s.dy(o,top,-6); s.dy(base,col,9);
      state.parts.push(P_('sketch',{name:'Pion (révolution)',params:{sk:s.d,mode:'revolve',h:10},color:'#2c3331',pos:[0,0,0]}));
    },
    note:{observe:['Le profil est dessiné à droite de l’<b>axe vertical</b> : la révolution le fait tourner sur un tour complet.','La cote 12 est un <b>rayon</b> : le pion mesure 24 mm de diamètre à la base.'],
      try:['Ouvrez l’esquisse et déplacez un point de la tête pour changer sa forme.','Passez en <b>Extrusion</b> pour voir la différence avec le même profil.']}},

  coeur:{level:3, cat:'sketch', title:'Pendentif cœur', icon:'ex_heart', tags:['Bézier','Extrusion','Cotes'],
    desc:'Quatre courbes de Bézier symétriques forment un cœur.',
    build(){
      resetFor('Pendentif cœur');
      const s=SKB(); const D=s.pt(0,8), R=s.pt(17,6), T=s.pt(0,-16), L=s.pt(-17,6);
      s.bez(D,R,[0,9],[0,10]); s.bez(R,T,[0,-9],[8,8]); s.bez(T,L,[-8,8],[0,-9]); s.bez(L,D,[0,10],[0,9]);
      const h=s.circle(-9,9,3.5); s.diam(h,2.6,3);
      s.dx(L,R,-26); s.dy(T,D,-24);
      state.parts.push(P_('sketch',{name:'Cœur (esquisse)',params:{sk:s.d,mode:'extrude',h:3},color:'#c45b8e',pos:[0,0,0]}));
    },
    note:{observe:['Le contour est fait de <b>4 courbes de Bézier</b> : chacune va d’un point à un autre et se règle avec deux <b>poignées</b>.','Le trou d’accroche est un cercle dessiné à l’intérieur du contour.'],
      try:['Ouvrez l’esquisse, prenez l’outil Sélection et tirez une poignée (petit rond) pour changer la forme.','Tapez 40 dans la cote 34 : le cœur s’élargit en gardant ses courbes.']}},

  vase:{level:3, cat:'sketch', title:'Vase', icon:'ex_vase', tags:['Bézier','Révolution','Creux'],
    desc:'Un profil courbe avec une paroi de 2 mm, tourné sur 360°.',
    build(){
      resetFor('Vase');
      const s=SKB(); const A0=1, A1=s.pt(15,0), A2=s.pt(9,42), A3=s.pt(12,47), A4=s.pt(10,47), A5=s.pt(7,42), A7=s.pt(13,2), A8=s.pt(0,2);
      s.line(A0,A1); s.bez(A1,A2,[12,14],[9,-14]); s.line(A2,A3); s.line(A3,A4); s.line(A4,A5); s.bez(A5,A7,[9,-14],[12,12]); s.line(A7,A8); s.line(A8,A0);
      s.dx(A0,A1,-5); s.dy(A0,A3,-7);
      state.parts.push(P_('sketch',{name:'Vase (révolution)',params:{sk:s.d,mode:'revolve',h:10},color:'#3d8bd0',pos:[0,0,0]}));
    },
    note:{observe:['Deux courbes de Bézier dessinent la <b>paroi extérieure</b> et la <b>paroi intérieure</b> : l’écart entre elles donne l’épaisseur.','La ligne du bas, à 2 mm, forme le <b>fond</b> du vase.'],
      try:['Ouvrez l’esquisse et tirez les poignées de la courbe extérieure pour rendre le vase plus ventru.','Passez en <b>Extrusion</b> pour voir le profil seul, puis revenez en <b>Révolution</b>.']}},

  /* ---------------- Mettre en mouvement ---------------- */
  barriere:{level:2, cat:'move', title:'Barrière de parking', icon:'ex_barrier', tags:['Pivot','Butées','Encastrement'],
    desc:'Une lisse qui se lève de 0 à 90° et redescend.',
    build(){
      resetFor('Barrière de parking');
      const road=P_('box',{name:'Chaussée',params:{L:100,l:80,h:0.6},color:'#7d8a86',pos:[64,0,0]});
      const post=P_('box',{name:'Borne',params:{L:14,l:14,h:36},color:'#e6a23a',pos:[0,0,0]});
      const lamp=P_('sphere',{name:'Feu',params:{d:6,seg:24},color:'#4aa36b',pos:[0,0,36]});
      const boom=P_('box',{name:'Lisse',params:{L:110,l:4,h:5},color:WHITE,pos:[62,0,30]});
      const band1=P_('box',{name:'Bande 1',params:{L:12,l:4.6,h:5.6},color:'#e4574b',pos:[40,0,29.7]});
      const band2=P_('box',{name:'Bande 2',params:{L:12,l:4.6,h:5.6},color:'#e4574b',pos:[80,0,29.7]});
      const cw=P_('box',{name:'Contrepoids',params:{L:12,l:8,h:9},color:DARK,pos:[-13,0,28]});
      state.parts.push(road,post,lamp,boom,band1,band2,cw);
      J_({name:'L1 Pivot de la lisse',type:'pivot',child:boom.id,parent:post.id,origin:[0,0,32.5],axis:'y',min:-90,max:0,motor:{mode:'alternatif',speed:30}});
      J_({name:'L2 Bande 1',type:'fixe',child:band1.id,parent:boom.id,origin:[40,0,32.5]});
      J_({name:'L3 Bande 2',type:'fixe',child:band2.id,parent:boom.id,origin:[80,0,32.5]});
      J_({name:'L4 Contrepoids',type:'fixe',child:cw.id,parent:boom.id,origin:[-12,0,32.5]});
    },
    note:{observe:['Une seule liaison <b>pivot</b> (axe Y) porte un moteur <b>aller-retour</b> limité par des <b>butées</b> de −90° à 0°.','Les bandes et le contrepoids sont <b>encastrés</b> sur la lisse : ils la suivent.'],
      try:['Mettez la simulation en pause et bougez le curseur de L1.','Modifiez L1 pour une butée à −60° : la barrière s’ouvre moins.']}},

  gears:{level:3, cat:'move', title:'Engrenages et crémaillère', icon:'gear', tags:['Engrenage','Pignon-crémaillère','Glissière'],
    desc:'Une roue Z20 entraîne un pignon Z10 et une crémaillère.',
    build(){
      resetFor('Engrenages et crémaillère');
      const plate=P_('box',{name:'Platine',params:{L:170,l:80,h:5},color:WHITE,pos:[0,-8,0]});
      const g1=P_('gear',{name:'Roue menante Z20',params:{z:20,m:2,e:6,dh:5},color:'#e6a23a',pos:[0,0,5]});
      const g2=P_('gear',{name:'Pignon Z10',params:{z:10,m:2,e:6,dh:5},color:'#3d8bd0',pos:[30,0,5],rot:[0,0,18]});
      const rack=P_('rack',{name:'Crémaillère',params:{n:12,m:2,e:6,hb:6},color:'#8a6c55',pos:[0,-20,5]});
      const rail=P_('box',{name:'Guide',params:{L:170,l:4,h:6},color:GREY,pos:[0,-30.6,5]});
      const ax1=P_('cylinder',{name:'Axe 1',params:{d:5,h:14,seg:24},color:DARK,pos:[0,0,5]});
      const ax2=P_('cylinder',{name:'Axe 2',params:{d:5,h:14,seg:24},color:DARK,pos:[30,0,5]});
      const crank=P_('cylinder',{name:'Manivelle',params:{d:5,h:8,seg:24},color:'#e4574b',pos:[0,13,11]});
      state.parts.push(plate,g1,g2,rack,rail,ax1,ax2,crank);
      const j1=J_({name:'L1 Pivot roue menante',type:'pivot',child:g1.id,parent:plate.id,origin:[0,0,8],axis:'z',min:-90,max:90,motor:{mode:'alternatif',speed:45}});
      J_({name:'L2 Pivot pignon',type:'pivot',child:g2.id,parent:plate.id,origin:[30,0,8],axis:'z',driver:{joint:j1.id,ratio:-2}});
      J_({name:'L3 Glissière crémaillère',type:'glissiere',child:rack.id,parent:plate.id,origin:[0,-20,8],axis:'x',driver:{joint:j1.id,ratio:+(Math.PI*40/360).toFixed(5)}});
      J_({name:'L4 Manivelle',type:'fixe',child:crank.id,parent:g1.id,origin:[0,13,11]});
    },
    note:{observe:['Le pignon Z10 tourne <b>2 fois plus vite</b> et en <b>sens inverse</b> : rapport −20/10 = −2.','La crémaillère avance de π × d / 360 = <b>0,35 mm par degré</b> (d = 40 mm).'],
      try:['Cliquez la roue menante : le panneau des propriétés donne son diamètre primitif d = m × Z.','Modifiez L2 et utilisez <b>Calculer le rapport</b> avec d’autres nombres de dents.']}},

  reducteur:{level:3, cat:'move', title:'Réducteur à deux étages', icon:'ex_reducer', tags:['Train d’engrenages','Rapport','Moteur continu'],
    desc:'Deux étages Z10 → Z30 : la sortie tourne 9 fois moins vite.',
    build(){
      resetFor('Réducteur à deux étages');
      const plate=P_('box',{name:'Platine',params:{L:130,l:64,h:4},color:WHITE,pos:[40,0,0]});
      const gp={m:2,e:6,dh:4};
      const pA=P_('gear',{name:'Pignon moteur Z10',params:{z:10,...gp},color:'#3d8bd0',pos:[0,0,4]});
      const gB=P_('gear',{name:'Roue Z30 (étage 1)',params:{z:30,...gp},color:'#e6a23a',pos:[40,0,4],rot:[0,0,6]});
      const pB=P_('gear',{name:'Pignon Z10 (étage 2)',params:{z:10,...gp},color:'#3d8bd0',pos:[40,0,10]});
      const gC=P_('gear',{name:'Roue de sortie Z30',params:{z:30,...gp},color:'#4aa36b',pos:[80,0,10],rot:[0,0,6]});
      const motor=P_('cylinder',{name:'Moteur',params:{d:13,h:16,seg:32},color:DARK,pos:[0,0,11]});
      const ax2=P_('cylinder',{name:'Axe intermédiaire',params:{d:4,h:22,seg:24},color:DARK,pos:[40,0,4]});
      const ax3=P_('cylinder',{name:'Axe de sortie',params:{d:4,h:16,seg:24},color:DARK,pos:[80,0,4]});
      const mark=P_('cylinder',{name:'Repère étage 1',params:{d:4,h:1.5,seg:24},color:'#e4574b',pos:[62,0,10]});
      const needle=P_('box',{name:'Aiguille de sortie',params:{L:3,l:26,h:2},color:'#e4574b',pos:[80,13,16]});
      state.parts.push(plate,motor,pA,gB,pB,gC,ax2,ax3,mark,needle);
      const j1=J_({name:'L1 Moteur',type:'pivot',child:pA.id,parent:plate.id,origin:[0,0,4],axis:'z',motor:{mode:'continu',speed:180}});
      const j2=J_({name:'L2 Étage 1',type:'pivot',child:gB.id,parent:plate.id,origin:[40,0,4],axis:'z',driver:{joint:j1.id,ratio:+(-10/30).toFixed(5)}});
      J_({name:'L3 Pignon sur roue',type:'fixe',child:pB.id,parent:gB.id,origin:[40,0,10]});
      J_({name:'L4 Repère',type:'fixe',child:mark.id,parent:gB.id,origin:[62,0,10]});
      J_({name:'L5 Étage 2 (sortie)',type:'pivot',child:gC.id,parent:plate.id,origin:[80,0,10],axis:'z',driver:{joint:j2.id,ratio:+(-10/30).toFixed(5)}});
      J_({name:'L6 Aiguille',type:'fixe',child:needle.id,parent:gC.id,origin:[80,0,16]});
    },
    note:{observe:['Chaque étage divise la vitesse par 3 : rapport global (10/30) × (10/30) = <b>1/9</b>.','Le moteur tourne à 180 °/s, l’aiguille de sortie à <b>20 °/s</b>, dans le même sens (deux inversions).','Le pignon de l’étage 2 est <b>encastré</b> sur la roue de l’étage 1 : ils tournent ensemble.'],
      try:['Comparez les valeurs de L1 et L5 pendant la simulation.','Mettez −1 comme rapport de L5 : la roue verte tourne alors aussi vite que la roue orange.']}},

  poulies:{level:3, cat:'move', title:'Poulies et courroie', icon:'ex_pulley', tags:['Poulies','Groupe','Moteur continu'],
    desc:'Poulie Ø40 vers poulie Ø20 : la petite tourne 2 fois plus vite.',
    build(){
      resetFor('Poulies et courroie');
      const plate=P_('box',{name:'Support',params:{L:120,l:60,h:5},color:WHITE,pos:[20,0,0]});
      const pulley=(name,d,x,color)=>G_(name,color,[x,0,5],[
        P_('cylinder',{name:'Disque',params:{d,h:8,seg:64},pos:[0,0,0]}),
        P_('torus',{name:'Gorge',params:{d,e:4,seg:64},hole:true,pos:[0,0,2]}),
        P_('cylinder',{name:'Alésage',params:{d:5,h:20,seg:24},hole:true,pos:[0,0,-5]}),
        P_('cylinder',{name:'Allègement',params:{d:d*0.2,h:20,seg:24},hole:true,pos:[d*0.27,0,-5]}),
      ]);
      const p1=pulley('Poulie menante Ø40',40,0,'#e4574b'), p2=pulley('Poulie menée Ø20',20,55,'#3d8bd0');
      const belt1=P_('box',{name:'Courroie (haut)',params:{L:55,l:2,h:3},color:DARK,pos:[27.5,15,7.5],rot:[0,0,-10.47]});
      const belt2=P_('box',{name:'Courroie (bas)',params:{L:55,l:2,h:3},color:DARK,pos:[27.5,-15,7.5],rot:[0,0,10.47]});
      const ax1=P_('cylinder',{name:'Axe 1',params:{d:5,h:16,seg:24},color:DARK,pos:[0,0,5]});
      const ax2=P_('cylinder',{name:'Axe 2',params:{d:5,h:16,seg:24},color:DARK,pos:[55,0,5]});
      state.parts.push(plate,p1,p2,belt1,belt2,ax1,ax2);
      const j1=J_({name:'L1 Moteur',type:'pivot',child:p1.id,parent:plate.id,origin:[0,0,9],axis:'z',motor:{mode:'continu',speed:60}});
      J_({name:'L2 Poulie menée',type:'pivot',child:p2.id,parent:plate.id,origin:[55,0,9],axis:'z',driver:{joint:j1.id,ratio:2}});
    },
    note:{observe:['Rapport = Ø menante / Ø menée = 40 / 20 = <b>2</b>, et les poulies tournent dans le <b>même sens</b>.','Chaque poulie est un <b>groupe</b> : un disque creusé par une gorge (tore), un alésage et un trou d’allègement.','La courroie est dessinée immobile : seul le mouvement des poulies est simulé.'],
      try:['Dégroupez une poulie pour voir ses trois perçages.','Changez le rapport de L2 à 0,5 : la petite poulie ralentit.']}},

  etau:{level:3, cat:'move', title:'Étau (vis-écrou)', icon:'ex_vise', tags:['Vis-écrou','Glissière','Encastrement'],
    desc:'Tourner la vis fait avancer le mors mobile de 2 mm par tour.',
    build(){
      resetFor('Étau');
      const base=P_('box',{name:'Corps',params:{L:110,l:44,h:6},color:GREY,pos:[0,0,0]});
      const fixed=P_('box',{name:'Mors fixe',params:{L:10,l:44,h:26},color:GREY,pos:[45,0,6]});
      const jaw=P_('box',{name:'Mors mobile',params:{L:10,l:44,h:26},color:'#e4574b',pos:[-5,0,6]});
      const piece=P_('box',{name:'Pièce à serrer',params:{L:19.5,l:24,h:14},color:'#3d8bd0',pos:[30.25,0,6]});
      const screw=P_('cylinder',{name:'Vis (pas 2 mm)',params:{d:8,h:100,seg:32},color:'#c9ced1',pos:[-58,0,19],rot:[0,90,0]});
      const handle=G_('Manivelle', DARK, [-62,0,19], [
        P_('cylinder',{name:'Barre',params:{d:5,h:50,seg:24},pos:[0,25,0],rot:[90,0,0]}),
        P_('sphere',{name:'Moyeu',params:{d:11,seg:24},pos:[0,0,-5.5]}),
        P_('sphere',{name:'Boule 1',params:{d:9,seg:24},pos:[0,25,-4.5]}),
        P_('sphere',{name:'Boule 2',params:{d:9,seg:24},pos:[0,-25,-4.5]}),
      ]);
      state.parts.push(base,fixed,jaw,piece,screw,handle);
      const j1=J_({name:'L1 Pivot de la vis',type:'pivot',child:screw.id,parent:base.id,origin:[0,0,19],axis:'x',min:0,max:3600,motor:{mode:'alternatif',speed:720}});
      J_({name:'L2 Manivelle',type:'fixe',child:handle.id,parent:screw.id,origin:[-62,0,19]});
      J_({name:'L3 Glissière du mors',type:'glissiere',child:jaw.id,parent:base.id,origin:[0,0,19],axis:'x',driver:{joint:j1.id,ratio:+(2/360).toFixed(6)}});
    },
    note:{observe:['La vis fait <b>10 tours</b> (3 600°). Avec un pas de 2 mm, le mors avance de <b>20 mm</b> et touche la pièce.','Le rapport de L3 vaut pas / 360 = <b>0,0056 mm par degré</b>.'],
      try:['Dans L3, choisissez <b>Vis et écrou</b> dans « Calculer le rapport », tapez un pas de 4 mm puis Appliquer.','Que se passe-t-il ? Ajustez la butée max de L1 pour que le mors s’arrête sur la pièce.']}},

  bras:{level:2, cat:'move', title:'Bras articulé', icon:'ex_arm', tags:['Pivots en chaîne','Butées'],
    desc:'Tourelle, épaule et coude : chaque pivot porte le suivant.',
    build(){
      resetFor('Bras articulé');
      const base=P_('cylinder',{name:'Socle',params:{d:44,h:8,seg:64},color:GREY,pos:[0,0,0]});
      const tur=P_('cylinder',{name:'Tourelle',params:{d:24,h:22,seg:48},color:'#e6a23a',pos:[0,0,8]});
      const sh=P_('cylinder',{name:'Épaule',params:{d:14,h:16,seg:32},color:DARK,pos:[0,8,32],rot:[90,0,0]});
      const a1=P_('box',{name:'Bras',params:{L:60,l:10,h:8},color:'#3a6fc4',pos:[25,0,28]});
      const el=P_('cylinder',{name:'Coude',params:{d:11,h:13,seg:32},color:DARK,pos:[50,6.5,32],rot:[90,0,0]});
      const a2=P_('box',{name:'Avant-bras',params:{L:45,l:8,h:6},color:'#4aa36b',pos:[67.5,0,29]});
      const pince=P_('sphere',{name:'Pince',params:{d:12,seg:32},color:'#e4574b',pos:[90,0,26]});
      state.parts.push(base,tur,sh,a1,el,a2,pince);
      J_({name:'L1 Rotation tourelle',type:'pivot',child:tur.id,parent:base.id,origin:[0,0,10],axis:'z',min:-60,max:60,motor:{mode:'alternatif',speed:30}});
      J_({name:'L2 Épaule',type:'fixe',child:sh.id,parent:tur.id,origin:[0,0,32]});
      J_({name:'L3 Pivot épaule',type:'pivot',child:a1.id,parent:tur.id,origin:[0,0,32],axis:'y',min:-35,max:5,motor:{mode:'alternatif',speed:18}});
      J_({name:'L4 Coude',type:'fixe',child:el.id,parent:a1.id,origin:[50,0,32]});
      J_({name:'L5 Pivot coude',type:'pivot',child:a2.id,parent:a1.id,origin:[50,0,32],axis:'y',min:-50,max:10,motor:{mode:'alternatif',speed:35}});
      J_({name:'L6 Pince',type:'fixe',child:pince.id,parent:a2.id,origin:[90,0,32]});
    },
    note:{observe:['Le bras est <b>porté</b> par la tourelle, l’avant-bras par le bras : chaque mouvement s’ajoute au précédent.','Trois moteurs aller-retour à des vitesses différentes donnent un mouvement complexe.'],
      try:['Mettez en pause, puis pilotez chaque pivot avec son curseur.','Supprimez le moteur de L1 (Modifier → Manuelle) et observez.']}},

  eolienne:{level:2, cat:'move', title:'Éolienne', icon:'ex_wind', tags:['Pivot continu','Groupe','Axe X'],
    desc:'Le rotor tourne sans fin pendant que la nacelle s’oriente.',
    build(){
      resetFor('Éolienne');
      const foot=P_('cylinder',{name:'Fondation',params:{d:26,h:4,seg:48},color:GREY,pos:[0,0,0]});
      const mast=P_('cone',{name:'Mât',params:{d:8,d2:5,h:76,seg:32},color:WHITE,pos:[0,0,4]});
      const nac=P_('box',{name:'Nacelle',params:{L:26,l:10,h:10},color:WHITE,pos:[6,0,80]});
      const rotor=G_('Rotor', WHITE, [21,0,85], [
        P_('sphere',{name:'Moyeu',params:{d:10,seg:32},pos:[0,0,-5]}),
        P_('box',{name:'Pale 1',params:{L:2,l:6,h:38},pos:[0,0,0],rot:[0,0,0]}),
        P_('box',{name:'Pale 2',params:{L:2,l:6,h:38},pos:[0,0,0],rot:[120,0,0]}),
        P_('box',{name:'Pale 3',params:{L:2,l:6,h:38},pos:[0,0,0],rot:[240,0,0]}),
      ]);
      state.parts.push(foot,mast,nac,rotor);
      J_({name:'L1 Orientation nacelle',type:'pivot',child:nac.id,parent:mast.id,origin:[0,0,80],axis:'z',min:-45,max:45,motor:{mode:'alternatif',speed:12}});
      J_({name:'L2 Rotor',type:'pivot',child:rotor.id,parent:nac.id,origin:[21,0,85],axis:'x',motor:{mode:'continu',speed:120}});
    },
    note:{observe:['Le rotor est un <b>groupe</b> (moyeu + 3 pales tournées de 120°) : une seule liaison suffit.','L2 est posée sur la nacelle : quand la nacelle s’oriente, l’axe du rotor tourne avec elle.'],
      try:['Changez la vitesse du rotor (Modifier → Vitesse).','Dégroupez le rotor pour voir l’angle de chaque pale (Rotation X).']}},

  /* ---------------- Structures ---------------- */
  pontWarren:{level:2, cat:'struct', mod:'treillis', title:'Pont en treillis', icon:'ex_bridge', tags:['Treillis','Traction','Compression'],
    desc:'Un pont de 40 cm en baguettes de bois chargé de 60 kg.',
    build(){
      resetFor('Pont en treillis'); const S=state.struct; S.mod='treillis'; const T=S.truss; T.mat='bois'; T.sec='plein'; T.D=6;
      const bot=[0,80,160,240,320,400].map(x=>newNode(x,0)), top=[40,120,200,280,360].map(x=>newNode(x,70));
      for(let i=0;i<5;i++){ newBar(bot[i].id,bot[i+1].id); newBar(bot[i].id,top[i].id); newBar(top[i].id,bot[i+1].id); if(i<4) newBar(top[i].id,top[i+1].id); }
      bot[0].sup='fixe'; bot[5].sup='glissant'; for(let i=1;i<5;i++) bot[i].fy=-150;
    },
    note:{observe:['Les barres du haut sont <b>comprimées</b> (rouge), celles du bas <b>tendues</b> (bleu).','Le triangle est la forme qui ne se déforme pas : c’est le principe du treillis.'],
      try:['Augmentez les forces (outil Sélection, cliquez un nœud du bas) jusqu’à ce qu’une barre casse.','Supprimez une diagonale : la structure devient instable.','Passez les barres du haut en <b>tube</b> pour éviter le flambage.']}},

  grue:{level:2, cat:'struct', mod:'treillis', title:'Grue en tubes', icon:'ex_crane', tags:['Tube','Cylindres imbriqués','Porte-à-faux'],
    desc:'Un mât et une flèche en tubes d’aluminium portent 8 kg au bout.',
    build(){
      resetFor('Grue en tubes'); const S=state.struct; S.mod='treillis'; const T=S.truss; T.mat='alu'; T.sec='tube'; T.D=10; T.d=8; T.labels=false;
      const L=[], R=[]; for(let k=0;k<=5;k++){ L.push(newNode(0,k*60)); R.push(newNode(40,k*60)); }
      for(let k=0;k<5;k++){ newBar(L[k].id,L[k+1].id); newBar(R[k].id,R[k+1].id); newBar(L[k+1].id,R[k+1].id); newBar(k%2?L[k].id:R[k].id, k%2?R[k+1].id:L[k+1].id); }
      newBar(L[0].id,R[0].id); L[0].sup='fixe'; R[0].sup='fixe';
      const tp=[R[5]], bt=[R[4]]; for(const x of [100,160,220,280]){ tp.push(newNode(x,300)); bt.push(newNode(x,240)); }
      for(let k=0;k<4;k++){ newBar(tp[k].id,tp[k+1].id); newBar(bt[k].id,bt[k+1].id); newBar(tp[k+1].id,bt[k+1].id); newBar(tp[k].id,bt[k+1].id); }
      bt[4].fy=-80;
    },
    note:{observe:['Chaque barre est un <b>tube</b> : deux cylindres imbriqués, Ø 10 mm dehors et Ø 8 mm dedans.','La flèche travaille en porte-à-faux : le dessus est tendu, le dessous comprimé.'],
      try:['Cliquez une barre et passez-la en <b>cylindre plein</b> Ø 10 : la masse augmente beaucoup, la flèche change peu.','Ajoutez 20 kg (Fy = −200 N) au bout : quelle barre lâche en premier ?']}},

  pontSuspendu:{level:2, cat:'struct', mod:'treillis', title:'Pont suspendu', icon:'ex_suspension', tags:['Câbles','Traction seule','Pylônes'],
    desc:'Le tablier est pendu à un câble porteur tenu par deux pylônes.',
    build(){
      resetFor('Pont suspendu'); const S=state.struct; S.mod='treillis'; const T=S.truss; T.mat='acier'; T.sec='cable'; T.D=1.5; T.labels=false;
      const deck=[], top=[]; for(let x=100;x<=500;x+=50){ deck.push(newNode(x,40)); top.push(newNode(x,60)); }
      deck[0].sup='fixe'; deck[deck.length-1].sup='glissant';
      const T1=newNode(100,220), T2=newNode(500,220), A1=newNode(-40,40), A2=newNode(640,40); A1.sup='fixe'; A2.sup='fixe';
      const tw=(a,b)=>Object.assign(newBar(a,b),{sec:'tube',D:12,d:9,mat:'alu'}), wd=(a,b)=>Object.assign(newBar(a,b),{sec:'plein',D:6,mat:'bois'});
      tw(top[0].id,T1.id); tw(top[top.length-1].id,T2.id);
      // tablier : poutre de rigidité en treillis
      for(let k=0;k<deck.length;k++){ wd(deck[k].id,top[k].id); if(k<deck.length-1){ wd(deck[k].id,deck[k+1].id); wd(top[k].id,top[k+1].id); wd(k<4?deck[k].id:top[k].id, k<4?top[k+1].id:deck[k+1].id); } }
      const cab=[T1]; for(let x=150;x<=450;x+=50) cab.push(newNode(x, +(90+130*((x-300)/200)**2).toFixed(2))); cab.push(T2);
      newBar(A1.id,T1.id); newBar(T2.id,A2.id); for(let k=0;k<cab.length-1;k++) newBar(cab[k].id,cab[k+1].id);
      for(let k=1;k<cab.length-1;k++) Object.assign(newBar(cab[k].id,top[k].id),{D:1});
      for(let k=1;k<top.length-1;k++) top[k].fy=-40;
    },
    note:{observe:['Les <b>câbles</b> ne travaillent qu’en traction : ils sont fins mais très résistants.','Le câble porteur forme une parabole ; les suspentes y accrochent le tablier, raidi par une <b>poutre en treillis</b>.'],
      try:['Mettez une forte force vers le haut sur le tablier : des suspentes se <b>détendent</b> (gris pointillé).','Supprimez un câble d’ancrage : le pylône bascule, la structure devient instable.','Supprimez les diagonales du tablier : sans poutre de rigidité, le pont devient un mécanisme.']}},

  plongeoir:{level:2, cat:'struct', mod:'maillage', title:'Plongeoir', icon:'ex_board', tags:['Maillage','Encastrement','Flèche'],
    desc:'Une planche de 2,40 m encastrée, un plongeur de 80 kg au bout.',
    build(){ resetFor('Plongeoir'); const S=state.struct; S.mod='maillage'; Object.assign(S.mesh,{shape:'poutre', t:500, mat:'bois', sup:'encastre', load:'pointe', F:800, grav:true, dens:2, view:'vm'}); Object.assign(S.mesh.P,{L:2400,h:60}); },
    note:{observe:['La planche est <b>encastrée</b> à gauche : la contrainte est la plus forte près de l’encastrement.','Le calcul à la main (RDM) et le maillage donnent presque la même flèche.'],
      try:['Mettez la déformée en <b>Réelle (×1)</b> : c’est vraiment ce que l’on voit au bord de la piscine.','Doublez l’épaisseur (Hauteur 120) : la flèche est divisée par 8, pas par 2 !']}},

  plancher:{level:2, cat:'struct', mod:'maillage', title:'Plancher simple', icon:'ex_floor', tags:['Deux appuis','Charge répartie','Traction / compression'],
    desc:'Une solive de 3 m posée sur deux murs, chargée sur toute sa longueur.',
    build(){ resetFor('Plancher simple'); const S=state.struct; S.mod='maillage'; Object.assign(S.mesh,{shape:'poutre', t:75, mat:'bois', sup:'appuis', load:'reparti', F:4000, grav:true, dens:2, view:'tc'}); Object.assign(S.mesh.P,{L:3000,h:150}); },
    note:{observe:['Le dessus de la solive est <b>comprimé</b> (rouge), le dessous <b>tendu</b> (bleu).','Au milieu de la hauteur, la fibre neutre ne travaille presque pas.'],
      try:['Passez le matériau en <b>béton</b> : la traction en bas dépasse ce que le béton supporte. C’est pour cela qu’on y met des armatures d’acier.','Comparez « Charge répartie » et « Force au milieu » avec la même force totale.']}},

  voute:{level:2, cat:'struct', mod:'maillage', title:'Voûte en pierre', icon:'ex_vault', tags:['Arc','Compression','Pierre'],
    desc:'Un arc de pierre de 3 m qui porte 5 tonnes au sommet.',
    build(){ resetFor('Voûte en pierre'); const S=state.struct; S.mod='maillage'; Object.assign(S.mesh,{shape:'arc', t:1000, mat:'pierre', sup:'pieds', load:'centre', F:50000, grav:true, dens:1, view:'tc'}); Object.assign(S.mesh.P,{Ri:1500,e:300}); },
    note:{observe:['Presque toute la voûte est <b>comprimée</b> : la pierre y résiste très bien.','C’est pourquoi les ponts et les cathédrales en pierre utilisent des arcs, pas des poutres droites.'],
      try:['Passez la forme en <b>Poutre</b> de même portée et même matériau : la pierre casse en traction.','Diminuez l’épaisseur de l’arc jusqu’à la limite.']}},

  potence:{level:2, cat:'struct', mod:'maillage', title:'Point suspendu', icon:'ex_hook', tags:['Potence','Charge suspendue','Concentration'],
    desc:'Une potence en bois porte une charge de 50 kg suspendue au bout du bras.',
    build(){ resetFor('Point suspendu'); const S=state.struct; S.mod='maillage'; Object.assign(S.mesh,{shape:'L', t:80, mat:'bois', sup:'pieds', load:'suspendu', F:500, grav:true, dens:2, view:'vm'}); Object.assign(S.mesh.P,{H:1200,w:80,La:900,ha:80}); },
    note:{observe:['La contrainte se concentre dans l’<b>angle</b> entre le poteau et le bras.','Le pied du poteau travaille aussi beaucoup : il retient tout le bras.'],
      try:['Augmentez la hauteur du bras : la flèche au bout diminue nettement.','Essayez l’<b>acier</b> avec des dimensions plus petites.']}},
};
const CATS=[['model','Modéliser avec des volumes'],['sketch','Esquisser et coter'],['move','Mettre en mouvement'],['struct','Simuler la déformation']];

function loadExample(k){
  const S=SAMPLES[k]; if(!S) return;
  if(S.level>prefs.level){ setLevel(S.level,true); setTimeout(()=>toast(`Niveau ${LEVELS[S.level-1].name} activé pour cet exemple.`),50); }
  closeBubble(); ST.anim.on=false; ST.k=1; resetAmpRef(); simReset(true); S.build();
  state.note={key:k, title:S.title, observe:S.note.observe, try:S.note.try};
  selection=[]; selJoint=null; jf=null;
  S.after?.();
  $('#projName').value=state.name; demoClosed=false; demoOpen=!matchMedia('(max-width: 860px)').matches;
  ST.sel=null; ST.fitted=false;
  const target= S.cat==='struct'? 'struct' : S.cat==='move'? 'mech' : 'model';
  if(target==='mech') for(const p of state.parts) validatePart(p);
  sync(); commit(); renderDemo(); fitView();
  setWs(target);
  $('#gallery').hidden=true;
}

/* ---- gallery */
function renderGallery(){
  const wrap=$('#galleryBody'); wrap.innerHTML='';
  for(const [cat,label] of CATS){
    const grid=h('div',{class:'gal-grid'});
    for(const [k,S] of Object.entries(SAMPLES)) if(S.cat===cat){
      grid.append(h('button',{class:'gal-card',onclick:()=>loadExample(k)},
        svgIcon(S.icon),
        h('div',{class:'gal-txt'}, h('div',{class:'gal-title'}, h('b',{},S.title), h('span',{class:'gal-lvl l'+S.level},LEVELS[S.level-1].name)), h('span',{},S.desc), h('div',{class:'gal-tags'}, S.tags.map(t=>h('span',{class:'gal-tag'},t))))));
    }
    wrap.append(h('section',{class:'gal-sec'}, h('h3',{},label), grid));
  }
}
function openGallery(){ renderGallery(); $('#gallery').hidden=false; $('#galleryBody').scrollTop=0; }

/* ---- demo note card, shown in the scene */
let demoClosed=false, demoOpen=true;
function renderDemo(){
  const el=$('#demo'); const n=state.note;
  if(!n || demoClosed){ el.hidden=true; applyViewOffset(); return; }
  placeDemo(); el.hidden=false; el.classList.toggle('closed',!demoOpen); el.innerHTML='';
  const grip=h('span',{class:'pgrip demo-grip',title:'Glisser pour déplacer la fiche'}, svgIcon('dots')); grip.addEventListener('pointerdown',e=>{ if(!el.classList.contains('in-tree')) startPanelDrag(e, el, 'demo'); });
  const head=h('div',{class:'demo-head'}, grip,
    h('button',{class:'demo-toggle','aria-expanded':String(demoOpen),onclick:()=>{ demoOpen=!demoOpen; renderDemo(); }},
      h('span',{class:'demo-kicker'},'Fiche démo'), h('b',{},n.title), svgIcon(demoOpen?'chevUp':'chevDown')),
    h('button',{class:'btn icon ghost',title:'Fermer la fiche','aria-label':'Fermer la fiche',onclick:()=>{ demoClosed=true; renderDemo(); }}, svgIcon('close')));
  el.append(head);
  if(demoOpen){
    const list=(title,items)=>h('div',{class:'demo-sec'}, h('h4',{},title), h('ul',{}, items.map(t=>h('li',{html:t}))));
    el.append(list('À observer',n.observe), list('À essayer',n.try),
      h('button',{class:'btn demo-more',onclick:openGallery}, svgIcon('book'),'Autres exemples'));
  }
  applyLayout('demo'); applyViewOffset();
}
