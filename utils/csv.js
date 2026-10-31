/**
 * 极简 CSV 解析：支持引号包裹、字段内逗号、字段内换行、双引号转义、BOM。
 * 返回二维数组（第一行通常是表头）。
 */
function parse(text) {
  const src = String(text || '').replace(/^\ufeff/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < src.length; i++) {
    const ch = src.charAt(i)

    if (quoted) {
      if (ch === '"') {
        if (src.charAt(i + 1) === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\r') {
      // 忽略，等 \n
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }

  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter(function (item) {
    if (item.length > 1) return true
    return String(item[0] || '').trim() !== ''
  })
}

/** 把 '2026/9/1'、'2026-9-1'、'2026-09-01 20:15' 之类统一成 'YYYY-MM-DD' */
function parseDate(value) {
  const text = String(value || '').trim()
  const matched = text.match(/(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/)
  if (!matched) return ''
  const year = matched[1]
  const month = matched[2].length === 1 ? '0' + matched[2] : matched[2]
  const day = matched[3].length === 1 ? '0' + matched[3] : matched[3]
  return year + '-' + month + '-' + day
}

/** 从 '2026-09-01 20:15:30' 里捞时间 */
function parseTime(value) {
  const text = String(value || '').trim()
  const matched = text.match(/(\d{1,2}):(\d{2})/)
  if (!matched) return ''
  const hour = matched[1].length === 1 ? '0' + matched[1] : matched[1]
  return hour + ':' + matched[2]
}

module.exports = {
  parse: parse,
  parseDate: parseDate,
  parseTime: parseTime
}
