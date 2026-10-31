/**
 * 左右滑动识别。
 * 只认「横向位移够大、明显比纵向大、动作够快」的手势，
 * 避免和列表上下滚动、长按、点击冲突。
 */
const MIN_DISTANCE = 40
const MAX_DURATION = 1000
const RATIO = 1.0

function point(touch) {
  if (!touch) return null
  const x = touch.clientX !== undefined ? touch.clientX : touch.pageX
  const y = touch.clientY !== undefined ? touch.clientY : touch.pageY
  if (x === undefined) return null
  return { x: x, y: y, time: Date.now() }
}

function readStart(event) {
  return point(event && event.touches && event.touches[0])
}

/**
 * 判断这次手势是左滑还是右滑，不是滑动返回 ''
 */
function resolve(start, event) {
  if (!start) return ''
  const end = point(event && event.changedTouches && event.changedTouches[0])
  if (!end) return ''
  if (Date.now() - start.time > MAX_DURATION) return ''

  const dx = end.x - start.x
  const dy = end.y - start.y
  if (Math.abs(dx) < MIN_DISTANCE) return ''
  if (Math.abs(dx) < Math.abs(dy) * RATIO) return ''
  return dx < 0 ? 'left' : 'right'
}

module.exports = {
  readStart: readStart,
  resolve: resolve
}
