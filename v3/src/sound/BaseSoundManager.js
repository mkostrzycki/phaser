var Class = require('../utils/Class');
var NOOP = require('../utils/NOOP');
var EventDispatcher = require('../events/EventDispatcher');
var SoundValueEvent = require('./SoundValueEvent');
//  Phaser.Sound.BaseSoundManager
var BaseSoundManager = new Class({
    initialize: function BaseSoundManager(game) {
        /**
         * Local reference to game.
         *
         * @property {Phaser.Game} game
         */
        this.game = game;
        /**
         * [description]
         *
         * @property {Phaser.Events.EventDispatcher} events
         */
        this.events = new EventDispatcher();
        /**
         * An array containing all added sounds.
         *
         * @private
         * @property {Array} sounds
         */
        this.sounds = [];
        /**
         * Global mute setting.
         *
         * @property {boolean} mute
         */
        this.mute = false;
        /**
         * Global volume setting.
         *
         * @property {number} volume
         */
        this.volume = 1;
        /**
         * Global playback rate at which all the sounds will be played.
         * Value of 1.0 plays the audio at full speed, 0.5 plays the audio at half speed
         * and 2.0 doubles the audio's playback speed.
         *
         * @property {number} rate
         */
        this.rate = 1;
        /**
         * Global detuning of all sounds in [cents](https://en.wikipedia.org/wiki/Cent_%28music%29).
         * The range of the value is -1200 to 1200, but we recommend setting it to [50](https://en.wikipedia.org/wiki/50_Cent).
         *
         * @property {number} detune
         */
        this.detune = 0;
        /**
         * Flag indicating if sounds should be paused when game looses focus,
         * for instance when user switches tabs or to another program/app.
         *
         * @property {boolean} pauseOnBlur
         */
        this.pauseOnBlur = true;
        game.events.on('ON_BLUR', function () {
            if (this.pauseOnBlur) {
                this.onBlur();
            }
        }.bind(this));
        game.events.on('ON_FOCUS', function () {
            if (this.pauseOnBlur) {
                this.onFocus();
            }
        }.bind(this));
        /**
         * Property that actually holds the value of global playback rate.
         *
         * @property {number} _rate
         * @private
         */
        this._rate = 1;
        /**
         * Property that actually holds the value of global detune.
         *
         * @property {number} _detune
         * @private
         */
        this._detune = 0;
    },
    add: NOOP,
    /**
     * [description]
     *
     * @param {string} key
     * @param {ISoundConfig} config
     * @returns {IAudioSpriteSound}
     */
    addAudioSprite: function (key, config) {
        var sound = this.add(key, config);
        /**
         * Local reference to 'spritemap' object form json file generated by audiosprite tool.
         *
         * @property {object} spritemap
         */
        sound.spritemap = this.game.cache.json.get(key).spritemap;
        for (var markerName in sound.spritemap) {
            if (!sound.spritemap.hasOwnProperty(markerName)) {
                continue;
            }
            var marker = sound.spritemap[markerName];
            sound.addMarker({
                name: markerName,
                start: marker.start,
                duration: marker.end - marker.start,
                config: config
            });
        }
        return sound;
    },
    play: function (key, extra) {
        var sound = this.add(key);
        sound.events.once('SOUND_ENDED', sound.destroy.bind(sound));
        if (extra) {
            if (extra.name) {
                sound.addMarker(extra);
                sound.play(extra.name);
            }
            else {
                sound.play(extra);
            }
        }
        else {
            sound.play();
        }
    },
    playAudioSprite: function (key, spriteName, config) {
        var sound = this.addAudioSprite(key);
        sound.events.once('SOUND_ENDED', sound.destroy.bind(sound));
        sound.play(spriteName, config);
    },
    /**
     *
     *
     * @param {ISound} sound
     * @returns {boolean} True if the sound was removed successfully, otherwise false.
     */
    remove: function (sound) {
        var index = this.sounds.indexOf(sound);
        if (index !== -1) {
            this.sounds.splice(index, 1);
            return true;
        }
        return false;
    },
    /**
     *
     * @param {string} key
     * @returns {number} The number of matching sound objects that were removed.
     */
    removeByKey: function (key) {
        var removed = 0;
        for (var i = this.sounds.length - 1; i >= 0; i--) {
            if (this.sounds[i].key === key) {
                this.sounds.splice(i, 1);
                removed++;
            }
        }
        return removed;
    },
    pauseAll: function () {
        this.forEachActiveSound(function (sound) {
            sound.pause();
        });
    },
    resumeAll: function () {
        this.forEachActiveSound(function (sound) {
            sound.resume();
        });
    },
    stopAll: function () {
        this.forEachActiveSound(function (sound) {
            sound.stop();
        });
    },
    /**
     * @private
     */
    onBlur: NOOP,
    /**
     * @private
     */
    onFocus: NOOP,
    /**
     * Update method called on every game step.
     *
     * @private
     * @param {number} time - The current timestamp as generated by the Request Animation Frame or SetTimeout.
     * @param {number} delta - The delta time elapsed since the last frame.
     */
    update: function (time, delta) {
        this.sounds.sort(function (s1, s2) {
            return (s1.pendingRemove === s2.pendingRemove) ? 0 : s1 ? 1 : -1;
        });
        for (var i = this.sounds.length - 1; i >= 0; i--) {
            if (!this.sounds[i].pendingRemove) {
                this.sounds.splice(this.sounds.length - 1 - i);
                break;
            }
        }
        this.sounds.forEach(function (sound) {
            sound.update(time, delta);
        });
    },
    destroy: function () {
        this.game = null;
        this.events.destroy();
        this.events = null;
        this.forEachActiveSound(function (sound) {
            sound.destroy();
        });
        this.sounds = null;
    },
    /**
     * @private
     * @param {(value: ISound, index: number, array: ISound[]) => void} callbackfn
     * @param thisArg
     */
    forEachActiveSound: function (callbackfn, thisArg) {
        var _this = this;
        this.sounds.forEach(function (sound, index) {
            if (!sound.pendingRemove) {
                callbackfn.call(thisArg || _this, sound, index, _this.sounds);
            }
        });
    }
});
/**
 * Global playback rate.
 * @property {number} rate
 */
Object.defineProperty(BaseSoundManager.prototype, 'rate', {
    get: function () {
        return this._rate;
    },
    set: function (value) {
        this._rate = value;
        this.forEachActiveSound(function (sound) {
            sound.setRate();
        }, this);
        this.events.dispatch(new SoundValueEvent(this, 'SOUND_RATE', value));
    }
});
/**
 * Global detune.
 * @property {number} detune
 */
Object.defineProperty(BaseSoundManager.prototype, 'detune', {
    get: function () {
        return this._detune;
    },
    set: function (value) {
        this._detune = value;
        this.forEachActiveSound(function (sound) {
            sound.setRate();
        }, this);
        this.events.dispatch(new SoundValueEvent(this, 'SOUND_DETUNE', value));
    }
});
module.exports = BaseSoundManager;
