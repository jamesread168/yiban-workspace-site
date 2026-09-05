/**
 * 学习闭环模块
 * A1 练习正确率 + 自动错题本（错因分类）
 * A2 错题复盘（遮答案重做，做对√ / 仍错★，周末汇总）
 * A3 薄弱点雷达图
 * A5 限时挑战 + 成绩曲线
 *
 * 数据结构（存在同步数据里，多设备共享）：
 *   data.practice.log : [{ id, at, date, sub, act, total, correct, mode, seconds }]
 *   data.wrongBook    : [{ id, sub, act, q, ans, picked, opts, reason,
 *                          at, lastAt, wrongCount, reviewOk, mastered, starred }]
 */
(function () {
  const D = () => window.AppData;
  const st = () => window.appState.data;
  const todayKey = () => window.todayKey();
  const toast = m => window.appShowToast(m);
  const confetti = () => window.appConfetti();
  const render = () => window.appRender();
  const modalEl = () => document.querySelector('#modalLayer');
  const esc = s => {
    const d = document.createElement('div');
    d.textContent = (s === null || s === undefined) ? '' : String(s);
    return d.innerHTML;
  };

  const MAX_WRONG = 200;
  const MAX_LOG = 500;

  const SUB_NAME = { yuwen: '语文', shuxue: '数学', yingyu: '英语', daode: '道法', kexue: '科学' };
  const ACT_NAME = {
    pinyin: '拼音', character: '识字卡', poem: '古诗', zi: '生字表',
    math: '加减法', math20: '20以内', shape: '图形', count: '数数',
    letter: '字母', word: '单词卡', spell: '拼写',
    story: '德育故事', habit: '好习惯', quiz: '科学问答', observe: '观察日记',
  };
  const SUB_COLOR = { yuwen: '#FFB6D9', shuxue: '#A5D8FF', yingyu: '#FFE066', daode: '#B5EAD7', kexue: '#C9B6FF' };

  // 错因分类：一年级最常见的三类
  const REASONS = [
    { id: 'unknown', emoji: '😵', label: '不会做', hint: '这个知识点还没掌握，需要再讲一遍' },
    { id: 'misread', emoji: '👀', label: '看错题', hint: '没看清题目就答了，要练审题' },
    { id: 'careless', emoji: '✏️', label: '粗心', hint: '会做但算错了，要练检查' },
  ];
  const REASON_MAP = {};
  REASONS.forEach(r => { REASON_MAP[r.id] = r; });

  function ensure() {
    const d = st();
    if (!d.practice || typeof d.practice !== 'object') d.practice = {};
    if (!Array.isArray(d.practice.log)) d.practice.log = [];
    if (!Array.isArray(d.wrongBook)) d.wrongBook = [];
    return d;
  }

  function save() {
    window.SyncAPI.saveData(st());
    if (window.appMarkDirty) window.appMarkDirty();
  }

  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = r[i]; r[i] = r[j]; r[j] = t;
    }
    return r;
  }

  function uid(p) {
    return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ============ A1 记录错题 ============
  function markWrong(sub, act, q, ans, picked, opts) {
    const d = ensure();
    const key = sub + '|' + act + '|' + String(q) + '|' + String(ans);
    let e = d.wrongBook.find(x => x.key === key);
    const now = Date.now();
    if (e) {
      e.wrongCount = (e.wrongCount || 1) + 1;
      e.lastAt = now;
      e.picked = String(picked);
      e.mastered = false;
      e.reviewOk = 0;
    } else {
      e = {
        id: uid('w'), key,
        sub, act,
        q: String(q), ans: String(ans), picked: String(picked),
        opts: Array.isArray(opts) ? opts.map(String).slice(0, 6) : null,
        reason: '', at: now, lastAt: now,
        wrongCount: 1, reviewOk: 0, mastered: false, starred: false,
      };
      d.wrongBook.unshift(e);
    }
    // 容量控制：优先丢弃已掌握且最久未复现的
    if (d.wrongBook.length > MAX_WRONG) {
      d.wrongBook.sort((a, b) => (a.mastered === b.mastered ? (b.lastAt - a.lastAt) : (a.mastered ? 1 : -1)));
      d.wrongBook.length = MAX_WRONG;
    }
    save();
    return e;
  }

  // 答错后让孩子自评错因（贴在当前练习界面里，不打断流程）
  function askReason(entry) {
    const body = modalEl() && modalEl().querySelector('.act-body');
    if (!body) return;
    const old = body.querySelector('.reason-ask');
    if (old) old.remove();
    const box = document.createElement('div');
    box.className = 'reason-ask';
    box.innerHTML = '<div class="ra-title">这道题为什么错了呀？</div><div class="ra-btns">' +
      REASONS.map(r => `<button class="ra-btn" data-reason="${r.id}"><span class="ra-emoji">${r.emoji}</span>${r.label}</button>`).join('') +
      '</div>';
    body.appendChild(box);
    box.querySelectorAll('[data-reason]').forEach(b => {
      b.addEventListener('click', () => {
        entry.reason = b.dataset.reason;
        save();
        box.querySelectorAll('.ra-btn').forEach(x => x.classList.remove('picked'));
        b.classList.add('picked');
        const r = REASON_MAP[b.dataset.reason];
        box.innerHTML = '<div class="ra-done">✅ 记下了：' + r.emoji + ' ' + r.label +
          '<span class="ra-hint">' + r.hint + '</span></div>';
      });
    });
  }

  // ============ A1 记录一次练习结果 ============
  function finish(sub, act, total, correct, mode, seconds) {
    const d = ensure();
    d.practice.log.push({
      id: uid('p'), at: Date.now(), date: todayKey(),
      sub, act,
      total: total || 0, correct: correct || 0,
      mode: mode || 'normal', seconds: seconds || 0,
    });
    if (d.practice.log.length > MAX_LOG) d.practice.log = d.practice.log.slice(-MAX_LOG);
    save();
  }

  // ============ 统计 ============
  function statsOf(days) {
    const d = ensure();
    const since = Date.now() - (days || 1) * 86400000;
    const rows = d.practice.log.filter(x => x.at >= since);
    const total = rows.reduce((n, x) => n + (x.total || 0), 0);
    const correct = rows.reduce((n, x) => n + (x.correct || 0), 0);
    return {
      total, correct,
      rate: total ? Math.round(correct / total * 100) : 0,
      sessions: rows.length,
    };
  }

  // 按「科目-活动」聚合，找出薄弱点
  function weakPoints(days) {
    const d = ensure();
    const since = Date.now() - (days || 30) * 86400000;
    const map = {};
    d.practice.log.filter(x => x.at >= since).forEach(x => {
      const k = x.sub + '|' + x.act;
      if (!map[k]) map[k] = { sub: x.sub, act: x.act, total: 0, correct: 0 };
      map[k].total += (x.total || 0);
      map[k].correct += (x.correct || 0);
    });
    return Object.values(map)
      .map(v => ({ ...v, rate: v.total ? Math.round(v.correct / v.total * 100) : 0 }))
      .filter(v => v.total >= 3)
      .sort((a, b) => a.rate - b.rate);
  }

  // ============ A3 薄弱点雷达图（按科目正确率）============
  function radarSvg(size) {
    const S = size || 220;
    const cx = S / 2, cy = S / 2, R = S / 2 - 34;
    const subs = ['yuwen', 'shuxue', 'yingyu', 'daode', 'kexue'];
    const d = ensure();
    const since = Date.now() - 30 * 86400000;
    const agg = {};
    subs.forEach(s => { agg[s] = { t: 0, c: 0 }; });
    d.practice.log.filter(x => x.at >= since).forEach(x => {
      if (!agg[x.sub]) agg[x.sub] = { t: 0, c: 0 };
      agg[x.sub].t += (x.total || 0);
      agg[x.sub].c += (x.correct || 0);
    });
    const vals = subs.map(s => (agg[s].t ? Math.round(agg[s].c / agg[s].t * 100) : 0));
    const hasData = subs.some(s => agg[s].t > 0);

    const n = subs.length;
    const pt = (i, r) => {
      const ang = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
    };
    // 网格
    let grid = '';
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const p = subs.map((_, i) => pt(i, R * f).map(v => v.toFixed(1)).join(',')).join(' ');
      grid += `<polygon points="${p}" fill="none" stroke="#E6E6EF" stroke-width="1"/>`;
    });
    subs.forEach((_, i) => {
      const p = pt(i, R);
      grid += `<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="#E6E6EF" stroke-width="1"/>`;
    });
    // 数据面
    let area = '', dots = '', labels = '';
    if (hasData) {
      const p = vals.map((v, i) => pt(i, R * Math.max(0.04, v / 100)).map(x => x.toFixed(1)).join(',')).join(' ');
      area = `<polygon points="${p}" fill="rgba(199,90,146,0.22)" stroke="#C75A92" stroke-width="2"/>`;
      dots = vals.map((v, i) => {
        const q = pt(i, R * Math.max(0.04, v / 100));
        return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3.5" fill="${SUB_COLOR[subs[i]]}" stroke="#fff" stroke-width="1.5"/>`;
      }).join('');
    }
    subs.forEach((s, i) => {
      const q = pt(i, R + 18);
      const anchor = Math.abs(q[0] - cx) < 6 ? 'middle' : (q[0] > cx ? 'start' : 'end');
      labels += `<text x="${q[0].toFixed(1)}" y="${(q[1] + 4).toFixed(1)}" text-anchor="${anchor}" font-size="12" font-weight="700" fill="#5A5A70">${SUB_NAME[s]} ${hasData ? vals[i] + '%' : ''}</text>`;
    });

    return `<svg viewBox="0 0 ${S} ${S}" width="100%" style="max-width:${S}px">${grid}${area}${dots}${labels}` +
      (hasData ? '' : `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="12" fill="#9A9AAB">暂无练习数据</text>`) +
      '</svg>';
  }

  // ============ A5 成绩曲线（限时挑战，最近 10 次）============
  function curveSvg() {
    const d = ensure();
    const rows = d.practice.log.filter(x => x.mode === 'timed').slice(-10);
    if (rows.length < 2) {
      return '<div class="view-sub">至少完成 2 次限时挑战才能画出成绩曲线 📈</div>';
    }
    const W = 420, H = 150, PL = 30, PR = 12, PT = 14, PB = 24;
    const maxV = Math.max(5, ...rows.map(r => r.correct || 0));
    const iw = W - PL - PR, ih = H - PT - PB;
    const xOf = i => PL + (rows.length === 1 ? iw / 2 : i * iw / (rows.length - 1));
    const yOf = v => PT + ih - (v / maxV) * ih;
    let grid = '';
    for (let g = 0; g <= 4; g++) {
      const y = PT + ih - g * ih / 4;
      grid += `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${(W - PR)}" y2="${y.toFixed(1)}" stroke="#EFEFF6" stroke-width="1"/>` +
        `<text x="${PL - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#9A9AAB">${Math.round(maxV * g / 4)}</text>`;
    }
    const pts = rows.map((r, i) => xOf(i).toFixed(1) + ',' + yOf(r.correct || 0).toFixed(1)).join(' ');
    const area = `${PL},${(PT + ih).toFixed(1)} ${pts} ${(W - PR)},${(PT + ih).toFixed(1)}`;
    const dots = rows.map((r, i) => `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(r.correct || 0).toFixed(1)}" r="3.5" fill="#FF7AB6" stroke="#fff" stroke-width="1.5"><title>${r.date} 答对 ${r.correct} 题</title></circle>`).join('');
    const labs = rows.map((r, i) => (i === 0 || i === rows.length - 1 || i === Math.floor(rows.length / 2))
      ? `<text x="${xOf(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#9A9AAB">${String(r.date).slice(5)}</text>` : '').join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">${grid}` +
      `<polygon points="${area}" fill="rgba(255,122,182,0.14)"/>` +
      `<polyline points="${pts}" fill="none" stroke="#FF7AB6" stroke-width="2.5" stroke-linejoin="round"/>` +
      `${dots}${labs}</svg>`;
  }

  // ============ 错题本 ============
  function openWrongBook() {
    const d = ensure();
    const list = d.wrongBook;
    const un = list.filter(x => !x.mastered);
    const mk = list.filter(x => x.mastered);

    const bySub = {};
    Object.keys(SUB_NAME).forEach(s => { bySub[s] = []; });
    un.forEach(e => { (bySub[e.sub] = bySub[e.sub] || []).push(e); });

    // 错因分布
    const reasonCount = { unknown: 0, misread: 0, careless: 0, '': 0 };
    un.forEach(e => { reasonCount[e.reason || ''] = (reasonCount[e.reason || ''] || 0) + 1; });

    const body = list.length ? `
      <div class="wb-summary">
        <div class="wb-sum-item"><b>${un.length}</b><span>待攻克</span></div>
        <div class="wb-sum-item"><b>${mk.length}</b><span>已掌握</span></div>
        <div class="wb-sum-item"><b>${list.reduce((n, x) => n + (x.wrongCount || 1), 0)}</b><span>累计答错</span></div>
      </div>
      ${un.length ? `<div class="wb-reason">
        <div class="wb-reason-title">错因分布</div>
        ${REASONS.map(r => `<div class="wb-reason-row">
          <span>${r.emoji} ${r.label}</span>
          <div class="wb-reason-bar"><span style="width:${un.length ? (reasonCount[r.id] / un.length * 100) : 0}%"></span></div>
          <b>${reasonCount[r.id]}</b></div>`).join('')}
        ${reasonCount[''] ? `<div class="view-sub" style="margin-top:6px">还有 ${reasonCount['']} 题没填错因</div>` : ''}
      </div>` : ''}
      ${Object.keys(bySub).filter(s => bySub[s] && bySub[s].length).map(s => `
        <div class="wb-group">
          <div class="wb-group-title" style="background:${SUB_COLOR[s]}22;color:#4A4A60">
            ${SUB_NAME[s] || s} · ${bySub[s].length} 题
            <button class="btn-sm btn-yellow" data-drill-sub="${s}" style="margin-left:auto">🔁 复盘本科</button>
          </div>
          ${bySub[s].map(e => wrongRowHtml(e)).join('')}
        </div>`).join('')}
      ${mk.length ? `<div class="wb-group">
        <div class="wb-group-title" style="background:#B5EAD733">✅ 已掌握（${mk.length}）</div>
        ${mk.slice(0, 30).map(e => wrongRowHtml(e)).join('')}
      </div>` : ''}
    ` : '<div class="empty"><span class="empty-emoji">🎉</span>错题本是空的，说明都做对啦！<br/>做错题目会自动收进来。</div>';

    window.openModal(`
      <div style="padding:14px 16px;border-bottom:1px solid #eee;background:linear-gradient(135deg,#FFB6D9,#FFE066)">
        <div style="font-size:16px;font-weight:800;color:#5B3A00">📕 错题本</div>
        <div style="font-size:12px;color:#7A5A20;margin-top:3px">答错的题自动收进来 · 复盘做对 2 次即出师</div>
      </div>
      <div style="padding:14px 16px;max-height:62vh;overflow-y:auto">${body}</div>
      <div class="act-foot">
        ${un.length ? '<button class="btn-sm btn-yellow" id="drillAllBtn">🔁 全部复盘</button>' : ''}
        <button class="btn-sm btn-gray" data-back>关闭</button>
      </div>
    `);

    const m = modalEl();
    m.querySelector('[data-back]').addEventListener('click', () => window.closeModal());
    m.querySelectorAll('[data-drill-sub]').forEach(b => b.addEventListener('click', () => {
      openDrill(bySub[b.dataset.drillSub]);
    }));
    const all = m.querySelector('#drillAllBtn');
    if (all) all.addEventListener('click', () => openDrill(un));
    bindWrongRow(m, () => openWrongBook());
  }

  function wrongRowHtml(e) {
    const r = REASON_MAP[e.reason];
    return `<div class="wb-item ${e.mastered ? 'mastered' : ''}">
      <div class="wb-q">${esc(e.q)}</div>
      <div class="wb-ans">正确答案：<b>${esc(e.ans)}</b>${e.picked && e.picked !== e.ans ? ` <span class="wb-picked">（你选了 ${esc(e.picked)}）</span>` : ''}</div>
      <div class="wb-meta">
        <span class="wb-tag">${ACT_NAME[e.act] || e.act}</span>
        ${r ? `<span class="wb-tag reason-${r.id}">${r.emoji} ${r.label}</span>` : '<span class="wb-tag">未标错因</span>'}
        <span class="wb-tag">错 ${e.wrongCount || 1} 次</span>
        ${(e.reviewOk || 0) > 0 ? `<span class="wb-tag ok">复盘对 ${e.reviewOk}</span>` : ''}
        ${e.starred ? '<span class="wb-tag star">★ 顽固</span>' : ''}
        <span class="wb-date">${String(e.lastAt ? new Date(e.lastAt).toLocaleDateString('zh-CN') : '')}</span>
      </div>
      <div class="wb-ops">
        ${e.mastered ? '' : '<button class="btn-sm btn-green" data-wdrill="' + e.id + '">🔁 重做</button>'}
        <button class="btn-sm btn-purple" data-wtoggle="${e.id}">${e.mastered ? '↩️ 取消掌握' : '✅ 标掌握'}</button>
        <button class="btn-sm btn-gray" data-wdel="${e.id}">🗑</button>
      </div>
    </div>`;
  }

  function bindWrongRow(scope, refresh) {
    const d = ensure();
    scope.querySelectorAll('[data-wdrill]').forEach(b => b.addEventListener('click', () => {
      const e = d.wrongBook.find(x => x.id === b.dataset.wdrill);
      if (e) openDrill([e]);
    }));
    scope.querySelectorAll('[data-wtoggle]').forEach(b => b.addEventListener('click', () => {
      const e = d.wrongBook.find(x => x.id === b.dataset.wtoggle);
      if (!e) return;
      e.mastered = !e.mastered;
      if (e.mastered) e.reviewOk = Math.max(2, e.reviewOk || 0);
      save();
      toast(e.mastered ? '已标记为掌握 ✅' : '已回到待攻克');
      refresh();
    }));
    scope.querySelectorAll('[data-wdel]').forEach(b => b.addEventListener('click', () => {
      const e = d.wrongBook.find(x => x.id === b.dataset.wdel);
      if (!e) return;
      if (window.Trash) window.Trash.push('错题', e);
      d.wrongBook = d.wrongBook.filter(x => x.id !== b.dataset.wdel);
      save();
      toast('已删除' + (window.Trash ? '（可在家长中心回收站恢复）' : ''));
      refresh();
    }));
  }

  // ============ A2 错题复盘：遮答案重做 ============
  function openDrill(list) {
    const d = ensure();
    const queue = shuffle((list || []).filter(x => !x.mastered));
    if (!queue.length) {
      toast('没有待复盘的错题 🎉');
      return;
    }
    let i = 0, okCount = 0, redoCount = 0;

    function optsOf(e) {
      if (e.opts && e.opts.length >= 2) return shuffle(e.opts);
      // 没有选项的题目：造 3 个干扰项（同科目其它错题的答案）
      const pool = d.wrongBook.filter(x => x.sub === e.sub && x.ans !== e.ans).map(x => x.ans);
      const set = [e.ans];
      shuffle(pool).forEach(v => { if (set.length < 4 && !set.includes(v)) set.push(v); });
      return set.length >= 2 ? shuffle(set) : null;
    }

    function build() {
      if (i >= queue.length) return resultScreen();
      const e = queue[i];
      const opts = optsOf(e);
      const body = opts
        ? `<div class="drill-q">${esc(e.q)}</div>
           <div class="opt-grid">${opts.map(o => `<button class="opt-btn" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>`
        : `<div class="drill-q">${esc(e.q)}</div>
           <div class="input-row"><input type="text" id="drillInput" placeholder="写出你的答案…" maxlength="30" /></div>
           <div class="input-row" style="margin-top:8px"><button class="btn-sm btn-green" data-submit>提交</button></div>`;
      return `<div class="act-screen">
        <div class="act-head"><span class="ae">🔁</span><span class="at">错题复盘</span><span class="as">${i + 1}/${queue.length}</span></div>
        <div class="act-body">
          <div class="drill-tip">遮住答案，重新做一遍～ 连续做对 2 次就出师啦</div>
          ${body}
          <div class="drill-meta">${SUB_NAME[e.sub] || e.sub} · ${ACT_NAME[e.act] || e.act} · 之前错 ${e.wrongCount || 1} 次 ${e.starred ? '★' : ''}</div>
        </div>
        <div class="act-foot">
          <button class="btn-sm btn-gray" data-skip>跳过</button>
          <button class="btn-sm btn-gray" data-quit>结束复盘</button>
        </div>
      </div>`;
    }

    function resultScreen() {
      return `<div class="act-screen">
        <div class="act-head"><span class="ae">🎉</span><span class="at">复盘完成</span></div>
        <div class="act-body" style="text-align:center;padding:20px 0">
          <div style="font-size:44px;font-weight:900;color:#FF7AB6">${okCount}/${queue.length}</div>
          <div class="view-sub">这次复盘做对 ${okCount} 题，仍有 ${redoCount} 题需要继续练</div>
          ${redoCount ? '<div class="alert alert-warn" style="margin-top:12px;text-align:left"><span class="alert-emoji">★</span><div>仍错的题已标上 ★，周末会在周报里汇总，记得重点攻克。</div></div>' : ''}
        </div>
        <div class="act-foot">
          <button class="btn-sm btn-yellow" data-again>再来一轮</button>
          <button class="btn-sm btn-gray" data-finish>完成</button>
        </div>
      </div>`;
    }

    function bind() {
      const m = modalEl();
      const e = queue[i];
      m.querySelectorAll('[data-o]').forEach(b => b.addEventListener('click', () => judge(b.dataset.o, b)));
      const sub = m.querySelector('[data-submit]');
      if (sub) {
        sub.addEventListener('click', () => {
          const v = (m.querySelector('#drillInput') || {}).value || '';
          if (!String(v).trim()) { toast('先写出答案哦～'); return; }
          judge(String(v).trim(), null);
        });
        const inp = m.querySelector('#drillInput');
        if (inp) inp.addEventListener('keypress', ev => { if (ev.key === 'Enter') sub.click(); });
      }
      const sk = m.querySelector('[data-skip]');
      if (sk) sk.addEventListener('click', () => { i++; window.openModal(build()); bind(); });
      const qt = m.querySelector('[data-quit]');
      if (qt) qt.addEventListener('click', () => { render(); openWrongBook(); });
      const ag = m.querySelector('[data-again]');
      if (ag) ag.addEventListener('click', () => { i = 0; okCount = 0; redoCount = 0; window.openModal(build()); bind(); });
      const fn = m.querySelector('[data-finish]');
      if (fn) fn.addEventListener('click', () => { render(); openWrongBook(); });
    }

    function judge(val, btn) {
      const e = queue[i];
      const right = String(val).trim() === String(e.ans).trim();
      const m = modalEl();
      m.querySelectorAll('[data-o]').forEach(x => {
        x.disabled = true;
        if (String(x.dataset.o).trim() === String(e.ans).trim()) x.classList.add('correct');
        if (x === btn && !right) x.classList.add('wrong');
      });
      const body = m.querySelector('.act-body');
      const fb = document.createElement('div');
      fb.className = 'quiz-feedback ' + (right ? 'ok' : 'no');

      if (right) {
        e.reviewOk = (e.reviewOk || 0) + 1;
        okCount++;
        if (e.reviewOk >= 2) { e.mastered = true; e.starred = false; }
        fb.innerHTML = e.mastered ? '🎉 连续做对 2 次，这题出师啦！' : '✅ 做对了！再做对 1 次就出师';
      } else {
        e.wrongCount = (e.wrongCount || 1) + 1;
        e.reviewOk = 0;
        e.mastered = false;
        e.starred = true;
        e.lastAt = Date.now();
        redoCount++;
        fb.innerHTML = '❌ 还不对，正确答案是 <b>' + esc(e.ans) + '</b>　★ 已标记为顽固题';
      }
      if (body) body.appendChild(fb);
      save();

      // 仍错 → 重新选一次错因
      if (!right && body) askReason(e);

      setTimeout(() => {
        i++;
        window.openModal(build());
        bind();
      }, right ? 1200 : 2200);
    }

    window.openModal(build());
    bind();
  }

  // ============ A5 限时挑战 ============
  const TIMED_SECONDS = 60;

  function genTimedQuestion() {
    const d = D();
    const kinds = ['pinyin', 'math', 'math20', 'spell', 'quiz'];
    const k = kinds[Math.floor(Math.random() * kinds.length)];
    if (k === 'pinyin') {
      const hz = d.HZ_DATA;
      const c = hz[Math.floor(Math.random() * hz.length)];
      const set = new Set([c.hz]);
      while (set.size < 4) set.add(hz[Math.floor(Math.random() * hz.length)].hz);
      return { sub: 'yuwen', act: 'pinyin', q: c.py, hint: '读拼音，选汉字', ans: c.hz, opts: shuffle([...set]) };
    }
    if (k === 'math' || k === 'math20') {
      const max = k === 'math' ? 10 : 20;
      const op = Math.random() < 0.5 ? '+' : '-';
      let a, b;
      if (op === '+') { a = Math.floor(Math.random() * max) + 1; b = Math.floor(Math.random() * (max - a + 1)); }
      else { a = Math.floor(Math.random() * max) + 1; b = Math.floor(Math.random() * a) + 1; }
      const ans = op === '+' ? a + b : a - b;
      const set = new Set([String(ans)]);
      while (set.size < 4) set.add(String(Math.max(0, Math.min(max * 2, ans + Math.floor(Math.random() * 7) - 3))));
      return { sub: 'shuxue', act: k, q: `${a} ${op} ${b} = ?`, hint: '算一算', ans: String(ans), opts: shuffle([...set]) };
    }
    if (k === 'spell') {
      const all = d.EN_WORDS;
      const t = all[Math.floor(Math.random() * all.length)];
      const opts = shuffle([t.word, ...shuffle(all.filter(w => w.word !== t.word)).slice(0, 3).map(w => w.word)]);
      return { sub: 'yingyu', act: 'spell', q: t.emoji + ' ' + t.cn, hint: '选出英文单词', ans: t.word, opts };
    }
    const qs = d.SCIENCE_QUIZ;
    const t = qs[Math.floor(Math.random() * qs.length)];
    return { sub: 'kexue', act: 'quiz', q: t.q, hint: '选一选', ans: t.a, opts: shuffle(t.opts.slice()) };
  }

  function openTimed() {
    const d = ensure();
    const best = d.practice.log.filter(x => x.mode === 'timed')
      .reduce((mx, x) => Math.max(mx, x.correct || 0), 0);
    let score = 0, asked = 0, left = TIMED_SECONDS, cur = null, timer = null, closed = false;

    function build() {
      cur = genTimedQuestion();
      asked++;
      const pct = Math.max(0, left / TIMED_SECONDS * 100);
      return `<div class="act-screen">
        <div class="act-head">
          <span class="ae">⏱️</span><span class="at">限时挑战</span>
          <span class="as">${left}s</span>
        </div>
        <div class="timed-bar"><span style="width:${pct}%"></span></div>
        <div class="act-body">
          <div class="timed-score">答对 <b>${score}</b> 题${best ? ' · 最佳 ' + best : ''}</div>
          <div class="drill-q">${esc(cur.q)}</div>
          <div class="view-sub" style="text-align:center;margin-bottom:8px">${esc(cur.hint)}</div>
          <div class="opt-grid">${cur.opts.map(o => `<button class="opt-btn" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>
        </div>
        <div class="act-foot"><button class="btn-sm btn-gray" data-quit>结束</button></div>
      </div>`;
    }

    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

    function quit() {
      stopTimer();
      closed = true;
      window.closeModal();
      render();
    }

    function over() {
      stopTimer();
      closed = true;
      finish('mixed', 'timed', asked, score, 'timed', TIMED_SECONDS - left);
      const newBest = Math.max(best, score);
      window.appAwardStars(score >= 10 ? 3 : score >= 5 ? 2 : 1);
      render();
      window.openModal(`<div class="act-screen">
        <div class="act-head"><span class="ae">⏱️</span><span class="at">时间到！</span></div>
        <div class="act-body" style="text-align:center;padding:16px 0">
          <div style="font-size:52px;font-weight:900;color:#FF7AB6">${score}</div>
          <div class="view-sub">60 秒内答对 ${score} 题（共 ${asked} 题）</div>
          ${score >= newBest && score > 0 ? '<div class="alert alert-good" style="margin-top:12px"><span class="alert-emoji">🏆</span><div>刷新个人最佳记录！</div></div>' : ''}
          <div style="margin-top:14px">${curveSvg()}</div>
        </div>
        <div class="act-foot">
          <button class="btn-sm btn-yellow" data-again>再来一次</button>
          <button class="btn-sm btn-gray" data-finish>完成</button>
        </div>
      </div>`);
      const m = modalEl();
      m.querySelector('[data-again]').addEventListener('click', () => openTimed());
      m.querySelector('[data-finish]').addEventListener('click', () => { window.closeModal(); render(); });
    }

    function bind() {
      const m = modalEl();
      const qt = m.querySelector('[data-quit]');
      if (qt) qt.addEventListener('click', quit);
      m.querySelectorAll('[data-o]').forEach(b => b.addEventListener('click', () => {
        if (closed) return;
        const right = String(b.dataset.o) === String(cur.ans);
        if (right) score++;
        else {
          // 挑战中的错题也进错题本（不打断节奏，静默记录）
          const e = markWrong(cur.sub, cur.act, cur.q, cur.ans, b.dataset.o, cur.opts);
          if (!e.reason) e.reason = '';
        }
        m.querySelectorAll('[data-o]').forEach(x => {
          x.disabled = true;
          if (String(x.dataset.o) === String(cur.ans)) x.classList.add('correct');
          if (x === b && !right) x.classList.add('wrong');
        });
        setTimeout(() => {
          if (closed) return;
          if (left <= 0) { over(); return; }
          window.openModal(build(), { onClose: quit }); bind();
        }, right ? 260 : 750);
      }));
    }

    window.openModal(build(), { onClose: quit });
    bind();
    timer = setInterval(() => {
      left--;
      if (left <= 0) { over(); return; }
      if (!closed) {
        const el = modalEl().querySelector('.as');
        const bar = modalEl().querySelector('.timed-bar span');
        if (el) el.textContent = left + 's';
        if (bar) bar.style.width = (left / TIMED_SECONDS * 100) + '%';
      }
    }, 1000);
  }

  // ============ 学习闭环主页 ============
  function openCenter() {
    const t1 = statsOf(1), t7 = statsOf(7), t30 = statsOf(30);
    const d = ensure();
    const un = d.wrongBook.filter(x => !x.mastered);
    const weak = weakPoints(30).slice(0, 5);
    const isWeekend = [0, 6].includes(new Date().getDay());

    window.openModal(`
      <div style="padding:14px 16px;border-bottom:1px solid #eee;background:linear-gradient(135deg,#C9B6FF,#FFB6D9)">
        <div style="font-size:16px;font-weight:800;color:#4A3A7A">🔄 学习闭环</div>
        <div style="font-size:12px;color:#6B5A9A;margin-top:3px">练 → 错 → 记 → 复盘 → 再练</div>
      </div>
      <div style="padding:14px 16px;max-height:64vh;overflow-y:auto">
        <div class="grid-3" style="gap:10px;margin-bottom:14px">
          <div class="stat-card"><div class="stat-val" style="color:#C75A92">${t1.rate}%</div><div class="stat-lab">今日正确率（${t1.total} 题）</div></div>
          <div class="stat-card"><div class="stat-val" style="color:#1B4F7A">${t7.rate}%</div><div class="stat-lab">近 7 天（${t7.total} 题）</div></div>
          <div class="stat-card"><div class="stat-val" style="color:#2D7A55">${t30.rate}%</div><div class="stat-lab">近 30 天（${t30.total} 题）</div></div>
        </div>

        ${isWeekend && un.length ? `<div class="alert alert-warn" style="margin-bottom:12px"><span class="alert-emoji">🗓️</span>
          <div><b>周末复盘时间</b>：还有 <b>${un.length}</b> 道错题没攻克${un.filter(x => x.starred).length ? `，其中 <b>${un.filter(x => x.starred).length}</b> 道标了 ★` : ''}。建议先复盘再玩～</div></div>` : ''}

        <div class="card" style="box-shadow:none;background:#fff;border:1px solid #EEE;margin-bottom:12px">
          <div class="card-title">📡 薄弱点雷达 <span class="t-sub">（近 30 天各科目正确率）</span></div>
          <div style="display:flex;align-items:center;justify-content:center">${radarSvg(230)}</div>
          ${weak.length ? `<div class="wb-reason" style="margin-top:6px">
            <div class="wb-reason-title">最需要加强的练习</div>
            ${weak.map(w => `<div class="wb-reason-row">
              <span>${SUB_NAME[w.sub] || w.sub} · ${ACT_NAME[w.act] || w.act}</span>
              <div class="wb-reason-bar"><span style="width:${100 - w.rate}%"></span></div>
              <b>${w.rate}%</b></div>`).join('')}
          </div>` : ''}
        </div>

        <div class="card" style="box-shadow:none;background:#fff;border:1px solid #EEE;margin-bottom:12px">
          <div class="card-title">📕 错题本 <span class="t-sub">（${un.length} 题待攻克）</span></div>
          <div class="view-sub" style="margin-bottom:10px">答错的题自动收录，复盘连续做对 2 次自动出师。</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn-sm btn-pink" id="wbOpenBtn">📕 打开错题本</button>
            ${un.length ? '<button class="btn-sm btn-yellow" id="wbDrillBtn">🔁 开始复盘</button>' : ''}
          </div>
        </div>

        <div class="card" style="box-shadow:none;background:#fff;border:1px solid #EEE">
          <div class="card-title">⏱️ 限时挑战 <span class="t-sub">（60 秒答对越多越好）</span></div>
          <div style="margin:10px 0">${curveSvg()}</div>
          <button class="btn-sm btn-yellow" id="timedBtn">⏱️ 开始挑战</button>
        </div>
      </div>
      <div class="act-foot"><button class="btn-sm btn-gray" data-back>关闭</button></div>
    `);

    const m = modalEl();
    m.querySelector('[data-back]').addEventListener('click', () => window.closeModal());
    m.querySelector('#wbOpenBtn').addEventListener('click', () => openWrongBook());
    const db = m.querySelector('#wbDrillBtn');
    if (db) db.addEventListener('click', () => openDrill(un));
    m.querySelector('#timedBtn').addEventListener('click', () => openTimed());
  }

  // 供周报/家长中心复用
  function weekendSummaryHtml() {
    const d = ensure();
    const un = d.wrongBook.filter(x => !x.mastered);
    if (!un.length) return '<div class="view-sub">本周错题本已清空 🎉</div>';
    const g = {};
    un.forEach(e => { const k = e.sub; (g[k] = g[k] || []).push(e); });
    const reasonCount = { unknown: 0, misread: 0, careless: 0, '': 0 };
    un.forEach(e => { reasonCount[e.reason || '']++; });
    return `<div>
      ${Object.keys(g).map(s => `<div class="wb-reason-row"><span>${SUB_NAME[s] || s}</span>
        <div class="wb-reason-bar"><span style="width:${(g[s].length / un.length * 100)}%"></span></div><b>${g[s].length}</b></div>`).join('')}
      <div class="view-sub" style="margin-top:8px">错因：不会 ${reasonCount.unknown} · 看错 ${reasonCount.misread} · 粗心 ${reasonCount.careless}${reasonCount[''] ? ' · 未标 ' + reasonCount[''] : ''}</div>
      ${un.filter(x => x.starred).length ? `<div class="alert alert-warn" style="margin-top:8px"><span class="alert-emoji">★</span><div><b>${un.filter(x => x.starred).length}</b> 道顽固题（复盘仍错）：${un.filter(x => x.starred).slice(0, 5).map(x => esc(x.q)).join('、')}</div></div>` : ''}
    </div>`;
  }

  window.Exam = {
    ensure, markWrong, askReason, finish,
    statsOf, weakPoints, radarSvg, curveSvg,
    openCenter, openWrongBook, openDrill, openTimed,
    weekendSummaryHtml,
    SUB_NAME, ACT_NAME, SUB_COLOR, REASONS,
  };
})();
