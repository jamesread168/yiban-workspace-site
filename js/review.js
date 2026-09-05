/**
 * A4 间隔复习队列
 * - 学习新知识（古诗 / 生字 / 单词）后，按 1-2-4-7 天间隔推送复习
 * - 复习做对：右移间隔；做错：重置间隔再插队
 * - 看板/dashboard 入口：今日待复习
 *
 * 数据结构（data.items[]）：
 *   { id, kind, key, name, ts, iv: '1'|'2'|'4'|'7'|'15',
 *     okCount, failCount, nextAt, archived }
 */
(function () {
  const st = () => window.appState.data;
  const toast = m => window.appShowToast(m);
  const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  const DAY = 86400000;
  const SCHED = [1, 2, 4, 7, 15];

  function ensure() {
    const d = st();
    if (!Array.isArray(d.items)) d.items = [];
    if (!d.review || typeof d.review !== 'object') d.review = {};
    return d;
  }

  function save() {
    window.SyncAPI.saveData(st());
    if (window.appMarkDirty) window.appMarkDirty();
  }

  function uid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // KIND_SOURCE: 注册可"加入复习"的学习项数据源
  const KIND_SOURCE = [
    {
      id: 'poem', label: '古诗', emoji: '📜',
      // 从 AppData.POEMS 拉取标题
      source: () => (window.AppData.POEMS || []).map((p, i) => ({
        key: 'poem:' + (p.title || p.id || i),
        name: p.title || (p.lines && p.lines[0]) || ('古诗 ' + (i + 1)),
      })),
    },
    {
      id: 'english', label: '英语', emoji: '🔤',
      source: () => (window.AppData.EN_WORDS || []).map((w, i) => ({ key: 'english:' + (w.word || i), name: w.word + ' ' + (w.cn || '') })),
    },
  ];

  // 学习新内容时调用（提交答对或家长点"背熟了"）
  function learn(kind, key, name) {
    const d = ensure();
    let e = d.items.find(x => x.kind === kind && x.key === key && !x.archived);
    const now = Date.now();
    if (e) {
      // 已学过的：重置间隔，从头重排
      e.iv = 0; e.nextAt = now + SCHED[0] * DAY;
      e.ts = now; e.failCount = 0;
    } else {
      d.items.push({
        id: uid(), kind, key, name,
        ts: now, iv: 0,
        okCount: 0, failCount: 0,
        nextAt: now + SCHED[0] * DAY,
        archived: false,
        history: [], // [{ at, ok, mode }]
      });
      // 控制上限 200
      if (d.items.length > 200) d.items = d.items.filter(x => !x.archived).slice(-200);
    }
    save();
    return e || d.items[d.items.length - 1];
  }

  // 取得今日（截止 now）待复习条目，按到期时间排序，未学过的也归进来
  function dueList() {
    const d = ensure();
    const now = Date.now();
    return d.items
      .filter(x => !x.archived && x.nextAt && x.nextAt <= now)
      .sort((a, b) => a.nextAt - b.nextAt);
  }

  // 看板用：今日到期数量
  function dueCount() { return dueList().length; }

  function judge(item, ok, mode) {
    const d = ensure();
    const e = d.items.find(x => x.id === item.id);
    if (!e) return;
    e.history.unshift({ at: Date.now(), ok: !!ok, mode: mode || 'queue' });
    if (e.history.length > 30) e.history.length = 30;
    if (ok) {
      e.okCount = (e.okCount || 0) + 1;
      e.iv = Math.min(SCHED.length - 1, e.iv + 1);
      e.nextAt = Date.now() + SCHED[e.iv] * DAY;
      // 累计 3 次正确（间隔到 7 天）即标注掌握
      if (e.okCount >= 3) e.archived = true;
    } else {
      e.failCount = (e.failCount || 0) + 1;
      e.iv = 0;
      e.nextAt = Date.now() + SCHED[0] * DAY; // 明天重做
    }
    save();
  }

  // 把"今日背熟"批量归档：所有学完的古诗 / 学完的单词
  function quickArchive(kind, fnOk) {
    const d = ensure();
    let n = 0;
    const items = d.items.filter(x => !x.archived && x.kind === kind);
    for (const it of items) {
      if (fnOk(it)) {
        it.archived = true;
        it.okCount = Math.max(3, it.okCount || 0);
        n++;
      }
    }
    if (n) save();
    return n;
  }

  // ============ UI ============
  function openManager() {
    const d = ensure();
    const due = dueList();
    const active = d.items.filter(x => !x.archived);
    const arch = d.items.filter(x => x.archived);
    const items = active.slice().sort((a, b) => (a.nextAt || 0) - (b.nextAt || 0));

    const fmtAt = ts => {
      if (!ts) return '—';
      const t = new Date(ts);
      const diff = t - Date.now();
      if (diff <= 0) return '⏰ 到期';
      if (diff < DAY) return Math.round(diff / 3600000) + ' 小时后';
      return Math.round(diff / DAY) + ' 天后';
    };

    window.openModal(`
      <div style="padding:14px 16px;border-bottom:1px solid #eee;background:linear-gradient(135deg,#A5D8FF,#C9B6FF)">
        <div style="font-size:16px;font-weight:800;color:#1B4F7A">🔁 间隔复习</div>
        <div style="font-size:12px;color:#5A5A70;margin-top:3px">新学 1 / 2 / 4 / 7 / 15 天复习 · 做对升级，做错重置</div>
      </div>
      <div style="padding:14px 16px;max-height:64vh;overflow-y:auto">
        <div class="grid-3" style="gap:10px;margin-bottom:12px">
          <div class="stat-card"><div class="stat-val" style="color:#C75A92">${due.length}</div><div class="stat-lab">今日待复习</div></div>
          <div class="stat-card"><div class="stat-val" style="color:#1B4F7A">${active.length}</div><div class="stat-lab">在复习</div></div>
          <div class="stat-card"><div class="stat-val" style="color:#2D7A55">${arch.length}</div><div class="stat-lab">已掌握</div></div>
        </div>

        <div class="card" style="box-shadow:none;border:1px solid #EEE;background:#fff;margin-bottom:12px">
          <div class="card-title">➕ 加入复习
            <span class="t-sub">（把已学过的内容登记进来，按间隔推送复习）</span>
          </div>
          <div class="rv-add-grid">
            ${KIND_SOURCE.map(s => `<div class="rv-add">
              <span class="rv-add-emoji">${s.emoji}</span>
              <span class="rv-add-lab">${s.label}</span>
              <select class="rv-add-sel" data-rv-kind="${s.id}">
                <option value="">— 选择 —</option>
                ${s.source().map(o => `<option value="${esc(o.key)}">${esc(o.name)}</option>`).join('')}
              </select>
              <button class="btn-sm btn-yellow rv-add-btn" data-rv-kind="${s.id}">＋ 加入</button>
            </div>`).join('')}
          </div>
        </div>

        <div class="card" style="box-shadow:none;border:1px solid #EEE;background:#fff">
          <div class="card-title">🧠 复习队列 <span class="t-sub">（${items.length} 项待复习）</span></div>
          ${items.length ? items.map(e => `<div class="rv-row">
            <div class="rv-emoji">${KIND_SOURCE.find(x => x.id === e.kind)?.emoji || '📚'}</div>
            <div class="rv-body">
              <div class="rv-name">${esc(e.name)}</div>
              <div class="rv-meta">
                <span>已对 ${e.okCount || 0} / 错 ${e.failCount || 0}</span>
                <span>· 现在阶段：第 <b>${SCHED[e.iv || 0]} 天</b></span>
                <span>· 下次：<b>${fmtAt(e.nextAt)}</b></span>
              </div>
            </div>
            <div class="rv-ops">
              <button class="btn-sm btn-green" data-rv-ok="${e.id}">✅ 会了</button>
              <button class="btn-sm btn-red" data-rv-no="${e.id}">❌ 还不行</button>
            </div>
          </div>`).join('') : '<div class="empty"><span class="empty-emoji">🎉</span>队列里没有要复习的内容<br/>把已学过的古诗/单词加进来，到期会自动推送</div>'}
        </div>

        ${arch.length ? `<div class="card" style="box-shadow:none;border:1px solid #EEE;background:#fff;margin-top:12px">
          <div class="card-title">✅ 已掌握 <span class="t-sub">${arch.length}</span></div>
          <div class="rv-arch">${arch.slice(0, 50).map(e => `<span class="rv-arch-tag" data-rv-un="${e.id}">${KIND_SOURCE.find(x => x.id === e.kind)?.emoji || '📚'} ${esc(e.name)}</span>`).join('')}</div>
        </div>` : ''}
      </div>
      <div class="act-foot"><button class="btn-sm btn-gray" data-back>关闭</button></div>
    `);

    const m = document.querySelector('#modalLayer');
    m.querySelector('[data-back]').addEventListener('click', () => window.closeModal());
    m.querySelectorAll('.rv-add-btn').forEach(b => b.addEventListener('click', () => {
      const kind = b.dataset.rvKind;
      const sel = m.querySelector(`.rv-add-sel[data-rv-kind="${kind}"]`);
      const val = sel.value;
      if (!val) { toast('先选一个内容哦～'); return; }
      const name = sel.options[sel.selectedIndex].text;
      learn(kind, val, name);
      toast('已加入复习队列 ✅');
      openManager();
    }));
    m.querySelectorAll('[data-rv-ok]').forEach(b => b.addEventListener('click', () => {
      const e = items.find(x => x.id === b.dataset.rvOk);
      if (e) { judge(e, true, 'queue'); toast('已升级间隔，下一轮会更久再来 ✨'); openManager(); }
    }));
    m.querySelectorAll('[data-rv-no]').forEach(b => b.addEventListener('click', () => {
      const e = items.find(x => x.id === b.dataset.rvNo);
      if (e) { judge(e, false, 'queue'); toast('没关系，明天再来一次～'); openManager(); }
    }));
    m.querySelectorAll('[data-rv-un]').forEach(b => b.addEventListener('click', () => {
      const e = arch.find(x => x.id === b.dataset.rvUn);
      if (e) { e.archived = false; e.iv = 0; e.nextAt = Date.now() + SCHED[0] * DAY; save(); openManager(); }
    }));
  }

  function openFlash() {
    const list = dueList();
    if (!list.length) { toast('今日没有要复习的～'); return; }
    let i = 0;
    let cur = list[i];
    let flipped = false;

    function build() {
      return `<div class="act-screen">
        <div class="act-head">
          <span class="ae">🧠</span><span class="at">间隔复习</span>
          <span class="as">${i + 1}/${list.length}</span>
        </div>
        <div class="act-body" style="text-align:center">
          <div class="flash-card" id="flashCard">
            <div class="flash-front">
              <div class="flash-type">${(KIND_SOURCE.find(s => s.id === cur.kind) || { emoji: '📚' }).emoji} ${(KIND_SOURCE.find(s => s.id === cur.kind) || { label: '复习' }).label}</div>
              <div class="flash-name">${esc(cur.name)}</div>
              <div class="flash-hint">说出 / 写出来答案，然后再翻面 👇</div>
            </div>
            <div class="flash-back" style="display:none">
              <div class="flash-type">✅ 答案 / 释义</div>
              <div class="flash-name">${esc(cur.name)}</div>
              <div class="flash-hint">还想得起吗？</div>
            </div>
          </div>
          <div class="flash-meta">已对 ${cur.okCount || 0} · 错 ${cur.failCount || 0} · 第 ${SCHED[cur.iv || 0]} 天</div>
        </div>
        <div class="act-foot">
          <button class="btn-sm btn-gray" id="flashFlip">🪞 翻面</button>
          <button class="btn-sm btn-red" id="flashNo">❌ 还不行</button>
          <button class="btn-sm btn-green" id="flashOk">✅ 会了</button>
        </div>
      </div>`;
    }

    function bind() {
      const m = document.querySelector('#modalLayer');
      const flip = m.querySelector('#flashFlip');
      if (flip) flip.addEventListener('click', () => {
        flipped = !flipped;
        m.querySelector('.flash-front').style.display = flipped ? 'none' : '';
        m.querySelector('.flash-back').style.display = flipped ? '' : 'none';
      });
      const ok = m.querySelector('#flashOk');
      if (ok) ok.addEventListener('click', () => {
        judge(cur, true, 'flash');
        next();
      });
      const no = m.querySelector('#flashNo');
      if (no) no.addEventListener('click', () => {
        judge(cur, false, 'flash');
        next();
      });
    }

    function next() {
      i++;
      if (i >= list.length) {
        window.openModal(`<div class="act-screen">
          <div class="act-head"><span class="ae">🎉</span><span class="at">复习完成</span></div>
          <div class="act-body" style="text-align:center;padding:24px 0">
            <div style="font-size:48px;font-weight:900;color:#FF7AB6">${list.length}</div>
            <div class="view-sub">个内容复习完成，间隔会按表现自动调整 ✨</div>
          </div>
          <div class="act-foot"><button class="btn-sm btn-yellow" id="flashRe">再来一轮</button><button class="btn-sm btn-gray" id="flashDone">完成</button></div>
        </div>`);
        const mm = document.querySelector('#modalLayer');
        mm.querySelector('#flashRe').addEventListener('click', () => openFlash());
        mm.querySelector('#flashDone').addEventListener('click', () => window.closeModal());
        return;
      }
      cur = list[i];
      flipped = false;
      window.openModal(build()); bind();
    }

    window.openModal(build());
    bind();
  }

  // dashboard mini widget 入口
  function widgetHtml() {
    const due = dueCount();
    return `<div class="rv-widget">
      <div class="rvw-icon">🔁</div>
      <div class="rvw-body">
        <div class="rvw-title">间隔复习</div>
        <div class="rvw-sub">${due ? `⏰ 今日 ${due} 项到期` : '🎉 没有要复习的内容'}</div>
      </div>
      <div class="rvw-ops">
        <button class="btn-sm btn-yellow" data-rvw-go>开始复习</button>
        <button class="btn-sm btn-gray" data-rvw-mgr>管理</button>
      </div>
    </div>`;
  }

  function bindWidget() {
    document.querySelectorAll('[data-rvw-go]').forEach(b => b.addEventListener('click', () => openFlash()));
    document.querySelectorAll('[data-rvw-mgr]').forEach(b => b.addEventListener('click', () => openManager()));
  }

  window.Review = {
    learn, dueCount, dueList, judge, quickArchive,
    openManager, openFlash, widgetHtml, bindWidget,
  };
})();
