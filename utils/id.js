/**
 * id 生成：时间戳 + 自增序号 + 随机串
 * 纯本地场景不需要全局唯一，但保留可读前缀方便排查。
 */
let seq = 0

function uid(prefix) {
  seq = (seq + 1) % 1296
  const time = Date.now().toString(36)
  const counter = seq.toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return (prefix || 'id') + '_' + time + counter + rand
}

module.exports = {
  uid: uid
}
