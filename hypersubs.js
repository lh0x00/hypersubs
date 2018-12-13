import { Random } from 'meteor/random'
import { EJSON } from 'meteor/ejson'
import { Tracker } from 'meteor/tracker'
import { slice, hasOwn, generateToken, isFunction } from './utils'

export const name = 'hypersubs'

function applyHyperSubs() {
  const shouldPreventBinding = !!(Meteor.subscribe && Meteor.subscribe.isHyperSubs)
  if (shouldPreventBinding) {
    return true
  }

  const originalConnection = Meteor.connection
  const originalSubscribe = Meteor.subscribe

  function argsParser(name) {
    const params = slice.call(arguments, 1)
    let callbacks = Object.create(null)
    if (params.length) {
      const lastParam = params[params.length - 1]
      if (isFunction(lastParam)) {
        callbacks.onReady = params.pop()
      } else if (lastParam && [lastParam.onReady, lastParam.onError, lastParam.onStop].some(isFunction)) {
        callbacks = params.pop()
      }
    }
    return {
      name,
      params,
      callbacks
    }
  }

  function createSubscription(data, options) {
    const self = this

    const { name, params, callbacks = {} } = data
    const { isOriginalSubscription = false } = options

    const tokenOfSubscription = generateToken([name, ...params])

    const checkIfSubscriptionExisted = sub => sub.inactive && sub.name === name && EJSON.equals(sub.params, params)
    let existing = Object.values(self._subscriptions).find(checkIfSubscriptionExisted)

    let id
    if (existing) {
      id = existing.id
      existing.inactive = false

      if (callbacks.onReady) {
        if (existing.ready) {
          callbacks.onReady()
        } else {
          existing.readyCallback = callbacks.onReady
        }
      }

      if (callbacks.onError) {
        existing.errorCallback = callbacks.onError
      }

      if (callbacks.onStop) {
        existing.stopCallback = callbacks.onStop
      }
    } else {
      id = Random.id()
      self._subscriptions[id] = {
        token: tokenOfSubscription,
        id: id,
        name: name,
        params: EJSON.clone(params),
        inactive: false,
        ready: false,
        readyDeps: new Tracker.Dependency(),
        readyCallback: callbacks.onReady,
        errorCallback: callbacks.onError,
        stopCallback: callbacks.onStop,
        connection: self,
        remove() {
          delete this.connection._subscriptions[this.id]
          this.ready && this.readyDeps.changed()
        },
        stop() {
          if (isOriginalSubscription) {
            this.connection._send({ msg: 'unsub', id: id })
          }
          this.remove()

          if (callbacks.onStop) {
            callbacks.onStop()
          }
        }
      }
      if (isOriginalSubscription) {
        self._send({ msg: 'sub', id: id, name: name, params: params })
      }
    }

    const handle = {
      stop() {
        if (!hasOwn.call(self._subscriptions, id)) {
          return
        }
        self._subscriptions[id].stop()
      },
      ready() {
        if (!hasOwn.call(self._subscriptions, id)) {
          return false
        }
        const record = self._subscriptions[id]
        record.readyDeps.depend()
        return record.ready
      },
      subscriptionId: id
    }

    const checkShouldStopOriginalSubscription = () =>
      Object.values(self._subscriptions).filter(sub => sub.token === tokenOfSubscription).length <= 1

    const shouldTrackingForVirtualSubscription = !isOriginalSubscription && Tracker.active
    if (shouldTrackingForVirtualSubscription) {
      const trackingHandleOfHyperSubs = Tracker.autorun(computation => {
        const handleOfHyperSubs = self._listHandleOfHyperSubs[tokenOfSubscription]
        const handleIsReady = handleOfHyperSubs.ready()
        const record = self._subscriptions[id]
        const isSameStateOfReady = record.ready === handleIsReady
        const isFirstRun = computation.firstRun
        if (!record.inactive && (isFirstRun || !isSameStateOfReady)) {
          record.ready = handleIsReady
          record.readyDeps.changed()
        }
      })
      Tracker.onInvalidate(() => {
        if (hasOwn.call(self._subscriptions, id)) {
          self._subscriptions[id].inactive = true
        }
        Tracker.afterFlush(() => {
          if (hasOwn.call(self._subscriptions, id) && self._subscriptions[id].inactive) {
            handle.stop()
            trackingHandleOfHyperSubs.stop()
            const shouldStopOriginalSubscription = checkShouldStopOriginalSubscription()
            if (shouldStopOriginalSubscription) {
              const handleOfHyperSubs = self._listHandleOfHyperSubs[tokenOfSubscription]
              handleOfHyperSubs.stop()
              delete self._listHandleOfHyperSubs[tokenOfSubscription]
            }
          }
        })
      })
    }

    return handle
  }

  // create function override Meteor subscribe
  function overrideSubscribe() {
    const self = this

    const data = argsParser.apply(self, arguments)
    const { name, params } = data

    const tokenOfSubscription = generateToken([name, ...params])
    self._listHandleOfHyperSubs = self._listHandleOfHyperSubs || {}
    if (!hasOwn.call(self._listHandleOfHyperSubs, tokenOfSubscription)) {
      // create real subscription to get data
      self._listHandleOfHyperSubs[tokenOfSubscription] = createSubscription.apply(self, [
        { name, params },
        {
          isOriginalSubscription: true
        }
      ])
    }

    // create fake subscription to handle tracking data
    const handle = createSubscription.apply(self, [
      data,
      {
        isOriginalSubscription: false
      }
    ])

    return handle
  }

  // override Meteor subscribe function
  Meteor.subscribe = overrideSubscribe.bind(originalConnection)
  Meteor.subscribe.isHyperSubs = true

  // backup originalSubscribe
  Meteor.originalSubscribe = originalSubscribe

  return true
}

if (Meteor.isClient) {
  Meteor.startup(applyHyperSubs)
}

export default {}
