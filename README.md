# red-rover

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
local redis on the default port of 6379.  
```js
const RedRover = require('@kuali/red-rover')
const redRover = new RedRover(config)
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
```js
const subscriber = redRover.subscriber('production-group')
subscriber.subscribe('user:created')
  .then(() => {
    subscriber.on('message', (channel, message) => {
      console.log(message)
    })
  })
```
In the circumstance when you desire a single response from a group of
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


## Subsbriber

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


### `subscriber.once(channel[, group])`

Same as `subscriber.on`, but unsubscribes from the channel when it handles the
event once. Returns a promise that is funfilled with the message when it
receives an event.

- `channel` (String) - The channel on which to listen
- `group` (String) - Optional.
