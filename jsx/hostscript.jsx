/**
 * OpenSway - Host Script (ExtendScript for After Effects)
 * @version 1.0.0
 */

// ============================================================
// Configuration
// ============================================================

var CONFIG = {
    controlPrefix: "OpenSway_"
};

// ============================================================
// Utility Functions
// ============================================================

function distance2D(p1, p2) {
    var dx = p2[0] - p1[0];
    var dy = p2[1] - p1[1];
    return Math.sqrt(dx * dx + dy * dy);
}

function getActiveComp() {
    var comp = app.project.activeItem;
    if (comp instanceof CompItem) {
        return comp;
    }
    return null;
}

function findLayerByName(comp, name) {
    for (var i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).name === name) {
            return comp.layer(i);
        }
    }
    return null;
}

function createUniqueName(comp, baseName) {
    var name = baseName;
    var counter = 1;
    while (findLayerByName(comp, name)) {
        counter++;
        name = baseName + "_" + counter;
    }
    return name;
}

// ============================================================
// Puppet Pin Detection
// ============================================================

function getPuppetPinsFromSelection() {
    var comp = getActiveComp();
    if (!comp) return { error: "Please select a composition." };

    var selectedLayers = comp.selectedLayers;
    if (selectedLayers.length === 0) {
        return { error: "Please select a layer with puppet pins." };
    }

    var layer = selectedLayers[0];

    // Find puppet effect
    var effects = layer.property("ADBE Effect Parade");
    if (!effects) return { error: "No effects found on layer." };

    var puppetEffect = null;
    for (var i = 1; i <= effects.numProperties; i++) {
        var effect = effects.property(i);
        if (effect.matchName === "ADBE FreePin3") {
            puppetEffect = effect;
            break;
        }
    }

    if (!puppetEffect) {
        return { error: "No Puppet effect found. Please apply Puppet Pin tool first." };
    }

    // Get mesh
    var mesh = puppetEffect.property("ADBE FreePin3 ARAP Group");
    if (!mesh) return { error: "No puppet mesh found." };

    // Find selected puppet pins
    var selectedProps = comp.selectedProperties;
    var pinPositions = [];

    for (var i = 0; i < selectedProps.length; i++) {
        var prop = selectedProps[i];
        if (prop.matchName === "ADBE FreePin3 PosPin Atom" ||
            (prop.parentProperty && prop.parentProperty.matchName === "ADBE FreePin3 PosPin Atom")) {

            var pinProp = prop.matchName === "ADBE FreePin3 PosPin Atom" ? prop : prop.parentProperty;
            var posProp = pinProp.property("ADBE FreePin3 PosPin Position");

            if (posProp) {
                pinPositions.push({
                    property: posProp,
                    pinGroup: pinProp,
                    position: posProp.value,
                    name: pinProp.name
                });
            }
        }
    }

    // Try all pins if none selected
    if (pinPositions.length === 0) {
        var arapGroup = mesh;
        for (var i = 1; i <= arapGroup.numProperties; i++) {
            var subGroup = arapGroup.property(i);
            if (subGroup.matchName === "ADBE FreePin3 PosPin Group") {
                for (var j = 1; j <= subGroup.numProperties; j++) {
                    var pin = subGroup.property(j);
                    if (pin.matchName === "ADBE FreePin3 PosPin Atom") {
                        var posProp = pin.property("ADBE FreePin3 PosPin Position");
                        if (posProp && posProp.selected) {
                            pinPositions.push({
                                property: posProp,
                                pinGroup: pin,
                                position: posProp.value,
                                name: pin.name
                            });
                        }
                    }
                }
            }
        }
    }

    if (pinPositions.length < 2) {
        return { error: "Please select at least 2 puppet pins." };
    }

    return {
        layer: layer,
        comp: comp,
        pins: pinPositions
    };
}

// ============================================================
// Chain Detection
// ============================================================

function sortPinsIntoChain(pins) {
    if (pins.length === 0) return [];
    if (pins.length === 1) return pins;

    // First selected pin becomes the root (fixed point)
    var chain = [pins[0]];
    var remaining = [];
    for (var i = 1; i < pins.length; i++) {
        remaining.push(pins[i]);
    }

    while (remaining.length > 0) {
        var lastPin = chain[chain.length - 1];
        var lastPos = lastPin.position;

        var nearestIndex = 0;
        var nearestDist = distance2D(lastPos, remaining[0].position);

        for (var i = 1; i < remaining.length; i++) {
            var dist = distance2D(lastPos, remaining[i].position);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestIndex = i;
            }
        }

        chain.push(remaining[nearestIndex]);
        remaining.splice(nearestIndex, 1);
    }

    return chain;
}

