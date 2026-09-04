/**
 * 资料中心 —— 每节课的课前/课后资料：上传、查阅、下载
 *
 * 存储设计：
 *  1. 索引（文件名/大小/类型/路径）存在工作台数据的 materials 字段，
 *     随现有的多设备同步机制（GitHub / 本机服务端）自动流转
 *  2. 文件本体两种存放方式：
 *     - github 后端已配置 → 文件直接存入 GitHub 数据仓库（推荐，单文件最大 20MB）
 *     - 未配置云端 → 小文件（≤300KB）以 base64 内联进数据（纯本地也能用）
 *
 * 入口：
 *  - 今日课表时间轴每节课上的 📎 按钮（按日期+节次定位）
 *  - 课表卡片右上角「资料库」按钮（浏览全部日期的资料）
 *  - 课表卡片右上角「科目资料」按钮（按科目归档，不限于某节课）
 */
(function () {
  const INLINE_LIMIT = 300 * 1024;   // 内联存储上限 300KB
  const GH_LIMIT = 20 * 1024 * 1024; // GitHub 上传上限 20MB

  const st = () => window.appState.data;
  const toast = m => window.appShowToast(m);
  const esc = s => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
  const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' KB';

  // ---------- 云端配置 ----------
  function ghCfg() {
    const cfg = window.CloudSync ? window.CloudSync.getConfig() : null;
    if (cfg && cfg.provider === 'github' && cfg.owner && cfg.repo && cfg.token) return cfg;
    return null;
  }

  // ---------- 索引读写 ----------
  function idx(dateKey, period) {
    const m = st().materials || {};
    return (m[dateKey] && m[dateKey][period]) || [];
  }
  function setIdx(dateKey, period, list) {
    if (!st().materials) st().materials = {};
    if (!st().materials[dateKey]) st().materials[dateKey] = {};
    st().materials[dateKey][period] = list;
  }

  // ---------- base64 工具（二进制安全）----------
  function bufToB64(buf) {
    const bytes = new Uint8Array(buf); let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  }
  function b64ToBytes(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function safeName(name) {
    return String(name).replace(/[\/\\:*?"<>|]/g, '_').slice(0, 80);
  }
  function safePeriod(p) {
    return String(p).replace(/[\/\\\s:]/g, '-');
  }
  function encodePath(p) {
    return String(p).split('/').map(encodeURIComponent).join('/');
  }

  // ---------- GitHub Contents API ----------
  async function ghPut(path, b64, message) {
    const cfg = ghCfg();
    const url = 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) +
      '/contents/' + encodePath(path);
    const r = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + cfg.token,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, content: b64, branch: cfg.branch || 'main' }),
    });
    if (!r.ok) throw new Error('上传失败 HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
    return r.json();
  }
  async function ghGet(path) {
    const cfg = ghCfg();
    const url = 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) +
      '/contents/' + encodePath(path) + '?ref=' + encodeURIComponent(cfg.branch || 'main');
    const r = await fetch(url, {
      headers: { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (!r.ok) throw new Error('读取失败 HTTP ' + r.status);
    return r.json();
  }
  async function ghDelete(path, sha) {
    const cfg = ghCfg();
    if (!sha) { const j = await ghGet(path); sha = j.sha; }
    const url = 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) +
      '/contents/' + encodePath(path);
    const r = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer ' + cfg.token,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'delete material', sha, branch: cfg.branch || 'main' }),
    });
    if (!r.ok) throw new Error('删除失败 HTTP ' + r.status);
  }

  // ---------- 上传 ----------
  async function upload(dateKey, period, kind, file) {
    const cfg = ghCfg();
    if (!cfg && file.size > INLINE_LIMIT) {
      throw new Error('文件 ' + fmtSize(file.size) + ' 超过内联上限 300KB。\n请在「设备同步」页配置 GitHub 云端后上传大文件');
    }
    if (cfg && file.size > GH_LIMIT) throw new Error('文件超过 20MB 上限');
    if (cfg && file.size > 5 * 1024 * 1024) toast('大文件上传中，请耐心等待…');

    const buf = await file.arrayBuffer();
    const entry = {
      id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      kind,                       // 'pre' | 'post'
      uploadedAt: Date.now(),
      storage: cfg ? 'github' : 'inline',
    };

    if (cfg) {
      const dir = String(cfg.path || 'data').replace(/^\/+|\/+$/g, '');
      entry.path = (dir ? dir + '/' : '') + 'materials/' + dateKey + '/' + safePeriod(period) + '/' +
        Date.now() + '-' + safeName(file.name);
      const j = await ghPut(entry.path, bufToB64(buf), 'material: ' + dateKey + ' ' + period);
      entry.sha = j && j.content ? j.content.sha : null;
    } else {
      entry.dataUrl = 'data:' + entry.type + ';base64,' + bufToB64(buf);
    }

    const list = idx(dateKey, period).slice();
    list.push(entry);
    setIdx(dateKey, period, list);
    window.SyncAPI.saveData(st());
    if (window.appMarkDirty) window.appMarkDirty();
    return entry;
  }

  // ---------- 取文件 Blob ----------
  async function fetchBlob(entry) {
    if (entry.storage === 'inline' && entry.dataUrl) {
      const r = await fetch(entry.dataUrl);
      return r.blob();
    }
    if (entry.storage === 'github' && entry.path) {
      const j = await ghGet(entry.path);
      return new Blob([b64ToBytes(j.content)], { type: entry.type });
    }
    throw new Error('文件数据缺失（可能来自旧版本或索引损坏）');
  }

  function isViewable(type) {
    return /^(image\/|application\/pdf|text\/|audio\/|video\/)/.test(type || '');
  }

  async function view(entry) {
    try {
      const blob = await fetchBlob(entry);
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (!w) { // 弹窗被拦截 → 退化为下载
        triggerDownload(blob, entry.name);
        toast('浏览器拦截了预览窗口，已改为下载');
      }
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (e) { toast(e.message); }
  }

  function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  }
  async function download(entry) {
    try { triggerDownload(await fetchBlob(entry), entry.name); }
    catch (e) { toast(e.message); }
  }

  // ---------- 删除 ----------
  async function remove(dateKey, period, id) {
    const list = idx(dateKey, period);
    const entry = list.find(x => x.id === id);
    if (!entry) return;
    if (!confirm('确定删除「' + entry.name + '」？')) return;
    try {
      if (entry.storage === 'github' && entry.path) await ghDelete(entry.path, entry.sha);
    } catch (e) {
      if (!String(e.message).includes('404')) { toast('云端删除失败：' + e.message); return; }
    }
    setIdx(dateKey, period, list.filter(x => x.id !== id));
    window.SyncAPI.saveData(st());
    if (window.appMarkDirty) window.appMarkDirty();
  }

  // ============ UI：单节课资料面板 ============
  function fileIcon(type, name) {
    if (/^image\//.test(type)) return '🖼';
    if (/pdf/.test(type)) return '📄';
    if (/^(audio|video)\//.test(type)) return '🎬';
    if (/^(text\/|application\/vnd\.openxml|application\/msword|application\/vnd\.ms-powerpoint|application\/vnd\.excel)/.test(type)) return '📝';
    if (/zip|rar|7z/.test(name + type)) return '🗜';
    return '📎';
  }

  function fileListHtml(dateKey, period, kind) {
    const list = idx(dateKey, period).filter(x => x.kind === kind);
    if (!list.length) return '<div style="font-size:12px;color:#9A9AAB;padding:4px 0">暂无资料</div>';
    return '<div style="display:flex;flex-direction:column;gap:6px">' + list.map(e => `
      <div style="display:flex;align-items:center;gap:8px;background:#FAFAF7;border:1px solid #EEE;border-radius:10px;padding:7px 10px">
        <span style="font-size:18px">${fileIcon(e.type, e.name)}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:#3A3A4E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.name)}</div>
          <div style="font-size:10px;color:#9A9AAB">${fmtSize(e.size)} · ${new Date(e.uploadedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${e.storage === 'inline' ? ' · 本机' : ''}</div>
        </div>
        ${isViewable(e.type) ? `<button class="btn-sm btn-green" data-mat-view="${e.id}" data-mat-p="${esc(period)}" data-mat-d="${dateKey}">👁</button>` : ''}
        <button class="btn-sm btn-yellow" data-mat-dl="${e.id}" data-mat-p="${esc(period)}" data-mat-d="${dateKey}">⬇</button>
        <button class="btn-sm btn-gray" data-mat-rm="${e.id}" data-mat-p="${esc(period)}" data-mat-d="${dateKey}">🗑</button>
      </div>`).join('') + '</div>';
  }

  function openPanel(dateKey, period, lessonName) {
    const hasCloud = !!ghCfg();
    window.openModal(`
      <div style="padding:14px 16px;border-bottom:1px solid #eee;background:linear-gradient(135deg,#B5EAD7,#A5D8FF)">
        <div style="font-size:16px;font-weight:800;color:#1F5C46">📎 ${esc(lessonName)} · 课前/课后资料</div>
        <div style="font-size:12px;color:#3A7A5E;margin-top:3px">${dateKey} · ${esc(period)} · 支持图片 / PDF / 文档 / 音视频</div>
      </div>
      <div style="padding:14px 16px;max-height:56vh;overflow-y:auto">
        ${hasCloud ? '' : `<div class="alert alert-warn" style="margin-bottom:10px"><span class="alert-emoji">💡</span>
          <div>当前为<b>本机内联存储</b>（单文件 ≤300KB）。在「设备同步」页配置 GitHub 云端后，可上传 20MB 以内的大文件并多设备共享。</div></div>`}
        <div style="font-size:13px;font-weight:800;color:#B25500;margin:4px 0 6px">🌅 课前资料</div>
        <div id="matListPre">${fileListHtml(dateKey, period, 'pre')}</div>
        <label style="display:inline-flex;align-items:center;gap:5px;margin:8px 0 16px;padding:6px 14px;border-radius:999px;background:var(--yellow);color:#6B5400;font-size:13px;font-weight:700;cursor:pointer">
          ＋ 上传课前资料<input type="file" multiple hidden data-mat-up="pre">
        </label>

        <div style="font-size:13px;font-weight:800;color:#1B4F7A;margin:4px 0 6px">🌙 课后资料</div>
        <div id="matListPost">${fileListHtml(dateKey, period, 'post')}</div>
        <label style="display:inline-flex;align-items:center;gap:5px;margin:8px 0 4px;padding:6px 14px;border-radius:999px;background:var(--blue);color:#1B4F7A;font-size:13px;font-weight:700;cursor:pointer">
          ＋ 上传课后资料<input type="file" multiple hidden data-mat-up="post">
        </label>
      </div>
      <div class="act-foot">
        <button class="btn-sm btn-gray" data-back>关闭</button>
      </div>
    `);

    const modal = document.querySelector('#modalLayer');
    modal.querySelector('[data-back]').addEventListener('click', () => window.closeModal());
    const refresh = () => {
      const pre = modal.querySelector('#matListPre');
      const post = modal.querySelector('#matListPost');
      if (pre) pre.innerHTML = fileListHtml(dateKey, period, 'pre');
      if (post) post.innerHTML = fileListHtml(dateKey, period, 'post');
      bindList();
      if (window.appRender) window.appRender(); // 刷新时间轴上的 📎 计数
    };

    const bindList = () => {
      modal.querySelectorAll('[data-mat-view]').forEach(b => b.addEventListener('click', async () => {
        const e = idx(b.dataset.matD, b.dataset.matP).find(x => x.id === b.dataset.matView);
        if (e) view(e);
      }));
      modal.querySelectorAll('[data-mat-dl]').forEach(b => b.addEventListener('click', async () => {
        const e = idx(b.dataset.matD, b.dataset.matP).find(x => x.id === b.dataset.matDl);
        if (e) download(e);
      }));
      modal.querySelectorAll('[data-mat-rm]').forEach(b => b.addEventListener('click', async () => {
        await remove(dateKey, period, b.dataset.matRm);
        refresh();
      }));
    };
    bindList();

    modal.querySelectorAll('[data-mat-up]').forEach(inp => inp.addEventListener('change', async () => {
      const kind = inp.dataset.matUp;
      const files = Array.from(inp.files || []);
      inp.value = '';
      if (!files.length) return;
      for (const f of files) {
        toast('正在上传：' + f.name);
        try {
          await upload(dateKey, period, kind, f);
        } catch (e) {
          alert(f.name + '\n' + e.message);
        }
      }
      refresh();
      toast('上传完成 ✅ 记得点右上角 💾 保存，同步到其他设备');
    }));
  }

  // ============ UI：资料库浏览器（全部日期）============
  function openBrowser() {
    const m = st().materials || {};
    const dates = Object.keys(m).sort().reverse();
    let body;
    if (!dates.length) {
      body = '<div class="empty"><span class="empty-emoji">🗄</span>还没有任何资料。<br/>在今日课表里点某节课的 📎 按钮即可上传。</div>';
    } else {
      body = dates.map(dk => {
        const dayLessons = Object.keys(m[dk]).map(period => {
          const list = m[dk][period];
          const files = list.map(e => `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed #F0F0EC">
              <span>${e.kind === 'pre' ? '🌅' : '🌙'}</span>
              <span style="font-size:13px">${fileIcon(e.type, e.name)}</span>
              <span style="flex:1;font-size:13px;color:#3A3A4E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.name)} <span style="color:#9A9AAB;font-size:11px">${fmtSize(e.size)}</span></span>
              ${isViewable(e.type) ? `<button class="btn-sm btn-green" data-mat-view="${e.id}" data-mat-p="${esc(period)}" data-mat-d="${dk}">👁</button>` : ''}
              <button class="btn-sm btn-yellow" data-mat-dl="${e.id}" data-mat-p="${esc(period)}" data-mat-d="${dk}">⬇</button>
            </div>`).join('');
          return `<div style="margin:8px 0 2px;font-size:13px;font-weight:800;color:#5B3A00">${esc(period)} <span style="color:#9A9AAB;font-weight:400">（${list.length} 个文件）</span></div>${files}`;
        }).join('');
        return `<div style="background:#fff;border:1px solid #EEE;border-radius:12px;padding:10px 14px;margin-bottom:10px">
          <div style="font-size:14px;font-weight:800;color:#C75A92">${dk}（${['周日','周一','周二','周三','周四','周五','周六'][new Date(dk.replace(/-/g, '/')).getDay()]}）</div>
          ${dayLessons}
        </div>`;
      }).join('');
    }

    window.openModal(`
      <div style="padding:14px 16px;border-bottom:1px solid #eee;background:linear-gradient(135deg,#C9B6FF,#FFB6D9)">
        <div style="font-size:16px;font-weight:800;color:#4A3A7A">🗄 资料库</div>
        <div style="font-size:12px;color:#6B5A9A;margin-top:3px">全部日期的课前/课后资料，可查阅与下载</div>
      </div>
      <div style="padding:14px 16px;max-height:60vh;overflow-y:auto">${body}</div>
      <div class="act-foot"><button class="btn-sm btn-gray" data-back>关闭</button></div>
    `);
    const modal = document.querySelector('#modalLayer');
    modal.querySelector('[data-back]').addEventListener('click', () => window.closeModal());
    modal.querySelectorAll('[data-mat-view]').forEach(b => b.addEventListener('click', () => {
      const e = (st().materials[b.dataset.matD] || {})[b.dataset.matP]?.find(x => x.id === b.dataset.matView);
      if (e) view(e);
    }));
    modal.querySelectorAll('[data-mat-dl]').forEach(b => b.addEventListener('click', () => {
      const e = (st().materials[b.dataset.matD] || {})[b.dataset.matP]?.find(x => x.id === b.dataset.matDl);
      if (e) download(e);
    }));
  }

  // ============ 科目资料（不限于每节课）============
  // 索引存 st().subjectMaterials = { '语文': [entry...], ... }
  // 文件本体：github 后端 → 数据仓库 materials/subjects/科目/ 目录；未配置 → base64 内联
  const SUBJECTS = [
    { name: '语文', emoji: '📖' },
    { name: '数学', emoji: '🔢' },
    { name: '英语', emoji: '🔤' },
    { name: '音乐', emoji: '🎵' },
    { name: '体育与健康', emoji: '⚽' },
    { name: '美术', emoji: '🎨' },
    { name: '科学', emoji: '🔬' },
    { name: '道德与法治', emoji: '⚖️' },
    { name: '书法', emoji: '✍️' },
    { name: '劳动', emoji: '🧹' },
    { name: '综合实践', emoji: '🛠️' },
  ];

  function subjectIdx(subject) {
    const m = st().subjectMaterials || {};
    return m[subject] || [];
  }
  function setSubjectIdx(subject, list) {
    if (!st().subjectMaterials) st().subjectMaterials = {};
    st().subjectMaterials[subject] = list;
  }

  async function uploadSubject(subject, file) {
    const cfg = ghCfg();
    if (!cfg && file.size > INLINE_LIMIT) {
      throw new Error('文件 ' + fmtSize(file.size) + ' 超过内联上限 300KB。\n请在「设备同步」页配置 GitHub 云端后上传大文件');
    }
    if (cfg && file.size > GH_LIMIT) throw new Error('文件超过 20MB 上限');
    if (cfg && file.size > 5 * 1024 * 1024) toast('大文件上传中，请耐心等待…');

    const buf = await file.arrayBuffer();
    const entry = {
      id: 'sm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploadedAt: Date.now(),
      storage: cfg ? 'github' : 'inline',
    };

    if (cfg) {
      const dir = String(cfg.path || 'data').replace(/^\/+|\/+$/g, '');
      entry.path = (dir ? dir + '/' : '') + 'materials/subjects/' + safeName(subject) + '/' +
        Date.now() + '-' + safeName(file.name);
      const j = await ghPut(entry.path, bufToB64(buf), 'subject material: ' + subject);
      entry.sha = j && j.content ? j.content.sha : null;
    } else {
      entry.dataUrl = 'data:' + entry.type + ';base64,' + bufToB64(buf);
    }

    const list = subjectIdx(subject).slice();
    list.push(entry);
    setSubjectIdx(subject, list);
    window.SyncAPI.saveData(st());
    if (window.appMarkDirty) window.appMarkDirty();
    return entry;
  }

  async function removeSubject(subject, id) {
    const list = subjectIdx(subject);
    const entry = list.find(x => x.id === id);
    if (!entry) return;
    if (!confirm('确定删除「' + entry.name + '」？')) return;
    try {
      if (entry.storage === 'github' && entry.path) await ghDelete(entry.path, entry.sha);
    } catch (e) {
      if (!String(e.message).includes('404')) { toast('云端删除失败：' + e.message); return; }
    }
    setSubjectIdx(subject, list.filter(x => x.id !== id));
    window.SyncAPI.saveData(st());
    if (window.appMarkDirty) window.appMarkDirty();
  }

  function subjectFileListHtml(subject) {
    const list = subjectIdx(subject).slice().sort((a, b) => b.uploadedAt - a.uploadedAt);
    if (!list.length) return '<div style="font-size:12px;color:#9A9AAB;padding:4px 0">暂无资料</div>';
    return '<div style="display:flex;flex-direction:column;gap:6px">' + list.map(e => `
      <div style="display:flex;align-items:center;gap:8px;background:#FAFAF7;border:1px solid #EEE;border-radius:10px;padding:7px 10px">
        <span style="font-size:18px">${fileIcon(e.type, e.name)}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:#3A3A4E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.name)}</div>
          <div style="font-size:10px;color:#9A9AAB">${fmtSize(e.size)} · ${new Date(e.uploadedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${e.storage === 'inline' ? ' · 本机' : ''}</div>
        </div>
        ${isViewable(e.type) ? `<button class="btn-sm btn-green" data-smat-view="${e.id}" data-smat-s="${esc(subject)}">👁</button>` : ''}
        <button class="btn-sm btn-yellow" data-smat-dl="${e.id}" data-smat-s="${esc(subject)}">⬇</button>
        <button class="btn-sm btn-gray" data-smat-rm="${e.id}" data-smat-s="${esc(subject)}">🗑</button>
      </div>`).join('') + '</div>';
  }

  function openSubjectPanel(subject, emoji) {
    const hasCloud = !!ghCfg();
    window.openModal(`
      <div style="padding:14px 16px;border-bottom:1px solid #eee;background:linear-gradient(135deg,#FFD6A5,#FFB6D9)">
        <div style="font-size:16px;font-weight:800;color:#8B4A2A">${emoji} ${esc(subject)} · 科目资料</div>
        <div style="font-size:12px;color:#A06A4A;margin-top:3px">该科目全部资料（课件 / 音频 / 练习 / 拓展阅读…），不限于某一节课</div>
      </div>
      <div style="padding:14px 16px;max-height:56vh;overflow-y:auto">
        ${hasCloud ? '' : `<div class="alert alert-warn" style="margin-bottom:10px"><span class="alert-emoji">💡</span>
          <div>当前为<b>本机内联存储</b>（单文件 ≤300KB）。在「设备同步」页配置 GitHub 云端后，可上传 20MB 以内的大文件并多设备共享。</div></div>`}
        <div id="smatList">${subjectFileListHtml(subject)}</div>
        <label style="display:inline-flex;align-items:center;gap:5px;margin:12px 0 4px;padding:6px 14px;border-radius:999px;background:var(--pink);color:#8B2A5B;font-size:13px;font-weight:700;cursor:pointer">
          ＋ 上传到本科目<input type="file" multiple hidden id="smatUp">
        </label>
      </div>
      <div class="act-foot">
        <button class="btn-sm btn-gray" data-back-list>← 返回科目列表</button>
        <button class="btn-sm btn-gray" data-back>关闭</button>
      </div>
    `);

    const modal = document.querySelector('#modalLayer');
    modal.querySelector('[data-back]').addEventListener('click', () => window.closeModal());
    modal.querySelector('[data-back-list]').addEventListener('click', () => openSubjectBrowser());

    const bindList = () => {
      modal.querySelectorAll('[data-smat-view]').forEach(b => b.addEventListener('click', () => {
        const e = subjectIdx(b.dataset.smatS).find(x => x.id === b.dataset.smatView);
        if (e) view(e);
      }));
      modal.querySelectorAll('[data-smat-dl]').forEach(b => b.addEventListener('click', () => {
        const e = subjectIdx(b.dataset.smatS).find(x => x.id === b.dataset.smatDl);
        if (e) download(e);
      }));
      modal.querySelectorAll('[data-smat-rm]').forEach(b => b.addEventListener('click', async () => {
        await removeSubject(b.dataset.smatS, b.dataset.smatRm);
        const box = modal.querySelector('#smatList');
        if (box) { box.innerHTML = subjectFileListHtml(b.dataset.smatS); bindList(); }
      }));
    };
    bindList();

    const inp = modal.querySelector('#smatUp');
    if (inp) inp.addEventListener('change', async () => {
      const files = Array.from(inp.files || []);
      inp.value = '';
      if (!files.length) return;
      for (const f of files) {
        toast('正在上传：' + f.name);
        try { await uploadSubject(subject, f); }
        catch (e) { alert(f.name + '\n' + e.message); }
      }
      const box = modal.querySelector('#smatList');
      if (box) { box.innerHTML = subjectFileListHtml(subject); bindList(); }
      toast('上传完成 ✅ 记得点右上角 💾 保存，同步到其他设备');
    });
  }

  function openSubjectBrowser() {
    const custom = Object.keys(st().subjectMaterials || {})
      .filter(n => !SUBJECTS.some(s => s.name === n))
      .sort();
    const all = SUBJECTS.concat(custom.map(n => ({ name: n, emoji: '📚' })));

    const grid = all.map(s => {
      const n = subjectIdx(s.name).length;
      return `<button data-smat-open="${esc(s.name)}" data-smat-emoji="${s.emoji}"
        style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 6px;background:#fff;border:1px solid #EEE;border-radius:12px;cursor:pointer">
        <span style="font-size:24px">${s.emoji}</span>
        <span style="font-size:12px;font-weight:700;color:#3A3A4E">${esc(s.name)}</span>
        <span style="font-size:10px;color:${n ? '#C75A92' : '#9A9AAB'};font-weight:700">${n ? n + ' 个文件' : '空'}</span>
      </button>`;
    }).join('');

    window.openModal(`
      <div style="padding:14px 16px;border-bottom:1px solid #eee;background:linear-gradient(135deg,#FFD6A5,#B5EAD7)">
        <div style="font-size:16px;font-weight:800;color:#6B4A2A">📚 科目资料库</div>
        <div style="font-size:12px;color:#7A6A4A;margin-top:3px">按科目归档的长期资料，点击科目进入上传 / 查阅 / 下载 / 删除</div>
      </div>
      <div style="padding:14px 16px;max-height:56vh;overflow-y:auto">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:8px">${grid}</div>
        <button id="smatAddSubject" style="margin-top:12px;width:100%;padding:9px;border-radius:999px;background:rgba(0,0,0,.05);color:#5A5A6E;font-size:13px;font-weight:700;cursor:pointer;border:1px dashed #CCC">＋ 新增自定义科目</button>
      </div>
      <div class="act-foot"><button class="btn-sm btn-gray" data-back>关闭</button></div>
    `);

    const modal = document.querySelector('#modalLayer');
    modal.querySelector('[data-back]').addEventListener('click', () => window.closeModal());
    modal.querySelectorAll('[data-smat-open]').forEach(b => b.addEventListener('click', () => {
      openSubjectPanel(b.dataset.smatOpen, b.dataset.smatEmoji || '📚');
    }));
    const addBtn = modal.querySelector('#smatAddSubject');
    if (addBtn) addBtn.addEventListener('click', () => {
      const name = prompt('输入新科目名称（如：编程、围棋、钢琴）：');
      if (!name || !name.trim()) return;
      const t = name.trim().slice(0, 12);
      if (st().subjectMaterials && st().subjectMaterials[t] !== undefined) {
        toast('科目已存在'); return;
      }
      setSubjectIdx(t, []);
      window.SyncAPI.saveData(st());
      if (window.appMarkDirty) window.appMarkDirty();
      openSubjectBrowser();
      openSubjectPanel(t, '📚');
    });
  }

  // ============ 暴露 ============
  window.Materials = {
    count: (dateKey, period) => idx(dateKey, period).length,
    subjectCount: s => subjectIdx(s).length,
    openPanel,
    openBrowser,
    openSubjectBrowser,
    openSubjectPanel,
  };
})();
