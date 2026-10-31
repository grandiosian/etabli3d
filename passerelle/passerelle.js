/* Passerelle — client pour l'application centralisatrice (aucune dépendance, module ES).
   Côté centralisateur :

     import { Passerelle } from './passerelle.js';
     const app = await Passerelle.connect(iframe, { origin: 'https://grandiosian.github.io', hub: { name: 'Mon ENT' } });
     const { project } = await app.request('project.get');
     app.on('project.changed', ({ revision, project }) => …);
     await app.subscribe(['project.changed'], { withProject: true });

   Le contrat (messages, événements, formats) est décrit dans PASSERELLE.md et manifest.json. */
export class Passerelle {
  static PROTOCOL = 'passerelle';
  static VERSION = 1;

  /** Attend l'annonce « ready » de l'app cible (ou la provoque), puis fait la poignée de main « hello ». */
  static async connect(target, { origin, hub = {}, timeout = 20000 } = {}) {
    const win = target.contentWindow || target;   // iframe ou fenêtre ouverte par window.open
    if (!origin) throw new Error('Passerelle : précisez l’origine de l’app cible (ex. https://grandiosian.github.io).');
    const p = new Passerelle(win, origin);
    const t0 = Date.now();
    // l'app répond à « hello » dès qu'elle est chargée ; on réessaie jusqu'à la réponse (ou l'accord de l'utilisateur)
    for (;;) {
      try { p.manifest = (await p.request('hello', { hub, protocolVersion: Passerelle.VERSION }, 1500)).manifest; return p; }
      catch (e) { if (e.code && e.code !== 'timeout') throw e; if (Date.now() - t0 > timeout) throw new Error('Passerelle : pas de réponse de l’app cible.'); }
    }
  }

  constructor(win, origin) {
    this.win = win; this.origin = origin; this.seq = 0; this.pending = new Map(); this.handlers = new Map(); this.manifest = null;
    this._onMessage = (ev) => {
      const m = ev.data;
      if (ev.source !== this.win || ev.origin !== this.origin || !m || m.protocol !== Passerelle.PROTOCOL) return;
      if (m.type === 'reply') {
        const w = this.pending.get(m.replyTo); if (!w) return;
        this.pending.delete(m.replyTo); clearTimeout(w.timer);
        if (m.ok) w.resolve(m.data); else w.reject(Object.assign(new Error(m.error?.message || 'erreur'), { code: m.error?.code }));
        return;
      }
      for (const cb of this.handlers.get(m.type) || []) cb(m.data, m);
      for (const cb of this.handlers.get('*') || []) cb(m.data, m);
    };
    window.addEventListener('message', this._onMessage);
  }

  /** Envoie une requête et attend la réponse. Rejette avec err.code (timeout, refused, bad-project, unknown-type…). */
  request(type, data = {}, timeout = 15000) {
    const id = 'h' + (++this.seq);
    return new Promise((resolve, reject) => {
      // « hello » peut attendre l'accord de l'utilisateur : délai long seulement après la première tentative
      const timer = setTimeout(() => { this.pending.delete(id); reject(Object.assign(new Error('Délai dépassé : ' + type), { code: 'timeout' })); }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.win.postMessage({ protocol: Passerelle.PROTOCOL, v: Passerelle.VERSION, id, type, data }, this.origin);
    });
  }

  /** Écoute un événement de l'app cible ('project.changed', 'selection.changed'… ou '*'). Renvoie une fonction pour arrêter. */
  on(type, cb) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(cb); return () => this.handlers.get(type).delete(cb); }

  subscribe(events, { withProject = false } = {}) { return this.request('events.subscribe', { events, withProject }); }

  close() { window.removeEventListener('message', this._onMessage); for (const w of this.pending.values()) clearTimeout(w.timer); this.pending.clear(); }
}

/** Décode le STL renvoyé par « export.stl » en Blob téléchargeable. */
export function stlBlob({ base64, mime = 'model/stl' }) {
  const bin = atob(base64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}
