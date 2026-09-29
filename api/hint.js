// 힌트: 해당 월의 경제 이벤트 + 강세/약세 국가 + 강세/약세 섹터 (3줄)
const { yahooChart } = require('./_lib');
const EVENTS = require('./_events');

const COUNTRIES = [
  ['^KS11', '🇰🇷 한국'], ['^GSPC', '🇺🇸 미국'], ['^N225', '🇯🇵 일본'], ['000001.SS', '🇨🇳 중국'],
  ['^HSI', '🇭🇰 홍콩'], ['^TWII', '🇹🇼 대만'], ['^BSESN', '🇮🇳 인도'], ['^GDAXI', '🇩🇪 독일'],
  ['^FTSE', '🇬🇧 영국'], ['^FCHI', '🇫🇷 프랑스'],
];
const US_SECTORS = [
  ['XLK', '기술'], ['XLF', '금융'], ['XLE', '에너지'], ['XLV', '헬스케어'], ['XLY', '경기소비재'],
  ['XLP', '필수소비재'], ['XLI', '산업재'], ['XLB', '소재'], ['XLU', '유틸리티'],
];
const KR_SECTORS = [
  ['091160.KS', '반도체'], ['091180.KS', '자동차'], ['091170.KS', '은행'], ['117460.KS', '에너지화학'],
  ['117700.KS', '건설'], ['117680.KS', '철강'], ['102970.KS', '증권'], ['266420.KS', '헬스케어'],
  ['305720.KS', '2차전지'], ['244580.KS', '바이오'],
];

let cache = null; // { at, ret: { symbol: { 'YYYY-MM': 월간수익률 } } }

async function load() {
  if (cache && Date.now() - cache.at < 12 * 3600 * 1000) return cache.ret;
  const from = 1259625600; // 2009-12-01 (2010-01 수익률 계산용)
  const to = Math.floor(Date.now() / 1000);
  const syms = [...COUNTRIES, ...US_SECTORS, ...KR_SECTORS].map((x) => x[0]);
  const results = await Promise.allSettled(syms.map((s) => yahooChart(s, from, to, '1mo')));
  const ret = {};
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const rows = r.value.rows;
    const m = {};
    for (let k = 1; k < rows.length; k++) {
      m[rows[k].date.slice(0, 7)] = rows[k].adj / rows[k - 1].adj - 1;
    }
    ret[syms[i]] = m;
  });
  cache = { at: Date.now(), ret };
  return ret;
}

const pct = (r) => (r >= 0 ? '+' : '') + (r * 100).toFixed(1) + '%';
const rank = (list, ret, month) =>
  list
    .filter(([s]) => ret[s] && ret[s][month] != null)
    .map(([s, n]) => ({ n, r: ret[s][month], s }))
    .sort((a, b) => b.r - a.r);
const fmt = (x) => `${x.n} ${pct(x.r)}`;

module.exports = async (req, res) => {
  const date = String((req.query && req.query.date) || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: '잘못된 요청이에요.' });
  const month = date.slice(0, 7);
  try {
    const ret = await load();
    const countries = rank(COUNTRIES, ret, month);
    const us = rank(US_SECTORS, ret, month);
    const kr = rank(KR_SECTORS, ret, month);
    const label = `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;

    // 1) 경제 이벤트
    let l1;
    if (EVENTS[month]) {
      l1 = `📰 ${label}: ${EVENTS[month]}`;
    } else {
      const kospi = ret['^KS11'] && ret['^KS11'][month];
      const spx = ret['^GSPC'] && ret['^GSPC'][month];
      l1 =
        `📰 ${label}: 시장을 뒤흔든 대형 이벤트는 두드러지지 않았어요.` +
        (kospi != null && spx != null ? ` (이달 코스피 ${pct(kospi)}, S&P500 ${pct(spx)})` : '');
    }

    // 2) 국가별
    let l2 = '🌏 국가별 증시 데이터가 없어요.';
    if (countries.length >= 3) {
      const w = countries[countries.length - 1];
      l2 = `🌏 국가별 월간 수익률 — 상위: ${fmt(countries[0])}, ${fmt(countries[1])} / 하위: ${fmt(w)}`;
      const own = countries.filter((c) => c.s === '^KS11' || c.s === '^GSPC').filter((c) => c !== countries[0] && c !== countries[1] && c !== w);
      if (own.length) l2 += ` (${own.map(fmt).join(', ')})`;
    }

    // 3) 섹터별
    const parts = [];
    if (us.length >= 3) parts.push(`미국 상위 ${fmt(us[0])}, ${fmt(us[1])} · 하위 ${fmt(us[us.length - 1])}`);
    if (kr.length >= 3) parts.push(`한국 상위 ${fmt(kr[0])} · 하위 ${fmt(kr[kr.length - 1])}`);
    const l3 = '🏭 섹터별 월간 수익률 — ' + (parts.join(' / ') || '데이터가 없어요.');

    res.setHeader('Cache-Control', 's-maxage=43200');
    res.status(200).json({ lines: [l1, l2, l3] });
  } catch (e) {
    res.status(500).json({ error: '힌트를 불러오지 못했어요.' });
  }
};
