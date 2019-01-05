/**
 * Stats.js
 *
 * @author: Harish Anchu <harishanchu@gmail.com>
 * @copyright Copyright (c) 2018, Harish Anchu.
 * @license See LICENSE
 */
'use strict';

module.exports = function (Stats) {

  /* ---------------------------------
   * Remote methods
   * --------------------------------
   */
  Stats.once('attached', function () {
    Stats.app.models.Customer.prototype.__get__stats = async function () {
      let userId = this.id;
      let [
        [weeklyTotalDuration, DailyDurationForLast7Days],
        todayCompletedTasksCount,
        currentWeekCompletedTasksCount,
        openTasksCount,
        currentWeekWorkedDays,
        currentWeekResourceAllocationPerClient
      ] = await Promise.all([
        getTimeSheetDurationStatsForUser(userId),
        getTodayCompletedTasksCount(userId),
        getCurrentWeekCompletedTasksCount(userId),
        getCurrentOpenTasksCount(userId),
        getCurrentWeekWorkedDays(userId),
        getCurrentWeekResourceAllocationPerClient(userId)
      ]);

      return {
        weeklyTotalDuration,
        DailyDurationForLast7Days,
        todayCompletedTasksCount,
        currentWeekCompletedTasksCount,
        openTasksCount,
        currentWeekWorkedDays,
        currentWeekResourceAllocationPerClient
      }
    }
  });


  /* -------------------------
   *  Support methods
   * -------------------------
   */

  async function getTimeSheetDurationStatsForUser(userId) {
    let sql = "select SUM(`duration`) as duration from TimeSheet " +
      "where " +
      "YEARWEEK(`date`) = YEARWEEK(CURDATE()) AND " +
      "userId = ?;";

    sql += "select DAYNAME(`date`) as day, SUM(`duration`) as duration from TimeSheet " +
      "where " +
      "date >= DATE(NOW()) - INTERVAL 7 DAY AND " +
      "userId = ? " +
      "GROUP BY date";

    return query(sql, [[userId], [userId]]).then((data) => {
      return [data[0][0].duration, data[1]];
    });
  }

  async function getTodayCompletedTasksCount(userId) {
    let sql = "select count(*) as count from TimeSheet " +
      "where " +
      "date = CURDATE() AND " +
      "status = 'completed' AND " +
      "userId = ?;";

    return query(sql, [userId]).then((data) => {
      return data[0].count;
    });
  }

  async function getCurrentWeekCompletedTasksCount(userId) {
    let sql = "select count(*) as count from TimeSheet " +
      "where " +
      "YEARWEEK(`date`) = YEARWEEK(CURDATE()) AND " +
      "status = 'completed' AND " +
      "userId = ?;";

    return query(sql, [userId]).then((data) => {
      return data[0].count;
    });
  }

  async function getCurrentOpenTasksCount(userId) {
    let sql = "select count(*) as count from TimeSheet " +
      "where " +
      "status = 'inProgress' AND " +
      "userId = ?;";

    return query(sql, [userId]).then((data) => {
      return data[0].count;
    });
  }

  async function getCurrentWeekWorkedDays(userId) {
    let sql = "select count(DISTINCT date) as count from TimeSheet " +
      "where " +
      "YEARWEEK(`date`) = YEARWEEK(CURDATE()) AND " +
      "userId = ?";

    return query(sql, [userId]).then((data) => {
      return data[0].count;
    });
  }

  async function getCurrentWeekResourceAllocationPerClient(userId) {
    let sql = "select pj.clientId as clientId, client.name as clientName, " +
      "SUM(`duration`) as duration from TimeSheet ts " +
      "LEFT JOIN Task task " +
      "ON (task.id = ts.taskId) " +
      "LEFT JOIN Project pj " +
      "ON (task.projectId = pj.id) " +
      "LEFT JOIN Client client " +
      "ON (pj.clientId = client.id) " +
      "where YEARWEEK(`date`) = YEARWEEK(CURDATE()) AND ts.userId = 1 " +
      "GROUP BY pj.clientId";

    return query(sql, [userId]).then((data) => {
      return data;
    });
  }

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


