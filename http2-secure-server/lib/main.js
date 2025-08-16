/**
* @license Apache-2.0
*
* Copyright (c) 2018 The Stdlib Authors.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

// MODULES //

var http2 = require( 'http2' ); // eslint-disable-line node/no-unsupported-features/node-builtins
var logger = require( 'debug' );
var isFunction = require( '@stdlib/assert/is-function' );
var omit = require( '@stdlib/utils/omit' );
var format = require( '@stdlib/string/format' );
var validate = require( './validate.js' );
var DEFAULTS = require( './defaults.json' );


// VARIABLES //

var debug = logger( './../../http2-secure-server' );
var EXCLUDE_OPTIONS = [
	'port',
	'maxport',
	'hostname',
	'address'
];


// MAIN //

/**
* Returns a function which creates an HTTP/2 server.
*
* ## Notes
*
* -   The function requires that either the PFX option is provided or a cert/key pair is provided.
* -   In addition to options documented below, the function supports any options supported by `http2.createSecureServer`. Which server options are supported depends on the Node.js version.
*
* @param {Options} [options] - server options
* @param {(string|Array<string>|Buffer|Array<Buffer>|Array<Object>)} [options.pfx] - PFX or PKCS12 encoded private key and certificate chain
* @param {(string|Array<string>|Buffer|Array<Buffer>)} [options.cert] - cert chains in PEM format
* @param {(string|Array<string>|Buffer|Array<Buffer>|Array<Object>)} [options.key] - private keys in PEM format
* @param {NonNegativeInteger} [options.port=0] - server port
* @param {NonNegativeInteger} [options.maxport] - max server port
* @param {string} [options.hostname] - server hostname
* @param {string} [options.address="127.0.0.1"] - server address
* @param {Callback} [requestListener] - callback invoked upon receiving an HTTP request
* @throws {TypeError} `requestListener` must be a function
* @throws {TypeError} must provide valid options
* @returns {Function} function which creates an HTTP server
*
* @example
* var resolve = require( 'path' ).resolve;
* var readFileSync = require( '@stdlib/fs/read-file' ).sync;
*
* var opts = {
*     'port': 7331,
*     'address': 'localhost',
*     'cert': readFileSync( resolve( __dirname, '..', 'examples', 'localhost-cert.pem' ) ),
*     'key': readFileSync( resolve( __dirname, '..', 'examples', 'localhost-privkey.pem' ) )
* };
*
* function done( error, server ) {
*     if ( error ) {
*         throw error;
*     }
*     console.log( 'Success!' );
*     server.close();
* }
*
* var http2Server = factory( opts );
* http2Server( done );
*/
function factory() {
	var requestListener;
	var hostname;
	var options;
	var nargs;
	var sopts;
	var opts;
	var port;
	var max;
	var err;
	var flg;

	nargs = arguments.length;
	sopts = {};
	opts = {};
	if ( nargs === 1 ) {
		if ( isFunction( arguments[0] ) ) {
			requestListener = arguments[ 0 ];
		} else {
			options = arguments[ 0 ];
			err = validate( opts, options );
			flg = true;
		}
	} else if ( nargs > 1 ) {
		options = arguments[ 0 ];
		requestListener = arguments[ 1 ];
		if ( !isFunction( requestListener ) ) {
			throw new TypeError( format( 'invalid argument. Request listener must be a function. Value: `%s`.', requestListener ) );
		}
		err = validate( opts, options );
		flg = true;
	}
	if ( err ) {
		throw err;
	}
	if ( flg ) {
		// Resolve any server-specific options which should be passed to `http2.createSecureServer`:
		sopts = omit( options, EXCLUDE_OPTIONS );
	}
	if ( opts.port === void 0 ) {
		port = DEFAULTS.port;
	} else {
		port = opts.port;
	}
	debug( 'Server port: %d', port );

	if ( opts.maxport === void 0 ) {
		max = port;
	} else {
		max = opts.maxport;
	}
	debug( 'Max server port: %d', max );

	if ( opts.hostname ) {
		hostname = opts.hostname;
	} else if ( opts.address ) {
		hostname = opts.address;
	} else {
		hostname = DEFAULTS.address;
	}
	debug( 'Server hostname: %s', hostname );

	return http2Server;

	/**
	* Creates an HTTP/2 server.
	*
	* @private
	* @param {Callback} done - function to invoke after creating a server
	* @throws {TypeError} must provide a function
	*
	* @example
	* function done( error, server ) {
	*     if ( error ) {
	*         throw error;
	*     }
	*     console.log( 'Success!' );
	*     server.close();
	* }
	* http2Server( done );
	*/
	function http2Server( done ) {
		var server;

		if ( !isFunction( done ) ) {
			throw new TypeError( format( 'invalid argument. Callback argument must be a function. Value: `%s`.', done ) );
		}
		if ( requestListener ) {
			server = http2.createSecureServer( sopts, requestListener );
		} else {
			server = http2.createSecureServer( sopts );
		}
		server.on( 'error', errorListener );
		server.once( 'listening', onListen );

		debug( 'Attempting to listen on %s:%d.', hostname, port );
		server.listen( port, hostname );

		/**
		* Server error event handler.
		*
		* @private
		* @param {Error} error - server error
		* @throws {Error} server error
		*/
		function errorListener( error ) {
			if ( error.code === 'EADDRINUSE' ) {
				debug( 'Server address already in use: %s:%d.', hostname, port );
				port += 1;
				if ( port <= max ) {
					debug( 'Attempting to listen on %s:%d.', hostname, port );
					server.listen( port, hostname );
					return;
				}
			}
			throw error;
		}

		/**
		* Callback invoked once a server is listening and ready to handle requests.
		*
		* @private
		*/
		function onListen() {
			var addr = server.address();
			debug( 'HTTP/2 server initialized. Server is listening for requests on %s:%d.', addr.address, addr.port );
			done( null, server );
		}
	}
}


// EXPORTS //

module.exports = factory;
