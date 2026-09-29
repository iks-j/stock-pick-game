// 종목명 자동완성 (네이버 증권 자동완성: 한글/영문 종목명 및 티커 지원)
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const MARKETS = new Set(['KOSPI', 'KOSDAQ', 'NASDAQ', 'NYSE', 'AMEX']);
const ETF_RE =
  /^(KODEX|TIGER|RISE|ACE|SOL|HANARO|KOSEF|ARIRANG|PLUS|KIWOOM|TIMEFOLIO|WON|1Q|BNK|마이티|히어로즈|파워|TRUSTON|ITF|KoAct|UNICORN)|레버리지|인버스|ETN|선물/i;

module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || '').trim().slice(0, 40);
  if (!q) return res.status(200).json({ items: [] });
  try {
    const r = await fetch(
      'https://ac.stock.naver.com/ac?target=stock&q=' + encodeURIComponent(q),
      { headers: HEADERS }
    );
    const j = await r.json();
    const items = (j.items || [])
      .filter((i) => MARKETS.has(i.typeCode) && !ETF_RE.test(i.name))
      .slice(0, 8)
      .map((i) => ({
        name: i.name,
        code: i.code,
        market: i.typeCode,
        symbol:
          i.typeCode === 'KOSPI' ? `${i.code}.KS`
          : i.typeCode === 'KOSDAQ' ? `${i.code}.KQ`
          : i.code.replace('.', '-'),
      }));
    res.status(200).json({ items });
  } catch (e) {
    res.status(502).json({ items: [], error: '검색 실패' });
  }
};
