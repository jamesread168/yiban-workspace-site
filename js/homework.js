/**
 * 作业打卡模块
 * - 按科目记录每天的作业（语文 / 数学 / 英语 / 道法 / 科学 / 其他）
 * - 完成打卡：勾选 → 记录完成时刻 + 星星奖励 + 音效震动
 * - 常用作业模板：一键添加高频作业（朗读 / 口算 / 听写 / 背诵…）
 * - 双减提示：一二年级不布置书面作业，建议以口头、朗读、实践为主
 *
 * 数据结构（随多设备同步流转）：
 *   data.homework    = { 'YYYY-MM-DD': [ { id, subject, text, minutes, done, doneAt } ] }
 *   data.homeworkTpl = [ { subject, text, minutes } ]   用户自定义模板
 */
(function () {
  const st = () => window.appState.data;
  const toast = m => window.appShowToast(m);
  const todayKey = () => window.todayKey();
  const save = () => window.SyncAPI.saveData(st());
  const render = () => window.appRender();
  const esc = s => {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  };

  const SUBJECTS = [
    { id: 'yuwen', name: '语文', emoji: '📖', color: '#FFB6D9' },
    { id: 'shuxue', name: '数学', emoji: '🔢', color: '#A5D8FF' },
    { id: 'yingyu', name: '英语', emoji: '🔤', color: '#FFE066' },
    { id: 'daode', name: '道法', emoji: '⚖️', color: '#B5EAD7' },
    { id: 'kexue', name: '科学', emoji: '🔬', color: '#C9B6FF' },
    { id: 'other', name: '其他', emoji: '📌', color: '#C9CED6' },
  ];
  const subOf = id => SUBJECTS.find(s => s.id === id) || SUBJECTS[SUBJECTS.length - 1];

  // 一年级高频作业（口头为主，契合双减）
  const DEFAULT_TPL = [
    { subject: 'yuwen', text: '朗读课文', minutes: 10 },
    { subject: 'yuwen', text: '背诵古诗', minutes: 10 },
    { subject: 'yuwen', text: '听写生字', minutes: 10 },
    { subject: 'shuxue', text: '口算练习', minutes: 10 },
    { subject: 'shuxue', text: '听算练习', minutes: 10 },
    { subject: 'yingyu', text: '听读英语', minutes: 10 },
    { subject: 'kexue', text: '观察记录', minutes: 10 },
    { subject: 'other', text: '跳绳运动', minutes: 15 },
  ];

  function ensure() {
    const d = st();
    if (!d.homework || typeof d.homework !== 'object') d.homework = {};
    return d;
  }
  function listOf(key) {
    const d = ensure();
    if (!Array.isArray(d.homework[key])) d.homework[key] = [];
    return d.homework[key];
  }
  function templates() {
    const d = st();
    if (!Array.isArray(d.homeworkTpl)) d.homeworkTpl = [];
    return d.homeworkTpl.length ? d.homeworkTpl : DEFAULT_TPL;
  }

  // 权限：只有家长模式能「布置 / 删除」作业；儿童模式只能打卡
  function isParentMode() {
    return !!(window.Parent && window.Parent.currentMode && window.Parent.currentMode() === 'parent');
  }
  function requireParent() {
    if (isParentMode()) return true;
    toast('作业由家长布置哦 🔒');
    if (window.Parent && window.Parent.askPin) window.Parent.askPin('mode');
    return false;
  }

  function add(subject, text, minutes) {
    if (!requireParent()) return false;
    const t = String(text || '').trim();
    if (!t) return false;
    const k = todayKey();
    const list = listOf(k);
    list.push({
      id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      subject: subject || 'other',
      text: t,
      minutes: parseInt(minutes, 10) || 10,
      done: false,
      doneAt: null,
    });
    save();
    return true;
  }

  function toggle(id) {
    const k = todayKey();
    const list = listOf(k);
    const it = list.find(x => x.id === id);
    if (!it) return;
    it.done = !it.done;
    it.doneAt = it.done ? Date.now() : null;
    save();
    if (it.done) {
      if (window.Feedback) window.Feedback.done();
      window.appAwardStars(1);              // 完成一项 +1 星
      const { done, total } = statOf(k);
      if (total > 0 && done === total) {    // 全部完成额外奖励
        window.appAwardStars(2);
        toast('🎉 今天的作业全部完成啦！+2⭐');
        if (window.Feedback) window.Feedback.levelUp();
        if (window.appConfetti) window.appConfetti();
      }
    }
    render();
  }

  function remove(id) {
    if (!requireParent()) return;
    const k = todayKey();
    const d = ensure();
    d.homework[k] = listOf(k).filter(x => x.id !== id);
    save();
    render();
  }

  function statOf(key) {
    const list = listOf(key);
    const done = list.filter(x => x.done).length;
    const mins = list.filter(x => x.done).reduce((n, x) => n + (x.minutes || 0), 0);
    return { done, total: list.length, mins };
  }

  // 最近 7 天完成率（给首页 widget / 数据看板用）
  function weekStat() {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const s = statOf(key);
      out.push({ key, ...s, rate: s.total ? Math.round(s.done / s.total * 100) : 0 });
    }
    return out;
  }

  // ============ 视图 ============
  function viewHomework() {
    const k = todayKey();
    const list = listOf(k);
    const { done, total, mins } = statOf(k);
    const pct = total ? Math.round(done / total * 100) : 0;
    const week = weekStat();
    const canEdit = isParentMode();   // 家长可布置/删除，孩子只能打卡

    const groups = SUBJECTS.map(s => ({
      s,
      items: list.filter(x => x.subject === s.id),
    })).filter(g => g.items.length);

    return `
      <div class="view-head">
        <div>
          <div class="view-title">📝 作业打卡</div>
          <div class="view-sub">按科目记录每天的作业，完成一项打一项卡</div>
        </div>
      </div>

      <div class="card" style="background:linear-gradient(135deg,#A5D8FF,#C9B6FF)">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:13px;font-weight:700;opacity:.85">今日作业</div>
            <div style="font-size:36px;font-weight:900;color:#fff">${done}/${total}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;opacity:.85">已完成用时</div>
            <div style="font-size:22px;font-weight:800;color:#fff">${mins} 分钟</div>
          </div>
        </div>
        <div style="margin-top:10px;height:8px;border-radius:999px;background:rgba(255,255,255,.35);overflow:hidden">
          <span style="display:block;height:100%;width:${pct}%;background:#fff;border-radius:999px"></span>
        </div>
        ${total === 0
          ? `<div class="view-sub" style="color:#fff;margin-top:8px">${canEdit ? '还没有作业，从下面添加吧～' : '今天还没有作业，等家长来布置～'}</div>`
          : (done === total ? '<div class="view-sub" style="color:#fff;margin-top:8px">🎉 全部完成，太棒了！</div>'
            : `<div class="view-sub" style="color:#fff;margin-top:8px">还剩 ${total - done} 项，加油～</div>`)}
      </div>

      <div class="card">
        <div class="card-title">➕ 布置作业${canEdit ? '' : '（家长）'}</div>
        ${canEdit ? `
        <div class="input-row" style="margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <select id="hwSubject" style="flex:1 1 120px;padding:10px;border-radius:10px;background:#fff;font-size:14px;border:2px solid #EEE">
            ${SUBJECTS.map(s => `<option value="${s.id}">${s.emoji} ${s.name}</option>`).join('')}
          </select>
          <select id="hwMinutes" style="flex:0 0 104px;padding:10px;border-radius:10px;background:#fff;font-size:14px;border:2px solid #EEE">
            ${[5, 10, 15, 20, 30, 45, 60].map(m => `<option value="${m}"${m === 10 ? ' selected' : ''}>${m} 分钟</option>`).join('')}
          </select>
        </div>
        <div class="input-row" style="margin-bottom:10px;gap:8px">
          <input type="text" id="hwText" placeholder="作业内容，如：朗读第3课" style="flex:1;min-width:120px;padding:10px;border-radius:10px;border:2px solid #EEE;font-size:14px" />
          <button class="btn-sm btn-green" id="hwAddBtn">添加</button>
        </div>
        <div style="font-size:12px;color:var(--text-light);margin-bottom:6px">常用作业（点一下直接添加）：</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${templates().map((t, i) => `<button class="btn-sm btn-gray" data-hwtpl="${i}">${subOf(t.subject).emoji} ${esc(t.text)}</button>`).join('')}
        </div>` : `
        <div class="view-sub">作业由爸爸妈妈布置。你完成一项，就点一下前面的圆圈打勾，每完成一项 +1 ⭐，全部完成还有额外奖励！</div>
        <div style="margin-top:10px">
          <button class="btn-sm btn-purple" data-mode-to="parent">👨‍👩‍👧 我是家长，去布置作业</button>
        </div>`}
      </div>

      ${groups.length ? groups.map(g => `
        <div class="card">
          <div class="card-title" style="border-left-color:${g.s.color}">
            ${g.s.emoji} ${g.s.name}
            <span class="t-sub">（${g.items.filter(x => x.done).length}/${g.items.length}）</span>
          </div>
          <ul class="todo-list">
            ${g.items.map(it => `
              <li class="${it.done ? 'done' : ''}">
                <div class="todo-check ${it.done ? 'checked' : ''}" data-hw-toggle="${it.id}">${it.done ? '✓' : ''}</div>
                <span class="todo-text">${esc(it.text)}
                  <span style="font-size:12px;color:var(--text-light)"> · ${it.minutes} 分钟${it.done && it.doneAt ? ' · ' + new Date(it.doneAt).toTimeString().slice(0, 5) + ' 完成' : ''}</span>
                </span>
                ${canEdit ? `<button class="todo-del" data-hw-del="${it.id}">×</button>` : ''}
              </li>`).join('')}
          </ul>
        </div>`).join('') : ''}

      <div class="card">
        <div class="card-title">📅 最近 7 天完成情况</div>
        <div style="display:flex;gap:6px;align-items:flex-end;height:90px">
          ${week.map(d => `
            <div style="flex:1;text-align:center">
              <div style="font-size:11px;color:var(--text-light);margin-bottom:3px">${d.total ? d.done + '/' + d.total : '-'}</div>
              <div style="height:${Math.max(6, Math.round(d.rate * 0.6))}px;background:linear-gradient(180deg,#A5D8FF,#C9B6FF);border-radius:4px 4px 0 0"></div>
              <div style="font-size:10px;color:var(--text-light);margin-top:3px">${d.key.slice(5).replace('-', '/')}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">💡 关于作业</div>
        <div class="tip-card"><span class="tip-emoji">📌</span><div>
          <div class="tip-title">深圳双减政策</div>
          <div class="tip-text">小学一、二年级<b>不布置家庭书面作业</b>。建议以朗读、背诵、口算、阅读、运动和实践活动为主，每次 10-20 分钟为宜。</div>
        </div></div>
        <div class="tip-card"><span class="tip-emoji">⭐</span><div>
          <div class="tip-title">星星奖励</div>
          <div class="tip-text">完成一项作业 +1 ⭐，当天<b>全部完成</b>再额外 +2 ⭐。</div>
        </div></div>
      </div>
    `;
  }

  // ============ 事件绑定（由 app.js 的 bindViewEvents 统一调用）============
  function bind(root) {
    // 模式切换按钮（儿童模式下的「我是家长，去布置作业」）
    if (window.Parent && window.Parent.bindBar) {
      try { window.Parent.bindBar(root); } catch (e) {}
    }
    root.querySelectorAll('[data-hw-toggle]').forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); toggle(el.dataset.hwToggle); });
    });
    root.querySelectorAll('[data-hw-del]').forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); remove(el.dataset.hwDel); });
    });
    root.querySelectorAll('[data-hwtpl]').forEach(el => {
      el.addEventListener('click', () => {
        const t = templates()[parseInt(el.dataset.hwtpl, 10)];
        if (t && add(t.subject, t.text, t.minutes)) { toast('已添加：' + t.text); render(); }
      });
    });
    const btn = root.querySelector('#hwAddBtn');
    if (btn) btn.addEventListener('click', doAdd);
    const input = root.querySelector('#hwText');
    if (input) input.addEventListener('keypress', (e) => { if (e.key === 'Enter') doAdd(); });

    function doAdd() {
      const subjectEl = root.querySelector('#hwSubject');
      const textEl = root.querySelector('#hwText');
      const minEl = root.querySelector('#hwMinutes');
      if (!textEl || !String(textEl.value).trim()) { toast('先写一下作业内容哦'); return; }
      if (add(subjectEl && subjectEl.value, textEl.value, minEl && minEl.value)) {
        textEl.value = '';
        toast('作业已添加');
        render();
        const again = document.querySelector('#hwText');
        if (again) again.focus();
      }
    }
  }

  // 首页 widget：今日作业进度
  function widgetHtml() {
    const k = todayKey();
    const { done, total } = statOf(k);
    if (!total) return '';
    return `<div class="tip-card"><span class="tip-emoji">📝</span><div>
      <div class="tip-title">今日作业 ${done}/${total}</div>
      <div class="tip-text">${done === total ? '全部完成，太棒了！' : '还剩 ' + (total - done) + ' 项'}</div>
    </div></div>`;
  }

  window.Homework = {
    view: viewHomework,
    bind, statOf, weekStat, add, toggle, remove, templates, SUBJECTS,
    widgetHtml,
  };

  // 注册进视图表（此时 window.Views 已由 views.js 创建）
  if (window.Views) window.Views.homework = viewHomework;
})();
