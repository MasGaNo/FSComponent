/// <reference path="../../../scripts/typings/jquery/jquery.d.ts" />

'use strict';

import $ = require('jquery');
import Backbone = require('backbone');
import _ = require('underscore');

//declare function require(name: string);
//declare function require(name: string[], callback: any);

module Fantasite {

    export var DataBindOneWay : string = 'oneway';//replace by const
    export var DataBindTwoWay: string = 'twoway';//replace by const
    export var DataBindOneWayToSource: string = 'onewaytosource';//replace by const
    export var DataBindOneTime: string = 'onetime';//replace by const
    
    export class ComponentList {
        private _instances: {[s:string]:Component}
        public constructor() {
            this._instances = {};
        }
        public get(type: string) : Component {
            return this._instances[type];
        }
        public add(component: Component) : void {
            if (this.get(component.__type) !== undefined) {
                throw('Cannot instantiate two same component for same DOMElement');
            }
            this._instances[component.__type] = component;
        }
        public has(componentType: string): Boolean {
            return this.get(componentType) !== undefined;
        }
        public remove(component: Component) : void {
            delete this._instances[component.__type];
        }
        public removeType(type: string) : void {
            delete this._instances[type];
        }
    };
    
	// Replace by FSEventDispatcher
    export class DataBindItem extends Backbone.Events {

        public static DataBindItemEventPropertyChange: string = 'propertychange';//switch with const in ES6 
    
