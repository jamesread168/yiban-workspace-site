/**
 * 即时反馈模块
 * - 奖励音效：Web Audio 实时合成，零音频文件、零网络请求（离线可用）
 * - 手机震动：navigator.vibrate（iOS Safari 不支持，自动降级不报错）
 * - 全局静音开关：存 localStorage，家长可在「家长中心 → 反馈设置」关闭
 *
 * 设计原则：反馈越快，孩子的主动性越强。但音量克制、答错音柔和，不做惩罚性刺激。
 */
(function () {
  const MUTE_KEY = '_fbMuted';
  let ctx = null;

  function muted() {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
  }
  function setMuted(v) {
    try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch (e) {}
  }
  function ac() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = AC ? new AC() : null;
    } catch (e) { ctx = null; }
    return ctx;
  }

  // 依次播放一串音符（上行音阶 = 正向反馈）
  function tone(freqs, dur, type, gain) {
    if (muted()) return;
    const c = ac();
    if (!c) return;
    try {
      if (c.state === 'suspended') c.resume();
      const t0 = c.currentTime;
      freqs.forEach((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type || 'sine';
        o.frequency.value = f;
        const start = t0 + i * dur;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.linearRampToValueAtTime(gain || 0.18, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        o.connect(g);
        g.connect(c.destination);
        o.start(start);
        o.stop(start + dur + 0.03);
      });
    } catch (e) { /* 音频不可用时静默降级 */ }
  }

  function buzz(pattern) {
    if (muted()) return;
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  }

  window.Feedback = {
    muted,
    setMuted,
    toggle() { setMuted(!muted()); return muted(); },
    // 获得星星：C5-E5-G5 上行 + 轻震动
    reward() { tone([784, 988, 1319], 0.12, 'sine', 0.18); buzz([18, 40, 18]); },
    // 完成一项打卡/任务
    done() { tone([880, 1175], 0.1, 'triangle', 0.15); buzz(25); },
    // 答错：低柔两音，不打击积极性
    wrong() { tone([330, 262], 0.13, 'sine', 0.12); buzz([30, 30, 30]); },
    // 升级 / 达成徽章
    levelUp() { tone([523, 659, 784, 1047], 0.13, 'sine', 0.2); buzz([20, 40, 20, 40, 20]); },
    // 护眼提醒：柔和提示音
    remind() { tone([660, 880], 0.18, 'sine', 0.14); buzz([40, 60, 40]); },
  };

  // ============ 护眼 20-20-20 ============
  // 累计用眼 20 分钟 → 弹窗引导远眺 6 米外 20 秒（政策要求 + 家长最关心）
  const EYE_KEY = '_eyeLastTs';
  const EYE_OFF_KEY = '_eyeCareOff';
  const EYE_MINUTES = 20;

  function eyeCareOff() {
    try { return localStorage.getItem(EYE_OFF_KEY) === '1'; } catch (e) { return false; }
  }
  window.EyeCare = {
    off: eyeCareOff,
    setOff(v) { try { localStorage.setItem(EYE_OFF_KEY, v ? '1' : '0'); } catch (e) {} },
    reset() { try { localStorage.setItem(EYE_KEY, String(Date.now())); } catch (e) {} },
    minutes: EYE_MINUTES,
    // 距离下次提醒还有多少分钟（给设置页显示）
    remainMinutes() {
      try {
        const last = Number(localStorage.getItem(EYE_KEY) || Date.now());
        return Math.max(0, Math.round(EYE_MINUTES - (Date.now() - last) / 60000));
      } catch (e) { return EYE_MINUTES; }
    },
  };

  function showEyeRest() {
    if (document.getElementById('eyeRestModal')) return;
    if (window.Feedback) window.Feedback.remind();
    const box = document.createElement('div');
    box.id = 'eyeRestModal';
    box.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;' +
      'justify-content:center;background:rgba(30,20,40,.55)';
    box.innerHTML =
      '<div style="background:#fff;border-radius:20px;padding:28px 24px;max-width:340px;width:86%;' +
      'text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.2)">' +
        '<div style="font-size:52px;margin-bottom:8px">\uD83D\uDC41</div>' +
        '<div style="font-size:17px;font-weight:800;color:#333;margin-bottom:6px">该让眼睛休息啦</div>' +
        '<div style="font-size:14px;color:#666;line-height:1.7;margin-bottom:14px">' +
          '已经用眼 <b>20 分钟</b> 了<br/>看看窗外 <b>6 米外</b> 的地方，坚持 <b>20 秒</b></div>' +
        '<div id="eyeCountdown" style="font-size:34px;font-weight:900;color:#E4537F;margin-bottom:14px">20</div>' +
        '<button id="eyeDoneBtn" style="padding:10px 26px;border:none;border-radius:999px;' +
        'background:linear-gradient(135deg,#FFB6D9,#FF9EC4);color:#fff;font-size:15px;' +
        'font-weight:800;cursor:pointer">我休息好啦</button>' +
      '</div>';
    document.body.appendChild(box);

    let left = 20;
    const cd = box.querySelector('#eyeCountdown');
    const timer = setInterval(function () {
      left--;
      if (cd) cd.textContent = String(Math.max(0, left));
      if (left <= 0) {
        clearInterval(timer);
        const btn = box.querySelector('#eyeDoneBtn');
        if (btn) {
          btn.textContent = '✅ 休息完成';
          btn.style.background = 'linear-gradient(135deg,#8CE99A,#69DB7C)';
        }
      }
    }, 1000);

    box.querySelector('#eyeDoneBtn').onclick = function () {
      clearInterval(timer);
      box.remove();
      try { localStorage.setItem(EYE_KEY, String(Date.now())); } catch (e) {}
    };
  }

  // 启动护眼计时（页面隐藏时不计入，避免挂着后台也弹窗）
  window.startEyeCare = function () {
    try {
      if (!Number(localStorage.getItem(EYE_KEY))) {
        localStorage.setItem(EYE_KEY, String(Date.now()));
      }
    } catch (e) {}
    setInterval(function () {
      if (eyeCareOff()) return;
      if (document.hidden) return;         // 后台不计时
      if (document.getElementById('eyeRestModal')) return;
      try {
        const last = Number(localStorage.getItem(EYE_KEY) || Date.now());
        if (Date.now() - last >= EYE_MINUTES * 60 * 1000) showEyeRest();
      } catch (e) {}
    }, 30000);
  };
})();