// ============================================================
// Control Layer Creation
// ============================================================

function createControlLayer(comp, name, params) {
    var ctrlLayer = comp.layers.addNull();
    ctrlLayer.name = name;
    ctrlLayer.label = 14;
    ctrlLayer.shy = true;

    function addSlider(displayName, value) {
        var slider = ctrlLayer.Effects.addProperty("ADBE Slider Control");
        slider.name = displayName;
        slider.property(1).setValue(value);
        return slider;
    }

    function addCheckbox(displayName, value) {
        var checkbox = ctrlLayer.Effects.addProperty("ADBE Checkbox Control");
        checkbox.name = displayName;
        checkbox.property(1).setValue(value ? 1 : 0);
        return checkbox;
    }

    addSlider("Amplitude", params.amplitude || 50);
    addSlider("Frequency", params.frequency || 2.0);
    addSlider("Phase Offset", params.phaseOffset || 0);
    addSlider("Damping", params.damping || 30);
    addSlider("Stiffness", params.stiffness || 50);
    addSlider("Gravity", params.gravity || 0);
    addSlider("Chain Delay", params.chainDelay || 0.1);
    addSlider("Noise Amount", params.noiseAmount || 20);
    addSlider("Noise Scale", params.noiseScale || 1.0);
    addSlider("Wind Direction", params.windDirection || 0);
    addSlider("Wind Strength", params.windStrength || 0);
    addSlider("Decay Start", params.decayStart || 0);
    addSlider("Decay Duration", params.decayDuration || 1.0);
    addCheckbox("Enabled", true);

    return ctrlLayer;
}

// ============================================================
// Expression Generators
// ============================================================

function generateProceduralExpression(controlLayerName, chainIndex, restPos) {
    var expr = [
        '// OpenSway Procedural Mode',
        'var ctrl = thisComp.layer("' + controlLayerName + '");',
        'var enabled = ctrl.effect("Enabled")(1);',
        'if (enabled == 0) { value; } else {',
        '',
        'var amp = ctrl.effect("Amplitude")(1);',
        'var freq = ctrl.effect("Frequency")(1);',
        'var phase = ctrl.effect("Phase Offset")(1) * Math.PI / 180;',
        'var chainDelay = ctrl.effect("Chain Delay")(1);',
        'var noiseAmt = ctrl.effect("Noise Amount")(1) / 100;',
        'var noiseScale = ctrl.effect("Noise Scale")(1);',
        'var windDir = ctrl.effect("Wind Direction")(1) * Math.PI / 180;',
        'var windStr = ctrl.effect("Wind Strength")(1);',
        'var decayStart = ctrl.effect("Decay Start")(1);',
        'var decayDur = ctrl.effect("Decay Duration")(1);',
        '',
        'var chainIndex = ' + chainIndex + ';',
        'var t = time - chainIndex * chainDelay;',
        '',
        'var sineX = Math.sin(t * freq * Math.PI * 2 + phase);',
        'var sineY = Math.sin(t * freq * Math.PI * 2 + phase + Math.PI / 4) * 0.3;',
        '',
        'var seed = chainIndex * 1000;',
        'var noiseX = noise([t * noiseScale, seed]) * 2 - 1;',
        'var noiseY = noise([t * noiseScale + 100, seed]) * 2 - 1;',
        '',
        'var motionX = sineX * (1 - noiseAmt) + noiseX * noiseAmt;',
        'var motionY = sineY * (1 - noiseAmt) + noiseY * noiseAmt * 0.5;',
        '',
        '// Wind force',
        'var windX = Math.cos(windDir) * windStr * (1 + noise([t * 2, seed + 500]) * 0.5);',
        'var windY = Math.sin(windDir) * windStr * (1 + noise([t * 2, seed + 600]) * 0.5);',
        '',
        '// Root stays fixed, motion increases toward tip',
        'var chainMult = chainIndex * 0.5;',
        '',
        'var decayMult = 1;',
        'if (decayStart > 0 && time > decayStart) {',
        '    var elapsed = time - decayStart;',
        '    decayMult = Math.max(0, 1 - elapsed / Math.max(0.001, decayDur));',
        '    decayMult = decayMult * decayMult * (3 - 2 * decayMult);',
        '}',
        '',
        'var offsetX = (motionX * amp + windX) * chainMult * decayMult;',
        'var offsetY = (motionY * amp + windY) * chainMult * decayMult;',
        '',
        'value + [offsetX, offsetY];',
        '}'
    ];
    return expr.join('\n');
}

