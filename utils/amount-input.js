/**
 * 金额输入键盘的纯状态机：把「当前输入串 + 按下的键」映射成新输入串。
 * 与 UI 解耦，方便测试；键盘组件只负责把按键抛出来。
 */
const MAX_INT_DIGITS = 8

function applyKey(current, key) {
  const value = current || ''
  if (key === 'del') {
    return value.slice(0, -1)
  }
  if (key === 'clear') {
    return ''
  }
  if (key === '.') {
    if (value === '') return '0.'
    if (value.indexOf('.') >= 0) return value
    return value + '.'
  }
  if (!/^\d$/.test(key)) {
    return value
  }
  const dot = value.indexOf('.')
  if (dot >= 0) {
    // 已有两位小数则忽略
    if (value.length - dot - 1 >= 2) return value
    return value + key
  }
  if (value.replace(/^0+/, '').length >= MAX_INT_DIGITS) {
    return value
  }
  if (value === '0') {
    return key
  }
  return value + key
}

module.exports = {
  MAX_INT_DIGITS: MAX_INT_DIGITS,
  applyKey: applyKey
}
