/**
 * 视图层 v2 —— 10 大模块
 * 每个视图函数返回 HTML 字符串，由 app.js 挂载并绑定事件
 */
(function () {
  const D = () => window.AppData;
  const st = () => window.appState.data;
  const todayKey = () => window.todayKey();
  const pad2 = n => n < 10 ? '0' + n : '' + n;
  const esc = s => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

  // ============ 通用组件 ============
  function statCard(icon, val, lab, bg, color) {
    return `<div class="stat-card">
      <div class="stat-icon" style="background:${bg}">${icon}</div>
      <div><div class="stat-val" style="color:${color}">${val}</div><div class="stat-lab">${lab}</div></div>
    </div>`;
  }

  function todayStudyCount() {
    const s = st().study?.[todayKey()] || {};
    return Object.values(s).reduce((n, o) => n + Object.values(o || {}).filter(Boolean).length, 0);
  }
  function todayHabitCount() {
    return Object.values(st().habits?.[todayKey()] || {}).filter(Boolean).length;
  }
  function todayCheckinCount() {
    return Object.values(st().checkins?.[todayKey()] || {}).filter(Boolean).length;
  }

  // ============ 1. 今日概览 ============
  function viewDashboard() {
    const s = st();
    const status = window.getNowScheduleStatus();
    const now = new Date();
    const day = now.getDay();
    const isWeekday = day >= 1 && day <= 5;
    const curDay = isWeekday ? day : 1;
    // 当前周是否使用临时课表
    const isOverridden = isWeekday && (window.isCurrentWeekOverridden ? window.isCurrentWeekOverridden() : false);
    const overrideKey = isOverridden ? (window.getCurrentOverrideKey ? window.getCurrentOverrideKey() : '') : '';
    const diffs = isOverridden && window.getWeekOverrideDiff ? window.getWeekOverrideDiff(overrideKey) : [];
    const diffHtml = diffs.length
      ? `<div style="margin-top:7px;font-size:12px;color:#8B4513;line-height:1.7;background:rgba(255,255,255,0.55);padding:6px 10px;border-radius:8px">
           <b>与默认课表不同之处：</b><br/>
           ${diffs.map(d => `• ${d.dayName} ${d.period}：${d.defaultName} → <b style="color:#C75A92">${d.overrideName}</b>`).join('<br/>')}
         </div>`
      : '';

    // 状态卡配色
    let bg, emoji, title, desc;
    if (!isWeekday) {
      bg = 'linear-gradient(135deg, var(--purple), var(--pink))'; emoji = '🎉';
      title = '今天是周末'; desc = '好好休息，下周继续加油！';
    } else if (status.state === 'before-school') {
      bg = 'linear-gradient(135deg, var(--blue), var(--purple))'; emoji = '🌅';
      title = '还没开始上课';
      desc = `距离第一节「${status.next ? status.next.name : ''}」还有 ${status.next ? minsUntil(status.next.start) : 0} 分钟`;
    } else if (status.state === 'morning-activity') {
      bg = 'linear-gradient(135deg, var(--yellow), var(--orange))'; emoji = '🚩';
      title = '正在进行：' + status.current.name;
      desc = `${status.current.start} - ${status.current.end}，别迟到哦～`;
    } else if (status.state === 'in-class') {
      bg = 'linear-gradient(135deg, var(--green), var(--blue))'; emoji = '📖';
      title = '上课中：' + status.current.name;
      desc = `${status.current.period}（${status.current.start}-${status.current.end}）· 下节：${status.next ? status.next.name : '放学'}`;
    } else if (status.state === 'break') {
      bg = 'linear-gradient(135deg, var(--orange), var(--pink))'; emoji = '☕';
      title = '休息时间：' + status.current.name;
      desc = status.next ? `休息到 ${status.current.end}，之后是 ${status.next.name}` : '休息中';
    } else {
      // 放学后：按时间显示更合适的状态
      const hr = now.getHours();
      if (hr >= 21 || hr < 6) {
        bg = 'linear-gradient(135deg, #2D2D5F, #5B3DA8)'; emoji = '🌙';
        title = '夜深啦，准备睡觉'; desc = '记得 21:20 前睡觉哦，明天继续加油～';
      } else if (hr >= 19) {
        bg = 'linear-gradient(135deg, #C75A92, #5B3DA8)'; emoji = '🌃';
        title = '晚上好'; desc = '完成今天的打卡和阅读，准备洗漱睡觉吧～';
      } else if (hr >= 17) {
        bg = 'linear-gradient(135deg, #FFB570, #FF7AB6)'; emoji = '🌆';
        title = '傍晚时分'; desc = '今天辛苦了，记得做运动和阅读哦～';
      } else {
        bg = 'linear-gradient(135deg, var(--pink), var(--purple))'; emoji = '🌇';
        title = '放学啦'; desc = '今天辛苦了，完成打卡和阅读吧！';
      }
    }

    // 今日完成度
    const totalTasks = 6 + 3; // 6打卡 + 学习/习惯/心情
    const doneTasks = todayCheckinCount() + Math.min(3, todayStudyCount() + todayHabitCount() + (s.mood?.[todayKey()] ? 1 : 0));
    const pct = Math.min(100, Math.round(doneTasks / totalTasks * 100));
    const C = 2 * Math.PI * 45;
    const offset = C - (pct / 100) * C;

    // 今日课表（走周覆盖机制，临时课表也能正确显示）
    let schedHtml = '';
    if (isWeekday) {
      const arr = (window.getDaySchedule ? window.getDaySchedule(new Date()) : (window.ScheduleData[curDay] || [])) || [];
      const dateKey = todayKey();
      schedHtml = arr.map((x, i) => {
        let cls = 'tl-item', tag = '';
        if (x.isBreak) cls += ' break';
        if (status.current && status.current.index === i) { cls += ' current'; tag = '<span class="tl-tag">正在上课</span>'; }
        else if (status.next && status.next.index === i) { cls += ' next'; tag = '<span class="tl-tag">下节课</span>'; }
        else if (status.current && status.current.index < i) cls += ' passed';
        else if (!status.current && status.next && status.next.index > i) cls += ' passed';
        const matBtn = x.isBreak ? '' :
          `<button class="mat-chip" data-mat-date="${dateKey}" data-mat-period="${x.period}" data-mat-name="${x.name}" title="课前/课后资料">📎${window.Materials ? window.Materials.count(dateKey, x.period) : 0}</button>`;
        return `<div class="${cls}">
          <div class="tl-time">${x.start}<span class="tl-period">${x.period}</span></div>
          <div class="tl-body"><span class="tl-emoji">${x.emoji}</span><span class="tl-name">${x.name}</span>${tag}${matBtn}</div>
        </div>`;
      }).join('');
    } else {
      schedHtml = '<div class="empty"><span class="empty-emoji">🎈</span>周末愉快，好好休息～</div>';
    }

    // 深圳提示（上学时间/睡眠）
    const cal = D().SZ_CALENDAR;
    const hour = now.getHours();
    let alertHtml = '';
    if (hour >= 19 && hour <= 22) {
      alertHtml = `<div class="alert alert-warn"><span class="alert-emoji">💤</span>
        <div>深圳规定：小学生就寝不晚于 <b>${cal.bedtime}</b>，每天睡足 <b>${cal.sleepTarget}</b> 小时。该准备洗漱睡觉啦～</div></div>`;
    } else if (hour >= 6 && hour < 8) {
      alertHtml = `<div class="alert alert-info"><span class="alert-emoji">🏫</span>
        <div>深圳规定小学上午上课不早于 <b>${cal.earliestSchoolTime}</b>。第一节课 8:55，记得吃早餐、带好文具！</div></div>`;
    } else {
      alertHtml = `<div class="alert alert-good"><span class="alert-emoji">📋</span>
        <div>双减政策：小学一、二年级<b>不布置家庭书面作业</b>。建议安排阅读、运动和亲子游戏～</div></div>`;
    }

    const todos = (s.todos || []).filter(t => !t.date || t.date === todayKey());

    return `
      ${alertHtml}

      <div class="hero-status" style="background:${bg}">
        <span class="hs-bg">${emoji}</span>
        <div class="hs-left">
          <div class="hs-label">当前状态 · 深圳 ${['周日','周一','周二','周三','周四','周五','周六'][day]}</div>
          <div class="hs-title">${title}</div>
          <div class="hs-desc">${desc}</div>
        </div>
        <div class="ring-wrap">
          <svg class="ring-svg" width="110" height="110" viewBox="0 0 110 110">
            <circle class="ring-bg" cx="55" cy="55" r="45"></circle>
            <circle class="ring-fg" cx="55" cy="55" r="45" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"></circle>
          </svg>
          <div class="ring-text"><div class="ring-num">${pct}%</div><div class="ring-lab">今日完成</div></div>
        </div>
      </div>

      <div class="grid-4">
        ${statCard('⭐', s.stars?.total || 0, '累计星星', 'linear-gradient(135deg,#FFE066,#FFB570)', '#B25500')}
        ${statCard('🔥', s.streaks?.currentDays || 0, '连续打卡', 'linear-gradient(135deg,#FFB6D9,#FF7AB6)', '#C75A92')}
        ${statCard('📚', todayStudyCount(), '今日学习', 'linear-gradient(135deg,#A5D8FF,#5BA8E5)', '#1B4F7A')}
        ${statCard('✅', todayHabitCount(), '今日习惯', 'linear-gradient(135deg,#B5EAD7,#6BC9A8)', '#2D7A55')}
      </div>

      <div class="grid-2">
        <div class="card">
          ${isOverridden ? `<div class="alert alert-warn" style="margin-bottom:12px">
            <span class="alert-emoji">📌</span>
            <div style="flex:1">本周使用 <b>临时课表</b>（周起始 ${overrideKey}）<button class="btn-sm btn-gray" id="viewDefaultBtn" style="margin-left:6px">查看默认</button></div>
          </div>
          ${diffHtml}` : ''}
          <div class="card-title">
            📅 今日课表
            <span class="t-sub">${isOverridden ? '（临时）' : '（深圳小学 8:55 第一节）'}</span>
            <button class="btn-sm btn-purple" id="matBrowserBtn" style="margin-left:auto">🗄 资料库</button>
            <button class="btn-sm btn-green" id="subjectMatBtn" style="margin-left:6px">📚 科目资料</button>
            <button class="btn-sm btn-yellow" id="uploadScheduleBtn" style="margin-left:6px">📤 上传课表</button>
          </div>
          <div class="day-tabs">
            ${[1,2,3,4,5].map(d => `<button class="day-tab ${d === curDay ? 'active' : ''}" data-day="${d}">周${['','一','二','三','四','五','六'][d]}</button>`).join('')}
          </div>
          <div class="timeline" style="margin-top:12px">${schedHtml}</div>
        </div>

        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card">
            <div class="card-title">🎒 今日小任务</div>
            <ul class="todo-list">
              ${todos.length ? todos.map(t => `<li class="${t.done ? 'done' : ''}">
                <div class="todo-check ${t.done ? 'checked' : ''}" data-todo-toggle="${t.id}">${t.done ? '✓' : ''}</div>
                <span class="todo-text">${esc(t.text)}</span>
                <button class="todo-del" data-todo-del="${t.id}">×</button>
              </li>`).join('') : '<div class="empty"><span class="empty-emoji">📝</span>还没有任务，添加一个吧～</div>'}
            </ul>
            <div class="input-row">
              <input type="text" id="todoInput" placeholder="添加一个小任务…" maxlength="30" />
              <button id="addTodoBtn">添加</button>
            </div>
          </div>

          <div class="card">
            <div class="card-title">🔮 明天的课程</div>
            <div id="tomorrowList">${tomorrowHtml()}</div>
          </div>
        </div>
      </div>
    `;
  }

  function minsUntil(time) {
    const [h, m] = time.split(':').map(Number);
    const now = new Date();
    const t = new Date(now); t.setHours(h, m, 0, 0);
    const d = Math.round((t - now) / 60000);
    return d > 0 ? d : 0;
  }

  function tomorrowHtml() {
    const d = new Date().getDay();
    const nd = (d >= 1 && d <= 4) ? d + 1 : 1;
    // 取"明天"那天的日期，走周覆盖机制
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const arr = (window.getDaySchedule ? window.getDaySchedule(tomorrow) : (window.ScheduleData[nd] || [])) || [];
    const nm = ['', '周一', '周二', '周三', '周四', '周五'][nd];
    if (!arr.length) return '<div class="empty">无课程</div>';
    return `<div class="view-sub" style="margin-bottom:8px">${nm} · 共 ${arr.filter(x => !x.isBreak).length} 节课</div>` +
      arr.map(x => `<div class="tl-item break" style="padding:8px 12px">
        <div class="tl-time">${x.start}</div>
        <div class="tl-body"><span class="tl-emoji">${x.emoji}</span><span class="tl-name">${x.name}</span></div>
      </div>`).join('');
  }

  // ============ 2. 学科学习 ============
  function viewStudy() {
    const s = st();
    const today = todayKey();
    const study = s.study?.[today] || {};

    const subjects = [
      { id: 'yuwen', name: '语文', emoji: '📖', color: '#FFB6D9', desc: '拼音·识字·古诗·生字表',
        acts: [
          { id: 'pinyin', name: '拼音练习', emoji: '🔤', desc: '看拼音选汉字' },
          { id: 'character', name: '识字卡', emoji: '🈶', desc: '翻面学汉字' },
          { id: 'poem', name: '古诗背诵', emoji: '📜', desc: '6 首必背古诗' },
          { id: 'zi', name: '生字表', emoji: '📝', desc: '追踪 100 个会写字' },
        ] },
      { id: 'shuxue', name: '数学', emoji: '🔢', color: '#A5D8FF', desc: '加减法·图形·数数',
        acts: [
          { id: 'math', name: '加减法', emoji: '➕', desc: '10 以内运算' },
          { id: 'math20', name: '20以内', emoji: '🔟', desc: '20 以内进阶' },
          { id: 'shape', name: '认识图形', emoji: '🔷', desc: '五种图形' },
          { id: 'count', name: '数数练习', emoji: '🧮', desc: '1-20 数数' },
        ] },
      { id: 'yingyu', name: '英语', emoji: '🔤', color: '#FFE066', desc: '字母·单词·拼写',
        acts: [
          { id: 'letter', name: '26 字母', emoji: '🅰️', desc: '大小写+发音' },
          { id: 'word', name: '单词卡', emoji: '📇', desc: '24 个单词' },
          { id: 'spell', name: '拼写练习', emoji: '✏️', desc: '看图选词' },
        ] },
      { id: 'daode', name: '道德与法治', emoji: '⚖️', color: '#B5EAD7', desc: '好习惯·小故事',
        acts: [
          { id: 'story', name: '德育小故事', emoji: '📚', desc: '3 个故事' },
          { id: 'habit', name: '好习惯', emoji: '🌱', desc: '8 项行为' },
        ] },
      { id: 'kexue', name: '科学', emoji: '🔬', color: '#C9B6FF', desc: '自然小问答',
        acts: [
          { id: 'quiz', name: '知识问答', emoji: '❓', desc: '8 道常识' },
          { id: 'observe', name: '观察日记', emoji: '📓', desc: '记录发现' },
        ] },
    ];

    const ziTotal = D().ZI_XIE.reduce((n, u) => n + u.zi.length, 0);
    const ziDone = Object.keys(s.ziMastered || {}).length;

    return `
      <div class="view-head">
        <div>
          <div class="view-title">📚 学科学习</div>
          <div class="view-sub">配套统编版教材 · 完成练习获得 ⭐</div>
        </div>
      </div>

      <div class="grid-4">
        ${statCard('📝', `${ziDone}/${ziTotal}`, '会写字掌握', 'linear-gradient(135deg,#FFB6D9,#FF7AB6)', '#C75A92')}
        ${statCard('📜', Object.keys(s.poems || {}).length, '已背古诗', 'linear-gradient(135deg,#FFE066,#FFB570)', '#B25500')}
        ${statCard('📚', todayStudyCount(), '今日已练', 'linear-gradient(135deg,#A5D8FF,#5BA8E5)', '#1B4F7A')}
        ${statCard('🎯', Math.round(ziDone / 1600 * 100) + '%', '识字进度(1600)', 'linear-gradient(135deg,#B5EAD7,#6BC9A8)', '#2D7A55')}
      </div>

      <div class="card">
        <div class="card-title">📕 教材清单 <span class="t-sub">（点击卡片进入学科练习）</span></div>
        <div class="sc-chips" style="margin-bottom:16px">
          ${D().TEXTBOOKS.map(t => `<span class="act-chip">${t.emoji} ${t.subject} · ${t.pub}</span>`).join('')}
        </div>
        <div class="study-grid">
          ${subjects.map(sub => {
            const done = study[sub.id] || {};
            const dn = Object.values(done).filter(Boolean).length;
            const tot = sub.acts.length;
            const pct = Math.round(dn / tot * 100);
            return `<div class="study-card" style="--cc:${sub.color}" data-subject="${sub.id}">
              <div class="sc-head">
                <div class="sc-emoji">${sub.emoji}</div>
                <div><div class="sc-name">${sub.name}</div><div class="sc-desc">${sub.desc}</div></div>
              </div>
              <div class="sc-progress">
                <div class="sc-bar"><span style="width:${pct}%"></span></div>
                <div class="sc-pct">${dn}/${tot} 已练</div>
              </div>
              <div class="sc-chips">
                ${sub.acts.map(a => `<span class="act-chip ${done[a.id] ? 'done' : ''}">${done[a.id] ? '✅' : a.emoji} ${a.name}</span>`).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ============ 3. 习惯打卡 ============
  function viewHabits() {
    const s = st();
    const today = todayKey();
    const done = s.habits?.[today] || {};
    const habits = D().DEFAULT_HABITS;
    const cats = [...new Set(habits.map(h => h.category))];

    // 最近 7 天各习惯完成率
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      const dd = s.habits?.[k] || {};
      last7.push({ k, label: `${d.getMonth()+1}/${d.getDate()}`, n: Object.values(dd).filter(Boolean).length });
    }
    const maxN = Math.max(1, ...last7.map(x => x.n));

    return `
      <div class="view-head">
        <div>
          <div class="view-title">✅ 习惯打卡</div>
          <div class="view-sub">好习惯受益一生 · 21 天养成一个习惯</div>
        </div>
      </div>

      <div class="grid-4">
        ${statCard('✅', Object.values(done).filter(Boolean).length + '/' + habits.length, '今日完成', 'linear-gradient(135deg,#B5EAD7,#6BC9A8)', '#2D7A55')}
        ${statCard('🔥', s.streaks?.bestDays || 0, '最佳连续', 'linear-gradient(135deg,#FFB6D9,#FF7AB6)', '#C75A92')}
        ${statCard('📅', s.streaks?.currentDays || 0, '当前连续', 'linear-gradient(135deg,#A5D8FF,#5BA8E5)', '#1B4F7A')}
        ${statCard('⭐', s.stars?.total || 0, '累计星星', 'linear-gradient(135deg,#FFE066,#FFB570)', '#B25500')}
      </div>

      <div class="card">
        <div class="card-title">📈 近 7 天习惯完成数</div>
        <div class="bar-chart">
          ${last7.map(x => `<div class="bar-col">
            <div class="bar-val">${x.n}</div>
            <div class="bar-fill" style="height:${(x.n / maxN * 100)}%"></div>
            <div class="bar-lab">${x.label}</div>
          </div>`).join('')}
        </div>
      </div>

      ${cats.map(cat => `
        <div class="card">
          <div class="card-title">${cat === '生活' ? '🏠' : cat === '卫生' ? '🧼' : cat === '礼貌' ? '🙋' : cat === '学习' ? '📚' : cat === '健康' ? '💪' : '👨‍👩‍👧'} ${cat}习惯</div>
          ${habits.filter(h => h.category === cat).map(h => `
            <div class="habit-row ${done[h.id] ? 'checked' : ''}" data-habit="${h.id}">
              <span class="habit-emoji">${h.emoji}</span>
              <span class="habit-text">${h.text}</span>
              <span class="habit-cat">${h.category}</span>
              <span class="habit-check">${done[h.id] ? '✓' : ''}</span>
            </div>
          `).join('')}
        </div>
      `).join('')}

      <div class="card">
        <div class="card-title">🎯 学校打卡（在校表现）</div>
        <div class="checkin-grid">
          ${window.CheckinItems.map(it => {
            const dn = !!(s.checkins?.[today]?.[it.id]);
            return `<div class="checkin-item ${dn ? 'done' : ''}" data-checkin="${it.id}">
              <div class="ci-emoji">${dn ? '✅' : it.emoji}</div>
              <div class="ci-name">${it.name}</div>
              <div class="ci-status">${dn ? '已完成' : it.desc}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ============ 4. 心情日记 ============
  function viewMood() {
    const s = st();
    const today = todayKey();
    const cur = s.mood?.[today];
    const moods = D().MOODS;

    // 最近 7 天心情
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      last7.push({ k, label: `${d.getMonth()+1}/${d.getDate()}`, m: s.mood?.[k] });
    }

    // 历史记录
    const history = Object.entries(s.mood || {}).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);

    return `
      <div class="view-head">
        <div>
          <div class="view-title">😊 心情日记</div>
          <div class="view-sub">记录每天的小情绪 · 说说心里话</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">今天心情如何？</div>
        <div class="mood-picker">
          ${moods.map(m => `<button class="mood-btn ${cur && cur.emoji === m.emoji ? 'active' : ''}" data-mood="${m.emoji}" data-label="${m.label}" data-score="${m.score}">
            <span class="mood-emoji">${m.emoji}</span><span class="mood-label">${m.label}</span>
          </button>`).join('')}
        </div>
        <div class="input-row">
          <input type="text" id="moodNote" placeholder="今天发生了什么？写一句话…" maxlength="60" value="${cur?.note ? esc(cur.note) : ''}" />
          <button id="saveMood">保存心情</button>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">📈 近 7 天心情</div>
          <div class="mood-chart">
            ${last7.map(x => {
              const sc = x.m ? x.m.score : 0;
              const m = moods.find(mm => mm.score === sc) || { color: '#E0E8F0' };
              return `<div class="mood-bar-col">
                <div class="bar-val">${x.m ? x.m.emoji : '-'}</div>
                <div class="mood-bar" style="height:${sc * 18}px;background:${m.color}"></div>
                <div class="mood-bar-label">${x.label}</div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-title">📔 心情记录 <span class="t-sub">（最近 ${history.length} 天）</span></div>
          ${history.length ? history.map(([k, m]) => `<div class="mood-item">
            <span class="mood-item-emoji">${m.emoji}</span>
            <div class="mood-item-body">
              <div class="mood-item-date">${k} · ${m.label}</div>
              <div class="mood-item-note">${m.note ? esc(m.note) : '（没有留言）'}</div>
            </div>
          </div>`).join('') : '<div class="empty"><span class="empty-emoji">📝</span>还没有心情记录</div>'}
        </div>
      </div>
    `;
  }

  // ============ 5. 运动健康 ============
  function viewHealth() {
    const s = st();
    const today = todayKey();
    const ex = s.exercise?.[today] || {};
    const h = s.health?.[today] || {};
    const sports = D().SPORTS;
    const cal = D().SZ_CALENDAR;

    // 运动统计
    const days = Object.keys(s.exercise || {});
    const totalMin = days.reduce((n, k) => n + Object.values(s.exercise[k] || {}).reduce((a, b) => a + (b.minutes || 0), 0), 0);

    // 睡眠计算
    let sleepHours = 0;
    if (h.sleepStart && h.sleepEnd) {
      const [sh, sm] = h.sleepStart.split(':').map(Number);
      const [eh, em] = h.sleepEnd.split(':').map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60;
      sleepHours = (mins / 60).toFixed(1);
    }
    const sleepOk = sleepHours >= cal.sleepTarget;

    return `
      <div class="view-head">
        <div>
          <div class="view-title">🏃 运动健康</div>
          <div class="view-sub">深圳要求：每天睡足 ${cal.sleepTarget} 小时 · ${cal.bedtime} 前就寝</div>
        </div>
      </div>

      ${sleepHours > 0 ? (sleepOk
        ? `<div class="alert alert-good"><span class="alert-emoji">😴</span><div>昨晚睡眠 <b>${sleepHours}</b> 小时，达标啦！继续保持～</div></div>`
        : `<div class="alert alert-warn"><span class="alert-emoji">😴</span><div>昨晚只睡了 <b>${sleepHours}</b> 小时，距离 ${cal.sleepTarget} 小时还差 ${(cal.sleepTarget - sleepHours).toFixed(1)} 小时，今晚早点睡哦～</div></div>`
      ) : ''}

      <div class="grid-4">
        ${statCard('🏃', Object.values(ex).filter(Boolean).length, '今日运动项', 'linear-gradient(135deg,#A5D8FF,#5BA8E5)', '#1B4F7A')}
        ${statCard('⏱️', totalMin, '累计运动(分)', 'linear-gradient(135deg,#B5EAD7,#6BC9A8)', '#2D7A55')}
        ${statCard('😴', sleepHours || '--', '昨晚睡眠(时)', 'linear-gradient(135deg,#C9B6FF,#9B7BE5)', '#5B3DA8')}
        ${statCard('📏', h.height ? h.height + 'cm' : '--', '身高', 'linear-gradient(135deg,#FFE066,#FFB570)', '#B25500')}
      </div>

      <div class="card">
        <div class="card-title">🏅 今日运动打卡 <span class="t-sub">（点击记录）</span></div>
        <div class="sport-grid">
          ${sports.map(sp => `<div class="sport-card ${ex[sp.id] ? 'done' : ''}" data-sport="${sp.id}">
            <div class="sp-emoji">${sp.emoji}</div>
            <div class="sp-name">${sp.name}</div>
            <div class="sp-target">目标 ${sp.target}${sp.unit}</div>
            ${ex[sp.id] ? `<div class="sp-done-tag">✅ ${ex[sp.id].value || ''}${sp.unit}</div>` : ''}
          </div>`).join('')}
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">😴 睡眠记录</div>
          <div class="input-row" style="margin-bottom:10px">
            <input type="time" id="sleepStart" value="${h.sleepStart || ''}" />
            <input type="time" id="sleepEnd" value="${h.sleepEnd || ''}" />
          </div>
          <div class="input-row">
            <button class="btn-sm btn-green" id="saveSleep">保存睡眠</button>
          </div>
          <div class="view-sub" style="margin-top:10px">目标：${cal.bedtime} 前入睡，睡足 ${cal.sleepTarget} 小时</div>
        </div>

        <div class="card">
          <div class="card-title">📏 身高体重</div>
          <div class="input-row" style="margin-bottom:10px">
            <input type="number" id="heightIn" placeholder="身高 (cm)" value="${h.height || ''}" />
            <input type="number" id="weightIn" placeholder="体重 (kg)" value="${h.weight || ''}" />
          </div>
          <div class="input-row">
            <button class="btn-sm btn-pink" id="saveBody">保存数据</button>
          </div>
          <div class="view-sub" style="margin-top:10px">定期记录，观察成长曲线 📈</div>
        </div>
      </div>
    `;
  }

  // ============ 6. 阅读记录 ============
  function viewReading() {
    const s = st();
    const list = s.reading || [];
    const today = todayKey();
    const todayBooks = list.filter(r => r.date === today);
    const todayMin = todayBooks.reduce((n, r) => n + (r.minutes || 0), 0);
    const totalMin = list.reduce((n, r) => n + (r.minutes || 0), 0);
    const totalPages = list.reduce((n, r) => n + (r.pages || 0), 0);
    const goal = D().LEARNING_GOALS.readMinutes;

    // 近 7 天阅读
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      const m = list.filter(r => r.date === k).reduce((a, r) => a + (r.minutes || 0), 0);
      last7.push({ label: `${d.getMonth()+1}/${d.getDate()}`, m });
    }
    const maxM = Math.max(goal, ...last7.map(x => x.m));

    return `
      <div class="view-head">
        <div>
          <div class="view-title">📖 阅读记录</div>
          <div class="view-sub">每天 ${goal} 分钟亲子共读 · 书香伴成长</div>
        </div>
      </div>

      <div class="grid-4">
        ${statCard('📖', todayMin + '分', '今日阅读', 'linear-gradient(135deg,#FFB6D9,#FF7AB6)', '#C75A92')}
        ${statCard('📚', list.length, '阅读次数', 'linear-gradient(135deg,#A5D8FF,#5BA8E5)', '#1B4F7A')}
        ${statCard('📄', totalPages, '累计页数', 'linear-gradient(135deg,#B5EAD7,#6BC9A8)', '#2D7A55')}
        ${statCard('⏱️', totalMin, '累计分钟', 'linear-gradient(135deg,#FFE066,#FFB570)', '#B25500')}
      </div>

      <div class="card">
        <div class="card-title">📈 近 7 天阅读时长 <span class="t-sub">（目标 ${goal} 分钟/天）</span></div>
        <div class="bar-chart">
          ${last7.map(x => `<div class="bar-col">
            <div class="bar-val">${x.m}</div>
            <div class="bar-fill" style="height:${(x.m / maxM * 100)}%;background:${x.m >= goal ? 'linear-gradient(180deg,#B5EAD7,#6BC9A8)' : 'linear-gradient(180deg,#A5D8FF,#5BA8E5)'}"></div>
            <div class="bar-lab">${x.label}</div>
          </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">➕ 添加阅读记录</div>
        <div class="input-row" style="margin-bottom:10px">
          <input type="text" id="readBook" placeholder="书名，如《小猪唏哩呼噜》" maxlength="30" />
        </div>
        <div class="input-row" style="margin-bottom:10px">
          <input type="number" id="readMinutes" placeholder="阅读分钟" value="20" min="1" max="180" />
          <input type="number" id="readPages" placeholder="页数" min="1" max="500" />
        </div>
        <div class="input-row">
          <button class="btn-sm btn-green" id="addRead">添加记录</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📚 阅读历史 <span class="t-sub">（${list.length} 条）</span></div>
        ${list.length ? list.slice(0, 20).map((r, i) => `<div class="read-item">
          <span class="read-icon">📖</span>
          <div class="read-body">
            <div class="read-book">${esc(r.book)}</div>
            <div class="read-meta">${r.date} · ${r.minutes} 分钟${r.pages ? ' · ' + r.pages + ' 页' : ''}</div>
          </div>
          <button class="read-del" data-read-del="${i}">×</button>
        </div>`).join('') : '<div class="empty"><span class="empty-emoji">📖</span>还没有阅读记录，读一本吧～</div>'}
      </div>
    `;
  }

  // ============ 7. 目标奖励 ============
  function viewGoals() {
    const s = st();
    const stars = s.stars?.total || 0;
    const rewards = s.rewards?.length ? s.rewards : D().REWARD_TEMPLATES;
    const badges = D().BADGES;
    const ziDone = Object.keys(s.ziMastered || {}).length;
    const LG = D().LEARNING_GOALS;

    // 学习目标
    const goals = [
      { id: 'g_zi', emoji: '📝', title: '识字目标', cur: ziDone, target: LG.ziGrade1, unit: '字', color: '#FFB6D9' },
      { id: 'g_read', emoji: '📖', title: '阅读打卡', cur: (s.reading || []).length, target: 30, unit: '次', color: '#A5D8FF' },
      { id: 'g_sport', emoji: '🏃', title: '运动打卡', cur: Object.keys(s.exercise || {}).length, target: 30, unit: '天', color: '#B5EAD7' },
      { id: 'g_poem', emoji: '📜', title: '古诗背诵', cur: Object.keys(s.poems || {}).length, target: 6, unit: '首', color: '#FFE066' },
      { id: 'g_star', emoji: '⭐', title: '星星收集', cur: stars, target: 200, unit: '颗', color: '#C9B6FF' },
    ];

    return `
      <div class="view-head">
        <div>
          <div class="view-title">🎯 目标奖励</div>
          <div class="view-sub">星星银行 · 奖励商城 · 成就徽章</div>
        </div>
      </div>

      <div class="card" style="background:linear-gradient(135deg,#FFE066,#FFB570)">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:13px;font-weight:700;opacity:.85">⭐ 星星银行</div>
            <div style="font-size:40px;font-weight:900;color:#fff">${stars}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;opacity:.85">今日获得</div>
            <div style="font-size:24px;font-weight:800;color:#fff">+${(s.stars?.today?.date === todayKey() ? s.stars.today.count : 0)}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🎯 学习目标进度</div>
        ${goals.map(g => {
          const pct = Math.min(100, Math.round(g.cur / g.target * 100));
          return `<div class="goal-card" style="border-left-color:${g.color}">
            <div class="goal-head">
              <span class="goal-emoji">${g.emoji}</span>
              <span class="goal-title">${g.title}</span>
              <span class="goal-progress">${g.cur}/${g.target} ${g.unit}</span>
            </div>
            <div class="goal-bar"><span style="width:${pct}%;background:${g.color}"></span></div>
            <div class="view-sub">${pct === 100 ? '🎉 已完成目标！' : `还差 ${g.target - g.cur} ${g.unit}，加油！`}</div>
          </div>`;
        }).join('')}
      </div>

      <div class="card">
        <div class="card-title">🎁 奖励商城 <span class="t-sub">（用星星兑换）</span></div>
        <div class="reward-grid">
          ${rewards.map(r => {
            const ok = stars >= r.cost;
            return `<div class="reward-card ${ok ? '' : 'locked'}" data-reward="${r.id}">
              <div class="reward-emoji">${r.emoji}</div>
              <div class="reward-name">${r.name}</div>
              <div class="reward-cost">⭐ ${r.cost}</div>
              ${ok ? '<div class="view-sub" style="color:var(--green-deep);font-weight:700">点击兑换</div>' : '<div class="view-sub">还差 ' + (r.cost - stars) + ' ⭐</div>'}
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">🏆 成就徽章 <span class="t-sub">（${badges.filter(b => safeCheck(b, s)).length}/${badges.length}）</span></div>
        <div class="badge-grid">
          ${badges.map(b => `<div class="badge-card ${safeCheck(b, s) ? 'earned' : ''}">
            <div class="badge-emoji">${b.emoji}</div>
            <div class="badge-name">${b.name}</div>
            <div class="badge-desc">${b.desc}</div>
          </div>`).join('')}
        </div>
      </div>
    `;
  }

  function safeCheck(badge, data) {
    try { return badge.check(data); } catch (e) { return false; }
  }

  // ============ 8. 家长中心 ============
  function viewParent() {
    const s = st();
    const today = todayKey();
    const cal = D().SZ_CALENDAR;
    const tips = D().PARENT_TIPS;

    const doneCheckin = Object.values(s.checkins?.[today] || {}).filter(Boolean).length;
    const doneHabit = Object.values(s.habits?.[today] || {}).filter(Boolean).length;
    const mood = s.mood?.[today];
    const readMin = (s.reading || []).filter(r => r.date === today).reduce((n, r) => n + r.minutes, 0);
    const sportN = Object.keys(s.exercise?.[today] || {}).length;

    // 学期倒计时
    const now = new Date();
    const sem = now.getMonth() >= 8 || now.getMonth() <= 0 ? cal.semesters[0] : cal.semesters[1];
    const endD = new Date(sem.end);
    const daysLeft = Math.max(0, Math.ceil((endD - now) / 86400000));

    return `
      <div class="view-head">
        <div>
          <div class="view-title">👨‍👩‍👧 家长中心</div>
          <div class="view-sub">今日学习报告 · 教育建议 · 深圳政策</div>
        </div>
      </div>

      <div class="grid-4">
        ${statCard('✅', `${doneCheckin}/6`, '在校打卡', 'linear-gradient(135deg,#A5D8FF,#5BA8E5)', '#1B4F7A')}
        ${statCard('🌱', `${doneHabit}/14`, '习惯完成', 'linear-gradient(135deg,#B5EAD7,#6BC9A8)', '#2D7A55')}
        ${statCard('📚', todayStudyCount(), '学习练习', 'linear-gradient(135deg,#FFB6D9,#FF7AB6)', '#C75A92')}
        ${statCard('😊', mood ? mood.emoji : '--', '今日心情', 'linear-gradient(135deg,#FFE066,#FFB570)', '#B25500')}
      </div>

      <div class="card">
        <div class="card-title">📋 今日学习报告</div>
        <div class="report-row"><span>在校打卡</span><span class="report-val">${doneCheckin}/6 项</span></div>
        <div class="report-row"><span>习惯养成</span><span class="report-val">${doneHabit}/14 项</span></div>
        <div class="report-row"><span>学科练习</span><span class="report-val">${todayStudyCount()} 次</span></div>
        <div class="report-row"><span>课外阅读</span><span class="report-val">${readMin} 分钟</span></div>
        <div class="report-row"><span>运动锻炼</span><span class="report-val">${sportN} 项</span></div>
        <div class="report-row"><span>获得星星</span><span class="report-val">+${s.stars?.today?.date === today ? s.stars.today.count : 0} ⭐</span></div>
        <div class="report-row"><span>连续打卡</span><span class="report-val">${s.streaks?.currentDays || 0} 天</span></div>
      </div>

      <div class="card">
        <div class="card-title">📅 深圳校历 · 2025-2026</div>
        <div class="report-row"><span>当前学期</span><span class="report-val">${sem.name}</span></div>
        <div class="report-row"><span>学期结束</span><span class="report-val">${sem.end}</span></div>
        <div class="report-row"><span>剩余天数</span><span class="report-val">${daysLeft} 天</span></div>
        <div class="report-row"><span>全学年教学周</span><span class="report-val">${cal.totalWeeks} 周</span></div>
        <div class="report-row"><span>新授课 / 复习</span><span class="report-val">${cal.newLessonWeeks} / ${cal.reviewWeeks} 周</span></div>
      </div>

      <div class="card">
        <div class="card-title">💡 教育建议 <span class="t-sub">（基于双减 + 深圳政策）</span></div>
        ${tips.map(t => `<div class="tip-card">
          <span class="tip-emoji">${t.emoji}</span>
          <div><div class="tip-title">${t.title}</div><div class="tip-text">${t.text}</div></div>
        </div>`).join('')}
      </div>

      <div class="card">
        <div class="card-title">⚙️ 数据管理</div>
        <div class="input-row" style="flex-wrap:wrap;gap:10px">
          <button class="btn-sm btn-pink" id="exportData">导出数据</button>
          <button class="btn-sm btn-green" id="importData">导入数据</button>
          <button class="btn-sm btn-gray" id="resetToday">重置今日</button>
          <input type="file" id="importDataFile" accept="application/json,.json" style="display:none" />
        </div>
        <div class="view-sub" style="margin-top:10px">换电脑/换设备：先在旧设备「导出数据」保存 JSON，再到新设备「导入数据」选择该文件即可恢复全部记录。数据保存在本机浏览器，可通过「设备同步」在多设备间同步。</div>
      </div>
    `;
  }

  // ============ 9. 数据看板 ============
  function viewStats() {
    const s = st();

    // 近 7 天星星
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      const stars = s.starLog?.[k] || 0;
      last7.push({ label: `${d.getMonth()+1}/${d.getDate()}`, v: stars });
    }
    const maxV = Math.max(5, ...last7.map(x => x.v));

    // 学科分布
    const studyAll = s.study || {};
    const dist = {};
    Object.values(studyAll).forEach(day => {
      Object.entries(day).forEach(([k, v]) => {
        dist[k] = (dist[k] || 0) + Object.values(v || {}).filter(Boolean).length;
      });
    });
    const names = { yuwen: '语文', shuxue: '数学', yingyu: '英语', daode: '道法', kexue: '科学' };
    const colors = { yuwen: '#FFB6D9', shuxue: '#A5D8FF', yingyu: '#FFE066', daode: '#B5EAD7', kexue: '#C9B6FF' };
    const distTotal = Object.values(dist).reduce((a, b) => a + b, 0) || 1;

    // 完成率
    const last7Habit = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      const dd = s.habits?.[k] || {};
      last7Habit.push(Object.values(dd).filter(Boolean).length / 14 * 100);
    }
    const avgHabit = Math.round(last7Habit.reduce((a, b) => a + b, 0) / 7);

    // 甜甜圈
    let offset = 0;
    const R = 60, C = 2 * Math.PI * R;
    const segs = Object.entries(dist).map(([k, v]) => {
      const len = v / distTotal * C;
      const seg = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${colors[k]}" stroke-width="26"
        stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" />`;
      offset += len;
      return seg;
    }).join('');

    return `
      <div class="view-head">
        <div>
          <div class="view-title">📊 数据看板</div>
          <div class="view-sub">学习数据可视化 · 见证每一点进步</div>
        </div>
      </div>

      <div class="grid-4">
        ${statCard('⭐', s.stars?.total || 0, '累计星星', 'linear-gradient(135deg,#FFE066,#FFB570)', '#B25500')}
        ${statCard('🔥', s.streaks?.bestDays || 0, '最佳连续', 'linear-gradient(135deg,#FFB6D9,#FF7AB6)', '#C75A92')}
        ${statCard('📈', avgHabit + '%', '7日习惯率', 'linear-gradient(135deg,#B5EAD7,#6BC9A8)', '#2D7A55')}
        ${statCard('📚', Object.values(studyAll).length, '学习天数', 'linear-gradient(135deg,#A5D8FF,#5BA8E5)', '#1B4F7A')}
      </div>

      <div class="card">
        <div class="card-title">⭐ 近 7 天星星获取</div>
        <div class="bar-chart">
          ${last7.map(x => `<div class="bar-col">
            <div class="bar-val">${x.v}</div>
            <div class="bar-fill" style="height:${(x.v / maxV * 100)}%"></div>
            <div class="bar-lab">${x.label}</div>
          </div>`).join('')}
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">📚 学科练习分布</div>
          <div class="donut-wrap">
            <svg width="140" height="140" viewBox="0 0 140 140" style="transform:rotate(-90deg)">
              <circle cx="70" cy="70" r="${R}" fill="none" stroke="#F0F0F0" stroke-width="26"></circle>
              ${segs}
            </svg>
            <div class="donut-legend">
              ${Object.entries(dist).map(([k, v]) => `<div class="legend-item">
                <span class="legend-dot" style="background:${colors[k]}"></span>
                <span>${names[k] || k}</span><b style="margin-left:auto">${v}</b>
              </div>`).join('')}
              ${!distTotal ? '<div class="view-sub">暂无数据</div>' : ''}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">📈 习惯完成趋势</div>
          <div class="bar-chart">
            ${last7Habit.map((v, i) => {
              const d = new Date(); d.setDate(d.getDate() - (6 - i));
              return `<div class="bar-col">
                <div class="bar-val">${Math.round(v)}%</div>
                <div class="bar-fill" style="height:${v}%;background:linear-gradient(180deg,#B5EAD7,#6BC9A8)"></div>
                <div class="bar-lab">${d.getMonth()+1}/${d.getDate()}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📖 阅读 & 运动总览</div>
        <div class="grid-3">
          ${statCard('📖', (s.reading || []).length, '阅读次数', 'linear-gradient(135deg,#FFB6D9,#FF7AB6)', '#C75A92')}
          ${statCard('📄', (s.reading || []).reduce((n, r) => n + (r.pages || 0), 0), '阅读页数', 'linear-gradient(135deg,#A5D8FF,#5BA8E5)', '#1B4F7A')}
          ${statCard('🏃', Object.keys(s.exercise || {}).length, '运动天数', 'linear-gradient(135deg,#B5EAD7,#6BC9A8)', '#2D7A55')}
        </div>
      </div>
    `;
  }

  // ============ 10. 设备同步 ============
  function viewSync() {
    const s = st();
    return `
      <div class="view-head">
        <div>
          <div class="view-title">📱 设备同步</div>
          <div class="view-sub">手机 / 平板 / 电脑 · 一个房间号，全设备同步</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">☁️ 数据同步 <span class="t-sub">（多设备共用一份数据）</span></div>
        <div class="cloud-status" id="cloudStatus">
          <span class="cs-dot"></span>
          <span class="cs-text" id="cloudStatusText">检查中…</span>
          <button class="btn-sm btn-green" id="syncNowBtn" style="margin-left:auto">强制推送本地</button>
        </div>
        <div class="view-sub" id="cloudLastSync" style="margin-top:6px"></div>
        <div class="alert alert-info" style="margin-top:10px"><span class="alert-emoji">💡</span><div>
          <b>新行为</b>：本地编辑后<b>不会自动同步</b>，请点右上角 <b>💾 保存</b> 按钮（或 <kbd>Ctrl+S</kbd>）。<br/>
          其他设备有新数据时，会在右上角弹出横幅让你选择「<b>同步覆盖</b> / <b>保留本地</b>」。</div></div>
      </div>

      <div class="card">
        <div class="card-title">⚙️ 云端配置 <span class="t-sub">（GitHub 仓库）</span></div>
        <input type="hidden" id="cloudProvider" value="github">
        <div id="cloudFields"></div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="btn-sm btn-green" id="saveCloudBtn">💾 保存并连接</button>
          <button class="btn-sm btn-yellow" id="testCloudBtn">🔍 测试连接</button>
          <button class="btn-sm btn-gray" id="clearCloudBtn">断开云端</button>
        </div>
        <div id="cloudTestResult" style="margin-top:10px"></div>
        <div id="cloudGuide" style="margin-top:12px"></div>
      </div>

      <div class="card">
        <div class="card-title">🔗 我的房间</div>
        <div class="sync-card">
          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="sync-id-line">
              <span class="sync-label" style="font-size:13px;color:var(--text-light)">房间号</span>
              <span class="sync-id" id="syncRoomId">${s.roomId}</span>
              <button class="btn-sm btn-pink" id="copyRoomBtn">复制</button>
            </div>
            <p class="sync-tip">在手机 / 平板打开本工作台，输入相同房间号即可同步打卡、任务、学习进度和星星。</p>
            <div class="input-row">
              <input type="text" id="joinRoomInput" placeholder="输入房间号加入…" maxlength="8" style="text-transform:uppercase;letter-spacing:2px" />
              <button class="btn-sm btn-green" id="joinRoomBtn">加入</button>
            </div>
            <div class="sync-status" id="syncStatus">本设备就绪 · 房间 ${s.roomId}</div>

            <div style="background:white;border-radius:12px;padding:10px 12px;margin-top:2px">
              <div style="font-size:12px;color:var(--text-light);margin-bottom:4px">手机访问地址</div>
              <div id="mobileUrlText" style="font-size:13px;font-weight:700;color:var(--pink-deep);word-break:break-all">获取中…</div>
              <button class="btn-sm btn-gray" id="copyUrlBtn" style="margin-top:6px">复制地址</button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
            <div class="qr-box" id="qrBox"></div>
            <p style="font-size:12px;color:var(--text-light)">扫码在手机/平板端打开</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">💡 同步说明</div>
        <div class="tip-card"><span class="tip-emoji">💾</span><div>
          <div class="tip-title">保存后才推送</div>
          <div class="tip-text">本地编辑不会自动上传，点右上角 <b>💾 保存</b>（或 <kbd>Ctrl+S</kbd>）后才推送到云端。</div>
        </div></div>
        <div class="tip-card"><span class="tip-emoji">📥</span><div>
          <div class="tip-title">其他设备有更新 → 询问后同步</div>
          <div class="tip-text">检测到云端新数据时右上角弹横幅，由你选择「同步覆盖」或「保留本地」，不会被静默覆盖。</div>
        </div></div>
        <div class="tip-card"><span class="tip-emoji">📱</span><div>
          <div class="tip-title">跨设备</div>
          <div class="tip-text">各设备打开同一网址、输入<b>相同房间号</b>即在同一工作空间；扫码打开会自动带入房间号。资料文件（📎/📚）随保存一起同步。</div>
        </div></div>
        <div class="tip-card"><span class="tip-emoji">🔒</span><div>
          <div class="tip-title">数据隐私</div>
          <div class="tip-text">数据经你自己的 GitHub <b>私有仓库</b> 同步，不经过任何第三方服务器；Token 只保存在本机浏览器，不会随网页分发。</div>
        </div></div>
      </div>
    `;
  }

  // ============ 11. 绘本馆 ============
  function viewBooks() {
    const s = st();
    const books = D().PICTURE_BOOKS;
    const themes = D().BOOK_THEMES;
    const marks = s.books || {};   // { bookId: 'want'|'reading'|'done' }
    const curTheme = window._bookTheme || '全部';

    const list = curTheme === '全部' ? books : books.filter(b => b.theme === curTheme);

    const stat = { want: 0, reading: 0, done: 0 };
    Object.values(marks).forEach(v => { if (stat[v] != null) stat[v]++; });

    const MARK_LABEL = { want: '想读 📌', reading: '在读 📖', done: '已读 ✅' };

    return `
      <div class="view-head">
        <div>
          <div class="view-title">📚 绘本馆</div>
          <div class="view-sub">${books.length} 本精选绘本 · 含一年级「快乐读书吧」必读书目</div>
        </div>
      </div>

      <div class="grid-4">
        ${statCard('📌', stat.want, '想读', 'linear-gradient(135deg,#FFB6D9,#FF7AB6)', '#C75A92')}
        ${statCard('📖', stat.reading, '在读', 'linear-gradient(135deg,#A5D8FF,#5BA8E5)', '#1B4F7A')}
        ${statCard('✅', stat.done, '已读', 'linear-gradient(135deg,#B5EAD7,#6BC9A8)', '#2D7A55')}
        ${statCard('🌟', books.length - stat.done, '待探索', 'linear-gradient(135deg,#FFE066,#FFB570)', '#B25500')}
      </div>

      <div class="card">
        <div class="card-title">🏷️ 按主题筛选</div>
        <div class="day-tabs" style="margin-bottom:14px">
          ${themes.map(t => `<button class="day-tab ${t === curTheme ? 'active' : ''}" data-btheme="${esc(t)}">${esc(t)}</button>`).join('')}
        </div>

        <div class="book-grid">
          ${list.map(b => {
            const m = marks[b.id];
            return `<div class="book-card ${m ? 'marked-' + m : ''}" data-book="${b.id}">
              <div class="book-cover">${b.emoji}</div>
              <div class="book-title">${esc(b.title)}</div>
              <div class="book-author">${esc(b.author)}</div>
              <div class="book-tags">
                <span class="book-tag">${esc(b.theme)}</span>
                <span class="book-tag age">${esc(b.age)}岁</span>
              </div>
              ${m ? `<div class="book-mark">${MARK_LABEL[m]}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
        ${!list.length ? '<div class="empty"><span class="empty-emoji">📚</span>该主题暂无绘本</div>' : ''}
      </div>

      <div class="card">
        <div class="card-title">💡 亲子共读小贴士</div>
        <div class="tip-card"><span class="tip-emoji">🗣️</span><div>
          <div class="tip-title">读前先"猜"</div>
          <div class="tip-text">看封面问孩子："你觉得这本书讲什么？" 激发预测和想象。</div>
        </div></div>
        <div class="tip-card"><span class="tip-emoji">👂</span><div>
          <div class="tip-title">读出声、加动作</div>
          <div class="tip-text">一年级孩子适合大声朗读，配合表情和动作，孩子更投入。</div>
        </div></div>
        <div class="tip-card"><span class="tip-emoji">❓</span><div>
          <div class="tip-title">读后聊一聊</div>
          <div class="tip-text">每本书都配了「共读指导」，点开卡片即可看到互动问题。</div>
        </div></div>
        <div class="tip-card"><span class="tip-emoji">🔁</span><div>
          <div class="tip-title">重复阅读有价值</div>
          <div class="tip-text">孩子要求反复读同一本，是深度理解的表现，不必急着换书。</div>
        </div></div>
      </div>
    `;
  }

  // 绘本详情弹窗
  function openBookDetail(bookId) {
    const b = D().PICTURE_BOOKS.find(x => x.id === bookId);
    if (!b) return;
    const d = st();
    const marks = d.books || {};
    const cur = marks[b.id] || '';

    window.openModal(`
      <div class="book-detail-head">
        <div class="bd-cover">${b.emoji}</div>
        <div class="bd-meta">
          <h2>${esc(b.title)}</h2>
          <div class="bd-author">${esc(b.author)}</div>
          <div class="bd-tags">
            <span class="book-tag">${esc(b.theme)}</span>
            <span class="book-tag age">适读 ${esc(b.age)} 岁</span>
          </div>
        </div>
      </div>
      <div class="book-detail-body">
        <div class="bd-section">
          <div class="bd-label">📖 内容简介</div>
          <div class="bd-text">${esc(b.desc)}</div>
        </div>
        <div class="bd-section">
          <div class="bd-label">💬 共读指导</div>
          <div class="bd-guide">${esc(b.guide)}</div>
        </div>
        <div class="bd-section">
          <div class="bd-label">🏷️ 标记为</div>
          <div class="bd-marks">
            ${['want', 'reading', 'done'].map(k => {
              const labels = { want: '📌 想读', reading: '📖 在读', done: '✅ 已读' };
              return `<button class="bd-mark-btn ${cur === k ? 'active' : ''}" data-mark="${k}">${labels[k]}</button>`;
            }).join('')}
            ${cur ? '<button class="bd-mark-btn" data-mark="">清除标记</button>' : ''}
          </div>
        </div>
      </div>
      <div class="act-foot">
        <button class="btn-sm btn-green" data-logread>📝 记一次阅读</button>
        <button class="btn-sm btn-gray" data-back>关闭</button>
      </div>
    `);

    const modal = document.querySelector('#modalLayer');
    modal.querySelector('[data-back]').addEventListener('click', () => window.closeModal());

    modal.querySelectorAll('[data-mark]').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.mark;
        if (!d.books) d.books = {};
        if (k) d.books[b.id] = k;
        else delete d.books[b.id];
        window.SyncAPI.saveData(d);
        window.appShowToast(k ? '已标记为' + ({ want: '想读', reading: '在读', done: '已读' }[k]) : '已清除标记');
        if (k === 'done') window.appConfetti();
        window.appRender();
        window.closeModal();
      });
    });

    // 记一次阅读：写入阅读记录
    modal.querySelector('[data-logread]').addEventListener('click', () => {
      const mins = prompt('这次亲子共读了多少分钟？', '20');
      if (mins === null) return;
      const m = parseInt(mins, 10) || 0;
      if (!d.reading) d.reading = [];
      d.reading.unshift({ date: todayKey(), book: b.title, minutes: m, pages: 0 });
      if (!d.books) d.books = {};
      d.books[b.id] = 'done';
      window.SyncAPI.saveData(d);
      window.appAwardStars(2);
      window.appShowToast('已记录：《' + b.title + '》' + m + ' 分钟');
      window.appRender();
      window.closeModal();
    });
  }

  // 暴露
  window.Views = {
    dashboard: viewDashboard,
    study: viewStudy,
    habits: viewHabits,
    mood: viewMood,
    health: viewHealth,
    reading: viewReading,
    goals: viewGoals,
    parent: viewParent,
    stats: viewStats,
    books: viewBooks,
    sync: viewSync,
  };
  window.openBookDetail = openBookDetail;
})();
