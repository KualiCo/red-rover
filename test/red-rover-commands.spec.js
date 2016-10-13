/* eslint-disable max-statements */
'use strict'

const expect = require('chai').expect
const spy = require('chai').spy
const RedRoverCommands = require('../lib/red-rover-commands')

describe('red-rover-commands', () => {
  const cfg = {
    port: 32768,
  }
  const commands = new RedRoverCommands(cfg)
  let subs = []
  let pub

  afterEach(() => {
    subs.forEach((sub) => {
      sub.unsubscribe()
      sub.quit()
    })
    subs = []
    if (pub) pub.quit()
  })

  it('issues commands', (done) => {
    const CHANNEL = 'commands'
    Promise.all([
      commands.receiver(CHANNEL),
      commands.sender(CHANNEL)
    ])
      .then(values => ({
        receiver: values[0],
        sender: values[1],
      }))
      .then(comm => {
        comm.receiver((msg) => {
          return 'World'
        })
        return comm
      })
      .then(comm => {
        comm.sender('Hello', (resp) => {
          expect(resp.msg).to.equal('World')
          done()
        })
      })
  })

  it('issues group commands', (done) => {
    const CHANNEL = 'commands'
    const GROUP_1 = 'group one'
    const GROUP_2 = 'group two'
    
    let totals = 0
    Promise.all([
      commands.receiver(CHANNEL),
      commands.receiver(CHANNEL, GROUP_1),
      commands.receiver(CHANNEL, GROUP_2),
      commands.receiver(CHANNEL, GROUP_2),
      commands.sender(CHANNEL)
    ])
      .then((resp) => {
        const receiverCallback = (value) => {
          return (msg) => {
            return value
          }
        }
        resp[0](receiverCallback(1))
        resp[1](receiverCallback(10))
        resp[2](receiverCallback(100))
        resp[3](receiverCallback(100))
        return resp
      })
      .then((resp) => {
        resp[4]('Hello', (response) => {
          totals += response.msg
        })
      })
      .then(() => {
        setTimeout(() => {
          expect(totals).to.equal(111)
          done()
        }, 50)
      })
  })

  it('global error handling')

})
