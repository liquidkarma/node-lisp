var lisp = require('./lisp');

exports.report = function report(input, showInput){
   var result = lisp.Lisp.toString(lisp.Lisp.parseEval(input));
   if(showInput)
      console.log('> ' + input.replace('\n', '') + '\n>> ' + result + '\n');
   else
      console.log(result);
   return result;
}
