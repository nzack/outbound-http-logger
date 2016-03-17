Coming soon....

Quick usage:

```
var OutboundHttpLogger = require('outbound-http-logger');
OutboundHttpLogger.quickstartLogEverything();
```

Or slightly longer:
```
var OutboundHttpLogger = require('outbound-http-logger');
var logger = OutboundHttpLogger.create();

// Global enable logging -- ** MUST do this
OutboundHttpLogger.enable();

// Global disable logging
OutboundHttpLogger.disable();

// Override and/or inspect request by monkey patching these:
logger.logRequestEnd
logger.logRequestStart
```

With options:
```
var logger = OutboundHttpLogger.create({
   name: '',
   timing: true,
   jsonBodyMaxLength: MAX_BODY_LENGTH_10K,
   urlMatcher: undefined,
   requestStart: true,
   requestEnd: true,
   requestHeaders: true,
   requestJsonBody: true,
   responseHeaders: true,
   responseJsonBody: true,
   formatter: DEFAULT_FORMATTER // see formatters/jclrz-formatter.js
 });
```

`urlMatcher` can be any regex run on the URL... i.e. `/google.com/`

Lots todo.. this is just initial release.