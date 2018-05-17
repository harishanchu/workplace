'use strict';

module.exports = function (app, options) {
  let remotes = app.remotes();
  // Set X-Total-Count for all search requests
  let applyXTotal = function (ctx, next) {
    let filter;
    if (ctx.args && ctx.args.filter) {
      filter = ctx.args.filter.where;
    }

    if (!ctx.res._headerSent) {
      let countCallback = function (err, count) {console.log(arguments)
        ctx.res.set('X-Total-Count', count);
        next();
      };

      if (ctx.method.isStatic) {
        this.count(filter, countCallback);
      } else {
        let filter = ctx.req.query.filter || {};
        let query = {};

        if(filter) {
          query.filter = filter;
        }

        ctx.instance[ctx.method.name.replace('__get__', '__count__')](query, countCallback);
      }
    } else {
      next();
    }
  };

  let pattern = options && Array.isArray(options.pattern) ? options.pattern : ['*.find'];

  for (let i = pattern.length - 1; i >= 0; i--) {
    remotes.after(pattern[i], applyXTotal);
  }
};
