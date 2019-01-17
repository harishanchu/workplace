'use strict';
const g = require('loopback/lib/globalize');

module.exports = function (Client) {
  /* ----------------------------
   * Hooks
   * ----------------------------
   */
  async function beforeDelete(ctx, next) {
    let ids = [].concat(ctx.args.id);

    let clients = await Client.find({where: {id: {inq: ids}}, fields: {id: true}, include:"projects"});

    if(!clients.every(client => {
        return !client.projects().length;
      })) {
      let err = new Error(g.f('Clients are associated with projects, hence cannot be deleted.'));
      err.statusCode = 400;
      err.code = 'CLIENT_ASSOCIATED_WITH_PROJECTS';

      throw err;
    }

    return null;
  }

  Client.beforeRemote('deleteById', beforeDelete);
  Client.beforeRemote('destroyAllCustom', beforeDelete);

  /* -------------------------
   *  API's
   * -------------------------
   */
  Client.destroyAllCustom = async function (ids, cb) {
    ids = [].concat(ids);

    return await Client.destroyAll({
      id: {
        inq: ids
      }
    }, (err, info) => {
      if (err) {
        throw err;
      } else {
        return info;
      }
    })
  };

  /* ---------------------------------
   * Remote methods
   * --------------------------------
   */
  Client.remoteMethod('destroyAllCustom', {
    isStatic: true,
    description: 'Delete all matching records',
    accessType: 'WRITE',
    accepts: {arg: 'id', type: 'array', description: 'id\'s to delete '},
    returns: {
      arg: 'count',
      type: 'object',
      description: 'The number of instances deleted',
      root: true,
    },
    http: {verb: 'del', path: '/'}
  });
};
