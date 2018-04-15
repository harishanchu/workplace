'use strict';

module.exports = function(Task) {

  /*--------------------------
   * Validations
   * -------------------------
   */

  Task.validatesInclusionOf('status', { in: ["open", "closed"] });

};
