/// <amd-dependency path="vendor/jquery/jquery-2.1.3" />
/// <amd-dependency path="vendor/backbone/backbone-1.1.2" />
/// <amd-dependency path="vendor/underscore/underscore-1.8.2" />
/// 'library.component.utilities'
/// <reference path="../../typings/jquery/jquery.d.ts" />
'use strict';
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Fantasite;
(function (Fantasite) {
    var $ = require('jquery');
    var Backbone = require('backbone-1.1.2');
    var _ = require('underscore-1.8.2');
    Fantasite.DataBindOneWay = 'oneway'; //replace by const
    Fantasite.DataBindTwoWay = 'twoway'; //replace by const
    Fantasite.DataBindOneWayToSource = 'onewaytosource'; //replace by const
    Fantasite.DataBindOneTime = 'onetime'; //replace by const
    var ComponentList = (function () {
        function ComponentList() {
            this._instances = {};
        }
        ComponentList.prototype.get = function (type) {
            return this._instances[type];
        };
        ComponentList.prototype.add = function (component) {
            if (this.get(component.__type) !== undefined) {
                throw ('Cannot instantiate two same component for same DOMElement');
            }
            this._instances[component.__type] = component;
        };
        ComponentList.prototype.has = function (componentType) {
            return this.get(componentType) !== undefined;
        };
        ComponentList.prototype.remove = function (component) {
            delete this._instances[component.__type];
        };
        ComponentList.prototype.removeType = function (type) {
            delete this._instances[type];
        };
        return ComponentList;
    })();
    Fantasite.ComponentList = ComponentList;
    ;
    var DataBindItem = (function (_super) {
        __extends(DataBindItem, _super);
        function DataBindItem(object) {
            _super.call(this);
            var recurDatas = arguments[1];
            if (!recurDatas) {
                recurDatas = [];
            }
            recurDatas.push(object);
            var internalProperty = {};
            _.each(object, (function (value, attribute) {
                if (value instanceof Function) {
                    this[attribute] = value;
                }
                else {
                    if (value instanceof Object) {
                        var indexOf = recurDatas.indexOf(value);
                        if (indexOf === -1) {
                            value = new DataBindItem(value);
                        }
                        else {
                            value = recurDatas[indexOf];
                        }
                    }
                    internalProperty['_' + attribute] = value;
                    var property = {
                        get: function getProperty() {
                            return internalProperty['_' + attribute];
                        },
                        set: function setProperty(setValue) {
                            if (setValue instanceof Object && !(setValue instanceof DataBindItem)) {
                                throw ('DataBindItem cannot support object value yet.');
                                setValue = new DataBindItem(setValue);
                            }
                            if (internalProperty['_' + attribute] === setValue) {
                                return;
                            }
                            internalProperty['_' + attribute] = setValue;
                            this.trigger(DataBindItem.DataBindItemEventPropertyChange + ':' + attribute);
                            this.trigger(DataBindItem.DataBindItemEventPropertyChange, { attribute: attribute });
                        },
                        enumerable: true
                    };
                    Object.defineProperty(this, attribute, property);
                }
            }).bind(this));
        }
        DataBindItem.DataBindItemEventPropertyChange = 'propertychange'; //switch with const in ES6 
        return DataBindItem;
    })(Backbone.Events);
    Fantasite.DataBindItem = DataBindItem;
    /*_.extend(DataBindItem.prototype, Backbone.Events, {
        
    });*/
    /********************\
        * Array binding    *
    \********************/
    var ArrayBinding = (function () {
        function ArrayBinding(arrayDatas) {
            if (arrayDatas === undefined) {
                arrayDatas = [];
            }
            if (!(arrayDatas instanceof Array)) {
                throw ('ArrayBinding need be initialize with an Array');
            }
            Array.prototype.splice.apply(this, ([0, 0]).concat(arrayDatas));
        }
        return ArrayBinding;
    })();
    Fantasite.ArrayBinding = ArrayBinding;
    ArrayBinding['prototype'] = new Array();
    _.extend(ArrayBinding.prototype, Backbone.Events, {
        pop: function popArrayBinding() {
            this.trigger('pop:before');
            var datas = Array.prototype.pop.call(this);
            this.trigger('pop:after');
            this.trigger(DataBindItem.DataBindItemEventPropertyChange + ':length');
            return datas;
        },
        push: function pushArrayBinding() {
            this.trigger('push:before');
            var datas = Array.prototype.push.apply(this, arguments);
            this.trigger('push:after');
            this.trigger(DataBindItem.DataBindItemEventPropertyChange + ':length');
            return datas;
        },
        reverse: function reverseArrayBinding() {
            this.trigger('reverse:before');
            Array.prototype.reverse.call(this);
            this.trigger('reverse:after');
            return this;
        },
        shift: function shiftArrayBinding() {
            this.trigger('shift:before');
            var datas = Array.prototype.shift.apply(this);
            this.trigger('shift:after');
            this.trigger(DataBindItem.DataBindItemEventPropertyChange + ':length');
            return datas;
        },
        sort: function sortArrayBinding() {
            this.trigger('sort:before');
            Array.prototype.sort.apply(this, arguments);
            this.trigger('sort:after');
            return this;
        },
        splice: function spliceArrayBinding() {
            this.trigger('splice:before');
            var length = this.length;
            var datas = Array.prototype.splice.apply(this, arguments);
            this.trigger('splice:after');
            if (length !== this.length) {
                this.trigger(DataBindItem.DataBindItemEventPropertyChange + ':length');
            }
            return datas;
        },
        unshift: function unshiftArrayBinding() {
            this.trigger('unshift:before');
            var datas = Array.prototype.unshift.apply(this, arguments);
            this.trigger('unshift:after');
            this.trigger(DataBindItem.DataBindItemEventPropertyChange + ':length');
            return datas;
        },
        clear: function clearArrayBinding() {
            this.trigger('clear:before');
            var length = this.length;
            var datas = Array.prototype.splice.call(this, 0, this.length);
            this.trigger('clear:after');
            if (length !== this.length) {
                this.trigger(DataBindItem.DataBindItemEventPropertyChange + ':length');
            }
            return datas;
        }
    });
    /**************\
     *  Component *
    \**************/
    var Component = (function (_super) {
        __extends(Component, _super);
        function Component($dom, index) {
            _super.call(this);
            this.options = {};
            this.$dom = null;
            this.__type = undefined;
            this.__id = undefined;
            if (this.__type === undefined) {
                throw ('A component must implemented a type!');
            }
            this._initialize($dom, index);
        }
        //<div data-bind="text:duration library.ui.converters:humanDuration"></div>
        //<div data-bind="{text: artist, addClass:type"></div>
        Component.prototype.checkNullable = function (dataBindOptions, value) {
            if (dataBindOptions.nullable === false && (value === null || value === undefined)) {
                return '';
            }
            return value;
        };
        /**
         * Apply value to dom
         */
        Component.prototype.setDataBind = function ($dom, attribute, value, isFinal, dataBindOptions) {
            var exprAttribute = ComponentUtilities.exprToMethod(attribute);
            var domBinder = ComponentUtilities.evalValue.call($dom, exprAttribute.method);
            if (domBinder.binder === undefined || !(domBinder.attribute in domBinder.binder)) {
                domBinder = ComponentUtilities.evalValue.call($dom[0], exprAttribute.method);
                if (domBinder.binder === undefined) {
                    return;
                }
            }
            if (domBinder.binder[domBinder.attribute] instanceof Function) {
                var attrArgs = ComponentUtilities.cleanParams(exprAttribute.args);
                if (isFinal) {
                    attrArgs.push(this.checkNullable(dataBindOptions, value));
                    domBinder.binder[domBinder.attribute].apply(domBinder.binder, attrArgs);
                }
                else {
                    if (this[value] instanceof Function) {
                        attrArgs.push(this[value].bind(this));
                        domBinder.binder[domBinder.attribute].apply(domBinder.binder, attrArgs);
                    }
                    else {
                        attrArgs.push(this.checkNullable(dataBindOptions, this[value]));
                        domBinder.binder[domBinder.attribute].apply(domBinder.binder, attrArgs);
                    }
                }
            }
            else {
                if (isFinal) {
                    domBinder.binder[domBinder.attribute] = this.checkNullable(dataBindOptions, value);
                }
                else {
                    if (this[value] instanceof Function) {
                        domBinder.binder[domBinder.attribute] = this[value].bind(this);
                    }
                    else {
                        domBinder.binder[domBinder.attribute] = this.checkNullable(dataBindOptions, this[value]);
                    }
                }
            }
        };
        Component.prototype.applyDataBind = function ($dom, attribute, value, dataBindOptions) {
            var params = ComponentUtilities.cleanParams(value.split(' '));
            var that = this;
            if (params.length > 1) {
                var domDataBind = params.shift();
                var converters = ComponentUtilities.cleanParams(params.join(' ').split(':'));
                require([converters[0]], function (Converter) {
                    var evalResult = ComponentUtilities.evalValue.call(that, domDataBind);
                    var converterDatas = ComponentUtilities.exprToMethod(converters[1]);
                    var converterArgs = ComponentUtilities.cleanParams(converterDatas.args);
                    var lazyApplyDataBindConverter = function lazyApplyDataBindConverterFunction() {
                        var finalArgs = [evalResult.binder[evalResult.attribute]];
                        for (var i = 0; i < converterArgs.length; ++i) {
                            var currentArg = ComponentUtilities.evalValue.call(that, converterArgs[i]);
                            if (currentArg.isValue === true) {
                                finalArgs.push(currentArg.attribute);
                            }
                            else {
                                finalArgs.push(currentArg.binder[currentArg.attribute]);
                            }
                        }
                        var converterMethod = Converter[converterDatas.method];
                        this.setDataBind.call(evalResult.binder, $dom, attribute, converterMethod.apply(converterMethod, finalArgs), true, dataBindOptions);
                    };
                    if (dataBindOptions.mode !== Fantasite.DataBindOneTime && dataBindOptions.mode !== Fantasite.DataBindOneWayToSource) {
                        //evalResult.binder.on(DataBindItemEventPropertyChange + ':' + evalResult.attribute, lazyApplyDataBindConverter);
                        evalResult.binder.on(DataBindItem.DataBindItemEventPropertyChange + ':' + evalResult.attribute, lazyApplyDataBindConverter);
                    }
                    lazyApplyDataBindConverter();
                });
            }
            else {
                var evalResult = ComponentUtilities.evalValue.call(that, value);
                var lazyApplyDataBind = function () {
                    if (dataBindOptions.lazy) {
                        try {
                            this.setDataBind.call(evalResult.binder, $dom, attribute, evalResult.attribute, false, dataBindOptions);
                        }
                        catch (e) {
                            setTimeout(lazyApplyDataBind, 0);
                        }
                    }
                    else {
                        this.setDataBind.call(evalResult.binder, $dom, attribute, evalResult.attribute, false, dataBindOptions);
                    }
                };
                if (dataBindOptions.mode !== Fantasite.DataBindOneTime && dataBindOptions.mode !== Fantasite.DataBindOneWayToSource) {
                    evalResult.binder.on(DataBindItem.DataBindItemEventPropertyChange + ':' + evalResult.attribute, lazyApplyDataBind);
                }
                lazyApplyDataBind();
            }
        };
        Component.prototype._initialize = function ($dom, index) {
            this.__id = '__comp' + (++Component.instanceId);
            var options = $dom.data('options');
            if (options) {
                if (index !== undefined) {
                    this.options = $.extend({}, this.options, options[index]);
                }
                else if (options instanceof Array) {
                    this.options = $.extend({}, this.options, options[0]);
                }
                else {
                    this.options = $.extend({}, this.options, options);
                }
            }
            else {
                this.options = $.extend({}, this.options);
            }
            var componentsList = $dom.data('jamComponents');
            if (componentsList === undefined) {
                componentsList = new ComponentList();
                $dom.data('jamComponents', componentsList);
            }
            componentsList.add(this);
            $dom.addClass('jam-component-init');
            if (index !== undefined) {
                $dom.addClass('jam-component-init-' + index);
            }
            if (this.__ctor.call(this, $dom) !== false) {
                this._dataBind($dom); //Need many improvment...
            }
            this.$dom = $dom; //check remove from DOM event to destroy object
            this.initialize.apply(this, arguments);
        };
        Component.prototype.__ctor = function () {
        };
        Component.prototype._dataBind = function ($dom) {
            var $dataBindList = $dom.find('[data-bind]');
            // Remove all data-bind inside of template component: they will be computed after template generation.
            // We keep data-bind in template component, to let the choice to personalize template option
            var $templateBindList = $dataBindList.filter('[data-component*="component.template"]');
            var $subTemplateComponent = $templateBindList.find('[data-bind]');
            $dataBindList = $dataBindList.not($subTemplateComponent);
            var $selfBind = $dom.filter('[data-bind]');
            if ($selfBind.length) {
                $dataBindList = $dataBindList.add($selfBind);
            }
            var that = this;
            $dataBindList.each(function _dataBindEachFunction(i, nodeDataBind) {
                that._applyBind(nodeDataBind);
            });
        };
        Component.prototype._applyBind = function (nodeDataBind) {
            var $nodeDataBind = $(nodeDataBind);
            var dataBind = $nodeDataBind.data('bind');
            var dataBindOption = $.extend({ mode: Fantasite.DataBindOneTime, nullable: false, lazy: false }, $nodeDataBind.data('bind-options'));
            var ContainerBind;
            if ('bindDataSource' in this.options && this.options.bindDataSource !== 'this') {
                ContainerBind = this[this.options.bindDataSource];
            }
            else {
                ContainerBind = this;
            }
            if (dataBind instanceof Object) {
                if ('_type' in dataBind && dataBind._type !== this.__type) {
                    return;
                }
                var privateProperties = ['_type'];
                for (var i in dataBind) {
                    if (privateProperties.indexOf(i) > -1) {
                        continue;
                    }
                    this.applyDataBind.call(ContainerBind, $nodeDataBind, i, dataBind[i], dataBindOption);
                }
            }
            else {
                var args = ComponentUtilities.cleanParams(dataBind.split(':'));
                this.applyDataBind.call(ContainerBind, $nodeDataBind, args.shift(), args.join(':'), dataBindOption);
            }
        };
        Component.prototype.initialize = function () {
        };
        Component.prototype.output = function () {
            if (!('output' in this.options)) {
                return;
            }
            var outputs = this.options.output;
            if (!(outputs instanceof Array)) {
                outputs = [outputs];
            }
            var datas = arguments;
            _.each(outputs, (function (output) {
                var $container;
                if (!('selector' in output)) {
                    $container = this.$dom;
                }
                else if ('context' in output) {
                    if (output.context === 'global') {
                        $container = $(output.selector);
                    }
                    else if (output.context === 'ancestor') {
                        $container = this.$dom.closest(output.selector);
                    }
                    else {
                        $container = this.$dom.find(output.selector);
                    }
                }
                else {
                    $container = this.$dom.find(output.selector);
                }
                var componentList = $container.data('jamComponents');
                if (!componentList) {
                    //lazy option?
                    return;
                }
                var outputComponent = componentList.get(output.component);
                outputComponent[output.input].apply(outputComponent, datas);
                if ('onOutput' in output) {
                    var property = output.onOutput;
                    if (this[property] instanceof Function) {
                        this[property].apply(this, datas);
                    }
                    else {
                        this[property] = datas;
                    }
                }
            }).bind(this));
        };
        Component.instanceId = 0;
        Component.extend = function extend(protoProps, staticProps) {
            var child = Backbone.Model.extend.call(this, protoProps, staticProps);
            if (protoProps) {
                for (var i in protoProps) {
                    if (protoProps[i] && protoProps[i].isProperty) {
                        Object.defineProperty(child.prototype, i, protoProps[i]);
                    }
                }
            }
            if (staticProps) {
                for (var i in staticProps) {
                    if (staticProps[i] && staticProps[i].isProperty) {
                        Object.defineProperty(child, i, staticProps[i]);
                    }
                }
            }
            return child;
        };
        return Component;
    })(Backbone.Events);
    Fantasite.Component = Component;
    ;
    var ComponentUtilities;
    (function (ComponentUtilities) {
        var evalResultMethod = ['isMethod', 'isAttribute', 'isValue'];
        var EvalResult = (function () {
            function EvalResult(datas) {
                Object.defineProperty(this, 'binder', {
                    get: function () {
                        return datas.binder;
                    },
                    enumerable: true
                });
                Object.defineProperty(this, 'attribute', {
                    get: function () {
                        return datas.attribute;
                    },
                    enumerable: true
                });
                for (var i = 0; i < evalResultMethod.length; ++i) {
                    var method = evalResultMethod[i];
                    Object.defineProperty(this, method, {
                        get: function () {
                            return method in datas && datas[method] === true;
                        },
                        enumerable: true
                    });
                }
            }
            return EvalResult;
        })();
        ComponentUtilities.EvalResult = EvalResult;
        ;
        function isStringSingleQuote(value) {
            return /^'(.*)'$/.test(value);
        }
        function isStringDoubleQuote(value) {
            return /^"(.*)"$/.test(value);
        }
        function isString(value) {
            return isStringSingleQuote(value) || isStringDoubleQuote(value);
        }
        function extractStringValue(value) {
            if (isStringSingleQuote(value)) {
                return value.match(/^'(.*)'$/)[1];
            }
            else if (isStringDoubleQuote(value)) {
                return value.match(/^"(.*)"$/)[1];
            }
        }
        function isMethod(value) {
            return isString(value) === false && /[^().]+(\(.*?\))/.test(value);
        }
        function isNumeric(value) {
            return !isNaN(value);
        }
        function evalValue(value) {
            /*
            'track.id.toString(.654).toLowerCase().find("div#id.lala")'.match(/[^().]+(\(.*?\))?/g)
            ["track", "id", "toString(.654)", "toLowerCase()", "find("div#id.lala")"]
            */
            var params;
            if (isString(value)) {
                params = [value];
            }
            else {
                params = value.match(/[^().]+(\(.*?\))?/g);
            }
            var currentContainer = this;
            for (var i = 0; i < params.length - 1; ++i) {
                var subValue = params[i];
                if (isMethod(subValue)) {
                    //TODO: Allow global function ?
                    var parseSubValue = subValue.match(/([^().]+)(\(.*?\))/);
                    var cleanParam = cleanParams(parseSubValue[2].match(/^\((.*)\)$/)[1].split(','));
                    for (var j = 0; j < cleanParam.length; ++j) {
                        var evalResult = evalValue(cleanParam[j]);
                        if (evalResult.isValue) {
                            cleanParam[j] = evalResult.attribute;
                        }
                        else if (evalResult.isAttribute) {
                            cleanParam[j] = evalResult.binder[evalResult.attribute];
                        }
                        else if (evalResult.isMethod) {
                            cleanParam[j] = evalResult.binder[evalResult.attribute](); //params ?
                        }
                    }
                    currentContainer = currentContainer[parseSubValue[1]].apply(currentContainer, cleanParam);
                }
                else {
                    currentContainer = currentContainer[subValue];
                }
            }
            var finalValue = params[params.length - 1];
            if (isString(finalValue) || isNumeric(finalValue)) {
                if (isString(finalValue)) {
                    finalValue = extractStringValue(finalValue);
                }
                return new EvalResult({
                    attribute: finalValue,
                    isValue: true
                });
            }
            return new EvalResult({
                attribute: finalValue,
                binder: currentContainer,
                isAttribute: true
            });
        }
        ComponentUtilities.evalValue = evalValue;
        function exprToMethod(exprInput) {
            var exprExplode = exprInput.match(/^(.*?)(\[{1}(.*)\]{1})?$/);
            var method = exprExplode[1];
            var args = exprExplode[3];
            if (args !== undefined) {
                args = args.split(',');
            }
            else {
                args = [];
            }
            return {
                method: method,
                args: args
            };
        }
        ComponentUtilities.exprToMethod = exprToMethod;
        function cleanParams(params) {
            for (var i = 0; i < params.length; ++i) {
                if (params[i] === '' || params[i] === null || params[i] === undefined) {
                    params.splice(i--, 1);
                }
                else {
                    params[i] = params[i].trim();
                }
            }
            return params;
        }
        ComponentUtilities.cleanParams = cleanParams;
    })(ComponentUtilities = Fantasite.ComponentUtilities || (Fantasite.ComponentUtilities = {}));
})(Fantasite || (Fantasite = {}));
