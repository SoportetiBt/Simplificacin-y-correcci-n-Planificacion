// Puente DispatchTrack (protegido con clave DT_TOKEN)
//   GET  /api/dt-test?token=CLAVE            -> lista tus planificaciones
//   GET  /api/dt-test?token=CLAVE&fix=ID     -> lista las paradas SIN coordenada (stop_id, N° orden, dirección)
//   POST /api/dt-test?token=CLAVE&put=ID     -> escribe coordenadas {items:[{stop_id,lat,lon,ident}]}
module.exports = async (req, res) => {
  const a = process.env.DT_ACTIVATION || '';
  const k = process.env.DT_API_KEY || '';
  const s = process.env.DT_API_SECRET || '';
  const TOKEN = process.env.DT_TOKEN || '';
  const base = 'https://planner-' + a + '.dispatchtrack.com/external_api/v1';
  const H = { Authorization: 'Basic ' + Buffer.from(k + ':' + s).toString('base64'), 'Content-Type': 'application/json' };
  const sinCoord = (x) => (!x.latitude || !x.longitude || Number(x.latitude) === 0 || Number(x.longitude) === 0);

  const q = req.query || {};
  const getp = (n) => (q[n] !== undefined ? q[n] : (req.url && req.url.indexOf(n + '=') >= 0 ? decodeURIComponent(req.url.split(n + '=')[1].split('&')[0]) : undefined));
  const token = getp('token');
  if (!TOKEN || token !== TOKEN) return res.status(401).json({ error: 'no autorizado' });

  const putId = getp('put'); const fixId = getp('fix');

  async function getAllStops(gid) {
    let page = 1, all = [];
    while (page <= 40) {
      const r = await fetch(base + '/stop_groups/' + encodeURIComponent(gid) + '?per_page=100&page=' + page, { headers: H });
      const j = await r.json(); const g = j.stop_group || j; const st = (g && g.stops) || [];
      all = all.concat(st);
      if (st.length < 100) break;
      page++;
    }
    return all;
  }
  async function readBody() {
    let b = req.body;
    if (b && typeof b === 'object') return b;
    if (typeof b === 'string') { try { return JSON.parse(b); } catch (e) {} }
    return await new Promise((rr) => { let d = ''; req.on('data', (c) => d += c); req.on('end', () => { try { rr(JSON.parse(d)); } catch (e) { rr(null); } }); req.on('error', () => rr(null)); });
  }

  try {
    if (putId) {
      const body = await readBody();
      const items = (body && body.items) || [];
      const resultados = [];
      for (let i = 0; i < items.length && i < 60; i++) {
        const it = items[i];
        if (it.stop_id == null || it.lat == null || it.lon == null || isNaN(Number(it.lat)) || isNaN(Number(it.lon))) {
          resultados.push({ ident: it.ident, ok: false, motivo: 'datos incompletos' }); continue;
        }
        const pr = await fetch(base + '/stop_groups/' + encodeURIComponent(putId) + '/stops/' + it.stop_id, {
          method: 'PUT', headers: H, body: JSON.stringify({ latitude: Number(it.lat), longitude: Number(it.lon) })
        });
        const txt = (await pr.text()).slice(0, 120);
        resultados.push({ ident: it.ident, stop_id: it.stop_id, status: pr.status, ok: (pr.status === 200 || pr.status === 201), resp: txt });
      }
      return res.status(200).json({ escritas: resultados.filter((r) => r.ok).length, total: items.length, resultados });
    }

    if (fixId) {
      const stops = await getAllStops(fixId);
      const faltan = stops.filter(sinCoord).map((x) => ({ stop_id: x.id, ident: x.identification, dir: x.address }));
      return res.status(200).json({ grupo: fixId, total: stops.length, sin_coordenada: faltan.length, faltantes: faltan });
    }

    const r = await fetch(base + '/stop_groups?per_page=20', { headers: H });
    const j = await r.json();
    const gs = (j.stop_groups || []).map((x) => ({ id: x.id, name: x.name, status: x.status, stops_count: x.stops_count }));
    return res.status(200).json({ grupos: gs });
  } catch (e) {
    return res.status(200).json({ error: String((e && e.stack) || e) });
  }
};
// fin del archivo
