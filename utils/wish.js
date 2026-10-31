/**
 * 购物清单的固定选项：想要程度、分类标签。
 * 放这里是为了页面、排序、迁移共用一份。
 */
const PRIORITIES = [
  { value: 3, label: '必买', color: '#E4572E' },
  { value: 2, label: '想要', color: '#F4A261' },
  { value: 1, label: '随便看看', color: '#B0B0B0' }
]

const TAGS = ['数码', '家居', '服饰', '出行', '学习', '其他']

function priority(value) {
  const v = Number(value) || 1
  for (let i = 0; i < PRIORITIES.length; i++) {
    if (PRIORITIES[i].value === v) return PRIORITIES[i]
  }
  return PRIORITIES[PRIORITIES.length - 1]
}

module.exports = {
  PRIORITIES: PRIORITIES,
  TAGS: TAGS,
  priority: priority
}
