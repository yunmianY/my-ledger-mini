/**
 * 内置图标表：逻辑 key → 包内 PNG 路径。
 *
 * 路径全部是 ASCII。之前用中文目录名时，Skyline 的资源服务请求会 500，
 * 换成 assets/ 下的英文路径后正常。
 */
const ENABLED = true

// 分类图标：中文 key（数据里存的就是这个）→ assets/cat 下的英文文件名
const CATEGORY_FILES = {
  餐饮: 'food',
  饮品: 'drink',
  交通: 'transport',
  通讯: 'comm',
  日用: 'daily',
  游戏: 'game',
  学习: 'study',
  礼物: 'gift',
  零食: 'snack',
  其他: 'other',
  工资: 'salary',
  奖金: 'bonus',
  兼职: 'parttime',
  红包: 'redpacket'
}

// 备用图标 / 账本图标（两个目录同名同序）
const ALT_FILES = {
  睡觉: 'sleep',
  流星: 'meteor',
  搜索: 'search',
  晚上: 'night',
  月亮: 'moon',
  礼物: 'gift',
  星球: 'planet',
  送信车: 'postcar',
  书本: 'book',
  鬼魂: 'ghost',
  日记: 'diary',
  房子: 'house',
  爪子: 'paw',
  白云: 'cloud',
  小鸟: 'bird',
  星云: 'nebula'
}

const MAP = {
  // 下边栏
  tabIndex: '/assets/tabbar/detail.png',
  tabWishlist: '/assets/tabbar/list.png',
  tabStats: '/assets/tabbar/stats.png',
  tabMine: '/assets/tabbar/mine.png',

  // 我的
  menuCategories: '/assets/mine/categories.png',
  menuBudget: '/assets/mine/budget.png',
  menuMembers: '/assets/mine/members.png',
  menuAppearance: '/assets/mine/appearance.png',
  menuExport: '/assets/mine/export.png',
  menuAbout: '/assets/mine/about.png'
}

Object.keys(CATEGORY_FILES).forEach(function (name) {
  MAP[name] = '/assets/cat/' + CATEGORY_FILES[name] + '.png'
})

Object.keys(ALT_FILES).forEach(function (name) {
  MAP['alt:' + name] = '/assets/alt/' + ALT_FILES[name] + '.png'
  MAP['book:' + name] = '/assets/book/' + ALT_FILES[name] + '.png'
})

// v3 写入过的英文 key，保留兼容，别删
MAP.food = MAP['餐饮']
MAP.drink = MAP['饮品']
MAP.transport = MAP['交通']
MAP.comm = MAP['通讯']
MAP.daily = MAP['日用']
MAP.game = MAP['游戏']
MAP.study = MAP['学习']
MAP.gift = MAP['礼物']
MAP.house = MAP['alt:房子']
MAP.other = MAP['其他']

/** 分类名 → iconKey，seed 和迁移共用一份 */
const CATEGORY_ICON_BY_NAME = {
  餐饮: '餐饮',
  饮品: '饮品',
  交通: '交通',
  通讯: '通讯',
  购物: '日用',
  日用: '日用',
  居住: 'alt:房子',
  娱乐: '游戏',
  学习: '学习',
  人情: '礼物',
  礼物: '礼物',
  零食: '零食',
  其他: '其他',
  工资: '工资',
  奖金: '奖金',
  兼职: '兼职',
  红包: '红包'
}

/** 新增分类时的图标选择器 */
const CATEGORY_PICKER = Object.keys(ALT_FILES).map(function (name) {
  return { key: 'alt:' + name, name: name }
})

/** 新增账本时的图标选择器 */
const BOOK_PICKER = Object.keys(ALT_FILES).map(function (name) {
  return { key: 'book:' + name, name: name }
})

function path(key) {
  if (!ENABLED || !key) return ''
  return MAP[key] || ''
}

/** 账本没有显式选图标时的默认值 */
const DEFAULT_BOOK_ICON = 'book:日记'

module.exports = {
  ENABLED: ENABLED,
  MAP: MAP,
  CATEGORY_PICKER: CATEGORY_PICKER,
  BOOK_PICKER: BOOK_PICKER,
  CATEGORY_ICON_BY_NAME: CATEGORY_ICON_BY_NAME,
  DEFAULT_BOOK_ICON: DEFAULT_BOOK_ICON,
  path: path
}
