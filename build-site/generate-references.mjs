'use strict';
// this script has very low reuse potential; I have just put it in a repo as backup
import fetch, { Headers, Request, Response, AbortError } from 'node-fetch';
import { parse } from 'node-html-parser';
import decoder from 'html-entity-decoder';
import fs from 'fs';
import AbortController from "abort-controller";

const MAX_WAIT=3000;
if( process.argv.length <4 || process.argv[2]!=='--url') {	
	console.warn("Pass URL as --url <blah> --out <blah>", process.argv);
	process.exit(1);
}
if( process.argv.length < 6 || process.argv[4]!== '--out' ) {
	console.warn("Pass URL as --url <blah> --out <blah>", process.argv);
	process.exit(1);	
}

let URL1=''; let URL2=''; let FN='';
try {
	URL1= process.argv[3];
	FN  = process.argv[5];
	URL2=new URL( URL1);
} catch(e) {
	console.warn("Pass valid URL as --url <blah>", process.argv, e);
	process.exit(1);	
} 

let resp; let root; let timeout;
try {
	const controller = new AbortController();
	timeout = setTimeout(() => {
		controller.abort();
	}, MAX_WAIT);
	let p1=new Date();

	resp = await fetch( URL2, {signal: controller.signal} );
	let html = await resp.text();
	root=parse(html );
	let p2=new Date();

} catch(e) {
	if (e instanceof AbortError) {
		let p3=p1.getTime()-p2.getTime();
		console.warn("network failure ", e, p3);	
	} else {
		console.warn("Error parsing ", e);	
	}
	process.exit(1);
} finally {
	clearTimeout(timeout);
}
function shorten(url) {
	let ss=url.lastIndexOf('#');
	if(ss >0) {
		return url.substr(0, ss);
	}
	return url;
}

function normaliseString(raw) {
	raw= raw.trim();
	raw=decoder.feed( raw);
	raw=raw.replace('"', '').replace('&quot;', '').replace('\'', '');
	if(raw.length>500) {
		raw=raw.substr(0, 500);
	}
	return raw;
}


let nn=root.querySelectorAll('sup a');
let list=[];
nn.forEach( function(val, i) {
	list.push( val.getAttribute('href') );
		} );
if( list.length <3 ) {	
	console.warn("Didn't find many/ any URLs in page/ Is this not on my site, or is it not an article?", );
	process.exit(1);
}

let final=[];
let shorts={ };
for(let i =0; i<list.length; i++) {
	console.log("DEBUG: "+ list[i]);
	let resp; let body;
	let item={
				'url':list[i].replace("http://192.168.0.34", "https://owenberesford.me.uk"),
				'descrip':'',
				'title':'',
				'auth':'',
				'date':0,
			};

	try {
		let d1=new Date();
		if( shorts[ shorten(list[i]) ]) {
			let ttt=Object.assign({}, final[ shorts[ shorten(list[i]) ] ] );
			ttt.url=item.url;
			final.push( ttt);
			continue;
		}

		const controller = new AbortController();
		timeout = setTimeout(() => {
			let d2=new Date();
			console.log("ABORTED pause of "+(d2.getTime()-d1.getTime())+" "+MAX_WAIT );
			controller.abort();
		}, MAX_WAIT);

		resp = await fetch( list[i], {signal: controller.signal} );

		if( resp.status===301 ||resp.status===302 ) {
			console.log("ERROR: "+URL1+"["+i+"] REDIRECT "+list[i]+" :: "+ resp.headers.location);
			resp= await fetch( resp.headers.location, {signal: controller.signal} );
		}
		if(!resp || !resp.ok) {
			console.log("ERROR: "+URL1+"["+i+"] URL was dead "+list[i]+" "+ resp.statusText);
			item.descrip=resp.statusText;
			final.push( item);
			continue;
		}
		let head = await resp.headers;
		for( let j2 of head.entries() ) {
			switch(j2[0]) {
			case 'last-modified':
				item.date=(new Date( j2[1])).getTime()/1000;
				break;

			default:
			//	console.log("Unhandled header", ...j2 );
			}
		}
		body = await resp.text();	

	} catch(e) {
		console.log("ERROR: "+URL1+"["+i+"] "+item.url+" :: client side failure "+ e);
		item.descrip=e.toString();
		final.push( item);
		continue;
	} finally {
		clearTimeout(timeout);
	}

	let hit= body.match(new RegExp('<title>([^<]+)<\\/title>', 'i') );
	if(hit && hit.length) {
		item.title=normaliseString(hit[1]);
	} else {
		hit=body.match(new RegExp('<h1[^>]*>([^<]+)</h1>', 'i') );
		if(hit && hit.length) {
			item.title=normaliseString(hit[1]);
		} else {
			item.title=list[i];
		}
	}

	hit= body.match(new RegExp('<meta[ \\t]+name=["\']description["\'][ \\t]+content="([^"]+)"', 'i'));
	if(hit && hit.length) {
		item.descrip=normaliseString(hit[1]);
	} else {
		item.descrip=item.title;
	}

	hit=body.match(new RegExp('<meta[ \\t]+name=["\']author["\'][ \\t]+content="([^"]+)"', 'i') );
	if(hit && hit.length) {
		item.auth=normaliseString(hit[1]);
	} else {
		item.auth='unknown';
	}
	if(item.url.includes("npmjs")) {
		let tt=item.url.substr( item.url.lastIndexOf('/')+1 );
		item.descrip="Package to install "+tt;
		item.title="Package to install "+tt;
	
		hit=body.match(new RegExp('aria-labelledby="collaborators".*<a href="\/~([^"]+)', 'im') );
		if(hit && hit.length) {
			item.auth=normaliseString(hit[1]);
		} else {
			item.auth='cant extract from NPMjs';
		}
	}

	// if cloudflare headers; do magic thing... yet to define magic precisely

	// this is before the add on purpose
	shorts[ shorten(list[i]) ]=final.length;
	final.push( item);
}

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
template= template+ JSON.stringify( final)+ "\n}}\n";

fs.writeFile( process.cwd()+'/'+FN, template, 'utf8', (err)=> { 
	if(err) { console.warn("Write ERROR "+ process.cwd()+'/'+FN ,err); }
} );


