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
      let countCallback = function (err, count) {
        ctx.res.set('x-total-count', count);
        next();
      };

      if (ctx.method.isStatic) {
        this.count(filter, countCallback);
      } else {
        let filter = ctx.req.query.filter || {};
        let query = {};

        if (filter) {
          query.filter = filter;
        }

        ctx.instance[ctx.method.name.replace('__get__', '__count__')](query, countCallback);
      }
    } else {
      next();
    }
  };

  let applyXTotalForRelated = function (ctx, output, next) {
    const relatedModel = app.models[ctx.resultType[0]];

    let filter;
    if (ctx.args && ctx.args.filter) {
      filter = ctx.args.filter.where;
    }
    relatedModel.count(filter, function(err, count) {
      if(err) {
        throw new Error(err);
      }
      if (!ctx.res._headerSent) {
        ctx.res.set('x-total-count', count);
        next();
      } else {
        throw new Error('Headers already sent !');
      }
    });
  };

  let pattern = options && Array.isArray(options.pattern) ? options.pattern : ['*.find'];

  for (let i = pattern.length - 1; i >= 0; i--) {
    remotes.after(pattern[i], applyXTotal);
  }

  let patternsForRelated = options.patternForRelated;
  for(let key in patternsForRelated) {
    let model = app.models[key];

    if(model) {
      for(let i = patternsForRelated[key].length - 1; i >= 0; i--) {
        model.afterRemote(patternsForRelated[key][i], applyXTotalForRelated);
      }
    }
  }
};
