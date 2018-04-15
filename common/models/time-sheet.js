'use strict';

module.exports = function (Timesheet) {

  /*--------------------------
   * Validations
   * -------------------------
   */

  Timesheet.validatesInclusionOf('status', {in: ["completed", "inProgress"]});

  Timesheet.observe('before save', function filterProperties(ctx, next) {
    let data = ctx.instance;
    // If task id is present check whether task belongs  to ctx user.
    if (data.taskId) {
      if (data.status === completed) {
        return data.task.update({status: 'closed'}).then(task => next()).catch(err => next(err))
      } else {
        next();
      }
    } else {
      let taskData = {
        comment: data.comment,
        projectId: data.projectId,
        userId: ctx.options.accessToken.userId
      };

      if (data.status === 'completed') {
        taskData.status = "closed";
      }

      ctx.instance.task.create(taskData).then(function (task) {
        delete data.comment;
        delete data.projectId;

        next();
      }).catch(function (err) {
        next(err);
      });
    }
  });

};
