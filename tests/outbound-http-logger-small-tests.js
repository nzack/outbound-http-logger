process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var assert = require('chai').assert;
var fs = require('fs');
var http = require('http');
var https = require('https');
var url = require('url');
var request = require('superagent');

require('longjohn');

const OutboundHttpLogger = require('../lib/outbound-http-logger');

describe('Outbound HTTP Logger Tests', function() {
  var server;
  var sslServer;

  before(function(done) {
    server = http.createServer();
    server.listen(9000, function() {
      done();
    });

    server.on('request', function(req, res) {
      debugger;
      res.writeHead(200, {});
      res.end();
    });
  });

  before(function(done) {
    var options = {
      key: fs.readFileSync('./server/rsa-server.key'),
      cert: fs.readFileSync('./server/rsa-server.crt')
    };
    sslServer = https.createServer(options, function(req, res) {
      console.log('********* REQUEST');
      res.writeHead(200, {});
      res.end();
    });

    sslServer.listen(9876, function() {
      done();
    });

    //sslServer.on('request', function(req, res) {
    //  debugger;
    //  res.writeHead(200, {});
    //  res.end();
    //});
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

      request.get('http://localhost:9000')
        .end(function(err, res) {
          done(err);
        });
    });
  });

  describe('HTTPS GET Request', function() {
    it('should log a GET request', function(done) {
      var logger = OutboundHttpLogger.create();
      OutboundHttpLogger.enable();

      request.get('https://localhost:9876')
        .end(function(err, res) {
          debugger;
          done(err);
        });
    });
  });

});
