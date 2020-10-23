import hashObject from 'object-hash'

export const hasOwn = Object.prototype.hasOwnProperty

export const slice = Array.prototype.slice

export const isFunction = f => typeof f === 'function'

export const generateToken = params => hashObject([...params])

export function argsParser(name) {
  const params = slice.call(arguments, 1)
  let callbacks = Object.create(null)
  if (params.length) {
    const lastParam = params[params.length - 1]
    if (lastParam === undefined) {
      return {
        name,
        params,
        callbacks
      };
    }

    const listCallbacks = [lastParam.onReady, lastParam.onError, lastParam.onStop]
    if (isFunction(lastParam)) {
      callbacks.onReady = params.pop()
    } else if (lastParam && listCallbacks.some(isFunction)) {
      callbacks = params.pop()
    }
  }
  return {
    name,
    params,
    callbacks
  }
}

export function stats(connection) {
  if (!connection) {
    throw new Error('Not found DDP connection')
  }

  if (!connection._subscriptions) {
    throw new Error('Not found list subscriptions of DDP connection')
  }

  const allSubscriptions = Object.values(connection._subscriptions)
  const listHyperSubscriptions = allSubscriptions.filter(sub => !!sub.isHyperSubscription)
  const listOriginalSubscriptions = listHyperSubscriptions.filter(sub => sub.isOriginalSubscription)
  const listVirtualSubscriptions = listHyperSubscriptions.filter(sub => !sub.isOriginalSubscription)

  const lengthOfAll = allSubscriptions.length
  const lengthOfHyper = listHyperSubscriptions.length
  const lengthOfOriginal = listOriginalSubscriptions.length
  const lengthOfVirual = listVirtualSubscriptions.length
  const lengthOfUse = lengthOfVirual - lengthOfOriginal
  const lengthOfSaving = lengthOfUse > 0 ? lengthOfUse : 0

  return {
    detail: {
      all: allSubscriptions,
      hyper: listHyperSubscriptions,
      original: listOriginalSubscriptions,
      virtual: listVirtualSubscriptions
    },
    count: {
      all: lengthOfAll,
      hyper: lengthOfHyper,
      original: lengthOfOriginal,
      virtual: lengthOfVirual,
      saving: lengthOfSaving
    }
  }
}

// eslint-disable-next-line no-console
export function autoPrintStats(timeout = 10000, connection, logger = console.log) {
  if (!connection || !connection.subscribe) {
    throw new Error('DDP connection is invalid')
  }

  if (!connection.subscribe.isHyperSubscribe) {
    throw new Error('Subscribe of DDP connection is not upgrade to Hypersubs!')
  }

  let counter = 0
  return setInterval(() => {
    counter += 1
    const results = stats(connection)
    const { count, detail } = results
    const { hyper, saving } = count
    const optimalPercentage = Number((saving / hyper) * 100).toFixed(2)
    const description = `saving ${optimalPercentage}%`
    logger(`#${counter}`, description, count, detail)
  }, timeout)
}

export default {}
