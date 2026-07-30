// Puente DispatchTrack (solo lectura por ahora)
//   /api/dt-test              -> lista tus stop groups recientes
//   /api/dt-test?stops=466350 -> muestra las paradas de ese grupo y cuales no tienen coordenada
module.exports = async (req, res) => {
  const a = process.env.DT_ACTIVATION || '';
  const k = process.env.DT_API_KEY || '';
  const s = process.env.DT_API_SECRET || '';
  const base = 'https://planner-' + a + '.dispatchtrack.com/external_api/v1';
  const auth = 'Basic ' + Buffer.from(k + ':' + s).toString('base64');
  const H = { Authorization: auth, 'Content-Type': 'application/json' };

  let q = req.query || {};
  if (!q.stops && req.url && req.url.indexOf('stops=') >= 0) {
    q.stops = decodeURIComponent(req.url.split('stops=')[1].split('&')[0]);
  }

  const sinCoord = (x) => (!x.latitude || !x.longitude || Number(x.latitude) === 0 || Number(x.longitude) === 0);

  try {
    if (q.stops) {
      const r = await fetch(base + '/stop_groups/' + encodeURIComponent(q.stops) + '?per_page=100', { headers: H });
      const txt = await r.text();
      let j; try { j = JSON.parse(txt); } catch (e) { return res.status(200).json({ status: r.status, raw: txt.slice(0, 600) }); }
      const g = j.stop_group || j;
      const stops = (g && g.stops) || [];
      const faltan = stops.filter(sinCoord);
      return res.status(200).json({
        status: r.status,
        grupo: { id: g && g.id, name: g && g.name, stops_count: g && g.stops_count, errors: g && g.errors },
        paradas_en_pagina: stops.length,
        sin_coordenada_en_pagina: faltan.length,
        muestra: stops.slice(0, 5).map((x) => ({ id: x.id, ident: x.identification, dir: x.address, lat: x.latitude, lon: x.longitude, place_id: x.place_id })),
        muestra_sin_coord: faltan.slice(0, 5).map((x) => ({ ident: x.identification, dir: x.address, lat: x.latitude, lon: x.longitude }))
      });
    }

    const r = await fetch(base + '/stop_groups?per_page=20', { headers: H });
    const txt = await r.text();
    let j; try { j = JSON.parse(txt); } catch (e) { return res.status(200).json({ status: r.status, raw: txt.slice(0, 600) }); }
    const gs = (j.stop_groups || []).map((x) => ({ id: x.id, name: x.name, active: x.active, status: x.status, stops_count: x.stops_count }));
    return res.status(200).json({ status: r.status, total: gs.length, grupos: gs, meta: j.meta });
  } catch (e) {
    return res.status(200).json({ error: String((e && e.stack) || e) });
  }
};
// fin del archivo
