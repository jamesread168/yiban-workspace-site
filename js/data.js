/**
 * 数据层 v2
 * 来源：
 *  - 深圳市教育局《2025-2026学年普通中小学校校历》
 *  - 教育部《义务教育课程方案和课程标准（2022年版）》
 *  - 统编版一年级上册教材（语文/数学/英语/道德与法治/科学）
 */

// ============ 深圳 2026-2027 学年校历 ============
// 第一学期：2026-09-01 开学（第一周周一是 8.31）
// 第二学期：2027-03-01 开学
const SZ_CALENDAR = {
  year: '2026-2027',
  totalWeeks: 39,          // 全学年教学时间
  newLessonWeeks: 35,      // 一至八年级新授课
  reviewWeeks: 2,          // 复习考试
  flexibleWeeks: 2,        // 学校机动
  semesters: [
    { name: '第一学期', start: '2026-09-01', end: '2027-01-23', week1: '2026-08-31 ~ 2026-09-06' },
    { name: '第二学期', start: '2027-03-01', end: '2027-07-10', week1: '2027-02-28 ~ 2027-03-06' },
  ],
  // 上学时间规定（深圳）：小学一般不早于 8:20
  earliestSchoolTime: '08:20',
  // 双减：小学一二年级不布置家庭书面作业
  noWrittenHomework: true,
  // 睡眠：小学生不晚于 21:20 就寝，每天 10 小时
  sleepTarget: 10,
  bedtime: '21:20',
};

// ============ 教材配套 ============
const TEXTBOOKS = [
  { subject: '语文', emoji: '📖', pub: '统编版', grade: '一年级上册', color: '#FFB6D9' },
  { subject: '数学', emoji: '🔢', pub: '统编版', grade: '一年级上册', color: '#A5D8FF' },
  { subject: '英语', emoji: '🔤', pub: '一年级上册', grade: 'SL版', color: '#FFE066' },
  { subject: '道德与法治', emoji: '⚖️', pub: '统编版', grade: '一年级上册', color: '#B5EAD7' },
  { subject: '科学', emoji: '🔬', pub: '教科版', grade: '一年级上册', color: '#C9B6FF' },
  { subject: '新华字典', emoji: '📕', pub: '商务印书馆', grade: '第13版', color: '#FF8B8B', isTool: true },
  { subject: '语文写字本', emoji: '📓', pub: '配套练习', grade: '×2 本', color: '#FFB570', isTool: true },
  { subject: '数学练习本', emoji: '📐', pub: '配套练习', grade: '×2 本/人', color: '#6BC9A8', isTool: true },
];

// ============ 一年级上册 写字表（会写 100 字，按单元） ============
const ZI_XIE = [
  { unit: '识字1 天地人', zi: ['一', '二', '三', '上'] },
  { unit: '识字2 金木水火土', zi: ['口', '目', '耳', '手'] },
  { unit: '识字3 口耳目', zi: ['日', '田', '禾', '火'] },
  { unit: '识字4 日月水火', zi: ['虫', '云', '山', '八', '十'] },
  { unit: '课文1 秋天', zi: ['了', '子', '人', '大'] },
  { unit: '课文2 小小的船', zi: ['月', '儿', '头', '里'] },
  { unit: '课文3 江南', zi: ['可', '东', '西'] },
  { unit: '课文4 四季', zi: ['天', '四', '是'] },
  { unit: '识字6 画', zi: ['水', '去', '来', '不'] },
  { unit: '识字7 大小多少', zi: ['小', '少', '牛', '果', '鸟'] },
  { unit: '识字8 小书包', zi: ['早', '书', '刀', '尺', '本'] },
  { unit: '识字9 日月明', zi: ['木', '林', '土', '力', '心'] },
  { unit: '识字10 升国旗', zi: ['中', '五', '立', '正'] },
  { unit: '课文5 影子', zi: ['在', '后', '我', '好'] },
  { unit: '课文6 比尾巴', zi: ['长', '比', '巴', '把'] },
  { unit: '课文7 青蛙写诗', zi: ['下', '个', '雨', '们'] },
  { unit: '课文8 雨点儿', zi: ['问', '有', '半', '从', '你'] },
  { unit: '课文9 明天要远足', zi: ['才', '明', '同', '学'] },
  { unit: '课文10 大还是小', zi: ['自', '己', '衣'] },
  { unit: '课文11 项链', zi: ['白', '的', '又', '和'] },
  { unit: '课文12 雪地里的小画家', zi: ['竹', '牙', '马', '用', '几'] },
  { unit: '课文13 乌鸦喝水', zi: ['只', '石', '多', '出', '见'] },
  { unit: '课文14 小蜗牛', zi: ['对', '妈', '全', '回'] },
];

