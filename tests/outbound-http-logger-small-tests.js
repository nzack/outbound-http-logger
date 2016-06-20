'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var assert = require('chai').assert;
var fs = require('fs');
var http = require('http');
var https = require('https');
var url = require('url');
var request = require('superagent');

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
      var body = JSON.stringify({ foo: 'bar'});
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('transfer-encoding', '');
      res.setHeader('Content-Length', body.length);
      res.writeHead(200, {});
      res.end(body);
    });

    sslServer.listen(9876, function() {
      done();
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
      assert.equal(options.responseJsonBody, true);
      assert.isDefined(options.formatter);
    });
  });

  describe('GET Request', function() {
    it('should log a GET request', function(done) {
      var logger = OutboundHttpLogger.create({ name: 'Test Logger'});
      OutboundHttpLogger.enable();

      request.get('http://localhost:9000')
        .send({ foo: 'bar' })
        .end(function(err, res) {
          done(err);
        });
    });
  });

  describe('HTTPS GET Request', function() {
    it('should log a GET request', function(done) {
      var logger = OutboundHttpLogger.create({ name: 'Test Logger'});
      OutboundHttpLogger.enable();

      request.get('https://localhost:9876')
        .send({ foo: 'bar' })
        .end(function(err, res) {
          done(err);
        });
    });
  });

  describe('Stats', function() {
    it('should generate stats', function(done) {
      OutboundHttpLogger.clear();
      var logger = OutboundHttpLogger.create({ name: 'Test Logger'});
      OutboundHttpLogger.enable();

      request.get('https://localhost:9876')
        .send({ foo: 'bar' })
        .end(function(err, res) {
          let stats = OutboundHttpLogger.stats();
          assert.equal(stats.count, 1);
          assert.equal(Object.keys(stats.urls).length, 1);
          assert.equal(stats.urls['https://localhost:9876/'], 1);
          done(err);
        });
    });

    it('should generate stats for mulitple requests', function(done) {
      let count = 10;
      OutboundHttpLogger.clear();
      var logger = OutboundHttpLogger.create({ name: 'Test Logger'});
      OutboundHttpLogger.enable();

      let promises = [];
      for (var i = 0; i < count; i++) {
        promises.push(makeRequest('https://localhost:9876'));
      }

      Promise.all(promises)
        .then(() => {
          let stats = OutboundHttpLogger.stats();
          OutboundHttpLogger.printStats();
          assert.equal(stats.count, count);
          assert.equal(stats.urls['https://localhost:9876/'], count);
          assert.equal(Object.keys(stats.urls).length, 1);
          done();
        });
    });

    it('should generate stats for mulitple requests', function(done) {
      let count = 10;
      OutboundHttpLogger.clear();
      var logger = OutboundHttpLogger.create({ name: 'Test Logger'});
      OutboundHttpLogger.enable();

      let promises = [];
      for (var i = 0; i < count; i++) {
        promises.push(makeRequest('https://localhost:9876'));
        promises.push(makeRequest('https://localhost:9876/bar'));
        promises.push(makeRequest('http://localhost:9000'));
        promises.push(makeRequest('http://localhost:9000/foo'));
      }

      Promise.all(promises)
        .then(() => {
          let stats = OutboundHttpLogger.stats();
          OutboundHttpLogger.printStats();
          assert.equal(stats.count, promises.length);
          assert.equal(stats.urls['https://localhost:9876/'], count);
          assert.equal(Object.keys(stats.urls).length, 4);
          done();
        });
    });
  });

});

let makeRequest = (url) => {
  return new Promise((resolve, reject) => {
    request.get(url)
      .end(function(err, res) {
        err ? reject(err) : resolve();
      });
  });
};
