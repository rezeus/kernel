# kernel

Kernel for event-driven applications.

Central place for emitting events (sync or async), gathering and storing configuration and holding references to various pieces.

## Table of Contents

* [Installation](#installation)
* [Usage](#usage)
* [Configuration](#configuration)
  * [Automatic Configuration](#automatic-configuration)
* [Shutting Down the Kernel and the App](#shutting-down-the-kernel-and-the-app)
* [Testing the App](#testing-the-app)
* [API](#api)
  * [kernel.config](#kernelconfig)
  * [kernel.configure(Object)](#kernelconfigureobject)
  * [kernel.boot()](#kernelboot)
  * [Proxied events Methods](#proxied-events-methods)
    * [kernel.emit(eventName[, ...args])](#kernelemiteventname-args)
    * [kernel.listeners(eventName)](#kernellistenerseventname)
    * [kernel.off(eventName, listener)](#kerneloffeventname-listener)
    * [kernel.on(eventName, listener)](#kerneloneventname-listener)
    * [kernel.once(eventName, listener)](#kernelonceeventname-listener)
    * [kernel.prependListener(eventName, listener)](#kernelprependlistenereventname-listener)
    * [kernel.prependOnceListener(eventName, listener)](#kernelprependoncelistenereventname-listener)
  * [Async Event Methods](#async-event-methods)
    * [kernel.emitAsync(eventName, data)](#kernelemitasynceventname-data)
    * [kernel.offAsync(eventName, listener)](#kerneloffasynceventname-listener)
    * [kernel.onAsync(eventName, listener)](#kernelonasynceventname-listener)
    * [kernel.onceAsync(eventName, listener)](#kernelonceasynceventname-listener)
* [License](#license)

## Installation

```sh
npm install @rezeus/kernel --save
```

## Usage

Since the package doesn't export a class, `require`ing it will create **the** kernel (if it were export a class the return value of the `require` would be a singleton instance). So `require` will give you the one and only kernel object. You can keep this object's reference in the `global` object or re-`require` where needed. For example;

```javascript
// index.js

const kernel = require('@rezeus/kernel');

global.kernel = kernel;

require('./otherFileThatUsesTheKernel');

// ...
```

```javascript
// otherFileThatUsesTheKernel.js

const kernel = global.kernel;

kernel.on(/* ... */);
```

**or**

```javascript
// index.js

const kernel = require('@rezeus/kernel');

require('./otherFileThatUsesTheKernel');

// ...
```

```javascript
// otherFileThatUsesTheKernel.js

const kernel = require('@rezeus/kernel');

kernel.on(/* ... */);
```

> The two variants of getting reference of the kernel is the same thanks to Node.js' module caching. You can read more about that from [here](https://nodejs.org/api/modules.html#modules_caching). That also means that you can not have more than one kernel, which would be nonsense otherwise. To clarify what I've just said; you can, and should, have a kernel per environment; one kernel for development, one for test and one for production. We will get to that in the [Testing the App](#testing-the-app) section. What I've said is you can, and should, **not** have two distinctive kernels per environment. There are ways to invalidate the Node.js' module cache, but just don't do it on the kernel.

With getting the reference out of the way here is the actual usage of the kernel;

```javascript
// index.js

const kernel = require('@rezeus/kernel');

kernel.on('error', (err) => {
  // TODO Handle error
});

kernel.once('booted', () => {
  // Kernel was booted. Here you can start the server.
});

kernel.boot();
```

The code snippet above essentially does this; sets two event handlers on the kernel and boots it. What boot mean here in the context of kernel is to do arbitrary tasks before the 'booted' event is emitted. The tasks are up to you. Below is the boot function code;

```javascript
function boot() {
  if (config === null) {
    config = Object.freeze(gatherConfigFromEnv());
  }

  ee.emitAsync('booting_backing')
    .then(() => {
      ee.emit('booting');
      ee.emit('booted');
    })
    .catch((err) => {
      ee.emit('error', err);
    });
}
```

Here, as you can see, the kernel emits 'booting_backing' event asynchronously (via it's underlying event emitter's `emitAsync` method), and then emits 'booting' and 'booted' events respectively. Emitting an event asynchronously means that the event emitter will block the execution until all the listeners for this particular event are settled (resolved or rejected).

> Please note that `ee` is the instance name of underlying [event emitter class](https://github.com/rezeus/kernel/blob/master/lib/AsyncEventEmitter.js). It is used in the kernel file. It's no different than calling `kernel.emitAsync` method since the kernel object _is_ also that event emitter instance. If that confused you here is the rephrase; the kernel object proxies event emitter methods to that instance. If that also confuses you see [the code](https://github.com/rezeus/kernel/blob/master/lib/index.js#L71-L122).

So for this case, all the `async` listeners for the 'booting_backing' event will be `await`ed. You can listen for this event in some other file to, for example, establish the database connection. And also if any error occurs along the way the execution will stop and 'error' event will be fired. It is the very event name that we've add a listener to it on 'index.js' above.

Please note that an asynchronous event is no different than a synchronous event in terms of listener invocation, the same rule applies to it as well; first added listener will be called first. **Asynchronous event is a regular event whose listener returns a Promise**.

You might have noticed the condition about the `config` in the boot function's codes. The config object of the kernel is just a plain old JavaScript object with keys and values. Those 3 lines reads as follows; if you haven't set configuration of the kernel (thus the application that uses the kernel) then try to gather configuration keys and values from environment variables. You can read about it from [here](#configuration), or go with the flow and eventually reach there.

As being said, what to do while booting the kernel is up to you but here's a small example;

```javascript
// services/database.js

const Sequelize = require('sequelize');

const kernel = global.kernel;
// or
// const kernel = require('@rezeus/kernel');

kernel.on('booting_backing', () => new Promise((resolve, reject) => {
  // Code excerpted from http://docs.sequelizejs.com/manual/installation/getting-started
  // and slightly modified

  // Setting up a connection
  const sequelize = new Sequelize('database', 'username', 'password', {
    host: 'localhost',
    dialect: 'mysql',
    operatorsAliases: false,

    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
  });

  // Test the connection
  sequelize
    .authenticate()
    .then(() => {
      console.log('Connection has been established successfully.');

      kernel.sequelize = sequelize;
      resolve();
    })
    .catch((err) => {
      console.error('Unable to connect to the database:', err);

      reject(err);
    });
}));
```

Having this file and `require`ing it **before** booting the kernel will result in an established database connection and `kernel.sequelize` reference, of course if it resolves. Also please note it must not be in it's own file, as long as the event handler registering occurs before the boot method invocation.

Finally if booting has done successfully we can start the server to listen. Below is the enhanced code snippet from above;

```javascript
// index.js

const http = require('http');

const kernel = require('@rezeus/kernel');

require('./services/database');

kernel.on('error', (err) => {
  // TODO Handle error
});

kernel.once('booted', () => {
  // Kernel was booted. Here you can start the server.

  // Code excerpted from https://nodejs.org/en/docs/guides/getting-started-guide/
  // and slightly modified

  const server = http.createServer((req, res) => {
    // Now you can use Sequelize to query some data;
    // kernel.sequelize.query('SELECT * FROM my_table').then((result) => { ... }).catch(...);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello World\n');
  });

  server.listen('127.0.0.1', 3000, () => {
    console.log('Server running on port 3000');
  });
});

kernel.boot();
```

As well as you can listen to the kernel emitting events, you can emit your events via the kernel too. It's simple as that;

```javascript
// assuming 'kernel' is the reference name for the kernel you got somehow

kernel.emit('my_event', payload);
// or
kernel.emitAsync('my_async_event', payload)
  .then(() => {
    // All the listeners has been invoked and resolved
  })
  .catch((err) => {
    // One of the listeners threw an error.
  });
```

## Configuration

User of the kernel is going to be your application and other pieces of codes around the application. Therefore it is good to have all the configuration settings in one, easily accessable place. Frankly it well may be the kernel. You can manually configure it or let it to gather configuration keys and values from the environment variables upon boot. Former is most suitable for developer-controlled environments (i.e. development and test) while latter is better for staging and production. Of course, once again, it's up to you, the previous sentence was merely my humble opinion about configuration.

It's better to have nested objects for specific parts of the application; e.g., one object for database settings, one for server, etc. You can call `configure` method on the kernel to do that. For example;

```javascript
// assuming 'kernel' is the reference name for the kernel you got somehow
// and add the necessary event handlers

// Manual configuration must be done before boot
kernel.configure({
  database: {
    host: 'localhost',
  },
  server: {
    port: 3000,
  },
});

kernel.boot();
```

Once set (manually or automatically) any configuration setting can get like so;

```javascript
const databaseConfig = kernel.config.database;
/**
 * databaseConfig = {
 *  host: 'localhost'
 * }
 */

console.log(kernel.config.server.port); // prints '3000'
```

### Automatic Configuration

If you don't call the `configure` method on the kernel, it will gather the configuration from the environment variables. It will do it somehow smart way in order to came up with the exact same structure as you would do manually. So for example to construct the configuration object same with the one above you should run the application like so;

```sh
APP_DATABASE__HOST='localhost' \
APP_SERVER__PORT=3000 \
node index.js
```

Assuming you start your application (especially on the staging and/or on the production server(s)) via `node index.js` command on a *nix platform. Although it doesn't matter how you start your application or what defines your application, be it a Docker container or an executable (see awesome [pkg](https://github.com/zeit/pkg) project) as long as you set the necessary environment variables.

As you might have noticed each and every environment variable (to configure the kernel) starts with 'APP_' prefix and '__' (double underscores) separates keys from values. Double underscores are used as separators due to support multi-word keys and values. For example `APP_FOO_BAR__BAZ__QUX_QUUX='quuz'` corresponds to;

```javascript
kernel.config.fooBar.baz.quxQuux === 'quuz'
```

Also automatic configuration gathering is smart enough to distinguish value types; it can parse value as string, as integer (number), as boolean, as array and as object by some use of hints. So no need to coerce the config key to desired type/literal. JavaScript is dynamically typed language, though that wasn't the point; you don't have to `Number.parseInt(kernel.config.server.port)`.

Here is a quick list of different value types to be parsed and their corresponding configuration object entries respectively;

```sh
APP_STR__REAL_STR='the string' \
APP_BOOL_1=true \
APP_BOOL_2=false \
APP_STR__LOOKS_BOOL_BUT_STR='true' \
APP_NUM=42 \
APP_OBJ={"foo":"must use double quotes here for key and value"} \
APP_ARR=['str',true,42,{"an":"obj"},[1,'array']]
```

```javascript
kernel.config === {
  str: {
    realStr: 'the string',
    looksBoolButStr: 'true',
  },
  bool1: true,
  bool2: false,
  num: 42,
  obj: {
    foo: 'must use double quotes here for key and value',
  },
  arr: ['str',true,42,{"an":"obj"},[1,'array']]
};
```

## Shutting Down the Kernel and the App

To properly terminate the application process, also known as graceful shutdown, the application must close the resources (thus handing over them to the system back, if that's the case) it has been using (e.g. port(s), file descriptor(s), etc.) and notify the other applications/services it has been established connection on (e.g. database, caching service, mail delivery service, etc.). All those can be done as soon as a process signal received, namely the `SIGTERM`. But, as always, orchestrating bits and pieces is a messy job, so the kernel is here to help you.

The `shutdown` method of the kernel does 3 things in order;
 * Emits 'shutdown_server' asynchronous event,
 * Emits 'shutdown_service' asynchronous event,
 * Emits 'shutted_down' synchronous event.

Recall that emitting an asynchronous event is merely blocking the code execution where the emit occured until all the asynchronous listeners settles. So we can wait for a listener to finish its job and also we can be confident about the result (either resolved or rejected) and act accordingly.

Before the code example here's a quick notification; the application should start shutting down with the server, and then other services are OK to shutdown. Since this is the graceful shutdown the application should serve the connected users but disallowing new users to connect and then terminate itself. This is why the `shutdown` method emits 2 distinct asynchronous events.

Let's assume we have a proper application code to start the server and a service to connect to the database (e.g. such `index.js` [here](https://gist.github.com/ozanmuyes/bfa1b6adc535df06bce4ad84642be909/e75e09170371d17385712351509298cd31150495) and `services/database.js` [here](https://gist.github.com/ozanmuyes/bfa1b6adc535df06bce4ad84642be909/e75e09170371d17385712351509298cd31150495));

```javascript
// index.js

// snip

// First register the listener against the kernel...
kernel.on('shutted_down', () => {
  process.exit();
});

process.on('SIGTERM', () => {
  // ...and then start shutting down (i.e. graceful shutdown)
  kernel.shutdown();

  // NOTE Beware that the `SIGTERM` signal may be signalled multiple times (hance `.on()` not `.once()`)
});

kernel.boot();
```

The only missing thing is to register event listeners for shutdown events (i.e. 'shutdown_server' and 'shutdown_service'). The code addition above is merely a foundation for graceful shutdown. So we should update server and service (in this case only database) initialization procedures accordingly;

```javascript
// index.js

// snip

kernel.once('booted', () => {
  // Kernel was booted. Here you can start the server.

  // snip

  kernel.once('shutdown_server', () => new Promise((resolve) => {
    server.close(() => { resolve(); });
  }));
});

// snip
```

```javascript
// services/database.js

// snip

kernel.on('booting_backing', () => new Promise((resolve, reject) => {
  // snip

  // NOTE We are just returning the result of the `.close()` method since the return value is Promise
  kernel.on('shutdown_service', () => sequelize.close());
});
```

The changes made so far can be seen [here](https://gist.github.com/ozanmuyes/bfa1b6adc535df06bce4ad84642be909/revisions#diff-168726dbe96b3ce427e7fedce31bb0bc).

## Testing the App

Since the application (actually the server in this context) depends on the kernel to start listening there must be a kernel for the test environment as well. As a rule of thumb you have an index file at the root of the project directory which is for development/staging/production environments and an index file at the test directory for test environment. To illustrate;

```bash
├── index.js
├── package.json
└── test
    └── index.js
```

In the 'test/index.js' file once the kernel has booted and server started to listening we can manually run tests via a test framework (or just manually run manual test if any test framework isn't the case). Some popular test frameworks exposes API to do that;

* [Mocha](https://mochajs.org/api/mocha#run)
* [Karma](http://karma-runner.github.io/3.0/dev/public-api.html)

For the test kernel it is well suited to [manually configure the kernel](#configuration).

Other environments may leverage from the NODE_ENV environment variable to determine the running environment and act accordingly;

* For development `NODE_ENV=development node index.js`,
* For staging `NODE_ENV=staging node index.js`,
* For production `NODE_ENV=production node index.js`

> NOTE: Same application entry file (i.e. `index.js`) for all different environments, only change is the value of NODE_ENV environment variable here.

Or for each environment, aside from setting the NODE_ENV with it's appropriate value, use another application entry file. So for example;

* For development `NODE_ENV=development node index.js`,
* For staging `NODE_ENV=staging node index_staging.js`,
* For production `NODE_ENV=production node index_production.js`

commands might as well be executed. The point of having individual entry files (thus kernels) is to have better control over the configuration and selectively `require` necessary packages or mock some parts of the application in the corresponding 'index' file. To help you to better understand the concept here is an example of such 'index' files;

```javascript
// index.js - application entry file for development environment

const kernel = require('@rezeus/kernel');

require('./services/database');

kernel.configure({
  database: {
    dialect: 'sqlite',
    storage: './db.sqlite',
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
  },
});

// Register 'booted' event handler on the kernel

kernel.boot();
```

whereas in the test environment a database connection might not be needed (assuming all tests are unit test, no integration tests);

```javascript
// index.js - application entry file for test environment

const kernel = require('@rezeus/kernel');

// No database service requirement...

kernel.configure({
  // ...thus database configuration omitted
  server: {
    host: '127.0.0.1',
    port: 9000, // server port might be different
  },
});

// Register 'booted' event handler on the kernel

kernel.boot();
```

## API

### kernel.config

Getter for the internal configuration object of the kernel.

Must be either configured via `kernel.configure` before booting the kernel or left as-is to automatic configuration gathering from environment variables. See [Automatic Configuration](#automatic-configuration) section for usage details.

### kernel.configure(Object)

Accepts an argument as object of type and sets internal config object (`kernel.config`) to it. After assignment the internal config object is going to be [frozen](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze).

### kernel.boot()

Initiates the booting procedures on the kernel. Fires 'booting_backing' event, then if no error occurs fires 'booting' and 'booted' events respectively. Otherwise fires 'error' event with caught error object.

Be aware that this method is not idempotent, that is calling it multiple times may cause strange behaviours. To prevent unwanted behaviours consider listening those events by 'once' and 'onceAsync' instead of 'on' and 'onAsync' where appropriate.

### kernel.shutdown()

Shutdown the kernel by closing the server and services to gracefully shutdown the application. To do that emits 2 async events; 'shutdown_server' and 'shutdown_service'. After the listeners of those events were settled, emits 'shutted_down' event (synchronously).

### Proxied events Methods

Those methods are already defined in the `events` module and kernel only proxies those methods.

#### kernel.emit(eventName[, ...args])

Please see [emitter.emit](https://nodejs.org/api/events.html#events_emitter_emit_eventname_args).

#### kernel.listeners(eventName)

Please see [emitter.listeners](https://nodejs.org/api/events.html#events_emitter_listeners_eventname).

#### kernel.off(eventName, listener)

Please see [emitter.off](https://nodejs.org/api/events.html#events_emitter_off_eventname_listener).

#### kernel.on(eventName, listener)

Please see [emitter.on](https://nodejs.org/api/events.html#events_emitter_on_eventname_listener).

#### kernel.once(eventName, listener)

Please see [emitter.once](https://nodejs.org/api/events.html#events_emitter_once_eventname_listener).

#### kernel.prependListener(eventName, listener)

Please see [emitter.prependListener](https://nodejs.org/api/events.html#events_emitter_prependlistener_eventname_listener).

#### kernel.prependOnceListener(eventName, listener)

Please see [emitter.prependOnceListener](https://nodejs.org/api/events.html#events_emitter_prependoncelistener_eventname_listener).

### Async Event Methods

#### kernel.emitAsync(eventName, data)

Same as `kernel.emit()` but for async events.

#### kernel.offAsync(eventName, listener)

Same as `kernel.off()` but for async events.

#### kernel.onAsync(eventName, listener)

Same as `kernel.on()` but for async events.

#### kernel.onceAsync(eventName, listener)

Same as `kernel.once()` but for async events.

## License

MIT License

Copyright (c) 2018-2019 Ozan Müyesseroğlu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
