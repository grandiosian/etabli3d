"""Passerelle avec la Centrale (fausse Centrale de tests/centrale/)."""
import os

NIVEAU = 3
PAGE = False   # ouvre ses propres contextes avec une fausse Centrale


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    # Passerelle avec la Centrale : une fausse Centrale (tests/centrale/) répond comme le vrai module
    base = URL.split('/dist/')[0]
    depart = {'app': 'etabli3d', 'version': 2, 'name': 'Support de départ', 'nextId': 2, 'joints': [],
              'parts': [{'id': 1, 'kind': 'box', 'name': 'Socle', 'params': {'L': 60, 'l': 40, 'h': 5}, 'color': '#4aa36b', 'hole': False, 'pos': [0, 0, 0], 'rot': [0, 0, 0]}]}
    serveur = {'app': 'etabli3d', 'version': 2, 'name': 'Porte-crayon', 'nextId': 4, 'joints': [],
               'parts': [{'id': 1, 'kind': 'group', 'name': 'Porte-crayon', 'color': '#c8955a', 'mat': {'k': 'bois'}, 'hole': False, 'pos': [0, 0, 0], 'rot': [0, 0, 0], 'params': {}, 'children': [
                   {'id': 2, 'kind': 'cylinder', 'name': 'Corps', 'params': {'d': 60, 'h': 90, 'seg': 64}, 'color': '#c8955a', 'hole': False, 'pos': [0, 0, 0], 'rot': [0, 0, 0]},
                   {'id': 3, 'kind': 'cylinder', 'name': 'Creux', 'params': {'d': 52, 'h': 90, 'seg': 64}, 'color': '#7b8985', 'hole': True, 'pos': [0, 0, 4], 'rot': [0, 0, 0]}]}]}
    cfg = {'activite': 'ex-de', 'progressions': {'tuto-premiers': {'faites': 3, 'total': 6, 'statut': 'commence'}, 'exo-de': {'faites': 3, 'total': 3, 'statut': 'termine'}},
           'projet': serveur, 'atelier': {'titre': 'Fabriquer le support', 'entrees': ['depart.json'], 'sorties': ['projet.etabli3d.json', 'piece.stl', 'apercu.png', 'resume.json']},
           'fichiers': {'depart.json': depart}}
    import json as _json
    ctx = b.new_context(viewport={'width': 1400, 'height': 860})
    ctx.add_init_script(f"window.CENTRALE_URL='{base}/tests/centrale/'; window.__CZ_TEST={_json.dumps(cfg)};")
    cz = ctx.new_page(); cz.on('pageerror', lambda e: errors.append('centrale: ' + str(e)))
    cz.goto(URL); cz.wait_for_timeout(2500); cz.click('#galleryClose')
    r = cz.evaluate("()=>[__cz.init.app, __cz.init.activites.length, Etabli3D.activites().length, document.querySelector('#bCentrale').textContent.trim()]")
    cz.click('#bCentrale'); cz.wait_for_timeout(200); cz.click('#czFaux'); cz.wait_for_timeout(1500)
    r2 = cz.evaluate("""()=>{const E=window.__etabli; return [document.querySelector('#bCentrale').textContent.trim(), document.querySelector('#tbPas').textContent, document.querySelector('#tbAtelier').classList.contains('k5'), __cz.init.boutonRetour, !!E.PROG.done['exo:de'], E.PROG.part.premiers, E.state.note && E.state.note.key,
      __cz.progres.some(([id,p])=>id==='ex-de' && p.faites===0 && p.statut==='commence'), __cz.sauve.some(([k,v])=>k==='projet' && v.app==='etabli3d'), Etabli3D.progression('exo-de').statut]}""")
    # Annuler : exemple demandé → fichier de l'étape (ouvert à l'arrivée) → projet du serveur
    cz.keyboard.press('Control+z'); cz.wait_for_timeout(300)
    r3a = cz.evaluate("()=>window.__etabli.state.name")
    cz.keyboard.press('Control+z'); cz.wait_for_timeout(300)
    r3 = [r3a] + cz.evaluate("()=>[window.__etabli.state.name, window.__etabli.state.parts[0].mat && window.__etabli.state.parts[0].mat.k]")
    n0 = cz.evaluate("()=>__cz.sauve.length")
    cz.click('#bFile'); cz.locator('#menuFile .cz-item', has_text='Reprendre').click(); cz.wait_for_timeout(600)
    r4 = cz.evaluate("()=>[window.__etabli.state.name, __cz.sauve.length]")
    cz.click('#bFile'); cz.locator('#menuFile .cz-item', has_text='Déposer').click(); cz.wait_for_timeout(1500)
    cz.click('#bFile'); cz.locator('#menuFile .cz-item', has_text='STL').click(); cz.wait_for_timeout(600)
    r5 = cz.evaluate("()=>[__cz.depots.map(d=>d.nom+':'+d.type+':'+(d.taille>0)).join(' '), __cz.fichiers.map(f=>f.nom.endsWith('.stl')+':'+f.type).join(' ')]")
    check('Centrale plus ancienne (sans Centrale.navigation) : pas de pied de navigation dans le Guide', cz.evaluate("()=>!document.querySelector('.gd-pied')"))
    check('Centrale : déclaration des activités, widget « Visiteur » puis identifiant et pastille de la classe, sans bouton flottant, progression fusionnée, projet du serveur (Annuler revient), activité demandée, sauvegarde',
          r == ['etabli3d', 43, 43, 'Visiteur'] and r2 == ['07', '5', True, False, True, 3, 'de', True, True, 'termine'] and r3 == ['Support de départ', 'Porte-crayon', 'bois'], [r, r2, r3])
    check('Centrale : fichier de l’atelier repris, dépôt des sorties (projet, STL, aperçu, résumé), STL envoyé au professeur',
          r4[0] == 'Support de départ' and r4[1] > n0 and r5 == ['projet.etabli3d.json:application/json:true resume.json:application/json:true piece.stl:model/stl:true apercu.png:image/png:true', 'true:model/stl'], [r4, n0, r5])
    # Constats de compétences : exercice réussi après « Un indice ? », tuto terminé (classe 5A → capacités de 5e)
    rc = cz.evaluate("""async ()=>{ const E=window.__etabli; E.startLesson('plaque'); await new Promise(r=>setTimeout(r,200));
      const d=document.querySelector('details.gd-tips'); d.open=true; await new Promise(r=>setTimeout(r,100));
      E.markDone('exo:plaque'); E.markDone('tuto:premiers');
      const c=id=>(__cz.progres.filter(([i])=>i===id).pop()||[])[1]?.constats||[];
      const ce=c('exo-plaque'), ct=c('tuto-premiers');
      return [ce.map(x=>x.competence+':'+x.reussi+':'+x.indices+':'+x.essais).join(' '), ct.map(x=>x.competence+':'+x.indices).join(' '),
              Etabli3D.activites().find(a=>a.id==='exo-plaque').competences.join(' ')]; }""")
    check('Centrale : constats envoyés à la réussite (capacités du niveau de la classe, indices comptés)',
          rc == ['CCRI16.5.1:true:1:1', 'CCRI16.5.1:1', 'CCRI16.5.1 CCRI16.4.1 CCRI16.3.1'], rc)
    # Bouton « ← » dans le widget de l'élève : Centrale.boutonPrecedent s'il existe, sinon « ← Mes ateliers » (Centrale.retour / adresse du portail)
    for precedent in (False, True):
        c2 = b.new_context(viewport={'width': 1400, 'height': 860})
        c2.add_init_script(f"window.CENTRALE_URL='{base}/tests/centrale/'; window.__CZ_TEST={_json.dumps({'precedent': precedent})}; sessionStorage.setItem('centrale-retour', '{base}/tests/portail.html');")
        p2 = c2.new_page(); p2.on('pageerror', lambda e: errors.append('centrale: ' + str(e)))
        p2.goto(URL); p2.wait_for_timeout(2500)
        rb = p2.evaluate("""()=>{const w=document.querySelector('#widgetCentrale'), r=w.querySelector('#bRetourCentrale');
          return [document.querySelectorAll('#bRetourCentrale').length, !!r && w.firstElementChild===r && r.nextElementSibling.id==='bCentrale', r? r.textContent.replace('←','').trim() : null, !!r && !r.hidden, (__cz.precedent||{}).maj>0]}""")
        if precedent:
            if p2.is_visible('#galleryClose'): p2.click('#galleryClose')
            n0 = p2.evaluate("()=>__cz.precedent.maj"); p2.click('#bCentrale'); p2.wait_for_timeout(200); p2.click('#czFaux'); p2.wait_for_timeout(800)
            p2.click('#bRetourCentrale'); p2.wait_for_timeout(200)
            rb += p2.evaluate("n0=>[__cz.precedent.maj>n0, document.querySelector('#bRetourCentrale').textContent.replace('←','').trim(), __cz.precedent.clic]", n0)
            check('widget de l’élève : bouton commun « ← » de la Centrale (Centrale.boutonPrecedent) au début du widget, mis à jour à la connexion',
                  rb == [1, True, 'Mes ateliers', True, True, True, 'Étape précédente', 1], rb)
        else:
            check('widget de l’élève : « ← Mes ateliers » de secours (Centrale sans boutonPrecedent, ouverte depuis le portail)',
                  rb == [1, True, 'Mes ateliers', True, False], rb)
        c2.close()
    ver = ctx.new_page(); ver.goto(base + '/dist/outils/verifier-descripteur.html?app=../test.html'); ver.wait_for_function("()=>document.body.dataset.resultat", timeout=30000)
    vr = ver.evaluate("()=>[document.body.dataset.resultat, [...document.querySelectorAll('#res li.ko')].map(l=>l.textContent)]")
    check('centrale.json correspond à l’application (outils/verifier-descripteur.html)', vr[0] == 'ok', vr)
    ctx.close()

    # Ouvert depuis le portail, dans une étape de parcours : le module retire le jeton (#centrale=…) dès init()
    depose = dict(depart, name='Support déposé')
    for cas, dossier, donnees, attendu in [
            ('rien de déposé', [], [], 'Support de départ'),
            ('dépôt plus récent que le projet', [{'nom': 'support.json', 'fourni': False, 'maj': 2000}], [{'cle': 'projet', 'maj': 1000}], 'Support déposé'),
            ('projet modifié après le dépôt', [{'nom': 'support.json', 'fourni': False, 'maj': 1000}], [{'cle': 'projet', 'maj': 2000}], 'Porte-crayon')]:
        cfg2 = {'projet': serveur, 'donnees': donnees, 'dossier': dossier, 'fichiers': {'depart.json': depart, **({'support.json': depose} if dossier else {})},
                'atelier': {'titre': 'Modéliser le support', 'entrees': ['depart.json'], 'sorties': ['support.json', 'support.stl']}}
        ctx = b.new_context(viewport={'width': 1400, 'height': 860})
        ctx.add_init_script(f"window.CENTRALE_URL='{base}/tests/centrale/'; window.__CZ_TEST={_json.dumps(cfg2)};")
        cz = ctx.new_page(); cz.on('pageerror', lambda e: errors.append('centrale: ' + str(e)))
        cz.goto(URL + '#centrale=jeton-essai&parcours=1&etape=0'); cz.wait_for_timeout(3000)
        r = cz.evaluate("()=>[document.querySelector('#bCentrale').textContent.trim(), location.hash.includes('centrale='), window.__etabli.state.name, typeof __cz.init.avantDeQuitter]")
        if cas == 'rien de déposé':
            check('Centrale : ouvert depuis le portail (#centrale=…), connexion automatique et fichier reçu par l’étape ouvert',
                  r == ['07', False, attendu, 'function'], r)
            check('Centrale : ouvert depuis le portail, la bibliothèque ne s’ouvre pas au démarrage', cz.evaluate("()=>document.querySelector('#gallery').hidden"))
            # mode atelier : ni menu du logo, ni bibliothèque, ni onglets du guide, ni niveau
            cz.click('#bFile', force=True); cz.wait_for_timeout(150)
            ma = cz.evaluate("""()=>{const E=window.__etabli; E.openGallery(); const v=s=>{const e=document.querySelector(s); return !!e && !!e.offsetParent;};
              return [document.documentElement.classList.contains('mode-atelier'), document.querySelector('#menuFile').hidden, document.querySelector('#gallery').hidden,
                v('.gd-tabs'), v('.gd-nav'), document.documentElement.classList.contains('sans-niveau')]}""")
            check('Centrale : mode atelier (menu du logo, bibliothèque, onglets du guide et niveau fermés)', ma == [True, True, True, False, False, True], ma)
            cz.evaluate("()=>__cz.init.avantDeQuitter()"); cz.wait_for_timeout(300)
            d1 = cz.evaluate("()=>__cz.depots.map(d=>d.nom+':'+d.type+':'+(d.taille>0)).join(' ')")
            cz.evaluate("()=>__cz.init.avantDeQuitter()"); cz.wait_for_timeout(300)
            n1 = cz.evaluate("()=>__cz.depots.length")
            cz.evaluate(f"()=>{E}.addPart('box',[80,0]) && 1"); cz.wait_for_timeout(300)
            cz.evaluate("()=>__cz.init.avantDeQuitter()"); cz.wait_for_timeout(300)
            n2 = cz.evaluate("()=>__cz.depots.length")
            check('Centrale : avant « Étape suivante », les sorties de l’étape sont déposées (une seule fois tant que rien ne change)',
                  d1 == 'support.json:application/json:true support.stl:model/stl:true' and n1 == 2 and n2 == 4, [d1, n1, n2])
        else:
            check(f'Centrale : arrivée dans l’étape, {cas} → « {attendu} »', r[0] == '07' and r[2] == attendu, r)
        ctx.close()

    # Navigation intégrée (Centrale.navigation) : « ← » et « Suivant → » dans le pied du Guide ; widget avec Centrale.nomAffiche
    nav = {'contexte': 'parcours', 'position': {'numero': 2, 'total': 4, 'titre': 'Modéliser le support', 'consigne': ''},
           'precedent': {'cible': 'etape', 'libelle': 'Étape 1 : Croquis', 'court': 'Étape précédente', 'titre': 'Revenir à l’étape 1'},
           'suivant': {'cible': 'etape', 'libelle': 'Étape 3 : Valider', 'titre': 'Termine d’abord cette étape', 'verrou': True, 'raison': 'Termine d’abord « Modéliser le support »', 'fin': False}}
    cfg3 = {'projet': serveur, 'fichiers': {'depart.json': depart}, 'nav': nav, 'nom': '', 'activite': 'exo-plaque',
            'atelier': {'titre': 'Modéliser le support', 'entrees': ['depart.json'], 'sorties': ['support.json']}}
    ctx = b.new_context(viewport={'width': 1400, 'height': 860})
    ctx.add_init_script(f"window.CENTRALE_URL='{base}/tests/centrale/'; window.__CZ_TEST={_json.dumps(cfg3)};")
    cz = ctx.new_page(); cz.on('pageerror', lambda e: errors.append('navigation: ' + str(e)))
    cz.goto(URL + '#centrale=jeton-essai&parcours=1&etape=0'); cz.wait_for_timeout(3000)
    pied = """()=>{const p=document.querySelector('#demo > .gd-pied'), s=p&&p.querySelector('.gd-suiv'), t=x=>x? x.innerText.replace(/\\s+/g,' ').trim() : null;
      return p? [t(p.querySelector('.gd-pied-pos')), t(p.querySelector('.gd-prec')), t(s), !!s && s.classList.contains('verrou'), s && s.getAttribute('aria-disabled'), t(p.querySelector('.gd-pied-raison')),
        !!document.querySelector('#demo .demo-head [aria-label="Fermer le guide"]'), p===document.querySelector('#demo').lastElementChild] : null}"""
    r1 = cz.evaluate(pied)
    w = cz.evaluate("()=>{const s=document.querySelector('#bCentrale span'); return [s.textContent, s.classList.contains('anonyme'), typeof __cz.nav.options.activite, __cz.nav.options.activite(), (__cz.vue||[]).length>0]}")
    check('Navigation intégrée : pied du Guide (étape n / N, « ← Étape précédente », « Suivant » verrouillé avec la raison), sans bouton Fermer',
          r1 == ['PARCOURS · ÉTAPE 2 / 4 · Modéliser le support', '← Étape précédente', 'Suivant Étape 3 : Valider', True, 'true', 'Termine d’abord « Modéliser le support »', False, True], r1)
    check('Widget de l’élève : Centrale.nomAffiche (« pas désanonymisé » en italique), redessiné au changement de vue ; activité ouverte donnée au module',
          w == ['pas désanonymisé', True, 'function', 'exo-plaque', True], w)
    cz.click('#demo .gd-suiv', force=True); cz.wait_for_timeout(300)   # aria-disabled : Playwright ne clique pas sans force
    a1 = cz.evaluate("()=>(__cz.allers||[]).length")
    n0 = cz.evaluate("()=>__cz.depots.length")
    cz.evaluate("()=>{ const s=window.__CZ_TEST.nav.suivant; s.verrou=false; s.raison=''; s.titre='Enregistrer et ouvrir l’étape suivante'; window.__CZ_TEST.nom='Léa D.'; __cz.vue.forEach(f=>f('enseignant')); __cz.nav.relancer(); }")
    cz.wait_for_timeout(300)
    r2 = cz.evaluate(pied)
    w2 = cz.evaluate("()=>{const s=document.querySelector('#bCentrale span'); return [s.textContent, s.classList.contains('anonyme')]}")
    cz.evaluate(f"()=>{E}.addPart('box',[80,0]) && 1"); cz.wait_for_timeout(200)
    cz.click('#demo .gd-suiv'); cz.wait_for_timeout(800)
    a2 = cz.evaluate("n0=>[__cz.allers, __cz.depots.length>n0]", n0)
    m0 = cz.evaluate("()=>__cz.nav.maj")
    cz.evaluate("()=>{ window.__etabli.startLesson('premiers'); }"); cz.wait_for_timeout(300)
    a3 = cz.evaluate("m0=>[__cz.nav.maj>m0, __cz.nav.options.activite()]", m0)
    cz.click('#demo .demo-toggle'); cz.wait_for_timeout(200)
    a4 = cz.evaluate("()=>[document.querySelector('#demo').classList.contains('closed'), !!document.querySelector('#demo > .gd-pied')]")
    check('Navigation intégrée : verrouillé, le clic ne part pas ; ouvert, « Suivant → » dépose les fichiers puis part ; changement d’activité signalé ; guide replié : pied gardé',
          a1 == 0 and r2[2:6] == ['Suivant Étape 3 : Valider →', False, None, None] and w2 == ['Léa D.', False] and a2 == [['suivant'], True] and a3 == [True, 'tuto-premiers'] and a4 == [True, True],
          [a1, r2, w2, a2, a3, a4])
    # fin de parcours : retour au portail, sans double flèche
    cz.evaluate("()=>{ window.__CZ_TEST.nav.suivant={cible:'portail', libelle:'Parcours terminé → Mes ateliers', court:'Mes ateliers', titre:'Dernière étape', fin:true, verrou:false, raison:''}; __cz.nav.relancer(); }")
    cz.wait_for_timeout(300)
    check('Navigation intégrée : dernière étape, « Parcours terminé → Mes ateliers »', cz.evaluate(pied)[2] == 'Parcours terminé → Mes ateliers', cz.evaluate(pied))
    # carte d'atelier dont le module ne connaît pas l'activité : seulement « ← Mes ateliers »
    cz.evaluate("()=>{ const N=window.__CZ_TEST.nav, P={cible:'portail', libelle:'Mes ateliers', court:'Mes ateliers', titre:'', fin:false, verrou:false, raison:''}; N.contexte='atelier'; N.position=null; N.precedent=P; N.suivant=P; __cz.nav.relancer(); }")
    cz.wait_for_timeout(300)
    r3 = cz.evaluate(pied)
    check('Navigation intégrée : carte d’atelier sans suite connue, seulement « ← Mes ateliers »', r3 and r3[1] == '← Mes ateliers' and r3[2] is None, r3)
    ctx.close()

    # Copie du navigateur d'un autre élève, ou d'un élève remis à zéro sur la Centrale : vidée, pas renvoyée au serveur.
    # Travail fait en visiteur (pas de lien) : envoyé comme avant (premier cas de ce domaine).
    local = {'app': 'etabli3d', 'version': 2, 'name': 'Travail d’avant', 'nextId': 2, 'joints': [],
             'parts': [{'id': 1, 'kind': 'box', 'name': 'Bloc', 'params': {'L': 30, 'l': 30, 'h': 30}, 'color': '#4aa36b', 'hole': False, 'pos': [0, 0, 0], 'rot': [0, 0, 0]}]}
    prog = {'done': {'tuto:premiers': 1}, 'seen': {'tuto:premiers': 1}, 'part': {'premiers': 6}}
    ex = {'exo-de': {'faites': 3, 'total': 3, 'statut': 'termine'}}
    for cas, lien, cfg4, attendu in [
            ('élève remis à zéro', '5A/07', {}, ['Nouveau projet', 0, False, 0, True, '5A/07', True]),
            ('autre élève sur le poste', '5A/03', {'projet': serveur, 'progressions': ex}, ['Nouveau projet', 1, False, 0, False, '5A/07', True]),
            ('même élève, travail sur le serveur', '5A/07', {'projet': serveur, 'progressions': ex}, ['Porte-crayon', 2, True, 1, False, '5A/07', False])]:
        ctx = b.new_context(viewport={'width': 1400, 'height': 860})
        ctx.add_init_script(f"window.CENTRALE_URL='{base}/tests/centrale/'; window.__CZ_TEST={_json.dumps(cfg4)};"
                            f"if(!sessionStorage.getItem('fait')){{ sessionStorage.setItem('fait','1'); localStorage.setItem('etabli3d.autosave', {_json.dumps(_json.dumps(local))});"
                            f"localStorage.setItem('etabli3d.progress', {_json.dumps(_json.dumps(prog))}); localStorage.setItem('etabli3d.centrale-eleve', '{lien}'); localStorage.setItem('etabli3d.atelier:1:0', '1'); }}")
        cz = ctx.new_page(); cz.on('pageerror', lambda e: errors.append('remise à zéro: ' + str(e)))
        cz.goto(URL); cz.wait_for_timeout(2500)
        if cz.is_visible('#galleryClose'): cz.click('#galleryClose')
        avant = cz.evaluate("()=>window.__etabli.state.name")
        cz.click('#bCentrale'); cz.wait_for_timeout(200); cz.click('#czFaux'); cz.wait_for_timeout(1500)
        toast = cz.evaluate("()=>document.querySelector('#toast').textContent")
        cz.keyboard.press('Control+z'); cz.wait_for_timeout(300)
        r = cz.evaluate("()=>{const E=window.__etabli; return [E.state.name, Object.keys(E.PROG.done).length, !!E.PROG.done['tuto:premiers'],"
                        " __cz.progres.filter(([id])=>id==='tuto-premiers').length]}")
        r += [toast.find('remis à zéro') >= 0] + cz.evaluate("()=>[localStorage.getItem('etabli3d.centrale-eleve'), !localStorage.getItem('etabli3d.atelier:1:0')]")
        if cas == 'élève remis à zéro':   # charger() reprendrait la copie de secours du module : pas appelé, projet vide envoyé
            rs = cz.evaluate("()=>[__cz.charges||0, (__cz.sauve.filter(([k])=>k==='projet').pop()||[])[1]?.parts?.length]")
            check('Connexion, élève remis à zéro : projet du serveur lu par listeDonnees, pas par charger() ; projet vide envoyé', rs == [0, 0], rs)
        # après Annuler (le projet du serveur ouvert, Annuler fait un pas en arrière) : copie vidée → projet vide,
        # jamais le travail d'avant ; copie gardée → le projet du navigateur
        if not attendu[6]: attendu = ['Travail d’avant'] + attendu[1:]
        check(f'Connexion, {cas} : copie du navigateur ' + ('vidée (rien de renvoyé, Annuler ne la ramène pas)' if attendu[6] else 'gardée et fusionnée'),
              avant == 'Travail d’avant' and r == attendu, [avant, r])
        ctx.close()

    # Sans serveur (Centrale injoignable) : #activite= ouvre l'activité ; « Déposer sur Nuage » enregistre le projet
    # puis, sans lien de la classe, demande le lien au professeur et le garde sur le poste
    ctx = b.new_context(viewport={'width': 1400, 'height': 860}, accept_downloads=True)
    ctx.add_init_script("window.CENTRALE_URL='http://127.0.0.1:9/';")
    sv = ctx.new_page(); sv.on('pageerror', lambda e: errors.append('sans serveur: ' + str(e)))
    sv.goto(URL + '#activite=exo-plaque'); sv.wait_for_timeout(2500)
    r = sv.evaluate("()=>[window.__etabli.GUIDE.tuto, location.hash, document.querySelector('#gallery').hidden]")
    sv.evaluate("()=>{ location.hash='#activite=ex-de'; }"); sv.wait_for_timeout(1200)
    r.append(sv.evaluate("()=>window.__etabli.state.note && window.__etabli.state.note.key"))
    check('Sans serveur : #activite=exo-plaque ouvre l’exercice (adresse nettoyée), #activite=ex-de l’exemple',
          r == ['plaque', '', True, 'de'], r)
    sv.click('#bFile')
    with sv.expect_download() as dl:
        sv.click('#bNuage')
    sv.wait_for_selector('#nuageFenetre', timeout=5000)
    sv.fill('#nuageFenetre input', 'https://nuage03.apps.education.fr/s/ESSAI')
    with ctx.expect_page() as nv:
        sv.click('#nuageFenetre button:has-text("Garder et ouvrir")')
    r = [dl.value.suggested_filename, sv.evaluate("()=>localStorage.getItem('etabli3d.nuage')"), sv.locator('#nuageFenetre').count()]
    sv.click('#bFile')
    with ctx.expect_page() as nv2:
        with sv.expect_download():
            sv.click('#bNuage')
    r.append(sv.locator('#nuageFenetre').count())
    check('Sans serveur : Déposer sur Nuage enregistre le projet, garde le lien du professeur et ouvre ensuite le dossier directement',
          r[0].endswith('.json') and r[1] == 'https://nuage03.apps.education.fr/s/ESSAI' and r[2:] == [0, 0], r)
    ctx.close()
