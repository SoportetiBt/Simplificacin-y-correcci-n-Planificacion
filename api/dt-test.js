module.exports = async (req, res) => {
  const a = process.env.DT_ACTIVATION || '';
  const k = process.env.DT_API_KEY || '';
  const s = process.env.DT_API_SECRET || '';
  const out = { largos: { act: a.length, key: k.length, secret: s.length }, pruebas: [] };
  const u = 'https://planner-' + a + '.dispatchtrack.com/external_api/v1/stop_groups?per_page=1';
  const b64 = (x) => Buffer.from(x).toString('base64');
  const metodos = [
    ['name:secret', 'Basic ' + b64(k + ':' + s)],
    ['secret solo', 'Basic ' + b64(s)],
    ['bearer secret', 'Bearer ' + s],
    ['secret crudo', s]
  ];
  for (let i = 0; i < metodos.length; i++) {
    try {
      const r = await fetch(u, { headers: { Authorization: metodos[i][1], 'Content-Type': 'application/json' } });
      const t = await r.text();
      out.pruebas.push({ metodo: metodos[i][0], status: r.status, body: t.slice(0, 120) });
    } catch (e) {
      out.pruebas.push({ metodo: metodos[i][0], error: String(e) });
    }
  }
  res.status(200).json(out);
};
// fin del archivo
