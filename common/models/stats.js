/**
 * Stats.js
 *
 * @author: Harish Anchu <harishanchu@gmail.com>
 * @copyright Copyright (c) 2018, Harish Anchu.
 * @license See LICENSE
 */
'use strict';

module.exports = function (Stats) {
  /* -------------------------
   *  Support methods
   * -------------------------
   */

  Stats.getUserStats = async function (userId) {
    let weeklyTotalDuration = "select SUM(`duration`) as duration from TimeSheet " +
      "where " +
      "YEARWEEK(`date`) = YEARWEEK(CURDATE()) AND " +
      "userId = ?";

    let dailyDurationForLast7Days = "select DAYNAME(`date`) as day, SUM(`duration`) as duration from TimeSheet " +
      "where " +
      "date >= DATE(NOW()) - INTERVAL 7 DAY AND " +
      "userId = ? " +
      "GROUP BY date";

    let todayCompletedTasksCount = "select count(*) as count from TimeSheet " +
      "where " +
      "date = CURDATE() AND " +
      "status = 'completed' AND " +
      "userId = ?";

    let dailyCompletedTasksForLast7Days = "select DAYNAME(`date`) as day, count(*) as count from TimeSheet " +
      "where " +
      "YEARWEEK(`date`) = YEARWEEK(CURDATE()) AND " +
      "status = 'completed' AND " +
      "userId = ? " +
      "GROUP BY date";

    let currentOpenTasksCount = "select count(*) as count from Task " +
      "where " +
      "status = 'open' AND " +
      "userId = ?";

    let currentWeekWorkedDays = "select count(DISTINCT date) as count from TimeSheet " +
      "where " +
      "YEARWEEK(`date`) = YEARWEEK(CURDATE()) AND " +
      "userId = ?";

    let last7daysResourceAllocationPerClient = "select pj.clientId as clientId, client.name as clientName, " +
      "SUM(`duration`) as duration from TimeSheet ts " +
      "LEFT JOIN Task task " +
      "ON (task.id = ts.taskId) " +
      "LEFT JOIN Project pj " +
      "ON (task.projectId = pj.id) " +
      "LEFT JOIN Client client " +
      "ON (pj.clientId = client.id) " +
      "where ts.date >= DATE(NOW()) - INTERVAL 7 DAY AND ts.userId = ? " +
      "GROUP BY pj.clientId";

    return query([
      weeklyTotalDuration,
      dailyDurationForLast7Days,
      todayCompletedTasksCount,
      dailyCompletedTasksForLast7Days,
      currentOpenTasksCount,
      currentWeekWorkedDays,
      last7daysResourceAllocationPerClient
    ].join(";"), [
      [userId],
      [userId],
      [userId],
      [userId],
      [userId],
      [userId],
      [userId]
    ]).then((data) => {
      return [
        data[0][0].duration,
        data[1],
        data[2][0].count,
        data[3],
        data[4][0].count,
        data[5][0].count,
        data[6]
      ];
    });
  };

  function query(sql, params = []) {
    let connector = Stats.dataSource.connector;

    return new Promise(function (resolve, reject) {
      connector.query(sql, params, (err, rows) => {
        if (err)
          reject(err);
        else
          resolve(rows)
      });
    });
  }
};


