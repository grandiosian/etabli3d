import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/* =========================================================
   Icons
   ========================================================= */
const I = {
  new:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M12 11v6M9 14h6"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
  open:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1"/><path d="M3 7v11a1 1 0 0 0 1 1h14l3-8H7l-3 7"/>',
  save:'<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  print:'<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>',
  sliders:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  move:'<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  rotate:'<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  scale:'<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>',
  home:'<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  orbit:'<ellipse cx="12" cy="12" rx="9" ry="4.5"/><path d="M16.5 6 19.5 7.6 17.2 10"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  hand:'<path d="M8 13V6a1.5 1.5 0 0 1 3 0v6M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7s-5-2-6.5-4.5L3 12.5a1.5 1.5 0 0 1 2.5-1.6L8 13"/>',
  selbox:'<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M10 10l7 3-3 1-1 3z" fill="currentColor" fill-opacity=".3"/>',
  mouse:'<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 3v7M6 10h12"/><path d="M12 3a6 6 0 0 0-6 6v1h6z" fill="currentColor"/>',
  solid:'<path d="M12 3 20 7.5 12 12 4 7.5z" fill="currentColor" fill-opacity=".3" stroke="none"/><path d="M4 7.5 12 12v9l-8-4.5z" fill="currentColor" fill-opacity=".6" stroke="none"/><path d="M20 7.5 12 12v9l8-4.5z" fill="currentColor" fill-opacity=".9" stroke="none"/><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  hole:'<path d="M4 10.5L10.86 3.64M4 14L13.92 4.08M4.64 16.86L16.16 5.34M6.88 18.12L18.4 6.6M9.12 19.38L20 8.5M11.36 20.64L20 12" stroke-width="1.1" opacity=".75"/><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" stroke-dasharray="3 2"/>',
  group:'<rect x="3" y="3" width="11" height="11" rx="1.5"/><rect x="10" y="10" width="11" height="11" rx="1.5" fill="currentColor" fill-opacity=".2"/>',
  ungroup:'<rect x="3" y="3" width="9" height="9" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/><path d="M15 6h3v3M9 15v3h3" stroke-dasharray="2 2"/>',
  dup:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  drop:'<path d="M12 3v11M8 10l4 4 4-4"/><path d="M3 20h18"/><path d="M6 17h12" opacity=".5"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  cube:'<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  vtop:'<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 4l4 4h8l4-4M8 8v8h8V8" opacity=".55"/>',
  vfront:'<rect x="5" y="7" width="14" height="13" rx="1"/><path d="M5 7l3-3h11l-2 3" opacity=".55"/>',
  vright:'<rect x="5" y="7" width="12" height="13" rx="1"/><path d="M17 7l3-3v12l-3 4" opacity=".55"/>',
  fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  play:'<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
  pause:'<path d="M7 4h4v16H7zM14 4h4v16h-4z" fill="currentColor"/>',
  reset:'<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v5h5"/>',
  cursor:'<path d="M5 3l14 7-6 2-2 6z"/>',
  pin:'<path d="M12 3v10M7 21h10M9 13h6l-3 5z"/><circle cx="12" cy="6" r="3"/>',
  check:'<path d="M5 12.5 10 17l9-10"/>',
  grp:'<rect x="2.5" y="2.5" width="19" height="19" rx="3" stroke-dasharray="3 2.2"/><rect x="5.5" y="9" width="8" height="8" rx="1" fill="currentColor" fill-opacity=".35"/><circle cx="14.5" cy="10.5" r="4.5" fill="currentColor" fill-opacity=".35"/>',
  ungrp:'<rect x="2" y="12" width="7.5" height="7.5" rx="1" fill="currentColor" fill-opacity=".35"/><circle cx="17.5" cy="7.5" r="4.5" fill="currentColor" fill-opacity=".35"/><path d="M9 9.5 12.5 6M12.5 6h-3M12.5 6v3M15 14.5l-3.5 3.5M11.5 18h3M11.5 18v-3"/>',
  meca:'<circle cx="9" cy="10" r="3"/><path d="M9 3.5v2M9 14.5v2M2.5 10h2M13.5 10h2M4.4 5.4l1.4 1.4M12.2 13.2l1.4 1.4M4.4 14.6l1.4-1.4M12.2 6.8l1.4-1.4"/><path d="M3 21h18M6 21v-2M10 21v-2M14 21v-2M18 21v-2"/>',
  guide:'<path d="M5 4h11l3 3v13H5z"/><path d="m8 9 1.5 1.5L12 8M8 15l1.5 1.5L12 14M14 9.5h3M14 15.5h3"/>',
  extrude:'<path d="M4 17l8 4 8-4M4 17V9M20 17V9M12 21v-8"/><path d="M4 9l8 4 8-4-8-4z" fill="currentColor" fill-opacity=".2"/><path d="M12 2v3" />',
  revolve:'<path d="M12 2v20" stroke-dasharray="2 2"/><path d="M12 5h5v4l-2 2 2 2v6h-5"/><path d="M7 19a5 2 0 0 0 10 0" opacity=".5"/>',
  pivot:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 1 1-2-5"/><path d="M17 3v4h4"/>',
  slide:'<path d="M3 12h18M17 8l4 4-4 4M7 8l-4 4 4 4"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  back:'<path d="M15 18l-6-6 6-6"/><path d="M9 12h11"/>',
  pin2:'<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3z"/><path d="M12 14v6"/>',
  side:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  dots:'<circle cx="9" cy="6" r="1.3" fill="currentColor"/><circle cx="15" cy="6" r="1.3" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/><circle cx="9" cy="18" r="1.3" fill="currentColor"/><circle cx="15" cy="18" r="1.3" fill="currentColor"/>',
  chevUp:'<path d="m6 15 6-6 6 6"/>',
  chevDown:'<path d="m6 9 6 6 6-6"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  k_line:'<path d="M4 19 20 5"/><circle cx="4" cy="19" r="2" fill="currentColor"/><circle cx="20" cy="5" r="2" fill="currentColor"/>',
  k_rect:'<rect x="4" y="6" width="16" height="12"/>',
  k_bez:'<path d="M4 19C7 5 17 19 20 5"/><path d="M4 19 8 8M20 5l-4 11" stroke-dasharray="2 2" opacity=".7"/><circle cx="8" cy="8" r="1.6"/><circle cx="16" cy="16" r="1.6"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-1.3-1-1.6-1-2.7 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  tree:'<path d="M5 4v16M5 8h5M5 14h5M5 20h5"/><rect x="11" y="6" width="9" height="4" rx="1"/><rect x="11" y="12" width="9" height="4" rx="1"/><rect x="11" y="18" width="9" height="4" rx="1"/>',
  eyeOff:'<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3C3.6 8 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 4.4-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  caret:'<path d="m9 6 6 6-6 6"/>',
  truss:'<path d="M3 18h18M6 8h12M3 18 6 8l6 10 6-10 3 10M6 8l6 10"/><circle cx="3" cy="18" r="1.3" fill="currentColor"/><circle cx="21" cy="18" r="1.3" fill="currentColor"/>',
  meshIc:'<path d="M3 7h18v10H3zM3 7l6 10M9 7l6 10M15 7l6 10M9 7v10M15 7v10" stroke-width="1.4"/>',
  supFix:'<circle cx="12" cy="7" r="2"/><path d="M12 9 7 16h10z"/><path d="M5 16h14M7 16l-2 3M11 16l-2 3M15 16l-2 3M19 16l-2 3"/>',
  supRoll:'<circle cx="12" cy="6" r="2"/><path d="M12 8 7 14h10z"/><circle cx="9" cy="16.5" r="1.5"/><circle cx="15" cy="16.5" r="1.5"/><path d="M5 19h14"/>',
  force:'<path d="M12 3v14M7 12l5 5 5-5"/><path d="M5 21h14"/>',
  k_circle:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  k_dim:'<path d="M4 8v8M20 8v8M4 12h16M4 12l3-2M4 12l3 2M20 12l-3-2M20 12l-3 2"/>',
};
/* Rack icons: little isometric objects, 40×40 */
const S = {
  box:'<path d="M20 6 34 13v14L20 34 6 27V13z" fill="#e4574b" /><path d="M6 13l14 7 14-7-14-7z" fill="#f08a80"/><path d="M20 20v14l14-7V13z" fill="#b93f35"/>',
  cylinder:'<path d="M8 12v16c0 3 5.4 6 12 6s12-3 12-6V12" fill="#e6a23a"/><ellipse cx="20" cy="12" rx="12" ry="6" fill="#f5c46f"/><path d="M26 16.5V33c3-.7 6-2.6 6-5V12c0 2-2.4 3.7-6 4.5z" fill="#c4842a"/>',
  sphere:'<circle cx="20" cy="20" r="13" fill="#3d8bd0"/><circle cx="15.5" cy="15" r="5.5" fill="#8cc0ec" opacity=".85"/>',
  cone:'<path d="M20 5 32 29c0 3-5.4 5-12 5S8 32 8 29z" fill="#8c5ac2"/><path d="M20 5l5 28.3c4-.8 7-2.4 7-4.3z" fill="#6a3f9c"/>',
  pyramid:'<path d="M20 5 34 26 20 34 6 26z" fill="#e0bd3f"/><path d="M20 5v29l14-8z" fill="#b8962c"/>',
  wedge:'<path d="M6 27V17l28-6v16L20 34z" fill="#4aa36b"/><path d="M6 17 20 24l14-13z" fill="#7ac495"/><path d="M20 24v10l14-7V11z" fill="#36804f"/>',
  tube:'<path d="M8 12v16c0 3 5.4 6 12 6s12-3 12-6V12" fill="#d4774a"/><ellipse cx="20" cy="12" rx="12" ry="6" fill="#eba077"/><ellipse cx="20" cy="12" rx="6.5" ry="3.2" fill="#8a4426"/>',
  torus:'<ellipse cx="20" cy="21" rx="15" ry="9" fill="#c45b8e"/><ellipse cx="20" cy="19" rx="15" ry="8" fill="#de88b2"/><ellipse cx="20" cy="19.5" rx="6.5" ry="3" fill="var(--panel)"/>',
  text:'<path d="M7 9h26v6h-2v-2.5h-8.5V30H26v3H14v-3h3.5V12.5H9V15H7z" fill="#3a6fc4"/>',
  gear:'<g fill="#6c7a89"><circle cx="20" cy="20" r="11"/><g id="t">'+[0,45,90,135,180,225,270,315].map(a=>`<rect x="17.5" y="4.5" width="5" height="6" rx="1" transform="rotate(${a} 20 20)"/>`).join('')+'</g></g><circle cx="20" cy="20" r="4" fill="var(--panel)"/>',
  rack:'<path d="M4 22h32v9H4z" fill="#8a6c55"/><path d="M5 22l2-6h3l2 6zM13 22l2-6h3l2 6zM21 22l2-6h3l2 6zM29 22l2-6h3l2 6z" fill="#a98a72"/>',
  ex_house:'<path d="M3 34h34" stroke="#4aa36b" stroke-width="3"/><rect x="9" y="18" width="22" height="16" fill="#e6a23a"/><path d="M5 20 20 7l15 13z" fill="#c4473c"/><rect x="26" y="9" width="4" height="7" fill="#c4473c"/><rect x="17" y="25" width="6" height="9" fill="#5b3a1e"/><rect x="11" y="22" width="4" height="4" fill="#5b3a1e"/>',
  ex_cup:'<path d="M12 6l3 16M21 4v18M27 7l-2 15" stroke-width="3.5" stroke="#e0bd3f" stroke-linecap="round"/><rect x="7" y="17" width="26" height="18" rx="2" fill="#3d8bd0"/><path d="M12 27h16" stroke="#1f5a8e" stroke-width="2.5"/>',
  ex_die:'<rect x="7" y="7" width="26" height="26" rx="5" fill="#f2f2ee" stroke="#9aa5a1" stroke-width="1.5"/><g fill="#2c3331"><circle cx="13.5" cy="13.5" r="2.5"/><circle cx="20" cy="20" r="2.5"/><circle cx="26.5" cy="26.5" r="2.5"/><circle cx="26.5" cy="13.5" r="2.5"/><circle cx="13.5" cy="26.5" r="2.5"/></g>',
  ex_key:'<rect x="4" y="12" width="32" height="16" rx="3" fill="#3a6fc4"/><circle cx="10" cy="20" r="2.6" fill="var(--panel)"/><path d="M16 17h14M16 21h10M16 25h12" stroke="#f2f2ee" stroke-width="2.2"/>',
  ex_plate:'<rect x="4" y="11" width="32" height="18" fill="#2b9a8a"/><circle cx="9" cy="20" r="2.3" fill="var(--panel)"/><circle cx="31" cy="20" r="2.3" fill="var(--panel)"/><circle cx="20" cy="20" r="5" fill="var(--panel)"/><path d="M4 34h32M4 32v4M36 32v4" stroke="#1d7656" stroke-width="1.6"/>',
  ex_pawn:'<path d="M20 4a5 5 0 0 1 3.5 8.6L25 14h-2.5l1.5 12 4 3v3H12v-3l4-3 1.5-12H15l1.5-1.4A5 5 0 0 1 20 4z" fill="#2c3331"/><path d="M10 35h20" stroke="#2c3331" stroke-width="3"/>',
  ex_barrier:'<rect x="5" y="16" width="7" height="20" fill="#e6a23a"/><path d="M9 18 34 6" stroke="#f2f2ee" stroke-width="4.5"/><path d="M9 18 34 6" stroke="#e4574b" stroke-width="4.5" stroke-dasharray="5 5"/><circle cx="8.5" cy="14" r="2.5" fill="#4aa36b"/>',
  ex_reducer:'<g fill="#3d8bd0"><circle cx="11" cy="22" r="6"/>'+[0,60,120,180,240,300].map(a=>`<rect x="9.5" y="13" width="3" height="4" transform="rotate(${a} 11 22)"/>`).join('')+'</g><g fill="#e6a23a"><circle cx="26" cy="20" r="10"/>'+[0,30,60,90,120,150,180,210,240,270,300,330].map(a=>`<rect x="24.6" y="7.5" width="2.8" height="4" transform="rotate(${a} 26 20)"/>`).join('')+'</g><circle cx="26" cy="20" r="2.2" fill="var(--panel)"/>',
  ex_pulley:'<circle cx="13" cy="20" r="9" fill="#e4574b"/><circle cx="31" cy="20" r="5" fill="#3d8bd0"/><path d="M13 11 31 15M13 29l18-4" stroke="#2c3331" stroke-width="2"/><circle cx="13" cy="20" r="2" fill="var(--panel)"/>',
  ex_vise:'<rect x="3" y="28" width="34" height="5" fill="#6c7a89"/><rect x="28" y="12" width="6" height="16" fill="#6c7a89"/><rect x="14" y="12" width="6" height="16" fill="#e4574b"/><rect x="21" y="18" width="6" height="10" fill="#3d8bd0"/><path d="M4 20h24" stroke="#9aa5a1" stroke-width="3"/><path d="M4 12v16" stroke="#2c3331" stroke-width="2.5"/>',
  ex_arm:'<rect x="5" y="31" width="14" height="5" rx="1" fill="#6c7a89"/><rect x="9" y="22" width="6" height="9" fill="#e6a23a"/><path d="M12 22 24 12" stroke="#3a6fc4" stroke-width="5" stroke-linecap="round"/><path d="M24 12l9 9" stroke="#4aa36b" stroke-width="4" stroke-linecap="round"/><circle cx="33" cy="22" r="3" fill="#e4574b"/>',
  ex_heart:'<path d="M20 34C9 26 5 20 5 14a7.5 7.5 0 0 1 15-1 7.5 7.5 0 0 1 15 1c0 6-4 12-15 20z" fill="#c45b8e"/><circle cx="12.5" cy="13" r="2" fill="var(--panel)"/>',
  ex_vase:'<path d="M14 5h12l-1 3c6 6 9 11 7 18-1 5-4 8-12 8S9 31 8 26c-2-7 1-12 7-18z" fill="#3d8bd0"/><path d="M15 8h10" stroke="#1f5a8e" stroke-width="2"/>',
  ex_bridge:'<path d="M3 30h34" stroke="#8a6c55" stroke-width="3"/><path d="M5 30 10 18h20l5 12M10 18l5 12 5-12 5 12 5-12" stroke="#c9a36b" stroke-width="2.2" fill="none"/>',
  ex_crane:'<path d="M9 36V8M15 36V8M9 8h24M9 14h24M15 8l6 6 6-6 6 6M9 36l6-7M9 29l6-7M9 22l6-8" stroke="#8d99a6" stroke-width="2" fill="none"/><path d="M33 14v8" stroke="#2c3331" stroke-width="1.5"/><rect x="30" y="22" width="6" height="5" fill="#e6a23a"/>',
  ex_suspension:'<path d="M2 28h36" stroke="#8a6c55" stroke-width="3"/><path d="M10 34V8M30 34V8" stroke="#8d99a6" stroke-width="2.5"/><path d="M2 28 10 8Q20 30 30 8l8 20" stroke="#2c3331" stroke-width="1.5" fill="none"/><path d="M15 17v11M20 21v7M25 17v11" stroke="#2c3331" stroke-width="1"/>',
  ex_board:'<rect x="3" y="12" width="8" height="24" fill="#6c7a89"/><path d="M11 13 C20 13 28 15 37 19" stroke="#c9a36b" stroke-width="4" fill="none"/><circle cx="34" cy="11" r="3" fill="#e4574b"/><path d="M34 14v4" stroke="#e4574b" stroke-width="2"/>',
  ex_floor:'<path d="M4 18 C14 21 26 21 36 18" stroke="#c9a36b" stroke-width="5" fill="none"/><path d="M4 21l-2 6h6zM36 21l-2 6h6z" fill="#6c7a89"/><path d="M8 10v5M14 10v5M20 10v5M26 10v5M32 10v5" stroke="#2f6fd6" stroke-width="1.5"/>',
  ex_vault:'<path d="M4 34V22a16 16 0 0 1 32 0v12h-7V22a9 9 0 0 0-18 0v12z" fill="#cbbf9f"/><path d="M20 3v5" stroke="#2f6fd6" stroke-width="2"/>',
  ex_hook:'<path d="M8 36V6h26v6H14v24z" fill="#c9a36b"/><path d="M31 12v8" stroke="#2c3331" stroke-width="1.5"/><rect x="27" y="20" width="8" height="8" fill="#e6a23a"/><path d="M4 36h12" stroke="#6c7a89" stroke-width="3"/>',
  ex_wind:'<path d="M19 36h4l-1-20h-2z" fill="#9aa5a1"/><g fill="#6c7a89"><path d="M21 15 19.5 2h3z"/><path d="M21 15l11.5 6.5-1.5 2.6z"/><path d="M21 15 9.5 21.5l1.5 2.6z"/></g><circle cx="21" cy="15" r="2.5" fill="#2c3331"/>',
  k_sketch:'<rect x="5" y="9" width="20" height="16" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="15" cy="17" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 31h20M5 29v4M25 29v4" stroke="currentColor" stroke-width="1.6"/><path d="M29 30 35 8l2 1-6 22z" fill="currentColor"/>',
  group:'<path d="M20 6 34 13v14L20 34 6 27V13z" fill="#7d8a86"/><path d="M6 13l14 7 14-7-14-7z" fill="#a8b4b0"/><ellipse cx="20" cy="13" rx="5" ry="2.5" fill="#4d5755"/>',
  sketch:'<path d="M6 27V13l14-7 14 7v14L20 34z" fill="#2b9a8a"/><path d="M6 13l14 7 14-7-14-7z" fill="#5cc2b3"/><circle cx="20" cy="13" r="3" fill="#1b6b60"/>',
};
function icon(name, el){
  if (S[name]) { el.setAttribute('viewBox','0 0 40 40'); el.innerHTML = S[name]; return; }
  el.setAttribute('viewBox','0 0 24 24'); el.setAttribute('fill','none'); el.setAttribute('stroke','currentColor');
  el.setAttribute('stroke-width','1.8'); el.setAttribute('stroke-linecap','round'); el.setAttribute('stroke-linejoin','round');
  el.innerHTML = I[name] || '';
}
function svgIcon(name){ const s=document.createElementNS('http://www.w3.org/2000/svg','svg'); icon(name,s); return s; }
function hydrateIcons(root=document){ root.querySelectorAll('svg[data-i]').forEach(s=>{ icon(s.dataset.i,s); s.removeAttribute('data-i'); s.setAttribute('aria-hidden','true'); }); }

