/**
 * Customer.js
 *
 * @author: Harish Anchu <harishanchu@gmail.com>
 * @copyright Copyright (c) 2018, Harish Anchu.
 * @license See LICENSE
 */
'use strict';

module.exports = (Customer) => {
  /* --------------------------------------------
   * Disable relational remote methods
   * -------------------------------------------
   * Its not possible to disable them from model
   * json config
   */
  Customer.disableRemoteMethodByName('prototype.__count__accessTokens');
  Customer.disableRemoteMethodByName('prototype.__create__accessTokens');
  Customer.disableRemoteMethodByName('prototype.__delete__accessTokens');
  Customer.disableRemoteMethodByName('prototype.__destroyById__accessTokens');
  Customer.disableRemoteMethodByName('prototype.__findById__accessTokens');
  Customer.disableRemoteMethodByName('prototype.__get__accessTokens');
  Customer.disableRemoteMethodByName('prototype.__updateById__accessTokens');
};
