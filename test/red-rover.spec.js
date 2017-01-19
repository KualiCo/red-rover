/* eslint-disable max-statements */
'use strict'

const expect = require('chai').expect
const spy = require('chai').spy
const RedRover = require('..')

describe('red-rover', () => {
  const redRover = new RedRover({ port: 6379 })
  let subs = []
  let pub

  before(() => {
    // redRover.monitor((time, args, raw_reply) => {
    //   const ts = new Date(Math.round(time * 1000)).toLocaleTimeString()
    //   console.log(`[${ts}] ${args}`)
    // })
  })

  afterEach(() => {
    subs.forEach((sub) => {
      sub.unsubscribe()
      sub.quit()
    })
    subs = []
    if (pub) pub.quit()
  })

  it('fails silently', (done) => {
    const redRover2 = new RedRover({ host: 'die' }, true)
    const CHANNEL = 'events'

    subs[0] = redRover2.subscriber()
    pub = redRover2.publisher()

    subs[0].subscribe(CHANNEL)
      .then((count) => {
        assert(false, 'should not subscribe')
      })

    let interval = setInterval(() => pub.publish(CHANNEL), 100)
    setTimeout(() => {
      clearInterval(interval)
      done()
    }, 320)
  })

  it('recieves events', (done) => {
    const CHANNEL = 'events'
    subs[0] = redRover.subscriber()
    pub = redRover.publisher()

    subs[0].subscribe(CHANNEL)
      .then((count) => {
        expect(count).to.equal(1)
        subs[0].on('message', receipt)
        pub.publish(CHANNEL)
        pub.publish(CHANNEL)
      })

    let cnt = 0
    function receipt(channel, message) {
      expect(message).to.have.property('_id')
      expect(cnt).to.be.below(3)
      if (++cnt === 2) done()
    }
  })

  it('passes data', (done) => {
    const CHANNEL = 'events'
    const DATA = {
      foo: 'bar',
      hello: 'world',
    }
    subs[0] = redRover.subscriber()
    pub = redRover.publisher()

    subs[0].subscribe(CHANNEL)
      .then(() => {
        subs[0].on('message', receipt)
        pub.publish(CHANNEL, DATA)
      })

    function receipt(channel, message) {
      expect(message.msg).to.have.property('foo', 'bar')
      expect(message.msg).to.have.property('hello', 'world')
      done()
    }
  })

  it('handles event only once per group', (done) => {
    const CHANNEL = 'events'
    const GROUP_1 = 'group 1'
    const GROUP_2 = 'group 2'
    const SPY_0 = spy()
    const SPY_1 = spy()
    const SPY_2 = spy()

    subs[0] = redRover.subscriber()
    subs[1] = redRover.subscriber(GROUP_1)
    subs[2] = redRover.subscriber(GROUP_2)
    subs[3] = redRover.subscriber(GROUP_2)
    pub = redRover.publisher()

    let count = 0
    let timer
    const incr = (amount) => {
      clearTimeout(timer)
      count += amount
      timer = setTimeout(check, 15)
    }

    Promise.all(subs.map((sub) => sub.subscribe(CHANNEL)))
      .then(() => {
        subs[0].on('message', () => { incr(1) })
        subs[1].on('message', () => { incr(10) })
        subs[2].on('message', () => { incr(100) })
        subs[3].on('message', () => { incr(100) })
      })
      .then(() => {
        pub.publish(CHANNEL)
      })

    function check() {
      expect(count).to.equal(111)
      done()
    }
  })

  it('can use .once', (done) => {
    const CHANNEL = 'events'
    pub = redRover.publisher()

    let isDone = false
    redRover.once(CHANNEL)
      .then((message) => {
        expect(message).to.have.property('_id')
        isDone = true
      })

    function recursivePublish(delay) {
      if (isDone) return done()
      setTimeout(() => {
        pub.publish(CHANNEL)
        recursivePublish(delay + delay)
      }, delay) 
    }

    recursivePublish(2)
  })

  it('can unsubscribe from a single subscription', (done) => {
    const CHANNEL = 'events'
    subs[0] = redRover.subscriber()
    pub = redRover.publisher()

    let count = 0
    let start
    subs[0].subscribe(CHANNEL)
      .then(() => {
        subs[0].on('message', onMessage)
        pub.publish(CHANNEL)
        start = Date.now()
      })

    function onMessage() {
      count++

      subs[0].unsubscribe(CHANNEL)
        .then(() => { pub.publish(CHANNEL) })
        .then(check(Date.now() - start))
    }

    function check(ms) {
      setTimeout(() => {
        expect(count).to.be.equal(1)
        done()
      }, 2 * ms)
    }
  })

  it('can dispose of all subscriptions', (done) => {
    const CHANNEL_1 = 'events one'
    const CHANNEL_2 = 'events two'
    const CHANNEL_3 = 'events three'

    subs[0] = redRover.subscriber()
    pub = redRover.publisher()

    const counts = {
      [CHANNEL_1]: 0,
      [CHANNEL_2]: 0,
      [CHANNEL_3]: 0,
    }
    let start
    let checks = 0

    Promise.all([
      subs[0].subscribe(CHANNEL_1),
      subs[0].subscribe(CHANNEL_2),
      subs[0].subscribe(CHANNEL_3),
    ])
      .then(() => {
        subs[0].on('message', onMessage)
      })
      .then(() => {
        start = Date.now()
        pub.publish(CHANNEL_1)
        pub.publish(CHANNEL_2)
        pub.publish(CHANNEL_3)
      })

    function onMessage(channel) {
      counts[channel]++
      subs[0].unsubscribe()
        .then(() => {
          pub.publish(CHANNEL_1)
          pub.publish(CHANNEL_2)
          pub.publish(CHANNEL_3)
          
          if (!checks++) check(Date.now() - start)
        })
    }

    function check(ms) {
      setTimeout(() => {
        expect(counts[CHANNEL_1]).to.be.equal(1)
        expect(counts[CHANNEL_2]).to.be.equal(1)
        expect(counts[CHANNEL_3]).to.be.equal(1)
        done()
      }, ms * 2)
    }
  })

  it('subscribes on a pattern', (done) => {
    const CHANNEL_1 = 'test.example.com/events/users/update'
    const CHANNEL_2 = 'test.example.com/events/users/create'
    const CHANNEL_3 = 'test.example.com/events/notifications'
    const CHANNEL_S = 'test.example.com/events/users/*'

    subs[0] = redRover.subscriber()
    pub = redRover.publisher()

    subs[0].psubscribe(CHANNEL_S)
      .then(() => {
        subs[0].on('pmessage', receipt)
        pub.publish(CHANNEL_1, 1)
        pub.publish(CHANNEL_2, 10)
        pub.publish(CHANNEL_3, 100)
      })

    let totals = 0
    function receipt(pchannel, channel, message) {
      totals += message.msg
    }

    setTimeout(() => {
      expect(totals).to.equal(11)
      done()
    }, 50)
  })

})
