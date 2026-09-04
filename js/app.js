/**
 * 主控制器 v2
 * 路由切换 · 状态管理 · 事件绑定 · 多设备同步
 */

// ============ 状态 ============
const state = { data: null, view: 'dashboard', dayTab: 1, dirty: false, saving: false, lastSavedAt: 0, pendingCloud: false };
const AVATARS = ['🐰','🐱','🐶','🐼','🦊','🐯','🐸','🐵','🦁','🐨','🐧','🐢'];

// ============ 工具 ============
function $(s) { return document.querySelector(s); }
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

window.todayKey = function () {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

function showToast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

// ============ 脏标记 & 保存按钮 ============
// 编辑后调用：标记本机有未同步修改
function markDirty() {
  state.dirty = true;
  state.pendingCloud = state.pendingCloud || hasCloudConfigured();
  updateSaveBtn();
}
function hasCloudConfigured() {
  const cfg = window.CloudSync && window.CloudSync.getConfig();
  return !!(cfg && cfg.provider);
}
function updateSaveBtn() {
  const btn = $('#saveBtn');
  if (!btn) return;
  const text = btn.querySelector('.save-text');
  const dot = btn.querySelector('.save-dot');
  btn.classList.remove('dirty', 'saving', 'error');
  if (state.saving) {
    btn.classList.add('saving');
    text.textContent = '保存中…';
    if (dot) dot.hidden = true;
    btn.title = '正在保存并同步…';
  } else if (state.dirty) {
    btn.classList.add('dirty');
    text.textContent = state.pendingCloud ? '保存 ●' : '保存 ●';
    if (dot) dot.hidden = false;
    btn.title = '有未保存的修改，点击保存' + (state.pendingCloud ? '并同步到云端' : '到本机');
  } else {
    text.textContent = '已保存';
    if (dot) dot.hidden = true;
    btn.title = state.lastSavedAt ? '最近保存：' + new Date(state.lastSavedAt).toLocaleTimeString('zh-CN') : '已是最新';
  }
}

// 统一的"保存"动作：先写本机，再按需推云端
async function saveAll() {
  if (state.saving) return;
  state.saving = true;
  updateSaveBtn();
  const ts = Date.now();
  try {
    state.data.updatedAt = ts;
    // 写本机（localStorage + 跨标签广播），这一步始终成功
    window.SyncAPI.saveData(state.data);
    state.lastSavedAt = ts;
    state.dirty = false;        // 本机已写入，dirty 清零
    state.pendingCloud = false; // 默认无待推送，下面再视云端情况翻回 true
    updateSaveBtn();

    const cloudConfigured = hasCloudConfigured();
    const cloudOnline = cloudConfigured && window.CloudSync.getStatus() === 'online';

    if (cloudOnline) {
      // 用 forcePush 强制推一次，绕过 autoPushEnabled 关闭状态
      const res = await window.CloudSync.sync(state.data.roomId, state.data, { forcePush: true });
      if (res && res.ok !== false && res.reason !== 'pending-push') {
        const map = { uploaded: '☁️ 已保存并上传', pushed: '☁️ 已保存并同步', 'conflict-resolved': '⚠️ 同步时发现冲突，已采用云端版本' };
        showToast(map[res.reason] || '☁️ 已同步');
      } else {
        // 推送失败，把按钮翻回"待同步"提示用户重试
        state.pendingCloud = true;
        showToast('本机已保存，云端推送失败 ⚠️');
        updateSaveBtn();
      }
    } else if (cloudConfigured) {
      state.pendingCloud = true;
      showToast('已保存到本机，云端未连接 ⚠️');
      updateSaveBtn();
    } else {
      showToast('已保存到本机 💾');
    }
  } catch (e) {
    state.dirty = true;
    showToast('保存失败：' + e.message);
    updateSaveBtn();
  } finally {
    state.saving = false;
    updateSaveBtn();
  }
}

function confetti() {
  const layer = $('#confettiLayer');
  const emojis = ['⭐','✨','🌟','💖','🎉','👏','🎊'];
  for (let i = 0; i < 20; i++) {
    const e = document.createElement('div');
    e.className = 'confetti';
    e.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    e.style.left = (Math.random() * 100) + '%';
    e.style.top = '-30px';
    e.style.animationDelay = (Math.random() * 0.3) + 's';
    e.style.fontSize = (18 + Math.random() * 16) + 'px';
    layer.appendChild(e);
    setTimeout(() => e.remove(), 2000);
  }
}

// ============ 数据初始化 ============
function ensureData() {
  const d = state.data;
  if (!d.checkins) d.checkins = {};
  if (!d.habits) d.habits = {};
  if (!d.mood) d.mood = {};
  if (!d.exercise) d.exercise = {};
  if (!d.health) d.health = {};
  if (!d.reading) d.reading = [];
  if (!d.study) d.study = {};
  if (!d.ziMastered) d.ziMastered = {};
  if (!d.poems) d.poems = {};
  if (!d.stars) d.stars = { total: 0, today: { date: '', count: 0 } };
  if (!d.starLog) d.starLog = {};
  if (!d.streaks) d.streaks = { currentDays: 0, bestDays: 0, lastDate: '' };
  if (!d.todos) d.todos = [];
  if (!d.rewards) d.rewards = window.AppData.REWARD_TEMPLATES.map(r => ({ ...r }));
  if (!d.books) d.books = {};   // 绘本标记：{ bookId: 'want'|'reading'|'done' }
  const k = window.todayKey();
  if (!d.checkins[k]) d.checkins[k] = {};
  if (!d.habits[k]) d.habits[k] = {};
  if (!d.exercise[k]) d.exercise[k] = {};
  if (!d.study[k]) d.study[k] = {};
  return d;
}

// ============ 星星 ============
function awardStars(n, silent) {
  const d = state.data;
  const k = window.todayKey();
  if (d.stars.today.date !== k) d.stars.today = { date: k, count: 0 };
  d.stars.total += n;
  d.stars.today.count += n;
  d.starLog[k] = (d.starLog[k] || 0) + n;
  window.SyncAPI.saveData(d);
  if (!silent) { showToast(`+${n} ⭐ 太棒了！`); confetti(); }
}

// ============ 视图路由 ============
function switchView(view) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  render();
  if (window.innerWidth <= 900) $('#sidebar').classList.remove('open');
}

function render() {
  const d = ensureData();
  const fn = window.Views[state.view] || window.Views.dashboard;
  $('#content').innerHTML = fn();
  bindViewEvents();
  updateSidebar();
  if (state.view === 'sync') { renderQr(); renderHotspotQr(); }
}

