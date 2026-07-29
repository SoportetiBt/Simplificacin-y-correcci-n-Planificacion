// Diagnóstico del puente DispatchTrack — Vercel Serverless Function
// Ruta pública: https://TU-APP.vercel.app/api/dt-test
// Prueba hosts + formas de autenticación, y reporta qué variables detecta. No crea ni modifica nada.
export default async function handler(req, res) {
  const act = process.env.DT_ACTIVATION;
  const A = process.env.DT_API_KEY || '';       // "nombre" de la key
  const B = process.env.DT_API_SECRET || '';    // "secreto" de la key

  // Reporte de variables detectadas por el servidor (solo longitudes, sin exponer valores)
  const variables_detectadas = {
    DT_ACTIVATION: { presente: !!act, largo: (act || '').length },
    DT_API_KEY:    { presente: !!A,   largo: A.length },
    DT_API_SECRET: { presente: !!B,   largo: B.length }
  };

  if (!act || (!A && !B)) {
    return res.status(500).json({ ok:false, error:'Faltan variables', variables_detectadas });
  }
  const b64 = s => Buffer.from(s).toString('base64');

  const metodos = [];
  if (A && B) {
    metodos.push(['Basic nombre:secreto', 'Basic ' + b64(A + ':' + B)]);
    metodos.push(['Basic secreto:nombre', 'Basic ' + b64(B + ':' + A)]);
  }
  if (B) { metodos.push(['Basic secreto', 'Basic ' + b64(B)]); metodos.push(['Bearer secreto', 'Bearer ' + B]); metodos.push(['secreto crudo', B]); }
  if (A) { metodos.push(['Basic nombre', 'Basic ' + b64(A)]); }
  if (A.includes(':')) metodos.push(['Basic (DT_API_KEY completo)', 'Basic ' + b64(A)]);

  const hosts = [ 'https://planner-' + act + '.dispatchtrack.com' ];

  const resultados = [];
  for (const h of hosts) {
    const url = h + '/external_api/v1/stop_groups?per_page=1';
    for (const [etiqueta, auth] of metodos) {
      try {
        const r = await fetch(url, { headers: { 'Authorization': auth, 'Content-Type': 'application/json' } });
        const body = await r.text();
        resultados.push({ host: h, metodo: etiqueta, status: r.status, muestra: body.slice(0, 200) });
      } catch (e) {
        resultados.push({ host: h, metodo: etiqueta, error: String(e && e.message || e) });
      }
    }
  }
  resultados.sort((a,b) => (a.status===200?-1:0) - (b.status===200?-1:0));
  const exito = resultados.find(r => r.status === 200) || null;
  res.status(200).json({ ok:true, activation: act, variables_detectadas, exito, resultados });
