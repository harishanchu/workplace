/**
 * date.js
 *
 * @author: Harish Anchu <harishanchu@gmail.com>
 * @copyright Copyright (c) 2019, Harish Anchu.
 */
'use strict';

function getFirstDayOfWeek(d) {
  d = new Date(d);
  var day = d.getDay(),
    diff = d.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
  return new Date(d.setDate(diff));
}

getMonday(new Date());

module.exports = {

}
