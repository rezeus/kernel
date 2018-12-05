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
 * Boot the kernel to start the server.
 * To do that emit 'boot:backing' and
 * 'boot' events to services.
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
      ee.emit('error', err); // TODO Maybe err -> BootError(err)
    });
}


const kernel = Object.defineProperties({}, {
  // #region Properties
  config: { get: () => config },
  //
  // #endregion Properties

  // #region Kernel Methods
  configure: { value: configure },
  boot: { value: boot },
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
      if (!KERNEL_EVENT_NAMES.includes(eventName)) {
        ee.emit(eventName, ...args);
      }
      return kernel;
    },
  },
  emitAsync: {
    value: (eventName, ...args) => {
      if (!KERNEL_EVENT_NAMES.includes(eventName)) {
        ee.emitAsync(eventName, ...args);
      }
      return kernel;
    },
  },
  // #endregion AsyncEventEmitter Methods
});

module.exports = kernel;
