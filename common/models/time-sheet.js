'use strict';

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

};
