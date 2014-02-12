(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(factory);
    } 
    else if(typeof window === 'object') {
        var _loadCb;
        window.addEventListener('load', function() {
            root.Famous = factory();
            if(_loadCb) root.Famous(_loadCb);
        });
        root.Famous = function(cb) {
            _loadCb = cb;
        };
    }
    else {
        root.Famous = factory();
    }
}(this, function () {

/**
 * almond 0.2.6 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("lib/almond", function(){});


/*
 * classList.js: Cross-browser full element.classList implementation.
 * 2011-06-15
 *
 * By Eli Grey, http://eligrey.com
 * Public Domain.
 * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 */

/*global self, document, DOMException */

/*! @source http://purl.eligrey.com/github/classList.js/blob/master/classList.js*/

if (typeof document !== "undefined" && !("classList" in document.createElement("a"))) {

(function (view) {



var
	  classListProp = "classList"
	, protoProp = "prototype"
	, elemCtrProto = (view.HTMLElement || view.Element)[protoProp]
	, objCtr = Object
	, strTrim = String[protoProp].trim || function () {
		return this.replace(/^\s+|\s+$/g, "");
	}
	, arrIndexOf = Array[protoProp].indexOf || function (item) {
		var
			  i = 0
			, len = this.length
		;
		for (; i < len; i++) {
			if (i in this && this[i] === item) {
				return i;
			}
		}
		return -1;
	}
	// Vendors: please allow content code to instantiate DOMExceptions
	, DOMEx = function (type, message) {
		this.name = type;
		this.code = DOMException[type];
		this.message = message;
	}
	, checkTokenAndGetIndex = function (classList, token) {
		if (token === "") {
			throw new DOMEx(
				  "SYNTAX_ERR"
				, "An invalid or illegal string was specified"
			);
		}
		if (/\s/.test(token)) {
			throw new DOMEx(
				  "INVALID_CHARACTER_ERR"
				, "String contains an invalid character"
			);
		}
		return arrIndexOf.call(classList, token);
	}
	, ClassList = function (elem) {
		var
			  trimmedClasses = strTrim.call(elem.className)
			, classes = trimmedClasses ? trimmedClasses.split(/\s+/) : []
			, i = 0
			, len = classes.length
		;
		for (; i < len; i++) {
			this.push(classes[i]);
		}
		this._updateClassName = function () {
			elem.className = this.toString();
		};
	}
	, classListProto = ClassList[protoProp] = []
	, classListGetter = function () {
		return new ClassList(this);
	}
;
// Most DOMException implementations don't allow calling DOMException's toString()
// on non-DOMExceptions. Error's toString() is sufficient here.
DOMEx[protoProp] = Error[protoProp];
classListProto.item = function (i) {
	return this[i] || null;
};
classListProto.contains = function (token) {
	token += "";
	return checkTokenAndGetIndex(this, token) !== -1;
};
classListProto.add = function (token) {
	token += "";
	if (checkTokenAndGetIndex(this, token) === -1) {
		this.push(token);
		this._updateClassName();
	}
};
classListProto.remove = function (token) {
	token += "";
	var index = checkTokenAndGetIndex(this, token);
	if (index !== -1) {
		this.splice(index, 1);
		this._updateClassName();
	}
};
classListProto.toggle = function (token) {
	token += "";
	if (checkTokenAndGetIndex(this, token) === -1) {
		this.add(token);
	} else {
		this.remove(token);
	}
};
classListProto.toString = function () {
	return this.join(" ");
};

if (objCtr.defineProperty) {
	var classListPropDesc = {
		  get: classListGetter
		, enumerable: true
		, configurable: true
	};
	try {
		objCtr.defineProperty(elemCtrProto, classListProp, classListPropDesc);
	} catch (ex) { // IE 8 doesn't support enumerable:true
		if (ex.number === -0x7FF5EC54) {
			classListPropDesc.enumerable = false;
			objCtr.defineProperty(elemCtrProto, classListProp, classListPropDesc);
		}
	}
} else if (objCtr[protoProp].__defineGetter__) {
	elemCtrProto.__defineGetter__(classListProp, classListGetter);
}

}(self));

}
;
define("lib/classList", function(){});

if (!Function.prototype.bind) {
    Function.prototype.bind = function (oThis) {
        if (typeof this !== "function") {
            // closest thing possible to the ECMAScript 5 internal IsCallable function
            throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
        }

        var aArgs = Array.prototype.slice.call(arguments, 1), 
        fToBind = this, 
        fNOP = function () {},
        fBound = function () {
            return fToBind.apply(this instanceof fNOP && oThis
                ? this
                : oThis,
                aArgs.concat(Array.prototype.slice.call(arguments)));
        };

        fNOP.prototype = this.prototype;
        fBound.prototype = new fNOP();

        return fBound;
    };
}
;
define("lib/functionPrototypeBind", function(){});

// adds requestAnimationFrame functionality
// Source: http://strd6.com/2011/05/better-window-requestanimationframe-shim/

window.requestAnimationFrame || (window.requestAnimationFrame = 
  window.webkitRequestAnimationFrame || 
  window.mozRequestAnimationFrame    || 
  window.oRequestAnimationFrame      || 
  window.msRequestAnimationFrame     || 
  function(callback, element) {
    return window.setTimeout(function() {
      callback(+new Date());
  }, 1000 / 60);
});

define("lib/requestAnimationFrame", function(){});

define('famous/Entity',['require','exports','module'],function(require, exports, module) {
    var entities = [];

    function register(entity) {
        var id = entities.length;
        set(id, entity);
        return id;
    };

    function get(id) {
        return entities[id];
    };

    function set(id, entity) {
        entities[id] = entity;
    };

    module.exports = {
        register: register,
        get: get,
        set: set
    };
});

define('famous/Matrix',['require','exports','module'],function(require, exports, module) {
    /**
     * @namespace FamousMatrix
     * 
     * @description 
     *  * A high-performance matrix math library used to calculate 
     *   affine transforms on surfaces and other renderables.
     *   Famous uses 4x4 matrices corresponding directly to
     *   WebKit matrices (row-major order)
     *    
     *    The internal "type" of a FamousMatrix is a 16-long float array in 
     *    row-major order, with:
     *      * elements [0],[1],[2],[4],[5],[6],[8],[9],[10] forming the 3x3
     *          transformation matrix
     *      * elements [12], [13], [14] corresponding to the t_x, t_y, t_z 
     *          affine translation.
     *      * element [15] always set to 1.
     * 
     * Scope: Ideally, none of these functions should be visible below the 
     * component developer level.
     *
     * @static
     * 
     * @name FamousMatrix
     */
    var FamousMatrix = {};

    // WARNING: these matrices correspond to WebKit matrices, which are
    //    transposed from their math counterparts
    FamousMatrix.precision = 1e-6;
    FamousMatrix.identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    /**
     * Multiply two or more FamousMatrix types to return a FamousMatrix.
     *
     * @name FamousMatrix#multiply4x4
     * @function
     * @param {FamousMatrix} a left matrix
     * @param {FamousMatrix} b right matrix
     * @returns {FamousMatrix} the resulting matrix
     */
    FamousMatrix.multiply4x4 = function multiply4x4(a, b) {
        var result = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        result[0] = a[0] * b[0] + a[1] * b[4] + a[2] * b[8] + a[3] * b[12];
        result[1] = a[0] * b[1] + a[1] * b[5] + a[2] * b[9] + a[3] * b[13];
        result[2] = a[0] * b[2] + a[1] * b[6] + a[2] * b[10] + a[3] * b[14];
        result[3] = a[0] * b[3] + a[1] * b[7] + a[2] * b[11] + a[3] * b[15];
        result[4] = a[4] * b[0] + a[5] * b[4] + a[6] * b[8] + a[7] * b[12];
        result[5] = a[4] * b[1] + a[5] * b[5] + a[6] * b[9] + a[7] * b[13];
        result[6] = a[4] * b[2] + a[5] * b[6] + a[6] * b[10] + a[7] * b[14];
        result[7] = a[4] * b[3] + a[5] * b[7] + a[6] * b[11] + a[7] * b[15];
        result[8] = a[8] * b[0] + a[9] * b[4] + a[10] * b[8] + a[11] * b[12];
        result[9] = a[8] * b[1] + a[9] * b[5] + a[10] * b[9] + a[11] * b[13];
        result[10] = a[8] * b[2] + a[9] * b[6] + a[10] * b[10] + a[11] * b[14];
        result[11] = a[8] * b[3] + a[9] * b[7] + a[10] * b[11] + a[11] * b[15];
        result[12] = a[12] * b[0] + a[13] * b[4] + a[14] * b[8] + a[15] * b[12];
        result[13] = a[12] * b[1] + a[13] * b[5] + a[14] * b[9] + a[15] * b[13];
        result[14] = a[12] * b[2] + a[13] * b[6] + a[14] * b[10] + a[15] * b[14];
        result[15] = a[12] * b[3] + a[13] * b[7] + a[14] * b[11] + a[15] * b[15];
        if(arguments.length <= 2)  return result;
        else return multiply4x4.apply(null, [result].concat(Array.prototype.slice.call(arguments, 2)));
    };

    /**
     * Fast-multiply two or more FamousMatrix types to return a
     *    FamousMatrix, assuming right column on each is [0 0 0 1]^T.
     *    
     * @name FamousMatrix#multiply
     * @function
     * @param {FamousMatrix} a left matrix
     * @param {FamousMatrix} b right matrix
     * @param {...FamousMatrix} c additional matrices to be multiplied in 
     *    order
     * @returns {FamousMatrix} the resulting matrix
     */ 
    FamousMatrix.multiply = function multiply(a, b, c) {
        if(!a || !b) return a || b;
        var result = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
        result[0] = a[0] * b[0] + a[1] * b[4] + a[2] * b[8];
        result[1] = a[0] * b[1] + a[1] * b[5] + a[2] * b[9];
        result[2] = a[0] * b[2] + a[1] * b[6] + a[2] * b[10];
        result[4] = a[4] * b[0] + a[5] * b[4] + a[6] * b[8];
        result[5] = a[4] * b[1] + a[5] * b[5] + a[6] * b[9];
        result[6] = a[4] * b[2] + a[5] * b[6] + a[6] * b[10];
        result[8] = a[8] * b[0] + a[9] * b[4] + a[10] * b[8];
        result[9] = a[8] * b[1] + a[9] * b[5] + a[10] * b[9];
        result[10] = a[8] * b[2] + a[9] * b[6] + a[10] * b[10];
        result[12] = a[12] * b[0] + a[13] * b[4] + a[14] * b[8] + b[12];
        result[13] = a[12] * b[1] + a[13] * b[5] + a[14] * b[9] + b[13];
        result[14] = a[12] * b[2] + a[13] * b[6] + a[14] * b[10] + b[14];
        if(arguments.length <= 2)  return result;
        else return multiply.apply(null, [result].concat(Array.prototype.slice.call(arguments, 2)));
    };

    /**
     * Return a FamousMatrix translated by additional amounts in each
     *    dimension.
     *    
     * @name FamousMatrix#move
     * @function
     * @param {FamousMatrix} m a matrix
     * @param {Array.<number>} t delta vector (array of floats && 
     *    array.length == 2 || 3)
     * @returns {FamousMatrix} the resulting translated matrix
     */ 
    FamousMatrix.move = function(m, t) {
        if(!t[2]) t[2] = 0;
        return [m[0], m[1], m[2], 0, m[4], m[5], m[6], 0, m[8], m[9], m[10], 0, m[12] + t[0], m[13] + t[1], m[14] + t[2], 1];
    };

    /**
     * Return a FamousMatrix which represents the result of a transform matrix
     * applied after a move. This is faster than the equivalent multiply.
     * 
     * @name FamousMatrix#moveThen
     * @function
     *
     * @param {Array.number} v vector representing initial movement
     * @param {FamousMatrix} m matrix to apply afterwards
     * @returns {FamousMatrix} the resulting matrix
     */
    FamousMatrix.moveThen = function(v, m) {
        if(!v[2]) v[2] = 0;
        var t0 = v[0]*m[0] + v[1]*m[4] + v[2]*m[8];
        var t1 = v[0]*m[1] + v[1]*m[5] + v[2]*m[9];
        var t2 = v[0]*m[2] + v[1]*m[6] + v[2]*m[10];
        return FamousMatrix.move(m, [t0, t1, t2]);
    };

    /**
     * Return a FamousMatrix which represents a translation by specified
     *    amounts in each dimension.
     *    
     * @name FamousMatrix#translate
     * @function
     * @param {number} x x translation (delta_x)
     * @param {number} y y translation (delta_y)
     * @param {number} z z translation (delta_z)
     * @returns {FamousMatrix} the resulting matrix
     */ 
    FamousMatrix.translate = function(x, y, z) {
        if(z === undefined) z = 0;
        return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
    };

    /**
     * Return a FamousMatrix which represents a scale by specified amounts
     *    in each dimension.
     *    
     * @name FamousMatrix#scale
     * @function  
     *
     * @param {number} x x scale factor
     * @param {number} y y scale factor
     * @param {number} z z scale factor
     * @returns {FamousMatrix} the resulting matrix
     */ 
    FamousMatrix.scale = function(x, y, z) {
        if(z === undefined) z = 1;
        return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
    };

    /**
     * Return a FamousMatrix which represents a specified clockwise
     *    rotation around the x axis.
     *    
     * @name FamousMatrix#rotateX
     * @function
     *
     * @param {number} theta radians
     * @returns {FamousMatrix} the resulting matrix
     */ 
    FamousMatrix.rotateX = function(theta) {
        var cosTheta = Math.cos(theta);
        var sinTheta = Math.sin(theta);
        return [1, 0, 0, 0, 0, cosTheta, sinTheta, 0, 0, -sinTheta, cosTheta, 0, 0, 0, 0, 1];
    };

    /**
     * Return a FamousMatrix which represents a specified clockwise
     *    rotation around the y axis.
     *    
     * @name FamousMatrix#rotateY
     * @function
     *
     * @returns {FamousMatrix} the resulting matrix
     */ 
    FamousMatrix.rotateY = function(theta) {
        var cosTheta = Math.cos(theta);
        var sinTheta = Math.sin(theta);
        return [cosTheta, 0, -sinTheta, 0, 0, 1, 0, 0, sinTheta, 0, cosTheta, 0, 0, 0, 0, 1];
    };

    /**
     * Return a FamousMatrix which represents a specified clockwise
     *    rotation around the z axis.
     *    
     * @name FamousMatrix#rotateZ
     * @function
     *
     * @param {number} theta radians
     * @returns {FamousMatrix} the resulting matrix
     */ 
    FamousMatrix.rotateZ = function(theta) {
        var cosTheta = Math.cos(theta);
        var sinTheta = Math.sin(theta);
        return [cosTheta, sinTheta, 0, 0, -sinTheta, cosTheta, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    };

    /**
     * Return a FamousMatrix which represents composed clockwise
     *    rotations along each of the axes. Equivalent to the result of
     *    multiply(rotateX(phi), rotateY(theta), rotateZ(psi))
     *    
     * @name FamousMatrix#rotate
     * @function
     *
     * @param {number} phi radians to rotate about the positive x axis
     * @param {number} theta radians to rotate about the positive y axis
     * @param {number} psi radians to rotate about the positive z axis
     * @returns {FamousMatrix} the resulting matrix
     */ 
    FamousMatrix.rotate = function(phi, theta, psi) {
        var cosPhi = Math.cos(phi);
        var sinPhi = Math.sin(phi);
        var cosTheta = Math.cos(theta);
        var sinTheta = Math.sin(theta);
        var cosPsi = Math.cos(psi);
        var sinPsi = Math.sin(psi);
        var result = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
        result[0] = cosTheta * cosPsi;
        result[1] = cosPhi * sinPsi + sinPhi * sinTheta * cosPsi;
        result[2] = sinPhi * sinPsi - cosPhi * sinTheta * cosPsi;
        result[4] = -cosTheta * sinPsi;
        result[5] = cosPhi * cosPsi - sinPhi * sinTheta * sinPsi;
        result[6] = sinPhi * cosPsi + cosPhi * sinTheta * sinPsi;
        result[8] = sinTheta;
        result[9] = -sinPhi * cosTheta;
        result[10] = cosPhi * cosTheta;
        return result;
    };

    /**
     * Return a FamousMatrix which represents an axis-angle rotation
     *
     * @name FamousMatrix#rotateAxis
     * @function
     *
     * @param {Array.number} v unit vector representing the axis to rotate about
     * @param {number} theta radians to rotate clockwise about the axis
     * @returns {FamousMatrix} the resulting matrix
     */ 
    FamousMatrix.rotateAxis = function(v, theta) {
        var sinTheta = Math.sin(theta);
        var cosTheta = Math.cos(theta);
        var verTheta = 1 - cosTheta; // versine of theta

        var xxV = v[0]*v[0]*verTheta;
        var xyV = v[0]*v[1]*verTheta;
        var xzV = v[0]*v[2]*verTheta;
        var yyV = v[1]*v[1]*verTheta;
        var yzV = v[1]*v[2]*verTheta;
        var zzV = v[2]*v[2]*verTheta;
        var xs = v[0]*sinTheta;
        var ys = v[1]*sinTheta;
        var zs = v[2]*sinTheta;

        var result = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
        result[0] = xxV + cosTheta;
        result[1] = xyV + zs;
        result[2] = xzV - ys;
        result[4] = xyV - zs;
        result[5] = yyV + cosTheta;
        result[6] = yzV + xs;
        result[8] = xzV + ys;
        result[9] = yzV - xs;
        result[10] = zzV + cosTheta;
        return result;
    };

    /**
     * Return a FamousMatrix which represents a transform matrix applied about
     * a separate origin point.
     * 
     * @name FamousMatrix#aboutOrigin
     * @function
     *
     * @param {Array.number} v origin point to apply matrix
     * @param {FamousMatrix} m matrix to apply
     * @returns {FamousMatrix} the resulting matrix
     */
    FamousMatrix.aboutOrigin = function(v, m) {
        var t0 = v[0] - (v[0]*m[0] + v[1]*m[4] + v[2]*m[8]);
        var t1 = v[1] - (v[0]*m[1] + v[1]*m[5] + v[2]*m[9]);
        var t2 = v[2] - (v[0]*m[2] + v[1]*m[6] + v[2]*m[10]);
        return FamousMatrix.move(m, [t0, t1, t2]);
    };

    /**
     * Return a FamousMatrix's webkit css representation to be used with the
     *    CSS3 -webkit-transform style. 
     * @example: -webkit-transform: matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,716,243,0,1)
     *
     * @name FamousMatrix#formatCSS
     * @function
     * 
     * @param {FamousMatrix} m a Famous matrix
     * @returns {string} matrix3d CSS style representation of the transform
     */ 
    FamousMatrix.formatCSS = function(m) {
        var n = m.slice(0);
        for(var i = 0; i < n.length; i++) if(n[i] < 0.000001 && n[i] > -0.000001) n[i] = 0;
        return 'matrix3d(' + n.join() + ')';
    };

    /**
     * Return a FamousMatrix representatikon of a skew transformation
     *
     * @name FamousMatrix#skew
     * @function
     * 
     * @param {number} psi radians skewed about the yz plane
     * @param {number} theta radians skewed about the xz plane
     * @param {number} phi radians skewed about the xy plane
     * @returns {FamousMatrix} the resulting matrix
     */ 
    FamousMatrix.skew = function(phi, theta, psi) {
        return [1, 0, 0, 0, Math.tan(psi), 1, 0, 0, Math.tan(theta), Math.tan(phi), 1, 0, 0, 0, 0, 1];
    };

    /**
     * Return translation vector component of given FamousMatrix
     * 
     * @name FamousMatrix#getTranslate
     * @function
     *
     * @param {FamousMatrix} m matrix
     * @returns {Array.<number>} the translation vector [t_x, t_y, t_z]
     */ 
    FamousMatrix.getTranslate = function(m) {
        return [m[12], m[13], m[14]];
    };

    /**
     * Return inverse affine matrix for given FamousMatrix. 
     * Note: This assumes m[3] = m[7] = m[11] = 0, and m[15] = 1. 
     *       Incorrect results if not invertable or preconditions not met.
     *
     * @name FamousMatrix#inverse
     * @function
     * 
     * @param {FamousMatrix} m matrix
     * @returns {FamousMatrix} the resulting inverted matrix
     */ 
    FamousMatrix.inverse = function(m) {
        var result = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
        // only need to consider 3x3 section for affine
        var c0 = m[5]*m[10] - m[6]*m[9];
        var c1 = m[4]*m[10] - m[6]*m[8];
        var c2 = m[4]*m[9] - m[5]*m[8];
        var c4 = m[1]*m[10] - m[2]*m[9];
        var c5 = m[0]*m[10] - m[2]*m[8];
        var c6 = m[0]*m[9] - m[1]*m[8];
        var c8 = m[1]*m[6] - m[2]*m[5];
        var c9 = m[0]*m[6] - m[2]*m[4];
        var c10 = m[0]*m[5] - m[1]*m[4];
        var detM = m[0]*c0 - m[1]*c1 + m[2]*c2;
        var invD = 1/detM;
        result[0] = invD * c0;
        result[1] = -invD * c4;
        result[2] = invD * c8;
        result[4] = -invD * c1;
        result[5] = invD * c5;
        result[6] = -invD * c9;
        result[8] = invD * c2;
        result[9] = -invD * c6;
        result[10] = invD * c10;
        result[12] = -m[12]*result[0] - m[13]*result[4] - m[14]*result[8];
        result[13] = -m[12]*result[1] - m[13]*result[5] - m[14]*result[9];
        result[14] = -m[12]*result[2] - m[13]*result[6] - m[14]*result[10];
        return result;
    };

    /**
     * Decompose FamousMatrix into separate .translate, .rotate, .scale,
     *    .skew components.
     *    
     * @name FamousMatrix#interpret
     * @function
     *
     * @param {FamousMatrix} M matrix
     * @returns {matrixSpec} object with component matrices .translate,
     *    .rotate, .scale, .skew
     */ 
    FamousMatrix.interpret = function(M) {

        // QR decomposition via Householder reflections

        function normSquared(v){
            if (v.length == 2)
                return v[0]*v[0] + v[1]*v[1];
            else
                return v[0]*v[0] + v[1]*v[1] + v[2]*v[2];
        };

        function norm(v){
            return Math.sqrt(normSquared(v));
        };

        function sign(n){
            return (n < 0) ? -1 : 1;
        };


        //FIRST ITERATION

        //default Q1 to the identity matrix;
        var x = [M[0], M[1], M[2]];                 // first column vector
        var sgn = sign(x[0]);                       // sign of first component of x (for stability)
        var xNorm = norm(x);                       // norm of first column vector
        var v = [x[0] + sgn * xNorm, x[1], x[2]];  // v = x + sign(x[0])|x|e1
        var mult = 2 / normSquared(v);              // mult = 2/v'v

        //evaluate Q1 = I - 2vv'/v'v
        var Q1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];

        //diagonals
        Q1[0]  = 1 - mult * v[0] * v[0];    // 0,0 entry
        Q1[5]  = 1 - mult * v[1] * v[1];    // 1,1 entry
        Q1[10] = 1 - mult * v[2] * v[2];    // 2,2 entry

        //upper diagonal
        Q1[1] = -mult * v[0] * v[1];        // 0,1 entry
        Q1[2] = -mult * v[0] * v[2];        // 0,2 entry
        Q1[6] = -mult * v[1] * v[2];        // 1,2 entry

        //lower diagonal
        Q1[4] = Q1[1];                      // 1,0 entry
        Q1[8] = Q1[2];                      // 2,0 entry
        Q1[9] = Q1[6];                      // 2,1 entry

        //reduce first column of M
        var MQ1 = FamousMatrix.multiply(M, Q1);


        //SECOND ITERATION on (1,1) minor
        var x2 = [MQ1[5], MQ1[6]];
        var sgn2 = sign(x2[0]);                              // sign of first component of x (for stability)
        var x2Norm = norm(x2);                              // norm of first column vector
        var v2 = [x2[0] + sgn2 * x2Norm, x2[1]];            // v = x + sign(x[0])|x|e1
        var mult2 = 2 / normSquared(v2);                     // mult = 2/v'v

        //evaluate Q2 = I - 2vv'/v'v
        var Q2 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];

        //diagonal
        Q2[5]  = 1 - mult2 * v2[0] * v2[0]; // 1,1 entry
        Q2[10] = 1 - mult2 * v2[1] * v2[1]; // 2,2 entry

        //off diagonals
        Q2[6] = -mult2 * v2[0] * v2[1];     // 2,1 entry
        Q2[9] = Q2[6];                      // 1,2 entry


        //calc QR decomposition. Q = Q1*Q2, R = Q'*M
        var Q = FamousMatrix.multiply(Q1, Q2);              //note: really Q transpose
        var R = FamousMatrix.multiply(M, Q);

        //remove negative scaling
        var remover = FamousMatrix.scale(R[0] < 0 ? -1 : 1, R[5] < 0 ? -1 : 1, R[10] < 0 ? -1 : 1);
        R = FamousMatrix.multiply(remover, R);
        Q = FamousMatrix.multiply(Q, remover);

        //decompose into rotate/scale/skew matrices
        var result = {};
        result.translate = FamousMatrix.getTranslate(M);
        result.rotate = [Math.atan2(-Q[6], Q[10]), Math.asin(Q[2]), Math.atan2(-Q[1], Q[0])];
        if(!result.rotate[0]) {
            result.rotate[0] = 0;
            result.rotate[2] = Math.atan2(Q[4], Q[5]);
        }
        result.scale = [R[0], R[5], R[10]];
        result.skew = [Math.atan(R[9]/result.scale[2]), Math.atan(R[8]/result.scale[2]), Math.atan(R[4]/result.scale[0])];

        //double rotation workaround
        if(Math.abs(result.rotate[0]) + Math.abs(result.rotate[2]) > 1.5*Math.PI) {
            result.rotate[1] = Math.PI - result.rotate[1];
            if(result.rotate[1] > Math.PI) result.rotate[1] -= 2*Math.PI;
            if(result.rotate[1] < -Math.PI) result.rotate[1] += 2*Math.PI;
            if(result.rotate[0] < 0) result.rotate[0] += Math.PI;
            else result.rotate[0] -= Math.PI;
            if(result.rotate[2] < 0) result.rotate[2] += Math.PI;
            else result.rotate[2] -= Math.PI;
        }   

        return result;

    };

    /**
     * Compose .translate, .rotate, .scale, .skew components into into
     *    FamousMatrix
     *    
     * @name FamousMatrix#build
     * @function
     *
     * @param {matrixSpec} spec object with component matrices .translate,
     *    .rotate, .scale, .skew
     * @returns {FamousMatrix} composed martix
     */ 
    FamousMatrix.build = function(spec) {
        var scaleMatrix = FamousMatrix.scale(spec.scale[0], spec.scale[1], spec.scale[2]);
        var skewMatrix = FamousMatrix.skew(spec.skew[0], spec.skew[1], spec.skew[2]);
        var rotateMatrix = FamousMatrix.rotate(spec.rotate[0], spec.rotate[1], spec.rotate[2]);
        return FamousMatrix.move(FamousMatrix.multiply(scaleMatrix, skewMatrix, rotateMatrix), spec.translate);
    };

    /**
     * Determine if two FamousMatrixes are component-wise equal
     * 
     * @name FamousMatrix#equals
     * @function
     * 
     * @param {FamousMatrix} a matrix
     * @param {FamousMatrix} b matrix
     * @returns {boolean} 
     */ 
    FamousMatrix.equals = function(a, b) {
        if(a === b) return true;
        if(!a || !b) return false;
        for(var i = 0; i < a.length; i++) if(a[i] != b[i]) return false;
        return true;
    };

    /**
     * Constrain angle-trio components to range of [-pi, pi).
     *
     * @name FamousMatrix#normalizeRotation
     * @function
     * 
     * @param {Array.<number>} rotation phi, theta, psi (array of floats 
     *    && array.length == 3)
     * @returns {Array.<number>} new phi, theta, psi triplet
     *    (array of floats && array.length == 3)
     */ 
    FamousMatrix.normalizeRotation = function(rotation) {
        var result = rotation.slice(0);
        if(result[0] == Math.PI/2 || result[0] == -Math.PI/2) {
            result[0] = -result[0];
            result[1] = Math.PI - result[1];
            result[2] -= Math.PI;
        }
        if(result[0] > Math.PI/2) {
            result[0] = result[0] - Math.PI;
            result[1] = Math.PI - result[1];
            result[2] -= Math.PI;
        }
        if(result[0] < -Math.PI/2) {
            result[0] = result[0] + Math.PI;
            result[1] = -Math.PI - result[1];
            result[2] -= Math.PI;
        }
        while(result[1] < -Math.PI) result[1] += 2*Math.PI;
        while(result[1] >= Math.PI) result[1] -= 2*Math.PI;
        while(result[2] < -Math.PI) result[2] += 2*Math.PI;
        while(result[2] >= Math.PI) result[2] -= 2*Math.PI;
        return result;
    };

    /**
     * Transform vector by a matrix, through right-multiplying by matrix.
     * 
     * @name FamousMatrix#vecMultiply
     * @function
     *
     * @param {Array.<number>} vec x,y,z vector 
     *    (array of floats && array.length == 3)
     * @param {FamousMatrix} m matrix
     * @returns {Array.<number>} the resulting vector
     *    (array of floats && array.length == 3)
     */ 
    FamousMatrix.vecMultiply = function(vec, m) {
        return [
            vec[0]*m[0] + vec[1]*m[4] + vec[2]*m[8] + m[12],
            vec[0]*m[1] + vec[1]*m[5] + vec[2]*m[9] + m[13],
            vec[0]*m[2] + vec[1]*m[6] + vec[2]*m[10] + m[14]
        ];
    };

    /** 
     * Apply visual perspective factor p to vector.
     *
     * @name FamousMatrix#applyPerspective
     * @function
     * @param {Array.<number>} vec x,y,z vector (array of floats && array.length == 3)
     * @param {number} p perspective factor
     * @returns {Array.<number>} the resulting x,y vector (array of floats 
     *    && array.length == 2)
     */
    FamousMatrix.applyPerspective = function(vec, p) {
        var scale = p/(p - vec[2]);
        return [scale * vec[0], scale * vec[1]];
    };

    module.exports = FamousMatrix;
});

define('famous/SpecParser',['require','exports','module','./Matrix'],function(require, exports, module) {
    var FM = require('./Matrix');

    /**
     * @class This object translates the the rendering instructions of type 
     *   {@link renderSpec} that {@link renderableComponent} objects generate 
     *   into direct document update instructions of type {@link updateSpec} 
     *   for the {@link SurfaceManager}.
     * 
     * @description 
     *   Scope: The {@link renderSpec} should be visible to component developers
     *   and deeper.  However, SpecParser This should not be visible below the 
     *   level of device developer.
     *
     * @name SpecParser
     * @constructor
     * 
     * @example 
     *   var parsedSpec = SpecParser.parse(spec);
     *   this.surfaceManager.update(parsedSpec);
     */
    function SpecParser() {
        this.reset();
    };

    /**
     * Convert a {@link renderSpec} coming from the context's render chain to an
     *    update spec for the update chain. This is the only major entrypoint
     *    for a consumer of this class. An optional callback of signature
     *    "function({@link updateSpec})" can be provided for call upon parse
     *    completion.
     *    
     * @name SpecParser#parse
     * @function
     * @static
     * 
     * @param {renderSpec} spec input render spec
     * @param {function(Object)} callback updateSpec-accepting function for 
     *   call on  completion
     * @returns {updateSpec} the resulting update spec (if no callback 
     *   specified, else none)
     */
    SpecParser.parse = function(spec, callback) {
        var sp = new SpecParser();
        var result = sp.parse(spec);
        if(callback) callback(result);
        else return result;
    };

    /**
     * Convert a renderSpec coming from the context's render chain to an update
     *    spec for the update chain. This is the only major entrypoint for a
     *    consumer of this class.
     *    
     * @name SpecParser#parse
     * @function
     * 
     * @param {renderSpec} spec input render spec
     * @returns {updateSpec} the resulting update spec
     */
    SpecParser.prototype.parse = function(spec) {
        this.reset();
        this._parseSpec(spec, FM.identity, 1, [0, 0], undefined, FM.identity);
        return this.result;
    };

    /**
     * Prepare SpecParser for re-use (or first use) by setting internal state 
     *  to blank.
     *    
     * @name SpecParser#reset
     * @function
     */
    SpecParser.prototype.reset = function() {
        this.result = {};
    };

    /**
     * Transforms a delta vector to apply inside the context of another transform
     *
     * @name _vecInContext
     * @function
     * @private
     *
     * @param {Array.number} vector to apply
     * @param {FamousMatrix} matrix context 
     * @returns {Array.number} transformed delta vector
     */
    function _vecInContext(v, m) {
        return [
            v[0]*m[0] + v[1]*m[4] + v[2]*m[8],
            v[0]*m[1] + v[1]*m[5] + v[2]*m[9],
            v[0]*m[2] + v[1]*m[6] + v[2]*m[10]
        ];
    };

    /**
     * From the provided renderSpec tree, recursively compose opacities,
     *    origins, transforms, and groups corresponding to each surface id from
     *    the provided renderSpec tree structure. On completion, those
     *    properties of 'this' object should be ready to use to build an
     *    updateSpec.
     *    
     *    
     * @name SpecParser#_parseSpec
     * @function
     * @private
     * 
     * @param {renderSpec} spec input render spec for a node in the render tree.
     * @param {number|undefined} group group id to apply to this subtree
     * @param {FamousMatrix} parentTransform positional transform to apply to
     *    this subtree.
     * @param {origin=} parentOrigin origin behavior to apply to this subtree
     */
    SpecParser.prototype._parseSpec = function(spec, parentTransform, parentOpacity, parentOrigin, parentSize, sizeCtx) {
        if(spec == undefined) {
            // do nothing
        }
        else if(typeof spec == 'number') {
            var id = spec;
            var originAdjust = parentSize ? [parentOrigin[0]*parentSize[0], parentOrigin[1]*parentSize[1], 0] : [0, 0, 0];
            if(!parentTransform) parentTransform = FM.identity;
            this.result[id] = [
                FM.move(parentTransform, _vecInContext(originAdjust, sizeCtx)),
                parentOpacity,
                parentOrigin,
                parentSize
            ]; // transform, opacity, origin, size
        }
        else if(spec instanceof Array) {
            for(var i = 0; i < spec.length; i++) {
                this._parseSpec(spec[i], parentTransform, parentOpacity, parentOrigin, parentSize, sizeCtx);
            }
        }
        else if(spec.target !== undefined) {
            var target = spec.target;
            var transform = parentTransform;
            var opacity = parentOpacity;
            var origin = parentOrigin;
            var size = parentSize;

            if(spec.opacity !== undefined) opacity = parentOpacity * spec.opacity;
            if(spec.transform) transform = FM.multiply(spec.transform, parentTransform);
            if(spec.origin) origin = spec.origin;
            if(spec.size) {
                size = spec.size;
                if(size[0] === undefined) size[0] = parentSize[0];
                if(size[1] === undefined) size[1] = parentSize[1];
                if(!parentSize) parentSize = size;
                if(!origin) origin = [0, 0];
                if(!transform) transform = FM.identity;
                transform = FM.move(transform, _vecInContext([origin[0]*parentSize[0], origin[1]*parentSize[1], 0], sizeCtx));
                transform = FM.moveThen([-origin[0]*size[0], -origin[1]*size[1], 0], transform);
                sizeCtx = parentTransform ? parentTransform : FM.identity;
                origin = [0, 0];
            }

            this._parseSpec(target, transform, opacity, origin, size, sizeCtx);
        }
    };

    module.exports = SpecParser;
});

define('famous/RenderNode',['require','exports','module','./Entity','./SpecParser','./Matrix'],function(require, exports, module) {
    var Entity = require('./Entity');
    var SpecParser = require('./SpecParser');
    var FM = require('./Matrix');
    
    /**
     * @class A linked list objectect wrapping a
     *   {@link renderableComponent} (like a {@link FamousTransform} or 
     *   {@link FamousSurface}) for insertion into the render tree.
     * 
     * @description Note that class may be removed in the near future.
     * 
     * Scope: Ideally, RenderNode should not be visible below the level
     * of component developer.
     *
     * @name RenderNode
     * @constructor
     * 
     * @example  < This should not be used by component engineers >
     * 
     * @param {renderableComponent} object Target render()able component 
     */
    function RenderNode(object) {
        this.modifiers = [];
        this.object = undefined;
        if(object) this.set(object);

        this._hasCached = false;
        this._resultCache = {};
        this._prevResults = {};
    };

    /**
     * Get the wrapped {@link renderableComponent}
     * 
     * @name RenderNode#get
     * @function
     *
     * @returns {renderableComponent} 
     */
    RenderNode.prototype.get = function() {
        return this.object;
    };

    /**
     * Set the wrapped (@link renderableComponent}
     *
     * @name RenderNode#set
     * @function
     */
    RenderNode.prototype.set = function(object) {
        this.object = object;
    };

    /**
     * Declare that content for the wrapped renderableComponent will come link
     *    the provided renderableComponent, effectively adding the provided
     *    component to the render tree.
     *
     * Note: syntactic sugar
     * 
     * @name RenderNode#link
     * @function
     *    
     * @returns {RenderNode} this render node
     */
    RenderNode.prototype.link = function(object) {
        if(object instanceof Array) this.set(object);
        else {
            var currentObject = this.get();
            if(currentObject) {
                if(currentObject instanceof Array) {
                    this.modifiers.unshift(object);
                }
                else {
                    this.modifiers.unshift(currentObject);
                    this.set(object);
                }
            }
            else {
                this.set(object);
            }
        }
        return this;
    };

    /**
     * Add an object to the set of objects rendered
     *
     * Note: syntactic sugar
     *
     * @name RenderNode#add
     * @function
     * 
     * @param {renderableComponent} object renderable to add
     * @returns {RenderNode} render node representing added branch
     */
    RenderNode.prototype.add = function(object) {
        if(!(this.get() instanceof Array)) this.set([]);
        var node = new RenderNode(object);
        this.get().push(node);
        return node;
    };

    /**
     * Adds a modifier to the chain
     *
     * Note: syntactic sugar
     *
     * @deprecated
     * 
     * @name RenderNode#mod
     * @function
     *
     * @returns [RenderNode} this render node
     */
    RenderNode.prototype.mod = function(object) {
        this.modifiers.push(object);
        return this;
    };

    RenderNode.prototype.commit = function(context, transform, opacity, origin, size) {
        var renderResult = this.render(undefined, this._hasCached);

        if(renderResult !== true) {
            // free up some divs from the last loop
            for(var i in this._prevResults) {
                if(!(i in this._resultCache)) {
                    var object = Entity.get(i);
                    if(object.cleanup) object.cleanup(context.getAllocator());
                }
            }

            this._prevResults = this._resultCache;
            this._resultCache = {};
            _applyCommit({
                transform: transform,
                size: size,
                origin: origin,
                opacity: opacity,
                target: renderResult
            }, context, this._resultCache);

            this._hasCached = true;
        }
    };

    function _applyCommit(spec, context, cacheStorage) {
        var result = SpecParser.parse(spec);
        for(var i in result) {
            var childNode = Entity.get(i);
            var commitParams = result[i];
            commitParams.unshift(context);
            var commitResult = childNode.commit.apply(childNode, commitParams);
            if(commitResult) _applyCommit(commitResult, context, cacheStorage);
            else cacheStorage[i] = commitParams;
        }
    };

    /**
     * Render the component wrapped directly by this node.
     * 
     * @name RenderNode#render
     * @function
     * 
     * @returns {renderSpec} render specification for the component subtree 
     *    only under this node.
     */
    RenderNode.prototype.render = function(input) {
        var result = input;
        var object = this.get();
        if(object) {
            if(object.render) result = object.render(input);
            else {
                var i = object.length - 1;
                result = new Array(i);
                while(i >= 0) {
                    result[i] = object[i].render();
                    i--;
                }
            }
        }
        var modifierCount = this.modifiers.length;
        for(var i = 0; i < modifierCount; i++) {
            result = this.modifiers[i].render(result);
        }
        return result;
    };

    module.exports = RenderNode;
});

define('famous/EventHandler',['require','exports','module'],function(require, exports, module) {
   
    /**
     * @class This object gives the user the opportunity to explicitly 
     *   control event propagation in their application.
     * @description FamousEventHandler forwards received events to a set of 
     *   provided callback functions.  It allows events to be either piped
     *   through to other layers of {@link FamousEventHandler} objects
     *   or "captured" at this layer (and not forwarded).
     *
     * @name FamousEventHandler
     * @constructor
     * @struct
     * 
     * @example
     *    var eventArbiter = new FamousEventArbiter(PAGES.COVER);
     *    var coverHandler = eventArbiter.forMode(PAGES.COVER);
     *    coverHandler.on('my_event', function(event) { 
     *      document.title = 'Cover'; 
     *    });
     *    var overviewHandler = eventArbiter.forMode(PAGES.OVERVIEW)
     *    overviewHandler.on('my_event', function(event) { 
     *      document.title = 'Overview'; 
     *    });
     *  
     *    function loadPage(page) {
     *      eventArbiter.setMode(page);
     *      eventArbiter.emit('my_event', {data: 123})
     *    };
     *
     *    loadPage(PAGES.COVER);
     * 
     */
    function FamousEventHandler() {
        this.listeners = {};
        this.downstream = []; // downstream event handlers
        this.downstreamFn = []; // downstream functions
        this.owner = this;
    };

    /**
     * Send event data to all handlers matching provided 'type' key. If handler 
     *    is not set to "capture", pass on to any next handlers also. Event's 
     *    "origin" field is set to this object if not yet set.
     *
     * @name FamousEventHandler#emit
     * @function
     * @param {string} type event type key (for example, 'click')
     * @param {Object} event received event data
     * @returns {boolean} true if this event has been handled by any handler
     */
    FamousEventHandler.prototype.emit = function(type, event) {
        if(!event) event = {};

        var handlers = this.listeners[type];
        var handled = false;
        if(handlers) {
            for(var i = 0; i < handlers.length; i++) {
                if(handlers[i].call(this.owner, event)) handled = true;
            }
        }

        return _emitNext.call(this, type, event) || handled;
    };

    /**
     * Send event data to downstream handlers responding to this event type.
     *
     * @name _emitNext
     * @function
     * @private
     * @param {string} type event type key (for example, 'click')
     * @param {Object} event received event data
     * @returns {boolean} true if this event has been handled by any 
     *   downstream handler
     */
    function _emitNext(type, event) {
        var handled = false;
        for(var i = 0; i < this.downstream.length; i++) {
            handled = this.downstream[i].emit(type, event) || handled;
        }
        for(var i = 0; i < this.downstreamFn.length; i++) {
            handled = this.downstreamFn[i](type, event) || handled;
        }
        return handled;
    };

    /**
     * Add handler function to set of callback functions for the provided 
     *   event type.  
     *   The handler will receive the original emitted event data object
     *   as its sole argument.
     * 
     * @name FamousEventHandler#on
     * @function
     * @param  {string} type event type key (for example, 'click')
     * @param  {function(string, Object)} handler handler function
     * @returns {FamousEventHandler} this
     */
    FamousEventHandler.prototype.on = function(type, handler) {
        // debugger
        if(!this.listeners[type]) this.listeners[type] = [];
        var index = this.listeners[type].indexOf(handler);
        if(index < 0) this.listeners[type].push(handler);
        return this;
    };

    /**
     * Remove handler function from set of callback functions for the provided 
     *   event type. 
     * Undoes work of {@link EventHandler#on}
     * 
     * @name FamousEventHandler#unbind
     * @function
     * @param  {string} type event type key (for example, 'click')
     * @param  {function(string, Object)} handler
     */
    FamousEventHandler.prototype.unbind = function(type, handler) {
        var index = this.listeners[type].indexOf(handler);
        if(index >= 0) this.listeners[type].splice(index, 1);
    };

    /** 
     * Add handler object to set of DOWNSTREAM handlers.
     * 
     * @name FamousEventHandler#pipe
     * @function
     * @param {emitterObject} target target emitter object
     */
    FamousEventHandler.prototype.pipe = function(target) {
        var downstreamCtx = (target instanceof Function) ? this.downstreamFn : this.downstream;
        var index = downstreamCtx.indexOf(target);
        if(index < 0) downstreamCtx.push(target);

        if(target instanceof Function) target('pipe');
        else target.emit('pipe');

        return target;
    };

    /**
     * Remove handler object from set of DOWNSTREAM handlers.
     * Undoes work of {@link EventHandler#pipe}
     * 
     * @name FamousEventHandler#unpipe
     * @function
     * @param {emitterObject} target target emitter object
     */
    FamousEventHandler.prototype.unpipe = function(target) {
        var downstreamCtx = (target instanceof Function) ? this.downstreamFn : this.downstream;
        var index = downstreamCtx.indexOf(target);
        if(index >= 0) {
            downstreamCtx.splice(index, 1);
            if(target instanceof Function) target('unpipe');
            else target.emit('unpipe');
            return target;
        }
        else return false;
    };

    /**
     * Call event handlers with this set to owner
     *
     * @name FamousEventHandler#bindThis
     * @function
     * @param {Object} owner object this EventHandler belongs to
     */
    FamousEventHandler.prototype.bindThis = function(owner) {
        this.owner = owner;
    };

    /**
     * Assign an event handler to receive an object's events
     *
     * @name FamousEventHandler#setInputHandler
     * @static
     * @function
     * @param {Object} object object to mix in emit function
     * @param {emitterObject} handler assigned event handler
     */
    FamousEventHandler.setInputHandler = function(object, handler) {
        object.emit = handler.emit.bind(handler);
    };

    /**
     * Assign an event handler to emit an object's events
     *
     * @name FamousEventHandler#setOutputHandler
     * @static
     * @function
     * @param {Object} object object to mix in pipe/unpipe/on/unbind functions
     * @param {emitterObject} handler assigned event emitter
     */
    FamousEventHandler.setOutputHandler = function(object, handler) {
        if(handler instanceof FamousEventHandler) handler.bindThis(object);
        object.pipe = handler.pipe.bind(handler);
        object.unpipe = handler.unpipe.bind(handler);
        object.on = handler.on.bind(handler);
        object.unbind = handler.unbind.bind(handler);
    };

    module.exports = FamousEventHandler;
});

define('famous/ElementAllocator',['require','exports','module'],function(require, exports, module) {
    function ElementAllocator(container) {
        if(!container) container = document.createDocumentFragment();
        this.container = container;
        this.detachedNodes = {};
        this.nodeCount = 0;
    };

    ElementAllocator.prototype.migrate = function(container) {
        var oldContainer = this.container;
        if(container === oldContainer) return;

        if(oldContainer instanceof DocumentFragment) {
            container.appendChild(oldContainer);
        }
        else {
            while(oldContainer.hasChildNodes()) {
                container.appendChild(oldContainer.removeChild(oldContainer.firstChild));
            }
        }

        this.container = container;
    };

    ElementAllocator.prototype.allocate = function(type) {
        type = type.toLowerCase();
        if(!(type in this.detachedNodes)) this.detachedNodes[type] = [];
        var nodeStore = this.detachedNodes[type];
        var result;
        if(nodeStore.length > 0) {
            result = nodeStore.pop();
        }
        else {
            result = document.createElement(type);
            this.container.appendChild(result);
        }
        this.nodeCount++;
        return result;
    };

    ElementAllocator.prototype.deallocate = function(element) {
        var nodeType = element.nodeName.toLowerCase();
        var nodeStore = this.detachedNodes[nodeType];
        nodeStore.push(element);
        this.nodeCount--;
    };

    ElementAllocator.prototype.getNodeCount = function() {
        return this.nodeCount;
    };

    module.exports = ElementAllocator;
});

define('famous/Utility',['require','exports','module'],function(require, exports, module) {
    /**
     * @namespace Utility
     * 
     * @description This namespace holds standalone functionality. 
     *    Currently includes 
     *    name mapping for transition curves, name mapping for origin 
     *    pairs, and the after() function.
     *    
     * @static
     * @name Utility
     */
    var Utility = {};

    /**
     * Transition curves mapping independent variable t from domain [0,1] to a
     *    range within [0,1]. Includes functions 'linear', 'easeIn', 'easeOut',
     *    'easeInOut', 'easeOutBounce', 'spring'.
     *    
     * @name Utility#curves
     * @field
     */
    Utility.Curve = {
        linear: function(t) { return t; },
        easeIn: function(t) { return t*t; },
        easeOut: function(t) { return t*(2-t); },
        easeInOut: function(t) {
            if(t <= 0.5) return 2*t*t;
            else return -2*t*t + 4*t - 1;
        },
        easeOutBounce: function(t) { return t*(3 - 2*t); },
        spring: function(t) { return (1 - t) * Math.sin(6 * Math.PI * t) + t; }
    };

    Utility.Direction = {
        X: 0,
        Y: 1,
        Z: 2
    };

    /**
     * Table of strings mapping origin string types to origin pairs. Includes
     *    concepts of center and combinations of top, left, bottom, right, as
     *    'tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br'.
     *    
     * @name Utility#origins
     * @field
     */
    Utility.Origin = {
        'tl': [0, 0],
        't': [0.5, 0],
        'tr': [1, 0],
        'l': [0, 0.5],
        'c': [0.5, 0.5],
        'r': [1, 0.5],
        'bl': [0, 1],
        'b': [0.5, 1],
        'br': [1, 1]
    };

    /** 
     * Return wrapper around callback function. Once the wrapper is called N
     *    times, invoke the callback function. Arguments and scope preserved.
     *    
     * @name Utility#after
     * @function 
     * @param {number} count number of calls before callback function invoked
     * @param {Function} callback wrapped callback function
     */
    Utility.after = function(count, callback) {
        var counter = count;
        return function() {
            counter--;
            if(counter === 0) callback.apply(this, arguments);
        };
    };

    /**
     * Load a URL and return its contents in a callback
     * 
     * @name Utility#loadURL
     * @function
     * @param {string} url URL of object
     * @param {function} callback callback to dispatch with content
     */
    Utility.loadURL = function(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if(this.readyState == 4) {
                if(callback) callback(this.responseText);
            }
        };
        xhr.open('GET', url);
        xhr.send();
    };

    /** @const */ Utility.transformInFrontMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1];
    Utility.transformInFront = {
        render: function(input) {
            return {transform: Utility.transformInFrontMatrix, target: input};
        }
    };

    /** @const */ Utility.transformBehindMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1, 1];
    Utility.transformBehind = {
        render: function(input) {
            return {transform: Utility.transformBehindMatrix, target: input};
        }
    };

    /**
     * Create a new component based on an existing component configured with custom options
     *
     * @name Utility#customizeComponent
     * @function
     * @param {Object} component Base component class
     * @param {Object} customOptions Options to apply
     * @param {function} initialize Initialization function to run on creation
     * @returns {Object} customized component
     */
    Utility.customizeComponent = function(component, customOptions, initialize) {
        var result = function(options) {
            component.call(this, customOptions);
            if(options) this.setOptions(options);
            if(initialize) initialize.call(this);
        };
        result.prototype = Object.create(component.prototype);
        return result;
    };


    module.exports = Utility;
});

define('famous/MultipleTransition',['require','exports','module','./Utility'],function(require, exports, module) {
    var Utility = require('./Utility');

    /**
     * @class Multiple value transition method
     * @description Transition meta-method to support transitioning multiple 
     *   values with scalar-only methods
     *
     * @name MultipleTransition
     * @constructor
     *
     * @param {Object} method Transionable class to multiplex
     */
    function MultipleTransition(method) {
        this.method = method;
        this._instances = [];
        this.state = [];
    };

    MultipleTransition.SUPPORTS_MULTIPLE = true;

    MultipleTransition.prototype.get = function() {
        for(var i = 0; i < this._instances.length; i++) {
            this.state[i] = this._instances[i].get();
        }
        return this.state;
    };

    MultipleTransition.prototype.set = function(endState, transition, callback) {
        var _allCallback = Utility.after(endState.length, callback)
        for(var i = 0; i < endState.length; i++) {
            if(!this._instances[i]) this._instances[i] = new (this.method)();
            this._instances[i].set(endState[i], transition, _allCallback);
        }
    };

    MultipleTransition.prototype.reset = function(startState) {
        for(var i = 0; i < startState.length; i++) {
            if(!this._instances[i]) this._instances[i] = new (this.method)();
            this._instances[i].reset(startState[i]);
        }
    };

    module.exports = MultipleTransition;
});

define('famous/TweenTransition',['require','exports','module','famous/Utility'],function(require, exports, module) {
    var Utility = require('famous/Utility');

    /**
     *
     * @class A state maintainer for a smooth transition between 
     *    numerically-specified states. 
     *
     * @description  Example numeric states include floats or
     *    {@link FamousMatrix} objects. TweenTransitions form the basis
     *    of {@link FamousTransform} objects.
     *
     * An initial state is set with the constructor or set(startValue). A
     *    corresponding end state and transition are set with set(endValue,
     *    transition). Subsequent calls to set(endValue, transition) begin at
     *    the last state. Calls to get(timestamp) provide the _interpolated state
     *    along the way.
     *
     * Note that there is no event loop here - calls to get() are the only way
     *    to find out state projected to the current (or provided) time and are
     *    the only way to trigger callbacks. Usually this kind of object would
     *    be part of the render() path of a visible component.
     *
     * @name TweenTransition
     * @constructor
     *   
     * @param {number|Array.<number>|Object.<number|string, number>} start 
     *    beginning state
     */
    function TweenTransition(options) {
        this.options = Object.create(TweenTransition.DEFAULT_OPTIONS);
        if(options) this.setOptions(options);

        this._startTime = 0;
        this._startValue = 0;
        this._updateTime = 0;
        this._endValue = 0;
        this._curve = undefined;
        this._duration = 0;
        this._active = false;
        this._callback = undefined;
        this.state = 0;
    };

    TweenTransition.SUPPORTS_MULTIPLE = true;
    TweenTransition.DEFAULT_OPTIONS = {
        curve: Utility.Curve.linear,
        duration: 500,
        speed: 0 /* considered only if positive */
    };

    var registeredCurves = {};

    /**
     * Add "unit" curve to internal dictionary of registered curves.
     * 
     * @name TweenTransition#registerCurve
     * @function
     * @static
     * 
     * @param {string} curveName dictionary key
     * @param {unitCurve} curve function of one numeric variable mapping [0,1]
     *    to range inside [0,1]
     * @returns {boolean} false if key is taken, else true
     */
    TweenTransition.registerCurve = function(curveName, curve) {
        if(!registeredCurves[curveName]) {
            registeredCurves[curveName] = curve;
            return true;
        }
        else {
            return false;
        }
    };

    /**
     * Remove object with key "curveName" from internal dictionary of registered
     *    curves.
     * 
     * @name TweenTransition#unregisterCurve
     * @function
     * @static
     * 
     * @param {string} curveName dictionary key
     * @returns {boolean} false if key has no dictionary value
     */
    TweenTransition.unregisterCurve = function(curveName) {
        if(registeredCurves[curveName]) {
            delete registeredCurves[curveName];
            return true;
        }
        else {
            return false;
        }
    };

    /**
     * Retrieve function with key "curveName" from internal dictionary of
     *    registered curves. Default curves are defined in the 
     *    {@link Utility.Curve} array, where the values represent {@link
     *    unitCurve} functions.
     *    
     * @name TweenTransition#getCurve
     * @function
     * @static
     * 
     * @param {string} curveName dictionary key
     * @returns {unitCurve} curve function of one numeric variable mapping [0,1]
     *    to range inside [0,1]
     */
    TweenTransition.getCurve = function(curveName) {
        return registeredCurves[curveName];
    };

    /**
     * Retrieve all available curves.
     *    
     * @name TweenTransition#getCurves
     * @function
     * @static
     * 
     * @returns {object} curve functions of one numeric variable mapping [0,1]
     *    to range inside [0,1]
     */
    TweenTransition.getCurves = function() {
        return registeredCurves; 
    };

    /**
     * Interpolate: If a linear function f(0) = a, f(1) = b, then return f(t)
     *
     * 
     * @name _interpolate
     * @function
     * @static
     * @private 
     * @param {number} a f(0) = a
     * @param {number} b f(1) = b
     * @param {number} t independent variable 
     * @returns {number} f(t) assuming f is linear
     */ 
    function _interpolate(a, b, t) {
        return ((1 - t) * a) + (t * b);
    };

    function _clone(obj) {
        if(obj instanceof Object) {
            if(obj instanceof Array) return obj.slice(0);
            else return Object.create(obj); 
        }
        else return obj;
    };

    /**
     * Fill in missing properties in "transition" with those in defaultTransition, and
     *    convert internal named curve to function object, returning as new
     *    object.
     *    
     * 
     * @name _normalize
     * @function
     * @static
     * @private
     * 
     * @param {transition} transition shadowing transition
     * @param {transition} defaultTransition transition with backup properties
     * @returns {transition} newly normalized transition
     */ 
    function _normalize(transition, defaultTransition) {
        var result = {curve: defaultTransition.curve};
        if(defaultTransition.duration) result.duration = defaultTransition.duration;
        if(defaultTransition.speed) result.speed = defaultTransition.speed;
        if(transition instanceof Object) {
            if(transition.duration !== undefined) result.duration = transition.duration;
            if(transition.curve) result.curve = transition.curve;
            if(transition.speed) result.speed = transition.speed;
        }
        if(typeof result.curve === 'string') result.curve = TweenTransition.getCurve(result.curve);
        return result;
    };

    /**
     * Copy object to internal "default" transition. Missing properties in
     *    provided transitions inherit from this default.
     * 
     * @name TweenTransition#setOptions
     * @function
     *    
     * @param {transition} transition {duration: number, curve: f[0,1] -> [0,1]}
     */
    TweenTransition.prototype.setOptions = function(options) {
        if(options.curve !== undefined) this.options.curve = options.curve;
        if(options.duration !== undefined) this.options.duration = options.duration;
        if(options.speed !== undefined) this.options.speed = options.speed;
    };

    /**
     * Add transition to end state to the queue of pending transitions. Special
     *    Use: calling without a transition resets the object to that state with
     *    no pending actions
     * 
     * @name TweenTransition#set
     * @function
     *    
     * @param {number|FamousMatrix|Array.<number>|Object.<number, number>} endValue
     *    end state to which we _interpolate
     * @param {transition=} transition object of type {duration: number, curve:
     *    f[0,1] -> [0,1] or name}. If transition is omitted, change will be 
     *    instantaneous.
     * @param {function()=} callback Zero-argument function to call on observed
     *    completion (t=1)
     */
    TweenTransition.prototype.set = function(endValue, transition, callback) {
        if(!transition) {
            this.reset(endValue);
            if(callback) callback();
            return;
        }
        
        this._startValue = _clone(this.get());
        transition = _normalize(transition, this.options);
        if(transition.speed) {
            var startValue = this._startValue;
            if(startValue instanceof Object) {
                var variance = 0;
                for(var i in startValue) variance += (endValue[i] - startValue[i]) * (endValue[i] - startValue[i]);
                transition.duration = Math.sqrt(variance) / transition.speed;
            }
            else {
                transition.duration = Math.abs(endValue - startValue) / transition.speed;
            }
        }

        this._startTime = Date.now();
        this._endValue = _clone(endValue);
        this._duration = transition.duration;
        this._curve = transition.curve;
        this._active = true;
        this._callback = callback;
    };

    /**
     * Cancel all transitions and reset to a stable state
     *
     * @name TweenTransition#reset
     * @function
     *
     * @param {number|Array.<number>|Object.<number, number>} startValue
     *    stable state to set to
     */
    TweenTransition.prototype.reset = function(startValue) {
        if(this._callback) { 
            var callback = this._callback;
            this._callback = undefined;
            callback();
        }
        this.state = _clone(startValue);
        this._startTime = 0;
        this._duration = 0;
        this._updateTime = 0;
        this._startValue = this.state;
        this._endValue = this.state;
        this._active = false;
    };

    /**
     * Get _interpolated state of current action at provided time. If the last
     *    action has completed, invoke its callback.
     * 
     * @name TweenTransition#get
     * @function
     *    
     * @param {number=} timestamp Evaluate the curve at a normalized version of this
     *    time. If omitted, use current time. (Unix epoch time)
     * @returns {number|Object.<number|string, number>} beginning state
     *    _interpolated to this point in time.
     */
    TweenTransition.prototype.get = function(timestamp) {
        this.update(timestamp);
        return this.state;
    };

    /**
     * Update internal state to the provided timestamp. This may invoke the last
     *    callback and begin a new action.
     * 
     * @name TweenTransition#update
     * @function
     * 
     * @param {number=} timestamp Evaluate the curve at a normalized version of this
     *    time. If omitted, use current time. (Unix epoch time)
     */
    TweenTransition.prototype.update = function(timestamp) {
        if(!this._active) {
            if(this._callback) {
                var callback = this._callback;
                this._callback = undefined;
                callback();
            }
            return;
        }

        if(!timestamp) timestamp = Date.now();
        if(this._updateTime >= timestamp) return;
        this._updateTime = timestamp;

        var timeSinceStart = timestamp - this._startTime;
        if(timeSinceStart >= this._duration) {
            this.state = this._endValue;
            this._active = false;
        }
        else if(timeSinceStart < 0) {
            this.state = this._startValue;
        }
        else { 
            var t = timeSinceStart / this._duration;
            if(this.state instanceof Object) {
                for(var i in this.state) this.state[i] = _interpolate(this._startValue[i], this._endValue[i], this._curve(t));
            }
            else {
                this.state = _interpolate(this._startValue, this._endValue, this._curve(t));
            }
        }
    };

    /**
     * Is there at least one action pending completion?
     * 
     * @name TweenTransition#isActive
     * @function
     * 
     * @returns {boolean} 
     */
    TweenTransition.prototype.isActive = function() {
        return this._active;
    };

    /**
     * Halt transition at current state and erase all pending actions.
     * 
     * @name TweenTransition#halt
     * @function
     */
    TweenTransition.prototype.halt = function() {
        this.reset(this.get());
    };

    /* Register all the default curves */
    TweenTransition.registerCurve('linear', Utility.Curve.linear);
    TweenTransition.registerCurve('easeIn', Utility.Curve.easeIn);
    TweenTransition.registerCurve('easeOut', Utility.Curve.easeOut);
    TweenTransition.registerCurve('easeInOut', Utility.Curve.easeInOut);
    TweenTransition.registerCurve('easeOutBounce', Utility.Curve.easeOutBounce);
    TweenTransition.registerCurve('spring', Utility.Curve.spring);

    module.exports = TweenTransition;
});

define('famous/Transitionable',['require','exports','module','./Utility','./MultipleTransition','./TweenTransition'],function(require, exports, module) {
    var Utility = require('./Utility');
    var MultipleTransition = require('./MultipleTransition');
    var TweenTransition = require('./TweenTransition');

    /**
     *
     * @class A engineInstance maintainer for a smooth transition between 
     *    numerically-specified engineInstances. 
     *
     * @description  Example numeric engineInstances include floats or
     *    {@link FamousMatrix} objects. Transitionables form the basis
     *    of {@link FamousTransform} objects.
     *
     * An initial engineInstance is set with the constructor or set(startState). A
     *    corresponding end engineInstance and transition are set with set(endState,
     *    transition). Subsequent calls to set(endState, transition) begin at
     *    the last engineInstance. Calls to get(timestamp) provide the interpolated engineInstance
     *    along the way.
     *
     * Note that there is no event loop here - calls to get() are the only way
     *    to find out engineInstance projected to the current (or provided) time and are
     *    the only way to trigger callbacks. Usually this kind of object would
     *    be part of the render() path of a visible component.
     * 
     * @name Transitionable
     * @constructor
     * @example 
     *   function FamousFader(engineInstance, transition) { 
     *     if(typeof engineInstance == 'undefined') engineInstance = 0; 
     *     if(typeof transition == 'undefined') transition = true; 
     *     this.transitionHelper = new Transitionable(engineInstance);
     *     this.transition = transition; 
     *   }; 
     *   
     *   FamousFader.prototype = { 
     *     show: function(callback) { 
     *       this.set(1, this.transition, callback); 
     *     }, 
     *     hide: function(callback) { 
     *       this.set(0, this.transition, callback); 
     *     }, 
     *     set: function(engineInstance, transition, callback) { 
     *       this.transitionHelper.halt();
     *       this.transitionHelper.set(engineInstance, transition, callback); 
     *     }, 
     *     render: function(target) { 
     *       var currOpacity = this.transitionHelper.get();
     *       return {opacity: currOpacity, target: target}; 
     *     } 
     *   };
     *   
     * @param {number|Array.<number>|Object.<number|string, number>} start 
     *    beginning engineInstance
     */
    function Transitionable(start) {
        this.currentAction = null;
        this.actionQueue = [];
        this.callbackQueue = [];

        this.state = 0;
        this._callback = undefined;
        this._engineInstance = null;
        this._currentMethod = null;

        this.set(start);
    };

    var transitionMethods = {};

    Transitionable.registerMethod = function(name, engineClass) {
        if(!(name in transitionMethods)) {
            transitionMethods[name] = engineClass;
            return true;
        }
        else return false;
    };

    Transitionable.unregisterMethod = function(name) {
        if(name in transitionMethods) {
            delete transitionMethods[name];
            return true;
        }
        else return false;
    };

    function _loadNext() {
        if(this._callback) {
            var callback = this._callback;
            this._callback = undefined;
            callback();
        }
        if(this.actionQueue.length <= 0) {
            this.set(this._engineInstance); // no update required
            return;
        }
        this.currentAction = this.actionQueue.shift();
        this._callback = this.callbackQueue.shift();

        var method = null;
        var endValue = this.currentAction[0];
        var transition = this.currentAction[1];
        if(transition instanceof Object && transition.method) {
            method = transition.method;
            if(typeof method === 'string') method = transitionMethods[method];
        }
        else {
            method = TweenTransition;
        }
        if(this._currentMethod !== method) {
            if(!(endValue instanceof Object) || method.SUPPORTS_MULTIPLE === true || endValue.length <= method.SUPPORTS_MULTIPLE) {
                this._engineInstance = new method();
            }
            else {
                this._engineInstance = new MultipleTransition(method);
            }
            this._currentMethod = method;
        }
        this._engineInstance.reset(this.state);
        this._engineInstance.set(endValue, transition, _loadNext.bind(this));
    };

    /**
     * Add transition to end engineInstance to the queue of pending transitions. Special
     *    Use: calling without a transition resets the object to that engineInstance with
     *    no pending actions
     * 
     * @name Transitionable#set
     * @function
     *    
     * @param {number|FamousMatrix|Array.<number>|Object.<number, number>} endState
     *    end engineInstance to which we interpolate
     * @param {transition=} transition object of type {duration: number, curve:
     *    f[0,1] -> [0,1] or name}. If transition is omitted, change will be 
     *    instantaneous.
     * @param {function()=} callback Zero-argument function to call on observed
     *    completion (t=1)
     */
    Transitionable.prototype.set = function(endState, transition, callback) {
        if(!transition) {
            this.reset(endState);
            if(callback) callback();
            return;
        }

        var action = [endState, transition];
        this.actionQueue.push(action);
        this.callbackQueue.push(callback);
        if(!this.currentAction) _loadNext.call(this);
    };

    /**
     * Cancel all transitions and reset to a stable engineInstance
     *
     * @name Transitionable#reset
     * @function
     *
     * @param {number|Array.<number>|Object.<number, number>} startState
     *    stable engineInstance to set to
     */
    Transitionable.prototype.reset = function(startState) {
        this._currentMethod = null;
        this._engineInstance = null;
        this.state = startState;
        this.currentAction = null;
        this.actionQueue = [];
        this.callbackQueue = [];
    };

    /**
     * Add delay action to the pending action queue queue.
     * 
     * @name Transitionable#delay
     * @function
     * 
     * @param {number} duration delay time (ms)
     * @param {function()} callback Zero-argument function to call on observed
     *    completion (t=1)
     */
    Transitionable.prototype.delay = function(duration, callback) {
        this.set(this._engineInstance, {duration: duration, curve: function() { return 0; }}, callback);
    };

    /**
     * Get interpolated engineInstance of current action at provided time. If the last
     *    action has completed, invoke its callback. TODO: What if people want
     *    timestamp == 0?
     * 
     * @name Transitionable#get
     * @function
     *    
     * @param {number=} timestamp Evaluate the curve at a normalized version of this
     *    time. If omitted, use current time. (Unix epoch time)
     * @returns {number|Object.<number|string, number>} beginning engineInstance
     *    interpolated to this point in time.
     */
    Transitionable.prototype.get = function(timestamp) {
        if(this._engineInstance) this.state = this._engineInstance.get(timestamp);
        return this.state;
    };

    /**
     * Is there at least one action pending completion?
     * 
     * @name Transitionable#isActive
     * @function
     * 
     * @returns {boolean} 
     */
    Transitionable.prototype.isActive = function() {
        return !!this.currentAction;
    };

    /**
     * Halt transition at current engineInstance and erase all pending actions.
     * 
     * @name Transitionable#halt
     * @function
     */
    Transitionable.prototype.halt = function() {
        this.set(this.get());
    };

    module.exports = Transitionable;
});

define('famous/Context',['require','exports','module','./RenderNode','./EventHandler','./SpecParser','./ElementAllocator','./Matrix','./Transitionable'],function(require, exports, module) {
    var RenderNode = require('./RenderNode');
    var FamousEventHandler = require('./EventHandler');
    var SpecParser = require('./SpecParser');
    var ElementAllocator = require('./ElementAllocator');
    var FM = require('./Matrix');
    var Transitionable = require('./Transitionable');

    /**
     * @class The top-level container for a Famous-renderable piece of the 
     *    document.  
     * @description It is directly updated
     *   by the process-wide FamousEngine object, and manages one 
     *   (render tree, event tree) pair, essentially defining their render
     *   and event space.
     *
     * The constructor should only be called by the engine.
     * @name Context
     * @constructor
     * 
     * @example
     *   var mainDiv = document.querySelector('#main'); 
     *   var mainContext = FamousEngine.createContext(mainDiv);
     *   var surface = new FamousSurface([300,50], 'Hello World');
     *   mainContext.link(helloWorldSurface);
     *
     * 
     * @param {FamousSurfaceManager} surfaceManager A {@link FamousSurfaceManager} 
     *   wrapping the top document element in this context.  Note that this div
     *   (for some reason?) is not the source of the document content.
     */
    function Context(container) {
        this.container = container;
        this.allocator = new ElementAllocator(container);

        this.srcNode = new RenderNode();
        this.eventHandler = new FamousEventHandler();
        this._size = [window.innerWidth, window.innerHeight];

        this.perspectiveState = new Transitionable(0);
        this._perspective = undefined;

        this.eventHandler.on('resize', function() {
            this._size = _getElementSize(this.container);
        }.bind(this));
    };

    function _getElementSize(element) {
        return [element.clientWidth, element.clientHeight];
    };

    Context.prototype.getAllocator = function() {
        return this.allocator;
    };

    /**
     * Add renderables to this Context
     *
     * @name Context#include
     * @function
     * @param {renderableComponent} obj 
     * @returns {RenderNode} new node wrapping this object
     */
    Context.prototype.link = function(obj) {
        return this.srcNode.link(obj);
    };

    /**
     * Add renderables to this Context
     *
     * @name Context#add
     * @function
     * @param {renderableComponent} obj 
     * @returns {RenderNode} new node wrapping this object
     */
    Context.prototype.add = function(obj) {
        return this.srcNode.add(obj);
    };

    /**
     * Add modifier renderables to this Context
     *
     * @name Context#mod
     * @function
     * @param {renderableComponent} obj 
     * @returns {RenderNode} new node wrapping this object
     */
    Context.prototype.mod = function(obj) {
        return this.srcNode.mod(obj);
    };

    /**
     * Move this context to another container
     *
     * @name Context#migrate
     * @function
     * @param {Node} container Container node to migrate to
     */
    Context.prototype.migrate = function(container) {
        if(container === this.container) return;
        this.container = container;
        this.allocator.migrate(container);
    };

    /**
     * Gets viewport size for Context
     *
     * @name Context#getSize
     * @function
     *
     * @returns {Array} viewport size
     */
    Context.prototype.getSize = function() {
        return this._size;
    };

    /**
     * Sets viewport size for Context
     *
     * @name Context#setSize
     * @function
     */
    Context.prototype.setSize = function(size) {
        if(!size) size = _getElementSize(this.container);
        this._size = size;
    };

    /**
     * Run the render loop and then the run the update loop for the content 
     *   managed by this context. 
     *   Update the surfaceManager for this context.
     *
     * @name Context#update
     * @function
     */
    Context.prototype.update = function() {
        var perspective = this.perspectiveState.get();
        if(perspective !== this._perspective) {
            this.container.style.perspective = perspective ? perspective.toFixed() + 'px' : '';
            this.container.style.webkitPerspective = perspective ? perspective.toFixed() : '';
            this._perspective = perspective;
        }
        
        if(this.srcNode) { 
            this.srcNode.commit(this, FM.identity, 1, [0, 0], this._size);
        }
    };

    /**
     * Get the 'final result' of engine properties to be applied to the surface
     *   before rendering.  Not used within the engine - primarily for 
     *   debugging or extension purposes.
     *
     * @name Context#getOutputTransform
     * @function
     * @param {Object} surface
     * @returns {surfaceOutputTransform}
     */
    Context.prototype.getOutputTransform = function(surface) {
        var pc = this.parsedCache;
        if(!pc) return;

        var id = surface.id;
        var result = {
            transform: pc.transforms[id],
            opacity: pc.opacities[id]
        };
        if(pc.origins[id]) result.origin = pc.origins[id];
        if(pc.groups[id]) {
            var gid = pc.groups[id];
            result.transform = FM.multiply(result.transform, pc.groupTransforms[gid]);
            if(pc.groupOpacities[gid]) result.opacity *= pc.groupOpacities[gid];
        }
        return result;
    };

    Context.prototype.getPerspective = function() {
        return this.perspectiveState.get();
    };

    Context.prototype.setPerspective = function(perspective, transition, callback) {
        return this.perspectiveState.set(perspective, transition, callback);
    };

    /**
     * Trigger an event, sending to all downstream handlers
     *   matching provided 'type' key.
     *
     * @name Context#emit
     * @function
     *
     * @param {string} type event type key (for example, 'click')
     * @param {Object} event event data
     */
    Context.prototype.emit = function(type, event) {
        return this.eventHandler.emit(type, event);
    };

    /**
     * Bind a handler function to an event type occuring in the context.
     *   These events will either come link calling {@link Context#emit} or
     *   directly link the document.  
     *   Document events have the opportunity to first be intercepted by the 
     *   on() method of the FamousSurface upon which the event occurs, then 
     *   by the on() method of the Context containing that surface, and
     *   finally as a default, the FamousEngine itself. 
     *
     * @name Context#on
     * @function
     * @param  {string} type event type key (for example, 'click')
     * @param {function(string, Object)} handler callback
     */
    Context.prototype.on = function(type, handler) {
        return this.eventHandler.on(type, handler);
    };

    /**
     * Unbind an event by type and handler.  
     *   This undoes the work of {@link Context#on}
     *
     * @name Context#unbind
     * @function
     * @param {string} type event type key (for example, 'click')
     * @param {function(string, Object)} handler 
     */
    Context.prototype.unbind = function(type, handler) {
        return this.eventHandler.unbind(type, handler);
    };

    /**
     * Emit Context events to downstream event handler
     *
     * @name Context#pipe
     * @function
     * @param {EventHandler} target downstream event handler
     */
    Context.prototype.pipe = function(target) {
        return this.eventHandler.pipe(target);
    };

    /**
     * Stop emitting events to a downstream event handler
     *
     * @name Context#unpipe
     * @function
     * @param {EventHandler} target downstream event handler
     */
    Context.prototype.unpipe = function(target) {
        return this.eventHandler.unpipe(target);
    };

    module.exports = Context;
});

define('famous/Engine',['require','exports','module','./Context','./EventHandler'],function(require, exports, module) {
    /**
     * @namespace FamousEngine
     * 
     * @description The singleton object initiated upon process
     *    startup which manages all active {@link FamousContext} instances, runs
     *    the render dispatch loop, and acts as a global listener and dispatcher
     *    for all events. Public functions include
     *    adding contexts and functions for execution at each render tick.
     * 
     *   On static initialization, window.requestAnimationFrame is called with
     *   the event loop function, step().
     * 
     *   Note: Any window in which FamousEngine runs will prevent default 
     *     scrolling behavior on the 'touchmove' event.
     * @static
     * 
     * @name FamousEngine
     * 
     * @example
     *   var mainDiv = document.querySelector('#main'); 
     *   var mainContext = FamousEngine.createContext(mainDiv);
     *   var surface = new FamousSurface([300,50], 'Hello World');
     *   mainContext.from(helloWorldSurface);
     */
    var FamousContext = require('./Context');
    var FamousEventHandler = require('./EventHandler');

    var contexts = [];
    var nextTickQueue = [];
    var deferQueue = [];

    var lastTime = Date.now();
    var frameTime = undefined;
    var frameTimeLimit = undefined;
    var eventHandler = new FamousEventHandler();

    /** @const */ var MAX_DEFER_FRAME_TIME = 10;

    var entities = [];

    /**
     * Inside requestAnimationFrame loop, this function is called which:
     *   - calculates current FPS (throttling loop if over limit set in setFPSCap)
     *   - emits dataless 'prerender' event on start of loop
     *   - call in order any one-shot function registered by nextTick on last loop.
     *   - call FamousContext.update on all {@link FamousContext} objects registered.
     *   - emits dataless 'postrender' event on end of loop
     * @name FamousEngine#step
     * @function
     * @private
     */
    function step() {
        var currTime = Date.now();
        // skip frame if we're over our framerate cap
        if(frameTimeLimit && currTime - lastTime < frameTimeLimit) {
            requestAnimationFrame(step);
            return;
        }
        frameTime = currTime - lastTime;
        lastTime = currTime;

        eventHandler.emit('prerender');

        // empty the queue
        for(var i = 0; i < nextTickQueue.length; i++) nextTickQueue[i].call(this);
        nextTickQueue = [];

        // limit total execution time for deferrable functions
        while(deferQueue.length && (Date.now() - currTime) < MAX_DEFER_FRAME_TIME) {
            deferQueue.shift().call(this);
        }

        for(var i = 0; i < contexts.length; i++) contexts[i].update();

        eventHandler.emit('postrender');

        requestAnimationFrame(step);
    };

    requestAnimationFrame(step);

    /**
     * Upon main document window resize (unless on an "input" HTML element)
     *   - scroll to the top left corner of the window
     *   - For each managed {@link FamousContext}: emit the 'resize' and update its size 
     *     with any {@link FamousSurfaceManager} managing that context.
     * @name FamousEngine#step
     * @function
     * @static
     * @private
     * 
     * @param {Object=} event
     */
    function handleResize(event) {
        if(document.activeElement && document.activeElement.nodeName == 'INPUT') {
            document.activeElement.addEventListener('blur', function deferredResize() {
                this.removeEventListener('blur', deferredResize);
                handleResize(event);
            });
            return;
        }
        window.scrollTo(0, 0);
        for(var i = 0; i < contexts.length; i++) {
            contexts[i].emit('resize');
        }
        eventHandler.emit('resize');
    };
    window.addEventListener('resize', handleResize, false);
    handleResize();

    // prevent scrolling via browser
    window.addEventListener('touchmove', function(event) { event.preventDefault(); }, false);

    /**
     * Pipes all events to a target object that implements the #emit() interface.
     * TODO: Confirm that "uncaught" events that bubble up to the document.
     * @name FamousEngine#pipe
     * @function
     * @param {emitterObject} target target emitter object
     * @returns {emitterObject} target emitter object (for chaining)
     */
    function pipe(target) { 
        return eventHandler.pipe(target);
    };

    /**
     * WARNING: DEPRECATED
     * @deprecated
     *
     * @name FamousEngine#pipeEvents
     * @function
     * @param {emitterObject} target target emitter object
     * @returns {emitterObject} target meitter object (for chaining)
     */
    function pipeEvents(target) {
        console.warn('pipeEvents is deprecated; use pipe instead');
        return pipeEvents(target);
    };

    /**
     * Stop piping all events at the FamousEngine level to a target emitter 
     *   object.  Undoes the work of {@link FamousEngine#pipe}.
     * 
     * @name FamousEngine#unpipe
     * @function
     * @param {emitterObject} target target emitter object
     */
    function unpipe(target) { 
        return eventHandler.unpipe(target);
    };

    var eventTypes = ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'click', 'keydown', 'keyup', 'keypress', 'mouseup', 'mousedown', 'mousemove', 'mouseover', 'mouseout', 'mousewheel', 'wheel', 'resize'];
    for(var i = 0; i < eventTypes.length; i++) {
        var type = eventTypes[i];
        document.body.addEventListener(type, function(event) {
            eventHandler.emit(event.type, event, false);
        }, false);
    }

    /**
     * Bind a handler function to a document or Engine event.
     *   These events will either come from calling {@link FamousEngine#emit} or
     *   directly from the document.  The document events to which FamousEngine 
     *   listens by default include: 'touchstart', 'touchmove', 'touchend', 
     *   'touchcancel', 
     *   'click', 'keydown', 'keyup', 'keypress', 'mousemove', 
     *   'mouseover', 'mouseout'.  
     *   Document events have the opportunity to first be intercepted by the 
     *   on() method of the FamousSurface upon which the event occurs, then 
     *   by the on() method of the FamousContext containing that surface, and
     *   finally as a default, the FamousEngine itself.
     * @static
     * @name FamousEngine#on
     * @function
     * @param  {string} type event type key (for example, 'click')
     * @param {function(string, Object)} handler callback
     */
    function on(type, handler) { 
        eventHandler.on(type, handler); 
    };

    /**
     * Trigger an event, sending to all downstream handlers
     *   matching provided 'type' key.
     *
     * @static
     * @name FamousEngine#emit
     * @function
     * @param {string} type event type key (for example, 'click')
     * @param {Object} event event data
     */
    function emit(type, event) { 
        eventHandler.emit(type, event); 
    };

    /**
     * Unbind an event by type and handler.  
     *   This undoes the work of {@link FamousEngine#on}
     * 
     * @static
     * @name FamousEngine#unbind
     * @function
     * @param {string} type 
     * @param {function(string, Object)} handler 
     */
    function unbind(type, handler) { 
        eventHandler.unbind(type, handler); 
    };

    /**
     * Return the current calculated frames per second of the FamousEngine.
     * 
     * @static
     * @name FamousEngine#getFPS
     * @function
     * @returns {number} calculated fps
     */
    function getFPS() {
        return 1000 / frameTime;
    };

    /**
     * Set the maximum fps at which the system should run. If internal render
     *    loop is called at a greater frequency than this FPSCap, Engine will
     *    throttle render and update until this rate is achieved.
     * 
     * @static
     * @name FamousEngine#setFPS
     * @function
     * @param {number} fps desired fps
     */
    function setFPSCap(fps) {
        frameTimeLimit = Math.floor(1000 / fps);
    };

    /**
     * Creates a new context for Famous rendering and event handling with
     *    provided HTML element as top of each tree. This will be tracked by the
     *    process-wide {@link FamousEngine}, and this will add a {@link
     *    FamousSurfaceManager} to the HTMLElement provided.
     *
     * @static
     * @name FamousEngine#createContext
     * @function
     * @param {Element} el Top of document tree
     * @returns {FamousContext}
     */
    function createContext(el) {
        if(el === undefined) {
            el = document.createElement('div');
            el.classList.add('container');
            document.body.appendChild(el);
        }
        else if(!(el instanceof Element)) {
            el = document.createElement('div');
            console.warn('Tried to create context on non-existent element');
        }
        var context = new FamousContext(el);
        contexts.push(context);
        return context;
    };

    /**
     * Queue a function to be executed on the next tick of the {@link
     *    FamousEngine}.  The function's only argument will be the 
     *    JS window object.
     *    
     * @static
     * @name FamousEngine#nextTick
     * @function
     * @param {Function} fn
     */
    function nextTick(fn) {
        nextTickQueue.push(fn);
    };

    function getEntity(id) {
        return entities[id];
    };

    function registerEntity(entity) {
        var id = entities.length;
        entities[id] = entity;
        return id;
    };

    /**
     * Queue a function to be executed sometime soon, at a time that is
     *    unlikely to affect framerate.
     *
     * @static
     * @name FamousEngine#defer
     * @function
     * @param {Function} fn
     */
    function defer(fn) {
        deferQueue.push(fn);
    };

    module.exports = {
        on: on,
        defer: defer,
        emit: emit,
        unbind: unbind,
        pipe: pipe,
        unpipe: unpipe,
        createContext: createContext,
        getFPS: getFPS,
        setFPSCap: setFPSCap,
        nextTick: nextTick,
        getEntity: getEntity,
        registerEntity: registerEntity
    };
});

define('famous/Surface',['require','exports','module','./Entity','./EventHandler','./Matrix'],function(require, exports, module) {
    var Entity = require('./Entity');
    var FamousEventHandler = require('./EventHandler');
    var FM = require('./Matrix');

    var usePrefix = document.body.style.webkitTransform !== undefined;

    /**
     * @class A base class for viewable content and event
     *    targets inside a Famous applcation, containing a renderable document
     *    fragment. 
     * @description Like an HTML div, it can accept internal markup,
     *    properties, and classes, and handle events. This is a PUBLIC
     *    interface and can be extended.
     * 
     * @name FamousSurface
     * @constructor
     * 
     * @param {Array.<number>} size Width and height in absolute pixels (array of ints)
     * @param {string} content Document content (e.g. HTML) managed by this
     *    surface.
     */
    function FamousSurface(options) {
        this.options = {};

        this.properties = {};
        this.content = '';
        this.classList = [];
        this.size = undefined;

        this._classesDirty = true;
        this._stylesDirty = true;
        this._sizeDirty = true;
        this._contentDirty = true;

        this._dirtyClasses = [];

        this._matrix = undefined;
        this._opacity = 1;
        this._origin = undefined;
        this._size = undefined;

        /** @ignore */
        this.eventForwarder = function(event) {
            this.emit(event.type, event);
        }.bind(this);
        this.eventHandler = new FamousEventHandler();
        this.eventHandler.bindThis(this);

        this.id = Entity.register(this);

        if(options) this.setOptions(options);

        this._currTarget = undefined;
    };

    /** 
     * Document events to which FamousSurface automatically listens.
     *   Bind to them with .on(), forward them with .pipe(), and similar.
     *
     * @name FamousSurface#surfaceEvents
     * @field
     * @type {Array.<string>} 
     */
    FamousSurface.prototype.surfaceEvents = ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'click', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'mousewheel', 'wheel'];

    FamousSurface.prototype.elementType = 'div';
    FamousSurface.prototype.elementClass = 'surface';

    /**
     * Bind a handler function to occurrence of event type on this surface.
     *   Document events have the opportunity to first be intercepted by the 
     *   on() method of the FamousSurface upon which the event occurs, then 
     *   by the on() method of the FamousContext containing that surface, and
     *   finally as a default, the FamousEngine itself.
     * 
     * @name FamousSurface#on
     * @function
     * @param  {string} type event type key (for example, 'click')
     * @param {function(string, Object)} handler callback
     */
    FamousSurface.prototype.on = function(type, fn) {
        this.eventHandler.on(type, fn);
    };

    /**
     * Unbind an event by type and handler.  
     *   This undoes the work of {@link FamousSurface#on}
     * 
     * @name FamousSurface#unbind
     * @function
     * @param {string} type event type key (for example, 'click')
     * @param {function(string, Object)} handler 
     */
    FamousSurface.prototype.unbind = function(type, fn) {
        this.eventHandler.unbind(type, fn);
    };

    /**
     * Trigger an event, sending to all downstream handlers
     *   matching provided 'type' key.
     * 
     * @name FamousSurface#emit
     * @function
     * @param  {string} type event type key (for example, 'click')
     * @param  {Object} event event data
     * @returns {boolean}  true if event was handled along the event chain.
     */
    FamousSurface.prototype.emit = function(type, event) {
        if(event && !event.origin) event.origin = this;
        var handled = this.eventHandler.emit(type, event);
        if(handled && event.stopPropagation) event.stopPropagation();
        return handled;
    };

    /**
     * Pipe all events to a target {@link emittoerObject}
     *
     * @name FamousSurface#pipe
     * @function
     * @param {emitterObject} target emitter object
     * @returns {emitterObject} target (to allow for chaining)
     */
    FamousSurface.prototype.pipe = function(target) {
        return this.eventHandler.pipe(target);
    };

    /**
     * (WARNING: DEPRECATED) Alias for FamousSurface#pipe
     * @deprecated
     *
     * @name FamousSurface#pipeEvents
     * @function
     * @param {emitterObject} target emitter object
     * @returns {emitterObject} target (to allow for chaining)
     */
    FamousSurface.prototype.pipeEvents = function(target) {
        console.warn('pipeEvents is deprecated; use pipe instead');
        return this.pipe.apply(this, arguments);
    };

    /**
     * Stop piping all events at the FamousEngine level to a target emitter 
     *   object.  Undoes the work of #pipe.
     * 
     * @name FamousSurface#unpipe
     * @function
     * @param {emitterObject} target emitter object
     */
    FamousSurface.prototype.unpipe = function(target) {
        return this.eventHandler.unpipe(target);
    };

    /**
     * Return spec for this surface. Note that for a base surface, this is
     *    simply an id.
     * 
     * (Scope: Device developers and deeper)
     * @name FamousSurface#render
     * @function
     * @returns {number} Spec for this surface (spec id)
     */
    FamousSurface.prototype.render = function() {
        return this.id;
    };

    /**
     * Set CSS-style properties on this FamousSurface. Note that this will cause
     *    dirtying and thus re-rendering, even if values do not change (confirm)
     *    
     * @name FamousSurface#setProperties
     * @function
     * @param {Object} properties property dictionary of "key" => "value"
     */
    FamousSurface.prototype.setProperties = function(properties) {
        for(n in properties) {
            this.properties[n] = properties[n];
        }
        this._stylesDirty = true;
    };

    /**
     * Get CSS-style properties on this FamousSurface.
     * 
     * @name FamousSurface#getProperties
     * @function
     * @returns {Object} Dictionary of properties of this Surface.
     */
    FamousSurface.prototype.getProperties = function() {
        return this.properties;
    };

    /**
     * Add CSS-style class to the list of classes on this FamousSurface. Note
     *   this will map directly to the HTML property of the actual
     *   corresponding rendered <div>. 
     *   These will be deployed to the document on call to .setup().
     *    
     * @param {string} className name of class to add
     */
    FamousSurface.prototype.addClass = function(className) {
        if(this.classList.indexOf(className) < 0) {
            this.classList.push(className);
            this._classesDirty = true;
        }
    };

    /**
     * Remove CSS-style class from the list of classes on this FamousSurface.
     *   Note this will map directly to the HTML property of the actual
     *   corresponding rendered <div>. 
     *   These will be deployed to the document on call to #setup().
     *    
     * @name FamousSurface#removeClass
     * @function
     * @param {string} className name of class to remove
     */
    FamousSurface.prototype.removeClass = function(className) {
        var i = this.classList.indexOf(className);
        if(i >= 0) {
            this._dirtyClasses.push(this.classList.splice(i, 1)[0]);
            this._classesDirty = true;
        }
    };

    FamousSurface.prototype.setClasses = function(classList) {
        var removal = [];
        for(var i = 0; i < this.classList.length; i++) {
            if(classList.indexOf(this.classList[i]) < 0) removal.push(this.classList[i]);
        }
        for(var i = 0; i < removal.length; i++) this.removeClass(removal[i]);
        // duplicates are already checked by addClass()
        for(var i = 0; i < classList.length; i++) this.addClass(classList[i]);
    };

    /**
     * Get array of CSS-style classes attached to this div.
     * 
     * @name FamousSurface#getClasslist
     * @function
     * @returns {Array.<string>} Returns an array of classNames
     */
    FamousSurface.prototype.getClassList = function() {
        return this.classList;
    };

    /**
     * Set or overwrite inner (HTML) content of this surface. Note that this
     *    causes a re-rendering if the content has changed.
     * 
     * @name FamousSurface#setContent
     * @function
     *    
     * @param {string} content HTML content
     */
    FamousSurface.prototype.setContent = function(content) {
        if(this.content != content) {
            this.content = content;
            this._contentDirty = true;
        }
    };

    /**
     * Return inner (HTML) content of this surface.
     * 
     * @name FamousSurface#getContent
     * @function
     * 
     * @returns {string} inner (HTML) content
     */
    FamousSurface.prototype.getContent = function() {
        return this.content;
    };

    /**
     * Set options for this surface
     *
     * @name FamousSurface#setOptions
     * @function
     *
     * @param {Object} options options hash
     */
    FamousSurface.prototype.setOptions = function(options) {
        if(options.size) this.setSize(options.size);
        if(options.classes) this.setClasses(options.classes);
        if(options.properties) this.setProperties(options.properties);
        if(options.content) this.setContent(options.content);
    };


    /**
     *   Attach Famous event handling to document events emanating from target
     *     document element.  This occurs just after deployment to the document.
     *     Calling this enables methods like #on and #pipe.
     *    
     * @private
     * @param {Element} target document element
     */
    function _bindEvents(target) {
        var eventTypes = this.surfaceEvents;
        for(var i = 0; i < eventTypes.length; i++) {
            target.addEventListener(eventTypes[i], this.eventForwarder);
        }
    };

    /**
     *   Detach Famous event handling from document events emanating from target
     *     document element.  This occurs just before recall from the document.
     *     Calling this enables methods like #on and #pipe.
     *    
     * 
     * @name FamousSurface#_unbindEvents
     * @function
     * @private
     * @param {Element} target document element
     */
    function _unbindEvents(target) {
        var eventTypes = this.surfaceEvents;
        for(var i = 0; i < eventTypes.length; i++) {
            target.removeEventListener(eventTypes[i], this.eventForwarder);
        }
    };

    /**
     *  Apply to document all changes from #removeClass since last #setup().
     *    
     * @name FamousSurface#_cleanupClasses
     * @function
     * @private
     * @param {Element} target document element
     */
    function _cleanupClasses(target) {
        for(var i = 0; i < this._dirtyClasses.length; i++) target.classList.remove(this._dirtyClasses[i]);
        this._dirtyClasses = [];
    };

    /**
     * Apply values of all Famous-managed styles to the document element.
     *   These will be deployed to the document on call to #setup().
     * 
     * @name FamousSurface#_applyStyles
     * @function
     * @private
     * @param {Element} target document element
     */
    function _applyStyles(target) {
        for(var n in this.properties) {
            target.style[n] = this.properties[n];
        }
    };

    /**
     * Clear all Famous-managed styles from the document element.
     *   These will be deployed to the document on call to #setup().
     * 
     * @name FamousSurface#_cleanupStyles
     * @function
     * @private
     * @param {Element} target document element
     */
    function _cleanupStyles(target) {
        for(var n in this.properties) {
            target.style[n] = '';
        }
    };

    var _setMatrix;
    var _setOrigin;
    var _setInvisible;

    /**
     * Directly apply given FamousMatrix to the document element as the 
     *   appropriate webkit CSS style.
     * 
     * @name FamousSurfaceManager#setMatrix
     * @function
     * @static
     * @private
     * @param {Element} element document element
     * @param {FamousMatrix} matrix 
     */ 
    if(usePrefix) _setMatrix = function(element, matrix) { element.style.webkitTransform = FM.formatCSS(matrix); };
    else _setMatrix = function(element, matrix) { element.style.transform = FM.formatCSS(matrix); };

    /**
     * Directly apply given origin coordinates to the document element as the 
     *   appropriate webkit CSS style.
     * 
     * @name FamousSurfaceManager#setOrigin
     * @function
     * @static
     * @private
     * @param {Element} element document element
     * @param {FamousMatrix} matrix 
     */ 
    if(usePrefix) _setOrigin = function(element, origin) { element.style.webkitTransformOrigin = _formatCSSOrigin(origin); };
    else _setOrigin = function(element, origin) { element.style.transformOrigin = _formatCSSOrigin(origin); };


    /**
     * Shrink given document element until it is effectively invisible.   
     *   This destroys any existing transform properties.  
     *   Note: Is this the ideal implementation?
     *
     * @name FamousSurfaceManager#setInvisible
     * @function
     * @static
     * @private
     * @param {Element} element document element
     */
    if(usePrefix) _setInvisible = function(element) { element.style.webkitTransform = 'scale3d(0.0001,0.0001,1)'; element.style.opacity = 0; };
    else _setInvisible = function(element) { element.style.transform = 'scale3d(0.0001,0.0001,1)'; element.style.opacity = 0; };

    /**
     * Comparator for length two numerical arrays (presumably, [x,y])
     *
     * @name FamousSurfaceManager#xyEquals
     * @function
     * @static
     * @param {Array.<number>} a
     * @param {Array.<number>} b
     * @returns {boolean} true if both falsy or both have equal [0] and [1] components.
     */
    function xyEquals(a, b) {
        if(!a && !b) return true;
        else if(!a || !b) return false;
        return a[0] == b[0] && a[1] == b[1];
    };

    function _formatCSSOrigin(origin) {
        return (100*origin[0]).toFixed(6) + '% ' + (100*origin[1]).toFixed(6) + '%';
    };

    /**
     * Sets up an element to be ready for commits
     *  
     * (Scope: Device developers and deeper)
     * @name FamousSurface#setup
     * @function
     * 
     * @param {Element} target document element
     */
    FamousSurface.prototype.setup = function(allocator) {
        var target = allocator.allocate(this.elementType);
        if(this.elementClass) {
            if(this.elementClass instanceof Array) {
                for(var i = 0; i < this.elementClass.length; i++) {
                    target.classList.add(this.elementClass[i]);
                }
            }
            else {
                target.classList.add(this.elementClass);
            }
        }
        _bindEvents.call(this, target);
        _setOrigin(target, [0, 0]); // handled internally
        this._currTarget = target;
        this._stylesDirty = true;
        this._classesDirty = true;
        this._sizeDirty = true;
        this._contentDirty = true;
        this._matrix = undefined;
        this._opacity = undefined;
        this._origin = undefined;
        this._size = undefined;
    };

    /**
     * Apply all changes stored in the Surface object to the actual element
     * This includes changes to classes, styles, size, and content, but not
     * transforms or opacities, which are managed by (@link FamousSurfaceManager).
     * 
     * (Scope: Device developers and deeper)
     * @name FamousSurface#commit
     * @function
     */
    FamousSurface.prototype.commit = function(context, matrix, opacity, origin, size) {
        if(!this._currTarget) this.setup(context.getAllocator());
        var target = this._currTarget;

        if(this.size) {
            var origSize = size;
            size = this.size.slice(0);
            if(size[0] === undefined && origSize[0]) size[0] = origSize[0];
            if(size[1] === undefined && origSize[1]) size[1] = origSize[1];
        }

        if(!xyEquals(this._size, size)) {
            this._size = size.slice(0);
            this._sizeDirty = true;
        }

        if(!matrix && this._matrix) {
            this._matrix = undefined;
            this._opacity = 0;
            _setInvisible(target);
            return;
        }

        if(this._opacity !== opacity) {
            this._opacity = opacity;
            target.style.opacity = Math.min(opacity, 0.999999);
        }

        if(!xyEquals(this._origin, origin) || !FM.equals(this._matrix, matrix)) {
            if(!matrix) matrix = FM.identity;
            if(!origin) origin = [0, 0];
            this._origin = origin.slice(0);
            this._matrix = matrix;
            var aaMatrix = matrix;
            if(origin) {
                aaMatrix = FM.moveThen([-this._size[0]*origin[0], -this._size[1]*origin[1]], matrix);
            }
            _setMatrix(target, aaMatrix);
        }

        if(!(this._classesDirty || this._stylesDirty || this._sizeDirty || this._contentDirty)) return;

        if(this._classesDirty) {
            _cleanupClasses.call(this, target);
            var classList = this.getClassList();
            for(var i = 0; i < classList.length; i++) target.classList.add(classList[i]);
            this._classesDirty = false;
        }
        if(this._stylesDirty) {
            _applyStyles.call(this, target);
            this._stylesDirty = false;
        }
        if(this._sizeDirty) {
            if(this._size) {
                target.style.width = (this._size[0] !== true) ? this._size[0] + 'px' : '';
                target.style.height = (this._size[1] !== true) ? this._size[1] + 'px' : '';
            }
            this._sizeDirty = false;
        }
        if(this._contentDirty) {
            this.deploy(target);
            this._contentDirty = false;
        }
    };

    /**
     *  Remove all Famous-relevant attributes from a document element.
     *    This is called by SurfaceManager's detach().
     *    This is in some sense the reverse of .deploy().
     *    Note: If you're trying to destroy a surface, don't use this. 
     *    Just remove it from the render tree.
     * 
     * (Scope: Device developers and deeper)
     * @name FamousSurface#cleanup
     * @function
     * @param {Element} target target document element
     */
    FamousSurface.prototype.cleanup = function(allocator) {
        var target = this._currTarget;
        this.recall(target);
        target.style.width = '';
        target.style.height = '';
        this._size = undefined;
        _cleanupStyles.call(this, target);
        var classList = this.getClassList();
        _cleanupClasses.call(this, target);
        for(var i = 0; i < classList.length; i++) target.classList.remove(classList[i]);
        _unbindEvents.call(this, target);
        this._currTarget = undefined;
        allocator.deallocate(target);
        _setInvisible(target);
    };
    /**
     * Directly output this surface's fully prepared inner document content to 
     *   the provided containing parent element.
     *   This translates to innerHTML in the DOM sense.
     * 
     * (Scope: Device developers and deeper)
     * @name FamousSurface#deploy
     * @function
     * @param {Element} target Document parent of this container
     */
    FamousSurface.prototype.deploy = function(target) {
        var content = this.getContent();
        if(typeof content == 'string') target.innerHTML = content;
        else target.appendChild(content);
    };

    /**
     * Remove any contained document content associated with this surface 
     *   from the actual document.  
     * 
     * (Scope: Device developers and deeper)
     * @name FamousSurface#recall
     * @function
     */
    FamousSurface.prototype.recall = function(target) {
        var df = document.createDocumentFragment();
        while(target.hasChildNodes()) df.appendChild(target.firstChild);
        this.setContent(df);
    };

    /** 
     *  Get the x and y dimensions of the surface.  This normally returns
     *    the size of the rendered surface unless setSize() was called
     *    more recently than setup().
     * 
     * @name FamousSurface#getSize
     * @function
     * @param {boolean} actual return actual size
     * @returns {Array.<number>} [x,y] size of surface
     */
    FamousSurface.prototype.getSize = function(actual) {
        // debugger
        if(actual) return this._size;
        else return this.size || this._size;
    };

    /**
     * Set x and y dimensions of the surface.  This takes effect upon
     *   the next call to this.{#setup()}.
     * 
     * @name FamousSurface#setSize
     * @function
     * @param {Array.<number>} size x,y size array
     */
    FamousSurface.prototype.setSize = function(size) {
        this.size = size ? size.slice(0,2) : undefined;
        this._sizeDirty = true;
    };

    module.exports = FamousSurface;
});

define('famous/ContainerSurface',['require','exports','module','./Surface','./Context'],function(require, exports, module) {
    var Surface = require('./Surface');
    var Context = require('./Context');

    /**
     * @class An object designed to contain surfaces, and set properties
     *   to be applied to all of them at once.
     *
     * @description 
     *  * A container surface will enforce these properties on the 
     *   surfaces it contains:
     *     * size (clips contained surfaces to its own width and height)
     *     * origin
     *     * its own opacity and transform, which will be automatically 
     *       applied to  all Surfaces contained directly and indirectly.
     *   These properties are maintained through a {@link 
     *   SurfaceManager} unique to this Container Surface.
     *   Implementation note: in the DOM case, this will generate a div with 
     *   the style 'containerSurface' applied.
     *   
     * @name ContainerSurface
     * @extends Surface
     * @constructor
     */
    function ContainerSurface(options) {
        Surface.call(this, options);
        this._container = document.createElement('div');
        this._container.classList.add('group');
        this._container.style.width = '100%';
        this._container.style.height = '100%';
        this._container.style.position = 'relative';
        this._shouldRecalculateSize = false;
        this.context = new Context(this._container);
        this.setContent(this._container);
    };

    ContainerSurface.prototype = Object.create(Surface.prototype);
    ContainerSurface.prototype.elementType = 'div';
    ContainerSurface.prototype.elementClass = 'surface';

    ContainerSurface.prototype.link = function() { return this.context.link.apply(this.context, arguments); };
    ContainerSurface.prototype.add = function() { return this.context.add.apply(this.context, arguments); };
    ContainerSurface.prototype.mod = function() { return this.context.mod.apply(this.context, arguments); };

    ContainerSurface.prototype.render = function() {
        if(this._sizeDirty) this._shouldRecalculateSize = true;
        return Surface.prototype.render.call(this);
    };

    ContainerSurface.prototype.commit = function() {
        var result = Surface.prototype.commit.apply(this, arguments);
        if(this._shouldRecalculateSize) {
            this.context.setSize();
            this._shouldRecalculateSize = false;
        }
        this.context.update();
        return result;
    }; 

    module.exports = ContainerSurface;
});


define('famous/Modifier',['require','exports','module','./Matrix','./Transitionable','./Utility'],function(require, exports, module) {
    var Matrix = require('./Matrix');
    var Transitionable = require('./Transitionable');
    var Utility = require('./Utility');

    /**
     *
     * @class A collection of visual changes to be
     *    applied to another renderable component. 
     *
     * @description This collection includes a
     *    transform matrix, an opacity contstant, and an origin specifier. These
     *    are all managed separately inside this object, and each operates
     *    independently. Modifier objects are typically applied within a
     *    {@link FamousRenderNode}. The object's subsequent siblings and children
     *    are transformed by the amounts specified in the object's properties.
     *
     * Renaming suggestion: Change parameters named "transform" to 
     * "transformMatrix" in here.
     *    
     * @name Modifier
     * @constructor
     */ 
    function Modifier(opts) {
        var transform = Matrix.identity;
        var opacity = 1;
        var origin = undefined;
        var size = undefined;

        /* maintain backwards compatibility for scene compiler */
        if(arguments.length > 1 || arguments[0] instanceof Array) {
            if(arguments[0] !== undefined) transform = arguments[0];
            if(arguments[1] !== undefined) opacity = arguments[1];
            origin = arguments[2];
            size = arguments[3];
        }
        else if(opts) {
            if(opts.transform) transform = opts.transform;
            if(opts.opacity !== undefined) opacity = opts.opacity;
            if(opts.origin) origin = opts.origin;
            if(opts.size) size = opts.size;
        }

        this.transformTranslateState = new Transitionable([0, 0, 0]);
        this.transformRotateState = new Transitionable([0, 0, 0]);
        this.transformSkewState = new Transitionable([0, 0, 0]);
        this.transformScaleState = new Transitionable([1, 1, 1]);
        this.opacityState = new Transitionable(opacity);
        this.originState = new Transitionable([0, 0]);
        this.sizeState = new Transitionable([0, 0]);

        this._originEnabled = false;
        this._sizeEnabled = false;

        this.setTransform(transform);
        this.setOpacity(opacity);
        this.setOrigin(origin);
        this.setSize(size);
    };

    /**
     * Get current interpolated positional transform matrix at this point in
     *    time.
     * (Scope: Component developers and deeper)
     *
     * @name Modifier#getTransform
     * @function
     *  
     * @returns {FamousMatrix} webkit-compatible positional transform matrix.
     */
    Modifier.prototype.getTransform = function() {
        if(this.isActive()) {
            return Matrix.build({
                translate: this.transformTranslateState.get(),
                rotate: this.transformRotateState.get(),
                skew: this.transformSkewState.get(),
                scale: this.transformScaleState.get()
            });
        }
        else return this.getFinalTransform();
    };

    /**
     * Get most recently provided end state positional transform matrix.
     * (Scope: Component developers and deeper)
     * 
     * @name Modifier#getFinalTransform
     * @function
     * 
     * @returns {FamousMatrix} webkit-compatible positional transform matrix.
     */
    Modifier.prototype.getFinalTransform = function() {
        return this._finalTransform;
    };

    /**
     * Add positional transformation to the internal queue. Special Use: calling
     *    without a transition resets the object to that state with no pending
     *    actions Note: If we called setTransform in that "start state" way,
     *    then called with a transition, we begin form that start state.
     * 
     * @name Modifier#setTransform
     * @function
     *    
     * @param {FamousMatrix} transform end state positional transformation to
     *    which we interpolate
     * @param {transition=} transition object of type {duration: number, curve:
     *    f[0,1] -> [0,1] or name}
     * @param {function()=} callback Zero-argument function to call on observed
     *    completion (t=1)
     */
    Modifier.prototype.setTransform = function(transform, transition, callback) {
        var _callback = callback ? Utility.after(4, callback) : undefined;
        if(transition) {
            if(this._transformDirty) {
                var startState = Matrix.interpret(this.getFinalTransform());
                this.transformTranslateState.set(startState.translate);
                this.transformRotateState.set(startState.rotate);
                this.transformSkewState.set(startState.skew);
                this.transformScaleState.set(startState.scale);
                this._transformDirty = false;
            }
            var endState = Matrix.interpret(transform);
            this.transformTranslateState.set(endState.translate, transition, _callback);
            this.transformRotateState.set(endState.rotate, transition, _callback);
            this.transformSkewState.set(endState.skew, transition, _callback);
            this.transformScaleState.set(endState.scale, transition, _callback);
        }
        else {
            this.transformTranslateState.halt();
            this.transformRotateState.halt();
            this.transformSkewState.halt();
            this.transformScaleState.halt();
            this._transformDirty = true;
        }
        this._finalTransform = transform;
    };

    /**
     * Get current interpolated opacity constant at this point in time.
     * 
     * @name Modifier#getOpacity
     * @function
     * 
     * @returns {number} interpolated opacity number. float w/ range [0..1]
     */
    Modifier.prototype.getOpacity = function() {
        return this.opacityState.get();
    };

    /**
     * Add opacity transformation to the internal queue. Special Use: calling
     *    without a transition resets the object to that state with no pending
     *    actions.
     * 
     * @name Modifier#setOpacity
     * @function
     *    
     * @param {number} opacity end state opacity constant to which we interpolate
     * @param {transition=} transition object of type 
     *    {duration: number, curve: f[0,1] -> [0,1] or name}. If undefined, 
     *    opacity change is instantaneous.
     * @param {function()=} callback Zero-argument function to call on observed
     *    completion (t=1)
     */ 
    Modifier.prototype.setOpacity = function(opacity, transition, callback) {
        this.opacityState.set(opacity, transition, callback);
    };

    /**
     * Get current interpolated origin pair at this point in time.
     *
     * @returns {Array.<number>} interpolated origin pair
     */
    Modifier.prototype.getOrigin = function() {
        return this._originEnabled ? this.originState.get() : undefined;
    };

    /**
     * Add origin transformation to the internal queue. Special Use: calling
     *    without a transition resets the object to that state with no pending
     *    actions
     * 
     * @name Modifier#setOrigin
     * @function
     *    
     * @param {Array.<number>} origin end state origin pair to which we interpolate
     * @param {transition=} transition object of type 
     *    {duration: number, curve: f[0,1] -> [0,1] or name}. if undefined, 
     *    opacity change is instantaneous.
     * @param {function()=} callback Zero-argument function to call on observed
     *    completion (t=1)
     */
    Modifier.prototype.setOrigin = function(origin, transition, callback) {
        this._originEnabled = !!origin;
        if(!origin) origin = [0, 0];
        if(!(origin instanceof Array)) origin = Utility.origins[origin];
        this.originState.set(origin, transition, callback);
    };

    /**
     * Get current interpolated size at this point in time.
     *
     * @returns {Array.<number>} interpolated size
     */
    Modifier.prototype.getSize = function() {
        return this._sizeEnabled ? this.sizeState.get() : undefined;
    };

    /**
     * Add size transformation to the internal queue. Special Use: calling
     *    without a transition resets the object to that state with no pending
     *    actions
     * 
     * @name Modifier#setSize
     * @function
     *    
     * @param {Array.<number>} size end state size to which we interpolate
     * @param {transition=} transition object of type 
     *    {duration: number, curve: f[0,1] -> [0,1] or name}. if undefined, 
     *    opacity change is instantaneous.
     * @param {function()=} callback Zero-argument function to call on observed
     *    completion (t=1)
     */
    Modifier.prototype.setSize = function(size, transition, callback) {
        this._sizeEnabled = !!size;
        if(!size) size = [0, 0];
        this.sizeState.set(size, transition, callback);
    };

    /**
     * Copy object to internal "default" transition. Missing properties in
     *    provided transitions inherit from this default.
     * 
     * (Scope: Component developers and deeper)
     * @name Modifier#setDefaultTransition
     * @function
     *    
     * @param {transition} transition {duration: number, curve: f[0,1] -> [0,1]}
     */
    Modifier.prototype.setDefaultTransition = function(transition) {
        this.transformTranslateState.setDefault(transition);
        this.transformRotateState.setDefault(transition);
        this.transformSkewState.setDefault(transition);
        this.transformScaleState.setDefault(transition);

        this.opacityState.setDefault(transition);
        this.originState.setDefault(transition);
        this.sizeState.setDefault(transition);
    };

    /**
     * Halt the entire transformation at current state.
     * (Scope: Component developers and deeper)
     * 
     * @name Modifier#halt
     * @function
     */
    Modifier.prototype.halt = function() {
        this.transformTranslateState.halt();
        this.transformRotateState.halt();
        this.transformSkewState.halt();
        this.transformScaleState.halt();

        this.opacityState.halt();
        this.originState.halt();
        this.sizeState.halt();
    };

    /**
     * Have we reached our end state in the motion transform?
     * 
     * @name Modifier#isActive
     * @function
     * 
     * @returns {boolean} 
     */
    Modifier.prototype.isActive = function() {
        return this.transformTranslateState.isActive() ||
            this.transformRotateState.isActive() ||
            this.transformSkewState.isActive() ||
            this.transformScaleState.isActive();
    };

    /**
     * * Return {@renderSpec} for this Modifier, applying to the provided
     *    target component. The transform will be applied to the entire target
     *    tree in the following way: 
     *    * Positional Matrix (this.getTransform) - Multiplicatively 
     *    * Opacity (this.getOpacity) - Applied multiplicatively.
     *    * Origin (this.getOrigin) - Children shadow parents
     *
     * (Scope: Component developers and deeper)
     * 
     * @name Modifier#render
     * @function
     * 
     * @param {renderSpec} target (already rendered) renderable component to
     *    which to apply the transform.
     * @returns {renderSpec} render spec for this Modifier, including the
     *    provided target
     */
    Modifier.prototype.render = function(target) {
        return {transform: this.getTransform(), opacity: this.getOpacity(), origin: this.getOrigin(), size: this.getSize(), target: target};
    };

    module.exports = Modifier;
});

define('famous/OptionsManager',['require','exports','module','./EventHandler'],function(require, exports, module) {
    var EventHandler = require('./EventHandler');

    /** @constructor */
    function OptionsManager(value) {
        this._value = value;
        this.eventOutput = null;
    };

    function _createEventOutput() {
        this.eventOutput = new EventHandler();
        this.eventOutput.bindThis(this);
        EventHandler.setOutputHandler(this, this.eventOutput);
    };

    OptionsManager.prototype.patch = function() {
        var myState = this._value;
        for(var i = 0; i < arguments.length; i++) {
            var patch = arguments[i];
            for(var k in patch) {
                if((k in myState) && (typeof myState[k] === 'object') && !(myState[k] instanceof Array) && (typeof patch[k] === 'object') && !(patch[k] instanceof Array)) {
                    if(!myState.hasOwnProperty(k)) myState[k] = Object.create(myState[k]);
                    this.key(k).patch(patch[k]);
                    if(this.eventOutput) this.eventOutput.emit('change', {id: k, value: this.key(k).value()});
                }
                else this.set(k, patch[k]);
            }
        }
        return this;
    };
    OptionsManager.prototype.setOptions = OptionsManager.prototype.patch;

    OptionsManager.prototype.key = function(key) {
        var result = new OptionsManager(this._value[key]);
        if(!(result._value instanceof Object) || result._value instanceof Array) result._value = {};
        return result;
    };

    OptionsManager.prototype.get = function(key) {
        return this._value[key];
    };
    OptionsManager.prototype.getOptions = OptionsManager.prototype.get;

    OptionsManager.prototype.set = function(key, value) {
        var originalValue = this.get(key);
        this._value[key] = value;
        if(this.eventOutput && value !== originalValue) this.eventOutput.emit('change', {id: key, value: value});
        return this;
    };

    OptionsManager.prototype.value = function() {
        return this._value;
    };

    /* These will be overridden once this.eventOutput is created */
    OptionsManager.prototype.on = function() { _createEventOutput.call(this); return this.on.apply(this, arguments); }
    OptionsManager.prototype.unbind = function() { _createEventOutput.call(this); return this.unbind.apply(this, arguments); }
    OptionsManager.prototype.pipe = function() { _createEventOutput.call(this); return this.pipe.apply(this, arguments); }
    OptionsManager.prototype.unpipe = function() { _createEventOutput.call(this); return this.unpipe.apply(this, arguments); }

    module.exports = OptionsManager;
});

define('famous/View',['require','exports','module','./RenderNode','./EventHandler','./OptionsManager'],function(require, exports, module) { 
    var RenderNode = require('./RenderNode');
    var EventHandler = require('./EventHandler');
    var OptionsManager = require('./OptionsManager');

    function View(options) {
        this.node = new RenderNode();

        this.eventInput = new EventHandler();
        this.eventOutput = new EventHandler();
        EventHandler.setInputHandler(this, this.eventInput);
        EventHandler.setOutputHandler(this, this.eventOutput);

        this.options = Object.create(this.constructor.DEFAULT_OPTIONS || View.DEFAULT_OPTIONS);
        this.optionsManager = new OptionsManager(this.options);

        if(options) this.setOptions(options);
    };

    View.DEFAULT_OPTIONS = null; // no defaults

    View.prototype.getOptions = function() {
        return this.optionsManager.value();
    };

    View.prototype.setOptions = function(options) {
        this.optionsManager.patch(options);
    };

    View.prototype._add = function() { return this.node.add.apply(this.node, arguments); };
    View.prototype._link = function() { return this.node.link.apply(this.node, arguments); };

    View.prototype.render =  function() {
        return this.node.render.apply(this.node, arguments);
    };

    View.prototype.getSize = function() {
        var target = this.node.get();
        if(target.getSize) return target.getSize.apply(target, arguments);
        else return this.options.size;
    };

    module.exports = View;
});

define('famous-utils/Time',['require','exports','module','famous/Engine'],function(require, exports, module) { 
    var FamousEngine = require('famous/Engine');

    function setInterval(func, duration) { 
        var t = Date.now();
        var execute = function() { 
            var t2 = Date.now();
            if(t2 - t >= duration) { 
                func(); 
                t = Date.now();
            }
        }
        FamousEngine.on('prerender', execute);
        return execute;
    };
    function removeInterval(func) {
        FamousEngine.unbind('prerender', func);
    };
    function executeOver(duration, func, callback) { 
        var t = Date.now();
        var execute = function(){
            var t2 = Date.now();
            var percent = (t2 - t) / duration;

            if (t2 - t >= duration){
                func(1); // 100% complete
                FamousEngine.unbind('prerender', execute);
                if(callback) callback();
                return;
            } else { 
                func(percent);
            }
        };
        FamousEngine.on('prerender', execute);
    };
    function setTimeout(func, duration) { 
        var t = Date.now();
        var execute = function() {
            var t2 = Date.now();
            if(t2 - t >= duration) {
                FamousEngine.unbind('prerender', execute);
                func()
                return;
            }
        }
        FamousEngine.on('prerender', execute);
        return execute;
    };
    function removeTimeout(func) { 
        FamousEngine.unbind('prerender', func);
    }

    module.exports = {
        setInterval: setInterval,
        removeInterval: removeInterval,
        executeOver: executeOver,
        setTimeout: setTimeout,
        removeTimeout: removeTimeout
    }

});

define('famous-physics/math/Vector',['require','exports','module'],function(require, exports, module) {

    /**
     * @class An immutable three-element floating point vector.
     *
     * @description Note that if not using the "out" parameter,
     *    then funtions return a common reference to an internal register.
     *    
     * * Class/Namespace TODOs:
     *   * Are there any vector STANDARDS in JS that we can use instead of our own library?
     *   * Is it confusing that this is immutable?
     *   * All rotations are counter-clockwise in a right-hand system.  Need to doc this 
     *     somewhere since Famous render engine's rotations are left-handed (clockwise)
     * 
     * Constructor: Take three elts or an array and make new vec.
     *    
     * @name Vector
     * @constructor
     */ 
    function Vector(x,y,z){
        if (arguments.length === 1) this.set(x)
        else{
            this.x = x || 0.0;
            this.y = y || 0.0;
            this.z = z || 0.0;
        };
        return this;
    };

    var register = new Vector(0,0,0);

    /**
     * Add to another Vector, element-wise.
     *
     * @name Vector#add
     * @function
     * @returns {Vector}
     */
    Vector.prototype.add = function(v, out){
        out = out || register;
        return out.setXYZ(
            this.x + (v.x || 0.0),
            this.y + (v.y || 0.0),
            this.z + (v.z || 0.0)
        );
    };

    /**
     * Subtract from another Vector, element-wise.
     *    
     * @name Vector#sub
     * @function
     * @returns {Vector}
     */
    Vector.prototype.sub = function(v, out){
        out = out || register;
        return out.setXYZ(
            this.x - v.x,
            this.y - v.y,
            this.z - v.z
        );
    };

    /**
     * Scale Vector by floating point r.
     *    
     * @name Vector#mult
     * @function
     * @returns {number}
     */
    Vector.prototype.mult = function(r, out){
        out = out || register;
        return out.setXYZ(
            r * this.x,
            r * this.y,
            r * this.z
        );
    };

    /**
     * Scale Vector by floating point 1/r.
     *    
     * @name Vector#div
     * @function
     * @returns {number}
     */
    Vector.prototype.div = function(r, out){
        return this.mult(1/r, out);
    };

    /**
     * Return cross product with another Vector
     *    
     * @name Vector#cross
     * @function
     * @returns {Vector}
     */
    Vector.prototype.cross = function(v, out){
        out = out || register;
        return out.setXYZ(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );

        //corrects for reversed y-axis
//        return out.setXYZ(
//            -this.y * v.z + this.z * v.y,
//             this.z * v.x - this.x * v.z,
//            -this.x * v.y + this.y * v.x
//        );
    };

    /**
     * Component-wise equality test between this and Vector v.
     * @name Vector#equals
     * @function
     * @returns {boolean}
     */
    Vector.prototype.equals = function(v){
        return (v.x == this.x && v.y == this.y && v.z == this.z);
    };

    /**
     * Rotate counter-clockwise around x-axis by theta degrees.
     *
     * @name Vector#rotateX
     * @function
     * @returns {Vector}
     */
    Vector.prototype.rotateX = function(theta, out){
        out = out || register;
        var x = this.x;
        var y = this.y;
        var z = this.z;

        var cosTheta = Math.cos(theta);
        var sinTheta = Math.sin(theta);

        return out.setXYZ(
             x,
            -z * sinTheta + y * cosTheta,
             z * cosTheta - y * sinTheta
        );
    };

    /**
     * Rotate counter-clockwise around y-axis by theta degrees.
     *
     * @name Vector#rotateY
     * @function
     * @returns {Vector}
     */
    Vector.prototype.rotateY = function(theta, out){
        out = out || register;
        var x = this.x;
        var y = this.y;
        var z = this.z;

        var cosTheta = Math.cos(theta);
        var sinTheta = Math.sin(theta);

        return out.setXYZ(
            -z * sinTheta + x * cosTheta,
            y,
            z * cosTheta + x * sinTheta
        );
    };

    /**
     * Rotate counter-clockwise around z-axis by theta degrees.
     *
     * @name Vector#rotateZ
     * @function
     * @returns {Vector}
     */
    Vector.prototype.rotateZ = function(theta, out){
        out = out || register;
        var x = this.x;
        var y = this.y;
        var z = this.z;

        var cosTheta = Math.cos(theta);
        var sinTheta = Math.sin(theta);

        return out.setXYZ(
            -y * sinTheta + x * cosTheta,
             y * cosTheta + x * sinTheta,
             z
        );
    };

    /**
     * Take dot product of this with a second Vector
     *       
     * @name Vector#dot
     * @function
     * @returns {number}
     */
    Vector.prototype.dot = function(v){
        return this.x * v.x + this.y * v.y + this.z * v.z;
    };

    /**
     * Take dot product of this with a this Vector
     *
     * @name Vector#normSquared
     * @function
     * @returns {number}
     */
    Vector.prototype.normSquared = function(){
        return this.dot(this);
    };

    /**
     * Find Euclidean length of the Vector.
     *       
     * @name Vector#norm
     * @function
     * @returns {number}
     */
    Vector.prototype.norm = function(){
        return Math.sqrt(this.normSquared());
    };

    /**
     * Scale Vector to specified length.
     * If length is less than internal tolerance, set vector to [length, 0, 0].
     * 
     * * TODOs: 
     *    * There looks to be a bug or unexplained behavior in here.  Why would
     *      we defer to a multiple of e_x for being below tolerance?
     *  
     * @name Vector#normalize
     * @function
     * @returns {Vector}
     */
    Vector.prototype.normalize = function(length, out){
        length  = (length !== undefined) ? length : 1.0;
        out     = out || register;

        var tolerance = 1e-7;
        var norm = this.norm();

        if (Math.abs(norm) > tolerance) return this.mult(length / norm, out);
        else return out.setXYZ(length, 0.0, 0.0);
    };

    /**
     * Make a separate copy of the Vector.
     *
     * @name Vector#clone
     * @function
     * @returns {Vector}
     */
    Vector.prototype.clone = function(){
        return new Vector(this);
    };

    /**
     * True if and only if every value is 0 (or falsy)
     *
     * @name Vector#isZero
     * @function
     * @returns {boolean}
     */
    Vector.prototype.isZero = function(){
        return !(this.x || this.y || this.z);
    };

    /**
     * Set this Vector to the values in the provided Array or Vector.
     *
     * TODO: set from Array disambiguation
     *
     * @name Vector#set
     * @function
     * @returns {Vector}
     */
    Vector.prototype.set = function(v){
        if (v instanceof Array){
            this.setFromArray(v);
        }
        else{
            this.x = v.x;
            this.y = v.y;
            this.z = v.z || 0.0;
        }
        if (this !== register) register.clear();
        return this;
    };

    Vector.prototype.setFromArray = function(v){
        this.x = v[0];
        this.y = v[1];
        this.z = v[2] || 0.0;
    };

    /**
     * Put result of last internal calculation in 
     *   specified output vector.
     *
     * @name Vector#put
     * @function
     * @returns {Vector}
     */
    Vector.prototype.put = function(v){
        v.set(register);
    };

    /**
     * Set elements directly and clear internal register.
     *   This is the a "mutating" method on this Vector.
     *  
     *
     * @name Vector#setXYZ
     * @function
     */
    Vector.prototype.setXYZ = function(x,y,z){
        register.clear();
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    };

    /**
     * Set elements to 0.
     *
     * @name Vector#clear
     * @function
     */
    Vector.prototype.clear = function(){
        this.x = 0;
        this.y = 0;
        this.z = 0;
    };

    /**
     * Scale this Vector down to specified "cap" length.
     * If Vector shorter than cap, or cap is Infinity, do nothing.
     *
     * 
     * @name Vector#cap
     * @function
     * @returns {Vector}
     */
    Vector.prototype.cap = function(cap, out){
        if (cap === Infinity) return this;
        out = out || register;
        var norm = this.norm();
        if (norm > cap) return this.normalize(cap, out);
        else return this;
    };

    /**
     * Return projection of this Vector onto another.
     * 
     * @name Vector#project
     * @function
     * @returns {Vector}
     */
    Vector.prototype.project = function(n, out){
        out = out || register;
        return n.mult(this.dot(n), out);
    };

    /**
     * Reflect this Vector across provided vector.
     *
     * @name Vector#reflect
     * @function
     */
    Vector.prototype.reflectAcross = function(n, out){
        out = out || register;
        n.normalize();
        return this.sub(this.project(n).mult(2), out);
    };

    /**
     * Convert Vector to three-element array.
     * 
     * * TODOs: 
     *   * Why do we have this and get()?
     *       
     * @name Vector#toArray
     * @function
     */
    Vector.prototype.toArray = function(){
        return [this.x, this.y, this.z];
    };

    /**
     * Convert Vector to three-element array.
     * 
     * * TODOs: 
     *   * Why do we have this and toArray()?
     *           
     * @name Vector#get
     * @function
     */
    Vector.prototype.get = function(){
        return this.toArray();
    };

    module.exports = Vector;

});

define('famous-physics/bodies/Particle',['require','exports','module','famous/RenderNode','famous-physics/math/Vector','famous/Matrix'],function(require, exports, module) {
    var RenderNode = require('famous/RenderNode');
    var Vector = require('famous-physics/math/Vector');
    var FM = require('famous/Matrix');

    /**
     *
     * @class A unit controlled by the physics engine which serves to provide position. 
     *
     * @description This is essentially the state object for the a particle's
     *    fundamental properties of position, velocity, acceleration, and force,
     *    which makes its position available through the render() function.
     *    Legal opts: (p)osition, (v)elocity, (a)cceleration, (f)orce, (m)ass,
     *       restitution, and dissipation.
     * 
     *
     * * Class/Namespace TODOs
     *
     * @name Particle
     * @constructor
     */     
     function Particle(opts){
        opts = opts || {};

        this.p = (opts.p) ? new Vector(opts.p) : new Vector(0,0,0);
        this.v = (opts.v) ? new Vector(opts.v) : new Vector(0,0,0);
        this.f = (opts.f) ? new Vector(opts.f) : new Vector(0,0,0);

        //scalars
        this.m           = (opts.m           !== undefined) ? opts.m           : 1;         //mass
        this.restitution = (opts.restitution !== undefined) ? opts.restitution : 0.5;       //collision damping
        this.dissipation = (opts.dissipation !== undefined) ? opts.dissipation : 0;         //velocity damping
        this.axis        = (opts.axis        !== undefined) ? opts.axis        : undefined; //TODO: find better solution

        this.setImmunity(opts.immunity || Particle.IMMUNITIES.NONE);

        this.mInv = 1 / this.m;
        this.size = [0,0,0];    //bounding box

        this.node = undefined;
        this.spec = {
            size : [0,0],
            target : {
                origin : [0.5,0.5],
                transform : undefined,
                target : undefined
            }
        };
    };

    Particle.AXIS = {
        X   : 0x0001,
        Y   : 0x0002,
        Z   : 0x0004
    };

    Particle.IMMUNITIES = {
        NONE     : 0x0000,
        POSITION : 0x0001,
        VELOCITY : 0x0002,
        ROTATION : 0x0004,
        AGENTS   : 0x0008,
        UPDATE   : 0x0010
    };

    for (var key in Particle.IMMUNITIES)
        Particle.IMMUNITIES.ALL |= Particle.IMMUNITIES[key];

        /**
     * Basic setter function for position Vector  
     * @name Particle#setPos
     * @function
     */
    Particle.prototype.setPos = function(p){
        this.p.set(p);
    };

    /**
     * Basic getter function for position Vector 
     * @name Particle#getPos
     * @function
     */
    Particle.prototype.getPos = function(){
        return this.p.get();
    };

    /**
     * Basic setter function for velocity Vector 
     * @name Particle#setVel
     * @function
     */
    Particle.prototype.setVel = function(v){
        if (this.hasImmunity(Particle.IMMUNITIES.VELOCITY)) return;
        this.v.set(v);
    };

    /**
     * Basic getter function for velocity Vector 
     * @name Particle#getVel
     * @function
     */
    Particle.prototype.getVel = function(){
        return this.v.get();
    };

    /**
     * Basic setter function for mass quantity 
     * @name Particle#setMass
     * @function
     */
    Particle.prototype.setMass = function(m){
        this.m = m; this.mInv = 1 / m;
    };

    /**
     * Basic getter function for mass quantity 
     * @name Particle#getMass
     * @function
     */
    Particle.prototype.getMass = function(){
        return this.m;
    };

    Particle.prototype.addImmunity = function(immunity){
        if (typeof immunity == 'string') immunity = Particle.IMMUNITIES[immunity.toUpperCase()];
        this.immunity |= immunity;
    };

    Particle.prototype.removeImmunity = function(immunity){
        if (typeof immunity == 'string') immunity = Particle.IMMUNITIES[immunity.toUpperCase()];
        this.immunity &= ~immunity;
    };

    Particle.prototype.setImmunity = function(immunity){
        if (typeof immunity == 'string') immunity = Particle.IMMUNITIES[immunity.toUpperCase()];
        this.immunity = immunity;
    };

    Particle.prototype.hasImmunity = function(immunity){
        if (typeof immunity == 'string') immunity = Particle.IMMUNITIES[immunity.toUpperCase()];
        return (this.getImmunity() & immunity);
    }

    /**
     * Basic getter function for immunity
     * @name Particle#getImmunity
     * @function
     */
    Particle.prototype.getImmunity = function(){
        return this.immunity;
    };

    /**
     * Set position, velocity, force, and accel Vectors each to (0, 0, 0)
     * @name Particle#reset
     * @function
     */
    Particle.prototype.reset = function(p,v){
        p = p || [0,0,0];
        v = v || [0,0,0];
        this.setPos(p);
        this.setVel(v);
    };

    /**
     * Add force Vector to existing internal force Vector
     * @name Particle#applyForce
     * @function
     */
    Particle.prototype.applyForce = function(force){
        if (this.hasImmunity(Particle.IMMUNITIES.AGENTS)) return;
        this.f.set(this.f.add(force));
    };

    /**
     * Add impulse (force*time) Vector to this Vector's velocity. 
     * @name Particle#applyImpulse
     * @function
     */
    Particle.prototype.applyImpulse = function(impulse){
        if (this.hasImmunity(Particle.IMMUNITIES.AGENTS)) return;
        this.setVel(this.v.add(impulse.mult(this.mInv)));
    };

    /**
     * Get kinetic energy of the particle.
     * @name Particle#getEnergy
     * @function
     */
    Particle.prototype.getEnergy = function(){
        return 0.5 * this.m * this.v.normSquared();
    };

    /**
     * Generate current positional transform from position (calculated)
     *   and rotation (provided only at construction time)
     * @name Particle#getTransform
     * @function
     */
    Particle.prototype.getTransform = function(){
        var p    = this.p;
        var axis = this.axis;

        if (axis !== undefined){
            if (axis & ~Particle.AXIS.X) {p.x = 0};
            if (axis & ~Particle.AXIS.Y) {p.y = 0};
            if (axis & ~Particle.AXIS.Z) {p.z = 0};
        };

        return FM.translate(p.x, p.y, p.z);
    };

    /**
     * Declare that this Particle's position will affect the provided node
     *    in the render tree.
     * 
     * @name Particle#link
     * @function
     *    
     * @returns {FamousRenderNode} a new render node for the provided
     *    renderableComponent.
     */
    Particle.prototype.link = function(obj){
        if (!this.node) this.node = new RenderNode();
        return this.node.link(obj);
    };

    Particle.prototype.add = function(obj){
        if (!this.node) this.node = new RenderNode();
        return this.node.add(obj);
    };

    Particle.prototype.replace = function(obj){
        this.node.object = obj;
    };

    /**
     * Return {@link renderSpec} of this particle.  This will render the render tree
     *   attached via #from and adjusted by the particle's caluculated position
     *
     * @name Particle#render
     * @function
     */

    Particle.prototype.render = function(target){
        target = (target !== undefined) ? target : this.node.render();
        this.spec.target.transform = this.getTransform();
        this.spec.target.target = target;
        return this.spec;
    };

    module.exports = Particle;

});
define('famous-physics/math/Quaternion',['require','exports','module'],function(require, exports, module) {

    /**
     * @constructor
     */
    function Quaternion(w,x,y,z){
        if (arguments.length == 1) this.set(w)
        else{
            this.w = (w !== undefined) ? w : 1.0;  //Angle
            this.x = x || 0.0;  //Axis.x
            this.y = y || 0.0;  //Axis.y
            this.z = z || 0.0;  //Axis.z
        };
        return this;
    };

    var register = new Quaternion(1,0,0,0);

    Quaternion.prototype.add = function(q, out){
        out = out || register;
        return out.setWXYZ(
            this.w + q.w,
            this.x + q.x,
            this.y + q.y,
            this.z + q.z
        );
    };

    Quaternion.prototype.sub = function(q, out){
        out = out || register;
        return out.setWXYZ(
            this.w - q.w,
            this.x - q.x,
            this.y - q.y,
            this.z - q.z
        );
    };

    Quaternion.prototype.scalarDivide = function(s, out){
        out = out || register;
        return this.scalarMult(1/s, out);
    };

    Quaternion.prototype.scalarMult = function(s, out){
        out = out || register;
        return out.setWXYZ(
            this.w * s,
            this.x * s,
            this.y * s,
            this.z * s
        );
    };

    Quaternion.prototype.multiply = function(q, out){
        out = out || register;
        var x = this.x, y = this.y, z = this.z, w = this.w;
        var qx = q.x, qy = q.y, qz = q.z, qw = q.w;
        return out.setWXYZ(
            w*qw - x*qx - y*qy - z*qz,
            w*qx + x*qw + y*qz - z*qy,
            w*qy - x*qz + y*qw + z*qx,
            w*qz + x*qy - y*qx + z*qw
        );
    };

    Quaternion.prototype.vectorMultiply = function(v, out){
        out = out || register;
        v.w = 0;
        return out.set(this.inverse().multiply(v).multiply(this));
    };

    Quaternion.prototype.inverse = function(out){
        out = out || register;
        return this.conj().scalarDivide(this.normSquared(), out);
    };

    Quaternion.prototype.negate = function(out){
        out = out || register;
        return this.scalarMult(-1, out);
    };

    Quaternion.prototype.conj = function(out){
        out = out || register;
        return out.setWXYZ(
            this.w,
            -this.x,
            -this.y,
            -this.z
        );
    };

    Quaternion.prototype.normalize = function(out){
        out = out || register;
        var norm = this.norm();
        if (Math.abs(norm) < 1e-7)
            return out.setWXYZ(1,0,0,0);
        else
            return this.scalarDivide(norm, out);
    };

    Quaternion.prototype.makeFromAngleAndAxis = function(angle, v){
        v.normalize(1, v);
        var ha = angle*0.5;
        var s = Math.sin(ha);
        this.x = s*v.x;
        this.y = s*v.y;
        this.z = s*v.z;
        this.w = Math.cos(ha);
        return this;
    };

    Quaternion.prototype.getAngle = function(){
        return 2*Math.acos(this.w);
    };

    Quaternion.prototype.getAxis = function(){
        //sin(acos(x)) = sqrt(1 - x^2)
        var w = this.w;
        if (w >= 1) return [0,0,0]
        else {
            var s = 1 / Math.sqrt(1 - w*w);
            return [s*this.x, s*this.y, this.z];
        };
    };

    Quaternion.prototype.setWXYZ = function(w,x,y,z){
        register.clear();
        this.w = w;
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    };

    Quaternion.prototype.set = function(v){
        if (v instanceof Array){
            this.w = v[0];
            this.x = v[1];
            this.y = v[2];
            this.z = v[3];
        }
        else{
            this.w = v.w;
            this.x = v.x;
            this.y = v.y;
            this.z = v.z;
        }
        if (this !== register) register.clear();
        return this;
    };

    Quaternion.prototype.put = function(quat){
        quat.set(register);
    };

    Quaternion.prototype.clone = function(){
        return new Quaternion(this);
    };

    Quaternion.prototype.clear = function(){
        this.w = 1.0;
        this.x = 0.0;
        this.y = 0.0;
        this.z = 0.0;
        return this;
    };

    Quaternion.prototype.isEqual = function(q){
        return (q.w == this.w && q.x == this.x && q.y == this.y && q.z == this.z);
    };

    Quaternion.prototype.dot = function(q){
        return (this.w*q.w + this.x*q.x + this.y*q.y + this.z*q.z);
    };

    Quaternion.prototype.normSquared = function(){
        return this.dot(this);
    };

    Quaternion.prototype.norm = function(){
        return Math.sqrt(this.normSquared());
    };

    Quaternion.prototype.isZero = function(){
        return !(this.x || this.y || this.z || this.w != 1);
    };

    Quaternion.prototype.zeroRotation = function(){
        this.x = 0; this.y = 0; this.z = 0; this.w = 1.0;
        return this;
    };

    Quaternion.prototype.getMatrix = function(){
        var inv_norm = 1 / this.norm();
        var x = this.x * inv_norm,
            y = this.y * inv_norm,
            z = this.z * inv_norm,
            w = this.w * inv_norm;

        //TODO: correct for y-axis direction
        return [
            1 - 2*y*y - 2*z*z,
              - 2*x*y - 2*z*w,
                2*x*z - 2*y*w,
            0,
              - 2*x*y + 2*z*w,
            1 - 2*x*x - 2*z*z,
              - 2*y*z - 2*x*w,
            0,
                2*x*z + 2*y*w,
              - 2*y*z + 2*x*w,
            1 - 2*x*x - 2*y*y,
            0,
            0,
            0,
            0,
            1
        ];
    };

    var epsilon  = 1e-5;
    Quaternion.prototype.slerp = function(q, t, out){
        out = out || register;
        var omega, cosomega, sinomega, scaleFrom, scaleTo;

        cosomega = this.dot(q);

        if (cosomega < 0.0) cosomega *= -1;

        if( (1.0 - cosomega) > epsilon ){
            omega       = Math.acos(cosomega);
            sinomega    = Math.sin(omega);
            scaleFrom   = Math.sin( (1.0 - t) * omega ) / sinomega;
            scaleTo     = Math.sin( t * omega ) / sinomega;
        }
        else {
            scaleFrom   = 1.0 - t;
            scaleTo     = t;
        };

        return this.scalarMult(scaleFrom/scaleTo).add(q).mult(scaleTo, out);
    };

    module.exports = Quaternion;

});
define('famous-physics/bodies/Body',['require','exports','module','./Particle','famous-physics/math/Vector','famous-physics/math/Quaternion','famous/Matrix'],function(require, exports, module) {
    var Particle = require('./Particle');
    var Vector = require('famous-physics/math/Vector');
    var Quaternion = require('famous-physics/math/Quaternion');
    var FM = require('famous/Matrix');

    function Body(opts){
        Particle.call(this, opts);

        this.q = (opts.q) ? new Quaternion(opts.q) : new Quaternion();  //orientation
        this.w = (opts.w) ? new Vector(opts.w) : new Vector();          //angular velocity
        this.L = (opts.L) ? new Vector(opts.L) : new Vector();          //angular momentum
        this.t = (opts.t) ? new Vector(opts.t) : new Vector();          //torque

        this.I    = [1,0,0,1,0,0,1,0,0];   //inertia tensor
        this.Iinv = [1,0,0,1,0,0,1,0,0];   //inverse inertia tensor
        this.w.w  = 0;                     //quaternify the angular velocity

        //register
        this.pWorld = new Vector();        //placeholder for world space position
    };

    Body.prototype = Object.create(Particle.prototype);
    Body.prototype.constructor = Body;

    Body.IMMUNITIES = Particle.IMMUNITIES;

    Body.prototype.updateAngularVelocity = function(){
        var Iinv = this.Iinv;
        var L = this.L;
        var Lx = L.x, Ly = L.y, Lz = L.z;
        var I0 = Iinv[0], I1 = Iinv[1], I2 = Iinv[2];
        
        this.w.setXYZ(
            I0[0] * Lx + I0[1] * Ly + I0[2] * Lz,
            I1[0] * Lx + I1[1] * Ly + I1[2] * Lz,
            I2[0] * Lx + I2[1] * Ly + I2[2] * Lz
        );
    };

    Body.prototype.toWorldCoordinates = function(localPosition){
        var q = this.q;
        localPosition.w = 0;
        return this.pWorld.set(q.inverse().multiply(localPosition).multiply(q));
    };

    Body.prototype.getEnergy = function(){
        var w = this.w;
        var I = this.I;
        var wx = w.x, wy = w.y, wz = w.z;
        var I0 = this.I[0], I1 = I[1], I2 = I[2];
        return 0.5 * (
            this.m * this.v.normSquared() +
            I0[0]*wx*wx + I0[1]*wx*wy + I0[2]*wx*wz +
            I1[0]*wy*wx + I1[1]*wy*wy + I1[2]*wy*wz +
            I2[0]*wz*wx + I2[1]*wz*wy + I2[2]*wz*wz
        );
    };

    Body.prototype.reset = function(p,v,q,L){
        this.setPos(p || [0,0,0]);
        this.setVel(v || [0,0,0]);
        this.w.clear();
        this.setOrientation(q || [1,0,0,0]);
        this.setAngularMomentum(L || [0,0,0]);
    };

    Body.prototype.setOrientation = function(q){
        this.q.set(q);
    };

    Body.prototype.setAngularMomentum = function(L){
        this.L.set(L);
    };

    Body.prototype.applyForce = function(force, location){
        if (this.hasImmunity(Body.IMMUNITIES.AGENTS)) return;
        this.f.set(this.f.add(force));
        if (location !== undefined) this.applyTorque(location.cross(force));
    };

    Body.prototype.applyTorque = function(torque){
        if (this.hasImmunity(Body.IMMUNITIES.ROTATION)) return;
        this.t.set(this.t.add(torque));
    };

    Body.prototype.getTransform = function(){
        return FM.move(this.q.getMatrix(), this.p.get());
    };

    module.exports = Body;

});

define('famous-physics/bodies/Circle',['require','exports','module','./Body'],function(require, exports, module) {
    var Body = require('./Body');

    /**
     * @class An elemental circle-shaped Particle in the physics engine.
     * 
     * @description This is a region defined by a radius.
     *    Its size is the dimension of the bounding square.
     *
     *
     * * Class/Namespace TODOs
     * 
     * * opts: 
     *    * r: radius
     *    * inherited opts from: {@link Particle}.
     * 
     * @name Circle
     * @extends Particle
     * @constructor
     * @example TODO
     */
     function Circle(opts){
        Body.call(this, opts);
        opts = opts || {};
        this.r = opts.r || 0;       //radius
        this.size = [2*this.r, 2*this.r];

        var r = this.r;
        var m = this.m;
        this.I = [
            [0.25 * m * r * r, 0, 0],
            [0, 0.25 * m * r * r, 0],
            [0, 0, 0.5 * m * r * r]
        ];

        this.Iinv = [
            [4 / (m * r * r), 0, 0],
            [0, 4 / (m * r * r), 0],
            [0, 0, 2 / (m * r * r)]
        ];
    };

    Circle.prototype = Object.create(Body.prototype);
    Circle.prototype.constructor = Circle;
    Circle.IMMUNITIES = Body.IMMUNITIES;

    module.exports = Circle;

});
define('famous-physics/bodies/Rectangle',['require','exports','module','./Body'],function(require, exports, module) {
    var Body = require('./Body');

    /*
     * @class An elemental rectangle-shaped Particle in the physics engine.
     * 
     * @description This is a region defined by a 2D box. 
     *
     * * Class/Namespace TODOs
     * 
     * * opts: 
     *   * size: ([height, width]) array
     *   * inherited opts from: {@link Particle}.
     *
     * @name Rectangle
     * @extends Particle
     * @example TODO
     * @constructor
     */
     function Rectangle(opts){
        Body.call(this, opts);
        opts = opts || {};
        this.size = opts.size || [0,0];

        var w = this.size[0];
        var h = this.size[1];

        this.I = [
            [h*h/12, 0, 0],
            [0, w*w/12, 0],
            [0, 0, (w*w + h*h)/12]
        ];

        this.Iinv = [
            [12 / (h*h), 0, 0],
            [0, 12 / (w*w), 0],
            [0, 0, 12 / ((w*w + h*h))]
        ];

    };

    Rectangle.prototype = Object.create(Body.prototype);
    Rectangle.prototype.constructor = Rectangle;

    Rectangle.IMMUNITIES = Body.IMMUNITIES;

    module.exports = Rectangle;

});
define('famous-physics/forces/Force',['require','exports','module','famous-physics/math/Vector'],function(require, exports, module) {
    var Vector = require('famous-physics/math/Vector');

    /** @constructor */
    function Force(){
        this.force = new Vector();
    };

    Force.prototype.setOpts = function(opts){
        for (var key in opts) this.opts[key] = opts[key];
    };

    Force.prototype.applyConstraint = function(){};

    Force.prototype.setupSlider = function(slider, property){
        property = property || slider.opts.name;
        slider.setOpts({value : this.opts[property]});
        if (slider.init) slider.init();
        slider.on('change', function(data){
            this.opts[property] = data.value;
        }.bind(this));
    };

    Force.prototype.getEnergy = function(){return 0};

    module.exports = Force;
});

define('famous-physics/constraints/Constraint',['require','exports','module'],function(require, exports, module) {

    /** @constructor */
    function Constraint(){};

    Constraint.prototype.setOpts = function(opts){
        for (var key in opts) this.opts[key] = opts[key];
    };

    Constraint.prototype.applyConstraint = function(){};

    Constraint.prototype.setupSlider = function(slider, property){
        property = property || slider.opts.name;
        slider.setOpts({value : this.opts[property]});
        if (slider.init) slider.init();
        slider.on('change', function(data){
            this.opts[property] = data.value;
        }.bind(this));
    };

    module.exports = Constraint;
});
define('famous-physics/integrator/SymplecticEuler',['require','exports','module'],function(require, exports, module) {

    /** @constructor */
    function SymplecticEuler(opts){
        this.opts = {
            velocityCap : Infinity,
            angularVelocityCap : Infinity
        };

        if (opts) this.setOpts(opts);
    };

    SymplecticEuler.prototype.integrateVelocity = function(particle, dt){
        var v = particle.v,
            m = particle.m,
            f = particle.f;

        if (f.isZero()) return;
        particle.setVel(v.add(f.mult(dt/m)));
        f.clear();
    };

    SymplecticEuler.prototype.integratePosition = function(particle, dt){
        var p = particle.p,
            v = particle.v;

        if (v.isZero()) return;
        v.set(v.cap(this.opts.velocityCap));
        particle.setPos(p.add(v.mult(dt)));
    };

    SymplecticEuler.prototype.integrateAngularMomentum = function(particle, dt){
        var L = particle.L,
            t = particle.t;

        if (t.isZero()) return;
        t.set(t.cap(this.opts.angularVelocityCap));
        L.add(t.mult(dt)).put(L);
        t.clear();
    };

    SymplecticEuler.prototype.integrateOrientation = function(particle, dt){
        var q = particle.q,
            w = particle.w;

        if (w.isZero()) return;
        q.set(q.add(q.multiply(w).scalarMult(0.5 * dt)));
        q.set(q.normalize());
    };

    SymplecticEuler.prototype.setOpts = function(opts){
        for (var key in opts) this.opts[key] = opts[key];
    };

    module.exports = SymplecticEuler;

});
define('famous-physics/PhysicsEngine',['require','exports','module','famous-physics/bodies/Particle','famous-physics/bodies/Body','famous-physics/bodies/Circle','famous-physics/bodies/Rectangle','famous-physics/forces/Force','famous-physics/constraints/Constraint','famous-physics/integrator/SymplecticEuler'],function(require, exports, module) {

    var Particle = require('famous-physics/bodies/Particle');
    var Body = require('famous-physics/bodies/Body');
    var Circle = require('famous-physics/bodies/Circle');
    var Rectangle = require('famous-physics/bodies/Rectangle');
    var Force = require('famous-physics/forces/Force');
    var Constraint = require('famous-physics/constraints/Constraint');
    var Integrator = require('famous-physics/integrator/SymplecticEuler');

    /** @constructor */
    function PhysicsEngine(opts){

        //default options
        this.opts = {
            speed               : 1,
            steps               : 1,
            velocityCap         : Infinity,
            angularVelocityCap  : Infinity,
            constraintSteps     : 1,
            constraintTolerance : 1e-4
        };

        if (opts) this.setOpts(opts);

        this._particles     = [];   //list of managed particles
        this._agents        = {};   //list of managed agents
        this._forces        = [];   //list of IDs of agents that are forces
        this._constraints   = [];   //list of IDs of agents that are constraints

        this._playing       = true;
        this._buffer        = 0;
        this._timestep      = (1000 / 60) / this.opts.steps;

        this._prevTime      = undefined;
        this._currTime      = undefined;

        this._integrator    = new Integrator({
            velocityCap         : this.opts.velocityCap,
            angularVelocityCap  : this.opts.angularVelocityCap
        });

        this._currAgentId   = 0;

        this.BODIES = PhysicsEngine.BODIES;

    };

    /* enum */
    PhysicsEngine.BODIES = {
        POINT       : Particle,
        BODY        : Body,
        CIRCLE      : Circle,
        RECTANGLE   : Rectangle
    };

    PhysicsEngine.IMMUNITIES = Particle.IMMUNITIES;

    //PRIVATE METHODS
    function getTime(){
        return Date.now();
    };

    //PUBLIC METHODS
    PhysicsEngine.prototype.setOpts = function(opts){
        for (var key in opts) if (this.opts[key]) this.opts[key] = opts[key];
    };

    PhysicsEngine.prototype.addBody = function(body){
        this._particles.push(body);
        return body;
    };

    // TODO: deprecate
    PhysicsEngine.prototype.createParticle = function(opts){
        return this.addBody(new Particle(opts));
    };

    PhysicsEngine.prototype.createBody = function(opts){
        var shape = opts.shape || PhysicsEngine.BODIES.POINT;
        return this.addBody(new shape(opts));
    };

    PhysicsEngine.prototype.remove = function(target){
        var index = this._particles.indexOf(target);
        if (index > -1) {
            for (var i = 0; i < Object.keys(this._agents); i++) this.detachFrom(i, target);
            this._particles.splice(index,1);
        }
    };

    function attachOne(agent, targets, source){
        if (targets === undefined) targets = this.getParticles();
        if (!(targets instanceof Array)) targets = [targets];

        this._agents[this._currAgentId] = {
            agent   : agent,
            targets : targets,
            source  : source
        };

        _mapAgentArray.call(this, agent).push(this._currAgentId);
        return this._currAgentId++;
    };

    PhysicsEngine.prototype.attach = function(agents, targets, source){
        if (agents instanceof Array){
            var agentIDs = [];
            for (var i = 0; i < agents.length; i++)
                agentIDs[i] = attachOne.call(this, agents[i], targets, source);
            return agentIDs;
        }
        else return attachOne.call(this, agents, targets, source);
    };

    PhysicsEngine.prototype.attachTo = function(agentID, target){
        _getBoundAgent.call(this, agentID).targets.push(target);
    };

    PhysicsEngine.prototype.detach = function(id){
        // detach from forces/constraints array
        var agent = this.getAgent(id);
        var agentArray = _mapAgentArray.call(this, agent);
        var index = agentArray.indexOf(id);
        agentArray.splice(index,1);

        // detach agents array
        delete this._agents[id];
    };

    PhysicsEngine.prototype.detachFrom = function(id, target){
        var boundAgent = _getBoundAgent.call(this, id);
        if (boundAgent.source === target) this.detach(id);  
        else {
            var targets = boundAgent.targets;
            var index = targets.indexOf(target);
            if (index > -1) targets.splice(index,1);
        };
    };

    PhysicsEngine.prototype.detachAll = function(){
        this._agents        = {};
        this._forces        = [];
        this._constraints   = [];
        this._currAgentId   = 0;
    };

    function _mapAgentArray(agent){
        if (agent instanceof Force)      return this._forces;
        if (agent instanceof Constraint) return this._constraints;
    };

    function _getBoundAgent(id){
        return this._agents[id];
    };

    PhysicsEngine.prototype.getAgent = function(id){
        return _getBoundAgent.call(this, id).agent;
    };

    PhysicsEngine.prototype.getParticles = function(){
        return this._particles;
    };

    PhysicsEngine.prototype.getParticlesExcept = function(particles){
        var result = [];
        this.forEachParticle(function(particle){
            if (particles.indexOf(particle) === -1) result.push(particle);
        });
        return result;
    };

    PhysicsEngine.prototype.getPos       = function(particle){ return (particle || this._particles[0]).getPos(); };
    PhysicsEngine.prototype.getVel       = function(particle){ return (particle || this._particles[0]).getVel(); };
    PhysicsEngine.prototype.getTransform = function(particle){ return (particle || this._particles[0]).getTransform(); };

    PhysicsEngine.prototype.setPos       = function(pos, particle){ (particle || this._particles[0]).setPos(pos); };
    PhysicsEngine.prototype.setVel       = function(vel, particle){ (particle || this._particles[0]).setVel(vel); };

    PhysicsEngine.prototype.forEachParticle = function(fn, args){
        var particles = this.getParticles();
        for (var index = 0, len = particles.length; index < len; index++)
            fn.call(this, particles[index], args);
    };

    function _updateForce(index){
        var boundAgent  = _getBoundAgent.call(this, this._forces[index]);
        boundAgent.agent.applyForce(boundAgent.targets, boundAgent.source);
    };

    function _updateConstraint(index, dt){
        var boundAgent  = this._agents[this._constraints[index]];
        return boundAgent.agent.applyConstraint(boundAgent.targets, boundAgent.source, dt);
    };

    function updateForces(){
        for (var index = this._forces.length -1; index > -1; index--)
            _updateForce.call(this, index);
    };

    function updateConstraints(dt){
        //Todo: while statement here until tolerance is met
        var err = Infinity;
        var iteration = 0;
        var tolerance = this.opts.constraintTolerance;
        while (iteration < this.opts.constraintSteps){
            err = 0;
            for (var index = this._constraints.length -1; index > -1; index--)
                err += _updateConstraint.call(this, index, dt);
            iteration++;
        };
    };

    function _updateVelocity(particle, dt){
        if (particle.hasImmunity(Particle.IMMUNITIES.UPDATE)) return;
        this._integrator.integrateVelocity(particle, dt);
    };
    function _updateAngularVelocity(particle){
        if (particle.hasImmunity(Particle.IMMUNITIES.ROTATION)) return;
        if (particle instanceof Body) particle.updateAngularVelocity();
    };
    function _updateAngularMomentum(particle, dt){
        if (particle.hasImmunity(Particle.IMMUNITIES.ROTATION)) return;
        if (particle instanceof Body) this._integrator.integrateAngularMomentum(particle, dt);
    };
    function _updatePosition(particle, dt){
        if (particle.hasImmunity(Particle.IMMUNITIES.UPDATE)) return;
        this._integrator.integratePosition(particle, dt);
    };
    function _updateOrientation(particle, dt){
        if (particle.hasImmunity(Particle.IMMUNITIES.ROTATION)) return;
        if (particle instanceof Body) this._integrator.integrateOrientation(particle, dt);
    };

    function updateVelocities(dt){      this.forEachParticle(_updateVelocity, dt); };
    function updatePositions(dt){       this.forEachParticle(_updatePosition, dt); };
    function updateAngularVelocities(){ this.forEachParticle(_updateAngularVelocity); };
    function updateAngularMomenta(dt){  this.forEachParticle(_updateAngularMomentum, dt); };
    function updateOrientations(dt){    this.forEachParticle(_updateOrientation, dt); };

    function integrate(dt){
        updateForces.call(this);
        updateVelocities.call(this, dt);
        updateAngularMomenta.call(this, dt);
        updateAngularVelocities.call(this, dt);
        updateConstraints.call(this, dt);
        updatePositions.call(this, dt);
        updateOrientations.call(this, dt);
    };

    PhysicsEngine.prototype.step = function(){
        if (!this._playing) return;

        //set previous time on initialization
        if (!this._prevTime) this._prevTime = getTime();

        //set current frame's time
        this._currTime = getTime();

        //milliseconds elapsed since last frame
        var dtFrame = this._currTime - this._prevTime;

        this._prevTime = this._currTime;
        if (dtFrame == 0) return;

        //robust integration
        // this._buffer += dtFrame;
        // while (this._buffer > this._timestep){
        //     integrate.call(this, this.opts.speed * this._timestep);
        //     this._buffer -= this._timestep;
        // };

        //simple integration
        integrate.call(this, this.opts.speed * this._timestep);
    };

    PhysicsEngine.prototype.render = function(target){
        this.step();
        var result = [];
        this.forEachParticle(function(particle){
            result.push(particle.render(target));
        });
        return result;
    };

    PhysicsEngine.prototype.play = function(){
        this._prevTime = getTime();
        this._playing = true;
    };

    PhysicsEngine.prototype.pause = function(){
        this._playing = false;
    };

    PhysicsEngine.prototype.toggle = function(){
        (this._playing) ? this.pause() : this.play();
    };

    PhysicsEngine.prototype.reverseTime = function(){
        this.opts.speed *= -1;
    };

    PhysicsEngine.prototype.reverseVelocities = function(){
        this.forEachParticle(function(particle){ particle.v.mult(-1, particle.v); });
    };

    module.exports = PhysicsEngine;

});
define('famous-physics/forces/Drag',['require','exports','module','famous-physics/forces/Force'],function(require, exports, module) {
    var Force = require('famous-physics/forces/Force');

    /** @constructor */
    function Drag(opts){
        this.opts = {
            strength : .01,
            forceFunction : Drag.FORCE_FUNCTIONS.LINEAR
        };

        if (opts) this.setOpts(opts);

        Force.call(this);
    };

    Drag.prototype = Object.create(Force.prototype);
    Drag.prototype.constructor = Force;

    Drag.FORCE_FUNCTIONS = {
        LINEAR : function(v){ return v; },
        QUADRATIC : function(v){ return v.mult(v.norm()); }
    };

    Drag.prototype.applyForce = function(particles){
	    var strength        = this.opts.strength;
	    var forceFunction   = this.opts.forceFunction;
	    var force           = this.force;
        for (var index = 0; index < particles.length; index++){
            var particle = particles[index];
            forceFunction(particle.v).mult(-strength).put(force);
            particle.applyForce(force);
        };
    };

    Drag.prototype.setOpts = function(opts){
        for (var key in opts) this.opts[key] = opts[key];
    };

    module.exports = Drag;
});
define('famous-physics/forces/Spring',['require','exports','module','famous-physics/forces/Force','famous-physics/math/Vector','famous/EventHandler'],function(require, exports, module) {
    var Force = require('famous-physics/forces/Force');
    var Vector = require('famous-physics/math/Vector');
    var EventHandler = require('famous/EventHandler');

    /** @constructor */
    function Spring(opts){

        this.opts = {
            period        : 300,
            dampingRatio  : 0.1,
            length        : 0,
            lMin          : 0,
            lMax          : Infinity,
            anchor        : undefined,
            forceFunction : Spring.FORCE_FUNCTIONS.HOOK,
            restTolerance : 1e-5
        };

        if (opts) this.setOpts(opts);

        this.eventOutput = undefined;
        this._atRest = false;

        this.init();

        Force.call(this);

        //registers
        this.disp = new Vector(0,0,0);

    };

    Spring.prototype = Object.create(Force.prototype);
    Spring.prototype.constructor = Force;

    Spring.FORCE_FUNCTIONS = {
        FENE : function (dist, rMax){
            var rMaxSmall = rMax * .99;
            var r = Math.max(Math.min(dist, rMaxSmall), -rMaxSmall);
            return r / (1 - r * r/(rMax * rMax))
        },
        HOOK : function(dist){
            return dist;
        }
    };

    function setForceFunction(fn){
        this.forceFunction = fn;
    };

    function calcStiffness(){
        var opts = this.opts;
        opts.stiffness = Math.pow(2 * Math.PI / opts.period, 2);
    };

    function calcDamping(){
        var opts = this.opts;
        opts.damping = 4 * Math.PI * opts.dampingRatio / opts.period ;
    };

    function getEnergy(strength, dist){
        return 0.5 * strength * dist * dist;
    };

    Spring.prototype.init = function(){
        setForceFunction.call(this, this.opts.forceFunction);
        calcStiffness.call(this);
        calcDamping.call(this);
    };

    Spring.prototype.applyForce = function(targets, source){

        var force        = this.force;
        var disp         = this.disp;
        var opts         = this.opts;

        var stiffness    = opts.stiffness;
        var damping      = opts.damping;
        var restLength   = opts.length;
        var lMax         = opts.lMax;
        var anchor       = opts.anchor || source.p;

        for (var i = 0; i < targets.length; i++){

            var target = targets[i];

            disp.set(anchor.sub(target.p));
            var dist = disp.norm() - restLength;

            if (dist == 0) return;

            //if dampingRatio specified, then override strength and damping
            var m      = target.m;
            stiffness *= m;
            damping   *= m;

            force.set(disp.normalize(stiffness * this.forceFunction(dist, lMax)));

            if (damping)
                if (source) force.set(force.add(target.v.sub(source.v).mult(-damping)));
                else        force.set(force.add(target.v.mult(-damping)));

            target.applyForce(force);
            if (source) source.applyForce(force.mult(-1));

            if (this.eventOutput) {
                var energy = target.getEnergy() + getEnergy(stiffness, dist);
                _fireAtRest.call(this, energy, target);
            };

        };

    };

    function _fireAtRest(energy, target){
        if (energy < this.opts.restTolerance){
            if (!this._atRest) this.eventOutput.emit('atRest', {particle : target});
            this._atRest = true;
        }
        else this._atRest = false;
    };

    Spring.prototype.getEnergy = function(target, source){
        var opts        = this.opts;
        var restLength  = opts.length,
            anchor      = opts.anchor || source.p,
            strength    = opts.stiffness;

        var dist = anchor.sub(target.p).norm() - restLength;

        return 0.5 * strength * dist * dist;
    };

    Spring.prototype.setOpts = function(opts){
        if (opts.anchor !== undefined){
            if (opts.anchor.p instanceof Vector) this.opts.anchor = opts.anchor.p;
            if (opts.anchor   instanceof Vector)  this.opts.anchor = opts.anchor;
            if (opts.anchor   instanceof Array)  this.opts.anchor = new Vector(opts.anchor);
        }
        if (opts.period !== undefined) this.opts.period = opts.period;
        if (opts.dampingRatio !== undefined) this.opts.dampingRatio = opts.dampingRatio;
        if (opts.length !== undefined) this.opts.length = opts.length;
        if (opts.lMin !== undefined) this.opts.lMin = opts.lMin;
        if (opts.lMax !== undefined) this.opts.lMax = opts.lMax;
        if (opts.forceFunction !== undefined) this.opts.forceFunction = opts.forceFunction;
        if (opts.restTolerance !== undefined) this.opts.restTolerance = opts.restTolerance;

        this.init();
    };

    Spring.prototype.setAnchor = function(anchor){
        if (this.opts.anchor === undefined) this.opts.anchor = new Vector();
        this.opts.anchor.set(anchor);
    };

    function _createEventOutput() {
        this.eventOutput = new EventHandler();
        this.eventOutput.bindThis(this);
        EventHandler.setOutputHandler(this, this.eventOutput);
    };

    Spring.prototype.on = function() { _createEventOutput.call(this); return this.on.apply(this, arguments); }
    Spring.prototype.unbind = function() { _createEventOutput.call(this); return this.unbind.apply(this, arguments); }
    Spring.prototype.pipe = function() { _createEventOutput.call(this); return this.pipe.apply(this, arguments); }
    Spring.prototype.unpipe = function() { _createEventOutput.call(this); return this.unpipe.apply(this, arguments); }

    module.exports = Spring;

});
define('famous-sync/TouchTracker',['require','exports','module','famous/EventHandler'],function(require, exports, module) {
    var FEH = require('famous/EventHandler');

    /** @constructor */
    function TouchTracker(selective) {
        this.selective = selective;
        this.touchHistory = {};
        this.eventHandler = new FEH(true);
    };

    function _timestampTouch(touch, origin, history, count) {
        var touchClone = {};
        for(var i in touch) touchClone[i] = touch[i];
        return {
            touch: touchClone,
            origin: origin,
            timestamp: +Date.now(),
            count: count,
            history: history
        };
    };

    function _handleStart(event) {
        for(var i = 0; i < event.changedTouches.length; i++) {
            var touch = event.changedTouches[i];
            var data = _timestampTouch(touch, event.origin, undefined, event.touches.length);
            this.eventHandler.emit('trackstart', data);
            if(!this.selective && !this.touchHistory[touch.identifier]) this.track(data);
        }
    };

    function _handleMove(event) {
        for(var i = 0; i < event.changedTouches.length; i++) {
            var touch = event.changedTouches[i];
            var history = this.touchHistory[touch.identifier];
            if(history) {
                var data = _timestampTouch(touch, event.origin, history, event.touches.length);
                this.touchHistory[touch.identifier].push(data);
                this.eventHandler.emit('trackmove', data);
            }
        }
    };

    function _handleEnd(event) {
        for(var i = 0; i < event.changedTouches.length; i++) {
            var touch = event.changedTouches[i];
            var history = this.touchHistory[touch.identifier];
            if(history) {
                var data = _timestampTouch(touch, event.origin, history, event.touches.length);
                this.eventHandler.emit('trackend', data);
                delete this.touchHistory[touch.identifier];
            }
        }
    };
    
    function _handleUnpipe(event) {
        for(var i in this.touchHistory) {
            var history = this.touchHistory[i];
            this.eventHandler.emit('trackend', {
                touch: history[history.length - 1].touch,
                timestamp: +Date.now(),
                count: 0,
                history: history
            });
            delete this.touchHistory[i];
        }
    };

    TouchTracker.prototype.track = function(data) {
        this.touchHistory[data.touch.identifier] = [data];
    };

    TouchTracker.prototype.emit = function(type, data) {
        if(type == 'touchstart') return _handleStart.call(this, data);
        else if(type == 'touchmove') return _handleMove.call(this, data);
        else if(type == 'touchend') return _handleEnd.call(this, data);
        else if(type == 'touchcancel') return _handleEnd.call(this, data);
        else if(type == 'unpipe') return _handleUnpipe.call(this);
    };

    TouchTracker.prototype.on = function(type, handler) { return this.eventHandler.on(type, handler); };
    TouchTracker.prototype.unbind = function(type, handler) { return this.eventHandler.unbind(type, handler); };
    TouchTracker.prototype.pipe = function(target) { return this.eventHandler.pipe(target); };
    TouchTracker.prototype.unpipe = function(target) { return this.eventHandler.unpipe(target); };

    module.exports = TouchTracker;
});

define('famous-sync/TouchSync',['require','exports','module','./TouchTracker','famous/EventHandler'],function(require, exports, module) {
    var FTT = require('./TouchTracker');
    var FEH = require('famous/EventHandler');

    function TouchSync(targetSync,options) {
        this.targetGet = targetSync;

        this.output = new FEH();
        this.touchTracker = new FTT();

        this.options = {
            direction: undefined,
            rails: false,
            scale: 1
        };

        if (options) {
            this.setOptions(options);
        } else {
            this.setOptions(this.options);
        }

        FEH.setOutputHandler(this, this.output);
        FEH.setInputHandler(this, this.touchTracker);

        this.touchTracker.on('trackstart', _handleStart.bind(this));
        this.touchTracker.on('trackmove', _handleMove.bind(this));
        this.touchTracker.on('trackend', _handleEnd.bind(this));
    }

    /** @const */ TouchSync.DIRECTION_X = 0;
    /** @const */ TouchSync.DIRECTION_Y = 1;

    function _handleStart(data) {
        this.output.emit('start', {count: data.count, touch: data.touch.identifier, pos: [data.touch.pageX, data.touch.pageY]});
    };

    function _handleMove(data) {
        var history = data.history;
        var prevTime = history[history.length - 2].timestamp;
        var currTime = history[history.length - 1].timestamp;
        var prevTouch = history[history.length - 2].touch;
        var currTouch = history[history.length - 1].touch;

        var diffX = currTouch.pageX - prevTouch.pageX;
        var diffY = currTouch.pageY - prevTouch.pageY;
        
        if(this.options.rails) {
            if(Math.abs(diffX) > Math.abs(diffY)) diffY = 0;
            else diffX = 0;
        }

        var diffTime = Math.max(currTime - prevTime, 8); // minimum tick time

        var velX = diffX / diffTime;
        var velY = diffY / diffTime;

        //DV edits to send acceleration and velocity
        if (history.length > 2){
            var prevprevTouch = history[history.length - 3].touch;
            var accelX = (currTouch.pageX - 2*prevTouch.pageX + prevprevTouch.pageX) / (diffTime*diffTime);
            var accelY = (currTouch.pageY - 2*prevTouch.pageY + prevprevTouch.pageY) / (diffTime*diffTime);
        }
        else{
            var accelX = 0;
            var accelY = 0;
        }

        var prevPos = this.targetGet();
        var scale = this.options.scale;
        var nextPos;
        var nextVel;
        var nextAccel;
        if(this.options.direction == TouchSync.DIRECTION_X) {
            nextPos = prevPos + scale*diffX;
            nextVel = scale*velX;
            nextAccel = scale*velY;
        }
        else if(this.options.direction == TouchSync.DIRECTION_Y) {
            nextPos = prevPos + scale*diffY;
            nextVel = scale*velY;
            nextAccel = scale*accelY;
        }
        else {
            nextPos = [prevPos[0] + scale*diffX, prevPos[1] + scale*diffY];
            nextVel = [scale*velX, scale*velY];
            nextAccel = [scale*accelX, scale*accelY];
        }

        this.output.emit('update', {
            p: nextPos,
            v: nextVel,
            a: nextAccel,
            c: [currTouch.pageX, currTouch.pageY],
            d: [diffX, diffY],
            touch: data.touch.identifier
        });
    };

    function _handleEnd(data) {
        var nextVel = (this.options.direction !== undefined) ? 0 : [0, 0];
        var history = data.history;
        var count = data.count;
        var pos = this.targetGet();
        if(history.length > 1) {
            var prevTime = history[history.length - 2].timestamp;
            var currTime = history[history.length - 1].timestamp;
            var prevTouch = history[history.length - 2].touch;
            var currTouch = history[history.length - 1].touch;
            var diffX = currTouch.pageX - prevTouch.pageX;
            var diffY = currTouch.pageY - prevTouch.pageY;

            if(this.options.rails) {
                if(Math.abs(diffX) > Math.abs(diffY)) diffY = 0;
                else diffX = 0;
            }

            var diffTime = Math.max(currTime - prevTime, 1); // minimum tick time
            var velX = diffX / diffTime;
            var velY = diffY / diffTime;
            var scale = this.options.scale;

            var nextVel;
            if(this.options.direction == TouchSync.DIRECTION_X) nextVel = scale*velX;
            else if(this.options.direction == TouchSync.DIRECTION_Y) nextVel = scale*velY;
            else nextVel = [scale*velX, scale*velY];
        }
        this.output.emit('end', {p: pos, v: nextVel, count: count, touch: data.touch.identifier});
    };

    TouchSync.prototype.setOptions = function(options) {
        if(options.direction !== undefined) this.options.direction = options.direction;
        if(options.rails !== undefined) this.options.rails = options.rails;
        if(options.scale !== undefined) this.options.scale = options.scale;
    };

    TouchSync.prototype.getOptions = function() {
        return this.options;
    };

    module.exports = TouchSync;
});

define('famous-sync/ScrollSync',['require','exports','module','famous/EventHandler','famous/Engine'],function(require, exports, module) {
    var FEH = require('famous/EventHandler');
    var FE = require('famous/Engine');

    function ScrollSync(targetSync,options) {
        this.targetGet = targetSync;

        this.options = {
            direction: undefined,
            minimumEndSpeed: Infinity,
            rails: false,
            scale: 1,
            stallTime: 50
        };

        if (options) {
            this.setOptions(options);
        } else {
            this.setOptions(this.options);
        }

        this.input = new FEH();
        this.output = new FEH();

        FEH.setInputHandler(this, this.input);
        FEH.setOutputHandler(this, this.output);

        this._prevTime = undefined;
        this._prevVel = undefined;
        this._lastFrame = undefined;
        this.input.on('mousewheel', _handleMove.bind(this));
        this.input.on('wheel', _handleMove.bind(this));
        this.inProgress = false;

        this._loopBound = false;
    };

    /** @const */ ScrollSync.DIRECTION_X = 0;
    /** @const */ ScrollSync.DIRECTION_Y = 1;

    function _newFrame() {
        var now = Date.now();
        if (this.inProgress && now - this._prevTime > this.options.stallTime) {
            var pos = this.targetGet();
            this.inProgress = false;
            var finalVel = 0;
            if(Math.abs(this._prevVel) >= this.options.minimumEndSpeed) finalVel = this._prevVel;
            this.output.emit('end', {p: pos, v: finalVel, slip: true});
        }
    };

    function _handleMove(e) {
        e.preventDefault();
        if (!this.inProgress) {
            this.inProgress = true;
            this.output.emit('start', {slip: true});
            if(!this._loopBound) {
                FE.on('prerender', _newFrame.bind(this));
                this._loopBound = true;
            }
        };

        var prevTime = this._prevTime;
        var diffX = (e.wheelDeltaX !== undefined) ? e.wheelDeltaX : -e.deltaX;
        var diffY = (e.wheelDeltaY !== undefined) ? e.wheelDeltaY : -e.deltaY;
        var currTime = Date.now();

        if(this.options.rails) {
            if(Math.abs(diffX) > Math.abs(diffY)) diffY = 0;
            else diffX = 0;
        }

        var diffTime = Math.max(currTime - prevTime, 8); // minimum tick time

        var velX = diffX / diffTime;
        var velY = diffY / diffTime;

        var prevPos = this.targetGet();

        var scale = this.options.scale;

        var nextPos;
        var nextVel;

        if(this.options.direction == ScrollSync.DIRECTION_X) {
            nextPos = prevPos + scale*diffX;
            nextVel = scale*velX;
        }
        else if(this.options.direction == ScrollSync.DIRECTION_Y) {
            nextPos = prevPos + scale*diffY;
            nextVel = scale*velY;
        }
        else {
            nextPos = [prevPos[0] + scale*diffX, prevPos[1] + scale*diffY];
            nextVel = [scale*velX, scale*velY];
        }

        this.output.emit('update', {p: nextPos, v: nextVel, slip: true});

        this._prevTime = currTime;
        this._prevVel = nextVel;
    };

    ScrollSync.prototype.getOptions = function() {
        return this.options;
    };

    ScrollSync.prototype.setOptions = function(options) {
        if(options.direction !== undefined) this.options.direction = options.direction;
        if(options.minimumEndSpeed !== undefined) this.options.minimumEndSpeed = options.minimumEndSpeed;
        if(options.rails !== undefined) this.options.rails = options.rails;
        if(options.scale !== undefined) this.options.scale = options.scale;
        if(options.stallTime !== undefined) this.options.stallTime = options.stallTime;
    };

    module.exports = ScrollSync;

});

define('famous-sync/GenericSync',['require','exports','module','famous/EventHandler','./TouchSync','./ScrollSync'],function(require, exports, module) {
    var EventHandler = require('famous/EventHandler');
    var TouchSync = require('./TouchSync');
    var ScrollSync = require('./ScrollSync');

    function GenericSync(targetGet, options) {
        this.targetGet = targetGet;

        this.eventInput = new EventHandler();
        EventHandler.setInputHandler(this, this.eventInput);
        
        this.eventOutput = new EventHandler();
        EventHandler.setOutputHandler(this, this.eventOutput);

        this._handlers = undefined;

        this.options = {
            syncClasses: defaultClasses
        };

        this._handlerOptions = this.options;

        if(options) this.setOptions(options);
        if(!this._handlers) _updateHandlers.call(this);
    };

    var defaultClasses = [TouchSync, ScrollSync];
    GenericSync.register = function(syncClass) {
        if(defaultClasses.indexOf(syncClass) < 0) defaultClasses.push(syncClass);
    };
    /** @const */ GenericSync.DIRECTION_X = 0;
    /** @const */ GenericSync.DIRECTION_Y = 1;
    /** @const */ GenericSync.DIRECTION_Z = 2;

    function _updateHandlers() {
        if(this._handlers) {
            for(var i = 0; i < this._handlers.length; i++) {
                this.eventInput.unpipe(this._handlers[i]);
                this._handlers[i].unpipe(this.eventOutput);
            }
        }
        this._handlers = [];
        for(var i = 0; i < this.options.syncClasses.length; i++) {
            var _SyncClass = this.options.syncClasses[i];
            this._handlers[i] = new _SyncClass(this.targetGet, this._handlerOptions);
            this.eventInput.pipe(this._handlers[i]);
            this._handlers[i].pipe(this.eventOutput);
        }
    }

    GenericSync.prototype.setOptions = function(options) {
        this._handlerOptions = options;
        if(options.syncClasses) {
            this.options.syncClasses = options.syncClasses;
            _updateHandlers.call(this);
        }
        if(this._handlers) {
            for(var i = 0; i < this._handlers.length; i++) {
                this._handlers[i].setOptions(this._handlerOptions);
            }
        }
    };

    module.exports = GenericSync;
});

define('famous/ViewSequence',['require','exports','module'],function(require, exports, module) {
    /**
     * @class ViewSequence
     *
     * @name ViewSequence
     * @constructor
     *
     * @param {Array} array Array that will be viewed
     * @param {number} index Index of array to begin at
     * @param {boolean} loop Whether to loop around the array at end
     */
    function ViewSequence(array, index, loop) {
        this.array = array || [];
        this.index = index || 0; 
        this.loop = loop || false;
        this._prev = undefined;
        this._prevIndex = undefined;
        this._next = undefined;
        this._nextIndex = undefined;
    };

    ViewSequence.prototype._createPrevious = function() {
        var prev = new (this.constructor)(this.array, this._prevIndex, this.loop);
        prev._next = this;
        prev._nextIndex = this.index;
        return prev;
    };

    ViewSequence.prototype._createNext = function() {
        var next = new (this.constructor)(this.array, this._nextIndex, this.loop);
        next._prev = this;
        next._prevIndex = this.index;
        return next;
    };

    ViewSequence.prototype.getPrevious = function() {
        var prevIndex = this.index - 1;
        if(this.index == 0) {
            if(this.loop) prevIndex = this.array.length - 1;
            else return undefined;
        }
        if(!this._prev || this._prevIndex != prevIndex) {
            this._prevIndex = prevIndex;
            this._prev = this._createPrevious();
        }
        return this._prev;
    };

    ViewSequence.prototype.getNext = function() {
        var nextIndex = this.index + 1;
        if(nextIndex >= this.array.length) {
            if(this.loop) nextIndex = 0;
            else return undefined;
        }
        if(!this._next || this._nextIndex != nextIndex) {
            this._nextIndex = nextIndex;
            this._next = this._createNext();
        }
        return this._next;
    };

    ViewSequence.prototype.toString = function() {
        return this.index;
    };

    ViewSequence.prototype.unshift = function(value) {
        if(!this._prev || this.index === 0) {
            var offset = arguments.length;
            this.array.unshift.apply(this.array, arguments);
            _reindex.call(this, offset);
        }
        else this._prev.unshift.apply(this._prev, arguments);
    };

    ViewSequence.prototype.push = function(value) {
        this.array.push.apply(this.array, arguments);
    };

    ViewSequence.prototype.splice = function(index, howMany, value) {
        if(!this._prev || this.index === index) {
            var offset = (this.index >= index) ? (arguments.length - 2) - howMany : 0;
            this.array.splice.apply(this.array, arguments);
            if(offset) _reindex.call(this, offset);
        }
        else this._prev.splice.apply(this._prev, arguments);
    };

    function _reindex(offset) {
        var i = this.index;
        var currentNode = this;
        while(currentNode && i < this.array.length) {
            currentNode.index += offset;
            if(currentNode._prevIndex !== undefined) currentNode._prevIndex += offset;
            if(currentNode._nextIndex !== undefined) currentNode._nextIndex += offset;
            currentNode = currentNode._next;
        }
    };

    ViewSequence.prototype.get = function() {
        return this.array[this.index];
    };

    ViewSequence.prototype.getSize = function() {
        var target = this.get();
        if(!target) return;
        if(!target.getSize) return undefined;
        return target.getSize.apply(target, arguments);
    };

    ViewSequence.prototype.render = function() {
        var target = this.get();
        if(!target) return;
        return target.render.apply(target, arguments);
    };

    module.exports = ViewSequence;
});

define('famous/Group',['require','exports','module','./Context','./Matrix','./Surface'],function(require, exports, module) {
    var Context = require('./Context');
    var Matrix = require('./Matrix');
    var Surface = require('./Surface');

    /* WARNING: HACK */

    /**
     * @class An object designed to contain surfaces, and set properties
     *   to be applied to all of them at once.
     *
     * @description 
     *  * A group will enforce these properties on the 
     *   surfaces it contains:
     *     * size (clips contained surfaces to its own width and height)
     *     * origin
     *     * its own opacity and transform, which will be automatically 
     *       applied to  all Surfaces contained directly and indirectly.
     *   These properties are maintained through a {@link 
     *   SurfaceManager} unique to this Container Surface.
     *   Implementation note: in the DOM case, this will generate a div with 
     *   the style 'containerSurface' applied.
     *   
     * @name Group
     * @extends Surface
     * @constructor
     */
    function Group(options) {
        Surface.call(this, options);
        this._shouldRecalculateSize = false;
        this._container = document.createDocumentFragment();
        this.context = new Context(this._container);
        this.setContent(this._container);
        this._groupSize = [undefined, undefined];

        this._origin = undefined;
        this._originTransfer = {
            render: function(input) {
                return {origin: this._origin, target: input};
            }.bind(this)
        };
    };

    /** @const */ Group.SIZE_ZERO = [0, 0];

    Group.prototype = Object.create(Surface.prototype);
    Group.prototype.elementType = 'div';
    Group.prototype.elementClass = 'group';

    Group.prototype.link = function() { 
        var segment = this.context.link(this._originTransfer);
        return segment.link.apply(segment, arguments); 
    };
    Group.prototype.add = function() { return this.context.add.apply(this.context, arguments); };
    Group.prototype.mod = function() { return this.context.mod.apply(this.context, arguments); };

    Group.prototype.render = function() {
        return Surface.prototype.render.call(this);
    };

    Group.prototype.deploy = function(target) {
        this.context.migrate(target);
    };

    Group.prototype.recall = function(target) {
        this._container = document.createDocumentFragment();
        this.context.migrate(this._container);
    };

    Group.prototype.commit = function(context, transform, opacity, origin, size) {
        transform = Matrix.moveThen([-origin[0]*size[0], -origin[1]*size[1], 0], transform);
        var result = Surface.prototype.commit.call(this, context, transform, opacity, origin, Group.SIZE_ZERO);
        this._origin = origin;
        if(size[0] != this._groupSize[0] || size[1] != this._groupSize[1]) {
            this.context.setSize(size);
            this._groupSize[0] = size[0];
            this._groupSize[1] = size[1];
        }
        this.context.update();
        return result;
    }; 

    module.exports = Group;
});


define('famous-views/Scrollview',['require','exports','module','famous/Utility','famous-utils/Time','famous-physics/PhysicsEngine','famous-physics/bodies/Particle','famous-physics/forces/Drag','famous-physics/forces/Spring','famous/Matrix','famous/EventHandler','famous-sync/GenericSync','famous/ViewSequence','famous/Group','famous/Entity'],function(require, exports, module) {
    var Utility = require('famous/Utility');
    var Time = require('famous-utils/Time');

    var PhysicsEngine = require('famous-physics/PhysicsEngine');
    var Particle = require('famous-physics/bodies/Particle');
    var Drag = require('famous-physics/forces/Drag');
    var Spring = require('famous-physics/forces/Spring');

    var Matrix = require('famous/Matrix');
    var EventHandler = require('famous/EventHandler');
    var GenericSync = require('famous-sync/GenericSync');
    var ViewSequence = require('famous/ViewSequence');
    var Group = require('famous/Group');
    var Entity = require('famous/Entity');

    /**
     * @class Lays out the sequenced renderables sequentially and makes them scrollable.
     * @description Items outside the viewport are automatically culled.
     * @name Scrollview
     * @constructor
     * @example 
     *   var myScrollview = new Scrollview({
     *       itemSpacing: 20
     *   });
     * 
     *   var mySequence = new ViewSequence();
     *   for(var i = 0; i < 50; i++) {
     *       surfaces.push(new Surface({content: 'Item ' + i}));
     *   }
     *   myScrollview.sequenceFrom(surfaces); // link items into scrollview
     *
     *   Engine.pipe(myScrollview); // let events on root window control the scrollview
     *   myContext.link(myScrollview); // link scrollview into myContext
     */
    function Scrollview(options) {
        this.options = {
            direction: Utility.Direction.Y,
            rails: true,
            itemSpacing: 0,
            clipSize: undefined,
            margin: undefined,
            friction: 0.001,
            drag: 0.0001,
            edgeGrip: 0.5,
            edgePeriod: 300,
            edgeDamp: 1,
            paginated: false,
            pagePeriod: 500,
            pageDamp: 0.8,
            pageStopSpeed: Infinity,
            pageSwitchSpeed: 1,
            speedLimit: 10
        };

        this.node = null;

        this.physicsEngine = new PhysicsEngine();
        this.particle = new Particle();
        this.physicsEngine.addBody(this.particle);

        this.spring = new Spring({anchor: [0, 0, 0]});

        this.drag = new Drag({forceFunction: Drag.FORCE_FUNCTIONS.QUADRATIC});
        this.friction = new Drag({forceFunction: Drag.FORCE_FUNCTIONS.LINEAR});

        this.sync = new GenericSync((function() {
            return -this.getPosition();
        }).bind(this), {direction: (this.options.direction == Utility.Direction.X) ? GenericSync.DIRECTION_X : GenericSync.DIRECTION_Y});
        
        this.eventInput = new EventHandler();
        this.eventOutput = new EventHandler();

        this.rawInput = new EventHandler();
        this.rawInput.pipe(this.sync);
        this.sync.pipe(this.eventInput);
        this.sync.pipe(this.eventOutput);
        this.rawInput.pipe(this.eventInput);

        EventHandler.setInputHandler(this, this.rawInput);
        EventHandler.setOutputHandler(this, this.eventOutput);

        this._outputFunction = undefined;
        this._masterOutputFunction = undefined;
        this.setOutputFunction(); // use default

        this.touchCount = 0;
        this._springAttached = false;
        this._onEdge = 0; // -1 for top, 1 for bottom
        this._springPosition = 0;
        this._touchVelocity = undefined;
        this._earlyEnd = false;

        this._masterOffset = 0; // minimize writes
        this._lastFrameNode = undefined;
        
        if(options) this.setOptions(options);
        else this.setOptions({});

        _bindEvents.call(this);

        this.group = new Group();
        this.group.link({render: _innerRender.bind(this)});

        this._entityId = Entity.register(this);
        this._contextSize = [window.innerWidth, window.innerHeight];

        this._offsets = {};
    }

    function _handleStart(event) {
        this.touchCount = event.count;
        if(event.count === undefined) this.touchCount = 1;
        
        _detachAgents.call(this);
        this.setVelocity(0);
        this._touchVelocity = 0;
        this._earlyEnd = false;
    }

    function _handleMove(event) {
        var pos = -event.p;
        var vel = -event.v;
        if(this._onEdge && event.slip) {
            if((vel < 0 && this._onEdge < 0) || (vel > 0 && this._onEdge > 0)) {
                if(!this._earlyEnd) {
                    _handleEnd.call(this, event);
                    this._earlyEnd = true;
                }
            }
            else if(this._earlyEnd && (Math.abs(vel) > Math.abs(this.particle.getVel()[0]))) {
                _handleStart.call(this, event);
            }
        }
        if(this._earlyEnd) return;
        this._touchVelocity = vel;

        if(event.slip) this.setVelocity(vel);
        else this.setPosition(pos);
    }

    function _handleEnd(event) {
        this.touchCount = event.count || 0;
        if(!this.touchCount) {
            _detachAgents.call(this);
            if(this._onEdge) this._springAttached = true;
            _attachAgents.call(this);
            var vel = -event.v;
            var speedLimit = this.options.speedLimit;
            if(event.slip) speedLimit *= this.options.edgeGrip;
            if(vel < -speedLimit) vel = -speedLimit;
            else if(vel > speedLimit) vel = speedLimit;
            this.setVelocity(vel);
            this._touchVelocity = undefined;
        }
    }

    function _bindEvents() {
        this.eventInput.on('start', _handleStart.bind(this));
        this.eventInput.on('update', _handleMove.bind(this));
        this.eventInput.on('end', _handleEnd.bind(this));
    }

    function _attachAgents() {
        if(this._springAttached) this.physicsEngine.attach([this.spring], this.particle);
        else this.physicsEngine.attach([this.drag, this.friction], this.particle);
    }

    function _detachAgents() {
        this._springAttached = false;
        this.physicsEngine.detachAll();
    }

    function _sizeForDir(size) {
        if(!size) size = this._contextSize;
        var dimension = (this.options.direction === Utility.Direction.X) ? 0 : 1;
        return size[dimension] || this._contextSize[dimension];
    }

    function _shiftOrigin(amount) {
        this._springPosition += amount;
        this.setPosition(this.getPosition() + amount);
        this.spring.setOpts({anchor: [this._springPosition, 0, 0]});
    }

    function _normalizeState() {
        var atEdge = false;
        while(!atEdge && this.getPosition() < 0) {
            var prevNode = this.node.getPrevious ? this.node.getPrevious() : undefined;
            if(prevNode) {
                var prevSize = prevNode.getSize ? prevNode.getSize() : this._contextSize;
                var dimSize = _sizeForDir.call(this, prevSize) + this.options.itemSpacing;
                _shiftOrigin.call(this, dimSize);
                this._masterOffset -= dimSize;
                this.node = prevNode;
            }
            else atEdge = true;
        }
        var size = (this.node && this.node.getSize) ? this.node.getSize() : this._contextSize;
        while(!atEdge && this.getPosition() >= _sizeForDir.call(this, size) + this.options.itemSpacing) {
            var nextNode = this.node.getNext ? this.node.getNext() : undefined;
            if(nextNode) {
                var dimSize = _sizeForDir.call(this, size) + this.options.itemSpacing;
                _shiftOrigin.call(this, -dimSize);
                this._masterOffset += dimSize;
                this.node = nextNode;
                size = this.node.getSize ? this.node.getSize() : this._contextSize;
            }
            else atEdge = true;
        }
        if(Math.abs(this._masterOffset) > (_getClipSize.call(this) + this.options.margin)) this._masterOffset = 0;
    }

    function _handleEdge(edgeDetected) {
        if(!this._onEdge && edgeDetected) {
            this.sync.setOptions({scale: this.options.edgeGrip});
            if(!this.touchCount && !this._springAttached) {
                this._springAttached = true;
                this.physicsEngine.attach([this.spring], this.particle);
            }
        }
        else if(this._onEdge && !edgeDetected) {
            this.sync.setOptions({scale: 1});
            if(this._springAttached && Math.abs(this.getVelocity()) < 0.001) {
                this.setVelocity(0);
                this.setPosition(this._springPosition);
                // reset agents, detaching the spring
                _detachAgents.call(this);
                _attachAgents.call(this);
            }
        }
        this._onEdge = edgeDetected;
    }

    function _handlePagination() {
        if(this.touchCount == 0 && !this._springAttached && !this._onEdge) {
            if(this.options.paginated && Math.abs(this.getVelocity()) < this.options.pageStopSpeed) {
                var nodeSize = this.node.getSize ? this.node.getSize() : this._contextSize;

                // parameters to determine when to switch
                var velSwitch = Math.abs(this.getVelocity()) > this.options.pageSwitchSpeed;
                var velNext = this.getVelocity() > 0;
                var posNext = this.getPosition() > 0.5*_sizeForDir.call(this, nodeSize);

                if((velSwitch && velNext)|| (!velSwitch && posNext)) this.goToNextPage();
                else _attachPageSpring.call(this);
                // no need to handle prev case since the origin is already the 'previous' page
            }
        }
    }

    function _attachPageSpring() {
        _setSpring.call(this, 0, {period: this.options.pagePeriod, damp: this.options.pageDamp});
        if(!this._springAttached) {
            this._springAttached = true;
            this.physicsEngine.attach([this.spring], this.particle);
        }
    }

    function _setSpring(position, parameters) {
        if(!parameters) parameters = {period: this.options.edgePeriod, damp: this.options.edgeDamp};
        this._springPosition = position;
        this.spring.setOpts({
            anchor: [this._springPosition, 0, 0],
            period: parameters.period,
            dampingRatio: parameters.damp
        });
    }

    function _output(node, offset, target) {
        var size = node.getSize ? node.getSize() : this._contextSize;
        var transform = this._outputFunction(offset);
        target.push({transform: transform, target: node.render()});
        return _sizeForDir.call(this, size);
    }

    function _getClipSize() {
        if(this.options.clipSize) return this.options.clipSize;
        else return _sizeForDir.call(this, this._contextSize);
    }

    Scrollview.prototype.getPosition = function(node) {
        var pos = this.particle.getPos()[0];
        if( node === undefined ) return pos;
        else {
            var offset = this._offsets[node];
            if(offset !== undefined) return pos - offset;
            else return undefined;
        }
    }

    Scrollview.prototype.setPosition = function(pos) {
        this.particle.setPos([pos, 0, 0]);
    }

    Scrollview.prototype.getVelocity = function() {
        return this.touchCount ? this._touchVelocity : this.particle.getVel()[0];
    }

    Scrollview.prototype.setVelocity = function(v) {
        this.particle.setVel([v, 0, 0]);
    }

    Scrollview.prototype.getOptions = function() {
        return this.options;
    }

    Scrollview.prototype.setOptions = function(options) {
        if(options.direction !== undefined) {
            this.options.direction = options.direction;
            if(this.options.direction === 'x') this.options.direction = Utility.Direction.X;
            else if(this.options.direction === 'y') this.options.direction = Utility.Direction.Y;
        }
        if(options.rails !== undefined) this.options.rails = options.rails;
        if(options.itemSpacing !== undefined) this.options.itemSpacing = options.itemSpacing;
        if(options.clipSize !== undefined) {
            if(options.clipSize !== this.options.clipSize) this._onEdge = 0; // recalculate edge on resize
            this.options.clipSize = options.clipSize;
        }
        if(options.margin !== undefined) this.options.margin = options.margin;

        if(options.drag !== undefined) this.options.drag = options.drag;
        if(options.friction !== undefined) this.options.friction = options.friction;

        if(options.edgeGrip !== undefined) this.options.edgeGrip = options.edgeGrip;
        if(options.edgePeriod !== undefined) this.options.edgePeriod = options.edgePeriod;
        if(options.edgeDamp !== undefined) this.options.edgeDamp = options.edgeDamp;

        if(options.paginated !== undefined) this.options.paginated = options.paginated;
        if(options.pageStopSpeed !== undefined) this.options.pageStopSpeed = options.pageStopSpeed;
        if(options.pageSwitchSpeed !== undefined) this.options.pageSwitchSpeed = options.pageSwitchSpeed;
        if(options.pagePeriod !== undefined) this.options.pagePeriod = options.pagePeriod;
        if(options.pageDamp !== undefined) this.options.pageDamp = options.pageDamp;

        if(options.speedLimit !== undefined) this.options.speedLimit = options.speedLimit;

        if(this.options.margin === undefined) this.options.margin = 0.5*Math.max(window.innerWidth, window.innerHeight);

        this.drag.setOpts({strength: this.options.drag});
        this.friction.setOpts({strength: this.options.friction});

        this.spring.setOpts({
            period: this.options.edgePeriod,
            dampingRatio: this.options.edgeDamp
        });

        this.sync.setOptions({
            rails: this.options.rails, 
            direction: (this.options.direction == Utility.Direction.X) ? GenericSync.DIRECTION_X : GenericSync.DIRECTION_Y
        });
    }

    Scrollview.prototype.setOutputFunction = function(fn, masterFn) {
        if(!fn) {
            fn = (function(offset) {
                return (this.options.direction == Utility.Direction.X) ? Matrix.translate(offset, 0) : Matrix.translate(0, offset);
            }).bind(this);
            if(!masterFn) masterFn = fn;
        }
        this._outputFunction = fn;
        this._masterOutputFunction = masterFn ? masterFn : function(offset) {
            return Matrix.inverse(fn(-offset));
        };
    }

    Scrollview.prototype.goToPreviousPage = function() {
        if(!this.node) return;
        var prevNode = this.node.getPrevious ? this.node.getPrevious() : undefined;
        if(prevNode) {
            var positionModification = _sizeForDir.call(this, this.node.getSize()) + this.options.itemSpacing;
            this.setPosition(this.getPosition() + positionModification);
            this.node = prevNode;
            for(var i in this._offsets) this._offsets[i] += positionModification;
            _attachPageSpring.call(this);

            Time.setTimeout(function() {
                this.eventOutput.emit('paginate');
            }.bind(this), 300);
        }

        return prevNode;
    }

    Scrollview.prototype.goToNextPage = function() {
        if(!this.node) return;
        var nextNode = this.node.getNext ? this.node.getNext() : undefined;
        if(nextNode) {
            var positionModification = _sizeForDir.call(this, this.node.getSize()) + this.options.itemSpacing;
            this.setPosition(this.getPosition() - positionModification);
            this.node = nextNode;
            for(var i in this._offsets) this._offsets[i] -= positionModification;
            _attachPageSpring.call(this);

            Time.setTimeout(function() {
                this.eventOutput.emit('paginate');
            }.bind(this), 300);
        }
        return nextNode;
    }

    Scrollview.prototype.getCurrentNode = function() {
        return this.node;
    }

    Scrollview.prototype.sequenceFrom = function(node) {
        if(node instanceof Array) node = new ViewSequence(node);
        this.node = node;
        this._lastFrameNode = node;
    }

    Scrollview.prototype.getSize = function() {
        if(this.options.direction == Utility.Direction.X) return [_getClipSize.call(this), undefined];
        else return [undefined, _getClipSize.call(this)];
    }

    Scrollview.prototype.render = function() {
        if(!this.node) return;
        this.physicsEngine.step();
        return this._entityId;
    }

    Scrollview.prototype.commit = function(context, transform, opacity, origin, size) {
        // reset edge detection on size change
        if(!this.options.clipSize && (size[0] != this._contextSize[0] || size[1] != this._contextSize[1])) {
            this._onEdge = 0;
            this._contextSize = size;
        }
        _normalizeState.call(this);
        var pos = this.getPosition();
        var scrollTransform = this._masterOutputFunction(-(pos + this._masterOffset));
        return {
            transform: Matrix.moveThen([-origin[0]*size[0], -origin[1]*size[1], 0], transform),
            opacity: opacity,
            origin: origin,
            size: size,
            target: {
                transform: scrollTransform,
                origin: origin,
                target: this.group.render()
            }
        };
    }

    function _innerRender() {
        var offsets = {};
        var pos = this.getPosition();
        var result = [];

        var edgeDetected = 0; // -1 for top, 1 for bottom

        // forwards
        var offset = 0;
        var currNode = this.node;
        offsets[currNode] = 0;
        while(currNode && offset - pos < _getClipSize.call(this) + this.options.margin) {
            offset += _output.call(this, currNode, offset + this._masterOffset, result) + this.options.itemSpacing;
            currNode = currNode.getNext ? currNode.getNext() : undefined;
            offsets[currNode] = offset;
            if(!currNode && offset - pos - this.options.itemSpacing <= _getClipSize.call(this)) {
                if(!this._onEdge) _setSpring.call(this, offset - _getClipSize.call(this) - this.options.itemSpacing);
                edgeDetected = 1;
            }
        }

        // backwards
        currNode = (this.node && this.node.getPrevious) ? this.node.getPrevious() : undefined;
        offset = 0;
        if(currNode) {
            var size = currNode.getSize ? currNode.getSize() : this._contextSize;
            offset -= _sizeForDir.call(this, size) + this.options.itemSpacing;
        }
        else {
            if(pos <= 0) {
                if(!this._onEdge) _setSpring.call(this, 0);
                edgeDetected = -1;
            }
        }
        while(currNode && ((offset - pos) > -(_getClipSize.call(this) + this.options.margin))) {
            offsets[currNode] = offset;
            _output.call(this, currNode, offset + this._masterOffset, result);
            currNode = currNode.getPrevious ? currNode.getPrevious() : undefined;
            if(currNode) {
                var size = currNode.getSize ? currNode.getSize() : this._contextSize;
                offset -= _sizeForDir.call(this, size) + this.options.itemSpacing;
            }
        }

        this._offsets = offsets;

        _handleEdge.call(this, edgeDetected);
        _handlePagination.call(this);

        if(this.options.paginated && (this._lastFrameNode !== this.node)) {
            this.eventOutput.emit('pageChange');
            this._lastFrameNode = this.node;
        }

        return result;
    }

    module.exports = Scrollview;

});

define('app/ArticleViews/ArticleBottomView',['require','exports','module','famous/Engine','famous/Surface','famous/ContainerSurface','famous/Modifier','famous/RenderNode','famous/Matrix','famous/View','famous-views/Scrollview'],function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Modifier            = require('famous/Modifier');
    var RenderNode          = require('famous/RenderNode');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Scrollview          = require('famous-views/Scrollview');

    function ArticleBottomView() {
        View.apply(this, arguments);

        createBacking.call(this);
        createScrollview.call(this);
    }

    function createBacking() {
        this.backing = new Surface({
            size: [320, 320],
            properties: {
                boxShadow: this.options.boxShadow
            }
        });

        var mod = new Modifier({
            origin: [0, 0]
        });

        this._add(mod).link(this.backing);
    }

    function createScrollview() {
        this.scrollview = new Scrollview(this.options.svOpts);

        this.content = new Surface({
            size: [320, 1068],
            classes: ['article', 'content'],
            content: this.options.content,
            properties: {
                backgroundColor: 'white',
            }
        });

        this.content.getSize = function() {
            return [320, 1068]
        };

        this.content.pipe(this.eventOutput);

        this.scrollview.sequenceFrom([this.content]);

        this.svMod = new Modifier({
            origin: [0.5, 0],
            transform: FM.translate(0, -320, 0)
        });

        this.container = new ContainerSurface({
            size: [undefined, 320],
            properties: {
                overflow: 'hidden'
            }
        });

        this.container.add(this.svMod).link(this.scrollview);

        this.contMod = new Modifier();
        this._add(this.contMod).link(this.container);
    }

    ArticleBottomView.prototype = Object.create(View.prototype);
    ArticleBottomView.prototype.constructor = ArticleBottomView;

    ArticleBottomView.DEFAULT_OPTIONS = {
        scale: null,
        thumbCoverSm: null,
        thumbCoverLg: null,
        content: null,
        svOpts: {
            itemSpacing: 0,
            clipSize: window.innerHeight,
            margin: window.innerHeight,
            drag: 0.001,
            edgeGrip: 1,
            edgePeriod: 300,
            // edgeDamp: 1,
            // paginated: false,
            // pagePeriod: 500,
            // pageDamp: 0.8,
            // pageStopSpeed: Infinity,
            // pageSwitchSpeed: 1,
            speedLimit: 10
        },
        boxShadow: null
    };

    ArticleBottomView.prototype.setAngle = function(angle) {
        this.contMod.setTransform(FM.rotateX(0));
    };

    ArticleBottomView.prototype.enableScroll = function() {
        this.content.pipe(this.scrollview);
    };

    ArticleBottomView.prototype.disableScroll = function() {
        this.content.unpipe(this.scrollview);
    };

    ArticleBottomView.prototype.noShadow = function() {
        this.backing.setProperties({
            boxShadow: ''
        });
    };

    ArticleBottomView.prototype.shadow = function() {
        this.backing.setProperties({
            boxShadow: this.options.boxShadow
        });
    };

    module.exports = ArticleBottomView;
});
define('app/ArticleViews/ArticleFullView',['require','exports','module','famous/Engine','famous/Surface','famous/ContainerSurface','famous/Modifier','famous/RenderNode','famous/Matrix','famous/View','famous-views/Scrollview'],function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Modifier            = require('famous/Modifier');
    var RenderNode          = require('famous/RenderNode');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Scrollview          = require('famous-views/Scrollview');

    function ArticleFullView() {
        View.apply(this, arguments);

        createBacking.call(this);
        createScrollview.call(this);
    }

    function createBacking() {
        var surface = new Surface({
            size: [undefined, undefined],
            properties: {
                backgroundColor: 'white'
            }
        });

        // this._add(surface);

        // surface.pipe(this.eventOutput);
    }

    function createScrollview() {
        this.scrollview = new Scrollview(this.options.svOpts);

        this.content = new Surface({
            size: [320, 1080],
            classes: ['article', 'content'],
            content: this.options.content,
            properties: {
                backgroundColor: 'white',
                // boxShadow: this.options.boxShadow
            }
        });

        this.content.getSize = function() {
            return [320, 1080]
        };

        this.scrollview.sequenceFrom([this.content]);
        // this.content.pipe(this.scrollview);

        this.mod = new Modifier({
            transform: FM.translate(0, -9999, 0)
        });

        this._add(this.mod).link(this.scrollview);
    }

    ArticleFullView.prototype = Object.create(View.prototype);
    ArticleFullView.prototype.constructor = ArticleFullView;

    ArticleFullView.DEFAULT_OPTIONS = {
        scale: null,
        thumbCoverSm: null,
        thumbCoverLg: null,
        content: null,
        svOpts: {
            itemSpacing: 0,
            clipSize: window.innerHeight,
            margin: window.innerHeight,
            drag: 0.001,
            edgeGrip: 1,
            edgePeriod: 300,
            // edgeDamp: 1,
            // paginated: false,
            // pagePeriod: 500,
            // pageDamp: 0.8,
            // pageStopSpeed: Infinity,
            // pageSwitchSpeed: 1,
            speedLimit: 10
        },
        boxShadow: null
    };

    ArticleFullView.prototype.hide = function() {
        this.mod.setTransform(FM.translate(0, -9999, 0));
    };

    ArticleFullView.prototype.show = function() {
        this.mod.setTransform(FM.translate(0, 0, 0));
    };

    module.exports = ArticleFullView;
});
define('app/ArticleViews/ArticleTopView',['require','exports','module','famous/Engine','famous/Surface','famous/ContainerSurface','famous/Modifier','famous/RenderNode','famous/Matrix','famous/View','famous-views/Scrollview'],function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Modifier            = require('famous/Modifier');
    var RenderNode          = require('famous/RenderNode');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Scrollview          = require('famous-views/Scrollview');

    function ArticleTopView() {
        View.apply(this, arguments);

        createContainer.call(this);
        createCover.call(this);
        // createBacking.call(this);
        createScrollview.call(this);
    }

    function createContainer() {
        this.container = new ContainerSurface({
            size: [undefined, 320],
            properties: {
                overflow: 'hidden'
            }
        });

        this.container.pipe(this.eventOutput);
    }

    function createCover() {
        this.coverLgImg = new Image();
        this.coverLgImg.src = this.options.thumbLg;
        this.coverLgImg.width = 320;

        this.coverLg = new Surface({
            size: [320, 274],
            content: this.coverLgImg,
            properties: {
                // boxShadow: this.options.boxShadow
            }
        });

        this.thumbLgMod = new Modifier();

        this.coverLg.pipe(this.eventOutput);

        this._add(this.thumbLgMod).link(this.coverLg);
    }

    function createBacking() {
        var backing = new Surface({
            size: [320, 320],
            properties: {
                backgroundColor: 'white'
            }
        });

        this.container.add(backing);
    }

    function createScrollview() {
        this.scrollview = new Scrollview(this.options.svOpts);

        this.content = new Surface({
            size: [320, 1068],
            classes: ['article', 'content'],
            content: this.options.content,
            properties: {
                backgroundColor: 'white',
                // boxShadow: this.options.boxShadow
            }
        });

        this.content.getSize = function() {
            return [320, 1068]
        };

        this.content.pipe(this.scrollview);
        this.scrollview.sequenceFrom([this.content]);

        var svMod = new Modifier({
            origin: [0.5, 0]
        });

        this.container.add(svMod).link(this.scrollview);    

        this.contMod = new Modifier();
        this._add(this.contMod).link(this.container);
    }

    ArticleTopView.prototype = Object.create(View.prototype);
    ArticleTopView.prototype.constructor = ArticleTopView;

    ArticleTopView.DEFAULT_OPTIONS = {
        scale: null,
        thumbSm: null,
        thumbLg: null,
        content: null,
        svOpts: {
            itemSpacing: 0,
            clipSize: window.innerHeight,
            margin: window.innerHeight,
            drag: 0.001,
            edgeGrip: 1,
            edgePeriod: 300,
            // edgeDamp: 1,
            // paginated: false,
            // pagePeriod: 500,
            // pageDamp: 0.8,
            // pageStopSpeed: Infinity,
            // pageSwitchSpeed: 1,
            speedLimit: 10
        },
        boxShadow: null
    };

    ArticleTopView.prototype.setAngle = function(angle) {
        this.contMod.setTransform(FM.aboutOrigin([0, 320, 0], FM.rotateX(-angle)));
        this.thumbLgMod.setTransform(FM.moveThen([0, 320, 0.01], FM.aboutOrigin([0, 320, 0], FM.rotate(-angle + Math.PI, 0, 0))));
    };

    ArticleTopView.prototype.enableScroll = function() {
        this.content.pipe(this.scrollview);
    };

    ArticleTopView.prototype.disableScroll = function() {
        this.content.unpipe(this.scrollview);
    };

    module.exports = ArticleTopView;
});
define('surface-extensions/ExpandingSurface',['require','exports','module','famous/Surface','famous/Engine'],function(require, exports, module) {    
    var Surface = require('famous/Surface');
    var Engine = require('famous/Engine');

    function ExpandingSurface ( options ) {

        this.getCustomSize = options.getCustomSize ? 
            options.getCustomSize : 
            function (target) {
                return [this.size[0], target.firstChild.clientHeight];
            };

        this._resizeDirty = true;
        this._checkHeight = checkHeight.bind(this);

        Engine.on('postrender', this._checkHeight );

        Surface.apply( this, arguments );
    }

    ExpandingSurface.prototype = Object.create( Surface.prototype );
    ExpandingSurface.prototype.constructor = ExpandingSurface;

    ExpandingSurface.prototype.setHeightDirty = function () {
        this._resizeDirty = true; 
        Engine.on('postrender', this._checkHeight );        
    }
    
    ExpandingSurface.prototype.setContent = function (content) {
        if(this.content != content) {
            this.content = '<div style="float:left">' + content + '</div>';
            this._contentDirty = true;
        }
        this.setHeightDirty();
    };

    function checkHeight () {
        if( this._resizeDirty && this._currTarget) { 

            var size = this.getCustomSize.call( this, this._currTarget ); 

            this.setSize(size);
            this.emit('resize', size);

            this._resizeDirty = false;

            Engine.unbind('postrender', this._checkHeight);
        }
    }

    module.exports = ExpandingSurface;
});

define('famous-animation/Easing',['require','exports','module'],function(require, exports, module) {

    /*
     *  EasingNameNorm: 
     *  @param {float} t: (time) expects a number between 0 and 1.
     *  @returns {float}: between 0 and 1, based on the curve.
     *  NOTE: Can only use Norm functions with FamousTransforms, passed in as a curve.
     *
     *  @example:
     *  var curve = { 
     *      curve: Easing.inOutBackNorm,
     *      duration: 500
     *  }
     *  yourTransform.setTransform(FM.identity, curve);
     *
     *  This would animate over 500 milliseconds back to [0, 0, 0]
     *
     *      
     *  EasingName: 
     *  @param {float} t: current normalized time: expects a number between 0 and 1.
     *
     *  @param {float} b: start value
     *
     *  @param {float} c: the total change of the easing function.
     * 
     *  @param {float} d: the duration of the tween, normally left at 1.
     *
     *  @returns {float}: number between b and b+c;
     *
     *  Most often used with the Animation engine:
     *  @example:
     *  animation.update = function() {
     *      someFunction.set(Easing.inOutCubic(this.getTime(), 0, 1000, 1.0)); 
     *  }
     *
     *  this would output numbers between 0 and 1000.
     *
     */ 

    var Easing = {
        linear: function(t, b, c, d)
        {
            return t*(c/d) + b;  
        }, 

        linearNorm: function(t)
        {
            return t; 
        },

        inQuad: function(t, b, c, d) 
        {
            return c*(t/=d)*t + b;
        },

        inQuadNorm: function(t)
        {
            return t*t; 
        },

        outQuad: function(t, b, c, d) 
        {
            return -c *(t/=d)*(t-2) + b;
        },

        outQuadNorm: function(t)
        {
            return -(t-=1)*t+1; 
        },

        inOutQuad: function(t, b, c, d) 
        {
            if ((t/=d/2) < 1) return c/2*t*t + b;
            return -c/2 * ((--t)*(t-2) - 1) + b;
        },

        inOutQuadNorm: function(t)
        {
            if ((t/=.5) < 1) return .5*t*t; 
            return -.5*((--t)*(t-2) - 1); 
        },

        inCubic: function(t, b, c, d) 
        {
            return c*(t/=d)*t*t + b;
        },

        inCubicNorm: function(t)
        {
            return t*t*t; 
        },

        outCubic: function(t, b, c, d) 
        {
            return c*((t=t/d-1)*t*t + 1) + b;
        },

        outCubicNorm: function(t)
        {
            return ((--t)*t*t + 1); 
        },

        inOutCubic: function(t, b, c, d) 
        {
            if ((t/=d/2) < 1) return c/2*t*t*t + b;
            return c/2*((t-=2)*t*t + 2) + b;
        },

        inOutCubicNorm: function(t)
        {
            if ((t/=.5) < 1) return .5*t*t*t;
            return .5*((t-=2)*t*t + 2); 
        },

        inQuart: function(t, b, c, d) 
        {
            return c*(t/=d)*t*t*t + b;
        },
        
        inQuartNorm: function(t)
        {
            return t*t*t*t; 
        },
        
        outQuart: function(t, b, c, d) 
        {
            return -c * ((t=t/d-1)*t*t*t - 1) + b;
        },
        
        outQuartNorm: function(t)
        {
            return -((--t)*t*t*t - 1); 
        },
        
        inOutQuart: function(t, b, c, d) 
        {
            if ((t/=d/2) < 1) return c/2*t*t*t*t + b;
            return -c/2 * ((t-=2)*t*t*t - 2) + b;
        },

        inOutQuartNorm: function(t) 
        {
            if ((t/=.5) < 1) return .5*t*t*t*t;
            return -.5 * ((t-=2)*t*t*t - 2);
        },
        
        inQuint: function(t, b, c, d) 
        {
            return c*(t/=d)*t*t*t*t + b;
        },

        inQuintNorm: function(t)
        {
            return t*t*t*t*t;
        },
        
        outQuint: function(t, b, c, d) 
        {
            return c*((t=t/d-1)*t*t*t*t + 1) + b;
        },

        outQuintNorm: function(t)
        {
            return ((--t)*t*t*t*t + 1); 
        },
        
        inOutQuint: function(t, b, c, d) 
        {
            if ((t/=d/2) < 1) return c/2*t*t*t*t*t + b;
            return c/2*((t-=2)*t*t*t*t + 2) + b;
        },

        inOutQuintNorm: function(t)
        {
            if ((t/=.5) < 1) return .5*t*t*t*t*t;
            return .5*((t-=2)*t*t*t*t + 2);
        },
        
        inSine: function(t, b, c, d) 
        {
            return -c * Math.cos(t/d * (Math.PI/2)) + c + b;
        },

        inSineNorm: function(t)
        {
            return -1.0*Math.cos(t * (Math.PI/2)) + 1.0; 
        },
        
        outSine: function(t, b, c, d) 
        {
            return c * Math.sin(t/d * (Math.PI/2)) + b;
        },

        outSineNorm: function(t)
        {
            return Math.sin(t * (Math.PI/2)); 
        },
        
        inOutSine: function(t, b, c, d) 
        {
            return -c/2 * (Math.cos(Math.PI*t/d) - 1) + b;
        },

        inOutSineNorm: function(t)
        {
            return -.5*(Math.cos(Math.PI*t) - 1); 
        },
        
        inExpo: function(t, b, c, d) 
        {
            return (t==0) ? b : c * Math.pow(2, 10 * (t/d - 1)) + b;
        },

        inExpoNorm: function(t)
        {
            return (t==0) ? 0.0 : Math.pow(2, 10 * (t - 1));
        },
        
        outExpo: function(t, b, c, d) 
        {
            return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;
        },

        outExpoNorm: function(t) 
        {
            return (t==1.0) ? 1.0 : (-Math.pow(2, -10 * t) + 1); 
        },
        
        inOutExpo: function (t, b, c, d) 
        {
            if (t==0) return b;
            if (t==d) return b+c;
            if ((t/=d/2) < 1) return c/2 * Math.pow(2, 10 * (t - 1)) + b;
            return c/2 * (-Math.pow(2, -10 * --t) + 2) + b;
        },

        inOutExpoNorm: function(t) 
        {
            if (t==0) return 0.0;
            if (t==1.0) return 1.0; 
            if ((t/=.5) < 1) return .5 * Math.pow(2, 10 * (t - 1)); 
            return .5 * (-Math.pow(2, -10 * --t) + 2);
        },
        
        inCirc: function(t, b, c, d) 
        {
            return -c * (Math.sqrt(1 - (t/=d)*t) - 1) + b;
        },

        inCircNorm: function(t)
        {
            return -(Math.sqrt(1 - t*t) - 1);
        },
        
        outCirc: function(t, b, c, d) 
        {
            return c * Math.sqrt(1 - (t=t/d-1)*t) + b;
        },
        
        outCircNorm: function(t)
        {
            return Math.sqrt(1 - (--t)*t); 
        },
        
        inOutCirc: function(t, b, c, d) 
        {
            if ((t/=d/2) < 1) return -c/2 * (Math.sqrt(1 - t*t) - 1) + b;
            return c/2 * (Math.sqrt(1 - (t-=2)*t) + 1) + b;
        },

        inOutCircNorm: function(t)
        {
            // return Easing.inOutCirc(t, 0.0, 1.0, 1.0); 
            if ((t/=.5) < 1) return -.5 * (Math.sqrt(1 - t*t) - 1);
            return .5 * (Math.sqrt(1 - (t-=2)*t) + 1); 
        },
        
        inElastic: function(t, b, c, d) 
        {
            var s=1.70158;var p=0;var a=c;
            if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
            if (a < Math.abs(c)) { a=c; var s=p/4; }
            else var s = p/(2*Math.PI) * Math.asin (c/a);
            return -(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
        },

        inElasticNorm: function (t)
        {
            var s=1.70158;var p=0;var a=1.0;
            if (t==0) return 0.0;  if (t==1) return 1.0;  if (!p) p=.3;         
            s = p/(2*Math.PI) * Math.asin (1.0/a);
            return -(a*Math.pow(2,10*(t-=1)) * Math.sin( (t-s)*(2*Math.PI)/ p)); 
        },
        
        outElastic: function(t, b, c, d) 
        {
            var s=1.70158;var p=0;var a=c;
            if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
            if (a < Math.abs(c)) { a=c; var s=p/4; }
            else var s = p/(2*Math.PI) * Math.asin (c/a);
            return a*Math.pow(2,-10*t) * Math.sin( (t*d-s)*(2*Math.PI)/p ) + c + b;
        },
        
        outElasticNorm: function(t)
        {           
            var s=1.70158;var p=0;var a=1.0;
            if (t==0) return 0.0;  if (t==1) return 1.0;  if (!p) p=.3;
            s = p/(2*Math.PI) * Math.asin (1.0/a);
            return a*Math.pow(2,-10*t) * Math.sin( (t-s)*(2*Math.PI)/p ) + 1.0; 
        },
        
        inOutElastic: function(t, b, c, d) 
        {
            var s=1.70158;var p=0;var a=c;
            if (t==0) return b;  if ((t/=d/2)==2) return b+c;  if (!p) p=d*(.3*1.5);
            if (a < Math.abs(c)) { a=c; var s=p/4; }
            else var s = p/(2*Math.PI) * Math.asin (c/a);
            if (t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
            return a*Math.pow(2,-10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )*.5 + c + b;
        },

        inOutElasticNorm: function(t)
        {
            var s=1.70158;var p=0;var a=1.0;
            if (t==0) return 0.0;  if ((t/=.5)==2) return 1.0;  if (!p) p=(.3*1.5);         
            s = p/(2*Math.PI) * Math.asin (1.0/a);
            if (t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin( (t-s)*(2*Math.PI)/p ));
            return a*Math.pow(2,-10*(t-=1)) * Math.sin( (t-s)*(2*Math.PI)/p )*.5 + 1.0; 
        },
        
        inBack: function(t, b, c, d, s) 
        {
            if (s == undefined) s = 1.70158;
            return c*(t/=d)*t*((s+1)*t - s) + b;
        },

        inBackNorm: function(t, s) 
        {
            if (s == undefined) s = 1.70158;
            return t*t*((s+1)*t - s);
        },
        
        outBack: function (t, b, c, d, s) 
        {
            if (s == undefined) s = 1.70158;
            return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;
        },

        outBackNorm: function (t, s) 
        {
            if (s == undefined) s = 1.70158;
            return ((--t)*t*((s+1)*t + s) + 1);
        },
        
        inOutBack: function (t, b, c, d, s) 
        {
            if (s == undefined) s = 1.70158; 
            if ((t/=d/2) < 1) return c/2*(t*t*(((s*=(1.525))+1)*t - s)) + b;
            return c/2*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2) + b;
        },

        inOutBackNorm: function(t, s) 
        {
            if (s == undefined) s = 1.70158; 
            if ((t/=.5) < 1) return .5*(t*t*(((s*=(1.525))+1)*t - s)); 
            return .5*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2); 
        },
        
        inBounce: function(t, b, c, d) 
        {
            return c - Easing.outBounce(d-t, 0, c, d) + b;
        },  

        inBounceNorm: function(t)
        {
            return 1.0 - Easing.outBounceNorm(1.0-t); 
        },              
    
        outBounce: function(t, b, c, d) 
        {
            if ((t/=d) < (1/2.75)) {
                return c*(7.5625*t*t) + b;
            } else if (t < (2/2.75)) {
                return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;
            } else if (t < (2.5/2.75)) {
                return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;
            } else {
                return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;
            }
        },

        outBounceNorm: function(t) 
        {
            if (t < (1/2.75)) {
                return (7.5625*t*t);
            } else if (t < (2/2.75)) {
                return (7.5625*(t-=(1.5/2.75))*t + .75); 
            } else if (t < (2.5/2.75)) {
                return (7.5625*(t-=(2.25/2.75))*t + .9375);
            } else {
                return (7.5625*(t-=(2.625/2.75))*t + .984375); 
            }
        },
        
        inOutBounce: function(t, b, c, d) 
        {
            if (t < d/2) return Easing.inBounce (t*2, 0, c, d) * .5 + b;
            return Easing.outBounce (t*2-d, 0, c, d) * .5 + c*.5 + b;
        },

        inOutBounceNorm: function(t)
        {
            if (t < .5) return Easing.inBounceNorm (t*2) * .5; 
            return Easing.outBounceNorm(t*2-1.0) * .5 + .5; 
        }
    }; 
    
    module.exports = Easing;
});

define('famous-utils/Utils',['require','exports','module','./Time','famous/Matrix'],function(require, exports, module) {
    var Time = require('./Time');    
    var FM = require('famous/Matrix');

    var Utils = {                
        rad2deg: function(rad)
        {
            return rad * 57.2957795; 
        },
    
        deg2rad: function(deg)
        {
            return deg * 0.0174532925; 
        },

        distance: function(x1, y1, x2, y2)
        {
            var deltaX = x2 - x1; 
            var deltaY = y2 - y1; 
            return Math.sqrt(deltaX*deltaX + deltaY*deltaY); 
        },

        distance3D: function(x1, y1, z1, x2, y2, z2)
        {
            var deltaX = x2 - x1; 
            var deltaY = y2 - y1; 
            var deltaZ = z2 - z1; 
            return Math.sqrt(deltaX*deltaX + deltaY*deltaY + deltaZ*deltaZ); 
        },

        map: function(value, inputMin, inputMax, outputMin, outputMax, clamp)
        {           
            var outValue = ((value - inputMin)/(inputMax - inputMin)) * (outputMax - outputMin) + outputMin; 
            if(clamp)
            {               
                if(outputMax > outputMin)
                {
                    if(outValue > outputMax)
                    {
                        outValue = outputMax; 
                    }
                    else if(outValue < outputMin)
                    {
                        outValue = outputMin; 
                    }   
                }
                else
                {
                    if(outValue < outputMax)
                    {
                        outValue = outputMax; 
                    }
                    else if(outValue > outputMin)
                    {
                        outValue = outputMin; 
                    }   
                }           
            }
            return outValue;         
        },

        limit: function(value, low, high)
        {
            value = Math.min(value, high); 
            value = Math.max(value, low); 
            return value;             
        },

        perspective: function(fovy, aspect, near, far) 
        {
            var out = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
            var f = 1.0 / Math.tan(fovy / 2),
            nf = 1.0 / (near - far);
            out[0] = f / aspect;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;

            out[4] = 0;
            out[5] = f;
            out[6] = 0;
            out[7] = 0;
            
            out[8] = 0;
            out[9] = 0;
            out[10] = (far + near) * nf;
            out[11] = -1;
            
            out[12] = 0;
            out[13] = 0;
            out[14] = (2 * far * near) * nf;
            out[15] = 0;
            return out;
        },

        ortho: function(left, right, bottom, top, near, far)
        {
            var out = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
            var tx = -(right+left)/(right-left);
            var ty = -(top+bottom)/(top-bottom);
            var tz = -(far+near)/(far-near);

            out[0] = 2.0/(right-left); 
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;

            out[4] = 0;
            out[5] = 2.0/(top-bottom);
            out[6] = 0;
            out[7] = 0;
            
            out[8] = 0;
            out[9] = 0;
            out[10] = -2.0/(far-near);
            out[11] = -1;
            
            out[12] = tx; 
            out[13] = ty;
            out[14] = tz;
            out[15] = 1.0;
            return out;
        },

        normalFromFM: function (out, a) 
        {
            var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
            a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
            a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
            a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

            b00 = a00 * a11 - a01 * a10,
            b01 = a00 * a12 - a02 * a10,
            b02 = a00 * a13 - a03 * a10,
            b03 = a01 * a12 - a02 * a11,
            b04 = a01 * a13 - a03 * a11,
            b05 = a02 * a13 - a03 * a12,
            b06 = a20 * a31 - a21 * a30,
            b07 = a20 * a32 - a22 * a30,
            b08 = a20 * a33 - a23 * a30,
            b09 = a21 * a32 - a22 * a31,
            b10 = a21 * a33 - a23 * a31,
            b11 = a22 * a33 - a23 * a32,

            // Calculate the determinant
            det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

            if (!det) { 
                return null; 
            }
            det = 1.0 / det;

            out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
            out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
            out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;

            out[3] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
            out[4] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
            out[5] = (a01 * b08 - a00 * b10 - a03 * b06) * det;

            out[6] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
            out[7] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
            out[8] = (a30 * b04 - a31 * b02 + a33 * b00) * det;

            return out;
        }, 

        clamp: function(v, min, max)        
        {
            if(v < min)
            {
                return min; 
            }
            else if(v > max)
            {
                return max; 
            }
            return v; 
        },

        color: function(red, green, blue, alpha)
        {
            return 'rgba('+Math.floor(red)+','+Math.floor(green)+','+Math.floor(blue)+','+alpha+')'; 
        },
        
        backgroundTransparent: function()
        {
            return {'backgroundColor': 'transparent'}; 
        },

        backgroundColor: function(red, green, blue, alpha)
        {
            return {'backgroundColor': 'rgba('+Math.floor(red)+','+Math.floor(green)+','+Math.floor(blue)+','+alpha+')'}; 
        },

        borderRadius: function(r)
        {
            return {'borderRadius': r+'px'}; 
        },

        borderTopWidth: function(r)
        {
            return {'borderTopWidth': r+'px'}; 
        },

        borderBottomWidth: function(r)
        {
            return {'borderBottomWidth': r+'px'}; 
        },

        borderLeftWidth: function(r)
        {
            return {'borderLeftWidth': r+'px'}; 
        },

        borderRightWidth: function(r)
        {
            return {'borderRightWidth': r+'px'}; 
        },

        borderWidth: function(size)
        {
            return {'borderWidth': size+'px'};
        },

        borderColor: function(red, green, blue, alpha)
        {
            if(alpha == 0.0)
            {
                return {'borderColor': 'transparent'}; 
            }
            else
            {
                return {'borderColor': 'rgba('+Math.floor(red)+','+Math.floor(green)+','+Math.floor(blue)+','+alpha+')'}; 
            }            
        },

        borderTopColor: function(red, green, blue, alpha)
        {
            if(alpha == 0.0)
            {
                return {'borderTopColor': 'transparent'}; 
            }
            else
            {
                return {'borderTopColor': 'rgba('+Math.floor(red)+','+Math.floor(green)+','+Math.floor(blue)+','+alpha+')'}; 
            }            
        },

        borderBottomColor: function(red, green, blue, alpha)
        {
            if(alpha == 0.0)
            {
                return {'borderBottomColor': 'transparent'}; 
            }
            else
            {
                return {'borderBottomColor': 'rgba('+Math.floor(red)+','+Math.floor(green)+','+Math.floor(blue)+','+alpha+')'}; 
            }            
        },

        borderRightColor: function(red, green, blue, alpha)
        {
            if(alpha == 0.0)
            {
                return {'borderRightColor': 'transparent'}; 
            }
            else
            {
                return {'borderRightColor': 'rgba('+Math.floor(red)+','+Math.floor(green)+','+Math.floor(blue)+','+alpha+')'}; 
            }            
        },

        borderLeftColor: function(red, green, blue, alpha)
        {
            if(alpha == 0.0)
            {
                return {'borderLeftColor': 'transparent'}; 
            }
            else
            {
                return {'borderLeftColor': 'rgba('+Math.floor(red)+','+Math.floor(green)+','+Math.floor(blue)+','+alpha+')'}; 
            }            
        },

        borderStyle: function(style)
        {
            return {'borderStyle': style};
        },

        borderTopStyle: function(style)
        {
            return {'borderTopStyle': style};
        },

        borderBottomStyle: function(style)
        {
            return {'borderBottomStyle': style};
        },

        borderRightStyle: function(style)
        {
            return {'borderRightStyle': style};
        },

        borderLeftStyle: function(style)
        {
            return {'borderLeftStyle': style};
        },

        colorHSL: function(hue, saturation, lightness, alpha)
        {
            return 'hsla('+Math.floor(hue)+','+Math.floor(saturation)+'%,'+Math.floor(lightness)+'%,'+alpha+')'; 
        },

        backgroundTransparent: function()
        {
            return {'backgroundColor': 'transparent'};             
        }, 

        backgroundColorHSL: function(hue, saturation, lightness, alpha)
        {
            return {'backgroundColor': 'hsla('+Math.floor(hue)+','+Math.floor(saturation)+'%,'+Math.floor(lightness)+'%,'+alpha+')'}; 
        },

        backfaceVisible: function(value)
        {
            if(value === true)
            {
                return {
                   'backface-visibility':'visible',
                    '-webkit-backface-visibility':'visible',
                    'MozBackfaceVisibility':'visible',
                    '-ms-backface-visibility': 'visible',
                }; 
            }
            else
            {
                return {
                   'backface-visibility':'hidden',
                    '-webkit-backface-visibility':'hidden',
                    'MozBackfaceVisibility':'hidden',
                    '-ms-backface-visibility': 'hidden',
                }; 
            }
        }, 

        clipCircle: function(x, y, r)
        {
            return {'-webkit-clip-path': 'circle('+x+'px,'+y+'px,'+r+'px)'};
        },        

        getWidth: function()
        {            
            return window.innerWidth; 
        },

        getHeight: function()
        {
            return window.innerHeight;                        
        },

        getCenter: function()
        {
            return [Utils.getWidth()*.5, Utils.getHeight()*.5]; 
        },
        
        isMobile: function() { 
            if( /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent) ) {
                return true;
            } 
            return false;
        },

        isString: function (maybeString) {
            return (typeof maybeString == 'string' || maybeString instanceof String) 
        },

        isArray: function (maybeArray) {
            return Object.prototype.toString.call( maybeArray ) === '[object Array]';
        },

        extend: function(a, b) {
            for(var key in b) { 
                a[key] = b[key];
            }
            return a;
        },

        getDevicePixelRatio: function()
        {
            return (window.devicePixelRatio ? window.devicePixelRatio : 1); 
        },

        supportsWebGL: function()
        {
            if( /Android|Chrome|Mozilla/i.test(navigator.appCodeName) && !!window.WebGLRenderingContext) {
                return true;
            } 
            return false;
        }, 

        getSurfacePosition: function(surface) {

            var currTarget = surface._currTarget;
            var transforms = [];
            var totalDist = [0, 0, 0];

            function getAllTransforms ( elem ) {

                var transform = getTransform(elem);

                if(transform !== "" && transform !== undefined ) {
                    var offset = parseTransform(transform);

                    totalDist[0] += offset[0];
                    totalDist[1] += offset[1];
                    totalDist[2] += offset[2];
                    
                }

                if( elem.parentElement !== document.body ) {
                    getAllTransforms(elem.parentNode);
                }
                
            }
            
            function parseTransform(transform) {
                var translate = []; 

                transform = removeMatrix3d( transform );

                translate[0] = parseInt(transform[12].replace(' ', '')); 
                translate[1] = parseInt(transform[13].replace(' ', ''));        
                translate[2] = parseInt(transform[14].replace(' ', ''));        

                for (var i = 0; i < translate.length; i++) {
                    if(typeof translate[i] == 'undefined') {
                        translate[i] = 0;
                    }
                };

                return translate;
            }

            function removeMatrix3d( mtxString ) { 
                mtxString = mtxString.replace('matrix3d(','');
                mtxString = mtxString.replace(')','');
                return mtxString.split(',');
            }

            function getTransform( elem ) { 
                var transform = elem['style']['webkitTransform'] || elem['style']['transform'] ;
                return transform;
            }

            if(currTarget) {

                getAllTransforms(currTarget);

            } else {

                return undefined;
            }

            return totalDist; 
        },

        // get center from [0, 0] origin
        getCenterMatrix: function ( pos, size, z) {
            if(z == undefined) z = 0;
            return FM.translate( pos[0] - size[0] * 0.5, pos[1] - size[1] * 0.5, z ); 
        },
        
        debounce: function (func, wait) {
           var timeout, ctx, timestamp, result, args;
           return function () {
                ctx = this;
                args = arguments;
                timestamp = new Date();

                var later =  function () {
                    var last = new Date() - timestamp;

                    if(last < wait) {
                        timeout = Time.setTimeout(later, wait - last);
                    } else { 
                        timeout = null;
                        result = func.apply(ctx, args);
                    }
                };

                if(!timeout) { 
                    timeout = Time.setTimeout(later, wait);
                }

                return result;
            };
        }, 

        hasUserMedia: function() {
            return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia || navigator.msGetUserMedia);
        },

        getUserMedia: function()
        {
            return navigator.getUserMedia || navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia || navigator.msGetUserMedia; 
        }, 

        isWebkit: function () {
           return !!window.webkitURL; 
        }

    };

    module.exports = Utils;
});

define('app/ArticleViews/ArticleView',['require','exports','module','famous/Engine','famous/Surface','surface-extensions/ExpandingSurface','famous/Modifier','famous/RenderNode','famous/Matrix','famous/View','famous-animation/Easing','famous/ContainerSurface','famous/Transitionable','famous-views/Scrollview','famous/ContainerSurface','famous/Utility','famous-utils/Utils','famous/EventHandler','./ArticleTopView','./ArticleBottomView','./ArticleFullView'],function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var ExpandingSurface    = require('surface-extensions/ExpandingSurface');
    var Modifier            = require('famous/Modifier');
    var RenderNode          = require('famous/RenderNode');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    var ContainerSurface    = require('famous/ContainerSurface');
    // var GenericSync         = require('famous-sync/GenericSync');
    var Transitionable      = require('famous/Transitionable');
    // var SpringTransition    = require('famous-physics/utils/SpringTransition');
    var Scrollview          = require('famous-views/Scrollview');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Utility             = require('famous/Utility');
    var Utils               = require('famous-utils/Utils');
    var EventHandler        = require('famous/EventHandler');

    var ArticleTopView      = require('./ArticleTopView');
    var ArticleBottomView   = require('./ArticleBottomView');
    var ArticleFullView     = require('./ArticleFullView');

    // Transitionable.registerMethod('spring', SpringTransition);

    function ArticleView() {
        View.apply(this, arguments);

        this.contentWidth = window.innerWidth - 2*this.options.margin;

        createArticleTop.call(this);
        createArticleBottom.call(this);
        // createArticleFull.call(this);
        createCover.call(this);

        function createArticleTop() {
            this.articleTop = new ArticleTopView(this.options);

            this.articleTop.pipe(this.eventOutput);
        }

        function createArticleBottom() {
            this.articleBottom = new ArticleBottomView(this.options);

            this.articleBottom.pipe(this.eventOutput);
            this.articleBottom.content.pipe(this.articleTop.scrollview);
        }

        function createArticleFull() {
            this.articleFull = new ArticleFullView(this.options);

            this.articleFull.content.pipe(this.articleTop.scrollview);
            this.articleFull.content.pipe(this.articleBottom.scrollview);
        }

        function createCover() {
            this.cover = new Surface();
            this.cover.pipe(this.eventOutput);
            this.cover.pipe(this.articleTop.scrollview);
            this.cover.pipe(this.articleBottom.scrollview);

            this.cover.on('touchstart', function() {
                this.touch = true;
            }.bind(this));

            this.cover.on('touchend', function() {
                this.touch = false;
            }.bind(this));
        }
    }

    ArticleView.prototype = Object.create(View.prototype);
    ArticleView.prototype.constructor = ArticleView;

    ArticleView.DEFAULT_OPTIONS = {
        scale: null,
        content: null,
        thumbSm: null,
        thumbLg: null,

        margin: 20,
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)'
    };

    ArticleView.prototype.getSize = function() {
    };

    ArticleView.prototype.setProgress = function(progress) {
        this.progress = progress;
    };

    ArticleView.prototype.map = function(start, end, clamp) {
        return Utils.map(this.progress, 0, 1, start, end, clamp);
    };

    ArticleView.prototype.enableScroll = function() {
        // this.enable = true;
        this.articleTop.enableScroll();
        this.articleBottom.enableScroll();
        // this.articleBottom.content.pipe(this.articleTop.scrollview);
    };

    ArticleView.prototype.disableScroll = function() {
        // this.enable = false;
        this.articleTop.disableScroll();
        this.articleBottom.disableScroll();
        // this.articleBottom.content.unpipe(this.articleTop.scrollview);
    };

    ArticleView.prototype.sequence = function() {
        console.log('sequence');
    };

    ArticleView.prototype.setAngle = function(angle) {
        this.angle = angle;
    };

    ArticleView.prototype.render = function() {
        this.articleTop.setAngle(this.angle);
        this.articleBottom.setAngle(this.angle);
        // var namePos = this.map(120, 85);
        // var textPos = this.map(140, 105);
        // var photoPos = this.map(-20, -68);
        // var footerPos = this.map(48, 0);

        // this.profilePicsView.setProgress(this.progress);
        // this.nameView.setProgress(this.progress);
        // this.nameView.fade(this.progress);
        // this.textView.fade(this.progress);

        this.atTop = Math.abs(this.articleTop.scrollview.getPosition()) < 5;
        console.log(this.atTop);

        this.spec = [];

        // this.mod0.setTransform(FM.translate(0, this.map(0, 0), 0.00001));
        // this.mod1.setTransform(FM.move(FM.rotateZ(this.map(-0.04, 0)), [this.map(-6, 0), this.map(-290, 0), 0]));

        // this.articleBottom.scrollview.setPosition(this.articleTop.scrollview.getPosition());

        this.spec.push({
            // target: this.articleFull.render()
        });

        if(this.angle === 0) {
            // this.articleFull.show();
        }

        // if(this.angle !== 0) {
            // this.articleFull.hide();

            this.spec.push({
                transform: FM.translate(0, 0, 0),
                target: this.articleTop.render()
            });

            this.spec.push({
                transform: FM.translate(0, 320, 0),
                target: this.articleBottom.render()
            });
if(this.enable) {
            this.spec.push({
                transform: FM.translate(0, 0, 500),
                target: this.cover.render()
            });
        }
        // }

        return this.spec;
    };

    module.exports = ArticleView;
});

define('app/CoverViews/CoverView',['require','exports','module','famous/Surface','famous/Modifier','famous/Matrix','famous/View','famous-animation/Easing'],function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');

    function CoverView() {
        View.apply(this, arguments);

        this.profileImg = new Image();
        this.profileImg.src = this.options.img;
        this.profileImg.width = 320;

        var pic = new Surface({
            size: [this.options.size, this.options.size],
            content: this.profileImg
        });

        this._add(pic);
    }

    CoverView.prototype = Object.create(View.prototype);
    CoverView.prototype.constructor = CoverView;

    CoverView.DEFAULT_OPTIONS = {
        text: null,
        name: null,
        img: null
    };

    module.exports = CoverView;
});

define('app/Data/CoverData',['require','exports','module'],function(require, exports, module) {
    module.exports = [
        {
            text: 'Objects in the mirror are unluckier than they appear.',
            img: './img/covers/mirror.jpg',
            name: 'Steve Kuzminski'
        },
        {
            text: 'Kylie Wilson changed her profile picture',
            img: './img/covers/kylie.jpg',
            name: 'Kylie Wilson'
        },
        {
            text: 'Sick gifs from Sochi',
            img: './img/covers/sochi.jpg',
            name: 'Chris Zimmerman'
        }
    ];
});

define('app/Data/StoryData',['require','exports','module'],function(require, exports, module) {
    module.exports = [
        {
            name: 'Jane Williams',
            profilePics:
                [
                    './img/profile-pics/jane.jpg'
                ],
            text: 'Hilarious! #goodguyroy',
            time: '4 HRS &#8226; PUBLIC',
            likes: 4,
            comments: 2,
            articleThumbSm: './img/roy/roysm.jpg',
            articleThumbLg: './img/roy/roylg.jpg',
            article:
                '<img src="./img/roy/header.png" width="320" />' +
                '<div style="padding:0 20px;"><h1>I Could Watch Roy Hibbert Blocking This Little Kid\'s Shot All Day Long</h1>' +
                '<iframe width="280" height="158" src="//www.youtube.com/embed/BY69NUNsF1Q?rel=0&showinfo=0" frameborder="0" allowfullscreen></iframe>' +
                '<p>Indiana Pacers big man Roy Hibbert visited Paramount School of Excellence in Indianapolis and relived his childhood when he wasn\'t yet an NBA star for a cute video. The best part is when he swats the crap out of a kid\'s weak layup, which has been GIFed below. (Second-best part is Hibbert using a child as a human shield in dodgeball.)</p>' +
                // '<iframe width="280" height="158" src="//www.youtube.com/embed/BY69NUNsF1Q?rel=0&showinfo=0" frameborder="0" allowfullscreen></iframe>' +
                '<img width="280" src="./img/roy/block.jpg" />' +
                '<p>The GIF\'s really missing the crushing thump of Hibbert\'s hand on the rejection, so watch the video for the full experience.</p></div>'
        },
        {
            name: 'Shupac Takur added 4 new photos with Lee-ann Platt and 5 others',
            profilePics: 
                [
                    './img/profile-pics/shu.jpg',
                    './img/profile-pics/leeann.jpg',
                    './img/profile-pics/sabina.jpg',
                    './img/profile-pics/corban.jpg',
                    './img/profile-pics/corban.jpg',
                    './img/profile-pics/corban.jpg',
                ],
            text: 'Fun times at Sunset Picnic! ',
            photos: 
                [
                    './img/shu/photos/1.jpg',
                    './img/shu/photos/2.jpg',
                    './img/shu/photos/3.jpg',
                    './img/shu/photos/4.jpg'
                ],
            time: '8 MINS &nbsp;SAN FRANCISCO, CA &#8226; FRIENDS',
            likes: 9,
            comments: 4
        },
        {
            name: 'Sarah Foster',
            profilePics: 
                [
                    './img/profile-pics/sarah.jpg'
                ],
            text: 'Taxes are done. woo hoo!',
            time: 'JUST NOW &#8226; FRIENDS',
            likes: 2,
            comments: 3
        },
        {
            name: 'RJ Pickens',
            profilePics: 
                [
                    './img/profile-pics/rj.jpg'
                ],
            text: 'Man, these are some good-looking speakers. #AISAudio #VOIDAudio',
            photos: 
                [
                    './img/rj/photos/1.jpg'
                ],
            time: '2 MINS &#8226; FRIENDS',
            likes: 10,
            comments: 2
        },
        {
            name: 'Nathalie Pickens',
            profilePics: 
                [
                    './img/profile-pics/nat.jpg'
                ],
            text: '"That song is so corny and i love you."'
        },
        {
            name: 'Scuba Steve',
            profilePics: 
                [
                    './img/profile-pics/scuba.jpg'
                ],
            text: 'In other news I\'m a TOP Sidecar driver now, so if you want a discount code hit me up. Also we operate in East Bay now! Woot!'
        },
        {
            name: 'Josh Hoover',
            profilePics: 
                [
                    './img/profile-pics/josh.jpg'
                ],
            text: '"Revolution doesn\'t have to do with smashing something; it has to do with bringing something forth. If you spend all your time thinking about that which you are attacking, then you are negatively bound to it. You have to find the zeal in yourself and bring that out."<br><br>Joseph Campbell, Pathways to Bliss'
        },
    ]
});
define('famous-physics/utils/SpringTransition',['require','exports','module','famous-physics/PhysicsEngine','famous-physics/forces/Spring','famous-physics/math/Vector'],function(require, exports, module) {
    var PE = require('famous-physics/PhysicsEngine');
    var Spring = require('famous-physics/forces/Spring');
    // var Spring = require('famous-physics/constraints/StiffSpring');
    var Vector = require('famous-physics/math/Vector');

     /** @constructor */
    function SpringTransition(state){
        state = state || 0;

        this._anchor    = new Vector(state, 0, 0);
        this.endState   = state;
        this.prevState  = undefined;

        this.atRest     = true;

        this.spring = new Spring({anchor : this._anchor});

        this.PE = new PE();
        this.particle = this.PE.createParticle({ p : [state, 0, 0]});
        this.PE.attach(this.spring, this.particle);
    }

    SpringTransition.DEFAULT_OPTIONS = {
        period : 300,
        dampingRatio : 0.5,
        velocity : 0
    };

    SpringTransition.forceFunctions = Spring.forceFunctions;

    var restTolerance = 1e-5;
    function _update(){
        if (this.atRest) return;

        this.PE.step();
        var energy = _getEnergy.call(this);
        if (energy < restTolerance) {
            this.atRest = true;
            _setParticlePosition.call(this, this.endState);
            if (this.callback) this.callback();
        };
    }

    function _getEnergy(){
        return this.particle.getEnergy() + this.spring.getEnergy(this.particle);
    }

    function _setupDefinition(def){
        var defaults = SpringTransition.DEFAULT_OPTIONS;
        if (def.period === undefined) def.period = defaults.period;
        if (def.dampingRatio === undefined) def.dampingRatio = defaults.dampingRatio;
        if (def.velocity === undefined) def.velocity = defaults.velocity;

        if (def.period < 150) console.warn('period may be unstable, increase the period or use a stiff transition');

        //setup spring
        this.spring.setOpts({
            period : def.period,
            dampingRatio : def.dampingRatio
        });

        //setup particle
        _setParticleVelocity.call(this, def.velocity);
    }

    function _setTarget(x){
        this.prevState = this.endState;
        this.endState = x;

        var direction;
        if (this.endState - this.prevState > 0) direction =  1;
        else if (this.endState < 0)             direction = -1;
        else                                    direction =  0;

        this._anchor.x = x;

        //correct for velocity sign
        _setParticleVelocity.call(this, direction * _getParticleVelocity.call(this));
    }

    function _setParticlePosition(p){
        this.particle.p.x = p;
    }

    function _setParticleVelocity(v){
        this.particle.v.x = v;
    }

    function _getParticlePosition(){
        return this.particle.p.x;
    }

    function _getParticleVelocity(){
        return this.particle.v.x;
    }

    function _setCallback(callback){
        this.callback = callback;
    }

    SpringTransition.prototype.reset = function(pos, vel){
        pos = pos || 0;
        vel = vel || 0;
        this.prevState = undefined;
        _setParticlePosition.call(this, pos);
        _setParticleVelocity.call(this, vel);
        _setTarget.call(this, pos);
        _setCallback.call(this, undefined);
    }

    SpringTransition.prototype.getVelocity = function(){
        _update.call(this);
        return _getParticleVelocity.call(this);
    }

    SpringTransition.prototype.setVelocity = function(v){
        this.call(this, _setParticleVelocity(v));
    }

    SpringTransition.prototype.halt = function(){
        this.set(this.get());
    }

    SpringTransition.prototype.get = function(){
        _update.call(this);
        return _getParticlePosition.call(this);
    }

    SpringTransition.prototype.set = function(endState, definition, callback){
        if (!definition){
            this.reset(endState)
            if (callback) callback();
            return;
        };

        this.atRest = false;
        _setupDefinition.call(this, definition);
        _setTarget.call(this, endState);
        _setCallback.call(this, callback);
    }

    module.exports = SpringTransition;

});
define('app/StoryViews/ProfilePicView',['require','exports','module','famous/Surface','famous/Modifier','famous/Matrix','famous/View','famous-animation/Easing'],function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');

    function ProfilePicView() {
        View.apply(this, arguments);

        this.profileImg = new Image();
        this.profileImg.src = this.options.url;
        this.profileImg.width = this.options.size;

        var pic = new Surface({
            size: [this.options.size, this.options.size],
            content: this.profileImg,
            classes: ['profile-view']
        });

        this.mod = new Modifier();
        this._link(this.mod).link(pic);

        pic.pipe(this.eventOutput);
    }

    ProfilePicView.prototype = Object.create(View.prototype);
    ProfilePicView.prototype.constructor = ProfilePicView;

    ProfilePicView.DEFAULT_OPTIONS = {
        url: null,
        size: 120
    };

    ProfilePicView.prototype.setScale = function(scale) {
        this.scale = scale;
        this.mod.setTransform(FM.scale(scale, scale, 1));
    };

    ProfilePicView.prototype.getSize = function() {
        return [this.options.size*this.scale, this.options.size*this.scale];
    };

    module.exports = ProfilePicView;
});

define('app/StoryViews/NumberView',['require','exports','module','famous/Surface','famous/Modifier','famous/Matrix','famous/View','famous-animation/Easing','famous-utils/Utils'],function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    var Utils               = require('famous-utils/Utils');

    function NumberView() {
        View.apply(this, arguments);

        createLowNum.call(this);
        createHighNum.call(this);
    }

    function createLowNum() {
        this.lowNum = new Surface({
            size: [this.options.size, this.options.size],
            content: '+' + (this.options.n-1),
            classes: ['number-view', 'profile-view']
        });

        this.lowMod = new Modifier();
        this._add(this.lowMod).link(this.lowNum);
    }

    function createHighNum() {
        this.highNum = new Surface({
            size: [this.options.size, this.options.size],
            content: '+' + this.options.n,
            classes: ['number-view', 'profile-view']
        });

        this.highMod = new Modifier();
        this._add(this.highMod).link(this.highNum);
    }

    NumberView.prototype = Object.create(View.prototype);
    NumberView.prototype.constructor = NumberView;

    NumberView.DEFAULT_OPTIONS = {
        n: null,
        size: 121
    };

    NumberView.prototype.fade = function(progress) {
        this.highMod.setOpacity(Easing.inOutQuadNorm.call(this, 1-progress));
        this.lowMod.setOpacity(Easing.inOutQuadNorm.call(this, progress));
    };

    NumberView.prototype.setScale = function(scale) {
        this.scale = scale;
        this.lowMod.setTransform(FM.scale(scale, scale, 1));
        this.highMod.setTransform(FM.scale(scale, scale, 1));
    };

    NumberView.prototype.getSize = function() {
        return [this.options.size*this.scale, this.options.size*this.scale];
    };

    module.exports = NumberView;
});

define('app/StoryViews/ProfilePicsView',['require','exports','module','famous/Surface','famous/Modifier','famous/Matrix','famous/View','famous-animation/Easing','famous-utils/Utils','./ProfilePicView','./NumberView'],function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    var Utils               = require('famous-utils/Utils');

    var ProfilePicView      = require('./ProfilePicView');
    var NumberView          = require('./NumberView');

    function ProfilePicsView() {
        View.apply(this, arguments);

        this.mods = [];
        this.picViews = [];

        for(var i = 0; i < Math.min(this.options.urls.length, 3); i++) {
            var view = new ProfilePicView({
                url: this.options.urls[i]
            });

            var mod = new Modifier();

            this.mods.push(mod);
            this.picViews.push(view);

            this._add(mod).link(view);

            view.pipe(this.eventOutput);
        }

        if(this.options.urls.length > 3) {
            this.numView = new NumberView({
                n: this.options.urls.length - 2
            });

            this.numMod = new Modifier();

            this._add(this.numMod).link(this.numView);
        }
    }

    ProfilePicsView.prototype = Object.create(View.prototype);
    ProfilePicsView.prototype.constructor = ProfilePicsView;

    ProfilePicsView.DEFAULT_OPTIONS = {
        scale: null,
        urls: null,
        spacing: 5,
        size: 120
    };

    ProfilePicsView.prototype.map = function(start, end, clamp) {
        return Utils.map(this.progress, 0, 1, start, end, clamp);
    };

    ProfilePicsView.prototype.setProgress = function(progress) {
        this.progress = progress;

        this.scale = this.map(1/3/this.options.scale, 0.5);

        for(var i = 0; i < this.mods.length; i++) {
            this.picViews[i].setScale(this.scale);
            this.mods[i].setTransform(FM.translate((this.options.size*this.scale + this.options.spacing)*i, 0, 0));
        }

        if(this.options.urls.length > 3) {
            this.mods[2].setOpacity(Easing.outQuadNorm.call(this, progress));
            this.mods[2].setTransform(FM.move(FM.scale(this.progress, 1, 1), [(this.options.size*this.scale + this.options.spacing)*2, 0, 0]));

            this.numView.setScale(this.scale);
            this.numView.fade(this.progress);
            this.numMod.setTransform(FM.translate((this.options.size*this.scale + this.options.spacing)*(2+this.progress), 0, 0));
        }
    };

    ProfilePicsView.prototype.getSize = function() {
        return [undefined, this.options.size*this.scale];
    };

    module.exports = ProfilePicsView;
});

define('app/StoryViews/NameView',['require','exports','module','famous/Surface','surface-extensions/ExpandingSurface','famous/Modifier','famous/Matrix','famous/View','famous-animation/Easing','famous-utils/Utils'],function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var ExpandingSurface    = require('surface-extensions/ExpandingSurface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    var Utils               = require('famous-utils/Utils');

    function NameView() {
        View.apply(this, arguments);

        createSmallName.call(this);
        createLargeName.call(this);
    }

    function createSmallName() {
        this.smallName = new ExpandingSurface({
            size: [this.options.width, undefined],
            content: '<div>' + this.options.name + '</div>',
            classes: ['story-name'],
            properties: {
                fontSize: '20px',
            }
        });

        this.smallMod = new Modifier();

        this._add(this.smallMod).link(this.smallName);
    }

    function createLargeName() {
        this.largeName = new ExpandingSurface({
            size: [this.options.width, undefined],
            content: '<div>' + this.options.name + '</div>',
            classes: ['story-name'],
            properties: {
                fontSize: '15px',
                // backgroundColor: 'blue'
            }
        });

        this.largeMod = new Modifier({
            transform: FM.translate(0, 2, 0)
        });

        this._add(this.largeMod).link(this.largeName);
    }

    NameView.prototype = Object.create(View.prototype);
    NameView.prototype.constructor = NameView;

    NameView.DEFAULT_OPTIONS = {
        width: 280,
        height: 15,
        name: null
    };

    NameView.prototype.fade = function(progress) {
        this.smallMod.setOpacity(Easing.inOutQuadNorm.call(this, 1-progress));
        this.largeMod.setOpacity(Easing.inOutQuadNorm.call(this, progress));
    };

    NameView.prototype.setProgress = function(progress) {
        this.progress = progress;
    };

    NameView.prototype.getSize = function() {
        return [this.options.width, Utils.map(this.progress, 0, 1, this.smallName.getSize()[1], this.largeName.getSize()[1])-2];
    };

    module.exports = NameView;
});

define('app/StoryViews/TextView',['require','exports','module','famous/Surface','famous/Modifier','famous/Matrix','famous/View','famous-animation/Easing'],function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');

    function TextView() {
        View.apply(this, arguments);

        createSmallText.call(this);
        createLargeText.call(this);
    }

    function createSmallText() {
        var text = this.options.text;

        if(!this.options.photos) {
            if(text.length < 40) {
                properties = this.options.smallLarge;
                smallOrigin = this.options.originLg;
            } else if(text.length < 280) {
                properties = this.options.smallMedium;
                smallOrigin = this.options.originMed;
            } else {
                properties = this.options.smallSmall;
                smallOrigin = this.options.originSm;
            }
        } else {
            properties = this.options.smallSmall;

            smallOrigin = this.options.originSm;
        }

        this.smallText = new Surface({
            size: [this.options.width, window.innerHeight * this.options.height],
            content: '<span class="story-text">' + text + '</span>',
            properties: properties
        });

        this.smallMod = new Modifier({
            origin: [0, smallOrigin]
        });

        this._add(this.smallMod).link(this.smallText);
        this.smallText.pipe(this.eventOutput);
    }

    function createLargeText() {
        var text = this.options.text;

        if(!this.options.photos) {
            if(text.length < 40) {
                properties = this.options.largeLarge;
                largeOrigin = this.options.originLg;
            } else if(text.length < 280) {
                properties = this.options.largeMedium;
                largeOrigin = this.options.originMed;
            } else {
                properties = this.options.largeSmall;
                largeOrigin = this.options.originSm;
            }

        } else {
            properties = this.options.largeSmall;
            largeOrigin = this.options.originSm;
        }

        // text = text.replace(/(\#[a-zA-Z0-9\-]+)/g, '<span class="bold">$1</span>');
        this.largeText = new Surface({
            size: [this.options.width, window.innerHeight * this.options.height],
            content: '<span class="story-text">' + text + '</span><p class="story-time">' + this.options.time + '</p>',
            properties: properties
        });

        this.largeMod = new Modifier({
            origin: [0, largeOrigin]
        });

        this._add(this.largeMod).link(this.largeText);
        this.largeText.pipe(this.eventOutput);
    }

    TextView.prototype = Object.create(View.prototype);
    TextView.prototype.constructor = TextView;

    TextView.DEFAULT_OPTIONS = {
        width: 280,
        height: 0.3,
        text: null,
        time: null,
        photos: null,

        smallLarge: {
            fontSize: '31px',
            lineHeight: '35px'
        },
        smallMedium: {
            fontSize: '28px',
            lineHeight: '32px'
        },
        smallSmall: {
            fontSize: '21px',
            lineHeight: '25px'
        },

        largeLarge: {
            fontSize: '28px',
            lineHeight: '32px'
        },
        largeMedium: {
            fontSize: '20px',
            lineHeight: '24px'
        },
        largeSmall: {
            fontSize: '15px',
            lineHeight: '19px',
            // backgroundColor: 'red'
        },

        originLg: 0.45,
        originMed: 0.35,
        originSm: 0.01
    };

    TextView.prototype.fade = function(progress) {
        this.smallMod.setOpacity(Easing.inOutQuadNorm.call(this, 1-progress));
        this.largeMod.setOpacity(Easing.inOutQuadNorm.call(this, progress));
    };

    TextView.prototype.getSize = function() {
        return [280, 60];
    };

    module.exports = TextView;
});

define('app/StoryViews/FooterView',['require','exports','module','famous/Surface','famous/Modifier','famous/Matrix','famous/View'],function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');

    function FooterView() {
        View.apply(this, arguments);

        this.img = new Image();
        this.img.src = './img/footer.png';
        this.img.width = this.options.width;

        var icons = new Surface({
            size: [this.options.width, 50],
            content: this.img
        });

        var likes = new Surface({
            size: [140, 40],
            content: 
                '<div class="footer-likes">' + 
                    this.options.likes + ' Likes &nbsp;' + 
                    this.options.comments + ' Comments' +
                '</div>' +
                '<div class="footer-write">Write a comment</div>'
        });

        var likesMod = new Modifier({
            transform: FM.translate(140, 9, 0)
        });

        this._add(icons);
        this._add(likesMod).link(likes);

        icons.pipe(this.eventOutput);
        likes.pipe(this.eventOutput);
    }

    FooterView.prototype = Object.create(View.prototype);
    FooterView.prototype.constructor = FooterView;

    FooterView.DEFAULT_OPTIONS = {
        width: 280,
        likes: null,
        comments: null,
        margin: 20
    };

    FooterView.prototype.getSize = function() {
        return [280, 50];
    }

    module.exports = FooterView;
});

define('app/StoryViews/ArticleStoryView',['require','exports','module','famous/Engine','famous/Surface','famous/Modifier','famous/Matrix','famous/View','famous-animation/Easing','famous-sync/GenericSync','famous/Transitionable','famous-physics/utils/SpringTransition','famous-views/Scrollview','famous/ContainerSurface','famous/Utility','famous-utils/Utils','./ProfilePicsView','./NameView','./TextView','../ArticleViews/ArticleView','./FooterView'],function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    var GenericSync         = require('famous-sync/GenericSync');
    var Transitionable      = require('famous/Transitionable');
    var SpringTransition    = require('famous-physics/utils/SpringTransition');
    var Scrollview          = require('famous-views/Scrollview');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Utility             = require('famous/Utility');
    var Utils               = require('famous-utils/Utils');

    var ProfilePicsView     = require('./ProfilePicsView');
    var NameView            = require('./NameView');
    var TextView            = require('./TextView');
    var ArticleView         = require('../ArticleViews/ArticleView');
    var FooterView          = require('./FooterView');

    Transitionable.registerMethod('spring', SpringTransition);

    function ArticleStoryView() {
        View.apply(this, arguments);

        this.flipable = true;
        this.closed = true;

        this.contentWidth = window.innerWidth - 2*this.options.margin;

        createSync.call(this);
        createCard.call(this);
        createProfilePic.call(this);
        createName.call(this);
        createText.call(this);
        createArticle.call(this);
        createFooter.call(this);
        createCover.call(this);

        function createSync() {
            this.pos = new Transitionable(0);

            this.sync = new GenericSync(function() {
                return this.pos.get();
            }.bind(this), {direction: Utility.Direction.Y});

            this.sync.on('update', function(data) {
                if(this.open && this.article.atTop && data.v > 0) {
                    this.articleScale.set(0.875, this.options.curve);
                    this.articleTop.set(-68, this.options.curve);
                }

                if(this.article.atTop && data.v > 0) {
                    this.article.disableScroll();
                    this.open = false;
                }

                if(!this.open) {
                    this.pos.set(data.p);
                }
            }.bind(this));

            this.sync.on('end', function() {
                if(this.angle < Math.PI/2) {
                    this.pos.set(-320, this.options.curve);
                    this.articleScale.set(1, this.options.curve);
                    this.articleTop.set(0, this.options.curve);
                    this.closed = false;
                    this.open = true;
                    this.article.enableScroll();
                    this.article.enable = true;
                } else {
                    this.articleScale.set(0.875, this.options.curve);
                    this.articleTop.set(-68, this.options.curve);
                    this.pos.set(0, this.options.curve, function() {
                        this.article.enable = false;
                        this.closed = true;
                    }.bind(this));
                }
            }.bind(this));
        }

        function createCard() {
            this.card = new Surface({
                properties: {
                    borderRadius: '5px',
                    backgroundColor: 'white'
                }
            });

            this.card.pipe(this.eventOutput);
        }

        function createProfilePic() {
            this.profilePicsView = new ProfilePicsView({
                scale: this.options.scale,
                urls: this.options.profilePics
            });

            this.profilePicsView.pipe(this.eventOutput);
        }

        function createName() {
            this.nameView = new NameView({
                name: this.options.name
            });

            this.nameView.pipe(this.eventOutput);
        }

        function createText() {
            if(!this.options.text) return;

            this.textView = new TextView({
                text: this.options.text,
                time: this.options.time,
                photos: true
            });

            this.textView.pipe(this.eventOutput);
        }

        function createArticle() {
            this.article = new ArticleView({
                scale: this.options.scale,
                content: this.options.content,
                thumbSm: this.options.thumbSm,
                thumbLg: this.options.thumbLg,
            });

            this.article.pipe(this.eventOutput);
            // this.article.pipe(this.sync);

            this.articleScale = new Transitionable(0.875);
            this.articleTop = new Transitionable(-68);
        }

        function createFooter() {
            this.footer = new FooterView({
                likes: this.options.likes,
                comments: this.options.comments
            });

            this.footer.pipe(this.eventOutput);
        }

        function createCover() {
            this.cover = new Surface({
                properties: {
                    backgroundColor: 'blue'
                }
            });

            this.cover.pipe(this.eventOutput);
        }
    }

    ArticleStoryView.prototype = Object.create(View.prototype);
    ArticleStoryView.prototype.constructor = ArticleStoryView;

    ArticleStoryView.DEFAULT_OPTIONS = {
        scale: null,
        name: null,
        profilePics: null,
        text: null,
        content: null,
        thumbSm: null,
        thumbLg: null,
        time: null,
        likes: null,
        comments: null,

        margin: 20,

        curve: {
            duration: 200,
            curve: 'easeInOut'
        }
    };

    ArticleStoryView.prototype.getSize = function() {
    };

    ArticleStoryView.prototype.setProgress = function(progress) {
        this.progress = progress;
    };

    ArticleStoryView.prototype.map = function(start, end, clamp) {
        return Utils.map(this.progress, 0, 1, start, end, clamp);
    };

    ArticleStoryView.prototype.enableFlip = function() {
        this.enable = true;
        this.article.pipe(this.sync);
    };

    ArticleStoryView.prototype.disableFlip = function() {
        this.enable = false;
        this.article.unpipe(this.sync);
    };

    ArticleStoryView.prototype.render = function() {
        var pos = this.pos.get();

        this.angle = Utils.map(pos, 0, -320, Math.PI, 0, true);
        this.article.setAngle(this.angle);

        var articleScale = this.articleScale.get();

        // this.stopped = Math.abs(this.article.articleFull.scrollview.getVelocity()) < 0.01;

        var namePos = this.map(120, 85);
        var textPos = this.map(140, 105);
        var photoPos = this.map(-20, this.articleTop.get());
        var footerPos = this.map(48, 0);
        var profilePicScale = this.map(1/3/this.options.scale, 0.5);

        this.profilePicsView.setProgress(this.progress);
        this.nameView.fade(this.progress);
        this.textView.fade(this.progress);

        this.open = this.angle === 0;

        if(this.open) {
            this.article.articleBottom.noShadow();
        } else {
            this.article.articleBottom.shadow();
        }

        this.spec = [];
        this.spec.push(this.card.render());

        this.spec.push({
            transform: FM.translate(this.options.margin, this.options.margin, 0),
            target: this.profilePicsView.render()
        });

        this.spec.push({
            transform: FM.translate(this.options.margin, namePos, 0),
            target: this.nameView.render()
        });

        if(this.textView) {
            this.spec.push({
                transform: FM.translate(this.options.margin, textPos, 0),
                size: [this.options.contentWidth, window.innerHeight - textPos - this.options.margin],
                target: {
                    target: this.textView.render()
                }
            });
        }

        this.spec.push({
            origin: [0.5, 0],
            transform: FM.move(FM.scale(articleScale, articleScale, 1), [0, photoPos, 0.0001]),
            size: [window.innerWidth, window.innerHeight],
            target: {
                target: this.article.render()
            }
        });

        this.spec.push({
            transform: FM.translate(this.options.margin, window.innerHeight - this.footer.getSize()[1], 0),
            opacity: Easing.inOutQuadNorm.call(this, this.progress),
            target: this.footer.render()
        });

        // if(!this.enable) {
        //     this.spec.push({
        //         transform: FM.translate(0, 0, 1000),
        //         // target: this.cover.render()
        //     });
        // }

        return this.spec;
    };

    module.exports = ArticleStoryView;
});

define('app/StoryViews/PhotoStoryView',['require','exports','module','famous/Engine','famous/Surface','famous/Modifier','famous/RenderNode','famous/Matrix','famous/View','famous-animation/Easing','famous-views/Scrollview','famous/ContainerSurface','famous/Utility','famous-utils/Utils','./ProfilePicsView','./NameView','./TextView','./FooterView'],function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var RenderNode          = require('famous/RenderNode');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    // var GenericSync         = require('famous-sync/GenericSync');
    // var Transitionable      = require('famous/Transitionable');
    // var SpringTransition    = require('famous-physics/utils/SpringTransition');
    var Scrollview          = require('famous-views/Scrollview');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Utility             = require('famous/Utility');
    var Utils               = require('famous-utils/Utils');

    var ProfilePicsView     = require('./ProfilePicsView');
    var NameView            = require('./NameView');
    var TextView            = require('./TextView');
    var FooterView          = require('./FooterView');

    // Transitionable.registerMethod('spring', SpringTransition);

    function PhotoStoryView() {
        View.apply(this, arguments);

        this.contentWidth = window.innerWidth - 2*this.options.margin;

        this.scrollable = true;
        this.content = [];

        createCard.call(this);
        createProfilePic.call(this);
        createName.call(this);
        createText.call(this);
        createPhotos.call(this);
        createFooter.call(this);
        createScrollview.call(this);
        createCover.call(this);

        function createCard() {
            this.card = new Surface({
                properties: {
                    borderRadius: '5px',
                    backgroundColor: 'white'
                }
            });

            this.card.pipe(this.eventOutput);
        }

        function createProfilePic() {
            this.content.push(new Surface({
                size: [undefined, this.options.margin]
            }));

            this.profilePicsView = new ProfilePicsView({
                scale: this.options.scale,
                urls: this.options.profilePics
            });

            this.content.push(this.profilePicsView);

            var node = new RenderNode();
            node.getSize = function() {
                return [undefined, this.map(2, 1) * 5];
            }.bind(this);

            this.content.push(node);
        }

        function createName() {
            this.nameView = new NameView({
                name: this.options.name
            });

            this.content.push(this.nameView);
        }

        function createText() {
            if(!this.options.text) return;

            this.textView = new TextView({
                text: this.options.text,
                time: this.options.time,
                photos: !!this.options.photos
            });

            this.content.push(this.textView);
        }

        function createPhotos() {
            for(var i = 0; i < this.options.photos.length; i++) {
                this.photoImg = new Image();
                this.photoImg.src = this.options.photos[i];
                this.photoImg.width = this.contentWidth;

                var surface = new Surface({
                    size: [this.contentWidth, this.contentWidth],
                    content: this.photoImg,
                    properties: {
                        boxShadow: '0 0 5px rgba(0,0,0,0.3)'
                    }
                });

                if(i < 2) {
                    var node = new RenderNode();
                    var mod = this['mod' + i] = new Modifier();
                    node.link(mod).link(surface);
                    this.content.push(node);

                    node.getSize = function() {
                        return [280, 280];
                    };
                } else {
                    this.content.push(surface);
                }

                this.content.push(new Surface({
                    size: [undefined, 15]
                }));
            }
        }

        function createFooter() {
            this.footer = new FooterView({
                likes: this.options.likes,
                comments: this.options.comments
            });

            this.content.push(this.footer);
        }

        function createScrollview () {
            this.scrollview = new Scrollview({
                itemSpacing: 0,
                clipSize: undefined,
                margin: window.innerHeight,
                drag: 0.001,
                edgeGrip: 1,
                edgePeriod: 300,
                // edgeDamp: 1,
                // paginated: false,
                // pagePeriod: 500,
                // pageDamp: 0.8,
                // pageStopSpeed: Infinity,
                // pageSwitchSpeed: 1,
                speedLimit: 10
            });

            this.scrollview.sequenceFrom(this.content);
            this.firstNode = this.scrollview.node;
        }

        function createCover() {
            this.cover = new Surface();
            this.cover.pipe(this.eventOutput);

            this.cover.on('touchstart', function() {
                this.touch = true;
                this.scrollview.setVelocity(0);
            }.bind(this));

            this.cover.on('touchend', function() {
                this.touch = false;
            }.bind(this));

        }
    }

    PhotoStoryView.prototype = Object.create(View.prototype);
    PhotoStoryView.prototype.constructor = PhotoStoryView;

    PhotoStoryView.DEFAULT_OPTIONS = {
        scale: null,
        name: null,
        profilePics: null,
        text: null,
        photos: null,
        time: null,
        likes: null,
        comments: null,

        margin: 20
    };

    PhotoStoryView.prototype.getSize = function() {
    };

    PhotoStoryView.prototype.setProgress = function(progress) {
        this.progress = progress;
    };

    PhotoStoryView.prototype.map = function(start, end, clamp) {
        return Utils.map(this.progress, 0, 1, start, end, clamp);
    };

    PhotoStoryView.prototype.enableScroll = function() {
        this.cover.pipe(this.scrollview);
        this.enable = true;
    };

    PhotoStoryView.prototype.disableScroll = function() {
        this.cover.unpipe(this.scrollview);
        this.enable = false;
    };

    PhotoStoryView.prototype.sequence = function() {
        console.log('sequence');
        this.scrollview.setVelocity(0);
        this.scrollview.setPosition(0);
        this.scrollview.sequenceFrom(this.firstNode);
    };

    PhotoStoryView.prototype.render = function() {
        var namePos = this.map(120, 85);
        var textPos = this.map(140, 105);
        var photoPos = this.map(-20, -68);
        var footerPos = this.map(48, 0);

        this.profilePicsView.setProgress(this.progress);
        this.nameView.setProgress(this.progress);
        this.nameView.fade(this.progress);
        this.textView.fade(this.progress);

        this.spec = [];
        this.spec.push(this.card.render());

        var scrollPos = this.scrollview.getPosition();

        if(scrollPos < 10 && this.scrollview.node.index === 0) {
            this.top = true;
        } else {
            this.top = false;
        }

        this.mod0.setTransform(FM.translate(0, this.map(0, 0), 0.00001));
        this.mod1.setTransform(FM.move(FM.rotateZ(this.map(-0.04, 0)), [this.map(-6, 0), this.map(-290, 0), 0]));

        this.spec.push({
            transform: FM.translate(20, 0, 0),
            target: this.scrollview.render()
        });

        this.spec.push({
            transform: FM.translate(0, 0, 2),
            target: this.cover.render()
        });

        return this.spec;
    };

    module.exports = PhotoStoryView;
});

define('app/StoryViews/StoryView',['require','exports','module','famous/Engine','famous/Surface','famous/Modifier','famous/Matrix','famous/View','famous-animation/Easing','famous-views/Scrollview','famous/ContainerSurface','famous/Utility','famous-utils/Utils','./ProfilePicsView','./NameView','./TextView','./FooterView'],function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    // var GenericSync         = require('famous-sync/GenericSync');
    // var Transitionable      = require('famous/Transitionable');
    // var SpringTransition    = require('famous-physics/utils/SpringTransition');
    var Scrollview          = require('famous-views/Scrollview');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Utility             = require('famous/Utility');
    var Utils               = require('famous-utils/Utils');

    var ProfilePicsView     = require('./ProfilePicsView');
    var NameView            = require('./NameView');
    var TextView            = require('./TextView');
    var FooterView          = require('./FooterView');

    // Transitionable.registerMethod('spring', SpringTransition);

    function StoryView() {
        View.apply(this, arguments);

        this.contentWidth = window.innerWidth - 2*this.options.margin;

        createCard.call(this);
        createProfilePic.call(this);
        createName.call(this);
        createText.call(this);
        createPhoto.call(this);
        createFooter.call(this);
        createCover.call(this);

        function createCard() {
            this.card = new Surface({
                properties: {
                    borderRadius: '5px',
                    backgroundColor: 'white'
                }
            });
        }

        function createProfilePic() {
            this.profilePicsView = new ProfilePicsView({
                scale: this.options.scale,
                urls: this.options.profilePics
            });
        }

        function createName() {
            this.nameView = new NameView({
                name: this.options.name
            });
        }

        function createText() {
            if(!this.options.text) return;

            this.textView = new TextView({
                text: this.options.text,
                time: this.options.time,
                photos: !!this.options.photos
            });
        }

        function createPhoto() {
            var photos = this.options.photos;
            if(!photos) return;

            this.photoImg = new Image();
            this.photoImg.src = photos[0];
            this.photoImg.width = this.contentWidth;

            this.photo = new Surface({
                size: [this.contentWidth, this.contentWidth],
                content: this.photoImg,
                properties: {
                    boxShadow: '0 0 5px rgba(0,0,0,0.3)'
                }
            });
        }

        function createFooter() {
            this.footer = new FooterView({
                likes: this.options.likes,
                comments: this.options.comments
            });
        }

        function createCover() {
            this.cover = new Surface();
            this.cover.pipe(this.eventOutput);
        }
    }

    StoryView.prototype = Object.create(View.prototype);
    StoryView.prototype.constructor = StoryView;

    StoryView.DEFAULT_OPTIONS = {
        scale: null,
        name: null,
        profilePics: null,
        text: null,
        photos: null,
        time: null,
        likes: null,
        comments: null,

        margin: 20
    };

    StoryView.prototype.getSize = function() {
    };

    StoryView.prototype.setProgress = function(progress) {
        this.progress = progress;
    };

    StoryView.prototype.map = function(start, end, clamp) {
        return Utils.map(this.progress, 0, 1, start, end, clamp);
    };

    StoryView.prototype.render = function() {
        var namePos = this.map(120, 85);
        var textPos = this.map(140, 105);
        var photoPos = this.map(-20, -68);
        var footerPos = this.map(48, 0);
        var profilePicScale = this.map(1/3/this.options.scale, 0.5);

        this.profilePicsView.setProgress(this.progress);
        this.nameView.fade(this.progress);
        this.textView.fade(this.progress);


        this.spec = [];
        this.spec.push(this.card.render());

        this.spec.push({
            transform: FM.translate(this.options.margin, this.options.margin, 0),
            target: this.profilePicsView.render()
        });

        this.spec.push({
            transform: FM.translate(this.options.margin, namePos, 0),
            target: this.nameView.render()
        });

        if(this.textView) {
            this.spec.push({
                transform: FM.translate(this.options.margin, textPos, 0),
                size: [this.options.contentWidth, window.innerHeight - textPos - this.options.margin],
                target: {
                    target: this.textView.render()
                }
            });
        }

        if(this.photo) {
            this.spec.push({
                origin: [0.5, 1],
                transform: FM.translate(0, photoPos, 0.1),
                target: this.photo.render()
            });
        }

        this.spec.push({
            // origin: [0, 1],
            transform: FM.translate(this.options.margin, window.innerHeight - this.footer.getSize()[1], 0),
            opacity: Easing.inOutQuadNorm.call(this, this.progress),
            target: this.footer.render()
        });

        this.spec.push({
            transform: FM.translate(0, 0, 2),
            target: this.cover.render()
        });

        return this.spec;
    };

    module.exports = StoryView;
});

define('app/StoryViews/StoriesView',['require','exports','module','famous/Engine','famous/Matrix','famous/View','famous/Modifier','famous/EventHandler','famous-sync/GenericSync','famous/Transitionable','famous-physics/utils/SpringTransition','famous-views/Scrollview','famous/ViewSequence','famous/Utility','famous-utils/Utils','../Data/StoryData','./StoryView','./PhotoStoryView','./ArticleStoryView'],function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Modifier            = require('famous/Modifier');

    var EventHandler        = require('famous/EventHandler');
    var GenericSync         = require('famous-sync/GenericSync');
    var Transitionable      = require('famous/Transitionable');
    var SpringTransition    = require('famous-physics/utils/SpringTransition');

    var Scrollview          = require('famous-views/Scrollview');
    var ViewSequence        = require('famous/ViewSequence');
    var Utility             = require('famous/Utility');
    var Utils               = require('famous-utils/Utils');

    var StoryData           = require('../Data/StoryData');
    var StoryView           = require('./StoryView');
    var PhotoStoryView      = require('./PhotoStoryView');
    var ArticleStoryView    = require('./ArticleStoryView');

    Transitionable.registerMethod('spring', SpringTransition);

    function StoriesView() {
        View.apply(this, arguments);

        createSyncs.call(this);
        createStories.call(this);
        setYListeners.call(this);

        window.app = this;
    }

    StoriesView.prototype = Object.create(View.prototype);
    StoriesView.prototype.constructor = StoriesView;

    StoriesView.DEFAULT_OPTIONS = {
        velThreshold: 1,
        spring: {
            method: 'spring',
            period: 200,
            dampingRatio: 1,
        },
        curve: {
            duration: 500,
            curve: 'easeOut'
        },

        cardScale: 0.445,
        gutter: 2
    };
    StoriesView.DEFAULT_OPTIONS.cardWidth = StoriesView.DEFAULT_OPTIONS.cardScale * window.innerWidth;

    StoriesView.DEFAULT_OPTIONS.cardHeight = StoriesView.DEFAULT_OPTIONS.cardScale * window.innerHeight;
    StoriesView.DEFAULT_OPTIONS.initY = window.innerHeight - StoriesView.DEFAULT_OPTIONS.cardHeight;
    StoriesView.DEFAULT_OPTIONS.posThreshold = (window.innerHeight - StoriesView.DEFAULT_OPTIONS.cardHeight)/2;


    StoriesView.DEFAULT_OPTIONS.scrollOpts = {
        direction: Utility.Direction.X,
        defaultItemSize: [StoriesView.DEFAULT_OPTIONS.cardWidth, StoriesView.DEFAULT_OPTIONS.cardHeight],
        itemSpacing: 2/StoriesView.DEFAULT_OPTIONS.cardScale,
        margin: window.innerWidth*3,
        pageSwitchSpeed: 0.1,
        pagePeriod: 300,
        pageDamp: 1,
        speedLimit: 10,
        drag: 0.001,
        friction: 0
    };

    var createStories = function() {
        this.storiesHandler = new EventHandler();

        this.scrollview = new Scrollview(this.options.scrollOpts);

        this.stories = [];

        for(var i = 0; i < StoryData.length; i++) {
            var story;
            var info = {
                profilePics: StoryData[i].profilePics,
                name: StoryData[i].name,
                text: StoryData[i].text,
                time: StoryData[i].time,
                likes: StoryData[i].likes,
                comments: StoryData[i].comments,
                scale: this.options.cardScale
            }

            if(StoryData[i].article) {
                info.content = StoryData[i].article;
                info.thumbSm = StoryData[i].articleThumbSm;
                info.thumbLg = StoryData[i].articleThumbLg;

                story = new ArticleStoryView(info);
            } else {
                info.photos = StoryData[i].photos;

                if(StoryData[i].photos && StoryData[i].photos.length > 1) {
                    story = new PhotoStoryView(info);
                } else {
                    story = new StoryView(info);
                }
            }

            story.pipe(this.storiesHandler);
            this.stories.push(story);

            story.on('touchstart', function(story) {
                this.targetStory = story;
            }.bind(this, story));
        }

        this.storiesHandler.pipe(this.scrollview);
        this.storiesHandler.pipe(this.ySync);

        var sequence = new ViewSequence(this.stories, 0, true);

        this.scrollview.sequenceFrom(sequence);

        this.scrollview.on('paginate', function() {
            if(this.targetStory.scrollable) {
                this.targetStory.sequence();
                this.targetStory.disableScroll();
            }
        }.bind(this));

        this.state = 'down';
    };

    var createSyncs = function() {
        this.yPos = new Transitionable(this.options.initY);

        this.ySync = new GenericSync(function() {
            return [0, this.yPos.get()];
        }.bind(this));
    };

    var setYListeners = function() {
        this.ySync.on('start', function(data) {
            this.direction = undefined;
            if(this.yPos.get() === 0 && this.targetStory.scrollable) {
                this.storyScrollable = true;
                this.swipable = false;
                this.targetStory.enableScroll();
            }

            if(this.yPos.get() === 0 && this.targetStory.flipable) {
                this.swipable = false;
                this.storyFlipable = true;
                this.targetStory.enableFlip();
            }
        }.bind(this));

        this.ySync.on('update', (function(data) {
            if(this.targetStory.flipable && !this.targetStory.closed) {
                this.storiesHandler.unpipe(this.scrollview);
            }

            if(!this.direction) {
                if(Math.abs(data.v[1]) > Math.abs(data.v[0])) {
                    this.direction = 'y';
                } else {
                    this.storiesHandler.unpipe(this.ySync);
                    this.direction = 'x';
                }
            }

            this.xPos = data.p[0];
            if(this.direction === 'y') {
                if(!this.storyScrollable && !this.storyFlipable) {
                    this.yPos.set(Math.min(this.options.initY + 75, Math.max(-75, data.p[1])));
                    this.swipable = true;
                } else if(this.storyScrollable && this.targetStory.top && data.v[1] > 0) {
                    this.yPos.set(Math.min(this.options.initY + 75, Math.max(-75, data.p[1])));
                    this.targetStory.disableScroll();
                    this.storyScrollable = false;
                    this.swipable = true;
                } else if(this.storyFlipable && this.targetStory.closed && data.v[1] > 0) {
                    this.yPos.set(Math.min(this.options.initY + 75, Math.max(-75, data.p[1])));
                    this.targetStory.enableFlip();
                    this.storyFlipable = false;
                    this.swipable = true;
                }
            }

            if(Math.abs(data.v[1]) < Math.abs(data.v[0])) {
                if(this.targetStory.scrollable && Math.abs(this.targetStory.scrollview.getVelocity()) > 0.05) {
                    this.storiesHandler.unpipe(this.scrollview);
                }
            }
        }).bind(this));

        this.ySync.on('end', (function(data) {
            this.direction = undefined;
            this.storyScrollable = false;
            this.storyFlipable = false;

            this.storiesHandler.pipe(this.scrollview);
            this.storiesHandler.pipe(this.ySync);

            var velocity = data.v[1].toFixed(2);

            if(!this.swipable) return;
            if(this.yPos.get() < this.options.posThreshold) {
                console.log(this.state, velocity)
                if(velocity > this.options.velThreshold) {
                    console.log(this.state, velocity);
                    this.slideDown(velocity);
                } else {
                    this.slideUp(Math.abs(velocity));
                }
            } else {
                if(velocity < -this.options.velThreshold) {
                    this.slideUp(Math.abs(velocity));
                } else {
                    this.slideDown(velocity);
                }
            }
        }).bind(this));
    };

    StoriesView.prototype.toggle = function() {
        if(this.up) this.slideDown();
        else this.slideUp();
        this.up = !this.up;
    };

    StoriesView.prototype.slideUp = function(velocity) {
        console.log('slide up');
        var spring = this.options.spring;
        spring.velocity = velocity;

        this.options.scrollOpts.paginated = true;
        this.scrollview.setOptions(this.options.scrollOpts);

        this.yPos.set(0, spring, function() {
            this.state = 'up';
        }.bind(this));

    };

    StoriesView.prototype.slideDown = function(velocity) {
        console.log('slide down');

        var spring = this.options.spring;
        spring.velocity = velocity;

        this.options.scrollOpts.paginated = false;
        this.scrollview.setOptions(this.options.scrollOpts);

        this.yPos.set(this.options.initY, spring, function() {
            this.state = 'down';
        }.bind(this));
    };

    StoriesView.prototype.render = function() {
        var yPos = this.yPos.get();
        var scale = Utils.map(yPos, 0, this.options.initY, 1, this.options.cardScale);
        this.progress = Utils.map(yPos, this.options.initY, 0, 0, 1, true);

        this.scrollview.sync.setOptions({
            direction: GenericSync.DIRECTION_X,
            scale: 1/scale
        });

        for(var i = 0; i < this.stories.length; i++) {
            this.stories[i].setProgress(this.progress);
        }

        this.spec = [];
        this.spec.push({
            origin: [0.5, 1],
            transform: FM.multiply(FM.aboutOrigin([0, 0, 0], FM.scale(scale, scale, 1)), 
                FM.translate(0, 0, 0)),
            target: {
                size: [window.innerWidth, window.innerHeight],
                target: this.scrollview.render()
            }
        });

        return this.spec;
    };

    module.exports = StoriesView;
});

define('famous-views/LightBox',['require','exports','module','famous/Matrix','famous/Modifier','famous/RenderNode','famous/Utility'],function(require, exports, module) {
    var Matrix = require('famous/Matrix');
    var Modifier = require('famous/Modifier');
    var RenderNode = require('famous/RenderNode');
    var Utility = require('famous/Utility');

    /**
     * @class Show, hide, or switch between different renderables 
     *   with a configurable transitions and in/out states
     * @description
     * @name LightBox
     * @constructor
     */
    function LightBox(options) {
        this.options = {
            inTransform: Matrix.scale(0.001, 0.001, 0.001),
            inOpacity: 0,
            inOrigin: [0.5, 0.5],
            outTransform: Matrix.scale(0.001, 0.001, 0.001),
            outOpacity: 0,
            outOrigin: [0.5, 0.5],
            showTransform: Matrix.identity,
            showOpacity: 1,
            showOrigin: [0.5, 0.5],
            inTransition: true,
            outTransition: true,
            overlap: false
        };

        if(options) this.setOptions(options);

        this._showing = false;
        this.nodes = [];
        this.transforms = [];
    };

    LightBox.prototype.getOptions = function() {
        return this.options;
    };

    LightBox.prototype.setOptions = function(options) {
        if(options.inTransform !== undefined) this.options.inTransform = options.inTransform;
        if(options.inOpacity !== undefined) this.options.inOpacity = options.inOpacity;
        if(options.inOrigin !== undefined) this.options.inOrigin = options.inOrigin;
        if(options.outTransform !== undefined) this.options.outTransform = options.outTransform;
        if(options.outOpacity !== undefined) this.options.outOpacity = options.outOpacity;
        if(options.outOrigin !== undefined) this.options.outOrigin = options.outOrigin;
        if(options.showTransform !== undefined) this.options.showTransform = options.showTransform;
        if(options.showOpacity !== undefined) this.options.showOpacity = options.showOpacity;
        if(options.showOrigin !== undefined) this.options.showOrigin = options.showOrigin;
        if(options.inTransition !== undefined) this.options.inTransition = options.inTransition;
        if(options.outTransition !== undefined) this.options.outTransition = options.outTransition;
        if(options.overlap !== undefined) this.options.overlap = options.overlap;
    };

    LightBox.prototype.show = function(renderable, transition, callback) {
        if(!renderable) {
            return this.hide(callback);
        }
        
        if(transition instanceof Function) {
            callback = transition;
            transition = undefined;
        }

        if(this._showing) {
            if(this.options.overlap) this.hide();
            else {
                this.hide(this.show.bind(this, renderable, callback));
                return;
            }
        }
        this._showing = true;

        var transform = new Modifier({
            transform: this.options.inTransform, 
            opacity: this.options.inOpacity, 
            origin: this.options.inOrigin
        });
        var node = new RenderNode();
        node.link(transform).link(renderable); 
        this.nodes.push(node);
        this.transforms.push(transform);

        var _cb = callback ? Utility.after(3, callback) : undefined;

        if(!transition) transition = this.options.inTransition;
        transform.setTransform(this.options.showTransform, transition, _cb);
        transform.setOpacity(this.options.showOpacity, transition, _cb);
        transform.setOrigin(this.options.showOrigin, transition, _cb);
    };

    LightBox.prototype.hide = function(transition, callback) {
        if(!this._showing) return;
        this._showing = false;
        
        if(transition instanceof Function) {
            callback = transition;
            transition = undefined;
        }

        var node = this.nodes[this.nodes.length - 1];
        var transform = this.transforms[this.transforms.length - 1];
        var _cb = Utility.after(3, function() {
            this.nodes.splice(this.nodes.indexOf(node), 1);
            this.transforms.splice(this.transforms.indexOf(transform), 1);
            if(callback) callback.call(this);
        }.bind(this));

        if(!transition) transition = this.options.outTransition;
        transform.setTransform(this.options.outTransform, transition, _cb);
        transform.setOpacity(this.options.outOpacity, transition, _cb);
        transform.setOrigin(this.options.outOrigin, transition, _cb);
    };

    LightBox.prototype.render = function() {
        var result = [];
        for(var i = 0; i < this.nodes.length; i++) {
            result.push(this.nodes[i].render());
        }
        return result;
    };

    module.exports = LightBox;
});

define('app/AppView',['require','exports','module','famous/Engine','famous/Modifier','famous/Surface','famous/Matrix','famous/View','famous-animation/Easing','famous-sync/GenericSync','famous/Transitionable','famous-physics/utils/SpringTransition','famous-views/LightBox','famous-utils/Time','./StoryViews/StoriesView','./CoverViews/CoverView','./Data/CoverData'],function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Modifier            = require('famous/Modifier');
    var Surface             = require('famous/Surface');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    var GenericSync         = require('famous-sync/GenericSync');
    var Transitionable      = require('famous/Transitionable');
    var SpringTransition    = require('famous-physics/utils/SpringTransition');
    var Lightbox            = require('famous-views/LightBox');
    var Time                = require('famous-utils/Time');

    var StoriesView         = require('./StoryViews/StoriesView');
    var CoverView           = require('./CoverViews/CoverView');
    var CoverData           = require('./Data/CoverData');

    Transitionable.registerMethod('spring', SpringTransition);

    function App() {
        View.apply(this, arguments);

        this.storiesView = new StoriesView();
        this.lightbox = new Lightbox({
            inTransform: FM.identity,
            inOpacity: 0,
            inOrigin: [0.5, 0.5],
            outTransform: FM.identity,
            outOpacity: 0,
            outOrigin: [0.5, 0.5],
            showTransform: FM.identity,
            showOpacity: 1,
            showOrigin: [0.5, 0.5],
            inTransition: {
                duration: 1000
            },
            outTransition: {
                duration: 1000
            },
            overlap: true
        });

        this.covers = [];
        for(var i = 0; i < CoverData.length; i++) {
            var cover = new CoverView(CoverData[i]);
            this.covers.push(cover);
        }

        var i = 0;
        this.lightbox.show(this.covers[0]);

        Time.setInterval(function() {
            i++;
            if(i === this.covers.length) i = 0;
            this.lightbox.show(this.covers[i]);
        }.bind(this), 4000);


        var mod = new Modifier({
            transform: FM.translate(0, 0, -0.1)
        });

        this._add(mod).link(this.lightbox);
        this._add(this.storiesView);
    }

    App.prototype = Object.create(View.prototype);
    App.prototype.constructor = App;

    App.DEFAULT_OPTIONS = {
    };

    module.exports = App;
});
define('famous/CanvasSurface',['require','exports','module','./Surface'],function(require, exports, module) {
    var FamousSurface = require('./Surface');

    /**
     * @class An object designed to contain surfaces, and set properties
     *   to be applied to all of them at once.
     *
     * @description 
     *  * A container surface will enforce these properties on the 
     *   surfaces it contains:
     *     * size (clips contained surfaces to its own width and height)
     *     * origin
     *     * its own opacity and transform, which will be automatically 
     *       applied to  all Surfaces contained directly and indirectly.
     *   These properties are maintained through a {@link 
     *   FamousSurfaceManager} unique to this Canvas Surface.
     *   Implementation note: in the DOM case, this will generate a div with 
     *   the style 'containerSurface' applied.
     *   
     * @name FamousCanvasSurface
     * @extends FamousSurface
     * @constructor
     */
    function FamousCanvasSurface(options) {
        if(options && options.canvasSize) this.canvasSize = options.canvasSize;
        FamousSurface.call(this, options);
        if(!this.canvasSize) this.canvasSize = this.getSize();
        this.backBuffer = document.createElement('canvas');
        if(this.canvasSize) {
            this.backBuffer.width = this.canvasSize[0];
            this.backBuffer.height = this.canvasSize[1];
        }
        this._contextId = undefined;
    };

    FamousCanvasSurface.prototype = Object.create(FamousSurface.prototype);
    FamousCanvasSurface.prototype.elementType = 'canvas';
    FamousCanvasSurface.prototype.elementClass = 'surface';

    FamousCanvasSurface.prototype.setContent = function() {};

    FamousCanvasSurface.prototype.deploy = function(target) {
        if(this.canvasSize) {
            target.width = this.canvasSize[0];
            target.height = this.canvasSize[1];
        }

        if(this._contextId == '2d') {
            target.getContext(this._contextId).drawImage(this.backBuffer, 0, 0);
            this.backBuffer.width = 0;
            this.backBuffer.height = 0;
        }

    };

    FamousCanvasSurface.prototype.recall = function(target) {
        var size = this.getSize();

        this.backBuffer.width = target.width;
        this.backBuffer.height = target.height;

        if(this._contextId == '2d') {
            this.backBuffer.getContext(this._contextId).drawImage(target, 0, 0);
            target.width = 0;
            target.height = 0;
        }
    };

    /**
     * Returns the canvas element's context
     *
     * @name FamousCanvasSurface#getContext
     * @function
     * @param {string} contextId context identifier
     */
    FamousCanvasSurface.prototype.getContext = function(contextId) {
        this._contextId = contextId;
        return this._currTarget ? this._currTarget.getContext(contextId) : this.backBuffer.getContext(contextId);
    };

    FamousCanvasSurface.prototype.setSize = function(size, canvasSize) {
        FamousSurface.prototype.setSize.apply(this, arguments);
        if(canvasSize) this.canvasSize = canvasSize.slice(0);
        if(this._currTarget) {
            this._currTarget.width = this.canvasSize[0];
            this._currTarget.height = this.canvasSize[1];
        }
    };

    module.exports = FamousCanvasSurface;
});


define('famous/EventArbiter',['require','exports','module','./EventHandler'],function(require, exports, module) {
    var FamousEventHandler = require('./EventHandler');

    /**
     * 
     * @class A switch which wraps several event 
     *    destinations and redirects received events to at most one of them. 
     * @description Setting the 'mode' of the object dictates which one 
     *    of these destinations will receive events.  
     *    It is useful for transferring control among
     *    many actionable areas in the event tree (like 'pages'), only one of 
     *    which is currently visible.  
     * 
     * @name FamousEventArbiter
     * @constructor
     * 
     * @example
     *    var eventArbiter = new FamousEventArbiter(PAGES.COVER);
     *    var coverHandler = eventArbiter.forMode(PAGES.COVER);
     *    coverHandler.on('my_event', function(event) { 
     *      document.title = 'Cover'; 
     *    });
     *    var overviewHandler = eventArbiter.forMode(PAGES.OVERVIEW)
     *    overviewHandler.on('my_event', function(event) { 
     *      document.title = 'Overview'; 
     *    });
     *  
     *    function loadPage(page) {
     *      eventArbiter.setMode(page);
     *      eventArbiter.emit('my_event', {data: 123})
     *    };
     *
     *    loadPage(PAGES.COVER);
     * 
     * @param {number|string} startMode initial setting of switch,
     */
    function FamousEventArbiter(startMode) {
        this.dispatchers = {};
        this.currMode = undefined;
        this.setMode(startMode);
    };

    /**
     * Set switch to this mode, passing events to the corresopnding 
     *   {@link FamousEventHandler}.  If mode has changed, emits 'change' 
     *   event to the  old mode's handler and 'modein' event to the new 
     *   mode's handler, passing along object {from: startMode, to: endMode}.
     *   
     * @name FamousEventArbiter#setMode
     * @function
     * @param {string|number} mode indicating which event handler to send to.
     */
    FamousEventArbiter.prototype.setMode = function(mode) {
        if(mode != this.currMode) {
            // debugger
            var startMode = this.currMode;
            if(this.dispatchers[this.currMode]) this.dispatchers[this.currMode].emit('unpipe');
            this.currMode = mode;
            if(this.dispatchers[mode]) this.dispatchers[mode].emit('pipe'); 
            this.emit('change', {from: startMode, to: mode});
        }
    };

    /**
     * Return the existing {@link FamousEventHandler} corresponding to this 
     *   mode, creating one if it doesn't exist. 
     * 
     * @name FamousEventArbiter#forMode
     * @function
     * @param {string|number} mode mode to which this eventHandler corresponds
     * @returns {FamousEventHandler} eventHandler behind this mode's "switch"
     */
    FamousEventArbiter.prototype.forMode = function(mode) {
        if(!this.dispatchers[mode]) this.dispatchers[mode] = new FamousEventHandler();
        return this.dispatchers[mode];
    };

    /**
     * Send event to currently selected handler.
     *
     * @name FamousEventArbiter#emit
     * @function
     * @param {string} eventType
     * @param {Object} event
     * @returns {boolean} true if the event was handled by at a leaf handler.
     */
    FamousEventArbiter.prototype.emit = function(eventType, event) {
        if(this.currMode == undefined) return false;
        if(!event) event = {};
        var dispatcher = this.dispatchers[this.currMode];
        if(dispatcher) return dispatcher.emit(eventType, event);
    };

    module.exports = FamousEventArbiter;
});

define('famous/ImageSurface',['require','exports','module','./Surface'],function(require, exports, module) {
    var FamousSurface = require('./Surface');

    /**
     * @class An object designed to contain surfaces, and set properties
     *   to be applied to all of them at once.
     *
     * @description 
     *  * A container surface will enforce these properties on the 
     *   surfaces it contains:
     *     * size (clips contained surfaces to its own width and height)
     *     * origin
     *     * its own opacity and transform, which will be automatically 
     *       applied to  all Surfaces contained directly and indirectly.
     *   These properties are maintained through a {@link 
     *   FamousSurfaceManager} unique to this Image Surface.
     *   Implementation note: in the DOM case, this will generate a div with 
     *   the style 'containerSurface' applied.
     *   
     * @name FamousImageSurface
     * @extends FamousSurface
     * @constructor
     */
    function FamousImageSurface(opts) {
        this.imageUrl = undefined;
        FamousSurface.apply(this, arguments);
    };

    FamousImageSurface.prototype = Object.create(FamousSurface.prototype);
    FamousImageSurface.prototype.surfaceEvents = FamousSurface.prototype.surfaceEvents.concat(['load']);
    FamousImageSurface.prototype.elementType = 'img';
    FamousImageSurface.prototype.elementClass = 'surface';

    FamousImageSurface.prototype.setContent = function(imageUrl) {
        this.imageUrl = imageUrl;
        this._contentDirty = true;
    };

    FamousImageSurface.prototype.deploy = function(target) {
        target.src = this.imageUrl || '';
    };

    FamousImageSurface.prototype.recall = function(target) {
        target.src = '';
    };

    module.exports = FamousImageSurface;
});


define('famous/SceneCompiler',['require','exports','module','./Matrix'],function(require, exports, module) {
    var FM = require('./Matrix');

    /**
     * @function compile a scene definition into a loader function
     *
     * @name Scene
     * @constructor
     */
    function compile(def) {
        var obj = {varCounter: 0};
        var codeLines = [];
        var resultVar = _parse.call(obj, def, codeLines);
        codeLines.push('return ' + resultVar + ';');
        return new Function(['FT', 'RenderNode', 'RN_link', 'RN_include', 'id', 'transforms'], codeLines.join('\n'));
    };

    function _assignVar(name, value) {
        return 'var ' + name + ' = ' + value + ';';
    };

    function _assignId(name, value) {
        return 'id.' + name + ' = ' + value + ';';
    };

    function _pushTransform(name) {
        return 'transforms.push(' + name + ');';
    };

    function _genVarName() {
        return '_' + this.varCounter++;
    };

    function _parse(def, output) {
        var result;
        if(def instanceof Array) {
            result = _parseArray.call(this, def, output);
        }
        else {
            result = _genVarName.call(this);
            if(def['target']) {
                var targetObj = _parse.call(this, def['target'], output);
                var obj = _parseTransform.call(this, def, output);
                output.push(_assignVar(result, 'new RenderNode(' + obj + ')'));
                output.push('RN_link.call(' + result + ', ' + targetObj + ');');
                if(def['id']) output.push(_assignId(def['id'], obj));
                output.push(_pushTransform(obj));
            }
            else if(def['id']) {
                output.push(_assignVar(result, 'new RenderNode()'));
                output.push(_assignId(def['id'], result));
            }
        }
        return result;
    };

    function _parseArray(def, output) {
        var result = _genVarName.call(this);
        output.push(_assignVar(result, 'new RenderNode()'));
        for(var i = 0; i < def.length; i++) {
            var obj = _parse.call(this, def[i], output);
            if(obj) {
                output.push('RN_include.call(' + result + ', ' + obj + ');');
            }
        }
        return result;
    };

    function _parseTransform(def, output) {
        var transformDef = def['transform'];
        var opacity = def['opacity'];
        var origin = def['origin'];
        var size = def['size'];
        var target = def['target'];
        var transform = FM.identity;
        if(transformDef instanceof Array) {
            if(transformDef.length == 16 && typeof transformDef[0] == 'number') {
                transform = transformDef;
            }
            else {
                for(var i = 0; i < transformDef.length; i++) {
                    transform = FM.multiply(transform, _resolveTransformMatrix(transformDef[i]));
                }
            }
        }
        else if(transformDef instanceof Object) {
            transform = _resolveTransformMatrix(transformDef);
        }

        var result = _genVarName.call(this);
        var transformStr = '[' + transform.join(',') + ']';
        var originStr = origin ? '[' + origin.join(',') + ']' : undefined;
        var sizeStr = size ? '[' + size.join(',') + ']' : undefined;
        output.push(_assignVar(result, 'new FT(' + transformStr + ',' + opacity + ',' + originStr + ',' + sizeStr + ')'));
        return result;
    };

    var _MATRIX_GENERATORS = {
        'translate': FM.translate,
        'rotate': FM.rotate,
        'rotateX': FM.rotateX,
        'rotateY': FM.rotateY,
        'rotateZ': FM.rotateZ,
        'rotateAxis': FM.rotateAxis,
        'scale': FM.scale,
        'skew': FM.skew,
        'matrix3d': function() { return arguments; }
    };

    function _resolveTransformMatrix(matrixDef) {
        for(var type in _MATRIX_GENERATORS) {
            if(type in matrixDef) {
                var args = matrixDef[type];
                if(!(args instanceof Array)) args = [args];
                return _MATRIX_GENERATORS[type].apply(this, args);
            }
        }
    };

    module.exports = {compile: compile};
});

define('famous/Scene',['require','exports','module','./RenderNode','./Modifier','./SceneCompiler'],function(require, exports, module) {
    var RenderNode = require('./RenderNode');
    var Modifier = require('./Modifier');
    var SceneCompiler = require('./SceneCompiler');

    var RN_link = RenderNode.prototype.link;
    var RN_add = RenderNode.prototype.add;

    /**
     * @class Scene definition loader
     * @description Builds and renders a scene graph based on a canonical scene definition
     *
     * @name Scene
     * @constructor
     */
    function Scene(def) {
        this.id = {};
        this.transforms = [];

        this.node = new RenderNode();
        this._def = undefined;
        if(def) this.load(def);
    };

    Scene.prototype.create = function() {
        return new Scene(this._def);
    };

    Scene.prototype.load = function(def) {
        if(def instanceof Scene) def = def._def;
        else if(!(def instanceof Function)) def = SceneCompiler.compile(def);
        this.node = def(Modifier, RenderNode, RN_link, RN_add, this.id, this.transforms);
        this._def = def;
    };

    Scene.prototype.getTransforms = function() {
        return this.transforms;
    };

    Scene.prototype.add = function() { return this.node.add.apply(this.node, arguments); };
    Scene.prototype.mod = function() { return this.node.mod.apply(this.node, arguments); };
    Scene.prototype.link = function() { return this.node.link.apply(this.node, arguments); };
    Scene.prototype.render = function() { return this.node.render.apply(this.node, arguments); };

    module.exports = Scene;
});

define('famous/Timer',['require','exports','module','famous/Engine'],function(require, exports, module) {
    var FamousEngine = require('famous/Engine');

    var _event  = 'prerender';

    var getTime = (window.performance)
        ? function(){return performance.now()}
        : function(){return Date.now()}

    function addTimerFunction(fn){
        FamousEngine.on(_event, fn);
        return fn;
    };

    function setTimeout(fn, duration){
        var t = getTime();
        var callback = function(){
            var t2 = getTime();
            if (t2 - t >= duration){
                fn.apply(this, arguments);
                FamousEngine.unbind(_event, callback);
            };
        };
        return addTimerFunction(callback);
    };

    function setInterval(fn, duration){
        var t = getTime();
        var callback = function(){
            var t2 = getTime();
            if (t2 - t >= duration){
                fn.apply(this, arguments);
                t = getTime();
            };
        };
        return addTimerFunction(callback);
    };

    function after(fn, numTicks){
        if (numTicks === undefined) return;
        var callback = function(){
            numTicks--;
            if (numTicks <= 0){ //in case numTicks is fraction or negative
                fn.apply(this, arguments);
                clear(callback);
            };
        };
        return addTimerFunction(callback);
    };

    function every(fn, numTicks){
        numTicks = numTicks || 1;
        var initial = numTicks;
        var callback = function(){
            numTicks--;
            if (numTicks <= 0){ //in case numTicks is fraction or negative
                fn.apply(this, arguments);
                numTicks = initial;
            };
        };
        return addTimerFunction(callback);
    };

    function clear(fn){
        FamousEngine.unbind(_event, fn);
    };

    module.exports = {
        setTimeout : setTimeout,
        setInterval : setInterval,
        after : after,
        every : every,
        clear : clear
    };

});

define('famous/VideoSurface',['require','exports','module','./Surface'],function(require, exports, module) {
    var FamousSurface = require('./Surface');

    /**
     * @class An object designed to contain surfaces, and set properties
     *   to be applied to all of them at once.
     *
     * @description 
     *  * A container surface will enforce these properties on the 
     *   surfaces it contains:
     *     * size (clips contained surfaces to its own width and height)
     *     * origin
     *     * its own opacity and transform, which will be automatically 
     *       applied to  all Surfaces contained directly and indirectly.
     *   These properties are maintained through a {@link 
     *   FamousSurfaceManager} unique to this Video Surface.
     *   Implementation note: in the DOM case, this will generate a div with 
     *   the style 'containerSurface' applied.
     *   
     * @name FamousVideoSurface
     * @extends FamousSurface
     * @constructor
     */
    function FamousVideoSurface(opts) {
        this.autoplay = opts.autoplay || false;
        this.videoUrl = undefined;

        FamousSurface.apply(this, arguments);
    };

    FamousVideoSurface.prototype = Object.create(FamousSurface.prototype);
    FamousVideoSurface.prototype.elementType = 'video';
    FamousVideoSurface.prototype.elementClass = 'surface';

    FamousVideoSurface.prototype.setContent = function(videoUrl) {
        this.videoUrl = videoUrl;
        this.contentDirty = true;
    };

    FamousVideoSurface.prototype.deploy = function(target) {
        target.src = this.videoUrl;
        target.autoplay = this.autoplay;
    };

    FamousVideoSurface.prototype.recall = function(target) {
        target.src = '';
    };

    module.exports = FamousVideoSurface;
});


define('famous/WebGLSurface',['require','exports','module','./Surface'],function(require, exports, module) {
    var FamousSurface = require('./Surface');

    /**
     * @class An object designed to contain WebGL
     *   
     * @name WebGLSurface
     * @extends FamousSurface
     * @constructor
     */
    function WebGLSurface(options) {        
        this.glOptions = options.glOptions; 
        this._canvas = document.createElement('canvas');
        FamousSurface.call(this, options);
        this.setContent(this._canvas);
        this.setSize(options.size); 
    }

    WebGLSurface.prototype = Object.create(FamousSurface.prototype);

    /**
     * Returns the canvas element's WebGL context
     *
     * @name WebGLSurface#getContext
     * @function
     */
    WebGLSurface.prototype.getContext = function() {
        return (this._canvas.getContext('webgl', this.glOptions) || this._canvas.getContext('experimental-webgl', this.glOptions)); 
    };

    WebGLSurface.prototype.setSize = function(size) {        
        FamousSurface.prototype.setSize.apply(this, arguments);        
        this._canvas.style.width = size[0] + "px";
        this._canvas.style.height = size[1] + "px";
        var ratio = window.devicePixelRatio ? window.devicePixelRatio : 1;        
        this._canvas.width = size[0] * ratio; 
        this._canvas.height = size[1] * ratio; 
    };

    module.exports = WebGLSurface;
});


define('famous-animation/Animation',['require','exports','module','famous/Surface','famous/Matrix','famous-utils/Utils','./Easing'],function(require, exports, module) {
    var FamousSurface = require('famous/Surface');     
    var FM = require('famous/Matrix');    
    var Utils = require('famous-utils/Utils');
    var Easing = require('./Easing'); 

    function Animation(options)
    { 
        this.name = options.name || 'base'; 
        this.dead = false; 
        this.engine = options.engine || undefined;
        this.duration = options.duration || 500.0;                  
        this.delay = options.delay || 0.0;         
        this.nextAnimations = []; 
        if(options.next !== undefined)
        {
            if(options.next instanceof Array)
            {
                this.nextAnimations.concat(options.next); 
            }
            else
            {
                this.nextAnimations.push(options.next); 
            }
        }

        this.callback = options.callback || undefined;         

        this.startTime = 0.0; 
        this.endTime = 0.0; 
        this.currentTime = 0.0;       
        this.normalizedTime = 0.0;          
        this.timePassed = 0.0; 
        
        this.halted = false; 
        this.playing = false; 
        this.activated = false;         //indicated whether or not Activate has been called

        this.activateCallback = options.activateCallback || undefined; 
        this.deactivateCallback = options.deactivateCallback || undefined; 

        this.loop = options.loop || false; 
        this.reverse = options.reverse || false; 
        this.reverseUponLoop = options.reverseUponLoop || false; 
        return this; 
    }    

    Animation.prototype.setDead = function(dead)
    {
        this.dead = dead; 
        return this; 
    };

    Animation.prototype.isDead = function()
    {
        return this.dead; 
    };    

    Animation.prototype.setup = function() 
    {

    };

    Animation.prototype.update = function() 
    {

    }; 

    Animation.prototype.render = function()	//Customize this
    {
        
    };

    Animation.prototype.isPlaying = function()
    {
        return this.playing; 
    };

    Animation.prototype.setDuration = function(duration)
    {
        this.duration = duration; 
        return this; 
    };

    Animation.prototype.setDelay = function(delay)
    {
        this.delay = delay; 
        return this; 
    };

    Animation.prototype.setCallback = function(callback)
    {
        this.callback = callback || undefined; 
        return this; 
    };

    Animation.prototype.setReverse = function(reverse) 
    {
        this.reverse = reverse; 
        return this; 
    };

    Animation.prototype.toggleReverse = function()
    {
        this.reverse = !this.reverse;
        return this; 
    };
    
    Animation.prototype.setLoop = function(loop)
    {
        this.loop = loop; 
        return this; 
    };

    Animation.prototype.setReverseUponLoop = function(reverseUponLoop)
    {
        this.reverseUponLoop = reverseUponLoop; 
        return this; 
    };

    Animation.prototype.isHalted = function()
    {
        return this.halted; 
    };

    Animation.prototype.halt = function()
    {
        this.halted = true;             
        this.timePassed = this.engine.getTime() - this.startTime;                 
    };

    Animation.prototype.continueAnimation = function() 
    {    
        this.halted = false; 
        this.startTime = this.engine.getTime() - this.timePassed; 
        this.timePassed = 0.0; 
    };

    Animation.prototype.activate = function()
    {

    };

    Animation.prototype.deactivate = function()
    {

    };

    Animation.prototype.start = function()
    {
        this.engine.addAnimation(this); 
        this.setDead(false); 
        this.halted = false; 
        this.playing = true; 
        this.startTime = this.engine.getTime() + this.delay - this.timePassed; 
        this.endTime = this.startTime + this.duration; 
        this.normalizedTime = 0.0;
    };

    Animation.prototype.tick = function()
    {
        if(this.playing && !this.halted)
        {
            this.currentTime = this.engine.getTime() - this.startTime;         
            this.normalizedTime = this.currentTime / this.duration;
            if(this.normalizedTime > 1.0)
            {                            
                this.normalizedTime = Utils.clamp(this.normalizedTime, 0.0, 1.0);                                   
                if(this.reverse)
                {
                    this.normalizedTime = 1.0 - this.normalizedTime; 
                }                                                               
                this.update(); 
                this.end();     
                return;         
            }
            if(this.normalizedTime > 0.000001)
            {                
                if(!this.activated)
                {
                    this.activate(); 
                    if(this.activateCallback !== undefined)
                    {
                        this.activateCallback(); 
                    }
                    this.activated = true; 
                }

                if(this.reverse)
                {
                    this.normalizedTime = 1.0 - this.normalizedTime; 
                }                                               
                this.update();
            }                                                
        }
    };

    Animation.prototype.getTime = function()
    {
        return this.normalizedTime; 
    };

    Animation.prototype.end = function()
    {
        this.activated = false; 
        this.playing = false;      
        this.deactivate(); 
        if(this.deactivateCallback !== undefined)
        {
            this.deactivateCallback(); 
        }
        this.engine.removeAnimation(this); 
        if(this.reverseUponLoop)
        {
            this.toggleReverse(); 
        }                   
        if(this.loop)
        {            
            this.start();
        }
        else
        {
            for(var i = 0; i < this.nextAnimations.length; i++)
            {                
                this.nextAnimations[i].start(); 
            }        
        }
        if(this.callback !== undefined)
        {
            this.callback(); 
        }
    };

    Animation.prototype.setNext = function(next) 
    {        
        if(next instanceof Array)
        {
            this.nextAnimations = this.nextAnimations.concat(this.nextAnimations, next); 
        }
        else
        {
            this.nextAnimations.push(next); 
        }
    };

    Animation.prototype.setName = function(name)
    {
        this.name = name; 
    };

    Animation.prototype.getName = function()
    {
        return this.name;
    };

    Animation.prototype.setActivateCallback = function(callback)
    {
        this.activateCallback = callback; 
    };

    Animation.prototype.setDeactivateCallback = function(callback) 
    {
        this.deactivateCallback = callback; 
    };

    module.exports = Animation;
});

define('famous-animation/Timer',['require','exports','module'],function(require, exports, module) {
    
    function Timer()
    {
        if (window.performance) 
        {
            if(window.performance.now) 
            {
                this.getTime = function() { return window.performance.now(); };
            } 
            else if(window.performance.webkitNow) 
            {           
                this.getTime = function() { return window.performance.webkitNow(); };
            } 
        } 
        else 
        {
            this.getTime = function() { return Date.now(); };
        }
    }
    
    module.exports = Timer;
});
define('famous-animation/AnimationEngine',['require','exports','module','famous/Engine','./Timer','./Animation'],function(require, exports, module) {
    var FamousEngine = require('famous/Engine'); 
    var Timer = require('./Timer');
    var Animation = require('./Animation'); 

    function AnimationEngine()
    {
        this.animations = []; 
        this.timer = new Timer(); 
        FamousEngine.on('prerender', this.update.bind(this));         
    }

    AnimationEngine.prototype.update = function() 
    {
        for (var i = 0; i < this.animations.length; i++) 
        {
            this.animations[i].tick();
        }
    };

    AnimationEngine.prototype.render = function() 
    {
        var results = []; 
    
        for (var i = 0; i < this.animations.length; i++) 
        {
            if(this.animations[i].normalizedTime > 0.0)
            {
                results.push(this.animations[i].render());
            }
            if(this.animations[i].isDead())
            {
                this.animations.splice(this.animations.indexOf(this.animations[i]), 1);
            }
        }
        return results; 
    };

    AnimationEngine.prototype.emit = function(type, event)
    {
        if(type == 'prerender')		
        {
            this.update();                         
            this.render(); 
        }
    };

    AnimationEngine.prototype.addAnimation = function(animation)
    {
        if(this.animations.indexOf(animation) == -1)
        {
            this.animations.push(animation);
        }
    };

    AnimationEngine.prototype.removeAnimation = function(animation)
    {
        animation.setDead(true);
    };

    AnimationEngine.prototype.getTime = function()
    {
        return this.timer.getTime();
    };

    module.exports = AnimationEngine;
});
define('famous-animation/CubicBezier',['require','exports','module'],function(require, exports, module) {

    function FamousCubicBezier(v) {
        //v =  [y1, y2, dy1, dy2];

        var M = [
            [ 1,  0,  0,  0],
            [ 0,  0,  1,  0],
            [-3,  3, -2, -1],
            [ 2, -2,  1,  1]
        ];

        v = v || [0,1,0,0];

        this.coef = [0,0,0,0];
        for (var i = 0; i < 4; i++)
            for (var j = 0; j < 4; j++)
                this.coef[i] += M[i][j]*v[j];

    };

    FamousCubicBezier.prototype.create = function() {
        var self = this;
        return function(t) {
            t = t || 0;
            var v = self.coef;
            return v[0] + v[1]*t + v[2]*t*t + v[3]*t*t*t;
        };
    };

    module.exports = FamousCubicBezier;
});

define('famous-math/Vector',['require','exports','module'],function(require, exports, module) {

    /**
     * @class An immutable three-element floating point vector.
     *
     * @description Note that if not using the "out" parameter,
     *    then funtions return a common reference to an internal register.
     *
     * * Class/Namespace TODOs:
     *   * Are there any vector STANDARDS in JS that we can use instead of our own library?
     *   * Is it confusing that this is immutable?
     *   * All rotations are counter-clockwise in a right-hand system.  Need to doc this
     *     somewhere since Famous render engine's rotations are left-handed (clockwise)
     *
     * Constructor: Take three elts or an array and make new vec.
     *
     * @name Vector
     * @constructor
     */
    function Vector(x,y,z){
        if (arguments.length === 1) this.set(x);
        else{
            this.x = x || 0.0;
            this.y = y || 0.0;
            this.z = z || 0.0;
        };
        return this;
    };

    var register = new Vector(0,0,0);

    /**
     * Add to another Vector, element-wise.
     *
     * @name Vector#add
     * @function
     * @returns {Vector}
     */
    Vector.prototype.add = function(v){
        return register.setXYZ(
            this.x + (v.x || 0.0),
            this.y + (v.y || 0.0),
            this.z + (v.z || 0.0)
        );
    };

    /**
     * Subtract from another Vector, element-wise.
     *
     * @name Vector#sub
     * @function
     * @returns {Vector}
     */
    Vector.prototype.sub = function(v){
        return register.setXYZ(
            this.x - v.x,
            this.y - v.y,
            this.z - v.z
        );
    };

    /**
     * Scale Vector by floating point r.
     *
     * @name Vector#mult
     * @function
     * @returns {number}
     */
    Vector.prototype.mult = function(r){
        return register.setXYZ(
            r * this.x,
            r * this.y,
            r * this.z
        );
    };

    /**
     * Scale Vector by floating point 1/r.
     *
     * @name Vector#div
     * @function
     * @returns {number}
     */
    Vector.prototype.div = function(r){
        return this.mult(1/r);
    };

    /**
     * Return cross product with another Vector (LHC)
     *
     * @name Vector#cross
     * @function
     * @returns {Vector}
     */
    Vector.prototype.cross = function(v){
        var x = this.x, y = this.y, z = this.z;
        var vx = v.x, vy = v.y, vz = v.z;
        return register.setXYZ(
            z * vy - y * vz,
            x * vz - z * vx,
            y * vx - x * vy
        );
    };

    /**
     * Component-wise equality test between this and Vector v.
     * @name Vector#equals
     * @function
     * @returns {boolean}
     */
    Vector.prototype.equals = function(v){
        return (v.x == this.x && v.y == this.y && v.z == this.z);
    };

    /**
     * Rotate clockwise around x-axis by theta degrees.
     *
     * @name Vector#rotateX
     * @function
     * @returns {Vector}
     */
    Vector.prototype.rotateX = function(theta){
        var x = this.x;
        var y = this.y;
        var z = this.z;

        var cosTheta = Math.cos(theta);
        var sinTheta = Math.sin(theta);

        return register.setXYZ(
            x,
            y * cosTheta - z * sinTheta,
            y * sinTheta + z * cosTheta
        );
    };

    /**
     * Rotate clockwise around y-axis by theta degrees.
     *
     * @name Vector#rotateY
     * @function
     * @returns {Vector}
     */
    Vector.prototype.rotateY = function(theta, out){
        out = out || register;
        var x = this.x;
        var y = this.y;
        var z = this.z;

        var cosTheta = Math.cos(theta);
        var sinTheta = Math.sin(theta);

        return out.setXYZ(
            z * sinTheta + x * cosTheta,
            y,
            z * cosTheta - x * sinTheta
        );
    };

    /**
     * Rotate clockwise around z-axis by theta degrees.
     *
     * @name Vector#rotateZ
     * @function
     * @returns {Vector}
     */
    Vector.prototype.rotateZ = function(theta){
        var x = this.x;
        var y = this.y;
        var z = this.z;

        var cosTheta = Math.cos(theta);
        var sinTheta = Math.sin(theta);

        return register.setXYZ(
            x * cosTheta - y * sinTheta,
            x * sinTheta + y * cosTheta,
            z
        );
    };

    /**
     * Take dot product of this with a second Vector
     *
     * @name Vector#dot
     * @function
     * @returns {number}
     */
    Vector.prototype.dot = function(v){
        return this.x * v.x + this.y * v.y + this.z * v.z;
    };

    /**
     * Take dot product of this with a this Vector
     *
     * @name Vector#normSquared
     * @function
     * @returns {number}
     */
    Vector.prototype.normSquared = function(){
        return this.dot(this);
    };

    /**
     * Find Euclidean length of the Vector.
     *
     * @name Vector#norm
     * @function
     * @returns {number}
     */
    Vector.prototype.norm = function(){
        return Math.sqrt(this.normSquared());
    };

    /**
     * Scale Vector to specified length.
     * If length is less than internal tolerance, set vector to [length, 0, 0].
     *
     * * TODOs:
     *    * There looks to be a bug or unexplained behavior in here.  Why would
     *      we defer to a multiple of e_x for being below tolerance?
     *
     * @name Vector#normalize
     * @function
     * @returns {Vector}
     */
    Vector.prototype.normalize = function(length){
        length  = (length !== undefined) ? length : 1.0;

        var tolerance = 1e-7;
        var norm = this.norm();

        if (Math.abs(norm) > tolerance) return register.set(this.mult(length / norm));
        else return register.setXYZ(length, 0.0, 0.0);
    };

    /**
     * Make a separate copy of the Vector.
     *
     * @name Vector#clone
     * @function
     * @returns {Vector}
     */
    Vector.prototype.clone = function(){
        return new Vector(this);
    };

    /**
     * True if and only if every value is 0 (or falsy)
     *
     * @name Vector#isZero
     * @function
     * @returns {boolean}
     */
    Vector.prototype.isZero = function(){
        return !(this.x || this.y || this.z);
    };

    Vector.prototype.setFromArray = function(v){
        this.x = v[0];
        this.y = v[1];
        this.z = v[2] || 0.0;
        return this;
    };

    /**
     * Set this Vector to the values in the provided Array or Vector.
     *
     * TODO: set from Array disambiguation
     *
     * @name Vector#set
     * @function
     * @returns {Vector}
     */
    Vector.prototype.set = function(v){
        if (v instanceof Array){
            this.setFromArray(v);
        }
        if (v instanceof Vector){
            this.x = v.x;
            this.y = v.y;
            this.z = v.z;
        }
        if (typeof v == 'number') {
            this.x = v;
            this.y = 0;
            this.z = 0;
        }
        if (this !== register) register.clear();
        return this;
    };

    /**
     * Put result of last internal calculation in
     *   specified output vector.
     *
     * @name Vector#put
     * @function
     * @returns {Vector}
     */
    Vector.prototype.put = function(v){
        v.set(register);
    };

    /**
     * Set elements directly and clear internal register.
     *   This is the a "mutating" method on this Vector.
     *
     *
     * @name Vector#setXYZ
     * @function
     */
    Vector.prototype.setXYZ = function(x,y,z){
        register.clear();
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    };

    /**
     * Set elements to 0.
     *
     * @name Vector#clear
     * @function
     */
    Vector.prototype.clear = function(){
        this.x = 0;
        this.y = 0;
        this.z = 0;
    };

    /**
     * Scale this Vector down to specified "cap" length.
     * If Vector shorter than cap, or cap is Infinity, do nothing.
     *
     *
     * @name Vector#cap
     * @function
     * @returns {Vector}
     */
    Vector.prototype.cap = function(cap){
        if (cap === Infinity) return register.set(this);
        var norm = this.norm();
        if (norm > cap) return register.set(this.mult(cap/norm));
        else return register.set(this);
    };

    /**
     * Return projection of this Vector onto another.
     *
     * @name Vector#project
     * @function
     * @returns {Vector}
     */
    Vector.prototype.project = function(n){
        return n.mult(this.dot(n));
    };

    /**
     * Reflect this Vector across provided vector.
     *
     * @name Vector#reflect
     * @function
     */
    Vector.prototype.reflectAcross = function(n){
        n.set(n.normalize());
        return register.set(this.sub(this.project(n).mult(2)));
    };

    /**
     * Convert Vector to three-element array.
     *
     * * TODOs:
     *   * Why do we have this and get()?
     *
     * @name Vector#toArray
     * @function
     */
    Vector.prototype.toArray = function(){
        return [this.x, this.y, this.z];
    };

    /**
     * Convert Vector to three-element array.
     *
     * * TODOs:
     *   * Why do we have this and toArray()?
     *
     * @name Vector#get
     * @function
     */
    Vector.prototype.get = function(){
        return this.toArray();
    };

    module.exports = Vector;

});

define('famous-math/Quaternion',['require','exports','module'],function(require, exports, module) {

    /**
     * @constructor
     */
    function Quaternion(w,x,y,z){
        if (arguments.length === 1) this.set(w)
        else{
            this.w = (w !== undefined) ? w : 1;  //Angle
            this.x = (x !== undefined) ? x : 0;  //Axis.x
            this.y = (y !== undefined) ? y : 0;  //Axis.y
            this.z = (z !== undefined) ? z : 0;  //Axis.z
        };
        return this;
    };

    var register = new Quaternion(1,0,0,0);

    Quaternion.prototype.add = function(q){
        return register.setWXYZ(
            this.w + q.w,
            this.x + q.x,
            this.y + q.y,
            this.z + q.z
        );
    };

    Quaternion.prototype.sub = function(q){
        return register.setWXYZ(
            this.w - q.w,
            this.x - q.x,
            this.y - q.y,
            this.z - q.z
        );
    };

    Quaternion.prototype.scalarDivide = function(s){
        return this.scalarMultiply(1/s);
    };

    Quaternion.prototype.scalarMultiply = function(s){
        return register.setWXYZ(
            this.w * s,
            this.x * s,
            this.y * s,
            this.z * s
        );
    };

    Quaternion.prototype.multiply = function(q){
        //left-handed coordinate system multiplication
        var x1 = this.x, y1 = this.y, z1 = this.z, w1 = this.w;
        var x2 = q.x, y2 = q.y, z2 = q.z, w2 = q.w || 0;
        return register.setWXYZ(
            w1*w2 - x1*x2 - y1*y2 - z1*z2,
            x1*w2 + x2*w1 + y2*z1 - y1*z2,
            y1*w2 + y2*w1 + x1*z2 - x2*z1,
            z1*w2 + z2*w1 + x2*y1 - x1*y2
        );
    };

    var conj = new Quaternion(1,0,0,0);
    Quaternion.prototype.rotateVector = function(v){
        conj.set(this.conj());
        return register.set(this.multiply(v).multiply(conj));
    };

    Quaternion.prototype.inverse = function(){
        return register.set(this.conj().scalarDivide(this.normSquared()));
    };

    Quaternion.prototype.negate = function(){
        return this.scalarMultiply(-1);
    };

    Quaternion.prototype.conj = function(){
        return register.setWXYZ(
             this.w,
            -this.x,
            -this.y,
            -this.z
        );
    };

    Quaternion.prototype.normalize = function(length){
        length = (length === undefined) ? 1 : length;
        return this.scalarDivide(length * this.norm());
    };

    Quaternion.prototype.makeFromAngleAndAxis = function(angle, v){
        //left handed quaternion creation: theta -> -theta
        var n  = v.normalize();
        var ha = angle*0.5;
        var s  = -Math.sin(ha);
        this.x = s*n.x;
        this.y = s*n.y;
        this.z = s*n.z;
        this.w = Math.cos(ha);
        return this;
    };

    Quaternion.prototype.setWXYZ = function(w,x,y,z){
        register.clear();
        this.w = w;
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    };

    Quaternion.prototype.set = function(v){
        if (v instanceof Array){
            this.w = v[0];
            this.x = v[1];
            this.y = v[2];
            this.z = v[3];
        }
        else{
            this.w = v.w;
            this.x = v.x;
            this.y = v.y;
            this.z = v.z;
        }
        if (this !== register) register.clear();
        return this;
    };

    Quaternion.prototype.put = function(q){
        q.set(register);
    };

    Quaternion.prototype.clone = function(){
        return new Quaternion(this);
    };

    Quaternion.prototype.clear = function(){
        this.w = 1;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        return this;
    };

    Quaternion.prototype.isEqual = function(q){
        return q.w == this.w && q.x == this.x && q.y == this.y && q.z == this.z;
    };

    Quaternion.prototype.dot = function(q){
        return this.w * q.w + this.x * q.x + this.y * q.y + this.z * q.z;
    };

    Quaternion.prototype.normSquared = function(){
        return this.dot(this);
    };

    Quaternion.prototype.norm = function(){
        return Math.sqrt(this.normSquared());
    };

    Quaternion.prototype.isZero = function(){
        return !(this.x || this.y || this.z);
    };

    Quaternion.prototype.getMatrix = function(){
        var temp = this.normalize(1);
        var x = temp.x, y = temp.y, z = temp.z, w = temp.w;

        //LHC system flattened to column major = RHC flattened to row major
        return [
            1 - 2*y*y - 2*z*z,
                2*x*y - 2*z*w,
                2*x*z + 2*y*w,
            0,
                2*x*y + 2*z*w,
            1 - 2*x*x - 2*z*z,
                2*y*z - 2*x*w,
            0,
                2*x*z - 2*y*w,
                2*y*z + 2*x*w,
            1 - 2*x*x - 2*y*y,
            0,
            0,
            0,
            0,
            1
        ];
    };

    Quaternion.prototype.getMatrix3x3 = function(){
        var temp = this.normalize(1);
        var x = temp.x, y = temp.y, z = temp.z, w = temp.w;

        //LHC system flattened to row major
        return [
            [
                1 - 2*y*y - 2*z*z,
                    2*x*y + 2*z*w,
                    2*x*z - 2*y*w
            ],
            [
                    2*x*y - 2*z*w,
                1 - 2*x*x - 2*z*z,
                    2*y*z + 2*x*w
            ],
            [
                    2*x*z + 2*y*w,
                    2*y*z - 2*x*w,
                1 - 2*x*x - 2*y*y
            ]
        ];
    };

    var epsilon = 1e-5;
    Quaternion.prototype.slerp = function(q, t){
        var omega, cosomega, sinomega, scaleFrom, scaleTo;
        cosomega = this.dot(q);
        if( (1.0 - cosomega) > epsilon ){
            omega       = Math.acos(cosomega);
            sinomega    = Math.sin(omega);
            scaleFrom   = Math.sin( (1.0 - t) * omega ) / sinomega;
            scaleTo     = Math.sin( t * omega ) / sinomega;
        }
        else {
            scaleFrom   = 1.0 - t;
            scaleTo     = t;
        };
        return register.set(this.scalarMultiply(scaleFrom/scaleTo).add(q).multiply(scaleTo));
    };

    module.exports = Quaternion;

});
define('famous-color/Color',['require','exports','module','famous-utils/Utils'],function(require, exports, module) {
    var Utils = require('famous-utils/Utils');

    /**
     * @class Allows you to make the shown renderables behave like an accordion through 
     * the open and close methods.
     * @description
     * @name Color
     * @constructor
     * @example
     * 
     * define(function(require, exports, module) {
     *     var Engine = require('famous/Engine');
     *     var Surface = require('famous/Surface');
     *     var Color = require('famous-color/Color');
     *     var Context = Engine.createContext();
     *     
     *     var color = new Color(80, 255, 255);
     *     var hex = color.getHex();
     *     var surface    = new Surface({
     *         size: [300, 300],
     *         properties: {
     *             backgroundColor: hex
     *         }
     *     });
     *     Context.link(surface);
     *
     *     var toggle = true;
     *     surface.on('click', function(){
     *         if (toggle) {
     *             hex = color.setFromRGBA(255,0,0).getHex();
     *         } else {
     *             hex = color.setHue(60).getHex();
     *         }
     *         surface.setProperties({
     *             backgroundColor: hex
     *         })
     *         toggle = !toggle;
     *     });
     * });
     */
    function Color(r, g, b, a)
    {
        if(r instanceof Color)
        {
            this.r = r.r;
            this.g = r.g;
            this.b = r.b;
            this.a = r.a;
            this.hex = r.getHex();
        }
        else
        {
            this.r = (typeof r === 'undefined') ? 255 : r;
            this.g = (typeof g === 'undefined') ? 255 : g;
            this.b = (typeof b === 'undefined') ? 255 : b;
            this.a = (typeof a === 'undefined') ? 1.0 : a;
            this.hex = this.getHex();
        }
    }

    /**
     * Return the object's hue, calculated from its rgb value
     * 
     * @name Color#getHue
     * @function
     */
    Color.prototype.getHue = function()
    {
        var r = this.r/255.0;
        var g = this.g/255.0;
        var b = this.b/255.0;

        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        
        var h = 0.0;

        var d = max - min;

        switch(max)
        {
            case r:
            {
                h = (g - b) / d + (g < b ? 6 : 0);
            }
            break;

            case g:
            {
                h = (b - r) / d + 2;
            }
            break;
            
            case b:
            {
                h = (r - g) / d + 4;
            }
            break;
        }
        h *= 60;

        if(isNaN(h)) {
            h = 0;
        }
        return h;
    };

    /**
     * Return the object's saturation, calculated from its rgb value
     * 
     * @name Color#getSaturation
     * @function
     */
    Color.prototype.getSaturation = function()
    {
        var r = this.r/255.0;
        var g = this.g/255.0;
        var b = this.b/255.0;

        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        
        var s, l = (max + min) / 2;

        if(max == min)
        {
            h = s = 0;
        }
        else
        {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max){
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h *= 60;
        }
        return s*100;
    };
    
    /**
     * Return the object's brightness, calculated from its rgb value
     * 
     * @name Color#getBrightness
     * @function
     */
    Color.prototype.getBrightness = function()
    {
        var r = this.r/255.0;
        var g = this.g/255.0;
        var b = this.b/255.0;

        return Math.max(r, g, b) * 100.0;
    };

    /**
     * Return the object's lightness, calculated from its rgb value
     * 
     * @name Color#getBrightness
     * @function
     */
    Color.prototype.getLightness = function()
    {
        var r = this.r/255.0;
        var g = this.g/255.0;
        var b = this.b/255.0;
        return ((Math.max(r, g, b) + Math.min(r, g, b)) / 2.0)*100.0;
    };

    /**
     * Return the object's hexidecimal color value, calculated from its rgb value
     * 
     * @name Color#getHex
     * @function
     */
    Color.prototype.getHex = function()
    {
        function toHex(num) {
            var hex = num.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }

        return '#' + toHex(this.r) + toHex(this.g) + toHex(this.b);
    };

    /**
     * Return the object's hue, saturation, and lightness , calculated from its 
     *     rgb value
     * 
     * @name Color#getHSL
     * @function
     */
    Color.prototype.getHSL = function()
    {
        var r = this.r/255.0;
        var g = this.g/255.0;
        var b = this.b/255.0;

        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        
        var h, s, l = (max + min) / 2;

        if(max == min)
        {
            h = s = 0;
        }
        else
        {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max){
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h *= 60;
        }
        return [h, s*100, l*100];
    };

    function hue2rgb(p, q, t)
    {
        if(t < 0) t += 1;
        if(t > 1) t -= 1;
        if(t < 1/6) return p + (q - p) * 6 * t;
        if(t < 1/2) return q;
        if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    }

    /**
     * Set the object's rgb and hex value, calculated from its values for hue, 
     *     saturation, and lightness
     * 
     * @name Color#setFromHSL
     * @function
     */
    Color.prototype.setFromHSL = function hslToRgb(h, s, l)
    {
        h /=360.0;
        s /=100.0;
        l /=100.0;
        
        var r, g, b;

        if(s === 0)
        {
            r = g = b = l; // achromatic
        }
        else
        {
            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        this.r = Math.round(r * 255);
        this.g = Math.round(g * 255);
        this.b = Math.round(b * 255);
        this.hex = this.getHex();
        return this;
    };

    /**
     * Set the object's rgb and hex value, calculated from its hexidecimal color value
     * 
     * @name Color#setFromHex
     * @function
     */
    Color.prototype.setFromHex = function(hex)
    {
        hex = (hex.charAt(0) === '#') ? hex.substring(1, hex.length) : hex;

        if(hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }

        this.hex = '#' + hex;
        this.r = parseInt(hex.substring(0, 2), 16);
        this.g = parseInt(hex.substring(2, 4), 16);
        this.b = parseInt(hex.substring(4, 6), 16);

        return this;
    };
    
    /**
     * Resets the object's rgb value, its hex value, and optionally its alpha 
     *     value from passed in values
     * 
     * @name Color#setFromRGBA
     * @function
     */
    Color.prototype.setFromRGBA = function(r, g, b, a)
    {
        this.r = r;
        this.g = g;
        this.b = b;
        if(a) this.a = a;
        this.hex = this.getHex();
        return this;
    };
    
    /**
     * Resets the object's hue from passed in value
     * 
     * @name Color#setHue
     * @function
     */
    Color.prototype.setHue = function(h)
    {
        var hsl = this.getHSL();
        return this.setFromHSL(h, hsl[1], hsl[2]);
    };

    /**
     * Resets the object's saturation from passed in value
     * 
     * @name Color#setSaturation
     * @function
     */
    Color.prototype.setSaturation = function(s)
    {
        var hsl = this.getHSL();
        return this.setFromHSL(hsl[0], s, hsl[2]);
    };

    /**
     * Resets the object's lightness from passed in value
     * 
     * @name Color#setLightness
     * @function
     */
    Color.prototype.setLightness = function(l)
    {
        var hsl = this.getHSL();
        return this.setFromHSL(hsl[0], hsl[1], l);
    };

    /**
     * Gets CSS background color value by delegating to Utils method
     * 
     * @name Color#getCSSBackgroundColor
     * @function
     */
    Color.prototype.getCSSBackgroundColor = function()
    {
        return Utils.backgroundColor(this.r, this.b, this.g, this.a);
    };

    /**
     * Gets CSS color value by delegating to Utils method
     * 
     * @name Color#getCSSColor
     * @function
     */
    Color.prototype.getCSSColor = function()
    {
        return Utils.color(this.r, this.g, this.b, this.a);
    };

    /**
     * Duplicates the current object with identical rgb and hex values
     * 
     * @name Color#clone
     * @function
     */
    Color.prototype.clone = function()
    {
        return new Color(this.r, this.g, this.b, this.a);
    };

    /**
     * Returns normalized red, green, blue, and alpha values as an array
     * 
     * @name Color#toNormalizeColorArray
     * @function
     */
    Color.prototype.toNormalizeColorArray = function()
    {
        return [this.r/255.0, this.g/255.0, this.b/255.0, this.a];
    };

    /**
     * Returns new color object with hue, saturation, and lightness set based on
     *     a normalized scale between the current object's hsl and a second
     *     object's hsl. The value passed in determines the amount of
     *     hsl change, on a scale from 0 to 1.
     * 
     * @name Color#lerp
     * @function
     */
    Color.prototype.lerp = function(other, value)
    {
        var hsl1 = this.getHSL();
        var hsl2 = other.getHSL();

        var hue = hsl1[0]+(hsl2[0]-hsl1[0])*value;
        var sat = hsl1[1]+(hsl2[1]-hsl1[1])*value;
        var lgt = hsl1[2]+(hsl2[2]-hsl1[2])*value;

        var color = new Color();
        color.setFromHSL(hue, sat, lgt);
        return color;
    };

    module.exports = Color;
});

define('famous-animation/GenericAnimation',['require','exports','module','famous/Surface','famous/Matrix','famous-math/Vector','famous-math/Quaternion','./Animation','./AnimationEngine','./Easing','famous-utils/Utils','famous-color/Color'],function(require, exports, module) {
    var FamousSurface = require('famous/Surface');     
    var FM = require('famous/Matrix');   
    var Vector = require('famous-math/Vector');
    var Quaternion = require('famous-math/Quaternion');

    var Animation = require('./Animation'); 
    var AnimationEngine = require('./AnimationEngine');     
    var Easing = require('./Easing'); 
    var Utils = require('famous-utils/Utils'); 

    var Color = require('famous-color/Color'); 

    function GenericAnimation(options)
    {
        Animation.call(this, options);             
        this.surface = options.surface;                                      
        this.renderSurface = options.renderSurface || false; 

        this.easing = options.easing || Easing.inOutCubicNorm; 

        //Color
        this.animateColor = false;         
        this.startColor = options.startColor || new Color(255, 255, 255, 1.0); 
        this.endColor = options.endColor || new Color(255, 255, 255, 1.0);         

        this.startColorHSL = new Vector(); 
        this.endColorHSL = new Vector(); 
        this.deltaColorHSL = new Vector(); 
        this.currentColorHSL = new Vector(); 
        
        //Opacity
        this.animateOpacity = false; 
        this.startOpacity = options.startOpacity || 0.0; 
        this.endOpacity = options.endOpacity || 0.0; 
        this.deltaOpacity = 0.0;         

        //Position
        this.animatePosition = false; 
        this.startPosition = options.startPosition || (new Vector(0,0,0)).fromArray(FM.getTranslate(this.surface.mtx)); 
        this.endPosition = options.endPosition || (new Vector(0,0,0)).fromArray(FM.getTranslate(this.surface.mtx));
        this.currentPosition = new Vector(0,0,0); 
        this.deltaPosition = new Vector(0,0,0);      

        //Orientation
        this.animateOrientation = false; 
        this.startOrientation = options.startOrientation || new Quaternion(); 
        this.endOrientation = options.endOrientation || new Quaternion(); 
        this.currentOrientation = options.currentOrientation || new Quaternion(); 

        //Corner Radius
        this.animateRadius = false; 
        this.startRadius = options.startRadius || 0.0; 
        this.endRadius = options.endRadius || 0.0; 
        this.deltaRadius = 0.0; 
        this.currentRadius = 0.0;                 
    }

    GenericAnimation.prototype = Object.create(Animation.prototype);
    GenericAnimation.prototype.constructor = GenericAnimation;

    GenericAnimation.prototype.activate = function()
    {            
        //Color
        var hsl1 = this.startColor.getHSL();         
        var hsl2 = this.endColor.getHSL();         

        this.startColorHSL.setXYZ(hsl1[0], hsl1[1], hsl1[2]); 
        this.endColorHSL.setXYZ(hsl2[0], hsl2[1], hsl2[2]); 
        this.endColorHSL.sub(this.startColorHSL, this.deltaColorHSL); 
        this.currentColorHSL.set(this.startColorHSL); 

        if(this.startColor.r == this.endColor.r && this.startColor.g == this.endColor.g && this.startColor.b == this.endColor.b && this.startColor.a == this.endColor.a)
        {            
            this.animateColor = false; 

        }
        else
        {
            this.animateColor = true; 
        }

        //Opacity
        this.deltaOpacity = this.endOpacity - this.startOpacity; 
        if(Math.abs(this.deltaOpacity) > 0.0)
        {
            this.animateOpacity = true;            
        }
        else
        {
            this.animateOpacity = false; 
        }

        //Position
        this.endPosition.sub(this.startPosition, this.deltaPosition);         
        this.currentPosition.set(this.startPosition); 
        if(this.deltaPosition.isZero())
        {
            this.animatePosition = false; 
        }
        else
        {
            this.animatePosition = true;             
        }

        //Orientation
        if(this.startOrientation.isEqual(this.endOrientation))
        {
            this.animateOrientation = false;            
        }
        else
        {
            this.animateOrientation = true;
        }

        //Radius
        this.deltaRadius = this.endRadius - this.startRadius; 
        this.currentRadius = this.startRadius; 
        if(this.deltaRadius === 0)
        {
            this.animateRadius = false; 
        }
        else
        {
            this.animateRadius = true;  
        }
    };

    GenericAnimation.prototype.tick = function()
    {
        if(this.playing && !this.halted)
        {
            this.currentTime = this.engine.getTime() - this.startTime;         
            this.normalizedTime = this.currentTime / this.duration;                         
            if(this.normalizedTime > 1.0)
            {                            
                this.normalizedTime = Utils.clamp(this.normalizedTime, 0.0, 1.0);                                   
                this._update(); 
                this.update(); 
                this.end();     
                return;         
            }
            if(this.normalizedTime > 0.000001)
            {                
                if(!this.activated)
                {
                    this.activate(); 
                    if(this.activateCallback !== undefined)
                    {
                        this.activateCallback(); 
                    }
                    this.activated = true; 
                }

                if(this.reverse)
                {
                    this.normalizedTime = 1.0 - this.normalizedTime; 
                }                
                this._update();                                
                this.update();              
            }                                                
        }
    };

    GenericAnimation.prototype._update = function() //Customize this
    {                     
        var value = this.easing(this.normalizedTime); 
        //Color
        if(this.animateColor)
        {
            this.deltaColorHSL.mult(value, this.currentColorHSL); 
            this.currentColorHSL.add(this.startColorHSL, this.currentColorHSL);         
            
            this.surface.setProperties(
                Utils.backgroundColorHSL(
                    this.currentColorHSL.x,
                    this.currentColorHSL.y, 
                    this.currentColorHSL.z,
                    1.0)
                );         
        }

        //Opacity
        if(this.animateOpacity)
        {
            this.surface.opacity = this.startOpacity + this.deltaOpacity*value; 
        }        

        //Position
        if(this.animatePosition || this.animateOrientation)
        {
            this.deltaPosition.mult(value, this.currentPosition);
            this.currentPosition.add(this.startPosition, this.currentPosition);         
            this.startOrientation.slerp(this.endOrientation, value, this.currentOrientation);                                            
            this.surface.mtx = FM.move(this.currentOrientation.getMatrix(), this.currentPosition.toArray());                 
        }


        //Radius
        if(this.animateRadius)
        {
            this.currentRadius = this.startRadius + this.deltaRadius*value; 
            this.surface.setProperties(Utils.borderRadius(this.currentRadius));     
            // var size = this.surface.getSize(); 
            // this.surface.setProperties(Utils.clipCircle(size[0]*.5, size[1]*.5, size[0]-this.currentRadius));            
        }
    };

    GenericAnimation.prototype.render = function() //Customize this
    {       
        if(this.renderSurface && !this.dead && this.normalizedTime > 0.0)
        {        
            return {            
                transform: this.surface.mtx, 
                opacity: this.surface.opacity,                         
                target: this.surface.render()
            }; 
        }        
    };

    GenericAnimation.prototype.setStartColor = function(c)
    {
        this.startColor = c;         
    };

    GenericAnimation.prototype.setEndColor = function(c)
    {
        this.endColor = c;       
    };

    GenericAnimation.prototype.getStartColor = function()
    {
        return this.startColor; 
    };

    GenericAnimation.prototype.getEndColor = function()
    {
        return this.endColor; 
    };

    GenericAnimation.prototype.setStartPosition = function(p)
    {
        this.startPosition = p;     
    };    

    GenericAnimation.prototype.setStartPositionX = function(x)
    {
        this.startPosition.x = x;     
    };    

    GenericAnimation.prototype.setStartPositionY = function(y)
    {
        this.startPosition.y = y;
    };    

    GenericAnimation.prototype.setStartPositionZ = function(z)
    {
        this.startPosition.z = z; 
    };    

    GenericAnimation.prototype.setEndPosition = function(p)
    {
        this.endPosition = p; 
    };

    GenericAnimation.prototype.setEndPositionX = function(x)
    {
        this.endPosition.setX(x); 
    };

    GenericAnimation.prototype.setEndPositionY = function(y)
    {
        this.endPosition.setY(y);         
    };

    GenericAnimation.prototype.setEndPositionZ = function(z)
    {
        this.endPosition.setZ(z);         
    };

    GenericAnimation.prototype.getEndPosition = function()
    {
        return this.endPosition; 
    };

    GenericAnimation.prototype.getStartPosition = function()
    {
        return this.startPosition; 
    };

    GenericAnimation.prototype.getCurrentPosition = function()
    {
        return this.currentPosition; 
    };

    GenericAnimation.prototype.setStartOpacity = function(o)
    {
        this.startOpacity = o; 
    };

    GenericAnimation.prototype.setEndOpacity = function(o)
    {
        this.endOpacity = o;
    };

    GenericAnimation.prototype.getStartOpacity = function()
    {
        return this.startOpacity;
    };

    GenericAnimation.prototype.getEndOpacity = function()
    {
        return this.endOpacity; 
    };

    GenericAnimation.prototype.setStartRadius = function(r)
    {        
        this.startRadius = r; 
    };

    GenericAnimation.prototype.setEndRadius = function(r)
    {
        this.endRadius = r; 
    };

    GenericAnimation.prototype.getCurrentRadius = function()
    {
        return this.currentRadius; 
    };

    GenericAnimation.prototype.getStartRadius = function(r)
    {
        return this.startRadius;
    };

    GenericAnimation.prototype.getEndRadius = function(r)
    {
        return this.endRadius; 
    };

    GenericAnimation.prototype.setStartOrientation = function(o)
    {
        this.startOrientation = o;     
    };

    GenericAnimation.prototype.setEndOrientation = function(o)
    {
        this.endOrientation = o; 
    };

    GenericAnimation.prototype.getEndOrientation = function()
    {
        return this.endOrientation; 
    };

    GenericAnimation.prototype.getStartOrientation = function()
    {
        return this.startOrientation; 
    };

    GenericAnimation.prototype.setEasing = function(easing)
    {
        this.easing = easing; 
    };

    GenericAnimation.prototype.setSurface = function(surface)
    {
        this.surface = surface; 
    };

    GenericAnimation.prototype.setEndValuesToStartValues = function()
    {
        this.startColor = this.endColor.clone(); 
        this.startOpacity = this.endOpacity;         
        this.startPosition.set(this.endPosition);         
        this.startOrientation.set(this.endOrientation); 
        this.startRadius = this.endRadius; 
    };

    module.exports = GenericAnimation;
});
define('famous-animation/Idle',['require','exports','module'],function(require, exports, module) {

    /**
    * @constructor
    */
    function FamousIdle(idleFn, timeout) {
        this.idleFn = idleFn;
        this.timeout = timeout;
        this.enabled = timeout > 0;
        
        this.reset();
    };

    FamousIdle.prototype.timeoutIn = function(delay) {
        this.lastTouchTime = (new Date()).getTime() - this.timeout + delay;
    };
    
    FamousIdle.prototype.enable = function() {
        this.enabled = true;
    };
    
    FamousIdle.prototype.disable = function() {
        this.enabled = false;
    };
    
    FamousIdle.prototype.setIdleFunction = function(idleFn) {
        this.idleFn = idleFn;
    };
    
    FamousIdle.prototype.update = function() {
        if(this.idling || !this.enabled || !this.idleFn) return;
        var currTime = (new Date()).getTime();
        if(currTime - this.lastTouchTime > this.timeout) {
            this.idling = true;
            this.idleFn.call(this);
        }
    };
    
    FamousIdle.prototype.isIdling = function() {
        return this.idling;
    };
    
    FamousIdle.prototype.reset = function() {
        this.lastTouchTime = (new Date()).getTime();
        this.idling = false;
    };
    
    FamousIdle.prototype.emit = function(type, event) {
        this.reset();
    };

    module.exports = FamousIdle;
});

define('famous-animation/PiecewiseCubicBezier',['require','exports','module','./CubicBezier'],function(require, exports, module) {

    var cubicBezier = require('./CubicBezier');

    function FamousPiecewiseCubicBezier(options) {

        options = options || {};
        this.split = options.split || .5;
        var overshoot = options.overshoot || 0;

        var vLeft = options.vLeft || [0, 1+overshoot, 0, 0];
        var vRight = options.vRight || [1+overshoot, 1, 0, 0];

        this.bezLeft =  new cubicBezier(vLeft).create();
        this.bezRight = new cubicBezier(vRight).create();

    };

    FamousPiecewiseCubicBezier.prototype.create = function() {
        var self = this;
        return function(t) {
            t = t || 0;
            var tNew;
            var split = self.split;

            if (t < split){
                tNew = t / split;
                return self.bezLeft(tNew);
            }
            else{
                tNew = (t - split) / (1 - split);
                return self.bezRight(tNew);
            }
        };
    };

    module.exports = FamousPiecewiseCubicBezier;

});

define('famous-animation/RegisterEasing',['require','exports','module','./Easing','famous/TweenTransition'],function(require, exports, module) {
    var Easing = require('./Easing');
    var TweenTransition = require('famous/TweenTransition');

    function getAvailableTransitionCurves() { 
        var normRe = /norm/gi;
        var keys = getKeys(Easing).filter(function(key){ return normRe.test(key); }).sort();
        var curves = {};
        for (var i = 0; i < keys.length; i++) {
            curves[keys[i]] = (Easing[keys[i]]);
        };
        return curves;
    }

    function getKeys(obj){
        var keys = [];
        for (key in obj) {
            if (obj.hasOwnProperty(key)){
                keys.push(key);
            }
        }
        return keys;
    };

    function registerKeys () {
        var curves = getAvailableTransitionCurves();
        for ( var key in curves ) {
            TweenTransition.registerCurve( key, curves[key] )
        };  
    }

    registerKeys();

});

define('famous-animation/Sequence',['require','exports','module'],function(require, exports, module) {
    /**
     * @constructor
     */
    function FamousSequence() {
        this.startTime = 0;
        this.setupPos = 0;
        this.schedule = [];
        this.seqLoc = -1;
    }

    FamousSequence.prototype._execute = function(pos) {
        if(this.seqLoc < 0) this.seqLoc = 0;
        while(this.seqLoc < this.schedule.length && this.schedule[this.seqLoc].pos <= pos) {
            this.schedule[this.seqLoc].action.call(this);
            this.seqLoc++;
        }
    };
    
    FamousSequence.prototype.update = function() {
        if(this.seqLoc < 0 || this.seqLoc >= this.schedule.length) return;

        var currPos = (new Date()).getTime() - this.startTime;
        this._execute(currPos);
    };
    
    FamousSequence.prototype.at = function(pos, action) {
        this.schedule.push({pos: pos, action: action});
        this.setupPos = pos;
    };
    
    FamousSequence.prototype.after = function(delay, action) {
        this.at(this.setupPos + delay, action);
    };
    
    FamousSequence.prototype.play = function(pos) {
        this.schedule.sort(function(a, b) { return a.pos - b.pos; });
        this.startTime = (new Date()).getTime();
        
        var seqLoc = 0;
        while(seqLoc < this.schedule.length && this.schedule[seqLoc].pos < pos) seqLoc++;
        this.seqLoc = seqLoc;
    };
    
    FamousSequence.prototype.fastForward = function(pos) {
        if(typeof pos == 'undefined') pos = Infinity;
        this._execute(pos);
    };
    
    FamousSequence.prototype.stop = function() {
        this.seqLoc = -1;
    };

    module.exports = FamousSequence;
});

define('famous-color/ColorPalette',['require','exports','module','./Color'],function(require, exports, module) {
    var Color = require('./Color');

    /**
     * @class Stores color objects as a group and provides helper methods for accessing
     *        colors and comparing their values.
     * @description
     * @name Color
     * @constructor
     */
    function ColorPalette(colors)
    {
        this.colors = colors;
    }

    ColorPalette.prototype.getColor = function(index)
    {
        return this.colors[index%this.colors.length];
    };

    ColorPalette.prototype.getCSS = function ( index ) {
        return this.getColor( index ).getCSSColor();
    };

    
    ColorPalette.prototype.getLighestColor = function()
    {
        var lightestValue = 0,
            lightestRef;

        for (var i = 0; i < this.colors.length; i++) {
            var light = this.colors[i].getLightness();
            if(light > lightestValue) { 
                lightestRef = this.colors[i];
                lightestValue = light;
            }
        };

        return lightestRef;
    };

    ColorPalette.prototype.getDarkestColor = function()
    {
        var darkestValue = 100,
            darkestRef;

        for (var i = 0; i < this.colors.length; i++) {
            var dark = this.colors[i].getLightness();
            if( dark < darkestValue ) { 
                darkestRef = this.colors[i];
                darkestValue = dark;
            }
        };

        return darkestRef;
    };

    ColorPalette.prototype.getCount = function()
    {
        return this.colors.length; 
    };

    module.exports = ColorPalette;
});

define('famous-color/ColorPalettes',['require','exports','module','./Color','./ColorPalette'],function(require, exports, module) {
    var Color = require('./Color'); 
    var ColorPalette = require('./ColorPalette'); 

    /**
     * @class Stores multiple palettes in a collection and provides methods for
     *        accessing, adding, and retrieving a random palette from a pre-set
     *        collection.
     * @description
     * @name ColorPalettes
     * @constructor
     */
    var rawPalettes = [
        [[53,92,125,1], [108,91,123,1], [192,108,132,1], [246,114,128,1], [248,177,149,1]],
        [[27,21,33,1], [181,172,1,1], [212,30,69,1], [232,110,28,1], [236,186,9,1]],
        [[63,54,42,1], [231,69,13,1], [250,157,4,1], [251,222,3,1], [254,245,150,1]],
        [[10,103,137,1], [10,153,111,1], [207,6,56,1], [250,102,50,1], [254,205,35,1]],
        [[157,85,105,1], [192,227,217,1], [202,55,99,1], [227,237,195,1], [235,113,84,1]],
        [[110,110,110,1], [145,217,255,1], [237,255,135,1], [255,133,167,1], [255,255,255,1]],
        [[0,0,0,1], [25,26,36,1], [51,44,44,1], [250,101,87,1], [255,255,255,1]],
        [[27,103,107,1], [81,149,72,1], [136,196,37,1], [190,242,2,1], [234,253,230,1]],
        [[31,11,12,1], [48,5,17,1], [179,84,79,1], [214,195,150,1], [231,252,207,1]],
        [[172,248,248,1], [223,235,24,1], [230,95,95,1], [235,54,24,1], [235,207,24,1]],
        [[196,182,109,1], [213,39,5,1], [240,211,119,1], [243,232,228,1], [247,109,60,1]],
        [[11,72,107,1], [59,134,134,1], [121,189,154,1], [168,219,168,1], [207,240,158,1]],
        [[0,188,209,1], [118,211,222,1], [174,232,251,1], [176,248,255,1], [254,249,240,1]],
        [[85,73,57,1], [112,108,77,1], [241,230,143,1], [255,100,100,1], [255,151,111,1]],
        [[36,244,161,1], [178,42,58,1], [199,244,36,1], [244,36,182,1], [249,246,49,1]],
        [[108,144,134,1], [169,204,24,1], [207,73,108,1], [235,234,188,1], [252,84,99,1]],
        [[78,79,75,1], [130,35,57,1], [247,62,62,1], [255,119,61,1], [255,213,115,1]],
        [[121,28,49,1], [145,213,152,1], [191,178,64,1], [202,51,68,1], [237,126,80,1]],
        [[104,73,83,1], [127,191,151,1], [182,219,145,1], [250,107,41,1], [253,158,41,1]],
        [[0,203,231,1], [0,218,60,1], [223,21,26,1], [244,243,40,1], [253,134,3,1]],
        [[56,222,231,1], [232,255,0,1], [254,62,71,1], [255,130,0,1]],
        [[27,32,38,1], [75,89,107,1], [153,228,255,1], [247,79,79,1], [255,59,59,1]],
        [[0,0,0,1], [0,173,239,1], [236,0,140,1], [255,242,0,1]],
        [[47,43,173,1], [173,43,173,1], [228,38,146,1], [247,21,104,1], [247,219,21,1]],
        [[101,150,158,1], [171,20,44,1], [189,219,222,1], [205,212,108,1], [219,217,210,1]],
        [[97,24,36,1], [193,47,42,1], [247,255,238,1], [254,222,123,1], [255,101,64,1]],
        [[118,85,66,1], [124,231,163,1], [220,93,110,1], [255,174,60,1], [255,229,156,1]],
        [[63,184,175,1], [127,199,175,1], [218,216,167,1], [255,61,127,1], [255,158,157,1]],
        [[217,251,223,1], [219,255,210,1], [231,254,235,1], [234,255,210,1], [243,255,210,1]],
        [[0,23,42,1], [27,139,163,1], [94,202,214,1], [178,222,249,1], [206,254,255,1]],
        [[225,245,196,1], [237,229,116,1], [249,212,35,1], [252,145,58,1], [255,78,80,1]],
        [[7,9,61,1], [11,16,140,1], [12,15,102,1], [14,78,173,1], [16,127,201,1]],
        [[5,177,240,1], [5,232,240,1], [94,87,230,1], [230,87,149,1], [255,5,113,1]],
        [[48,0,24,1], [90,61,49,1], [131,123,71,1], [173,184,95,1], [229,237,184,1]],
        [[111,191,162,1], [191,184,174,1], [242,199,119,1], [242,230,194,1], [255,255,255,1]],
        [[22,147,165,1], [69,181,196,1], [126,206,202,1], [160,222,214,1], [199,237,232,1]],
        [[8,26,48,1], [50,64,90,1], [59,100,128,1], [155,153,130,1], [255,134,17,1]],
        [[74,186,176,1], [152,33,0,1], [255,211,0,1], [255,245,158,1]],
        [[42,135,50,1], [49,48,66,1], [107,85,48,1], [255,109,36,1], [255,235,107,1]],
        [[0,0,0,1], [25,134,219,1], [105,172,224,1], [149,199,24,1], [184,212,40,1]],
        [[64,0,20,1], [127,0,40,1], [191,0,59,1], [229,0,71,1], [255,0,79,1]],
        [[56,69,59,1], [78,133,136,1], [255,70,84,1], [255,213,106,1], [255,254,211,1]],
        [[29,44,143,1], [57,179,162,1], [209,146,191,1], [222,75,107,1], [252,180,121,1]],
        [[14,36,48,1], [232,213,183,1], [232,213,185,1], [245,179,73,1], [252,58,81,1]],
        [[0,210,255,1], [222,255,0,1], [255,0,168,1], [255,66,0,1]],
        [[21,99,105,1], [51,53,84,1], [169,186,181,1], [216,69,148,1], [236,196,89,1]],
        [[105,210,231,1], [167,219,216,1], [224,228,204,1], [243,134,48,1], [250,105,0,1]],
        [[122,106,83,1], [148,140,117,1], [153,178,183,1], [213,222,217,1], [217,206,178,1]],
        [[34,104,136,1], [57,142,182,1], [255,162,0,1], [255,214,0,1], [255,245,0,1]],
        [[2,100,117,1], [194,163,79,1], [251,184,41,1], [254,251,175,1], [255,229,69,1]],
        [[214,37,77,1], [246,215,107,1], [253,235,169,1], [255,84,117,1], [255,144,54,1]],
        [[0,0,0,1], [124,180,144,1], [211,25,0,1], [255,102,0,1], [255,242,175,1]],
        [[35,116,222,1], [38,38,38,1], [87,54,255,1], [231,255,54,1], [255,54,111,1]],
        [[64,18,44,1], [89,186,169,1], [101,98,115,1], [216,241,113,1], [252,255,217,1]],
        [[126,148,158,1], [174,194,171,1], [235,206,160,1], [252,119,101,1], [255,51,95,1]],
        [[75,73,11,1], [117,116,73,1], [226,223,154,1], [235,229,77,1], [255,0,81,1]],
        [[159,112,69,1], [183,98,5,1], [208,167,124,1], [253,169,43,1], [254,238,171,1]],
        [[38,37,28,1], [160,232,183,1], [235,10,68,1], [242,100,61,1], [242,167,61,1]],
        [[0,0,0,1], [67,110,217,1], [120,0,0,1], [216,216,216,1], [240,24,0,1]],
        [[51,51,51,1], [131,163,0,1], [158,12,57,1], [226,27,90,1], [251,255,227,1]],
        [[79,156,52,1], [108,186,85,1], [125,210,89,1], [158,228,70,1], [187,255,133,1]],
        [[0,44,43,1], [7,100,97,1], [10,131,127,1], [255,61,0,1], [255,188,17,1]],
        [[149,207,183,1], [240,65,85,1], [242,242,111,1], [255,130,58,1], [255,247,189,1]],
        [[89,168,15,1], [158,213,76,1], [196,237,104,1], [226,255,158,1], [240,242,221,1]],
        [[54,42,44,1], [189,223,38,1], [237,38,105,1], [238,189,97,1], [252,84,99,1]],
        [[11,246,147,1], [38,137,233,1], [233,26,157,1], [246,182,11,1], [246,242,11,1]],
        [[8,0,9,1], [65,242,221,1], [207,242,65,1], [249,44,130,1], [252,241,30,1]],
        [[198,164,154,1], [198,229,217,1], [214,129,137,1], [233,78,119,1], [244,234,213,1]],
        [[6,71,128,1], [8,84,199,1], [160,194,222,1], [205,239,255,1], [237,237,244,1]],
        [[93,66,63,1], [124,87,83,1], [238,128,117,1], [255,177,169,1], [255,233,231,1]],
        [[59,129,131,1], [237,48,60,1], [245,99,74,1], [250,208,137,1], [255,156,91,1]],
        [[56,166,155,1], [104,191,101,1], [204,217,106,1], [242,88,53,1], [242,218,94,1]],
        [[60,197,234,1], [70,70,70,1], [233,234,60,1], [246,246,246,1]],
        [[97,99,130,1], [102,36,91,1], [105,165,164,1], [168,196,162,1], [229,234,164,1]],
        [[10,191,188,1], [19,116,125,1], [41,34,31,1], [252,53,76,1], [252,247,197,1]],
        [[7,0,4,1], [236,67,8,1], [252,129,10,1], [255,172,35,1], [255,251,214,1]],
        [[0,5,1,1], [8,138,19,1], [237,20,9,1], [240,249,241,1], [247,249,21,1]],
        [[64,197,132,1], [131,218,232,1], [170,46,154,1], [251,35,137,1], [251,132,137,1]],
        [[64,47,58,1], [217,119,119,1], [255,198,158,1], [255,219,196,1]],
        [[243,96,49,1], [249,236,95,1], [255,102,0,1], [255,153,0,1], [255,204,0,1]],
        [[33,90,109,1], [45,45,41,1], [60,162,162,1], [146,199,163,1], [223,236,230,1]],
        [[10,42,63,1], [101,147,160,1], [185,204,184,1], [219,21,34,1], [255,239,167,1]],
        [[0,160,176,1], [106,74,60,1], [204,51,63,1], [235,104,65,1], [237,201,81,1]],
        [[14,141,148,1], [67,77,83,1], [114,173,117,1], [233,213,88,1], [255,171,7,1]],
        [[94,159,163,1], [176,85,116,1], [220,209,180,1], [248,126,123,1], [250,184,127,1]],
        [[31,31,31,1], [122,91,62,1], [205,189,174,1], [250,75,0,1], [250,250,250,1]],
        [[176,230,41,1], [180,35,16,1], [247,207,10,1], [250,124,7,1], [252,231,13,1]],
        [[94,65,47,1], [120,192,168,1], [240,120,24,1], [240,168,48,1], [252,235,182,1]],
        [[31,26,28,1], [98,128,125,1], [134,158,138,1], [201,107,30,1], [209,205,178,1]],
        [[40,60,0,1], [100,153,125,1], [237,143,69,1], [241,169,48,1], [254,204,109,1]],
        [[37,2,15,1], [143,143,143,1], [158,30,76,1], [236,236,236,1], [255,17,104,1]],
        [[207,108,116,1], [244,93,120,1], [255,112,136,1], [255,130,153,1], [255,187,193,1]],
        [[0,0,0,1], [12,13,5,1], [168,171,132,1], [198,201,157,1], [231,235,176,1]],
        [[0,170,255,1], [170,0,255,1], [170,255,0,1], [255,0,170,1], [255,170,0,1]],
        [[78,150,137,1], [126,208,214,1], [135,214,155,1], [195,255,104,1], [244,252,232,1]],
        [[10,10,10,1], [227,246,255,1], [255,20,87,1], [255,216,125,1]],
        [[51,51,153,1], [102,153,204,1], [153,204,255,1], [255,0,51,1], [255,204,0,1]],
        [[23,22,92,1], [190,191,158,1], [216,210,153,1], [229,228,218,1], [245,224,56,1]],
        [[49,99,64,1], [96,158,77,1], [159,252,88,1], [195,252,88,1], [242,252,88,1]],
        [[92,88,99,1], [168,81,99,1], [180,222,193,1], [207,255,221,1], [255,31,76,1]],
        [[61,67,7,1], [161,253,17,1], [225,244,56,1], [244,251,196,1], [255,208,79,1]],
        [[0,205,172,1], [2,170,176,1], [22,147,165,1], [127,255,36,1], [195,255,104,1]],
        [[0,203,231,1], [0,218,60,1], [223,21,26,1], [244,243,40,1], [253,134,3,1]],
        [[34,104,136,1], [57,142,182,1], [255,162,0,1], [255,214,0,1], [255,245,0,1]],
        [[3,13,79,1], [206,236,239,1], [231,237,234,1], [251,12,6,1], [255,197,44,1]],
        [[253,255,0,1], [255,0,0,1], [255,90,0,1], [255,114,0,1], [255,167,0,1]],
        [[108,66,18,1], [179,0,176,1], [183,255,55,1], [255,124,69,1], [255,234,155,1]],
        [[0,4,49,1], [59,69,58,1], [90,224,151,1], [204,46,9,1], [255,253,202,1]],
        [[59,45,56,1], [188,189,172,1], [207,190,39,1], [240,36,117,1], [242,116,53,1]],
        [[101,145,155,1], [120,185,168,1], [168,212,148,1], [242,177,73,1], [244,229,97,1]],
        [[0,193,118,1], [136,193,0,1], [250,190,40,1], [255,0,60,1], [255,138,0,1]],
        [[110,37,63,1], [165,199,185,1], [199,94,106,1], [241,245,244,1], [251,236,236,1]],
        [[39,112,140,1], [111,191,162,1], [190,191,149,1], [227,208,116,1], [255,180,115,1]],
        [[62,72,76,1], [82,91,96,1], [105,158,81,1], [131,178,107,1], [242,232,97,1]],
        [[248,135,46,1], [252,88,12,1], [252,107,10,1], [253,202,73,1], [255,169,39,1]],
        [[83,119,122,1], [84,36,55,1], [192,41,66,1], [217,91,67,1], [236,208,120,1]],
        [[41,136,140,1], [54,19,0,1], [162,121,15,1], [188,53,33,1], [255,208,130,1]],
        [[10,186,181,1], [58,203,199,1], [106,219,216,1], [153,236,234,1], [201,252,251,1]],
        [[8,158,42,1], [9,42,100,1], [90,204,191,1], [229,4,4,1], [251,235,175,1]],
        [[187,187,136,1], [204,198,141,1], [238,170,136,1], [238,194,144,1], [238,221,153,1]],
        [[121,219,204,1], [134,78,65,1], [234,169,167,1], [242,199,196,1], [248,245,226,1]],
        [[96,136,213,1], [114,170,222,1], [157,200,233,1], [192,222,245,1], [217,239,244,1]],
        [[30,30,30,1], [177,255,0,1], [209,210,212,1], [242,240,240,1]],
        [[255,102,0,1], [255,153,0,1], [255,204,0,1], [255,255,204,1], [255,255,255,1]],
        [[35,15,43,1], [130,179,174,1], [188,227,197,1], [235,235,188,1], [242,29,65,1]],
        [[212,238,94,1], [225,237,185,1], [240,242,235,1], [244,250,210,1], [255,66,66,1]],
        [[20,32,71,1], [168,95,59,1], [247,92,92,1], [255,255,255,1]],
        [[63,184,240,1], [80,208,240,1], [196,251,93,1], [224,240,240,1], [236,255,224,1]],
        [[185,222,81,1], [209,227,137,1], [224,72,145,1], [225,183,237,1], [245,225,226,1]],
        [[185,222,81,1], [209,227,137,1], [224,72,145,1], [225,183,237,1], [245,225,226,1]],
        [[17,68,34,1], [51,170,170,1], [51,221,51,1], [221,238,68,1], [221,238,187,1]],
        [[46,13,35,1], [245,72,40,1], [247,128,60,1], [248,228,193,1], [255,237,191,1]],
        [[204,243,144,1], [224,224,90,1], [247,196,31,1], [252,147,10,1], [255,0,61,1]],
        [[18,18,18,1], [255,89,56,1], [255,255,255,1]],
        [[53,38,48,1], [85,72,101,1], [205,91,81,1], [233,223,204,1], [243,163,107,1]],
        [[236,250,1,1], [236,250,2,1], [247,220,2,1], [248,227,113,1], [250,173,9,1]],
        [[77,129,121,1], [161,129,121,1], [236,85,101,1], [249,220,159,1], [254,157,93,1]],
        [[4,0,4,1], [65,61,61,1], [75,0,15,1], [200,255,0,1], [250,2,60,1]],
        [[66,50,56,1], [179,112,45,1], [200,209,151,1], [235,33,56,1], [245,222,140,1]],
        [[143,153,36,1], [172,201,95,1], [241,57,109,1], [243,255,235,1], [253,96,129,1]],
        [[18,18,18,1], [23,122,135,1], [250,245,240,1], [255,180,143,1]],
        [[67,197,210,1], [182,108,97,1], [241,155,140,1], [254,247,237,1], [255,234,215,1]],
        [[78,205,196,1], [85,98,112,1], [196,77,88,1], [199,244,100,1], [255,107,107,1]],
        [[0,0,0,1], [137,161,160,1], [154,227,226,1], [255,71,103,1], [255,118,5,1]],
        [[248,200,221,1], [253,231,120,1], [255,61,61,1], [255,92,143,1], [255,103,65,1]],
        [[23,138,132,1], [145,145,145,1], [229,255,125,1], [235,143,172,1], [255,255,255,1]],
        [[73,112,138,1], [136,171,194,1], [202,255,66,1], [208,224,235,1], [235,247,248,1]],
        [[51,222,245,1], [122,245,51,1], [245,51,145,1], [245,161,52,1], [248,248,101,1]],
        [[57,13,45,1], [172,222,178,1], [225,234,181,1], [237,173,158,1], [254,75,116,1]],
        [[192,107,129,1], [233,22,67,1], [245,175,145,1], [247,201,182,1], [249,210,182,1]],
        [[131,196,192,1], [156,100,53,1], [190,215,62,1], [237,66,98,1], [240,233,226,1]],
        [[136,145,136,1], [191,218,223,1], [207,246,247,1], [233,26,82,1], [237,242,210,1]],
        [[64,44,56,1], [209,212,169,1], [227,164,129,1], [245,215,165,1], [255,111,121,1]],
        [[93,65,87,1], [131,134,137,1], [168,202,186,1], [202,215,178,1], [235,227,170,1]],
        [[0,168,198,1], [64,192,203,1], [143,190,0,1], [174,226,57,1], [249,242,231,1]],
        [[0,204,190,1], [9,166,163,1], [157,191,175,1], [237,235,201,1], [252,249,216,1]],
        [[0,205,172,1], [2,170,176,1], [22,147,165,1], [127,255,36,1], [195,255,104,1]],
        [[51,39,23,1], [107,172,191,1], [157,188,188,1], [240,240,175,1], [255,55,15,1]],
        [[51,51,53,1], [101,99,106,1], [139,135,149,1], [193,190,200,1], [233,232,238,1]],
        [[17,118,109,1], [65,9,54,1], [164,11,84,1], [228,111,10,1], [240,179,0,1]],
        [[73,10,61,1], [138,155,15,1], [189,21,80,1], [233,127,2,1], [248,202,0,1]],
        [[71,162,145,1], [144,79,135,1], [213,28,122,1], [219,213,139,1], [244,127,143,1]],
        [[55,191,230,1], [169,232,250,1], [186,255,21,1], [211,255,106,1], [247,239,236,1]],
        [[69,173,168,1], [84,121,128,1], [89,79,79,1], [157,224,173,1], [229,252,194,1]],
        [[248,241,224,1], [249,246,241,1], [250,244,227,1], [251,106,79,1], [255,193,150,1]],
        [[0,98,125,1], [1,64,87,1], [51,50,49,1], [66,153,15,1], [255,255,255,1]],
        [[52,17,57,1], [53,150,104,1], [60,50,81,1], [168,212,111,1], [255,237,144,1]],
        [[0,153,137,1], [163,169,72,1], [206,24,54,1], [237,185,46,1], [248,89,49,1]],
        [[26,31,30,1], [108,189,181,1], [147,204,198,1], [200,214,191,1], [227,223,186,1]],
        [[165,222,190,1], [183,234,201,1], [251,178,163,1], [252,37,55,1], [255,215,183,1]],
        [[26,20,14,1], [90,142,161,1], [204,65,65,1], [255,255,255,1]],
        [[51,51,51,1], [111,111,111,1], [204,204,204,1], [255,100,0,1], [255,255,255,1]],
        [[51,145,148,1], [167,2,103,1], [241,12,73,1], [246,216,107,1], [251,107,65,1]],
        [[31,3,51,1], [31,57,77,1], [39,130,92,1], [112,179,112,1], [171,204,120,1]],
        [[209,242,165,1], [239,250,180,1], [245,105,145,1], [255,159,128,1], [255,196,140,1]],
        [[60,54,79,1], [109,124,157,1], [124,144,179,1], [149,181,194,1], [185,224,220,1]],
        [[35,179,218,1], [153,214,241,1], [168,153,241,1], [208,89,218,1], [248,78,150,1]],
        [[85,66,54,1], [96,185,154,1], [211,206,61,1], [241,239,165,1], [247,120,37,1]],
        [[20,20,20,1], [177,198,204,1], [255,239,94,1], [255,255,255,1]],
        [[136,238,208,1], [202,224,129,1], [239,67,53,1], [242,205,79,1], [246,139,54,1]],
        [[53,38,29,1], [95,79,69,1], [151,123,105,1], [206,173,142,1], [253,115,26,1]],
        [[68,66,89,1], [159,189,166,1], [219,101,68,1], [240,145,67,1], [252,177,71,1]],
        [[191,208,0,1], [196,60,39,1], [233,60,31,1], [242,83,58,1], [242,240,235,1]],
        [[43,43,43,1], [53,54,52,1], [230,50,75,1], [242,227,198,1], [255,198,165,1]],      
        [[23,20,38,1], [26,15,12,1], [207,207,207,1], [240,240,240,1], [255,77,148,1]],
        [[28,1,19,1], [107,1,3,1], [163,0,6,1], [194,26,1,1], [240,60,2,1]],
        [[10,10,10,1], [140,97,70,1], [214,179,156,1], [242,76,61,1], [255,255,255,1]],
        [[46,13,35,1], [245,72,40,1], [247,128,60,1], [248,228,193,1], [255,237,191,1]],
        [[0,62,95,1], [0,67,132,1], [22,147,165,1], [150,207,234,1], [247,249,114,1]],
        [[66,29,56,1], [87,0,69,1], [190,226,232,1], [205,255,24,1], [255,8,90,1]],
        [[47,59,97,1], [121,128,146,1], [187,235,185,1], [233,236,229,1], [255,103,89,1]],
        [[58,17,28,1], [87,73,81,1], [131,152,142,1], [188,222,165,1], [230,249,188,1]],
        [[147,193,196,1], [198,182,204,1], [242,202,174,1], [250,12,195,1], [255,123,15,1]],
        [[255,3,149,1], [255,9,3,1], [255,139,3,1], [255,216,3,1], [255,251,3,1]],
        [[4,0,4,1], [254,26,138,1], [254,53,26,1], [254,143,26,1], [254,240,26,1]],
        [[125,173,154,1], [196,199,169,1], [249,213,177,1], [254,126,142,1], [255,62,97,1]],
        [[69,38,50,1], [145,32,77,1], [226,247,206,1], [228,132,74,1], [232,191,86,1]],
        [[0,0,0,1], [38,173,228,1], [77,188,233,1], [209,231,81,1], [255,255,255,1]],
        [[44,87,133,1], [209,19,47,1], [235,241,247,1], [237,214,130,1]],
        [[92,172,196,1], [140,209,157,1], [206,232,121,1], [252,182,83,1], [255,82,84,1]],
        [[58,68,8,1], [74,88,7,1], [125,146,22,1], [157,222,13,1], [199,237,14,1]],
        [[22,147,167,1], [200,207,2,1], [204,12,57,1], [230,120,30,1], [248,252,193,1]],
        [[59,12,44,1], [210,255,31,1], [250,244,224,1], [255,106,0,1], [255,195,0,1]],
        [[44,13,26,1], [52,158,151,1], [200,206,19,1], [222,26,114,1], [248,245,193,1]],
        [[28,20,13,1], [203,232,107,1], [242,233,225,1], [255,255,255,1]],      
        [[75,88,191,1], [161,206,247,1], [247,255,133,1], [255,54,134,1]],
        [[74,95,103,1], [92,55,75,1], [204,55,71,1], [209,92,87,1], [217,212,168,1]]
    ];

    function ColorPalettes()
    {
        
    }

    function _makeColor(args) 
    {
        return new Color(args[0],args[1],args[2],args[3]);
    }

    function _makeColorPalette(args)
    {               
        var palette = [];
        for(var i = 0, _len = args.length; i < _len; i++) 
        {
            palette.push(_makeColor(args[i]));
        }
        return new ColorPalette(palette);
    }

    ColorPalettes.prototype.getPalette = function(i) 
    {       
        return _makeColorPalette(rawPalettes[Math.floor(i)]);
    };

    ColorPalettes.prototype.getCount = function()
    {
        return rawPalettes.length;
    };

    ColorPalettes.prototype.getRandomPalette = function () {
        var index = Math.floor( rawPalettes.length * Math.random() )
        return this.getPalette( index ); 
    }

    var color = new ColorPalettes();
    module.exports = color;

});

;
define("famous-math/Random", function(){});

define('famous-modifiers/Camera',['require','exports','module','famous/Transitionable','famous/Matrix','famous/Utility'],function(require, exports, module) {
    var Transitionable = require('famous/Transitionable');
    var Matrix = require('famous/Matrix');
    var Utility = require('famous/Utility');
    /**
     * @class Camera
     * @description
     * Can affect the skew, rotation, scale, and translation of linked renderables.
     * @name Accordion
     * @constructor
     * @example 
     *   define(function(require, exports, module) {
     *           var Engine = require('famous/Engine');
     *           var Camera = require('famous-modifiers/Camera');
     *           var Surface = require('famous/surface');
     *           var RenderNode = require('famous/RenderNode');
     *           var Modifier = require('famous/Modifier');
     *           var Matrix = require('famous/Matrix');
     *
     *           var camera = new Camera();
     *    
     *           var SUPERMOD = new Modifier({
     *               origin: [0.5, 0.5]
     *           });
     *           var SUPERNODE = new RenderNode();
     *
     *           for (var i = 0; i < 3; i++) {
     *               var surfaceWidth = 200;
     *               var node = new RenderNode();
     *    
     *               var modifier = new Modifier ({
     *                   transform: Matrix.translate(surfaceWidth * i, 0)
     *               });
     *    
     *               var surface = new Surface({
     *                   content: ['test ', String(i)].join(''),
     *                   properties: {
     *                       backgroundColor:'#3cf'
     *                   },
     *                   size: [surfaceWidth, surfaceWidth]
     *               });
     *    
     *               node.link(modifier).link(surface);
     *               SUPERNODE.add(node);
     *           }
     *    
     *           var Context = Engine.createContext();
     *           Context.setPerspective(500);
     *           Context.link(camera).link(SUPERMOD).link(SUPERNODE);
     *
     *           var rotation = 0;
     *           Engine.on('prerender', function() {
     *               camera.setRotation([0, 0, rotation]);
     *               rotation+=(0.005);
     *           });
     *   });
     */
    function Camera(matrix) {
        this._renderMatrix = Matrix.identity;
        
        this._scaleState = new Transitionable([1, 1, 1]);
        this._skewState = new Transitionable([0, 0, 0]);
        this._rotateState = new Transitionable([0, 0, 0]);
        this._translateState = new Transitionable([0, 0, 0]);

        this._dirty = false;

        if(matrix) this.lookAt(matrix);
    }

    Camera.prototype.halt = function() {
        this._scaleState.halt();
        this._skewState.halt();
        this._rotateState.halt();
        this._translateState.halt();
    };

    Camera.prototype.getScale = function() {
        return this._scaleState.get();
    };

    Camera.prototype.setScale = function(scale, transition, callback) {
        this._dirty = true;
        return this._scaleState.set(scale, transition, callback);
    };

    Camera.prototype.getSkew = function() {
        return this._skewState.get();
    };

    Camera.prototype.setSkew = function(skew, transition, callback) {
        this._dirty = true;
        return this._skewState.set(skew, transition, callback);
    };

    Camera.prototype.getRotation = function() {
        return this._rotateState.get();
    };

    Camera.prototype.setRotation = function(rotation, transition, callback) {
        this._dirty = true;
        return this._rotateState.set(rotation, transition, callback);
    };

    // deprecated, do not use; shimmed
    Camera.prototype.getSpin = Camera.prototype.getRotation;
    Camera.prototype.setSpin = Camera.prototype.setRotation;

    Camera.prototype.getPos = function() {
        return this._translateState.get();
    };

    Camera.prototype.setPos = function(pos, transition, callback) {
        this._dirty = true;
        return this._translateState.set(pos, transition, callback);
    };

    Camera.prototype.lookAt = function(matrix, transition, callback) {
        var onceCb = undefined;
        if(callback) onceCb = Utility.after(4, callback);
        this.halt();
        var endInterp = Matrix.interpret(matrix);
        this.setScale(endInterp.scale, transition, onceCb);
        this.setSkew(endInterp.skew, transition, onceCb);
        this.setRotation(endInterp.rotate, transition, onceCb);
        this.setPos(endInterp.translate, transition, onceCb);
    };

    function _calculateRenderMatrix() {
        var scaleMatrix = Matrix.scale.apply(this, this._scaleState.get());
        var skewMatrix = Matrix.skew.apply(this, this._skewState.get());
        var rotateMatrix = Matrix.rotate.apply(this, this._rotateState.get());
        var resultMatrix = Matrix.move(Matrix.multiply(scaleMatrix, skewMatrix, rotateMatrix), this._translateState.get());
        return Matrix.inverse(resultMatrix);
    };

    Camera.prototype.render = function(input) {
        this._dirty |= this._scaleState.isActive() || this._skewState.isActive() || this._rotateState.isActive() || this._translateState.isActive();
        if(this._dirty) {
            this._renderMatrix = _calculateRenderMatrix.call(this);
            this._dirty = false;
        }
        return {
            transform: this._renderMatrix,
            group: true,
            target: input
        };
    };

    module.exports = Camera;
});

define('famous-sync/MouseSync',['require','exports','module','famous/EventHandler'],function(require, exports, module) {
    var FEH = require('famous/EventHandler');

    function MouseSync(targetGet, options) {
        this.targetGet = targetGet;

        this.options =  {
            direction: undefined,
            rails: false,
            scale: 1,
            stallTime: 50,
            propogate : true           //events piped to document on mouseleave
        };

        if (options) {
            this.setOptions(options);
        } else {
            this.setOptions(this.options);
        }

        this.input = new FEH();
        this.output = new FEH();

        FEH.setInputHandler(this, this.input);
        FEH.setOutputHandler(this, this.output);

        this._prevCoord = undefined;
        this._prevTime = undefined;
        this._prevVel = undefined;

        this.input.on('mousedown', _handleStart.bind(this));
        this.input.on('mousemove', _handleMove.bind(this));
        this.input.on('mouseup', _handleEnd.bind(this));

        (this.options.propogate)
            ? this.input.on('mouseleave', _handleLeave.bind(this))
            : this.input.on('mouseleave', _handleEnd.bind(this));
    }

    /** @const */ MouseSync.DIRECTION_X = 0;
    /** @const */ MouseSync.DIRECTION_Y = 1;

    function _handleStart(e) {
        e.preventDefault(); // prevent drag
        this._prevCoord = [e.clientX, e.clientY];
        this._prevTime = Date.now();
        this._prevVel = (this.options.direction !== undefined) ? 0 : [0, 0];
        this.output.emit('start');
    };

    function _handleMove(e) {
        if(!this._prevCoord) return;

        var prevCoord = this._prevCoord;
        var prevTime = this._prevTime;
        var currCoord = [e.clientX, e.clientY];

        var currTime = Date.now();

        var diffX = currCoord[0] - prevCoord[0];
        var diffY = currCoord[1] - prevCoord[1];

        if(this.options.rails) {
            if(Math.abs(diffX) > Math.abs(diffY)) diffY = 0;
            else diffX = 0;
        }

        var diffTime = Math.max(currTime - prevTime, 8); // minimum tick time

        var velX = diffX / diffTime;
        var velY = diffY / diffTime;

        var prevPos = this.targetGet();
        var scale = this.options.scale;
        var nextPos;
        var nextVel;

        if(this.options.direction == MouseSync.DIRECTION_X) {
            nextPos = prevPos + scale*diffX;
            nextVel = scale*velX;
        }
        else if(this.options.direction == MouseSync.DIRECTION_Y) {
            nextPos = prevPos + scale*diffY;
            nextVel = scale*velY;
        }
        else {
            nextPos = [prevPos[0] + scale*diffX, prevPos[1] + scale*diffY];
            nextVel = [scale*velX, scale*velY];
        }

        this.output.emit('update', {p: nextPos, v: nextVel});

        this._prevCoord = currCoord;
        this._prevTime = currTime;
        this._prevVel = nextVel;
    };

    function _handleEnd(e) {
        if(!this._prevCoord) return;

        var prevTime = this._prevTime;
        var currTime = Date.now();

        if(currTime - prevTime > this.options.stallTime) this._prevVel = (this.options.direction == undefined) ? [0, 0] : 0;

        var pos = this.targetGet();

        this.output.emit('end', {p: pos, v: this._prevVel});

        this._prevCoord = undefined;
        this._prevTime = undefined;
        this._prevVel = undefined;
    };

    function _handleLeave(e){
        if(!this._prevCoord) return;

        var boundMove = function(e){
            _handleMove.call(this, e);
        }.bind(this);

        var boundEnd = function(e){
            _handleEnd.call(this, e);
            document.removeEventListener('mousemove', boundMove);
            document.removeEventListener('mouseup', boundEnd);
        }.bind(this);

        document.addEventListener('mousemove', boundMove);
        document.addEventListener('mouseup', boundEnd);
    };

    MouseSync.prototype.getOptions = function() {
        return this.options;
    };

    MouseSync.prototype.setOptions = function(options) {
        if(options.direction !== undefined) this.options.direction = options.direction;
        if(options.rails !== undefined) this.options.rails = options.rails;
        if(options.scale !== undefined) this.options.scale = options.scale;
        if(options.stallTime !== undefined) this.options.stallTime = options.stallTime;
        if(options.propogate !== undefined) this.options.propogate = options.propogate;
    };

    module.exports = MouseSync;
});

define('famous-modifiers/Draggable',['require','exports','module','famous/Matrix','famous-sync/MouseSync','famous-sync/TouchSync','famous-sync/GenericSync','famous/Transitionable','famous/EventHandler'],function(require, exports, module) {
	var FM = require('famous/Matrix');
	var MouseSync = require('famous-sync/MouseSync');
	var TouchSync = require('famous-sync/TouchSync');
	var GenericSync = require('famous-sync/GenericSync');
	var FTH = require('famous/Transitionable');
	var EventHandler = require('famous/EventHandler');

    /**
     * @class Draggable
     * @description
     * Makes the linked renderables responsive to dragging.
     * @name Draggable
     * @constructor
     * @example 
     *	define(function(require, exports, module) {
     *	    var Engine = require('famous/Engine');
     *	    var Draggable = require('famous-modifiers/Draggable');
     *	    var Surface = require('famous/Surface');
     *
     *	    var Context = Engine.createContext();
     *	    var draggable = new Draggable();
     *	    var surface = new Surface({
     *	        content: 'test',
     *	        properties: {
     *	            backgroundColor:'#3cf'
     *	        },
     *	        size: [300, 300]
     *	    });
     *
     *	    surface.pipe(draggable);
     *
     *	    Context.link(draggable).link(surface);
     *	});
     */
	function Draggable(options) {
		this.options = Object.create(Draggable.DEFAULT_OPTIONS);
		if (options) this.setOptions(options);

		this._positionState = new FTH([0,0]);
		this._cursorPos = [0, 0];
		this._active = true;

		this.sync = new GenericSync(
			(function() { return this._cursorPos; }).bind(this),
			{
				scale : this.options.scale,
				syncClasses : [MouseSync, TouchSync]
			}
		);

		this.eventOutput = new EventHandler();
		EventHandler.setInputHandler(this,  this.sync);
		EventHandler.setOutputHandler(this, this.eventOutput);

		_bindEvents.call(this);
	}

	//binary representation of directions for bitwise operations
	var _direction = {
		x : 0x001,         //001
		y : 0x002          //010
	}

	Draggable.DEFAULT_OPTIONS = {
		projection  : _direction.x | _direction.y,
		scale       : 1,
		maxX        : Infinity,
		maxY        : Infinity,
		snapX       : 0,
		snapY       : 0,
		transition  : {duration : 0}
	}

	function _handleStart(){
		var pos = this.getPosition();
		this._cursorPos = pos.slice();
		this.eventOutput.emit('dragstart', {p : pos});
	}

	function _handleMove(event){
		if (this._active){
			this.setPosition(_mapPosition.call(this, event.p), this.options.transition);
			this._cursorPos = event.p;
		}
		this.eventOutput.emit('dragmove', {p : this.getPosition()});
	}

	function _handleEnd(){
		this.eventOutput.emit('dragend', {p : this.getPosition()});
	}

	function _bindEvents() {
		this.sync.on('start',  _handleStart.bind(this));
		this.sync.on('update', _handleMove.bind(this));
		this.sync.on('end',    _handleEnd.bind(this));
	}

	function _mapPosition (pos){
		var opts        = this.options;
		var projection  = opts.projection;
		var maxX        = opts.maxX;
		var maxY        = opts.maxY;
		var snapX       = opts.snapX;
		var snapY       = opts.snapY;

		//axes
		var tx = (projection & _direction.x) ? pos[0] : 0;
		var ty = (projection & _direction.y) ? pos[1] : 0;

		//snapping
		if (snapX > 0) tx -= tx % snapX;
		if (snapY > 0) ty -= ty % snapY;

		//containment within maxX, maxY bounds
		tx = Math.max(Math.min(tx, maxX), -maxX);
		ty = Math.max(Math.min(ty, maxY), -maxY);

		return [tx,ty];
	}

	Draggable.prototype.setOptions = function(options){
		var opts = this.options;
		if (options.projection !== undefined){
			var proj = options.projection;
			this.options.projection = 0;
			['x', 'y'].forEach(function(val){
				if (proj.indexOf(val) != -1) opts.projection |= _direction[val];
			});
		};
		if (options.scale !== undefined)        opts.scale = options.scale;
		if (options.maxX !== undefined)         opts.maxX = options.maxX;
		if (options.maxY !== undefined)         opts.maxY = options.maxY;
		if (options.snapX !== undefined)        opts.snapX = options.snapX;
		if (options.snapY !== undefined)        opts.snapY = options.snapY;
		if (options.transition !== undefined)   opts.transition = options.transition;
	}

	Draggable.prototype.getPosition = function() {
		return this._positionState.get();
	};

	Draggable.prototype.setPosition = function(p, transition, callback) {
		if (this._positionState.isActive()) this._positionState.halt();
		this._positionState.set(p, transition, callback);
	};

	Draggable.prototype.activate = function(){
		this._active = true;
	}

	Draggable.prototype.deactivate = function(){
		this._active = false;
	}

	Draggable.prototype.toggle = function(){
		this._active = !this._active;
	}

	Draggable.prototype.render = function(target) {
		var pos = this.getPosition();
		return {
			transform: FM.translate(pos[0], pos[1]),
			target: target
		};
	}

	module.exports = Draggable;

});

define('famous-performance/ProfilerMetric',['require','exports','module'],function(require, exports, module) {

    function PerformanceMetric(bufferSize){

        this.bufferSize = bufferSize || 30;
        this.calculateStatistics = false;

        //tracked statistics
        this.val = 0;
        this.min = 0;
        this.max = 0;
        this.std = 0;

        //internals
        this._index      = 0;
        this._startTime  = 0;
        this._stopped    = true;
        this._startCalls = 0;

        this.accumulator = new Array(this.bufferSize);
        for (var i = 0; i < this.bufferSize; i++) this.accumulator[i] = 0;

    };

    var getTime = (window.performance)
        ? function(){return performance.now()}
        : function(){return Date.now()}

    function getMax(array){
        return Math.max.apply(Math, array);
    };

    function getMin(array){
        return Math.min.apply(Math, array);
    };

    function getAvg(array){
        var N = array.length;
        var sum = 0;
        for (var i = 0; i < N; i++) sum += array[i];
        return sum / N;
    };

    function getSTD(array, avg){
        var sum = 0;
        var meanDiff;
        var N = array.length;
        if (avg === undefined) avg = getAvg(array);
        for (var i = 0; i < N; i++){
            meanDiff = array[i] - avg;
            sum += meanDiff * meanDiff;
        };
        return Math.sqrt(sum / N)
    };

    PerformanceMetric.prototype.start = function(){
        this._startCalls++;
        if (this._stopped){
            this._startTime = getTime();
            this._stopped = false;
        }
        else{
            //run stop if started is run twice consecutively
            this.stop();
            this.start();
        };
    };

    PerformanceMetric.prototype.stop = function(){
        this._stopped = true;
        var duration  = getTime() - this._startTime;
        if (this._startCalls == 1)  this.insert(duration);
        else                        this.addInPlace(duration);
    };

    PerformanceMetric.prototype.aggregate = function(){
        var accumulator = this.accumulator;
        this.val = getAvg(accumulator);
        if (this.calculateStatistics){
            this.min = getMin(accumulator);
            this.max = getMax(accumulator);
            this.std = getSTD(accumulator, this.val);
        };
    };

    PerformanceMetric.prototype.insert = function(val){
        if (this._index === this.bufferSize){
            this.aggregate();
            this._index = 0;
        };
        this.accumulator[this._index] = val;
        this._index++;
    };

    PerformanceMetric.prototype.addInPlace = function(val){
        this.accumulator[this._index - 1] += val;
    };

    PerformanceMetric.prototype.setBufferSize = function(N){
        this.bufferSize = N;
        this.accumulator = new Array(N);
        for (var i = 0; i < N; i++) this.accumulator[i] = 0;
        this._index = 0;
    };

    PerformanceMetric.prototype.reset = function(){
        this._startCalls = 0;
    };

    PerformanceMetric.prototype.dump = function(){
        console.log(this.accumulator);
    };

    module.exports = PerformanceMetric;

});
define('famous-performance/Profiler',['require','exports','module','famous-performance/ProfilerMetric','famous/EventHandler'],function(require, exports, module) {
    var PerformanceMetric = require('famous-performance/ProfilerMetric');
    var EventHandler = require('famous/EventHandler');

    var bufferSize = 20;
    var metrics = {};
    var eventHandler = new EventHandler();
    var FPS = 'FPS';

    function start(id){
        var metric = (metrics[id] === undefined)
            ? addMetric(id)
            : metrics[id];
        metric.start();
    };

    function stop(id){
        metrics[id].stop();
    };

    function addMetric(id){
        var metric = new PerformanceMetric(bufferSize, id);
        metrics[id] = metric;
        return metric;
    };

    function setBufferSize(N){
        bufferSize = N;
        for (var key in metrics) metrics[key].setBufferSize(N);
    };

    function getBufferSize(){
        return bufferSize;
    };

    function emit(type, event){
        eventHandler.emit(type, event)
    };

    eventHandler.on('prerender', function(){
        start(FPS);
        start('Famous');
    });

    eventHandler.on('postrender', function(){
        stop('Famous');
        for (var key in metrics) metrics[key].reset();
    });

    module.exports = {
        metrics : metrics,
        start : start,
        stop : stop,
        emit : emit,
        setBufferSize : setBufferSize,
        getBufferSize : getBufferSize
    };

});
define('famous-performance/ProfilerMetricView',['require','exports','module','famous/Surface','famous/Matrix'],function(require, exports, module) {
    var FamousSurface = require('famous/Surface');
    var FM = require('famous/Matrix');

    function PerformanceMetricView(metric, opts){
        this.opts = {
            size    : [100, 20],
            label   : '',
            map     : function(val){return .06 * val}
        };

        if (opts) this.setOpts(opts);

        this.metric = metric;
        this.createView();
        this.textPadding = 4;
    };

    PerformanceMetricView.prototype.setOpts = function(opts) {
        for (var key in opts) this.opts[key] = opts[key];
    };

    PerformanceMetricView.prototype.createView = function() {
        var metricSurface = new FamousSurface({size : this.opts.size});
        metricSurface.setProperties({
            background : '#3cf'
        });

        var boundingSurface = new FamousSurface({size : this.opts.size});
        boundingSurface.setProperties({
            background : '#36f'
        });

        var textSurface = new FamousSurface({content : this.opts.label.toString()});
        textSurface.setProperties({
            color : 'white',
            textShadow : '0px 0px 2px black',
            lineHeight : this.opts.size[1] + 'px'
        });

        this.boundingSurface = boundingSurface;
        this.metricSurface = metricSurface;
        this.textSurface = textSurface;
    };

    PerformanceMetricView.prototype.render = function(){
        var scaleValue = this.metric.val;
        var scaleFactor = (scaleValue !== undefined) ? this.opts.map(scaleValue) : 0;

        return {
            size : this.opts.size,
            target : [
                {
                    target : this.boundingSurface.render(),
                    transform : FM.translate(0,0,-0.0001)
                },
                {
                    target : this.metricSurface.render(),
                    transform : FM.scale(scaleFactor, 1, 1)
                },
                {
                    target : this.textSurface.render(),
                    transform : FM.translate(this.opts.size[0] + this.textPadding, 0)
                }
            ]
        };
    };

    module.exports = PerformanceMetricView;

});
define('famous-performance/ProfilerView',['require','exports','module','famous-performance/ProfilerMetricView','famous-performance/Profiler','famous/RenderNode','famous/Modifier','famous/Matrix'],function(require, exports, module) {
    var PerformanceMetricView = require('famous-performance/ProfilerMetricView');
    var Profiler = require('famous-performance/Profiler')
    var FamousCombiner = require('famous/RenderNode');
    var FT = require('famous/Modifier');
    var FM = require('famous/Matrix');

    var metrics = Profiler.metrics;
    var combiner = new FamousCombiner();
    var counter = 0;

    var options = {
        max : 1000 / 60,
        size : [150, 20],
        margin : 1
    };

    function setMax(max){
        options.max = max;
    };

    function setSize(size){
        options.size = size;
    };

    function init(){
        var ty = 0;
        var map;
        for (var key in metrics){
            if (key.toUpperCase() === 'FPS') map = function(val){ return 1000 / (60 * val); }
            else map = function(val){return val / options.max};

            var metricView = new PerformanceMetricView(metrics[key], {
                size    : options.size,
                label   : key,
                map     : map
            });

            var layoutTransform = new FT(FM.translate(0, ty));
            combiner.add(layoutTransform).link(metricView);
            ty += options.size[1] + options.margin;
        };
    };

    function render(){
        if (counter >  2)   return combiner.render();
        if (counter == 2)   init();
        if (counter <= 2)   counter++;
    };


    module.exports = {
        setMax : setMax,
        setSize : setSize,
        render : render
    };

});
define('famous-physics/constraints/Collision',['require','exports','module','famous-physics/constraints/Constraint','../math/Vector','famous/EventHandler'],function(require, exports, module) {
    var Constraint = require('famous-physics/constraints/Constraint');
    var Vector = require('../math/Vector');
    var EventHandler = require('famous/EventHandler');

    /** @constructor */
    function Collision(opts){

        this.opts = {
            restitution : .5
        };

        if (opts) this.setOpts(opts);

        this.eventOutput = new EventHandler();
        EventHandler.setOutputHandler(this, this.eventOutput);

        //registers
        this.n      = new Vector();
        this.vRel   = new Vector();
        this.I      = new Vector();
        this.disp   = new Vector();

    };

    Collision.prototype = Object.create(Constraint.prototype);
    Collision.prototype.constructor = Constraint;

    Collision.prototype.setOpts = function(opts){
        for (var key in opts) this.opts[key] = opts[key];
    };

    Collision.prototype.applyConstraint = function(particles, source, dt){

        if (source === undefined) return;

        var p1 = source.p;
        var r1 = source.r;
        var v1 = source.v;

        var n = this.n;
        var I = this.I;
        var vRel = this.vRel;
        var disp = this.disp;
        var restitution = this.opts.restitution;

        for (var index = 0; index < particles.length; index++){

            var target = particles[index];

            if (source == target) continue;

            var p2 = target.p;
            var r2 = target.r;
            var m1Inv = source.mInv;

            disp.set(p1.sub(p2));
            var dist = disp.norm();

            var overlap = r1 + r2 - dist;

            if (overlap > 0){

                n.set(disp.normalize()); //n register set

                var collisionData = {target : target, source : source, overlap : overlap, normal : n};

                //TODO: create pre and post solve methods so this event is only fired once
                this.eventOutput.emit('preCollision', collisionData);
                this.eventOutput.emit('collision', collisionData);

                var v2 = target.v;
                var m2Inv = target.mInv;

                vRel.set(v1.sub(v2)); //vRel in register

                //TODO: add k from collision jacobian
                I.set(n.mult((1 + restitution) * vRel.dot(n) / (m1Inv + m2Inv)));

                v1.sub(I.mult(m1Inv), v1);
                p1.add(n.mult(overlap/2), p1);

                v2.add(I.mult(m2Inv), v2);
                p2.add(n.mult(-overlap/2), p2);

                this.eventOutput.emit('postCollision', collisionData);

            };

        };

    };

    module.exports = Collision;

});
define('famous-physics/math/vector',['require','exports','module'],function(require, exports, module) {

    /**
     * @class An immutable three-element floating point vector.
     *
     * @description Note that if not using the "out" parameter,
     *    then funtions return a common reference to an internal register.
     *    
     * * Class/Namespace TODOs:
     *   * Are there any vector STANDARDS in JS that we can use instead of our own library?
     *   * Is it confusing that this is immutable?
     *   * All rotations are counter-clockwise in a right-hand system.  Need to doc this 
     *     somewhere since Famous render engine's rotations are left-handed (clockwise)
     * 
     * Constructor: Take three elts or an array and make new vec.
     *    
     * @name Vector
     * @constructor
     */ 
    function Vector(x,y,z){
        if (arguments.length === 1) this.set(x)
        else{
            this.x = x || 0.0;
            this.y = y || 0.0;
            this.z = z || 0.0;
        };
        return this;
    };

    var register = new Vector(0,0,0);

    /**
     * Add to another Vector, element-wise.
     *
     * @name Vector#add
     * @function
     * @returns {Vector}
     */
    Vector.prototype.add = function(v, out){
        out = out || register;
        return out.setXYZ(
            this.x + (v.x || 0.0),
            this.y + (v.y || 0.0),
            this.z + (v.z || 0.0)
        );
    };

    /**
     * Subtract from another Vector, element-wise.
     *    
     * @name Vector#sub
     * @function
     * @returns {Vector}
     */
    Vector.prototype.sub = function(v, out){
        out = out || register;
        return out.setXYZ(
            this.x - v.x,
            this.y - v.y,
            this.z - v.z
        );
    };

    /**
     * Scale Vector by floating point r.
     *    
     * @name Vector#mult
     * @function
     * @returns {number}
     */
    Vector.prototype.mult = function(r, out){
        out = out || register;
        return out.setXYZ(
            r * this.x,
            r * this.y,
            r * this.z
        );
    };

    /**
     * Scale Vector by floating point 1/r.
     *    
     * @name Vector#div
     * @function
     * @returns {number}
     */
    Vector.prototype.div = function(r, out){
        return this.mult(1/r, out);
    };

    /**
     * Return cross product with another Vector
     *    
     * @name Vector#cross
     * @function
     * @returns {Vector}
     */
    Vector.prototype.cross = function(v, out){
        out = out || register;
        return out.setXYZ(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );

        //corrects for reversed y-axis
//        return out.setXYZ(
//            -this.y * v.z + this.z * v.y,
//             this.z * v.x - this.x * v.z,
//            -this.x * v.y + this.y * v.x
//        );
    };

    /**
     * Component-wise equality test between this and Vector v.
     * @name Vector#equals
     * @function
     * @returns {boolean}
     */
    Vector.prototype.equals = function(v){
        return (v.x == this.x && v.y == this.y && v.z == this.z);
    };

    /**
     * Rotate counter-clockwise around x-axis by theta degrees.
     *
     * @name Vector#rotateX
     * @function
     * @returns {Vector}
     */
    Vector.prototype.rotateX = function(theta, out){
        out = out || register;
        var x = this.x;
        var y = this.y;
        var z = this.z;

        var cosTheta = Math.cos(theta);
        var sinTheta = Math.sin(theta);

        return out.setXYZ(
             x,
            -z * sinTheta + y * cosTheta,
             z * cosTheta - y * sinTheta
        );
    };

    /**
     * Rotate counter-clockwise around y-axis by theta degrees.
     *
     * @name Vector#rotateY
     * @function
     * @returns {Vector}
     */
    Vector.prototype.rotateY = function(theta, out){
        out = out || register;
        var x = this.x;
        var y = this.y;
        var z = this.z;

        var cosTheta = Math.cos(theta);
        var sinTheta = Math.sin(theta);

        return out.setXYZ(
            -z * sinTheta + x * cosTheta,
            y,
            z * cosTheta + x * sinTheta
        );
    };

    /**
     * Rotate counter-clockwise around z-axis by theta degrees.
     *
     * @name Vector#rotateZ
     * @function
     * @returns {Vector}
     */
    Vector.prototype.rotateZ = function(theta, out){
        out = out || register;
        var x = this.x;
        var y = this.y;
        var z = this.z;

        var cosTheta = Math.cos(theta);
        var sinTheta = Math.sin(theta);

        return out.setXYZ(
            -y * sinTheta + x * cosTheta,
             y * cosTheta + x * sinTheta,
             z
        );
    };

    /**
     * Take dot product of this with a second Vector
     *       
     * @name Vector#dot
     * @function
     * @returns {number}
     */
    Vector.prototype.dot = function(v){
        return this.x * v.x + this.y * v.y + this.z * v.z;
    };

    /**
     * Take dot product of this with a this Vector
     *
     * @name Vector#normSquared
     * @function
     * @returns {number}
     */
    Vector.prototype.normSquared = function(){
        return this.dot(this);
    };

    /**
     * Find Euclidean length of the Vector.
     *       
     * @name Vector#norm
     * @function
     * @returns {number}
     */
    Vector.prototype.norm = function(){
        return Math.sqrt(this.normSquared());
    };

    /**
     * Scale Vector to specified length.
     * If length is less than internal tolerance, set vector to [length, 0, 0].
     * 
     * * TODOs: 
     *    * There looks to be a bug or unexplained behavior in here.  Why would
     *      we defer to a multiple of e_x for being below tolerance?
     *  
     * @name Vector#normalize
     * @function
     * @returns {Vector}
     */
    Vector.prototype.normalize = function(length, out){
        length  = (length !== undefined) ? length : 1.0;
        out     = out || register;

        var tolerance = 1e-7;
        var norm = this.norm();

        if (Math.abs(norm) > tolerance) return this.mult(length / norm, out);
        else return out.setXYZ(length, 0.0, 0.0);
    };

    /**
     * Make a separate copy of the Vector.
     *
     * @name Vector#clone
     * @function
     * @returns {Vector}
     */
    Vector.prototype.clone = function(){
        return new Vector(this);
    };

    /**
     * True if and only if every value is 0 (or falsy)
     *
     * @name Vector#isZero
     * @function
     * @returns {boolean}
     */
    Vector.prototype.isZero = function(){
        return !(this.x || this.y || this.z);
    };

    /**
     * Set this Vector to the values in the provided Array or Vector.
     *
     * TODO: set from Array disambiguation
     *
     * @name Vector#set
     * @function
     * @returns {Vector}
     */
    Vector.prototype.set = function(v){
        if (v instanceof Array){
            this.setFromArray(v);
        }
        else{
            this.x = v.x;
            this.y = v.y;
            this.z = v.z || 0.0;
        }
        if (this !== register) register.clear();
        return this;
    };

    Vector.prototype.setFromArray = function(v){
        this.x = v[0];
        this.y = v[1];
        this.z = v[2] || 0.0;
    };

    /**
     * Put result of last internal calculation in 
     *   specified output vector.
     *
     * @name Vector#put
     * @function
     * @returns {Vector}
     */
    Vector.prototype.put = function(v){
        v.set(register);
    };

    /**
     * Set elements directly and clear internal register.
     *   This is the a "mutating" method on this Vector.
     *  
     *
     * @name Vector#setXYZ
     * @function
     */
    Vector.prototype.setXYZ = function(x,y,z){
        register.clear();
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    };

    /**
     * Set elements to 0.
     *
     * @name Vector#clear
     * @function
     */
    Vector.prototype.clear = function(){
        this.x = 0;
        this.y = 0;
        this.z = 0;
    };

    /**
     * Scale this Vector down to specified "cap" length.
     * If Vector shorter than cap, or cap is Infinity, do nothing.
     *
     * 
     * @name Vector#cap
     * @function
     * @returns {Vector}
     */
    Vector.prototype.cap = function(cap, out){
        if (cap === Infinity) return this;
        out = out || register;
        var norm = this.norm();
        if (norm > cap) return this.normalize(cap, out);
        else return this;
    };

    /**
     * Return projection of this Vector onto another.
     * 
     * @name Vector#project
     * @function
     * @returns {Vector}
     */
    Vector.prototype.project = function(n, out){
        out = out || register;
        return n.mult(this.dot(n), out);
    };

    /**
     * Reflect this Vector across provided vector.
     *
     * @name Vector#reflect
     * @function
     */
    Vector.prototype.reflectAcross = function(n, out){
        out = out || register;
        n.normalize();
        return this.sub(this.project(n).mult(2), out);
    };

    /**
     * Convert Vector to three-element array.
     * 
     * * TODOs: 
     *   * Why do we have this and get()?
     *       
     * @name Vector#toArray
     * @function
     */
    Vector.prototype.toArray = function(){
        return [this.x, this.y, this.z];
    };

    /**
     * Convert Vector to three-element array.
     * 
     * * TODOs: 
     *   * Why do we have this and toArray()?
     *           
     * @name Vector#get
     * @function
     */
    Vector.prototype.get = function(){
        return this.toArray();
    };

    module.exports = Vector;

});

define('famous-physics/constraints/CollisionJacobian',['require','exports','module','famous-physics/constraints/Constraint','famous-physics/math/vector','famous/EventHandler'],function(require, exports, module) {
    var Constraint = require('famous-physics/constraints/Constraint');
    var Vector = require('famous-physics/math/vector');
    var EventHandler = require('famous/EventHandler');

    /** @constructor */
    function CollisionJacobian(opts){
        this.opts = {
            k : 0.5,
            restitution : 0.5
        };

        if (opts) this.setOpts(opts);

        this.eventOutput = new EventHandler();
        EventHandler.setOutputHandler(this, this.eventOutput);

        //registers
        this.n        = new Vector();
        this.pDiff    = new Vector();
        this.vDiff    = new Vector();
        this.impulse1 = new Vector();
        this.impulse2 = new Vector();
        this.slop     = 0;
    };

    CollisionJacobian.prototype = Object.create(Constraint.prototype);
    CollisionJacobian.prototype.constructor = Constraint;

    CollisionJacobian.prototype.setOpts = function(opts){
        for (var key in opts) this.opts[key] = opts[key];
    };

    function normalVelocity(particle1, particle2){
        return particle1.v.dot(particle2.v);
    };

    CollisionJacobian.prototype.applyConstraint = function(particles, source, dt){

        if (source === undefined) return;

        var v1 = source.v,
            p1 = source.p,
            w1 = source.mInv,
            r1 = source.r;

        var k    = this.opts.k;
        var n    = this.n;
        var pDiff = this.pDiff;
        var vDiff = this.vDiff;
        var impulse1 = this.impulse1;
        var impulse2 = this.impulse2;

        var restitution1 = source.restitution;

        for (var i = 0; i < particles.length; i++){
            var target = particles[i];

            if (target == source) continue;

            var v2 = target.v,
                p2 = target.p,
                w2 = target.mInv,
                r2 = target.r;

            var restitution2 = target.restitution;

            var restitution = (this.opts.restitution !== undefined)
                ? this.opts.restitution
                : Math.sqrt(restitution1 * restitution2)

            pDiff.set(p2.sub(p1));
            vDiff.set(v2.sub(v1));

            var dist = pDiff.norm();
            var overlap = dist - (r1 + r2);
            var effMass = 1/(w1 + w2);
            var gamma = 0;

            if (overlap < 0){

                n.set(pDiff.normalize());
                var collisionData = {target : target, source : source, overlap : overlap, normal : n};

                //TODO: create pre and post solve methods so this event is only fired once
                this.eventOutput.emit('preCollision', collisionData);
                this.eventOutput.emit('collision', collisionData);

                var lambda = (overlap <= this.slop)
                    ? ((1 + restitution) * n.dot(vDiff) + k/dt * (overlap - this.slop)) / (gamma + dt/effMass)
                    : ((1 + restitution) * n.dot(vDiff)) / (gamma + dt/effMass)

                n.mult(dt*lambda).put(impulse1);
                impulse1.mult(-1).put(impulse2);

                source.applyImpulse(impulse1);
                target.applyImpulse(impulse2);

                p1.add(n.mult( overlap/2), p1);
                p2.add(n.mult(-overlap/2), p2);

                this.eventOutput.emit('postCollision', collisionData);

            };

        };

    };

    module.exports = CollisionJacobian;
});
define('famous-physics/constraints/Curve',['require','exports','module','famous-physics/constraints/Constraint','../math/Vector'],function(require, exports, module) {
    var Constraint = require('famous-physics/constraints/Constraint');
    var Vector = require('../math/Vector');

    /** @constructor */
    function Curve(opts){
        this.opts = {
            f  : function(x,y,z){ return Math.sin(x/100)*100 - y},
            df : undefined,
            g  : function(x,y,z){ return z },
            dg : undefined,
            dampingRatio : 0,
            period : 0
        };

        if (opts) this.setOpts(opts);

        this.J = new Vector();
        this.impulse  = new Vector();
    };

    Curve.prototype = Object.create(Constraint.prototype);
    Curve.prototype.constructor = Constraint;

    Curve.prototype.setOpts = function(opts){
        for (var key in opts) this.opts[key] = opts[key];
    };

    Curve.prototype.applyConstraint = function(targets, source, dt){

        var impulse  = this.impulse;
        var J = this.J;
        var f = this.opts.f;
        var g = this.opts.f;
        var df = this.opts.df;
        var dg = this.opts.dg;

        var err = 0;
        for (var i = 0; i < targets.length; i++){
            var particle = targets[i];

            var v = particle.v;
            var p = particle.p;
            var m = particle.m;

            if (this.opts.period == 0){
                var gamma = 0;
                var beta = 1;
            }
            else{
                var c = 4 * m * Math.PI * this.opts.dampingRatio / this.opts.period;
                var k = 4 * m * Math.PI * Math.PI / (this.opts.period * this.opts.period);

                var gamma = 1 / (c + dt*k);
                var beta  = dt*k / (c + dt*k);
            };

            if (df === undefined){
                var eps = 1e-7;
                var f0  = f(p.x, p.y, p.z);
                var dfx = (f(p.x + eps, p.y, p.z) - f0) / eps;
                var dfy = (f(p.x, p.y + eps, p.z) - f0) / eps;
                var dfz = (f(p.x, p.y, p.z + eps) - f0) / eps;

                var g0  = g(p.x, p.y, p.z);
                var dgx = (g(p.x + eps, p.y, p.z) - g0) / eps;
                var dgy = (g(p.x, p.y + eps, p.z) - g0) / eps;
                var dgz = (g(p.x, p.y, p.z + eps) - g0) / eps;

                J.setXYZ(dfx + dgx, dfy + dgy, dfz + dgz);
            }
            else {
                var d1 = df(p.x, p.y, p.z);
                var d2 = dg(p.x, p.y, p.z)
                J.setXYZ(d1[0] + d2[0], d1[1] + d2[1], d1[2] + d2[2]);
            }

            var antiDrift = beta/dt * (f(p.x, p.y, p.z) + g(p.x, p.y, p.z));
            var lambda = -(J.dot(v) + antiDrift) / (gamma + dt*J.normSquared() / m);

            impulse.set(J.mult(dt*lambda));
            particle.applyImpulse(impulse);

            // err += calcError(impulse);
            err += Math.abs(lambda);

        };

        return err;
    };

    Curve.prototype.setupSlider = function(slider, property){
        property = property || slider.opts.name;
        slider.setOpts({value : this.opts[property]});
        slider.init();
        slider.on('change', function(data){
            this.opts[property] = data.value;
        }.bind(this));
    };

    module.exports = Curve;
});
define('famous-physics/constraints/Distance',['require','exports','module','famous-physics/constraints/Constraint','../math/Vector'],function(require, exports, module) {
    var Constraint = require('famous-physics/constraints/Constraint');
    var Vector = require('../math/Vector');

    /** @constructor */
    function Distance(opts){
        this.opts = {
            length : 0,
            anchor : undefined,
            dampingRatio : 0,
            period : 0
        };

        if (opts) this.setOpts(opts);

        this.impulse  = new Vector();
        this.n        = new Vector();
        this.diffP    = new Vector();
        this.diffV    = new Vector();
    };

    Distance.prototype = Object.create(Constraint.prototype);
    Distance.prototype.constructor = Constraint;

    Distance.prototype.setOpts = function(opts){
        if (opts.anchor !== undefined){
            if (opts.anchor.p instanceof Vector) this.opts.anchor = opts.anchor.p;
            if (opts.anchor   instanceof Vector)  this.opts.anchor = opts.anchor;
            if (opts.anchor   instanceof Array)  this.opts.anchor = new Vector(opts.anchor);
        }
        if (opts.length !== undefined) this.opts.length = opts.length;
        if (opts.dampingRatio !== undefined) this.opts.dampingRatio = opts.dampingRatio;
        if (opts.period !== undefined) this.opts.period = opts.period;
    };

    function calcError(impulse){
        return impulse.norm();
    };

    Distance.prototype.setAnchor = function(v){
        if (this.opts.anchor === undefined) this.opts.anchor = new Vector();
        this.opts.anchor.set(v);
    };

    Distance.prototype.applyConstraint = function(targets, source, dt){
        var n        = this.n;
        var diffP    = this.diffP;
        var diffV    = this.diffV;
        var impulse  = this.impulse;

        if (source){
            var p2 = source.p;
            var w2 = source.mInv;
            var v2 = source.v;
        }
        else{
            var p2 = this.opts.anchor;
            var w2 = 0;
        };

        var length = this.opts.length;
        var err = 0;

        for (var i = 0; i < targets.length; i++){

            var particle = targets[i];

            var v1 = particle.v;
            var p1 = particle.p;
            var w1 = particle.mInv;

            diffP.set(p1.sub(p2));
            n.set(diffP.normalize());

            var dist = diffP.norm() - length;

            if (source) diffV.set(v1.sub(v2))
            else        diffV.set(v1);

            var effMass = 1 / (w1 + w2);

            if (this.opts.period == 0){
                var gamma = 0;
                var beta = 1;
            }
            else{
                var c = 4 * effMass * Math.PI * this.opts.dampingRatio / this.opts.period;
                var k = 4 * effMass * Math.PI * Math.PI / (this.opts.period * this.opts.period);

                var gamma = 1 / (c + dt*k);
                var beta  = dt*k / (c + dt*k);
            };

            var antiDrift = beta/dt * dist;
            var lambda    = -(n.dot(diffV) + antiDrift) / (gamma + dt/effMass);

            impulse.set(n.mult(dt*lambda));
            particle.applyImpulse(impulse);

            if (source) source.applyImpulse(impulse.mult(-1));

            // err += calcError(impulse);
            err += Math.abs(lambda);

        };

        return err;
    };

    module.exports = Distance;
});
define('famous-physics/constraints/Distance1D',['require','exports','module','famous-physics/constraints/Constraint','../math/Vector'],function(require, exports, module) {
    var Constraint = require('famous-physics/constraints/Constraint');
    var Vector = require('../math/Vector');

    /** @constructor */
    function Distance1D(opts){
        this.opts = {
            length : 0,
            anchor : undefined,
            dampingRatio : 0,
            period : 0
        };

        if (opts) this.setOpts(opts);

        this.impulse  = new Vector();

    };

    Distance1D.prototype = Object.create(Constraint.prototype);
    Distance1D.prototype.constructor = Constraint;

    Distance1D.prototype.setOpts = function(opts){
        for (var key in opts) this.opts[key] = opts[key];
    };

    function calcError(impulse){
        return impulse.norm();
    };

    Distance1D.prototype.applyConstraint = function(targets, source, dt){
        var impulse  = this.impulse;
        var diffP; var diffV;

        if (source){
            var p2 = source.p.x;
            var w2 = source.mInv;
            var v2 = source.v.x;
        }
        else{
            var p2 = this.opts.anchor;
            var w2 = 0;
        };

        var length = this.opts.length;
        var period = this.opts.period;
        var dampingRatio = this.opts.dampingRatio;
        var err = 0;

        for (var i = 0; i < targets.length; i++){

            var particle = targets[i];

            var v1 = particle.v.x;
            var p1 = particle.p.x;
            var w1 = particle.mInv;

            diffP = p1 - p2;

            var dist = diffP - length;

            if (source) diffV = v1 - v2;
            else        diffV = v1;

            var effMass = 1 / (w1 + w2);

            if (period == 0){
                var gamma = 0;
                var beta = 1;
            }
            else{
                // period /= Math.max(Math.sqrt(1 - dampingRatio*dampingRatio),10000);
                var c = 4 * effMass * Math.PI * dampingRatio / period;
                var k = 4 * effMass * Math.PI * Math.PI / (period*period);

                var gamma = 1 / (c + dt*k);
                var beta  = dt*k / (c + dt*k);
            };

            var antiDrift = beta/dt * dist;
            var lambda    = -(diffV + antiDrift) / (gamma + dt/effMass);

            impulse.setXYZ(dt*lambda, 0, 0);
            particle.applyImpulse(impulse);

            if (source) source.applyImpulse(impulse.mult(-1));

            // err += calcError(impulse);
            err += Math.abs(lambda);

        };

        return err;
    };

    Distance1D.prototype.setupSlider = function(slider, property){
        property = property || slider.opts.name;
        slider.setOpts({value : this.opts[property]});
        if (slider.init instanceof Function) slider.init();
        slider.on('change', function(data){
            this.opts[property] = data.value;
        }.bind(this));
    };

    module.exports = Distance1D;
});
define('famous-physics/constraints/Rod',['require','exports','module','famous-physics/constraints/Constraint','../math/Vector'],function(require, exports, module) {
    var Constraint = require('famous-physics/constraints/Constraint');
    var Vector = require('../math/Vector');

    /** @constructor */
    function Rod(opts){

        this.opts = {
            length      : 0,
            anchor      : undefined,
            stiffness   : 1
        };

        if (opts) this.setOpts(opts);

        //registers
        this.disp = new Vector();
        this.push = new Vector();

    };

    Rod.prototype = Object.create(Constraint.prototype);
    Rod.prototype.constructor = Constraint;

    Rod.prototype.setOpts = function(opts){
        if (opts.anchor !== undefined){
            if (opts.anchor.p instanceof Vector) this.opts.anchor = opts.anchor.p;
            if (opts.anchor   instanceof Array)  this.opts.anchor = new Vector(opts.anchor);
            delete opts.anchor;
        }
        for (var key in opts) this.opts[key] = opts[key];
    };

    Rod.prototype.applyConstraint = function(targets, source, dt){

        var opts            = this.opts;
        var disp            = this.disp;
        var push            = this.push;
        var targetLength    = opts.length;
        var stiffness       = opts.stiffness;
        var anchor          = opts.anchor || source.p;

        var particle = targets[0];
        var p = particle.p;

        disp.set(p.sub(anchor));
        var currLength = disp.norm();

        var stretch = (targetLength - currLength) / currLength;

        if (Math.abs(stretch) > 0){
            disp.mult(stretch * 0.5 * stiffness, push)
            if (!particle.immunity) {
                p.add(push, p);
                particle.v.add(push.div(dt), particle.v);
            }
            if (source && !source.immunity){
                source.p.sub(push, source.p);
                source.v.sub(push.div(dt), source.v);
            }
        };

    };

    module.exports = Rod;

});
define('famous-physics/constraints/Rope',['require','exports','module','famous-physics/constraints/Constraint','famous-physics/math/Vector'],function(require, exports, module) {
    var Constraint = require('famous-physics/constraints/Constraint');
    var Vector = require('famous-physics/math/Vector');

    /** @constructor */
    function Rope(opts){
        this.opts = {
            length : 0,
            anchor : undefined,
            dampingRatio : 0,
            period : 0
        };

        if (opts) this.setOpts(opts);

        this.impulse  = new Vector();
        this.n        = new Vector();
        this.diffP    = new Vector();
        this.diffV    = new Vector();

    };

    Rope.prototype = Object.create(Constraint.prototype);
    Rope.prototype.constructor = Constraint;

    Rope.prototype.setOpts = function(opts){
        if (opts.anchor !== undefined){
            if (opts.anchor   instanceof Vector) this.opts.anchor = opts.anchor;
            if (opts.anchor.p instanceof Vector) this.opts.anchor = opts.anchor.p;
            if (opts.anchor   instanceof Array)  this.opts.anchor = new Vector(opts.anchor);
        }
        if (opts.length !== undefined) this.opts.length = opts.length;
        if (opts.dampingRatio !== undefined) this.opts.dampingRatio = opts.dampingRatio;
        if (opts.period !== undefined) this.opts.period = opts.period;
    };

    function calcError(impulse){
        return impulse.norm();
    };

    Rope.prototype.applyConstraint = function(targets, source, dt){
        var n        = this.n;
        var diffP    = this.diffP;
        var diffV    = this.diffV;
        var impulse  = this.impulse;

        if (source){
            var p2 = source.p;
            var w2 = source.mInv;
            var v2 = source.v;
        }
        else{
            var p2 = this.opts.anchor;
            var w2 = 0;
        };

        var length = this.opts.length;
        var err = 0;

        for (var i = 0; i < targets.length; i++){

            var particle = targets[i];

            var v1 = particle.v;
            var p1 = particle.p;
            var w1 = particle.mInv;

            diffP.set(p1.sub(p2));

            var dist = diffP.norm() - length;

            //dist < 0 means not extended
            if (dist < 0) return;

            n.set(diffP.normalize());

            if (source) diffV.set(v1.sub(v2))
            else        diffV.set(v1);

            var effMass = 1 / (w1 + w2);

            if (this.opts.period == 0){
                var gamma = 0;
                var beta = 1;
            }
            else{
                var c = 4 * effMass * Math.PI * this.opts.dampingRatio / this.opts.period;
                var k = 4 * effMass * Math.PI * Math.PI / (this.opts.period * this.opts.period);

                var gamma = 1 / (c + dt*k);
                var beta  = dt*k / (c + dt*k);
            };

            var antiDrift = beta/dt * dist;
            var lambda    = -(n.dot(diffV) + antiDrift) / (gamma + dt/effMass);

            impulse.set(n.mult(dt*lambda));
            particle.applyImpulse(impulse);

            if (source) source.applyImpulse(impulse.mult(-1));

            // err += calcError(impulse);
            err += Math.abs(lambda);

        };

        return err;
    };

    Rope.prototype.setupSlider = function(slider, property){
        property = property || slider.opts.name;
        slider.setOpts({value : this.opts[property]});
        slider.init();
        slider.on('change', function(data){
            this.opts[property] = data.value;
        }.bind(this));
    };

    module.exports = Rope;
});
define('famous-physics/constraints/StiffSpring',['require','exports','module','famous-physics/constraints/Constraint','../math/Vector','famous/EventHandler'],function(require, exports, module) {
    var Constraint = require('famous-physics/constraints/Constraint');
    var Vector = require('../math/Vector');
    var EventHandler = require('famous/EventHandler');

    /** @constructor */
    function StiffSpring(opts){

        this.opts = {
            length         : 0,
            anchor         : undefined,
            dampingRatio   : 1,
            period         : 1000,
            restTolerance  : 1e-5
        };

        if (opts) this.setOpts(opts);

        //registers
        this.pDiff  = new Vector();
        this.vDiff  = new Vector();
        this.n      = new Vector();
        this.impulse1 = new Vector();
        this.impulse2 = new Vector();

        this.eventOutput = undefined;
        this._atRest = false;

    };

    StiffSpring.prototype = Object.create(Constraint.prototype);
    StiffSpring.prototype.constructor = Constraint;

    function _fireAtRest(energy, target){
        //TODO: BUG when callback can be fired twice. Energy not always monotonic
        if (energy < this.opts.restTolerance){
            if (!this._atRest) this.eventOutput.emit('atRest', {particle : target});
            this._atRest = true;
        }
        else this._atRest = false;
    };

    function _getEnergy(impulse, disp, dt){
        var energy = Math.abs(impulse.dot(disp)/dt);
        return energy;
    }

    StiffSpring.prototype.setOpts = function(opts){
        if (opts.anchor !== undefined){
            if (opts.anchor   instanceof Vector) this.opts.anchor = opts.anchor;
            if (opts.anchor.p instanceof Vector) this.opts.anchor = opts.anchor.p;
            if (opts.anchor   instanceof Array)  this.opts.anchor = new Vector(opts.anchor);
        }
        if (opts.length !== undefined) this.opts.length = opts.length;
        if (opts.dampingRatio !== undefined) this.opts.dampingRatio = opts.dampingRatio;
        if (opts.period !== undefined) this.opts.period = opts.period;
        if (opts.restTolerance !== undefined) this.opts.restTolerance = opts.restTolerance;
    };

    StiffSpring.prototype.setAnchor = function(v){
        if (this.opts.anchor === undefined) this.opts.anchor = new Vector();
        this.opts.anchor.set(v);
    };

    StiffSpring.prototype.applyConstraint = function(targets, source, dt){

        var opts         = this.opts;
        var pDiff        = this.pDiff;
        var vDiff        = this.vDiff;
        var impulse1     = this.impulse1;
        var impulse2     = this.impulse2;
        var length       = opts.length;
        var anchor       = opts.anchor || source.p;
        var period       = opts.period;
        var dampingRatio = opts.dampingRatio;

        for (var i = 0; i < targets.length ; i++){
            var target = targets[i];

            var p1 = target.p;
            var v1 = target.v;
            var m1 = target.m;
            var w1 = target.mInv;

            pDiff.set(p1.sub(anchor));
            var dist = pDiff.norm() - length;

            if (source){
                var w2 = source.mInv;
                var v2 = source.v;
                vDiff.set(v1.sub(v2));
                var effMass = 1/(w1 + w2);
            }
            else{
                vDiff.set(v1);
                var effMass = m1;
            }

            if (this.opts.period == 0){
                var gamma = 0;
                var beta = 1;
            }
            else{
                var k = 4 * effMass * Math.PI * Math.PI / (period * period);
                var c = 4 * effMass * Math.PI * dampingRatio / period;

                var beta  = dt * k / (c + dt * k);
                var gamma = 1 / (c + dt*k);
            };

            var antiDrift = beta/dt * dist;
            pDiff.normalize(-antiDrift)
                .sub(vDiff)
                .mult(dt / (gamma + dt/effMass))
                .put(impulse1);

            // var n = new Vector();
            // n.set(pDiff.normalize());
            // var lambda = -(n.dot(vDiff) + antiDrift) / (gamma + dt/effMass);
            // impulse2.set(n.mult(dt*lambda));

            target.applyImpulse(impulse1);

            if (source){
                impulse1.mult(-1).put(impulse2);
                source.applyImpulse(impulse2);
            };

            if (this.eventOutput) {
                var energy = target.getEnergy() + _getEnergy(impulse1, pDiff, dt);
                _fireAtRest.call(this, energy, target);
            };
        };

    };

    StiffSpring.prototype.getEnergy = function(target, source){
        var opts        = this.opts;
        var restLength  = opts.length,
            period      = opts.period,
            anchor      = opts.anchor || source.p;

        if (period === 0) return 0;

        var strength = 4 * target.m * Math.PI * Math.PI / (period * period);
        var displacement = anchor.sub(target.p);
        var dist = displacement.norm() - restLength;

        return 0.5 * strength * dist * dist;
    }

    function _createEventOutput() {
        this.eventOutput = new EventHandler();
        this.eventOutput.bindThis(this);
        EventHandler.setOutputHandler(this, this.eventOutput);
    };

    StiffSpring.prototype.on = function() { _createEventOutput.call(this); return this.on.apply(this, arguments); }
    StiffSpring.prototype.unbind = function() { _createEventOutput.call(this); return this.unbind.apply(this, arguments); }
    StiffSpring.prototype.pipe = function() { _createEventOutput.call(this); return this.pipe.apply(this, arguments); }
    StiffSpring.prototype.unpipe = function() { _createEventOutput.call(this); return this.unpipe.apply(this, arguments); }

    module.exports = StiffSpring;

});
define('famous-physics/constraints/Surface',['require','exports','module','famous-physics/constraints/Constraint','../math/Vector'],function(require, exports, module) {
    var Constraint = require('famous-physics/constraints/Constraint');
    var Vector = require('../math/Vector');

    /** @constructor */
    function Surface(opts){
        this.opts = {
            f : undefined,
            df : undefined,
            dampingRatio : 0,
            period : 0
        };

        if (opts) this.setOpts(opts);

        this.J = new Vector();
        this.impulse  = new Vector();
        this.eps = 1e-7;
    };

    Surface.prototype = Object.create(Constraint.prototype);
    Surface.prototype.constructor = Constraint;

    Surface.prototype.setOpts = function(opts){
        for (var key in opts) this.opts[key] = opts[key];
    };

    Surface.prototype.applyConstraint = function(targets, source, dt){

        var impulse  = this.impulse;
        var J = this.J;
        var f = this.opts.f;
        var df = this.opts.df;

        var err = 0;
        for (var i = 0; i < targets.length; i++){

            var particle = targets[i];

            var v = particle.v;
            var p = particle.p;
            var m = particle.m;

            if (this.opts.period == 0){
                var gamma = 0;
                var beta = 1;
            }
            else{
                var c = 4 * m * Math.PI * this.opts.dampingRatio / this.opts.period;
                var k = 4 * m * Math.PI * Math.PI / (this.opts.period * this.opts.period);

                var gamma = 1 / (c + dt*k);
                var beta  = dt*k / (c + dt*k);
            };

            if (df === undefined){
                var eps = this.eps;
                var f0  = f(p.x, p.y, p.z);
                var dfx = (f(p.x + eps, p.y, p.z) - f0) / eps;
                var dfy = (f(p.x, p.y + eps, p.z) - f0) / eps;
                var dfz = (f(p.x, p.y, p.z + eps) - f0) / eps;
                J.setXYZ(dfx, dfy, dfz);
            }
            else J.setXYZ.apply(J, df(p.x, p.y, p.z));

            var antiDrift = beta/dt * f(p.x, p.y, p.z);
            var lambda = -(J.dot(v) + antiDrift) / (gamma + dt*J.normSquared() / m);

            impulse.set(J.mult(dt*lambda));
            particle.applyImpulse(impulse);

            // err += calcError(impulse);
            err += Math.abs(lambda);

        };

        return err;
    };

    Surface.prototype.setupSlider = function(slider, property){
        property = property || slider.opts.name;
        slider.setOpts({value : this.opts[property]});
        slider.init();
        slider.on('change', function(data){
            this.opts[property] = data.value;
        }.bind(this));
    };

    module.exports = Surface;
});
define('famous-physics/constraints/Wall',['require','exports','module','famous-physics/constraints/Constraint','../math/Vector','famous/EventHandler'],function(require, exports, module) {
    var Constraint = require('famous-physics/constraints/Constraint');
    var Vector = require('../math/Vector');
    var EventHandler = require('famous/EventHandler');

    /** @constructor */
    function Wall(opts){
        this.opts = {
            restitution : 0.7,
            k : 0,
            n : new Vector(),
            d : 0,
            onContact : Wall.ON_CONTACT.REFLECT
        };

        if (opts) this.setOpts(opts);

        //registers
        this.diff     = new Vector();
        this.impulse  = new Vector();
        this.slop     = -1;

        this.eventOutput = undefined;
    };

    Wall.prototype = Object.create(Constraint.prototype);
    Wall.prototype.constructor = Constraint;

    Wall.ON_CONTACT = {
        REFLECT : 0,
        WRAP    : 1,
        ABSORB  : 2
    };

    Wall.prototype.setOpts = function(opts){
        if (opts.restitution !== undefined) this.opts.restitution = opts.restitution;
        if (opts.k !== undefined) this.opts.k = opts.k;
        if (opts.d !== undefined) this.opts.d = opts.d;
        if (opts.onContact !== undefined) this.opts.onContact = opts.onContact;
        if (opts.n !== undefined) this.opts.n.set(opts.n);
    };

    Wall.prototype.getNormalVelocity = function(v){
        var n = this.opts.n;
        return v.dot(n);
    };

    Wall.prototype.getDistance = function(p){
        var n = this.opts.n,
            d = this.opts.d;
        return p.dot(n) + d;
    };

    Wall.prototype.onEnter = function(particle, overlap, dt){
        var p           = particle.p,
            v           = particle.v,
            m           = particle.m,
            n           = this.opts.n,
            action      = this.opts.onContact,
            restitution = this.opts.restitution,
            impulse     = this.impulse;

        var k = this.opts.k;
        var gamma = 0;


        if (this.eventOutput){
            var data = {particle : particle, wall : this, overlap : overlap};
            this.eventOutput.emit('preCollision', data);
            this.eventOutput.emit('collision', data);
        }

        switch (action){
            case Wall.ON_CONTACT.REFLECT:
                var lambda = (overlap < this.slop)
                    ? -((1 + restitution) * n.dot(v) + k/dt * (overlap - this.slop)) / (m*dt + gamma)
                    : -((1 + restitution) * n.dot(v)) / (m*dt + gamma)

                impulse.set(n.mult(dt*lambda));
                particle.applyImpulse(impulse);
                p.add(n.mult(-overlap), p);
                break;
            case Wall.ON_CONTACT.ABSORB:
                var lambda = n.dot(v) / (m*dt + gamma)
                impulse.set(n.mult(dt*lambda));
                particle.applyImpulse(impulse);
                p.add(n.mult(-overlap), p);
                v.clear();
                break;
            case Wall.ON_CONTACT.WRAP:
                if (overlap < -particle.r)
                break;
        };

        if (this.eventOutput) this.eventOutput.emit('postCollision', data);
    };

    Wall.prototype.onExit = function(particle, overlap, dt){
        var action = this.opts.onContact;
        var p = particle.p;
        var n = this.opts.n;

        if (action == Wall.ON_CONTACT.REFLECT){
            p.add(n.mult(-overlap), p);
        }
        else if (action == Wall.ON_CONTACT.WRAP){}
        else if (action == Wall.ON_CONTACT.ABSORB){}
    };

    Wall.prototype.applyConstraint = function(particles, source, dt){
        var n = this.opts.n;

        for (var i = 0; i < particles.length; i++){
            var particle = particles[i],
                p = particle.p,
                v = particle.v,
                r = particle.r || 0;

            var overlap = this.getDistance(p.add(n.mult(-r)));

            //if semi-penetrable then detect nv as well
            var nv = this.getNormalVelocity(v);

            if (overlap < 0){
                if (nv < 0) this.onEnter(particle, overlap, dt);
                else        this.onExit(particle, overlap, dt);
            };
        };
    };

    function _createEventOutput() {
        this.eventOutput = new EventHandler();
        this.eventOutput.bindThis(this);
        EventHandler.setOutputHandler(this, this.eventOutput);
    };

    Wall.prototype.on = function() { _createEventOutput.call(this); return this.on.apply(this, arguments); }
    Wall.prototype.unbind = function() { _createEventOutput.call(this); return this.unbind.apply(this, arguments); }
    Wall.prototype.pipe = function() { _createEventOutput.call(this); return this.pipe.apply(this, arguments); }
    Wall.prototype.unpipe = function() { _createEventOutput.call(this); return this.unpipe.apply(this, arguments); }

    module.exports = Wall;

});
define('famous-physics/constraints/Walls',['require','exports','module','famous-physics/constraints/Constraint','famous-physics/math/Vector','famous-physics/constraints/Wall'],function(require, exports, module) {
    var Constraint = require('famous-physics/constraints/Constraint');
    var Vector = require('famous-physics/math/Vector');
    var Wall = require('famous-physics/constraints/Wall');

    /** @constructor */
    function Walls(opts){
        this.opts = {
            sides   : Walls.TWO_DIMENSIONAL,
            size    : [window.innerWidth, window.innerHeight, 0],
            origin  : [.5,.5,.5],
            k       : 0,
            restitution : 0.5,
            onContact   : Walls.ON_CONTACT.REFLECT
        };

        this.setSize(this.opts.size, this.opts.origin);
        this.setOptsForEach({
            restitution : this.opts.restitution,
            k : this.opts.k
        });

        if (opts) this.setOpts(opts);
    };

    Walls.prototype = Object.create(Constraint.prototype);
    Walls.prototype.constructor = Constraint;

    Walls.SIDES = {
        LEFT    : new Wall({n : new Vector( 1, 0, 0)}),
        RIGHT   : new Wall({n : new Vector(-1, 0, 0)}),
        TOP     : new Wall({n : new Vector( 0, 1, 0)}),
        BOTTOM  : new Wall({n : new Vector( 0,-1, 0)}),
        FRONT   : new Wall({n : new Vector( 0, 0, 1)}),
        BACK    : new Wall({n : new Vector( 0, 0,-1)})
    };

    Walls.TWO_DIMENSIONAL   = [Walls.SIDES.LEFT, Walls.SIDES.RIGHT, Walls.SIDES.TOP, Walls.SIDES.BOTTOM];
    Walls.THREE_DIMENSIONAL = [Walls.SIDES.LEFT, Walls.SIDES.RIGHT, Walls.SIDES.TOP, Walls.SIDES.BOTTOM, Walls.SIDES.FRONT, Walls.SIDES.BACK];

    Walls.ON_CONTACT = Wall.ON_CONTACT;

    Walls.prototype.setOpts = function(opts){
        var resizeFlag = false;
        if (opts.restitution !== undefined) this.setOptsForEach({restitution : opts.restitution});
        if (opts.k !== undefined) this.setOptsForEach({k : opts.k});
        if (opts.size !== undefined) {this.opts.size = opts.size; resizeFlag = true};
        if (opts.sides !== undefined) this.opts.sides = opts.sides;
        if (opts.onContact !== undefined) {this.opts.onContact = opts.onContact; this.setOnContact(opts.onContact)}
        if (opts.origin !== undefined) {this.opts.origin = opts.origin; resizeFlag = true};
        if (resizeFlag) this.setSize(this.opts.size, this.opts.origin);
    };

    Walls.prototype.setSize = function(size, origin){
        origin = origin || this.opts.origin;
        if (origin.length < 3) origin[2] = 0.5;

        Walls.SIDES.LEFT.setOpts(  {d : size[0] * origin[0]} );
        Walls.SIDES.TOP.setOpts(   {d : size[1] * origin[1]} );
        Walls.SIDES.FRONT.setOpts( {d : size[2] * origin[2]} );
        Walls.SIDES.RIGHT.setOpts( {d : size[0] * (1 - origin[0])} );
        Walls.SIDES.BOTTOM.setOpts({d : size[1] * (1 - origin[1])} );
        Walls.SIDES.BACK.setOpts(  {d : size[2] * (1 - origin[2])} );

        this.opts.size   = size;
        this.opts.origin = origin;
    };

    Walls.prototype.setOptsForEach = function(opts){
        this.forEachWall(function(wall){
            wall.setOpts(opts)
        });
        for (var key in opts) this.opts[key] = opts[key];
    };

    Walls.prototype.setOnContact = function(onContact){
        this.forEachWall(function(wall){
            wall.setOpts({onContact : onContact});
        });

        switch (onContact){
            case Walls.ON_CONTACT.REFLECT:
                break;
            case Walls.ON_CONTACT.WRAP:
                this.forEachWall(function(wall){
                    wall.setOpts({onContact : onContact});
                    wall.on('wrap', function(data){
                        var particle = data.particle
                        var n = wall.opts.n;
                        var d = wall.opts.d;
                        switch (wall){
                            case Walls.SIDES.RIGHT:
                                var d2 = Walls.SIDES.LEFT.opts.d;
                                break;
                            case Walls.SIDES.LEFT:
                                var d2 = Walls.SIDES.TOP.opts.d;
                                break;
                            case Walls.SIDES.TOP:
                                var d2 = Walls.SIDES.BOTTOM.opts.d;
                                break;
                            case Walls.SIDES.BOTTOM:
                                var d2 = Walls.SIDES.TOP.opts.d;
                                break;
                        }
                        particle.p.add(n.mult(d + d2), particle.p);
                    });
                });
                break;
            case Walls.ON_CONTACT.ABSORB:
                break;
        };
    };

    Walls.prototype.applyConstraint = function(particles, source, dt){
        this.forEachWall(function(wall){
            wall.applyConstraint(particles, source, dt);
        });
    };

    Walls.prototype.forEachWall = function(fn){
        for (var index = 0; index < this.opts.sides.length; index++)
            fn(this.opts.sides[index]);
    };

    Walls.prototype.rotateZ = function(theta){
        this.forEachWall(function(wall){
            var n = wall.opts.n;
            n.rotateZ(theta).put(n);
        });
    };

    Walls.prototype.rotateX = function(theta){
        this.forEachWall(function(wall){
            var n = wall.opts.n;
            n.rotateX(theta).put(n);
        });
    };

    Walls.prototype.rotateY = function(theta){
        this.forEachWall(function(wall){
            var n = wall.opts.n;
            n.rotateY(theta).put(n);
        });
    };

    module.exports = Walls;

});
define('famous-physics/math/matrix',['require','exports','module'],function(require, exports, module) {

    /**
     * @class A class for general NxM matrix manipulation.
     *
     * @description TODO
     *
     * * Class/Namespace TODOs
     *   * Is the main difference between this and FamousMatrix
     *     the assumptions made by FamousMatrix for speed? 
     *   *  Why is this lower-case file "matrix.js"? 
     *   *  Why is this JS object code style different from the other style 
     *      of Matrix.prototype.loop = function...
     * 
     * Create empty matrix (for this constructor) and optionally fill with fn(row, col)
     * for each row, col.
     * @name Matrix
     * @constructor
     */ 
    function Matrix(nRows, nCols, values, fn){
        this.nRows = nRows;
        this.nCols = nCols;
        this.values = values || [[]];

        if (fn) this.loop(fn);
    };

    // TODO: Why is this JS object style different from the other style 
    // of Matrix.prototype.loop = function...
    Matrix.prototype = {
        /**
         * Apply fn(row,col) to generate each (row, col) entry in the Matrix.
         * @name Matrix#loop
         * @function
         */
        loop : function(fn){
            var M = this.values;
            for (var row = 0; row < this.nRows; row++){
                M[row] = [];
                for (var col = 0; col < this.nCols; col++)
                    M[row][col] = fn(row,col);
            };
            return this;
        },

        /**
         * Set matrix values to provided two-dimensional array.
         *
         * * TODOs:
         *   * This has to be an internal, since this doesn't reset 
         *     nRows and nCols.
         * @name Matrix#set
         * @function
         */
        set : function(values){
            this.values = values;
            return this;
        },

        /**
         * Set matrix values to provided two-dimensional array.
         * 
         * * TODOs:
         *   * Rename to generate() or similar.  The object has already
         *     been "created" by the time we get here.
         * @name Matrix#create
         * @function
         */
        create : function(fn){
            return this.loop(fn);
        },

        /**
         * Turn this matrix into an identity matrix.
         *
         * * TODOs:
         *   * Should we throw error if not a square?
         *   * Should rename function, since Matrix.identity() looks awkward. It 
         *     sounds like a static variable, not a function.  
         *     More like generateIdentity().
         * @name Matrix#identity
         * @function
         */
        identity : function(){
            return this.loop(function(row,col){
                if (row == col) return 1;
                else return 0;
            });
        },

       /**
         * Pretty print content of matrix to console.
         *
         * * TODOs:
         *   * We need to get rid of eval() here for sure.  Definitnely a security
         *     risk, since the input to the matrix is not even "type"-checked as numeric.
         * @name Matrix#print
         * @function
         */
        print : function(){
            for (var row = 0; row < this.nRows; row++){
                var str = 'console.log(';
                for (var col = 0; col < this.nCols; col++){
                    str += 'this.values[' + row + '][' + col + '].toFixed(1)';
                    if (col < this.nCols-1) str += ',';
                }
                str += ')';
                eval(str);
            };
        },

       /**
         * Take this matrix A, input matrix B, and return matrix product A*B.
         * Note: If not a valid multiplication, this function proceeds anyway.
         * @name Matrix#rightMult
         * @function
         */
        rightMult : function(M2, out){

            if (M2.nRows != this.nCols) console.warn('cant multiply');

            var vals1 = this.values;
            var vals2 = M2.values;
            var nRows = this.nRows;
            var nCols = M2.nCols;

            var vals = [];
            for (var row = 0; row < nRows; row++){
                vals[row] = [];
                for (var col = 0; col < nCols; col++){
                    var sum = 0;
                    for (var i = 0; i < this.nCols; i++){
                        sum += vals1[row][i] * vals2[i][col];
                    }
                    vals[row][col] = sum;
                };
            };

            if (out) return out.set(vals);
            else return new Matrix(nRows, nCols).set(vals);
        },

       /**
         * Take this matrix A, input array V interpreted as a column vector, 
         *   and return matrix product A*V.
         *
         * * TODOs:
         *   * This may be confusing if public: v is not a Matrix nor a Vector.
         * @name Matrix#vMult
         * @function
         */
        vMult : function(v){
            var n = v.length;
            var Mv = [];
            for (var row = 0; row < this.nRows; row++){
                var sum = 0;
                for (var i = 0; i < n; i++) sum += this.values[row][i] * v[i]
                Mv[row] = sum;
            };
            return Mv;
        },


       /**
         * Modify this matrix to diagnonal matrix with element (i,i) replaced with 
         *   the ith element of input array.
         * 
         * * TODOs:
         *   * This may be confusing if public: v is not a Matrix nor a Vector.
         * @name Matrix#diag
         * @function
         */
        diag : function(diagonal){
            var fn = function(row,col){
                if (row == col) return diagonal[row];
                else return 0;
            };
            return this.loop(fn);
        },

       /**
         * Creates (or modifies "out" to) a Matrix which is the transpose of this.
         * @name Matrix#transpose
         * @function
         */
        transpose : function(out){
            var fun = function(row,col){
                return this.values[col][row];
            }.bind(this);

            if (out)
                return out.loop(fun); //only for square matrices!
            else
                return new Matrix(this.nCols, this.nRows, [[]], fun);
        }
    };

    module.exports = Matrix;
});
define('famous-physics/math/GaussSeidel',['require','exports','module'],function(require, exports, module) {

    /**
     * @class A linear equation solver using the Gauss-Seidel method.
     *
     * @description Solves for x in the matrix equation Mx = b for positive-definite
     *   matrices with lower resources than standard Gaussian elimination.
     *   
     * * TODOs:
     *   * Should calcError really be a private method?
     *   * Along those lines, should this simply be a static function rather than 
     *     an object?  Why construct it without M and b, also? 
     *     
     * @name GaussSeidel
     * @constructor
     */ 
    function GaussSeidel(numIterations, tolerance){
        this.numIterations  = numIterations || 10;
        this.tolerance      = tolerance || 1e-7;
        this.prevX          = [];
        this.x              = [];
    }

    function calcError(){
        var err = 0;
        var n = this.x.length;

        for (var i = 0; i < n; i++)
            err += Math.pow(this.prevX[i] - this.x[i],2) / (this.x[i] * this.x[i]);
        return Math.sqrt(err);
    }

    /**
     * Given two-dimensional array ("matrix") M and array ("column vector")
     * b, solve for "column vector" x.
     *
     * @name GaussSeidel#solve
     * @function
     * @returns {Array.<number>}
     */
    GaussSeidel.prototype.solve = function(M, b){

        var numIterations = this.numIterations;
        var n = b.length;
        var x = this.x;
        var prevX = this.prevX;
        var sigma;

        //init x
        for (var i = 0; i < n; i++) this.x[i] = 0;

        //iteration
        var iteration = 0;
        var err = Infinity;
        while (iteration < numIterations && err > this.tolerance){

            for (var i = 0; i < n; i++){

                prevX[i] = x[i];
                sigma = 0;

                for (var j = 0; j < n; j++){
                    if (j != i)
                        sigma += M[i][j] * x[j];
                };

                x[i] = (b[i] - sigma) / M[i][i];

            };

            err = calcError();
            iteration++;

        };

        return x;

    };

    module.exports = GaussSeidel;

});
define('famous-physics/constraints/joint',['require','exports','module','../math/matrix','../math/GaussSeidel','../math/Vector'],function(require, exports, module) {
    var Matrix = require('../math/matrix');
    var GaussSeidel = require('../math/GaussSeidel');
    var Vector = require('../math/Vector');

    /**
     * @constructor
     */
    function Joint(opts){
        this.opts = {
            length : 0
        };

        if (opts) this.setOpts(opts);

        var numIterations = 10;
        var tolerance = 1e-5;
        this.solver = new GaussSeidel(numIterations, tolerance);
    };

    Joint.prototype.getPosition = function(target, source, dt){

        // if (particle.id != 1) return;

        var numParticles = 2;
        var numConstraints = 1;

        var vs = [];
        var ps = [];
        var ws = [];
        var fs = [];
        var ms = [];

        var particle = target;
        vs[0] = particle.getVel();
        ps[0] = particle.p;
        ws[0] = particle.mInv;
        fs[0] = particle.f;
        ms[0] = particle.m;

        vs[1] = source.v;
        ps[1] = source.p;
        ws[1] = source.mInv;
        fs[1] = source.f;
        ms[1] = source.m;


        //construct Jacobian
        var Jvalues = [];
        for (var row = 0; row < numConstraints; row++){
            Jvalues[row] = [];
            for (var col = 0; col < numParticles; col++){

                var entry;
                if (col == row)
                    entry = ps[row].sub(ps[row+1]);
                else if(col == row + 1)
                    entry = ps[row+1].sub(ps[row]);

                Jvalues[row][3*col + 0] = entry.x;
                Jvalues[row][3*col + 1] = entry.y;
                Jvalues[row][3*col + 2] = entry.z;
            }
        }

        var J = new Matrix(numConstraints,3*numParticles);
        J.set(Jvalues);

        //construct deriv of jacobian
        var DJvalues = [];
        for (var row = 0; row < numConstraints; row++){
            DJvalues[row] = [];
            for (var col = 0; col < numParticles; col++){

                var entry;
                if (col == row)
                    entry = vs[row].sub(vs[row+1]);
                else if(col == row + 1)
                    entry = vs[row+1].sub(vs[row]);


                DJvalues[row][3*col + 0] = entry.x;
                DJvalues[row][3*col + 1] = entry.y;
                DJvalues[row][3*col + 2] = entry.z;
            }
        }

        var Wdiag = []; var v = [];
        for (var index = 0; index < numParticles; index++){
            Wdiag[3*index + 0] = ws[index];
            Wdiag[3*index + 1] = ws[index];
            Wdiag[3*index + 2] = ws[index];

            v[3*index + 0] = vs[index].x;
            v[3*index + 1] = vs[index].y;
            v[3*index + 2] = vs[index].z;
        };

        var W = new Matrix(3*numParticles,3*numParticles).diag(Wdiag);

        //construct M
        var M = new Matrix(numConstraints,numConstraints);
        J.rightMult(W).rightMult(J.transpose(), M);

        //Jv + k/dt * C
        var b1 = J.vMult(v);

        var k = 1;
        var C = [];
        for (var index = 0; index < numConstraints; index++){
            var L = this.length;
            var distSqu = ps[index+1].sub(ps[index]).normSquared();
            C[index]  = 0.5 * (distSqu - L*L);
        };

        var b = [];
        for (var i = 0; i < numConstraints; i++)
            b[i] = -b1[i] - k/dt * C[i];

        var lambda = this.solver.solve(M.values, b);

        //solve for new forces F = JTx
        var F = J.transpose().vMult(lambda);

        var newFs = []
        for (var index = 0; index < numParticles; index++){
            newFs[index] = new Vector(
                F[3*index + 0],
                F[3*index + 1],
                F[3*index + 2]
            );
        };

        //add impulses
        for (var index = 0; index < numParticles; index++){
            var v = vs[index];
            var m = ms[index];
            var f = newFs[index];

            if (index == 0 && particle.id == 0) continue;
            if (index == 1 && particle.id == 0)
                v.add(f.sub(newFs[0]).div(m), v)
            else
                v.add(f.div(m), v);
        };

    };

    Joint.prototype.getError = function(dt){

    }

    module.exports = Joint;
});
define('famous-physics/forces/Repulsion',['require','exports','module','famous-physics/forces/Force','famous-physics/math/Vector'],function(require, exports, module) {
    var Force = require('famous-physics/forces/Force');
    var Vector = require('famous-physics/math/Vector');

    /** @constructor */
    function Repulsion(opts){
        this.opts = {
            strength        : 1,
            anchor          : undefined,
            radii           : { min : 0, max : Infinity },
            cutoff          : 0,
            cap             : Infinity,
            decayFunction   : Repulsion.DECAY_FUNCTIONS.GRAVITY
        };

        if (opts) this.setOpts(opts);
        this.setOpts(opts);

        //registers
        this.disp  = new Vector();

        Force.call(this);
    };

    Repulsion.prototype = Object.create(Force.prototype);
    Repulsion.prototype.constructor = Force;

    Repulsion.DECAY_FUNCTIONS = {
        LINEAR : function (r, cutoff){
            return Math.max(1 - (1 / cutoff) * r, 0)
        },
        MORSE : function (r, cutoff){
            var r0 = (cutoff == 0) ? 100 : cutoff;
            var rShifted = r + r0 * (1 - Math.log(2)); //shift by x-intercept
            return Math.max(1 - Math.pow(1 - Math.exp(rShifted/r0 - 1), 2), 0);
        },
        INVERSE : function(r, cutoff){
            return 1 / (1 - cutoff + r);
        },
        GRAVITY : function(r, cutoff){
            return 1 / (1 - cutoff + r*r);
        }
    };

    Repulsion.prototype.setOpts = function(opts){
        if (opts.anchor !== undefined){
            if (opts.anchor.p instanceof Vector) this.opts.anchor = opts.anchor.p;
            if (opts.anchor   instanceof Array)  this.opts.anchor = new Vector(opts.anchor);
            delete opts.anchor;
        }
        for (var key in opts) this.opts[key] = opts[key];
    };

    Repulsion.prototype.applyForce = function(particles, source){

        var opts        = this.opts,
            force       = this.force,
            disp        = this.disp;

        var strength    = opts.strength,
            anchor      = opts.anchor || source.p,
            cap         = opts.cap,
            cutoff      = opts.cutoff,
            rMax        = opts.radii.max,
            rMin        = opts.radii.min,
            decayFn     = opts.decayFunction;

        if (strength == 0) return;

        for (var index in particles){
            var particle = particles[index];

            if (particle == source) continue;

            var m1 = particle.m,
                p1 = particle.p;

            disp.set(p1.sub(anchor));
            var r = disp.norm();

            if (r < rMax && r > rMin){
                force.set(disp.normalize(strength * m1 * decayFn(r, cutoff)).cap(cap));
                particle.applyForce(force);
            };
        };

    };

    module.exports = Repulsion;

});
define('famous-physics/forces/TorqueSpring',['require','exports','module','famous-physics/forces/Force','famous-physics/math/Vector'],function(require, exports, module) {
    var Force = require('famous-physics/forces/Force');
    var Vector = require('famous-physics/math/Vector');

    /** @constructor */
    function Spring(opts){

        this.opts = {
            period        : 300,
            dampingRatio  : 0,
            length        : 0,
            lMin          : 0,
            lMax          : Infinity,
            anchor        : undefined,
            forceFunction : Spring.FORCE_FUNCTIONS.HOOK,
            callback      : undefined,
            callbackTolerance : 1e-7
        };

        if (opts) this.setOpts(opts);

        //registers
        this.torque  = new Vector();

        this.init();
        this._canFireCallback = undefined;

        Force.call(this);
        this.disp = new Vector(0,0,0);

    };

    Spring.prototype = Object.create(Force.prototype);
    Spring.prototype.constructor = Force;

    Spring.FORCE_FUNCTIONS = {
        FENE : function (dist, rMax){
            var rMaxSmall = rMax * .99;
            var r = Math.max(Math.min(dist, rMaxSmall), -rMaxSmall);
            return r / (1 - r * r/(rMax * rMax))
        },
        HOOK : function(dist){
            return dist;
        }
    };

    function setForceFunction(fn){
        this.forceFunction = fn;
    };

    function setStiffness(opts){
        opts.stiffness = Math.pow(2 * Math.PI / opts.period, 2);
    };

    function setDamping(opts){
        opts.damping = 4 * Math.PI * opts.dampingRatio / opts.period ;
    };

    function getEnergy(strength, dist){
        return 0.5 * strength * dist * dist;
    };

    Spring.prototype.init = function(){
        var opts = this.opts;
        setForceFunction.call(this, opts.forceFunction);
        setStiffness.call(this, opts);
        setDamping.call(this, opts);
    };

    Spring.prototype.applyForce = function(targets, source){

        var torque       = this.torque;
        var opts         = this.opts;
        var disp         = this.disp;

        var stiffness    = opts.stiffness;
        var damping      = opts.damping;
        var restLength   = opts.length;
        var anchor       = opts.anchor;

        for (var i = 0; i < targets.length; i++){

            var target = targets[i];

            disp.set(anchor.sub(target.q));
            var dist = disp.norm() - restLength;

            if (dist == 0) return;

            //if dampingRatio specified, then override strength and damping
            var m      = target.m;
            stiffness *= m;
            damping   *= m;

            torque.set(disp.normalize(stiffness * this.forceFunction(dist, this.opts.lMax)));

            if (damping) torque.add(target.w.mult(-damping), torque);

            target.applyTorque(torque);

        };

    };

    Spring.prototype.setOpts = function(opts){
        if (opts.anchor !== undefined){
            if (opts.anchor.p instanceof Vector) this.opts.anchor = opts.anchor.p;
            if (opts.anchor   instanceof Vector)  this.opts.anchor = opts.anchor;
            if (opts.anchor   instanceof Array)  this.opts.anchor = new Vector(opts.anchor);
        }
        if (opts.period !== undefined) this.opts.period = opts.period;
        if (opts.dampingRatio !== undefined) this.opts.dampingRatio = opts.dampingRatio;
        if (opts.length !== undefined) this.opts.length = opts.length;
        if (opts.lMin !== undefined) this.opts.lMin = opts.lMin;
        if (opts.lMax !== undefined) this.opts.lMax = opts.lMax;
        if (opts.forceFunction !== undefined) this.opts.forceFunction = opts.forceFunction;
        if (opts.callback !== undefined) this.opts.callback = opts.callback;
        if (opts.callbackTolerance !== undefined) this.opts.callbackTolerance = opts.callbackTolerance;

        this.init();
    };

    module.exports = Spring;

});
define('famous-physics/forces/VectorField',['require','exports','module','famous-physics/forces/Force','../math/Vector'],function(require, exports, module) {
    var Force = require('famous-physics/forces/Force');
    var Vector = require('../math/Vector');

    /** @constructor */
    function VectorField(opts){
        this.opts = {
            strength : 1,
            field : VectorField.FIELDS.CONSTANT
        };

        if (opts) this.setOpts(opts);

        this.setFieldOptions(this.opts.field);

        this.timeDependent = (this.opts.field.length == 3);
        this.tOrig         = undefined;

        //registers
        this.register = new Vector(0,0,0);

        Force.call(this);
    };

    VectorField.prototype = Object.create(Force.prototype);
    VectorField.prototype.constructor = Force;

    VectorField.FIELDS = {
        CONSTANT            : function(v, opts){ return v.set(opts.direction) },
        LINEAR              : function(v, opts){ return v.set(v.mult(opts.k)) },
        RADIAL_GRAVITY      : function(v, opts){ return v.set(v.mult(-1, v)) },
        SPHERE_ATTRACTOR    : function(v, opts){ return v.set(v.mult((opts.radius - v.norm()) / v.norm())) },
        POINT_ATTRACTOR     : function(v, opts){ return v.set(opts.p.sub(v)) }
    };

    VectorField.prototype.setOpts = function(opts){
        for (var key in opts) this.opts[key] = opts[key];
    };

    VectorField.prototype.evaluate = function(v, t){
        this.register.set(v);
        return this.opts.field(this.register, this.opts, t);
    };

    VectorField.prototype.applyForce = function(particles){
        var force = this.force;
        var t;
        if (this.timeDependent){
            if (this.tOrig) this.tOrig = Date.now();
            t = (Date.now() - this.tOrig) * 0.001; //seconds
        }
        else t = undefined;

        for (var i = 0; i < particles.length; i++){
            var particle = particles[i];
            force.set(this.evaluate(particle.p, t).mult(particle.m * this.opts.strength))
            particle.applyForce(force);
        };
    };

    VectorField.prototype.setFieldOptions = function(field){
        var FIELDS = VectorField.FIELDS;

        switch (field){
            case FIELDS.CONSTANT:
                if (!this.opts.direction) this.opts.direction = new Vector(0,1,0);
                break;
            case FIELDS.POINT_ATTRACTOR:
                if (!this.opts.p) this.opts.p = new Vector(0,0,0);
                break;
            case FIELDS.SPHERE_ATTRACTOR:
                if (!this.opts.radius) this.opts.radius = 1;
                break;
            case FIELDS.LINEAR:
                if (!this.opts.k) this.opts.k = 1;
                break;
        };

    };

    module.exports = VectorField;

});
define('famous-physics/forces/rotationalDrag',['require','exports','module','famous-physics/forces/Force','famous-physics/math/Vector'],function(require, exports, module) {
    var Force = require('famous-physics/forces/Force');
    var Vector = require('famous-physics/math/Vector');

    /** @constructor */
    function RotationalDrag(opts){
        this.opts = {
            strength : .01,
            forceFunction : RotationalDrag.FORCE_FUNCTIONS.LINEAR
        };

        if (opts) this.setOpts(opts);

        Force.call(this);
    };

    RotationalDrag.prototype = Object.create(Force.prototype);
    RotationalDrag.prototype.constructor = Force;

    RotationalDrag.FORCE_FUNCTIONS = {
        LINEAR : function(v){ return v; },
        QUADRATIC : function(v){ return v.mult(v.norm()); }
    };

    RotationalDrag.prototype.applyForce = function(particles){
        var strength        = this.opts.strength;
        var forceFunction   = this.opts.forceFunction;
        var force = this.force;

        //TODO: rotational drag as function of inertia
        for (var index in particles){
            var particle = particles[index];
            forceFunction(particle.w).mult(-100*strength).put(force);
            particle.applyTorque(force);
        };
    };

    RotationalDrag.prototype.setOpts = function(opts){
        for (var key in opts) this.opts[key] = opts[key];
    };

    module.exports = RotationalDrag;
});
define('famous-physics/integrator/verlet',['require','exports','module','../math/Vector'],function(require, exports, module) {
    var Vector = require('../math/Vector');
    // x  = x + (x - xOld) + a * dt * dt
    // v  = (x - xOld) / (2*dt)

    /**
     * @constructor
     */
    function Verlet(options){
        options   = options || {};
        this.vCap = options.vCap || Infinity;
        this.aCap = options.aCap || Infinity;
        this.drag = options.drag || 1;

        this.diff = new Vector();
        this.pOldCopy = new Vector();
        this.dragVector = new Vector();
    };

    Verlet.prototype.integrate = function(particle, dt, firstFrame){

        var pOld    = particle.pOld,
            p       = particle.p,
            a       = particle.a;

        this.diff.set(p.sub(pOld));

        if (firstFrame){
            var v = particle.v;
            if (!particle.hasImmunity('velocity'))
                v.add(a.mult(0.5 * dt), v);

            if (!particle.hasImmunity('position')){
                pOld.set(p);
                p.add(v.mult(dt), p);
            };
        }
        else {
            this.pOldCopy.set(pOld);
            if (!particle.hasImmunity('position')){
                this.dragVector.set(this.diff.mult(this.drag));
                pOld.set(p);
                p.add(a.mult(dt*dt), p);
                p.add(this.dragVector, p);
            };
        };

        // second order accurate velocity for previous time using predictor
        // if (!particle.hasImmunity('velocity'))
        //     particle.v.set(p.sub(this.pOldCopy).div(2 * dt));

    };

    // accelerations
    Verlet.prototype.integrateVelocity = function(particle, dt, firstFrame){
        var p = particle.p;
        var a = particle.a;
        if (firstFrame){
            var v = particle.v;
            v.add(a.mult(0.5 * dt), v);
            p.add(v.mult(dt), p);
        }
        else p.add(a.mult(dt*dt), p);
    };

    // inertia
    Verlet.prototype.integratePosition = function(particle){
        var p        = particle.p;
        var pOld     = particle.pOld;
        var pOldCopy = this.pOldCopy;

        pOldCopy.set(pOld);
        pOld.set(p);
        p.add(p.sub(pOldCopy).mult(this.drag), p);
    };

    module.exports = Verlet;

});
define('famous-physics/math/Random',['require','exports','module'],function(require, exports, module) {
    /**
     * @namespace Random
     *
     * @description
     *  Extremely simple uniform random number generator wrapping Math.random.
     *
     * @name Random
     *
     */

    function _randomFloat(min,max){ return min + Math.random() * (max - min); };
    function _randomInteger(min,max){ return Math.floor(min + Math.random() * (max - min + 1)); };

    module.exports = {

        /**
         * Get single random int between min and max (inclusive), or array
         *   of size dim if specified
         * @name FamousMatrix#int
         * @function
         * @param {number} min
         * @param {number} max
         * @param {number} max
         * @returns {number} random integer, or optionally an array
         */
        integer : function(min,max,dim){
            min = (min !== undefined) ? min : 0;
            max = (max !== undefined) ? max : 1;
            if (dim !== undefined){
                var result = [];
                for (var i = 0; i < dim; i++) result.push(_randomInteger(min,max));
                return result;
            }
            else return _randomInteger(min,max);
        },

        /**
         * Get single random float between min and max (inclusive), or array
         *   of size dim if specified
         * @name FamousMatrix#range
         * @function
         * @param {number} min
         * @param {number} max
         * @returns {number} random float, or optionally an array
         */
        range : function(min,max,dim){
            min = (min !== undefined) ? min : 0;
            max = (max !== undefined) ? max : 1;
            if (dim !== undefined){
                var result = [];
                for (var i = 0; i < dim; i++) result.push(_randomFloat(min,max));
                return result;
            }
            else return _randomFloat(min,max);
        },


        /**
         * Return random sign, either -1 or 1
         *
         * @name FamousMatrix#sign
         * @function
         * @param {number} prob probability of returning 1
         * @returns {number} random sign
         */
        sign : function(prob){
            prob = (prob !== undefined) ? prob : 0.5;
            return (Math.random() < prob) ? 1 : -1;
        },


        /**
         * Return random bool, either true or false
         *
         * @name FamousMatrix#boolean
         * @function
         * @param {number} prob probability of returning true
         * @returns {boolean} random bool
         */
        bool : function(prob){
            prob = (prob !== undefined) ? prob : 0.5;
            return Math.random() < prob;
        }

    };

});
define('famous-physics/utils/PhysicsTransition',['require','exports','module','famous-physics/PhysicsEngine','famous-physics/constraints/StiffSpring','famous-physics/constraints/Wall','famous-physics/math/Vector'],function(require, exports, module) {
    var PE = require('famous-physics/PhysicsEngine');
    // var Spring = require('famous-physics/forces/Spring');
    var Spring = require('famous-physics/constraints/StiffSpring');
    var Wall = require('famous-physics/constraints/Wall');
    var Vector = require('famous-physics/math/Vector');

    /** @deprecated */

    /** @constructor */
    function PhysicsTransition(state){
        this.defaultDefinition = {
            spring : {
                period : 300,
                dampingRatio : 0.5
            },
            v : 0,
            wall : false
        };

        state = state || 0;

        this._anchor    = new Vector(state, 0, 0);
        this.endState   = state;
        this.prevState  = undefined;
        this.direction  = undefined;
        this.atRest     = true;

        this.spring = new Spring({
            anchor : this._anchor
        });

        this.wall = new Wall({
            restitution : 0.5,
            k : 0,
            n : new Vector(-1,0,0)
        });

        this.attachedWall = undefined;

        this.PE = new PE();
        this.particle = this.PE.createParticle({ p : [state, 0, 0]});
        this.attachedSpring = this.PE.attach(this.spring, this.particle);
    }

    PhysicsTransition.forceFunctions = Spring.forceFunctions;

    var restTolerance = 1e-5;
    function _update(){
        if (this.atRest) return;

        this.PE.step();
        var energy = _getEnergy.call(this);
        if (energy < restTolerance) {
            this.atRest = true;
            _setParticlePosition.call(this, this.endState);
            if (this.callback) this.callback();
        };
    }

    function _getEnergy(){
        return this.particle.getEnergy() + this.spring.getEnergy(this.particle);
    }

    function _setupDefinition(def){
        //setup spring
        this.spring.setOpts(def.spring);

        //setup particle
        _setParticleVelocity.call(this, def.v);

        //setup wall
        (def.wall) ? _attachWall.call(this) : _detachWall.call(this);
    }

    function _setTarget(x){
        this.prevState = this.endState;
        this.endState = x;

        if (this.endState - this.prevState > 0)
            this.direction = 1;
        else if (this.endState < 0)
            this.direction = -1;
        else this.direction = 0;


        if (this.attachedSpring !== undefined) this._anchor.x = x;
        if (this.attachedWall   !== undefined) {
            this.wall.setOpts({
                d : Math.abs(x),
                n : [-this.direction, 0, 0]
            });
        };

        //correct for velocity sign
        _setParticleVelocity.call(this, this.direction * _getParticleVelocity.call(this));
    }

    function _attachWall(){
        this.attachedWall = this.PE.attach(this.wall, this.particle);
    }

    function _detachWall(){
        if (this.attachedWall !== undefined) this.PE.detach(this.attachedWall);
    }

    function _setParticlePosition(p){
        this.particle.p.x = p;
    }

    function _setParticleVelocity(v){
        this.particle.v.x = v;
    }

    function _getParticlePosition(){
        return this.particle.p.x;
    }

    function _getParticleVelocity(){
        return this.particle.v.x;
    }

    function _setCallback(callback){
        this.callback = callback;
    }

    PhysicsTransition.prototype.reset = function(pos, vel){
        pos = pos || 0;
        vel = vel || 0;
        this.prevState = undefined;
        _setParticlePosition.call(this, pos);
        _setParticleVelocity.call(this, vel);
        _setTarget.call(this, pos);
        _setCallback.call(this, undefined);
    }

    PhysicsTransition.prototype.getVelocity = function(){
        _update.call(this);
        return _getParticleVelocity.call(this);
    }

    PhysicsTransition.prototype.halt = function(){
        this.set(this.get());
    }

    PhysicsTransition.prototype.get = function(){
        _update.call(this);
        return _getParticlePosition.call(this);
    }

    PhysicsTransition.prototype.set = function(endState, definition, callback){
        if (!definition){
            this.reset(endState)
            if (callback) callback();
            return;
        };

        this.atRest = false;
        _setupDefinition.call(this, definition);
        _setTarget.call(this, endState);
        _setCallback.call(this, callback);
    }

    module.exports = PhysicsTransition;

});
define('famous-physics/utils/PhysicsTransition2',['require','exports','module','famous-physics/PhysicsEngine','famous-physics/constraints/StiffSpring','famous-physics/forces/VectorField','famous-physics/constraints/Wall','famous-physics/math/Vector','famous/EventHandler'],function(require, exports, module) {
    var PE = require('famous-physics/PhysicsEngine');
    var Spring = require('famous-physics/constraints/StiffSpring');
    var VectorField = require('famous-physics/forces/VectorField');
    var Wall = require('famous-physics/constraints/Wall');
    var Vector = require('famous-physics/math/Vector');
    var FEH = require('famous/EventHandler');

    /** @deprecated */

    /*
     * Define a physical transition by specifying a physics tween to a target location
     * after which a spring or wall is attached to give a bounce effect
     * The definition for the transition allows one to specify the parameters of the
     * physics tween, which is an initial velocity and acceleration (thrust), in addition
     * to spring and wall parameters
     */

    /** @constructor */
    function PhysicsTransition(start){

        start = start || 0;
        this.endState  = start;
        this.prevState = undefined;
        this.direction = undefined;

        this.defaultDefinition = {
            transition : {
                curve : {v : 1, thrust : 0},
                duration : 500
            },
            bounce : {period : 0, dampingRatio : 0},
            walls : false
        };

        this._anchor = new Vector(start, 0, 0);

        this.stageOneActive = false;

        this.attachedSpring = undefined;
        this.attachedWall   = undefined;
        this.attachedThrust = undefined;

        this.eventHandler = new FEH();
        this.eventHandler.on('initStageTwo', _stageTwo.bind(this));

        this.PE = new PE();
        this.particle = this.PE.createBody({
            p : [start, 0, 0],
            v : [0, 0, 0]
        });

        this.spring = new Spring({anchor : this._anchor});

        this.thrust = new VectorField({
            strength : 0,
            field : VectorField.FIELDS.CONSTANT,
            direction : [1,0,0]
        });

        this.wall = new Wall({
            restitution : 0.5,
            k : 0,
            n : new Vector(-1,0,0)
        });

    }

    PhysicsTransition.TRANSITIONS = {
        linear  : { v :  1, thrust : 0},
        easeIn  : { v :  0, thrust : 2},
        backIn  : { v : -1, thrust : 2}
    }

    PhysicsTransition.BOUNCE = {
        none    : {dampingRatio : 0,   period : 0},
        low     : {dampingRatio : 0.5, period : 300},
        medium  : {dampingRatio : 0.3, period : 600},
        high    : {dampingRatio : 0.1, period : 800}
    }

    var time;
    PhysicsTransition.forceFunctions = Spring.forceFunctions;

    function _getDirection(){
        return (this.particle.p.x <= this.endState) ? 1 : -1;
    }

    function _setDirection(direction){
        this.direction = direction;
    }

    function _checkDirection(){
        if (this.stageOneActive == true && this.direction != _getDirection.call(this))
            this.eventHandler.emit('initStageTwo');
    }

    function _setupDefinition(def){
        var T = def.transition.duration;
        var curve = def.transition.curve;

        var a, v;
        if (typeof curve == 'string') curve = PhysicsTransition.TRANSITIONS[curve];

        v = this.direction * curve.v;
        a = this.direction * curve.thrust;

        var D = this.endState - this.particle.p.x;

        if (T == 0){
            this.v = v || 0;
            this.a = 0;
        }
        else{
            //solving x0 + v(Tt) + 1/2a(Tt)^2 = D for t
            var scaledDuration;
            if (a == 0){
                scaledDuration = D / (v * T);
            }
            else{
                if (v*v + 2*a*D < 0) console.warn('unphysical choices for (v,a), target cannot be reached');
                scaledDuration = (D > 0)
                    ? (-v + Math.sqrt(v*v + 2*a*D)) / (a * T)
                    : (-v - Math.sqrt(v*v + 2*a*D)) / (a * T);
            }

            this.v = scaledDuration * v;
            this.a = scaledDuration * scaledDuration * a;
        }

        var bounce = def.bounce;
        if (typeof bounce == 'string') bounce = PhysicsTransition.BOUNCE[bounce];

        this.spring.setOpts({
            period          : bounce.period,
            dampingRatio    : bounce.dampingRatio
        });

        this.wallsActive = def.walls;
    }

    function _setTarget(x){
        this.prevState = this.endState;
        this.endState  = x;
        _setDirection.call(this, _getDirection.call(this));
    }

    function _attachSpring(pos){
        if (this.attachedSpring !== undefined) return;
        this._anchor.x = pos;
        this.attachedSpring = this.PE.attach(this.spring, this.particle);
    }

    function _detachSpring(){
        if (this.attachedSpring === undefined) return;
        this.PE.detach(this.attachedSpring, this.particle);
        this.attachedSpring = undefined;
    }

    function _attachWall(position, direction){
        if (!this.wallsActive) return;
        this.wall.setOpts({
            d : Math.abs(position),
            n : [-direction,0,0]
        });
        this.attachedWall = this.PE.attach(this.wall, this.particle);
    }

    function _detachWall(){
        if (this.attachedWall === undefined) return;
        this.PE.detach(this.attachedWall, this.particle);
        this.attachedWall = undefined;
    }

    function _attachThrust(strength){
        this.thrust.setOpts({strength : strength});
        this.attachedThrust = this.PE.attach(this.thrust, this.particle);
    }

    function _detachThrust(){
        if (this.attachedThrust === undefined) return;
        this.PE.detach(this.attachedThrust);
        this.attachedThrust = undefined;
    }

    function _stageOne(){
        this.stageOneActive = true;
        _detachSpring.call(this);
        _detachThrust.call(this);
        _detachWall.call(this);
        _attachThrust.call(this, this.a);
        _setVelocity.call(this, this.v);
        time = Date.now();
    }

    function _stageTwo(){
        console.log('Duration : ', Date.now() - time);
        this.stageOneActive = false;
        _detachThrust.call(this);
        _setPosition.call(this, this.endState);
        _attachSpring.call(this, this.endState);
        _attachWall.call(this, this.endState, this.direction);
    }

    function _setVelocity(v){
        this.particle.v.x = v;
    }

    function _setPosition(p){
        this.particle.p.x = p;
    }

    function _setCallback(callback){
        this.spring.setOpts({callback : callback});
    }

    function _update(){
        this.PE.step();
        _checkDirection.call(this);
    }

    //------------------------------------------------------------PUBLIC METHODS

    PhysicsTransition.prototype.reset = function(p,v){
        v = v || 0;
        p = p || 0;
        this.PE.detachAll();
        _setPosition.call(this, p);
        _setVelocity.call(this, v);
        _setCallback.call(this, undefined);
    }

    PhysicsTransition.prototype.set = function(endState, definition, callback){
        if (!definition){
            this.reset(endState)
            if (callback) callback();
            return;
        };

        _setTarget.call(this, endState);
        _setupDefinition.call(this, definition);
        _setCallback.call(this, callback);
        _stageOne.call(this);
    }

    PhysicsTransition.prototype.get = function(){
        _update.call(this);
        return this.particle.p.x;
    }

    PhysicsTransition.prototype.getVelocity = function(){
        _update.call(this);
        return this.particle.v.x;
    }

    PhysicsTransition.prototype.getTarget = function(){
        return this.endState;
    }

    module.exports = PhysicsTransition;

});
define('famous-physics/utils/StiffSpringTransition',['require','exports','module','famous-physics/PhysicsEngine','famous-physics/constraints/StiffSpring','famous-physics/math/Vector'],function(require, exports, module) {
    var PE = require('famous-physics/PhysicsEngine');
    var Spring = require('famous-physics/constraints/StiffSpring');
    var Vector = require('famous-physics/math/Vector');

     /** @constructor */
    function SpringTransition(state){
        state = state || 0;

        this._anchor    = new Vector(state, 0, 0);
        this.endState   = state;
        this.prevState  = undefined;
        this.atRest     = true;

        this.spring = new Spring({anchor : this._anchor});

        this.PE = new PE();
        this.particle = this.PE.createParticle({ p : [state, 0, 0]});
        this.PE.attach(this.spring, this.particle);
    }

    SpringTransition.DEFAULT_OPTIONS = {
        period : 300,
        dampingRatio : 0.5,
        velocity : 0
    };

    SpringTransition.forceFunctions = Spring.forceFunctions;

    var restTolerance = 1e-5;
    function _update(){
        if (this.atRest) return;

        this.PE.step();
        var energy = _getEnergy.call(this);
        if (energy < restTolerance) {
            this.atRest = true;
            _setParticlePosition.call(this, this.endState);
            if (this.callback) this.callback();
        };
    }

    function _getEnergy(){
        return this.particle.getEnergy() + this.spring.getEnergy(this.particle);
    }

    function _setupDefinition(def){
        var defaults = SpringTransition.DEFAULT_OPTIONS;
        if (def.period === undefined) def.period = defaults.period;
        if (def.dampingRatio === undefined) def.dampingRatio = defaults.dampingRatio;
        if (def.velocity === undefined) def.velocity = defaults.velocity;

        //setup spring
        this.spring.setOpts({
            period : def.period,
            dampingRatio : def.dampingRatio
        });

        //setup particle
        _setParticleVelocity.call(this, def.velocity);
    }

    function _setTarget(x){
        this.prevState = this.endState;
        this.endState = x;

        var direction;
        if (this.endState - this.prevState > 0) direction =  1;
        else if (this.endState < 0)             direction = -1;
        else                                    direction =  0;

        this._anchor.x = x;

        //correct for velocity sign
        _setParticleVelocity.call(this, direction * _getParticleVelocity.call(this));
    }

    function _setParticlePosition(p){
        this.particle.p.x = p;
    }

    function _setParticleVelocity(v){
        this.particle.v.x = v;
    }

    function _getParticlePosition(){
        return this.particle.p.x;
    }

    function _getParticleVelocity(){
        return this.particle.v.x;
    }

    function _setCallback(callback){
        this.callback = callback;
    }

    SpringTransition.prototype.reset = function(pos, vel){
        pos = pos || 0;
        vel = vel || 0;
        this.prevState = undefined;
        _setParticlePosition.call(this, pos);
        _setParticleVelocity.call(this, vel);
        _setTarget.call(this, pos);
        _setCallback.call(this, undefined);
    }

    SpringTransition.prototype.getVelocity = function(){
        _update.call(this);
        return _getParticleVelocity.call(this);
    }

    SpringTransition.prototype.setVelocity = function(v){
        this.call(this, _setParticleVelocity(v));
    }

    SpringTransition.prototype.halt = function(){
        this.set(this.get());
    }

    SpringTransition.prototype.get = function(){
        _update.call(this);
        return _getParticlePosition.call(this);
    }

    SpringTransition.prototype.set = function(endState, definition, callback){
        if (!definition){
            this.reset(endState)
            if (callback) callback();
            return;
        };

        this.atRest = false;
        _setupDefinition.call(this, definition);
        _setTarget.call(this, endState);
        _setCallback.call(this, callback);
    }

    module.exports = SpringTransition;

});
define('famous-physics/utils/WallTransition',['require','exports','module','famous-physics/PhysicsEngine','famous-physics/forces/Spring','famous-physics/constraints/Wall','famous-physics/math/Vector'],function(require, exports, module) {
    var PE = require('famous-physics/PhysicsEngine');
    var Spring = require('famous-physics/forces/Spring');
    // var Spring = require('famous-physics/constraints/StiffSpring');
    var Wall = require('famous-physics/constraints/Wall');
    var Vector = require('famous-physics/math/Vector');

    /*
    * Define a physical transition by attaching a spring and or wall to a target location
    * The definition for the transition allows one to specify the parameters of the
    * spring and wall and starting velocity
    */

     /** @constructor */
    function WallTransition(state){
        state = state || 0;

        this._anchor    = new Vector(state, 0, 0);
        this.endState   = state;
        this.prevState  = undefined;
        this.atRest     = true;

        this.spring = new Spring({anchor : this._anchor});
        this.wall   = new Wall();

        this.PE = new PE();
        this.particle = this.PE.createParticle({ p : [state, 0, 0] });
        this.PE.attach(this.spring, this.particle);
        this.PE.attach(this.wall, this.particle);
    }

    WallTransition.DEFAULT_OPTIONS = {
        period : 300,
        dampingRatio : 0,
        restitution : 0.4,
        velocity : 0
    };

    WallTransition.forceFunctions = Spring.forceFunctions;

    var restTolerance = 1e-5;
    function _update(){
        if (this.atRest) return;

        this.PE.step();
        var energy = _getEnergy.call(this);
        if (energy < restTolerance) {
            this.atRest = true;
            _setParticlePosition.call(this, this.endState);
            if (this.callback) this.callback();
        };
    }

    function _getEnergy(){
        return this.particle.getEnergy() + this.spring.getEnergy(this.particle);
    }

    function _setupDefinition(def){
        var defaults = WallTransition.DEFAULT_OPTIONS;
        if (def.period === undefined) def.period = defaults.period;
        if (def.dampingRatio === undefined) def.dampingRatio = defaults.dampingRatio;
        if (def.velocity === undefined) def.velocity = defaults.velocity;
        if (def.restitution === undefined) def.restitution = defaults.restitution;

        //setup spring
        this.spring.setOpts({
            period : def.period,
            dampingRatio : def.dampingRatio
        });

        //setup wall
        this.wall.setOpts({
            restitution : def.restitution
        });

        //setup particle
        _setParticleVelocity.call(this, def.velocity);
    }

    function _setTarget(x){
        this.prevState = this.endState;
        this.endState = x;

        var direction;
        if (this.endState - this.prevState > 0) direction =  1;
        else if (this.endState < 0)             direction = -1;
        else                                    direction =  0;

        this._anchor.x = x;

        this.wall.setOpts({
            d : Math.abs(x),
            n : [-direction, 0, 0]
        });

        //correct for velocity sign
        _setParticleVelocity.call(this, direction * _getParticleVelocity.call(this));
    }

    function _setParticlePosition(p){
        this.particle.p.x = p;
    }

    function _setParticleVelocity(v){
        this.particle.v.x = v;
    }

    function _getParticlePosition(){
        return this.particle.p.x;
    }

    function _getParticleVelocity(){
        return this.particle.v.x;
    }

    function _setCallback(callback){
        this.callback = callback;
    }

    WallTransition.prototype.reset = function(pos, vel){
        pos = pos || 0;
        vel = vel || 0;
        this.prevState = undefined;
        _setParticlePosition.call(this, pos);
        _setParticleVelocity.call(this, vel);
        _setTarget.call(this, pos);
        _setCallback.call(this, undefined);
    }

    WallTransition.prototype.getVelocity = function(){
        _update.call(this);
        return _getParticleVelocity.call(this);
    }

    WallTransition.prototype.setVelocity = function(v){
        this.call(this, _setParticleVelocity(v));
    }

    WallTransition.prototype.halt = function(){
        this.set(this.get());
    }

    WallTransition.prototype.get = function(){
        _update.call(this);
        return _getParticlePosition.call(this);
    }

    WallTransition.prototype.set = function(endState, definition, callback){
        if (!definition){
            this.reset(endState)
            if (callback) callback();
            return;
        };

        this.atRest = false;
        _setupDefinition.call(this, definition);
        _setTarget.call(this, endState);
        _setCallback.call(this, callback);
    }

    module.exports = WallTransition;

});
define('famous-sync/FastClick',['require','exports','module'],function(require, exports, module) {
    if(!window.CustomEvent) return;
    var clickThreshold = 300;
    var potentialClicks = {};
    document.addEventListener('touchstart', function(event) {
        var timestamp = Date.now();
        for(var i = 0; i < event.changedTouches.length; i++) {
            var touch = event.changedTouches[i];
            potentialClicks[touch.identifier] = timestamp;
        }
    });
    window.addEventListener('touchmove', function(event) {
        for(var i = 0; i < event.changedTouches.length; i++) {
            var touch = event.changedTouches[i];
            delete potentialClicks[touch.identifier];
        }
    });
    document.addEventListener('touchend', function(event) {
        var currTime = Date.now();
        for(var i = 0; i < event.changedTouches.length; i++) {
            var touch = event.changedTouches[i];
            var startTime = potentialClicks[touch.identifier];
            if(startTime && currTime - startTime < clickThreshold) {
                event.preventDefault();
                var clickEvt = new CustomEvent('click', {
                    'bubbles': true,
                    'details': touch
                });
                event.target.dispatchEvent(clickEvt);
            }
            delete potentialClicks[touch.identifier];
        }
    });
});

define('famous-sync/TwoFingerSync',['require','exports','module','famous/EventHandler'],function(require, exports, module) {
    var FEH = require('famous/EventHandler');

    function TwoFingerSync(targetSync,options) {
        this.targetGet = targetSync;

        this.options = {
            scale: 1
        };

        if (options) {
            this.setOptions(options);
        } else {
            this.setOptions(this.options);
        }

        this.input = new FEH();
        this.output = new FEH();

        FEH.setInputHandler(this, this.input);
        FEH.setOutputHandler(this, this.output);

        this.touchAId = undefined;
        this.posA = undefined;
        this.timestampA = undefined;
        this.touchBId = undefined;
        this.posB = undefined;
        this.timestampB = undefined;

        this.input.on('touchstart', this.handleStart.bind(this));
        this.input.on('touchmove', this.handleMove.bind(this));
        this.input.on('touchend', this.handleEnd.bind(this));
        this.input.on('touchcancel', this.handleEnd.bind(this));
    };

    TwoFingerSync.prototype.getOptions = function() {
        return this.options;
    };

    TwoFingerSync.prototype.setOptions = function(options) {
        if(options.scale !== undefined) this.options.scale = options.scale;
    };

    TwoFingerSync.prototype.handleStart = function(event) {
        for(var i = 0; i < event.changedTouches.length; i++) {
            var touch = event.changedTouches[i];
            if(!this.touchAId) {
                this.touchAId = touch.identifier;
                this.posA = [touch.pageX, touch.pageY];
                this.timestampA = Date.now();
            }
            else if(!this.touchBId) {
                this.touchBId = touch.identifier;
                this.posB = [touch.pageX, touch.pageY];
                this.timestampB = Date.now();
                this._startUpdate();
            }
        }
    };

    TwoFingerSync.prototype.handleMove = function(event) {
        if(!(this.touchAId && this.touchBId)) return;
        var prevTimeA = this.timestampA;
        var prevTimeB = this.timestampB;
        var diffTime;
        for(var i = 0; i < event.changedTouches.length; i++) {
            var touch = event.changedTouches[i];
            if(touch.identifier == this.touchAId) {
                this.posA = [touch.pageX, touch.pageY];
                this.timestampA = Date.now();
                diffTime = this.timestampA - prevTimeA;
            }
            else if(touch.identifier == this.touchBId) {
                this.posB = [touch.pageX, touch.pageY];
                this.timestampB = Date.now();
                diffTime = this.timestampB - prevTimeB;
            }
        }
        if(diffTime) { //change detected
            this._moveUpdate(diffTime);
        }
    };

    TwoFingerSync.prototype.handleEnd = function(event) {
        var pos = this.targetGet();
        var scale = this.options.scale;
        for(var i = 0; i < event.changedTouches.length; i++) {
            var touch = event.changedTouches[i];
            if(touch.identifier == this.touchAId || touch.identifier == this.touchBId) {
                if(this.touchAId && this.touchBId) this.output.emit('end', {p: pos, v: scale*this._vel, touches: [this.touchAId, this.touchBId], angle: this._angle});
                this.touchAId = undefined;
                this.touchBId = undefined;
            }
        }
    };

    module.exports = TwoFingerSync;

});

define('famous-sync/PinchSync',['require','exports','module','./TwoFingerSync'],function(require, exports, module) {
    var TwoFingerSync = require('./TwoFingerSync');

    function PinchSync(targetSync,options) {
        TwoFingerSync.call(this,targetSync,options);
        this._dist = undefined;
    }

    PinchSync.prototype = Object.create(TwoFingerSync.prototype);

    function _calcDist(posA, posB) {
        var diffX = posB[0] - posA[0];
        var diffY = posB[1] - posA[1];
        return Math.sqrt(diffX*diffX + diffY*diffY);
    };

    PinchSync.prototype._startUpdate = function() {
        this._dist = _calcDist(this.posA, this.posB);
        this._vel = 0;
        this.output.emit('start', {count: event.touches.length, touches: [this.touchAId, this.touchBId], distance: this._dist});
    };

    PinchSync.prototype._moveUpdate = function(diffTime) {
        var currDist = _calcDist(this.posA, this.posB);
        var diffZ = currDist - this._dist;
        var veloZ = diffZ / diffTime;

        var prevPos = this.targetGet();
        var scale = this.options.scale;
        this.output.emit('update', {p: prevPos + scale*diffZ, v: scale*veloZ, touches: [this.touchAId, this.touchBId], distance: currDist});

        this._dist = currDist;
        this._vel = veloZ;
    };

    module.exports = PinchSync;
});

define('famous-sync/RotateSync',['require','exports','module','./TwoFingerSync'],function(require, exports, module) {
    var TwoFingerSync = require('./TwoFingerSync');

    function RotateSync(targetSync,options) {
        TwoFingerSync.call(this,targetSync,options);
        this._angle = undefined;
    }

    RotateSync.prototype = Object.create(TwoFingerSync.prototype);

    function _calcAngle(posA, posB) {
        var diffX = posB[0] - posA[0];
        var diffY = posB[1] - posA[1];
        return Math.atan2(diffY, diffX);
    };

    RotateSync.prototype._startUpdate = function() {
        this._angle = _calcAngle(this.posA, this.posB);
        this._vel = 0;
        this.output.emit('start', {count: event.touches.length, touches: [this.touchAId, this.touchBId], angle: this._angle});
    };

    RotateSync.prototype._moveUpdate = function(diffTime) {
        var currAngle = _calcAngle(this.posA, this.posB);
        var diffTheta = currAngle - this._angle;
        var velTheta = diffTheta / diffTime;

        var prevPos = this.targetGet();
        var scale = this.options.scale;
        this.output.emit('update', {p: prevPos + scale*diffTheta, v: scale*velTheta, touches: [this.touchAId, this.touchBId], angle: currAngle});

        this._angle = currAngle;
        this._vel = velTheta;
    };

    module.exports = RotateSync;
});

define('famous-sync/ScaleSync',['require','exports','module','./TwoFingerSync'],function(require, exports, module) {
    var TwoFingerSync = require('./TwoFingerSync');

    function ScaleSync(targetSync,options) {
        TwoFingerSync.call(this,targetSync,options);
        this._startDist = undefined;
        this._prevScale = undefined;
        this.input.on('pipe', _reset.bind(this));
    }

    ScaleSync.prototype = Object.create(TwoFingerSync.prototype);

    function _calcDist(posA, posB) {
        var diffX = posB[0] - posA[0];
        var diffY = posB[1] - posA[1];
        return Math.sqrt(diffX*diffX + diffY*diffY);
    };

    function _reset() {
        this.touchAId = undefined;
        this.touchBId = undefined;
    };

    ScaleSync.prototype._startUpdate = function() {
        this._prevScale = 1;
        this._startDist = _calcDist(this.posA, this.posB);
        this._vel = 0;
        this.output.emit('start', {count: event.touches.length, touches: [this.touchAId, this.touchBId], distance: this._startDist});
    };

    ScaleSync.prototype._moveUpdate = function(diffTime) {
        var currDist = _calcDist(this.posA, this.posB);
        var currScale = currDist / this._startDist;
        var diffScale = currScale - this._prevScale;
        var veloScale = diffScale / diffTime;

        var prevPos = this.targetGet();
        var scale = this.options.scale;
        this.output.emit('update', {p: prevPos + scale*diffScale, v: scale*veloScale, touches: [this.touchAId, this.touchBId], distance: currDist});

        this._prevScale = currScale;
        this._vel = veloScale;
    };

    module.exports = ScaleSync;
});

define('famous-ui/Buttons/ButtonBase',['require','exports','module','famous/Surface','famous/View','famous/Matrix','famous/Modifier','famous-animation/Easing'],function(require, exports, module) {     
    var Surface = require('famous/Surface'); 
    var View = require('famous/View');
    var FM = require('famous/Matrix');      
    var Modifier = require('famous/Modifier');
    var Easing = require('famous-animation/Easing');

    function ButtonBase ( options ) {
        View.apply( this, arguments );
        this.eventInput.pipe( this.eventOutput );

        this.surface = new Surface(this.options.surfaceOptions); 

        this.surface.pipe(this); 

        this.transform = new Modifier({ 
            size: this.surface.getSize() 
        });

        this.node.link( this.transform ).link( this.surface );

        this.surface.pipe( this );

        this.surface.on('click', this._handleClick.bind(this));

        this._state = false;
        
    }
    ButtonBase.prototype = Object.create( View.prototype );
    ButtonBase.prototype.constructor = ButtonBase;

    ButtonBase.DEFAULT_OPTIONS = {
        surfaceOptions: {},
        openState: FM.identity,
        closeState: FM.rotateZ( Math.PI * 0.75 ),
        transition: { 
            curve: Easing.inOutBackNorm,
            duration: 500
        }
    }; 

    ButtonBase.prototype._handleClick = function () {
        
    }

    ButtonBase.prototype.halt = function () {
        this.transform.halt();
    }    

    ButtonBase.prototype.setTransform = function () {
        this.transform.setTransform.apply( this.transform, arguments ); 
    }
    ButtonBase.prototype.setOpacity = function () {
        this.transform.setOpacity.apply( this.transform, arguments ); 
    }
    

    ButtonBase.prototype.getSize = function () {
        return this.surface.getSize(); 
    };

    module.exports = ButtonBase;
});

define('famous-ui/Buttons/RotateButton',['require','exports','module','famous/Surface','famous/View','famous/Matrix','famous/Modifier','famous-animation/Easing','./ButtonBase'],function(require, exports, module) {     
    var Surface = require('famous/Surface'); 
    var View = require('famous/View');
    var FM = require('famous/Matrix');      
    var Modifier = require('famous/Modifier');
    var Easing = require('famous-animation/Easing');

    var ButtonBase = require('./ButtonBase');

    function RotateButton ( options ) {
        ButtonBase.apply( this, arguments );

        this.transform.setOrigin([ 0.5, 0.5 ]);
        this._state = false;
        
    }

    RotateButton.prototype = Object.create( ButtonBase.prototype );
    RotateButton.prototype.constructor = RotateButton;

    RotateButton.DEFAULT_OPTIONS = {
        surfaceOptions: {},
        openState: FM.identity,
        closeState: FM.rotateZ( Math.PI * 0.75 ),
        transition: { 
            curve: Easing.inOutBackNorm,
            duration: 500
        }
    }; 

    RotateButton.prototype._handleClick = function (e ) {
        e.stopPropagation();
        this.toggle(); 
    }

    RotateButton.prototype.getSize = function () {
        return this.surface.getSize(); 
    };

    RotateButton.prototype.toggle = function (e) {
        if( this._state == false ) {
            this.open(); 
        } else { 
            this.close();
        }
    };

    RotateButton.prototype.open = function () {
        this._state = true;
        this.transform.halt();
        this.emit('open');
        this.transform.setTransform( this.options.closeState, this.options.transition);
    }; 

    RotateButton.prototype.close = function () {
        this._state = false;
        this.transform.halt();
        this.emit('close');
        this.transform.setTransform( this.options.openState, this.options.transition);
    };

    module.exports = RotateButton;
});

define('famous-ui/Buttons/SpringButton',['require','exports','module','famous-physics/PhysicsEngine','famous/View','famous-physics/forces/Spring','famous/Surface','famous-physics/math/Vector','famous-utils/Utils'],function(require, exports, module) { 
    var PhysicsEngine = require('famous-physics/PhysicsEngine');
    var View = require('famous/View');
    var Spring = require('famous-physics/forces/Spring');
    var Surface = require('famous/Surface');
    var Vector3 = require('famous-physics/math/Vector');
    var Utils = require('famous-utils/Utils');

    function SpringButton (options) {
        View.apply(this, arguments);
        this.eventInput.pipe( this.eventOutput );

        this.PE = new PhysicsEngine();
        this.available = true;
        
        this.anchor = this.PE.createParticle({ 
            p: this.options.pos,
            v: this.options.vel,
            immunity: true
        });

        this.particle = this.PE.createParticle({ 
            p: this.options.pos,
            v: this.options.vel,
        });

        this.spring = new Spring({ 
            period          : this.options.springPeriod,
            dampingRatio    : this.options.springDampingRatio,
            length          : this.options.springLength,
            anchor          : this.options.pos,
            callback        : selection.bind(this)
        });

        this.PE.attach(this.spring, this.particle);

        this.surface = new Surface({
            size: this.options.size, 
            content: this.options.content,
            classes: this.options.surfaceClasses,
            properties: this.options.surfaceProperties
        });
        this.surface.pipe(this);

        this.on('click', _handleClick.bind(this));
    }
    
    SpringButton.prototype = Object.create(View.prototype);
    SpringButton.prototype.constructor = SpringButton;
    
    SpringButton.DEFAULT_OPTIONS = {
        size: [200, 200],
        pos: [0, 0, 0],
        vel: [0, 0, 0],
        springPeriod: 200,
        springDampingRatio: 0.8,
        springLength: 0,
        content: '', 
        surfaceProperties: {},
        surfaceClasses: [],
        limitTouches: false,
        forceMult: [10, 10, 10],
        padding: 0,
        callbackTolerance : 1e-4,
        clickForce: [0, 0, -0.005]
    }
    

    SpringButton.prototype.setPeriod = function (val) {
       this.spring.setPeriod(val);
    };   
    
    SpringButton.prototype.setDamping = function (val) {
       this.spring.setDampingRatio(val);
    };   
    
    SpringButton.prototype.setCallbackTolerance = function (val) {
       this.spring.opts.callbackTolerance = val;
    };

    SpringButton.prototype.addForce = function (_force) {

        var force = { x: 0, y: 0, z: 0 }; 

        if ( Utils.isArray( _force) ) { 
            force.x = _force[0] * this.options.forceMult[0];
            force.y = _force[1] * this.options.forceMult[1];
            force.z = _force[2] * this.options.forceMult[2];
        } else {
            force.x = _force.x * this.options.forceMult[0];
            force.y = _force.y * this.options.forceMult[1];
            force.z = _force.z * this.options.forceMult[2];
        }
        if(this.options.limitTouches) { 
            if(this.available) {
                this.particle.applyForce(force);
                this.available = false;

                this.emit('selection');
            }

        } else { 
            this.particle.applyForce(force) 
            this.emit('selection');
                
        }            
    };

    SpringButton.prototype.render = function () {

        this.PE.step();    

        return { 
            opacity: 1,
            transform: this.PE.getTransform(this.particle),
            target: this.surface.render()
        };
    };

    function _handleClick () {

        this._addForce( this.options.clickForce )   
        
    }

    function selection (e) {

        if( this.options.limitTouches ) { 
            this.available = true;
        }
        
    }
    module.exports = SpringButton;
});

define('famous-ui/Buttons/SpringButton.ui',['require','exports','module','./SpringButton'],function(require, exports, module) { 
    var SpringButton = require('./SpringButton');

    function SpringButtonAutoUI( options ) {
        SpringButton.apply( this, arguments ); 
        this.autoUI = 
        [
            // PHYSICS
            {
                type: 'label',
                uiOptions: {
                    content: 'PHYSICS',
                    properties: { 
                        'border-bottom' : '1px solid #f2786f',
                        'color' : '#f2786f',
                        'font-size': '16px'
                    }
                }
            },
            {
                option: 'springPeriod',
                type: 'slider',
                uiOptions: { 
                    range: [100, 2000],
                    name: 'SPRING DURATION'
                }
            },
            {
                option: 'springPeriod',
                callback: this.setDamping,
                type: 'slider',
                uiOptions: { 
                    range: [0.002, 0.8],
                    name: 'SPRING DAMPING'
                }
            },

            // APPEARANCE
            {
                type: 'label',
                uiOptions: {
                    content: 'APPEARANCE',
                    properties: { 
                        'border-bottom' : '1px solid white',
                        'color' : 'rgba( 255, 255, 255, 1 )',
                        'font-size': '16px'
                    }
                }
            },
            {
                callback: this.setBackgroundColor,
                type: 'colorPicker',
                uiOptions: {
                    name: 'Background Color'
                }
            },
            {
                callback: this.setBorderColor,
                type: 'colorPicker',
                uiOptions: {
                    name: 'Stroke Color'
                }
            },
            {
                callback: this.setBorderRadius,
                type: 'slider',
                uiOptions: { 
                    range: [0, 100],
                    name: 'BORDER RADIUS'
                }
            }
        ]; 
    }

    SpringButtonAutoUI.prototype = Object.create( SpringButton.prototype );
    SpringButtonAutoUI.prototype.constructor = SpringButtonAutoUI; 
    
    SpringButtonAutoUI.prototype.setPeriod = function ( val ) {
        this.setOptions({ period: val });
    };

    SpringButtonAutoUI.prototype.setDamping = function ( val ) {
        this.setOptions({ dampingRatio: val });
    };
    
    SpringButtonAutoUI.prototype.setBackgroundColor = function ( arg ) {
        this.surface.setProperties({ 
            'background-color': arg.getCSSColor()
        });
    };
    
    SpringButtonAutoUI.prototype.setBorderColor = function ( arg ) {
        this.surface.setProperties({ 
            'border': '1px solid ' + arg.getCSSColor()
        });
    };

    SpringButtonAutoUI.prototype.setBorderRadius = function ( arg ) {
        this.surface.setProperties({ 
            'border-radius': arg + 'px'
        });
    };

    module.exports = SpringButtonAutoUI;
});

define('famous-ui/ColorPicker/ColorButton',['require','exports','module','famous/EventHandler','famous/CanvasSurface'],function(require, exports, module) {
    var FEH = require('famous/EventHandler');
    var CanvasSurface = require('famous/CanvasSurface');
 
    /*
     *  @class ColorButton : A canvas surface that is meant to draw background colors
     *      very frequently at highest framerate possible.
     *  @description : used in ColorPicker.
     *
     *  @name ColorButton
     *  @constructor
     */
    function ColorButton(size, initialColor) {
        this.size = size;
        this.canvasSize = [this.size[0]*2, this.size[1]*2];

        CanvasSurface.call(this, {size: this.size, canvasSize: this.canvasSize });
        
        this.color = initialColor;
        this.colorSurface(this.color.getHex());
    }
    ColorButton.prototype = Object.create(CanvasSurface.prototype);

    ColorButton.prototype.colorSurface = function(color) {
        var ctx = this.getContext('2d');

        ctx.clearRect( 0, 0, this.canvasSize[0], this.canvasSize[1]);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, this.canvasSize[0], this.canvasSize[1]);
    };

    module.exports = ColorButton;
});

define('famous-ui/ColorPicker/CanvasPicker',['require','exports','module','famous/Surface','famous/CanvasSurface','famous/Matrix','famous/EventHandler','famous/Modifier','famous-utils/Utils','famous-color/Color','famous/Engine','famous-animation/Easing','./ColorButton','famous/View'],function(require, exports, module) {
    var Surface = require('famous/Surface');
    var CanvasSurface = require('famous/CanvasSurface');
    var FM = require('famous/Matrix');
    var FEH = require('famous/EventHandler');
    var Modifier = require('famous/Modifier');
    var Utils = require('famous-utils/Utils');
    var Color = require('famous-color/Color');
    var Engine = require('famous/Engine');
    var Easing = require('famous-animation/Easing');
    var ColorButton = require('./ColorButton'); 
    var View = require('famous/View');
    
    /*
     *  Base class for GradientPicker, HuePicker and AlphaPicker.
     *  Creates a gradient on a canvas surface and a picker surface. 
     */
    function CanvasPicker(size, initialColor, opts) {
        View.call(this, opts);

        this.eventInput.pipe( this.eventOutput );
        
        this.size = size;
        this.color = initialColor.clone();
        this.name = name;
        this.pos = [];
        this._dirty = true;
        this.canvasSize = [this.size[0]*2, this.size[1]*2];

        this._selectedCoords = [
            Utils.map(this.options.pickerPosX, 0, 1, 0, this.size[0]-1, true),
            Utils.map(this.options.pickerPosY, 0, 1, 0, this.size[1]-1, true),
        ];
 
        this.gradient = new CanvasSurface({
            size: [this.size[0], this.size[0]],
            canvasSize: [this.size[0]*2, this.size[0]*2]
        });

        var pickerPos = getPickerPos.call(this, this.size[0] * this.options.pickerPosX, this.size[1] * this.options.pickerPosY);

        this.pickerTransform = new Modifier({ 
            transform: FM.translate(pickerPos[0], pickerPos[1], 0)
        });

        if(this.options.colorPicker) {
            this.picker = new ColorButton(this.options.pickerSize, this.color);
        } else {
            this.picker = new Surface({ size: this.options.pickerSize, classes: ['ui-color-picker'] });
        }

        this.picker.setProperties(this.options.pickerProperties);

        this._mousemove = mousemove.bind(this);
        this._mouseup = mouseup.bind(this);
        
        this.gradient.on('mousedown', mousedown.bind(this));
        this.picker.on('mousedown', mousedown.bind(this));

        this.gradient.on('touchstart', touchstart.bind(this));
        this.picker.on('touchstart', touchstart.bind(this));

        this.gradient.on('touchmove', touchmove.bind(this));
        this.picker.on('touchmove', touchmove.bind(this));

        this.gradient.on('click', blockEvent);
        this.picker.on('click', blockEvent);
        
        this.on('updatePosition', this.updateColor.bind(this));
        this.on('updatePosition', updatePicker.bind(this));

        // Render Tree
        this.node.add(this.pickerTransform).link(this.picker);
        this.node.add(this.gradient);

    }

    CanvasPicker.prototype = Object.create(View.prototype);
    CanvasPicker.prototype.constructor = CanvasPicker;

    CanvasPicker.DEFAULT_OPTIONS = { 
        pickerSize: [4, 25],
        transition: {
            curve: Easing.inSineNorm,
            duration: 50
        },
        pickerPosX: 0,
        pickerPosY: 0,
        pickerZ: 2,
        railsY: false,
        pickerProperties: {},
        colorPicker: false
    }

    CanvasPicker.prototype.drawGradient = function(color) {
        /* in hue / alpha / gradient picker */
    };

    /**
     * Get the color.
     * @name CanvasPicker#getColor
     * @function
     * @return {FamousColor}. 
     */
    CanvasPicker.prototype.getColor = function() {
        return this.color;
    };

    /**
     * Get the size of the widget.
     * @name CanvasPicker#getSize
     * @function
     * @return {Array : number} size : of item. 
     */
    CanvasPicker.prototype.getSize = function() {
        return this.size;
    };

    /**
     * Read the color from the selected coordinate point of the canvas.
     * @name CanvasPicker#updateColor
     * @function
     */
    CanvasPicker.prototype.updateColor = function() {
        var ctx = this.gradient.getContext('2d');
        var data = ctx.getImageData(this._selectedCoords[0]*2, this._selectedCoords[1]*2, 1, 1).data;
        
        this.color.setFromRGBA(data[0], data[1], data[2]);
        this.emit('change', {value: this.color});
    };

    /**
     * Read the color from the selected coordinate point of the canvas.
     * @name #updatePicker
     * @param {Object} e : e.shouldAnimate comes from mousedown function, if you click once, it will animate to that position.
     *      Otherwise, it will instantly place the picker in the desired position. 
     * @function
     * @private
     */
    function updatePicker(e) {
        var pickerPos = getPickerPos.call(this, this._selectedCoords[0], this._selectedCoords[1]);

        if(this.options.railsY) pickerPos[1] = 0;

        this.pickerTransform.halt();
        
        if(e.shouldAnimate) {
            this.pickerTransform.setTransform(FM.translate(pickerPos[0], pickerPos[1], this.options.pickerZ), this.options.transition);
        } else {
            this.pickerTransform.setTransform(FM.translate(pickerPos[0], pickerPos[1], this.options.pickerZ));
        }
    }

    /**
     * Get the pixel position for placement of the picker.
     * @name #getPickerPos
     * @param {Number} x : selectedCoord x
     * @param {Number} y : selectedCoord y
     * @function
     * @private
     */
    function getPickerPos(x, y) {
        var halfPicker = this.options.pickerSize[0] * 0.5;

        return [
            Utils.map(x, 0, this.size[0], - halfPicker, this.size[0] - halfPicker, true),
            this.options.railsY ? 0 : Utils.map(y, 0, this.size[1], - halfPicker, this.size[1] - halfPicker, true)
        ];
    }

    // Start Events
    function mousedown(event) {
        event.preventDefault(); event.stopPropagation();
        this._dirty = true;
        eventChange.call(this, event, true);
        Engine.on('mousemove', this._mousemove);
        Engine.on('mouseup', this._mouseup);
        
    }
    function touchstart(event) {
        this._dirty = true;
        event.preventDefault(); event.stopPropagation();
        eventChange.call(this, event.touches[0]);
    }
    // Drag Events
    function mousemove(event) {
        event.preventDefault(); event.stopPropagation();
        eventChange.call(this, event);
    }

    // End Events
    function mouseup(event) {
        event.preventDefault(); event.stopPropagation();
        Engine.unbind('mousemove', this._mousemove);
        Engine.unbind('mouseup', this._mouseup);
    }
    function touchmove(event) {
        event.preventDefault(); event.stopPropagation();
        eventChange.call(this, event.touches[0]);
    }
    function touchend(event) {
        event.preventDefault(); event.stopPropagation();
        eventChange.call(this, event.touches[0]);
    }

    function mouseout(e) { }

    function blockEvent(event) {
        event.preventDefault(); event.stopPropagation();
    }


    function eventChange(e, shouldAnimate) {
        if(this._dirty) {
            this.pos = Utils.getSurfacePosition(this.gradient);
            this._dirty = false;
        }
        this._selectedCoords = [
            Utils.clamp(e.pageX - this.pos[0], 0, this.size[0]-1),
            Utils.clamp(e.pageY - this.pos[1], 0, this.size[1]-1)
        ];
        this.emit('updatePosition', {shouldAnimate: shouldAnimate});
    }

    module.exports = CanvasPicker;
});

define('famous-ui/Easing/CanvasDrawer',['require','exports','module'],function(require, exports, module) {
    // will never type these out again.
    function lineTo(ctx, x1, y1, x2, y2) { 
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.closePath();
    }

    function rect(ctx, x1, y1, w, h) { 
        ctx.beginPath();
        ctx.rect(x1, y1, w, h);
        ctx.fill();
        ctx.closePath();
    }
    
    module.exports = {
        lineTo: lineTo,
        rect: rect
    }
});

define('famous-ui/ColorPicker/AlphaPicker',['require','exports','module','famous/Surface','famous-color/Color','./CanvasPicker','famous-ui/Easing/CanvasDrawer'],function(require, exports, module) {
    var Surface = require('famous/Surface');
    var Color = require('famous-color/Color');
    var CanvasPicker = require('./CanvasPicker');
    var CanvasDrawer = require('famous-ui/Easing/CanvasDrawer');

    /*
     *  @class AlphaPicker : selection of alpha ( transparency ).
     *  @description : used in ColorPicker.
     *
     *  @name AlphaPicker
     *  @constructor
     */
    function AlphaPicker(size, initialColor, pickerSize) { 

        var pSize = pickerSize || [35, 35];

        CanvasPicker.call(this, size, initialColor, {
            railsY: true,
            pickerProperties: {
                border: '3px solid white',
                borderRadius: size[0]/2 + 'px',
                boxShadow: '0px 1px 0px #888',
                marginTop: '2px'
            },
            pickerPosX: initialColor.a,
            pickerSize: pSize,
            colorPicker: true,
            normalizedColors: true
        });

        this.alpha = this.color.a;

        this.backgroundCanvas = initBackground.call(this);
        this.drawGradient();

        this.on('change', this.drawPickerColor.bind(this));
        this.pickerColor;
    }
    AlphaPicker.prototype = Object.create(CanvasPicker.prototype);

    /**
     * Color the picker. Set to auto update based on the currently 
     * selected color
     * @name AlphaPicker#drawPickerColor
     * @function
     * @param { Object } e : selected color emitted over the event
     */
    AlphaPicker.prototype.drawPickerColor = function(e) {
        this.picker.colorSurface(e.value.getCSSColor());
    }

    AlphaPicker.prototype.setColor = function (color) {

        this.color = color;
        this.drawGradient();
        this.drawPickerColor({value: this.color});
        
    }

    /**
     * Draw the gradient.
     * @name AlphaPicker#drawGradient
     * @function
     * @param { FamousColor } : selected color
     */
    AlphaPicker.prototype.drawGradient = function() { 
        var ctx = this.gradient.getContext('2d');

        ctx.clearRect(0, 0, this.canvasSize[0], this.canvasSize[1]);
        ctx.drawImage( this.backgroundCanvas, 0, 0 );

        var color = this.color.clone();
        color.a = 0;

        createAlphaGradient.call(this, ctx, [0, 0], [1, 1], color.getCSSColor() );
    }

    /**
     * Calculate the alpha. Set the alpha and emit an event.
     * @name AlphaPicker#updateColor
     * @function
     */
    AlphaPicker.prototype.updateColor = function () {
        var alpha = parseFloat( (this._selectedCoords[0] / this.size[0]).toFixed( 2 ) ); 
        this.color.a = alpha;
        this.emit('change', { value: this.color });
    }

    /**
     * Create the main gradient. It draws from 0 to 1 in alpha.
     * @name #createAlphaGradient
     * @function
     * @return {Canvas}. 
     * @private
     */
    function createAlphaGradient(ctx, startOrigin, endOrigin, color) { 
        // remove only alpha part of rgba string
        colorAlpha = color.substring(0, color.length - 2);
        
        var gradient = ctx.createLinearGradient(
            this.canvasSize[0]*startOrigin[0], this.canvasSize[1]*startOrigin[1], 
            this.canvasSize[0]*endOrigin[0], this.canvasSize[1]*endOrigin[1]
        );

        gradient.addColorStop(0, colorAlpha + '0)');
        gradient.addColorStop(1, colorAlpha + '1)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvasSize[0], this.canvasSize[1]);
    }

    /**
     * Create the background canvas. It draws grey and white tiled squares to represent transparency.
     * @name #initBackground
     * @function
     * @return {Canvas}. 
     * @private
     */
    function initBackground () {
        var canvas = document.createElement('canvas');
        canvas.width = this.canvasSize[0];
        canvas.height = this.canvasSize[1];

        var ctx = canvas.getContext('2d');
        // white background
        ctx.fillStyle = '#ffffff';
        CanvasDrawer.rect( ctx, 0, 0, this.canvasSize[0], this.canvasSize[1] );

        // tiled grey squares
        ctx.fillStyle = '#cccccc';

        var columns = 16;
        var rows = 2;

        var width = height = this.canvasSize[0] / columns;

         for (var i = 0; i < columns; i++) {
             for (var j = 0; j < rows; j++) {

                 // every other one
                 if( i % 2 == 0 && j % 2 == 0) {
                    
                     CanvasDrawer.rect( ctx, width * i, j * height, width, height );

                 }  else if( i % 2 == 1 && j % 2 == 1 ) { 

                     CanvasDrawer.rect( ctx, width * i, j * height, width, height );
                     
                 }
             };
         };
         return canvas;
    }

    module.exports = AlphaPicker;
});

define('famous-ui/ColorPicker/GradientPicker',['require','exports','module','famous-color/Color','./CanvasPicker'],function(require, exports, module) {
    var Color = require('famous-color/Color');
    var CanvasPicker = require('./CanvasPicker');
    
    /*
     *  @class GradientPicker : selection of saturation / lightness.
     *  @description : used in ColorPicker.
     *
     *  @name GradientPicker
     *  @constructor
     */
    function GradientPicker(size, initialColor) { 
        var saturation =  initialColor.getSaturation() / 100;
        var brightness  = initialColor.getBrightness() / 100;
        initialColor.setSaturation( 100 );

        CanvasPicker.call(this, size, initialColor, {
            pickerSize: [26, 26],
            pickerProperties: { 
                borderRadius: '13px',
                border: '1px solid white'
            },
            pickerPosX: saturation,
            pickerPosY: 1 - brightness 
        }); 

        this.drawGradient(this.color.getCSSColor());
    }
    GradientPicker.prototype = Object.create(CanvasPicker.prototype);

    /**
     * Draw the gradient.
     * @name GradientPicker#drawGradient
     * @function
     * @param { FamousColor } : selected color
     */
    GradientPicker.prototype.drawGradient = function(color) { 
        var ctx = this.gradient.getContext('2d');

        ctx.clearRect(0, 0, this.canvasSize[0], this.canvasSize[1]);
        createGradient.call(this, ctx, 'rgba(255, 255, 255, 1)', color, [0, 0.5], [1, 0.5]);
        createGradient.call(this, ctx, 'rgba(0, 0, 0, 1)', 'rgba(0, 0, 0, 0)', [0.5, 1], [0.5, 0]);
        this.updateColor();
        
    }

    /**
     * Called twice to draw two gradients: 
     *  1. horizontal: from white to active color and 
     *  2. vertical: overlay from black transparent to full 
     *  transparent to allow you to select saturation and brightness.
     *
     * @name #createGradient
     * @param { ctx } 2d canvas context to draw to
     * @param { String } startColor : color to start drawing
     * @param { String } endColor : end color to draw.
     * @param { Array: [number, number] } startOrigin : Origin relative to canvas size to start drawing the gradient 
     * @param { Array: [number, number] } endOrigin   : Origin relative to canvas size to start drawing the gradient 
     * @function
     * @private
     */
    function createGradient(ctx, startColor, endColor, startOrigin, endOrigin) { 
        
        var gradient = ctx.createLinearGradient(
            this.canvasSize[0]*startOrigin[0], this.canvasSize[1]*startOrigin[1], 
            this.canvasSize[0]*endOrigin[0], this.canvasSize[1]*endOrigin[1]
        );

        gradient.addColorStop(0, startColor);
        gradient.addColorStop(1, endColor);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvasSize[0], this.canvasSize[1]);

    }
    module.exports = GradientPicker;
});

define('famous-ui/ColorPicker/HuePicker',['require','exports','module','famous-color/Color','./CanvasPicker'],function(require, exports, module) {
    var Color = require('famous-color/Color');
    var CanvasPicker = require('./CanvasPicker');
    
    /*
     *  @class HuePicker : selection of hue.
     *  @description : used in ColorPicker.
     *
     *  @name HuePicker
     *  @constructor
     */
    function HuePicker(size, initialColor, pickerSize) { 
        // only get full hue of color.
        var hueColor = new Color();
        var hue = initialColor.getHue(); 
        hueColor.setFromHSL(hue, 100.0, 50.0);

        var pSize = pickerSize || [35, 35];
        CanvasPicker.call(this, size, hueColor, {
            railsY: true,
            pickerProperties: {
                border: '2px solid white',
                borderRadius: size[0]/2 + 'px',
                boxShadow: '0px 1px 0px #888',
                marginTop: '2px'
            },
            pickerPosX: 1 - hue / 360,
            pickerSize: pSize,
            colorPicker: true,
            normalizedColors: true
        });

        this.drawGradient(this.color.getCSSColor());

        this.on('change', this.drawPickerColor.bind(this));
        this.pickerColor;
    }
    HuePicker.prototype = Object.create(CanvasPicker.prototype);

    /**
     * Color the picker. Set to auto update based on the currently 
     *  selected color
     * @name HuePicker#drawPickerColor
     * @function
     * @param { Object } e : selected color emitted over the event
     */
    HuePicker.prototype.drawPickerColor = function(e) {
        if(this.pickerColor !== e.value.hex) { 
            this.picker.colorSurface(e.value.hex);
            this.pickerColor = e.value.hex;
        }
    };

    /**
     * Draw the gradient.
     * @name AlphaPicker#drawGradient
     * @function
     * @param { FamousColor } : selected color
     */
    HuePicker.prototype.drawGradient = function(color) { 

        var ctx = this.gradient.getContext('2d');

        ctx.clearRect(0, 0, this.canvasSize[0], this.canvasSize[1]);
        drawRainbow.call(this, ctx, [0, 0.5], [1, 0.5]);

    }

    /**
     * Draw full spectrum to canvas.
     * @name #drawRainbow
     * @param { ctx } 2d canvas context to draw to
     * @param { Array: [number, number] } startOrigin : Origin relative to canvas size to start drawing the gradient 
     * @param { Array: [number, number] } endOrigin   : Origin relative to canvas size to start drawing the gradient 
     * @function
     * @private
     */
    function drawRainbow(ctx, startOrigin, endOrigin) { 
        
        var gradient = ctx.createLinearGradient(
            this.canvasSize[0]*startOrigin[0], this.canvasSize[1]*startOrigin[1], 
            this.canvasSize[0]*endOrigin[0], this.canvasSize[1]*endOrigin[1]
        );

        gradient.addColorStop(0,    'rgb(255,   0,   0)') // r
        gradient.addColorStop(0.16, 'rgb(255,   0, 255)') // v
        gradient.addColorStop(0.33, 'rgb(0,     0, 255)') // b
        gradient.addColorStop(0.50, 'rgb(0,   255, 255)') // g
        gradient.addColorStop(0.67, 'rgb(0,   255,   0)') // y
        gradient.addColorStop(0.83, 'rgb(255, 255,   0)') // o
        gradient.addColorStop(1,    'rgb(255,   0,   0)') // r

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvasSize[0], this.canvasSize[1]);

    }


    /*      Color Wavelength Spectrums: ROYGBIV
     *
     *      Red     620–750     130
     *      Orange  590–620      30
     *      Yellow  570-590      20
     *      Green   495–570      75
     *      Blue    450–495      45
     *      Violet  380-450      70
     *
     */

    module.exports = HuePicker;
});


define('famous-ui/ColorPicker/ColorPicker',['require','exports','module','famous/Surface','famous/CanvasSurface','famous/Matrix','famous/EventHandler','famous/Modifier','famous/Transitionable','famous-utils/Utils','famous-color/Color','famous/View','famous/Engine','famous-animation/Easing','famous-utils/Time','./GradientPicker','./HuePicker','./AlphaPicker','./ColorButton'],function(require, exports, module) {
    var Surface = require('famous/Surface');
    var CanvasSurface = require('famous/CanvasSurface');
    var FM = require('famous/Matrix');
    var FEH = require('famous/EventHandler');
    var Modifier = require('famous/Modifier');
    var Transitionable = require('famous/Transitionable');
    var Utils = require('famous-utils/Utils');
    var Color = require('famous-color/Color');
    var View = require('famous/View');
    var Engine = require('famous/Engine');
    var Easing = require('famous-animation/Easing');
    var Time = require('famous-utils/Time');

    // Color Picker Pieces
    var GradientPicker = require('./GradientPicker');
    var HuePicker = require('./HuePicker');
    var AlphaPicker = require('./AlphaPicker');
    var ColorButton = require('./ColorButton');

    function ColorPicker ( options ) {

        View.apply( this, arguments );

        this.color = this.options.defaultColor;

        this.sizeState = new Transitionable([0, 0]);

        this.visible = false;
        this.boundListener = false;

        this._closeListen = this.hide.bind(this);
    }

    ColorPicker.prototype = Object.create(View.prototype);
    ColorPicker.prototype.constructor = ColorPicker;

    ColorPicker.DEFAULT_OPTIONS = { 
        transition: {
            curve: Easing.inOutBackNorm,
            duration: 400
        },
        hueSize: 30,
        pickerSize: [25, 25],
        size: undefined,
        defaultColor: new Color( 80, 255, 255 ),
        name : '',
        useAlpha: true,
        padding: 5
    }

    ColorPicker.prototype.init = function () {

        this.defaultPositions = {
            gradientPicker  : FM.translate( 0, this.options.size[1], 1),
            huePicker       : FM.translate( 0, this.options.size[1] + this.options.size[0] , 1),
            alphaPicker     : FM.translate( 0, this.options.size[1] * 2 + this.options.size[0] + this.options.padding * 3, 1)
        }; 

        this.gradientPicker = new GradientPicker([this.options.size[0], this.options.size[0]], this.color);
        this.gradientTransform = new Modifier({ transform: this.defaultPositions.gradientPicker });

        this.huePicker = new HuePicker([this.options.size[0], this.options.hueSize], this.color, this.options.pickerSize);
        this.hueTransform = new Modifier({ transform: this.defaultPositions.huePicker  });

        this.openingSurface = new ColorButton(this.options.size, this.color, this.options.name);
        this.openingTransform = new Modifier();

        this.node.add(this.hueTransform).link(this.huePicker);
        this.node.add(this.openingTransform).link(this.openingSurface);
        this.node.add(this.gradientTransform).link(this.gradientPicker); 

        this.openingSurface.on('click', this.togglePicker.bind(this));

        this.huePicker.on('change', updateFromHue.bind(this));
        this.gradientPicker.on('change', updateFromGradient.bind(this));

        this.on('change', updateColorButton.bind(this));


        if( this.options.useAlpha ) { 
            this.alphaPicker = new AlphaPicker([this.options.size[0], this.options.hueSize], this.color, this.options.pickerSize )
            this.alphaTransform = new Modifier({ transform: this.defaultPositions.alphaPicker });
            this.node.add( this.alphaTransform ).link( this.alphaPicker );
            this.alphaPicker.on('change', updateFromAlpha.bind(this));
        }

        this.hide();
    };

    // TODO
    ColorPicker.prototype.set = function (r, g, b, a) {
        
    };

    ColorPicker.prototype.get = function() { 
        return this.color;
    };


    ColorPicker.prototype.togglePicker = function() {
        if(this.visible == false) {
            this.show();
        } else {
            this.hide();
        }
    };
    
    ColorPicker.prototype.hide = function(e) {
        
        this.visible = false;

        // all hidden at same spot.
        var hiddenMatrix = FM.multiply( FM.scale( 1, 0.0000001 ), this.defaultPositions.gradientPicker);

        this.hueTransform.halt();
        this.hueTransform.setOpacity(0, this.options.transition);
        this.hueTransform.setTransform(hiddenMatrix, this.options.transition );

        this.gradientTransform.halt();
        this.gradientTransform.setOpacity(0, this.options.transition);
        this.gradientTransform.setTransform(hiddenMatrix, this.options.transition );

        if( this.options.useAlpha ) { 

            this.alphaTransform.halt();
            this.alphaTransform.setOpacity(0, this.options.transition);
            this.alphaTransform.setTransform( hiddenMatrix, this.options.transition );
        } 

        this.sizeState.set([this.options.size[0], this.options.size[1]], this.options.transition );

        if(this.boundListener == true) this.unbindClickClose(); 
    };

    ColorPicker.prototype.show = function() {
        
        this.emit('showing');
        this.visible = true;

        this.hueTransform.halt();
        this.hueTransform.setOpacity(1, this.options.transition);
        this.hueTransform.setTransform( this.defaultPositions.huePicker, this.options.transition );

        this.gradientTransform.halt();
        this.gradientTransform.setOpacity(1, this.options.transition);
        this.gradientTransform.setTransform( this.defaultPositions.gradientPicker, this.options.transition );

        if( this.options.useAlpha ) { 

            this.alphaTransform.halt();
            this.alphaTransform.setOpacity(1, this.options.transition);
            this.alphaTransform.setTransform( this.defaultPositions.alphaPicker, this.options.transition );

            this.sizeState.set(
                [
                    this.options.size[0], 
                    this.gradientPicker.getSize()[1] + this.huePicker.getSize()[1] + this.openingSurface.getSize()[1] + this.alphaPicker.getSize()[1]
                ], 
                this.options.transition );

        } else { 

            this.sizeState.set(
                [
                    this.options.size[0], 
                    this.gradientPicker.getSize()[1] + this.huePicker.getSize()[1] + this.openingSurface.getSize()[1]
                ], 
                this.options.transition );
        }

        Engine.defer(this.bindClickClose.bind(this));
    };

    ColorPicker.prototype.setSize = function ( size ) {
        this.options.size = size;
    };

    ColorPicker.prototype.getSize = function () {
        return this.options.size ? this.sizeState.get() : undefined;
    };

    ColorPicker.prototype.bindClickClose = function () {
        Engine.on('click', this._closeListen);
        this.boundListener = true;
    };

    ColorPicker.prototype.unbindClickClose = function() {
        Engine.unbind('click', this._closeListen);
        this.boundListener = false;
    };

    ColorPicker.prototype.render = function( input ) {
        return {
            size: this.sizeState.get(),
            target: this.node.render()
        }
    };

    function updateFromHue(e) {

        var color = e.value.getCSSColor();
        this.gradientPicker.drawGradient(color);

        syncColors.call( this );
    }

    function updateFromGradient() {
        syncColors.call( this );
    }

    function updateFromAlpha() {
        syncColors.call( this );
    }

    function syncColors() {
        var newColor = this.gradientPicker.getColor();

        
        if( this.options.useAlpha ) {
            newColor.a = this.alphaPicker.getColor().a;
            this.alphaPicker.setColor( newColor );
        }

        this.color = newColor;
        updateColorButton.call( this, {value: this.color });
        
        this.eventOutput.emit('change', {value: this.color});
        
    }

    function updateColorButton(e) {
        var color = e.value.getCSSColor();
        this.openingSurface.colorSurface(color);
    }

    module.exports = ColorPicker;
});

define('famous-ui/Dropdown/DropdownItem',['require','exports','module','famous/View','famous/Matrix','famous/Modifier','famous/Surface','famous-animation/Easing','famous-utils/Utils','famous-views/Scrollview'],function(require, exports, module) { 
    var View = require('famous/View');
    var FM = require('famous/Matrix');
    var Modifier = require('famous/Modifier');
    var Surface = require('famous/Surface');
    var Easing = require('famous-animation/Easing');
    var Utils = require('famous-utils/Utils');
    var Scrollview = require('famous-views/Scrollview');
    
    function DropdownItem(opts, value, selected) { 
        View.apply(this, arguments);
        this.eventInput.pipe( this.eventOutput );
        
        this.value = value;

        this._isSelected = selected || false;
        this._styleType;

        this.options.itemContent.unshift( this.options.name );

        this.surface = new Surface({ 
            size: this.options.itemSize, 
            content: this.options.template.apply(this, this.options.itemContent) 
        });

        this.transform = new Modifier();
        style.call( this );

        this.surface.pipe(this);
        this.surface.on('click', this.emit.bind(this, 'selection', { value: this.value, origin: this }));
        this.node.link( this.transform ).link( this.surface );
    }

    DropdownItem.prototype = Object.create(View.prototype);
    DropdownItem.prototype.constructor = DropdownItem;

    DropdownItem.DEFAULT_OPTIONS = { 
        name: 'Food',
        itemSize: [216, 50],
        classes: [],
        properties: {
            'color': '#ffffff',
            'background-color' : '#333',
            'border': '1px solid #ccc'
        },
        selectedProperties: { },
        template: function ( content ) {
            return '<h2 style="padding: 10px;">' + content + '</h2>';
        },
        defaultCurve: { 
            curve: Easing.inOutBackNorm,
            duration: 400
        },
        squishCurve: { 
            curve: Easing.outBounceNorm,
            duration: 400
        },
        itemContent: []
    }
    DropdownItem.prototype.setTemplate = function ( bool ) {

    }
    /**
     * Set state of selected to trigger styling.
     *
     * @name MultiBoolToggle#setSelected
     * @function
     * @param {Boolean} Selected, or not. 
     */
    DropdownItem.prototype.setSelected = function ( bool ) {
        this._isSelected = bool;
        style.call( this );
    }

    /**
     * Style the item.
     * @name style
     * @function
     * @private
     */
    function style() {
        this.transform.halt();
        if(this._isSelected) { 
            this.surface.setProperties( this.options.selectedProperties );
            this._styleType = true;
            this.transform.setTransform(FM.move(FM.scale( 0.7, 0.7 ), [ this.options.itemSize[0] * 0.125, this.options.itemSize[1] * 0.125]));
            this.transform.setTransform(FM.identity, this.options.squishCurve, this.emit.bind(this, 'selectionEnd'));
        } else { 
            this.surface.setProperties( this.options.properties );
            this._styleType = false;
            if(this.transform.getFinalTransform() !== FM.identity) { 
                this.transform.setTransform(FM.identity);
            }
        }
    }

    /**
     * Get size of item.
     *
     * @name MultiBoolToggle#getSize
     * @return {Array:number} size, [x, y] 
     */
    DropdownItem.prototype.getSize = function () {
        return this.surface.getSize();
    }

    /**
     * Get name of item.
     * @name MultiBoolToggle#getName
     * @return { String } name : name of item
     */
    DropdownItem.prototype.getName = function () {
        return this.options.name;
    }


    module.exports = DropdownItem;
});

define('famous-ui/Dropdown/Dropdown',['require','exports','module','famous/View','famous/Matrix','famous/Modifier','famous/Transitionable','famous/Surface','famous-animation/Easing','famous-utils/Utils','famous-views/Scrollview','./DropdownItem','famous/ContainerSurface'],function(require, exports, module) { 
    var View = require('famous/View');
    var FM = require('famous/Matrix');
    var Modifier = require('famous/Modifier');
    var Transitionable = require('famous/Transitionable');
    var Surface = require('famous/Surface');
    var Easing = require('famous-animation/Easing');
    var Utils = require('famous-utils/Utils');
    var Scrollview = require('famous-views/Scrollview');
    var DropdownItem = require('./DropdownItem');
    var ContainerSurface = require('famous/ContainerSurface');

    function Dropdown( ) {
        View.apply( this, arguments );
        this.eventInput.pipe( this.eventOutput );

        this.options.scrollviewOpts.clipSize = this.options.height;

        this.label          = undefined;
        this.defaultMtx     = undefined;
        this.closedMtx      = undefined;
        this.arrowClosedPos = undefined;
        this.arrowOpenPos   = undefined;
        this.labelTemplate  = undefined; 
        this.itemTemplate   = undefined; 
        this.itemOpts       = undefined; 
        this.sizeState      = new Transitionable([0, 0]);
        
        this.items          = [];

        // STATE 
        this._isOpen        = false;
        this.initialized    = false;
    }

    Dropdown.prototype = Object.create(View.prototype);
    Dropdown.prototype.constructor = Dropdown;

    Dropdown.DEFAULT_OPTIONS = { 
        items: [
            { name: 'Apples',  value: 'apples'}, 
            { name: 'Oranges',  value: 'oranges'}
        ],
        defaultSelected: 0,
        itemSize: undefined,
        labelProperties: {
            'color': '#ffffff',
            'background-color' : '#333',
            'border': '1px solid #ccc'
        },
        itemClasses: [],
        itemProperties: {
            'color': '#ccc',
            'background-color' : '#fff',
            'border': '1px solid #ccc'
        },
        itemSelectedProperties: {
            'border': '3px solid #33ccff'
        },
        scrollviewOpts: { 
            direction: 1,
            clipSize: undefined,
        },
        height: 125,
        defaultCurve: { 
            curve: Easing.inOutBackNorm,
            duration: 500
        },
        labelFadeCurve: { 
            curve: Easing.inOutSineNorm,
            duration: 200
        },
        arrowSize: [20, 20],
        arrowPadding: [5, 10, 1],
        arrowContent: '<img src="js/famous-ui/img/arrowRight.svg"></img>',
        itemTemplate: function ( content ) {
            return '<h4 style="line-height:' + this.options.itemSize[1] + 'px; padding-left: 10px;">' + content + '</h4>';
            },

        labelTemplate:  function ( content ) {
            return '<h3 style="line-height:' + this.options.itemSize[1] + 'px; padding-left: 10px;">' + content + '</h3>';
            },
        autoClose: false
    }

    /**
     * Initialize the widget.
     * @name Dropdown#init
     * @function
     */
    Dropdown.prototype.init = function () {
        this.defaultMtx     = FM.translate( 0, this.options.itemSize[1], 0 );
        this.closedMtx      = FM.move(FM.scale(1, 0.01), [0, this.options.itemSize[1] , 0]);

        //arrow mtxs
        this.arrowClosedPos = FM.translate( 
            this.options.itemSize[0] - this.options.arrowSize[0] - this.options.arrowPadding[0], 
            this.options.arrowPadding[1], 
            this.options.arrowPadding[2]);

        this.arrowOpenPos = FM.move( FM.rotateZ( Math.PI * 0.5 ), 
            [ 
                this.options.itemSize[0] - this.options.arrowSize[0] * 0.25 - this.options.arrowPadding[0], 
                this.options.arrowPadding[1], 
                this.options.arrowPadding[2]
            ]);


        this.options.itemTemplate = this.options.itemTemplate.bind(this);
        this.options.labelTemplate = this.options.labelTemplate.bind(this);

        this.itemOpts = {
            itemSize: this.options.itemSize,
            itemProperties: this.options.itemProperties,
            selectedProperties: this.options.itemSelectedProperties,
            template: this.options.itemTemplate,
            classes: this.options.itemClasses
        }

        initArrow.call(this);
        initScrollview.call(this);
        initDefaultItems.call(this); 
        initLabel.call(this);
        this.sizeState.set( this.options.itemSize );
        this.initialized = true;
    }

    /**
     * Init label surface & transform
     * @private
     */
    function initLabel() {
        this.label = new Surface({
            content: this._getLabelContent( this.options.defaultSelected ),
            size: this.options.itemSize
        });
        this.label.setProperties( this.options.labelProperties );
        this.labelTransform = new Modifier();
        this.node.add(this.labelTransform).link(this.label);
        this.label.on('click', this.toggleMenu.bind(this) );        
    }

    /**
     * Init arrow surface & transform
     * @private
     */
    function initArrow() {
        this.arrow = new Surface({
            size: this.options.arrowSize, 
            content: this.options.arrowContent 
        });
        this.arrowTransform = new Modifier({ transform: this.arrowClosedPos });
        this.node.add(this.arrowTransform).link(this.arrow);
    }

    /**
     * Init scrollview & transform
     * @private
     */
    function initScrollview() {
        this.scrollviewContainer = new ContainerSurface({ 
            size:  [this.options.itemSize[0], this.options.height],
            properties: { 'overflow': 'hidden' }
            });

        this.scrollview = new Scrollview( this.options.scrollviewOpts );
        this.scrollview.sequenceFrom(this.items);

        this.scrollviewTransform = new Modifier({ 
            transform: this.closedMtx, 
            opacity: 0,
            size: [this.options.itemSize[0], this.options.itemSize[1]]
            });

        this.node.add(this.scrollviewTransform).link(this.scrollviewContainer);
        this.scrollviewContainer.add(this.scrollview);
    }

    /**
     * Init default items passed into options object
     * @private
     */
    function initDefaultItems() {
        for (var i = 0; i < this.options.items.length; i++) {
            var item = this.options.items[i];
            this.addItem( item.name, item.value, item.content );
        };
        this.value = this.items[this.options.defaultSelected].value;
    }

    /**
     * Add an item to the Dropdown Menu.
     * @name Dropdown#addItem
     * @function
     * @param {String} name : Label name displayed
     * @param {String} value : string value emitted when selected
     */
    Dropdown.prototype.addItem = function ( name, value, extraContent ) {

        var opts = this.itemOpts;
        opts.name = name;
        if( extraContent ) { 
            opts.itemContent = extraContent;
        }

        var item = new DropdownItem( opts, value, false );
        item.setTemplate( this.itemTemplate );

        item.transform.setOpacity( 0 );
        item.transform.setOpacity( 1 , this.options.defaultCurve );

        this.items.push( item ); 
        item.pipe(this.scrollview);

        item.on('selection', handleSelection.bind(this));

        if(this.options.autoClose) {
            item.on('selectionEnd', this.closeMenu.bind(this));
        }
    }

    /**
     * Open the menu.
     * @name Dropdown#openMenu
     * @function
     */
    Dropdown.prototype.openMenu = function () {
        this._isOpen = true;
        setArrow.call(this, this._isOpen);
        setMenu.call(this, this._isOpen);
    }

    /**
     * Close the menu.
     * @name Dropdown#closeMenu
     * @function
     */
    Dropdown.prototype.closeMenu = function () {
        this._isOpen = false;
        setArrow.call(this, this._isOpen);
        setMenu.call(this, this._isOpen);
    }

    /**
     * Toggle the menu between open and closed.
     * @name Dropdown#closeMenu
     * @function
     */
    Dropdown.prototype.toggleMenu = function () {
        if(this._isOpen) this.closeMenu();
        else this.openMenu();
    }
    /**
     * Toggle the menu between open and closed.
     * @name Dropdown#get
     * @function
     * @returns {String} value of selected item in dropdown
     */
    Dropdown.prototype.get = function () {
        return this.value;
    }

    Dropdown.prototype._getLabelContent = function ( index ) {
        var item = this.items[index]; 
        var content = item.options.itemContent;
        var html = this.options.labelTemplate.apply( this, content ) ;
        return html;
    }

    /**
     * Set the value of the dropdown via value.
     * @name Dropdown#set
     * @function
     * @returns {String} value of selected item in dropdown
     */
    Dropdown.prototype.set = function ( value) {
        var index = getIndexByValue.call( this, value )
        var item = this.items[index];
        this.value = item.value;

        setSelected.call(this, index);

        var labelHtml = this._getLabelContent( index );
        this.updateLabel( labelHtml );

        this.emit('change', { value: this.value });
    }

    /**
     * Set the clip height of the dropdown.
     * @name Dropdown#setHeight
     * @function
     * @param {Number} num : height in pixels 
     */
    Dropdown.prototype.setHeight = function ( num ) {
        this.options.height = num;
        this.options.scrollviewOpts.clipSize = num;
        this.scrollview.options.clipSize = num;
        this.scrollviewContainer.setSize( this.options.itemSize[0], num );
    }

    /**
     * Remove an item from the dropdown.
     * @name Dropdown#removeItem
     * @function
     * @param {String || Number} item : index or value of item to remove 
     */
    Dropdown.prototype.removeItem = function ( item ) {
        var index;
        if( typeof item == 'string' ) {
            index = getIndexByValue.call(this, item ); 
        } else if ( typeof item == 'number' ) {
            index = item;
        }
        if( index !== -1 ) { 
            this.items[index].transform.setOpacity(0, this.options.defaultCurve, (function ( index ) {
                this.items.splice( index , 1 );
                }).bind(this, index))
        }
    }    

    /**
     * Set arrow transform.
     * @function @private
     * @param { bool } bool : bool of open / closed
     */
    function setArrow ( bool ) {
        var mtx = bool ? this.arrowOpenPos : this.arrowClosedPos ;
        this.arrowTransform.setTransform( mtx, this.options.defaultCurve );
    }

    /**
     * Set menu transforms.
     * @function @private
     * @param { bool } bool : bool of open / closed
     */
    function setMenu ( bool ) {
        var opacity = bool ? 1 : 0.000001;
        var size    = bool ? [this.options.itemSize[0], this.options.height ] : [this.options.itemSize[0], this.options.itemSize[1] ];
        var mtx     = bool ? this.defaultMtx : this.closedMtx;
        this.scrollviewTransform.setOpacity(opacity, this.options.defaultCurve); 
        this.scrollviewTransform.setTransform( mtx, this.options.defaultCurve);
        this.sizeState.set(size, this.options.defaultCurve); 
    }

    /**
     * Set selected item.
     * @function @private
     */    
    function handleSelection(e) {
        var index = this.items.indexOf(e.origin);
        var item = this.items[index];
        if(item) { 
            this.set(item.value, index);
        }
    }

    /**
     * set all items to appropriate selected state
     * @function @private
     */    
    function setSelected(index) {
         for (var i = 0; i < this.items.length; i++) {
             if( index == i ) { 
                this.items[i].setSelected(true);
             } else { 
                this.items[i].setSelected(false);
             }
         };
    }

    /**
     * Update the label name.
     * @name Dropdown#updateLabel
     * @function
     * @param {String} value : of label  
     */
    Dropdown.prototype.updateLabel = function ( html ) {

        var updateLabel = function ( html ) {
            this.label.setContent( html );
            this.labelTransform.setOpacity( 1, this.options.labelFadeCurve );
        }

        this.labelTransform.setOpacity( 0, this.options.labelFadeCurve, updateLabel.bind(this, html));

    }

    /**
     * get index of item via value
     * @function @private
     */    
    function getIndexByValue ( value ) {
        for (var i = 0; i < this.items.length; i++) {
            if( this.items[i].value == value ) {
                return i;
            }
        };
        return -1;
    }

    /**
     * Set the size of each item.
     * @name Dropdown#setSize
     * @function
     * @param {Array : number} size : of item. 
     */
    Dropdown.prototype.setSize = function ( size ) {
        this.options.itemSize = [size[0], size[1] * 2]; 
    }

    /**
     * Get the size of the widget.
     * @name Dropdown#getSize
     * @function
     * @return {Array : number} size : of item. 
     */
    Dropdown.prototype.getSize =  function () {
        return this.initialized ? this.sizeState.get() : undefined;
    }

    module.exports = Dropdown;
});

define('famous-ui/Easing/EasingVisualizer',['require','exports','module','famous-animation/Easing','famous/CanvasSurface','./CanvasDrawer'],function(require, exports, module) {
    var Easing = require('famous-animation/Easing');
    var FamousCanvasSurface = require('famous/CanvasSurface');
    var CanvasDrawer = require('./CanvasDrawer');

    /* @widget: takes an easing curve and outputs a visual representation of the curve.
    * all drawing done in an offscreen canvas that is never inserted into the dom.
    *
    * @param opts : {
    *      @param divisions { Number }      : Fidelity of the drawn line.
    *      @param function { Function }     : Normalized Curve to draw.
    *      @param size { Array.Number}      : Size of the canvasSurface.
    *      @param strokeColor { String }    : Color of the easing line. 
    *      @param fillColor { String }      : Color of the background.
    *   }
    */ 
    
    function EasingVisualizer(opts) {
        this.opts = { 
            size: [1000, 1000],
            strokeColor: '#33ccff',
            fillColor: '#333',
            fn: Easing.inOutBackNorm,
            divisions: 30
        }
        this.setOpts( opts );
        this.opts.canvasSize = [this.opts.size[0] * 2, this.opts.size[1] * 2];
        this.opts.gutter = Math.floor(this.opts.size[0] * .35);

        FamousCanvasSurface.call(this, {size: this.opts.size, canvasSize: this.opts.canvasSize });
        this.update();
    }

    EasingVisualizer.prototype = Object.create(FamousCanvasSurface.prototype);
    EasingVisualizer.prototype.constructor = EasingVisualizer;

    EasingVisualizer.prototype.setOpts = function(opts, destinationOpts) { 
        if( !destinationOpts) destinationOpts  = this.opts;
        for(var key in opts) destinationOpts[key] = opts[key];
    } 

    EasingVisualizer.prototype.setCurve = function(fn) { 
        this.opts.fn = fn;
        this.update();
    }

    EasingVisualizer.prototype.update = function() { 
        var offscreenCanvas = initOffscreen.call(this);
        var ctx = this.getContext('2d');
        ctx.drawImage(offscreenCanvas, 0, 0);
    }

    function initOffscreen() { 
        var canvas = document.createElement('canvas');
        canvas.width = this.opts.canvasSize[0];
        canvas.height = this.opts.canvasSize[1];

        var ctx = canvas.getContext('2d');
        ctx.strokeStyle = this.opts.strokeColor;
        ctx.lineWidth = 2;
        ctx.fillStyle = this.opts.fillColor;
        CanvasDrawer.rect(ctx, 0, 0, this.opts.canvasSize[0], this.opts.canvasSize[1]);

        var theta = 1 / this.opts.divisions;

        var xSize = this.opts.canvasSize[0] - this.opts.gutter;
        var ySize = this.opts.canvasSize[1] - this.opts.gutter;
        var initPos = this.opts.gutter * 0.5;

        for(var i = 1; i < this.opts.divisions; i++) { 
            var prevIndex = theta * (i - 1); 
            var index = theta * i;

            var x1 = prevIndex * xSize + initPos;
            var x2 = index * xSize + initPos;

            var y1 = ySize - this.opts.fn(prevIndex) * (ySize - this.opts.gutter);
            var y2 = ySize - this.opts.fn(index) * (ySize - this.opts.gutter);

            CanvasDrawer.lineTo(ctx, x1, y1, x2, y2);
        }
        return canvas;
    }

    module.exports = EasingVisualizer;
});

define('famous-ui/Easing/EasingBool',['require','exports','module','./EasingVisualizer','famous/EventHandler'],function(require, exports, module) {
    var EasingVisualizer = require('./EasingVisualizer'); 
    var FEH = require('famous/EventHandler');
    
    // @widget: single toggle of an easing visualizer
    // maintains state, and emits change events on clicks.
    // Since it is useless on it's own, only use with a MultiEasingToggler
    function EasingBool (options, easingOpts) {
        this.easingOpts = {
            value: false,
            selectedProperties: { 
                'border': '3px solid #33ccff'
            },
            normalProperties: { 
                'border': 'none'
            }
        }
        EasingVisualizer.apply(this, arguments);
        this.setOptions( easingOpts, this.easingOpts );

        this.on('click', this.toggle.bind(this));

        highlight.call(this);
    }

    EasingBool.prototype = Object.create(EasingVisualizer.prototype);
    EasingBool.prototype.constructor = EasingBool;

    EasingBool.prototype.silentSet = function (bool) {
        this.easingOpts.value = bool; 
        highlight.call(this);
    }

    EasingBool.prototype.toggle = function () { 
        this.set( !this.value );
    }

    EasingBool.prototype.set = function (bool) {
        this.easingOpts.value = bool;
        this.emit( 'boolChange', { value: this.easingOpts.value });
        highlight.call( this );
    }

    function highlight () {
        var properties = this.easingOpts.value ? 
            this.easingOpts.selectedProperties : 
            this.easingOpts.normalProperties;
        this.setProperties(properties);
    }

    module.exports = EasingBool;
});

define('famous-ui/Easing/MultiEasingToggle',['require','exports','module','./EasingBool','famous-animation/Easing','famous/View','famous/Modifier','famous/Matrix'],function(require, exports, module) 
{    
    var EasingBool = require('./EasingBool');
    var Easing = require('famous-animation/Easing');
    var View = require('famous/View');
    var Modifier = require('famous/Modifier');
    var FM = require('famous/Matrix');    

    // @widget : MultiEasingToggle :  grid of EasingBools. Only one can be selected, and emits
    // events when a new one is selected. 
    function MultiEasingToggle(opts) { 

        View.apply(this, arguments);

        this.value = this.options.easingFns[this.options.defaultSelected];
        this.height = 0;
        this.bools = [];

        this.initialized = false;
    }

    MultiEasingToggle.prototype = Object.create(View.prototype);
    MultiEasingToggle.prototype.constructor = MultiEasingToggle;

    MultiEasingToggle.DEFAULT_OPTIONS = { 
        easingFns           : [Easing.inOutBackNorm, Easing.outBounceNorm, Easing.inOutBackNorm, Easing.outBounceNorm],
        columns             : 3,
        size                : undefined,
        panelSize           : 216,
        easingAspect        : [1.25, 1],
        defaultSelected     : 0,
        easingBoolSize      : [undefined, undefined],
        selectedProperties  : undefined,
        normalProperties    : undefined
    }

    MultiEasingToggle.prototype.init = function () {
        var positions = getPositions.call(this);
        for (var i = 0; i < this.options.easingFns.length; i++) {
            value = (i == this.options.defaultSelected) ? true : false;

            var easingOpts = {
                value: value
            }

            if( this.options.selectedProperties ) easingOpts.selectedProperties = this.options.selectedProperties
            if( this.options.normalProperties ) easingOpts.normalProperties = this.options.normalProperties
                
            var bool = new EasingBool({ 
                fn: this.options.easingFns[i],
                size: this.options.easingBoolSize
                }, easingOpts);

            bool.on('boolChange', setSelected.bind(this, i));
            bool.pipe(this.eventOutput);

            this.node.add(new Modifier(positions[i])).link(bool);
            this.bools.push(bool);
        };

        this.initialized = true;
    }

    function getPositions() {
        var len = this.options.easingFns.length,
            positions = [],
            rowIndex = 0,
            colIndex = -1;

        for (var i = 0; i < len; i++) {

            colIndex = i % this.options.columns;
            if(colIndex === 0 && i !== 0) rowIndex++; 

            positions.push(FM.translate(
                colIndex * this.options.easingBoolSize[0], 
                rowIndex * this.options.easingBoolSize[1], 
                0 ));

            // last, set height
            if(i == len - 1) { 
                this.options.size[1] = (rowIndex + 1) * this.options.easingBoolSize[1];
            }
        };
        return positions;
    }

    function setSelected(selectedIndex, val) {
        var oppositeVal = !val;
        for (var i = 0; i <this.bools.length; i++) {
            if(i == selectedIndex) { 
                this.bools[i].silentSet( val );
            } else { 
                this.bools[i].silentSet( oppositeVal );
            }
        };
        this.value = this.options.easingFns[selectedIndex]; 
        this.eventOutput.emit('change', {value: this.value });
    }

    MultiEasingToggle.prototype.set = function (val) {
        var i = this.options.easingFns.indexOf(val);
        setSelected.call(this, i, true);
    }

    MultiEasingToggle.prototype.get = function() { 
        return this.value;
    }

    MultiEasingToggle.prototype.setSize = function(size) { 
        this.options.easingBoolSize[0] = Math.floor(size[0] / this.options.columns); 
        this.options.easingBoolSize[1] = Math.floor(this.options.easingBoolSize[0] / this.options.easingAspect[0]);

        this.options.size = [];
        this.options.size[0] = size[0];
    } 

    MultiEasingToggle.prototype.getSize = function() { 
        if( this.initialized ) { 
            return this.options.size;
        } else { 
            return undefined;
        }
    }    

    module.exports = MultiEasingToggle;
});

define('famous-ui/Text/Label',['require','exports','module','famous/Surface'],function(require, exports, module) {    
    var Surface = require('famous/Surface');

    function Label ( opts ) {
        this.options = { 
            size: undefined,  
            content: '',
            properties: {},
            classes: ['ui-label']
        }
        this._dirty = true;

        for( var key in opts ) this.options[ key ] = opts[key];
        this.surface;
    }

    Label.prototype.init = function () {
        this.surface = new Surface({
            size: this.options.size,
            content: '<div>' + this.options.content + '</div>',
            classes: this.options.classes,
            properties: this.options.properties
        });
    }
    Label.prototype.setSize = function (size) {
        this.options.size = [size[0], 0];
    }
    Label.prototype.getSize = function () {
       return this.options.size ? this.options.size : undefined;
    }
    Label.prototype.pipe = function (target) {
       return this.surface.pipe( target );
    }
    Label.prototype.render = function () {
        if( this._dirty ) { 
            if( this.surface._currTarget ) {
                this.options.size = [
                    this.options.size[0],
                    this.surface._currTarget.firstChild.clientHeight
                ]

                this.surface.setSize( this.options.size );
                
                this._dirty = false;
            }
        }
        return this.surface.render();
    }

    module.exports = Label;
});

define('famous-ui/Toggles/BoolToggle',['require','exports','module','famous/Surface','famous/Matrix','famous/EventHandler','famous/Modifier','famous/Modifier','famous-animation/Easing','famous/RenderNode','famous-utils/Utils','famous/View'],function(require, exports, module) {
    var FamousSurface = require('famous/Surface');
    var FM = require('famous/Matrix');
    var FEH = require('famous/EventHandler');
    var FT = require('famous/Modifier');
    var Modifier = require('famous/Modifier');
    var Easing = require('famous-animation/Easing');
    var RenderNode = require('famous/RenderNode');
    var Utils = require('famous-utils/Utils');
    var View = require('famous/View');

    function BoolToggle( opts ) { 
        View.apply( this, arguments );
        this.eventInput.pipe( this.eventOutput );
        
        this.value = opts.value;
        this.name = opts.name;
    }

    BoolToggle.prototype = Object.create( View.prototype );
    BoolToggle.prototype.constructor = BoolToggle;

    BoolToggle.DEFAULT_OPTIONS = { 
        size: undefined, 
        value: true, 
        name: 'bool toggle', 
        transition: { 
            duration: 250,
            curve: Easing.inOutBackNorm
        }, 
        padding: 20
    }
    /**
     * Initialize the widget.
     * @name BoolToggle#init
     * @function
     */
    BoolToggle.prototype.init = function () {
        if( this.options.size == undefined ) { 
            this.options.size = [undefined, undefined];
        }

        var opacity = this.options.value == true ? 1 : 0;

        this.label = new FamousSurface({
            size: this.options.size, 
            content: '<div style="border: 1px solid #ffffff; width:' + (this.options.size[1]-1) + 'px; height: ' +  (this.options.size[1]-1) + 'px; float: left;"></div>' +
                '<div class="slider-label" style="float: left; margin-left:' + this.options.size[1]*.5 + 'px;margin-top:' + this.options.size[1] * 0.1 + 'px">' + this.name + '</div>',
            properties: {'fontSize': this.options.size[1]*.75+'px'}
        });

        this.fill = new FamousSurface({ 
            size: [this.options.size[1], this.options.size[1]] ,
            properties: { 'backgroundColor': '#ffffff' }
        });

        this.transform = new Modifier({ 
            opacity: opacity,
            transform: FM.translate(0,0,1),
            size: [this.options.size[1], this.options.size[1]]
        });

        this.labelTransform = new Modifier({
            transform: FM.translate(0, 0, 1)
        });
        
        // Events
        this.fill.pipe( this ); 
        this.label.pipe( this );
        this.on('click', handleClick.bind(this));
        
        // Render Tree
        this.node.add( this.transform ).link( this.fill );
        this.node.add( this.labelTransform ).link( this.label);

        this.set( this.options.value ); 
    }
    /**
     * Trigger toggle on click. 
     * @private
     */
    function handleClick () { 
        this.toggle();
    }

    /**
     * Set value of toggle without emiting an event.
     * @name BoolToggle#silentSet
     * @function
     * @param {Boolean} Value of toggle. 
     */
    BoolToggle.prototype.silentSet = function(bool) { 
        this.value = bool;
        setTransform.call( this );
    }

    /**
     * Toggle the value of the toggle.
     * @name BoolToggle#toggle
     * @function
     */
    BoolToggle.prototype.toggle = function() { 
        this.set( !this.value );
    }

    /**
     * Set the value of the toggle.
     * @name BoolToggle#set
     * @param {Boolean} bool : value to set.
     * @function
     */
    BoolToggle.prototype.set = function( bool ) {
        if (this.value === bool) return;
        this.value = bool;
        this.emit( 'change', {value: this.value });
        setTransform.call( this );
    }

    /**
     * Set the transform based on the current value. 
     * @private
     */
    function setTransform () { 

        this.transform.halt();

        var mtx = this.value ? 
            FM.scale(1, 1, 1) : 
            FM.move( FM.scale(0.0001, 0.0001, 0.0001), 
                [this.options.size[1] * 0.5, this.options.size[1] * 0.5, 0] );
    /**
     * Get the size of the toggle.
     * @name BoolToggle#getSize
     * @function
     */
        var op = this.value ? 1 : 0; 

        this.transform.setTransform(mtx, this.options.transition);
        this.transform.setOpacity(op, this.options.transition);

    }

    /**
     * Get the value of the toggle.
     * @name BoolToggle#get
     * @param {Boolean} bool : value to set.
     * @function
     */
    BoolToggle.prototype.get = function() { 
        return this.value; 
    }

    /**
     * Get the size of the toggle.
     * @name BoolToggle#getSize
     * @function
     */
    BoolToggle.prototype.getSize = function() { 
        return this.options.size; 
    }

    /**
     * Set the size of the toggle.
     * @name BoolToggle#getSize
     * @function
     */
    BoolToggle.prototype.setSize = function ( size ) {
        this.options.size = size; 
    }

    module.exports = BoolToggle;
});

define('famous-ui/Toggles/MultiBoolToggle',['require','exports','module','famous/Surface','famous/RenderNode','famous/Matrix','famous/Modifier','famous/Transitionable','famous/EventHandler','famous/View','famous-animation/Easing','./BoolToggle'],function(require, exports, module) {
    var FamousSurface = require('famous/Surface');
    var RenderNode = require('famous/RenderNode');
    var FM = require('famous/Matrix');
    var Modifier = require('famous/Modifier');
    var Transitionable = require('famous/Transitionable');
    var FEH = require('famous/EventHandler');
    var View = require('famous/View');
    var Easing = require('famous-animation/Easing');
    var BoolToggle = require('./BoolToggle');

    /*
     */
    function MultiBoolToggle( opts ) {
        View.apply( this, arguments );
        this.eventInput.pipe( this.eventOutput );
        
        this.value;
        this.label;
        this.labelTransform;
        this.usingLabel = false;

        this.bools = [];
        this.boolValues = [];
        this.transforms = [];


    }
    MultiBoolToggle.prototype = Object.create( View.prototype );
    MultiBoolToggle.prototype.constructor = MultiBoolToggle;

    MultiBoolToggle.DEFAULT_OPTIONS = { 
        size: undefined, 
        values: [], 
        defaultSelected: 0, 
        name: undefined, 
        padding: 20,
        sizeTransition: {
            curve: Easing.inOutBackNorm,
            duration: 400
        },
        opacityTransition: { 
            curve: Easing.inOutBackNorm,
            duration: 400
        } 
    }

    /**
     * Initialize the widget.
     * @name MultiBoolToggle#init
     * @function
     */
    MultiBoolToggle.prototype.init = function () {
        if( this.options.size == undefined ) { 
            this.options.size = [undefined, undefined];
        }
        this.sizeState = new Transitionable([this.options.size[0], 0]);
        initLabel.call(this);
        initBools.call(this);
    }

    /**
     * Init label surface
     * @private
     */
    function initLabel () {
        if( this.options.name !== undefined ) {

            this.label = new FamousSurface({
                size: this.options.size, 
                content: '<div class="slider-label" style="margin-top:' + this.options.size[1] * 0.1 + 'px">' + this.options.name + '</div>'
            });            

            this.label.setProperties({'font-size': this.options.size[1]*.75+'px'})
            this.labelTransform = new Modifier();
            this.transforms.push( this.labelTransform );
            this.usingLabel = true;            

            this.node.add( this.labelTransform ).link( this.label );

            updateSize.call( this );
        }
    }

    /**
     * Init default bool toggles
     * @private
     */
    function initBools () { 
        for(var i = 0 ; i < this.options.values.length; i++) { 

            var bool = i == this.options.defaultSelected ? true : false;

            if( bool ) this.value = this.options.values[i];

            this._addToggle(bool, this.options.values[i], true);
        }
    }

    /**
     * Update Size state. 
     * @private
     */
    function updateSize () {
        this.sizeState.halt();
        var length = this.transforms.length;
        var height = length * this.options.size[1] + ( length - 1 ) * this.options.padding;
        this.sizeState.set( [this.options.size[0], height], this.options.sizeTransition );
    }

    /**
     * Loop through toggles and set them to the appropriate state.
     *
     * @name MultiBoolToggle#setSelectedToggle
     * @function
     * @param {Number} index of selected Item 
     */
    MultiBoolToggle.prototype.setSelectedToggle = function(selectedIndex) { 
        for(var i = 0; i < this.bools.length; i++) { 

            if(i == selectedIndex) { 

                this.bools[i].silentSet( true);
                this.boolValues[i] = true;
                this.value = this.options.values[i];

                this.emit('change', {value: this.options.values[i]});

            } else { 
                this.bools[i].silentSet( false );
                this.boolValues[i] = false;
            }
        }
    }

    /**
     * Set appropriate toggle via value string.
     *
     * @name MultiBoolToggle#set
     * @function
     * @param {String} Value of desired toggle to mark as selected. 
     */
    MultiBoolToggle.prototype.set = function (val) {
        var i = this.options.values.indexOf(val);
        this.setSelectedToggle( i );
    }

    /**
     * Set appropriate toggle via value string.
     *
     * @name MultiBoolToggle#get
     * @function
     * @returns {String} Value of selected Bool Toggle. 
     */
    MultiBoolToggle.prototype.get = function() { 
        return this.value;
    }

    /**
     * Add a toggle to this widget.
     *
     * @name MultiBoolToggle#addToggle
     * @function
     * @param {Boolean} value : of new Bool Toggle. 
     * @param {String}  name : of new Bool Toggle. 
     * @param {Boolean} noPush: don't add element to value array, 
     *                  for default values
     */
    MultiBoolToggle.prototype._addToggle = function ( value, name, noPush ) {
        var length = this.transforms.length;

        var toggle = new BoolToggle({
            size: this.options.size, 
            value: value, 
            name: name 
        });

        toggle.init();
        toggle.pipe( this );

        if( !noPush ) { 
            this.options.values.push( name );
        }

        var transform = new Modifier({
            transform: FM.translate(0, this.options.size[1] * length + this.options.padding * length),
            opacity: 0
        });

        transform.setOpacity( 1, this.options.opacityTransition );
        
        this.bools.push(toggle);

        this.transforms.push( transform );
        this.node.add( transform ).link( toggle );

        toggle.silentSet( value );
        this.boolValues.push( value );

        toggle.on('change', (function(i, arg) {

            if( this.boolValues[i] == true ) { 
                this.bools[i].silentSet(true); // ensure that it stays selected.
            } else { 
                this.setSelectedToggle( i );
            }

        }).bind(this, this.usingLabel ? length - 1 : length));

        updateSize.call( this );
    }

    /**
     * Get size of entire multi bool toggle. Returns undefined if not initalized,
     * allowing panelScroller to set the size.
     *
     * @name MultiBoolToggle#getSize
     * @function
     * @returns {Array : number} Size of the widget.
     */ 
    MultiBoolToggle.prototype.getSize = function () {
        if( this.sizeState ) {
            return this.sizeState.get();
        } else { 
            return undefined;
        }
    }

    /**
     * Set the size of each individual bool. 
     *
     * @name MultiBoolToggle#setSize
     * @function
     * @param {Array : number} size: [x, y] Size of each individual boolToggle.
     */ 
    MultiBoolToggle.prototype.setSize = function ( size ) {
        this.options.size = size;
    }

    /**
     * Remove a toggle from this widget.
     *
     * @name MultiBoolToggle#removeToggle
     * @function
     * @param {Number || String} value : index or string value of Bool Toggle to be removed. 
     */
    MultiBoolToggle.prototype.removeToggle = function ( val ) {
        var index, transformIndex; 
        if( typeof val == 'number' ) {
            index = val;
        } else if ( typeof val == 'string' ) { 
            index = this.options.values.indexOf( val );
        } 

        if( index >= 0 ) { 
            transformIndex = this.usingLabel ? index + 1 : index;

            this.transforms[ transformIndex ].setOpacity( 0, this.options.sizeTransition, (function (index, transformIndex) {

                this.branches.splice( transformIndex, 1 );
                this.bools.splice( index, 1 );
                this.options.values.splice( index, 1 );
                this.transforms.splice( transformIndex, 1 );
                updateSize.call( this );        


            }).bind( this, index, transformIndex ));
        }
    }

    module.exports = MultiBoolToggle;
});

define('famous-ui/PanelScrollview',['require','exports','module','famous-views/Scrollview'],function(require, exports, module) {
    var Scrollview  = require('famous-views/Scrollview');
        
    /*
     *  PanelScrollview takes UI widgets and puts them into a scrollview. 
     *
     *  UI WIDGET REQUIREMENTS:
     *  function init: initialize the widget, creating surfaces.
     *      This is a requirement so the PanelScrollview can auto size the widgets
     *      if they are not set in the user's options of each widget. This gives
     *      the user flexibility to not worry about sizing, or to customize it
     *      if needed. 
     *  function getSize: return the entire size of the widget.
     *  function setSize: set the [width, sliderHeight] of the widget.
     *  function pipe: pipe events to the scrollview.
     *  function render: render the widget.
     *  function get: return the current value of the widget.
     *  function set: set the value of the widget.
     */
    function PanelScrollview( panelOpts ) {

        this.panelOpts = Object.create(PanelScrollview.DEFAULT_OPTIONS)
        if (panelOpts) { this.setPanelOptions(panelOpts) };

        Scrollview.call( this, this.panelOpts.scrollviewOptions );

        this.uiItems = [];
        this._sequenced = false;

    }

    PanelScrollview.DEFAULT_OPTIONS = {
        scrollviewOptions: {
            direction: 'y',
            itemSpacing: 8
        },
        width: 256,
        sliderHeight: 16
    };

    PanelScrollview.prototype = Object.create( Scrollview.prototype );

    PanelScrollview.prototype.setPanelOptions = function(options) {
        for (var key in PanelScrollview.DEFAULT_OPTIONS) {
            if(options[key] !== undefined) this.panelOpts[key] = options[key];
        }
    }

    /**
     * Add a single object to the panel.
     * @private
     */
    function _addOne( obj ) {

        this.uiItems.push( obj );

        if( this._sequenced === false ) {
            this.sequenceFrom( this.uiItems );
            this._sequenced = true;
        }

        if( obj.getSize() === undefined && obj.setSize ) {
            obj.setSize([
                this.panelOpts.width,
                this.panelOpts.sliderHeight
                ]);
        }
        
        if( obj.init ) {
            obj.init();
        }

        if( obj.pipe ) {
            obj.pipe( this );
        }
    }

    PanelScrollview.prototype.reset = function () {
        this.uiItems = [];
        this._sequenced = false;
    };

    PanelScrollview.prototype.add = function ( obj ) {
        if (obj instanceof Array) {

            for (var i = 0; i < obj.length; i++) {
                _addOne.call( this, obj[i] );
            }

        } else {

            _addOne.call( this, obj );

        }
    };

    // TODO
    PanelScrollview.prototype.addBackground = function () {
        
    };

    module.exports = PanelScrollview;
});

define('famous-ui/Slider',['require','exports','module','famous/Surface','famous/Matrix','famous/EventHandler','famous-utils/Utils','famous/Engine','famous/View'],function(require, exports, module) {
    var Surface = require('famous/Surface');
    var FM = require('famous/Matrix');
    var FEH = require('famous/EventHandler');
    var Utils = require('famous-utils/Utils');
    var Engine = require('famous/Engine');
    var View = require('famous/View');

    /** @constructor */
    function Slider( )
    {
        View.apply( this, arguments );
        this.eventInput.pipe( this.eventOutput );

        if( this.options.defaultValue === undefined ) { 
            this.options.defaultValue = (this.options.range[0] + this.options.range[1]) * 0.5;
        }

        this.pos = []; 
        this.value = this.options.defaultValue; 

        this._dirty = true; 
        this.currTouchId = null;             
    }

    Slider.prototype = Object.create( View.prototype );
    Slider.prototype.constructor = Slider;

    Slider.DEFAULT_OPTIONS = { 
        size            : undefined,
        range           : [0, 10],
        defaultValue    : undefined,
        precision       : undefined,
        name            : 'Slider',
        backOpacity     : 1
    }

    Slider.prototype.init = function () {

        this.fill = new Surface({ 
            size: this.options.size,
            classes: ['slider-fill', 'no-user-select']
        });

        this.back = new Surface({ 
            size: this.options.size,
            classes: ['slider-back', 'no-user-select' ]
        }); 
        this.backMatrix = FM.translate(0, 0, 1);

        this.label = new Surface({ 
            size        : this.options.size,
            classes     : ['slider-label', 'no-user-select' ],
            properties  : { 'fontSize': this.options.size[1] * 0.75 + 'px', 'lineHeight': this.options.size[1] + 'px' },
            content     : labelTemplate.call( this )
        }); 
        this.labelMatrix = FM.translate(0, this.options.size[1], 1.2);

        // Events
        this.back.pipe( this );
        this.label.pipe( this );
        this.fill.pipe( this );

        this.on('touchstart', _handleTouchStart.bind(this));
        this.on('touchmove', _handleTouchMove.bind(this));
        this.on('touchend', _handleTouchEnd.bind(this));
        this.on('touchcancel', _handleTouchEnd.bind(this));

        this.on('mousedown', _handleMouseDown.bind(this));
        this.on('mousedown', _handleMouseDown.bind(this));
        
        this._mouseMove = _handleMouseMove.bind(this);
        this._mouseUp = _handleMouseUp.bind(this);
        this._mouseLeave = _handleMouseLeave.bind(this); 
        this._handleStart = _handleStart.bind( this );
        this._handleMove = _handleMove.bind( this );

        this._add( this.fill );
        this._add( this.back );
        this._add( this.label );    
    };

    function stopEvents ( e ) { 
        e.preventDefault();
        e.stopPropagation();        
    }

    // touchstart / mousedown
    function _handleTouchStart (event) {   
        stopEvents( event );
        
        if(this.currTouchId) return;
        var touch = event.changedTouches[0];
        this.currTouchId = touch.identifier;
        this._handleStart(touch);
    }

    function _handleMouseDown (event) {
        stopEvents( event );

        Engine.on('mousemove', this._mouseMove);
        Engine.on('mouseup', this._mouseUp);
        Engine.on('mouseout', this._mouseLeave); 
        
        this._handleStart(event);
    }

    function _handleStart (event) {
        if(this._dirty) {
            this.pos = Utils.getSurfacePosition(this.back);
            this._dirty = false; 
        }
        this.set( Utils.map( (event.pageX - this.pos[0]) / this.options.size[0] , 0.0, 1.0, this.options.range[0], this.options.range[1] , true) ); 
    }

    // touchmoves / mousedrags
    function _handleTouchMove (event) {
        stopEvents( event );

        for(var i = 0; i < event.changedTouches.length; i++) {
            var touch = event.changedTouches[i];            
            if(touch.identifier == this.currTouchId) {
                this._handleMove(touch);
                break; 
            }
        }
    }

    function _handleMouseMove (event) {
        stopEvents( event );
        this._handleMove(event);
    } 

    function _handleMove (event) {
        this.set( Utils.map( (event.pageX - this.pos[0]) / this.options.size[0] , 0.0, 1.0, this.options.range[0], this.options.range[1] , true) ); 
    }

    function _handleTouchEnd (event) {    
        stopEvents( event );
        for(var i = 0; i < event.changedTouches.length; i++) {
            if(event.changedTouches[i].identifier == this.currTouchId) {
                this.currTouchId = undefined;                
                break; 
            }
        }
    } 

    function _handleMouseUp (event) {
        stopEvents( event );
        this._endMouse();
    } 

    function _handleMouseLeave (event) { 
        var outElement = event.relatedTarget || event.toElement;
        if(!outElement || outElement.nodeName == "HTML") { // left the window
            this._endMouse();
        }
    }

    Slider.prototype._endMouse = function() {
        Engine.unbind('mousemove', this._mouseMove);
        Engine.unbind('mouseup', this._mouseUp);
        Engine.unbind('mouseout', this._mouseLeave); 
    };

    // Getters / Setters
    Slider.prototype.get = function() {
        return this.value;
    };

    Slider.prototype.getRange = function() {
        return this.options.range; 
    }; 

    Slider.prototype.setSize = function ( size ) {
        this.options.size = size;
    };

    Slider.prototype.getSize = function () {
        return this.options.size ? [this.options.size[0], this.options.size[1] * 2] : undefined;    
    };

    Slider.prototype.set = function(val) 
    {
        if( this.options.precision !== undefined ) {
            val = parseInt( val.toFixed( this.options.precision ) );
        }

        this.value = Math.min(Math.max(this.options.range[0], val), this.options.range[1]);        
        this.setLabelContent();
        this.emit('change', {value: this.get(), range: this.range});
        return this; 
    };

    Slider.prototype.setLabelContent = function() { 
        this.label.setContent( labelTemplate.call( this ) ); 
    };
    
    Slider.prototype.render = function() 
    {
        var fillSize = ((this.get() - this.options.range[0]) / (this.options.range[1] - this.options.range[0]));
        return [            
            {
                transform: this.backMatrix,
                opacity: this.options.backOpacity,
                target: this.back.render()
            },
            {
                transform: FM.move(FM.scale( fillSize, 1, 1 ), [ 0, 0, 2 ]),
                target: this.fill.render()            
            },                        
            {
                transform: this.labelMatrix,                
                target: this.label.render()
            } 
        ];
    };

    function labelTemplate () {
        return this.options.name + 
            " <span class='slider-value' style='float:right'>" + 
                this.value + 
            "</span>";
    }

    module.exports = Slider;
});

define('famous-ui/AutoUI',['require','exports','module','famous/View','famous/Matrix','famous/Modifier','famous-animation/Easing','famous-ui/PanelScrollview','famous-ui/Toggles/BoolToggle','famous-ui/Toggles/MultiBoolToggle','famous-ui/Easing/MultiEasingToggle','famous-ui/Dropdown/Dropdown','famous-ui/Slider','famous-ui/ColorPicker/ColorPicker','famous-ui/Text/Label'],function(require, exports, module) {    
    var View                = require('famous/View');
    var FM                  = require('famous/Matrix');
    var Modifier            = require('famous/Modifier'); 
    var Easing              = require('famous-animation/Easing');

    var PanelScrollview     = require('famous-ui/PanelScrollview');
    var BoolToggle          = require('famous-ui/Toggles/BoolToggle');
    var MultiBoolToggle     = require('famous-ui/Toggles/MultiBoolToggle');
    var MultiEasingToggle   = require('famous-ui/Easing/MultiEasingToggle');
    var Dropdown            = require('famous-ui/Dropdown/Dropdown');
    var Slider              = require('famous-ui/Slider');
    var ColorPicker         = require('famous-ui/ColorPicker/ColorPicker');

    var Label               = require('famous-ui/Text/Label');

    function AutoPanel ( options ) {
        View.apply( this, arguments );
        this.eventInput.pipe( this.eventOutput );
        
        this.panel = new PanelScrollview( this.options.panelOptions );
        this.pipe( this.panel );
        this.autoUIElements = [];
        this.autoUIElementsMap = { };

        this.panelModifier = new Modifier({ transform: this.options.defaultMatrix });
        this._add( this.panelModifier ).link( this.panel );

        if( this.options.defaultSelected ) {
            this.setCurrentObject( this.options.defaultSelected );
        }
    }

    AutoPanel.prototype = Object.create( View.prototype );
    AutoPanel.prototype.constructor = AutoPanel;

    AutoPanel.DEFAULT_OPTIONS = { 
        saveValues: false,
        panelOptions: { },
        defaultSelected: undefined,
        defaultMatrix: FM.translate( 0, 0 ),
    }
    
    AutoPanel.UI_ELEMENTS = {
        'slider'            : Slider,
        'dropdown'          : Dropdown,
        'colorPicker'       : ColorPicker,
        'toggle'            : BoolToggle,
        'multiBoolToggle'   : MultiBoolToggle,
        'easing'            : MultiEasingToggle,
        'label'             : Label
    }; 

    AutoPanel.prototype.setCurrentObject = function ( obj ) {
        if( obj !== this.currentObj ) { 

            this.currentObject = obj;
            this.clear( addUI.bind( this ));
        }
    }; 

    AutoPanel.prototype.setScrollviewOptions = function ( opts ) {
        return this.panel.setOptions( opts );
    }

    // TODO: Export options as JSON
    AutoPanel.prototype.toJSON = function () {
        var json = [];
        for (var i = 0; i < this.autoUIElements.length; i++) {

        };
    };

    AutoPanel.prototype.reset = function () {
        this.panel.reset();
        this.autoUIElements = [];
        this.autoUIElementsMap = {}; 
    };

    AutoPanel.prototype.getSize = function () {
        return [this.panel.panelOpts.width, undefined]; 
    }

    AutoPanel.prototype.clear = function ( callback ) {

        this.reset();
        if( callback) callback();

    }; 

    function addUI () {

        if( this.currentObject.autoUI ) { 

            for (var i = 0; i < this.currentObject.autoUI.length; i++) {

                var uiDefinition = this.currentObject.autoUI[i];

                if ( uiDefinition.type ) { 
                    this._optionToUI( uiDefinition, this.panel );
                }                 
            }
        }

        if( this._scaledDown ) { 

            this.panelModifier.setTransform( this.options.defaultMatrix, this.options.scaleTransition );
            this._scaledDown = false;
        }
    }

    AutoPanel.prototype._optionToUI = function ( uiDefinition ) {

        var Element = AutoPanel.UI_ELEMENTS[ uiDefinition.type ]; 
        var ui = new Element( uiDefinition.uiOptions );

        this.panel.add( ui );
        this.autoUIElements.push( ui );

        // allow lookup by name
        if(uiDefinition.uiOptions.name)
        {
            this.autoUIElementsMap[uiDefinition.uiOptions.name] = ui;     
        }        

        // with option and maybe callback
        if( uiDefinition.key ) {

            // assumes inheritance from view.
            var optionsManager = uiDefinition.object ? uiDefinition.object.optionsManager : this.currentObject.optionsManager;

            ui.on('change', (function ( optionsManager, key, callback, arg) {

                if( optionsManager ) { 
                    optionsManager.set( key, arg.value );
                }

                if( callback ) callback.call( this, arg.value );

            }).bind( this.currentObject, optionsManager, uiDefinition.key, uiDefinition.callback ));

        // with callback only
        } else if ( uiDefinition.callback ) {
            
            ui.on( 'change', (function (callback, arg) {
                
                callback.call( this, arg.value );

            }).bind( this.currentObject, uiDefinition.callback ));

        }
    };

    AutoPanel.prototype.getUIElementsMap = function()
    {
        return this.autoUIElementsMap; 
    }; 

    module.exports = AutoPanel;
});

define('famous-utils/FormatTime',['require','exports','module'],function(require, exports, module) {

    /**
     * @constructor
     */

    function FormatTime(iso_timestring, format_style) {
        var parts = iso_timestring.toString().match(/(\d+)/g);
        var js_date = new Date(parts[0], parts[1]-1, parts[2], parts[3], parts[4], parts[5], 0);
        var today = new Date();
        var seconds_since = (today.getTime()-js_date.getTime()) * 0.001;
        var minutes_since = parseInt(seconds_since/60, 10);
        var hours_ago = parseInt(minutes_since/60, 10);
        var days_since = parseInt(hours_ago/24, 10);
        var date_list = convert_date_to_human_readable(js_date);

        // Format styles:
        // 0 / undefined - full fuzzy time
        // 1 - only fuzy for the first hour, then return simple time

        // Provide a 1-10 context of how old something is. 1 is new, 10 is old
        var time_stack = 10;
        var timeago = '';

        if (minutes_since < 720) {
            // It's been less than 12 hours. Make it fuzzy
            if (minutes_since < 60) {
                // It's been less than an hour
                if (minutes_since < 2) {
                    timeago = "just now";
                    time_stack = 1;
                    return [timeago, time_stack];
                }

                if (minutes_since < 30) {
                    timeago = minutes_since + " minutes ago";
                    time_stack = 2;
                    return [timeago, time_stack];
                }

                if (minutes_since < 40) {
                    timeago = "about a half hour ago";
                    time_stack = 2;
                    return [timeago, time_stack];
                }

                if (minutes_since < 50) {
                    timeago = "about 45 minutes ago";
                    time_stack = 3;
                    return [timeago, time_stack];
                }

                timeago = "about an hour ago";
                time_stack = 4;
                return [timeago, time_stack];

            }
            else {
                // It was posted today, more than an hour ago
                if (format_style == 1) {
                    timeago = date_list[6] + ":" + date_list[7] + date_list[8];
                }
                else {
                    timeago = "earlier today at " + date_list[6] + ":" + date_list[7] + date_list[8];
                }

                time_stack = 5;
                return [timeago, time_stack];
            }
        }

        if (minutes_since < 1440) {
            // It's been more than 12 hours, but less than 24
            timeago = "yesterday at " + date_list[6] + ":" + date_list[7] + date_list[8];
            time_stack = 6;
            return [timeago, time_stack];
        }

        if (days_since >= 1 && days_since <= 2) {
            // This happened a day ago, yesterday
            timeago = "yesterday at " + date_list[6] + ":" + date_list[7] + date_list[8];
            time_stack = 7;
            return [timeago, time_stack];
        }

        if (days_since < 6) {
            // This happened within the past 5 days
            timeago = date_list[0] + " at " + date_list[6] + ":" + date_list[7] + date_list[8];
            time_stack = 8;
            return [timeago, time_stack];
        }

        if (days_since < 30) {
            // This happened within the past month

            if (format_style == 1) {
                timeago = date_list[3] + "/" + date_list[1] + " at " + date_list[6] + ":" + date_list[7] + date_list[8];
            }
            else {
                timeago = date_list[4] + " " + date_list[1] + date_list[2] + " around " + date_list[6] + date_list[8];
            }

            time_stack = 9;
            return [timeago, time_stack];
        }

        // It's been over a month, just give me a date that's useful
        timeago = format_long_time(date_list, today);
        time_stack = 10;
        return [timeago, time_stack];
    }

    function convert_date_to_human_readable(js_date) {
        var day = js_date.getDate();
        var day_str = js_date.getDay();
        var month = js_date.getMonth() + 1;
        var year = js_date.getFullYear();
        var hour = js_date.getHours();
        var min = js_date.getMinutes().toString();
        var ap = (hour < 12) ? 'am' : 'pm';

        if (min.length < 2) {
            min = "0" + min;
        }

        var day_list = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        var ith_map = {1: "st", 2: "nd", 3: "rd", 4: "th", 5: "th", 6: "th", 7: "th", 8: "th", 9: "th", 10: "th", 11: "th", 12: "th", 13: "th", 14: "th", 15: "th", 16: "th", 17: "th", 18: "th", 19: "th", 20: "th", 21: "st", 22: "nd", 23: "rd", 24: "th", 25: "th", 26: "th", 27: "th", 28: "th", 29: "th", 30: "th", 31: "st"};

        var month_map = {1: "Jan", 2: "Feb", 3: "Mar", 4: "April", 5: "May", 6: "June", 7: "July", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"};


        if (hour === 0) {
            hour = 12;
        }
        if (hour > 12) {
            hour = hour - 12;
        }

        return [day_list[day_str], day, ith_map[day], month, month_map[month], year, hour, min, ap];
    }

    function format_long_time(date_list, today) {
        // returns date as "Nov 1st 2012 at 5:33pm"
        // omit the year if it's the year we're currently in
        var now = today ? today : new Date();
        var timeago = (today.getFullYear() === date_list[5]) ?
            date_list[4] + " " + date_list[1] + date_list[2] :
            date_list[4] + " " + date_list[1] + date_list[2] + " " + date_list[5];

        return timeago;
    }

    module.exports = FormatTime;

});












define('famous-utils/KeyCodes',['require','exports','module'],function(require, exports, module) {
    
    var KeyCodes = {        
        0 : 48,
        1 : 49,
        2 : 50,
        3 : 51,
        4 : 52,
        5 : 53,
        6 : 54,
        7 : 55,
        8 : 56,
        9 : 57,
        A : 65,
        B : 66,
        C : 67,
        D : 68,
        E : 69,
        F : 70,
        G : 71,
        H : 72,
        I : 73,
        J : 74,
        K : 75,
        L : 76,
        M : 77,
        N : 78,
        O : 79,
        P : 80,
        Q : 81,
        R : 82,
        S : 83,
        T : 84,
        U : 85,
        V : 86,
        W : 87,
        X : 88,
        Y : 89,
        Z : 90,     
        a : 97,
        b : 98,
        c : 99,
        d : 100,
        e : 101,
        f : 102,
        g : 103,
        h : 104,
        i : 105,
        j : 106,
        k : 107,         
        l : 108,
        m : 109,
        n : 110,
        o : 111,
        p : 112,
        q : 113,
        r : 114,
        s : 115,
        t : 116,
        u : 117,
        v : 118,
        w : 119,
        x : 120,
        y : 121,
        z : 122, 
        ENTER : 13,
        LEFT_ARROW: 37,
        RIGHT_ARROW: 39,
        UP_ARROW: 38,
        DOWN_ARROW: 40,
        SPACE: 32,
        SHIFT: 16,
        TAB: 9
    };

    module.exports = KeyCodes;
});

define('famous-utils/NoiseImage',['require','exports','module'],function(require, exports, module) {
    var canvas = document.createElement('canvas');

    var ctx = canvas.getContext("2d");

    var hue = function(seed) {
        var random = (Math.random() * 361)>>0;
        var result = seed ? (360 * (seed*0.125)) - ((Math.random() * (46))>>0) : random;
        return result;
    };

    var saturation = function() {
        return 30 + (Math.random() * 71)>>0;
    };
    
    var light = function() {
        return 30 + (Math.random() * 71)>>0;
    };

    var color =  function(seed) {
       ctx.fillStyle = 'hsl(' + hue(seed) + ','+ saturation() +'%,' + light() +'%)';
    };

    function generateNoiseImage (size, fraction, seed) {
        if(!size) size = [128, 128];
        if(!fraction) fraction = 8;

        canvas.width = size[0];
        canvas.height = size[1];

        var halfFraction = fraction>>1;
        var pixelSize = canvas.width/fraction;
        var length = (fraction * fraction)>>1;
        var cachedHalfFraction = 1/halfFraction;

        color(seed);
        ctx.fillRect(0,0,size[0],size[1]);
        color(seed);

        var column,row;
        for (var i = 0; i < length; i++){
            if ((Math.random() + 0.5)>>0){
                row = (i * cachedHalfFraction)>>0;
                column = i - (halfFraction * row);
                ctx.fillRect(column * pixelSize, row * pixelSize, pixelSize, pixelSize);
                ctx.fillRect(((fraction-(column+1))) * pixelSize, row * pixelSize, pixelSize, pixelSize);
            }
        }

        var myImage = canvas.toDataURL("image/png");
        return myImage;
    }


    module.exports = {
       generate: generateNoiseImage
    };

});

define('famous-utils/TimeAgo',['require','exports','module'],function(require, exports, module) {

    function parseTime (time) {
        var now = Date.now();
        var difference = now - time;
        var minute = 60000;
        var hour = 60 * minute;
        var day = 24 * hour;

        if (difference < minute) {
            return "Just Now"
        } else if (difference < hour) {
            var minutes = ~~(difference/minute);
            return minutes + "m";
        } else if (difference < day) {
            var hours = ~~(difference/hour);
            return hours + "h";
        } else {
            var days = ~~(difference/day);
            return days + "d";
        }

    }

    module.exports = {
        parse: parseTime
    }

});

define('famous-views/ControlSet',['require','exports','module','famous/EventHandler','famous/Matrix'],function(require, exports, module) {
    var EventHandler = require('famous/EventHandler');
    var Matrix = require('famous/Matrix');

    /**
     * @name ControlSet
     * @constructor
     * To be deleted.
     */
    function ControlSet() {
        this.eventOutput = new EventHandler();
        EventHandler.setOutputHandler(this, this.eventOutput);

        this.controls = [];
    }

    ControlSet.prototype.include = function(id, control) {
        control.on('change', function(data) {
            this.eventOutput.emit(id, {value: data.value});
        }.bind(this));
        this.controls.push(control);
    };

    ControlSet.prototype.render = function() {
        var result = [];
        var offset = 0;
        var axisSize = 0;
        for(var i = 0; i < this.controls.length; i++) {
            var control = this.controls[i];
            var size = control.getSize();

            result.push({
                transform: Matrix.translate(0, offset),
                target: control.render()
            });

            offset += size[1];
            axisSize = Math.max(axisSize, size[0]);
        }

        return {
            size: [axisSize, offset],
            target: result
        };
    };

    module.exports = ControlSet;
});

define('famous-views/Flip',['require','exports','module','famous/Matrix','famous/Transitionable','famous/RenderNode'],function(require, exports, module) {
    var Matrix = require('famous/Matrix');
    var Transitionable = require('famous/Transitionable');
    var RenderNode = require('famous/RenderNode');

    /**
     * @class Allows you to link two renderables as front and back sides that can be 
     *     'flipped' back and forth along a chosen axis. Rendering optimizations are
     *      automatically handled.
     * 
     * @description
     * @name Flip
     * @constructor
     * @example 
     *     var myFlip = new Flip();
     *     var surface1 = new Surface();
     *     var surface2 = new Surface();
     *     myContext.link(myFlip); // represents two-sided component
     *     flip.linkFront(surface1);
     *     flip.linkBack(surface2);
     *     myFlip.flip(); // causes widget to flip
     */
    function Flip(options) {
        this.options = {
            transition: true,
            cull: true
        };

        if(options) this.setOptions(options);

        this._side = 0;
        this.state = new Transitionable(0);
        
        this.frontNode = new RenderNode();
        this.backNode = new RenderNode();
    }

    Flip.prototype.setDefaultTransition = function(transition) {
        this.transition = transition;
    };

    Flip.prototype.flip = function(side, callback) {
        if(side === undefined) side = (this._side === 1) ? 0 : 1;
        this._side = side;
        this.state.set(side, this.options.transition, callback);
    };

    Flip.prototype.getOptions = function() {
        return this.options;
    };

    Flip.prototype.setOptions = function(options) {
        if(options.transition !== undefined) this.options.transition = options.transition;
        if(options.cull !== undefined) this.options.cull = options.cull;
    };

    Flip.prototype.linkFront = function(obj) {
        return this.frontNode.link(obj);
    };

    Flip.prototype.linkBack = function(obj) {
        return this.backNode.link(obj);
    };

    Flip.prototype.render = function(target) {
        var pos = this.state.get();
        if(target !== undefined) {
            return {
                transform: Matrix.rotateY(Math.PI * pos),
                target: target
            };
        }
        else {
            if(this.options.cull && !this.state.isActive()) {
                if(pos) return this.backNode.render();
                else return this.frontNode.render();
            }
            else {
                return [
                    {
                        transform: Matrix.rotateY(Math.PI * pos),
                        target: this.frontNode.render()
                    },
                    {
                        transform: Matrix.rotateY(Math.PI * (pos + 1)),
                        target: this.backNode.render()
                    }
                ];
            }
        }
    };

    module.exports = Flip;
});

define('famous-views/InputSurface',['require','exports','module','famous/Surface'],function(require, exports, module) {  	
 	var Surface = require('famous/Surface');

    /**
     *  HTML Input Surface
     *
     *  @class A famo.us surface in the form of an HTML
     *  input element.
     */
    function InputSurface ( options ) {

        this._placeholder = options.placeholder || '';
        this._value       = options.value || '';
        this._type        = options.type || 'text';

        Surface.apply(this, arguments);
    }

    InputSurface.prototype = Object.create(Surface.prototype);

    /* Also listen to keyboard events on the surface. */
    InputSurface.prototype.surfaceEvents = Surface.prototype.surfaceEvents.concat(
        ['keypress', 'keyup', 'keydown']);

    InputSurface.prototype.elementType = 'input';
    InputSurface.prototype.elementClass = 'famous-surface';

    /**
     * @name InputSurface#setPlaceholder
     * @param {string} Value to set the html placeholder to.
     * Triggers a repaint next tick.
     * @returns this, allowing method chaining.
     */
    InputSurface.prototype.setPlaceholder = function ( str ) {
        this._placeholder = str;
        this._contentDirty = true;
        return this;
    }

    /**
     * @name InputSurface#setValue
     * @param {string} Value to set the main input value to.
     * Triggers a repaint next tick.
     * @returns this, allowing method chaining.
     */
    InputSurface.prototype.setValue = function ( str ) {
        this._value = str;
        this._contentDirty = true;
        return this;
    }

    /** 
     * @name InputSurface#setType
     * @param {string} Set the type of the input surface.
     * Triggers a repaint next tick.
     * @returns this, allowing method chaining.
     */
    InputSurface.prototype.setType = function ( str ) {
        this._type = str;
        this._contentDirty = true;
        return this;
    }

    /**
     * @name InputSurface#getValue
     * @returns {string} value of current input.
     */
    InputSurface.prototype.getValue = function () {
        if( this._currTarget ) { 
            return this._currTarget.value;
        } else { 
            return this._value;
        }
    }

    /**
     * @name InputSurface#deploy
     * sets the placeholder, value and type of the input.
     */
    InputSurface.prototype.deploy = function (target) {
        if( this._placeholder !== "" ) target.placeholder = this._placeholder;
        target.value = this._value;
        target.type = this._type;
    }

    module.exports = InputSurface;
});

define('famous-views/ScrollContainer',['require','exports','module','famous/ContainerSurface','famous/EventHandler','./Scrollview','famous/Utility'],function(require, exports, module) {
    var ContainerSurface = require('famous/ContainerSurface');
    var EventHandler = require('famous/EventHandler');
    var Scrollview = require('./Scrollview');
    var Utility = require('famous/Utility');

    /**
     * @class A scrollview linked within a container surface.
     * @description
     * @name ScrollContainer
     * @constructor
     * @example 
     *   var myContainer = new ScrollContainer({
     *       look: {
     *           size: [undefined, 500],
     *           properties: {
     *               backgroundColor: '#3cf'
     *           }
     *       },
     *       feel: {
     *           direction: Utility.Direction.Y,
     *           itemSpacing: 20
     *       }
     *   });
     *
     *   var mySurface = [];
     *   for(var i = 0; i < 10; i++) {
     *       mySurfaces[i] = new Surface({content: 'Item ' + i});
     *   }
     *   myContainer.sequenceFrom(mySurfaces); // attach the content
     *   myContext.link(myContainer); // myContainer functions like a Surface
     */
    function ScrollContainer(options) {
        this.options = Object.create(ScrollContainer.DEFAULT_OPTIONS);

        this.surface = new ContainerSurface(this.options.look);
        this.scrollview = new Scrollview(this.options.feel);

        if(options) this.setOptions(options);

        this.surface.link(this.scrollview);

        EventHandler.setInputHandler(this, this.surface);
        EventHandler.setOutputHandler(this, this.surface);

        this.pipe(this.scrollview);
    };

    ScrollContainer.DEFAULT_OPTIONS = {
        look: undefined,
        feel: {direction: Utility.Direction.X}
    };

    ScrollContainer.prototype.setOptions = function(options) {
        if(options.look !== undefined) {
            this.options.look = options.look;
            this.surface.setOptions(this.options.look);
        }
        if(options.feel !== undefined) {
            this.options.feel = options.feel;
            this.scrollview.setOptions(this.options.feel);
        }
    };

    ScrollContainer.prototype.sequenceFrom = function() {
        return this.scrollview.sequenceFrom.apply(this.scrollview, arguments);
    };

    ScrollContainer.prototype.render = function() { 
        return this.surface.render.apply(this.surface, arguments);
    };

    module.exports = ScrollContainer;
});

define('famous-views/SequentialLayout',['require','exports','module','famous/OptionsManager','famous/Matrix','famous/Transitionable','famous/ViewSequence','famous/Utility'],function(require, exports, module) {
    var OptionsManager = require('famous/OptionsManager');
    var Matrix = require('famous/Matrix');
    var Transitionable = require('famous/Transitionable');
    var ViewSequence = require('famous/ViewSequence');
    var Utility = require('famous/Utility');

    /**
     * @class Lays out specified renderables sequentially.
     * @description
     * @name SequentialLayout
     * @constructor
     * @example 
     *   define(function(require, exports, module) {
     *           var Engine = require('famous/Engine');
     *           var SequentialLayout = require('famous-views/SequentialLayout');
     *           var Surface = require('famous/Surface');
     *
     *           var Context = Engine.createContext();
     *           var sequentiallayout = new SequentialLayout({
     *               itemSpacing: 2
     *           });
     *
     *           var surfaces = [];
     *           for (var index = 0; index < 10; index++) {
     *               surfaces.push(
     *                   new Surface({
     *                       content: 'test ' + String(index + 1),
     *                       size: [window.innerWidth * 0.1 - 1, undefined],
     *                       properties: {
     *                           backgroundColor: '#3cf',
     *                       }
     *                   })
     *               );
     *           }
     *
     *           sequentiallayout.sequenceFrom(surfaces);
     *           Context.link(sequentiallayout);
     *   });
     */
    function SequentialLayout(options) {
        this._items = null;
        this._size = null;
        this._outputFunction = SequentialLayout.DEFAULT_OUTPUT_FUNCTION;

        this.options = Object.create(this.constructor.DEFAULT_OPTIONS);
        this.optionsManager = new OptionsManager(this.options);
        if(options) this.setOptions(options);
    };

    SequentialLayout.DEFAULT_OPTIONS = {
        direction: Utility.Direction.X,
        defaultItemSize: [50, 50],
        itemSpacing: 0
    };

    SequentialLayout.DEFAULT_OUTPUT_FUNCTION = function(input, offset, index) {
        var transform = (this.options.direction === Utility.Direction.X) ? Matrix.translate(offset, 0) : Matrix.translate(0, offset);
        return {
            transform: transform,
            target: input.render()
        };
    };

    SequentialLayout.prototype.getSize = function() {
        if(!this._size) this.render(); // hack size in
        return this._size;
    };

    SequentialLayout.prototype.sequenceFrom = function(items) {
        if(items instanceof Array) items = new ViewSequence(items);
        this._items = items;
        return this;
    };

    SequentialLayout.prototype.setOptions = function(options) {
        this.optionsManager.setOptions.apply(this.optionsManager, arguments);
        return this;
    };

    SequentialLayout.prototype.setOutputFunction = function(outputFunction) {
        this._outputFunction = outputFunction;
        return this;
    };

    SequentialLayout.prototype.render = function() {
        var length = 0;
        var girth = 0;

        var lengthDim = (this.options.direction === Utility.Direction.X) ? 0 : 1;
        var girthDim = (this.options.direction === Utility.Direction.X) ? 1 : 0;

        var currentNode = this._items;
        var result = [];
        while(currentNode) {
            var item = currentNode.get();

            if(length) length += this.options.itemSpacing; // start flush

            var itemSize;
            if(item && item.getSize) itemSize = item.getSize();
            if(!itemSize) itemSize = this.options.defaultItemSize;
            if(itemSize[girthDim] !== true) girth = Math.max(girth, itemSize[girthDim]);

            var output = this._outputFunction.call(this, item, length, result.length);
            result.push(output);
            
            if(itemSize[lengthDim] && (itemSize[lengthDim] !== true)) length += itemSize[lengthDim];
            currentNode = currentNode.getNext();
        }

        if(!girth) girth = undefined;

        if(!this._size) this._size = [0, 0];
        this._size[lengthDim] = length;
        this._size[girthDim] = girth;

        return {
            size: this.getSize(),
            target: result
        };
    };

    module.exports = SequentialLayout;
});

define('famous-views/Shaper',['require','exports','module','famous/RenderNode','famous/Matrix','famous/Modifier','famous/Utility'],function(require, exports, module) {
    var FamousRenderNode = require('famous/RenderNode');
    var FM = require('famous/Matrix');
    var Modifier = require('famous/Modifier');
    var Utility = require('famous/Utility');

    /**
     * @name Shaper
     * @constructor
     * To be deleted.
     */
    function FamousShaper(panels) {
        this.nodes = [];
        this.transforms = [];
        this.defaultTransition = {duration: 1000, curve: 'easeInOut'};

        for(var id in panels) this.side(id).from(panels[id]);
    }

    FamousShaper.prototype.side = function(id) {
        if(!this.nodes[id]) {
            this.transforms[id] = new Modifier();
            this.transforms[id].setDefaultTransition(this.defaultTransition);
            this.nodes[id] = new FamousRenderNode(this.transforms[id]);
        }
        return this.nodes[id];
    };

    FamousShaper.prototype.halt = function(id) {
        this.transforms[id].halt();
    };

    FamousShaper.prototype.haltSet = function(idList) {
        for(var i = 0; i < idList.length; i++) {
            this.halt(i);
        }
    };

    FamousShaper.prototype.haltAll = function() {
        this.haltSet(this.all());
    };

    FamousShaper.prototype.set = function(id, transform, transition, callback) {
        if(!this.transforms[id]) {
            if(callback) callback();
            return;
        }
        this.transforms[id].setTransform(transform, transition, callback);
    };

    FamousShaper.prototype.setShape = function(idList, shape, transition, callback) {
        var shapeFn = (typeof shape == 'function') ? shape : function(i) { return shape[i]; };
        var onceCb = callback ? Utility.after(idList.length, callback) : undefined;
        for(var i = 0; i < idList.length; i++) {
            this.set(idList[i], shapeFn(i), transition, onceCb);
        }
    };

    FamousShaper.prototype.setShapeAll = function(shape, transition, callback) {
        this.setShape(this.all(), shape, transition, callback);
    };

    FamousShaper.prototype.modify = function(id, transform, transition, callback) {
        var finalTransform = FM.multiply(this.transforms[id].getFinalTransform(), transform);
        this.set(id, finalTransform, transition, callback);
    };

    FamousShaper.prototype.modifySet = function(idList, transform, transition, callback) {
        var onceCb = callback ? Utility.after(idList.length, callback) : undefined;
        for(var i = 0; i < idList.length; i++) {
            this.modify(idList[i], transform, transition, onceCb);
        }
    };

    FamousShaper.prototype.modifyAll = function(transform, transition, callback) {
        this.modify(this.all(), transform, transition, callback);
    };

    FamousShaper.prototype.setOpacity = function(id, opacity, transition, callback) {
        this.transforms[id].setOpacity(opacity, transition, callback);
    };

    FamousShaper.prototype.setOpacitySet = function(idList, opacity, transition, callback) {
        var onceCb = callback ? Utility.after(idList.length, callback) : undefined;
        for(var i = 0; i < idList.length; i++) {
            this.setOpacity(idList[i], opacity, transition, onceCb);
        }
    };

    FamousShaper.prototype.setOpacityAll = function(opacity, transition, callback) {
        this.setOpacitySet(this.all(), opacity, transition, callback);
    };

    FamousShaper.prototype.all = function() {
        var result = [];
        for(var i in this.nodes) result.push(i);
        return result;
    };

    FamousShaper.prototype.getTransform = function(id) {
        return this.transforms[id].getTransform();
    };

    FamousShaper.prototype.getOpacity = function(id) {
        return this.transforms[id].getOpacity();
    };

    FamousShaper.prototype.isMoving = function(id) {
        return this.transforms[id].isMoving();
    };

    FamousShaper.prototype.render = function() {
        var result = [];
        for(var i = 0; i < this.nodes.length; i++) {
            result[i] = this.nodes[i].execute();
        }
        return result;
    };

    module.exports = FamousShaper;
});

define('famous-views/Swappable',['require','exports','module','famous/RenderNode','famous/Matrix','famous/Modifier'],function(require, exports, module) {
    var RenderNode = require('famous/RenderNode');
    var Matrix = require('famous/Matrix');
    var Modifier = require('famous/Modifier');

    /**
     * @class Swappable
     * @desciption
     * Allows you to swap different renderables in and out.
     * @name Swappable
     * @constructor
     * @example
     *   define(function(require, exports, module) {
     *       var Engine = require('famous/Engine');
     *       var Swappable = require('famous-modifiers/Swappable');
     *       var Surface = require('famous/Surface');
     *
     *       var swappable = new Swappable();
     *
     *       for (var i = 0; i < 5; i++) {
     *           var color = 'hsl(' + String(i<<4) + ',80%,80%)';
     *
     *           var surface = new Surface({
     *               content: 'test ' + String(i + 1),
     *               size: [300, 300],
     *               properties: {
     *                   backgroundColor: color,
     *                   textShadow: '0px 0px 5px black',
     *                   textAlign: 'center'
     *               }
     *           });
     *
     *           swappable.item(i).link(surface);
     *       }
     *
     *       var Context = Engine.createContext();
     *
     *       var item = 0;
     *
     *       var iterate = function() {
     *           swappable.select(item);
     *           if (item >= 4) {
     *               item = 0;
     *           } else {
     *               item++;
     *           }
     *       };
     *
     *       Context.link(swappable);
     *       iterate();
     *       Engine.on('click', iterate);
     *   });
     */
    function Swappable(options) {

        this.options = {
            initTransform  : Matrix.identity,
            initOpacity    : 0,
            finalTransform : Matrix.identity,
            finalOpacity   : 0,
            inTransition   : {duration : 500, curve : 'easeInOut'},
            outTransition  : {duration : 500, curve : 'easeInOut'},
            async          : false
        };

        this.nodes = {};
        this.transforms = [];

        this.currIndex = -1;
        this.prevIndex = -1;

        this.setOptions(options);

    }

    Swappable.prototype.item = function(i) {
        var result = new RenderNode(new Modifier(this.options.initTransform, this.options.initOpacity), true);
        this.nodes[i] = result;
        return result;
    };

    Swappable.prototype.select = function(i, callback) {
        if(i == this.currIndex) return;

        if(this.options.async) {
            _transitionOut.call(this, this.currIndex, (function() {
                _transitionIn.call(this, this.currIndex, callback);
            }).bind(this));
        }
        else{
            _transitionOut.call(this, this.currIndex);
            _transitionIn.call(this, i, callback);
        }
        this.currIndex = i;
    };

    function _transition(i, initTransform, initOpacity, finalTransform, finalOpacity, transition, callback) {
        if(!(i in this.nodes)) return;
        var transform = this.nodes[i].modifiers[0];
        console.log(this.nodes[i]);
        if(transform.isMoving && !transform.isMoving()) {
            if(initTransform) transform.setTransform(initTransform);
            if(initOpacity !== undefined) transform.setOpacity(initOpacity);
        }
        transform.setTransform(finalTransform, transition);
        transform.setOpacity(finalOpacity, transition, callback);
    }

    function _transitionIn(i, callback) {
        _transition.call(this, i, this.options.initTransform, this.options.initOpacity, Matrix.identity, 1, this.options.inTransition, callback);
    }

    function _transitionOut(i, callback) {
        _transition.call(this, i, undefined, undefined, this.options.finalTransform, this.options.finalOpacity, this.options.outTransition, callback);
    }

    Swappable.prototype.setOptions = function(options){
        for (var key in options) this.options[key] = options[key];
    };

    Swappable.prototype.getOptions = function(){
        return this.options;
    };

    Swappable.prototype.render = function() {
        var result = [];
        for(var i in this.nodes) {
            result.push(this.nodes[i].render());
        }
        return result;
    };

    module.exports = Swappable;

});

define('main',['require','exports','module','app/ArticleViews/ArticleBottomView','app/ArticleViews/ArticleFullView','app/ArticleViews/ArticleTopView','app/ArticleViews/ArticleView','app/CoverViews/CoverView','app/Data/CoverData','app/Data/StoryData','app/StoryViews/ArticleStoryView','app/StoryViews/FooterView','app/StoryViews/NameView','app/StoryViews/NumberView','app/StoryViews/PhotoStoryView','app/StoryViews/ProfilePicView','app/StoryViews/ProfilePicsView','app/StoryViews/StoriesView','app/StoryViews/StoryView','app/StoryViews/TextView','app/AppView','famous/CanvasSurface','famous/ContainerSurface','famous/Context','famous/ElementAllocator','famous/Engine','famous/Entity','famous/EventArbiter','famous/EventHandler','famous/Group','famous/ImageSurface','famous/Matrix','famous/Modifier','famous/MultipleTransition','famous/OptionsManager','famous/RenderNode','famous/Scene','famous/SceneCompiler','famous/SpecParser','famous/Surface','famous/Timer','famous/Transitionable','famous/TweenTransition','famous/Utility','famous/VideoSurface','famous/View','famous/ViewSequence','famous/WebGLSurface','famous-animation/Animation','famous-animation/AnimationEngine','famous-animation/CubicBezier','famous-animation/Easing','famous-animation/GenericAnimation','famous-animation/Idle','famous-animation/PiecewiseCubicBezier','famous-animation/RegisterEasing','famous-animation/Sequence','famous-animation/Timer','famous-color/Color','famous-color/ColorPalette','famous-color/ColorPalettes','famous-math/Quaternion','famous-math/Random','famous-math/Vector','famous-modifiers/Camera','famous-modifiers/Draggable','famous-performance/Profiler','famous-performance/ProfilerMetric','famous-performance/ProfilerMetricView','famous-performance/ProfilerView','famous-physics/bodies/Body','famous-physics/bodies/Circle','famous-physics/bodies/Particle','famous-physics/bodies/Rectangle','famous-physics/constraints/Collision','famous-physics/constraints/CollisionJacobian','famous-physics/constraints/Constraint','famous-physics/constraints/Curve','famous-physics/constraints/Distance','famous-physics/constraints/Distance1D','famous-physics/constraints/Rod','famous-physics/constraints/Rope','famous-physics/constraints/StiffSpring','famous-physics/constraints/Surface','famous-physics/constraints/Wall','famous-physics/constraints/Walls','famous-physics/constraints/joint','famous-physics/forces/Drag','famous-physics/forces/Force','famous-physics/forces/Repulsion','famous-physics/forces/Spring','famous-physics/forces/TorqueSpring','famous-physics/forces/VectorField','famous-physics/forces/rotationalDrag','famous-physics/integrator/SymplecticEuler','famous-physics/integrator/verlet','famous-physics/math/GaussSeidel','famous-physics/math/Quaternion','famous-physics/math/Random','famous-physics/math/Vector','famous-physics/math/matrix','famous-physics/utils/PhysicsTransition','famous-physics/utils/PhysicsTransition2','famous-physics/utils/SpringTransition','famous-physics/utils/StiffSpringTransition','famous-physics/utils/WallTransition','famous-physics/PhysicsEngine','famous-sync/FastClick','famous-sync/GenericSync','famous-sync/MouseSync','famous-sync/PinchSync','famous-sync/RotateSync','famous-sync/ScaleSync','famous-sync/ScrollSync','famous-sync/TouchSync','famous-sync/TouchTracker','famous-sync/TwoFingerSync','famous-ui/Buttons/ButtonBase','famous-ui/Buttons/RotateButton','famous-ui/Buttons/SpringButton','famous-ui/Buttons/SpringButton.ui','famous-ui/ColorPicker/AlphaPicker','famous-ui/ColorPicker/CanvasPicker','famous-ui/ColorPicker/ColorButton','famous-ui/ColorPicker/ColorPicker','famous-ui/ColorPicker/GradientPicker','famous-ui/ColorPicker/HuePicker','famous-ui/Dropdown/Dropdown','famous-ui/Dropdown/DropdownItem','famous-ui/Easing/CanvasDrawer','famous-ui/Easing/EasingBool','famous-ui/Easing/EasingVisualizer','famous-ui/Easing/MultiEasingToggle','famous-ui/Text/Label','famous-ui/Toggles/BoolToggle','famous-ui/Toggles/MultiBoolToggle','famous-ui/AutoUI','famous-ui/PanelScrollview','famous-ui/Slider','famous-utils/FormatTime','famous-utils/KeyCodes','famous-utils/NoiseImage','famous-utils/Time','famous-utils/TimeAgo','famous-utils/Utils','famous-views/ControlSet','famous-views/Flip','famous-views/InputSurface','famous-views/LightBox','famous-views/ScrollContainer','famous-views/Scrollview','famous-views/SequentialLayout','famous-views/Shaper','famous-views/Swappable','surface-extensions/ExpandingSurface'],function(require, exports, module) {
var Famous = function(cb) { cb.call(this, require) };
Famous.App = {};
Famous.App.ArticleViews_ArticleBottomView = require('app/ArticleViews/ArticleBottomView');
Famous.App.ArticleViews_ArticleFullView = require('app/ArticleViews/ArticleFullView');
Famous.App.ArticleViews_ArticleTopView = require('app/ArticleViews/ArticleTopView');
Famous.App.ArticleViews_ArticleView = require('app/ArticleViews/ArticleView');
Famous.App.CoverViews_CoverView = require('app/CoverViews/CoverView');
Famous.App.Data_CoverData = require('app/Data/CoverData');
Famous.App.Data_StoryData = require('app/Data/StoryData');
Famous.App.StoryViews_ArticleStoryView = require('app/StoryViews/ArticleStoryView');
Famous.App.StoryViews_FooterView = require('app/StoryViews/FooterView');
Famous.App.StoryViews_NameView = require('app/StoryViews/NameView');
Famous.App.StoryViews_NumberView = require('app/StoryViews/NumberView');
Famous.App.StoryViews_PhotoStoryView = require('app/StoryViews/PhotoStoryView');
Famous.App.StoryViews_ProfilePicView = require('app/StoryViews/ProfilePicView');
Famous.App.StoryViews_ProfilePicsView = require('app/StoryViews/ProfilePicsView');
Famous.App.StoryViews_StoriesView = require('app/StoryViews/StoriesView');
Famous.App.StoryViews_StoryView = require('app/StoryViews/StoryView');
Famous.App.StoryViews_TextView = require('app/StoryViews/TextView');
Famous.App.AppView = require('app/AppView');
Famous.Famous = {};
Famous.Famous.CanvasSurface = require('famous/CanvasSurface');
Famous.Famous.ContainerSurface = require('famous/ContainerSurface');
Famous.Famous.Context = require('famous/Context');
Famous.Famous.ElementAllocator = require('famous/ElementAllocator');
Famous.Famous.Engine = require('famous/Engine');
Famous.Famous.Entity = require('famous/Entity');
Famous.Famous.EventArbiter = require('famous/EventArbiter');
Famous.Famous.EventHandler = require('famous/EventHandler');
Famous.Famous.Group = require('famous/Group');
Famous.Famous.ImageSurface = require('famous/ImageSurface');
Famous.Famous.Matrix = require('famous/Matrix');
Famous.Famous.Modifier = require('famous/Modifier');
Famous.Famous.MultipleTransition = require('famous/MultipleTransition');
Famous.Famous.OptionsManager = require('famous/OptionsManager');
Famous.Famous.RenderNode = require('famous/RenderNode');
Famous.Famous.Scene = require('famous/Scene');
Famous.Famous.SceneCompiler = require('famous/SceneCompiler');
Famous.Famous.SpecParser = require('famous/SpecParser');
Famous.Famous.Surface = require('famous/Surface');
Famous.Famous.Timer = require('famous/Timer');
Famous.Famous.Transitionable = require('famous/Transitionable');
Famous.Famous.TweenTransition = require('famous/TweenTransition');
Famous.Famous.Utility = require('famous/Utility');
Famous.Famous.VideoSurface = require('famous/VideoSurface');
Famous.Famous.View = require('famous/View');
Famous.Famous.ViewSequence = require('famous/ViewSequence');
Famous.Famous.WebGLSurface = require('famous/WebGLSurface');
Famous.FamousAnimation = {};
Famous.FamousAnimation.Animation = require('famous-animation/Animation');
Famous.FamousAnimation.AnimationEngine = require('famous-animation/AnimationEngine');
Famous.FamousAnimation.CubicBezier = require('famous-animation/CubicBezier');
Famous.FamousAnimation.Easing = require('famous-animation/Easing');
Famous.FamousAnimation.GenericAnimation = require('famous-animation/GenericAnimation');
Famous.FamousAnimation.Idle = require('famous-animation/Idle');
Famous.FamousAnimation.PiecewiseCubicBezier = require('famous-animation/PiecewiseCubicBezier');
Famous.FamousAnimation.RegisterEasing = require('famous-animation/RegisterEasing');
Famous.FamousAnimation.Sequence = require('famous-animation/Sequence');
Famous.FamousAnimation.Timer = require('famous-animation/Timer');
Famous.FamousColor = {};
Famous.FamousColor.Color = require('famous-color/Color');
Famous.FamousColor.ColorPalette = require('famous-color/ColorPalette');
Famous.FamousColor.ColorPalettes = require('famous-color/ColorPalettes');
Famous.FamousMath = {};
Famous.FamousMath.Quaternion = require('famous-math/Quaternion');
Famous.FamousMath.Random = require('famous-math/Random');
Famous.FamousMath.Vector = require('famous-math/Vector');
Famous.FamousModifiers = {};
Famous.FamousModifiers.Camera = require('famous-modifiers/Camera');
Famous.FamousModifiers.Draggable = require('famous-modifiers/Draggable');
Famous.FamousPerformance = {};
Famous.FamousPerformance.Profiler = require('famous-performance/Profiler');
Famous.FamousPerformance.ProfilerMetric = require('famous-performance/ProfilerMetric');
Famous.FamousPerformance.ProfilerMetricView = require('famous-performance/ProfilerMetricView');
Famous.FamousPerformance.ProfilerView = require('famous-performance/ProfilerView');
Famous.FamousPhysics = {};
Famous.FamousPhysics.Bodies_Body = require('famous-physics/bodies/Body');
Famous.FamousPhysics.Bodies_Circle = require('famous-physics/bodies/Circle');
Famous.FamousPhysics.Bodies_Particle = require('famous-physics/bodies/Particle');
Famous.FamousPhysics.Bodies_Rectangle = require('famous-physics/bodies/Rectangle');
Famous.FamousPhysics.Constraints_Collision = require('famous-physics/constraints/Collision');
Famous.FamousPhysics.Constraints_CollisionJacobian = require('famous-physics/constraints/CollisionJacobian');
Famous.FamousPhysics.Constraints_Constraint = require('famous-physics/constraints/Constraint');
Famous.FamousPhysics.Constraints_Curve = require('famous-physics/constraints/Curve');
Famous.FamousPhysics.Constraints_Distance = require('famous-physics/constraints/Distance');
Famous.FamousPhysics.Constraints_Distance1D = require('famous-physics/constraints/Distance1D');
Famous.FamousPhysics.Constraints_Rod = require('famous-physics/constraints/Rod');
Famous.FamousPhysics.Constraints_Rope = require('famous-physics/constraints/Rope');
Famous.FamousPhysics.Constraints_StiffSpring = require('famous-physics/constraints/StiffSpring');
Famous.FamousPhysics.Constraints_Surface = require('famous-physics/constraints/Surface');
Famous.FamousPhysics.Constraints_Wall = require('famous-physics/constraints/Wall');
Famous.FamousPhysics.Constraints_Walls = require('famous-physics/constraints/Walls');
Famous.FamousPhysics.Constraints_joint = require('famous-physics/constraints/joint');
Famous.FamousPhysics.Forces_Drag = require('famous-physics/forces/Drag');
Famous.FamousPhysics.Forces_Force = require('famous-physics/forces/Force');
Famous.FamousPhysics.Forces_Repulsion = require('famous-physics/forces/Repulsion');
Famous.FamousPhysics.Forces_Spring = require('famous-physics/forces/Spring');
Famous.FamousPhysics.Forces_TorqueSpring = require('famous-physics/forces/TorqueSpring');
Famous.FamousPhysics.Forces_VectorField = require('famous-physics/forces/VectorField');
Famous.FamousPhysics.Forces_rotationalDrag = require('famous-physics/forces/rotationalDrag');
Famous.FamousPhysics.Integrator_SymplecticEuler = require('famous-physics/integrator/SymplecticEuler');
Famous.FamousPhysics.Integrator_verlet = require('famous-physics/integrator/verlet');
Famous.FamousPhysics.Math_GaussSeidel = require('famous-physics/math/GaussSeidel');
Famous.FamousPhysics.Math_Quaternion = require('famous-physics/math/Quaternion');
Famous.FamousPhysics.Math_Random = require('famous-physics/math/Random');
Famous.FamousPhysics.Math_Vector = require('famous-physics/math/Vector');
Famous.FamousPhysics.Math_matrix = require('famous-physics/math/matrix');
Famous.FamousPhysics.Utils_PhysicsTransition = require('famous-physics/utils/PhysicsTransition');
Famous.FamousPhysics.Utils_PhysicsTransition2 = require('famous-physics/utils/PhysicsTransition2');
Famous.FamousPhysics.Utils_SpringTransition = require('famous-physics/utils/SpringTransition');
Famous.FamousPhysics.Utils_StiffSpringTransition = require('famous-physics/utils/StiffSpringTransition');
Famous.FamousPhysics.Utils_WallTransition = require('famous-physics/utils/WallTransition');
Famous.FamousPhysics.PhysicsEngine = require('famous-physics/PhysicsEngine');
Famous.FamousSync = {};
Famous.FamousSync.FastClick = require('famous-sync/FastClick');
Famous.FamousSync.GenericSync = require('famous-sync/GenericSync');
Famous.FamousSync.MouseSync = require('famous-sync/MouseSync');
Famous.FamousSync.PinchSync = require('famous-sync/PinchSync');
Famous.FamousSync.RotateSync = require('famous-sync/RotateSync');
Famous.FamousSync.ScaleSync = require('famous-sync/ScaleSync');
Famous.FamousSync.ScrollSync = require('famous-sync/ScrollSync');
Famous.FamousSync.TouchSync = require('famous-sync/TouchSync');
Famous.FamousSync.TouchTracker = require('famous-sync/TouchTracker');
Famous.FamousSync.TwoFingerSync = require('famous-sync/TwoFingerSync');
Famous.FamousUi = {};
Famous.FamousUi.Buttons_ButtonBase = require('famous-ui/Buttons/ButtonBase');
Famous.FamousUi.Buttons_RotateButton = require('famous-ui/Buttons/RotateButton');
Famous.FamousUi.Buttons_SpringButton = require('famous-ui/Buttons/SpringButton');
Famous.FamousUi.Buttons_SpringButton.ui = require('famous-ui/Buttons/SpringButton.ui');
Famous.FamousUi.ColorPicker_AlphaPicker = require('famous-ui/ColorPicker/AlphaPicker');
Famous.FamousUi.ColorPicker_CanvasPicker = require('famous-ui/ColorPicker/CanvasPicker');
Famous.FamousUi.ColorPicker_ColorButton = require('famous-ui/ColorPicker/ColorButton');
Famous.FamousUi.ColorPicker_ColorPicker = require('famous-ui/ColorPicker/ColorPicker');
Famous.FamousUi.ColorPicker_GradientPicker = require('famous-ui/ColorPicker/GradientPicker');
Famous.FamousUi.ColorPicker_HuePicker = require('famous-ui/ColorPicker/HuePicker');
Famous.FamousUi.Dropdown_Dropdown = require('famous-ui/Dropdown/Dropdown');
Famous.FamousUi.Dropdown_DropdownItem = require('famous-ui/Dropdown/DropdownItem');
Famous.FamousUi.Easing_CanvasDrawer = require('famous-ui/Easing/CanvasDrawer');
Famous.FamousUi.Easing_EasingBool = require('famous-ui/Easing/EasingBool');
Famous.FamousUi.Easing_EasingVisualizer = require('famous-ui/Easing/EasingVisualizer');
Famous.FamousUi.Easing_MultiEasingToggle = require('famous-ui/Easing/MultiEasingToggle');
Famous.FamousUi.Text_Label = require('famous-ui/Text/Label');
Famous.FamousUi.Toggles_BoolToggle = require('famous-ui/Toggles/BoolToggle');
Famous.FamousUi.Toggles_MultiBoolToggle = require('famous-ui/Toggles/MultiBoolToggle');
Famous.FamousUi.AutoUI = require('famous-ui/AutoUI');
Famous.FamousUi.PanelScrollview = require('famous-ui/PanelScrollview');
Famous.FamousUi.Slider = require('famous-ui/Slider');
Famous.FamousUtils = {};
Famous.FamousUtils.FormatTime = require('famous-utils/FormatTime');
Famous.FamousUtils.KeyCodes = require('famous-utils/KeyCodes');
Famous.FamousUtils.NoiseImage = require('famous-utils/NoiseImage');
Famous.FamousUtils.Time = require('famous-utils/Time');
Famous.FamousUtils.TimeAgo = require('famous-utils/TimeAgo');
Famous.FamousUtils.Utils = require('famous-utils/Utils');
Famous.FamousViews = {};
Famous.FamousViews.ControlSet = require('famous-views/ControlSet');
Famous.FamousViews.Flip = require('famous-views/Flip');
Famous.FamousViews.InputSurface = require('famous-views/InputSurface');
Famous.FamousViews.LightBox = require('famous-views/LightBox');
Famous.FamousViews.ScrollContainer = require('famous-views/ScrollContainer');
Famous.FamousViews.Scrollview = require('famous-views/Scrollview');
Famous.FamousViews.SequentialLayout = require('famous-views/SequentialLayout');
Famous.FamousViews.Shaper = require('famous-views/Shaper');
Famous.FamousViews.Swappable = require('famous-views/Swappable');
Famous.SurfaceExtensions = {};
Famous.SurfaceExtensions.ExpandingSurface = require('surface-extensions/ExpandingSurface');
module.exports = Famous; });
require(["lib/classList", "lib/functionPrototypeBind", "lib/requestAnimationFrame", "main"]);
    return require('main');
}));
