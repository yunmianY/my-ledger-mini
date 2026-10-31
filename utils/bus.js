/**
 * 极简事件总线。
 * 页面在 onLoad 里 on()，在 onUnload 里调用返回的 off()，避免内存泄漏。
 * 约定事件名：
 *   'change' 任意数据变更（payload.scope 标明来源）
 */
const listeners = Object.create(null)

function on(type, handler) {
  if (typeof handler !== 'function') {
    return function () {}
  }
  if (!listeners[type]) {
    listeners[type] = []
  }
  listeners[type].push(handler)
  return function off() {
    remove(type, handler)
  }
}

function remove(type, handler) {
  const list = listeners[type]
  if (!list) return
  const index = list.indexOf(handler)
  if (index >= 0) {
    list.splice(index, 1)
  }
}

function off(type, handler) {
  if (handler) {
    remove(type, handler)
  } else {
    delete listeners[type]
  }
}

function emit(type, payload) {
  const list = listeners[type]
  if (!list || !list.length) return
  list.slice().forEach(function (handler) {
    try {
      handler(payload || {})
    } catch (err) {
      console.error('[bus] handler error on ' + type, err)
    }
  })
}

module.exports = {
  on: on,
  off: off,
  emit: emit
}
