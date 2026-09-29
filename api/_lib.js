// 공용 유틸: Yahoo Finance 차트 조회, 점수 저장소(Upstash Redis 또는 로컬 파일)
const fs = require('fs');
const path = require('path');

const HEADERS = { 'User-Agent': 'Mozilla/5.0' };

// 일봉 조회. 거래소 현지 날짜(YYYY-MM-DD) 기준 rows 반환
async function yahooChart(symbol, period1, period2, interval = '1d') {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=${interval}&events=div,splits`;
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
// Vercel: Blob에 기록 1건당 파일 1개로 저장(동시에 저장해도 덮어쓰기 없음). 로컬: data/scores.json
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const FILE = path.join(__dirname, '..', 'data', 'scores.json');

async function loadScores() {
  if (USE_BLOB) {
    const { list } = require('@vercel/blob');
    const blobs = [];
    let cursor;
    do {
      const page = await list({ prefix: 'scores/', cursor });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    const all = await Promise.all(
      blobs.map((b) => fetch(b.url).then((r) => r.json()).catch(() => null))
    );
    return all.filter(Boolean);
  }
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function addScore(entry) {
  if (USE_BLOB) {
    const { put } = require('@vercel/blob');
    await put(`scores/${entry.id}.json`, JSON.stringify(entry), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
    return;
  }
  const list = await loadScores();
  list.push(entry);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 1));
}

module.exports = { yahooChart, loadScores, addScore };
