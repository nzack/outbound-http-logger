Utility for logging HTTP requests.

<img src="https://raw.githubusercontent.com/nzack/readme-images/master/outbound-http-logger/sample-capture.png" width="389" height="766" />

Quick usage:

```
var OutboundHttpLogger = require('outbound-http-logger');
OutboundHttpLogger.go();
// or
OutboundHttpLogger.quickstartLogEverything();
```

Or slightly longer:

```
var OutboundHttpLogger = require('outbound-http-logger');
var logger = OutboundHttpLogger.create();

// Global enable logging -- ** MUST do this
OutboundHttpLogger.enable();
```

Other stuff:

```
// Global disable logging
OutboundHttpLogger.disable();

// Override and/or inspect request by monkey patching these:
logger.logRequestEnd
logger.logRequestStart
```

With options:

```
var logger = OutboundHttpLogger.create({
   name: '',                                // Name of the logger, useful if you have multiple loggers
   timing: true,                            // Prints timing stats
   jsonBodyMaxLength: MAX_BODY_LENGTH_10K,  // Max limit to print JSON body
   urlMatcher: undefined,                   // RegExp object that matches the url
   requestStart: true,                      // Log start of request
   requestEnd: true,                        // Log end of request
   requestHeaders: true,                    // Log request headers
   requestJsonBody: true,                   // Log request JSON body
   responseHeaders: true,                   // Log response headers
   responseJsonBody: true,                  // Log response JSON body
   formatter: DEFAULT_FORMATTER             // See formatters/jclrz-formatter.js
 });
```

`urlMatcher` can be any regex run on the URL... i.e. `/google.com/`

Lots todo... this is just initial release.