const crypto = require('crypto')
const bindings = require('bindings')('argon2')
const Promise = require('any-promise')

const defaults = Object.freeze({
  timeCost: 3,
  memoryCost: 12,
  parallelism: 1,
  argon2d: false
})

const limits = Object.freeze(bindings.limits)

const validate = (salt, options) => {
  if (!Buffer.isBuffer(salt) || salt.length < 8) {
    throw new Error('Invalid salt, must be a buffer with 8 or more bytes.')
  }

  if (options.parallelism === 'auto') {
    /* istanbul ignore next */
    options.parallelism = require('os').cpus().length
  }

  for (const key of Object.keys(limits)) {
    const max = limits[key].max
    const min = limits[key].min
    const value = options[key]
    if (!Number.isInteger(value) || value > max || value < min) {
      throw new Error(`Invalid ${key}, must be an integer between ${min} and ${max}.`)
    }
  }
}

module.exports = {
  defaults,
  limits,

  hash(plain, salt, options) {
    options = Object.assign({}, defaults, options)

    if (!Buffer.isBuffer(plain)) {
      plain = new Buffer(plain)
    }

    try {
      validate(salt, options)
      return new Promise((resolve, reject) => {
        return bindings.hash(plain, salt, options.timeCost, options.memoryCost,
          options.parallelism, options.argon2d, resolve, reject)
      })
    } catch (err) {
      return Promise.reject(err)
    }
  },

  generateSalt(length) {
    length = typeof length === 'undefined' ? 16 : length
    return new Promise((resolve, reject) => {
      crypto.randomBytes(length, (err, salt) => {
        /* istanbul ignore if */
        if (err) {
          return reject(err)
        }
        return resolve(salt)
      })
    })
  },

  verify(hash, plain) {
    if (!/^\$argon2[di](\$v=\d+)?\$m=\d+,t=\d+,p=\d+(?:\$[\w+\/]+){2}$/.test(hash)) {
      return Promise.reject(new Error('Invalid hash, must be generated by Argon2.'))
    }

    if (!Buffer.isBuffer(plain)) {
      plain = new Buffer(plain)
    }

    return new Promise((resolve, reject) => {
      bindings.verify(hash, plain, hash[7] === 'd', resolve, reject)
    })
  }
}
