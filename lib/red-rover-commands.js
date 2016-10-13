'use strict'

const RedRover = require('./red-rover')

const MESSAGE = 'message'
const SUBSCRIBE = 'subscribe'


module.exports = class RedRoverCommands extends RedRover {
  sender(channel, group) {
    const pub = this.publisher()
    const sub = this.subscriber(group)

    const commandChannel = `${channel}::command`
    const responseChannel = `${channel}::response`

    const responseFilterMap = {}
    sub.on(MESSAGE, (chnl, msg) => {
      const callback = responseFilterMap[msg._re] || logMiss
      callback(msg)
    })

    function sender(message, callback) {
      const _id = pub.publish(commandChannel, message)
      responseFilterMap[_id] = callback
    }

    return sub.subscribe(responseChannel)
      .then(() => sender)
  }

  receiver(channel, group) {
    const pub = this.publisher()
    const sub = this.subscriber(group)

    const commandChannel = `${channel}::command`
    const responseChannel = `${channel}::response`

    const commandCallbacks = []
    sub.on(MESSAGE, (chnl, msg) => {
      const {_id} = msg
      commandCallbacks.forEach((callback) => {
        const resp = callback(msg)
        if (isFunction(resp.then)) {
          resp.then((response) => { sendResponse(response, _id) })
        } else {
          sendResponse(resp, _id)
        }

      })
    })

    function sendResponse(response, _id) {
      pub.publish(responseChannel, response, { _re: _id })
    }

    function receiver(callback) {
      commandCallbacks.push(callback)
    }

    return sub.subscribe(commandChannel)
      .then(() => receiver)
  }
}


// --- Utility Functions ---

function logMiss(msg) {
  console.log('[RedRoverCommands commander response MISS]')
  console.log(msg)
}

function isFunction(fn) {
  return Object.prototype.toString.call(fn) === '[object Function]'
} 

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]'
}
