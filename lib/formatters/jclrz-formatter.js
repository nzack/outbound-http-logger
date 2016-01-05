var jclrz = require('json-colorz');

/**
 * Formatter uses the jclrz library to print out the object to the console
 * in a colorized format.
 *
 * @constructor
 */
function JclrzFormatter() {}

/**
 * Logs
 *
 * @param obj
 */
JclrzFormatter.prototype.requestStart = function(obj) {
  jclrz.colors.attr = 'green';
  jclrz(obj);
};

JclrzFormatter.prototype.requestEnd = function(obj) {
  jclrz.colors.attr = 'blue';
  jclrz(obj);
  jclrz.colors.attr = 'green';
};

module.exports = new JclrzFormatter();