function updateSidebar() {
  const d = state.data, k = window.todayKey();
  // 侧边栏统计
  const dash = Object.values(d.checkins?.[k] || {}).filter(Boolean).length
    + Object.values(d.habits?.[k] || {}).filter(Boolean).length;
  setBadge('#navBadgeDash', dash);
  const studyN = Object.values(d.study?.[k] || {}).reduce((n, o) => n + Object.values(o || {}).filter(Boolean).length, 0);
  setBadge('#navBadgeStudy', studyN);
  const habitN = Object.values(d.habits?.[k] || {}).filter(Boolean).length;
  setBadge('#navBadgeHabit', habitN);

  $('#topStars').textContent = d.stars?.total || 0;
  $('#sideStreak').textContent = d.streaks?.currentDays || 0;

  // 完成度
  const total = 6 + 14 + 6; // 打卡6 + 习惯14 + 学习6（近似）
  const done = Object.values(d.checkins?.[k] || {}).filter(Boolean).length + habitN + Math.min(6, studyN);
  const pct = Math.min(100, Math.round(done / total * 100));
  $('#sideProgressBar').style.width = pct + '%';
  $('#sideProgressText').textContent = pct + '%';
}

function setBadge(sel, n) {
  const el = document.querySelector(sel);
  if (!el) return;
  if (n > 0) { el.textContent = n; el.hidden = false; } else { el.hidden = true; }
}

// ============ 事件绑定 ============
function bindViewEvents() {
  const content = $('#content');

  // ---- 导航日切换（课表）----
  content.querySelectorAll('.day-tab').forEach(b => {
    b.addEventListener('click', () => {
      const day = parseInt(b.dataset.day, 10);
      state.dayTab = day;
      content.querySelectorAll('.day-tab').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      renderScheduleFor(day);
    });
  });

  // ---- 学科卡片 ----
  content.querySelectorAll('[data-subject]').forEach(c => {
    c.addEventListener('click', () => window.StudyCenter.openSubject(c.dataset.subject));
  });

  // ---- 习惯打卡 ----
  content.querySelectorAll('[data-habit]').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.habit;
      const k = window.todayKey();
      const h = state.data.habits[k];
      if (h[id]) { delete h[id]; row.classList.remove('checked'); row.querySelector('.habit-check').textContent = ''; }
      else {
        h[id] = Date.now();
        row.classList.add('checked'); row.querySelector('.habit-check').textContent = '✓';
        awardStars(1);
      }
      window.SyncAPI.saveData(state.data); markDirty();
      updateSidebar();
    });
  });

  // ---- 在校打卡 ----
  content.querySelectorAll('[data-checkin]').forEach(c => {
    c.addEventListener('click', () => {
      const id = c.dataset.checkin;
      const k = window.todayKey();
      if (state.data.checkins[k][id]) { showToast('今天已经打过卡啦～'); return; }
      state.data.checkins[k][id] = Date.now();
      const item = window.CheckinItems.find(x => x.id === id);
      awardStars(item ? item.stars : 1);
      // 到校打卡更新连续天数
      if (id === 'arrive') updateStreak();
      render();
    });
  });

  // ---- 待办 ----
  content.querySelectorAll('[data-todo-toggle]').forEach(c => {
    c.addEventListener('click', () => {
      const t = state.data.todos.find(x => x.id === c.dataset.todoToggle);
      if (!t) return;
      t.done = !t.done;
      window.SyncAPI.saveData(state.data); markDirty();
      if (t.done) { awardStars(1); confetti(); }
      render();
    });
  });
  content.querySelectorAll('[data-todo-del]').forEach(b => {
    b.addEventListener('click', () => {
      state.data.todos = state.data.todos.filter(x => x.id !== b.dataset.todoDel);
      window.SyncAPI.saveData(state.data); markDirty();
      render();
    });
  });
  const addTodo = () => {
    const inp = $('#todoInput');
    if (!inp) return;
    const v = inp.value.trim();
    if (!v) return;
    state.data.todos.push({ id: 't' + Date.now(), text: v, done: false, date: window.todayKey() });
    window.SyncAPI.saveData(state.data); markDirty();
    render();
  };
  if ($('#addTodoBtn')) $('#addTodoBtn').addEventListener('click', addTodo);
  if ($('#todoInput')) $('#todoInput').addEventListener('keypress', e => { if (e.key === 'Enter') addTodo(); });

  // ---- 心情 ----
  // 若今天已保存过心情，用已保存值初始化，避免必须重选才能保存
  const curMood = state.data.mood?.[window.todayKey()];
  let pickedMood = curMood
    ? { emoji: curMood.emoji, label: curMood.label, score: curMood.score }
    : null;
  content.querySelectorAll('[data-mood]').forEach(b => {
    b.addEventListener('click', () => {
      content.querySelectorAll('[data-mood]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      pickedMood = { emoji: b.dataset.mood, label: b.dataset.label, score: parseInt(b.dataset.score, 10) };
    });
  });
  if ($('#saveMood')) {
    $('#saveMood').addEventListener('click', () => {
      const note = $('#moodNote').value.trim();
      if (!pickedMood) { showToast('先选一个心情吧～'); return; }
      const k = window.todayKey();
      const first = !state.data.mood[k];
      state.data.mood[k] = { ...pickedMood, note };
      window.SyncAPI.saveData(state.data); markDirty();
      if (first) awardStars(1); else showToast('心情已更新 😊');
      render();
    });
  }

  // ---- 运动 ----
  content.querySelectorAll('[data-sport]').forEach(c => {
    c.addEventListener('click', () => {
      const id = c.dataset.sport;
      const sp = window.AppData.SPORTS.find(s => s.id === id);
      const k = window.todayKey();
      if (state.data.exercise[k][id]) { delete state.data.exercise[k][id]; showToast('已取消'); }
      else {
        const v = prompt(`${sp.name}完成了多少${sp.unit}？`, sp.target);
        if (v === null) return;
        state.data.exercise[k][id] = { value: parseInt(v, 10) || sp.target, minutes: parseInt(v, 10) || sp.target };
        awardStars(2);
      }
      window.SyncAPI.saveData(state.data); markDirty();
      render();
    });
  });
  if ($('#saveSleep')) {
    $('#saveSleep').addEventListener('click', () => {
      const a = $('#sleepStart').value, b = $('#sleepEnd').value;
      if (!a || !b) { showToast('请选择入睡和起床时间'); return; }
      const k = window.todayKey();
      if (!state.data.health[k]) state.data.health[k] = {};
      state.data.health[k].sleepStart = a;
      state.data.health[k].sleepEnd = b;
      window.SyncAPI.saveData(state.data); markDirty();
      showToast('睡眠已记录 😴');
      render();
    });
  }
  if ($('#saveBody')) {
    $('#saveBody').addEventListener('click', () => {
      const h = $('#heightIn').value, w = $('#weightIn').value;
      const k = window.todayKey();
      if (!state.data.health[k]) state.data.health[k] = {};
      if (h) state.data.health[k].height = parseFloat(h);
      if (w) state.data.health[k].weight = parseFloat(w);
      window.SyncAPI.saveData(state.data); markDirty();
      showToast('身体数据已保存 📏');
      render();
    });
  }

  // ---- 阅读 ----
  if ($('#addRead')) {
    $('#addRead').addEventListener('click', () => {
      const book = $('#readBook').value.trim();
      const min = parseInt($('#readMinutes').value, 10) || 0;
      const pg = parseInt($('#readPages').value, 10) || 0;
      if (!book) { showToast('请填写书名～'); return; }
      state.data.reading.unshift({ date: window.todayKey(), book, minutes: min, pages: pg });
      window.SyncAPI.saveData(state.data); markDirty();
      awardStars(2);
      render();
    });
  }
  content.querySelectorAll('[data-read-del]').forEach(b => {
    b.addEventListener('click', () => {
      state.data.reading.splice(parseInt(b.dataset.readDel, 10), 1);
      window.SyncAPI.saveData(state.data); markDirty();
      render();
    });
  });

  // ---- 奖励兑换 ----
  content.querySelectorAll('[data-reward]').forEach(c => {
    c.addEventListener('click', () => {
      const r = state.data.rewards.find(x => x.id === c.dataset.reward);
      if (!r) return;
      if ((state.data.stars?.total || 0) < r.cost) { showToast('星星还不够哦～'); return; }
      if (!confirm(`确定用 ${r.cost} ⭐ 兑换「${r.name}」吗？`)) return;
      state.data.stars.total -= r.cost;
      window.SyncAPI.saveData(state.data); markDirty();
      showToast(`🎉 兑换成功：${r.name}`);
      confetti();
      render();
    });
  });

  // ---- 家长中心 ----
  if ($('#exportData')) {
    $('#exportData').addEventListener('click', () => {
      const txt = JSON.stringify(state.data, null, 2);
      const blob = new Blob([txt], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `工作台数据-${window.todayKey()}.json`;
      a.click();
      showToast('数据已导出 📤');
    });
  }
  if ($('#importData') && $('#importDataFile')) {
    const fileInput = $('#importDataFile');
    $('#importData').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(reader.result);
          if (!obj || typeof obj !== 'object') throw new Error('文件内容不是有效 JSON');
          if (!obj.checkins && !obj.stars && !obj.todos && !obj.habits) {
            throw new Error('不是工作台数据文件');
          }
          if (!confirm('导入将覆盖本设备当前的打卡、星星、任务等数据，确定继续吗？')) { fileInput.value = ''; return; }
          const merged = Object.assign({}, state.data, obj);
          merged.roomId = state.data.roomId || obj.roomId;
          merged.updatedAt = Date.now();
          window.SyncAPI.saveData(merged);
          state.data = window.SyncAPI.loadData();
          render();
          showToast('数据已导入 📥');
          confetti();
        } catch (e) {
          showToast('导入失败：' + e.message);
        }
        fileInput.value = '';
      };
      reader.readAsText(f, 'utf-8');
    });
  }
  if ($('#resetToday')) {
    $('#resetToday').addEventListener('click', () => {
      if (!confirm('确定重置今日所有打卡记录吗？')) return;
      const k = window.todayKey();
      state.data.checkins[k] = {};
      state.data.habits[k] = {};
      state.data.exercise[k] = {};
      state.data.study[k] = {};
      window.SyncAPI.saveData(state.data); markDirty();
      render();
      showToast('今日已重置');
    });
  }

  // ---- 绘本馆 ----
  content.querySelectorAll('[data-btheme]').forEach(b => {
    b.addEventListener('click', () => {
      window._bookTheme = b.dataset.btheme;
      render();
    });
  });
  content.querySelectorAll('[data-book]').forEach(c => {
    c.addEventListener('click', () => {
      if (window.openBookDetail) window.openBookDetail(c.dataset.book);
      else showToast('绘本模块未加载');
    });
  });

  // ---- 课表上传/编辑 ----
  const upBtn = $('#uploadScheduleBtn');
  if (upBtn) {
    upBtn.addEventListener('click', () => {
      if (window.openScheduleEditor) window.openScheduleEditor();
      else showToast('编辑器未加载');
    });
  }
  const viewDefBtn = $('#viewDefaultBtn');
  if (viewDefBtn) {
    viewDefBtn.addEventListener('click', () => {
      if (window.openScheduleEditor) {
        // 第二个参数 true 表示用默认课表数据填充（对比用）
        const cur = window.getCurrentOverrideKey ? window.getCurrentOverrideKey() : '';
        window.openScheduleEditor(cur, true);
      }
    });
  }

  // ---- 同步 ----
  if ($('#copyRoomBtn')) bindSync();
  // 云端同步（随时随地）
  bindCloud();
}

