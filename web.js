var VanillaTilt = (function () {
    "use strict";
  
    class Tilt {
      constructor(element, settings = {}) {
        if (!(element instanceof Node)) throw "Can't initialize VanillaTilt because " + element + " is not a Node.";
        
        this.width = null;
        this.height = null;
        this.clientWidth = null;
        this.clientHeight = null;
        this.left = null;
        this.top = null;
        this.gammazero = null;
        this.betazero = null;
        this.lastgammazero = null;
        this.lastbetazero = null;
        this.transitionTimeout = null;
        this.updateCall = null;
        this.event = null;
  
        this.updateBind = this.update.bind(this);
        this.resetBind = this.reset.bind(this);
  
        this.element = element;
        this.settings = this.extendSettings(settings);
        this.reverse = this.settings.reverse ? -1 : 1;
        this.resetToStart = Tilt.isSettingTrue(this.settings["reset-to-start"]);
        this.glare = Tilt.isSettingTrue(this.settings.glare);
        this.glarePrerender = Tilt.isSettingTrue(this.settings["glare-prerender"]);
        this.fullPageListening = Tilt.isSettingTrue(this.settings["full-page-listening"]);
        this.gyroscope = Tilt.isSettingTrue(this.settings.gyroscope);
        this.gyroscopeSamples = this.settings.gyroscopeSamples;
  
        this.elementListener = this.getElementListener();
        if (this.glare) this.prepareGlare();
        if (this.fullPageListening) this.updateClientSize();
        
        this.addEventListeners();
        this.reset();
  
        if (false === this.resetToStart) {
          this.settings.startX = 0;
          this.settings.startY = 0;
        }
      }
  
      static isSettingTrue(setting) {
        return "" === setting || true === setting || 1 === setting;
      }
  
      getElementListener() {
        if (this.fullPageListening) return window.document;
        if (typeof this.settings["mouse-event-element"] === "string") {
          const listener = document.querySelector(this.settings["mouse-event-element"]);
          if (listener) return listener;
        }
        return this.settings["mouse-event-element"] instanceof Node ? this.settings["mouse-event-element"] : this.element;
      }
  
      addEventListeners() {
        this.onMouseEnterBind = this.onMouseEnter.bind(this);
        this.onMouseMoveBind = this.onMouseMove.bind(this);
        this.onMouseLeaveBind = this.onMouseLeave.bind(this);
        this.onWindowResizeBind = this.onWindowResize.bind(this);
        this.onDeviceOrientationBind = this.onDeviceOrientation.bind(this);
  
        this.elementListener.addEventListener("mouseenter", this.onMouseEnterBind);
        this.elementListener.addEventListener("mouseleave", this.onMouseLeaveBind);
        this.elementListener.addEventListener("mousemove", this.onMouseMoveBind);
  
        if (this.glare || this.fullPageListening) {
          window.addEventListener("resize", this.onWindowResizeBind);
        }
  
        if (this.gyroscope) {
          window.addEventListener("deviceorientation", this.onDeviceOrientationBind);
        }
      }
  
      removeEventListeners() {
        this.elementListener.removeEventListener("mouseenter", this.onMouseEnterBind);
        this.elementListener.removeEventListener("mouseleave", this.onMouseLeaveBind);
        this.elementListener.removeEventListener("mousemove", this.onMouseMoveBind);
  
        if (this.gyroscope) {
          window.removeEventListener("deviceorientation", this.onDeviceOrientationBind);
        }
  
        if (this.glare || this.fullPageListening) {
          window.removeEventListener("resize", this.onWindowResizeBind);
        }
      }
  
      destroy() {
        clearTimeout(this.transitionTimeout);
        if (null !== this.updateCall) cancelAnimationFrame(this.updateCall);
  
        this.element.style.willChange = "";
        this.element.style.transition = "";
        this.element.style.transform = "";
  
        this.resetGlare();
        this.removeEventListeners();
        this.element.vanillaTilt = null;
        delete this.element.vanillaTilt;
        this.element = null;
      }
  
      onDeviceOrientation(event) {
        if (null === event.gamma || null === event.beta) return;
        this.updateElementPosition();
  
        if (this.gyroscopeSamples > 0) {
          this.lastgammazero = this.gammazero;
          this.lastbetazero = this.betazero;
  
          if (null === this.gammazero) {
            this.gammazero = event.gamma;
            this.betazero = event.beta;
          } else {
            this.gammazero = (event.gamma + this.lastgammazero) / 2;
            this.betazero = (event.beta + this.lastbetazero) / 2;
          }
  
          this.gyroscopeSamples -= 1;
        }
  
        const totalX = this.settings.gyroscopeMaxAngleX - this.settings.gyroscopeMinAngleX;
        const totalY = this.settings.gyroscopeMaxAngleY - this.settings.gyroscopeMinAngleY;
        const perX = totalX / this.width;
        const perY = totalY / this.height;
        const tiltX = (event.gamma - (this.settings.gyroscopeMinAngleX + this.gammazero)) / perX;
        const tiltY = (event.beta - (this.settings.gyroscopeMinAngleY + this.betazero)) / perY;
  
        if (null !== this.updateCall) cancelAnimationFrame(this.updateCall);
  
        this.event = { clientX: tiltX + this.left, clientY: tiltY + this.top };
        this.updateCall = requestAnimationFrame(this.updateBind);
      }
  
      onMouseEnter() {
        this.updateElementPosition();
        this.element.style.willChange = "transform";
        this.setTransition();
      }
  
      onMouseMove(event) {
        if (null !== this.updateCall) cancelAnimationFrame(this.updateCall);
        this.event = event;
        this.updateCall = requestAnimationFrame(this.updateBind);
      }
  
      onMouseLeave() {
        this.setTransition();
        if (this.settings.reset) requestAnimationFrame(this.resetBind);
      }
  
      reset() {
        this.onMouseEnter();
        this.fullPageListening
          ? (this.event = {
              clientX: ((this.settings.startX + this.settings.max) / (2 * this.settings.max)) * this.clientWidth,
              clientY: ((this.settings.startY + this.settings.max) / (2 * this.settings.max)) * this.clientHeight,
            })
          : (this.event = {
              clientX: this.left + ((this.settings.startX + this.settings.max) / (2 * this.settings.max)) * this.width,
              clientY: this.top + ((this.settings.startY + this.settings.max) / (2 * this.settings.max)) * this.height,
            });
  
        let scale = this.settings.scale;
        this.settings.scale = 1;
        this.update();
        this.settings.scale = scale;
        this.resetGlare();
      }
  
      resetGlare() {
        if (this.glare) {
          this.glareElement.style.transform = "rotate(180deg) translate(-50%, -50%)";
          this.glareElement.style.opacity = "0";
        }
      }
  
      getValues() {
        let percentageX, percentageY;
        if (this.fullPageListening) {
          percentageX = this.event.clientX / this.clientWidth;
          percentageY = this.event.clientY / this.clientHeight;
        } else {
          percentageX = (this.event.clientX - this.left) / this.width;
          percentageY = (this.event.clientY - this.top) / this.height;
        }
  
        percentageX = Math.min(Math.max(percentageX, 0), 1);
        percentageY = Math.min(Math.max(percentageY, 0), 1);
  
        return {
          tiltX: (this.reverse * (this.settings.max - percentageX * this.settings.max * 2)).toFixed(2),
          tiltY: (this.reverse * (percentageY * this.settings.max * 2 - this.settings.max)).toFixed(2),
          percentageX: 100 * percentageX,
          percentageY: 100 * percentageY,
          angle: Math.atan2(
            this.event.clientX - (this.left + this.width / 2),
            -(this.event.clientY - (this.top + this.height / 2))
          ) * (180 / Math.PI),
        };
      }
  
      updateElementPosition() {
        let rect = this.element.getBoundingClientRect();
        this.width = this.element.offsetWidth;
        this.height = this.element.offsetHeight;
        this.left = rect.left;
        this.top = rect.top;
      }
  
      update() {
        let values = this.getValues();
        this.element.style.transform = `perspective(${this.settings.perspective}px) rotateX(${
          "x" === this.settings.axis ? 0 : values.tiltY
        }deg) rotateY(${this.settings.axis === "y" ? 0 : values.tiltX}deg) scale3d(${this.settings.scale}, ${this.settings.scale}, ${this.settings.scale})`;
  
        if (this.glare) {
          this.glareElement.style.transform = `rotate(${values.angle}deg) translate(-50%, -50%)`;
          this.glareElement.style.opacity = `${values.percentageY * this.settings["max-glare"] / 100}`;
        }
  
        this.element.dispatchEvent(new CustomEvent("tiltChange", { detail: values }));
        this.updateCall = null;
      }
  
      prepareGlare() {
        if (!this.glarePrerender) {
          const glareWrapper = document.createElement("div");
          glareWrapper.classList.add("js-tilt-glare");
          const glareInner = document.createElement("div");
          glareInner.classList.add("js-tilt-glare-inner");
          glareWrapper.appendChild(glareInner);
          this.element.appendChild(glareWrapper);
        }
  
        this.glareElementWrapper = this.element.querySelector(".js-tilt-glare");
        this.glareElement = this.element.querySelector(".js-tilt-glare-inner");
  
        if (!this.glarePrerender) {
          Object.assign(this.glareElementWrapper.style, {
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            "pointer-events": "none",
            "border-radius": "inherit",
          });
  
          Object.assign(this.glareElement.style, {
            position: "absolute",
            top: "50%",
            left: "50%",
            "pointer-events": "none",
            "background-image": "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)",
            transform: "rotate(180deg) translate(-50%, -50%)",
            "transform-origin": "0% 0%",
            opacity: "0",
          });
  
          this.updateGlareSize();
        }
      }
  
      updateGlareSize() {
        if (this.glare) {
          const glareSize = 2 * (this.element.offsetWidth > this.element.offsetHeight ? this.element.offsetWidth : this.element.offsetHeight);
          Object.assign(this.glareElement.style, {
            width: `${glareSize}px`,
            height: `${glareSize}px`,
          });
        }
      }
  
      updateClientSize() {
        this.clientWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        this.clientHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
      }
  
      onWindowResize() {
        this.updateGlareSize();
        this.updateClientSize();
      }
  
      setTransition() {
        clearTimeout(this.transitionTimeout);
        this.element.style.transition = `${this.settings.speed}ms ${this.settings.easing}`;
        if (this.glare) this.glareElement.style.transition = `opacity ${this.settings.speed}ms ${this.settings.easing}`;
  
        this.transitionTimeout = setTimeout(() => {
          this.element.style.transition = "";
          if (this.glare) this.glareElement.style.transition = "";
        }, this.settings.speed);
      }
  
      extendSettings(settings) {
        let defaultSettings = {
          reverse: false,
          max: 15,
          startX: 0,
          startY: 0,
          perspective: 1000,
          easing: "cubic-bezier(.03,.98,.52,.99)",
          scale: 1,
          speed: 300,
          transition: true,
          axis: null,
          glare: false,
          "max-glare": 1,
          "glare-prerender": false,
          "full-page-listening": false,
          "mouse-event-element": null,
          reset: true,
          "reset-to-start": true,
          gyroscope: true,
          gyroscopeMinAngleX: -45,
          gyroscopeMaxAngleX: 45,
          gyroscopeMinAngleY: -45,
          gyroscopeMaxAngleY: 45,
          gyroscopeSamples: 10,
        };
  
        let newSettings = {};
        for (let key in defaultSettings) {
          if (key in settings) {
            newSettings[key] = settings[key];
          } else if (this.element.hasAttribute(`data-tilt-${key}`)) {
            let attribute = this.element.getAttribute(`data-tilt-${key}`);
            try {
              newSettings[key] = JSON.parse(attribute);
            } catch (e) {
              newSettings[key] = attribute;
            }
          } else {
            newSettings[key] = defaultSettings[key];
          }
        }
        return newSettings;
      }
  
      static init(elements, settings) {
        if (elements instanceof Node) elements = [elements];
        if (elements instanceof NodeList) elements = [].slice.call(elements);
  
        if (Array.isArray(elements)) {
          elements.forEach((element) => {
            if (!("vanillaTilt" in element)) {
              element.vanillaTilt = new Tilt(element, settings);
            }
          });
        }
      }
    }
  
    if (typeof document !== "undefined") {
      window.VanillaTilt = Tilt;
      Tilt.init(document.querySelectorAll("[data-tilt]"));
    }
  
    return Tilt;
  })();
  // Ambil semua elemen video
  const videos = document.querySelectorAll('video');

  videos.forEach(video => {
    video.addEventListener('play', () => {
      // Pause semua video kecuali yang sedang diputar
      videos.forEach(v => {
        if (v !== video) {
          v.pause();
        }
      });
    });
  });