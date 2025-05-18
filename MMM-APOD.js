/* MagicMirror²
 * Module: MMM-APOD
 *
 * MagicMirror² By Michael Teeuw https://magicmirror.builders
 * MIT Licensed.
 *
 * Module MMM-APOD By Grena https://github.com/grenagit
 * MIT Licensed.
 */

Module.register("MMM-APOD",{

	// Default module config
	defaults: {
		appid: "",
		updateInterval: 6 * 60 * 60 * 1000, // every 6 hours
		animationSpeed: 1000, // 1 second
		maxMediaWidth: 0,
		maxMediaHeight: 0,
		maxDescriptionLength: 200,
		backgroundSize: "cover",
		backgroundPosition: "center",
		backgroundOverlay: "linear-gradient(to bottom, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0) 80%, rgba(0, 0, 0, 0.75) 100%)",
		showTitle: true,
		showDescription: false,
		useShortDescription: true,

		initialLoadDelay: 0, // 0 seconds delay
		retryDelay: 2500, // 2,5 seconds

		apiBase: "https://api.nasa.gov/",
		apodEndpoint: "planetary/apod",
	},

	// Define required scripts
	getStyles: function() {
		return ["MMM-APOD.css"];
	},

	// Define start sequence
	start: function() {
		Log.info("Starting module: " + this.name);

		this.title = null;
		this.description = null;
		this.copyright = null;
		this.type = null;
		this.url = null;

		if(this.data.position === 'fullscreen_below') {
			this.backgrounded = true;
			this.data.header = null;
		} else {
			this.backgrounded = false;
		}

		this.loaded = false;
		this.scheduleUpdate(this.config.initialLoadDelay);
	},

	// Override dom generator
	getDom: function() {
		var wrapper = document.createElement("div");

		if(this.config.appid === "") {
			wrapper.innerHTML = "Please set the correct NASA <i>appid</i> in the config for module: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if(!this.loaded) {
			wrapper.innerHTML = this.translate("LOADING");
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if(this.backgrounded) {
			var apodBackground = document.createElement('div');

			apodBackground.className = "background";

			apodBackground.style.backgroundSize = this.config.backgroundSize;
			apodBackground.style.backgroundPosition = this.config.backgroundPosition;
			apodBackground.style.backgroundImage = 'url("' + this.url + '")';

			wrapper.appendChild(apodBackground);
			
			if(this.config.backgroundOverlay != "") {
				var apodBackgroundOverlay = document.createElement('div');

				apodBackgroundOverlay.className = "overlay";

				apodBackgroundOverlay.style.background = this.config.backgroundOverlay;

				wrapper.appendChild(apodBackgroundOverlay);
			}
		} else {
			if(this.config.showTitle) {
				var apodTitle = document.createElement('div');

				apodTitle.className = "dimmed light small";
				apodTitle.innerHTML = this.title;
 
				wrapper.appendChild(apodTitle);
			}

			var apodImage = document.createElement('img');

			if(this.config.maxMediaWidth != 0) {
				apodImage.style.maxWidth = this.config.maxMediaWidth + 'px';
			}
			if(this.config.maxMediaHeight != 0) {
				apodImage.style.maxHeight = this.config.maxMediaHeight + 'px';
			}

			apodImage.src = this.url;
			apodImage.alt = this.title;

			wrapper.appendChild(apodImage);

			if(this.copyright != "" && typeof this.copyright !== "undefined") {
				var apodCopyright = document.createElement('div');

				apodCopyright.className = "dimmed thin xsmall";
				apodCopyright.innerHTML = "&copy; " + this.copyright;

				wrapper.appendChild(apodCopyright);
			}

			if(this.config.showDescription) {
				var apodDescription = document.createElement('div');

				apodDescription.className = "dimmed light xsmall description";

				if(this.config.maxMediaWidth != 0) {
					apodDescription.style.maxWidth = this.config.maxMediaWidth + 'px';
				} else if(this.type === "video") {
					apodDescription.style.maxWidth = '960px';
				}

				if(this.config.useShortDescription) {
					apodDescription.innerHTML = this.shortText(this.description, this.config.maxDescriptionLength);
				} else {
					apodDescription.innerHTML = this.description;
				}

				wrapper.appendChild(apodDescription);
			}
		}

		return wrapper;
	},

	// Request new data from api.nasa.gov
	updateAPOD: async function(daysAgo) {
		if(this.config.appid === "") {
			Log.error(this.name + ": APPID not set.");
			return;
		}
		var url = this.config.apiBase + this.config.apodEndpoint + "?api_key=" + this.config.appid;
		daysAgo = daysAgo || 0;
		if(daysAgo > 0) {
			const queryDate = new Date();
			queryDate.setTime(queryDate.getTime() - 24*60*60*1000*daysAgo);
			const queryDateString = `${queryDate.getFullYear()}-${String(queryDate.getMonth() + 1).padStart(2, '0')}-${String(queryDate.getDate()).padStart(2, '0')}`;
			Log.info(`Querying from ${queryDateString}`);
			url = `${url}&date=${queryDateString}`;
		}

		var self = this;
		var retry = true;

		try {
			const response = await fetch(url);
			if(response.status === 200) {
				const data = await response.json();
				if(!self.processAPOD(data)) {
					retry = false;
					if(daysAgo > 6) {
						throw new Error(`${self.name}: Unable to find an image in the last ${daysAgo} days, check the NASA API: ${url}`);
					}
					await self.updateAPOD(daysAgo + 1);
				}
			} else if(response.status === 403) {
				self.updateDom(self.config.animationSpeed);
				retry = false;
				throw new Error(self.name + ": Incorrect APPID.");
			} else if(response.status === 429) {
				self.updateDom(self.config.animationSpeed);
				retry = false;
				throw new Error(self.name + ": Rate limit exceeded.");
			} else {
				throw new Error(self.name + ": Could not load APOD.");
			}
		} catch(error) {
			Log.error(error);
		} finally {
			if(retry) {
				self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
			}
		}
	},

	// Use the received data to set the various values before update DOM
	processAPOD: function(data) {
		if(!data || typeof data.url === "undefined") {
			Log.error(this.name + ": Do not receive usable data.");
			return false;
		}

		this.title = data.title;
		this.description = data.explanation;
		this.copyright = data.copyright;

		this.type = data.media_type;

		if(this.type === "image") {
			if(typeof data.hdurl !== "undefined") {
				this.url = data.hdurl;
			} else {
				this.url = data.url;
			}
		} else if(this.type === "video") {
			let id = data.url.match(/(?:[?&]vi?=|\/embed\/|\/\d\d?\/|\/vi?\/|https?:\/\/(?:www\.)?youtu\.be\/)([^&\n?#]+)/)[1];
			this.url = "https://img.youtube.com/vi/" + id + "/maxresdefault.jpg";
		} else {
			Log.error(this.name + ": Type of media unknown (not image or video).");
			return false;
		}

		this.loaded = true;
		this.updateDom(this.config.animationSpeed);
		return true;
	},

	// Schedule next update
	scheduleUpdate: function(delay) {
		var nextLoad = this.config.updateInterval;
		if(typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}

		var self = this;
		setTimeout(function() {
			self.updateAPOD();
		}, nextLoad);
	},

	// Short text without cutting sentences and words
	shortText: function (text, maxLenght) {
		if(text.lastIndexOf(".", maxLenght) !== -1) {
			return text.substr(0, text.lastIndexOf(".", maxLenght)) + ".";
		} else if(text.lastIndexOf(" ", maxLenght) !== -1) {
			return text.substr(0, text.lastIndexOf(" ", maxLenght)) + "&hellip;";
		} else {
			return text.substr(0, maxLenght) + "&hellip;";
		} 
	}

});