function renderScheduleFor(day) {
  const status = window.getNowScheduleStatus();
  // 取今天所在周，对应星期几的课表（这样能正确应用周覆盖）
  const monday = window.getMondayOfWeek ? window.getMondayOfWeek(new Date()) : null;
  const targetDate = monday ? new Date(monday.getTime() + (day - 1) * 86400000) : new Date();
  const arr = (window.getDaySchedule ? window.getDaySchedule(targetDate) : (window.ScheduleData[day] || [])) || [];
  const isToday = new Date().getDay() === day;
  const html = arr.map((x, i) => {
    let cls = 'tl-item', tag = '';
    if (x.isBreak) cls += ' break';
    if (isToday) {
      if (status.current && status.current.index === i) { cls += ' current'; tag = '<span class="tl-tag">正在上课</span>'; }
      else if (status.next && status.next.index === i) { cls += ' next'; tag = '<span class="tl-tag">下节课</span>'; }
      else if (status.current && status.current.index < i) cls += ' passed';
      else if (!status.current && status.next && status.next.index > i) cls += ' passed';
    }
    return `<div class="${cls}">
      <div class="tl-time">${x.start}<span class="tl-period">${x.period}</span></div>
      <div class="tl-body"><span class="tl-emoji">${x.emoji}</span><span class="tl-name">${x.name}</span>${tag}</div>
    </div>`;
  }).join('');
  const tl = document.querySelector('#content .timeline');
  if (tl) tl.innerHTML = html;
}

// ============ 连续天数 ============
function updateStreak() {
  const d = state.data;
  const k = window.todayKey();
  if (d.streaks.lastDate === k) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yk = `${y.getFullYear()}-${pad2(y.getMonth()+1)}-${pad2(y.getDate())}`;
  d.streaks.currentDays = (d.streaks.lastDate === yk) ? d.streaks.currentDays + 1 : 1;
  d.streaks.lastDate = k;
  d.streaks.bestDays = Math.max(d.streaks.bestDays || 0, d.streaks.currentDays);
}

// ============ 同步面板 ============
function copyText(t, okMsg) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(t).then(() => showToast(okMsg)).catch(() => fallbackCopy(t, okMsg));
  } else fallbackCopy(t, okMsg);
}
function fallbackCopy(t, okMsg) {
  const ta = document.createElement('textarea');
  ta.value = t;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast(okMsg); } catch (e) {}
  ta.remove();
}

