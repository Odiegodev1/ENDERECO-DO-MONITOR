// GET /api/track  → devolve o script que você coloca no seu site.
// Uso: <script defer src="https://SEU-MONITOR.vercel.app/api/track"></script>

module.exports = (req, res) => {
  const base = 'https://' + req.headers.host;
  const code = `(function(){
  try {
    var base = ${JSON.stringify(base)};
    var sid = null;
    try { sid = sessionStorage.getItem('nimo_sid'); } catch (e) {}
    if (!sid) {
      sid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      try { sessionStorage.setItem('nimo_sid', sid); } catch (e) {}
    }
    var site = location.hostname.replace(/^www\\./, '');
    function ping() {
      if (document.hidden) return;
      new Image().src = base + '/api/ping?site=' + encodeURIComponent(site) +
        '&sid=' + encodeURIComponent(sid) + '&t=' + Date.now();
    }
    ping();
    setInterval(ping, 20000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ping(); });
  } catch (e) {}
})();`;

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).send(code);
};