/* =========================================================
   Utilities
   ========================================================= */
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const DEG = Math.PI/180;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=(v,d=2)=>{ if(!isFinite(v)) return '—'; const r=Math.round(v*10**d)/10**d; return (Object.is(r,-0)?0:r).toLocaleString('fr-FR',{maximumFractionDigits:d}); };
const parseNum = s => { if(typeof s==='number') return s; const v=parseFloat(String(s).replace(/\s/g,'').replace(',','.')); return isFinite(v)?v:NaN; };
const clone = o => JSON.parse(JSON.stringify(o));
const h = (tag, attrs={}, ...kids) => { const e=document.createElement(tag); for(const [k,v] of Object.entries(attrs)){ if(v==null||v===false) continue; if(k==='class') e.className=v; else if(k.startsWith('on')) e.addEventListener(k.slice(2),v); else if(k==='html') e.innerHTML=v; else e.setAttribute(k,v===true?'':v);} for(const c of kids.flat()){ if(c==null||c===false) continue; e.append(c.nodeType?c:document.createTextNode(c)); } return e; };
let toastTimer=0;
function toast(msg, ms=2600){ const t=$('#toast'); t.textContent=msg; t.style.opacity=1; clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.style.opacity=0, ms); }
function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

/* =========================================================
   Shape catalogue
   ========================================================= */
