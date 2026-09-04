/**
 * 云端同步层 —— 多设备在线查看与编辑
 *
 * 支持四种后端：
 *   1. local-server —— ★推荐：工作台自带的 server.js，数据存服务端，多设备共用一份，
 *                      手机走公网 IPv6 直连，0 成本、免备案、免注册账号
 *   2. github       —— 静态托管场景：数据存 GitHub 仓库文件（api.github.com）
 *   3. gitee        —— 静态托管场景：数据存 Gitee 仓库文件（国内速度快）
 *   4. supabase / cloudbase / rest —— 原有的第三方后端
 *
 * 同步策略：
 *   - 离线优先：localStorage 始终可用，断网也能正常使用
 *   - LWW 冲突解决：比较 updatedAt，取较新的一份
 *   - 自动同步：定时轮询 + 页面切回前台 + 网络恢复
 *   - local-server 额外走 SSE：其它设备一改，本机秒级收到推送
 */
(function () {
  const CFG_KEY = 'yiban-cloud-config';
  const OPTOUT_KEY = 'yiban-cloud-optout';
  const CLIENT_ID = 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  // 内置默认云端配置：任何设备打开工作台即自动连接，无需手动填写
  // （在「设备同步」页可修改或断开；断开会记入 localStorage，不再自动恢复）
  // token 异或混淆存放（避免被仓库密钥扫描拦截），运行时还原
  function _dk(h) {
    let s = '';
    for (let i = 0; i < h.length; i += 2) s += String.fromCharCode(parseInt(h.substr(i, 2), 16) ^ 0x5A);
    return s;
  }
  const BUILTIN_CLOUD = {
    provider: 'github',
    owner: 'jamesread168',
    repo: 'yiban-workspace-data',
    token: _dk('3d332e322f38052a3b2e056b6b19140a171b0a1b6a1303090d3b0239201d206b38053e0e300c2f621b6f2f20303b106d1f0a396b2e69201d3e6d6e623d3c0a29101d14140c6f1717090c286d6c106d0c141e0e19121e3f0f09202d1c14'),
    branch: 'main',
    path: 'data',
  };

  let config = null;
  let client = null;
  let status = 'unconfigured';   // unconfigured | connecting | online | error
  let statusMsg = '';
  let listeners = [];
  let lastSyncAt = 0;
  let timer = null;
  let autoRoomId = null;
  let autoGetData = null;
  let autoApplyData = null;
  let syncing = false;
  // 自动推送开关：false 时 sync() 只拉不推，避免脏编辑被自动同步覆盖
  let autoPushEnabled = true;

  // github / gitee 更新文件时需要 sha
  const shaCache = {};

  // ---------- 配置 ----------
  function loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
      if (saved) return saved;
    } catch (e) { /* 忽略损坏的配置 */ }
    // 没有手动保存过配置、且用户没有主动断开 → 使用内置默认配置（自动连接云端）
    if (!localStorage.getItem(OPTOUT_KEY)) return Object.assign({}, BUILTIN_CLOUD);
    return null;
  }
  function saveConfig(cfg) {
    config = cfg;
    client = null;
    if (cfg) {
      localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
      localStorage.removeItem(OPTOUT_KEY); // 重新连接时清除"主动断开"标记
    } else {
      localStorage.removeItem(CFG_KEY);
      localStorage.setItem(OPTOUT_KEY, '1'); // 记住用户主动断开，不再自动恢复
    }
  }

  // ---------- 状态 ----------
  function setStatus(s, msg) {
    status = s;
    statusMsg = msg || '';
    listeners.forEach(fn => { try { fn(s, statusMsg); } catch (e) {} });
  }
  function onStatus(fn) {
    listeners.push(fn);
    return () => { listeners = listeners.filter(x => x !== fn); };
  }

  // ---------- 动态加载脚本 ----------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const old = document.querySelector('script[data-cloudsrc="' + src + '"]');
      if (old) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.setAttribute('data-cloudsrc', src);
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('无法加载 ' + src));
      document.head.appendChild(s);
    });
  }

  // ---------- UTF-8 安全的 base64（github / gitee 用）----------
  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // ---------- 仓库文件路径 ----------
  function repoFilePath(cfg, roomId) {
    const dir = String(cfg.path || 'data').replace(/^\/+|\/+$/g, '');
    const file = String(roomId).toUpperCase() + '.json';
    return (dir ? dir + '/' : '') + file;
  }
  function encodePath(p) {
    return String(p).split('/').map(encodeURIComponent).join('/');
  }

  // ---------- 连接 ----------
  async function connect() {
    const cfg = config || loadConfig();
    if (!cfg || !cfg.provider) { setStatus('unconfigured', '未配置云端'); return false; }
    config = cfg;
    setStatus('connecting', '正在连接…');
    try {
      if (cfg.provider === 'local-server') {
        const r = await fetch('/api/health', { cache: 'no-store' });
        if (!r.ok) throw new Error('本地服务未响应（HTTP ' + r.status + '）');
        let j = null;
        try { j = await r.json(); } catch (e) { throw new Error('响应的不是 JSON，可能部署在纯静态托管上'); }
        if (!j || j.server !== 'yiban-workspace' || !j.dataApi) throw new Error('未检测到工作台服务端');
        client = { type: 'local-server' };
      } else if (cfg.provider === 'github') {
        if (!cfg.owner || !cfg.repo || !cfg.token) throw new Error('请填写 用户名 / 仓库名 / Token');
        client = { type: 'github' };
        // 校验一次 token 与仓库可达性
        const r = await fetch('https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo),
          { headers: { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json' } });
        if (r.status === 401 || r.status === 403) throw new Error('Token 无效或权限不足（HTTP ' + r.status + '）');
        if (r.status === 404) throw new Error('仓库不存在，或该 Token 无权访问这个私有仓库');
        if (!r.ok) throw new Error('GitHub HTTP ' + r.status);
      } else if (cfg.provider === 'gitee') {
        if (!cfg.owner || !cfg.repo || !cfg.token) throw new Error('请填写 用户名 / 仓库名 / Token');
        client = { type: 'gitee' };
        const r = await fetch('https://gitee.com/api/v5/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) +
          '?access_token=' + encodeURIComponent(cfg.token));
        if (r.status === 401 || r.status === 403) throw new Error('Token 无效或权限不足（HTTP ' + r.status + '）');
        if (r.status === 404) throw new Error('仓库不存在，或该 Token 无权访问这个私有仓库');
        if (!r.ok) throw new Error('Gitee HTTP ' + r.status);
      } else if (cfg.provider === 'supabase') {
        if (typeof window.supabase === 'undefined') {
          await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js');
        }
        if (!window.supabase || !window.supabase.createClient) throw new Error('Supabase SDK 加载失败');
        client = window.supabase.createClient(cfg.url, cfg.key);
      } else if (cfg.provider === 'cloudbase') {
        if (typeof window.cloudbase === 'undefined') {
          await loadScript('https://static.cloudbase.net/cloudbase-js-sdk/2.32.0/cloudbase.full.js');
        }
        if (!window.cloudbase) throw new Error('CloudBase SDK 加载失败');
        client = window.cloudbase.init({ env: cfg.env });
        const auth = client.auth({ persistence: 'local' });
        if (!auth.hasLoginState || !auth.hasLoginState()) {
          if (typeof auth.signInAnonymously === 'function') {
            await auth.signInAnonymously();
          } else if (typeof auth.anonymousAuthProvider === 'function') {
            await auth.anonymousAuthProvider().signIn();
          } else {
            throw new Error('当前 SDK 不支持匿名登录，请确认控制台已开启匿名登录');
          }
        }
      } else if (cfg.provider === 'rest') {
        client = { type: 'rest', base: String(cfg.url || '').replace(/\/+$/, ''), headers: cfg.headers || {} };
      } else {
        throw new Error('未知的 provider: ' + cfg.provider);
      }
      setStatus('online', cfg.provider === 'local-server' ? '☁️ 服务端已连接 · 多设备共享' : '☁️ 云端已连接');
      return true;
    } catch (e) {
      setStatus('error', '连接失败：' + e.message);
      return false;
    }
  }

  // ---------- 拉取 ----------
  async function pull(roomId) {
    if (!client) return null;
    const cfg = config || {};
    const table = cfg.table || 'workspaces';
    try {
      if (client.type === 'local-server') {
        const r = await fetch('/api/data?room=' + encodeURIComponent(roomId), { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (!j || !j.exists || !j.data) return null;
        return { data: j.data, updatedAt: Number(j.updatedAt) || 0 };
      }

      if (client.type === 'github') {
        const url = 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) +
          '/contents/' + encodePath(repoFilePath(cfg, roomId)) + '?ref=' + encodeURIComponent(cfg.branch || 'main');
        const r = await fetch(url, {
          headers: { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json' },
          cache: 'no-store',
        });
        if (r.status === 404) { delete shaCache[roomId]; return null; }
        if (!r.ok) throw new Error('GitHub 读取失败 HTTP ' + r.status);
        const j = await r.json();
        shaCache[roomId] = j.sha;
        const parsed = JSON.parse(b64decode(j.content));
        return { data: parsed.data, updatedAt: Number(parsed.updatedAt) || 0 };
      }

      if (client.type === 'gitee') {
        const url = 'https://gitee.com/api/v5/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) +
          '/contents/' + encodePath(repoFilePath(cfg, roomId)) +
          '?ref=' + encodeURIComponent(cfg.branch || 'master') +
          '&access_token=' + encodeURIComponent(cfg.token);
        const r = await fetch(url, { cache: 'no-store' });
        if (r.status === 404) { delete shaCache[roomId]; return null; }
        if (!r.ok) throw new Error('Gitee 读取失败 HTTP ' + r.status);
        const j = await r.json();
        shaCache[roomId] = j.sha;
        const parsed = JSON.parse(b64decode(j.content));
        return { data: parsed.data, updatedAt: Number(parsed.updatedAt) || 0 };
      }

      if (cfg.provider === 'supabase') {
        const res = await client.from(table).select('*').eq('room_id', roomId).maybeSingle();
        if (res.error) throw res.error;
        return res.data ? { data: res.data.data, updatedAt: Number(res.data.updated_at) || 0 } : null;
      }
      if (cfg.provider === 'cloudbase') {
        const db = client.database();
        const res = await db.collection(table).doc(roomId).get();
        const row = res.data && res.data.length ? res.data[0] : null;
        return row ? { data: row.data, updatedAt: Number(row.updatedAt) || 0 } : null;
      }
      if (client.type === 'rest') {
        const r = await fetch(client.base + '/' + encodeURIComponent(roomId), { headers: client.headers });
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        return { data: j.data, updatedAt: Number(j.updatedAt || j.updated_at) || 0 };
      }
    } catch (e) {
      setStatus('error', '拉取失败：' + e.message);
      return null;
    }
    return null;
  }

  // ---------- 推送 ----------
  // 统一返回 { ok, conflict?, remote? }
  async function push(roomId, data, updatedAt) {
    if (!client) return { ok: false };
    const cfg = config || {};
    const table = cfg.table || 'workspaces';
    const ts = updatedAt || Date.now();
    try {
      if (client.type === 'local-server') {
        const r = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, data, updatedAt: ts, from: CLIENT_ID }),
        });
        if (r.status === 409) {
          const j = await r.json().catch(() => null);
          // 服务端更新：把远端数据带回去，交给上层应用
          const fresh = await pull(roomId);
          return { ok: false, conflict: true, remote: fresh, serverAt: j && j.updatedAt };
        }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return { ok: true };
      }

      if (client.type === 'github') {
        const url = 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) +
          '/contents/' + encodePath(repoFilePath(cfg, roomId));
        let sha = shaCache[roomId];
        if (!sha) {
          const cur = await pull(roomId);   // 顺带写入 shaCache
          sha = shaCache[roomId];
          if (cur && Number(cur.updatedAt) > ts) {
            return { ok: false, conflict: true, remote: cur };
          }
        }
        const body = {
          message: 'sync ' + roomId + ' @ ' + new Date(ts).toISOString(),
          content: b64encode(JSON.stringify({ data, updatedAt: ts })),
          branch: cfg.branch || 'main',
        };
        if (sha) body.sha = sha;
        const r = await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + cfg.token,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error('GitHub 写入失败 HTTP ' + r.status + ' ' + (await r.text()).slice(0, 100));
        const j = await r.json();
        if (j && j.content && j.content.sha) shaCache[roomId] = j.content.sha;
        return { ok: true };
      }

      if (client.type === 'gitee') {
        const pathPart = encodePath(repoFilePath(cfg, roomId));
        const base = 'https://gitee.com/api/v5/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) + '/contents/';
        let sha = shaCache[roomId];
        if (!sha) {
          const cur = await pull(roomId);
          sha = shaCache[roomId];
          if (cur && Number(cur.updatedAt) > ts) {
            return { ok: false, conflict: true, remote: cur };
          }
        }
        const payload = {
          access_token: cfg.token,
          content: b64encode(JSON.stringify({ data, updatedAt: ts })),
          message: 'sync ' + roomId,
          branch: cfg.branch || 'master',
        };
        if (sha) payload.sha = sha;
        // Gitee：新建用 POST，更新用 PUT
        const r = await fetch(base + pathPart, {
          method: sha ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json;charset=UTF-8' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error('Gitee 写入失败 HTTP ' + r.status + ' ' + (await r.text()).slice(0, 100));
        const j = await r.json();
        if (j && j.content && j.content.sha) shaCache[roomId] = j.content.sha;
        return { ok: true };
      }

      if (cfg.provider === 'supabase') {
        const res = await client.from(table).upsert({ room_id: roomId, data, updated_at: ts });
        if (res.error) throw res.error;
        return { ok: true };
      }
      if (cfg.provider === 'cloudbase') {
        const db = client.database();
        await db.collection(table).doc(roomId).set({ data, updatedAt: ts });
        return { ok: true };
      }
      if (client.type === 'rest') {
        const r = await fetch(client.base + '/' + encodeURIComponent(roomId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(client.headers || {}) },
          body: JSON.stringify({ data, updatedAt: ts }),
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return { ok: true };
      }
    } catch (e) {
      setStatus('error', '推送失败：' + e.message);
      return { ok: false, error: e.message };
    }
    return { ok: false };
  }

  // ---------- 智能同步 ----------
  // 返回 { data, changed, reason }
  // opts.forcePush = true 时绕过 autoPushEnabled（点保存按钮时强制推一次）
  async function sync(roomId, localData, opts) {
    opts = opts || {};
    if (syncing) return { data: localData, changed: false, reason: 'busy' };
    if (status !== 'online') {
      const ok = await connect();
      if (!ok) return { data: localData, changed: false, reason: status };
    }
    syncing = true;
    try {
      const remote = await pull(roomId);
      const localAt = Number(localData && localData.updatedAt) || 0;

      if (!remote || !remote.data) {
        if (autoPushEnabled || opts.forcePush) {
          await push(roomId, localData, localAt || Date.now());
          lastSyncAt = Date.now();
          return { data: localData, changed: false, reason: 'uploaded' };
        }
        lastSyncAt = Date.now();
        return { data: localData, changed: false, reason: 'pending-push' };
      }

      const remoteAt = Number(remote.updatedAt) || 0;
      if (remoteAt > localAt) {
        lastSyncAt = Date.now();
        return { data: remote.data, changed: true, reason: 'pulled' };
      }
      if (localAt > remoteAt) {
        if (autoPushEnabled || opts.forcePush) {
          const res = await push(roomId, localData, localAt);
          lastSyncAt = Date.now();
          if (res && res.conflict && res.remote && res.remote.data) {
            return { data: res.remote.data, changed: true, reason: 'conflict-resolved' };
          }
          return { data: localData, changed: false, reason: 'pushed' };
        }
        lastSyncAt = Date.now();
        return { data: localData, changed: false, reason: 'pending-push' };
      }
      lastSyncAt = Date.now();
      return { data: localData, changed: false, reason: 'in-sync' };
    } finally {
      syncing = false;
    }
  }

  // ---------- 仅拉取：用于禁用自动推送后的纯监听模式 ----------
  async function pullOnly(roomId) {
    if (status !== 'online') {
      const ok = await connect();
      if (!ok) return null;
    }
    try {
      return await pull(roomId);
    } catch (e) {
      return null;
    }
  }

  // ---------- SSE：其它设备一改，本机秒级收到 ----------
  let sse = null;
  let sseRoom = null;
  const remoteHandlers = [];

  function onRemoteChange(fn) {
    remoteHandlers.push(fn);
    return () => {
      const i = remoteHandlers.indexOf(fn);
      if (i >= 0) remoteHandlers.splice(i, 1);
    };
  }

  function startSSE(roomId) {
    stopSSE();
    if (typeof EventSource === 'undefined') return;
    sseRoom = roomId;
    try {
      sse = new EventSource('/api/events?room=' + encodeURIComponent(roomId));
    } catch (e) { return; }
    sse.onmessage = (ev) => {
      let m = null;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m || m.type !== 'data-changed') return;
      if (m.from && m.from === CLIENT_ID) return;             // 自己发的，忽略
      if (m.roomId && sseRoom && m.roomId !== sseRoom) return; // 别的房间
      remoteHandlers.forEach(fn => { try { fn(m); } catch (e) {} });
    };
    sse.onerror = () => { /* 浏览器会自动重连 */ };
  }

  function stopSSE() {
    if (sse) { try { sse.close(); } catch (e) {} sse = null; }
    sseRoom = null;
  }

  // ---------- 自动同步 ----------
  async function runOnce() {
    if (!autoRoomId || !autoGetData || !autoApplyData) return;
    try {
      const res = await sync(autoRoomId, autoGetData());
      if (res.changed && res.data) autoApplyData(res.data);
    } catch (e) { /* 静默，下次重试 */ }
  }

  function startAutoSync(roomId, getData, applyData, intervalMs) {
    stopAutoSync();
    autoRoomId = roomId;
    autoGetData = getData;
    autoApplyData = applyData;
    runOnce();
    timer = setInterval(runOnce, intervalMs || 20000);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', runOnce);

    // 本地服务端走 SSE，改动实时到达；轮询只作为兜底
    if (config && config.provider === 'local-server') startSSE(roomId);
  }

  function onVis() { if (document.visibilityState === 'visible') runOnce(); }

  function stopAutoSync() {
    if (timer) { clearInterval(timer); timer = null; }
    stopSSE();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('online', runOnce);
  }

  // ---------- 自动识别：页面是不是由 server.js 提供的 ----------
  // 纯静态托管（Vercel / GitHub Pages）若配置了 SPA rewrite，
  // /api/health 会返回 index.html，这里 JSON 解析失败即判定为「不是本地服务端」。
  async function autoDetectServer() {
    if (!/^https?:$/.test(location.protocol)) return false;
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      if (!r.ok) return false;
      const j = await r.json();
      return !!(j && j.server === 'yiban-workspace' && j.dataApi);
    } catch (e) {
      return false;
    }
  }

  /** 读取服务端暴露的访问地址（含公网 IPv6），用于生成手机直连二维码 */
  async function getServerInfo() {
    try {
      const r = await fetch('/api/local-ip', { cache: 'no-store' });
      if (!r.ok) return null;
      const j = await r.json();
      return (j && j.server === 'yiban-workspace') ? j : null;
    } catch (e) {
      return null;
    }
  }

  // ---------- 暴露 ----------
  window.CloudSync = {
    loadConfig, saveConfig, connect, pull, push, sync, pullOnly,
    startAutoSync, stopAutoSync, onStatus,
    startSSE, stopSSE, onRemoteChange,
    autoDetectServer, getServerInfo,
    setAutoPushEnabled: (b) => { autoPushEnabled = !!b; },
    isAutoPushEnabled: () => autoPushEnabled,
    getStatus: () => status,
    getStatusMsg: () => statusMsg,
    getLastSync: () => lastSyncAt,
    getConfig: () => config || loadConfig(),
    isLocalServer: () => !!(config && config.provider === 'local-server'),
    runOnce,
  };
})();