function bindSync() {
  $('#copyRoomBtn').addEventListener('click', () => {
    copyText(state.data.roomId, '房间号已复制：' + state.data.roomId);
  });

  // 复制手机访问地址
  const copyUrlBtn = $('#copyUrlBtn');
  if (copyUrlBtn) {
    copyUrlBtn.addEventListener('click', () => {
      const t = $('#mobileUrlText').textContent;
      if (!t || t === '获取中…' || t === '未获取') { showToast('地址还没准备好～'); return; }
      copyText(t, '访问地址已复制');
    });
  }

  // 复制公网（Vercel）访问地址
  const copyPublicUrlBtn = $('#copyPublicUrlBtn');
  if (copyPublicUrlBtn) {
    copyPublicUrlBtn.addEventListener('click', () => {
      copyText('https://20260902101109.vercel.app', '公网地址已复制');
    });
  }

  // 手动设置电脑 IP（自动探测失败时用）
  const setIpBtn = $('#setIpBtn');
  if (setIpBtn) {
    setIpBtn.addEventListener('click', () => {
      const v = $('#manualIpInput').value.trim();
      if (!v) { showToast('请输入电脑 IP，如 192.168.1.5'); return; }
      setManualIP(v);
      showToast('已设置 IP：' + v);
      renderQr();
    });
    $('#manualIpInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') setIpBtn.click();
    });
  }

  $('#joinRoomBtn').addEventListener('click', () => {
    const code = $('#joinRoomInput').value.trim().toUpperCase();
    if (code.length < 4) { showToast('请输入正确的房间号'); return; }
    state.data.roomId = code;
    window.SyncAPI.saveData(state.data); markDirty();
    const url = new URL(window.location.href);
    url.searchParams.set('room', code);
    window.history.replaceState({}, '', url.toString());
    showToast('已加入房间 ' + code);
    render();
  });
}

// ===== 局域网 IP 探测（手机扫码必须，localhost 手机访问不到）=====
let cachedLanIP = null;

function getLocalIP() {
  return new Promise((resolve) => {
    if (cachedLanIP) { resolve(cachedLanIP); return; }
    if (typeof RTCPeerConnection === 'undefined') { resolve(null); return; }
    let pc = null, done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      try { if (pc) pc.close(); } catch (e) {}
      resolve(val);
    };
    try {
      pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => finish(null));
      pc.onicecandidate = (e) => {
        if (done || !e.candidate || !e.candidate.candidate) return;
        const m = e.candidate.candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        if (m && m[1]) {
          const ip = m[1];
          // 排除回环地址与 mDNS 伪地址
          if (!/^127\./.test(ip) && !/^169\.254/.test(ip) && !/^0\./.test(ip)) {
            cachedLanIP = ip;
            finish(ip);
          }
        }
      };
      setTimeout(() => finish(null), 2500);
    } catch (e) { finish(null); }
  });
}

// 手动指定 IP（当自动探测失败时用）
function setManualIP(ip) {
  cachedLanIP = ip ? ip.trim() : null;
  if (ip) localStorage.setItem('yiban-manual-ip', ip.trim());
  else localStorage.removeItem('yiban-manual-ip');
}

// 返回手机可访问的基础地址
// 关键：localhost / 127.0.0.1 手机访问不到，必须换成局域网 IP
async function getMobileBaseUrl() {
  const port = window.location.port || '8080';
  const proto = window.location.protocol;

  // 1. 用户手动指定的 IP 优先级最高
  const saved = localStorage.getItem('yiban-manual-ip');
  if (saved) return `http://${saved}:${port}`;

  const host = window.location.hostname;

  // 2. 已用 IP / 域名访问 → 手机端同样可访问，直接沿用当前地址
  if (host !== 'localhost' && host !== '127.0.0.1') {
    return `${proto}//${window.location.host}`;
  }

  // 3. 本地访问 → 问服务器要真实地址：
  //    优先「公网 IPv6」（手机 5G 也能直接连），其次局域网 IPv4（只能同 WiFi）
  try {
    const r = await fetch('/api/local-ip', { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      if (j.ipv6) return `http://[${j.ipv6}]:${j.port || port}`;
      if (j.ip) return `http://${j.ip}:${j.port || port}`;
    }
  } catch (e) {
    // 未使用 server.js 时会失败，继续回退
  }

  // 4. 回退：WebRTC 探测（部分浏览器因隐私策略返回 mDNS 而失败）
  const ip = await getLocalIP();
  return ip ? `http://${ip}:${port}` : null;
}

async function renderQr() {
  const box = $('#qrBox');
  if (!box) return;
  box.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:12px;color:#7A7A8C">生成中…</div>';

  const base = await getMobileBaseUrl();
  const txt = $('#mobileUrlText');

  if (!base) {
    box.innerHTML = `<div style="padding:16px 10px;text-align:center;font-size:12px;color:#7A7A8C;line-height:1.6">
      <div style="font-size:28px;margin-bottom:6px">📶</div>
      未能自动获取<br/>请在下方填写电脑 IP
    </div>`;
    if (txt) txt.textContent = '未获取';
    return;
  }

  const url = new URL(base);
  url.searchParams.set('room', state.data.roomId);
  const full = url.toString();

  // 生成二维码（在线服务）；加载失败时退化为文字地址，保证仍可用
  box.innerHTML = '';
  const img = new Image();
  img.alt = '扫码加入';
  img.style.width = '100%';
  img.style.height = '100%';
  img.onerror = () => {
    box.innerHTML = `<div style="padding:14px 8px;text-align:center;font-size:11px;color:#7A7A8C;line-height:1.6">
      <div style="font-size:26px;margin-bottom:4px">📶</div>
      二维码图片加载失败<br/>请在手机浏览器手动输入上方地址
    </div>`;
  };
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(full)}`;
  box.appendChild(img);

  if (txt) {
    txt.textContent = full;
    txt.style.cursor = 'pointer';
    txt.title = '点击复制';
    txt.onclick = () => copyText(full, '地址已复制：' + full);
  }
  // 把探测到的 IP 作为提示，方便用户核对/修改
  const ipInput = $('#manualIpInput');
  if (ipInput && !localStorage.getItem('yiban-manual-ip')) {
    ipInput.placeholder = `当前使用：${url.hostname}`;
  }
}

// 热点专用二维码：Windows 移动热点固定地址 192.168.137.1
function renderHotspotQr() {
  const box = $('#hotspotQrBox');
  if (!box) return;
  const url = new URL('http://192.168.137.1:8080/');
  url.searchParams.set('room', state.data.roomId);
  const full = url.toString();
  box.innerHTML = '';
  const img = new Image();
  img.alt = '热点扫码';
  img.style.width = '100%';
  img.style.height = '100%';
  img.onerror = () => {
    box.innerHTML = `<div style="padding:6px 4px;text-align:center;font-size:10px;color:#7A7A8C;line-height:1.5">二维码加载失败<br/>手动输入<br/>192.168.137.1:8080</div>`;
  };
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(full)}`;
  box.appendChild(img);

  const btn = $('#copyHotspotUrlBtn');
  if (btn && !btn._bound) {
    btn._bound = true;
    btn.addEventListener('click', () => copyText(full, '热点地址已复制：' + full));
  }
}

