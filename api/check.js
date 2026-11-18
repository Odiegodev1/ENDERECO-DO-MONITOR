// Vercel Serverless Function: GET /api/check?url=https://seusite.com
// Responde se o site está no ar, o código HTTP e o tempo de resposta.
// O objeto "project" no final é o formato que o ESP32 (NIMO) já entende.
//
// Opcional: defina ALLOWED_HOSTS=meusite.com,outro.vercel.app nas variáveis
// de ambiente da Vercel para que só esses domínios possam ser checados.

const net = require('net');
const redis = require('./_redis');

const TIMEOUT = 8000;
const UA = 'nimo-monitor/1.0 (+status check)';

// Bloqueia endereços internos/locais (evita usar a função para varrer redes privadas)
function isBlockedHost(host) {
  host = host.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host.startsWith('[')) return true; // IPv6 literal
  if (net.isIPv4(host)) {
    const [a, b] = host.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

async function probe(url, method) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method,
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA },
    });
    const ms = Date.now() - t0; // tempo até receber os headers
    try { await r.body?.cancel(); } catch {}
    return { status: r.status, ms };
  } finally {
    clearTimeout(timer);
  }
}

// Tenta HEAD (leve); se falhar ou der erro, tenta GET (alguns servidores bloqueiam HEAD)
async function check(url) {
  try {
    const r = await probe(url, 'HEAD');
    if (r.status < 400) return r;
  } catch {}
  return probe(url, 'GET');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  let raw = String(req.query.url || '').trim();
  if (!raw) return res.status(400).json({ error: 'informe ?url=' });
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;

  let target;
  try { target = new URL(raw); } catch { return res.status(400).json({ error: 'URL inválida' }); }

  if (isBlockedHost(target.hostname)) {
    return res.status(400).json({ error: 'endereço não permitido' });
  }

  const allowed = (process.env.ALLOWED_HOSTS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(target.hostname.toLowerCase())) {
    return res.status(403).json({ error: 'site não permitido' });
  }

  let httpStatus = 0, responseTime = 0, error = null;
  try {
    const r = await check(target.href);
    httpStatus = r.status;
    responseTime = r.ms;
  } catch (e) {
    error = e.name === 'AbortError' ? 'timeout' : 'sem conexão';
  }

  // Qualquer resposta abaixo de 500 significa que o servidor está respondendo
  const online = httpStatus > 0 && httpStatus < 500;
  const status = online ? 'ONLINE' : 'OFFLINE';

  // Visitantes online agora (só existe se o Redis estiver configurado
  // e o script /api/track estiver instalado no site)
  let visitors = null;
  if (redis.enabled) {
    try {
      const key = redis.siteKey(target.hostname);
      const r = await redis.run([
        ['ZREMRANGEBYSCORE', key, 0, Date.now() - redis.WINDOW],
        ['ZCARD', key],
      ]);
      visitors = Number(r[1]) || 0;
    } catch {
      visitors = null;
    }
  }

  res.status(200).json({
    url: target.href,
    name: target.hostname,
    status,
    httpStatus,
    responseTime,
    visitorsOnline: visitors,
    error,
    checkedAt: new Date().toISOString(),
    project: {
      name: target.hostname, status, httpStatus, responseTime,
      ...(visitors !== null ? { visitorsOnline: visitors } : {}),
    },
  });
};
