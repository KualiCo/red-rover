'use strict'

const redis = require('redis')
const uuid = require('uuid')

const MESSAGE = 'message'
const SUBSCRIBE = 'subscribe'

module.exports = class RedRover {
  constructor(cfg) {
    this.client = redis.createClient(cfg)
  }

  publisher() {
    // const id = uuid.v4()
    const pub = this.client.duplicate()

    function publish(channel, message) {
      // console.log(`PUBLISH: ${id}`)
      const payload = Object.assign({}, message, { _id: uuid.v4() })
      pub.publish(channel, JSON.stringify(payload))
    }

    function quit() {
      // console.log(`---QUIT: ${id}`)
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
      const cb = (event === MESSAGE) ? hijacker(callback) : callback
      sub.on(event, cb)
    }

    function subscribe(channel) {
      if (!channel) {
        throw new Error('RedRover: Subscribe requires a channel')
      }

      sub.subscribe(channel)
      return new Promise((resolve) => {
        sub.on(SUBSCRIBE, (subscribeChannel, count) => {
          if (channel === subscribeChannel) {
            resolve(count)
          }
        })
      })
    }

    function unsubscribe(channel) {
      return new Promise((resolve) => {
        const args = [ resolve ]
        if (channel) args.unshift(channel)
        sub.unsubscribe(...args)
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
      unsubscribe,
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
