var _ = require('lodash');
var util = require('util');
var shimmer = require('shimmer');
var moment = require('moment');

var http = require('http');
var https = require('https');
var debug = require('debug')('outbound-http-logger');

const MAX_BODY_LENGTH_10K = 10 * (1 << 10);

const DEFAULT_FORMATTER = require('./formatters/jclrz-formatter');

const DEFAULT_OPTIONS = {
  name: '',
  timing: true,
  jsonBodyMaxLength: MAX_BODY_LENGTH_10K,
  urlMatcher: undefined,
  requestStart: true,
  requestEnd: true,
  requestHeaders: true,
  requestJsonBody: true,
  responseHeaders: true,
  responseJsonBody: false,
  formatter: DEFAULT_FORMATTER
};

/**
 * The constructor for a new {OutboundHttpLogger}.
 *
 * @param {Object} options
 * @constructor
 */
function OutboundHttpLogger(options) {
  this.options = options;
}

/**
 * Tracks all registered logger objects
 * @type {Array}
 * @private
 */
OutboundHttpLogger._loggers = [];

/**
 * Object for holding global stats
 * @private
 */
OutboundHttpLogger._stats = {
  count: 0
};

OutboundHttpLogger.create = function(options) {

  var resolvedOptions = _.defaults({}, options, DEFAULT_OPTIONS);

  var logger = new OutboundHttpLogger(resolvedOptions);
  OutboundHttpLogger._loggers.push(logger);

  return logger;
};

/**
 * Globally enables request logging.  This method must be
 * called before request logging will begin.
 */
OutboundHttpLogger.enable = function() {
  if (OutboundHttpLogger._hooked) {
    return;
  }

  OutboundHttpLogger._hooked = true;
  shimmer.wrap(http, 'request', hookRequest);
  //shimmer.wrap(https, 'request', hookRequest);
};

/**
 * Globally disables request logging.  This method will disable
 * all request logging.
 */
OutboundHttpLogger.disable = function() {
  shimmer.unwrap(http, 'request', hookRequest);
  //shimmer.unwrap(https, 'request', hookRequest);
  OutboundHttpLogger._hooked = false;
};

OutboundHttpLogger.clear = function() {
  OutboundHttpLogger._loggers = [];
  OutboundHttpLogger._stats = {};
};

/**
 * This method logs the start of the request.  Context information
 * about the request is passed in.
 *
 * @param {Object} requestContext - The request context object.
 */
OutboundHttpLogger.prototype.logRequestStart = function(requestContext) {
  if (!this.options.requestStart) {
    return;
  }

  // Log the start of the http so that if anything happens during the
  // request we will know what requests were in flight at the time
  // something happened.
  var httpLogObject = {};

  if (this.options.name) {
    httpLogObject.name = this.options.name;
  }

  var clientRequest = requestContext.clientRequest;

  httpLogObject = _.extend(httpLogObject, {
    type: 'request_start',
    timestamp: requestContext.initialRequestCallStart.toISOString(),
    url: requestContext.outboundUrl,
    method: requestContext.method,
    headers: clientRequest._headers
  });

  if (this.options.requestJsonBody === true && requestContext.requestBody) {
    var length = requestContext.requestBody.length || -1;
    var type = clientRequest._headers['content-type'];
    var chunked = clientRequest._headers['transfer-encoding'] === 'chunked';

    if (length && type && !chunked) {
      httpLogObject.content = {};
      httpLogObject.content.contentLength = length;
      if (type.indexOf('json') >= 0 && parseInt(length) <= this.options.jsonBodyMaxLength) {
        httpLogObject.content.body = JSON.parse(requestContext.requestBody);
      }
    }
  }

  this.options.formatter.requestStart(httpLogObject);
};

/**
 * This method logs the end of the request.  Context information about the
 * request is passed in.
 *
 * @param {Object} requestContext - The request context object.
 */
