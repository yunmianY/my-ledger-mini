/**
 * 日期工具：日期统一用 'YYYY-MM-DD' 字符串，月份用 'YYYY-MM'。
 * 字符串可直接比较排序，也天然是流水分片的键。
 */
const WEEKDAYS = '日一二三四五六'

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

function todayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}

function nowMonth() {
  return todayStr().slice(0, 7)
}

/** 当前时刻 'HH:mm' */
function nowTime() {
  const d = new Date()
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes())
}

/** 时间戳 → 'HH:mm'（迁移老数据时按创建时间回填） */
function timeOfStamp(stamp) {
  const value = Number(stamp)
  const d = isFinite(value) && value > 0 ? new Date(value) : new Date()
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes())
}

/** 把任意 '8:5' / '08:05' 规范成 'HH:mm'，非法返回 '' */
function normalizeTime(value) {
  if (!value) return ''
  const parts = String(value).split(':')
  if (parts.length < 2) return ''
  const hour = parseInt(parts[0], 10)
  const minute = parseInt(parts[1], 10)
  if (!isFinite(hour) || !isFinite(minute)) return ''
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return ''
  return pad2(hour) + ':' + pad2(minute)
}

function monthOf(dateStr) {
  return String(dateStr || '').slice(0, 7)
}

function toDate(dateStr) {
  const parts = String(dateStr).split('-')
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2] || 1))
}

function buildDate(year, month, day) {
  return year + '-' + pad2(month) + '-' + pad2(day)
}

function shiftMonth(month, delta) {
  const parts = String(month).split('-')
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1 + delta, 1)
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1)
}

function shiftDay(dateStr, delta) {
  const d = toDate(dateStr)
  d.setDate(d.getDate() + delta)
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}

function daysInMonth(month) {
  const parts = String(month).split('-')
  return new Date(Number(parts[0]), Number(parts[1]), 0).getDate()
}

/** 周一 = 0 ... 周日 = 6 */
function weekdayIndex(dateStr) {
  return (toDate(dateStr).getDay() + 6) % 7
}

function weekdayLabel(dateStr) {
  return '周' + WEEKDAYS.charAt(toDate(dateStr).getDay())
}

function monthLabel(month) {
  const parts = String(month).split('-')
  return parts[0] + '年' + Number(parts[1]) + '月'
}

function monthShort(month) {
  return String(Number(String(month).split('-')[1])) + '月'
}

function dayNum(dateStr) {
  return Number(String(dateStr).split('-')[2])
}

/** 与今天相差的天数，今天 = 0，昨天 = 1 */
function diffFromToday(dateStr) {
  const a = toDate(todayStr())
  const b = toDate(dateStr)
  const t1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const t2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((t1 - t2) / 86400000)
}

function dateLabel(dateStr) {
  const diff = diffFromToday(dateStr)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff === 2) return '前天'
  const d = toDate(dateStr)
  return (d.getMonth() + 1) + '月' + d.getDate() + '日'
}

function fullDateLabel(dateStr) {
  const d = toDate(dateStr)
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · ' + weekdayLabel(dateStr)
}

/** 用于「日均」：本月取已过天数，过去月份取整月，未来月份为 0 */
function elapsedDays(month) {
  const current = nowMonth()
  if (month < current) return daysInMonth(month)
  if (month > current) return 0
  return new Date().getDate()
}

function monthsOfYear(year) {
  const list = []
  for (let m = 1; m <= 12; m++) {
    list.push(year + '-' + pad2(m))
  }
  return list
}

module.exports = {
  pad2: pad2,
  todayStr: todayStr,
  nowMonth: nowMonth,
  nowTime: nowTime,
  timeOfStamp: timeOfStamp,
  normalizeTime: normalizeTime,
  monthOf: monthOf,
  toDate: toDate,
  buildDate: buildDate,
  shiftMonth: shiftMonth,
  shiftDay: shiftDay,
  daysInMonth: daysInMonth,
  weekdayIndex: weekdayIndex,
  weekdayLabel: weekdayLabel,
  monthLabel: monthLabel,
  monthShort: monthShort,
  dayNum: dayNum,
  diffFromToday: diffFromToday,
  dateLabel: dateLabel,
  fullDateLabel: fullDateLabel,
  elapsedDays: elapsedDays,
  monthsOfYear: monthsOfYear
}