const F = (k,label,o={}) => ({k,label,unit:'mm',min:0.1,step:1,...o});
const KINDS = {
  box:{label:'Cube',color:'#e4574b',params:{L:20,l:20,h:20},fields:[F('L','Longueur (X)'),F('l','Largeur (Y)'),F('h','Hauteur (Z)')]},
  cylinder:{label:'Cylindre',color:'#e6a23a',params:{d:20,h:20,seg:48},fields:[F('d','Diamètre'),F('h','Hauteur'),F('seg','Facettes',{lvl:3,unit:'',min:3,max:128,step:1,int:true})]},
  sphere:{label:'Sphère',color:'#3d8bd0',params:{d:20,seg:32},fields:[F('d','Diamètre'),F('seg','Facettes',{lvl:3,unit:'',min:6,max:96,step:1,int:true})]},
  cone:{label:'Cône',color:'#8c5ac2',params:{d:20,d2:0,h:20,seg:48},fields:[F('d','Diamètre de base'),F('d2','Diamètre du haut',{min:0}),F('h','Hauteur'),F('seg','Facettes',{lvl:3,unit:'',min:3,max:128,step:1,int:true})]},
  pyramid:{label:'Pyramide',color:'#e0bd3f',params:{L:20,l:20,h:20},fields:[F('L','Longueur (X)'),F('l','Largeur (Y)'),F('h','Hauteur (Z)')]},
  wedge:{label:'Coin',color:'#4aa36b',params:{L:20,l:20,h:20},fields:[F('L','Longueur (X)'),F('l','Largeur (Y)'),F('h','Hauteur (Z)')]},
  tube:{label:'Tube',color:'#d4774a',params:{d:20,di:14,h:20,seg:48},fields:[F('d','Diamètre extérieur'),F('di','Diamètre intérieur'),F('h','Hauteur'),F('seg','Facettes',{lvl:3,unit:'',min:3,max:128,step:1,int:true})]},
  torus:{label:'Tore',color:'#c45b8e',params:{d:24,e:6,seg:48},fields:[F('d','Diamètre moyen'),F('e','Épaisseur'),F('seg','Facettes',{lvl:3,unit:'',min:6,max:128,step:1,int:true})]},
  text:{label:'Texte',color:'#3a6fc4',params:{txt:'TECHNO',size:12,h:4,font:'sans'},fields:[F('txt','Texte',{type:'text'}),F('size','Hauteur des lettres'),F('h','Épaisseur'),F('font','Police',{type:'select',opts:[['sans','Bâton'],['serif','Avec empattements'],['mono','Machine à écrire'],['round','Arrondie']]})]},
  gear:{label:'Roue dentée',color:'#6c7a89',params:{z:20,m:2,e:6,dh:5},fields:[F('z','Nombre de dents Z',{unit:'',min:6,max:150,step:1,int:true}),F('m','Module m',{step:0.5}),F('e','Épaisseur'),F('dh',"Diamètre de l'alésage",{min:0})]},
  rack:{label:'Crémaillère',color:'#8a6c55',params:{n:12,m:2,e:6,hb:6},fields:[F('n','Nombre de dents',{unit:'',min:2,max:200,step:1,int:true}),F('m','Module m',{step:0.5}),F('e','Épaisseur'),F('hb','Hauteur sous les dents')]},
  sketch:{label:'Esquisse',color:'#2b9a8a',params:{},fields:[]},
  group:{label:'Groupe',color:'#7d8a86',params:{},fields:[]},
};
const BASIC = ['box','cylinder','sphere','cone','pyramid','wedge','tube','torus','text'];
/* Level at which each shape appears in the rack: 1 débutant, 2 intermédiaire, 3 avancé. */
const KIND_LVL = {box:1,cylinder:1,sphere:1,cone:1,pyramid:1,wedge:1,text:1,tube:2,torus:2,sketch:2,gear:3,rack:3};
const MECA = ['gear','rack'];
const PALETTE = ['#e4574b','#e6a23a','#e0bd3f','#4aa36b','#2b9a8a','#3d8bd0','#3a6fc4','#8c5ac2','#c45b8e','#8a6c55','#6c7a89','#f2f2ee','#2c3331'];

