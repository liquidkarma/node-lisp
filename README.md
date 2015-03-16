A port of the lisp interpreter I did on [synapticfailure](http://synapticfailure.com/ai/lisp_js/) to run with node.js.

## Requirements
commander for cli: npm install commander

## Running

REPL:
```
node cli.js
```

Run test cases:
```
node cli.js -t
```

Run commands from file:
```
node cli.js -f /path/to/file
```

Example:
```
node cli.js -f examples/hello.lisp
```