// ============ 一年级上册 识字表（会认，选取常用） ============
const ZI_SHI = [
  '天','地','人','你','我','他','一','二','三','四','五','上','下','口','耳','目','手','足','站','坐',
  '日','月','水','火','山','石','田','禾','对','云','雨','风','花','鸟','虫','六','七','八','九','十',
  '了','子','人','大','月','儿','头','里','可','东','西','天','四','是','女','开','水','去','来','不',
  '小','少','牛','果','鸟','早','书','刀','尺','本','木','林','土','力','心','中','五','立','正','在',
  '后','我','好','长','比','巴','把','下','个','雨','们','问','有','半','从','你','才','明','同','学',
  '自','己','衣','白','的','又','和','竹','牙','马','用','几','只','石','多','出','见','对','妈','全','回','工','厂'
];

// 汉字信息库（拼音/部首/组词/英文）
const HZ_DATA = [
  { hz: '人', py: 'rén', bushou: '人', cizu: '大人 人民', en: 'person' },
  { hz: '口', py: 'kǒu', bushou: '口', cizu: '嘴巴 口水', en: 'mouth' },
  { hz: '手', py: 'shǒu', bushou: '扌', cizu: '手指 双手', en: 'hand' },
  { hz: '日', py: 'rì', bushou: '日', cizu: '日子 生日', en: 'sun/day' },
  { hz: '月', py: 'yuè', bushou: '月', cizu: '月亮 月饼', en: 'moon' },
  { hz: '水', py: 'shuǐ', bushou: '氵', cizu: '喝水 清水', en: 'water' },
  { hz: '火', py: 'huǒ', bushou: '火', cizu: '火车 生火', en: 'fire' },
  { hz: '山', py: 'shān', bushou: '山', cizu: '高山 山水', en: 'mountain' },
  { hz: '木', py: 'mù', bushou: '木', cizu: '树木 木头', en: 'tree' },
  { hz: '田', py: 'tián', bushou: '田', cizu: '田地 田野', en: 'field' },
  { hz: '天', py: 'tiān', bushou: '大', cizu: '天气 天空', en: 'sky' },
  { hz: '上', py: 'shàng', bushou: '一', cizu: '上面 上来', en: 'up' },
  { hz: '下', py: 'xià', bushou: '一', cizu: '下面 下去', en: 'down' },
  { hz: '大', py: 'dà', bushou: '大', cizu: '大小 大人', en: 'big' },
  { hz: '小', py: 'xiǎo', bushou: '小', cizu: '大小 小猫', en: 'small' },
  { hz: '一', py: 'yī', bushou: '一', cizu: '一起 一只', en: 'one' },
  { hz: '二', py: 'èr', bushou: '二', cizu: '二月 第二', en: 'two' },
  { hz: '三', py: 'sān', bushou: '三', cizu: '三月 第三', en: 'three' },
  { hz: '四', py: 'sì', bushou: '囗', cizu: '四季 四月', en: 'four' },
  { hz: '五', py: 'wǔ', bushou: '五', cizu: '五月 五个', en: 'five' },
  { hz: '六', py: 'liù', bushou: '亠', cizu: '六月 六个', en: 'six' },
  { hz: '七', py: 'qī', bushou: '一', cizu: '七月 七个', en: 'seven' },
  { hz: '八', py: 'bā', bushou: '八', cizu: '八个 八月', en: 'eight' },
  { hz: '九', py: 'jiǔ', bushou: '丿', cizu: '九月 九个', en: 'nine' },
  { hz: '十', py: 'shí', bushou: '十', cizu: '十只 十分', en: 'ten' },
];

