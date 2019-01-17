'use strict';
const g = require('loopback/lib/globalize');

module.exports = function (Project) {
  /* ----------------------------
     * Hooks
     * ----------------------------
     */
  async function beforeDelete(ctx, next) {
    let ids = [].concat(ctx.args.id);

    let projects = await Project.find({where: {id: {inq: ids}}, fields: {id: true}, include:"tasks"});

    if(!projects.every(project => {
        return !project.tasks().length;
      })) {
      let err = new Error(g.f('Projects are associated with tasks, hence cannot be deleted.'));
      err.statusCode = 400;
      err.code = 'PROJECT_ASSOCIATED_WITH_TASKS';

      throw err;
    }

    return null;
  }

  Project.beforeRemote('deleteById', beforeDelete);
  Project.beforeRemote('destroyAllCustom', beforeDelete);

  /* -------------------------
   *  API's
   * -------------------------
   */
  Project.destroyAllCustom = async function (ids, cb) {
    ids = [].concat(ids);

    return await Project.destroyAll({
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
  Project.remoteMethod('destroyAllCustom', {
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
