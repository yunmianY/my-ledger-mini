/**
 * 导出成各种文本格式。
 * 输入统一是 store.queryForExport 产出的行：
 * { book, date, time, type: 'expense'|'income', category, amountCents, member, note }
 */
const money = require('./money')

const HEADERS = ['账本', '日期', '时间', '类型', '分类', '金额(元)', '记账人', '备注']

function typeText(type) {
  return type === 'income' ? '收入' : '支出'
}

function summarize(rows) {
  let expense = 0
  let income = 0
  rows.forEach(function (row) {
    if (row.type === 'income') income += row.amountCents
    else expense += row.amountCents
  })
  return { expense: expense, income: income, count: rows.length }
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\r\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"'
  }
  return text
}

function eachRow(rows, build) {
  return rows.map(function (row) {
    return build(row)
  })
}

/** 字段里的 Tab 和换行会把 TSV 弄坏，先压成空格 */
function flat(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/[\t\r\n]+/g, ' ')
    .trim()
}

function toCsv(rows) {
  const lines = [HEADERS.join(',')]
  eachRow(rows, function (row) {
    lines.push([
      csvCell(row.book),
      csvCell(row.date),
      csvCell(row.time),
      csvCell(typeText(row.type)),
      csvCell(row.category),
      csvCell(money.toInput(row.amountCents)),
      csvCell(row.member),
      csvCell(row.note)
    ].join(','))
  })
  // BOM 让 Excel 按 UTF-8 打开，中文不乱码
  return '\ufeff' + lines.join('\r\n')
}

function toTsv(rows) {
  const lines = [HEADERS.join('\t')]
  eachRow(rows, function (row) {
    lines.push([
      flat(row.book),
      flat(row.date),
      flat(row.time),
      flat(typeText(row.type)),
      flat(row.category),
      money.toInput(row.amountCents),
      flat(row.member),
      flat(row.note)
    ].join('\t'))
  })
  return '\ufeff' + lines.join('\r\n')
}

function toMarkdown(rows) {
  const summary = summarize(rows)
  const lines = [
    '# 记账导出',
    '',
    '共 ' + summary.count + ' 笔 · 支出 ¥' + money.format(summary.expense) + ' · 收入 ¥' + money.format(summary.income),
    '',
    '| 日期 | 时间 | 账本 | 类型 | 分类 | 金额 | 记账人 | 备注 |',
    '| --- | --- | --- | --- | --- | ---: | --- | --- |'
  ]
  eachRow(rows, function (row) {
    lines.push([
      row.date,
      row.time || '',
      row.book,
      typeText(row.type),
      row.category,
      (row.type === 'income' ? '+' : '-') + money.format(row.amountCents),
      row.member,
      String(row.note || '').replace(/\|/g, '\\|')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  })
  return lines.join('\n')
}

function toText(rows) {
  const summary = summarize(rows)
  const lines = [
    '记账导出',
    '共 ' + summary.count + ' 笔 · 支出 ¥' + money.format(summary.expense) + ' · 收入 ¥' + money.format(summary.income),
    ''
  ]
  eachRow(rows, function (row) {
    const parts = [row.date]
    if (row.time) parts.push(row.time)
    parts.push(row.book, typeText(row.type), row.category)
    parts.push((row.type === 'income' ? '+' : '-') + '¥' + money.format(row.amountCents))
    if (row.member) parts.push(row.member)
    if (row.note) parts.push(row.note)
    lines.push(parts.join('  '))
  })
  return lines.join('\n')
}

module.exports = {
  HEADERS: HEADERS,
  toCsv: toCsv,
  toTsv: toTsv,
  toMarkdown: toMarkdown,
  toText: toText
}