// ============ 必背古诗（一年级） ============
const POEMS = [
  { title: '咏鹅', author: '（唐）骆宾王', lines: ['鹅，鹅，鹅，曲项向天歌。', '白毛浮绿水，红掌拨清波。'] },
  { title: '静夜思', author: '（唐）李白', lines: ['床前明月光，疑是地上霜。', '举头望明月，低头思故乡。'] },
  { title: '悯农', author: '（唐）李绅', lines: ['锄禾日当午，汗滴禾下土。', '谁知盘中餐，粒粒皆辛苦。'] },
  { title: '画', author: '（唐）王维', lines: ['远看山有色，近听水无声。', '春去花还在，人来鸟不惊。'] },
  { title: '古朗月行', author: '（唐）李白', lines: ['小时不识月，呼作白玉盘。', '又疑瑶台镜，飞在青云端。'] },
  { title: '风', author: '（唐）李峤', lines: ['解落三秋叶，能开二月花。', '过江千尺浪，入竹万竿斜。'] },
];

// ============ 英语单词（一年级） ============
const EN_WORDS = [
  { word: 'apple', cn: '苹果', emoji: '🍎' }, { word: 'banana', cn: '香蕉', emoji: '🍌' },
  { word: 'cat', cn: '猫', emoji: '🐱' }, { word: 'dog', cn: '狗', emoji: '🐶' },
  { word: 'book', cn: '书', emoji: '📕' }, { word: 'bag', cn: '书包', emoji: '🎒' },
  { word: 'pen', cn: '笔', emoji: '🖊️' }, { word: 'ruler', cn: '尺子', emoji: '📏' },
  { word: 'one', cn: '一', emoji: '1️⃣' }, { word: 'two', cn: '二', emoji: '2️⃣' },
  { word: 'three', cn: '三', emoji: '3️⃣' }, { word: 'four', cn: '四', emoji: '4️⃣' },
  { word: 'five', cn: '五', emoji: '5️⃣' }, { word: 'six', cn: '六', emoji: '6️⃣' },
  { word: 'seven', cn: '七', emoji: '7️⃣' }, { word: 'eight', cn: '八', emoji: '8️⃣' },
  { word: 'nine', cn: '九', emoji: '9️⃣' }, { word: 'ten', cn: '十', emoji: '🔟' },
  { word: 'hello', cn: '你好', emoji: '👋' }, { word: 'good', cn: '好的', emoji: '👍' },
  { word: 'morning', cn: '早上', emoji: '🌅' }, { word: 'school', cn: '学校', emoji: '🏫' },
  { word: 'friend', cn: '朋友', emoji: '🧑‍🤝‍🧑' }, { word: 'teacher', cn: '老师', emoji: '👩‍🏫' },
];

// ============ 一年级习惯清单（可自定义） ============
const DEFAULT_HABITS = [
  { id: 'h_early', text: '按时起床不迟到', emoji: '⏰', category: '生活' },
  { id: 'h_bed', text: '自己整理床铺', emoji: '🛏️', category: '生活' },
  { id: 'h_bag', text: '自己整理书包', emoji: '🎒', category: '生活' },
  { id: 'h_wash', text: '饭前便后洗手', emoji: '🧼', category: '卫生' },
  { id: 'h_teeth', text: '早晚刷牙', emoji: '🪥', category: '卫生' },
  { id: 'h_greet', text: '主动问好', emoji: '🙋', category: '礼貌' },
  { id: 'h_listen', text: '上课专心听讲', emoji: '👂', category: '学习' },
  { id: 'h_sit', text: '坐姿端正', emoji: '🪑', category: '学习' },
  { id: 'h_homework', text: '按时完成练习', emoji: '✏️', category: '学习' },
  { id: 'h_read', text: '课外阅读 20 分钟', emoji: '📚', category: '学习' },
  { id: 'h_sport', text: '运动 30 分钟', emoji: '🏃', category: '健康' },
  { id: 'h_eye', text: '少看屏幕护眼', emoji: '👀', category: '健康' },
  { id: 'h_sleep', text: '21:20 前睡觉', emoji: '😴', category: '健康' },
  { id: 'h_chore', text: '帮忙做家务', emoji: '🧹', category: '家庭' },
];

