# red-rover

A JavaScript event publisher/subscriber built on Redis' great pub/sub platform.
RedRover allows applications and services to communicate events without
foreknowledge of integrating systems. This decoupling allows for improved
application simplicity through isolation.

RedRover has three simple mechanisms for publishing events
1. Simple Publish and Subscribe
Applications have the ability to publish an event, including relevant event
data. Any subscribers would recieve the event and data.
2. Group Subscribe
Applications in a load balanced or clustered configuration could subscribe
to published events as a group. This unique feature of RedRobin makes it so
that only one member of the group receives the event.
3. Commands
Commands allow for bi-directional pub/sub. They provide a return channel while
still allowing publishers and subscribers to be completely unaware of
eachother.

RedRover is ready for use. It comes complete with documentation, a full suite
of tests, and performance benchmarks that you can run in your own environment.

A JavaScript event publisher/subscriber backed by Redis. 
> Red Rover, Red Rover, send `user:created` right over

## Why?
Well I am glad that you asked. Event buses like 
[redis-eventemitter](https://github.com/freeall/redis-eventemitter), 
[message-exchange](https://github.com/nathangromano/message-exchange) and 
[redis-event-bus](https://github.com/jus101/redis-event-bus) are a bit too 
simplistic. They do not give you event ids so you cannot easily respond to 
specific events. Nor do they have the notion of groups. So every event goes 
to every subscriber. This sounds reasonable, but it is common to have several 
load-balanced servers running an application, and having all of them respond 
to an event is not always the desired behavior. On the other hand 
[bus.io](https://github.com/fullstackers/bus.io) is a full application 
framework. Sometimes you just want to publish events.

# Installation

You must have `node` and `npm` installed

```
npm install --save @kuali/red-rover
```

# Usage

Using red-rover is easy. After requiring it, instantiate it by passing in 
your configuration. Omitting a configuration will attempt to connect to a 
local redis on the default port of 6379. Optional `failSilently` `boolean`
flag may be added to allow red-rover to swallow any errors.
```js
const RedRover = require('@kuali/red-rover')
const redRover = new RedRover(config, failSilently)
```

Create publishers and/or subscribers.
```js
const publisher = redRover.publisher()
const subscriber = redRover.subscriber()
```

## Publish
```js
publisher.publish('user:created', { id: 56789, name: 'John' })
```

## Subscribe
```js
subscriber.subscribe('user:created')
  .then(() => {
    subscriber.on('message', (channel, message) => {
      console.log(message)
    })
  })
```

## Group Subscribe
Allows delivery to only one of many subscribers.
```js
const subscriber = redRover.subscriber('production-group')
subscriber.subscribe('user:created')
  .then(() => {
    subscriber.on('message', (channel, message) => {
      console.log(message)
    })
  })
```
In the circumstance when you desire a single event delivery to a group of
subscribers you can create a subscriber group that will act as a single
subscriber. This is particularly useful if you have load-balanced servers
but you only want a single action to take place.

In the following example, 3 subscribers are set up, two of them part of the same
group. Each of these subscribers could be in different processes or even
different servers (as long as they point to the same redis instance).

Two of the subscribers are signed up with `group1`, and the other is a part of
`group2`. When an event goes out that all three of them are listening to, only
one of the subscribers from each group will pick up the event.

```js
const redRover = require('@kuali/red-rover')()

const subscriber1 = redRover.subscriber('group1')
const subscriber2 = redRover.subscriber('group1')
const subscriber3 = redRover.subscriber('group2')
const publisher = redRover.publisher()

subscriber1.on('message', (channel, message) => {
  console.log('user created by 1', payload)
})

subscriber2.on('message', (channel, message) => {
  console.log('user created by 2', payload)
})

subscriber3.on('message', (channel, message) => {
  console.log('user created by 3', payload)
})

subscriber.subscribe('user:created')
  .then(() => {
    publisher.publish('user:created', {
      email: 'test@test.com'
    })
  })

// Result
// user created by 1 { email: 'test@test.com' }
// user created by 3 { email: 'test@test.com' }
```

# Config options
```js
const RedRover = require('@kuali/red-rover')
const redRover = new RedRover({
  host: '127.0.0.1',
  port: 6379   
})
```
The complete set of [configuration options](https://github.com/NodeRedis/node_redis#options-object-properties). 


# API

## `redRover.publisher()`

Returns a publisher


## `redRover.subscriber(group)`

Returns a subscriber. Passing the optional group parameter restricts the 
message delivery to a single member of the group.

- `group` (String) - The group name to use


## Publisher

### `publisher.publish(channel[, event])`

Publishes a message the the passed channel.

- `channel` (String) - The channel on which to publish
- `event` (Mixed) - The payload to send through the event. Note that this
  should be serializable into JSON. Any functions or circular references get
  removed.


### `publisher.quit()`

Quits this publisher. No more events may be sent.


## Subscriber

### `subscriber.subscribe(channel)`

Subscribes to a channel. Returns a promise that is fulfilled when the
subscriber is ready to receive events. Subscribers can subscribe to many
channels.

- `channel` (String) - The channel on which to listen


### `subscriber.psubscribe(channel)`

Subscribes to a channel using a [pattern](http://redis.io/commands/psubscribe). 
Returns a promise that is fulfilled when the subscriber is ready to receive 
events. Subscribers can subscribe to many channels.

- `channel` (String) - The channel on which to listen


### `subscriber.on(eventType, handler)`

Sets up a subscription hander on a subscriber. Events on all channels on
which the subscriber is listening will call the handler.

- `eventType` (String) - This string should be 'message' or 'pmessage'.
- `handler` (Function) - The handler to the event. It should have two
  arguments, the channel and the payload that the event emits.


## Once

### `redRover.once(channel[, group])`

Subscribes to a channel for a single event. Once an event is received the 
promise is fulfilled and the subscription is cleaned up.

- `channel` (String) - The channel on which to listen
- `group` (String) - Optional.


## Commands
RedRover commands leverage publishers and subscribers to allow for 
bi-directional communication. The `Sender` creates a second channel on which
responses can be sent. The `Receiver` uses the second channel to return
a response to the `Sender`.

Although commands support groups, they still have no idea how many `Receivers`
might be listening or respond. This is necessary to enable complete decoupling.
The only way to ensure that a `Sender` receieve a single response is to have
all receivers be members of the same group. This is unenforceable through code
in the current version.

### Sender
Send a event and expect responses
```js
redRover.sender(channel)
  // the returned promise is fulfilled when channel subscriptions are setup
  .then((sender) => {
    // send an event for which you expect a response
    sender.send(event, (response) => {
      // handle returned response
    })
    // call stop when you are done
    sender.stop()
  })
```


### Receiver
Respond to sender events
```js
redRover.receiver(channel, group)
  // the returned promise is fulfilled when channel subscriptions are setup
  .then((receiver) => {
    // receive an event for which you will send a response
    receiver.receive((event) => {
      // act on event - return your response or a promise
    })
    // call stop when you are done
    receiver.stop()
  })
```

