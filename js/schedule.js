/**
 * 一（6）班课程表 — 支持「周覆盖」机制
 *
 * 工作原理：
 *  - DEFAULT_SCHEDULE：常规课表（周一-周五，2026-2027 学年默认值）
 *  - WEEK_OVERRIDES：周级覆盖，key = 该周周一的日期 YYYY-MM-DD
 *  - getDaySchedule(date)：根据日期自动返回默认或覆盖
 *
 * 老师/家长无需改代码：
 *  - 「上传课表」UI 会创建/更新 WEEK_OVERRIDES
 *  - 没有覆盖的周自动用默认课表
 *  - 当前周使用临时课表时，工作台会显示提示
 */

// ============ 默认课表（常规） ============
const DEFAULT_SCHEDULE = {
  1: [ // 周一
    { period: '升旗/阳光体育', start: '08:00', end: '08:50', name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
    { period: '第1节', start: '08:55', end: '09:35', name: '班队会/心理健康', emoji: '💗', subject: '班会' },
    { period: '第2节', start: '09:45', end: '10:25', name: '英语', emoji: '🔤', subject: '英语' },
    { period: '眼保健操', start: '10:25', end: '10:30', name: '眼保健操', emoji: '👀', isBreak: true },
    { period: '第3节', start: '10:40', end: '11:20', name: '语文', emoji: '📖', subject: '语文' },
    { period: '第4节', start: '11:30', end: '12:10', name: '体育与健康', emoji: '⚽', subject: '体育' },
    { period: '午餐午休', start: '12:10', end: '14:00', name: '午餐午休', emoji: '🍱', isBreak: true },
    { period: '第5节', start: '14:10', end: '14:50', name: '数学', emoji: '🔢', subject: '数学' },
    { period: '眼保健操', start: '14:50', end: '14:55', name: '眼保健操', emoji: '👀', isBreak: true },
    { period: '第6节', start: '15:05', end: '15:45', name: '美术', emoji: '🎨', subject: '美术' },
  ],
  2: [ // 周二
    { period: '升旗/阳光体育', start: '08:00', end: '08:50', name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
    { period: '第1节', start: '08:55', end: '09:35', name: '语文', emoji: '📖', subject: '语文' },
    { period: '第2节', start: '09:45', end: '10:25', name: '语文', emoji: '📖', subject: '语文' },
    { period: '眼保健操', start: '10:25', end: '10:30', name: '眼保健操', emoji: '👀', isBreak: true },
    { period: '第3节', start: '10:40', end: '11:20', name: '体育与健康', emoji: '⚽', subject: '体育' },
    { period: '第4节', start: '11:30', end: '12:10', name: '劳动', emoji: '🧹', subject: '劳动' },
    { period: '午餐午休', start: '12:10', end: '14:00', name: '午餐午休', emoji: '🍱', isBreak: true },
    { period: '第5节', start: '14:10', end: '14:50', name: '音乐', emoji: '🎵', subject: '音乐' },
    { period: '眼保健操', start: '14:50', end: '14:55', name: '眼保健操', emoji: '👀', isBreak: true },
    { period: '第6节', start: '15:05', end: '15:45', name: '道德与法治', emoji: '⚖️', subject: '道德' },
  ],
  3: [ // 周三
    { period: '升旗/阳光体育', start: '08:00', end: '08:50', name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
    { period: '第1节', start: '08:55', end: '09:35', name: '语文', emoji: '📖', subject: '语文' },
    { period: '第2节', start: '09:45', end: '10:25', name: '美术', emoji: '🎨', subject: '美术' },
    { period: '眼保健操', start: '10:25', end: '10:30', name: '眼保健操', emoji: '👀', isBreak: true },
    { period: '第3节', start: '10:40', end: '11:20', name: '数学', emoji: '🔢', subject: '数学' },
    { period: '第4节', start: '11:30', end: '12:10', name: '书法', emoji: '✍️', subject: '书法' },
    { period: '午餐午休', start: '12:10', end: '14:00', name: '午餐午休', emoji: '🍱', isBreak: true },
    { period: '第5节', start: '14:10', end: '14:50', name: '英语', emoji: '🔤', subject: '英语' },
    { period: '眼保健操', start: '14:50', end: '14:55', name: '眼保健操', emoji: '👀', isBreak: true },
    { period: '第6节', start: '15:05', end: '15:45', name: '道德与法治', emoji: '⚖️', subject: '道德' },
  ],
  4: [ // 周四
    { period: '升旗/阳光体育', start: '08:00', end: '08:50', name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
    { period: '第1节', start: '08:55', end: '09:35', name: '语文', emoji: '📖', subject: '语文' },
    { period: '第2节', start: '09:45', end: '10:25', name: '体育与健康', emoji: '⚽', subject: '体育' },
    { period: '眼保健操', start: '10:25', end: '10:30', name: '眼保健操', emoji: '👀', isBreak: true },
    { period: '第3节', start: '10:40', end: '11:20', name: '语文', emoji: '📖', subject: '语文' },
    { period: '第4节', start: '11:30', end: '12:10', name: '综合实践', emoji: '🛠️', subject: '实践' },
    { period: '午餐午休', start: '12:10', end: '14:00', name: '午餐午休', emoji: '🍱', isBreak: true },
    { period: '第5节', start: '14:10', end: '14:50', name: '数学', emoji: '🔢', subject: '数学' },
    { period: '眼保健操', start: '14:50', end: '14:55', name: '眼保健操', emoji: '👀', isBreak: true },
    { period: '第6节', start: '15:05', end: '15:45', name: '英语', emoji: '🔤', subject: '英语' },
  ],
  5: [ // 周五
    { period: '升旗/阳光体育', start: '08:00', end: '08:50', name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
    { period: '第1节', start: '08:55', end: '09:35', name: '科学', emoji: '🔬', subject: '科学' },
    { period: '第2节', start: '09:45', end: '10:25', name: '语文', emoji: '📖', subject: '语文' },
    { period: '眼保健操', start: '10:25', end: '10:30', name: '眼保健操', emoji: '👀', isBreak: true },
    { period: '第3节', start: '10:40', end: '11:20', name: '语文', emoji: '📖', subject: '语文' },
    { period: '第4节', start: '11:30', end: '12:10', name: '音乐', emoji: '🎵', subject: '音乐' },
    { period: '午餐午休', start: '12:10', end: '14:00', name: '午餐午休', emoji: '🍱', isBreak: true },
    { period: '第5节', start: '14:10', end: '14:50', name: '体育与健康', emoji: '⚽', subject: '体育' },
    { period: '眼保健操', start: '14:50', end: '14:55', name: '眼保健操', emoji: '👀', isBreak: true },
    { period: '第6节', start: '15:05', end: '15:45', name: '围棋', emoji: '♟️', subject: '围棋' },
  ],
};

// ============ 周覆盖（用户上传的临时课表） ============
const WEEK_OVERRIDES = {
  // 2026-2027 学年第一学期 第 1 周临时课表（8.31 ~ 9.4）
  // 周一 8.31：开学前一天，整日无课
  // 周二 9.1：开学第一课（"开学第一课"代替常规第一周的"班队会/心理健康"）
  // 周三-五：9.2 起正常（但第2节 周三=语文 与默认的"美术"不同）
  '2026-08-31': {
    1: [], // 周一：8月31日 整日不安排课程
    2: [
      { period: '升旗/阳光体育', start: '08:00', end: '08:50', name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
      { period: '第1节', start: '08:55', end: '09:35', name: '开学第一课', emoji: '🎉', subject: '开学' },
      { period: '第2节', start: '09:45', end: '10:25', name: '语文', emoji: '📖', subject: '语文' },
      { period: '眼保健操', start: '10:25', end: '10:30', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第3节', start: '10:40', end: '11:20', name: '体育与健康', emoji: '⚽', subject: '体育' },
      { period: '第4节', start: '11:30', end: '12:10', name: '劳动', emoji: '🧹', subject: '劳动' },
      { period: '午餐午休', start: '12:10', end: '14:00', name: '午餐午休', emoji: '🍱', isBreak: true },
      { period: '第5节', start: '14:10', end: '14:50', name: '音乐', emoji: '🎵', subject: '音乐' },
      { period: '眼保健操', start: '14:50', end: '14:55', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第6节', start: '15:05', end: '15:45', name: '道德与法治', emoji: '⚖️', subject: '道德' },
    ],
    3: [
      { period: '升旗/阳光体育', start: '08:00', end: '08:50', name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
      { period: '第1节', start: '08:55', end: '09:35', name: '语文', emoji: '📖', subject: '语文' },
      { period: '第2节', start: '09:45', end: '10:25', name: '语文', emoji: '📖', subject: '语文' },
      { period: '眼保健操', start: '10:25', end: '10:30', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第3节', start: '10:40', end: '11:20', name: '数学', emoji: '🔢', subject: '数学' },
      { period: '第4节', start: '11:30', end: '12:10', name: '书法', emoji: '✍️', subject: '书法' },
      { period: '午餐午休', start: '12:10', end: '14:00', name: '午餐午休', emoji: '🍱', isBreak: true },
      { period: '第5节', start: '14:10', end: '14:50', name: '英语', emoji: '🔤', subject: '英语' },
      { period: '眼保健操', start: '14:50', end: '14:55', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第6节', start: '15:05', end: '15:45', name: '道德与法治', emoji: '⚖️', subject: '道德' },
    ],
    4: [
      { period: '升旗/阳光体育', start: '08:00', end: '08:50', name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
      { period: '第1节', start: '08:55', end: '09:35', name: '语文', emoji: '📖', subject: '语文' },
      { period: '第2节', start: '09:45', end: '10:25', name: '体育与健康', emoji: '⚽', subject: '体育' },
      { period: '眼保健操', start: '10:25', end: '10:30', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第3节', start: '10:40', end: '11:20', name: '语文', emoji: '📖', subject: '语文' },
      { period: '第4节', start: '11:30', end: '12:10', name: '综合实践', emoji: '🛠️', subject: '实践' },
      { period: '午餐午休', start: '12:10', end: '14:00', name: '午餐午休', emoji: '🍱', isBreak: true },
      { period: '第5节', start: '14:10', end: '14:50', name: '数学', emoji: '🔢', subject: '数学' },
      { period: '眼保健操', start: '14:50', end: '14:55', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第6节', start: '15:05', end: '15:45', name: '英语', emoji: '🔤', subject: '英语' },
    ],
    5: [
      { period: '升旗/阳光体育', start: '08:00', end: '08:50', name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
      { period: '第1节', start: '08:55', end: '09:35', name: '科学', emoji: '🔬', subject: '科学' },
      { period: '第2节', start: '09:45', end: '10:25', name: '语文', emoji: '📖', subject: '语文' },
      { period: '眼保健操', start: '10:25', end: '10:30', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第3节', start: '10:40', end: '11:20', name: '语文', emoji: '📖', subject: '语文' },
      { period: '第4节', start: '11:30', end: '12:10', name: '音乐', emoji: '🎵', subject: '音乐' },
      { period: '午餐午休', start: '12:10', end: '14:00', name: '午餐午休', emoji: '🍱', isBreak: true },
      { period: '第5节', start: '14:10', end: '14:50', name: '体育与健康', emoji: '⚽', subject: '体育' },
      { period: '眼保健操', start: '14:50', end: '14:55', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第6节', start: '15:05', end: '15:45', name: '音乐', emoji: '🎵', subject: '音乐' },
    ],
  },

  // 2026-2027 学年第一学期 第 2 周临时课表（9.7 ~ 9.11）
  // 与默认课表相比：周一第6节 美术→音乐；周五第4节 音乐→美术
  '2026-09-07': {
    1: [ // 周一
      { period: '升旗/阳光体育', start: '08:00', end: '08:50', name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
      { period: '第1节', start: '08:55', end: '09:35', name: '班队会/心理健康', emoji: '💗', subject: '班会' },
      { period: '第2节', start: '09:45', end: '10:25', name: '英语', emoji: '🔤', subject: '英语' },
      { period: '眼保健操', start: '10:25', end: '10:30', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第3节', start: '10:40', end: '11:20', name: '语文', emoji: '📖', subject: '语文' },
      { period: '第4节', start: '11:30', end: '12:10', name: '体育与健康', emoji: '⚽', subject: '体育' },
      { period: '午餐午休', start: '12:10', end: '14:00', name: '午餐午休', emoji: '🍱', isBreak: true },
      { period: '第5节', start: '14:10', end: '14:50', name: '数学', emoji: '🔢', subject: '数学' },
      { period: '眼保健操', start: '14:50', end: '14:55', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第6节', start: '15:05', end: '15:45', name: '音乐', emoji: '🎵', subject: '音乐' },
    ],
    2: [ // 周二
      { period: '升旗/阳光体育', start: '08:00', end: '08:50', name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
      { period: '第1节', start: '08:55', end: '09:35', name: '语文', emoji: '📖', subject: '语文' },
      { period: '第2节', start: '09:45', end: '10:25', name: '语文', emoji: '📖', subject: '语文' },
      { period: '眼保健操', start: '10:25', end: '10:30', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第3节', start: '10:40', end: '11:20', name: '体育与健康', emoji: '⚽', subject: '体育' },
      { period: '第4节', start: '11:30', end: '12:10', name: '劳动', emoji: '🧹', subject: '劳动' },
      { period: '午餐午休', start: '12:10', end: '14:00', name: '午餐午休', emoji: '🍱', isBreak: true },
      { period: '第5节', start: '14:10', end: '14:50', name: '音乐', emoji: '🎵', subject: '音乐' },
      { period: '眼保健操', start: '14:50', end: '14:55', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第6节', start: '15:05', end: '15:45', name: '道德与法治', emoji: '⚖️', subject: '道德' },
    ],
    3: [ // 周三
      { period: '升旗/阳光体育', start: '08:00', end: '08:50', name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
      { period: '第1节', start: '08:55', end: '09:35', name: '语文', emoji: '📖', subject: '语文' },
      { period: '第2节', start: '09:45', end: '10:25', name: '美术', emoji: '🎨', subject: '美术' },
      { period: '眼保健操', start: '10:25', end: '10:30', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第3节', start: '10:40', end: '11:20', name: '数学', emoji: '🔢', subject: '数学' },
      { period: '第4节', start: '11:30', end: '12:10', name: '书法', emoji: '✍️', subject: '书法' },
      { period: '午餐午休', start: '12:10', end: '14:00', name: '午餐午休', emoji: '🍱', isBreak: true },
      { period: '第5节', start: '14:10', end: '14:50', name: '英语', emoji: '🔤', subject: '英语' },
      { period: '眼保健操', start: '14:50', end: '14:55', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第6节', start: '15:05', end: '15:45', name: '道德与法治', emoji: '⚖️', subject: '道德' },
    ],
    4: [ // 周四
      { period: '升旗/阳光体育', start: '08:00', end: '08:50', name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
      { period: '第1节', start: '08:55', end: '09:35', name: '语文', emoji: '📖', subject: '语文' },
      { period: '第2节', start: '09:45', end: '10:25', name: '体育与健康', emoji: '⚽', subject: '体育' },
      { period: '眼保健操', start: '10:25', end: '10:30', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第3节', start: '10:40', end: '11:20', name: '语文', emoji: '📖', subject: '语文' },
      { period: '第4节', start: '11:30', end: '12:10', name: '综合实践', emoji: '🛠️', subject: '实践' },
      { period: '午餐午休', start: '12:10', end: '14:00', name: '午餐午休', emoji: '🍱', isBreak: true },
      { period: '第5节', start: '14:10', end: '14:50', name: '数学', emoji: '🔢', subject: '数学' },
      { period: '眼保健操', start: '14:50', end: '14:55', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第6节', start: '15:05', end: '15:45', name: '英语', emoji: '🔤', subject: '英语' },
    ],
    5: [ // 周五
      { period: '升旗/阳光体育', start: '08:00', end: '08:50', name: '升旗/阳光体育', emoji: '🚩', isActivity: true },
      { period: '第1节', start: '08:55', end: '09:35', name: '科学', emoji: '🔬', subject: '科学' },
      { period: '第2节', start: '09:45', end: '10:25', name: '语文', emoji: '📖', subject: '语文' },
      { period: '眼保健操', start: '10:25', end: '10:30', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第3节', start: '10:40', end: '11:20', name: '语文', emoji: '📖', subject: '语文' },
      { period: '第4节', start: '11:30', end: '12:10', name: '美术', emoji: '🎨', subject: '美术' },
      { period: '午餐午休', start: '12:10', end: '14:00', name: '午餐午休', emoji: '🍱', isBreak: true },
      { period: '第5节', start: '14:10', end: '14:50', name: '体育与健康', emoji: '⚽', subject: '体育' },
      { period: '眼保健操', start: '14:50', end: '14:55', name: '眼保健操', emoji: '👀', isBreak: true },
      { period: '第6节', start: '15:05', end: '15:45', name: '围棋', emoji: '♟️', subject: '围棋' },
    ],
  },
};

// 打卡项配置
const CHECKIN_ITEMS = [
  { id: 'arrive', name: '到校打卡', emoji: '🏫', desc: '8:00 前', timeStart: '06:00', timeEnd: '08:30', stars: 1 },
  { id: 'listen', name: '认真听课', emoji: '👂', desc: '上课中', timeStart: '08:55', timeEnd: '15:45', stars: 2 },
  { id: 'eye', name: '做眼保健操', emoji: '👀', desc: '10:25 / 14:50', timeStart: '10:20', timeEnd: '15:00', stars: 1 },
  { id: 'read', name: '课外阅读', emoji: '📚', desc: '晚上', timeStart: '17:00', timeEnd: '22:00', stars: 2 },
  { id: 'homework', name: '完成作业', emoji: '✏️', desc: '下午', timeStart: '15:45', timeEnd: '21:00', stars: 2 },
  { id: 'sleep', name: '早睡早起', emoji: '😴', desc: '21:30前', timeStart: '19:00', timeEnd: '21:30', stars: 1 },
];

// ============ 工具函数 ============
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function ymd(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

// 计算某日期所在周的周一（date: Date 对象）
function getMondayOfWeek(date) {
  const d = new Date(date);
  const dow = d.getDay() || 7; // 周日=0 转为 7
  d.setDate(d.getDate() - dow + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 获取某周(周一)对应的课表：返回 {schedule, overridden, key}
function getWeekScheduleByMonday(monday) {
  const key = ymd(monday);
  if (WEEK_OVERRIDES[key]) return { schedule: WEEK_OVERRIDES[key], overridden: true, key };
  return { schedule: DEFAULT_SCHEDULE, overridden: false, key: null };
}

// 核心 API：取某天的课表（自动选择默认/覆盖）
function getDaySchedule(date) {
  if (!date) date = new Date();
  const d = date.getDay();
  if (d === 0 || d === 6) return []; // 周末
  const monday = getMondayOfWeek(date);
  const { schedule } = getWeekScheduleByMonday(monday);
  return schedule[d] || [];
}

// 兼容旧 API
function getTodaySchedule() { return getDaySchedule(new Date()); }

// 获取当前时间段信息
function getNowScheduleStatus() {
  const now = new Date();
  const today = getDaySchedule(now);
  const curMin = now.getHours() * 60 + now.getMinutes();
  if (today.length === 0) return { current: null, next: null, state: 'weekend' };
  let current = null, next = null;
  for (let i = 0; i < today.length; i++) {
    const s = today[i];
    const start = timeToMin(s.start);
    const end = timeToMin(s.end);
    if (curMin >= start && curMin < end) {
      current = { ...s, index: i };
      if (today[i + 1]) next = { ...today[i + 1], index: i + 1 };
      break;
    }
    if (curMin < start && !next) next = { ...s, index: i };
  }
  if (!current && !next) return { current: null, next: null, state: 'after-school' };
  if (!current && next) {
    if (timeToMin(next.start) > timeToMin(today[0].start))
      return { current: null, next, state: 'before-school' };
  }
  if (current) {
    if (current.isBreak) return { current, next, state: 'break' };
    if (current.isActivity) return { current, next, state: 'morning-activity' };
    return { current, next, state: 'in-class' };
  }
  return { current: null, next, state: 'before-school' };
}

// 当前周是否使用临时课表
function isCurrentWeekOverridden() {
  const monday = getMondayOfWeek(new Date());
  return !!WEEK_OVERRIDES[ymd(monday)];
}
function getCurrentOverrideKey() {
  return ymd(getMondayOfWeek(new Date()));
}

// 周覆盖 CRUD（UI 用）
function saveWeekOverride(mondayDate, scheduleData) {
  const key = ymd(mondayDate);
  WEEK_OVERRIDES[key] = scheduleData;
}
function clearWeekOverride(mondayDate) {
  delete WEEK_OVERRIDES[ymd(mondayDate)];
}
function getAllOverrideKeys() {
  return Object.keys(WEEK_OVERRIDES).sort();
}

// 对比某周临时课表与默认课表的差异（用于 UI 特别提示）
function getWeekOverrideDiff(mondayDate) {
  const key = typeof mondayDate === 'string' ? mondayDate : ymd(mondayDate);
  const ov = WEEK_OVERRIDES[key];
  if (!ov) return [];
  const diffs = [];
  const dayNames = ['', '周一', '周二', '周三', '周四', '周五'];
  for (let d = 1; d <= 5; d++) {
    const def = DEFAULT_SCHEDULE[d] || [];
    const cur = ov[d] || [];
    const defMap = new Map(def.map(x => [x.period, x.name]));
    const curMap = new Map(cur.map(x => [x.period, x.name]));
    const allPeriods = Array.from(new Set([...defMap.keys(), ...curMap.keys()]));
    for (const period of allPeriods) {
      const a = defMap.get(period);
      const b = curMap.get(period);
      if (a !== b) {
        diffs.push({
          day: d,
          dayName: dayNames[d],
          period,
          defaultName: a || '(空)',
          overrideName: b || '(空)',
        });
      }
    }
  }
  return diffs;
}

// ============ 学期周历（学期课表查询用） ============
const SEMESTER = {
  name: '2026-2027学年 第一学期',
  start: '2026-08-31', // 第 1 周周一（8.31 报到，9.1 正式开学）
  end: '2027-01-31',   // 学期范围（覆盖到寒假前，仅用于计算周数）
};

// 学期内所有周的列表：[{no, monday, key, label, overridden}]
function getSemesterWeeks() {
  function semParse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  const start = semParse(SEMESTER.start);
  const end = semParse(SEMESTER.end);
  const weeks = [];
  const cur = new Date(start);
  while (cur <= end) {
    const key = ymd(cur);
    const sunday = new Date(cur.getTime() + 6 * 86400000);
    weeks.push({
      no: weeks.length + 1,
      monday: new Date(cur),
      key,
      label: (cur.getMonth() + 1) + '.' + cur.getDate() + ' - ' + (sunday.getMonth() + 1) + '.' + sunday.getDate(),
      overridden: !!WEEK_OVERRIDES[key],
    });
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

// 某日期是学期第几周（不在学期内返回 0）
function getSemesterWeekNo(date) {
  if (!date) date = new Date();
  const monday = getMondayOfWeek(date);
  const key = ymd(monday);
  const weeks = getSemesterWeeks();
  const w = weeks.find(x => x.key === key);
  return w ? w.no : 0;
}

// ============ 暴露到全局 ============
window.ScheduleData = DEFAULT_SCHEDULE;   // 兼容旧 API
window.DefaultSchedule = DEFAULT_SCHEDULE;
window.WeekOverrides = WEEK_OVERRIDES;
window.CheckinItems = CHECKIN_ITEMS;
window.getTodaySchedule = getTodaySchedule;
window.getNowScheduleStatus = getNowScheduleStatus;
window.getDaySchedule = getDaySchedule;
window.getWeekScheduleByMonday = getWeekScheduleByMonday;
window.getMondayOfWeek = getMondayOfWeek;
window.isCurrentWeekOverridden = isCurrentWeekOverridden;
window.getCurrentOverrideKey = getCurrentOverrideKey;
window.saveWeekOverride = saveWeekOverride;
window.clearWeekOverride = clearWeekOverride;
window.getAllOverrideKeys = getAllOverrideKeys;
window.getWeekOverrideDiff = getWeekOverrideDiff;
window.SEMESTER = SEMESTER;
window.getSemesterWeeks = getSemesterWeeks;
window.getSemesterWeekNo = getSemesterWeekNo;
window.ymd = ymd;
