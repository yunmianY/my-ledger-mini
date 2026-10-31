const store = require('../../utils/store')
const bus = require('../../utils/bus')
const money = require('../../utils/money')
const media = require('../../utils/media')
const wishOptions = require('../../utils/wish')
const prefill = require('../../utils/prefill')
const tabs = require('../../utils/tabs')
const swipe = require('../../utils/swipe')

function toast(title) {
  wx.showToast({ title: title, icon: 'none' })
}

Page({
  data: {
    pending: [],
    bought: [],
    pendingTotalText: '0.00',
    pendingCount: 0,
    boughtTotalText: '0.00',
    boughtCount: 0,
    progressPercent: 0,
    progressText: '',
    monthlyText: '未设置每月存款',
    tags: [],
    activeTag: '',

    showForm: false,
    formId: '',
    formTitle: '添加想买的东西',
    formName: '',
    formPrice: '',
    formNote: '',
    formImage: '',
    formPriority: 2,
    formTag: '',
    originalImage: '',

    priorities: wishOptions.PRIORITIES,
    tagOptions: wishOptions.TAGS
  },

  onLoad() {
    store.init()
    this.offChange = bus.on('change', () => {
      this.refresh()
    })
    this.refresh()
  },

  onShow() {
    if (this.data.pending.length || this.data.bought.length || this.data.tags.length) {
      this.refresh()
    }
  },

  onUnload() {
    if (this.offChange) {
      this.offChange()
      this.offChange = null
    }
  },

  refresh() {
    const all = store.listWishes()
    const summary = store.wishSummary()
    const activeTag = this.data.activeTag

    const tagSet = []
    all.forEach(function (item) {
      if (item.tag && tagSet.indexOf(item.tag) < 0) tagSet.push(item.tag)
    })

    const pending = []
    const bought = []
    all.forEach(function (item) {
      if (activeTag && item.tag !== activeTag) return
      const priority = wishOptions.priority(item.priority)
      const view = {
        id: item.id,
        name: item.name,
        note: item.note || '',
        tag: item.tag || '',
        imagePath: item.imagePath || '',
        priceText: item.priceCents ? '¥' + money.format(item.priceCents) : '价格待定',
        priorityLabel: priority.label,
        priorityColor: priority.color
      }
      if (item.done) {
        bought.push(view)
      } else {
        pending.push(view)
      }
    })

    const totalCents = summary.pendingCents + summary.boughtCents
    const percent = totalCents ? Math.round(summary.boughtCents * 100 / totalCents) : 0
    const monthly = store.getWishMonthly()

    let progressText = ''
    if (summary.pendingCount === 0) {
      progressText = summary.boughtCount ? '清单上的东西都买到啦' : '还没有想买的东西'
    } else if (monthly > 0) {
      const months = Math.ceil(summary.pendingCents / monthly)
      progressText = '按每月存 ¥' + money.format(monthly) + ' 算，还需 ' + months + ' 个月'
    } else {
      progressText = '设个每月能存的数，帮你算还要攒多久'
    }

    this.setData({
      pending: pending,
      bought: bought,
      pendingTotalText: money.format(summary.pendingCents),
      pendingCount: summary.pendingCount,
      boughtTotalText: money.format(summary.boughtCents),
      boughtCount: summary.boughtCount,
      progressPercent: percent,
      progressText: progressText,
      monthlyText: monthly > 0 ? '每月存 ¥' + money.format(monthly) : '未设置',
      tags: tagSet
    })
  },

  editMonthly() {
    const that = this
    const current = store.getWishMonthly()
    wx.showModal({
      title: '每月能存多少',
      editable: true,
      placeholderText: '例如 800，留空表示不设置',
      content: current ? money.toInput(current) : '',
      success(res) {
        if (!res.confirm) return
        const text = String(res.content || '').trim()
        if (!text) {
          store.setWishMonthly(0)
          that.refresh()
          return
        }
        const cents = money.toCents(text)
        if (isNaN(cents) || cents < 0) {
          toast('金额格式不对')
          return
        }
        store.setWishMonthly(cents)
        that.refresh()
      }
    })
  },

  onTag(event) {
    const tag = event.currentTarget.dataset.tag || ''
    if (tag === this.data.activeTag) return
    this.setData({ activeTag: tag }, () => {
      this.refresh()
    })
  },

  onToggle(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    const wish = store.getWish(id)
    if (!wish) return
    const markingBought = !wish.done

    try {
      store.toggleWish(id)
    } catch (err) {
      toast((err && err.message) || '操作失败')
      return
    }

    if (!markingBought || !wish.priceCents) return

    // 买到了、而且填了价格，就问一句要不要顺手记账
    wx.showModal({
      title: '顺便记一笔？',
      content: '「' + wish.name + '」¥' + money.format(wish.priceCents),
      confirmText: '记一笔',
      cancelText: '不用',
      success(res) {
        if (!res.confirm) return
        prefill.set({ amountCents: wish.priceCents, note: wish.name })
        wx.navigateTo({ url: '/pages/record/record' })
      }
    })
  },

  openAdd() {
    this.setData({
      showForm: true,
      formId: '',
      formTitle: '添加想买的东西',
      formName: '',
      formPrice: '',
      formNote: '',
      formImage: '',
      formPriority: 2,
      formTag: this.data.activeTag,
      originalImage: ''
    })
  },

  openEdit(id) {
    const wish = store.getWish(id)
    if (!wish) return
    this.setData({
      showForm: true,
      formId: id,
      formTitle: '编辑',
      formName: wish.name,
      formPrice: wish.priceCents ? money.toInput(wish.priceCents) : '',
      formNote: wish.note || '',
      formImage: wish.imagePath || '',
      formPriority: wish.priority || 2,
      formTag: wish.tag || '',
      originalImage: wish.imagePath || ''
    })
  },

  closeForm() {
    this.cleanupDraftImage()
    this.setData({
      showForm: false,
      formImage: '',
      originalImage: '',
      formTag: ''
    })
  },

  /** 取消时删掉本次刚上传、还没保存的图片 */
  cleanupDraftImage() {
    const path = this.data.formImage
    if (path && path !== this.data.originalImage) {
      media.removeFile(path)
    }
  },

  onName(event) {
    this.setData({ formName: event.detail.value })
  },

  onPrice(event) {
    this.setData({ formPrice: event.detail.value })
  },

  onNote(event) {
    this.setData({ formNote: event.detail.value })
  },

  onPriority(event) {
    this.setData({ formPriority: Number(event.currentTarget.dataset.value) || 1 })
  },

  onTagPick(event) {
    const tag = event.currentTarget.dataset.tag || ''
    this.setData({ formTag: tag === this.data.formTag ? '' : tag })
  },

  onPickImage() {
    const that = this
    media.pickImage({ prefix: 'wish', width: 320, quality: 80, cropScale: '1:1' }, function (err, path) {
      if (err) {
        if (err.message !== 'cancel') {
          toast(err.message || '选择失败')
        }
        return
      }
      const previous = that.data.formImage
      if (previous && previous !== that.data.originalImage) {
        media.removeFile(previous)
      }
      that.setData({ formImage: path })
    })
  },

  onClearImage() {
    const previous = this.data.formImage
    if (previous && previous !== this.data.originalImage) {
      media.removeFile(previous)
    }
    this.setData({ formImage: '' })
  },

  onSubmit() {
    const name = (this.data.formName || '').trim()
    if (!name) {
      toast('先给它起个名字')
      return
    }

    let priceCents = 0
    if (this.data.formPrice) {
      const parsed = money.toCents(this.data.formPrice)
      if (isNaN(parsed) || parsed < 0) {
        toast('价格格式不对')
        return
      }
      priceCents = parsed
    }

    const payload = {
      name: name,
      priceCents: priceCents,
      note: this.data.formNote,
      imagePath: this.data.formImage,
      priority: this.data.formPriority,
      tag: this.data.formTag
    }

    try {
      if (this.data.formId) {
        store.updateWish(this.data.formId, payload)
        // 换了图就把旧图删掉
        if (this.data.originalImage && this.data.originalImage !== this.data.formImage) {
          media.removeFile(this.data.originalImage)
        }
      } else {
        store.addWish(payload)
      }
    } catch (err) {
      toast((err && err.message) || '保存失败')
      return
    }

    this.setData({ showForm: false, formImage: '', originalImage: '', formTag: '' })
    toast('已保存')
  },

  onMore(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    const that = this
    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success(res) {
        if (res.tapIndex === 0) {
          that.openEdit(id)
        } else if (res.tapIndex === 1) {
          that.remove(id)
        }
      },
      fail() {}
    })
  },

  remove(id) {
    const that = this
    wx.showModal({
      title: '从清单里移除？',
      content: '只是从清单删掉，不会动账本里的记录。',
      confirmText: '移除',
      confirmColor: '#D64545',
      success(res) {
        if (!res.confirm) return
        const wish = store.getWish(id)
        store.removeWish(id)
        if (wish && wish.imagePath) {
          media.removeFile(wish.imagePath)
        }
        toast('已移除')
      }
    })
  },

  onSwipeStart(event) {
    this._swipeStart = swipe.readStart(event)
  },

  onSwipeEnd(event) {
    const direction = swipe.resolve(this._swipeStart, event)
    this._swipeStart = null
    if (direction) tabs.swipe('wishlist', direction)
  }
})
