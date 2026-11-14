"""Premier démarrage, niveaux, barre du haut, disposition de départ, arborescence."""
import os
from commun import niveau

NIVEAU = 1
GALERIE = True   # contexte neuf : la bibliothèque s'ouvre à la première visite, on la laisse ouverte


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    check('galerie ouverte à la première visite', pg.is_visible('#gallery'))
    pg.click('#galleryClose')
    n = pg.evaluate(f'()=>[{E}.state.parts.length,{E}.state.joints.length,document.documentElement.dataset.level]')
    check('démarrage : maison, niveau débutant', n == [4, 0, '1'], n)
    check('débutant : pas d’esquisse, bouton « Vérifier pour l’impression »', not pg.is_visible('#bSketch') and not pg.is_visible('#simbar') and 'impression' in pg.evaluate("()=>document.querySelector('#rackSim [data-go=check]').textContent"))
    # menu Réglages (engrenage) : les trois niveaux, l'arborescence (grisée avant Avancé), l'aide
    pg.click('#bSet'); pg.wait_for_timeout(100)
    r = pg.evaluate("""()=>{const m=document.querySelector('#menuSet'); return [!m.hidden, document.querySelector('#bSet').getAttribute('aria-expanded'),
      [...m.querySelectorAll('#lvl [data-lvl]')].map(b=>b.querySelector('b').textContent+':'+b.getAttribute('aria-checked')).join(','),
      [...m.querySelectorAll('#setTree button')].map(b=>b.textContent+(b.disabled?'-':'')).join(','), m.querySelector('#setTree').textContent.includes('Avancé'),
      !!m.querySelector('#bHelp') && m.querySelector('#bHelp').textContent.trim()]}""")
    check('menu Réglages : Débutant / Intermédiaire / Avancé, Arborescence grisée avant Avancé, Aide et raccourcis',
          r == [True, 'true', 'Débutant:true,Intermédiaire:false,Avancé:false', 'Affichée-,Masquée-', True, 'Aide et raccourcis'], r)
    pg.click('#lvl [data-lvl="2"]'); pg.wait_for_timeout(300)
    r = pg.evaluate("()=>[document.documentElement.dataset.level, document.querySelector('#lvl [data-lvl=\"2\"]').getAttribute('aria-checked'), !document.querySelector('#menuSet').hidden]")
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    check('le niveau se change depuis le menu (qui reste ouvert), Échap le ferme', r == ['2', 'true', True] and pg.is_hidden('#menuSet'), r)
    pg.click('#bSet'); pg.click('#bLook'); pg.wait_for_timeout(100)
    r = [pg.is_hidden('#menuSet'), pg.is_visible('#menuLook'), pg.locator('#menuLook', has_text='Arborescence').count() == 0]
    pg.click('#bSet'); pg.wait_for_timeout(100)
    r += [pg.is_hidden('#menuLook'), pg.is_visible('#menuSet')]
    pg.mouse.click(450, 26); pg.wait_for_timeout(100)   # dans la barre, hors des boutons
    r += [pg.is_hidden('#menuSet')]
    pg.click('#bSet'); pg.click('#bHelp'); pg.wait_for_timeout(100)
    r += [pg.is_visible('#help'), pg.is_hidden('#menuSet')]
    pg.click('#helpClose')
    pg.click('#bSet'); pg.wait_for_timeout(100)
    g0 = pg.evaluate("()=>[document.querySelector('#bGuide').getAttribute('aria-pressed'), !document.querySelector('#demo').hidden, document.querySelector('#mobileInsp').getAttribute('aria-pressed')]")
    pg.click('#bGuide'); pg.wait_for_timeout(200)
    g1 = pg.evaluate("()=>[document.querySelector('#bGuide').getAttribute('aria-pressed'), !document.querySelector('#demo').hidden, !document.querySelector('#menuSet').hidden]")
    pg.click('#bGuide'); pg.wait_for_timeout(200)
    pg.click('#mobileInsp'); pg.wait_for_timeout(200)
    p1 = pg.evaluate("()=>[document.querySelector('#mobileInsp').getAttribute('aria-pressed'), document.querySelector('#app').classList.contains('insp-min')]")
    pg.click('#mobileInsp'); pg.wait_for_timeout(200)
    p2 = pg.evaluate("()=>[document.querySelector('#mobileInsp').getAttribute('aria-pressed'), document.querySelector('#app').classList.contains('insp-min')]")
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    check('menu Réglages : interrupteurs Guide et Propriétés (le menu reste ouvert)', g1[0] != g0[0] and g1[1] != g0[1] and g1[2] and p1 == ['false', True] and p2 == ['true', False], [g0, g1, p1, p2])
    check('un menu ouvert ferme l’autre, un clic ailleurs ferme Réglages, « Aide et raccourcis » ouvre l’aide ; plus d’arborescence dans Apparence', all(r), r)
    pg.click('#rack [data-rtab="sk"]'); pg.wait_for_timeout(100)
    check('intermédiaire : esquisse et bouton « Valider pour simulation »', pg.is_visible('#bSketch') and 'simulation' in pg.evaluate("()=>document.querySelector('#rackSim [data-go=check]').textContent") and not pg.is_visible('#bTree'))
    check('intermédiaire : outil Bézier disponible', pg.is_visible('#rack [data-sktool="bezier"]'))
    r = pg.evaluate("()=>[[...document.querySelectorAll('#rack [data-sktool]')].filter(e=>e.offsetParent).length, document.querySelector('#rackBasic').hidden, document.querySelector('#rack [data-rtab=sk]').getAttribute('aria-selected')]")
    pg.click('#rack [data-rtab="vol"]'); pg.wait_for_timeout(100)
    r2 = pg.evaluate("()=>[[...document.querySelectorAll('#rack [data-sktool]')].filter(e=>e.offsetParent).length, !document.querySelector('#rackBasic').hidden]")
    check('onglet « Esquisse » : les outils d’esquisse dans leur onglet, plus à côté des volumes', r == [5, True, 'true'] and r2 == [0, True], [r, r2])
    check('bouton Esquisse non enfoncé au repos', pg.locator('#rack .shape.on').count() == 0)
    niveau(pg, 3)
    check('avancé : arborescence visible', pg.is_visible('#outliner') and pg.locator('#treeBody .tr').count() == 4)
    pg.click('#bSet'); pg.locator('#setTree button', has_text='Masquée').click(); pg.wait_for_timeout(300)
    r = [pg.is_hidden('#outliner'), pg.evaluate(f'()=>{E}.prefs.tree')]
    pg.locator('#setTree button', has_text='Affichée').click(); pg.wait_for_timeout(300)
    r += [pg.is_visible('#outliner'), pg.evaluate(f'()=>{E}.prefs.tree'), pg.evaluate("()=>document.querySelector('#setTree').textContent.includes('Disponible')")]
    pg.click('#bSet')
    check('avancé : l’arborescence se masque et se réaffiche depuis le menu Réglages', r == [True, False, True, True, False], r)
    r = pg.evaluate("()=>{const o=document.querySelector('#outliner').getBoundingClientRect(), s=document.querySelector('#stage').getBoundingClientRect(), i=document.querySelector('#insp').getBoundingClientRect(), v=document.querySelector('#views').getBoundingClientRect(); return [o.left<=1 && o.right<=s.left+1, i.right>s.right-40 && i.top>=v.bottom-2]}")
    check('arborescence à gauche, propriétés à droite sous le cube de vue', r == [True, True], r)
    r = pg.evaluate("()=>{const d=document.querySelector('#demo').getBoundingClientRect(), o=document.querySelector('#outliner').getBoundingClientRect(); return [!document.querySelector('#demo').hidden, d.left>=o.right-1 && d.left<o.right+40, document.querySelector('#demo').parentElement.id]}")
    check('guide à gauche de la vue, à droite de l’arborescence', r == [True, True, 'stage'], r)
    check('barre de création à onglets en haut (Volumes, Esquisse, Création mécanique, Simulation), roues dentées à part ; menu Fichier', pg.locator('#rack [data-rtab]').count() == 4 and pg.locator('#rackMeca .shape', has_text='Roue dentée').count() == 1 and pg.locator('#rackBasic .shape', has_text='Roue dentée').count() == 0 and pg.is_hidden('#bNew') and pg.locator('#bTree').count() == 0 and pg.evaluate("()=>{const t=document.querySelector('.rack-tabs').getBoundingClientRect(), r=document.querySelector('.rack-row').getBoundingClientRect(); return t.bottom<=r.top+1}"))
    pg.click('#bFile'); pg.wait_for_timeout(100)
    r = pg.evaluate("()=>[!document.querySelector('#menuFile').hidden, [...document.querySelectorAll('#menuFile button')].map(b=>b.id).join(',')]")
    pg.click('#bFile'); pg.wait_for_timeout(100)
    hdr = pg.evaluate("""()=>{const q=s=>document.querySelector(s), x=s=>q(s).getBoundingClientRect(), u=x('#bUndo'), d=x('#bRedo'), g=x('#bSet');
      const btns=[...q('#top').querySelectorAll('button')].filter(e=>e.offsetParent && !e.closest('.menu')).map(e=>e.getBoundingClientRect().right);
      return [q('#bFile').classList.contains('brand') && !!q('#bFile svg.logo'), x('#bFile').right <= u.left, u.right <= d.left + 1, d.right <= x('#widgetCentrale').left,
        [u, d, g].every(r=>Math.round(r.width) === 36 && Math.round(r.height) === 34), [q('#bUndo'), q('#bRedo'), q('#bSet')].every(e=>getComputedStyle(e).borderRadius === '9px'),
        g.right >= Math.max(...btns) - 0.5, ['#bGuide', '#bLook', '#mobileInsp', '#bHelp', '#lvl'].every(s=>q('#menuSet ' + s)),
        [...q('#top .tb-r').children].filter(e=>e.offsetParent).length <= 2]}""")
    check('le logo ouvre le menu Fichier (nouveau, ouvrir, enregistrer, STL, dépôt Nuage, bibliothèque), puis annuler / rétablir et le widget de l’élève ; à droite seulement la démarche et l’engrenage (guide, propriétés, apparence, niveau et aide dans son menu)', r == [True, 'bNew,bOpen,bSave,bStl,bNuage,bExamples'] and all(hdr) and pg.is_hidden('#menuFile'), [r, hdr])
    r = pg.evaluate("""()=>{const u=document.querySelector('#bUndo'), p=u.querySelector('path'); const was=u.disabled; u.disabled=true; const off=+getComputedStyle(u).opacity; u.disabled=false; const on=+getComputedStyle(u).opacity; u.disabled=was;
      return [u.title, document.querySelector('#bRedo').title, u.querySelector('svg').getAttribute('viewBox'), p.getAttribute('d'), off < 0.6 && on === 1]}""")
    check('annuler / rétablir : icônes communes, titres, grisés quand il n’y a rien à annuler', r == ['Annuler (Ctrl+Z)', 'Rétablir (Ctrl+Y)', '0 0 24 24', 'M9 14 4 9l5-5', True], r)
    # barre du haut commune (NetSim, TechnoStudio) : widget « Visiteur », activité en cours au centre, une seule ligne
    tb = pg.evaluate("""()=>{const x=s=>document.querySelector(s).getBoundingClientRect(), t=x('#top'), w=x('#tbAtelier'), mid=(w.left+w.right)/2;
      const kids=[...document.querySelectorAll('#top .tb-l > *, #top .tb-c > *, #top .tb-r > *')].filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect());
      return [document.querySelector('#bCentrale').textContent.trim(), document.querySelector('#tbType').textContent, document.querySelector('#projName').value,
        !!document.querySelector('#tbProg .nvb'), /^\\d+\\/\\d+$/.test(document.querySelector('#tbProg .tbpct').textContent), Math.abs(mid-innerWidth/2) < 4,
        kids.every(k=>k.top >= t.top && k.bottom <= t.bottom), Math.round(t.height) === 52, !document.querySelector('#bRetourCentrale')?.offsetParent]}""")   # le module récent pose un « ← » caché
    check('barre du haut : « Visiteur », activité au centre (Exemple · Maison, barres, n/total), tout sur une ligne, pas de « ← » hors Centrale',
          tb == ['Visiteur', 'Exemple', 'Maison', True, True, True, True, True, True], tb)
    for w in (1000, 1280, 1920):
        pg.set_viewport_size({'width': w, 'height': 860}); pg.wait_for_timeout(250)
        one = pg.evaluate("(w)=>{const t=document.querySelector('#top').getBoundingClientRect(), a=document.querySelector('#tbAtelier').getBoundingClientRect(); return [Math.round(t.height) === 52, document.querySelector('#top').scrollWidth <= innerWidth + 1, document.querySelector('#bSet').getBoundingClientRect().right <= innerWidth, w < 1280 || Math.abs((a.left+a.right)/2 - innerWidth/2) < 4]}", w)
        check(f'barre du haut sur une ligne à {w} px', all(one), one)
    # petite fenêtre (600 à 860 px) : barre sur une ligne, création juste dessous, Édition (ouverte) en haut de la vue
    pg.evaluate(f"()=>{E}.setEdOpen(true)")
    for w in (640, 760, 860):
        pg.set_viewport_size({'width': w, 'height': 800}); pg.wait_for_timeout(250)
        one = pg.evaluate("""()=>{const x=s=>document.querySelector(s).getBoundingClientRect(), t=x('#top'), r=x('#rack'), b=x('#toolbar'), st=x('#stage');
          const kids=[...document.querySelectorAll('#top .tb-l > *, #top .tb-c > *, #top .tb-r > *')].filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect());
          const chevauche=kids.some((a,i)=>kids.some((c,j)=>j>i && a.left<c.right-1 && c.left<a.right-1 && a.top<c.bottom-1 && c.top<a.bottom-1));
          return [Math.round(t.height) === 52, document.querySelector('#top').scrollWidth <= innerWidth + 1, !chevauche, x('#bSet').right <= innerWidth,
            Math.abs(r.top - t.bottom) < 2, Math.abs(b.top - r.bottom) < 2, Math.abs(st.top - r.bottom) < 2]}""")
        check(f'petite fenêtre {w} px : barre sur une ligne, création juste dessous, Édition en haut de la vue', all(one), one)
    pg.evaluate(f"()=>{E}.setEdOpen(false)")
    # cas le plus chargé : élève connecté avec « ← », démarche à droite (Valider) : jamais de débordement, la roue reste visible ;
    # une ligne de 600 à 860 px, deux lignes au plus sur téléphone
    pg.evaluate(f"""()=>{{const w=document.querySelector('#widgetCentrale'), r=document.createElement('button'); r.className='tbid-ret'; r.id='bRetourTest';
      r.innerHTML='<span>←</span><span class="centrale-precedent-txt">Étape précédente</span>'; w.prepend(r);
      document.querySelector('#bCentrale span').textContent='renard-bleu-42'; document.querySelector('#projName').value='Porte-clés personnalisé'; {E}.setWs('check')}}""")
    pg.wait_for_timeout(250)
    for w in (360, 420, 599, 600, 680, 760, 860):
        pg.set_viewport_size({'width': w, 'height': 800}); pg.wait_for_timeout(250)
        one = pg.evaluate("""()=>{const x=s=>document.querySelector(s).getBoundingClientRect(), t=x('#top');
          const kids=[...document.querySelectorAll('#top .tb-l > *, #top .tb-c > *, #top .tb-r > *')].filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect());
          const chevauche=kids.some((a,i)=>kids.some((c,j)=>j>i && a.left<c.right-1 && c.left<a.right-1 && a.top<c.bottom-1 && c.top<a.bottom-1));
          return [document.documentElement.scrollWidth <= innerWidth + 1, !chevauche, x('#bSet').right <= innerWidth, x('#bUndo').right <= innerWidth,
            !!document.querySelector('#flow').children.length, Math.round(t.height) <= (innerWidth < 600 ? 92 : 52), x('#projName').width >= 30]}""")
        check(f'barre du haut chargée à {w} px (connecté, démarche) : rien ne déborde, roue visible, {"deux lignes" if w < 600 else "une ligne"} au plus', all(one), one)
    pg.evaluate(f"()=>{{document.querySelector('#bRetourTest').remove(); {E}.setWs('model')}}")
    pg.set_viewport_size({'width': 1400, 'height': 860}); pg.wait_for_timeout(250)
    pg.evaluate(f"()=>{E}.setEdOpen(true)"); pg.wait_for_timeout(150)
    ed = pg.evaluate("()=>{const b=document.querySelector('#edBar'), r=b.getBoundingClientRect(), st=document.querySelector('#stage').getBoundingClientRect(), k=document.querySelector('#rack').getBoundingClientRect(); return [Math.abs(r.left-k.right)<2 && Math.abs(r.right-st.right)<2, Math.abs(r.top-k.top)<2 && Math.abs(r.bottom-k.bottom)<2, getComputedStyle(b).clipPath === 'none' && getComputedStyle(b.querySelector('.ed-shape')).clipPath === 'none']}")
    pg.evaluate(f"()=>{E}.setEdOpen(false)")
    check('barre d’édition dans une colonne à droite de la création, même rangée et même hauteur, bords droits', ed == [True, True, True], ed)
    pg.evaluate(f"()=>{E}.setSel([])")
    check('panneau « Propriétés » : invitation à cliquer un objet', pg.inner_text('#inspTitle') == 'Propriétés' and 'Cliquez sur un objet' in pg.inner_text('#inspBody') and 'Pour commencer' not in pg.inner_text('#inspBody'))
    pg.locator('#treeBody .tr').nth(0).locator('.tr-btn').nth(0).click(); pg.wait_for_timeout(200)
    check('arborescence : masquer une pièce', pg.evaluate(f'()=>{E}.state.parts[0].hidden===true && ![...{E}.meshes.values()][0].mesh.visible'))
    pg.locator('#treeBody .tr').nth(0).locator('.tr-btn').nth(0).click()