/* =========================================================
   Geometry builders  (Z up, base at z = 0, centred on X/Y)
   ========================================================= */
function ensureAttrs(g){
  if(!g.attributes.normal) g.computeVertexNormals();
  if(!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
  return g;
}
function polyhedron(verts, faces){
  const pos=[];
  for(const f of faces){ for(let i=1;i<f.length-1;i++){ for(const k of [f[0],f[i],f[i+1]]) pos.push(...verts[k]); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.computeVertexNormals(); return ensureAttrs(g);
}
function zUp(g, h){ g.rotateX(Math.PI/2); g.translate(0,0,h/2); return g; }
const P = (v,min=0.01)=> Math.max(min, +v || min);

function gearShape(z,m){
  z=Math.max(6,Math.round(z)); m=P(m,0.1);
  const a=20*DEG, rp=m*z/2, rb=rp*Math.cos(a), ra=rp+m, rf=Math.max(0.3*rp, rp-1.25*m);
  const inv = t=>Math.tan(t)-t;
  const half = Math.PI/(2*z) + inv(a);
  const phi = r => { if(r<=rb) return half; return half - inv(Math.acos(rb/r)); };
  const pts=[]; const N=8; const step=2*Math.PI/z;
  const rStart = Math.max(rf, Math.min(rb, ra));
  for(let i=0;i<z;i++){
    const c=i*step;
    // right flank (from root up to tip)
    pts.push([rf*Math.cos(c-phi(rStart)), rf*Math.sin(c-phi(rStart))]);
    for(let k=0;k<=N;k++){ const r=rStart+(ra-rStart)*k/N; const p=c-phi(r); pts.push([r*Math.cos(p), r*Math.sin(p)]); }
    // tip
    const pt=phi(ra); pts.push([ra*Math.cos(c),ra*Math.sin(c)]);
    for(let k=N;k>=0;k--){ const r=rStart+(ra-rStart)*k/N; const p=c+phi(r); pts.push([r*Math.cos(p), r*Math.sin(p)]); }
    pts.push([rf*Math.cos(c+phi(rStart)), rf*Math.sin(c+phi(rStart))]);
    // root arc to the next tooth
    const a0=c+phi(rStart), a1=c+step-phi(rStart);
    for(let k=1;k<4;k++){ const t=a0+(a1-a0)*k/4; pts.push([rf*Math.cos(t), rf*Math.sin(t)]); }
    void pt;
  }
  return new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],p[1])));
}
function rackShape(n,m,hb){
  n=Math.max(2,Math.round(n)); m=P(m,0.1); hb=P(hb,0.5);
  const p=Math.PI*m, t=Math.tan(20*DEG), L=n*p;
  const yr=-1.25*m, yt=m, yb=yr-hb;
  const pts=[[-L/2,yb],[L/2,yb],[L/2,yr]];
  for(let i=n-1;i>=0;i--){
    const cx=-L/2+p/2+i*p;
    const wr=p/4+1.25*m*t, wt=p/4-m*t;
    pts.push([cx+wr,yr],[cx+wt,yt],[cx-wt,yt],[cx-wr,yr]);
  }
  pts.push([-L/2,yr]);
  // drop consecutive duplicates
  const out=[]; for(const q of pts){ const l=out[out.length-1]; if(!l||Math.hypot(l[0]-q[0],l[1]-q[1])>1e-6) out.push(q); }
  return new THREE.Shape(out.map(q=>new THREE.Vector2(q[0],q[1])));
}

