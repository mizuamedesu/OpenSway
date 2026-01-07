/**
 * OpenSway - Main JavaScript for CEP Panel
 */

(function() {
    'use strict';

    var csInterface = new CSInterface();

    // Presets data
    var PRESETS = {
        custom: { amplitude: 50, frequency: 2, chainDelay: 0.1, noiseAmount: 20, damping: 30, stiffness: 50, physicsBlend: 0, gravity: 0 },
        hair: { amplitude: 30, frequency: 1.5, chainDelay: 0.08, noiseAmount: 35, damping: 40, stiffness: 20, physicsBlend: 0, gravity: 5 },
        rope: { amplitude: 40, frequency: 0.8, chainDelay: 0.05, noiseAmount: 10, damping: 60, stiffness: 70, physicsBlend: 80, gravity: 20 },
        cloth: { amplitude: 50, frequency: 1.0, chainDelay: 0.12, noiseAmount: 50, damping: 30, stiffness: 40, physicsBlend: 40, gravity: 3 },
        tail: { amplitude: 60, frequency: 2.0, chainDelay: 0.1, noiseAmount: 25, damping: 25, stiffness: 35, physicsBlend: 0, gravity: 0 }
    };

    // UI Elements
    var ui = {
        modeSelect: null,
        presetSelect: null,
        amplitude: null,
        amplitudeVal: null,
        frequency: null,
        frequencyVal: null,
        chainDelay: null,
        chainDelayVal: null,
        noiseAmount: null,
        noiseAmountVal: null,
        damping: null,
        dampingVal: null,
        stiffness: null,
        stiffnessVal: null,
        physicsBlend: null,
        physicsBlendVal: null,
        gravity: null,
        gravityVal: null,
        decayStart: null,
        decayDuration: null,
        btnApply: null,
        btnRemove: null,
        btnBake: null,
        status: null
    };

    // Initialize
    function init() {
        // Cache UI elements
        ui.modeSelect = document.getElementById('modeSelect');
        ui.presetSelect = document.getElementById('presetSelect');
        ui.amplitude = document.getElementById('amplitude');
        ui.amplitudeVal = document.getElementById('amplitudeVal');
        ui.frequency = document.getElementById('frequency');
        ui.frequencyVal = document.getElementById('frequencyVal');
        ui.chainDelay = document.getElementById('chainDelay');
        ui.chainDelayVal = document.getElementById('chainDelayVal');
        ui.noiseAmount = document.getElementById('noiseAmount');
        ui.noiseAmountVal = document.getElementById('noiseAmountVal');
        ui.damping = document.getElementById('damping');
        ui.dampingVal = document.getElementById('dampingVal');
        ui.stiffness = document.getElementById('stiffness');
        ui.stiffnessVal = document.getElementById('stiffnessVal');
        ui.physicsBlend = document.getElementById('physicsBlend');
        ui.physicsBlendVal = document.getElementById('physicsBlendVal');
        ui.gravity = document.getElementById('gravity');
        ui.gravityVal = document.getElementById('gravityVal');
        ui.decayStart = document.getElementById('decayStart');
        ui.decayDuration = document.getElementById('decayDuration');
        ui.btnApply = document.getElementById('btnApply');
        ui.btnRemove = document.getElementById('btnRemove');
        ui.btnBake = document.getElementById('btnBake');
        ui.status = document.getElementById('status');

        // Bind events
        bindEvents();

        // Set theme
        updateTheme();
    }

    // Bind UI events
    function bindEvents() {
        // Slider sync
        syncSlider(ui.amplitude, ui.amplitudeVal);
        syncSlider(ui.frequency, ui.frequencyVal);
        syncSlider(ui.chainDelay, ui.chainDelayVal);
        syncSlider(ui.noiseAmount, ui.noiseAmountVal);
        syncSlider(ui.damping, ui.dampingVal);
        syncSlider(ui.stiffness, ui.stiffnessVal);
        syncSlider(ui.physicsBlend, ui.physicsBlendVal);
        syncSlider(ui.gravity, ui.gravityVal);

        // Preset change
        ui.presetSelect.addEventListener('change', function() {
            var preset = PRESETS[this.value];
            if (preset) {
                setSliderValue(ui.amplitude, ui.amplitudeVal, preset.amplitude);
                setSliderValue(ui.frequency, ui.frequencyVal, preset.frequency);
                setSliderValue(ui.chainDelay, ui.chainDelayVal, preset.chainDelay);
                setSliderValue(ui.noiseAmount, ui.noiseAmountVal, preset.noiseAmount);
                setSliderValue(ui.damping, ui.dampingVal, preset.damping);
                setSliderValue(ui.stiffness, ui.stiffnessVal, preset.stiffness);
                setSliderValue(ui.physicsBlend, ui.physicsBlendVal, preset.physicsBlend);
                setSliderValue(ui.gravity, ui.gravityVal, preset.gravity);
            }
        });

        // Buttons
        ui.btnApply.addEventListener('click', applySway);
        ui.btnRemove.addEventListener('click', removeSway);
        ui.btnBake.addEventListener('click', bakeToKeyframes);
    }

    // Sync slider and input
    function syncSlider(slider, input) {
        slider.addEventListener('input', function() {
            input.value = parseFloat(this.value).toFixed(this.step < 1 ? 2 : 0);
        });
        input.addEventListener('change', function() {
            var val = parseFloat(this.value);
            if (!isNaN(val)) {
                slider.value = val;
            }
        });
    }

    // Set slider value
    function setSliderValue(slider, input, value) {
        slider.value = value;
        input.value = value;
    }

    // Get current parameters
    function getParams() {
        return {
            mode: ui.modeSelect.value,
            amplitude: parseFloat(ui.amplitude.value),
            frequency: parseFloat(ui.frequency.value),
            chainDelay: parseFloat(ui.chainDelay.value),
            noiseAmount: parseFloat(ui.noiseAmount.value),
            damping: parseFloat(ui.damping.value),
            stiffness: parseFloat(ui.stiffness.value),
            physicsBlend: parseFloat(ui.physicsBlend.value),
            gravity: parseFloat(ui.gravity.value),
            decayStart: parseFloat(ui.decayStart.value) || 0,
            decayDuration: parseFloat(ui.decayDuration.value) || 1
        };
    }

    // Show status message
    function showStatus(message, isError) {
        ui.status.textContent = message;
        ui.status.className = isError ? 'error' : 'success';
        setTimeout(function() {
            ui.status.textContent = '';
            ui.status.className = '';
        }, 3000);
    }

    // Apply sway
    function applySway() {
        var params = getParams();
        var script = 'applySwayFromPanel(' + JSON.stringify(params) + ')';

        csInterface.evalScript(script, function(result) {
            if (result && result !== 'null' && result !== 'undefined') {
                if (result.indexOf('Error') === -1) {
                    showStatus('Sway applied!', false);
                } else {
                    showStatus(result, true);
                }
            }
        });
    }

    // Remove sway
    function removeSway() {
        csInterface.evalScript('removeSway()', function(result) {
            if (result && result.indexOf('Error') === -1) {
                showStatus('Sway removed', false);
            }
        });
    }

    // Bake to keyframes
    function bakeToKeyframes() {
        csInterface.evalScript('bakeToKeyframesFromPanel()', function(result) {
            if (result && result.indexOf('Error') === -1) {
                showStatus('Baked to keyframes', false);
            }
        });
    }

    // Update theme based on host app
    function updateTheme() {
        var hostEnv = csInterface.getHostEnvironment();
        var bgColor = hostEnv.appSkinInfo.panelBackgroundColor.color;
        var isDark = (bgColor.red + bgColor.green + bgColor.blue) / 3 < 128;

        if (!isDark) {
            document.body.classList.add('light-theme');
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
