/**
 * 数据版本号 —— 单一来源。
 * 加字段的流程：在 migrations.js 的 steps 末尾追加一个 step，然后把这里 +1。
 * seed.js（首次初始化）、store.js（判断是否迁移）、migrations.js（校验步骤数）都读这里。
 */
module.exports = {
  VERSION: 5
}
