"""Chaque exemple de démonstration se charge (et tourne s’il a un moteur)."""
import os

NIVEAU = 3


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    for ex in pg.evaluate(f'()=>Object.keys({E}.SAMPLES)'):
        pg.evaluate(f"()=>{E}.loadExample('{ex}')"); pg.wait_for_timeout(500)
        r = pg.evaluate(f'''()=>{{const E={E}; const struct=E.SAMPLES['{ex}'].cat==='struct';
            const sk=E.state.parts.filter(p=>p.kind==='sketch').map(p=>{{const s=E.SK.d; E.SK.d=JSON.parse(JSON.stringify(p.params.sk)); const e=E.skSolve(); E.SK.d=s; return e;}});
            const R= struct? (E.SD().mod==='treillis'? E.ST.res : E.ST.mres) : null;
            return {{struct, ws:E.ws(), parts:E.state.parts.length, motors:E.state.joints.filter(j=>j.motor).length, note:!!E.state.note, skErr:Math.max(0,...sk), res: R? R.ok : null}}}}''')
        ok = r['note'] and r['skErr'] < 1e-3 and ((r['struct'] and r['res'] and r['ws']=='struct') or (not r['struct'] and r['parts'] > 0))
        if r['motors']:
            ok = ok and r['ws']=='mech'
            pg.click('#sPlay'); pg.wait_for_timeout(800); pg.click('#sPlay')
            ok = ok and pg.evaluate(f'()=>Object.values({E}.sim.values).some(v=>Math.abs(v)>0.5)')
            pg.click('#sReset')
        check(f'exemple {ex}', ok, r)
        pg.screenshot(path=os.path.join(OUT, f'exemple-{ex}.png'))
