/**
 * 金额工具：内部一律用「分」(int)，展示层再格式化。
 * 任何地方都不要用浮点数做加减。
 */
function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

function groupDigits(str) {
  return String(str).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 任意输入 → 分。非法输入返回 NaN。
 * 支持 '12'、'12.3'、'12.34'、'1,234.56'、'-8.8'，小数超过两位视为非法。
 */
function toCents(value) {
  if (value === null || value === undefined) return NaN
  if (typeof value === 'number') {
    if (!isFinite(value)) return NaN
    return Math.round(value * 100)
  }
  const raw = String(value).trim().replace(/,/g, '')
  if (!raw) return NaN
  if (!/^-?\d*(\.\d{0,2})?$/.test(raw)) return NaN
  if (raw === '-' || raw === '.' || raw === '-.') return NaN
  const negative = raw.charAt(0) === '-'
  const body = negative ? raw.slice(1) : raw
  const parts = body.split('.')
  const intPart = parts[0] || '0'
  const fracPart = ((parts[1] || '') + '00').slice(0, 2)
  const cents = parseInt(intPart, 10) * 100 + parseInt(fracPart, 10)
  if (!isFinite(cents)) return NaN
  return negative ? -cents : cents
}

/**
 * 分 → 展示文本，默认带千分位两位小数。
 * options: { noDecimal, symbol, signed }
 */
function format(cents, options) {
  const opt = options || {}
  const value = Number(cents)
  const abs = Math.abs(Math.round(isFinite(value) ? value : 0))
  let text = groupDigits(String(Math.floor(abs / 100)))
  if (!opt.noDecimal) {
    text += '.' + pad2(abs % 100)
  }
  if (opt.symbol) {
    text = opt.symbol + text
  }
  if (opt.signed && value < 0) {
    text = '-' + text
  }
  return text
}

function formatSigned(cents) {
  return format(cents, { signed: true })
}

/** 分 → 可继续编辑的输入串，如 1230 → '12.30'（不带千分位） */
function toInput(cents) {
  const value = Math.round(Number(cents) || 0)
  const abs = Math.abs(value)
  return (value < 0 ? '-' : '') + Math.floor(abs / 100) + '.' + pad2(abs % 100)
}

/** 输入中的字符串 → 带千分位的展示串（保留用户正在输入的小数部分） */
function formatInput(str) {
  if (!str) return ''
  const negative = str.charAt(0) === '-'
  const body = negative ? str.slice(1) : str
  const dot = body.indexOf('.')
  const intPart = dot >= 0 ? body.slice(0, dot) : body
  const fracPart = dot >= 0 ? body.slice(dot) : ''
  return (negative ? '-' : '') + groupDigits(intPart) + fracPart
}

module.exports = {
  pad2: pad2,
  toCents: toCents,
  format: format,
  formatSigned: formatSigned,
  toInput: toInput,
  formatInput: formatInput
}