/* ---- text: rasterise with canvas, trace outlines (pixel edges), build shapes */
const FONTS = { sans:'800 {px}px "Arial Black","Arial",sans-serif', serif:'700 {px}px Georgia,"Times New Roman",serif', mono:'700 {px}px "Courier New",monospace', round:'700 {px}px "Trebuchet MS","Verdana",sans-serif' };
function textShapes(txt, size, font){
  txt = (txt||'').slice(0,40) || ' ';
  const px=140, pad=8;
  const c=document.createElement('canvas'); const ctx=c.getContext('2d',{willReadFrequently:true});
  const f=(FONTS[font]||FONTS.sans).replace('{px}',px);
  ctx.font=f; const w=Math.ceil(ctx.measureText(txt).width)+pad*2; const H=Math.ceil(px*1.35)+pad*2;
  c.width=Math.max(4,Math.min(w,4096)); c.height=H;
  ctx.font=f; ctx.fillStyle='#fff'; ctx.textBaseline='alphabetic'; ctx.fillText(txt, pad, pad+px);
  const data=ctx.getImageData(0,0,c.width,c.height).data;
  const W=c.width; const on=(x,y)=> x>=0&&y>=0&&x<W&&y<H && data[(y*W+x)*4]>127;
  // directed boundary edges, filled pixel on the left (y-up coordinates)
  const edges=new Map(); const key=(x,y)=>x+','+y; let count=0;
  const add=(x1,y1,x2,y2)=>{ const k=key(x1,y1); if(!edges.has(k)) edges.set(k,[]); edges.get(k).push([x2,y2]); count++; };
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ if(!on(x,y)) continue; const Y=H-y;
    if(!on(x,y+1)) add(x,Y-1,x+1,Y-1);
    if(!on(x+1,y)) add(x+1,Y-1,x+1,Y);
    if(!on(x,y-1)) add(x+1,Y,x,Y);
    if(!on(x-1,y)) add(x,Y,x,Y-1);
  }
  const loops=[];
  while(edges.size){
    const [sk,list]=edges.entries().next().value; const [sx,sy]=sk.split(',').map(Number);
    let cur=[sx,sy]; let prevDir=null; const loop=[];
    for(let guard=0; guard<count+5; guard++){
      const k=key(cur[0],cur[1]); const outs=edges.get(k); if(!outs) break;
      let idx=0;
      if(outs.length>1 && prevDir){ // prefer the left turn
        let best=-9; outs.forEach((o,i)=>{ const d=[o[0]-cur[0],o[1]-cur[1]]; const cr=prevDir[0]*d[1]-prevDir[1]*d[0]; if(cr>best){best=cr;idx=i;} });
      }
      const nx=outs.splice(idx,1)[0]; if(!outs.length) edges.delete(k);
      loop.push(cur); prevDir=[nx[0]-cur[0],nx[1]-cur[1]]; cur=nx;
      if(cur[0]===loop[0][0]&&cur[1]===loop[0][1]) break;
    }
    void list;
    if(loop.length>=4) loops.push(loop);
  }
  // smooth: edge midpoints, then drop collinear points
  const s=size/(px*0.72); // size ≈ capital height
  const polys=loops.map(L=>{ const m=[]; for(let i=0;i<L.length;i++){ const a=L[i], b=L[(i+1)%L.length]; m.push([(a[0]+b[0])/2,(a[1]+b[1])/2]); }
    return rdpClosed(m, 0.55); }).filter(p=>p.length>=3);
  const area=p=>{ let A=0; for(let i=0;i<p.length;i++){ const a=p[i],b=p[(i+1)%p.length]; A+=a[0]*b[1]-b[0]*a[1]; } return A/2; };
  const inside=(pt,poly)=>{ let ins=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const a=poly[i],b=poly[j]; if(((a[1]>pt[1])!==(b[1]>pt[1])) && pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0]) ins=!ins; } return ins; };
  const outers=polys.filter(p=>area(p)>0).map(p=>({p,a:area(p),holes:[]}));
  for(const hp of polys.filter(p=>area(p)<0)){
    let best=null; for(const o of outers){ if(inside(hp[0],o.p) && (!best||o.a<best.a)) best=o; }
    if(best) best.holes.push(hp);
  }
  // centre
  let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9; for(const o of outers) for(const q of o.p){ minx=Math.min(minx,q[0]);maxx=Math.max(maxx,q[0]);miny=Math.min(miny,q[1]);maxy=Math.max(maxy,q[1]); }
  const cx=(minx+maxx)/2, cy=(miny+maxy)/2;
  const V=q=>new THREE.Vector2((q[0]-cx)*s,(q[1]-cy)*s);
  return outers.map(o=>{ const sh=new THREE.Shape(o.p.map(V)); for(const hp of o.holes) sh.holes.push(new THREE.Path(hp.map(V))); return sh; });
}

