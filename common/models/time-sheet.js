'use strict';
const utilities = require('../../util/utilities');

module.exports = function (Timesheet) {

  /* --------------------------
   * Validations
   * -------------------------
   */

  Timesheet.validatesInclusionOf('status', {in: ['completed', 'inProgress']});

  // @todo: add validation to check presense of either task id or task;

  /* --------------------------
   * Operation hooks
   * -------------------------
   */

  Timesheet.observe('after save', function filterProperties(ctx, next) {
    let status;

    // Change the status of the task based on timesheet status.
    if (ctx.instance.status === 'completed') {
      status = 'closed';
    } else {
      status = 'open';
    }

    ctx.instance.task.update({status}, function (err) {
      next(err);
    });
  });

  /*-------------------------
   *  API's
   * -------------------------
   */
  Timesheet.on('attached', function () {
    Timesheet._oldFind = Timesheet.find;

    // Override find method to to handle download requests
    Timesheet.find = function (query, options, download, res, cb) {
      this._oldFind.call(this, query, options, function (err, data) {
        if (err) {
          utilities.handleError(err, cb);
        } else if (download) {
          const fields = [
            {
              label: 'client',
              value: (row, field) => {
                return utilities.objectGet(row, 'task.project.client.name');
              },
            },
            'project',
            'status',
            'duration',
          ];
          const csv = utilities.parseJsonToCsv(data, fields);

          utilities.sendFileResponse(res, csv, 'attachment;filename=Data.csv');
        } else {
          cb(false, data);
        }
      });
    };
  });

  /*---------------------------------
   * Remote methods
   * --------------------------------
   */

  // Alter find method
  Timesheet.sharedClass.findMethodByName('find').accepts.push({
    arg: 'download',
    type: 'boolean',
    description: 'Whether response should be send as csv file',
    default: false,
    http: {source: 'query'}
  });
  Timesheet.sharedClass.findMethodByName('find').accepts.push({
    arg: 'res',
    type: 'object',
    'http': {source: 'res'}
  });
};
