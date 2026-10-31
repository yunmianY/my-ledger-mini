/**
 * 底部 tab 的单一来源：tabbar 组件和左右滑动都读这里。
 */
const icons = require('./icons')

const TABS = [
  { key: 'index', label: '明细', emoji: '📋', icon: icons.path('tabIndex'), url: '/pages/index/index' },
  { key: 'wishlist', label: '清单', emoji: '🛍️', icon: icons.path('tabWishlist'), url: '/pages/wishlist/wishlist' },
  { key: 'stats', label: '统计', emoji: '📊', icon: icons.path('tabStats'), url: '/pages/stats/stats' },
  { key: 'mine', label: '我的', emoji: '🙂', icon: icons.path('tabMine'), url: '/pages/mine/mine' }
]

function indexOf(key) {
  for (let i = 0; i < TABS.length; i++) {
    if (TABS[i].key === key) return i
  }
  return -1
}

function switchTo(key) {
  const index = indexOf(key)
  if (index < 0) return false
  wx.reLaunch({ url: TABS[index].url })
  return true
}

/**
 * 左滑进下一个 tab，右滑回上一个；已经在两端就不动。
 *
 * 转场交给系统做：
 *   前进 = navigateTo（新页面从右滑入，旧页面同时左移）
 *   后退 = navigateBack（当前页右滑出，上一页同时回来）
 * 这样两个页面是同时在动的，不会出现中间白屏。
 *
 * @param {String} currentKey 当前 tab
 * @param {String} direction 'left' | 'right'
 */
function swipe(currentKey, direction) {
  const index = indexOf(currentKey)
  if (index < 0) return false
  const target = direction === 'left' ? index + 1 : index - 1
  if (target < 0 || target >= TABS.length) return false

  const tab = TABS[target]

  if (direction === 'left') {
    wx.navigateTo({
      url: tab.url,
      fail() {
        wx.reLaunch({ url: tab.url })
      }
    })
    return true
  }

  // 从 tabbar 直接进来的页面栈里只有自己，退不回去，就瞬时切
  if (getCurrentPages().length > 1) {
    wx.navigateBack({ delta: 1 })
  } else {
    wx.reLaunch({ url: tab.url })
  }
  return true
}

module.exports = {
  TABS: TABS,
  indexOf: indexOf,
  switchTo: switchTo,
  swipe: swipe
}
