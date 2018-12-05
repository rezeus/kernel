'use strict';

/* eslint-disable no-underscore-dangle */

const EventEmitter = require('events');

class AsyncEventEmitter extends EventEmitter {
  constructor() {
    super();

    this._onceListenersForEventName = new Map();
  }

  /**
   * Convenience method to complete 'xAsync' method naming.
   *
   * @param {string|symbol} eventName
   * @param {function} listener
   */
  onAsync(eventName, listener) {
    this.on.call(this, eventName, listener);
  }

  /**
   * @param {string|symbol} eventName
   * @param {function} listener
   */
  onceAsync(eventName, listener) {
    /** @type {Set<Function>} */
    let onceListeners = this._onceListenersForEventName.get(eventName);

    if (onceListeners === undefined) {
      this._onceListenersForEventName.set(eventName, new Set());
      onceListeners = this._onceListenersForEventName.get(eventName);
    }

    onceListeners.add(listener);

    this.once(eventName, listener);
  }

  /**
   * Emit the event and wait for all returned promises to be settle.
   *
   * @param {string|symbol} eventName
   * @param {object} data
   */
  emitAsync(eventName, data) {
    // return Promise that will settle once each event listener is settled
    const listeners = this.listeners(eventName);
    /** @type {Set<Function>} */
    const onceListeners = this._onceListenersForEventName.get(eventName);

    if (onceListeners) {
      return Promise.all([
        ...listeners.map((listener) => {
          if (onceListeners.has(listener)) {
            this.removeListener(eventName, listener);
            onceListeners.delete(listener);
          }

          return (data ? listener(data) : listener());
        }),
      ]);
    }

    return Promise.all([
      ...listeners.map(listener => (data ? listener(data) : listener())),
    ]);
  }

  /**
   * Convenience method to complete 'xAsync' method naming.
   *
   * @param {string|symbol} eventName
   * @param {function} listener
   */
  offAsync(eventName, listener) {
    this.off.call(this, eventName, listener);
  }

  //
}

module.exports = AsyncEventEmitter;
