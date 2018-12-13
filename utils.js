import hashObject from 'object-hash'

export const hasOwn = Object.prototype.hasOwnProperty

export const slice = Array.prototype.slice

export const isFunction = f => typeof f === 'function'

export const generateToken = params => hashObject([...params])
