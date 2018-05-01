'use strict';

module.exports = function (app, options) {
  var remotes = app.remotes();
  // Set X-Total-Count for all search requests
  var applyXTotal = function (ctx, next) {
    var filter;
    if (ctx.args && ctx.args.filter) {
      filter = ctx.args.filter.where;
    }

    if (!ctx.res._headerSent) {
      if(ctx.method.isStatic) {
        this.count(filter, function (err, count) {
          ctx.res.set('X-Total-Count', count);
          next();
        });
      } else {
        // console.log(ctx.instance)
      }
    } else {
      next();
    }
  };
  var pattern = options && Array.isArray(options.pattern) ? options.pattern : ['*.find'];

  for (var i=pattern.length-1; i>=0; i--) {
    remotes.after(pattern[i], applyXTotal);
  }
};
