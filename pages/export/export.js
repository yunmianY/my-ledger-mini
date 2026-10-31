const store = require('../../utils/store')
const dateUtil = require('../../utils/date')
const format = require('../../utils/export-format')

Page({
  data: {
    bookName: '',
    scope: 'book',
    from: '',
    to: '',
    fromText: '不限',
    toText: '不限',
    countText: '0 条',
    rangeText: '暂无数据',
    expenseCats: [],
    incomeCats: [],
    selectedNames: [],
    catLabel: '全部',
    showFrom: false,
    showTo: false,
    showCats: false,
    importText: ''
  },

  onShow() {
    store.init()
    this.refresh()
  },

  buildRows() {
    return store.queryForExport({
      scope: this.data.scope,
      from: this.data.from,
      to: this.data.to,
      categoryNames: this.data.selectedNames
    })
  },

  refresh() {
    const book = store.getActiveBook()
    const rows = this.buildRows()
    let rangeText = '暂无数据'
    if (rows.length) {
      rangeText = rows[0].date + ' ~ ' + rows[rows.length - 1].date
    }
    this.setData({
      bookName: book ? book.name : '',
      countText: rows.length + ' 条',
      rangeText: rangeText
    })
  },

  onScope(event) {
    const scope = event.currentTarget.dataset.scope
    if (!scope || scope === this.data.scope) return
    // 切换账本范围时清掉分类筛选：不同账本的分类不一定对得上
    this.setData({ scope: scope, selectedNames: [], catLabel: '全部' }, () => {
      this.refresh()
    })
  },

  openFrom() {
    this.setData({ showFrom: true })
  },

  closeFrom() {
    this.setData({ showFrom: false })
  },

  openTo() {
    this.setData({ showTo: true })
  },

  closeTo() {
    this.setData({ showTo: false })
  },

  onFromSelect(event) {
    const date = event.detail.date
    if (!date) return
    this.setData({ from: date, fromText: date, showFrom: false }, () => {
      this.refresh()
    })
  },

  onToSelect(event) {
    const date = event.detail.date
    if (!date) return
    this.setData({ to: date, toText: date, showTo: false }, () => {
      this.refresh()
    })
  },

  clearFrom() {
    this.setData({ from: '', fromText: '不限', showFrom: false }, () => {
      this.refresh()
    })
  },

  clearTo() {
    this.setData({ to: '', toText: '不限', showTo: false }, () => {
      this.refresh()
    })
  },

  openCats() {
    const that = this
    const books = this.data.scope === 'all' ? store.listBooks() : [store.getActiveBook()]
    const seen = Object.create(null)
    const expense = []
    const income = []

    books.forEach(function (book) {
      if (!book) return
      store.listCategories(book.id).forEach(function (cat) {
        const key = cat.type + '|' + cat.name
        if (seen[key]) return
        seen[key] = true
        const item = {
          name: cat.name,
          type: cat.type,
          checked: that.data.selectedNames.indexOf(cat.name) >= 0
        }
        if (cat.type === 'income') {
          income.push(item)
        } else {
          expense.push(item)
        }
      })
    })

    this.setData({ showCats: true, expenseCats: expense, incomeCats: income })
  },

  closeCats() {
    this.setData({ showCats: false })
  },

  toggleCat(event) {
    const name = event.currentTarget.dataset.name
    if (!name) return
    const selected = this.data.selectedNames.slice()
    const index = selected.indexOf(name)
    if (index >= 0) {
      selected.splice(index, 1)
    } else {
      selected.push(name)
    }
    this.setData({ selectedNames: selected }, () => {
      this.markCats(selected)
    })
  },

  markCats(selected) {
    function mark(list) {
      return list.map(function (item) {
        return Object.assign({}, item, { checked: selected.indexOf(item.name) >= 0 })
      })
    }
    this.setData({
      expenseCats: mark(this.data.expenseCats),
      incomeCats: mark(this.data.incomeCats)
    })
  },

  clearCats() {
    this.setData({ selectedNames: [] }, () => {
      this.markCats([])
    })
  },

  confirmCats() {
    const count = this.data.selectedNames.length
    this.setData({
      showCats: false,
      catLabel: count ? '已选 ' + count + ' 项' : '全部'
    }, () => {
      this.refresh()
    })
  },

  fileTag() {
    const scopeTag = this.data.scope === 'all' ? '全部账本' : (this.data.bookName || '记账')
    return scopeTag + '_' + (this.data.from || '最早') + '_' + (this.data.to || '最新')
  },

  exportCsv() {
    this.exportRows('csv')
  },

  exportTsv() {
    this.exportRows('tsv')
  },

  exportMarkdown() {
    this.exportRows('md')
  },

  exportText() {
    this.exportRows('txt')
  },

  /** 四种文本格式共用一套取数和分享流程 */
  exportRows(kind) {
    const rows = this.buildRows()
    if (!rows.length) {
      wx.showToast({ title: '当前条件下没有记录', icon: 'none' })
      return
    }
    let content = ''
    if (kind === 'csv') content = format.toCsv(rows)
    else if (kind === 'tsv') content = format.toTsv(rows)
    else if (kind === 'md') content = format.toMarkdown(rows)
    else content = format.toText(rows)

    this.saveAndShare('账单_' + this.fileTag() + '.' + kind, content)
  },

  exportJson() {
    // 备份始终是全量，不受上面的筛选影响
    const content = JSON.stringify(store.exportAll(), null, 2)
    const name = '记账备份_' + dateUtil.todayStr() + '.json'
    this.saveAndShare(name, content)
  },

  saveAndShare(name, content) {
    let path = ''
    try {
      path = wx.env.USER_DATA_PATH + '/' + name
      wx.getFileSystemManager().writeFileSync(path, content, 'utf8')
    } catch (err) {
      console.error('[export] write failed', err)
      this.copy(content)
      return
    }
    if (typeof wx.shareFileMessage === 'function') {
      const that = this
      wx.shareFileMessage({
        filePath: path,
        fileName: name,
        fail() {
          that.copy(content)
        }
      })
    } else {
      this.copy(content)
    }
  },

  copy(content) {
    wx.setClipboardData({
      data: content,
      success() {
        wx.showToast({ title: '已复制到剪贴板', icon: 'none' })
      }
    })
  },

  onImportInput(event) {
    this.setData({ importText: event.detail.value })
  },

  /** 自动识别：以 { 开头当 JSON 备份，其余当 CSV 表格 */
  onImport() {
    const text = (this.data.importText || '').trim()
    if (!text) {
      wx.showToast({ title: '先把内容粘贴进来', icon: 'none' })
      return
    }
    if (text.charAt(0) === '{') {
      this.importJson()
    } else {
      this.importCsvText(text)
    }
  },

  importJson() {
    const that = this
    wx.showActionSheet({
      itemList: ['合并导入（推荐）', '覆盖导入（会清空现有）'],
      success(res) {
        that.doImport(res.tapIndex === 0 ? 'merge' : 'replace')
      },
      fail() {}
    })
  },

  doImport(mode) {
    const text = (this.data.importText || '').trim()
    if (!text) return
    const that = this
    wx.showModal({
      title: mode === 'merge' ? '合并导入？' : '覆盖导入？',
      content: mode === 'merge'
        ? '相同的记录会跳过，其余追加到现有数据里。'
        : '现有数据会被全部清空，替换成备份里的内容。',
      confirmText: '导入',
      confirmColor: mode === 'merge' ? '#2A9D8F' : '#D64545',
      success(res) {
        if (!res.confirm) return
        try {
          store.importAll(text, mode)
          that.setData({ importText: '' })
          that.refresh()
          wx.showToast({ title: '导入成功', icon: 'none' })
        } catch (err) {
          wx.showModal({
            title: '导入失败',
            content: (err && err.message) || '备份内容无法解析',
            showCancel: false
          })
        }
      }
    })
  },

  importCsvText(text) {
    const that = this
    wx.showModal({
      title: '导入 CSV？',
      content: '按「账本 + 日期 + 时间 + 类型 + 金额 + 分类 + 备注」去重，重复的行会跳过。',
      confirmText: '导入',
      success(res) {
        if (!res.confirm) return
        try {
          const result = store.importCsv(text)
          that.setData({ importText: '' })
          that.refresh()
          wx.showModal({
            title: '导入完成',
            content: '新增 ' + result.created + ' 条，跳过 ' + result.skipped + ' 条',
            showCancel: false
          })
        } catch (err) {
          wx.showModal({
            title: '导入失败',
            content: (err && err.message) || '无法解析这段表格',
            showCancel: false
          })
        }
      }
    })
  },

  clearAll() {
    const that = this
    wx.showModal({
      title: '清空全部数据？',
      content: '所有账本、分类、记录都会被删除，无法恢复。建议先导出备份。',
      confirmText: '清空',
      confirmColor: '#D64545',
      success(res) {
        if (!res.confirm) return
        store.clearAll()
        that.refresh()
        wx.showToast({ title: '已清空', icon: 'none' })
      }
    })
  }
})
