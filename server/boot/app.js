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
 * @param app
 */
module.exports = (app) => {
  if (process.env.APP_URL) {
    app.set('url', process.env.APP_URL);
  }
};
