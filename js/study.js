/**
 * 学习中心交互 v2
 * 15 个互动练习：拼音/识字/古诗/生字表/加减法/20以内/图形/数数/字母/单词/拼写/故事/习惯/问答/观察
 */
(function () {
  const D = () => window.AppData;
  const st = () => window.appState.data;
  const todayKey = () => window.todayKey();
  const toast = m => window.appShowToast(m);
  const confetti = () => window.appConfetti();
  const render = () => window.appRender();

  // 学科 → 活动 映射
  const SUBJECT_ACTS = {
    yuwen: [
      { id: 'pinyin', name: '拼音练习', emoji: '🔤', desc: '看拼音选汉字' },
      { id: 'character', name: '识字卡', emoji: '🈶', desc: '翻面学汉字' },
      { id: 'poem', name: '古诗背诵', emoji: '📜', desc: '6 首必背古诗' },
      { id: 'zi', name: '生字表', emoji: '📝', desc: '追踪 100 个会写字' },
    ],
    shuxue: [
      { id: 'math', name: '加减法', emoji: '➕', desc: '10 以内运算' },
      { id: 'math20', name: '20以内', emoji: '🔟', desc: '20 以内进阶' },
      { id: 'shape', name: '认识图形', emoji: '🔷', desc: '五种图形' },
      { id: 'count', name: '数数练习', emoji: '🧮', desc: '1-20 数数' },
    ],
    yingyu: [
      { id: 'letter', name: '26 字母', emoji: '🅰️', desc: '大小写+发音' },
      { id: 'word', name: '单词卡', emoji: '📇', desc: '24 个单词' },
      { id: 'spell', name: '拼写练习', emoji: '✏️', desc: '看图选词' },
    ],
    daode: [
      { id: 'story', name: '德育小故事', emoji: '📚', desc: '3 个故事' },
      { id: 'habit', name: '好习惯', emoji: '🌱', desc: '8 项行为' },
    ],
    kexue: [
      { id: 'quiz', name: '知识问答', emoji: '❓', desc: '8 道常识' },
      { id: 'observe', name: '观察日记', emoji: '📓', desc: '记录发现' },
    ],
  };

  const SUBJECT_META = {
    yuwen: { name: '语文', emoji: '📖', color: '#FFB6D9' },
    shuxue: { name: '数学', emoji: '🔢', color: '#A5D8FF' },
    yingyu: { name: '英语', emoji: '🔤', color: '#FFE066' },
    daode: { name: '道德与法治', emoji: '⚖️', color: '#B5EAD7' },
    kexue: { name: '科学', emoji: '🔬', color: '#C9B6FF' },
  };

  const modalEl = () => document.querySelector('#modalLayer');

  // ============ 打开学科 ============
  function openSubject(subId) {
    const meta = SUBJECT_META[subId];
    const acts = SUBJECT_ACTS[subId] || [];
    const done = st().study?.[todayKey()]?.[subId] || {};

    window.openModal(`
      <div class="sd-head" style="background:${meta.color}">
        <span class="big-emoji">${meta.emoji}</span>
        <div><h2>${meta.name}</h2><p>选择一项练习开始吧～</p></div>
      </div>
      <div class="activity-list">
        ${acts.map(a => `
          <button class="activity-row ${done[a.id] ? 'done' : ''}" data-act="${a.id}">
            <span class="act-emoji-box">${done[a.id] ? '✅' : a.emoji}</span>
            <span><span class="act-name-txt">${a.name}</span><span class="act-desc-txt">${a.desc}</span></span>
            <span class="act-arrow">→</span>
          </button>
        `).join('')}
      </div>
    `);

    modalEl().querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', () => openActivity(subId, b.dataset.act));
    });
  }

  // ============ 打开活动 ============
  function openActivity(subId, actId) {
    const fn = ACTIVITIES[actId];
    if (fn) fn(subId, actId);
    else window.openModal('<div style="padding:30px">功能开发中…</div>');
  }

  // ============ 奖励 ============
  function award(subId, actId, stars) {
    stars = stars || 2;
    const d = st();
    const k = todayKey();
    if (!d.study[k]) d.study[k] = {};
    if (!d.study[k][subId]) d.study[k][subId] = {};
    if (d.study[k][subId][actId]) return false;
    d.study[k][subId][actId] = Date.now();
    window.SyncAPI.saveData(d);
    window.appAwardStars(stars);
    render();
    return true;
  }

  // 通用：头 + 尾
  function screen(head, body, foot) {
    return `<div class="act-screen">
      ${head ? `<div class="act-head">${head}</div>` : ''}
      <div class="act-body">${body}</div>
      <div class="act-foot">${foot || '<button class="btn-sm btn-gray" data-back>返回</button>'}</div>
    </div>`;
  }

  function bindBack(subId) {
    const b = modalEl().querySelector('[data-back]');
    if (b) b.addEventListener('click', () => openSubject(subId));
  }

  // ==================== 活动实现 ====================
  const ACTIVITIES = {};

  // 1. 拼音练习
  ACTIVITIES.pinyin = function (subId) {
    const S = { score: 0, total: 0, q: null };
    function build() {
      const hz = D().HZ_DATA;
      const correct = hz[Math.floor(Math.random() * hz.length)];
      const opts = new Set([correct.hz]);
      while (opts.size < 4) opts.add(hz[Math.floor(Math.random() * hz.length)].hz);
      S.q = { py: correct.py, ans: correct.hz, opts: shuffle([...opts]) };
      S.total++;
      return screen(
        `<span class="ae">🔤</span><span class="at">拼音练习</span><span class="as">${S.score}/${S.total - 1}</span>`,
        `<div class="pinyin-big">${S.q.py}</div>
         <div class="pinyin-hint">读一读，选出对应的汉字</div>
         <div class="opt-grid">${S.q.opts.map(o => `<button class="opt-btn" data-o="${o}">${o}</button>`).join('')}</div>`,
        `<button class="btn-sm btn-yellow" data-skip>换一题</button><button class="btn-sm btn-gray" data-back>返回</button>`
      );
    }
    function bind() {
      modalEl().querySelectorAll('[data-o]').forEach(b => {
        b.addEventListener('click', () => {
          const right = b.dataset.o === S.q.ans;
          if (right) S.score++;
          else if (window.Exam) {
            // 错题自动进错题本，并让孩子自评错因（粗心/看错/不会）
            const e = window.Exam.markWrong(subId, 'pinyin', S.q.py, S.q.ans, b.dataset.o, S.q.opts);
            window.Exam.askReason(e);
          }
          modalEl().querySelectorAll('[data-o]').forEach(x => {
            x.disabled = true;
            if (x.dataset.o === S.q.ans) x.classList.add('correct');
            if (x === b && !right) x.classList.add('wrong');
          });
          showFeedback(right, S.q.ans);
          setTimeout(() => {
            if (S.total >= 6) {
              if (window.Exam) window.Exam.finish(subId, 'pinyin', S.total, S.score);
              award(subId, 'pinyin', 2); openSubject(subId);
            }
            else { window.openModal(build()); bind(); }
          }, right ? 900 : 2000);
        });
      });
      const sk = modalEl().querySelector('[data-skip]');
      if (sk) sk.addEventListener('click', () => { window.openModal(build()); bind(); });
      bindBack(subId);
    }
    window.openModal(build()); bind();
  };

  // 2. 识字卡
  ACTIVITIES.character = function (subId) {
    const list = shuffle([...D().HZ_DATA]);
    let i = 0;
    function build() {
      const c = list[i];
      return screen(
        `<span class="ae">🈶</span><span class="at">识字卡</span><span class="as">${i + 1}/${list.length}</span>`,
        `<div class="hz-flashcard" data-flip>
          <div class="hz-card-face hz-front">
            <div class="hz-char">${c.hz}</div><div class="hz-pinyin">${c.py}</div>
            <div class="hz-hint">点击翻面</div>
          </div>
          <div class="hz-card-face hz-back">
            <div class="hz-back-row"><b>部首：</b>${c.bushou}</div>
            <div class="hz-back-row"><b>组词：</b>${c.cizu}</div>
            <div class="hz-back-row"><b>英文：</b>${c.en}</div>
          </div>
        </div>
        <div class="hz-nav">
          <button class="btn-sm btn-gray" data-prev>← 上一张</button>
          <button class="btn-sm btn-yellow" data-flipbtn>翻一翻 🔄</button>
          <button class="btn-sm btn-pink" data-next>下一张 →</button>
        </div>`,
        '<button class="btn-sm btn-gray" data-back>返回</button>'
      );
    }
    function bind() {
      const card = modalEl().querySelector('[data-flip]');
      card.addEventListener('click', () => card.classList.toggle('flipped'));
      modalEl().querySelector('[data-flipbtn]').addEventListener('click', () => card.classList.toggle('flipped'));
      modalEl().querySelector('[data-prev]').addEventListener('click', () => { i = Math.max(0, i - 1); window.openModal(build()); bind(); });
      modalEl().querySelector('[data-next]').addEventListener('click', () => {
        i++;
        if (i >= list.length) { award(subId, 'character', 2); i = 0; openSubject(subId); return; }
        if ((i + 1) % 8 === 0) award(subId, 'character', 1);
        window.openModal(build()); bind();
      });
      bindBack(subId);
    }
    window.openModal(build()); bind();
  };

  // 3. 古诗
  ACTIVITIES.poem = function (subId) {
    const poems = D().POEMS;
    let i = 0;
    function build() {
      const p = poems[i];
      return screen(
        `<span class="ae">📜</span><span class="at">古诗背诵</span><span class="as">${i + 1}/${poems.length}</span>`,
        `<div class="poem-card" data-read>
          <div class="poem-title">${p.title}</div>
          <div class="poem-author">${p.author}</div>
          <div class="poem-lines">${p.lines.map(l => `<div class="poem-line">${[...l].map((ch, idx) => `<span class="poem-char" style="animation-delay:${idx * 0.07}s">${ch}</span>`).join('')}</div>`).join('')}</div>
        </div>
        <div class="poem-nav">
          <button class="btn-sm btn-gray" data-prev>← 上一首</button>
          <span style="font-size:13px;color:var(--text-light)">点击诗句朗读</span>
          <button class="btn-sm btn-pink" data-next>下一首 →</button>
        </div>
        <div class="poem-tip">也可以点「学会了」记录已背古诗</div>`,
        `<button class="btn-sm btn-green" data-learn>学会了 ✓</button><button class="btn-sm btn-gray" data-back>返回</button>`
      );
    }
    function bind() {
      modalEl().querySelector('[data-prev]').addEventListener('click', () => { i = (i - 1 + poems.length) % poems.length; window.openModal(build()); bind(); });
      modalEl().querySelector('[data-next]').addEventListener('click', () => { i = (i + 1) % poems.length; window.openModal(build()); bind(); });
      // 分句朗读：题目 + 每句依次播放，句间自带停顿，更像朗诵
      modalEl().querySelector('[data-read]').addEventListener('click', () => speakLines([poems[i].title, ...poems[i].lines], 'zh-CN', 'poem'));
      modalEl().querySelector('[data-learn]').addEventListener('click', () => {
        st().poems[poems[i].title] = Date.now();
        window.SyncAPI.saveData(st());
        toast('已记录：' + poems[i].title + ' 📜');
        const ok = award(subId, 'poem', 2);
        if (ok) render();
        openSubject(subId);
      });
      bindBack(subId);
      // 手机浏览器禁止在非用户手势中调用语音，改为点击诗句触发朗读
    }
    window.openModal(build()); bind();
  };

  // 4. 生字表（追踪 100 个会写字）
  ACTIVITIES.zi = function (subId) {
    const mastered = st().ziMastered;
    function build() {
      const units = D().ZI_XIE;
      const total = units.reduce((n, u) => n + u.zi.length, 0);
      const done = Object.keys(mastered).length;
      return screen(
        `<span class="ae">📝</span><span class="at">生字表 · 会写</span><span class="as">${done}/${total}</span>`,
        `<div class="alert alert-info" style="margin-bottom:14px"><span class="alert-emoji">💡</span>
          <div>点击汉字标记为「已掌握」。对应教材写字表（${total} 字）</div></div>
        ${units.map(u => `<div class="zi-unit">
          <div class="zi-unit-title">${u.unit}（${u.zi.filter(z => mastered[z]).length}/${u.zi.length}）</div>
          <div class="zi-grid">${u.zi.map(z => `<div class="zi-cell ${mastered[z] ? 'mastered' : ''}" data-zi="${z}">${z}</div>`).join('')}</div>
        </div>`).join('')}`,
        `<button class="btn-sm btn-green" data-done>完成学习</button><button class="btn-sm btn-gray" data-back>返回</button>`
      );
    }
    function bind() {
      modalEl().querySelectorAll('[data-zi]').forEach(c => {
        c.addEventListener('click', () => {
          const z = c.dataset.zi;
          if (mastered[z]) { delete mastered[z]; c.classList.remove('mastered'); }
          else {
            mastered[z] = Date.now(); c.classList.add('mastered');
            speak(z, 'zh-CN', 'char');
          }
          window.SyncAPI.saveData(st());
          updateHead();
        });
      });
      modalEl().querySelector('[data-done]').addEventListener('click', () => {
        const ok = award(subId, 'zi', 2);
        if (ok) toast('生字学习完成！+2⭐');
        openSubject(subId);
      });
      bindBack(subId);
    }
    function updateHead() {
      const total = D().ZI_XIE.reduce((n, u) => n + u.zi.length, 0);
      const done = Object.keys(mastered).length;
      const el = modalEl().querySelector('.as');
      if (el) el.textContent = `${done}/${total}`;
      modalEl().querySelectorAll('.zi-unit-title').forEach(t => {
        const m = t.textContent.match(/（\d+\/(\d+)）/);
        if (m) {
          const unit = D().ZI_XIE.find(u => t.textContent.startsWith(u.unit));
          if (unit) t.textContent = `${unit.unit}（${unit.zi.filter(z => mastered[z]).length}/${unit.zi.length}）`;
        }
      });
    }
    window.openModal(build()); bind();
  };

  // 5-6. 加减法（10 / 20 以内）
  function makeMath(subId, actId, max) {
    const S = { score: 0, total: 0 };
    function gen() {
      const op = Math.random() < 0.5 ? '+' : '-';
      let a, b;
      if (op === '+') { a = Math.floor(Math.random() * max) + 1; b = Math.floor(Math.random() * (max - a + 1)); }
      else { a = Math.floor(Math.random() * max) + 1; b = Math.floor(Math.random() * a) + 1; }
      const ans = op === '+' ? a + b : a - b;
      const opts = new Set([ans]);
      while (opts.size < 4) {
        const v = Math.max(0, Math.min(max * 2, ans + Math.floor(Math.random() * 7) - 3));
        opts.add(v);
      }
      return { q: `${a} ${op} ${b} = ?`, ans, opts: shuffle([...opts]) };
    }
    function build() {
      const cur = gen();
      S.total++;
      window._curMath = cur;
      return screen(
        `<span class="ae">${actId === 'math20' ? '🔟' : '➕'}</span><span class="at">${actId === 'math20' ? '20以内运算' : '加减法'}</span><span class="as">${S.score}/${S.total - 1}</span>`,
        `<div class="math-q">${cur.q}</div>
         <div class="opt-grid">${cur.opts.map(o => `<button class="opt-btn math-opt" data-v="${o}">${o}</button>`).join('')}</div>`,
        '<button class="btn-sm btn-gray" data-back>返回</button>'
      );
    }
    function bind() {
      modalEl().querySelectorAll('[data-v]').forEach(b => {
        b.addEventListener('click', () => {
          const v = parseInt(b.dataset.v, 10);
          const cur = window._curMath;
          const right = v === cur.ans;
          if (right) S.score++;
          else if (window.Exam) {
            const e = window.Exam.markWrong(subId, actId, cur.q, cur.ans, v, cur.opts);
            window.Exam.askReason(e);
          }
          modalEl().querySelectorAll('[data-v]').forEach(x => {
            x.disabled = true;
            if (parseInt(x.dataset.v, 10) === cur.ans) x.classList.add('correct');
            if (x === b && !right) x.classList.add('wrong');
          });
          // 明确告诉孩子 对 / 错，并显示正确答案
          showFeedback(right, cur.ans);
          setTimeout(() => {
            if (S.total >= 8) {
              if (window.Exam) window.Exam.finish(subId, actId, S.total, S.score);
              award(subId, actId, 2); openSubject(subId);
            }
            else { window.openModal(build()); bind(); }
          }, right ? 650 : 2100);
        });
      });
      bindBack(subId);
    }
    window.openModal(build()); bind();
  }
  ACTIVITIES.math = (s) => makeMath(s, 'math', 10);
  ACTIVITIES.math20 = (s) => makeMath(s, 'math20', 20);

  // 7. 认识图形
  ACTIVITIES.shape = function (subId) {
    const shapes = [
      { name: '正方形', svg: '<rect x="6" y="6" width="20" height="20" fill="#FFB6D9" stroke="#C75A92" stroke-width="2"/>' },
      { name: '三角形', svg: '<polygon points="16,5 29,27 3,27" fill="#A5D8FF" stroke="#1B4F7A" stroke-width="2"/>' },
      { name: '圆形', svg: '<circle cx="16" cy="16" r="13" fill="#FFE066" stroke="#A88A00" stroke-width="2"/>' },
      { name: '长方形', svg: '<rect x="3" y="9" width="26" height="14" fill="#B5EAD7" stroke="#2D7A55" stroke-width="2"/>' },
      { name: '五角星', svg: '<polygon points="16,3 19,13 29,13 21,19 24,29 16,23 8,29 11,19 3,13 13,13" fill="#C9B6FF" stroke="#5B3DA8" stroke-width="2"/>' },
    ];
    let score = 0, total = 0, cur = null;
    function build() {
      const correct = shapes[Math.floor(Math.random() * shapes.length)];
      const others = shuffle(shapes.filter(s => s.name !== correct.name)).slice(0, 3);
      cur = { correct, opts: shuffle([correct, ...others]) };
      total++;
      return screen(
        `<span class="ae">🔷</span><span class="at">认识图形</span><span class="as">${score}/${total - 1}</span>`,
        `<div class="shape-q">请找出：<b>${cur.correct.name}</b></div>
         <div class="opt-grid shape-grid">${cur.opts.map(o => `<button class="opt-btn shape-btn" data-n="${o.name}"><svg viewBox="0 0 32 32">${o.svg}</svg></button>`).join('')}</div>`,
        '<button class="btn-sm btn-gray" data-back>返回</button>'
      );
    }
    function bind() {
      modalEl().querySelectorAll('[data-n]').forEach(b => {
        b.addEventListener('click', () => {
          const right = b.dataset.n === cur.correct.name;
          if (right) score++;
          else if (window.Exam) {
            const e = window.Exam.markWrong(subId, 'shape', '请找出：' + cur.correct.name, cur.correct.name, b.dataset.n, cur.opts.map(o => o.name));
            window.Exam.askReason(e);
          }
          b.classList.add(right ? 'correct' : 'wrong');
          showFeedback(right, cur.correct.name);
          setTimeout(() => {
            if (total >= 6) {
              if (window.Exam) window.Exam.finish(subId, 'shape', total, score);
              award(subId, 'shape', 2); openSubject(subId);
            }
            else { window.openModal(build()); bind(); }
          }, right ? 700 : 1900);
        });
      });
      bindBack(subId);
    }
    window.openModal(build()); bind();
  };

  // 8. 数数
  ACTIVITIES.count = function (subId) {
    let n = 1, score = 0, total = 0;
    function build() {
      return screen(
        `<span class="ae">🧮</span><span class="at">数数练习</span><span class="as">${n}/20</span>`,
        `<div class="count-q">一共有 <b>${n}</b> 个小球，对吗？</div>
         <div class="count-dots">${Array.from({ length: n }, () => '<span class="dot">●</span>').join('')}</div>
         <div class="count-opts">${shuffle([...new Set([Math.max(1, n - 1), n, n + 1])]).map(v => `<button class="count-opt" data-v="${v}">${v}</button>`).join('')}</div>`,
        '<button class="btn-sm btn-gray" data-back>返回</button>'
      );
    }
    function bind() {
      modalEl().querySelectorAll('[data-v]').forEach(b => {
        b.addEventListener('click', () => {
          const right = parseInt(b.dataset.v, 10) === n;
          total++;
          if (right) { score++; b.classList.add('correct'); }
          else {
            b.classList.add('wrong');
            if (window.Exam) {
              const e = window.Exam.markWrong(subId, 'count', '一共有几个●？（' + n + '）', n, b.dataset.v, [n - 1, n, n + 1].filter(x => x > 0));
              window.Exam.askReason(e);
            }
          }
          // 数数：明确告知正确数量
          showFeedback(right, n);
          setTimeout(() => {
            if (right) {
              if (n >= 20) {
                if (window.Exam) window.Exam.finish(subId, 'count', total, score);
                award(subId, 'count', 2); openSubject(subId); return;
              }
              n++;
            }
            window.openModal(build()); bind();
          }, right ? 700 : 1900);
        });
      });
      bindBack(subId);
    }
    window.openModal(build()); bind();
  };

  // 9. 26 字母
  ACTIVITIES.letter = function (subId) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    let i = 0;
    function build() {
      const L = letters[i];
      return screen(
        `<span class="ae">🅰️</span><span class="at">26 字母</span><span class="as">${i + 1}/26</span>`,
        `<div class="letter-card">
          <div class="letter-upper">${L}</div>
          <div class="letter-lower">${L.toLowerCase()}</div>
          <div class="letter-hint">点下方 🔊 听发音</div>
        </div>
        <div class="letter-actions">
          <button class="btn-sm btn-yellow" data-pron>朗读 🔊</button>
          <button class="btn-sm btn-pink" data-next>下一个 →</button>
        </div>`,
        '<button class="btn-sm btn-gray" data-back>返回</button>'
      );
    }
    function bind() {
      modalEl().querySelector('[data-pron]').addEventListener('click', () => speak(letters[i], 'en-US', 'word'));
      modalEl().querySelector('[data-next]').addEventListener('click', () => {
        i++;
        if (i >= 26) { award(subId, 'letter', 2); openSubject(subId); return; }
        if ((i + 1) % 9 === 0) award(subId, 'letter', 1);
        window.openModal(build()); bind();
      });
      bindBack(subId);
      // 手机端需点击「朗读 🔊」按钮触发（非手势调用会被系统拦截）
    }
    window.openModal(build()); bind();
  };

  // 10. 单词卡
  ACTIVITIES.word = function (subId) {
    const list = shuffle([...D().EN_WORDS]);
    let i = 0;
    function build() {
      const w = list[i];
      return screen(
        `<span class="ae">📇</span><span class="at">单词卡</span><span class="as">${i + 1}/${list.length}</span>`,
        `<div class="word-flashcard" data-flip>
          <div class="word-face front"><div class="word-emoji">${w.emoji}</div><div class="word-hint">这个是什么呢？</div></div>
          <div class="word-face back"><div class="word-text">${w.word}</div><div class="word-cn">${w.cn}</div></div>
        </div>
        <div class="word-actions">
          <button class="btn-sm btn-yellow" data-pron>朗读 🔊</button>
          <button class="btn-sm btn-pink" data-flipbtn>翻一翻 🔄</button>
          <button class="btn-sm btn-green" data-next>下一个 →</button>
        </div>`,
        '<button class="btn-sm btn-gray" data-back>返回</button>'
      );
    }
    function bind() {
      const card = modalEl().querySelector('[data-flip]');
      card.addEventListener('click', () => card.classList.toggle('flipped'));
      modalEl().querySelector('[data-flipbtn]').addEventListener('click', () => card.classList.toggle('flipped'));
      modalEl().querySelector('[data-pron]').addEventListener('click', () => speak(list[i].word, 'en-US', 'word'));
      modalEl().querySelector('[data-next]').addEventListener('click', () => {
        i++;
        if (i >= list.length) { award(subId, 'word', 2); openSubject(subId); return; }
        if ((i + 1) % 8 === 0) award(subId, 'word', 1);
        window.openModal(build()); bind();
      });
      bindBack(subId);
    }
    window.openModal(build()); bind();
  };

  // 11. 拼写练习
  ACTIVITIES.spell = function (subId) {
    const all = D().EN_WORDS;
    let score = 0, total = 0, cur = null;
    function build() {
      const t = all[Math.floor(Math.random() * all.length)];
      const opts = shuffle([t, ...shuffle(all.filter(w => w.word !== t.word)).slice(0, 3)]);
      cur = t; total++;
      return screen(
        `<span class="ae">✏️</span><span class="at">拼写练习</span><span class="as">${score}/${total - 1}</span>`,
        `<div class="spell-q">
          <div class="spell-emoji">${t.emoji}</div>
          <div class="spell-hint">选出它的英文单词</div>
        </div>
        <div class="opt-grid spell-grid">${opts.map(o => `<button class="opt-btn spell-btn" data-w="${o.word}">${o.word}</button>`).join('')}</div>`,
        '<button class="btn-sm btn-gray" data-back>返回</button>'
      );
    }
    function bind() {
      modalEl().querySelectorAll('[data-w]').forEach(b => {
        b.addEventListener('click', () => {
          const right = b.dataset.w === cur.word;
          if (right) score++;
          else if (window.Exam) {
            const e = window.Exam.markWrong(subId, 'spell', cur.emoji + ' ' + cur.cn, cur.word, b.dataset.w, opts.map(o => o.word));
            window.Exam.askReason(e);
          }
          modalEl().querySelectorAll('[data-w]').forEach(x => {
            x.disabled = true;
            if (x.dataset.w === cur.word) x.classList.add('correct');
            if (x === b && !right) x.classList.add('wrong');
          });
          showFeedback(right, cur.word);
          setTimeout(() => {
            if (total >= 6) {
              if (window.Exam) window.Exam.finish(subId, 'spell', total, score);
              award(subId, 'spell', 2); openSubject(subId);
            }
            else { window.openModal(build()); bind(); }
          }, right ? 800 : 2000);
        });
      });
      bindBack(subId);
    }
    window.openModal(build()); bind();
  };

  // 12. 德育小故事
  ACTIVITIES.story = function (subId) {
    const stories = D().MORAL_STORIES;
    let i = 0;
    function build() {
      const s = stories[i];
      return screen(
        `<span class="ae">📚</span><span class="at">德育小故事</span><span class="as">${i + 1}/${stories.length}</span>`,
        `<div class="story-card">
          <div class="story-title">${s.title}</div>
          <div class="story-content">${s.content.map(p => `<p>${p}</p>`).join('')}</div>
          <div class="story-moral">🌟 ${s.moral}</div>
          <div class="story-emoji">${s.emoji}</div>
        </div>`,
        `<button class="btn-sm btn-green" data-next>${i < stories.length - 1 ? '下一个 →' : '我学会了'}</button>
         <button class="btn-sm btn-gray" data-back>返回</button>`
      );
    }
    function bind() {
      modalEl().querySelector('[data-next]').addEventListener('click', () => {
        i++;
        if (i >= stories.length) { award(subId, 'story', 2); openSubject(subId); return; }
        window.openModal(build()); bind();
      });
      bindBack(subId);
    }
    window.openModal(build()); bind();
  };

  // 13. 好习惯（道法）
  ACTIVITIES.habit = function (subId) {
    const habits = [
      { t: '自己整理书包', e: '🎒' }, { t: '饭前便后洗手', e: '🧼' },
      { t: '见到老师同学问好', e: '🙋' }, { t: '不在马路上玩耍', e: '🚦' },
      { t: '爱护花草树木', e: '🌳' }, { t: '帮爸爸妈妈做家务', e: '🧹' },
      { t: '上课专心听讲', e: '👂' }, { t: '垃圾扔进垃圾桶', e: '🗑️' },
    ];
    function build() {
      return screen(
        `<span class="ae">🌱</span><span class="at">好习惯</span><span class="as">今日做到</span>`,
        `<div class="obs-tip">今天做到了哪些？点一点 ✅ 记录～</div>
         <div>${habits.map((h, idx) => `<div class="habit-row" data-h="${idx}">
           <span class="habit-emoji">${h.e}</span><span class="habit-text">${h.t}</span>
           <span class="habit-check"></span>
         </div>`).join('')}</div>`,
        `<button class="btn-sm btn-green" data-fin>完成</button><button class="btn-sm btn-gray" data-back>返回</button>`
      );
    }
    function bind() {
      modalEl().querySelectorAll('[data-h]').forEach(row => {
        row.addEventListener('click', () => {
          row.classList.toggle('checked');
          row.querySelector('.habit-check').textContent = row.classList.contains('checked') ? '✓' : '';
        });
      });
      modalEl().querySelector('[data-fin]').addEventListener('click', () => {
        const n = modalEl().querySelectorAll('.habit-row.checked').length;
        if (!n) { toast('请先勾选已做到的哦'); return; }
        award(subId, 'habit', Math.min(3, Math.ceil(n / 3)));
        openSubject(subId);
      });
      bindBack(subId);
    }
    window.openModal(build()); bind();
  };

  // 14. 科学问答
  ACTIVITIES.quiz = function (subId) {
    const qs = shuffle([...D().SCIENCE_QUIZ]);
    let i = 0, score = 0, cur = null;
    function build() {
      cur = qs[i];
      return screen(
        `<span class="ae">❓</span><span class="at">知识问答</span><span class="as">${i + 1}/${qs.length}</span>`,
        `<div class="quiz-q">${cur.q}</div>
         <div class="opt-grid quiz-grid">${cur.opts.map(o => `<button class="opt-btn quiz-btn" data-o="${o}">${o}</button>`).join('')}</div>`,
        '<button class="btn-sm btn-gray" data-back>返回</button>'
      );
    }
    function bind() {
      modalEl().querySelectorAll('[data-o]').forEach(b => {
        b.addEventListener('click', () => {
          const right = b.dataset.o === cur.a;
          if (right) score++;
          modalEl().querySelectorAll('[data-o]').forEach(x => {
            x.disabled = true;
            if (x.dataset.o === cur.a) x.classList.add('correct');
            if (x === b && !right) x.classList.add('wrong');
          });
          showFeedback(right, cur.a);
          const ex = document.createElement('div');
          ex.className = 'quiz-explain';
          ex.innerHTML = `💡 ${cur.explain}`;
          modalEl().querySelector('.act-body').appendChild(ex);
          setTimeout(() => {
            i++;
            if (i >= qs.length) {
              award(subId, 'quiz', Math.max(2, score));
              toast(`问答完成！答对 ${score}/${qs.length} 题`);
              openSubject(subId);
            } else { window.openModal(build()); bind(); }
          }, 2300);
        });
      });
      bindBack(subId);
    }
    window.openModal(build()); bind();
  };

  // 15. 观察日记
  ACTIVITIES.observe = function (subId) {
    const KEY = 'yiban-observe';
    let list = [];
    try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) {}
    function build() {
      return screen(
        `<span class="ae">📓</span><span class="at">观察日记</span>`,
        `<div class="obs-tip">今天看到了什么有趣的小事物？记录下来吧～</div>
         <div class="obs-input-row">
           <textarea id="obsText" placeholder="例如：今天看到蚂蚁搬家…" maxlength="100"></textarea>
         </div>
         <div class="obs-list">
           ${list.length ? list.map((l, i) => `<div class="obs-item">
             <span class="obs-date">${l.date}</span><span class="obs-content">${esc(l.text)}</span>
             <button class="obs-del" data-i="${i}">×</button>
           </div>`).join('') : '<div class="view-sub">还没有记录～</div>'}
         </div>`,
        `<button class="btn-sm btn-green" data-save>保存记录</button><button class="btn-sm btn-gray" data-back>返回</button>`
      );
    }
    function bind() {
      modalEl().querySelector('[data-save]').addEventListener('click', () => {
        const t = modalEl().querySelector('#obsText').value.trim();
        if (!t) { toast('请先写点什么吧～'); return; }
        list.unshift({ date: todayKey(), text: t });
        localStorage.setItem(KEY, JSON.stringify(list));
        award(subId, 'observe', 1);
        window.openModal(build()); bind();
      });
      modalEl().querySelectorAll('[data-i]').forEach(b => {
        b.addEventListener('click', () => {
          list.splice(parseInt(b.dataset.i, 10), 1);
          localStorage.setItem(KEY, JSON.stringify(list));
          window.openModal(build()); bind();
        });
      });
      bindBack(subId);
    }
    window.openModal(build()); bind();
  };

  // ============ 工具 ============
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // ===== 语音朗读（手机兼容）=====
  // 手机浏览器限制：
  //  1) speak() 必须在用户手势(click/touchstart)的直接调用栈内触发
  //  2) iOS 需先"解锁"音频，且 voices 需预热才能拿到中文/英文发音人
  let speechUnlocked = false;

  function loadVoices() {
    try {
      return (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
    } catch (e) { return []; }
  }

  // 挑选匹配语言的发音人，避免中文被英文引擎朗读
  function pickVoice(lang) {
    const vs = loadVoices();
    if (!vs.length) return null;
    if (lang === 'en-US') {
      return vs.find(v => /^en[-_]US/i.test(v.lang)) ||
             vs.find(v => /^en/i.test(v.lang)) || null;
    }
    return vs.find(v => /^zh[-_]CN/i.test(v.lang)) ||
           vs.find(v => /^zh[-_]Hans/i.test(v.lang)) ||
           vs.find(v => /^zh/i.test(v.lang)) || null;
  }

  function initSpeech() {
    if (typeof window.speechSynthesis === 'undefined') return;
    loadVoices();
    try { window.speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) {}
    const unlock = () => {
      if (speechUnlocked) return;
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        window.speechSynthesis.speak(u);
        speechUnlocked = true;
        loadVoices();
      } catch (e) {}
    };
    ['click', 'touchstart', 'keydown'].forEach(ev => {
      document.addEventListener(ev, unlock, { once: true, passive: true });
    });
  }

  // ===== 引擎 2：在线 TTS 兜底 =====
  // 微信 X5 内核 / 部分国产浏览器没有 window.speechSynthesis，
  // 此时改用在线发音接口（国内可访问，支持中英文）。
  // 2026-09 实测：有道中文接口已废（超过 1 个字即返回 500 "returned null audio"），
  // 改为「百度翻译网页版优先 + 有道兜底」双通道，失败自动换引擎重试。
  // 注意：百度接口校验 Referer（非百度来源返回 HTML 防盗链页），
  // index.html 已设置 <meta name="referrer" content="no-referrer"> 配合使用。
  let ttsAudio = null;
  // onEnd：本段播完（或失败）后的回调，用于串联分段朗读
  function onlineTTSUrls(text, lang) {
    let t = String(text).replace(/[\n\r]+/g, '，').trim();
    if (t.length > 40) t = t.slice(0, 40);
    if (!t) return [];
    const isEn = (lang === 'en-US');
    const urls = [];
    // 引擎 A：百度翻译网页版 gettts（中英文均可用，实测 30 字长句正常）
    urls.push('https://fanyi.baidu.com/gettts?lan=' + (isEn ? 'en' : 'zh') +
      '&text=' + encodeURIComponent(t) + '&spd=3&source=web');
    // 引擎 B：有道 dictvoice（英文可靠；中文接口已不稳定，仅作兜底）
    urls.push('https://dict.youdao.com/dictvoice?audio=' +
      encodeURIComponent(t) + '&type=' + (isEn ? 1 : 0));
    return urls;
  }

  function playOnlineTTS(text, lang, onEnd) {
    try {
      const urls = onlineTTSUrls(text, lang);
      if (!urls.length) { if (onEnd) onEnd(); return true; }
      if (!ttsAudio) ttsAudio = new Audio();

      const finish = () => { if (onEnd) onEnd(); };
      let i = 0;
      const tryPlay = () => {
        ttsAudio.pause();
        ttsAudio.src = urls[i];
        const p = ttsAudio.play();
        // play() 的 promise reject 会误报，这里静默
        if (p && typeof p.catch === 'function') p.catch(() => {});
      };
      // 播完继续下一句；当前引擎失败自动换下一个引擎重试
      ttsAudio.onended = finish;
      ttsAudio.onerror = () => {
        i++;
        if (i < urls.length) { tryPlay(); }
        else {
          toast('在线发音失败：请检查网络');
          finish();
        }
      };
      tryPlay();
      return true;
    } catch (e) {
      if (onEnd) onEnd();
      return false;
    }
  }

  // 在线 TTS 分段朗读：长文本按标点切成短句逐句播放
  function playOnlineSequence(parts, lang) {
    const list = (parts || []).map(s => String(s == null ? '' : s).trim()).filter(Boolean);
    if (!list.length) return false;
    let i = 0;
    const next = () => {
      if (i >= list.length) return;
      playOnlineTTS(list[i++], lang, next);
    };
    next();
    return true;
  }

  // 把长文本按标点切成 <=40 字的小段
  function splitForTTS(text, maxLen) {
    const max = maxLen || 40;
    const raw = String(text == null ? '' : text).trim();
    if (!raw) return [];
    if (raw.length <= max) return [raw];
    const pieces = raw.split(/([，。！？；：、,\.!?;:])/).filter(Boolean);
    const out = [];
    let buf = '';
    for (let i = 0; i < pieces.length; i++) {
      const seg = pieces[i];
      if ((buf + seg).length > max && buf) { out.push(buf); buf = ''; }
      if (seg.length > max) { // 单段仍超长，硬切
        for (let j = 0; j < seg.length; j += max) out.push(seg.slice(j, j + max));
        buf = '';
      } else {
        buf += seg;
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  // 挑选更自然的发音人：优先系统里音质较好的女声
  // 关键：必须保证 voice 的语言与待读文本一致，
  // 否则会出现"中文 voice 读英文字母 → 无声/怪音"的问题。
  function pickBestVoice(lang) {
    const vs = loadVoices();
    if (!vs.length) return null;
    const isEn = (lang === 'en-US');
    const want = isEn ? 'en' : 'zh';               // 目标语言前缀
    const keys = isEn
      ? ['samantha', 'karen', 'moira', 'daniel', 'google us english', 'en-us']
      : ['tingting', 'ting-ting', 'mei-jia', 'sinji', 'yaoyao', 'huihui',
         'google 普通话', 'google zh', 'zh-cn'];

    const langOk = (v) => (v.lang || '').toLowerCase().indexOf(want) === 0;

    // 1) 先按「优质发音人 + 语言匹配」找
    for (const k of keys) {
      const hit = vs.find(v =>
        (v.name || '').toLowerCase().indexOf(k) >= 0 && langOk(v));
      if (hit) return hit;
    }
    // 2) 再退化为「任意语言匹配的 voice」
    const anyMatch = vs.find(langOk);
    if (anyMatch) return anyMatch;
    // 3) 实在找不到就别强行指定 voice（交给浏览器按 u.lang 自选）
    return null;
  }

  // 语音参数：按内容类型调 rate/pitch，读起来更自然有感情
  function voiceParams(lang, kind) {
    const isEn = (lang === 'en-US');
    if (kind === 'poem') return { rate: 0.70, pitch: 1.10, volume: 1 }; // 古诗：慢而有韵味
    if (kind === 'char') return { rate: 0.60, pitch: 1.12, volume: 1 }; // 单字：慢而清晰
    if (kind === 'word') return { rate: 0.68, pitch: 1.05, volume: 1 }; // 单词：清晰
    return isEn ? { rate: 0.78, pitch: 1.02, volume: 1 }
                : { rate: 0.84, pitch: 1.05, volume: 1 };
  }

  // 分句朗读：逐句入队，句与句之间自带停顿，听起来更像朗诵
  function speakLines(lines, lang, kind) {
    const arr = (Array.isArray(lines) ? lines : [lines])
      .map(s => String(s == null ? '' : s).trim())
      .filter(Boolean);
    if (!arr.length) return false;

    if (typeof window.speechSynthesis !== 'undefined') {
      try {
        window.speechSynthesis.cancel();
        const p = voiceParams(lang, kind || 'poem');
        const v = pickBestVoice(lang);
        arr.forEach(line => {
          const u = new SpeechSynthesisUtterance(line);
          u.lang = lang || 'zh-CN';
          u.rate = p.rate;
          u.pitch = p.pitch;
          u.volume = p.volume;
          if (v) u.voice = v;
          window.speechSynthesis.speak(u);
        });
        return true;
      } catch (e) { /* 落到在线引擎 */ }
    }
    // 在线引擎：按句分段播放（整首古诗直接请求会被接口拒绝）
    return playOnlineSequence(arr, lang);
  }

  // 双引擎朗读：优先原生（免流量、速度快），失败自动降级到在线发音
  function speak(text, lang, kind) {
    const t = String(text == null ? '' : text).trim();
    if (!t) return false;

    // 引擎 1：浏览器原生语音合成
    if (typeof window.speechSynthesis !== 'undefined') {
      try {
        window.speechSynthesis.cancel();
        const p = voiceParams(lang, kind);
        const u = new SpeechSynthesisUtterance(t);
        u.lang = lang || 'zh-CN';
        u.rate = p.rate;
        u.pitch = p.pitch;
        u.volume = p.volume;
        const v = pickBestVoice(lang);
        if (v) u.voice = v;
        window.speechSynthesis.speak(u);
        return true;
      } catch (e) {
        // 原生不可用 → 落到引擎 2
      }
    }

    // 引擎 2：在线发音（兼容微信 X5 等内核），长文本自动切段
    if (playOnlineSequence(splitForTTS(t), lang)) return true;

    toast('无法朗读：请检查网络，或点右上角用系统浏览器打开');
    return false;
  }
  // 统一的答题反馈条：明确告诉孩子「对 / 错」，答错时给出正确答案
  function showFeedback(right, correctAnswer) {
    const body = modalEl().querySelector('.act-body');
    if (!body) return;
    const old = body.querySelector('.quiz-feedback');
    if (old) old.remove();
    const fb = document.createElement('div');
    fb.className = 'quiz-feedback ' + (right ? 'ok' : 'no');
    fb.innerHTML = right
      ? '🎉 答对啦！'
      : (correctAnswer != null && correctAnswer !== ''
          ? '❌ 答错了，正确答案是 <b>' + esc(correctAnswer) + '</b>'
          : '❌ 再想想～');
    body.appendChild(fb);
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // 初始化语音：预热 voices + 绑定用户手势解锁
  initSpeech();

  window.StudyCenter = { openSubject, openActivity, speak, speakLines, initSpeech };
})();
