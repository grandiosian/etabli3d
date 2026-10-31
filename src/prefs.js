
/* =========================================================
   Preferences: level (débutant / intermédiaire / avancé) and appearance.
   Stored in this browser only.
   Levels are applied with CSS: <html data-level="n">, and elements marked
   data-min="2|3" (shown from that level) or data-max="n" (hidden above it).
   ========================================================= */
const PREFS_KEY='etabli3d.prefs';
const prefs=(()=>{ let p={}; try{ p=JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')||{}; }catch(e){}
  return { level:[1,2,3].includes(p.level)? p.level : 1, firstVisit:!p.level,
    theme:['auto','light','dark'].includes(p.theme)? p.theme : 'auto',
    accent:p.accent||'vert', mat:p.mat||'vert', tree:p.tree!==false, axes:p.axes||'classique', labels:p.labels!==false,
    glass:['transparent','leger','opaque'].includes(p.glass)? p.glass : 'transparent',
    lmb:['select','orbit','pan'].includes(p.lmb)? p.lmb : 'orbit', ortho:!!p.ortho, shadows:!!p.shadows, light:['studio','doux','contraste','soleil'].includes(p.light)? p.light : 'studio', rmode:['plein','texture','aretes','filaire','xray'].includes(p.rmode)? p.rmode : 'plein', tex:['impression','bois','metal','damier'].includes(p.tex)? p.tex : 'impression', hq:!!p.hq, ref:['auto','aucun','piece','pomme','canette','personne','voiture','immeuble','avion'].includes(p.ref)? p.ref : 'auto', nav:['auto','show','hide'].includes(p.nav)? p.nav : 'auto',
    jl: p.jlv===2 && ['orbite','libre','ligne','colonne','carre','rect','cercle'].includes(p.jl)? p.jl : 'orbite', jlv:2 }; })();
function savePrefs(){ try{ const {firstVisit,...keep}=prefs; localStorage.setItem(PREFS_KEY, JSON.stringify(keep)); }catch(e){} }
const lv=n=>prefs.level>=n;

const LEVELS=[
  {n:1, name:'Débutant', short:'Déb.', desc:'Volumes simples, perçages, groupes, couleurs.'},
  {n:2, name:'Intermédiaire', short:'Inter.', desc:'+ esquisses cotées, courbes de Bézier, tube et tore, liaisons et moteurs.'},
  {n:3, name:'Avancé', short:'Av.', desc:'+ engrenages, transmissions, révolution, arborescence.'},
];

/* ---- appearance */
const ACCENTS={
  vert:   {name:'Vert atelier', light:['#1d7656','#d3e9de'], dark:['#4cb889','#1c3a2f']},
  bleu:   {name:'Bleu',         light:['#2361b0','#d8e5f6'], dark:['#6aa5ee','#1c2d45']},
  violet: {name:'Violet',       light:['#6b46b8','#e6ddf6'], dark:['#a98ae8','#2c2343']},
  orange: {name:'Orange',       light:['#b4530f','#f8e2d0'], dark:['#f0954f','#3d2717']},
  rouge:  {name:'Framboise',    light:['#b3264d','#f6d7e0'], dark:['#ef7896','#3d1c26']},
};
const MATS={
  vert:  {name:'Tapis vert',  fill:'#2c7457', edge:0x22604a, ink:'255,255,255'},
  bleu:  {name:'Tapis bleu',  fill:'#2a5f8f', edge:0x214d75, ink:'255,255,255'},
  gris:  {name:'Tapis gris',  fill:'#4b5551', edge:0x3b4441, ink:'255,255,255'},
  sable: {name:'Contreplaqué',fill:'#d2bd92', edge:0xa8946c, ink:'60,45,20'},
};
const HOST_THEME=document.documentElement.getAttribute('data-theme');
function applyTheme(){
  const r=document.documentElement;
  if(prefs.theme==='auto'){ if(HOST_THEME) r.setAttribute('data-theme',HOST_THEME); else r.removeAttribute('data-theme'); }
  else r.setAttribute('data-theme',prefs.theme);
  const A=ACCENTS[prefs.accent]||ACCENTS.vert;
  let st=document.getElementById('accentStyle'); if(!st){ st=document.createElement('style'); st.id='accentStyle'; document.body.append(st); }
  const L=`--accent:${A.light[0]};--accent-soft:${A.light[1]};--accent-ink:#ffffff`, D=`--accent:${A.dark[0]};--accent-soft:${A.dark[1]};--accent-ink:#0b1512`;
  st.textContent=`:root{${L}} @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${D}}} :root[data-theme="dark"]{${D}}`;
}
function applyGlass(){ document.documentElement.dataset.glass=prefs.glass; }
applyGlass();
function applyLevelAttr(){ document.documentElement.dataset.level=prefs.level; }
applyTheme(); applyLevelAttr();