// ============ 运动项目 ============
const SPORTS = [
  { id: 'rope', name: '跳绳', emoji: '🪢', unit: '个', target: 100 },
  { id: 'run', name: '跑步', emoji: '🏃', unit: '分钟', target: 15 },
  { id: 'basketball', name: '拍球', emoji: '⛹️', unit: '分钟', target: 15 },
  { id: 'swim', name: '游泳', emoji: '🏊', unit: '分钟', target: 20 },
  { id: 'bike', name: '骑车', emoji: '🚴', unit: '分钟', target: 20 },
  { id: 'outdoor', name: '户外活动', emoji: '🌳', unit: '分钟', target: 60 },
  { id: 'dance', name: '跳舞/体操', emoji: '💃', unit: '分钟', target: 15 },
  { id: 'walk', name: '散步', emoji: '🚶', unit: '分钟', target: 20 },
];

// ============ 心情选项 ============
const MOODS = [
  { emoji: '😄', label: '超开心', score: 5, color: '#FFE066' },
  { emoji: '😊', label: '开心', score: 4, color: '#B5EAD7' },
  { emoji: '😐', label: '还行', score: 3, color: '#A5D8FF' },
  { emoji: '😕', label: '有点难过', score: 2, color: '#C9B6FF' },
  { emoji: '😢', label: '难过', score: 1, color: '#FFB6D9' },
  { emoji: '😴', label: '有点累', score: 2, color: '#FFB570' },
];

// ============ 科学小问答 ============
const SCIENCE_QUIZ = [
  { q: '向日葵总是朝着哪个方向？', a: '太阳', opts: ['月亮', '太阳', '星星', '风'], explain: '向日葵会跟着太阳转动，又叫「向阳花」。' },
  { q: '小蝌蚪长大后会变成什么？', a: '青蛙', opts: ['鱼', '乌龟', '青蛙', '鸭子'], explain: '小蝌蚪长出腿后变成青蛙或蟾蜍。' },
  { q: '下面哪个会发光？', a: '萤火虫', opts: ['蚂蚁', '萤火虫', '蝴蝶', '蜗牛'], explain: '萤火虫体内有荧光素，夜晚能发光。' },
  { q: '我们的心脏在身体哪个部位？', a: '左胸', opts: ['肚子', '头部', '左胸', '右胸'], explain: '心脏在左胸，把血液泵向全身。' },
  { q: '植物用什么「喝」水？', a: '根', opts: ['叶子', '根', '花', '果实'], explain: '根在土壤里吸收水分和养分。' },
  { q: '彩虹是怎么形成的？', a: '阳光和水滴', opts: ['云朵', '阳光和水滴', '风', '雪花'], explain: '阳光穿过空气中的小水滴折射出七色光。' },
  { q: '一年有几个季节？', a: '4个', opts: ['2个', '3个', '4个', '5个'], explain: '春夏秋冬四个季节。' },
  { q: '哪种动物是哺乳动物？', a: '鲸鱼', opts: ['鲨鱼', '鲸鱼', '金鱼', '乌龟'], explain: '鲸鱼用肺呼吸、喂奶，是哺乳动物。' },
];

// ============ 道德与法治 小故事 ============
const MORAL_STORIES = [
  {
    title: '小熊分蜂蜜', moral: '分享让快乐变成两倍', emoji: '🐻🍯🐰',
    content: [
      '小熊找到了一罐蜂蜜，他想起了好朋友小兔。',
      '于是他拿着蜂蜜走了很远的路，来到小兔家。',
      '"我们一起吃吧！" 小熊说。',
      '"谢谢你的分享！" 小兔笑了。',
    ]
  },
  {
    title: '小松鼠的道歉', moral: '做错事要勇敢承认', emoji: '🐿️🙏🐰',
    content: [
      '小松鼠不小心弄坏了小兔的画笔。',
      '他很害怕，躲了起来不敢说。',
      '后来他鼓起勇气："对不起，我弄坏了你的画笔。"',
      '小兔笑着说："没关系，诚实比画笔更珍贵！"',
    ]
  },
  {
    title: '排队的小鸭子', moral: '守规则让大家都开心', emoji: '🦆🚦🦆',
    content: [
      '一群小鸭子要去游泳。',
      '大家都想第一个跳下水，挤成一团。',
      '鸭妈妈说："排好队，一个一个来。"',
      '排好队后，每只小鸭子都很快地下水啦！',
    ]
  },
];

