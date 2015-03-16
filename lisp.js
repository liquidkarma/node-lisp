// Copyright(C) 2010 synapticfailure.com, except where otherwise noted

exports.Lisp = (function(){
   var globalSymbols = {};
   var cadr          = /^c[ad]+r$/;
   var traceEl       = null;

   function parseLists(x){
      var stack  = [];
      var tokens = [];
      var token  = '';
      var depth  = 0;
      var quotes = [];
      var l      = x.length;
      for(var i = 0; i < l; i++){
         var c = x.charAt(i);
         if('\'"() \r\n'.indexOf(c) >= 0){
            if(token.length > 0){
               tokens.push(token);
               token = '';
               if(quotes.length > 0 && quotes[quotes.length - 1] == depth){
                  var tmp = stack.pop();
                  tmp.push(tokens);
                  tokens = tmp;
                  quotes.pop();
               }
            }
            if(c == '('){
               stack.push(tokens);
               tokens = [];
               depth++;
            }
            else if(c == ')'){
               depth--;
               if(depth < 0)
                  throw 'Unbalanced parens (unexpected/extra right paren)';
               var tmp = stack.pop();
               tmp.push(tokens);
               tokens = tmp;
               if(quotes.length > 0 && quotes[quotes.length - 1] == depth){
                  var tmp = stack.pop();
                  tmp.push(tokens);
                  tokens = tmp;
                  quotes.pop();
               }
            }
            else if(c == '"'){
               var esc = false;
               token = '"';
               do{
                  ++i;
                  if(i >= l)
                     throw 'Unbalanced quotation';
                  c = x.charAt(i);
                  token += c;
                  if(esc){
                     c   = '';
                     esc = false;
                  }
                  else if(c == '\\')
                     esc = true;
               } while(c != '"');
               tokens.push(token);
               token = '';
            }
            else if(c == '\''){
               stack.push(tokens);
               tokens = ['quote'];
               quotes.push(depth);
            }
         }
         else
            token += c;
      }
      if(depth > 0)
         throw 'Unbalanced parens (missing right paren)';
      else{
         if(token.length > 0)
            tokens.push(token);
         if(quotes.length > 0){
            var tmp = stack.pop();
            tmp.push(tokens);
            tokens = tmp;
         }
         return tokens;
      }
   }

   function requireNArgs(args, n, op){
      if(args.length < n){
         if(n == 1)
            throw "At least one argument expected for " + op + " operator";
         else
            throw "Not enough arguments specified for " + op + " operator";
      }
      else if(args.length > n)
         throw "Too many arguments for " + op + " operator, expected " + (n == 1 ? 'one' : n);
   }

   function atLeast(n, args, op){
      if(args.length < n)
         throw "At least " + n + " argument required for " + op + " operator";
   }

   function isNumber(x){
      return !isNaN(Number(x));
   }

   function toNumber(x, symbols){
      var arg   = lispEval(x, symbols);
      var value = Number(arg);
      if(isNaN(value))
         throw "Not a valid number: " + arg;
      return value;
   }

   function aggregate(args, initial, f){
      var agg   = initial;
      var count = args.length;
      for(var i = 0; i < count; i++)
         agg = f.call(this, agg, args[i]);
      return agg;
   }

   function isAtom(x, symbols){
      var value = lispEval(x, symbols);
      return (value == null || typeof(value) != 'object' || value.length == 0);
   }

   function isEmpty(x){
      return (x == null || (typeof(x) == 'object' && x.length == 0));
   }

   function createFunction(args, expr, symbols){
      if(typeof(args) == 'object' && args.length > 0){
         var count = args.length;
         for(var i = 0; i < count; i++){
            if(!isAtom(['quote', args[i]], symbols))
               throw 'Argument of function is not an atom: ' + args[i];
         }
      }
      return function(funcArgs, funcSymbols){
         if(args.length != funcArgs.length)
            throw 'Invalid number of arguments for function (expected ' + args.length + ')'
         if(expr == null)
            return null;
         else{
            var callSymbols = {};
            for(var sym in symbols)
               callSymbols[sym] = symbols[sym];
            var count = funcArgs.length;
            for(var i = 0; i < count; i++)
               callSymbols[args[i]] = lispEval(funcArgs[i], funcSymbols);
            return lispEval(expr, callSymbols);
         }
      };
   }

   var funcs = {
      'quote': function(args, symbols){
         requireNArgs(args, 1, 'quote');
         return args[0];
      },

      'atom': function(args, symbols){
         requireNArgs(args, 1, 'atom');
         return isAtom(args[0], symbols);
      },

      'numberp': function(args, symbols){
         requireNArgs(args, 1, 'numberp');
         return isNumber(lispEval(args[0], symbols));
      },

      '+': function(args, symbols){
         return aggregate(args, 0, function(x, y){ return x + toNumber(y, symbols) });
      },

      '*': function(args, symbols){
         return aggregate(args, 1, function(x, y){ return x * toNumber(y, symbols) });
      },

      '-': function(args, symbols){
         atLeast(1, args, 'subtraction');
         return aggregate(args, args.length == 1 ? 0 : toNumber(args[0], symbols) * 2, function(x, y){ return x - toNumber(y, symbols) });
      },

      '/': function(args, symbols){
         atLeast(1, args, 'divide');
         var initial = toNumber(args[0], symbols);
         return aggregate(args, initial * initial, function(x, y){ return x / toNumber(y, symbols) });
      },

      '<': function(args, symbols){
         atLeast(1, args, 'less than');
         return aggregate(args, [true, toNumber(args[0], symbols) - 1], function(x, y){ var val = toNumber(y, symbols); return [x[0] && x[1] < val, val] })[0];
      },

      '<=': function(args, symbols){
         atLeast(1, args, 'less than or equal');
         return aggregate(args, [true, toNumber(args[0], symbols)], function(x, y){ var val = toNumber(y, symbols); return [x[0] && x[1] <= val, val] })[0];
      },

      '>': function(args, symbols){
         atLeast(1, args, 'greater than');
         return aggregate(args, [true, toNumber(args[0], symbols) + 1], function(x, y){ var val = toNumber(y, symbols); return [x[0] && x[1] > val, val] })[0];
      },

      '>=': function(args, symbols){
         atLeast(1, args, 'greater than or equal');
         return aggregate(args, [true, toNumber(args[0], symbols)], function(x, y){ var val = toNumber(y, symbols); return [x[0] && x[1] >= val, val] })[0];
      },

      '=': function(args, symbols){
         atLeast(1, args, 'equal');
         return aggregate(args, [true, toNumber(args[0], symbols)], function(x, y){ var val = toNumber(y, symbols); return [x[0] && x[1] == val, val] })[0];
      },

      'eq': function(args, symbols){
         requireNArgs(args, 2, 'eq');
         //return aggregate(args, [true, lispEval(args[0], symbols)], function(x, y){ var val = lispEval(y, symbols); return [x[0] && x[1] === val, val] })[0];
         var a = lispEval(args[0], symbols);
         var b = lispEval(args[1], symbols);
         // empty list/null special case comparison
         if(isEmpty(a) && isEmpty(b))
            return true;
         else
            return (a === b);
      },

      'and': function(args, symbols){
         var count  = args.length;
         for(var i = 0; i < count; i++){
            var result = lispEval(args[i], symbols);
            if(result == null || result == false)
               return false;
         }
         return true;
      },

      'or': function(args, symbols){
         var count  = args.length;
         for(var i = 0; i < count; i++){
            var result = lispEval(args[i], symbols);
            if(result != null && result != false)
               return true;
         }
         return false;
      },

      'car': function(args, symbols){
         requireNArgs(args, 1, 'car');
         var value = lispEval(args[0], symbols);
         if(value == null)
            return null;
         else if(typeof(value) == 'object')
            return value.length > 0 ? value[0] : null;
         else
            throw 'Argument to "car" was not a list: ' + value
      },

      'cdr': function(args, symbols){
         requireNArgs(args, 1, 'car');
         var value = lispEval(args[0], symbols);
         if(value == null)
            return null;
         else if(typeof(value) == 'object')
            return value.length > 0 ? value.slice(1) : null;
         else
            throw 'Argument to "cdr" was not a list: ' + value
      },

      'cons': function(args, symbols){
         requireNArgs(args, 2, 'car');
         var a = lispEval(args[0], symbols);
         var b = lispEval(args[1], symbols);
         if(b == null)
            return [a];
         else if(typeof(b) != 'object')
            throw 'The second argument to "cons" should be a nil or a list';
         else{
            b.unshift(a);
            return b;
         }
      },

      'list': function(args, symbols){
         var count = args.length;
         if(count > 0){
            var lst = [];
            for(var i = 0; i < count; i++)
               lst.push(lispEval(args[i], symbols));
            return lst;
         }
         return null;
      },

      'cond': function(args, symbols){
         var count = args.length;
         for(var i = 0; i < count; i++){
            var arg = args[i];
            if(typeof(arg) != 'object')
               throw 'Argument to "cond" was not a list: ' + arg
            else if(arg.length == 0)
               throw 'A nil value was specified to "cond" instead of a list'
            else{
               var check = lispEval(arg[0], symbols)
               if(check != null && check !== false){
                  if(arg.length == 1)
                     return check;
                  else
                     return lispEval(arg[arg.length - 1], symbols);
               }
            }
         }
         return false;
      },

      'if': function(args, symbols){
         atLeast(2, args, 'if');
         if(args.length != 2 && args.length != 3)
            throw "Invalid number of argument for 'if'";
         var condArgs = [[args[0], args[1]], ['t', args.length == 3 ? args[2] : null]];
         return funcs['cond'](condArgs, symbols);
      },

      'lambda': function(args, symbols){
         requireNArgs(args, 2, 'lambda');
         return createFunction(args[0], args[1], symbols);
      },

      'defun': function(args, symbols){
         if(args.length != 2 && args.length != 3)
            throw 'defun requires 2 or 3 arguments';
         if(typeof(args[0]) != 'string')
            throw 'Function name must be a string';
         else if(typeof(args[1]) != 'object')
            throw 'Function arguments must be a list';
         globalSymbols[args[0]] = createFunction(args[1], args.length == 2 ? null : args[2], symbols);
      },

      'define': function(args, symbols){
         return funcs['defun'](args, symbols);
      },

      'let': function(args, symbols){
         atLeast(2, args, 'let');
         var letSymbols = {};
         for(var sym in symbols)
            letSymbols[sym] = symbols[sym];
         var lets = args[0];
         if(typeof(lets) == 'object'){
            var letslength = lets.length;
            for(var i = 0; i < letslength; i++){
               var let = lets[i];
               if(typeof(let) == 'object' && let.length == 2 && typeof(let[0]) == 'string')
                  letSymbols[let[0]] = lispEval(let[1], symbols);
               else
                  throw 'Invalid variable binding statement for let: ' + let
            }
         }
         else{
            // ignore
         }
         var result = null;
         var count  = args.length;
         for(var i = 1; i < count; i++)
            result = lispEval(args[i], letSymbols);
         return result;
      },

      'set': function(args, symbols){
         if((args.length % 2) != 0)
            throw 'Odd number of arguments passed to setq';
         var count  = args.length;
         var values = {};
         var last   = null;
         for(var i = 0; i < count; i += 2){
            var sym = args[i];
            if(typeof(sym) != 'string' || isNumber(sym))
               throw 'Not a symbol: ' + sym;
            last = values[sym] = lispEval(args[i+1], symbols);
         }
         for(var sym in values)
            symbols[sym] = values[sym];
         return last;
      },

      'eval': function(args, symbols){
         requireNArgs(args, 1, 'eval');
         return lispEval(args[0], symbols);
      }
   };

   // some of these helpers came from Paul Graham: http://www.paulgraham.com/rootsoflisp.html
   // and some of these helpers were copied from: http://joeganley.com/code/jslisp.html
   // Portions copyright (C) 1997-2010 J. L. Ganley.  All rights reserved.
   // Portions copyright (c) 1988, 1990 Roger Rohrbach
   var helpers = [
      "(defun null (x) (eq x '()))",
      "(defun not (x) (cond (x '()) (t t)))",
      "(defun append (x y) (cond ((null x) y) (t (cons (car x) (append (cdr x) y)))))",
      "(defun pair (x y) (cond ((and (null x) (null y)) '()) ((and (not (atom x)) (not (atom y))) (cons (list (car x) (car y)) (pair (cdr x) (cdr y))))))",
      "(defun assoc (x y) (cond ((eq (caar y) x) (cadar y)) (t (assoc x (cdr y)))))",
      "(defun maplist (x f) (cond ((null x) '()) (t (cons (f x) (maplist (cdr x) f)))))",
      "(defun len (s) (cond ((null s) 0) (t (+ 1 (len (cdr s))))))",
      "(defun flatten (s) (cond ((null s) nil) ((atom (car s)) (cons (car s) (flatten (cdr s)))) (t (append (flatten (car s)) (flatten (cdr s))))))",
       "(defun equal (x y) (or (and (atom x) (atom y) (eq x y)) (and (not (atom x)) (not (atom y)) (equal (car x) (car y)) (equal (cdr x) (cdr y)))))",
       "(defun append (x y) (cond ((null x) y) (t (cons (car x) (append (cdr x) y)))))",
       "(defun member (x y) (and (not (null y)) (or (equal x (car y)) (member x (cdr y)))))",
       "(defun last (e) (cond ((atom e) nil) ((null (cdr e)) (car e)) (t (last (cdr e)))))",
       "(defun qreverse (x y) (cond ((null x) y) (t (qreverse (cdr x) (cons (car x) y)))))",
       "(defun reverse (x) (qreverse x nil))",
       "(defun remove (e l) (cond ((null l) nil) ((equal e (car l)) (remove e (cdr l))) (t (cons (car l) (remove e (cdr l))))))",
       "(defun mapcar (f l) (cond ((null l) nil) (t (cons (eval (list f (list 'quote (car l)))) (mapcar f (cdr l))))))",
       "(defun apply (f args) (cond ((null args) nil) (t (eval (cons f args)))))"
   ];

   function lispReset(){
      globalSymbols = {};

      try{
         var count = helpers.length;
         for(var i = 0; i < count; i++)
            parseEval(helpers[i], globalSymbols);
      }
      catch(e){
         alert('Error defining internal functions: ' + e);
      }
   }

   function lispEval(lst, symbols){
      trace(lst, symbols);
      if(lst != null){
         if(typeof(lst) == 'object'){
            if(lst.length > 0){
               var funcName = lispEval(lst[0], symbols);
               if(typeof(funcName) == 'function')
                  return funcName.call(this, lst.slice(1), symbols);
               else if(typeof(funcName) == 'string' && funcName in funcs){
                  var func = funcs[funcName];
                  if(typeof(func) == 'function')
                     return func.call(this, lst.slice(1), symbols);
                  else
                     throw 'Invalid function: ' + funcName;
               }
               else if(typeof(funcName) == 'object' && funcName.length > 0 && funcName[0] == 'lambda'){
                  var func = lispEval(funcName, symbols);
                  if(typeof(func) == 'function')
                     return func.call(this, lst.slice(1), symbols);
                  else
                     throw 'Invalid function: ' + funcName;
               }
               else if(cadr.test(funcName)){
                  var result = lst.slice(1);
                  var l      = funcName.length - 2;
                  for(var i = l; i > 0; i--)
                     result = [['quote', funcs[funcName.charAt(i) == 'd' ? 'cdr' : 'car'].call(this, result, symbols)]];
                  if(result.length > 0)
                     return lispEval(result[0], symbols);
                  else
                     return null;
               }
               else
                  throw 'Unknown function: ' + funcName;
            }
            else
               return null;
         }
         else if(typeof(lst) == 'string' && lst.length > 0 && lst.charAt(0) == '"' && lst.charAt(lst.length-1) == '"')
            return lst;
         else if(isNumber(lst))
            return lst;
         else if(lst == 'nil')
            return null;
         else if(lst == 't')
            return true;
         else if(typeof(lst) == 'boolean' && lst === false)
            return null;
         else if(lst in symbols)
            return symbols[lst];
         else if(lst in funcs || cadr.test(lst))
            return lst;
         else
            throw 'Unbound variable: ' + lst;
      }
      else
         return null;
   }

   function listToString(x){
      if(x == null)
         return 'nil';
      else if(typeof(x) == 'object'){
         var length = x.length;
         if(length == 0)
            return 'nil';
         else{
            var pieces = [];
            for(var i = 0; i < length; i++)
               pieces.push(listToString(x[i]));
            return '(' + pieces.join(' ') + ')';
         }
      }
      else if(typeof(x) == 'boolean')
         return x ? 't' : 'nil';
      else
         return x;
   }

   function parseEval(x){
      var result = null;
      var lsts   = parseLists(x);
      if(lsts != null){
         var count = lsts.length;
         for(var i = 0; i < count; i++)
            result = lispEval(lsts[i], globalSymbols);
      }
      return result;
   }

   function trace(lst, symbols){
      if(traceEl){
         var syms = [];
         for(var key in symbols){
            var symbol = symbols[key];
            if(typeof(symbol) == 'function')
               symbol = '*function*';
            else if(typeof(symbol) == 'object')
               symbol = listToString(symbol);
            syms.push(key + ': ' + symbol);
         }
         traceEl.innerHTML += listToString(lst) + ' [' + syms.join(', ') + ']<br/>&nbsp;<br/>';
         traceEl.scrollTop = display.scrollHeight; // autoscroll
      }
   }

   function setTracing(enable, traceId, display){
      if(enable){
         traceEl = document.getElementById(traceId);
         if(display)
            traceEl.style.display = '';
      }
      else{
         if(display && traceEl)
            traceEl.style.display = 'none';
         traceEl = null;
      }
   }

   // inspired by processing.init.js: http://processingjs.org
   function doRunScriptsOnPage(){
      var scripts = document.getElementsByTagName('script');
      var count   = scripts.length;
      try{
         for(var i = 0; i < count; i++){
            var script = scripts[i];
            if(script.type == 'application/lisp'){
               var span = document.createElement('SPAN');
               span.innerHTML = listToString(parseEval(script.text));
               script.parentNode.insertBefore(span, script);
            }
         }
      }
      catch(e){
         alert(e);
      }
   }

   function runScriptsOnPage(){
      if(window.addEventListener)
         window.addEventListener('load', doRunScriptsOnPage, false);
      else if(window.attachEvent)
         window.attachEvent('onload', doRunScriptsOnPage);
   }

   return {
      reset: lispReset,
      parse: parseLists,
      eval: function(x){ return lispEval(x, globalSymbols); },
      parseEval: parseEval,
      toString: listToString,
      runScriptsOnPage: runScriptsOnPage,
      setTracing: setTracing
   };
})();
