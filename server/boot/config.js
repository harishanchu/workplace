/**
 * config.js
 *
 * @author: Harish Anchu <harishanchu@gmail.com>
 * @copyright Copyright (c) 2018, Harish Anchu.
 * @license See LICENSE
 */
'use strict';
const path = require('path');
const NodejsConfig = require('nodejs-config');

module.exports = (app) => {
  app.config = NodejsConfig(
    path.resolve('.'),  // an absolute path to your applications 'config' directory
    () => {
      return process.env.NODE_ENV;
    }
  );
};
