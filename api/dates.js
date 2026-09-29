// 한국(코스피)과 미국(S&P500) 증시가 모두 열렸던 과거 날짜 목록
const { yahooChart } = require('./_lib');

let cache = null; // { at, dates }

module.exports = async (req, res) => {
  try {
    if (!cache || Date.now() - cache.at > 12 * 3600 * 1000) {
      const from = 1262304000; // 2010-01-01
      const to = Math.floor(Date.now() / 1000) - 86400; // 어제까지
      const [us, kr] = await Promise.all([
        yahooChart('^GSPC', from, to),
        yahooChart('^KS11', from, to),
      ]);
      const krSet = new Set(kr.rows.map((r) => r.date));
      const dates = us.rows.map((r) => r.date).filter((d) => krSet.has(d));
      cache = { at: Date.now(), dates };
    }
    res.setHeader('Cache-Control', 's-maxage=43200');
    res.status(200).json({ dates: cache.dates });
  } catch (e) {
    res.status(e.status || 500).json({ error: '날짜 목록을 불러오지 못했어요.' });
  }
};
