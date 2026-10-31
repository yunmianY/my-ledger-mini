/**
 * 页面间的临时预填数据。
 * 比 URL 传参可靠：不用处理中文编码，也不会被长度限制卡住。
 *
 * 用法：A 页 set(...) → navigateTo(B) → B 页 onLoad 里 take()
 * take 会清空，保证只生效一次。
 */
let payload = null

function set(data) {
  payload = data || null
}

function take() {
  const data = payload
  payload = null
  return data
}

module.exports = {
  set: set,
  take: take
}
