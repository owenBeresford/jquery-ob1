'use strict';
import fetch, { Headers, Request, Response } from 'node-fetch';
import decoder from 'html-entity-decoder';
import fs from 'fs';

const BASEURL="http://192.168.0.34/resource/";
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

let list=[];
try {
	let resp = await fetch( URL2 );
	let json0 = await resp.text();
	let json1 = JSON.parse(json0 );

	json1.forEach( function(val, i) {
		list.push( BASEURL+val );
			} );
	if( list.length <3 ) {	
		console.warn("Didn't find many/ any URLs in page/ Is this not on my site, or is it not an article?", );
		process.exit(1);
	}
} catch(e) {
	console.warn("Network error", e);	
}

let final=[];
for(let i =0; i<list.length; i++) {
	let resp; let body;
	let item={
				'url':list[i].replace(/http:\/\/192\.168\.0\.34/, "https://owenberesford.me.uk"),
				'descrip':'',
				'title':'',
				'auth':'',
				'date':0,
			};

	try {
		resp = await fetch( list[i] );
		if(! resp.ok) {
			console.warn("["+i+"] URL was dead", resp.statusText);
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
		console.warn("["+i+"] URL was dead", resp.statusText);
	}
	let hit=body.match(new RegExp('<meta[ \\t]+name=["\']description["\'][ \\t]+content="([^"]+)"', 'i'));
	if(hit && hit.length) {
		item.descrip= hit[1].trim();
		item.descrip=decoder.feed( item.descrip);
		item.descrip=item.descrip.replace('"', '').replace('&quot;', '').replace('\'', '');

	} else {
		item.descrip=list[i];
	}

	if(item.date===0 || isNaN( item.date) ) {
		hit= body.match(new RegExp('Last modified <time datetime="([^"]+)"', 'i') );
		if(hit && hit.length) {
			item.date=(new Date(hit[1])).getTime()/1000;
		}
	}

	hit= body.match(new RegExp('<title>([^<]+)<\\/title>', 'i') );
	if(hit && hit.length) {
		item.title= hit[1].trim();
		item.title=decoder.feed( item.title );
		item.title=item.title.replace('"', '').replace('&quot;', '').replace('\'', '');
	} else {
		item.title=list[i];
	}

	hit=body.match(new RegExp('<meta[ \\t]+name=["\']author["\'][ \\t]+content="([^"]+)"', 'i') );
	if(hit && hit.length) {
		item.auth= hit[1].trim();
		item.auth=decoder.feed( item.auth );
		item.auth=item.auth.replace('"', '').replace('&quot;', '').replace('\'', '');
	} else {
		item.auth='unknown';
	}

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
| mime-type		    = application/json
}}
{{nextresource GET
|*
}}
{{plain root
`;
template= template+ JSON.stringify( final)+ "\n}}\n";

fs.writeFile( process.cwd()+'/'+FN, template, 'utf8', (err)=> { 
	if(err) { console.warn("ERROR writing "+process.cwd()+'/'+FN,  err); }
	} );

