/**
 * 存储适配层 —— 全工程唯一直接调用 wx.storage 的文件。
 * 想换成云开发 / 自有后端时，只需要重写这个文件（保持同步接口或改成 Promise 后统一改 store）。
 */
const PREFIX = 'acc:'

function wrapKey(key) {
  return PREFIX + key
}

function read(key, fallback) {
  try {
    const raw = wx.getStorageSync(wrapKey(key))
    if (raw === '' || raw === null || raw === undefined) return fallback
    return raw
  } catch (err) {
    console.error('[storage] read failed: ' + key, err)
    return fallback
  }
}

function write(key, value) {
  try {
    wx.setStorageSync(wrapKey(key), value)
    return true
  } catch (err) {
    console.error('[storage] write failed: ' + key, err)
    const message = (err && err.errMsg) || String(err)
    if (/exceed|exceeded|最大|full/i.test(message)) {
      wx.showModal({
        title: '本地空间已满',
        content: '记账数据写不进去了。请先到「我的 → 导出备份」导出后清理历史数据。',
        showCancel: false
      })
    }
    return false
  }
}

function remove(key) {
  try {
    wx.removeStorageSync(wrapKey(key))
  } catch (err) {
    console.error('[storage] remove failed: ' + key, err)
  }
}

function listKeys() {
  try {
    return wx.getStorageInfoSync().keys || []
  } catch (err) {
    console.error('[storage] listKeys failed', err)
    return []
  }
}

function usage() {
  try {
    const info = wx.getStorageInfoSync()
    return { currentSize: info.currentSize || 0, limitSize: info.limitSize || 10240 }
  } catch (err) {
    return { currentSize: 0, limitSize: 10240 }
  }
}

module.exports = {
  PREFIX: PREFIX,
  read: read,
  write: write,
  remove: remove,
  listKeys: listKeys,
  usage: usage
}