// 公网直连：把服务端探测到的公网 IPv6 地址与二维码渲染出来（手机 5G 可直接打开）
async function renderPublicAccess() {
  const box = $('#publicQrBox');
  const txt = $('#publicUrlText');
  const tip = $('#publicTip');
  if (!box && !txt) return;

  const info = (window.CloudSync && window.CloudSync.getServerInfo)
    ? await window.CloudSync.getServerInfo() : null;

  if (!info || !info.ipv6) {
    if (txt) txt.textContent = '未检测到公网 IPv6';
    if (tip) tip.innerHTML = '当前页面不是由 <code>server.js</code> 提供，或本机没有公网 IPv6。<br/>' +
      '可改用下方「电脑热点」或「同一 WiFi」方式。';
    if (box) box.innerHTML = '<div style="padding:10px;text-align:center;font-size:11px;color:#7A7A8C;line-height:1.6">暂无<br/>公网地址</div>';
    return;
  }

  const url = `http://[${info.ipv6}]:${info.port || 8080}/?room=${encodeURIComponent(state.data.roomId)}`;

  if (txt) {
    txt.textContent = url;
    txt.style.cursor = 'pointer';
    txt.title = '点击复制';
    txt.onclick = () => copyText(url, '公网地址已复制：' + url);
  }
  if (tip) {
    tip.innerHTML = '手机 <b>不用连热点、不用同一个 WiFi</b>，用 5G 流量直接打开，所有设备共用同一份数据。<br/>' +
      '<span style="color:#C75A92">若打不开，多半是路由器拦了 IPv6 入站</span>：进路由器关掉「IPv6 防火墙 / SPI」，或先用电脑热点。';
  }
  if (box) {
    box.innerHTML = '';
    const img = new Image();
    img.alt = '公网直连扫码';
    img.style.width = '100%';
    img.style.height = '100%';
    img.onerror = () => {
      box.innerHTML = '<div style="padding:10px;text-align:center;font-size:10px;color:#7A7A8C;line-height:1.5">二维码加载失败<br/>请手动输入左侧地址</div>';
    };
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    box.appendChild(img);
  }

  const btn = $('#copyPublic6Btn');
  if (btn && !btn._bound) {
    btn._bound = true;
    btn.addEventListener('click', () => copyText(url, '公网地址已复制：' + url));
  }
}

// ============ 云端同步（随时随地，多设备协作）============
const CLOUD_FIELDS = {
  'local-server': [],
  github: [
    { key: 'owner', label: 'GitHub 用户名', ph: 'your-name' },
    { key: 'repo', label: '数据仓库名（建议私有）', ph: 'yiban-data' },
    { key: 'token', label: 'Token（建议只勾选读写这一个仓库）', ph: 'github_pat_… 或 ghp_…', type: 'password' },
    { key: 'branch', label: '分支', ph: 'main', def: 'main' },
    { key: 'path', label: '数据存放目录', ph: 'data', def: 'data' },
  ],
  gitee: [
    { key: 'owner', label: 'Gitee 用户名', ph: 'your-name' },
    { key: 'repo', label: '数据仓库名（建议私有）', ph: 'yiban-data' },
    { key: 'token', label: '私人令牌', ph: '32 位令牌', type: 'password' },
    { key: 'branch', label: '分支', ph: 'master', def: 'master' },
    { key: 'path', label: '数据存放目录', ph: 'data', def: 'data' },
  ],
  supabase: [
    { key: 'url', label: 'Project URL', ph: 'https://xxxxx.supabase.co' },
    { key: 'key', label: 'anon public key', ph: 'eyJhbGciOi...' },
    { key: 'table', label: '数据表名', ph: 'workspaces', def: 'workspaces' },
  ],
  cloudbase: [
    { key: 'env', label: '环境 ID', ph: 'xxxxxx-xxxxxx' },
    { key: 'table', label: '集合名', ph: 'workspaces', def: 'workspaces' },
  ],
  rest: [
    { key: 'url', label: 'API 基础地址', ph: 'https://your-api.com/workspaces' },
  ],
};

const CLOUD_GUIDE = {
  'local-server': `<div class="alert alert-good" style="margin-top:12px"><span class="alert-emoji">✅</span><div>
    <b>已连接本机服务端</b><br/>
    数据统一存放在运行 <code>server.js</code> 的这台电脑上，所有访问同一个房间的设备
    <b>共用同一份数据</b>，改动通过 SSE <b>秒级互推</b>。<br/>
    手机走公网 IPv6 直连时，<b>不需要连热点、不需要同一个 WiFi、不用注册任何账号</b>。</div></div>`,
  github: `<div class="alert alert-info" style="margin-top:12px"><span class="alert-emoji">📖</span><div>
    <b>GitHub 仓库同步配置（约 3 分钟，免费）</b><br/>
    <b>1.</b> 新建一个<b>私有</b>仓库（例如 <code>yiban-data</code>），里面放一个 <code>data</code> 目录<br/>
    <b>2.</b> Settings → Developer settings → <b>Personal access tokens → Fine-grained tokens</b> → 新建<br/>
    &nbsp;&nbsp;&nbsp;· <b>Repository access</b> 选 <i>Only select repositories</i> → 只勾数据仓库<br/>
    &nbsp;&nbsp;&nbsp;· <b>Contents</b> 权限设为 <i>Read and write</i><br/>
    <b>3.</b> 把用户名、仓库名、Token 填入上方 → 「🔍 测试连接」→「💾 保存并连接」<br/>
    <span style="color:#C75A92">⚠️ Token 只保存在<b>这台设备</b>的浏览器里，不会随网页分发。</span></div></div>`,
  gitee: `<div class="alert alert-info" style="margin-top:12px"><span class="alert-emoji">📖</span><div>
    <b>Gitee 仓库同步配置（国内速度快，推荐国内使用）</b><br/>
    <b>1.</b> 新建一个<b>私有</b>仓库（例如 <code>yiban-data</code>），里面放一个 <code>data</code> 目录<br/>
    <b>2.</b> 右上角头像 → <b>设置</b> → <b>私人令牌</b> → 生成新令牌，勾选 <code>projects</code> 权限<br/>
    <b>3.</b> 填入用户名、仓库名、令牌 → 「🔍 测试连接」→「💾 保存并连接」<br/>
    <span style="color:#C75A92">⚠️ 用户名是「个人主页地址」里那段，不是邮箱、也不是中文昵称。</span></div></div>`,
  supabase: `<div class="alert alert-info" style="margin-top:12px"><span class="alert-emoji">📖</span><div>
    <b>Supabase 配置步骤（约 5 分钟，免费）</b><br/>
    <b>1.</b> supabase.com 注册 → 新建项目（初始化约 2 分钟）<br/>
    <b>2.</b> 左侧 <b>SQL Editor</b> → 执行下方建表语句<br/>
    <b>3.</b> 获取 Project URL 与 key（<b>新版界面三选一</b>）：<br/>
    &nbsp;&nbsp;· 路径 A：左下角齿轮 ⚙️ → <b>API</b> 或 <b>API Keys</b><br/>
    &nbsp;&nbsp;· 路径 B：项目首页的 <b>Project API keys</b> 卡片<br/>
    &nbsp;&nbsp;· 路径 C：直接访问 <code>supabase.com/dashboard/project/&lt;项目ref&gt;/settings/api</code><br/>
    <span style="color:#C75A92">⚠️ 新版界面可能显示 <b>publishable key</b>，它就是原来的 <b>anon key</b>，直接用即可。</span><br/>
    <b>4.</b> 填入上方表单 → 先点 <b>🔍 测试连接</b> 验证 → 成功后保存<br/>
    <code style="display:block;background:#fff;padding:8px;border-radius:6px;font-size:11px;margin-top:8px;white-space:pre">create table workspaces (
  room_id text primary key,
  data jsonb,
  updated_at bigint
);</code></div></div>`,
  cloudbase: `<div class="alert alert-info" style="margin-top:12px"><span class="alert-emoji">📖</span><div>
    <b>腾讯云开发配置步骤（环境 ID 已为你填好时可直接跳到第 4 步）</b><br/>
    <b>1.</b> 开通腾讯云开发 CloudBase 并新建环境<br/>
    <b>2.</b> 左侧 <b>数据库</b> → 新建集合 <b>workspaces</b><br/>
    &nbsp;&nbsp;&nbsp;权限设为「<b>所有用户可读，所有用户可写</b>」<br/>
    &nbsp;&nbsp;&nbsp;<span style="color:#C75A92">⚠️ 多设备要写入同一条记录，必须开放<b>写</b>权限；若选「仅创建者可写」，其他设备会写入失败。</span><br/>
    <b>3.</b> 左侧 <b>登录授权</b> → 开启 <b>匿名登录</b><br/>
    <b>4.</b> 上方填入<b>环境 ID</b> 与集合名 <b>workspaces</b> → 「🔍 测试连接」→「💾 保存并连接」</div></div>`,
  rest: `<div class="alert alert-info" style="margin-top:12px"><span class="alert-emoji">📖</span><div>
    <b>自定义 REST API 约定</b><br/>
    · <code>GET  {base}/{roomId}</code> → 返回 <code>{ data: {...}, updatedAt: 数字 }</code><br/>
    · <code>POST {base}/{roomId}</code> → body <code>{ data: {...}, updatedAt: 数字 }</code><br/>
    适合已有后端 / 云函数 / Workers 的用户自行对接。</div></div>`,
};

