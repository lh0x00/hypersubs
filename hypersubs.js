import { Random } from 'meteor/random'
import { EJSON } from 'meteor/ejson'
import { Tracker } from 'meteor/tracker'
import { DDP } from 'meteor/ddp-client'
import { argsParser, hasOwn, generateToken, isFunction } from './utils'

export { stats, autoPrintStats } from './utils'

export const CONST = {
  CALLBACK_TYPES: {
    ON_READY: 'onReady',
    ON_ERROR: 'onError',
    ON_STOP: 'onStop',
  },
  CALLBACK_NAMES: {
    onReady: 'readyCallback',
    onError: 'errorCallback',
    onStop: 'stopCallback',
  },
}

export const name = 'hypersubs'

export const config = {
  isOverride: true,
  autorun: true,
}

/**
 * Create a subscription
 * @param {Object} data data
 * @param {Object} options options
 */
function createSubscription(data, options) {
  const self = this

  const { name, params, callbacks = {} } = data
  const { isOriginalSubscription = false } = options

  const tokenOfSubscription = generateToken([name, ...params])

  /**
   * Get ready staus of real subscription
   */
  const getReadyOfRealSubscription = () => {
    if (!self._listHandleOfHyperSubs) self._listHandleOfHyperSubs = {}
    const handleOfHyperSubs = self._listHandleOfHyperSubs[tokenOfSubscription]
    const handleIsReady = !!(handleOfHyperSubs && handleOfHyperSubs.ready())
    return handleIsReady
  }

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
      },
      isOriginalSubscription,
      isHyperSubscription: true,
    }

    if (isOriginalSubscription) {
      self._send({ msg: 'sub', id: id, name: name, params: params })
    } else {
      // if create new virtual subscription, check and trigger based real subscription existed before
      const handleIsReady = getReadyOfRealSubscription()
      const record = self._subscriptions[id]
      if (handleIsReady && !record.ready && !record.inactive) {
        record.ready = handleIsReady
        if (callbacks.onReady) {
          callbacks.onReady()
        }
        record.readyDeps.changed()
      }
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
    subscriptionId: id,
    isHyperHandle: true,
  }

  /**
   * Check should stop original subscription
   */
  const checkShouldStopOriginalSubscription = () => Object.values(self._subscriptions).filter(sub => !sub.isOriginalSubscription && sub.token === tokenOfSubscription).length === 0

  const shouldTrackingForVirtualSubscription = !isOriginalSubscription && Tracker.active
  if (shouldTrackingForVirtualSubscription) {
    const trackingHandleOfHyperSubs = Tracker.autorun(computation => {
      const handleIsReady = getReadyOfRealSubscription()
      const record = self._subscriptions[id]
      const isSameStateOfReady = record.ready === handleIsReady
      const { firstRun: isFirstRun } = computation || {}
      if (isFirstRun || (!record.inactive && !isSameStateOfReady)) {
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

/**
 * Create function override Meteor subscribe
 */
function overrideSubscribe() {
  const self = this

  const data = argsParser.apply(self, arguments)
  const { name, params } = data

  const tokenOfSubscription = generateToken([name, ...params])
  self._listHandleOfHyperSubs = self._listHandleOfHyperSubs || {}
  if (!hasOwn.call(self._listHandleOfHyperSubs, tokenOfSubscription)) {
    // create real subscription to get data
    const typeOfCallbacks = Object.values(CONST.CALLBACK_TYPES)
    const callbackReducer = (acc, typeOfCallback) => {
      const nameOfCallback = CONST.CALLBACK_NAMES[typeOfCallback]
      function callback() {
        const args = arguments
        const listSubscriptions = Object.values(self._subscriptions)
        const checkIfCallbackValid = sub => !sub.isOriginalSubscription && sub.token === tokenOfSubscription
        const subscriptions = listSubscriptions.filter(checkIfCallbackValid)
        subscriptions.forEach(sub => {
          const callback = sub[nameOfCallback]

          const shouldChangeToReady = typeOfCallback === CONST.CALLBACK_TYPES.ON_READY && !sub.ready
          if (shouldChangeToReady) {
            sub.ready = true
            sub.readyDeps.changed()
          }

          const shouldCallback = isFunction(callback)
          if (shouldCallback) {
            callback.apply(this, args)
          }
          return true
        })
      }

      return {
        ...acc,
        [typeOfCallback]: callback,
      }
    }
    const overrideCallbacks = typeOfCallbacks.reduce(callbackReducer, Object.create(null))

    self._listHandleOfHyperSubs[tokenOfSubscription] = createSubscription.apply(self, [
      { name, params, callbacks: overrideCallbacks },
      {
        isOriginalSubscription: true,
      },
    ])
  }

  // create fake subscription to handle tracking data
  const handle = createSubscription.apply(self, [
    data,
    {
      isOriginalSubscription: false,
    },
  ])

  return handle
}

/**
 * Upgrade Meteor subscribe
 * @param {Function} originalSubscribe original Meteor.subscribe
 */
export function upgradeSubscribe(originalSubscribe) {
  const self = this
  const isNotFoundSubscribe = !originalSubscribe
  if (isNotFoundSubscribe) {
    throw new Error('Not found DDP subscribe, subscribe:', originalSubscribe)
  }

  const shouldPreventBinding = !!(originalSubscribe && originalSubscribe.isHyperSubscribe)
  if (shouldPreventBinding) {
    return originalSubscribe
  }

  const hyperSubscribe = overrideSubscribe.bind(self)
  hyperSubscribe.isHyperSubscribe = true
  return hyperSubscribe
}

/**
 * Upgrade DDP connect
 * @param {Object} ddp ddp connect
 * @param {Object} overrideConfig (optional) override config
 */
export function upgradeDDPConnect(ddp, overrideConfig) {
  const originalConnect = ddp && ddp.connect
  if (!originalConnect) {
    throw new Error('Not found DDP connect, DDP:', ddp)
  }

  ddp.connect = function overrideDDPConnect(...rest) {
    const originalConnection = originalConnect(...rest)
    const originalSubscribe = originalConnection.subscribe
    applySubscribeForDDP(originalConnection, originalConnection, originalSubscribe, overrideConfig)
    originalConnection.isHyperConnection = true
    return originalConnection
  }
  return true
}

/**
 * Apply subscribe for DDP
 * @param {Object} namespace namespace
 * @param {Object} connection original connection
 * @param {Function} subscribe original suhbscribe
 * @param {Object} overrideConfig (optional) override config
 */
export function applySubscribeForDDP(namespace, connection, subscribe, overrideConfig) {
  const { isOverride = false } = overrideConfig || config || {}
  const hyperSubscribe = upgradeSubscribe.apply(connection, [subscribe])
  namespace.hyperSubscribe = hyperSubscribe
  if (isOverride) {
    namespace.subscribe = hyperSubscribe
    namespace.originalSubscribe = subscribe
  }
  return true
}

/**
 * Apply subscribe for Meteor
 * @param {Object} overrideConfig (optional) override config
 */
export function applySubscribeForMeteor(overrideConfig) {
  const originalConnection = Meteor.connection
  const originalSubscribe = Meteor.subscribe
  applySubscribeForDDP(Meteor, originalConnection, originalSubscribe, overrideConfig)
  Meteor.connection.subscribe = Meteor.subscribe
}

const { autorun } = config || {}
if (autorun) {
  // should apply function on startup
  Meteor.startup(() => {
    // auto upgrade DDP connect
    upgradeDDPConnect(DDP)

    // auto upgrade subscribe for Meteor
    if (Meteor.isClient) {
      applySubscribeForMeteor()
    }
  })
}
