/**
 * 家长端 + 回收站
 *  E1 儿童/家长双模式（4 位 PIN）
 *  E2 周报/月报（一键导出 PDF / HTML）
 *  E3 班级通知登记（可转待办）
 *  F5 本地快照（撤销误删/误改）
 */
(function () {
  const st = () => window.appState.data;
  const toast = m => window.appShowToast(m);
  const confetti = () => window.appConfetti && window.appConfetti();
  const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  const todayKey = () => window.todayKey();
  const MONTH_NAMES = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

  // ============ E1 模式切换 ============
  const PIN_KEY = '_parentPin';
  const MODE_KEY = '_currentMode';

  function currentMode() { return sessionStorage.getItem(MODE_KEY) || 'child'; }

  function setMode(m) {
    try { sessionStorage.setItem(MODE_KEY, m); } catch (e) {}
    document.body.classList.toggle('parent-mode', m === 'parent');
    document.body.classList.toggle('child-mode', m === 'child');
    document.dispatchEvent(new CustomEvent('modechange', { detail: m }));
    try { if (window.appRender) window.appRender(); } catch (e) { toast('切换模式失败：' + e.message); }
  }

  function ensurePin() {
    let pin = localStorage.getItem(PIN_KEY);
    return pin;
  }
  function setPin(pin) { localStorage.setItem(PIN_KEY, pin); }

  function askPin(action, onOk) {
    const pin = ensurePin();
    if (!pin) {
      // 第一次设置 PIN
      window.openModal(`
        <div style="padding:18px 16px;text-align:center">
          <div style="font-size:42px;margin-bottom:10px">🔒</div>
          <div style="font-size:18px;font-weight:800;color:#4A3A7A">设置 4 位家长密码</div>
          <div class="view-sub" style="margin:8px 0 14px">让孩子切换到家长模式时输入，避免他/她自己修改数据</div>
          <div class="input-row" style="justify-content:center">
            <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" id="pinFirst" placeholder="新密码" />
            <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" id="pinSecond" placeholder="再输入一次" />
          </div>
        </div>
        <div class="act-foot"><button class="btn-sm btn-gray" data-cancel>取消</button><button class="btn-sm btn-yellow" data-ok>设置</button></div>
      `);
      const m = document.querySelector('#modalLayer');
      m.querySelector('[data-cancel]').addEventListener('click', () => window.closeModal());
      m.querySelector('[data-cancel]').addEventListener('click', () => window.closeModal());
      const i1 = m.querySelector('#pinFirst'), i2 = m.querySelector('#pinSecond');
      const doSet = () => {
        try {
          const a = (i1.value || '').trim();
          const b = (i2.value || '').trim();
          if (!/^\d{4}$/.test(a) || a !== b) { toast('两次密码不一致或格式错误'); return; }
          setPin(a);
          setMode('parent');
          toast('已切换到家长模式 👨‍👩‍👧');
          window.closeModal();
          if (onOk) onOk();
        } catch (e) { toast('设置密码失败：' + e.message); }
      };
      const okBtn = m.querySelector('[data-ok]');
      okBtn.addEventListener('click', doSet);
      okBtn.addEventListener('touchend', e => { if (e && e.preventDefault) e.preventDefault(); doSet(); });
      i1.addEventListener('keypress', e => { if (e.key === 'Enter') doSet(); });
      i1.addEventListener('keydown', e => { if (e.key === 'Enter') doSet(); });
      i2.addEventListener('keypress', e => { if (e.key === 'Enter') doSet(); });
      i2.addEventListener('keydown', e => { if (e.key === 'Enter') doSet(); });
      return;
    }
    // 已经有 PIN，要求输入
    window.openModal(`
      <div style="padding:18px 16px;text-align:center">
        <div style="font-size:42px;margin-bottom:10px">🔒</div>
        <div style="font-size:18px;font-weight:800;color:#4A3A7A">请输入 4 位家长密码</div>
        <div class="input-row" style="justify-content:center;margin-top:14px">
          <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" id="pinInput" autofocus placeholder="****" />
        </div>
      </div>
      <div class="act-foot"><button class="btn-sm btn-gray" data-cancel>取消</button><button class="btn-sm btn-yellow" data-ok>确定</button></div>
    `);
    const m = document.querySelector('#modalLayer');
    m.querySelector('[data-cancel]').addEventListener('click', () => window.closeModal());
    const inp = m.querySelector('#pinInput');
    function tryLogin() {
      try {
        const v = (inp.value || '').trim();
        if (v !== ensurePin()) {
          toast('密码错误，再试一次～');
          inp.value = ''; inp.focus();
          return;
        }
        setMode('parent');
        toast('已切换到家长模式 👨‍👩‍👧');
        window.closeModal();
        if (onOk) onOk();
      } catch (e) { toast('切换失败：' + e.message); }
    }
    const okBtn = m.querySelector('[data-ok]');
    okBtn.addEventListener('click', tryLogin);
    okBtn.addEventListener('touchend', e => { if (e && e.preventDefault) e.preventDefault(); tryLogin(); });
    inp.addEventListener('keypress', e => { if (e.key === 'Enter') tryLogin(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
  }

  function uiBar() {
    const mode = currentMode();
    if (mode === 'child') {
      return `<button class="btn-sm btn-purple" data-mode-to="parent" title="家长切换密码验证">👨‍👩‍👧 家长模式</button>`;
    }
    return `<button class="btn-sm btn-yellow" data-mode-to="child" title="切换回儿童模式">🐰 儿童模式</button>`;
  }
  function bindBar(scope) {
    scope.querySelectorAll('[data-mode-to]').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.modeTo;
      if (t === 'parent') askPin();
      else setMode('child');
    }));
  }

  // ============ F5 本地快照（回收站）============
  const TRASH_KEY = '_trash';
  const MAX_TRASH = 50;

  function trashList() {
    try { return JSON.parse(localStorage.getItem(TRASH_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveTrash(list) { localStorage.setItem(TRASH_KEY, JSON.stringify(list.slice(0, MAX_TRASH))); }

  function push(kind, item) {
    const l = trashList();
    l.unshift({ id: 't' + Date.now() + Math.random().toString(36).slice(2, 5), kind, item, at: Date.now() });
    saveTrash(l);
  }

  function openTrash() {
    const l = trashList();
    window.openModal(`
      <div style="padding:14px 16px;border-bottom:1px solid #eee;background:linear-gradient(135deg,#FFE066,#FFB6D9)">
        <div style="font-size:16px;font-weight:800;color:#5B3A00">🗑 回收站 <span class="t-sub">（最近 ${l.length} 项）</span></div>
        <div class="view-sub" style="margin-top:3px;color:#7A5A20">误删/误改的内容都在这里 · 7 天后自动清空</div>
      </div>
      <div style="padding:14px 16px;max-height:60vh;overflow-y:auto">
        ${l.length ? l.map(e => `<div class="trash-row">
          <div>
            <span class="trash-kind">${e.kind}</span>
            <div class="trash-meta">${new Date(e.at).toLocaleString('zh-CN')}</div>
            <div class="trash-preview">${esc(JSON.stringify(e.item).slice(0, 200))}</div>
          </div>
          <div class="trash-ops">
            ${(typeof TrashRestore === 'function' || e.kind === '错题') ? `<button class="btn-sm btn-green" data-trash-back="${e.id}">↩️ 恢复</button>` : ''}
            <button class="btn-sm btn-red" data-trash-del="${e.id}">永久删除</button>
          </div>
        </div>`).join('') : '<div class="empty"><span class="empty-emoji">🧹</span>回收站是空的～</div>'}
      </div>
      <div class="act-foot">${l.length ? '<button class="btn-sm btn-red" data-trash-clear>清空回收站</button>' : ''}<button class="btn-sm btn-gray" data-back>关闭</button></div>
    `);
    const m = document.querySelector('#modalLayer');
    m.querySelector('[data-back]').addEventListener('click', () => window.closeModal());
    m.querySelectorAll('[data-trash-del]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.trashDel;
      saveTrash(trashList().filter(x => x.id !== id));
      toast('已永久删除');
      openTrash();
    }));
    const cb = m.querySelector('[data-trash-clear]');
    if (cb) cb.addEventListener('click', () => {
      if (!confirm('确认清空回收站？所有内容会永久删除')) return;
      saveTrash([]);
      toast('已清空');
      openTrash();
    });
    m.querySelectorAll('[data-trash-back]').forEach(b => b.addEventListener('click', () => {
      const e = trashList().find(x => x.id === b.dataset.trashBack);
      if (!e) return;
      restoreItem(e);
      saveTrash(trashList().filter(x => x.id !== b.dataset.trashBack));
      toast('已恢复 ✅');
      openTrash();
    }));
  }

  function restoreItem(e) {
    const d = st();
    if (e.kind === '错题') {
      const x = e.item;
      if (!Array.isArray(d.wrongBook)) d.wrongBook = [];
      // 避免 key 重复
      if (!d.wrongBook.find(y => y.key === x.key)) d.wrongBook.unshift(x);
      window.SyncAPI.saveData(d); if (window.appMarkDirty) window.appMarkDirty();
    }
  }

  // 清过期项
  setInterval(() => {
    const before = trashList().length;
    const kept = trashList().filter(e => Date.now() - e.at < 7 * 86400000);
    if (kept.length !== before) saveTrash(kept);
  }, 60 * 1000);

  // ============ E2 周报/月报 ============
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function dayRange(daysAgo) {
    const out = [];
    const today = new Date();
    for (let i = daysAgo - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      out.push(fmtDate(d));
    }
    return out;
  }
  function within(t, since) { return t && t >= since; }

  function weeklySummary() {
    const days = dayRange(7);
    const d = st();
    let habits = 0, habitMax = 0, study = 0, mood = 0, checkins = 0, stars = 0, readMin = 0, sport = 0;
    for (const k of days) {
      habitMax += window.AppData.DEFAULT_HABITS.length;
      habits += Object.values(d.habits?.[k] || {}).filter(Boolean).length;
      study += Object.values(d.study?.[k] || {}).reduce((n, o) => n + Object.values(o || {}).filter(Boolean).length, 0);
      if (d.mood?.[k]) mood++;
      checkins += Object.values(d.checkins?.[k] || {}).filter(Boolean).length;
      stars += (d.starsHistory || []).filter(s => s.date === k).reduce((n, s) => n + s.n, 0);
      readMin += (d.reading || []).filter(r => r.date === k).reduce((n, r) => n + r.minutes, 0);
      sport += Object.keys(d.exercise?.[k] || {}).length;
    }
    const since = Date.now() - 7 * 86400000;
    const w = (d.practice?.log || []).filter(x => x.at >= since);
    const ts = w.reduce((n, x) => n + (x.total || 0), 0);
    const ok = w.reduce((n, x) => n + (x.correct || 0), 0);
    const pct = ts ? Math.round(ok / ts * 100) : 0;
    return { habits, habitMax, study, mood, checkins, stars, readMin, sport, total: ts, correct: ok, pct };
  }
  function monthlySummary() {
    const days = dayRange(30);
    const d = st();
    let habits = 0, habitMax = 0, study = 0, mood = 0, checkins = 0, stars = 0, readMin = 0, sport = 0;
    for (const k of days) {
      habitMax += window.AppData.DEFAULT_HABITS.length;
      habits += Object.values(d.habits?.[k] || {}).filter(Boolean).length;
      study += Object.values(d.study?.[k] || {}).reduce((n, o) => n + Object.values(o || {}).filter(Boolean).length, 0);
      if (d.mood?.[k]) mood++;
      checkins += Object.values(d.checkins?.[k] || {}).filter(Boolean).length;
      stars += (d.starsHistory || []).filter(s => s.date === k).reduce((n, s) => n + s.n, 0);
      readMin += (d.reading || []).filter(r => r.date === k).reduce((n, r) => n + r.minutes, 0);
      sport += Object.keys(d.exercise?.[k] || {}).length;
    }
    return { habits, habitMax, study, mood, checkins, stars, readMin, sport };
  }

  function reportHtml(kind) {
    const sum = kind === 'month' ? monthlySummary() : weeklySummary();
    const title = kind === 'month' ? '月报' : '周报';
    const date = new Date();
    const range = kind === 'month' ? `${date.getMonth() + 1} 月` : `${(function () { const t = new Date(date); t.setDate(t.getDate() - 6); return `${t.getMonth() + 1}/${t.getDate()}`; })()} - ${date.getMonth() + 1}/${date.getDate()}`;
    const exHtml = (window.Exam && window.Exam.weekendSummaryHtml) ? window.Exam.weekendSummaryHtml() : '';
    return `
      <div class="report-head">
        <div class="report-h-emoji">${kind === 'month' ? '🌕' : '📅'}</div>
        <div>
          <div class="report-h-title">${title}</div>
          <div class="report-h-sub">${range}</div>
        </div>
      </div>
      <div class="report-grid">
        <div class="report-cell"><div class="report-num">${sum.habits}/${sum.habitMax}</div><div class="report-lab">习惯打卡</div></div>
        <div class="report-cell"><div class="report-num">${sum.study}</div><div class="report-lab">学科练习</div></div>
        <div class="report-cell"><div class="report-num">${sum.mood}</div><div class="report-lab">心情日记</div></div>
        <div class="report-cell"><div class="report-num">${sum.checkins}</div><div class="report-lab">在校打卡</div></div>
        <div class="report-cell"><div class="report-num">${(sum.readMin)} 分</div><div class="report-lab">阅读时间</div></div>
        <div class="report-cell"><div class="report-num">${sum.sport}</div><div class="report-lab">运动次数</div></div>
        <div class="report-cell"><div class="report-num">+${sum.stars} ⭐</div><div class="report-lab">获得星星</div></div>
        ${sum.total ? `<div class="report-cell"><div class="report-num">${sum.pct}%</div><div class="report-lab">正确率 (${sum.correct}/${sum.total})</div></div>` : ''}
      </div>
      ${exHtml}
    `;
  }

  function openReport(kind) {
    window.openModal(`
      <div style="padding:14px 16px;border-bottom:1px solid #eee;background:linear-gradient(135deg,#A5D8FF,#FFE066)">
        <div style="font-size:16px;font-weight:800;color:#1B4F7A">📋 ${kind === 'month' ? '本月报告' : '本周报告'}</div>
        <div style="font-size:12px;color:#5A5A70;margin-top:3px">打印 / 导出 PDF：浏览器菜单 → 打印 → 保存为 PDF</div>
      </div>
      <div id="reportBody" style="padding:14px 16px;max-height:60vh;overflow-y:auto">${reportHtml(kind)}</div>
      <div class="act-foot">
        <button class="btn-sm btn-green" id="repPrint">🖨 打印/导出 PDF</button>
        <button class="btn-sm btn-gray" data-back>关闭</button>
      </div>
    `);
    const m = document.querySelector('#modalLayer');
    m.querySelector('[data-back]').addEventListener('click', () => window.closeModal());
    m.querySelector('#repPrint').addEventListener('click', () => {
      const w = window.open('', '_blank');
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>学习${kind === 'month' ? '月' : '周'}报</title>
      <style>body{font-family:'Microsoft YaHei',sans-serif;padding:24px;color:#333}.report-head{display:flex;gap:12px;align-items:center;margin-bottom:18px;border-bottom:2px solid #333;padding-bottom:12px}
      .report-h-emoji{font-size:42px}.report-h-title{font-size:22px;font-weight:800}.report-h-sub{color:#666;font-size:13px}
      .report-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
      .report-cell{border:1px solid #DDD;border-radius:8px;padding:10px;text-align:center}
      .report-num{font-size:24px;font-weight:900;color:#C75A92}.report-lab{font-size:12px;color:#666;margin-top:4px}
      .alert-warn{padding:10px;border:1px solid #FFC;border-radius:8px;background:#FFF8E1;margin-top:10px}</style>
      </head><body>${m.querySelector('#reportBody').innerHTML}<script>setTimeout(()=>window.print(), 200);<\/script></body></html>`);
      w.document.close();
    });
  }

  // ============ F4 学期成长档案导出（JSON + 文本总览）============
  function exportArchive() {
    const d = st();
    const summary = {
      exportAt: new Date().toISOString(),
      nickname: d.profile?.nickname || '',
      birthDate: d.profile?.birthDate || '',
      school: d.profile?.school || '',
      stats: {
        totalStars: d.stars?.total || 0,
        bestStreak: d.streaks?.bestDays || 0,
        poemsMastered: Object.keys(d.poems || {}).length,
        ziMastered: Object.keys(d.ziMastered || {}).length,
        wordsLearned: Object.keys(d.wordsLearned || {}).length,
        booksRead: (d.reading || []).filter(r => r.date).length,
        checkinDays: Object.values(d.checkins || {}).reduce((n, o) => n + Object.values(o || {}).filter(Boolean).length, 0),
      },
      badDays: Object.values(d.mood || {}).filter(x => x && x.emoji === '😢').length,
      weekly: weeklySummary(),
      monthly: monthlySummary(),
    };

    let json;
    try {
      json = JSON.stringify({ data: d, summary }, null, 2);
    } catch (e) {
      toast('导出失败：数据无法序列化 (' + e.message + ')');
      return;
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '成长档案_' + (d.profile?.nickname || 'student') + '_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    try { a.click(); } catch (e) {}
    document.body.removeChild(a);

    // iOS/微信内置浏览器会静默拦截编程式点击下载，延迟 revoke 并给 toast 反馈
    setTimeout(() => {
      URL.revokeObjectURL(url);
      toast('已导出成长档案 📦');
    }, 600);
  }

  // ============ E3 通知/作业登记（注册入待办）============
  function openNotice() {
    const d = st();
    if (!Array.isArray(d.notices)) d.notices = [];
    const list = d.notices.slice().sort((a, b) => b.at - a.at);

    window.openModal(`
      <div style="padding:14px 16px;border-bottom:1px solid #eee;background:linear-gradient(135deg,#B5EAD7,#A5D8FF)">
        <div style="font-size:16px;font-weight:800;color:#2D7A55">📝 作业 / 班级通知</div>
        <div style="font-size:12px;color:#5A5A70;margin-top:3px">拍班级群消息存这里，一键转成待办</div>
      </div>
      <div style="padding:14px 16px;max-height:60vh;overflow-y:auto">
        <textarea id="ntcInput" placeholder="把班级群通知复制进来…" style="width:100%;min-height:80px;border-radius:8px;border:1px solid #DDD;padding:10px;font-size:14px;resize:vertical"></textarea>
        <div class="input-row" style="margin-top:8px">
          <select id="ntcTag" style="padding:6px"><option value="homework">家庭作业</option><option value="notice">通知</option><option value="supply">需带物品</option></select>
          <button class="btn-sm btn-yellow" id="ntcAdd">＋ 登记</button>
        </div>
        ${list.length ? list.map(n => `<div class="ntc-row">
          <div class="ntc-head">
            <span class="ntc-tag t-${n.tag}">${({homework:'📓作业',notice:'📢通知',supply:'🎒带物品'})[n.tag] || '📌其他'}</span>
            <span class="ntc-date">${new Date(n.at).toLocaleString('zh-CN')}</span>
            <button class="btn-sm btn-purple" data-nt-to="${n.id}">转待办</button>
            <button class="btn-sm btn-red" data-nt-del="${n.id}">删除</button>
          </div>
          <div class="ntc-body">${esc(n.text)}</div>
        </div>`).join('') : '<div class="view-sub" style="margin-top:10px">已登记 ${list.length} 条通知</div>'}
      </div>
      <div class="act-foot"><button class="btn-sm btn-gray" data-back>关闭</button></div>
    `);
    const m = document.querySelector('#modalLayer');
    m.querySelector('[data-back]').addEventListener('click', () => window.closeModal());
    m.querySelector('#ntcAdd').addEventListener('click', () => {
      const t = (m.querySelector('#ntcInput').value || '').trim();
      const tag = m.querySelector('#ntcTag').value;
      if (!t) { toast('请先输入通知内容'); return; }
      d.notices.push({ id: 'n' + Date.now() + Math.random().toString(36).slice(2, 5), text: t, tag, at: Date.now() });
      window.SyncAPI.saveData(d); if (window.appMarkDirty) window.appMarkDirty();
      toast('已登记 ✅');
      openNotice();
    });
    m.querySelectorAll('[data-nt-del]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.ntDel;
      d.notices = d.notices.filter(x => x.id !== id);
      window.SyncAPI.saveData(d); if (window.appMarkDirty) window.appMarkDirty();
      openNotice();
    }));
    m.querySelectorAll('[data-nt-to]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.ntTo;
      const n = d.notices.find(x => x.id === id);
      if (!n) return;
      if (!Array.isArray(d.todos)) d.todos = [];
      d.todos.push({ id: 't' + Date.now() + Math.random().toString(36).slice(2, 5), text: n.text, done: false, date: todayKey(), fromNotice: id });
      window.SyncAPI.saveData(d); if (window.appMarkDirty) window.appMarkDirty();
      toast('已加到今日小任务 ✅');
      openNotice();
    }));
  }

  // ============ 家长中心主页 ============
  function openParentCenter() {
    const sum7 = weeklySummary();
    const w = (window.Exam && window.Exam.weekendSummaryHtml) ? window.Exam.weekendSummaryHtml() : '';
    const isParent = currentMode() === 'parent';
    window.openModal(`
      <div style="padding:14px 16px;border-bottom:1px solid #eee;background:linear-gradient(135deg,#C9B6FF,#A5D8FF)">
        <div style="font-size:16px;font-weight:800;color:#4A3A7A">👨‍👩‍👧 家长中心</div>
        <div style="font-size:12px;color:#6B5A9A;margin-top:3px">${isParent ? '当前：家长模式 · 可修改数据' : '当前：儿童模式 · 切换后可修改'}</div>
      </div>
      <div style="padding:14px 16px;max-height:64vh;overflow-y:auto">
        <div class="pc-grid">
          <button class="pc-tile" data-pc-act="mode">
            <div class="pc-tile-emoji">${isParent ? '👨‍👩‍👧' : '🐰'}</div>
            <div class="pc-tile-name">${isParent ? '切换到儿童模式' : '切换到家长模式'}</div>
            <div class="pc-tile-desc">${isParent ? '锁屏给小朋友' : '4 位密码验证'}</div>
          </button>
          <button class="pc-tile" data-pc-act="week">
            <div class="pc-tile-emoji">📋</div><div class="pc-tile-name">本周报告</div><div class="pc-tile-desc">${sum7.habits}/${sum7.habitMax} 习惯 · 正确率 ${sum7.pct}%</div>
          </button>
          <button class="pc-tile" data-pc-act="month">
            <div class="pc-tile-emoji">🗓</div><div class="pc-tile-name">本月报告</div><div class="pc-tile-desc">${monthlySummary().habits} 习惯 · ${monthlySummary().study} 练习</div>
          </button>
          <button class="pc-tile" data-pc-act="notice">
            <div class="pc-tile-emoji">📝</div><div class="pc-tile-name">作业 / 通知</div><div class="pc-tile-desc">班级群消息登记</div>
          </button>
          <button class="pc-tile" data-pc-act="archive">
            <div class="pc-tile-emoji">📦</div><div class="pc-tile-name">学期档案</div><div class="pc-tile-desc">JSON 一键导出</div>
          </button>
          <button class="pc-tile" data-pc-act="trash">
            <div class="pc-tile-emoji">🗑</div><div class="pc-tile-name">回收站</div><div class="pc-tile-desc">${trashList().length} 项</div>
          </button>
          <button class="pc-tile" data-pc-act="pin">
            <div class="pc-tile-emoji">🔑</div><div class="pc-tile-name">修改密码</div><div class="pc-tile-desc">4 位 PIN</div>
          </button>
        </div>
        ${w ? `<div class="card" style="margin-top:12px">${w}</div>` : ''}
      </div>
      <div class="act-foot"><button class="btn-sm btn-gray" data-back>关闭</button></div>
    `);
    const m = document.querySelector('#modalLayer');
    m.querySelector('[data-back]').addEventListener('click', () => window.closeModal());
    m.querySelectorAll('[data-pc-act]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.pcAct;
      if (a === 'mode') {
        window.closeModal();
        if (currentMode() === 'parent') setMode('child');
        else askPin('mode');
      } else if (a === 'week') { openReport('week'); }
      else if (a === 'month') { openReport('month'); }
      else if (a === 'notice') { openNotice(); }
      else if (a === 'archive') { window.closeModal(); exportArchive(); }
      else if (a === 'trash') { openTrash(); }
      else if (a === 'pin') { window.closeModal(); askPin('repin', () => setPin('')); }
    }));
  }

  window.Parent = {
    setMode, currentMode, askPin, ensurePin, setPin, uiBar, bindBar,
    push, trashList, openTrash, restoreItem,
    openReport, weeklySummary, monthlySummary, exportArchive,
    openNotice, openParentCenter,
  };
  window.Trash = { push, list: trashList, open: openTrash };
})();
