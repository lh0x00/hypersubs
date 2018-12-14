import hashObject from 'object-hash'

export const hasOwn = Object.prototype.hasOwnProperty

export const slice = Array.prototype.slice

export const isFunction = f => typeof f === 'function'

export const generateToken = params => hashObject([...params])

export const checkCallbacksIsValid = callbacks =>
  typeof callbacks === 'object' && Object.values(callbacks).filter(Boolean).length > 0

export function argsParser(name) {
  const params = slice.call(arguments, 1)
  let callbacks = Object.create(null)
  if (params.length) {
    const lastParam = params[params.length - 1]
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
    callbacks,
  }
}
