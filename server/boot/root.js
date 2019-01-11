'use strict';
const packageJson = require('../../package.json');
const _ = require('lodash');

module.exports = function (server) {
  let router = server.loopback.Router();

  // Install a `/` route that returns server status
  // router.get('/', server.loopback.status());

  // Returns app version from package.json file
  router.get('/api/v1/version', (req, res) => {
    let version = _.pick(packageJson, ['released', 'version']);

    res.send(version);
  });

  router.get('/api/v1/config', (req, res) => {
    res.send(server.config.get('clientConfig'));
  });

  server.use(router);
};
