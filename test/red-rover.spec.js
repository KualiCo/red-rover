/* eslint-disable max-statements */
'use strict'

const expect = require('chai').expect
const spy = require('chai').spy
const redRover = require('..')

describe('red-rover', () => {
  const cfg = {
    port: 32768,
  }
  let subs = []
  let pub

  afterEach(() => {
    subs.forEach((sub) => sub.dispose())
    subs = []
    if (pub) pub.dispose()
  })

  it('recieves events', (done) => {
    const eventSpy = spy()
    subs[0] = redRover.subscriber(cfg)
    pub = redRover.publisher(cfg)
    subs[0].on('event', eventSpy)
    pub.emit('event')
    pub.emit('event')
    setTimeout(() => {
      expect(eventSpy).to.have.been.called(2)
      done()
    }, 50)
  })

  it('passes data', (done) => {
    subs[0] = redRover.subscriber(cfg)
    pub = redRover.publisher(cfg)
    subs[0].on('event', (data) => {
      expect(data).to.be.eql({
        foo: 'bar',
        hello: 'world',
      })
      done()
    })
    pub.emit('event', {
      foo: 'bar',
      hello: 'world',
    })
  })

  it('handles event only once per group', (done) => {
    const groupSpy = spy()
    const group2Spy = spy()
    subs[0] = redRover.subscriberGroup('group', cfg)
    subs[1] = redRover.subscriberGroup('group', cfg)
    subs[2] = redRover.subscriberGroup('group2', cfg)
    pub = redRover.publisher(cfg)
    subs[0].on('event', groupSpy)
    subs[1].on('event', groupSpy)
    subs[2].on('event', group2Spy)
    pub.emit('event')
    setTimeout(() => {
      expect(groupSpy).to.have.been.called(1)
      expect(group2Spy).to.have.been.called(1)
      done()
    }, 50)
  })

  it('can use .once', (done) => {
    const eventSpy = spy()
    subs[0] = redRover.subscriber(cfg)
    pub = redRover.publisher(cfg)
    subs[0].once('event', eventSpy)
    pub.emit('event')
    pub.emit('event')
    setTimeout(() => {
      expect(eventSpy).to.have.been.called(1)
      done()
    }, 50)
  })

  it('can unsubscribe from a single subscription', (done) => {
    subs[0] = redRover.subscriber(cfg)
    pub = redRover.publisher(cfg)
    let count = 0
    subs[0].on('event', () => {
      if (++count > 1) return done(new Error('called more than once'))
      subs[0].unsubscribe('event')
      return pub.emit('event')
    })
    pub.emit('event')
    setTimeout(() => {
      expect(count).to.be.equal(1)
      done()
    }, 50)
  })

  it('can dispose of all subscriptions', (done) => {
    subs[0] = redRover.subscriber(cfg)
    pub = redRover.publisher(cfg)
    let count = 0
    subs[0].on('event', () => {
      if (++count > 1) return done(new Error('called more than once'))
      subs[0].dispose()
      pub.emit('event')
    })
    pub.emit('event')
    setTimeout(() => {
      expect(count).to.be.equal(1)
      done()
    }, 50)
  })

  it('issues commands', () => {
    subs[0] = redRover.subscriber(cfg)
    pub = redRover.publisher(cfg)
    subs[0].onCommand('event', (data) => {
      expect(data).to.be.eql({ name: 'Kenneth' })
      return Promise.resolve({ message: `Hello ${data.name}` })
    })
    return expect(pub.command('event', { name: 'Kenneth' }))
      .to.eventually.eql({ message: 'Hello Kenneth' })
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
