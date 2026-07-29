module.exports = async (req, res) => {
  const a = process.env.DT_ACTIVATION || '';
  const k = process.env.DT_API_KEY || '';
  const s = process.env.DT_API_SECRET || '';
  const out = { largos: { act: a.length, key: k.length, secret: s.length } };
  try {
    const auth = 'Basic ' + Buffer.from(k + ':' + s).toString('base64');
    const u = 'https://planner-' + a + '.dispatchtrack.com/external_api/v1/stop_groups?per_page=1';
    const r = await fetch(u, { headers: { Authorization: auth } });
    out.status = r.status;
    out.body = (await r.text()).slice(0, 200);
  } catch (e) {
    out.error = String(e);
  }
  res.status(200).json(out);
};
// fin del archivo
