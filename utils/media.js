/**
 * 图片选择与本地持久化。
 * chooseMedia 给出的是临时文件，重启后会被清理，所以统一压缩后复制到
 * wx.env.USER_DATA_PATH/uploads 下，只保存这个持久路径。
 */
const UPLOAD_DIR = wx.env.USER_DATA_PATH + '/uploads'

function fs() {
  return wx.getFileSystemManager()
}

function ensureDir() {
  try {
    fs().accessSync(UPLOAD_DIR)
  } catch (err) {
    try {
      fs().mkdirSync(UPLOAD_DIR, true)
    } catch (err2) {
      console.error('[media] mkdir failed', err2)
    }
  }
}

function isManaged(path) {
  return typeof path === 'string' && path.indexOf(wx.env.USER_DATA_PATH) === 0
}

function extOf(path) {
  const matched = /\.([a-zA-Z0-9]+)(\?|$)/.exec(path || '')
  if (!matched) return 'jpg'
  const ext = matched[1].toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].indexOf(ext) < 0) return 'jpg'
  return ext === 'jpeg' ? 'jpg' : ext
}

function copyIn(source, prefix, done) {
  ensureDir()
  const name = prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.' + extOf(source)
  const target = UPLOAD_DIR + '/' + name
  try {
    fs().copyFileSync(source, target)
  } catch (err) {
    try {
      fs().writeFileSync(target, fs().readFileSync(source))
    } catch (err2) {
      done(err2)
      return
    }
  }
  done(null, target)
}

function compress(source, options, done) {
  if (typeof wx.compressImage !== 'function') {
    done(null, source)
    return
  }
  const params = {
    src: source,
    quality: options.quality || 75,
    success(res) {
      done(null, res.tempFilePath || source)
    },
    fail() {
      // 压缩失败就用原图，不阻塞流程
      done(null, source)
    }
  }
  if (options.width > 0) {
    params.compressedWidth = options.width
  }
  wx.compressImage(params)
}

/**
 * 调起系统裁切框（可拖动、可缩放）。
 * 用户主动取消时返回 cancel，其他失败就放行原图，不挡住流程。
 */
function crop(source, scale, done) {
  if (!scale || typeof wx.cropImage !== 'function') {
    done(null, source)
    return
  }
  wx.cropImage({
    src: source,
    cropScale: scale,
    success(res) {
      done(null, res.tempFilePath || source)
    },
    fail(err) {
      const message = (err && err.errMsg) || ''
      if (/cancel/i.test(message)) {
        done(new Error('cancel'))
        return
      }
      done(null, source)
    }
  })
}

/**
 * 选一张图片 → 可选裁切 → 压缩 → 复制到用户目录
 * @param {Object} options { prefix, width, quality, cropScale }
 * @param {Function} done (err, savedPath)
 */
function pickImage(options, done) {
  const opts = options || {}
  wx.chooseMedia({
    count: 1,
    mediaType: ['image'],
    sourceType: ['album', 'camera'],
    sizeType: ['compressed'],
    success(res) {
      const file = (res.tempFiles || [])[0]
      const temp = file && (file.tempFilePath || file.path)
      if (!temp) {
        done(new Error('没有取到图片'))
        return
      }
      crop(temp, opts.cropScale, function (cropErr, cropped) {
        if (cropErr) {
          done(cropErr)
          return
        }
        compress(cropped || temp, opts, function (err, compressed) {
          copyIn(compressed || temp, opts.prefix || 'img', done)
        })
      })
    },
    fail(err) {
      const message = (err && err.errMsg) || ''
      done(new Error(/cancel/i.test(message) ? 'cancel' : '选择图片失败'))
    }
  })
}

function removeFile(path) {
  if (!isManaged(path)) return
  try {
    fs().unlinkSync(path)
  } catch (err) {
    // 文件不存在也无所谓
  }
}

function removeAllUploads() {
  let names = []
  try {
    names = fs().readdirSync(UPLOAD_DIR) || []
  } catch (err) {
    return
  }
  names.forEach(function (name) {
    try {
      fs().unlinkSync(UPLOAD_DIR + '/' + name)
    } catch (err) {
      // 忽略单个文件失败
    }
  })
}

module.exports = {
  UPLOAD_DIR: UPLOAD_DIR,
  pickImage: pickImage,
  removeFile: removeFile,
  removeAllUploads: removeAllUploads,
  isManaged: isManaged
}
