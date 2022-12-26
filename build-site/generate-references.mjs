'use strict';
if(parseInt(process.versions.node)===18) {
	console.error("warning, in Dec2022, node18 libraries don't like node-libcurl. use v16 or something.\n");
	process.exit(254);
}
// using lots of 'function' (not arrows) so code is compiled once.
// #REF

import {  Curl } from 'node-libcurl';
import { parse } from 'node-html-parser';
import decoder from 'html-entity-decoder';
import fs from 'fs';

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

function shorten(url) {
	let ss=url.lastIndexOf('#');
	if(ss >0) {
		return url.substr(0, ss);
	}
	return url;
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
	let sect=raw.split('/'), last=sect[sect.length-1];
	
	if(sect.length>4 && last && ! last.match(new RegExp('\\.htm', 'i'))) {
		return last;
	}
	if(sect.length===4 && last && !last.match(new RegExp('\\.htm', 'i'))) { // Two are used for 'https://'
		return last;
	}
	if(sect.length===4 && last==="") {
		return sect[2];
	} else if( sect.length>4 && last==="") {
		return sect[2];
	}

	console.log("Last gasp, url parsing failed. "+raw);	
	return raw;
}


function mod_npmjs(item, body) {
	let tt=item.url.substr( item.url.lastIndexOf('/')+1 );
	item.descrip="Package to install "+tt;
	item.title="Package to install "+tt;

	let hit=body.match(new RegExp('aria-labelledby="collaborators".*<a href="\/~([^"]+)', 'im') );
	if(hit && hit.length) {
		item.auth=normaliseString(hit[1]);
	} else {
		item.auth='cant extract from NPMjs';
	}
	return item;
}

function mod_medium(item, body) {
	let hit=body.match( new RegExp('<h2 class="pw-author-name[^>]*>[ \t\n]*<span[^>]*>([A-Za-z 0-9\']+)<\/span>', 'im') ); 
	if(hit && hit.length) {
		item.auth=normaliseString(hit[1]);
	} else {
		item.auth='cant extract from medium';
	}

	hit=body.match( new RegExp('<p class="pw-published-date[^>]*>[ \t\n]*<span[^>]*>([A-Za-z 0-9,]+)<\/span>', 'im') ); 
	if(hit && hit.length) {
		item.date=(new Date(hit[1])).getTime()/1000;
	} else {
		item.auth='cant extract from medium';
	}
	return item;
}

function mod_github(item, body ) {
	//	https://github.com/node-ffi-napi/node-ffi-napi
	let tt1=item.url.split('/');
	item.auth=tt1[3];	
	return item;	
}

function mod_stackoverflow(item, body) {
	item.auth='No author for Q&A sites';
	return item;	
} 

function mod_MDN(item, body) {
	item.auth='MDN contribuitors';
	return item;	
} 

function mod_GDN(item, body) {
	item.auth='Google inc';
	return item;	
}

function mod_react(item, body) {
	item.auth='Meta platforms inc';
	return item;	
}

function mod_graphQL(item, body) {
	item.auth='The GraphQL Foundation';
	return item;	
}

function mod_caniuse(item, body) {
	item.auth='Alexis Deveria @Fyrd';
	return item;	
}

function mod_wikipedia(item, body) {
	item.auth='Wikipedia contributors';
	return item;	
}

const VENDORS=[
	{'name':'npmjs', 'target':false, 'callback':mod_npmjs },
	{'name':'medium', 'target':'auth', 'callback':mod_medium },
	{'name':'github', 'target':'auth', 'callback':mod_github },
	{'name':'stackoverflow', 'target':'auth', 'callback':mod_stackoverflow },
	{'name':'wikipedia', 'target':'auth', 'callback':mod_wikipedia },
	{'name':'developer.mozilla.org', 'target':'auth', 'callback':mod_MDN },
	{'name':'reactjs.org', 'target':'auth', 'callback':mod_react },
	{'name':'graphql.org', 'target':'auth', 'callback':mod_graphQL },
	{'name':'developers.google.com', 'target':'auth', 'callback':mod_GDN },
	{'name':'caniuse.com', 'target':'auth', 'callback':mod_caniuse },

];
const VENDORS_LENGTH=VENDORS.length; 

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


