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
const app = require('../../server/server');

module.exports = function (Customer) {
  let RoleMapping = require('loopback').RoleMapping;
  let allowEmailDomains = [];
  let defaultEmailDomain;

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
    if(ctx.req.body.email) {
      let domain = ctx.req.body.email.split('@')[1];

      if (!domain && defaultEmailDomain) {
        ctx.req.body.email = ctx.req.body.email + '@' + defaultEmailDomain;
      }
    }

    next();
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

  /* -------------------------
   *  API's
   * -------------------------
   */

  /**
   * Override default loopback login method to implement application
   * custom logic
   */
  Customer.login = function (credentials, fn) {
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
      }
      else {
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
