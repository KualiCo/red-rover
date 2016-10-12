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

  subscriber(group) {
    const { client } = this
    const sub = client.duplicate()

    function on(event, callback) {
      const cb = (event === MESSAGE) ? hijacker(callback) : callback
      sub.on(event, cb)
    }

    function hijacker(callback) {
      if (group) {
        return (channel, message) => {
          const msg = JSON.parse(message)
          const _id = msg._id
          const key = `${group}:${_id}`
          client.multi([[ 'set', key, '1', 'nx', 'ex', 300 ]])
            .exec_atomic((err, resp) => {
              if (err) {
                console.log(`ERROR: ${err}`)
                throw new Error(err)
              }
              if (resp[0] === 'OK') {
                return callback(channel, msg)
              }
              return null
            })
        }
      }

      return (channel, message) => {
        const msg = JSON.parse(message)
        callback(channel, msg)
      }
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
      sub.unsubscribe(channel)
    }

    function quit() {
      sub.quit()
    }

    return {
      on,
      subscribe,
      unsubscribe,
      quit,
    }
  }
}
