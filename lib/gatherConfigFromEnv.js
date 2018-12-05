'use strict';

const NAME_PREFIX = 'APP_';

/** @param {string} str */
function snakeToCamel(str) {
  // gets 'QUX_QUUX'
  // returns 'quxQuux'

  const retVal = str
    .split('_')
    .map(s => `${s[0].toUpperCase()}${s.substring(1).toLowerCase()}`)
    .join('');

  return `${retVal[0].toLowerCase()}${retVal.substring(1)}`;
}

/** @param {string} key */
function transformKey(key) {
  // gets 'APP_FOO_BAR__BAZ'
  // returns 'fooBar.baz'

  return key
    .substring(NAME_PREFIX.length)
    .split('__')
    .map(s => snakeToCamel(s))
    .join('.');
}

/** @param {string} str */
function parseValue(str) {
  switch (str[0]) {
    case '\'': {
      if (str[str.length - 1] === '\'') {
        return str.substring(1, str.length - 1);
      }

      throw new SyntaxError(`Invalid configuration value (${str}): Started as a string but not ends with "'".`);
    }

    case '[':
      return JSON.parse(str.replace(/'/g, '"'));

    case '{':
      return JSON.parse(str);

    default: {
      // Still might be a number or boolean
      if (/^(-|\+)?([0-9]+|Infinity)$/.test(str)) {
        return Number(str);
      }

      if (str === 'true') {
        return true;
      }
      if (str === 'false') {
        return false;
      }

      return str;
    }
  }
}

/**
 * @param {any} obj
 * @param {string} path
 * @param {any} value
 */
function setValueOnObjectByPath(obj, path, value) {
  let target = obj;

  const fragments = path.split('.');
  const fragmentsLenMinus1 = (fragments.length - 1);

  for (let i = 0; i < fragmentsLenMinus1; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(target, fragments[i])) {
      target[fragments[i]] = {};
    }

    target = target[fragments[i]];
  }

  target[fragments[fragmentsLenMinus1]] = value;
}

function gatherConfigFromEnv() {
  const config = {};

  Object
    .keys(process.env)
    .filter(key => key.startsWith(NAME_PREFIX))
    .forEach((key) => {
      setValueOnObjectByPath(config, transformKey(key), parseValue(process.env[key]));
    });

  return config;
}

module.exports = gatherConfigFromEnv;
