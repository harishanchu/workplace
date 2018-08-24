/**
 * Task.js
 *
 * @author: Harish Anchu <harishanchu@gmail.com>
 * @copyright Copyright (c) 2018, Harish Anchu.
 * @license See LICENSE
 */
'use strict';
const utilities = require('../../util/utilities');
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

  /* ----------------------------
   * Hooks
   * ----------------------------
   */


  // Find method don't support owner acl; hence the workaround.
  Task.beforeRemote('find', function logQuery(ctx, unused, next) {
    if (!(ctx.args.options.authorizedRoles.admin || ctx.args.options.authorizedRoles.owner)) {
      // Modify the where query to make sure that user only see owned records if user don't
      // privileged roles.
      utilities.objectSet(ctx, 'args.filter.where.userId', ctx.args.options.accessToken.userId);
    }

    next();
  });


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
