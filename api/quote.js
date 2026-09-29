// 특정 종목의 특정 날짜 일간 등락률 (전 거래일 종가 대비)
const { yahooChart } = require('./_lib');

const DAY = 86400;

module.exports = async (req, res) => {
  const { symbol, date } = req.query || {};
  if (!symbol || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^[\w.\-^]{1,15}$/.test(symbol)) {
    return res.status(400).json({ error: '잘못된 요청이에요.' });
  }
  try {
    const t = Date.parse(date + 'T00:00:00Z') / 1000;
    const { meta, rows } = await yahooChart(symbol, t - 14 * DAY, t + 2 * DAY);
    if (meta.instrumentType && meta.instrumentType !== 'EQUITY') {
      return res.status(400).json({ error: 'ETF·펀드는 안 돼요. 개별 기업 종목을 골라주세요.' });
    }
    const i = rows.findIndex((r) => r.date === date);
    if (i < 1) {
      return res
        .status(404)
        .json({ error: '이 종목은 그날 거래 기록이 없어요 (상장 전이거나 거래정지). 다른 종목을 골라주세요.' });
    }
    const cur = rows[i];
    const prev = rows[i - 1];
    res.setHeader('Cache-Control', 's-maxage=86400');
    res.status(200).json({
      symbol,
      date,
      currency: meta.currency,
      prevDate: prev.date,
      prevClose: prev.close,
      close: cur.close,
      ret: cur.adj / prev.adj - 1,
    });
  } catch (e) {
    res.status(e.status || 500).json({
      error: e.status === 404 ? '이 종목은 그날 거래 기록이 없어요 (상장 전이거나 거래정지). 다른 종목을 골라주세요.' : '시세 조회에 실패했어요. 잠시 후 다시 시도해주세요.',
    });
  }
};