function renderCloudFields(provider, cfg) {
  const box = $('#cloudFields');
  if (!box) return;
  const fields = CLOUD_FIELDS[provider] || [];
  box.innerHTML = fields.length ? fields.map(f => `
    <div class="field-label">${f.label}</div>
    <div class="input-row">
      <input type="${f.type || 'text'}" data-cfield="${f.key}" placeholder="${f.ph}"
        value="${esc((cfg && cfg[f.key]) || f.def || '')}" />
    </div>`).join('')
    : `<div class="view-sub">此方式无需额外配置，直接点「💾 保存并连接」即可。</div>`;
  const guide = $('#cloudGuide');
  if (guide) guide.innerHTML = provider ? (CLOUD_GUIDE[provider] || '') : '';
}

function updateCloudStatus() {
  const box = $('#cloudStatus');
  const txt = $('#cloudStatusText');
  const last = $('#cloudLastSync');
  if (!box || !txt || !window.CloudSync) return;
  const st = window.CloudSync.getStatus();
  const msg = window.CloudSync.getStatusMsg();
  box.className = 'cloud-status ' +
    (st === 'online' ? 'online' : st === 'connecting' ? 'connecting' : st === 'error' ? 'error' : '');
  txt.textContent = msg || (st === 'unconfigured' ? '未配置云端 · 数据仅存本机' : '');
  if (last) {
    const t = window.CloudSync.getLastSync();
    last.textContent = t ? '上次同步：' + new Date(t).toLocaleString('zh-CN') : '';
  }
}

function startCloudAuto() {
  if (!window.CloudSync) return;
  const isLocal = window.CloudSync.isLocalServer();

  // 关键：禁用轮询自动推送。本地编辑后只有用户点保存才推云端，
  // 否则会一边编辑一边偷偷被同步，新数据可能把刚改的覆盖掉。
  window.CloudSync.setAutoPushEnabled(false);

  window.CloudSync.startAutoSync(
    state.data.roomId,
    () => state.data,
    // 检测到远端更新不再自动覆盖本机，改为弹出确认横幅
    (remoteData, source) => {
      if (!remoteData) return;
      promptRemoteUpdate(remoteData, source || '轮询检测');
    },
    // 本机服务端延迟极低，4 秒轮询 + SSE 实时推送；云端为了省请求用 20 秒
    isLocal ? 4000 : 20000
  );

  // 其它设备一改动，本设备立刻检测（仅本机服务端支持）
  if (isLocal && !startCloudAuto._sseBound) {
    startCloudAuto._sseBound = true;
    window.CloudSync.onRemoteChange((msg) => {
      // SSE 推送：对方刚保存过，本地拉一次对比
      if (msg && msg.serverAt) {
        // 直接用 serverAt 触发一次拉取并比对
        window.CloudSync.runOnce();
      }
    });
  }
}

// ============ 云端有更新 → 横幅提示，让用户选择 ============
let remotePromptShown = false;
function promptRemoteUpdate(remoteData, source) {
  // 兼容两种入参：pull() 返回 { data, updatedAt }，sync() 返回 { data, changed, reason }
  let workspaceData = null, remoteAt = 0;
  if (!remoteData) return;
  if (remoteData.updatedAt !== undefined && typeof remoteData.data === 'object') {
    workspaceData = remoteData.data;
    remoteAt = Number(remoteData.updatedAt) || 0;
  } else if (remoteData.data && typeof remoteData.data === 'object') {
    workspaceData = remoteData.data;
    remoteAt = Number(workspaceData.updatedAt) || 0;
  }
  if (!workspaceData) return;

  const localAt = Number(state.data.updatedAt) || 0;
  // 防抖：如果已经在提示了，不重复
  if (remotePromptShown) return;
  // 已被其它路径处理过（比如用户刚刚点过"同步"），跳过
  if (remoteAt <= localAt) return;

  // 差异预览
  const diff = summarizeDiff(state.data, workspaceData);

  remotePromptShown = true;
  const banner = document.createElement('div');
  banner.className = 'cloud-update-banner';
  banner.innerHTML = `
    <span class="cu-emoji">📥</span>
    <div class="cu-text">
      <div>检测到<b>其他设备的新版本</b></div>
      <div class="cu-time">${source || ''} · ${formatTimeAgo(remoteAt)}${diff ? ' · ' + diff : ''}</div>
    </div>
    <div class="cu-actions">
      <button class="primary" id="cuAccept">同步覆盖</button>
      <button id="cuKeep">保留本地</button>
    </div>
  `;
  document.body.appendChild(banner);

  const close = () => {
    banner.remove();
    remotePromptShown = false;
  };
  banner.querySelector('#cuAccept').addEventListener('click', () => {
    // 应用云端版本，覆盖本地（已编辑的会丢失——这是用户明确选择的）
    const fresh = JSON.parse(JSON.stringify(workspaceData));
    fresh.roomId = state.data.roomId;
    state.data = fresh;
    window.SyncAPI.saveData(state.data);
    render();
    state.dirty = false;
    state.pendingCloud = false;
    updateSaveBtn();
    showToast('已同步云端版本 ☁️');
    close();
  });
  banner.querySelector('#cuKeep').addEventListener('click', () => {
    // 保留本地。下次保存时本地会盖掉云端
    close();
    showToast('已保留本地，下次保存会上传到云端');
  });
  // 8 秒无操作自动关闭"保留本地"
  setTimeout(() => { if (banner.isConnected) close(); }, 12000);
}