// ============ 成就徽章 ============
const BADGES = [
  { id: 'b_first', name: '启程', emoji: '🌱', desc: '完成第一次打卡', check: d => Object.keys(d.checkins || {}).length >= 1 },
  { id: 'b_week', name: '一周坚持', emoji: '🔥', desc: '连续打卡 7 天', check: d => (d.streaks?.currentDays || 0) >= 7 },
  { id: 'b_month', name: '月度之星', emoji: '🌟', desc: '连续打卡 30 天', check: d => (d.streaks?.currentDays || 0) >= 30 },
  { id: 'b_star50', name: '星星收集家', emoji: '⭐', desc: '累计 50 颗星', check: d => (d.stars?.total || 0) >= 50 },
  { id: 'b_star200', name: '星光闪耀', emoji: '✨', desc: '累计 200 颗星', check: d => (d.stars?.total || 0) >= 200 },
  { id: 'b_read10', name: '小书虫', emoji: '📚', desc: '累计阅读 10 次', check: d => (d.reading || []).length >= 10 },
  { id: 'b_sport10', name: '运动小将', emoji: '🏅', desc: '累计运动 10 次', check: d => Object.keys(d.exercise || {}).length >= 10 },
  { id: 'b_zi50', name: '识字达人', emoji: '📝', desc: '掌握 50 个字', check: d => Object.keys(d.ziMastered || {}).length >= 50 },
  { id: 'b_mood7', name: '心情记录者', emoji: '😊', desc: '记录 7 天心情', check: d => Object.keys(d.mood || {}).length >= 7 },
  { id: 'b_poem3', name: '小诗人', emoji: '📜', desc: '学会 3 首古诗', check: d => Object.keys(d.poems || {}).length >= 3 },
];

// ============ 奖励商城模板 ============
const REWARD_TEMPLATES = [
  { id: 'r1', name: '看动画片 20 分钟', emoji: '📺', cost: 20 },
  { id: 'r2', name: '去公园玩', emoji: '🎡', cost: 50 },
  { id: 'r3', name: '买一本绘本', emoji: '📖', cost: 80 },
  { id: 'r4', name: '周末游乐场', emoji: '🎠', cost: 150 },
  { id: 'r5', name: '和爸爸妈妈野餐', emoji: '🧺', cost: 100 },
  { id: 'r6', name: '选一次晚餐', emoji: '🍔', cost: 60 },
];

// ============ 学习目标（深圳一年级） ============
const LEARNING_GOALS = {
  ziTarget: 1600,        // 1-2年级认识常用汉字
  ziWriteTarget: 800,    // 其中会写
  ziGrade1: 400,         // 一年级上册识字量
  mathTarget: 20,        // 20以内加减法
  readMinutes: 20,       // 每天阅读分钟
  sportMinutes: 60,      // 每天运动分钟（户外）
  sleepHours: 10,        // 每天睡眠小时
  bedtime: '21:20',      // 就寝时间
};

// ============ 家长建议库 ============
const PARENT_TIPS = [
  { emoji: '💤', title: '睡眠优先', text: '深圳规定小学生每天睡足 10 小时，21:20 前上床。睡眠不足会直接影响记忆力和长高。' },
  { emoji: '📝', title: '双减政策', text: '小学一二年级不布置家庭书面作业。请多安排阅读、朗读、运动和亲子游戏，而不是刷题。' },
  { emoji: '📖', title: '亲子阅读', text: '每天 20 分钟亲子共读，比任何识字卡片都有效。读完后和孩子聊一聊故事情节。' },
  { emoji: '👀', title: '护眼 20-20-20', text: '每用眼 20 分钟，看 20 英尺（6 米）外物体 20 秒。每天户外活动 1 小时可预防近视。' },
  { emoji: '🏃', title: '每天运动', text: '一年级孩子每天应有 60 分钟中高强度运动，跳绳是深圳体育考核项目之一。' },
  { emoji: '🎯', title: '习惯 > 分数', text: '一年级重点是养成习惯：自己整理书包、按时作息、专心听讲。习惯好了，成绩自然来。' },
  { emoji: '💬', title: '多聊学校的事', text: '每天问开放式问题："今天最开心的事是什么？" 而不是 "考了多少分？"' },
  { emoji: '⭐', title: '及时肯定', text: '表扬努力而非天赋。说"你今天很认真"而不是"你真聪明"。' },
];

