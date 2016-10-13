'use strict'

const redis = require('redis')
const uuid = require('uuid')

const MONITOR = 'monitor'
const MESSAGE = 'message'
const PMESSAGE = 'pmessage'

module.exports = class RedRover {
  constructor(cfg) {
    this.client = redis.createClient(cfg)
  }

  monitor(callback) {
    return new Promise((resolve, reject) => {
      this.client.on(MONITOR, callback)

      this.client.monitor((err, res) => {
        if (err) return reject(err)
        return resolve()
      })
    })
  }

  publisher() {
    const pub = this.client.duplicate()

    function publish(channel, msg, meta) {
      if (!channel) {
        throw new Error('RedRover: publish requires a channel')
      }

      const _id = uuid.v4()
      const payload = Object.assign({ _id, msg }, meta)
      pub.publish(channel, JSON.stringify(payload))
      return _id
    }

    function quit() {
      pub.quit()
    }

    return {
      publish,
      quit,
    }
  }

  subscriber(group, once) {
    const { client } = this
    const sub = this.client.duplicate()
    let runs = 0

    function on(event, callback) {
      switch(event) {
        case MESSAGE:
          sub.on(MESSAGE, hijacker(callback))
          break

        case PMESSAGE:
          sub.on(PMESSAGE, phijacker(callback))
          break

        default:
          sub.on(event, callback)
      }
    }

    function subscribe(channel) {
      return _subscribe(channel, 'subscribe')
    }

    function psubscribe(channel) {
      return _subscribe(channel, 'psubscribe')
    }

    function _subscribe(channel, command) {
      if (!channel) {
        throw new Error('RedRover: subscribe requires a channel')
      }

      sub[command](channel)
      return new Promise((resolve) => {
        sub.on(command, (subscribeChannel, count) => {
          if (channel === subscribeChannel) {
            resolve(count)
          }
        })
      })
    }

    function unsubscribe(channel) {
      return _unsubscribe(channel, 'unsubscribe')
    }

    function punsubscribe(channel) {
      return _unsubscribe(channel, 'punsubscribe')
    }

    function _unsubscribe(channel, command) {
      return new Promise((resolve) => {
        const args = [ resolve ]
        if (channel) args.unshift(channel)
        sub[command](...args)
      })
    }

    function quit() {
      sub.quit()
    }

    // --- Utility functions ---

    function hijacker(callback) {
      return (channel, message) => {
        if (once && runs) return null
        const msg = JSON.parse(message)
        if (group) {
          coordinateGroup(channel, msg, (chosen) => {
            if (chosen) {
              runs++
              return callback(channel, msg)
            }
            return null
          })
        } else {
          runs++
          return callback(channel, msg)
        }
        return null
      }
    }

    function phijacker(callback) {
      return (pchannel, channel, message) => {
        if (once && runs) return null
        const msg = JSON.parse(message)
        if (group) {
          coordinateGroup(channel, msg, (chosen) => {
            if (chosen) {
              runs++
              return callback(pchannel, channel, msg)
            }
            return null
          })
        } else {
          runs++
          return callback(pchannel, channel, msg)
        }
        return null
      }
    }

    function coordinateGroup(channel, msg, callback) {
      const _id = msg._id
      const key = `${group}:${_id}`

      client.set([ key, '1', 'nx', 'ex', 300 ], (err, resp) => {
        if (err) {
          console.log(`ERROR: ${err}`)
          throw new Error(err)
        }
        callback(resp === 'OK')
      })
    }

    return {
      on,
      subscribe,
      psubscribe,
      unsubscribe,
      punsubscribe,
      quit,
    }
  }

  once(channel, group) {
    const sub = this.subscriber(group, true)
    return new Promise((resolve) => {
      sub.subscribe(channel)
      sub.on(MESSAGE, (c, message) => {
        sub.unsubscribe(channel)
        sub.quit()
        resolve(message)
      })
    })
  }
}
