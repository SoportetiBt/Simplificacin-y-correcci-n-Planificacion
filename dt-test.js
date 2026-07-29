// Diagnostico del puente DispatchTrack - Vercel Serverless Function
// Ruta publica: https://TU-APP.vercel.app/api/dt-test
// Prueba host + formas de autenticacion, y reporta que variables detecta. No crea ni modifica nada.
export default async function handler(req, res) {
  try {
    const act = process.env.DT_ACTIVATION || '';
    const A = process.env.DT_API_KEY || '';
    const B = process.env.DT_API_SECRET || '';

    const variables_detectadas = {
      DT_ACTIVATION: { presente: !!act, largo: act.length },
      DT_API_KEY:    { presente: !!A,   largo: A.length },
      DT_API_SECRET: { presente: !!B,   largo: B.length }
    };

    if (!act || (!A && !B)) {
      return res.status(200).json({ ok: false, error: 'Faltan variables', variables_detectadas });
    }

    const b64 = function (s) { return Buffer.from(s).toString('base64'); };

    const metodos = [];
    if (A && B) {
      metodos.push(['Basic nombre-secreto', 'Basic ' + b64(A + ':' + B)]);
      metodos.push(['Basic secreto-nombre', 'Basic ' + b64(B + ':' + A)]);
    }
    if (B) {
      metodos.push(['Basic secreto', 'Basic ' + b64(B)]);
      metodos.push(['Bearer secreto', 'Bearer ' + B]);
      metodos.push(['secreto crudo', B]);
    }
    if (A) {
      metodos.push(['Basic nombre', 'Basic ' + b64(A)]);
    }
    if (A.indexOf(':') >= 0) {
      metodos.push(['Basic DT_API_KEY completo', 'Basic ' + b64(A)]);
    }

    const host = 'https://planner-' + act + '.dispatchtrack.com';
    const url = host + '/external_api/v1/stop_groups?per_page=1';

    const resultados = [];
    for (let i = 0; i < metodos.length; i++) {
      const etiqueta = metodos[i][0];
      const auth = metodos[i][1];
      try {
        const r = await fetch(url, { headers: { 'Authorization': auth, 'Content-Type': 'application/json' } });
        const body = await r.text();
        resultados.push({ metodo: etiqueta, status: r.status, muestra: body.slice(0, 200) });
      } catch (e) {
        resultados.push({ metodo: etiqueta, error: String((e && e.message) || e) });
      }
    }

    let exito = null;
    for (let i = 0; i < resultados.length; i++) {
      if (resultados[i].status === 200) { exito = resultados[i]; break; }
    }

    return res.status(200).json({ ok: true, host: host, variables_detectadas, exito, resultados });}
  } catch (err) {
    return res.status(200).json({ ok: false, error_interno: String((err && err.stack) || err) });
  }
}
