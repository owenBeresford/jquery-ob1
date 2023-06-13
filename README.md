UPDATE 2022: code frozen

# jquery-ob1
Plugin for some of my site features. **Very little reusability**  I normally name very specific company behaviour code after the company that owns it, so in this case it needs to be named after me... >.<  This scales better than calling 50% of files 'app.js'

This code drives features in owenberesford.me.uk This little project tidies up the namespace abit, and drops hacks required from 2010.
I need to put some glue code and build scripting somewhere, it will probably be dumped into this project as well.

Cloudflare and build-scripts:
* I am building a basic set of meta-data for links on this site, so people can see where they are going to.  I have many outbound links.  I am a good net-citizen I run this once a month (ish); but the cached data improves experience for *every* visitor.
* Secondly this gives me a whole site report on deadlinks
* in 2022, I attempted a purge/ revision to update all outbound HTTP links to HTTPS versions; this filtered out many dead sites. 
* Cloudflare blocks bots/ script/ crawlers because....
* I have no workround from Node, as I not not have access to the full headers, or able to pretend that I am `expect` .
* I have created a Python version, which allows control of the headers, but Cloudflare is still blocking
* I linked a cloudflare breaker module, to the Python version, no results either
* 
