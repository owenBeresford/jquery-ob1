/*jslint white: true, browser: true, devel: true,  nomen: true, todo: true */
/**
 *  jquery-ob1
 *
 * Copyright (c) 2017 Owen Beresford, All rights reserved.
 * I have not signed a total rights contract, my employer isn't relevant.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * jquery-ob1 ~ Code to make features on the owenberesford.me.uk site.  Probably no reuse ever.
 *
 * @author: Owen beresford owenberesford@users.noreply.github.com
 * @version: 0.1.0
 * @date: 12/10/2017
 * @licence: AGPL <http://www.gnu.org/licenses/agpl-3.0.html>
 *
 * deps:
 *  jQuery must already be loaded
 *  uses jquery-readDuration when installed
 *  uses jquery-columniser when installed
 *  uses jquery-resize when installed
 *  uses jquery-biblio when installed
 *
 These are the options that are currently supported:
 ** debug ~ whether to write to console.log, or not.
 ** resize_registered ~ 0 INTERNAL flag
 ** menuTop, DEFAULT 170 ~ INTERNAL, will be removed soon
 ** tabs ~ DEFAULT [] ~ INTERNAL used for the tabs
 ** prevCols, DEFAULT 0 ~ INTERNAL, used to detect change on numbers of columns
 */
