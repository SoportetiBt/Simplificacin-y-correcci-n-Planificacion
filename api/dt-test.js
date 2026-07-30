// Puente DispatchTrack
//   /api/dt-test                 -> grupos recientes
//   /api/dt-test?stops=ID        -> detalle de paradas (pagina 1)
//   /api/dt-test?fix=ID          -> ENSAYO: paradas sin coordenada + coordenada propuesta (NO escribe)
//   /api/dt-test?fix=ID&go=1     -> escribe de verdad las coordenadas en DispatchTrack
module.exports = async (req, res) => {
  const a = process.env.DT_ACTIVATION || '';
  const k = process.env.DT_API_KEY || '';
  const s = process.env.DT_API_SECRET || '';
  const base = 'https://planner-' + a + '.dispatchtrack.com/external_api/v1';
  const H = { Authorization: 'Basic ' + Buffer.from(k + ':' + s).toString('base64'), 'Content-Type': 'application/json' };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sinCoord = (x) => (!x.latitude || !x.longitude || Number(x.latitude) === 0 || Number(x.longitude) === 0);

  let q = req.query || {};
  const getp = (name) => (q[name] !== undefined ? q[name] : (req.url && req.url.indexOf(name + '=') >= 0 ? decodeURIComponent(req.url.split(name + '=')[1].split('&')[0]) : undefined));
  const fixId = getp('fix'); const stopsId = getp('stops'); const go = getp('go');

  function clasif(h) {
    const t = (h.addresstype || h.type || '').toLowerCase();
    if (['building', 'house', 'house_number', 'address'].indexOf(t) >= 0) return 'exacta';
    if (['road', 'residential', 'pedestrian', 'street', 'tertiary', 'secondary', 'primary'].indexOf(t) >= 0) return 'aproximada';
    return 'centroide';
  }
  async function geocode(dir) {
    try {
      const u = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cl&q=' + encodeURIComponent((dir || '') + ', Chile');
      const r = await fetch(u, { headers: { 'User-Agent': 'SimplificadorPlanificacion/1.0 (pablo.millon@bigticket.cl)' } });
      const j = await r.json();
      if (!j || !j.length) return { lat: null, lon: null, conf: 'nulo' };
      const h = j[0];
      return { lat: Math.round(+h.lat * 1e6) / 1e6, lon: Math.round(+h.lon * 1e6) / 1e6, conf: clasif(h) };
    } catch (e) { return { lat: null, lon: null, conf: 'error', detalle: String(e) }; }
  }
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

  try {
    if (fixId) {
      const stops = await getAllStops(fixId);
      const faltan = stops.filter(sinCoord);
      const lote = faltan.slice(0, 6); // hasta 6 por corrida (para no exceder el tiempo)
      const acciones = [];
      for (let i = 0; i < lote.length; i++) {
        const st = lote[i];
        const geo = await geocode(st.address);
        const acc = { stop_id: st.id, ident: st.identification, dir: st.address, propuesta: geo };
        if (go === '1' && geo && geo.lat) {
          const pr = await fetch(base + '/stop_groups/' + encodeURIComponent(fixId) + '/stops/' + st.id, {
            method: 'PUT', headers: H, body: JSON.stringify({ latitude: geo.lat, longitude: geo.lon })
          });
          acc.escrito = { status: pr.status, resp: (await pr.text()).slice(0, 150) };
        }
        acciones.push(acc);
        await sleep(1100);
      }
      return res.status(200).json({
        grupo: fixId, total_paradas: stops.length, sin_coordenada: faltan.length,
        procesadas_esta_corrida: lote.length, quedan_pendientes: Math.max(0, faltan.length - lote.length),
        modo: go === '1' ? 'ESCRITO EN DISPATCHTRACK' : 'ENSAYO (no se escribio nada)', acciones
      });
    }

    if (stopsId) {
      const r = await fetch(base + '/stop_groups/' + encodeURIComponent(stopsId) + '?per_page=100', { headers: H });
      const j = await r.json(); const g = j.stop_group || j; const stops = (g && g.stops) || [];
      const faltan = stops.filter(sinCoord);
      return res.status(200).json({ grupo: { id: g && g.id, name: g && g.name, stops_count: g && g.stops_count }, paradas_en_pagina: stops.length, sin_coordenada_en_pagina: faltan.length, muestra_sin_coord: faltan.slice(0, 8).map((x) => ({ id: x.id, ident: x.identification, dir: x.address })) });
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
