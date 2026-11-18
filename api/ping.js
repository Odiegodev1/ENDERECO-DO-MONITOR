// GET /api/ping?site=diegodev.tech&sid=abc123
// Chamado pelo script do site a cada ~20 s enquanto a aba está aberta.
// Guarda o visitante (sid) com a hora do último sinal.

const redis = require('./_redis');

// GIF 1x1 transparente (o script usa <img>, então não gera erro no console)
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'image/gif');

  const site = String(req.query.site || '').toLowerCase().replace(/^www\./, '');
  const sid = String(req.query.sid || '');

  const valid =
    redis.enabled &&
    /^[a-z0-9.-]{3,100}$/.test(site) &&
    /^[A-Za-z0-9_-]{6,40}$/.test(sid);

  // Se ALLOWED_HOSTS estiver definido, só aceita esses sites
  const allowed = (process.env.ALLOWED_HOSTS || '')
    .split(',').map(s => s.trim().toLowerCase().replace(/^www\./, '')).filter(Boolean);
  const permitted = !allowed.length || allowed.includes(site);

  if (valid && permitted) {
    try {
      await redis.run([['ZADD', redis.siteKey(site), Date.now(), sid]]);
    } catch {}
  }
  res.status(200).end(GIF);
};
