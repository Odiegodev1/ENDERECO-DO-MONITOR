// Cliente mínimo para Redis via REST (Upstash). Arquivos com "_" no começo
// não viram endpoint na Vercel, então este arquivo só serve de apoio.
//
// Variáveis de ambiente (criadas automaticamente pela integração Upstash
// da Vercel; os dois nomes abaixo são aceitos):
//   KV_REST_API_URL / KV_REST_API_TOKEN
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Um visitante conta como "online" se deu sinal de vida nos últimos 45 s.
const WINDOW = 45000;

const enabled = Boolean(URL_ && TOKEN);

// Executa vários comandos numa única chamada: run([['ZCARD','chave'], ...])
async function run(commands) {
  const r = await fetch(URL_.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  const out = await r.json();
  return out.map(x => x.result);
}

// "www.diegodev.tech" e "diegodev.tech" contam como o mesmo site
const siteKey = host => 'presence:' + String(host).toLowerCase().replace(/^www\./, '');

module.exports = { enabled, run, WINDOW, siteKey };
