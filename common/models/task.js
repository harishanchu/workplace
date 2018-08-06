/**
 * Task.js
 *
 * @author: Harish Anchu <harishanchu@gmail.com>
 * @copyright Copyright (c) 2018, Harish Anchu.
 * @license See LICENSE
 */
'use strict';
const app = require('../../server/server');

module.exports = function (Task) {
  let taskTypes;

  app.on('started', function () {
    taskTypes = app.config.get('app').taskTypes;
    Task.validatesInclusionOf('type', {in: taskTypes});
  });

  /*--------------------------
   * Validations
   * -------------------------
   */

  Task.validatesInclusionOf('status', {in: ["open", "closed"]});

  /* -------------------------
   *  API's
   * -------------------------
   */
  Task.types = function (cb) {
    cb(null, taskTypes);
  };

  /* ---------------------------------
   * Remote methods
   * --------------------------------
   */
  Task.remoteMethod('types', {
    returns: [
      {arg: 'body', type: 'array', root: true},
    ],
    description: 'Report list of supported task types',
    accessType: 'READ',
    http: {verb: 'get', path: '/types'},
  });
};
