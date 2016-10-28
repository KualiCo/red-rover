/* eslint-disable max-statements */
'use strict'

const expect = require('chai').expect
const spy = require('chai').spy
const RedRoverCommands = require('..')

describe('red-rover-commands', () => {
  const commands = new RedRoverCommands({ port: 6379 })

  it('issues commands', (done) => {
    const CHANNEL = 'commands'
    Promise.all([
      commands.receiver(CHANNEL),
      commands.sender(CHANNEL)
    ])
      .then(comm => {
        comm[0].receive((msg) => {
          return 'World'
        })
        return comm
      })
      .then(comm => {
        comm[1].send('Hello', (resp) => {
          expect(resp.msg).to.equal('World')
          Promise.all([
            comm[0].stop(),
            comm[1].stop()
          ])
            .then(() => done())
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
        resp[0].receive(receiverCallback(1))
        resp[1].receive(receiverCallback(10))
        resp[2].receive(receiverCallback(100))
        resp[3].receive(receiverCallback(100))
        return resp
      })
      .then((resp) => {
        resp[4].send('Hello', (response) => {
          totals += response.msg
        })
        return resp
      })
      .then((resp) => {
        setTimeout(() => {
          expect(totals).to.equal(111)
          Promise.all(resp.map((conn) => conn.stop()))
            .then(() => done())
        }, 50)
      })
  })

})