function formatTimeAgo(ts) {
  if (!ts) return '';
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  return new Date(ts).toLocaleString('zh-CN');
}

function summarizeDiff(local, remote) {
  // 简单的"差异摘要"：比对星星、连续天数、待办数、最近一次保存日
  const parts = [];
  const ls = local.stars?.total || 0, rs = remote.stars?.total || 0;
  if (ls !== rs) parts.push(`⭐ ${rs - ls >= 0 ? '+' : ''}${rs - ls}`);
  const lc = local.streaks?.currentDays || 0, rc = remote.streaks?.currentDays || 0;
  if (lc !== rc) parts.push(`🔥 ${rc}天`);
  const lt = (local.todos || []).filter(t => !t.done).length;
  const rt = (remote.todos || []).filter(t => !t.done).length;
  if (lt !== rt) parts.push(`📝 待办${rt}项`);
  return parts.join(' · ');
}

function bindCloud() {
  if (!window.CloudSync) return;
  const sel = $('#cloudProvider');
  if (!sel) return;

  const cfg = window.CloudSync.getConfig();
  if (cfg && cfg.provider) {
    sel.value = cfg.provider;
    renderCloudFields(cfg.provider, cfg);
  }

  sel.addEventListener('change', () => renderCloudFields(sel.value, null));

  const saveBtn = $('#saveCloudBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const provider = sel.value;
      if (!provider) { showToast('请先选择一种云服务'); return; }
      const c = { provider };
      document.querySelectorAll('[data-cfield]').forEach(inp => {
        c[inp.dataset.cfield] = inp.value.trim();
      });
      if (provider === 'supabase' && (!c.url || !c.key)) { showToast('请填写 Project URL 和 anon key'); return; }
      if (provider === 'cloudbase' && !c.env) { showToast('请填写环境 ID'); return; }
      if (provider === 'rest' && !c.url) { showToast('请填写 API 地址'); return; }

      window.CloudSync.saveConfig(c);
      showToast('正在连接云端…');
      const ok = await window.CloudSync.connect();
      updateCloudStatus();
      if (ok) {
        showToast('🎉 云端已连接');
        confetti();
        startCloudAuto();
      } else {
        showToast('连接失败：' + window.CloudSync.getStatusMsg());
      }
    });
  }

  // 🔍 测试连接：不覆盖已有配置，测完自动还原
  const testBtn = $('#testCloudBtn');
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const provider = sel.value;
      if (!provider) { showToast('请先选择一种云服务'); return; }
      const c = { provider };
      document.querySelectorAll('[data-cfield]').forEach(inp => {
        c[inp.dataset.cfield] = inp.value.trim();
      });
      if (provider === 'supabase' && (!c.url || !c.key)) { showToast('请填写 Project URL 和 key'); return; }
      if (provider === 'cloudbase' && !c.env) { showToast('请填写环境 ID'); return; }
      if (provider === 'rest' && !c.url) { showToast('请填写 API 地址'); return; }

      const box = $('#cloudTestResult');
      if (box) box.innerHTML = '<div class="view-sub">⏳ 正在测试连接…</div>';

      const oldCfg = window.CloudSync.getConfig();
      window.CloudSync.saveConfig(c);
      const ok = await window.CloudSync.connect();
      let html = '';
      // 从 Project URL 推导出「我的 API 设置页」直达链接
      const m = String(c.url || '').match(/https:\/\/([^.]+)\.supabase\.(co|in|net)/);
      const apiLink = m
        ? '<div style="margin-top:8px"><a href="https://supabase.com/dashboard/project/' + m[1] +
          '/settings/api" target="_blank" rel="noopener" style="display:inline-block;padding:8px 14px;' +
          'border-radius:999px;background:#FFE066;color:#6B5400;font-weight:700;font-size:13px;' +
          'text-decoration:none">🔗 打开我的 API 设置页</a></div>'
        : '';

      if (ok) {
        const st0 = window.CloudSync.getStatus();
        const remote = await window.CloudSync.pull(state.data.roomId);
        const st1 = window.CloudSync.getStatus();
        if (st1 === 'error') {
          html = '<div class="alert alert-warn" style="margin-top:8px"><span class="alert-emoji">⚠️</span><div>' +
            '已连上，但读表失败：' + esc(window.CloudSync.getStatusMsg()) +
            '<br/>请回到 Supabase 的 <b>SQL Editor</b> 执行建表语句。</div></div>' + apiLink;
        } else if (remote && remote.data) {
          html = '<div class="alert alert-good" style="margin-top:8px"><span class="alert-emoji">✅</span><div>' +
            '连接成功！已读到云端数据，点「💾 保存并连接」即可启用。</div></div>';
        } else {
          html = '<div class="alert alert-good" style="margin-top:8px"><span class="alert-emoji">✅</span><div>' +
            '连接成功！表已就绪（该房间暂无数据，保存后自动上传）。</div></div>';
        }
      } else {
        html = '<div class="alert alert-warn" style="margin-top:8px"><span class="alert-emoji">❌</span><div>' +
          '连接失败：' + esc(window.CloudSync.getStatusMsg()) +
          '<br/>请检查 URL / key 是否填对（key 应选 <b>anon</b> 或 <b>publishable</b> 那个）。</div></div>' + apiLink;
      }

      // 还原原配置
      window.CloudSync.saveConfig(oldCfg);
      if (oldCfg && oldCfg.provider) {
        await window.CloudSync.connect();
        startCloudAuto();
      } else {
        window.CloudSync.stopAutoSync();
      }
      if (box) box.innerHTML = html;
      updateCloudStatus();
    });
  }

  const clearBtn = $('#clearCloudBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (!confirm('确定断开云端同步？\n断开后数据将仅保存在本机。')) return;
      window.CloudSync.saveConfig(null);
      window.CloudSync.stopAutoSync();
      showToast('已断开云端');
      render();
    });
  }

  const syncBtn = $('#syncNowBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      // 立即同步 = 强制推送本地（如果本地有修改）。拉取必须先经确认。
      const btn = syncBtn;
      btn.disabled = true;
      showToast('正在同步…');
      try {
        const res = await window.CloudSync.sync(state.data.roomId, state.data, { forcePush: true });
        if (res.changed && res.data) {
          // 远端更新的情况：转给横幅确认
          promptRemoteUpdate(res, '立即同步 · 远端检测');
          showToast('云端有新数据，请选择是否同步');
        } else if (res.reason === 'pushed' || res.reason === 'uploaded' || res.reason === 'conflict-resolved') {
          state.dirty = false;
          state.pendingCloud = false;
          updateSaveBtn();
          showToast('☁️ 已推送本地修改到云端');
        } else {
          showToast('同步完成（' + (res.reason || '') + '）');
        }
      } finally {
        btn.disabled = false;
      }
      updateCloudStatus();
    });
  }

  updateCloudStatus();
}

