/* Magic Mirror
 * Module: MMM-APOD
 *
 * Magic Mirror By Michael Teeuw https://magicmirror.builders
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
		this.loaded = false;
		this.scheduleUpdate(this.config.initialLoadDelay);
	},

	// Override dom generator
	getDom: function() {
		var wrapper = document.createElement("div");

		if (this.config.appid === "") {
			wrapper.innerHTML = "Please set the correct NASA <i>appid</i> in the config for module: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if (!this.loaded) {
			wrapper.innerHTML = this.translate("LOADING");
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if(this.config.showTitle) {
			var apodTitle = document.createElement('div');
			apodTitle.className = "dimmed light small";
			apodTitle.innerHTML = this.title;
			wrapper.appendChild(apodTitle);
		}

		if (this.type === "image") {
			var apodImage = document.createElement('img');

			var styleString = '';
			if (this.config.maxMediaWidth != 0) {
				styleString += 'max-width: ' + this.config.maxMediaWidth + 'px;';
			}
			if (this.config.maxMediaHeight != 0) {
				styleString += 'max-height: ' + this.config.maxMediaHeight + 'px;';
			}
			if (styleString != '') {
				apodImage.style = styleString;
			}

			apodImage.src = this.url;
			apodImage.alt = this.title;

			wrapper.appendChild(apodImage);
		} else if (this.type === "video") {
			var apodVideo = document.createElement('iframe');

			var styleString = 'border: none;';
			if (this.config.maxMediaWidth != 0) {
				styleString += 'max-width: ' + this.config.maxMediaWidth + 'px;';
			}
			if (this.config.maxMediaHeight != 0) {
				styleString += 'max-height: ' + this.config.maxMediaHeight + 'px;';
			}
			apodVideo.style = styleString;

			apodVideo.src = this.url.replace("www.youtube.com", "www.youtube-nocookie.com");
			apodVideo.width = "960";
			apodVideo.height = "540";

			wrapper.appendChild(apodVideo);
		} else {
			Log.error(this.name + ": Type of media unknown (not image or video).");
			return;
		}

		if(this.copyright != "" && typeof this.copyright !== "undefined") {
			var apodCopyright = document.createElement('div');

			apodCopyright.className = "dimmed thin xsmall";
			apodCopyright.innerHTML = "&copy; " + this.copyright;

			wrapper.appendChild(apodCopyright);
		}

		if(this.config.showDescription) {
			var apodDescription = document.createElement('div');

			apodDescription.className = "dimmed light xsmall description";

			if (this.config.maxMediaWidth != 0) {
				apodDescription.style = 'max-width: ' + this.config.maxMediaWidth + 'px;';
			} else if (this.type === "video") {
				apodDescription.style = 'max-width: 960px;';
			}

			if(this.config.useShortDescription) {
				apodDescription.innerHTML = this.shortText(this.description, this.config.maxDescriptionLength);
			} else {
				apodDescription.innerHTML = this.description;
			}

			wrapper.appendChild(apodDescription);
		}

		return wrapper;
	},

	// Request new data from api.nasa.gov
	updateAPOD: function() {
		if (this.config.appid === "") {
			Log.error(this.name + ": APPID not set.");
			return;
		}

		var url = this.config.apiBase + this.config.apodEndpoint + "?api_key=" + this.config.appid;
		var self = this;
		var retry = true;

		var apodRequest = new XMLHttpRequest();
		apodRequest.open("GET", url, true);
		apodRequest.onreadystatechange = function() {
			if (this.readyState === 4) {
				if (this.status === 200) {
					self.processAPOD(JSON.parse(this.response));
				} else if (this.status === 403) {
					self.updateDom(self.config.animationSpeed);

					Log.error(self.name + ": Incorrect APPID.");
					retry = false;
				} else if (this.status === 429) {
					self.updateDom(self.config.animationSpeed);

					Log.error(self.name + ": Rate limit exceeded.");
					retry = false;
				} else {
					Log.error(self.name + ": Could not load APOD.");
				}

				if (retry) {
					self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
				}
			}
		};
		apodRequest.send();
	},

	// Use the received data to set the various values before update DOM
	processAPOD: function(data) {
		if (!data || typeof data.url === "undefined") {
			Log.error(this.name + ": Do not receive usable data.");
			return;
		}

		this.title = data.title;
		this.description = data.explanation;
		this.copyright = data.copyright;

		this.type = data.media_type;
		this.url = data.url;

		this.loaded = true;
		this.updateDom(this.config.animationSpeed);
	},

	// Schedule next update
	scheduleUpdate: function(delay) {
		var nextLoad = this.config.updateInterval;
		if (typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}

		var self = this;
		setTimeout(function() {
			self.updateAPOD();
		}, nextLoad);
	},

	// Short text without cutting sentences and words
	shortText: function (text, maxLenght) {
		if (text.lastIndexOf(".", maxLenght) !== -1) {
			return text.substr(0, text.lastIndexOf(".", maxLenght)) + ".";
		} else if (text.lastIndexOf(" ", maxLenght) !== -1) {
			return text.substr(0, text.lastIndexOf(" ", maxLenght)) + "&hellip;";
		} else {
			return text.substr(0, maxLenght) + "&hellip;";
		} 
	}

});