OutboundHttpLogger.prototype.logRequestEnd = function(requestContext) {
  if (!this.options.requestEnd) {
    return;
  }

  var message = requestContext.incomingMessage;
  var httpLogObject = {};

  if (this.options.name) {
    httpLogObject.name = this.options.name;
  }

  httpLogObject = _.extend(httpLogObject, {
    type: 'request_end',
    timestamp: requestContext.initialRequestCallStart.toISOString(),
    res_status: message.statusCode,
    url: requestContext.outboundUrl,
    method: requestContext.method
  });

  if (this.options.responseHeaders) {
    httpLogObject.headers= message.headers;
  }

  if (this.options.timing) {
    httpLogObject.timing = {
      req_ms: requestContext.requestTime,
      total_ms: requestContext.totalTime,
      socket_assignment_ms: requestContext.socketAssignmentTime
    };
  }

  httpLogObject.content = {
    readContentSize: requestContext.contentLength
  };

  if (message.text) {
    httpLogObject.content.contentLength = message.text.length;
  }

  if (this.options.responseJsonBody === true) {
    var length = message.headers['content-length'];
    var type = message.headers['content-type'];
    var chunked = message.headers['transfer-encoding'] === 'chunked';

    if (length && type && !chunked) {
      if (type.indexOf('json') >= 0 && parseInt(length) <= this.options.jsonBodyMaxLength) {
        httpLogObject.content.body = JSON.parse(message.text);
      }
    }
  }

  this.options.formatter.requestEnd(httpLogObject);
};

/**
 * This method is used by shimmer and returns the new, wrapped function.
 *
 * @param originalFn - The orginal function we're using shimmer to wrap
 * @returns {requestHook}
 */
function hookRequest(originalFn) {

  /**
   * The function used to replace `http.request`.
   */
  return function requestHook(options) {
    var alreadyTracked = false;
    if (options.__outboundHttpLoggerTracked) {
      debug('Request has already been tracked.');
      alreadyTracked = true;
    }
    options.__outboundHttpLoggerTracked = true;

    // Apply the original method to get a ClientRequest object
    var clientRequest = originalFn.apply(this, arguments);

    // If the request is already patched, just continue
    if (alreadyTracked) {
      return clientRequest;
    }

    var protocol;
    if (clientRequest.agent) {
      protocol = clientRequest.agent.protocol;
    }

    var host = clientRequest.getHeader('host');
    var path = clientRequest.path;
    var outboundUrl = util.format('%s//%s%s', protocol, host, path);

    // Get the information we need from the arguments of the request
    var requestContext = {
      clientRequest: clientRequest,
      requestStart: null,
      method: clientRequest.method,
      socketAssignmentTime: null,
      requestTime: null,
      totalTime: null,
      responseStatus: null,
      initialRequestCallStart: moment(),
      contentLength: 0,
      outboundUrl: outboundUrl,
      protocol: protocol,
      host: host,
      path: path
    };

    // Test all loggers to see if any of them are valid.
    var matchedLoggers = _.filter(OutboundHttpLogger._loggers, function(logger) {
      var urlMatcher = logger.options.urlMatcher;
      return urlMatcher === undefined || urlMatcher.test(requestContext.outboundUrl);
    });

    // Hook the end function of the ClientRequest if we're trying to capture the
    // request body.
    if (clientRequest._hasBody) {
      shimmer.wrap(clientRequest, 'end', function hookClientRequestEnd(originalEnd) {
        return function clientRequestEndHook() {
          requestContext.requestBody = arguments[0];
          return originalEnd.apply(this, arguments);
        };
      });
    }

    clientRequest.once('socket', trackSocketAssignment);

    // Emitted when a response is received to this request.
    clientRequest.on('response', response);

    return clientRequest;

    /**
     * Helper to process the `response` event
     *
     * @param incomingMessage
     */
    function response(incomingMessage) {
      requestContext.incomingMessage = incomingMessage;
      requestContext.requestTime = moment().diff(requestContext.requestStart);

      // This event fires when no more data will be provided.
      // http://nodejs.org/api/stream.html#stream_event_end
      incomingMessage.on('end', requestEnd);
      incomingMessage.on('data', requestData);
    }

    function requestData(chunk) {
      requestContext.contentLength += chunk.length;
    }

    /**
     * Logs request end.
     */
    function requestEnd() {
      OutboundHttpLogger._stats.count++;
      requestContext.totalTime = moment().diff(requestContext.initialRequestCallStart);

      matchedLoggers.forEach(function(logger) {
        logger.logRequestEnd(requestContext);
      });
    }

    /**
     * Tracks socket assignment and logs request start
     */
    function trackSocketAssignment() {
      // Socket connected
      requestContext.requestStart = moment();

      // Socket assignment time (ie the time it takes for the socket to get a
      requestContext.socketAssignmentTime = moment().diff(requestContext.initialRequestCallStart);

      matchedLoggers.forEach(function(logger) {
        logger.logRequestStart(requestContext);
      });
    }
  };
}

module.exports = OutboundHttpLogger;

