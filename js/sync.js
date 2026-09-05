/**
 * 多设备协同模块
 *
 * 设计目标（不依赖后端服务）：
 *  1. 同设备跨标签页实时同步 —— 用 BroadcastChannel（同源策略）
 *  2. 不同设备间"数据迁移" —— 通过"同步码"导出/导入
 *  3. 房间号：识别一组协同设备（加入房间即可视为"同一个孩子的工作台"）
 *  4. 二维码：扫码即可打开工作台并自动加入同一个房间
 *
 * 数据格式（存 localStorage KEY = 'yiban-workspace'）：
 *   {
 *     version: 1,
 *     roomId: 'ABCD12',
 *     checkins: { 'YYYY-MM-DD': { arrive: ts, listen: ts, ... } },
 *     todos:    [ { id, text, done, date } ],
 *     streaks:  { currentDays, bestDays, lastDate },
 *     stars:    { total, today: { date, count } },
 *     updatedAt: timestamp
 *   }
 */

const STORAGE_KEY = 'yiban-workspace';
const ROOM_LEN = 6;
const CHANNEL_NAME = 'yiban-workspace-channel';

// 生成随机房间号
function genRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混的 I,O,1,0
  let s = '';
  for (let i = 0; i < ROOM_LEN; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// 默认空数据结构
function makeEmptyData(roomId) {
  return {
    version: 1,
    roomId,
    checkins: {},
    todos: [],
    streaks: { currentDays: 0, bestDays: 0, lastDate: '' },
    stars: { total: 0, today: { date: '', count: 0 } },
    updatedAt: Date.now(),
  };
}

// 读取本地存储
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const rid = genRoomId();
      const d = makeEmptyData(rid);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
      return d;
    }
    const data = JSON.parse(raw);
    if (!data.roomId) data.roomId = genRoomId();
    return data;
  } catch (e) {
    console.warn('loadData fallback', e);
    const rid = genRoomId();
    return makeEmptyData(rid);
  }
}

// 保存并通知
let bc = null;
function initBroadcastChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (bc) return bc;
  bc = new BroadcastChannel(CHANNEL_NAME);
  return bc;
}

// 保存并通知
// 重要：这里【绝不】刷新 data.updatedAt。
// updatedAt 是 LWW（最后写入者胜）的仲裁依据，只有「点保存 / 上传资料后同步」
// 这类真正推云端的动作才能改它（见 app.js 的 saveAll）。
// 若每次本地小编辑（打卡、勾待办）都刷时间戳，本机会永远"看起来比云端新"，
// 结果：其他设备的新数据拉不进来，还会被本机这份旧数据反覆盖。
function saveData(data, opts = {}) {
  if (opts.bumpTs) data.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // 广播变更给同源其它标签页
  const ch = initBroadcastChannel();
  if (ch && !opts.silent) {
    ch.postMessage({ type: 'data-changed', payload: serializeForSync(data) });
  }
  return data;
}

// 序列化为紧凑字符串（用于跨设备"同步码"）
function serializeForSync(data) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}
function deserializeFromSync(str) {
  try {
    const json = decodeURIComponent(escape(atob(str)));
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

// 应用数据变化（从其它来源收到时调用）
function applyRemoteData(remote) {
  if (!remote || typeof remote !== 'object') return false;
  const local = loadData();
  // 保留本地更新的房间号，但合并数据：以更新的为准
  const merged = { ...local, ...remote, roomId: local.roomId };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return true;
}

// 订阅来自其它标签页的更新
function subscribeCrossTab(onUpdate) {
  const ch = initBroadcastChannel();
  if (!ch) return () => {};
  const handler = (ev) => {
    if (ev.data && ev.data.type === 'data-changed') {
      const remote = ev.data.payload;
      onUpdate(remote);
    }
  };
  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}

// 暴露 API
window.SyncAPI = {
  loadData,
  saveData,
  applyRemoteData,
  subscribeCrossTab,
  serializeForSync,
  deserializeFromSync,
  genRoomId,
  makeEmptyData,
};