// ============ 绘本馆（一年级推荐绘本/必读书目） ============
// guide = 共读指导问题，方便家长亲子共读时互动
const PICTURE_BOOKS = [
  // 亲情与爱
  { id: 'b1', title: '我爸爸', author: '[英]安东尼·布朗', emoji: '👨', theme: '亲情', age: '3-8', desc: '用孩子的口吻描绘无所不能的爸爸，充满想象力与爱。', guide: '读完问问孩子：你的爸爸最厉害的地方是什么？' },
  { id: 'b2', title: '我妈妈', author: '[英]安东尼·布朗', emoji: '👩', theme: '亲情', age: '3-8', desc: '妈妈是厨师、是画家、是……也是永远爱你的妈妈。', guide: '聊聊妈妈每天为你做了哪些事。' },
  { id: 'b3', title: '猜猜我有多爱你', author: '[爱尔兰]山姆·麦克布雷尼', emoji: '🐰', theme: '亲情', age: '3-8', desc: '小兔子想告诉大兔子它有多爱他，一场爱的比拼。', guide: '和孩子比一比「我爱你这么多」。' },
  { id: 'b4', title: '爷爷一定有办法', author: '[加]菲比·吉尔曼', emoji: '🧵', theme: '智慧', age: '4-9', desc: '一条毯子随着孩子长大不断变成新东西，爷爷总有办法。', guide: '讨论：旧东西还能变成什么？' },
  { id: 'b5', title: '逃家小兔', author: '[美]玛格丽特·怀兹·布朗', emoji: '🐇', theme: '亲情', age: '3-7', desc: '小兔子想逃跑，妈妈说不管你变成什么，我都会找到你。', guide: '感受妈妈无条件的爱。' },
  { id: 'b6', title: '团圆', author: '余丽琼 / 朱成梁', emoji: '🥟', theme: '国情', age: '4-9', desc: '春节爸爸回家，一枚好运硬币串起父女深情。中国原创绘本。', guide: '讲讲你家过年的习俗。' },

  // 习惯与品格
  { id: 'b7', title: '大卫，不可以', author: '[美]大卫·香农', emoji: '🙈', theme: '习惯', age: '3-7', desc: '调皮的大卫总在闯祸，但妈妈依然爱他。', guide: '讨论哪些事「不可以」，为什么。' },
  { id: 'b8', title: '小熊不刷牙', author: '[瑞士]斯伐拉纳·提欧利那', emoji: '🐻', theme: '习惯', age: '3-6', desc: '小熊哈利讨厌刷牙，直到牙齿不见了……', guide: '培养早晚刷牙的好习惯。' },
  { id: 'b9', title: '是谁嗯嗯在我的头上', author: '[德]维尔纳·霍尔茨瓦特', emoji: '💩', theme: '科普', age: '3-6', desc: '小鼹鼠寻找「肇事者」的搞笑故事，认识动物粪便。', guide: '认识不同动物的「嗯嗯」。' },
  { id: 'b10', title: '彩虹色的花', author: '[波兰]麦克·格雷涅茨', emoji: '🌸', theme: '分享', age: '4-8', desc: '彩虹色的花把花瓣送给需要帮助的小动物。', guide: '讨论分享带来的快乐。' },

  // 想象力与科普
  { id: 'b11', title: '好饿的毛毛虫', author: '[美]艾瑞·卡尔', emoji: '🐛', theme: '科普', age: '2-6', desc: '毛毛虫吃啊吃，最后变成蝴蝶。认识数字、食物、星期。', guide: '数一数毛毛虫吃了哪些东西。' },
  { id: 'b12', title: '棕色的熊，你在看什么？', author: '[美]比尔·马丁', emoji: '🐻', theme: '语言', age: '2-5', desc: '韵律重复的句式，轻松认识动物和颜色。', guide: '和孩子一起有节奏地朗读。' },
  { id: 'b13', title: '月亮的味道', author: '[波兰]麦克·格雷涅茨', emoji: '🌙', theme: '想象', age: '4-8', desc: '小动物叠罗汉尝月亮，月亮会是什么味道呢？', guide: '想象月亮是什么味道。' },
  { id: 'b14', title: '蚂蚁和西瓜', author: '[日]田村茂', emoji: '🍉', theme: '合作', age: '3-7', desc: '小蚂蚁们团结合作搬西瓜，画面充满细节趣味。', guide: '观察蚂蚁是怎么分工合作的。' },
  { id: 'b15', title: '小蓝和小黄', author: '[美]李欧·李奥尼', emoji: '🔵', theme: '色彩', age: '3-6', desc: '小蓝和小黄抱在一起，变成了绿色。', guide: '玩一玩颜色混合游戏。' },
  { id: 'b16', title: '田鼠阿佛', author: '[美]李欧·李奥尼', emoji: '🐭', theme: '想象', age: '4-8', desc: '别的田鼠收集粮食，阿佛收集阳光、颜色和词语。', guide: '讨论「精神食粮」的重要。' },

  // 一年级「快乐读书吧」必读
  { id: 'b17', title: '和大人一起读（一上）', author: '人民教育出版社', emoji: '📖', theme: '必读', age: '6-7', desc: '一年级上册「快乐读书吧」指定读本，含儿歌、童谣、故事。', guide: '每天亲子共读一篇，读出声。' },
  { id: 'b18', title: '小巴掌童话', author: '张秋生', emoji: '✋', theme: '必读', age: '6-8', desc: '短小精悍的童话，语言优美，非常适合朗读。', guide: '选一篇大声朗读给家人听。' },
  { id: 'b19', title: '金波四季童话', author: '金波', emoji: '🍂', theme: '必读', age: '6-8', desc: '按春夏秋冬编排的童话，感受自然与文字之美。', guide: '找出描写季节的好词好句。' },
  { id: 'b20', title: '大头儿子和小头爸爸', author: '郑春华', emoji: '👦', theme: '必读', age: '6-8', desc: '温馨的父子故事，贴近日常生活。', guide: '聊聊你和大头儿子的相似处。' },
  { id: 'b21', title: '神笔马良', author: '洪汛涛', emoji: '🖌️', theme: '必读', age: '6-9', desc: '经典中国童话，马良用神笔帮助穷人、惩罚坏人。', guide: '如果你有一支神笔，会画什么？' },
  { id: 'b22', title: '七色花', author: '[苏]卡达耶夫', emoji: '🌈', theme: '必读', age: '6-9', desc: '七片花瓣七个愿望，最后一个愿望最珍贵。', guide: '讨论哪个愿望最有意义。' },
  { id: 'b23', title: '一起长大的玩具', author: '金波', emoji: '🧸', theme: '必读', age: '6-8', desc: '关于童年玩具的散文，温暖而怀旧。', guide: '说说你最喜欢的玩具。' },
  { id: 'b24', title: '愿望的实现', author: '[印度]泰戈尔', emoji: '✨', theme: '必读', age: '6-9', desc: '父子互换身份的奇幻故事。', guide: '讨论长大好还是童年好。' },
];

// 绘本主题（用于筛选）
const BOOK_THEMES = ['全部', '必读', '亲情', '习惯', '科普', '想象', '分享', '合作', '智慧', '语言', '色彩', '国情'];

// 暴露
window.AppData = {
  SZ_CALENDAR, TEXTBOOKS, ZI_XIE, ZI_SHI, HZ_DATA, POEMS, EN_WORDS,
  DEFAULT_HABITS, SPORTS, MOODS, SCIENCE_QUIZ, MORAL_STORIES,
  BADGES, REWARD_TEMPLATES, LEARNING_GOALS, PARENT_TIPS,
  PICTURE_BOOKS, BOOK_THEMES,
};