// ============================================================
// Main Functions (Called from Panel)
// ============================================================

function applySwayFromPanel(paramsJSON) {
    var params;
    try {
        params = (typeof paramsJSON === 'string') ? JSON.parse(paramsJSON) : paramsJSON;
    } catch (e) {
        return "Error: Invalid parameters";
    }

    var data = getPuppetPinsFromSelection();
    if (data.error) {
        alert(data.error, "OpenSway");
        return "Error: " + data.error;
    }

    var chain = sortPinsIntoChain(data.pins);

    app.beginUndoGroup("OpenSway: Apply Sway");

    try {
        var ctrlName = createUniqueName(data.comp, CONFIG.controlPrefix + "Control");
        var ctrlLayer = createControlLayer(data.comp, ctrlName, params);

        for (var i = 0; i < chain.length; i++) {
            var pin = chain[i];
            var restPos = pin.position;

            var expr = generateProceduralExpression(ctrlName, i, restPos);
            pin.property.expression = expr;
        }

        app.endUndoGroup();
        return "Applied to " + chain.length + " pins";

    } catch (e) {
        app.endUndoGroup();
        return "Error: " + e.toString();
    }
}

function removeSway() {
    var data = getPuppetPinsFromSelection();
    if (data.error) {
        alert(data.error, "OpenSway");
        return "Error: " + data.error;
    }

    app.beginUndoGroup("OpenSway: Remove Sway");

    try {
        var count = 0;
        for (var i = 0; i < data.pins.length; i++) {
            var pin = data.pins[i];
            if (pin.property.expression !== "") {
                pin.property.expression = "";
                count++;
            }
        }
        app.endUndoGroup();
        return "Removed from " + count + " pins";
    } catch (e) {
        app.endUndoGroup();
        return "Error: " + e.toString();
    }
}

// Get all puppet pins from selected layer (for UI listing)
function getAllPuppetPins() {
    var comp = getActiveComp();
    if (!comp) return JSON.stringify({ error: "Please select a composition." });

    var selectedLayers = comp.selectedLayers;
    if (selectedLayers.length === 0) {
        return JSON.stringify({ error: "Please select a layer with puppet pins." });
    }

    var layer = selectedLayers[0];
    var effects = layer.property("ADBE Effect Parade");
    if (!effects) return JSON.stringify({ error: "No effects found on layer." });

    var puppetEffect = null;
    for (var i = 1; i <= effects.numProperties; i++) {
        var effect = effects.property(i);
        if (effect.matchName === "ADBE FreePin3") {
            puppetEffect = effect;
            break;
        }
    }

    if (!puppetEffect) {
        return JSON.stringify({ error: "No Puppet effect found." });
    }

    var mesh = puppetEffect.property("ADBE FreePin3 ARAP Group");
    if (!mesh) return JSON.stringify({ error: "No puppet mesh found." });

    var pins = [];
    for (var i = 1; i <= mesh.numProperties; i++) {
        var subGroup = mesh.property(i);
        if (subGroup.matchName === "ADBE FreePin3 PosPin Group") {
            for (var j = 1; j <= subGroup.numProperties; j++) {
                var pin = subGroup.property(j);
                if (pin.matchName === "ADBE FreePin3 PosPin Atom") {
                    var posProp = pin.property("ADBE FreePin3 PosPin Position");
                    if (posProp) {
                        pins.push({
                            name: pin.name,
                            position: posProp.value
                        });
                    }
                }
            }
        }
    }

    if (pins.length === 0) {
        return JSON.stringify({ error: "No puppet pins found." });
    }

    return JSON.stringify({ pins: pins, layerName: layer.name });
}

