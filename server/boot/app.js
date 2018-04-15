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

  /**
   * Set application public url.
   */
  if (process.env.APP_URL) {
    app.set('url', process.env.APP_URL);
  }


  migrate(function () {
    createAdminUser(function () {
      createClientsAndProjects(cb);
    });
  });

  /**
   * Database migration scripts.
   */
  function migrate(cb) {
    let ds = app.dataSources.db;

    ds.autoupdate(function (err) {
      if (err) {
        console.error('Database initial scripts error.');
      }

      cb(err);
    });
  }

  /**
   * Create super admin user.
   */
  function createAdminUser(cb) {
    Customer.findOne({email: 'workplace-admin@company.com'}, function (err, user) {
      if (err) {
        return cb(err);
      } else if (user) {
        // User already exits
        cb();
      } else {
        // Create admin user
        Customer.create(
          {
            name: 'Admin', email: 'workplace-admin@company.com',
            password: 'password',
            emailVerified: true
          },
          function (err, user) {
            if (err) return cb(err);

            // Create the super admin role
            Role.create(
              {name: 'super-admin'},
              function (err, role) {
                if (err) cb(err);

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
    app.models.Client.findOne({name: "Internal"}, function (err, client) {
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
};