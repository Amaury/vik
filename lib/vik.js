/**
 * Vik object.
 *
 * A target selector must be given.
 * If no source selector is given, the whole response is copied inside the target node.
 * If a source selector is given:
 * - "replace" strategy: the target node is replaced by the source node.
 * - "fill" strategy: the source node is copied inside the target node.
 * - "copy" strategy: the content of the source node is copied inside the target node.
 *
 * Default:
 * - target: "body"
 * - source: "body"
 * - strategy: "replace"
 */
var vik = new function() {
	/* ********** PRIVATE ATTRIBUTES ********** */
	/** Handler to call before the page has been loaded. */
	this._preCallback = null;
	/** Handler to call when the page has been loaded. */
	this._postCallback = null;
	/** Ghost mode. */
	this._ghost = false;
	/** Selector of the node which contains the page title. */
	this._title = "head > title";
	/** Name of the attribute which contains the page title, from the 'title' selector. If empty, use the node itself. */
	this._titleAttribute = null;
	/** Selector of the default target, where the loaded content will be written. */
	this._target = "body";
	/** Selector of the extracted element in the fetched data. */
	this._source = "body";
	/** Strategy applied when data are copied from the source to the target. */
	this._strategy = "replace";
	/** Prefix to add on fetched URLs. */
	this._urlPrefix = null;
	/** True when the CTRL key is pressed. */
	this._ctrlPressed = false;

	/* ********** EVENT MANAGERS ********** */
	// CTRL key press management
	document.addEventListener("keydown", function(event) {
		if (event.which == "17")
			vik._ctrlPressed = true;
	});
	document.addEventListener("keyup", function(event) {
		if (event.which == "17")
			vik._ctrlPressed = false;
	});
	// management of backward/forward buttons
	window.onpopstate = function(event) {
		vik._onpopstate(event);
	};

	/* ********** INITIALIZATION ********** */
	/**
	 * Method called to initialize Vik at page loading.
	 * @param	Object	params	Associative array with parameter values:
	 *				- ghost (boolean)		Tell if loadings should be in ghost mode (no addition in history). (default: false)
	 *				- preCallback (Closure)	Handler to call before the page has been loaded.
	 *				- postCallback (Closure)	Handler to call after the page has been loaded.
	 *				- strategy (string)		"replace" or "fill". (default: "replace")
	 *				- target (string)		Selector of the current page's element which will be the target of the managed links. (default: "body")
	 *				- source (string)		Selector of the response's element which will contain the HTML to load.
	 *								If this element is not found, the whole response will be used.
	 *								If this parameter is set to null, the whole response will be used. (default: "body")
	 *				- urlPrefix (string)		Prefix to add on fetched URLs. If this parameter is set, the 'defaultSource' parameter
	 *								is automatically set to null. (default: null)
	 *				- title (string)		Selector of the node which contains the page title.
	 *								If empty, the page title will not be updated.
	 *				- titleAttribute (string)	Name of the attribute of the node fetched from the "title" selector, which contains the page title.
	 *								If empty, the text content of the selected node will be used.
	 */
	this.init = function(params) {
		this._initParams(params);
		// once the DOM is ready, update all eligible links
		this.onDocumentReady(function() {
			// init of links
			vik._initLinks();
			// call the handler (if defined)
			vik.execCallback(vik._postCallback);
		});
	};

	/* ********** LOADING ********** */
	/**
	 * Method called when a link is clicked.
	 * @param	string|DOMNode	input		URL of the page to load or link's node.
	 * @param	Object		params		Parameters.
	 * @param	bool		ghostMode	(optional) true to use ghost mode.
	 */
	this.load = function(input, params, ghostMode) {
		// check if the CTRL key is pressed (open in a new tab)
		if (this._ctrlPressed)
			return (true);
		// execute the "before" callbacks
		if (params.preCallback) {
			// execute callback defined in link's parameters
			this.execCallback(
				params.preCallback,
				function() {
					// after execution, check if there is a general callback
					if (!vik._preCallback) {
						// no general callback, continue the main processing
						vik._loadExec(input, params, ghostMode);
					} else {
						// execute the general callback
						vik.execCallback(
							vik._preCallback,
							function() {
								vik._loadExec(input, params, ghostMode);
							}
						);
					}
				}
			);
		} else if (this._preCallback) {
			// execute the general callback
			this.execCallback(
				this._preCallback,
				function() {
					vik._loadExec(input, params, ghostMode);
				}
			);
		} else {
			// no callback defined, continue the execution
			this._loadExec(input, params, ghostMode);
		}
		return (false);
	};

	/* ********** UTILITIES ********** */
	/**
	 * Method used to trigger some code when the document is loaded.
	 * @param	Closure	handler	Function to execute.
	 * @link	https://stackoverflow.com/questions/9899372/pure-javascript-equivalent-of-jquerys-ready-how-to-call-a-function-when-t/9899701#9899701
	 */
	this.onDocumentReady = function(handler) {
		// see if DOM is already available
		if (document.readyState === "complete" || document.readyState === "interactive") {
			// call on next available tick
			setTimeout(handler, 1);
		} else {
			document.addEventListener("DOMContentLoaded", handler, {capture: false, once: true});
		}
	};
	/**
	 * Do an AJAX request using the GET method.
	 * @param	string	url		URL to fetch.
	 * @param	string	strategy	Vik merging strategy. Will be sent as HTTP header, if not empty or null.
	 * @param	bool	asHTML		True to get an HTML response.
	 * @param	Closure	handler		Callback function.
	 */
	this.fetchGet = function(url, strategy, asHTML, handler) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", url, true);
		if (strategy)
			xhr.setRequestHeader("x-vik-strategy", strategy);
		if (asHTML === true)
			xhr.responseType = "document";
		xhr.onreadystatechange = function() {
			if (this.readyState != 4 || this.status != 200)
				return;
			if (asHTML === true)
				handler(this.responseXML);
			else
				handler(this.response);
		};
		xhr.send();
	};
	/**
	 * Execute a function.
	 * @param	string|Closure	handler	Callback or function name.
	 * @param	mixed		param	Variable given to the callback as parameter.
	 * @return	mixed	What the handler returned.
	 */
	this.execCallback = function(handler, param) {
		if (!handler)
			return (undefined);
		if (typeof handler === "function")
			return (hendler(param));
		if (typeof handler === "string")
			return (window[handler](param));
		return (undefined);
	};

	/* ********** PRIVATE METHODS ********** */
	/** Private method used to update object's attributes. */
	this._initParams = function(params) {
		if (!params)
			params = {};
		this._ghost = (params.ghost === true) ? true : false;
		this._preCallback = params.hasOwnProperty("preCallback") ? params.preCallback : null;
		this._postCallback = params.hasOwnProperty("postCallback") ? params.postCallback : null;
		this._target = params.hasOwnProperty("target") ? params.target : "body";
		this._source = params.hasOwnProperty("source") ? params.source : "body";
		this._strategy = "replace";
		if (params.strategy == "fill" || params.strategy == "copy")
			this._strategy = params.strategy;
		this._urlPrefix = params.hasOwnProperty("urlPrefix") ? params.urlPrefix : null;
		this._title = params.hasOwnProperty("title") ? params.title : "title";
		this._titleAttribute = params.hasOwnProperty("titleAttribute") ? params.titleAttribute : null;
	};
	/** Initialization of links. */
	this._initLinks = function() {
		// get the list of elements to update
		var elements = document.querySelectorAll(
			  "a"				// links
			+ "[href^='/']"			// with URL starting with a slash
			+ ":not([href^='//'])"		//          but not with a double slash
			+ ":not([data-vik='off'])"	// not disabled
			+ ":not([data-vik='false'])"
			+ ":not([data-vik='no'])"
			+ ":not([data-vik^='disable'])"
			+ ":not([data-vik='0'])"
			+ ":not([target])"		// without a 'target' attribute
			+ ":not([onclick])"		// without an 'onclick' attribute
		);
		// loop on the elements, and add them an 'onclick' attribute
		for (var i = 0; i < elements.length; ++i) {
			var elem = elements[i];
			var ghostMode = ((elem.hasAttribute("data-vik") && elem.getAttribute("data-vik") == "ghost") || vik._ghost) ? true : false;
			// create the parameters array
			var clickParam = {};
			if (elem.hasAttribute("data-vik-strategy")) {
				var strategy = elem.getAttribute("data-vik-strategy");
				if (strategy == "replace" || strategy == "fill" || strategy == "copy")
					clickParam.strategy = strategy;
			}
			if (elem.hasAttribute("data-vik-target") && elem.getAttribute("data-vik-target").length)
				clickParam.target = elem.getAttribute("data-vik-target");
			if (elem.hasAttribute("data-vik-source") && elem.getAttribute("data-vik-source").length)
				clickParam.source = elem.getAttribute("data-vik-source");
			if (elem.hasAttribute("data-vik-prefix"))
				clickParam.urlPrefix = elem.getAttribute("data-vik-prefix");
			if (elem.hasAttribute("data-vik-pre-callback") && elem.getAttribute("data-vik-pre-callback").length)
				clickParam.preCallback = elem.getAttribute("data-vik-callback-before");
			if (elem.hasAttribute("data-vik-post-callback") && elem.getAttribute("data-vik-post-callback").length)
				clickParam.postCallback = elem.getAttribute("data-vik-post-callback");
			if (elem.hasAttribute("data-vik-title"))
				clickParam.title = elem.getAttribute("data-vik-title");
			if (elem.hasAttribute("data-vik-title-attribute") && elem.getAttribute("data-vik-title-attribute").length)
				clickParam.titleAttribute = elem.getAttribute("data-vik-title-attribute");
			// remove the Vik attributes
			elem.removeAttribute("data-vik");
			elem.removeAttribute("data-vik-strategy");
			elem.removeAttribute("data-vik-target");
			elem.removeAttribute("data-vik-source");
			elem.removeAttribute("data-vik-prefix");
			elem.removeAttribute("data-vik-pre-callback");
			elem.removeAttribute("data-vik-post-callback");
			elem.removeAttribute("data-vik-title");
			elem.removeAttribute("data-vik-title-attribute");
			clickParam = JSON.stringify(clickParam);
			// add the "onclick" attribute
			var clickStr = "return vik.load(this";
			if (clickParam != "{}" || ghostMode)
				clickStr += ", " + clickParam;
			if (ghostMode)
				clickStr += ", true";
			clickStr += ")";
			elem.setAttribute("onclick", clickStr);
		}
	};
	/**
	 * Real processing of a click on a link.
	 * @param	string|DOMNode	input		URL of the page to load or link's node.
	 * @param	Object		params		Parameters.
	 * @param	bool		ghostMode	(optional) true to use ghost mode.
	 */
	this._loadExec = function(input, params, ghostMode) {
		// check params
		if (!params)
			params = {};
		// get the URL
		var url = null;
		if (typeof input === "string") {
			// an URL was given as input
			url = input;
		} else {
			// a DOMNode was given as input
			if (!input.hasAttribute("href")) {
				console.log("[VIK] Unable to fetch data. Missing 'href' attribute.");
				return (false);
			}
			url = input.getAttribute("href");
		}
		var realUrl = url;
		if (params.urlPrefix)
			realUrl = params.urlPrefix + url;
		else if (this._urlPrefix)
			realUrl = this._urlPrefix + url;
		// get the target
		var target = null;
		var targetNode = null;
		if (params.target)
			targetNode = document.querySelector(target = params.target);
		if (!targetNode && this._target)
			targetNode = document.querySelector(target = this._target);
		if (!targetNode) {
			console.log("[VIK] Unable to fetch data. The target '" + target + "' doesn't exist.");
			return (false);
		}
		// fetch the page
		var source = params.hasOwnProperty("source") ? params.source : this._source;
		var titleSelector = params.title ? params.title : vik._title;
		var asHTML = (source || titleSelector) ? true : false;
		var strategy = params.strategy ? params.strategy : vik._strategy;
		// fetch the page data
		this.fetchGet(realUrl, strategy, asHTML, function(content) {
			// write the content in the right place
			if (!asHTML) {
				targetNode.innerHTML = content;
			} else if (!source) {
				targetNode.innerHTML = content.innerHTML;
			} else {
				// search the source node
				var srcNode = content.querySelector(source);
				if (!srcNode) {
					console.log("[VIK] Source selector '" + source + "' returns nothing.");
					return;
				}
				// strategy-based processing
				if (strategy == "copy") {
					// copy strategy
					targetNode.innerHTML = "";
					if (srcNode.childNodes) {
						while (srcNode.hasChildNodes())
							targetNode.appendChild(srcNode.firstChild);
					}
				} else if (strategy == "fill") {
					// "fill" strategy
					targetNode.innerHTML = "";
					targetNode.appendChild(srcNode);
				} else {
					// replace strategy
					targetNode.replaceWith(srcNode);
				}
			}
			// if not ghost mode
			if (ghostMode !== true) {
				// update page title
				if (titleSelector) {
					var titleNode = content.querySelector(titleSelector);
					if (!titleNode) {
						console.log("[Vik] Unable to find the page title's node ('" + titleSelector + "').");
					} else {
						var titleAttribute = params.hasOwnProperty(titleAttribute) ? params.titleAttribute : vik._titleAttribute;
						if (!titleAttribute) {
							document.title = titleNode.innerText;
						} else if (titleNode.hasAttribute(titleAttribute)) {
							document.title = titleNode.getAttribute(titleAttribute);
						}
					}
				}
				// scroll to top
				window.scrollTo(0, 0);
				// history state (state = clone of params + url)
				var state = {
					"url": url
				};
				for (var prop in params) {
					if (params.hasOwnProperty(prop))
						state[prop] = params[prop];
				}
				// add to history
				window.history.pushState(state, "", url);
			}
			// execute the "after" callbacks
			if (vik._postCallback)
				vik.execCallback(vik._postCallback);
			if (params.postCallback)
				vik.execCallback(params.postCallback);
		});
		return (false);
	};

	/* ********** HISTORY MANAGEMENT ********** */
	/**
	 * Method called when backward/forward buttons are clicked.
	 * @param	Event	event	PopState event.
	 */
	this._onpopstate = function(event) {
		// get the stored state
		var state = event.state;
		// no state: load the page directly from the browser
		if (!state) {
			window.location.href = document.location;
			return;
		}
		// get the target
		var target = null;
		var targetNode = null;
		if (state.target)
			targetNode = document.querySelector(target = state.target);
		if (!targetNode && this._target)
			targetNode = document.querySelector(target = this._target);
		if (!targetNode) {
			window.location.href = document.location;
			return;
		}
		// get the source node
		var source = state.hasOwnProperty("source") ? state.source : this._source;
		var asHTML = source ? true : false;
		var strategy = state.strategy ? state.strategy : vik._strategy;
		// fetch the page data
		vik.fetchGet(state.url, strategy, asHTML, function(content) {
			// write the content in the right place
			if (!asHTML) {
				targetNode.innerHTML = content;
			} else {
				// search the source node
				var srcNode = content.querySelector(source);
				if (!srcNode) {
					console.log("[VIK] Source selector '" + source + "' returns nothing.");
					return;
				}
				// strategy-based processing
				if (strategy == "copy") {
					// copy strategy
					targetNode.innerHTML = "";
					if (srcNode.childNodes) {
						while (srcNode.hasChildNodes())
							targetNode.appendChild(srcNode.firstChild);
					}
				} else if (strategy == "fill") {
					// "fill" strategy
					targetNode.innerHTML = "";
					targetNode.appendChild(srcNode);
				} else {
					// replace strategy
					targetNode.replaceWith(srcNode);
				}
			}
			// execute the "after" callbacks
			if (vik._postCallback)
				vik.execCallback(vik._postCallback);
			if (state.postCallback)
				vik.execCallback(state.postCallback);
		});
	};
};
