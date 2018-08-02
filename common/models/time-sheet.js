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
  Timesheet.download = function (query, res, cb) {
    if(query === undefined) {
      query = {
        "order": ["date asc", "user.id asc"],
        "include": [{"task": {"project": "client"}},"user"],
        "where": {"user": {}} // for order by to work
      };
    }
    if (typeof res === 'function') {
      cb = res;
      res = query;
      query = {
        "order": "user.id asc",
        "include": [{"task": {"project": "client"}},"user"],
        "where": {"user": {}} // for order by to work
      };
    }

    Timesheet.find(query, function (err, data) {
      data = data.map(item => item.toJSON());

      if (err) {
        utilities.handleError(err, cb);
      } else {
        const fields = [
          {
            label: 'Date',
            value: (row, field) => row.date.toLocaleString('en-US', {timeZone: 'UTC'}).split(',')[0],
          },
          {
            label: 'User',
            value: 'user.name',
          },
          {
            label: 'Email',
            value: 'user.email',
          },
          {
            label: 'Client',
            value: 'task.project.client.name',
          },
          {
            label: 'Client Id',
            value: 'task.project.clientId',
          },
          {
            label: 'Project',
            value: 'task.project.name',
          },
          {
            label: 'Project Id',
            value: 'task.projectId',
          },
          {
            label: 'Task Id',
            value: 'taskId',
          },
          {
            label: 'Task Description',
            value: 'task.description',
          },
          {
            label: 'Comment',
            value: 'comment',
          },
          {
            label: 'status',
            value: (row, field) => row.status === "completed" ? "Completed" : "In Progress",
          },
          {
            label: 'Duration',
            value: 'duration',
          },
        ];
        const csv = utilities.parseJsonToCsv(data, fields);

        utilities.sendFileResponse(res, csv, 'attachment;filename=Data.csv');
      }
    })
  }
  ;

  /*---------------------------------
   * Remote methods
   * --------------------------------
   */
  Timesheet.remoteMethod('download', {
    accepts: [
      {
        arg: 'filter',
        type: 'object',
        description: 'Filter defining fields, where, include, order, offset, and limit - ' +
        'must be a JSON-encoded string ({"something":"value"})'
      },
      {arg: 'res', type: 'object', http: {source: 'res'}}
    ],
    returns: [
      {type: 'file', root: true}
    ],
    description: 'Time sheets download',
    accessType: 'READ',
    http: {verb: 'get', path: '/download'},
  });


  /*Timesheet.on('attached', function () {
    Timesheet._oldFind = Timesheet.find;

    // Override find method to to handle download requests
    Timesheet.find = function (query, options, res, cb) {
      if(res === undefined) {

      }
      if (cb === undefined) {
        cb = res;
      }

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
  });*/


// Alter find method
  /*Timesheet.sharedClass.findMethodByName('find').accepts.push({
    arg: 'download',
    type: 'boolean',
    description: 'Whether response should be send as csv file',
    default: false,
    http: {source: 'query'}
  });*/
  /*Timesheet.sharedClass.findMethodByName('find').accepts.push({
    arg: 'res',
    type: 'object',
    'http': {source: 'res'}
  });*/
}
;