        public constructor(object: Object) {
        
            super();

            var recurDatas : Array<any> = arguments[1];
            if (!recurDatas) {
                recurDatas = [];
            }
            recurDatas.push(object);
        
            var internalProperty : Object = {};
        
            _.each(object, (function(value, attribute) {

                if (value instanceof Function) {
                    this[attribute] = value;
                } else {
                
                    if (value instanceof Object) {
                        var indexOf = recurDatas.indexOf(value);
                        if (indexOf === -1) {
                            value = new DataBindItem(value);
                        } else {
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
                                throw('DataBindItem cannot support object value yet.')
                                setValue = new DataBindItem(setValue);
                                // check if the properties has some binding info, so refresh data and reload evalValue
                            }
                        
                            if (internalProperty['_' + attribute] === setValue) {
                                return;
                            }
                        
                            internalProperty['_' + attribute] = setValue;
                            this.trigger(DataBindItem.DataBindItemEventPropertyChange + ':' + attribute);
                            this.trigger(DataBindItem.DataBindItemEventPropertyChange, {attribute:attribute});
                        },
                        enumerable:true
                    };
                    Object.defineProperty(this, attribute, property);
                }
            }).bind(this));
        }
    }
    
    /*_.extend(DataBindItem.prototype, Backbone.Events, {
        
    });*/

    /********************\
        * Array binding    *
    \********************/

    export class ArrayBinding {

        public constructor(arrayDatas: any|ArrayBinding) {
            if (arrayDatas === undefined) {
                arrayDatas = [];
            }
            if (!(arrayDatas instanceof Array)) {
                throw ('ArrayBinding need be initialize with an Array');
            }

            Array.prototype.splice.apply(this,([0, 0]).concat(arrayDatas));
        }
    }
    ArrayBinding['prototype'] = new Array();
    _.extend(ArrayBinding.prototype, /*Array.prototype,*/ Backbone.Events, {
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
    
    export class Component extends Backbone.Events {

        public constructor ($dom : JQuery, index : number) {
        
            super();

            if (this.__type === undefined) {
                throw('A component must implemented a type!');
            }
        
            this._initialize($dom, index);
        }
    
        //<div data-bind="text:duration library.ui.converters:humanDuration"></div>
        //<div data-bind="{text: artist, addClass:type"></div>

        private checkNullable(dataBindOptions, value : any) {
            if (dataBindOptions.nullable === false && (value === null || value === undefined)) {
                return '';
            }
            return value;
        }
    
        /**
         * Apply value to dom
         */
        private setDataBind($dom : JQuery, attribute : string, value : any, isFinal : Boolean, dataBindOptions) {
        
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
                } else {
                    if (this[value] instanceof Function) {
                        attrArgs.push(this[value].bind(this));
                        domBinder.binder[domBinder.attribute].apply(domBinder.binder, attrArgs);
                    } else {
                        attrArgs.push(this.checkNullable(dataBindOptions, this[value]));
                        domBinder.binder[domBinder.attribute].apply(domBinder.binder, attrArgs);
                    }
                }
            } else {
                if (isFinal) {
                    domBinder.binder[domBinder.attribute] = this.checkNullable(dataBindOptions, value);
                } else {
                    if (this[value] instanceof Function) {
                        domBinder.binder[domBinder.attribute] = this[value].bind(this);
                    } else {
                        domBinder.binder[domBinder.attribute] = this.checkNullable(dataBindOptions, this[value]);
                    }
                }
            }
        }
    
        private applyDataBind($dom : JQuery, attribute : string, value : string, dataBindOptions) {
            var params : Array<string> = ComponentUtilities.cleanParams(value.split(' '));
            var that = this;
        
            if (params.length > 1) {
                var domDataBind = params.shift();
                var converters : Array<string> = ComponentUtilities.cleanParams(params.join(' ').split(':'));
                require([converters[0]], function(Converter) {
                
                    var evalResult = ComponentUtilities.evalValue.call(that, domDataBind);
                
                    var converterDatas = ComponentUtilities.exprToMethod(converters[1]);
                    var converterArgs = ComponentUtilities.cleanParams(converterDatas.args);
                
                    var lazyApplyDataBindConverter = function lazyApplyDataBindConverterFunction() {
                    
                        var finalArgs = [evalResult.binder[evalResult.attribute]];
                        for (var i = 0; i < converterArgs.length; ++i) {
                            var currentArg = ComponentUtilities.evalValue.call(that, converterArgs[i]);
                            if (currentArg.isValue === true) {
                                finalArgs.push(currentArg.attribute);
                            } else {
                                finalArgs.push(currentArg.binder[currentArg.attribute]);
                            }
                        }
                    
                        var converterMethod = Converter[converterDatas.method];
                        this.setDataBind.call(evalResult.binder, $dom, attribute, converterMethod.apply(converterMethod/*this?*/, finalArgs), true, dataBindOptions);
                    };
                    if (dataBindOptions.mode !== DataBindOneTime && dataBindOptions.mode !== DataBindOneWayToSource) {
                        //evalResult.binder.on(DataBindItemEventPropertyChange + ':' + evalResult.attribute, lazyApplyDataBindConverter);
                        evalResult.binder.on(DataBindItem.DataBindItemEventPropertyChange + ':' + evalResult.attribute, lazyApplyDataBindConverter);
                    }
                    lazyApplyDataBindConverter();
                });
            } else {
            
                var evalResult = ComponentUtilities.evalValue.call(that, value);
                        
                var lazyApplyDataBind = function() {
                    if (dataBindOptions.lazy) {
                        try {
                            this.setDataBind.call(evalResult.binder, $dom, attribute, evalResult.attribute, false, dataBindOptions);
                        } catch(e) {
                            setTimeout(lazyApplyDataBind, 0);
                        }
                    } else {
                        this.setDataBind.call(evalResult.binder, $dom, attribute, evalResult.attribute, false, dataBindOptions);
                    }
                };
                if (dataBindOptions.mode !== DataBindOneTime && dataBindOptions.mode !== DataBindOneWayToSource) {
                    evalResult.binder.on(DataBindItem.DataBindItemEventPropertyChange + ':' + evalResult.attribute, lazyApplyDataBind);
                    // keep all data-binding list for DataBindItemConstructor
                }
                lazyApplyDataBind();
            }
        }
    
        private static instanceId : number = 0;
    
        private _initialize($dom : JQuery, index : number) {
            
            this.__id = '__comp' + (++Component.instanceId);
            
            var options = $dom.data('options');
            if (options) {
                
                if (index !== undefined) {
                    this.options = $.extend({}, this.options, options[index]);
                } else if (options instanceof Array) {
                    this.options = $.extend({}, this.options, options[0]);
                } else {
                    this.options = $.extend({}, this.options, options);
                }
            } else {
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
                this._dataBind($dom);//Need many improvment...
            }
            
            this.$dom = $dom;//check remove from DOM event to destroy object
            
            this.initialize.apply(this, arguments);
        }
        protected __ctor() { }
        protected _dataBind($dom: JQuery) {
            var $dataBindList: JQuery = $dom.find('[data-bind]');

            // Remove all data-bind inside of template component: they will be computed after template generation.
            // We keep data-bind in template component, to let the choice to personalize template option
            var $templateBindList : JQuery = $dataBindList.filter('[data-component*="component.template"]');
            var $subTemplateComponent: JQuery = $templateBindList.find('[data-bind]');
            $dataBindList = $dataBindList.not($subTemplateComponent);
            
            var $selfBind:JQuery = $dom.filter('[data-bind]');
            if ($selfBind.length) {
                $dataBindList = $dataBindList.add($selfBind);
            }
            
            var that = this;
            $dataBindList.each(function _dataBindEachFunction(i : number, nodeDataBind : HTMLElement) {
                that._applyBind(nodeDataBind);
            });
        }
        protected _applyBind(nodeDataBind: HTMLElement) {
            var $nodeDataBind: JQuery = $(nodeDataBind);
            var dataBind = $nodeDataBind.data('bind');
            
            var dataBindOption = $.extend({mode:DataBindOneTime, nullable:false, lazy:false}, $nodeDataBind.data('bind-options'));
            
            var ContainerBind;
            if ('bindDataSource' in this.options && this.options.bindDataSource !== 'this') {
                ContainerBind = this[this.options.bindDataSource];
            } else {
                ContainerBind = this;
            }
            
            if (dataBind instanceof Object){
                
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
            } else {
                var args = ComponentUtilities.cleanParams(dataBind.split(':'));
                this.applyDataBind.call(ContainerBind, $nodeDataBind, args.shift(), args.join(':'), dataBindOption);
            }
        }
        protected initialize(){}
        protected output() {
            if (!('output' in this.options)) {
                return;
            }
            var outputs = this.options.output;
            if (!(outputs instanceof Array)) {
                outputs = [outputs];
            }
            
            var datas = arguments;
            
            _.each(outputs, (function(output) {
                var $container;
                if (!('selector' in output)) {
                    $container = this.$dom;
                } else if ('context' in output) {
                    if (output.context === 'global') {
                        $container = $(output.selector);
                    } else if (output.context === 'ancestor') {
                        $container = this.$dom.closest(output.selector);
                    } else {
                        $container = this.$dom.find(output.selector);
                    }
                } else {
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
                    } else {
                        this[property] = datas;
                    }
                }
            }).bind(this));
        }
        options: any = {}
        $dom: JQuery = null
        __type: string = undefined
        __id: string = undefined

        static extend = function extend(protoProps, staticProps) {
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
    };
    
    export module ComponentUtilities {

        var evalResultMethod = ['isMethod', 'isAttribute', 'isValue'];

        interface IEvalResult {

            isValue?: boolean
            isAttribute?: boolean
            attribute?: string
            isMethod?: boolean
            binder?: any

        }

        export class EvalResult implements IEvalResult {

            public constructor(datas) {

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
        };
        
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
            } else if (isStringDoubleQuote(value)) {
                return value.match(/^"(.*)"$/)[1];
            }
        }

        function isMethod(value) {
            return isString(value) === false && /[^().]+(\(.*?\))/.test(value);
        }

        function isNumeric(value) {
            return !isNaN(value);
        }

        export function evalValue(value : string): IEvalResult {
            /*
            'track.id.toString(.654).toLowerCase().find("div#id.lala")'.match(/[^().]+(\(.*?\))?/g)
            ["track", "id", "toString(.654)", "toLowerCase()", "find("div#id.lala")"]
            */
            var params;
            if (isString(value)) {
                params = [value];
            } else {
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
                        var evalResult: IEvalResult = evalValue(cleanParam[j]);
                        if (evalResult.isValue) {
                            cleanParam[j] = evalResult.attribute;
                        } else if (evalResult.isAttribute) {
                            cleanParam[j] = evalResult.binder[evalResult.attribute];
                        } else if (evalResult.isMethod) {
                            cleanParam[j] = evalResult.binder[evalResult.attribute]();//params ?
                        }
                    }
                    currentContainer = currentContainer[parseSubValue[1]].apply(currentContainer, cleanParam);
                } else {
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

            return new EvalResult(
                {
                    attribute: finalValue,
                    binder: currentContainer,
                    isAttribute: true
                }
            );
        }

        export function exprToMethod(exprInput) {
            var exprExplode = exprInput.match(/^(.*?)(\[{1}(.*)\]{1})?$/);
            var method = exprExplode[1];
            var args = exprExplode[3];
            if (args !== undefined) {
                args = args.split(',');
            } else {
                args = [];
            }
            return {
                method: method,
                args: args
            };
        }

        export function cleanParams(params) {
            for (var i = 0; i < params.length; ++i) {
                if (params[i] === '' || params[i] === null || params[i] === undefined) {
                    params.splice(i--, 1);
                } else {
                    params[i] = params[i].trim();
                }
            }
            return params;
        }
    }

    //Component.DataBindItem = DataBindItem;
    //Component.ArrayBinding = ArrayBinding;
    
}