function rdp(pts, eps){
  if(pts.length<3) return pts.slice();
  const [ax,ay]=pts[0], [bx,by]=pts[pts.length-1]; const dx=bx-ax, dy=by-ay, L=Math.hypot(dx,dy)||1e-9;
  let md=-1, mi=0; for(let i=1;i<pts.length-1;i++){ const d=Math.abs((pts[i][0]-ax)*dy-(pts[i][1]-ay)*dx)/L; if(d>md){md=d;mi=i;} }
  if(md<=eps) return [pts[0], pts[pts.length-1]];
  const l=rdp(pts.slice(0,mi+1),eps), r=rdp(pts.slice(mi),eps); return l.slice(0,-1).concat(r);
}
function rdpClosed(pts, eps){
  if(pts.length<4) return pts;
  let far=0, fd=-1; for(let i=1;i<pts.length;i++){ const d=Math.hypot(pts[i][0]-pts[0][0],pts[i][1]-pts[0][1]); if(d>fd){fd=d;far=i;} }
  const a=rdp(pts.slice(0,far+1),eps), b=rdp(pts.slice(far).concat([pts[0]]),eps);
  return a.slice(0,-1).concat(b.slice(0,-1));
}
/* ---- sketch profiles (shared by the sketch editor and the 3D builder) */
/* Cubic Bézier between sketch points a and b; handles are stored as offsets t1 (from a) and t2 (from b). */
function bezCtrl(sk, z){ const P=id=>sk.pts.find(p=>p.id===id); const A=P(z.a), B=P(z.b);
  return [[A.x,A.y],[A.x+z.t1[0],A.y+z.t1[1]],[B.x+z.t2[0],B.y+z.t2[1]],[B.x,B.y]]; }
function bezAt(c, t){ const u=1-t; const k0=u*u*u, k1=3*u*u*t, k2=3*u*t*t, k3=t*t*t;
  return [k0*c[0][0]+k1*c[1][0]+k2*c[2][0]+k3*c[3][0], k0*c[0][1]+k1*c[1][1]+k2*c[2][1]+k3*c[3][1]]; }
