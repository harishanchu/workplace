'use strict';
const app = require('../../server/server');

module.exports = function(Task) {
  let taskTypes;

  app.on('started', function () {
    taskTypes = app.config.get('app').taskTypes;
    Task.validatesInclusionOf('type', {in: taskTypes});
  });

  /*--------------------------
   * Validations
   * -------------------------
   */

  Task.validatesInclusionOf('status', { in: ["open", "closed"] });


  Task.types = function (cb) {
    cb(null, taskTypes);
  };

  Task.remoteMethod('types', {
    returns: [
      {arg: 'body', type: 'array', root: true},
    ],
    description: 'Report list of supported task types',
    accessType: 'READ',
    http: {verb: 'get', path: '/types'},
  });
};
