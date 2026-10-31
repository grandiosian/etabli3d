"""Validation, repères, liaisons, étiquettes et bulle de la Mécanique."""
import os

NIVEAU = 3


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    # Valider -> Mécanique : gate, repères, liaison accrochée à un repère
    pg.evaluate(f"()=>{E}.setWs('model')"); pg.evaluate("()=>document.querySelector('#bNew').click()"); pg.wait_for_timeout(200)
    pg.evaluate(f"()=>{{const E={E}; const a=E.addPart('box',[0,0]); a.params.L=60; a.params.l=40; a.params.h=6; const c=E.addPart('cylinder',[20,0]); c.pos=[20,0,6];}}")
    pg.evaluate(f"()=>{E}.setWs('mech')"); pg.wait_for_timeout(300)
    check('Mécanique verrouillée avant validation', pg.evaluate(f'()=>!{E}.mechReady()') and pg.locator('text=Avant de simuler').count() == 1)
    pg.click('#inspBody .btn.primary'); pg.wait_for_timeout(500)
    r = pg.evaluate(f"()=>{E}.state.parts.map(p=>[{E}.vState(p), (p.locs||[]).map(l=>l.id)])")
    check('validation : statut et repères', all(s in ('ok','warn') for s,_ in r) and 'axe' in r[1][1], r)
    pg.click('text=Ajouter une liaison'); pg.wait_for_timeout(300)
    pg.click('text=Créer la liaison'); pg.wait_for_timeout(300)
    j = pg.evaluate(f"()=>{E}.state.joints[0]")
    check('liaison accrochée au repère « axe »', j and j['loc'] and j['loc']['lid']=='axe', j and j.get('loc'))
    pg.evaluate(f"()=>{{const p={E}.state.parts[1]; p.params.d=30;}}")
    check('pièce modifiée = à revalider', pg.evaluate(f"()=>{E}.vState({E}.state.parts[1])") == 'stale')
    big = pg.evaluate(f"()=>{{const E={E}; const g=E.getGeometry({{kind:'sphere',params:{{d:20,seg:96}}}}); const p=E.makeProxy(g); return [(g.index?g.index.count:g.attributes.position.count)/3, p.attributes.position.count/3];}}")
    check('proxy basse résolution', big[1] < big[0]/3 and big[1] <= 1300, big)
    # Bulle et étiquettes (Mécanique)
    pg.evaluate(f"()=>{E}.loadExample('gears')"); pg.wait_for_timeout(500)
    n = pg.locator('#jlabels .jl').count()
    check('une étiquette par liaison', n == 4, n)
    pg.locator('#jlabels .jl').nth(0).click(); pg.wait_for_timeout(200)
    check('bulle Mécanique ouverte depuis une étiquette', pg.evaluate(f"()=>{E}.BUB.kind")=='mech' and pg.is_visible('#bubble'))
    pg.click('#bubPlay'); pg.wait_for_timeout(600)
    check('la bulle lance la simulation', pg.evaluate(f"()=>{E}.sim.playing"))
    pg.click('#bubPlay'); pg.evaluate(f"()=>{E}.simReset()")
    r = pg.evaluate(f"""()=>{{const E={E}; const p=E.state.parts[1]; const l=p.locs.find(k=>k.id==='axe'); const j=E.state.joints[0];
        j.loc={{pid:p.id,lid:'axe'}}; const before=j.axis.slice(); E.locEdit(p,l,'flip'); return [before[2], j.axis[2]];}}""")
    check('inverser un repère inverse l’axe de la liaison', r[0] > 0.99 and r[1] < -0.99, r)
    # Étiquettes regroupées : dispositions et réduction automatique
    pg.evaluate(f"()=>{E}.simReset(true)"); pg.wait_for_timeout(300)
    r = pg.evaluate("""()=>{const st=document.querySelector('#stage').getBoundingClientRect(); const L=[...document.querySelectorAll('#jlabels > .jl')].map(e=>e.getBoundingClientRect());
      return [document.querySelector('#jlabels').dataset.lay, L.length, L.every(r=>r.left>=st.left-1 && r.right<=st.right+1 && r.top>=st.top-1 && r.bottom<=st.bottom+1),
        getComputedStyle(document.querySelector('#jlGroup')).backgroundColor]}""")
    check('étiquettes autour du mécanisme (ovale, par défaut), groupe transparent', r[0]=='orbite' and r[1]==4 and r[2] and r[3] in ('rgba(0, 0, 0, 0)','transparent'), r)
    pg.click('#jlGroup .jl-lay[aria-label="En cercle"]'); pg.wait_for_timeout(200)
    pg.wait_for_timeout(300)
    r = pg.evaluate(f"""()=>{{const E={E}; const st=document.querySelector('#stage').getBoundingClientRect(); const L=[...document.querySelectorAll('#jlabels > .jl')].map(e=>e.getBoundingClientRect());
      const c=L.map(r=>[r.left+r.width/2-st.left, r.top+r.height/2-st.top]); const mx=c.reduce((a,p)=>a+p[0],0)/c.length, my=c.reduce((a,p)=>a+p[1],0)/c.length;
      const d=c.map(p=>Math.hypot(p[0]-mx,p[1]-my)); return [document.querySelector('#jlabels').dataset.lay, L.length, Math.max(...d)-Math.min(...d) < 0.25*Math.max(...d)];}}""")
    check('étiquettes en cercle autour du mécanisme', r == ['cercle', 4, True], r)
    pg.click('#jlGroup .jl-lay[aria-label="En ligne"]'); pg.wait_for_timeout(200)
    big = pg.evaluate("()=>document.querySelector('#jlabels').dataset.sz")
    pg.set_viewport_size({'width': 760, 'height': 560}); pg.wait_for_timeout(500)
    small = pg.evaluate("()=>{const st=document.querySelector('#stage').getBoundingClientRect(); return [document.querySelector('#jlabels').dataset.sz, [...document.querySelectorAll('#jlabels > .jl')].every(e=>{const r=e.getBoundingClientRect(); return r.left>=st.left-1 && r.right<=st.right+1;})]}")
    rank = {'full':0, 'compact':1, 'mini':2}
    check('étiquettes réduites quand la vue est petite', rank[small[0]] >= rank[big] and small[0] != 'full' and small[1], [big, small])
    pg.set_viewport_size({'width': 1400, 'height': 860}); pg.wait_for_timeout(400)
    r = pg.evaluate(f"()=>{{const st=document.querySelector('#stage').getBoundingClientRect(), c=document.querySelector('#stage canvas.gl').getBoundingClientRect(), a=document.querySelector('#app').getBoundingClientRect(); return [Math.round(c.width-st.width), Math.round(st.left-a.left+a.right-st.right), getComputedStyle(document.querySelector('#insp')).backgroundColor, Math.round(st.top-c.top), getComputedStyle(document.querySelector('#rack')).backgroundColor]}}")
    check('panneaux transparents (réglages, barre de création), la vue 3D passe dessous', abs(r[0]-r[1]) <= 1 and r[0] > 40 and ('/ 0.' in r[2] or 'rgba' in r[2]), r)