async function initCloud() {
  if (!window.CloudSync) return;
  window.CloudSync.onStatus(updateCloudStatus);

  let cfg = window.CloudSync.getConfig();

  // 页面由 server.js 提供时，自动启用「本机服务端」共享 —— 用户什么都不用配
  if ((!cfg || !cfg.provider) && await window.CloudSync.autoDetectServer()) {
    cfg = { provider: 'local-server' };
    window.CloudSync.saveConfig(cfg);
  }

  if (cfg && cfg.provider) {
    window.CloudSync.connect().then(ok => { if (ok) startCloudAuto(); });
  }
  setTimeout(updateCloudStatus, 400);
  renderPublicAccess();
}

// ============ 时钟 & 天气 ============
function updateClock() {
  const now = new Date();
  $('#topClock').textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const h = now.getHours();
  let greet = '你好', nick = '小朋友，今天也要加油哦～';
  if (h < 6) { greet = '夜深啦'; nick = '要早点睡觉哦～'; }
  else if (h < 9) { greet = '早上好'; nick = '新的一天，背上小书包出发吧～'; }
  else if (h < 12) { greet = '上午好'; nick = '认真听课，知识会变成小魔法～'; }
  else if (h < 14) { greet = '中午好'; nick = '吃饱饭休息一下～'; }
  else if (h < 17) { greet = '下午好'; nick = '加油，离放学不远啦～'; }
  else if (h < 19) { greet = '傍晚好'; nick = '今天表现怎么样？记得打卡哦～'; }
  else if (h < 22) { greet = '晚上好'; nick = '作业写完了吗？我们来打卡吧～'; }
  else { greet = '夜深啦'; nick = '要早点休息，明天见～'; }
  $('#greeting').textContent = greet;
  $('#nickname').textContent = nick;
}

function fetchWeather() {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=22.5&longitude=114.0&current=temperature_2m,weather_code&timezone=Asia%2FShanghai';
  fetch(url).then(r => r.json()).then(j => {
    const c = j.current;
    if (!c) return;
    $('#weatherTemp').textContent = Math.round(c.temperature_2m) + '°C';
    const code = c.weather_code;
    $('#weatherEmoji').textContent =
      code === 0 ? '☀️' : code <= 3 ? '⛅' : code <= 48 ? '🌫️' : code <= 57 ? '🌦️' :
      code <= 67 ? '🌧️' : code <= 77 ? '🌨️' : code <= 82 ? '⛈️' : code <= 99 ? '🌩️' : '🌈';
  }).catch(() => { $('#weatherTemp').textContent = '26°C'; $('#weatherEmoji').textContent = '⛅'; });
}

// ============ 弹窗工具（供 study.js 使用）============
window.openModal = function (html) {
  const layer = $('#modalLayer');
  layer.querySelector('.modal-body').innerHTML = html;
  layer.classList.add('show');
  document.body.style.overflow = 'hidden';
};
window.closeModal = function () {
  $('#modalLayer').classList.remove('show');
  document.body.style.overflow = '';
};

// ============ 初始化 ============
function init() {
  state.data = window.SyncAPI.loadData();
  window.appState = state;
  window.appShowToast = showToast;
  window.appConfetti = confetti;
  window.appRender = render;
  window.appAwardStars = awardStars;

  // 顶栏保存按钮
  const saveBtn = $('#saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveAll);
  }
  // Ctrl/Cmd + S 快捷保存
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveAll();
    }
  });
  // 有未保存修改时，离开页面提醒
  window.addEventListener('beforeunload', (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '有未保存的修改，确定要离开吗？';
      return e.returnValue;
    }
  });

  // URL 房间号
  const url = new URL(window.location.href);
  const r = url.searchParams.get('room');
  if (r && r !== state.data.roomId) {
    state.data.roomId = r.toUpperCase();
    window.SyncAPI.saveData(state.data);
  }
  // URL 指定视图：?view=sync 直达「设备同步」页（扫码用）
  const v = url.searchParams.get('view');
  if (v && window.Views[v]) state.view = v;

  // 头像
  const saved = localStorage.getItem('yiban-avatar');
  if (saved) document.querySelector('.avatar-emoji').textContent = saved;
  $('#avatar').addEventListener('click', () => {
    const cur = localStorage.getItem('yiban-avatar') || '🐰';
    const opts = AVATARS.filter(a => a !== cur);
    const next = opts[Math.floor(Math.random() * opts.length)];
    localStorage.setItem('yiban-avatar', next);
    document.querySelector('.avatar-emoji').textContent = next;
  });

  // 导航
  document.querySelectorAll('.nav-item').forEach(b => {
    b.addEventListener('click', () => switchView(b.dataset.view));
  });

  // 菜单
  $('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  // 弹窗关闭
  $('#modalClose').addEventListener('click', window.closeModal);
  document.querySelector('.modal-mask').addEventListener('click', window.closeModal);

  // 时钟
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(() => { if (state.view === 'dashboard') render(); }, 60000);

  fetchWeather();
  render();

  // 云端同步（若已配置则自动连接并定时同步）
  initCloud();

  // 跨标签页同步
  window.SyncAPI.subscribeCrossTab((remote) => {
    if (!remote) return;
    const local = window.SyncAPI.loadData();
    if (!local.updatedAt || (remote.updatedAt && remote.updatedAt > local.updatedAt)) {
      window.SyncAPI.applyRemoteData(remote);
      state.data = window.SyncAPI.loadData();
      showToast('已同步最新数据 🔄');
      render();
    }
  });

  // 微信内置浏览器(X5内核)常无 speechSynthesis。
  // 语音已自动降级为在线发音，这里给出持久指引横幅。
  if (/MicroMessenger/i.test(navigator.userAgent) && !localStorage.getItem('yiban-wx-tip-closed')) {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9998;' +
      'background:linear-gradient(135deg,#FFE066,#FFB570);color:#6B3A00;' +
      'padding:12px 16px;font-size:13px;display:flex;align-items:center;gap:10px;' +
      'box-shadow:0 -4px 16px rgba(0,0,0,.15);';
    bar.innerHTML =
      '<span style="font-size:20px;flex-shrink:0">💡</span>' +
      '<span style="flex:1;line-height:1.5">您在微信中打开：语音已切换为<b>在线发音</b>。' +
      '若无声，请点右上角 <b>⋯</b> → <b>在浏览器中打开</b></span>' +
      '<button id="wxTipClose" style="background:rgba(0,0,0,.12);border-radius:50%;' +
      'width:26px;height:26px;flex-shrink:0;font-size:15px">×</button>';
    document.body.appendChild(bar);
    bar.querySelector('#wxTipClose').addEventListener('click', () => {
      bar.remove();
      localStorage.setItem('yiban-wx-tip-closed', '1');
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