function skProfiles(sk){
  const P=new Map(sk.pts.map(p=>[p.id,p]));
  const BZ_N=32;
  const edges=[...sk.lines.map(l=>({k:'l',a:l.a,b:l.b,o:l})), ...(sk.beziers||[]).map(z=>({k:'b',a:z.a,b:z.b,o:z}))];
  const adj=new Map(); for(const e of edges){ for(const v of [e.a,e.b]){ if(!adj.has(v)) adj.set(v,[]); adj.get(v).push(e); } }
  const edgePts=(e, from)=>{ // points after `from`, up to the other end
    const to= e.a===from? e.b : e.a; const T=P.get(to);
    if(e.k==='l') return [[T.x,T.y]];
    const c=bezCtrl(sk,e.o), out=[]; for(let i=1;i<=BZ_N;i++){ const t=i/BZ_N; out.push(bezAt(c, e.a===from? t : 1-t)); } return out; };
  const seen=new Set(); const loops=[]; let open=0;
  for(const e0 of edges){
    if(seen.has(e0)) continue;
    const comp=[]; const st=[e0]; seen.add(e0);
    while(st.length){ const e=st.pop(); comp.push(e); for(const v of [e.a,e.b]) for(const m of adj.get(v)) if(!seen.has(m)){ seen.add(m); st.push(m);} }
    const ptsIn=new Set(); comp.forEach(e=>{ptsIn.add(e.a);ptsIn.add(e.b);});
    const ok=[...ptsIn].every(id=>adj.get(id).length===2) && (comp.length>=3 || (comp.length===2 && comp.some(e=>e.k==='b')));
    if(!ok){ open++; continue; }
    const S=P.get(e0.a); const pts=[[S.x,S.y]]; let prev=e0, cur=e0.b; pts.push(...edgePts(e0,e0.a)); let guard=0;
    while(cur!==e0.a && guard++<=comp.length){ const nx=adj.get(cur).find(m=>m!==prev); pts.push(...edgePts(nx,cur)); prev=nx; cur= nx.a===cur? nx.b : nx.a; }
    pts.pop(); // last point repeats the first
    loops.push({kind:'poly', pts});
  }
  for(const c of sk.circles){ const ctr=P.get(c.c); const pts=[]; for(let i=0;i<72;i++){ const t=i/72*Math.PI*2; pts.push([ctr.x+c.r*Math.cos(t), ctr.y+c.r*Math.sin(t)]); } loops.push({kind:'circle', c:[ctr.x,ctr.y], r:c.r, pts}); }
  const area=p=>{ let A=0; for(let i=0;i<p.length;i++){ const a=p[i],b=p[(i+1)%p.length]; A+=a[0]*b[1]-b[0]*a[1]; } return A/2; };
  const inside=(pt,poly)=>{ let ins=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const a=poly[i],b=poly[j]; if(((a[1]>pt[1])!==(b[1]>pt[1])) && pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0]) ins=!ins; } return ins; };
  const probe=L=>{ // a point surely on/inside the loop boundary region: centroid of first edge slightly
    const a=L.pts[0], b=L.pts[1]; return [(a[0]+b[0])/2,(a[1]+b[1])/2]; };
  loops.forEach(L=>{ L.area=Math.abs(area(L.pts)); });
  loops.forEach(L=>{ const pr=probe(L); L.parents=loops.filter(o=>o!==L && o.area>L.area && inside(pr,o.pts)); L.depth=L.parents.length; });
  const shapes=[];
  for(const L of loops.filter(L=>L.depth%2===0)){
    const toV=q=>new THREE.Vector2(q[0],q[1]);
    // three.js only fixes the holes' winding when it has to flip the outline itself: give it an
    // anticlockwise outline and clockwise holes, otherwise the walls of a hole come out inside-out.
    const ccw=q=> area(q)<0? q.slice().reverse() : q, cw=q=> area(q)>0? q.slice().reverse() : q;
    let sh; if(L.kind==='circle'){ sh=new THREE.Shape(); sh.absarc(L.c[0],L.c[1],L.r,0,Math.PI*2,false); } else sh=new THREE.Shape(ccw(L.pts).map(toV));
    for(const H of loops.filter(H=>H.depth===L.depth+1 && H.parents.includes(L))){
      let ph; if(H.kind==='circle'){ ph=new THREE.Path(); ph.absarc(H.c[0],H.c[1],H.r,0,Math.PI*2,true); } else ph=new THREE.Path(cw(H.pts).map(toV));
      sh.holes.push(ph);
    }
    shapes.push({shape:sh, loop:L});
  }
  return {loops, shapes, open};
}
function signedVolume(g){
  const p=g.attributes.position, idx=g.index; let V=0; const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const n= idx? idx.count : p.count;
  for(let i=0;i<n;i+=3){ const i0=idx?idx.getX(i):i, i1=idx?idx.getX(i+1):i+1, i2=idx?idx.getX(i+2):i+2;
    a.fromBufferAttribute(p,i0); b.fromBufferAttribute(p,i1); c.fromBufferAttribute(p,i2); V+=a.dot(b.clone().cross(c)); }
  return V/6;
}
function sketchGeometry(par){
  const sk=par.sk; if(!sk) return null;
  const {shapes}=skProfiles(sk);
  if(!shapes.length) return null;
  if(par.mode==='revolve'){
    const {loops}=skProfiles(sk);
    const band=(pts)=>{ const gs=[]; for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length]; if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6) continue; if(a[0]<=1e-6&&b[0]<=1e-6) continue;
        const g=new THREE.LatheGeometry([new THREE.Vector2(a[0],a[1]),new THREE.Vector2(b[0],b[1])],64); gs.push(ensureAttrs(g.toNonIndexed())); } return gs.length? mergeGeometries(gs):null; };
    const geos=[];
    for(const L of loops){
      const pts=L.pts.map(q=>[Math.max(0,q[0]),q[1]]);
      let g=band(pts); if(!g) continue;
      const wantPositive = L.depth%2===0;
      if((signedVolume(g)>0)!==wantPositive){ g.dispose(); g=band(pts.slice().reverse()); }
      geos.push(g);
    }
    if(!geos.length) return null;
    const m = geos.length>1 ? mergeGeometries(geos) : geos[0];
    m.rotateX(Math.PI/2);
    return m;
  }
  const g=new THREE.ExtrudeGeometry(shapes.map(s=>s.shape),{depth:P(par.h,0.1),bevelEnabled:false,curveSegments:48});
  return ensureAttrs(g);
}

