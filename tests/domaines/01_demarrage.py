"""Premier démarrage, niveaux, barre du haut, disposition de départ, arborescence."""
import os

NIVEAU = 1
GALERIE = True   # contexte neuf : la bibliothèque s'ouvre à la première visite, on la laisse ouverte


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    check('galerie ouverte à la première visite', pg.is_visible('#gallery'))
    pg.click('#galleryClose')
    n = pg.evaluate(f'()=>[{E}.state.parts.length,{E}.state.joints.length,document.documentElement.dataset.level]')
    check('démarrage : maison, niveau débutant', n == [4, 0, '1'], n)
    check('débutant : pas d’esquisse, bouton « Vérifier pour l’impression »', not pg.is_visible('#bSketch') and not pg.is_visible('#simbar') and 'impression' in pg.evaluate("()=>document.querySelector('#rackSim [data-go=check]').textContent"))
    pg.click('#lvl [data-lvl="2"]'); pg.wait_for_timeout(200)
    check('intermédiaire : esquisse et bouton « Valider pour simulation »', pg.is_visible('#bSketch') and 'simulation' in pg.evaluate("()=>document.querySelector('#rackSim [data-go=check]').textContent") and not pg.is_visible('#bTree'))
    check('intermédiaire : outil Bézier disponible', pg.is_visible('#rack [data-sktool="bezier"]'))
    r = pg.evaluate("()=>{const k=[...document.querySelectorAll('#rack [data-sktool]')].map(e=>e.getBoundingClientRect()), v=[...document.querySelectorAll('#rackBasic .shape')].map(e=>e.getBoundingClientRect()), rk=document.querySelector('#rack').getBoundingClientRect(); return [k.length, Math.min(...k.map(b=>b.left)) > Math.max(...v.map(b=>b.right)), rk.right-Math.max(...k.map(b=>b.right)) < 60]}")
    check('icônes de création d’esquisse à droite de la barre', r == [5, True, True], r)
    check('bouton Esquisse non enfoncé au repos', pg.locator('#rack .shape.on').count() == 0)
    pg.click('#lvl [data-lvl="3"]'); pg.wait_for_timeout(300)
    check('avancé : arborescence visible', pg.is_visible('#outliner') and pg.locator('#treeBody .tr').count() == 4)
    r = pg.evaluate("()=>{const o=document.querySelector('#outliner').getBoundingClientRect(), s=document.querySelector('#stage').getBoundingClientRect(), i=document.querySelector('#insp').getBoundingClientRect(), v=document.querySelector('#views').getBoundingClientRect(); return [o.left<=1 && o.right<=s.left+1, i.right>s.right-40 && i.top>=v.bottom-2]}")
    check('arborescence à gauche, propriétés à droite sous le cube de vue', r == [True, True], r)
    r = pg.evaluate("()=>{const d=document.querySelector('#demo').getBoundingClientRect(), o=document.querySelector('#outliner').getBoundingClientRect(); return [!document.querySelector('#demo').hidden, d.left>=o.right-1 && d.left<o.right+40, document.querySelector('#demo').parentElement.id]}")
    check('guide à gauche de la vue, à droite de l’arborescence', r == [True, True, 'stage'], r)
    check('barre de création à onglets en haut (Volumes, Simulation), roues dentées avec les volumes ; menu Fichier', pg.locator('#rack [data-rtab]').count() == 3 and pg.locator('#rackMeca .shape', has_text='Roue dentée').count() == 1 and pg.locator('#rackBasic .shape', has_text='Roue dentée').count() == 0 and pg.is_hidden('#bNew') and pg.locator('#bTree').count() == 0 and pg.evaluate("()=>{const t=document.querySelector('.rack-tabs').getBoundingClientRect(), r=document.querySelector('.rack-row').getBoundingClientRect(); return t.bottom<=r.top+1}"))
    pg.click('#bFile'); pg.wait_for_timeout(100)
    r = pg.evaluate("()=>[!document.querySelector('#menuFile').hidden, [...document.querySelectorAll('#menuFile button')].map(b=>b.id).join(',')]")
    pg.click('#bFile'); pg.wait_for_timeout(100)
    hdr = pg.evaluate("()=>{const x=id=>document.querySelector(id).getBoundingClientRect(); return [x('#bUndo').left < x('#bFile').left, x('#lvl').left > innerWidth/2, x('#bLook').left > x('#lvl').left, x('#bHelp').left > x('#bLook').left]}")
    check('menu Fichier (nouveau, ouvrir, enregistrer, STL, bibliothèque), flèches devant, niveaux / apparence / aide à droite', r == [True, 'bNew,bOpen,bSave,bStl,bExamples'] and all(hdr) and pg.is_hidden('#menuFile'), [r, hdr])
    ed = pg.evaluate("()=>{const s=document.querySelector('.ed-shape'), r=s.getBoundingClientRect(), st=document.querySelector('#stage').getBoundingClientRect(); return [Math.abs((r.left+r.right)/2-(st.left+st.right)/2)<6, getComputedStyle(s).clipPath.startsWith('polygon')]}")
    check('barre d’édition centrée sur la vue, aux bords obliques', ed == [True, True], ed)
    pg.evaluate(f"()=>{E}.setSel([])")
    check('panneau « Propriétés » : invitation à cliquer un objet', pg.inner_text('#inspTitle') == 'Propriétés' and 'Cliquez sur un objet' in pg.inner_text('#inspBody') and 'Pour commencer' not in pg.inner_text('#inspBody'))
    pg.locator('#treeBody .tr').nth(0).locator('.tr-btn').nth(0).click(); pg.wait_for_timeout(200)
    check('arborescence : masquer une pièce', pg.evaluate(f'()=>{E}.state.parts[0].hidden===true && ![...{E}.meshes.values()][0].mesh.visible'))
    pg.locator('#treeBody .tr').nth(0).locator('.tr-btn').nth(0).click()
