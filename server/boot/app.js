/**
 * app.js
 *
 * @author: Harish Anchu <harishanchu@gmail.com>
 * @copyright Copyright (c) 2018, Harish Anchu.
 * @license See LICENSE
 */
'use strict';

/**
 * General application boot logic to apply
 *
 * @param app
 * @param cb
 */
module.exports = (app, cb) => {
  let loopback = require('loopback');
  let Customer = app.models.Customer;
  let Role = app.models.Role;
  let RoleMapping = loopback.RoleMapping;
  let defaultAdminEmail = app.config.get('app').defaultAdminEmail;

  /**
   * Set application public url.
   */
  if (process.env.APP_URL) {
    app.set('url', process.env.APP_URL);
  }

  /**
   * Replace "me" in id path parameter of instance methods to user id if user is logged in.
   */
  Object.keys(app.models).forEach(function (key) {
    app.models[key].sharedCtor.accepts[0].http = function (ctx) {
      let req = ctx.req;

      if (req.params.id === 'me' && req.accessToken) {
        return req.accessToken.userId.toString();
      } else {
        return req.params.id;
      }
    }
  });

  function handleError(err) {
    console.error('Database initial scripts error.');
    console.log(err);
    setTimeout(() => process.exit(1));
  }

  migrate(function (err) {
    if (err) {
      return handleError(err);
    }
    createAdminUser(function (err) {
      if (err) {
        return handleError(err);
      }

      createClientsAndProjects((err) => {
        if (err) {
          return handleError(err);
        } else {
          cb();
        }
      });
    });
  });

  /**
   * Database migration scripts.
   */
  function migrate(cb) {
    let ds = app.dataSources.db;

    ds.autoupdate(function (err) {
      cb(err);
    });
  }

  /**
   * Create super admin user.
   */
  function createAdminUser(cb) {
    Customer.findOne({where: {email: defaultAdminEmail}}, function (err, user) {
      if (err) {
        return cb(err);
      } else if (user) {
        // User already exits
        cb();
      } else {
        // Create admin user
        Customer.create(
          {
            name: 'Admin', email: defaultAdminEmail,
            password: process.env.WORKPLACE_ADMIN_PASSWORD || 'password',
            emailVerified: true
          },
          function (err, user) {
            if (err) {
              return cb(err);
            }

            // Create the super admin role
            Role.create(
              {name: 'admin'},
              function (err, role) {
                if (err) {
                  return cb(err);
                }

                // Ensure super admin role is assigned for the user.
                role.principals.create({
                  principalId: user.id,
                  principalType: RoleMapping.USER,
                  roleId: role.id
                }, function (err) {
                  cb(err);
                });
              });
          });
      }
    });

  }

  /**
   * Create default projects.
   *
   * @param cb
   */
  function createClientsAndProjects(cb) {
    app.models.Client.findOne({where: {name: "Internal"}}, function (err, client) {
      if (err) {
        return cb(err);
      } else if (client) {
        // Client exists
        cb();
      }
      else {
        app.models.Client.create([
          {name: "Internal"}
        ], function (err, client) {
          client[0].projects.create([{name: "Internal"}], function (err, projects) {
            return cb();
          })
        });
      }
    });
  }

  app.set('url', app.config.get('app').appUrl);
};
