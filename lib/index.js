'use strict';

/* eslint-disable no-underscore-dangle */

const AsyncEventEmitter = require('./AsyncEventEmitter');
const gatherConfigFromEnv = require('./gatherConfigFromEnv');

// The event names listed below are for kernel specific events,
// they can not be emitted outside of the kernel (i.e. no any
// module or script that uses kernel can emit any of these).
const KERNEL_EVENT_NAMES = [
  'booting',
  'booting_backing', // async event
  'booted',
  'shutdown',
  //
];

const ee = new AsyncEventEmitter();

let config = null;


/**
 * Manually configuration. This method is optional and recommended usage is
 * only for prototyping the application. Instead not calling this method
 * and letting the kernel gather the configuration from environment
 * variables.
 *
 * @param {any} obj Configuration key-value object
 */
function configure(obj) {
  // TODO [NSTDFRZN] Be sure nested objects are frozen too
  config = Object.freeze(obj);
}

/**
 * Boot the kernel to start the application.
 * To do that emits 'boot_backing' and
 * 'boot' events to listeners.
 *
 * If the kernel wasn't configured so far
 * gathers configuration automatically
 * from environment variables.
 */
function boot() {
  if (config === null) {
    // TODO [NSTDFRZN] Be sure nested objects are frozen too
    config = Object.freeze(gatherConfigFromEnv());
  }

  ee.emitAsync('booting_backing')
    .then(() => {
      ee.emit('booting');
      ee.emit('booted');
    })
    .catch((err) => {
      ee.emit('error', err); // TODO [ERR2BTERR] Maybe err -> BootError(err)
    });
}

/**
 * Shutdown the kernel by closing the server and services
 * to gracefully shutdown the application. To do that
 * emits 2 async events; 'shutdown_server' and
 * 'shutdown_service'. After the listeners
 * of those events were settled, emits
 * 'shutted_down' event (sync).
 */
function shutdown() {
  ee.emitAsync('shutdown_server')
    .then(() => ee.emitAsync('shutdown_service'))
    .then(() => {
      ee.emit('shutted_down');
    })
    .catch((err) => {
      ee.emit('error', err); // TODO [ERR2BTERR] Maybe err -> BootError(err)
    });
}


/** @type {Kernel} */
const kernel = Object.defineProperties({}, {
  // #region Properties
  config: { get: () => config },
  //
  // #endregion Properties

  // #region Kernel Methods
  configure: { value: configure },
  boot: { value: boot },
  shutdown: { value: shutdown },
  //
  // #endregion Kernel Methods

  // #region AsyncEventEmitter Methods
  on: {
    value: (eventName, listener) => {
      ee.on(eventName, listener);
      return kernel;
    },
  },
  onAsync: {
    value: (eventName, listener) => {
      ee.onAsync(eventName, listener);
      return kernel;
    },
  },
  once: {
    value: (eventName, listener) => {
      ee.once(eventName, listener);
      return kernel;
    },
  },
  onceAsync: {
    value: (eventName, listener) => {
      ee.onceAsync(eventName, listener);
      return kernel;
    },
  },
  prependListener: {
    value: (eventName, listener) => {
      ee.prependListener(eventName, listener);
      return kernel;
    },
  },
  prependOnceListener: {
    value: (eventName, listener) => {
      ee.prependOnceListener(eventName, listener);
      return kernel;
    },
  },
  off: {
    value: (eventName, listener) => {
      ee.off(eventName, listener);
      return kernel;
    },
  },
  offAsync: {
    value: (eventName, listener) => {
      ee.offAsync(eventName, listener);
      return kernel;
    },
  },
  emit: {
    value: (eventName, ...args) => {
      if (KERNEL_EVENT_NAMES.includes(eventName)) {
        throw new Error(`Application can not emit kernel specific events ('${eventName}' in this case).`);
      }

      ee.emit(eventName, ...args);
      return kernel;
    },
  },
  emitAsync: {
    value: (eventName, ...args) => {
      if (KERNEL_EVENT_NAMES.includes(eventName)) {
        throw new Error(`Application can not emit kernel specific events ('${eventName}' in this case).`);
      }

      return ee.emitAsync(eventName, ...args);
    },
  },
  listeners: {
    value: eventName => ee.listeners(eventName),
  },
  // #endregion AsyncEventEmitter Methods
});

module.exports = kernel;


/**
 * @typedef {object} Kernel
 * @property {object} config The dictionary that holds application configuration.
 * @property {function} configure Manual configuration.
 * @property {function} boot Boot the kernel by emitting the boot event for starting the application piece by piece in order.
 * @property {function} shutdown Shutdown the kernel by emitting shutdown event for gracefully shutting down the application.
 * @property {function} on Adds the listener function to the end of the listeners array for the event.
 * @property {function} onAsync Same as `kernel.emit()` but for async events.
 * @property {function} once Adds a **one-time** listener function for the event.
 * @property {function} onceAsync Same as `kernel.on()` but for async events.
 * @property {function} prependListener Adds the listener function to the __beginning__ of the listeners array for the event.
 * @property {function} prependOnceListener Adds a **one-time** listener function for the event to the __beginning__ of the listeners array.
 * @property {function} off Removes the specified listener from the listener array for the event.
 * @property {function} offAsync Same as `kernel.off()` but for async events.
 * @property {function} emit Synchronously calls each of the listeners registered for the event, in the order they were registered, passing the supplied arguments to each.
 * @property {function} emitAsync Same as `kernel.emit()` but for async events.
 * @property {function} listeners Returns a copy of the array of listeners for the event.
 */
