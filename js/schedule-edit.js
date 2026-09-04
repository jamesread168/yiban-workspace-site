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

  window.openScheduleEditor = openScheduleEditor;
})();
