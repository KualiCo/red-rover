'use strict'

const redis = require('redis')
const uuid = require('uuid')

exports.publisher = function(cfg) {
  const pub = redis.createClient(cfg)

  function emit(channel, msg) {
    console.log('emit')
    console.log(channel)
    console.log(msg)
    const payload = Object.assign({}, msg, { _id: uuid.v4() })
    console.log('payload')
    console.log(payload)
    pub.publish(channel, JSON.stringify(payload))
  }

  function dispose() {
    pub.quit()
  }

  return {
    emit,
    dispose,
  }
}

exports.subscriber = function(cfg) {
  const sub = redis.createClient(cfg)
  const channelMap = {}

  function on(channel, _callback) {
    sub.on('message', (_channel, _message) => {
      console.log('message')
      console.log(_channel)
      console.log(_message)
      _callback(_channel, JSON.parse(_message))
    })

    sub.on('subscribe', (_channel, _count) => {
      console.log(`${_count} subscribed to channel: ${channel}`)
    })

    channelMap[channel] = true
    console.log('subscribe')
    console.log(channel)
    sub.subscribe(channel)
  }

  function dispose(channel) {
    if (channel) {
      sub.unsubscribe(channel)
      delete channelMap[channel]
      if (!Object.keys(channelMap).length) {
        sub.quit()
      }
    } else {
      sub.unsubscribe()
      sub.quit()
    }
  }

  return {
    on,
    dispose,
  }
}

exports.subscriberGroup = function(group, cfg) {
  const sub = redis.createClient(cfg)
  const client = sub.duplicate()
  const channelMap = {}

  function on(channel, callback) {
    sub.on('message', (_channel, _message) => {
      const msg = JSON.parse(_message)
      const { _id } = msg
      const key = `${group}:${_id}`
      client.multi([[ 'set', key, '1', 'nx', 'ex', 300 ]])
        .exec_atomic((err, resp) => {
          if (err) {
            throw new Error(err)
          }
          if (resp[0] === 'OK') {
            return callback(channel, msg)
          }
          return callback(channel, null)
        })
    })

    sub.on('subscribe', (_channel, _count) => {
      console.log(`${_count} subscribed to channel: ${channel}`)
    })

    sub.subscribe(channel)
  }

  function dispose(channel) {
    if (channel) {
      sub.unsubscribe(channel)
      delete channelMap[channel]
      if (!Object.keys(channelMap).length) {
        sub.quit()
      }
    } else {
      sub.unsubscribe()
      sub.quit()
    }
  }

  return {
    on,
    dispose,
  }
}
