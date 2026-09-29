// 랭킹 조회(GET) / 기록 등록(POST)
const { loadScores, addScore } = require('./_lib');

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const b = req.body || {};
      const name = String(b.name || '').trim().slice(0, 20);
      const picks = Array.isArray(b.picks) ? b.picks : [];
      if (!name || picks.length !== 10) {
        return res.status(400).json({ error: '이름과 10개의 선택이 필요해요.' });
      }
      const clean = [];
      for (const p of picks) {
        const ret = Number(p.ret);
        if (!Number.isFinite(ret) || ret < -1 || ret > 10) {
          return res.status(400).json({ error: '잘못된 기록이에요.' });
        }
        clean.push({
          date: String(p.date).slice(0, 10),
          name: String(p.name).slice(0, 40),
          market: String(p.market || '').slice(0, 10),
          ret,
        });
      }
      // 최종 수익률은 서버에서 다시 복리 계산
      const total = clean.reduce((acc, p) => acc * (1 + p.ret), 1);
      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name,
        total,
        picks: clean,
        at: new Date().toISOString(),
      };
      await addScore(entry);
      return res.status(200).json({ ok: true, id: entry.id });
    }

    const all = await loadScores();
    all.sort((a, b) => b.total - a.total);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ count: all.length, top: all.slice(0, 50) });
  } catch (e) {
    res.status(500).json({ error: '랭킹 처리 중 오류가 발생했어요.' });
  }
};
