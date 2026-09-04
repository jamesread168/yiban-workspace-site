/**
 * 课表编辑器
 *
 * 让老师/家长无需改代码即可为任意一周上传/修改临时课表：
 *  - 选择要编辑的周（默认本周）
 *  - 表格中 5 列 × 10 行，可逐格修改
 *  - 支持「复制默认课表」「清除该周覆盖」「保存为该周临时课表」
 *
 * 老师上传后，工作台自动应用：
 *  - 当前周使用临时课表时，dashboard 会显示「本周使用临时课表」提示
 *  - 切到临时课表覆盖的星期时，对应日的状态卡/明日预览都跟着变
 */
(function () {
  const toast = m => window.appShowToast(m);
  const confetti = () => window.appConfetti();
  const render = () => window.appRender();
  const esc = s => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

  // 预设课程库（emoji + subject）
  const COURSE_LIB = [
    { name: '语文', emoji: '📖', subject: '语文' },
    { name: '数学', emoji: '🔢', subject: '数学' },
    { name: '英语', emoji: '🔤', subject: '英语' },
    { name: '美术', emoji: '🎨', subject: '美术' },
    { name: '音乐', emoji: '🎵', subject: '音乐' },
    { name: '体育与健康', emoji: '⚽', subject: '体育' },
    { name: '劳动', emoji: '🧹', subject: '劳动' },
    { name: '书法', emoji: '✍️', subject: '书法' },
    { name: '综合实践', emoji: '🛠️', subject: '实践' },
    { name: '道德与法治', emoji: '⚖️', subject: '道德' },
    { name: '科学', emoji: '🔬', subject: '科学' },
    { name: '班队会/心理健康', emoji: '💗', subject: '班会' },
    { name: '开学第一课', emoji: '🎉', subject: '开学' },
    { name: '围棋', emoji: '♟️', subject: '围棋' },
    { name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
    { name: '眼保健操', emoji: '👀', isBreak: true },
    { name: '午餐午休', emoji: '🍱', isBreak: true },
  ];

  // 10 个时段（与默认课表保持一致）
  const SLOTS = [
    { period: '升旗/阳光体育', start: '08:00', end: '08:50' },
    { period: '第1节',         start: '08:55', end: '09:35' },
    { period: '第2节',         start: '09:45', end: '10:25' },
    { period: '眼保健操',     start: '10:25', end: '10:30' },
    { period: '第3节',         start: '10:40', end: '11:20' },
    { period: '第4节',         start: '11:30', end: '12:10' },
    { period: '午餐午休',     start: '12:10', end: '14:00' },
    { period: '第5节',         start: '14:10', end: '14:50' },
    { period: '眼保健操',     start: '14:50', end: '14:55' },
    { period: '第6节',         start: '15:05', end: '15:45' },
  ];

  // 工具
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(date) { return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()); }
  function parseYMD(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function getMonday(date) {
    const d = new Date(date);
    const dow = d.getDay() || 7; // 周日=0 转为 7
    d.setDate(d.getDate() - dow + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function pickEmoji(name) {
    if (!name) return '📚';
    const hit = COURSE_LIB.find(c => c.name === name || name.includes(c.name) || c.name.includes(name));
    return hit ? hit.emoji : '📚';
  }
  function pickSubject(name) {
    if (!name) return '';
    const hit = COURSE_LIB.find(c => c.name === name || name.includes(c.name) || c.name.includes(name));
    return hit ? (hit.subject || hit.name) : '';
  }
  function pickExtra(name) {
    const hit = COURSE_LIB.find(c => c.name === name);
    const ex = {};
    if (hit && hit.isBreak) ex.isBreak = true;
    if (hit && hit.isActivity) ex.isActivity = true;
    return ex;
  }

  // 加载指定周的数据（覆盖 → 默认）
  function loadWeek(mondayKey) {
    if (window.WeekOverrides && window.WeekOverrides[mondayKey]) {
      return { data: window.WeekOverrides[mondayKey], overridden: true };
    }
    return { data: window.DefaultSchedule, overridden: false };
  }

  // 打开编辑器
  function openScheduleEditor(initialDate, useDefault) {
    const monday = initialDate
      ? getMonday(parseYMD(initialDate))
      : getMonday(new Date());
    let mondayKey = ymd(monday);

    let initial = useDefault ? window.DefaultSchedule : (loadWeek(mondayKey).data);
    let overridden = !useDefault && loadWeek(mondayKey).overridden;

    const dayNames = ['', '一', '二', '三', '四', '五'];
    const datalistId = 'course-datalist-' + Date.now();
    const datalistOptions = COURSE_LIB.map(c => `<option value="${esc(c.name)}">`).join('');

    const buildRows = (data) => SLOTS.map((slot, slotIdx) => {
      const cells = [1, 2, 3, 4, 5].map(d => {
        const items = data[d] || [];
        const cur = items[slotIdx] || {};
        const isSpecial = slot.period === '眼保健操' || slot.period === '午餐午休' || slot.period === '升旗/阳光体育';
        return `<td>
          <input list="${datalistId}" data-slot="${slotIdx}" data-day="${d}"
            class="sched-cell" value="${esc(cur.name || '')}"
            placeholder="${isSpecial ? slot.period : '课程名'}"
            style="width:100%;border:1px solid #ddd;border-radius:6px;padding:5px 6px;font-size:12px;${isSpecial ? 'background:#FFF6E0' : 'background:#fff'}" />
        </td>`;
      }).join('');
      return `<tr>
        <td style="font-size:11px;color:#7A7A8C;white-space:nowrap;padding:5px 6px;background:#FAFAFA">
          <b style="color:#3A3A4E;font-size:12px">${slot.period}</b><br/>
          <span style="font-size:10px">${slot.start}–${slot.end}</span>
        </td>
        ${cells}
      </tr>`;
    }).join('');

    window.openModal(`
      <div style="padding:14px 16px;border-bottom:1px solid #eee;background:linear-gradient(135deg,#FFE066,#FFB570)">
        <div style="font-size:16px;font-weight:800;color:#5B3A00">📤 ${useDefault ? '查看默认课表' : '上传/编辑课表'}</div>
        <div style="font-size:12px;color:#6B4A00;margin-top:3px">为任意一周设置临时课表，缺勤、调课、研学都能灵活处理</div>
      </div>
      <div style="padding:14px 16px;max-height:60vh;overflow-y:auto">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
          <label style="font-size:13px;font-weight:600">哪一周（周一日期）：</label>
          <input type="date" id="editWeekInput" value="${mondayKey}"
            style="padding:6px 10px;border:1px solid #ddd;border-radius:8px;font-size:13px" />
          <span id="editWeekStatus" style="font-size:12px"></span>
          <button class="btn-sm btn-yellow" id="copyDefaultBtn">📋 复制默认</button>
          <button class="btn-sm btn-gray" id="clearWeekBtn">🗑 清除该周</button>
        </div>
        <div style="overflow-x:auto;border-radius:10px;border:1px solid #eee">
          <table style="width:100%;border-collapse:collapse;min-width:560px">
            <thead>
              <tr style="background:#F8F8F8">
                <th style="padding:6px 8px;text-align:left;font-size:12px;width:90px">节次</th>
                ${[1,2,3,4,5].map(d => `<th style="padding:6px;font-size:12px;width:auto">周${dayNames[d]}</th>`).join('')}
              </tr>
            </thead>
            <tbody id="schedTbody">${buildRows(initial)}</tbody>
          </table>
        </div>
        <datalist id="${datalistId}">${datalistOptions}</datalist>
        <div style="font-size:11px;color:#7A7A8C;margin-top:8px;line-height:1.6">
          💡 提示：输入框可直接打字，也可点右侧下拉选择预设课程（语文/数学/英语/美术/音乐/体育/劳动/书法/综合实践/道德与法治/科学/围棋 等）。<br/>
          留空表示该节不安排课程。
        </div>
      </div>
      <div class="act-foot">
        ${useDefault ? '' : '<button class="btn-sm btn-green" id="saveEditBtn">💾 保存为该周临时课表</button>'}
        <button class="btn-sm btn-gray" data-back>关闭</button>
      </div>
    `);

    const modal = document.querySelector('#modalLayer');
    const back = () => window.closeModal();
    modal.querySelector('[data-back]').addEventListener('click', back);

    const updateStatus = () => {
      const v = modal.querySelector('#editWeekInput').value;
      const mon = getMonday(parseYMD(v));
      const key = ymd(mon);
      const isOv = window.WeekOverrides && !!window.WeekOverrides[key];
      const st = modal.querySelector('#editWeekStatus');
      st.innerHTML = isOv
        ? `<span style="color:#C75A92;font-weight:700">⚠️ 本周已有临时课表覆盖</span>`
        : `<span style="color:#7A7A8C">该周无临时课表（key=${key}）</span>`;
    };
    updateStatus();

    const reloadForKey = (key) => {
      const wk = loadWeek(key);
      const tbody = modal.querySelector('#schedTbody');
      tbody.innerHTML = buildRows(wk.data);
      updateStatus();
    };

    modal.querySelector('#editWeekInput').addEventListener('change', () => {
      const v = modal.querySelector('#editWeekInput').value;
      const mon = getMonday(parseYMD(v));
      reloadForKey(ymd(mon));
    });

    const copyBtn = modal.querySelector('#copyDefaultBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        modal.querySelectorAll('.sched-cell').forEach(inp => {
          const d = +inp.dataset.day;
          const slotIdx = +inp.dataset.slot;
          const def = window.DefaultSchedule[d] || [];
          const cur = def[slotIdx] || {};
          inp.value = cur.name || '';
        });
        toast('已用默认课表填充');
      });
    }

    const clrBtn = modal.querySelector('#clearWeekBtn');
    if (clrBtn) {
      clrBtn.addEventListener('click', () => {
        const v = modal.querySelector('#editWeekInput').value;
        const mon = getMonday(parseYMD(v));
        const key = ymd(mon);
        if (!window.WeekOverrides[key]) { toast('该周没有临时课表'); return; }
        if (!confirm(`确定删除 ${key} 周的临时课表？\n该周将恢复为默认课表。`)) return;
        window.clearWeekOverride(mon);
        toast('已清除临时课表，恢复为默认');
        render();
        back();
      });
    }

    const saveBtn = modal.querySelector('#saveEditBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const v = modal.querySelector('#editWeekInput').value;
        const mon = getMonday(parseYMD(v));
        const key = ymd(mon);
        const newWeek = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        SLOTS.forEach((slot, slotIdx) => {
          [1, 2, 3, 4, 5].forEach(d => {
            const inp = modal.querySelector(`[data-slot="${slotIdx}"][data-day="${d}"]`);
            if (!inp) return;
            const name = inp.value.trim();
            if (!name) return;
            newWeek[d].push({
              period: slot.period,
              start: slot.start,
              end: slot.end,
              name,
              emoji: pickEmoji(name),
              subject: pickSubject(name),
              ...pickExtra(name),
            });
          });
        });
        window.saveWeekOverride(mon, newWeek);
        toast('已保存为 ' + key + ' 周临时课表 ✨');
        confetti();
        render();
        back();
      });
    }
  }

  // ============ 学期课表浏览（按周查询整学期课程） ============
  // 弹窗内可前后翻周、下拉跳周，一眼看到该周周一~周五全部课程；
  // 使用临时课表的周会标注 📌 并高亮与默认课表不同的课格。
  function openSemesterSchedule(weekNo) {
    const weeks = window.getSemesterWeeks();
    if (!weeks || !weeks.length) { toast('学期周历未加载'); return; }
    const curNo = window.getSemesterWeekNo(new Date());
    let no = (typeof weekNo === 'number' && weekNo >= 1 && weekNo <= weeks.length)
      ? weekNo : (curNo || 1);

    const dayNames = ['', '一', '二', '三', '四', '五'];
    const PERIOD_SLOTS = ['第1节', '第2节', '第3节', '第4节', '第5节', '第6节'];
    const PERIOD_TIMES = { '第1节': '8:55', '第2节': '9:45', '第3节': '10:40', '第4节': '11:30', '第5节': '14:10', '第6节': '15:05' };
    const shortName = x => (x && (x.subject || x.name)) || '';

    function build() {
      const w = weeks[no - 1];
      const monday = w.monday;
      const { schedule, overridden } = window.getWeekScheduleByMonday(monday);
      const todayYmd = window.ymd(new Date());

      // 与默认课表不同的课格集合：'day|period'
      const diffMap = new Set();
      if (overridden && window.getWeekOverrideDiff) {
        window.getWeekOverrideDiff(monday).forEach(x => diffMap.add(x.day + '|' + x.period));
      }
      const diffList = diffMap.size && window.getWeekOverrideDiff
        ? window.getWeekOverrideDiff(monday) : [];

      // 表头：周几 + 日期
      const headCells = [1, 2, 3, 4, 5].map(d => {
        const date = new Date(monday.getTime() + (d - 1) * 86400000);
        const isToday = window.ymd(date) === todayYmd;
        return `<th style="padding:6px 2px;font-size:12px;${isToday ? 'background:#FFD6E8;color:#C75A92;font-weight:800' : ''}">
          周${dayNames[d]}<br/><span style="font-size:10px;font-weight:400">${date.getMonth() + 1}.${date.getDate()}${isToday ? ' ·今天' : ''}</span>
        </th>`;
      }).join('');

      // 行 = 天，列 = 6 节正课（手机屏幕友好，课程用短名）
      const bodyRows = [1, 2, 3, 4, 5].map(d => {
        const items = schedule[d] || [];
        const byPeriod = new Map(items.map(x => [x.period, x]));
        const date = new Date(monday.getTime() + (d - 1) * 86400000);
        const isToday = window.ymd(date) === todayYmd;
        const cells = PERIOD_SLOTS.map(p => {
          const x = byPeriod.get(p);
          const changed = diffMap.has(d + '|' + p);
          if (!x) {
            return `<td style="border:1px solid #F0F0F4;padding:7px 2px;text-align:center;font-size:12px;color:#C5C5D0">—</td>`;
          }
          const bg = changed ? 'background:#FFF3C2' : (isToday ? 'background:#FFF0F6' : 'background:#fff');
          const star = changed ? ' <span style="color:#E08900" title="与默认课表不同">★</span>' : '';
          return `<td style="border:1px solid #F0F0F4;padding:7px 2px;text-align:center;font-size:12px;${bg}"
            title="${esc(x.name)}（${x.start}-${x.end}）">${esc(shortName(x))}${star}</td>`;
        }).join('');
        return `<tr>
          <td style="border:1px solid #F0F0F4;padding:6px;background:${isToday ? '#FFD6E8' : '#FAFAFA'};font-size:12px;font-weight:700;${isToday ? 'color:#C75A92' : 'color:#3A3A4E'}">
            周${dayNames[d]}<br/><span style="font-size:10px;font-weight:400">${date.getMonth() + 1}.${date.getDate()}</span>
          </td>
          ${cells}
        </tr>`;
      }).join('');

      const badge = (no === curNo) ? '<span style="background:#B5EAD7;color:#2D7A55;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:700">本周</span>' : '';
      const ovBadge = overridden ? '<span style="background:#FFE9A8;color:#8B6000;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:700">📌 临时课表</span>' : '';

      return `
        <div style="padding:14px 16px;border-bottom:1px solid #eee;background:linear-gradient(135deg,#A5D8FF,#B5EAD7)">
          <div style="font-size:16px;font-weight:800;color:#1B4F7A">🗓 学期课表 · ${esc(window.SEMESTER.name)}</div>
          <div style="font-size:12px;color:#2F5D74;margin-top:3px">翻看学期内任意一周的课程安排</div>
        </div>
        <div style="padding:12px 14px;max-height:62vh;overflow-y:auto">
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
            <button class="btn-sm btn-gray" id="semPrev" ${no <= 1 ? 'disabled' : ''}>← 上一周</button>
            <select id="semJump" style="padding:6px 8px;border:1px solid #ddd;border-radius:8px;font-size:12px;flex:1;min-width:130px;max-width:200px">
              ${weeks.map(x => `<option value="${x.no}" ${x.no === no ? 'selected' : ''}>第${x.no}周（${x.label}）${x.overridden ? ' 📌' : ''}</option>`).join('')}
            </select>
            <button class="btn-sm btn-gray" id="semNext" ${no >= weeks.length ? 'disabled' : ''}>下一周 →</button>
            ${curNo ? `<button class="btn-sm btn-purple" id="semToday">本周</button>` : ''}
          </div>
          <div style="font-size:13px;font-weight:700;margin-bottom:2px">第 ${no} 周 / 共 ${weeks.length} 周 <span style="font-weight:400;color:#7A7A8C">（${w.label}）</span></div>
          <div style="display:flex;gap:6px;margin-bottom:10px">${badge}${ovBadge}</div>
          <div style="overflow-x:auto;border-radius:10px;border:1px solid #eee">
            <table style="width:100%;border-collapse:collapse;min-width:430px">
              <thead><tr style="background:#F8F8F8">
                <th style="padding:6px;font-size:12px;width:52px"></th>${headCells}
              </tr></thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </div>
          <div style="font-size:11px;color:#7A7A8C;margin-top:8px;line-height:1.7">
            每天 8:00 🚩 升旗/阳光体育 · 10:25/14:50 👀 眼保健操 · 12:10 🍱 午餐午休<br/>
            节次时间：${PERIOD_SLOTS.map(p => p.replace('第', '').replace('节', '') + '节 ' + PERIOD_TIMES[p]).join(' · ')}
            ${overridden ? '<br/><span style="color:#8B6000">★ 标记 = 与默认课表不同的课</span>' : ''}
          </div>
          ${diffList.length ? `<div style="margin-top:8px;font-size:12px;color:#8B4513;line-height:1.7;background:rgba(255,230,150,0.35);padding:6px 10px;border-radius:8px">
            <b>与默认课表不同之处：</b><br/>
            ${diffList.map(x => `• ${x.dayName} ${x.period}：${esc(x.defaultName)} → <b style="color:#C75A92">${esc(x.overrideName)}</b>`).join('<br/>')}
          </div>` : ''}
        </div>
        <div class="act-foot">
          <button class="btn-sm btn-yellow" id="semEditThisWeek">✏️ 编辑该周课表</button>
          <button class="btn-sm btn-gray" data-back>关闭</button>
        </div>
      `;
    }

    function bind() {
      const modal = document.querySelector('#modalLayer');
      const prev = modal.querySelector('#semPrev');
      const next = modal.querySelector('#semNext');
      if (prev) prev.addEventListener('click', () => { if (no > 1) { no--; refresh(); } });
      if (next) next.addEventListener('click', () => { if (no < weeks.length) { no++; refresh(); } });
      const jump = modal.querySelector('#semJump');
      if (jump) jump.addEventListener('change', () => { no = parseInt(jump.value, 10) || 1; refresh(); });
      const todayBtn = modal.querySelector('#semToday');
      if (todayBtn) todayBtn.addEventListener('click', () => { no = curNo || 1; refresh(); });
      const editBtn = modal.querySelector('#semEditThisWeek');
      if (editBtn) editBtn.addEventListener('click', () => openScheduleEditor(weeks[no - 1].key));
      const back = modal.querySelector('[data-back]');
      if (back) back.addEventListener('click', () => window.closeModal());
    }

    function refresh() { window.openModal(build()); bind(); }

    refresh();
  }

  window.openScheduleEditor = openScheduleEditor;
  window.openSemesterSchedule = openSemesterSchedule;
})();