(function ($) {
    "use strict";

    $.ob1Impl = function (el, options) {
        /**
         * CorrectionModule
         * Constructor ~ initialise state

         * @param el
         * @param options
         * @access public
         * @return self
         */
        function CorrectionModule(el, options) {
            this.options = $.extend({}, $.ob1Impl.defaultOptions, options);

            $('.noJS').removeClass('noJS');
            if (typeof opera === 'object') {
                $('html').attr('style', 'font-size:90%');
            }
            if (this.extractGET('dbg')) {
                this.options.debug = 1;
            }
            if ($.fn.readingDuration && location.pathname != '/resource/home') {
                $('.h4_page').readingDuration({
                    dataLocation: "#main",
                    target: ".addReading",
                    debug: this.options.debug,
                    linkTo: '//owenberesford.me.uk/resource/jQuery-reading-duration'
                });
            }

            if ($(window).width() < 600) {
                this.closed_size = 20;
                $('.after_menu').css('margin-top', this.options.menuTop + 'px');
            }


            if (this.options.debug) {
                console.log("correction() Created module.");
            }
            return this;
        }

        /**
         * extractGET
         * Utility function, extract values from location object

         * @param string    val
         * @access public
         * @return string || null if not found
         */
        CorrectionModule.prototype.extractGET = function (val) {
            let result = null,
                tmp = [],
                t = location.search.replace("?", "").split("&");

            for (let i in t) {
                tmp = t[i].split("=");
                if (tmp[0] === val) {
                    result = decodeURIComponent(tmp[1]);
                }
            }
            return result;
        };

        /**
         * biblioExtract
         * Initialise the biblio listings if relevant
         *
         * @access public
         * @return void
         */
        CorrectionModule.prototype.biblioExtract = function () {
            // as I am polling this without making an object, I need to access the "prototype" fn
            if (typeof jQuery.fn.biblio !== 'function') {
                console.log("jQuery + plugins isn't loaded (check order of injection).");
                return this;
            }
            if (typeof biblio_loader == 'function') {
                biblio_loader();
				return this;

            } else {
				if(parseInt($('body').width()) > this.options.mobileWidth) {
					return this;
				}
                let id = '.lotsOfWords';
                if ($(id + " sup a").length === 0) {
                    id = '.halferWords';
                }
                if ($(id + " sup a").length > 3) {
                    if (this.options.debug) {
                        console.log("Have quite a few references, will extract for mobile.");
                    }

                    let url = window.location.href;
                    if (url.indexOf('?') > 0) {
                        url = url.substring(0, url.indexOf('?'));
                    }
                    if (url.indexOf('#') > 0) {
                        url = url.substring(0, url.indexOf('#'));
                    }
                    url += "-references";
					let self=this;

                    $.ajax({
                        type: 'HEAD',
                        async: false,
                        url: url,
                        timeout: 1000,
                        success: function (data, textStatus, jqXHR) {
                            if (self.options.debug) {
                                console.log("Have references cache, applying it.");
                            }
                            $('document').biblio({
                                tocEdit: 1,
                                width: 500,
                                debug: self.options.debug,
                                loosingElement: id,
                                extendViaDownload: 4,
                                referencesCache: url
                            });
                        },
                        error: function (jqXHR, textStatus, errorThrown) {
                            if (self.options.debug) {
                                console.log("Doing a manual download.");
                            }
                            $('document').biblio({
                                tocEdit: 1,
                                debug: self.options.debug,
                                loosingElement: id,
                                extendViaDownload: 2
                            });
                        }
                    });

                }
            }
			return this;
        };

        /**
         * columnise
         * Wrapper function to configure the jquery-columnise

         * http://stackoverflow.com/questions/14328795/redefine-number-of-columns-depending-on-min-screen-resolutions-with-columnizer
         * http://welcome.totheinter.net/columnizer-jquery-plugin/
         * @access public
         * @return void
         */
        CorrectionModule.prototype.columnise = function () {
            let $t1 = window.currentSize();
            let $tt = $('.lotsOfWords');
// only apply when asked to, and have enough content
            if ($tt.length === 0 || $tt.text().length < 500) {
                return this;
            }
            if (!$tt.columnize) {
                return this;
            }

// hopefully phones changing orientation won't break things...
// can double buffer to reduce flicker, if so append target:"#showhere" 
            let colno = 1;
   	    if ($t1[0] > 2000) {
	        colno = 5;
	    } else if ($t1[0] > 1600) {
                colno = 4;
            } else if ($t1[0] > 1200) {
                colno = 3;
            } else if ($t1[0] > 650) {
                colno = 2;
            }
            if (this.options.debug) {
                console.log("Text split into " + colno + " columns.");
            }

            if (!this.options.prevCols || this.options.prevCols != colno) {
                if ($('.first').length) {
                    $('.column > *').unwrap();
                }
                if (colno > 1) {
// suppress columnising for a single column, or the <HR> come up wonky
                    $tt.columnize({columns: colno, buildOnce: true});
                    $tt.renumberByJS('ol', colno, null, 'column');
                }
                if (jQuery.fn.wresize) {
		    let myself=this;
                    let $t = $('.h4_page').wresize({debug: myself.options.debug});
                    $t.wait(function() {
                    myself.columnise();
                });
                }
                this.options.prevCols = colno;
            }
	    return this;
        };
	    
        /**
         * burgerMenu
         * display/ hide this

         * @param id ~ the id of the menu element to open
         * @access public
         * @return void
         */
        CorrectionModule.prototype.burgerMenu = function (id) {
			// add pullin code
			let t=$(id);
			if( !t.attr('data-state') ) {
				t.addClass('burgerMenuOpen').attr('data-state', 1);
				$('#pageMenu i').removeClass('fa-bars').addClass('fa-remove')
			} else {
				t.removeClass('burgerMenuOpen').attr('data-state', null);
				$('#pageMenu i').removeClass('fa-remove').addClass('fa-bars')
			}
		}

        /**
         * alignHeader
         * Function to call on page load, to reflow the content (actual content is first in file)
         * this function is necessary as technically the header is the last thing in the document, so search engines get page content, rather than a similar header all the time.

         * @access public
         * @return void
         */
        CorrectionModule.prototype.alignHeader = function () {
            let t1 = $('.outer_menu').css('height');
            let t2 = $('.outer_menu').css('margin-bottom');
            let t3 = $('.outer_menu').css('margin');
            t1 = parseInt(t1, 10);
            t2 = t2 ? parseInt(t2, 10) : parseInt(t3, 10);
// 	var $offset	= 30 + t1 + t2; // // with the current build, the larger figure  seems too large
            let offset = t1 + t2;
            let t4 = $('.after_menu').offset().top;
            if (this.options.debug) {
                console.log("Combined height of menu is " + offset + " the top of the content is " + t4);
            }
            if (typeof opera != 'undefined') {
                offset = offset + 2;
            }

            if (parseInt(t4, 10) < offset) {
                $('.after_menu').css('margin-top', offset + 'px');
            }
            $('fieldset.h4_menu ul').height($('fieldset.h4_menu').height() - 5);


            if (!this.options.resize_registered) {
				let myself=this;
                $(window).resize(function () {
                    myself.alignHeader();
                });
                this.options.resize_registered = 1;
            }
			return this;
        };

        /**
         * tabInit
         * Initalise the tabs

         * @param where
         * @access public
         * @return void
         */
        CorrectionModule.prototype.tabInit = function (where) {
            if (this.options.debug) {
                console.log("Initialising the tabs..");
            }
            if (typeof where == 'string') {
                this.options.tabs.holder = where;
            } else {
                this.options.tabs.holder = 'tabList';
            }
            let $row = $('.' + this.options.tabs.holder + ' li');

            this.options.tabs.sections = [];
            this.options.tabs.sum = [];
			let myself=this;

            let globalCounter = 0;
            $row.each(function ($index, $item) {
                let id = $($item).attr('id');
                id = id.replace(/^click/, '');

                myself.options.tabs.sections[globalCounter] = 'block' + id;
                myself.options.tabs.sum[globalCounter] = 'summary' + id;
                globalCounter++;
                $('#summary' + id).attr('style', 'display:none;');
                $('#block' + id).attr('style', 'display:none');
                $($item).click(this.tabChange);
            });
			return this;
        };

        /**
         * tabChange
         * as name says...

         * @param Event $e
         * @access public
         * @return void
         */
        CorrectionModule.prototype.tabChange = function ($e) {
            for (let i = 0; i < this.options.tabs.sections.length; i++) {
                $('#' + this.options.tabs.sections[i]).attr('style', 'display:none');
            }
            for (let i = 0; i < this.options.tabs.sum.length; i++) {
                $('#' + this.options.tabs.sum[i]).attr('style', 'display:none');
                $('#' + this.options.tabs.sum[i]).attr('class', '');
            }
            $('.' + this.options.tabs.holder + ' li').each(
                function (index, item) {
                    $(item).attr('class', '');
                });

            let tt = '';
            if (typeof $e == 'object') {
                tt = $e.currentTarget.id;
                tt = tt.substring(5);
            } else if (typeof $e == 'string') {
                tt = $e;
            }
            if (this.options.debug) {
                console.log("Tab change " + tt);
            }

            $('#click' + tt).attr('class', $('#click' + tt).attr('class') + ' tabActive');
            $('#summary' + tt).attr('class', 'summaryActive');
            $('#summary' + tt).attr('style', '');
            $('#block' + tt).attr('style', 'display:inline');
			return this;
        };


        return new CorrectionModule(el, options);
    };

    // pls see doc header
    $.ob1Impl.defaultOptions = {
        debug: 0,
        resize_registered: 0,
        menuTop: 170,
        tabs: {},
        mobileWidth: 700,
        prevCols: 0,
    };

    $.fn.ob1 = function (options) {
        try {
            return $.ob1Impl(this, options);
        } catch ($e) {
            console.log($e);
            console.log($e.stack);
        }
    };

    /**
     * currentSize
     * Utility function to report the tab size...
     // I use this in debugging RWD

     * @access public
     * @return void
     */
    window.currentSize = function () {
        let d = document, root = d.documentElement, body = d.body;
        let wid = window.innerWidth || root.clientWidth || body.clientWidth;
        let hi = window.innerHeight || root.clientHeight || body.clientHeight;
        wid = parseInt(wid, 10);
        hi = parseInt(hi, 10);
        return [wid, hi];
    };

    /**
     * Functional extension to allow mal-compliant webbrowsers access to this website.
     * Add standard function isISOString into the data object where it is absent.
     *
     * @src: https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toISOString
     * @author: owen  added this to the code base, but I didn't write it
     * @date: 20/09/2012
     * @version: 0.0.2
     * @param: NONE
     * @return: string of the current date object
     *
     */
    if (!Date.prototype.toISOString) {
        ( function () {
            function pad(number) {
                let r = String(number);
                if (r.length === 1) {
                    r = '0' + r;
                }
                return r;
            }

            Date.prototype.toISOString = function () {
                return this.getUTCFullYear()
                    + '-' + pad(this.getUTCMonth() + 1)
                    + '-' + pad(this.getUTCDate())
                    + 'T' + pad(this.getUTCHours())
                    + ':' + pad(this.getUTCMinutes())
                    + ':' + pad(this.getUTCSeconds())
                    + '.' + String((this.getUTCMilliseconds() / 1000).toFixed(3)).slice(2, 5)
                    + 'Z';
            };
        }() );
    }

    /**
     * importDate
     * functional equiv to strtotime()
     // format code:
     //  y, m, d, h, i, s as PHP date codes, but all lower case

     * @param format
     * @param day
     * @param time
     * @access public
     * @author Owen Beresford
     * @return a Date
     */
    Date.prototype.importDate = function (format, day, time) {
        let day1, time1, fpos, bpos;
        let year1, month1, _day1, hour1, min1, sec1;

        let tt = day.split('T');
        let found = false;

        if (tt.length == 2) {
            day1 = tt[0];
            time1 = tt[1];
            found = true;
        }

        tt = day.split(' ');
        if (!found && tt.length == 2) {
            day1 = tt[0];
            time1 = tt[1];
            found = true;
        }

        if (!found && time) {
            day1 = day;
            time1 = time;
            found = true;
        } else {
            day1 = day;
            time1 = '00:00:00';
        }

        if (day1.indexOf('-')) {
            day1 = day1.split('-');
        } else {
            day1 = day1.split('/');
        }
        time1 = time1.split(':');
        day1 = day1 + time1; // check this line...

        fpos = 0;
        bpos = 0;
        while (fpos < format.length) {
            switch (format.charAt(fpos)) {
                case 'y': {
                    year1 = parseInt(day1[bpos], 10);
                    break;
                }
                case 'm': {
                    month1 = parseInt(day1[bpos], 10);
                    month1--;
                    break;
                }
                case 'd': {
                    _day1 = parseInt(day1[bpos], 10);
                    break;
                }
                case 'h': {
                    hour1 = parseInt(day1[bpos], 10);
                    hour1--;
                    break;
                }
                case 'i': {
                    min1 = parseInt(day1[bpos], 10);
                    break;
                }
                case 's': {
                    sec1 = parseInt(day1[bpos], 10);
                    break;
                }
            }
            fpos++;
            bpos++;
        }

        return new Date(year1, month1, _day1, hour1, min1, sec1, 0);
    };


}(jQuery));
