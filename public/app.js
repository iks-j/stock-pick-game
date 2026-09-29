(() => {
  const ROUNDS = 10;
  const $ = (id) => document.getElementById(id);
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

  let allDates = [];
  let game = null; // { dates, round, balance, picks }
  let chosen = null; // 자동완성에서 선택한 종목
  let suggestions = [];
  let active = -1;
  let seq = 0;
  let lastSavedId = null;

  const pct = (r) => (r >= 0 ? '+' : '') + (r * 100).toFixed(2) + '%';
  const usd = (v) => '$' + v.toFixed(2);
  const cls = (r) => (r >= 0 ? 'up' : 'down');
  const MARKET_LABEL = { KOSPI: '코스피', KOSDAQ: '코스닥', NASDAQ: '나스닥', NYSE: 'NYSE', AMEX: 'AMEX' };

  async function api(path, opts) {
    const res = await fetch(path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '요청에 실패했어요.');
    return data;
  }

  function show(name) {
    ['start', 'game', 'final'].forEach((s) => $('screen-' + s).classList.toggle('hidden', s !== name));
    window.scrollTo(0, 0);
  }

  // ---------- 랭킹 ----------
  async function loadBoard() {
    const box = $('leaderboard');
    try {
      const { count, top } = await api('/api/scores');
      $('lb-count').textContent = `누적 참여 ${count}회`;
      if (!top.length) {
        box.innerHTML = '<p class="hint" style="padding:12px 14px">아직 기록이 없어요. 첫 번째 주인공이 되어보세요!</p>';
        return;
      }
      box.innerHTML = '';
      top.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = 'lb-row' + (s.id === lastSavedId ? ' me' : '');
        const medal = ['🥇', '🥈', '🥉'][i] || i + 1;
        const r = s.total - 1;
        row.innerHTML =
          `<div class="lb-rank">${medal}</div>` +
          `<div class="lb-name"></div>` +
          `<div class="lb-val ${cls(r)}">${pct(r)}<small>${usd(s.total)}</small></div>`;
        const nm = row.querySelector('.lb-name');
        nm.textContent = s.name;
        const d = document.createElement('span');
        d.className = 'lb-date';
        d.textContent = s.at.slice(0, 10);
        nm.appendChild(d);
        row.addEventListener('click', (e) => {
          if (e.target.closest('.pk')) return;
          const old = row.querySelector('.pk');
          if (old) return old.remove();
          const pk = document.createElement('div');
          pk.className = 'pk';
          s.picks.forEach((p) => {
            const line = document.createElement('div');
            const l = document.createElement('span');
            l.textContent = `${p.date} · ${p.name}`;
            const v = document.createElement('span');
            v.className = cls(p.ret);
            v.textContent = pct(p.ret);
            line.append(l, v);
            pk.appendChild(line);
          });
          row.appendChild(pk);
        });
        box.appendChild(row);
      });
    } catch (e) {
      box.innerHTML = `<p class="hint" style="padding:12px 14px">랭킹을 불러오지 못했어요.</p>`;
    }
  }

  // ---------- 게임 진행 ----------
  function startGame() {
    const pool = allDates.slice();
    const picked = [];
    while (picked.length < ROUNDS) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    picked.sort(); // 날짜 순서대로 복리 투자
    game = { dates: picked, round: 0, balance: 1, picks: [] };
    show('game');
    showRound();
  }

  function showRound() {
    const date = game.dates[game.round];
    const wd = WEEK[new Date(date + 'T00:00:00Z').getUTCDay()];
    $('round-label').textContent = `${game.round + 1} / ${ROUNDS}`;
    $('bar-fill').style.width = (game.round / ROUNDS) * 100 + '%';
    $('balance-label').textContent = usd(game.balance);
    $('date-big').textContent = date;
    $('date-week').textContent = wd + '요일';
    $('pick-box').classList.remove('hidden');
    $('result-box').classList.add('hidden');
    $('stock-input').value = '';
    $('stock-input').disabled = false;
    setMsg('');
    $('hint-box').classList.add('hidden');
    chosen = null;
    $('btn-confirm').disabled = true;
    hideList();
    $('stock-input').focus();
  }

  function setMsg(t, err) {
    const m = $('pick-msg');
    m.textContent = t;
    m.classList.toggle('err', !!err);
  }

  // 자동완성
  function hideList() { $('ac-list').classList.add('hidden'); active = -1; }
  function renderList() {
    const ul = $('ac-list');
    ul.innerHTML = '';
    if (!suggestions.length) return hideList();
    suggestions.forEach((s, i) => {
      const li = document.createElement('li');
      if (i === active) li.className = 'on';
      const n = document.createElement('span');
      n.textContent = `${s.name} (${s.code})`;
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = MARKET_LABEL[s.market] || s.market;
      li.append(n, b);
      li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(s); });
      ul.appendChild(li);
    });
    ul.classList.remove('hidden');
  }
  function choose(s) {
    chosen = s;
    $('stock-input').value = s.name;
    $('btn-confirm').disabled = false;
    setMsg('');
    hideList();
  }
  let timer;
  $('stock-input').addEventListener('input', () => {
    chosen = null;
    $('btn-confirm').disabled = true;
    clearTimeout(timer);
    const q = $('stock-input').value.trim();
    if (!q) return hideList();
    timer = setTimeout(async () => {
      const my = ++seq;
      try {
        const { items } = await api('/api/search?q=' + encodeURIComponent(q));
        if (my !== seq) return;
        suggestions = items;
        active = items.length ? 0 : -1;
        renderList();
        if (!items.length) setMsg('검색 결과가 없어요. 종목명이나 티커를 확인해주세요.', true);
        else setMsg('');
      } catch { /* 무시 */ }
    }, 250);
  });
  $('stock-input').addEventListener('keydown', (e) => {
    const open = !$('ac-list').classList.contains('hidden');
    if (e.key === 'ArrowDown' && open) { active = (active + 1) % suggestions.length; renderList(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && open) { active = (active - 1 + suggestions.length) % suggestions.length; renderList(); e.preventDefault(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0) choose(suggestions[active]);
      else if (chosen) confirmPick();
    } else if (e.key === 'Escape') hideList();
  });
  $('stock-input').addEventListener('blur', hideList);

  async function confirmPick() {
    if (!chosen || $('btn-confirm').disabled) return;
    const date = game.dates[game.round];
    $('btn-confirm').disabled = true;
    $('stock-input').disabled = true;
    setMsg('그날의 주가를 확인하는 중…');
    try {
      const q = await api(`/api/quote?symbol=${encodeURIComponent(chosen.symbol)}&date=${date}`);
      const from = game.balance;
      game.balance = from * (1 + q.ret);
      game.picks.push({ date, name: chosen.name, market: chosen.market, ret: q.ret });
      const cur = q.currency === 'KRW' ? '₩' : q.currency === 'USD' ? '$' : q.currency + ' ';
      const fmt = (v) => cur + v.toLocaleString('en-US', { maximumFractionDigits: q.currency === 'KRW' ? 0 : 2 });
      $('res-name').textContent = `${chosen.name} (${MARKET_LABEL[chosen.market] || chosen.market})`;
      $('res-ret').textContent = pct(q.ret);
      $('res-ret').className = 'res-ret ' + cls(q.ret);
      $('res-price').textContent = `전일 종가 ${fmt(q.prevClose)} → 종가 ${fmt(q.close)}`;
      $('res-from').textContent = usd(from);
      $('res-to').textContent = usd(game.balance);
      $('res-to').className = cls(game.balance - from);
      $('balance-label').textContent = usd(game.balance);
      $('bar-fill').style.width = ((game.round + 1) / ROUNDS) * 100 + '%';
      $('btn-next').textContent = game.round + 1 === ROUNDS ? '최종 결과 보기 →' : '다음 날짜 →';
      $('pick-box').classList.add('hidden');
      $('result-box').classList.remove('hidden');
      setMsg('');
    } catch (e) {
      $('stock-input').disabled = false;
      $('btn-confirm').disabled = false;
      setMsg(e.message, true);
    }
  }
  $('btn-confirm').addEventListener('click', confirmPick);

  $('btn-hint').addEventListener('click', async () => {
    const box = $('hint-box');
    const date = game.dates[game.round];
    box.classList.remove('hidden');
    box.innerHTML = '<p class="hint">힌트를 불러오는 중…</p>';
    try {
      const { lines } = await api('/api/hint?date=' + date);
      if (game.dates[game.round] !== date) return;
      box.innerHTML = '';
      lines.forEach((t) => {
        const p = document.createElement('p');
        p.textContent = t;
        box.appendChild(p);
      });
    } catch (e) {
      box.innerHTML = '<p class="hint">힌트를 불러오지 못했어요. 다시 눌러주세요.</p>';
    }
  });

  $('btn-next').addEventListener('click', () => {
    game.round++;
    if (game.round >= ROUNDS) return showFinal();
    showRound();
  });

  // ---------- 결과 ----------
  function showFinal() {
    const r = game.balance - 1;
    $('final-usd').textContent = usd(game.balance);
    $('final-pct').textContent = pct(r);
    $('final-pct').className = cls(r);
    const box = $('final-picks');
    box.innerHTML = '';
    game.picks.forEach((p) => {
      const line = document.createElement('div');
      const l = document.createElement('span');
      l.textContent = `${p.date} · ${p.name}`;
      const v = document.createElement('b');
      v.className = cls(p.ret);
      v.textContent = pct(p.ret);
      line.append(l, v);
      box.appendChild(line);
    });
    $('save-msg').textContent = '';
    $('save-form').querySelector('button').disabled = false;
    show('final');
    $('name-input').focus();
  }

  $('save-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    $('save-msg').textContent = '저장하는 중…';
    try {
      const { id } = await api('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: $('name-input').value.trim(), picks: game.picks }),
      });
      lastSavedId = id;
      goHome();
    } catch (err) {
      btn.disabled = false;
      $('save-msg').textContent = err.message;
    }
  });
  $('btn-skip').addEventListener('click', goHome);

  function goHome() {
    show('start');
    loadBoard();
  }

  // ---------- 초기화 ----------
  $('btn-start').addEventListener('click', startGame);
  (async function init() {
    loadBoard();
    try {
      const { dates } = await api('/api/dates');
      allDates = dates;
      $('btn-start').disabled = false;
    } catch (e) {
      $('start-msg').textContent = '날짜 데이터를 불러오지 못했어요. 새로고침해주세요.';
    }
  })();
})();
