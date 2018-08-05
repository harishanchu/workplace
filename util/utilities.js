const g = require('loopback/lib/globalize');
const Json2csvParser = require('json2csv').Parser;
const assignDeep = require("assign-deep");

const utilities = {
  regexes: {
    alphanumeric: /^[a-zA-Z0-9]+$/,
    alphanumericWithSpace: /^[\w\-\s]+$/,
    phone: /^\d{10}$/,
    last4SSN: /^\d{4}$/,
  },

  assignDeep: assignDeep,

  handleError: (error, cb) => {
    if (error instanceof Error) {
      cb(error);
    } else {
      let err = new Error(g.f(error.message));
      err.code = error.message.toUpperCase().replace(/ /g, "_");
      err.statusCode = error.code;
      err.status = error.code;
      cb(err);
    }
  },

  sendFileResponse: (res, data, disposition) => {
    res.set('Expires', 'Tue, 03 Jul 2001 06:00:00 GMT');
    res.set('Content-Type', 'application/force-download');
    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Type', 'application/download');
    res.set('Content-Disposition', disposition);
    res.set('Content-Transfer-Encoding', 'binary');
    res.send(data);
  },

  parseJsonToCsv: (data, fields) => {
    const opts = {fields};
    let csv = '';

    try {
      const parser = new Json2csvParser(opts);
      csv = parser.parse(data);
    } catch (err) {
      console.error(err);
    }

    return csv;
  },

  /**
   * Get an object key value where key specified in dot notation.
   *
   * @param obj
   * @param path
   * @returns {*}
   */
  objectGet: (obj, path) => {
    let pathArray = path.split('.');

    if (!utilities.isset(obj))
      return null;

    for (let i = 0; i < pathArray.length; i++) {
      obj = obj[pathArray[i]];

      if (!utilities.isset(obj))
        break;
    }

    return obj;
  },

  /**
   * Set an object key value where key specified in dot notation.
   *
   * @param obj
   * @param path
   * @param value
   */
  objectSet: function (obj, path, value) {
    if (typeof(path) === 'string') {
      path = path.split('.');
    }
    if (!utilities.isset(obj[path[0]])) {
      obj[path[0]] = {};
    }
    if (path.length > 1) {
      utilities.objectSet(obj[path.shift()], path, value);
    } else {
      obj[path[0]] = value;
    }
  },

  /**
   * Checks whether given value is null or undefined.
   *
   * @returns {boolean}
   */
  isset: (...args) => {
    //  discuss at: http://phpjs.org/functions/isset/
    // original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // improved by: FremyCompany
    // improved by: Onno Marsman
    // improved by: Rafał Kukawski
    //   example 1: isset( undefined, true);
    //   returns 1: false
    //   example 2: isset( 'Kevin van Zonneveld' );
    //   returns 2: true

    let a = args;
    let l = a.length;
    let i = 0;
    let undef;

    if (l === 0) {
      throw new Error('Empty isset');
    }

    while (i !== l) {
      if (a[i] === undef || a[i] === null) {
        return false;
      }
      i++;
    }

    return true;
  },
};

module.exports = utilities;
