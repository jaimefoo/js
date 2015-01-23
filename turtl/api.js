var Api = new Class({
	// the base url all resources are pulled from (NEVER a trailing slash!)
	// NOTE: this must be set by the app
	api_url:		null,
	api_key:		null,

	user:			false,

	// a tracker that will track all API requests (ONLY IF in an addon)
	tracker:		null,

	// override this function to determine which callback gets called on a JSONP
	// return. normall this is done by analyzing the response. the default is to
	// always run "success" since nothing EVER goes wrong anyway, ever (at least
	// not when WE program it).
	cb_wrap:	function(cb_success, cb_fail)
	{
		return function(data)
		{
			cb_success(data);
		};
	},

	initialize: function(url, key, cb_wrap)
	{
		this.api_url = url;
		this.api_key = key;
		this.cb_wrap = cb_wrap;
		// JS hax LAWL omgawrsh gawrsh shhwarshhrwsh
		this['delete'] = function()
		{
			alert('api.delete() is deprecated and broken in MANY browsers ("delete" is a reserved word in JS). Please use api._delete() instead.');
		};
	},

	set_api_key: function(key)
	{
		this.api_key = key;
	},

	set_auth: function(auth_key)
	{
		if(!auth_key) return false;

		this.user = {
			auth_key: auth_key
		};
	},

	clear_auth: function()
	{
		this.user = false;
	},

	// HTTP status after a call is made
	status:		null,

	// error object populated when there is an error
	error: 		{
		code:	null,
		msg:	null,
		field:	null
	},

	// set to true to get debug info
	debug:		false,

	// request id counter
	requests:	0,

	get: function(resource, data, params) { return this._call(this.api_url, 'GET', resource, data, params); },
	post: function(resource, data, params) { return this._call(this.api_url, 'POST', resource, data, params); },
	put: function(resource, data, params) { return this._call(this.api_url, 'PUT', resource, data, params); },
	_delete: function(resource, data, params) { return this._call(this.api_url, 'DELETE', resource, data, params); },	// BAH JS-annoyingness

	_call: function(api_url, method, resource, data, params)
	{
		data || (data = {});
		params || (params = {});

		return new Promise(function(resolve, reject) {
			// should we auth to the server? we don't want to unless we have to
			var send_auth = this.test_auth_needed(method, resource);

			var url = api_url + '/' + resource.replace(/^\//, '');

			if(!['post', 'get'].contains(method.toLowerCase()))
			{
				// add method GET var (MUST be GET (Wookie restriction))
				if(url.match(/\?/))
					url += '&_method='+method;
				else
					url += '?_method='+method;
			}

			var request = {
				url: url,
				method: (method.toLowerCase() == 'get' ? 'GET' : 'POST'),
				emulation: false,
				headers: params.headers || {},
				data: data,
				responseType: params.responseType,
				onSuccess: function(res)
				{
					if(!params.responseType)
					{
						try
						{
							res = JSON.parse(res);
						}
						catch(e)
						{
							var err = 'api: error parsing resonse: '+ res
							log.debug(err);
							reject(err);
							return;
						}
					}
					resolve(res);
				},
				onFailure: function(xhr)
				{
					var res = xhr;
					if(!params.responseType && xhr)
					{
						try
						{
							res = JSON.parse(xhr.responseText);
						}
						catch(e)
						{
							res = 'error parsing error response: '+ xhr.responseText;
							log.debug('api: ', res);
						}
					}
					reject({res: res, xhr: xhr});
				},
				onProgress: function(event, xhr)
				{
					var progress = {total: event.total, loaded: event.loaded};
					if(params.progress) params.progress(progress, xhr);
				},
				onUploadprogress: function(event, xhr)
				{
					var progress = {total: event.total, loaded: event.loaded};
					if(params.uploadprogress) params.uploadprogress(progress, xhr);
				},
				evalScripts: false,
				evalResponse: false
			};

			if(params.rawUpload)
			{
				request.urlEncoded = false;
				request.encoding = false;
				request.processData = false;
			}

			// fill in the client we're using
			request.headers['X-Turtl-Client'] = config.client + '-' + config.version;

			// if we're sending auth AND we're logged in, authenticate
			if(this.user && send_auth)
			{
				request.headers['X-Auth-Api-Key'] = this.api_key;
				request.headers['Authorization'] = 'Basic ' + Base64.encode('user:' + this.user.auth_key);
			}
			new Request(request).send();
		})
	},

	// given a method and resource (and also config.auth in /config/auth.js),
	// determine if authentication is needed to access this resource
	test_auth_needed: function(method, resource)
	{
		if(['POST', 'PUT', 'DELETE'].contains(method))
		{
			var auth = true;
		}
		else
		{
			var auth = false;
		}

		for(var i = 0; i < config.auth.length; i++)
		{
			var entry = config.auth[i];
			var regex = new RegExp('^' + entry.resource.replace(/\//g, '\\\/') + '$')
			match = regex.exec(resource);
			if(match && entry.method.toUpperCase() == method)
			{
				if(!auth && entry.auth) auth = true;
				else if(auth && !entry.auth) auth = false;
				// first match wins
				break;
			}
		};
		//if (auth) console.log('auth needed: '+method+' '+resource);
		return auth;
	},

	// given a response from the api, process it and run any callbacks
	is_error: function(data)
	{
		if(typeof(data.status) != 'undefined')
		{
			return true;
		}
		return false;
	},

	qs_serialize: function(obj, prefix)
	{
		var str = [];
		for(var p in obj)
		{
			var k = prefix ? prefix + "[" + p + "]" : p, v = obj[p];
			str.push(typeof v == "object" ? 
			this.qs_serialize(v, k) :
			encodeURIComponent(k) + "=" + encodeURIComponent(v));
		}
		return str.join("&");
	}
});

