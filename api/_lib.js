// 공용 유틸: Yahoo Finance 차트 조회, 점수 저장소(Upstash Redis 또는 로컬 파일)
const fs = require('fs');
const path = require('path');

const HEADERS = { 'User-Agent': 'Mozilla/5.0' };

// 일봉 조회. 거래소 현지 날짜(YYYY-MM-DD) 기준 rows 반환
async function yahooChart(symbol, period1, period2) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=div,splits`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    const err = new Error('시세 조회 실패');
    err.status = res.status < 500 ? 404 : 502;
    throw err;
  }
  const json = await res.json();
  const r = json.chart && json.chart.result && json.chart.result[0];
  if (!r || !r.timestamp) {
    const err = new Error('시세 데이터 없음');
    err.status = 404;
    throw err;
  }
  const meta = r.meta;
  const close = r.indicators.quote[0].close;
  const adj = r.indicators.adjclose && r.indicators.adjclose[0].adjclose;
  const rows = [];
  r.timestamp.forEach((ts, i) => {
    if (close[i] == null) return;
    rows.push({
      date: new Date((ts + meta.gmtoffset) * 1000).toISOString().slice(0, 10),
      close: close[i],
      adj: adj && adj[i] != null ? adj[i] : close[i],
    });
  });
  return { meta, rows };
}

// ---- 점수 저장소 ----
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'stock-game:scores';
const FILE = path.join(__dirname, '..', 'data', 'scores.json');

async function kv(cmd) {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

async function loadScores() {
  if (KV_URL && KV_TOKEN) {
    const list = await kv(['LRANGE', KEY, 0, -1]);
    return list.map((s) => JSON.parse(s));
  }
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function addScore(entry) {
  if (KV_URL && KV_TOKEN) {
    await kv(['RPUSH', KEY, JSON.stringify(entry)]);
    return;
  }
  const list = await loadScores();
  list.push(entry);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 1));
}

module.exports = { yahooChart, loadScores, addScore };
