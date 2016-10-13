/* eslint-disable max-statements */
'use strict'

const expect = require('chai').expect
const spy = require('chai').spy
const RedRover = require('..')

describe('red-rover', () => {
  const cfg = {
    port: 32768,
  }
  const redRover = new RedRover(cfg)
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
      expect(message).to.have.property('foo', 'bar')
      expect(message).to.have.property('hello', 'world')
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

    Promise.all(subs.map((sub) => sub.subscribe(CHANNEL)))
      .then(() => {
        subs[0].on('message', SPY_0)
        subs[1].on('message', SPY_1)
        subs[2].on('message', SPY_2)
        subs[3].on('message', SPY_2)
      })
      .then(() => {
        pub.publish(CHANNEL)
      })

    setTimeout(() => {
      expect(SPY_0).to.have.been.called(1)
      expect(SPY_1).to.have.been.called(1)
      expect(SPY_2).to.have.been.called(1)
      done()
    }, 50)
  })

  it('can use .once', (done) => {
    const CHANNEL = 'events'
    pub = redRover.publisher()

    redRover.once(CHANNEL)
      .then((message) => {
        expect(message).to.have.property('_id')
        done()
      })

    setTimeout(() => {
      pub.publish(CHANNEL)
      pub.publish(CHANNEL)
    }, 50)
  })

  it('can unsubscribe from a single subscription', (done) => {
    const CHANNEL = 'events'
    subs[0] = redRover.subscriber()
    pub = redRover.publisher()

    let count = 0
    subs[0].subscribe(CHANNEL)
      .then(() => {
        subs[0].on('message', () => {
          count++
          subs[0].unsubscribe(CHANNEL)
          pub.publish(CHANNEL)
        })
        pub.publish(CHANNEL)
      })

    setTimeout(() => {
      expect(count).to.be.equal(1)
      done()
    }, 150)
  })

  it('can dispose of all subscriptions', (done) => {
    const CHANNEL_1 = 'events one'
    const CHANNEL_2 = 'events two'
    const CHANNEL_3 = 'events three'

    subs[0] = redRover.subscriber()
    pub = redRover.publisher()

    Promise.all([
      subs[0].subscribe(CHANNEL_1),
      subs[0].subscribe(CHANNEL_2),
      subs[0].subscribe(CHANNEL_3),
    ])
      .then(() => {
        subs[0].on('message', retreive)
      })
      .then(() => {
        pub.publish(CHANNEL_1)
        pub.publish(CHANNEL_2)
        pub.publish(CHANNEL_3)
      })
      .then(() => subs[0].unsubscribe())
      .then(() => {
        pub.publish(CHANNEL_1)
        pub.publish(CHANNEL_2)
        pub.publish(CHANNEL_3)
      })

    const counts = {
      [CHANNEL_1]: 0,
      [CHANNEL_2]: 0,
      [CHANNEL_3]: 0,
    }

    function retreive(channel) {
      counts[channel]++
    }

    setTimeout(() => {
      expect(counts[CHANNEL_1]).to.be.equal(1)
      expect(counts[CHANNEL_2]).to.be.equal(1)
      expect(counts[CHANNEL_3]).to.be.equal(1)
      done()
    }, 50)
  })

  it('subscribes on a pattern', (done) => {
    const eventSpy = spy()
    subs[0] = redRover.subscriber(cfg)
    pub = redRover.publisher(cfg)
    subs[0].on('events:*', eventSpy)
    pub.emit('event:foo')
    pub.emit('event:bar')
    setTimeout(() => {
      expect(eventSpy).to.have.been.called(2)
      done()
    }, 50)
  })

  it('retries event', (done) => {
    subs[0] = redRover.subscriber()
    pub = redRover.publisher()
    let count = 0
    subs[0].on('event', () => {
      if (count++ === 0) throw new Error('transient error')
      done()
    })
    pub.emit('event')
  })

  it('global error handling')

})
