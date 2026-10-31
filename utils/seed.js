/**
 * 种子数据：首次启动的默认账本与内置分类。
 * 新建账本时会克隆同一套模板，保证每个账本的分类互相独立。
 */
const db = require('./db')
const ids = require('./id')
const appVersion = require('./version')
const icons = require('./icons')

const EXPENSE_TEMPLATE = [
  { name: '餐饮', emoji: '🍜' },
  { name: '饮品', emoji: '🧋' },
  { name: '交通', emoji: '🚇' },
  { name: '通讯', emoji: '📱' },
  { name: '日用', emoji: '🧴' },
  { name: '居住', emoji: '🏠' },
  { name: '娱乐', emoji: '🎮' },
  { name: '学习', emoji: '📚' },
  { name: '人情', emoji: '🎁' },
  { name: '其他', emoji: '📌' }
]

const INCOME_TEMPLATE = [
  { name: '工资', emoji: '💰' },
  { name: '奖金', emoji: '🏆' },
  { name: '兼职', emoji: '💻' },
  { name: '红包', emoji: '🧧' },
  { name: '其他', emoji: '📌' }
]

const PALETTE = ['#E4572E', '#F4A261', '#2A9D8F', '#6C8AE4', '#B07CC6', '#E9C46A', '#8AB17D', '#D64545', '#5B8DEF']

const DEFAULT_BOOK = {
  id: 'bk_default',
  name: '日常',
  emoji: '📒',
  iconKey: 'book:日记',
  color: '#F4A261',
  members: ['我']
}

function buildCategories(bookId) {
  const list = []
  EXPENSE_TEMPLATE.forEach(function (item, index) {
    list.push({
      id: ids.uid('ct'),
      bookId: bookId,
      name: item.name,
      emoji: item.emoji,
      iconKey: icons.CATEGORY_ICON_BY_NAME[item.name] || '',
      type: 'expense',
      color: PALETTE[index % PALETTE.length],
      order: index,
      builtin: true,
      createdAt: Date.now()
    })
  })
  INCOME_TEMPLATE.forEach(function (item, index) {
    list.push({
      id: ids.uid('ct'),
      bookId: bookId,
      name: item.name,
      emoji: item.emoji,
      iconKey: icons.CATEGORY_ICON_BY_NAME[item.name] || '',
      type: 'income',
      color: PALETTE[index % PALETTE.length],
      order: index,
      builtin: true,
      createdAt: Date.now()
    })
  })
  return list
}

function bootstrap() {
  const now = Date.now()
  const book = {
    id: DEFAULT_BOOK.id,
    name: DEFAULT_BOOK.name,
    emoji: DEFAULT_BOOK.emoji,
    iconKey: DEFAULT_BOOK.iconKey,
    color: DEFAULT_BOOK.color,
    members: DEFAULT_BOOK.members.slice(),
    archived: false,
    order: 0,
    createdAt: now
  }
  db.setBooks([book])
  db.setCats(buildCategories(book.id))
  db.setBudgets({})
  db.setMonths([])
  db.setMeta({
    version: appVersion.VERSION,
    activeBookId: book.id,
    currency: 'CNY',
    carryBudget: true,
    createdAt: now
  })
  return book
}

function cloneCategories(bookId) {
  const list = buildCategories(bookId)
  db.setCats(db.cats().concat(list))
  return list
}

module.exports = {
  EXPENSE_TEMPLATE: EXPENSE_TEMPLATE,
  INCOME_TEMPLATE: INCOME_TEMPLATE,
  PALETTE: PALETTE,
  DEFAULT_BOOK: DEFAULT_BOOK,
  buildCategories: buildCategories,
  bootstrap: bootstrap,
  cloneCategories: cloneCategories
}
