/**
 * roles.js
 *
 * @author: Harish Anchu <harishanchu@gmail.com>
 * @copyright Copyright (c) 2018, Harish Anchu.
 */

const _ = require('lodash');

module.exports = function (app) {
  let Role = app.models.Role;

  function reject(cb) {
    process.nextTick(() => cb(null, false));
  }

  Role.registerResolver('custom-owner', function (role, context, callback) {
    if (!context || !context.model || !context.modelId) {
      return reject(callback);
    }

    let modelClass = context.model;
    let modelIds = context.remotingContext.args.id;
    let user = context.getUser();
    let userId = user && user.id;

    isOwner(modelClass, modelIds, userId, callback);
  });

  function isOwner(modelClass, modelIds, userId, callback) {
    if (!userId || !modelIds || !modelIds.length) {
      return reject(callback)
    }

    modelClass.find({
      where: {
        id: {
          inq: modelIds
        },
        userId: userId
      }
    }, (err, items) => {
      if (err) {
        return callback(err, false)
      } else {
        if (items.length !== modelIds.length) {
          callback(null, false)
        } else {
          callback(null, true)
        }
      }
    });
  }
};


