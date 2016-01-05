var assert = require('chai').assert;
var http = require('http');

const OutboundHttpLogger = require('../lib/outbound-http-logger');

describe('Outbound HTTP Logger Tests', function() {
  var server = http.createServer();

  before(function(done) {
    server.listen(9000, function() {
      done();
    });

    server.on('request', function(req, res) {
      debugger;
      res.writeHead(200, {});
      res.end();
    });
  });

  after(function(done) {
    server.close(done);
  });

  beforeEach(function() {
    OutboundHttpLogger.clear();
  });

  describe('Object Creation Tests', function() {
    it('should create a logger w/ defaults', function() {
      var logger = OutboundHttpLogger.create();

      var options = logger.options;
      assert.equal(options.name, '');
      assert.equal(options.timing, true);
      assert.equal(options.jsonBodyMaxLength, 10 * (1 << 10));
      assert.isUndefined(options.urlMatcher);
      assert.equal(options.requestStart, true);
      assert.equal(options.requestEnd, true);
      assert.equal(options.requestHeaders, true);
      assert.equal(options.requestJsonBody, true);
      assert.equal(options.responseHeaders, true);
      assert.equal(options.responseJsonBody, false);
      assert.isDefined(options.formatter);
    });
  });

  describe('GET Request', function() {
    it('should log a GET request', function(done) {
      var logger = OutboundHttpLogger.create();
      OutboundHttpLogger.enable();

      http.get('http://localhost:9000', function(res) {
        res.resume();
        done();
      })
    });
  });

});