// Apply sway with user-defined pin order
function applySwayWithOrder(paramsJSON) {
    var params;
    try {
        params = (typeof paramsJSON === 'string') ? JSON.parse(paramsJSON) : paramsJSON;
    } catch (e) {
        return "Error: Invalid parameters";
    }

    var pinOrder = params.pinOrder; // Array of pin names in order
    if (!pinOrder || pinOrder.length < 2) {
        alert("Please set at least 2 pins in the chain order.", "OpenSway");
        return "Error: Need at least 2 pins";
    }

    var comp = getActiveComp();
    if (!comp) {
        alert("Please select a composition.", "OpenSway");
        return "Error: No composition";
    }

    var selectedLayers = comp.selectedLayers;
    if (selectedLayers.length === 0) {
        alert("Please select a layer with puppet pins.", "OpenSway");
        return "Error: No layer selected";
    }

    var layer = selectedLayers[0];
    var effects = layer.property("ADBE Effect Parade");
    if (!effects) return "Error: No effects";

    var puppetEffect = null;
    for (var i = 1; i <= effects.numProperties; i++) {
        var effect = effects.property(i);
        if (effect.matchName === "ADBE FreePin3") {
            puppetEffect = effect;
            break;
        }
    }

    if (!puppetEffect) return "Error: No Puppet effect";

    var mesh = puppetEffect.property("ADBE FreePin3 ARAP Group");
    if (!mesh) return "Error: No mesh";

    // Build pin map
    var pinMap = {};
    for (var i = 1; i <= mesh.numProperties; i++) {
        var subGroup = mesh.property(i);
        if (subGroup.matchName === "ADBE FreePin3 PosPin Group") {
            for (var j = 1; j <= subGroup.numProperties; j++) {
                var pin = subGroup.property(j);
                if (pin.matchName === "ADBE FreePin3 PosPin Atom") {
                    var posProp = pin.property("ADBE FreePin3 PosPin Position");
                    if (posProp) {
                        pinMap[pin.name] = {
                            property: posProp,
                            pinGroup: pin,
                            position: posProp.value,
                            name: pin.name
                        };
                    }
                }
            }
        }
    }

    // Build chain in user-specified order
    var chain = [];
    for (var i = 0; i < pinOrder.length; i++) {
        var pinName = pinOrder[i];
        if (pinMap[pinName]) {
            chain.push(pinMap[pinName]);
        }
    }

    if (chain.length < 2) {
        alert("Could not find specified pins.", "OpenSway");
        return "Error: Pins not found";
    }

    app.beginUndoGroup("OpenSway: Apply Sway");

    try {
        var ctrlName = createUniqueName(comp, CONFIG.controlPrefix + "Control");
        var ctrlLayer = createControlLayer(comp, ctrlName, params);

        for (var i = 0; i < chain.length; i++) {
            var pin = chain[i];
            var restPos = pin.position;

            var expr = generateProceduralExpression(ctrlName, i, restPos);
            pin.property.expression = expr;
        }

        app.endUndoGroup();
        return "Applied to " + chain.length + " pins";

    } catch (e) {
        app.endUndoGroup();
        return "Error: " + e.toString();
    }
}

function bakeToKeyframesFromPanel() {
    var data = getPuppetPinsFromSelection();
    if (data.error) {
        alert(data.error, "OpenSway");
        return "Error: " + data.error;
    }

    var comp = data.comp;

    app.beginUndoGroup("OpenSway: Bake to Keyframes");

    try {
        var frameRate = comp.frameRate;
        var frameDur = 1 / frameRate;
        var startTime = 0;
        var endTime = comp.duration;

        for (var i = 0; i < data.pins.length; i++) {
            var pin = data.pins[i];
            var prop = pin.property;

            if (prop.expression === "") continue;

            var samples = [];
            for (var t = startTime; t <= endTime; t += frameDur) {
                samples.push({
                    time: t,
                    value: prop.valueAtTime(t, false)
                });
            }

            prop.expression = "";

            for (var j = 0; j < samples.length; j++) {
                prop.setValueAtTime(samples[j].time, samples[j].value);
            }
        }

        app.endUndoGroup();
        return "Baked " + data.pins.length + " pins";
    } catch (e) {
        app.endUndoGroup();
        return "Error: " + e.toString();
    }
}
