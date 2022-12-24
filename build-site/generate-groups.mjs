'use strict';
import { curly, Curl } from 'node-libcurl';
// import fetch, { Headers, Request, Response } from 'node-fetch';
import decoder from 'html-entity-decoder';
import fs from 'fs';

const BASEURL="http://192.168.0.34/resource/";
const MAX_WAIT=5000;
function process_args(args) {
	if( args.length <4 || args[2]!=='--url') {	
		console.warn("Pass URL as --url <blah> --out <blah>", args);
		process.exit(1);
	}
	if( args.length < 6 || args[4]!== '--out' ) {
		console.warn("Pass URL as --url <blah> --out <blah>", args);
		process.exit(1);	
	}

	let URL1=''; let URL2=''; let FN='';
	try {
		URL1= args[3];
		FN  = args[5];
		URL2=new URL( URL1);

	} catch(e) {
		console.warn("Pass valid URL as --url <blah>", args, e);
		process.exit(1);	
	} 
	return [URL2, FN, URL1 ];
}

const [URL2, FN, URL1]=process_args(process.argv);

function wave(url, good1, bad1, offset, curlgood, curlbad) {
	try {
		console.log("DEBUG: ["+offset+"] "+url);
		const curl = new Curl();
		curl.setOpt('URL', url);
		curl.setOpt('FOLLOWLOCATION', true);
		curl.setOpt('HTTPHEADER', [ 'upgrade-insecure-requests: 1', 'cache-control: no-cache', ]);
		if(url.match('caniuse.com')) {
			console.log("DEBUG: override for caniuse.com");
			curl.setOpt('USERAGENT', 'Mozilla/5.0 (compatible; Linux) Curl/1.0');
//		-e https://caniuse.com/index.php -A 'Mozilla/5.0 (compatible; Linux) Curl/1.0' -m 2 	
		}
		if(typeof offset=== 'number') {
			curl.offset=offset;
		}
		curl.good=curlgood;
		curl.bad=curlbad;

		curl.on('end', good1.bind(curl));
		curl.on('error', bad1.bind(curl));
		curl.perform();

	} catch(e) {
		console.warn("["+offset+"] Network error with "+url +" :: "+ e);	
		curlbad(e);
	}
}

function exec_reference_url(offset, url, next_page, log_and_close) {
  return new Promise(function (good, bad) {
	wave( url, next_page, log_and_close, offset, good, bad);
  });
}

function normaliseString(raw) {
	if(!raw) { return ""; }

	raw= raw.trim();
	raw=decoder.feed( raw);
	raw=raw.replace('"', '').replace('&quot;', '').replace('\'', '');
	if(raw.length>500) {
		raw=raw.substr(0, 500);
	}
	return raw;
}

function valueOfUrl(raw) {
	console.error("Write code to make an URL more readable 61");
	return raw;
}



const P1 = new Promise(function(good, bad) {  

function process_first_page(statusCode, data, headers) {
	if( parseInt(statusCode /100) !==2) {
		return bad( new Error("Recieved "+statusCode));
	}
	if(typeof data === 'string') {
		data=JSON.parse(data);
	}
	let list=[];
	for(let i=0; i<data.length; i++) {
		list.push( BASEURL+ data[i] );
	}

  	this.close();
	if( list.length <5 ) {	
		console.warn("Didn't find many/ any URLs in page/ Is this not on my site, or is it not an article?", );
		process.exit(0);
	}
	good(list);
}

function log_and_close() {
	console.log(arguments[0], arguments[1]);
	this.close();
	bad("Error");
}

wave(URL1, process_first_page, log_and_close, "n/a", good, bad);

}).then(function(list) {
	let final=[], stack=[];

	function process_next_page(statusCode, body, headers) {
		let item={
				'url':list[this.offset].replace(/http:\/\/192\.168\.0\.34/, "https://owenberesford.me.uk"),
				'descrip':'',
				'title':'',
				'auth':'',
				'date':0,
			};
		this.close();
// console.log("sdfsdfsdf ", statusCode, body, headers, new Date());
		if( parseInt(statusCode/100)!==2 ) {
			console.warn("["+this.offset+"] URL was dead "+ headers.result.reason );
			item.descrip=headers.result.reason;
			final.push( item);
			this.good(final);
			return;
		}
		if( 'last-modified' in headers && headers['last-modified']) {
			item.date=(new Date( headers['last-modified'])).getTime()/1000;
		}

		let hit=body.match(new RegExp('<meta[ \\t]+name=["\']description["\'][ \\t]+content="([^"]+)"', 'i'));
		if(hit && hit.length) {
			item.descrip= normaliseString( hit[1]);
		} else {
			item.descrip=valueOfUrl(list[this.offset]);
		}

		if(item.date===0 || isNaN( item.date) ) {
			hit= body.match(new RegExp('Last modified <time datetime="([^"]+)"', 'i') );
			if(hit && hit.length) {
				item.date=(new Date(hit[1])).getTime()/1000;
			}
		}

		hit= body.match(new RegExp('<title>([^<]+)<\\/title>', 'i') );
		if(hit && hit.length) {
			item.title= normaliseString(hit[1]);
		} else {
			item.title=valueOfUrl( list[this.offset]);
		}

		hit=body.match(new RegExp('<meta[ \\t]+name=["\']author["\'][ \\t]+content="([^"]+)"', 'i') );
		if(hit && hit.length) {
			item.auth= normaliseString(hit[1]);
		} else {
			item.auth='unknown';
		}

		final.push( item);
		this.good(final);
	}
	
	function log_and_close() {
		console.log(arguments[0], arguments[1]);
		this.close();
		this.bad("Error");
	}


	for(let i =0; i<list.length; i++) {
		stack.push( exec_reference_url(i, list[i], process_next_page, log_and_close) );
	}
	Promise.all(stack).then(function(data) {
		let template=`
{{pagemeta
|Name                = Should NOT be visible ~ JSON output.
|Title               = Should NOT be visible ~ JSON output.
|Author              = Owen Beresford
|DocVersion          = 2.0
|AccessGroup         = 5
|Method              = GET
|CodeVersion         = 2.0.0
|Keywords            = XXX
|description		= Template file for generating JSON responses.
| mime-type		    = application/json
}}
{{nextresource GET
|*
}}
{{plain root
`;
		template= template+ JSON.stringify( data)+ "\n}}\n";

		fs.writeFile( process.cwd()+'/'+FN, template, 'utf8', (err)=> { 
			if(err) { console.warn("ERROR writing "+process.cwd()+'/'+FN,  err); }
		} );

	});

});