function buildPrimitive(kind, p){
  let g;
  switch(kind){
    case 'box': g=new THREE.BoxGeometry(P(p.L),P(p.l),P(p.h)); g.translate(0,0,P(p.h)/2); break;
    case 'cylinder': g=zUp(new THREE.CylinderGeometry(P(p.d)/2,P(p.d)/2,P(p.h),clamp(p.seg|0,3,128)),P(p.h)); break;
    case 'cone': g=zUp(new THREE.CylinderGeometry(Math.max(0,+p.d2||0)/2,P(p.d)/2,P(p.h),clamp(p.seg|0,3,128)),P(p.h)); break;
    case 'sphere': { const r=P(p.d)/2, s=clamp(p.seg|0,6,96); g=new THREE.SphereGeometry(r,s,Math.max(4,s>>1)); g.rotateX(Math.PI/2); g.translate(0,0,r); break; }
    case 'torus': { const R=P(p.d)/2, r=Math.min(P(p.e)/2, R*0.98), s=clamp(p.seg|0,6,128); g=new THREE.TorusGeometry(R,r,Math.max(8,s>>2),s); g.translate(0,0,r); break; }
    case 'tube': { const R=P(p.d)/2, r=clamp(+p.di||0,0,P(p.d)-0.2)/2, s=clamp(p.seg|0,3,128);
      const sh=new THREE.Shape(); sh.absarc(0,0,R,0,Math.PI*2,false);
      if(r>0.05){ const hp=new THREE.Path(); hp.absarc(0,0,r,0,Math.PI*2,true); sh.holes.push(hp); }
      g=new THREE.ExtrudeGeometry(sh,{depth:P(p.h),bevelEnabled:false,curveSegments:Math.max(3,Math.round(s/4))}); break; }
    case 'pyramid': { const a=P(p.L)/2,b=P(p.l)/2,H=P(p.h);
      g=polyhedron([[-a,-b,0],[a,-b,0],[a,b,0],[-a,b,0],[0,0,H]],[[3,2,1,0],[0,1,4],[1,2,4],[2,3,4],[3,0,4]]); break; }
    case 'wedge': { const a=P(p.L)/2,b=P(p.l)/2,H=P(p.h);
      g=polyhedron([[-a,-b,0],[a,-b,0],[-a,-b,H],[-a,b,0],[a,b,0],[-a,b,H]],[[0,3,4,1],[0,1,2],[3,5,4],[0,2,5,3],[1,4,5,2]]); break; }
    case 'text': { const shapes=textShapes(p.txt,P(p.size,1),p.font);
      if(!shapes.length){ g=new THREE.BoxGeometry(0.01,0.01,0.01); break; }
      g=new THREE.ExtrudeGeometry(shapes,{depth:P(p.h),bevelEnabled:false,curveSegments:2}); break; }
    case 'gear': { const sh=gearShape(p.z,p.m); const dh=+p.dh||0;
      if(dh>0.1 && dh/2 < p.m*p.z/2-1.25*p.m-0.3){ const hp=new THREE.Path(); hp.absarc(0,0,dh/2,0,Math.PI*2,true); sh.holes.push(hp); }
      g=new THREE.ExtrudeGeometry(sh,{depth:P(p.e),bevelEnabled:false,curveSegments:32}); break; }
    case 'rack': g=new THREE.ExtrudeGeometry(rackShape(p.n,p.m,p.hb),{depth:P(p.e),bevelEnabled:false}); break;
    case 'sketch': g=sketchGeometry(p) || new THREE.BoxGeometry(0.01,0.01,0.01); break;
    default: g=new THREE.BoxGeometry(10,10,10);
  }
  return ensureAttrs(g);
}

/* =========================================================
   Part transforms + CSG for groups
   ========================================================= */
const _e=new THREE.Euler(), _q=new THREE.Quaternion(), _one=new THREE.Vector3(1,1,1);
function partMatrix(p, out=new THREE.Matrix4()){
  _e.set(p.rot[0]*DEG,p.rot[1]*DEG,p.rot[2]*DEG,'XYZ'); _q.setFromEuler(_e);
  return out.compose(new THREE.Vector3(...p.pos), _q, _one);
}
function setPartFromMatrix(p, m){
  const pos=new THREE.Vector3(), q=new THREE.Quaternion(), s=new THREE.Vector3(); m.decompose(pos,q,s);
  const e=new THREE.Euler().setFromQuaternion(q,'XYZ');
  const r=v=>{ const x=Math.round(v*1e4)/1e4; return Object.is(x,-0)?0:x; };
  p.pos=[r(pos.x),r(pos.y),r(pos.z)]; p.rot=[r(e.x/DEG),r(e.y/DEG),r(e.z/DEG)];
}
let CSG=null; // { Brush, Evaluator, ADDITION, SUBTRACTION }
const csgReady = import('three-bvh-csg').then(m=>{ CSG=m; }).catch(err=>{ console.warn('CSG indisponible',err); });

const geoCache=new Map();
function geomKey(p){
  if(p.kind==='group') return 'g:'+JSON.stringify(p.children.map(c=>({k:c.kind,p:c.params,h:!!c.hole,pos:c.pos,rot:c.rot,ch:c.kind==='group'?geomKey(c):0})));
  return p.kind+':'+JSON.stringify(p.params);
}
function getGeometry(p){
  const k=geomKey(p);
  if(geoCache.has(k)){ const g=geoCache.get(k); geoCache.delete(k); geoCache.set(k,g); return g; }
  let g;
  try { g = p.kind==='group' ? groupGeometry(p) : buildPrimitive(p.kind,p.params); }
  catch(err){ console.error(err); g=ensureAttrs(new THREE.BoxGeometry(5,5,5)); }
  g.computeBoundingBox(); g.computeBoundingSphere();
  geoCache.set(k,g);
  if(geoCache.size>160){ const used=new Set([...meshes.values()].map(r=>r.mesh.geometry)); for(const [kk,gg] of geoCache){ if(geoCache.size<=120) break; if(!used.has(gg)){ gg.dispose(); geoCache.delete(kk);} } }
  return g;
}
function groupGeometry(G){
  const solids=G.children.filter(c=>!c.hole), holes=G.children.filter(c=>c.hole);
  const brushOf=c=>{ const g=getGeometry(c).clone(); const b=new CSG.Brush(g); partMatrix(c,b.matrix); b.matrix.decompose(b.position,b.quaternion,b.scale); b.updateMatrixWorld(true); return b; };
  if(!CSG){ // fallback: merge solids only
    const gs=(solids.length?solids:holes).map(c=>{ const g=getGeometry(c).clone().toNonIndexed(); g.applyMatrix4(partMatrix(c)); return ensureAttrs(g); });
    return mergeGeometries(gs.map(g=>{ for(const k of Object.keys(g.attributes)) if(!['position','normal','uv'].includes(k)) g.deleteAttribute(k); return g; }));
  }
  const ev=new CSG.Evaluator(); ev.useGroups=false; ev.attributes=['position','uv','normal'];
  const list = solids.length? solids : holes;
  let acc=brushOf(list[0]); let ops=0;
  for(let i=1;i<list.length;i++){ acc=ev.evaluate(acc, brushOf(list[i]), CSG.ADDITION); ops++; }
  if(solids.length) for(const hc of holes){ acc=ev.evaluate(acc, brushOf(hc), CSG.SUBTRACTION); ops++; }
  let out=acc.geometry; if(!ops){ out=out.clone(); out.applyMatrix4(acc.matrixWorld); }
  out.clearGroups?.();
  return ensureAttrs(out);
}
