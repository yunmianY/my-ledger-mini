/**
 * 流水 → 视图模型。
 * 明细页和统计页的「当天明细」都要展示同样的字段，抽出来避免两处各写一份。
 */
const money = require('./money')

/**
 * @param {Object} txn 原始流水
 * @param {Object} catMap 分类映射 { id: category }
 */
function decorate(txn, catMap) {
  const cat = catMap ? catMap[txn.categoryId] : null
  const isIncome = txn.type === 'income'
  return {
    id: txn.id,
    name: cat ? cat.name : '未分类',
    emoji: cat ? cat.emoji : '❓',
    iconPath: cat ? (cat.iconPath || '') : '',
    iconKey: cat ? (cat.iconKey || '') : '',
    note: txn.note || '',
    member: txn.member || '',
    time: txn.time || '',
    income: isIncome,
    amountText: (isIncome ? '+' : '-') + money.format(txn.amountCents)
  }
}

function decorateList(txns, catMap) {
  return (txns || []).map(function (txn) {
    return decorate(txn, catMap)
  })
}

module.exports = {
  decorate: decorate,
  decorateList: decorateList
}
