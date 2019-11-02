/**
 * Customer.js
 *
 * @author: Harish Anchu <harishanchu@gmail.com>
 * @copyright Copyright (c) 2018, Harish Anchu.
 * @license See LICENSE
 */
'use strict';
const path = require('path');
const qs = require('querystring');
const g = require('loopback/lib/globalize');
const app = require('../../server/server');
const assert = require('assert');
const loopback = require('loopback');
const utils = require('loopback/lib/utils');

module.exports = function (Customer) {
  let RoleMapping = require('loopback').RoleMapping;
  let allowEmailDomains = [];
  let defaultEmailDomain;

  Customer.validatesDateOf('dob', {
    message: 'is invalid'
  });

  app.on('started', function () {
    allowEmailDomains = app.config.get('app').allowEmailDomains;
    defaultEmailDomain = app.config.get('app').defaultEmailDomain;

    /* --------------------------
     * Validations
     * -------------------------
     */
    Customer.validate('email', function (onErr) {
      let domain = this.email.split('@')[1];

      if (allowEmailDomains.length && allowEmailDomains.indexOf(domain) === -1) {
        onErr('domain');
      }
    }, {
      message: {
        domain: 'Please provide an email with valid domain. Supported domains are: ' + allowEmailDomains.join(', ')
      }
    });
  });

  /* ----------------------------
   * Hooks
   * ----------------------------
   */

  Customer.beforeRemote('create', function (ctx, user, next) {
    if (ctx.req.body.email) {
      let domain = ctx.req.body.email.split('@')[1];

      if (!domain && defaultEmailDomain) {
        ctx.req.body.email = ctx.req.body.email + '@' + defaultEmailDomain;
      }
    }

    next();
  });

  Customer.observe('before save', function (ctx, next) {
    if (ctx.isNewInstance) {
      return next();
    }
    const data = ctx.data || ctx.instance;
    const isEmailChange = 'email' in data;

    if (!isEmailChange) {
      return next();
    }

    const err = new Error(
      'Changing email is not allowed.');
    err.statusCode = 422;
    err.code = 'EMAIL_CHANGE_NOT_ALLOWED';
    next(err);
  });

  /**
   * Create settings model for user.
   *
   * Send verification email after registration if user is a parent user
   * and email is not verified.
   */
  Customer.afterRemote('create', function (context, userInstance, next) {
    // verification email.
    if (!userInstance.emailVerified) {
      let app = Customer.app;
      let urlPath = joinUrlPath(
        app.get('restApiRoot'),
        Customer.http.path,
        Customer.sharedClass.findMethodByName('confirm').http.path
      );

      let verifyHref = app.get('url').replace(/\/$/, '') + urlPath +
        '?' + qs.stringify({
          uid: '' + userInstance.id,
          redirect: `${Customer.app.config.get('app').clientUrl}/`
        });

      let options = {
        type: 'email',
        to: userInstance.email,
        from: Customer.app.config.get('app').emails.notification,
        subject: 'Thanks for registering',
        template: path.resolve(__dirname, '../../server/views/verify.ejs'),
        redirect: `${Customer.app.config.get('app').clientUrl}/`,
        user: userInstance,
        verifyHref: verifyHref
      };
      userInstance.verify(options, function (err, response) {
        next(err);
      });
    } else {
      next();
    }
  });

  Customer.beforeRemote('prototype.__destroyById__tasks', function (context, unused, next) {
    context.instance.timeSheets.find({where: {taskId: context.args.fk}})
      .then(function (data) {
        if (data.length) {
          let err = new Error(g.f('Task is associated with time sheets, hence cannot be deleted.'));
          err.statusCode = 400;
          err.code = 'TASK_ASSOCIATED_WITH_TIMESHEETS';

          next(err);
        } else {
          next();
        }
      })
      .catch(next);
  });

  Customer.afterRemote('prototype.__updateById__tasks', function (context, taskInstance, next) {
    let connector = Customer.dataSource.connector;
    let status;
    let userId = taskInstance.userId;
    let taskId = context.args.fk;

    // Update status of latest associated timsheet based on task status.

    if (context.args.data && context.args.data.status) {
      if (context.args.data.status === "open") {
        status = 'inProgress';
      } else {
        status = 'completed';
      }

      connector.query(
        'UPDATE TimeSheet ' +
        'SET status = "' + status +
        '" WHERE taskId = ? AND ' +
        'userId = ? ' +
        'ORDER BY date DESC ' +
        'LIMIT 1;',
        [taskId, userId],
        (err, rows) => {
          if(err) {
            console.log(err);

            next(new Err('Failed to update associated timesheet.'))
          } else {
            next()
          }
        }
      )
    } else {
      next();
    }
  });

  /*--------------------------
   * Listen for model events
   *--------------------------
   */

  //send password reset link when password reset requested
  Customer.on('resetPasswordRequest', function (info) {
    let url = Customer.app.config.get('app').clientUrl + '/resetpassword/';
    let template = Customer.app.loopback.template(
      path.resolve(__dirname, '../../server/views/reset.ejs')
    );

    Customer.app.models.Email.send({
      to: info.email,
      from: Customer.app.config.get('app').emails.notification,
      subject: 'Password reset',
      html: template({
        resetHref: url + info.accessToken.id,
        name: info.user.name
      })
    }, function (err) {
      if (err) {
        //@todo: log error
        console.log('> error sending password reset email');
        console.log(err)
      }
    });
  });


  /* -------------------------
   *  API's
   * -------------------------
   */

  /**
   * Override default loopback login method to implement application
   * custom logic
   */
  Customer.login = function (credentials, fn) {
    if (credentials.email) {
      let domain = credentials.email.split('@')[1];

      if (!domain && defaultEmailDomain) {
        credentials.email = credentials.email + '@' + defaultEmailDomain;
      }
    }

    this.super_.login.call(this, credentials, 'user', function (err, token) {
      // Default response token attribute name is id; we
      // will rename it here to accessToken. We will remove
      // userId attribute since user information object already
      // contains it.
      if (token) {
        // Send roles along with user information
        RoleMapping.find({where: {principalType: 'USER', principalId: token.userId}, include: 'role'})
          .then(function (roleMapping) {
            token = token.toJSON();
            token.user.roles = roleMapping.map(function (roleMap) {
              return roleMap.toObject()['role']['name'];
            });
            token.accessToken = token.id;
            delete token.id;
            delete token.userId;

            fn(err, token);
          })
          .catch(fn);
      } else {
        fn(err);
      }
    });
  };

  /**
   * Add a role to the user
   * @param {string} userId
   * @param {string} roleName Role to be assigned to the user
   * @param {Function} callback
   */

  Customer.addRole = function (userId, roleName, callback) {
    Customer.findById(userId, function (err, user) {
      if (err) {
        return callback(err);
      } else if (!user) {
        let err = new Error(g.f('User not found'));
        err.statusCode = 400;
        err.code = 'USER_NOT_FOUND';

        return callback(err);
      } else {
        const Role = Customer.app.models.Role;
        const RoleMapping = Customer.app.models.RoleMapping;

        Role.upsertWithWhere(
          {
            name: roleName
          },
          {
            name: roleName
          },
          function (err, role) {
            if (err) {
              callback(role);
            } else {
              // Assign role to the user
              RoleMapping.upsertWithWhere(
                {
                  principalId: user.id,
                  principalType: RoleMapping.USER,
                  roleId: role.id
                }, {
                  principalId: user.id,
                  principalType: RoleMapping.USER,
                  roleId: role.id
                }, function (err) {
                  callback(err);
                })
            }
          }
        )
      }
    });
  };

  //@fix: https://github.com/strongloop/loopback/issues/3393
  /**
   * Verify a user's identity by sending them a confirmation message.
   * NOTE: Currently only email verification is supported
   *
   * ```js
   * var verifyOptions = {
   *   type: 'email',
   *   from: 'noreply@example.com'
   *   template: 'verify.ejs',
   *   redirect: '/',
   *   generateVerificationToken: function (user, options, cb) {
   *     cb('random-token');
   *   }
   * };
   *
   * user.verify(verifyOptions);
   * ```
   *
   * NOTE: the User.getVerifyOptions() method can also be used to ease the
   * building of identity verification options.
   *
   * ```js
   * var verifyOptions = MyUser.getVerifyOptions();
   * user.verify(verifyOptions);
   * ```
   *
   * @options {Object} verifyOptions
   * @property {String} type Must be `'email'` in the current implementation.
   * @property {Function} mailer A mailer function with a static `.send() method.
   *  The `.send()` method must accept the verifyOptions object, the method's
   *  remoting context options object and a callback function with `(err, email)`
   *  as parameters.
   *  Defaults to provided `userModel.email` function, or ultimately to LoopBack's
   *  own mailer function.
   * @property {String} to Email address to which verification email is sent.
   *  Defaults to user's email. Can also be overriden to a static value for test
   *  purposes.
   * @property {String} from Sender email address
   *  For example `'noreply@example.com'`.
   * @property {String} subject Subject line text.
   *  Defaults to `'Thanks for Registering'` or a local equivalent.
   * @property {String} text Text of email.
   *  Defaults to `'Please verify your email by opening this link in a web browser:`
   *  followed by the verify link.
   * @property {Object} headers Email headers. None provided by default.
   * @property {String} template Relative path of template that displays verification
   *  page. Defaults to `'../../templates/verify.ejs'`.
   * @property {Function} templateFn A function generating the email HTML body
   *  from `verify()` options object and generated attributes like `options.verifyHref`.
   *  It must accept the verifyOptions object, the method's remoting context options
   *  object and a callback function with `(err, html)` as parameters.
   *  A default templateFn function is provided, see `createVerificationEmailBody()`
   *  for implementation details.
   * @property {String} redirect Page to which user will be redirected after
   *  they verify their email. Defaults to `'/'`.
   * @property {String} verifyHref The link to include in the user's verify message.
   *  Defaults to an url analog to:
   *  `http://host:port/restApiRoot/userRestPath/confirm?uid=userId&redirect=/``
   * @property {String} host The API host. Defaults to app's host or `localhost`.
   * @property {String} protocol The API protocol. Defaults to `'http'`.
   * @property {Number} port The API port. Defaults to app's port or `3000`.
   * @property {String} restApiRoot The API root path. Defaults to app's restApiRoot
   *  or `'/api'`
   * @property {Function} generateVerificationToken A function to be used to
   *  generate the verification token.
   *  It must accept the verifyOptions object, the method's remoting context options
   *  object and a callback function with `(err, hexStringBuffer)` as parameters.
   *  This function should NOT add the token to the user object, instead simply
   *  execute the callback with the token! User saving and email sending will be
   *  handled in the `verify()` method.
   *  A default token generation function is provided, see `generateVerificationToken()`
   *  for implementation details.
   * @callback {Function} cb Callback function.
   * @param {Object} options remote context options.
   * @param {Error} err Error object.
   * @param {Object} object Contains email, token, uid.
   * @promise
   */
  Customer.prototype.verify = function (verifyOptions, options, cb) {
    if (cb === undefined && typeof options === 'function') {
      cb = options;
      options = undefined;
    }
    cb = cb || utils.createPromiseCallback();

    var user = this;
    var userModel = this.constructor;
    var registry = userModel.registry;
    verifyOptions = Object.assign({}, verifyOptions);
    // final assertion is performed once all options are assigned
    assert(typeof verifyOptions === 'object',
      'verifyOptions object param required when calling user.verify()');

    // Shallow-clone the options object so that we don't override
    // the global default options object
    verifyOptions = Object.assign({}, verifyOptions);

    // Set a default template generation function if none provided
    verifyOptions.templateFn = verifyOptions.templateFn || createVerificationEmailBody;

    // Set a default token generation function if none provided
    verifyOptions.generateVerificationToken = verifyOptions.generateVerificationToken ||
      userModel.generateVerificationToken;

    // Set a default mailer function if none provided
    verifyOptions.mailer = verifyOptions.mailer || userModel.email ||
      registry.getModelByType(loopback.Email);

    var pkName = userModel.definition.idName() || 'id';
    verifyOptions.redirect = verifyOptions.redirect || '/';
    var defaultTemplate = path.join(__dirname, '..', '..', 'templates', 'verify.ejs');
    verifyOptions.template = path.resolve(verifyOptions.template || defaultTemplate);
    verifyOptions.user = user;
    verifyOptions.protocol = verifyOptions.protocol || 'http';

    var app = userModel.app;
    verifyOptions.host = verifyOptions.host || (app && app.get('host')) || 'localhost';
    verifyOptions.port = verifyOptions.port || (app && app.get('port')) || 3000;
    verifyOptions.restApiRoot = verifyOptions.restApiRoot || (app && app.get('restApiRoot')) || '/api';

    var displayPort = (
      (verifyOptions.protocol === 'http' && verifyOptions.port == '80') ||
      (verifyOptions.protocol === 'https' && verifyOptions.port == '443')
    ) ? '' : ':' + verifyOptions.port;

    if (!verifyOptions.verifyHref) {
      const confirmMethod = userModel.sharedClass.findMethodByName('confirm');
      if (!confirmMethod) {
        throw new Error(
          'Cannot build user verification URL, ' +
          'the default confirm method is not public. ' +
          'Please provide the URL in verifyOptions.verifyHref.'
        );
      }

      const urlPath = joinUrlPath(
        verifyOptions.restApiRoot,
        userModel.http.path,
        confirmMethod.http.path
      );

      verifyOptions.verifyHref =
        verifyOptions.protocol +
        '://' +
        verifyOptions.host +
        displayPort +
        urlPath +
        '?' + qs.stringify({
          uid: '' + verifyOptions.user[pkName],
          redirect: verifyOptions.redirect,
        });
    }

    verifyOptions.to = verifyOptions.to || user.email;
    verifyOptions.subject = verifyOptions.subject || g.f('Thanks for Registering');
    verifyOptions.headers = verifyOptions.headers || {};

    // assert the verifyOptions params that might have been badly defined
    assertVerifyOptions(verifyOptions);

    // argument "options" is passed depending on verifyOptions.generateVerificationToken function requirements
    var tokenGenerator = verifyOptions.generateVerificationToken;
    if (tokenGenerator.length == 3) {
      tokenGenerator(user, options, addTokenToUserAndSave);
    } else {
      tokenGenerator(user, addTokenToUserAndSave);
    }

    function addTokenToUserAndSave(err, token) {
      if (err) return cb(err);
      user.verificationToken = token;
      user.updateAttributes({'verificationToken': token}, function (err) {
        if (err) return cb(err);
        sendEmail(user);
      });
    }

    function sendEmail(user) {
      verifyOptions.verifyHref +=
        verifyOptions.verifyHref.indexOf('?') === -1 ? '?' : '&';
      verifyOptions.verifyHref += 'token=' + user.verificationToken;

      verifyOptions.verificationToken = user.verificationToken;
      verifyOptions.text = verifyOptions.text || g.f('Please verify your email by opening ' +
        'this link in a web browser:\n\t%s', verifyOptions.verifyHref);
      verifyOptions.text = verifyOptions.text.replace(/\{href\}/g, verifyOptions.verifyHref);

      // argument "options" is passed depending on templateFn function requirements
      var templateFn = verifyOptions.templateFn;
      if (templateFn.length == 3) {
        templateFn(verifyOptions, options, setHtmlContentAndSend);
      } else {
        templateFn(verifyOptions, setHtmlContentAndSend);
      }

      function setHtmlContentAndSend(err, html) {
        if (err) return cb(err);

        verifyOptions.html = html;

        // Remove verifyOptions.template to prevent rejection by certain
        // nodemailer transport plugins.
        delete verifyOptions.template;

        // argument "options" is passed depending on Email.send function requirements
        var Email = verifyOptions.mailer;
        if (Email.send.length == 3) {
          Email.send(verifyOptions, options, handleAfterSend);
        } else {
          Email.send(verifyOptions, handleAfterSend);
        }

        function handleAfterSend(err, email) {
          if (err) return cb(err);
          cb(null, {email: email, token: user.verificationToken, uid: user[pkName]});
        }
      }
    }

    return cb.promise;
  };

  //@fix: https://github.com/strongloop/loopback/issues/3393
  /**
   * Confirm the user's identity.
   *
   * @param {Any} userId
   * @param {String} token The validation token
   * @param {String} redirect URL to redirect the user to once confirmed
   * @callback {Function} callback
   * @param {Error} err
   * @promise
   */
  Customer.confirm = function (uid, token, redirect, fn) {
    fn = fn || utils.createPromiseCallback();
    this.findById(uid, function (err, user) {
      if (err) {
        fn(err);
      } else {
        if (user && user.verificationToken === token) {
          user.updateAttributes({verificationToken: null, emailVerified: true}, function (err) {
            if (err) {
              fn(err);
            } else {
              fn();
            }
          });
        } else {
          if (user) {
            err = new Error(g.f('Invalid token: %s', token));
            err.statusCode = 400;
            err.code = 'INVALID_TOKEN';
          } else {
            err = new Error(g.f('User not found: %s', uid));
            err.statusCode = 404;
            err.code = 'USER_NOT_FOUND';
          }
          fn(err);
        }
      }
    });
    return fn.promise;
  };

  Customer.once('attached', function () {
    Customer.app.once('started', function () {
      let Stats = Customer.app.models.Stats;

      Customer.prototype.__get__stats = async function () {
        let userId = this.id;
        let [
          weeklyTotalDuration,
          DailyDurationForLast7Days,
          todayCompletedTasksCount,
          dailyCompletedTasksForLast7Days,
          openTasksCount,
          currentWeekWorkedDays,
          last7daysResourceAllocationPerClient
        ] = await Stats.getUserStats(userId);

        return {
          weeklyTotalDuration,
          DailyDurationForLast7Days,
          todayCompletedTasksCount,
          dailyCompletedTasksForLast7Days,
          openTasksCount,
          currentWeekWorkedDays,
          last7daysResourceAllocationPerClient
        }
      }
    });
  });

  /* ---------------------------------
   * Override remote methods
   * --------------------------------
   */

  /**
   * Modify login API
   */
  let loginRemoteMethod = Customer.sharedClass.findMethodByName('login');

  loginRemoteMethod.accepts = [
    {arg: 'credentials', type: 'object', required: true, http: {source: 'body'}}
  ];
  loginRemoteMethod.returns = [{
    arg: 'body', type: 'object', root: true
  }];

  /**
   * Modify logout API http verb from the default.
   */
  Customer.sharedClass.findMethodByName('logout').http.verb = "delete";

  /**
   * Modify change password API http verb from the default.
   */
  Customer.sharedClass.findMethodByName('changePassword').http.verb = 'put';

  /**
   * Modify reset password API http verb from the default.
   */
  Customer.sharedClass.findMethodByName('setPassword').http.verb = 'put';

  /* ---------------------------------
   * Remote methods
   * --------------------------------
   */
  Customer.remoteMethod('addRole', {
    'accepts': [
      {
        arg: 'id',
        type: 'any',
        description: 'User id whose role is to be updated',
        required: true,
        http: {source: 'path'}
      },
      {
        'arg': 'roleName',
        'type': 'string',
        'required': true,
        'description': 'Role to be added to the user',
        'http': {
          'source': 'form'
        }
      }
    ],
    'description': 'Add a role to the user',
    'http': [
      {
        'path': '/:id/role',
        'verb': 'post'
      }
    ]/*,
    accessScopes: ['EXECUTE']*/
  });


  /* --------------------------------------------
   * Disable relational remote methods
   * -------------------------------------------
   * Its not possible to disable them from model
   * json config
   */
  /*Customer.disableRemoteMethodByName('prototype.__count__accessTokens');
  Customer.disableRemoteMethodByName('prototype.__create__accessTokens');
  Customer.disableRemoteMethodByName('prototype.__delete__accessTokens');
  Customer.disableRemoteMethodByName('prototype.__destroyById__accessTokens');
  Customer.disableRemoteMethodByName('prototype.__findById__accessTokens');
  Customer.disableRemoteMethodByName('prototype.__get__accessTokens');
  Customer.disableRemoteMethodByName('prototype.__updateById__accessTokens');*/
};

function joinUrlPath(args) {
  let result = arguments[0];

  for (let ix = 1; ix < arguments.length; ix++) {
    let next = arguments[ix];

    result += result[result.length - 1] === '/' && next[0] === '/' ? next.slice(1) : next;
  }

  return result;
}

function assertVerifyOptions(verifyOptions) {
  assert(verifyOptions.type, 'You must supply a verification type (verifyOptions.type)');
  assert(verifyOptions.type === 'email', 'Unsupported verification type');
  assert(verifyOptions.to, 'Must include verifyOptions.to when calling user.verify() ' +
    'or the user must have an email property');
  assert(verifyOptions.from, 'Must include verifyOptions.from when calling user.verify()');
  assert(typeof verifyOptions.templateFn === 'function',
    'templateFn must be a function');
  assert(typeof verifyOptions.generateVerificationToken === 'function',
    'generateVerificationToken must be a function');
  assert(verifyOptions.mailer, 'A mailer function must be provided');
  assert(typeof verifyOptions.mailer.send === 'function', 'mailer.send must be a function ');
}

function createVerificationEmailBody(verifyOptions, options, cb) {
  var template = loopback.template(verifyOptions.template);
  var body = template(verifyOptions);
  cb(null, body);
}
