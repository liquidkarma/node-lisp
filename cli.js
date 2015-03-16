#!/usr/bin/env node
var program = require('commander'),
    readline = require('readline'),
    fs = require('fs'),
    lisp = require('./lisp'),
    node_lisp = require('./node_lisp'),
    tests = require('./lisp_tests');

program
   .version('0.0.1')
   .option('-f, --file <file>', 'File to run')
   .option('-t, --test', 'Run tests')
   .parse(process.argv);

lisp.Lisp.reset();
if(program.file){
   console.log('Running "' + program.file + '"');
   fs.readFile(program.file, function(err, data){
      if(err)
         throw err;
      //console.log(data.toString());
      node_lisp.report(data.toString(), false);
   });
}
else if(program.test){
   console.log('Running test cases');
   tests.validate();
}
else{
   // repl
   var rl = readline.createInterface(process.stdin, process.stdout);
   rl.setPrompt('> ');
   rl.prompt();
   rl.on('line', function(line){
      try{
         node_lisp.report(line, false);
      }
      catch(err){
         console.log(err);
      }
      rl.prompt();
   })
   .on('close', function(){
      console.log('');
      process.exit(0);
   });
}
