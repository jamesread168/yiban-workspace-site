/**
 * B2 放学后例程引导
 * - 多步骤流程图：当前步骤高亮 + 总进度条 + 每步计时
 * - 提前完成 → 自动攒"自由时间"
 * - 数据结构：data.routine.today / data.routine.log
 */
(function () {
  const st = () => window.appState.data;
  const toast = m => window.appShowToast(m);
  const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };

  // 默认放学后例程（每周一~五）
  // 每项：id, name, emoji, target(秒), hint
  const DEFAULT_STEPS = [
    { id: 'rest',    name: '短暂休息',       emoji: '☕', target: 10 * 60, hint: '喝点水、吃点小点心' },
    { id: 'exercise', name: '运动/玩耍',      emoji: '⚽', target: 40 * 60, hint: '跳绳/踢球/骑车' },
    { id: 'reading', name: '课外阅读',        emoji: '📖', target: 20 * 60, hint: '绘本或桥梁书' },
    { id: 'review',  name: '复习薄弱点',      emoji: '📕', target: 15 * 60, hint: '看看错题本+朗读' },
    { id: 'snack',   name: '洗手吃晚饭前点心', emoji: '🍎', target: 10 * 60, hint: '水果/坚果' },
    { id: 'dinner',  name: '晚饭+家聊',       emoji: '🍽', target: 30 * 60, hint: '聊天说说今天的事' },
    { id: 'leisure', name: '自由时间',        emoji: '🎨', target: 30 * 60, hint: '画画/拼搭/课外玩' },
    { id: 'prep',    name: '收拾书包+准备',    emoji: '🎒', target: 10 * 60, hint: '检查作业清单+书包' },
    { id: 'bed',     name: '洗漱睡觉',        emoji: '🛁', target: 20 * 60, hint: '9 点前完成' },
  ];

  function todayKey() { return window.todayKey(); }

  function ensure() {
    const d = st();
    if (!d.routine || typeof d.routine !== 'object') d.routine = {};
    return d;
  }
  function ensureDay(key) {
    const d = ensure();
    if (!d.routine[key] || !Array.isArray(d.routine[key].steps)) {
      d.routine[key] = {
        steps: DEFAULT_STEPS.map(s => ({
          id: s.id, name: s.name, emoji: s.emoji, target: s.target, hint: s.hint,
          started: 0, ended: 0, used: 0, done: false, bonus: 0,
        })),
        started: 0, ended: 0, starred: 0,
      };
    }
    return d.routine[key];
  }
  function save() { window.SyncAPI.saveData(st()); if (window.appMarkDirty) window.appMarkDirty(); }

  // 状态
  function stateOf() {
    const day = ensureDay(todayKey());
    const total = day.steps.length;
    const doneN = day.steps.filter(s => s.done).length;
    const allDone = doneN >= total;
    const firstUndone = day.steps.find(s => !s.done);
    let cur = null;
    if (firstUndone) {
      const idx = day.steps.indexOf(firstUndone);
      cur = { index: idx, step: firstUndone };
    }
    let saved = 0; // 提前完成攒下的时间
    for (const s of day.steps) {
      if (s.done && s.used && s.target && s.used < s.target) saved += (s.target - s.used);
    }
    return { day, total, doneN, pct: Math.round(doneN / total * 100), cur, allDone, saved, firstUndone };
  }

  // 计时器（每步内部 stopwatch）
  const _tick = {};

  function startStep(idx) {
    const day = ensureDay(todayKey());
    const s = day.steps[idx];
    if (!s || s.done) return;
    // 暂停上一次
    const cur = st()._routineActive;
    if (cur && cur.idx !== idx && !day.steps[cur.idx].done) {
      const prev = day.steps[cur.idx];
      if (!prev.ended) prev.ended = Date.now();
      if (prev.started) prev.used += Math.max(0, (prev.ended - prev.started) / 1000) | 0;
    }
    s.started = Date.now();
    s.ended = 0;
    st()._routineActive = { idx, id: s.id };
    save();
    if (_tick[idx]) clearInterval(_tick[idx]);
    _tick[idx] = setInterval(() => refreshTimer(idx), 1000);
  }
  function stopStep(idx) {
    const s = ensureDay(todayKey()).steps[idx];
    if (!s || s.done) return;
    s.ended = Date.now();
    if (s.started) {
      s.used = (s.used || 0) + Math.max(0, ((s.ended - s.started) / 1000) | 0);
    }
    s.started = 0; s.ended = 0;
    if (_tick[idx]) { clearInterval(_tick[idx]); _tick[idx] = null; }
    save();
  }
  function refreshTimer(idx) {
    const day = ensureDay(todayKey());
    const s = day.steps[idx];
    if (!s) return;
    const live = (s.used || 0) + (s.started ? Math.max(0, ((Date.now() - s.started) / 1000) | 0) : 0);
    const el = document.querySelector('#routineTimer');
    if (el) {
      const m = Math.floor(live / 60), sec = (live % 60) | 0;
      const tgt = Math.floor(s.target / 60);
      el.textContent = `${pad2(m)}:${pad2(sec)} / ${pad2(tgt)} 分`;
      el.className = live > s.target ? 'rt-timer over' : 'rt-timer';
    }
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function finishStep(idx) {
    const day = ensureDay(todayKey());
    const s = day.steps[idx];
    if (!s) return;
    if (!s.done) {
      if (s.started) stopStep(idx);
      s.done = true;
      // 提前完成 → 攒自由时间
      if (s.used && s.used < s.target) s.bonus = (s.target - s.used) | 0;
      // 完成一个步骤，加 1 颗星
      if (window.appAwardStars) window.appAwardStars(1);
      day.starred = (day.starred || 0) + 1;
      save();
      toast(`✅ ${s.emoji} ${s.name}完成`);
    }
    // 开始下一步
    if (idx + 1 < day.steps.length) startStep(idx + 1);
    else {
      // 全部完成
      day.ended = Date.now();
      save();
    }
  }

  // 渲染主页（嵌入 dashboard 卡片）
  function widgetHtml() {
    const stt = stateOf();
    const day = stt.day;
    const cur = stt.cur;
    const stepRows = day.steps.map((s, i) => {
      const past = s.done;
      const ongoing = cur && cur.index === i && !past;
      const cls = 'rt-row ' + (past ? 'past' : ongoing ? 'on' : 'next');
      const live = (s.used || 0) + (s.started ? Math.max(0, ((Date.now() - s.started) / 1000) | 0) : 0);
      const m = Math.floor(live / 60), sec = (live % 60) | 0;
      const tgt = Math.floor(s.target / 60);
      const overTime = live > s.target;
      return `<div class="${cls}" data-rti="${i}">
        <div class="rt-num">${past ? '✓' : (i + 1)}</div>
        <div class="rt-emoji">${s.emoji}</div>
        <div class="rt-name">${s.name}</div>
        <div class="rt-meta">${s.hint}</div>
        <div class="rt-clock ${overTime ? 'over' : ''}">${pad2(m)}:${pad2(sec)} / ${tgt} 分</div>
      </div>`;
    }).join('');

    return `<div class="rt-widget">
      <div class="rt-head">
        <span class="rt-title">🎯 放学后例程</span>
        <span class="rt-pct">${stt.doneN}/${stt.total} · ${stt.pct}%</span>
        <span class="rt-bar"><span style="width:${stt.pct}%"></span></span>
      </div>
      <div class="rt-list">${stepRows}</div>
      <div class="rt-actions">
        <button class="btn-sm btn-yellow" data-rt-flip>${cur ? `开始/继续：${cur.step.emoji} ${cur.step.name}` : '全部完成 🎉'}</button>
      </div>
  ${stt.saved ? `<div class="rt-saved">💰 已提前攒下 <b>${(stt.saved / 60).toFixed(1)} 分</b>自由时间</div>` : ''}
    </div>`;
  }

  function bindWidget() {
    document.querySelectorAll('[data-rt-flip]').forEach(b => b.addEventListener('click', () => openCenter()));
  }

  function openCenter() {
    const stt = stateOf();
    const day = stt.day;

    function buildStep(i) {
      const s = day.steps[i];
      const live = (s.used || 0) + (s.started ? Math.max(0, ((Date.now() - s.started) / 1000) | 0) : 0);
      const m = Math.floor(live / 60), sec = (live % 60) | 0;
      const tgtM = Math.floor(s.target / 60);
      const overTime = live > s.target;
      const prev = i > 0 ? day.steps[i - 1] : null;
      const next = i < day.steps.length - 1 ? day.steps[i + 1] : null;
      return `<div class="act-screen">
        <div class="act-head">
          <span class="ae">${s.emoji}</span>
          <span class="at">${s.name}</span>
          <span class="as">第 ${i + 1} / ${day.steps.length} 步</span>
        </div>
        <div class="act-body" style="text-align:center">
          <div class="rt-bigemoji">${s.emoji}</div>
          <div class="rt-bigname">${s.name}</div>
          <div class="view-sub" style="margin:8px 0 16px">${s.hint}</div>
          <div class="rt-timer ${overTime ? 'over' : ''}" id="routineTimer">${pad2(m)}:${pad2(sec)} / ${pad2(tgtM)} 分</div>
          ${overTime ? '<div class="alert alert-warn" style="margin-top:14px"><span class="alert-emoji">⏰</span><div>超过建议时间了，先停下继续下一步？</div></div>' : ''}
          <div style="margin-top:18px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            <button class="btn-sm btn-yellow" id="rtStart">▶ 开始/暂停</button>
            ${s.done ? '' : '<button class="btn-sm btn-green" id="rtDone">✅ 完成本步</button>'}
          </div>
        </div>
        <div class="act-foot">
          ${prev ? '<button class="btn-sm btn-gray" id="rtPrev">← ' + prev.name + '</button>' : '<button class="btn-sm btn-gray" id="rtPrev" disabled>已到第一步</button>'}
          <button class="btn-sm btn-gray" id="rtAll">查看总览</button>
          ${next ? '<button class="btn-sm btn-gray" id="rtNext">' + next.name + ' →</button>' : '<button class="btn-sm btn-gray" id="rtNext" disabled>全部完成</button>'}
        </div>
      </div>`;
    }

    function bindStep(i) {
      const m = document.querySelector('#modalLayer');
      const start = m.querySelector('#rtStart');
      if (start) start.addEventListener('click', () => {
        const active = st()._routineActive;
        if (active && active.idx === i) {
          // 暂停
          stopStep(i);
          toast('⏸ 已暂停');
        } else {
          startStep(i);
          toast('▶ 开始计时');
        }
        // 立即同步显示
        const live = (day.steps[i].used || 0) + (day.steps[i].started ? Math.max(0, ((Date.now() - day.steps[i].started) / 1000) | 0) : 0);
        const min = Math.floor(live / 60), sec = (live % 60) | 0;
        const tgtM = Math.floor(day.steps[i].target / 60);
        const t = m.querySelector('#routineTimer');
        if (t) { t.textContent = `${pad2(min)}:${pad2(sec)} / ${pad2(tgtM)} 分`; t.className = live > day.steps[i].target ? 'rt-timer over' : 'rt-timer'; }
      });
      const dn = m.querySelector('#rtDone');
      if (dn) dn.addEventListener('click', () => {
        finishStep(i);
        if (window.appRender) window.appRender();
        // 进下一步
        if (i + 1 < day.steps.length) { window.openModal(buildStep(i + 1)); bindStep(i + 1); }
        else { window.openModal(overallResult()); bindOverall(); }
      });
      m.querySelector('#rtPrev').addEventListener('click', () => {
        if (i > 0) { window.openModal(buildStep(i - 1)); bindStep(i - 1); }
      });
      m.querySelector('#rtNext').addEventListener('click', () => {
        if (i + 1 < day.steps.length) { window.openModal(buildStep(i + 1)); bindStep(i + 1); }
      });
      m.querySelector('#rtAll').addEventListener('click', () => {
        window.openModal(overallHtml()); bindOverall();
      });
    }

    function overallResult() {
      const tot = day.steps.reduce((n, s) => n + (s.used || 0), 0);
      const tgt = day.steps.reduce((n, s) => n + s.target, 0);
      return `<div class="act-screen">
        <div class="act-head"><span class="ae">🎉</span><span class="at">例程全部完成！</span></div>
        <div class="act-body" style="text-align:center;padding:20px 0">
          <div style="font-size:48px;font-weight:900;color:#FF7AB6">${(tot/60).toFixed(1)} 分</div>
          <div class="view-sub">9 个步骤都完成了，建议目标 ${(tgt/60).toFixed(0)} 分钟${tot < tgt ? `，提前 <b>${((tgt-tot)/60).toFixed(1)} 分</b>${tot < tgt ? '结束 🎉' : ''}` : ''}</div>
          ${day.starred ? `<div class="alert alert-good" style="margin-top:14px"><span class="alert-emoji">⭐</span><div>今天获得 <b>${day.starred}</b> 颗星！</div></div>` : ''}
        </div>
        <div class="act-foot"><button class="btn-sm btn-yellow" id="rtAgain">再玩一轮</button><button class="btn-sm btn-gray" id="rtClose">关闭</button></div>
      </div>`;
    }
    function bindOverall() {
      const m = document.querySelector('#modalLayer');
      const a = m.querySelector('#rtAgain');
      if (a) a.addEventListener('click', () => {
        // 重置今日
        d.routine[todayKey()] = null;
        save();
        openCenter();
      });
      const c = m.querySelector('#rtClose');
      if (c) c.addEventListener('click', () => window.closeModal());
    }

    function overallHtml() {
      const rows = day.steps.map((s, i) => {
        const used = (s.used || 0) + (s.started && i === (st()._routineActive || {}).idx ? Math.max(0, ((Date.now() - s.started) / 1000) | 0) : 0);
        const m = Math.floor(used / 60), sec = (used % 60) | 0;
        const tgtM = Math.floor(s.target / 60);
        return `<div class="rt-overall-row">
          <div class="rt-num">${s.done ? '✓' : (i + 1)}</div>
          <div class="rt-emoji">${s.emoji}</div>
          <div class="rt-name">${s.name}</div>
          <div class="rt-clock">${pad2(m)}:${pad2(sec)} / ${pad2(tgtM)} 分</div>
          ${s.done ? '<span class="rt-done-tag">已完成</span>' : `<button class="btn-sm btn-yellow" data-rt-jump="${i}">跳转</button>`}
        </div>`;
      }).join('');
      const stt2 = stateOf();
      return `<div class="act-screen">
        <div class="act-head"><span class="ae">🎯</span><span class="at">放学后例程 · 总览</span></div>
        <div class="act-body">
          <div class="rt-overall-bar"><span style="width:${stt2.pct}%"></span></div>
          <div class="view-sub" style="margin:6px 0 12px">已完成 ${stt2.doneN}/${stt2.total} · ${stt2.saved ? `攒下 ${(stt2.saved/60).toFixed(1)} 分自由时间` : '尚未攒下自由时间'}</div>
          ${rows}
        </div>
        <div class="act-foot">
          <button class="btn-sm btn-gray" id="rtCloseOnly">关闭</button>
          <button class="btn-sm btn-yellow" id="rtStartHere">${stt2.cur ? '继续当前步' : stt2.allDone ? '查看总结' : '开始第一步'}</button>
        </div>
      </div>`;
    }
    function bindOverallOpen() {
      const m = document.querySelector('#modalLayer');
      m.querySelector('#rtCloseOnly').addEventListener('click', () => window.closeModal());
      m.querySelector('#rtStartHere').addEventListener('click', () => {
        if (stt.allDone) { window.openModal(overallResult()); bindOverall(); }
        else { window.openModal(buildStep(stt.cur ? stt.cur.index : 0)); bindStep(stt.cur ? stt.cur.index : 0); }
      });
      m.querySelectorAll('[data-rt-jump]').forEach(b => b.addEventListener('click', () => {
        const i = parseInt(b.dataset.rtJump, 10);
        window.openModal(buildStep(i)); bindStep(i);
      }));
    }
    // 第一次进来先看总览
    window.openModal(overallHtml());
    bindOverallOpen();
  }

  window.Routine = {
    ensure, ensureDay, stateOf, startStep, stopStep, finishStep,
    openCenter, widgetHtml, bindWidget, DEFAULT_STEPS,
  };
})();