const P1 = new Promise(function(good, bad) {  

function process_first_page(statusCode, data, headers) {
	if( parseInt(statusCode /100) !==2) {
		bad( new Error("Recieved "+statusCode));
	}
	
	let root=parse(data );
	let nn=root.querySelectorAll('sup a');
	let list=[];
	nn.forEach( function(val, i) {
		list.push( val.getAttribute('href') );
			} );
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
	curlbad("Error");
}

wave(URL1, process_first_page, log_and_close, "n/a", good, bad);

}).then(function(list) {
	let final=[];
	let shorts={};

function log_and_close() {
	console.log(arguments[0], arguments[1]);
	this.close();
	let item={
				'url':list[this.offset].replace("http://192.168.0.34", "https://owenberesford.me.uk"),
				'descrip':'HTTP error, '+arguments[0],
				'title':'HTTP error, '+arguments[0],
				'auth':'unknown',
				'date':0,
			};
	final[this.offset]= item;
	this.good( item);
//	this.bad(new Error("Error"));
}

function next_page(statusCode, body, headers) {
	let item={
				'url':list[this.offset].replace("http://192.168.0.34", "https://owenberesford.me.uk"),
				'descrip':'',
				'title':'',
				'auth':'',
				'date':0,
			};
console.log("DEBUG response ["+this.offset+"] "+statusCode+" output has "+final.length );
// I set curl follow-header
	if( parseInt( statusCode /100)!==2) {
		console.log("ERROR: "+URL1+"["+this.offset+"] URL was dead "+list[this.offset]+" ", headers.result);
		if(headers.result && headers.result.reason) {
			item.descrip= headers.result.reason;
		} else {
			item.descrip="Recieved code "+statusCode+" code.";
		}
		final[this.offset]= item;
		this.good( item);
		return;
	}
	if('last-modified' in headers) {
		item.date=(new Date( headers['last-modified'])).getTime()/1000;
	} else {
		let hit= body.match(new RegExp('posted.{1,5}<time datetime="([^"]*)', 'im') );
		if(hit && hit.length) {
			item.date=(new Date(hit[1])).getTime()/1000;
		}  else {
			let hit= body.match(new RegExp('last updated.*?<time datetime="([^"]*)', 'im') );
			if(hit && hit.length) {
				item.date=(new Date(hit[1])).getTime()/1000;
			} else {
				let hit= body.match(new RegExp('class="pw-published-date[^>]*><span>([^<]*)</span>', 'im') );
				if(hit && hit.length) {
					item.date=(new Date(hit[1])).getTime()/1000;
				} else {
					console.log("DEBUG: Need more date code...");
				}
			}
		}
	}

// https://gist.github.com/lancejpollard/1978404
	let hit= body.match(new RegExp('<title>([^<]+)<\\/title>', 'i') );
	if(hit && hit.length) {
		item.title=normaliseString(hit[1]);
	} else {
		hit=body.match(new RegExp('<h1[^>]*>([^<]+)</h1>', 'i') );
		if(hit && hit.length) {
			item.title=normaliseString(hit[1]);
		} else {
			hit=body.match(new RegExp('<meta[ \\t]+name=["\']og:title["\'][ \\t]+content="([^"]+)"', 'i'));
			if(hit && hit.length) {
				item.title=normaliseString(hit[1]);
			} else {
// <meta name="og:title" content="The Rock"/>
				item.title=valueOfUrl(list[this.offset]);
			}
		}
	}

	hit=body.match(new RegExp('<meta[ \\t]+name=["\']description["\'][ \\t]+content="([^"]+)"', 'i'));
	if(hit && hit.length) {
		item.descrip=normaliseString(hit[1]);
	
	} else {
		item.descrip=item.title;
	}

	hit=body.match(new RegExp('<meta[ \\t]+name=["\']author["\'][ \\t]+content="([^"]+)"', 'i') );
	if(hit && hit.length) {
		item.auth=normaliseString(hit[1]);
	} else {
		hit=body.match(new RegExp('<meta[ \\t]+name=["\']copyright["\'][ \\t]+content="([^"]+)"', 'i') );
		if(hit && hit.length) {
			item.auth=normaliseString(hit[1]);
		} else {
// <meta name="twitter:creator" content="@channelOwen">
			hit=body.match(new RegExp('<meta[ \\t]+name=["\']twitter:creator["\'][ \\t]+content="([^"]+)"', 'i') );
			if(hit && hit.length) {
				item.auth=normaliseString(hit[1]);
			} else {
				hit=body.match(new RegExp('\&copy; [0-9,]* ([^<\n])|[Ⓒ ©] [0-9,]* ([^<\n])', 'i') );
				if(hit && hit.length) {
					item.auth=normaliseString(hit[1]);
				} else {
					item.auth='unknown';
				}
			}

// https://love2dev.com/blog/html-website-copyright/
// look at cc statement in footer next
// ©	&copy;	&#169;	&#xA9;	copyright symbol
// Ⓒ	&#9400;	&#x24B8;	    C inside circle
//  <footer> <small>&copy; Copyright 2018, Example Corporation</small> </footer> 
		}
	}
	for(let i=0; i< VENDORS_LENGTH; i++) {
		if(item.url.includes(VENDORS[i].name) && ((VENDORS[i].target && item[VENDORS[i].target] ==='unknown') ||
			!item[VENDORS[i].target])) {
			item=VENDORS[i].callback(item, body);		
		}
	}

	shorts[ shorten(list[this.offset]) ]=this.offset;
	final[this.offset]= item;
	this.good( item);
}
	
	let stack=[];
	for(let j =0 ; j< list.length; j++) {
		stack.push(exec_reference_url(j, list[j], next_page, log_and_close));
	}

	Promise.all(stack).then(function(data) {
console.log("DEBUG: end event (write to disk) ");

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
|mime-type		    = application/json
}}
{{nextresource GET
|*
}}
{{plain root
`;
		template= template+ JSON.stringify( data)+ "\n}}\n";

		fs.writeFile( process.cwd()+'/'+FN, template, 'utf8', (err)=> { 
			if(err) { console.warn("Write ERROR "+ process.cwd()+'/'+FN ,err); }
		} );

	});
});

