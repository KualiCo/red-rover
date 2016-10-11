# red-rover

A utility library to handle distributed redis subscriptions.

> Red Rover, Red Rover, send `users:create` right over

# Installation

You must have `node` and `npm` installed

```
npm install --save @kuali/red-rover
```

# Usage

In the following example, 3 subscribers are set up, two of them part of the same
group. Each of these subscribers could be in different processes or even
different servers (as long as they point to the same redis instance).

Two of the subscribers are signed up with `group1`, and the other is a part of
`group2`. When an event goes out that all three of them are listening to, only
one of the subscribers from each group will pick up the event.

```js
'use strict'

const redRover = require('@kuali/red-rover')

const redisOptions = { host: '127.0.0.1', port: 6379 }
const sub1 = redRover.subscriber('group1', redisOptions)
const sub2 = redRover.subscriber('group1', redisOptions)
const sub3 = redRover.subscriber('group2', redisOptions)
const pub = redRover.publisher(redisOptions)

sub1.on('user:create', (payload) => {
  console.log('user created', payload)
})

sub2.on('user:create', (payload) => {
  console.log('user created', payload)
})

sub3.on('user:create', (payload) => {
  console.log('user created', payload)
})

pub.emit('user:create', {
  email: 'test@test.com'
})
```

# API

## `redRover.publisher()`

Returns a publisher

## `redRover.subscriber(redisOptions)`

Creates an event subscriber.

- `redisOptions` (Object) - The options to pass into the redis library.

Returns a subscriber

## `redRover.subscriberGroup(groupName, redisOptions)`

Creates an event subscriber group. The difference between this and a regular
subscriber is that if you have multiple subscribers using the same groupName,
only one subscriber in that group will recieve any given unique event. This is
useful if you have scaled your app to multiple instances, but you only want a
given event handled once per event (instead of each node handling the event).

- `groupName` (String) - The group name to use
- `redisOptions` (Object) - The options to pass into the redis library.

Returns a subscriber

## `publisher.emit(event[, payload])`

Emits an event.

- `event` (String) - The event to emit
- `payload` (Mixed) - The payload to send through the event. Note that this
  should be serializable into JSON. Any functions or circular references get
  removed.

## `subscriber.on(event, handler)`

Sets up a subscription to a given event.

- `event` (String) - The event (or event pattern) to listen to. Event patterns
  follow redis' [channel pattern syntax](http://redis.io/commands/psubscribe).
- `handler` (Function) - The handler to the event. It should only have one
  argument, the payload that the event emits.

## `subscriber.once(event, handler)`

Same as `subscriber.on`, but unsubscribes from the channel when it handles the
event once.
