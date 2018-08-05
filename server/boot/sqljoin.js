/**
 * sqljoin.js
 *
 * @author: Harish Anchu <harishanchu@gmail.com>
 * @copyright Copyright (c) 2018, Harish Anchu.
 * @license See LICENSE
 */
'use strict';

const MySQL = require('loopback-connector-mysql').MySQL;
const SqlConnector = require('loopback-connector').SqlConnector;
const ParameterizedSQL = SqlConnector.ParameterizedSQL;
const debug = require('debug')('loopback:connector:mysql');
const utilities = require('../../util/utilities');

/**
 * Adds inner join support to loopback-connector-mysql
 *
 * @param server
 */
module.exports = function modifyLoopbackMySQLConnector(server) {
  /**
   * Build a SQL SELECT statement
   * @param {String} model Model name
   * @param {Object} filter Filter object
   * @param {Object} options Options object
   * @returns {ParameterizedSQL} Statement object {sql: ..., params: [...]}
   */
  MySQL.prototype.buildSelect = function (model, filter, options) {
    if (!filter.order) {
      var idNames = this.idNames(model);
      if (idNames && idNames.length) {
        filter.order = idNames;
      }
    }
    var tableAlias = getTableAlias(model);
    var selectStmt = new ParameterizedSQL('SELECT ' +
      this.buildColumnNames(model, filter, tableAlias) +
      ' FROM ' + this.tableEscaped(model) + ' ' + tableAlias + ' '
    );

    if (filter) {
      let aliases = {};
      let relationsToBeBuiltForOrderBy = {};

      if (filter.order) {
        let order = filter.order;

        if (typeof filter.order === 'string') {
          order = [filter.order];
        }

        for (let i = 0, n = order.length; i < n; i++) {
          let t = order[i].split(/[\s,]+/);

          if (t[0].indexOf('.') > 1) {
            utilities.objectSet(relationsToBeBuiltForOrderBy, t[0], {});
          }
        }
      }

      let filterWhere = utilities.assignDeep(relationsToBeBuiltForOrderBy, filter.where);
      var joins = this.buildJoins(model, filterWhere, tableAlias);
      if (joins && joins.joinStmt.sql) {
        aliases = joins.aliases;
        selectStmt.sql = selectStmt.sql.replace('SELECT', 'SELECT DISTINCT ' +
          tableAlias + '.id, ');
        selectStmt.merge(joins.joinStmt);
      }

      if (filter.where) {
        var whereStmt = this.buildWhere(model, filter.where, tableAlias, aliases);
        selectStmt.merge(whereStmt);
      }

      if (filter.order) {
        var order = this.buildOrderBy(model, filter.order, aliases);
        selectStmt.merge(order.orderBy);
        if (order.columnNames) {
          selectStmt.sql = selectStmt.sql.replace('FROM', ', ' +
            order.columnNames + ' FROM ');
        }
      }

      if (filter.limit || filter.skip || filter.offset) {
        selectStmt = this.applyPagination(
          model, selectStmt, filter);
      }
    }

    return this.parameterize(selectStmt);
  };

  /**
   * Build the SQL WHERE clause for the where object
   * @param {string} model Model name
   * @param {object} where An object for the where conditions
   * @param {string} tableAlias Alias to subselects
   * @param {string} aliases Created aliases
   * @returns {ParameterizedSQL} The SQL WHERE clause
   */
  MySQL.prototype.buildWhere = function (model, where, tableAlias, aliases) {
    var whereClause = this._buildWhere(model, where, tableAlias, aliases);
    if (whereClause.sql) {
      whereClause.sql = 'WHERE ' + whereClause.sql;
    }
    return whereClause;
  };

  /*!
   * @param model
   * @param where
   * @returns {ParameterizedSQL}
   * @private
   */
  MySQL.prototype._buildWhere = function (model, where, tableAlias, aliases) {
    if (!where) {
      return new ParameterizedSQL('');
    }
    if (typeof where !== 'object' || Array.isArray(where)) {
      debug('Invalid value for where: %j', where);
      return new ParameterizedSQL('');
    }
    var self = this;
    var props = self.getModelDefinition(model).properties;

    var whereStmts = [];
    for (var key in where) {
      var stmt = new ParameterizedSQL('', []);
      // Handle and/or operators
      if (key === 'and' || key === 'or') {
        var branches = [];
        var branchParams = [];
        var clauses = where[key];
        if (Array.isArray(clauses)) {
          for (var i = 0, n = clauses.length; i < n; i++) {
            var stmtForClause = self._buildWhere(model, clauses[i], tableAlias, aliases);
            if (stmtForClause.sql) {
              stmtForClause.sql = '(' + stmtForClause.sql + ')';
              branchParams = branchParams.concat(stmtForClause.params);
              branches.push(stmtForClause.sql);
            }
          }
          stmt.merge({
            sql: ' ( ' + branches.join(' ' + key.toUpperCase() + ' ') + ' ) ',
            params: branchParams,
          });
          whereStmts.push(stmt);
          continue;
        }
        // The value is not an array, fall back to regular fields
      }
      var p = props[key];
      if (p == null) {
        let relations = self.getModelDefinition(model).settings.relations;
        if (relations && relations[key]) {
          let relation = relations[key];
          let childWhere = self._buildWhere(relation.model, where[key],
            aliases[relation.model], aliases);
          whereStmts.push(childWhere);
        } else {
          debug('Unknown property %s is skipped for model %s', key, model);
        }
        continue;
      }
      /* eslint-disable one-var */
      var columnEscaped = self.columnEscaped(model, key);
      var columnName = tableAlias ? tableAlias + '.' + columnEscaped : columnEscaped;
      var expression = where[key];
      var columnValue;
      var sqlExp;
      /* eslint-enable one-var */
      if (expression === null || expression === undefined) {
        stmt.merge(columnName + ' IS NULL');
      } else if (expression && expression.constructor === Object) {
        var operator = Object.keys(expression)[0];
        // Get the expression without the operator
        expression = expression[operator];
        if (operator === 'inq' || operator === 'nin' || operator === 'between') {
          columnValue = [];
          if (Array.isArray(expression)) {
            // Column value is a list
            for (var j = 0, m = expression.length; j < m; j++) {
              columnValue.push(this.toColumnValue(p, expression[j]));
            }
          } else {
            columnValue.push(this.toColumnValue(p, expression));
          }
          if (operator === 'between') {
            // BETWEEN v1 AND v2
            var v1 = columnValue[0] === undefined ? null : columnValue[0];
            var v2 = columnValue[1] === undefined ? null : columnValue[1];
            columnValue = [v1, v2];
          } else {
            // IN (v1,v2,v3) or NOT IN (v1,v2,v3)
            if (columnValue.length === 0) {
              if (operator === 'inq') {
                columnValue = [null];
              } else {
                // nin () is true
                continue;
              }
            }
          }
        } else if (operator === 'regexp' && expression instanceof RegExp) {
          // do not coerce RegExp based on property definitions
          columnValue = expression;
        } else {
          columnValue = this.toColumnValue(p, expression);
        }
        sqlExp = self.buildExpression(
          columnName, operator, columnValue, p);
        stmt.merge(sqlExp);
      } else {
        // The expression is the field value, not a condition
        columnValue = self.toColumnValue(p, expression);
        if (columnValue === null) {
          stmt.merge(columnName + ' IS NULL');
        } else {
          if (columnValue instanceof ParameterizedSQL) {
            stmt.merge(columnName + '=').merge(columnValue);
          } else {
            stmt.merge({
              sql: columnName + '=?',
              params: [columnValue],
            });
          }
        }
      }
      whereStmts.push(stmt);
    }
    var params = [];
    var sqls = [];
    for (var k = 0, s = whereStmts.length; k < s; k++) {
      sqls.push(whereStmts[k].sql);
      params = params.concat(whereStmts[k].params);
    }
    var whereStmt = new ParameterizedSQL({
      sql: sqls.join(' AND '),
      params: params,
    });
    return whereStmt;
  };

  MySQL.prototype.buildJoins = function (model, where, tableAlias) {
    var self = this;
    var props = self.getModelDefinition(model).properties;
    var aliases = {};
    var joinStmts = [];

    if (!where) {
      return false;
    }

    for (var key in where) {
      // Handle and/or operators
      if (key === 'and' || key === 'or') {
        var stmt = new ParameterizedSQL('', []);
        var branches = [];
        var branchParams = [];
        var clauses = where[key];
        if (Array.isArray(clauses)) {
          for (var i = 0, n = clauses.length; i < n; i++) {
            var stmtForClause = self.buildJoins(model, clauses[i], tableAlias, aliases);
            if (stmtForClause) {
              aliases = Object.assign(aliases, stmtForClause.aliases);
              if (stmtForClause.joinStmt.sql) {
                branchParams = branchParams.concat(stmtForClause.joinStmt.params);
                branches.push(stmtForClause.joinStmt.sql);
              }
            }
          }
          stmt.merge({
            sql: branches.join(' '),
            params: branchParams,
          });
          joinStmts.push(stmt);
          continue;
        }
        // The value is not an array, fall back to regular fields
      }
      var p = props[key];
      if (p == null) {
        let relations = self.getModelDefinition(model).settings.relations;
        if (relations && relations[key]) {
          let relation = relations[key];
          let childTableAlias = getTableAlias(model);
          aliases[relation.model] = childTableAlias;
          let foreignKey = relation.foreignKey != '' ? relation.foreignKey :
            relation.model.toLowerCase() + 'Id';
          let type = relation.type;
          let joinThrough, joinOn;
          if (type == 'belongsTo') {
            joinOn = tableAlias + '.' + foreignKey + ' = ' + childTableAlias + '.id';
          } else if (type == 'hasMany' && relation.through) {
            const throughModel = this.tableEscaped(relation.through);
            const throughModelAlias = getTableAlias(model);
            aliases[relation.through] = throughModelAlias;
            let parentForeignKey = relation.foreignKey ||
              lowerCaseFirstLetter(model) + 'Id';
            let childForeignKey = relation.keyThrough ||
              lowerCaseFirstLetter(relation.model) + 'Id';
            joinThrough = `LEFT JOIN ${throughModel} ${throughModelAlias} 
             ON ${throughModelAlias}.${parentForeignKey}` +
              ` = ${tableAlias}.id`;
            joinOn = throughModelAlias + '.' + childForeignKey +
              ' = ' + childTableAlias + '.id';
          } else {
            joinOn = childTableAlias + '.' + foreignKey + ' = ' + tableAlias + '.id';
          }
          const joinTable = this.tableEscaped(relation.model);
          let join = new ParameterizedSQL(
            `LEFT JOIN ${joinTable} ${childTableAlias} ON ${joinOn}`, []);
          if (joinThrough) {
            join = new ParameterizedSQL(joinThrough, []).merge(join);
          }
          var recursiveResult = self.buildJoins(relation.model, where[key],
            childTableAlias);
          if (recursiveResult) {
            join.merge(recursiveResult.joinStmt);
            aliases = Object.assign(aliases, recursiveResult.aliases);
          }
          joinStmts.push(join);
        } else {
          // Unknown property, ignore it
          debug('Unknown property %s is skipped for model %s', key, model);
        }
      }
    }
    var params = [];
    var sqls = [];
    for (var k = 0, s = joinStmts.length; k < s; k++) {
      sqls.push(joinStmts[k].sql);
      params = params.concat(joinStmts[k].params);
    }
    var joinStmt = new ParameterizedSQL({
      sql: sqls.join(' '),
      params: params,
    });
    var result = {
      aliases: aliases,
      joinStmt: joinStmt,
    };
    return result;
  };

  /**
   * Build the ORDER BY clause
   * @param {string} model Model name
   * @param {string[]} order An array of sorting criteria
   * @returns {string} The ORDER BY clause
   */
  MySQL.prototype.buildOrderBy = function (model, order, aliases) {
    if (!order) {
      return '';
    }
    var self = this;
    if (typeof order === 'string') {
      order = [order];
    }
    var clauses = [];
    var columnNames = [];
    for (var i = 0, n = order.length; i < n; i++) {
      var t = order[i].split(/[\s,]+/);
      var key = t[0];
      if (key.indexOf('.') > -1) {
        const modelAndProperty = key.split('.');

        let relations;
        let relatedModel = model;
        for (var j = 0; j < (modelAndProperty.length - 1); j++) {
          relations = this.getModelDefinition(relatedModel).settings.relations
          let relationKey = modelAndProperty[j];

          if (relations && relations[relationKey]) {
            relatedModel = relations[relationKey].model;
          } else {
            relatedModel = false
            break;
          }
        }

        let relatedProperty = modelAndProperty[j];

        if (relatedModel) {
          const alias = aliases[relatedModel];
          if (alias) {
            if (t.length > 1) {
              clauses.push(alias + '.' + relatedProperty + ' ' + t[1]);
            } else {
              clauses.push(alias + '.' + relatedProperty);
            }

            columnNames.push(alias + '.' + relatedProperty +
              ' as ' + alias + '_orderBy' + relatedProperty);
          }
        }
      } else {
        if (t.length > 1) {
          clauses.push(self.columnEscaped(model, t[0]) + ' ' + t[1]);
        } else {
          clauses.push(self.columnEscaped(model, order[i]))
        }
      }
    }
    var result = {
      orderBy: clauses.length > 0 ? 'ORDER BY ' + clauses.join(',') : '',
      columnNames: columnNames.join(','),
    };
    return result;
  };

  /**
   * Build a list of escaped column names for the given model and fields filter
   * @param {string} model Model name
   * @param {object} filter The filter object
   * @param {object} tableAlias The table alias
   * @returns {string} Comma separated string of escaped column names
   */
  MySQL.prototype.buildColumnNames = function (model, filter, tableAlias) {
    var fieldsFilter = filter && filter.fields;
    var cols = this.getModelDefinition(model).properties;
    if (!cols) {
      return tableAlias ? tableAlias + '.*' : '*';
    }
    var self = this;
    var keys = Object.keys(cols);
    if (Array.isArray(fieldsFilter) && fieldsFilter.length > 0) {
      // Not empty array, including all the fields that are valid properties
      keys = fieldsFilter.filter(function (f) {
        return cols[f];
      });
    } else if ('object' === typeof fieldsFilter &&
      Object.keys(fieldsFilter).length > 0) {
      // { field1: boolean, field2: boolean ... }
      var included = [];
      var excluded = [];
      keys.forEach(function (k) {
        if (fieldsFilter[k]) {
          included.push(k);
        } else if ((k in fieldsFilter) && !fieldsFilter[k]) {
          excluded.push(k);
        }
      });
      if (included.length > 0) {
        keys = included;
      } else if (excluded.length > 0) {
        excluded.forEach(function (e) {
          var index = keys.indexOf(e);
          keys.splice(index, 1);
        });
      }
    }
    var names = keys.map(function (c) {
      const columnEscaped = self.columnEscaped(model, c);
      return tableAlias ? tableAlias + '.' + columnEscaped : columnEscaped;
    });
    return names.join(',');
  };

  /**
   * Count all model instances by the where filter
   *
   * @param {String} model The model name
   * @param {Object} where The where object
   * @param {Object} options The options object
   * @param {Function} cb The callback function
   */
  MySQL.prototype.count = function (model, where, options, cb) {
    if (typeof where === 'function') {
      // Backward compatibility for 1.x style signature:
      // count(model, cb, where)
      var tmp = options;
      cb = where;
      where = tmp;
    }

    var tableAlias = getTableAlias(model);

    var stmt = new ParameterizedSQL('SELECT count(*) as "cnt" FROM ' +
      this.tableEscaped(model) + ' ' + tableAlias + ' ');
    var joins = this.buildJoins(model, where, tableAlias);
    var aliases = {};
    if (joins && joins.joinStmt.sql) {
      stmt.sql = stmt.sql.replace('count(*)', 'COUNT(DISTINCT ' + tableAlias + '.id)');
      stmt.merge(joins.joinStmt);
      aliases = joins.aliases;
    }
    stmt = stmt.merge(this.buildWhere(model, where, tableAlias, aliases));
    stmt = this.parameterize(stmt);
    this.execute(stmt.sql, stmt.params,
      function (err, res) {
        if (err) {
          return cb(err);
        }
        var c = (res && res[0] && res[0].cnt) || 0;
        // Some drivers return count as a string to contain bigint
        // See https://github.com/brianc/node-postgres/pull/427
        cb(err, Number(c));
      });
  };

  function getTableAlias(model) {
    return model + Math.random().toString().replace('.', '').replace('-', '');
  }

  function lowerCaseFirstLetter(text) {
    return text.charAt(0).toLowerCase() + text.slice(1);
  }
};
