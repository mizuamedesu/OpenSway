/**
 * OpenSway - Host Script (ExtendScript for After Effects)
 * @version 1.0.0
 */

// ============================================================
// Configuration
// ============================================================

var CONFIG = {
    controlPrefix: "OpenSway_",
    maxPhysicsFrames: 500
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

    var rootIndex = 0;
    var rootY = pins[0].position[1];
    var rootX = pins[0].position[0];

    for (var i = 1; i < pins.length; i++) {
        var pos = pins[i].position;
        if (pos[1] < rootY - 10) {
            rootY = pos[1];
            rootX = pos[0];
            rootIndex = i;
        } else if (Math.abs(pos[1] - rootY) < 10 && pos[0] < rootX) {
            rootX = pos[0];
            rootIndex = i;
        }
    }

    var chain = [pins[rootIndex]];
    var remaining = [];
    for (var i = 0; i < pins.length; i++) {
        if (i !== rootIndex) remaining.push(pins[i]);
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
    addSlider("Physics Blend", params.physicsBlend || 0);
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
        'var chainMult = 1 + chainIndex * 0.3;',
        '',
        'var decayMult = 1;',
        'if (decayStart > 0 && time > decayStart) {',
        '    var elapsed = time - decayStart;',
        '    decayMult = Math.max(0, 1 - elapsed / Math.max(0.001, decayDur));',
        '    decayMult = decayMult * decayMult * (3 - 2 * decayMult);',
        '}',
        '',
        'var offsetX = motionX * amp * chainMult * decayMult;',
        'var offsetY = motionY * amp * chainMult * decayMult;',
        '',
        'value + [offsetX, offsetY];',
        '}'
    ];
    return expr.join('\n');
}

function generatePhysicsExpression(controlLayerName, chainIndex, restPos, parentPinPath, restLength) {
    var expr = [
        '// OpenSway Physics Mode (Verlet Integration)',
        'var ctrl = thisComp.layer("' + controlLayerName + '");',
        'var enabled = ctrl.effect("Enabled")(1);',
        'if (enabled == 0) { value; } else {',
        '',
        'var stiffness = ctrl.effect("Stiffness")(1) / 100;',
        'var damping = ctrl.effect("Damping")(1) / 100;',
        'var gravity = ctrl.effect("Gravity")(1);',
        'var decayStart = ctrl.effect("Decay Start")(1);',
        'var decayDur = ctrl.effect("Decay Duration")(1);',
        '',
        'var chainIndex = ' + chainIndex + ';',
        'var restLength = ' + restLength + ';',
        'var restPos = ' + JSON.stringify(restPos) + ';',
        '',
        'var dt = thisComp.frameDuration;',
        'var k = stiffness * 0.5;',
        'var d = 1 - damping * 0.05;',
        '',
        parentPinPath ? 'var parentPos = ' + parentPinPath + ';' : 'var parentPos = restPos;',
        '',
        'var pos = restPos;',
        'var prevPos = restPos;',
        'var startFrame = 0;',
        'var currentFrame = Math.floor(time / dt);',
        'var maxIter = Math.min(currentFrame - startFrame, ' + CONFIG.maxPhysicsFrames + ');',
        '',
        'for (var i = 0; i < maxIter; i++) {',
        '    var targetPos = parentPos;',
        '    var springForce = [(targetPos[0] - pos[0]) * k, (targetPos[1] - pos[1]) * k];',
        '    var gravityForce = [0, gravity * 0.1];',
        '    var accX = springForce[0] + gravityForce[0];',
        '    var accY = springForce[1] + gravityForce[1];',
        '    var velX = (pos[0] - prevPos[0]) * d;',
        '    var velY = (pos[1] - prevPos[1]) * d;',
        '    var newX = pos[0] + velX + accX * dt * dt;',
        '    var newY = pos[1] + velY + accY * dt * dt;',
        '    var toParentX = newX - parentPos[0];',
        '    var toParentY = newY - parentPos[1];',
        '    var dist = Math.sqrt(toParentX * toParentX + toParentY * toParentY);',
        '    if (dist > restLength * 1.5) {',
        '        var scale = restLength * 1.5 / dist;',
        '        newX = parentPos[0] + toParentX * scale;',
        '        newY = parentPos[1] + toParentY * scale;',
        '    }',
        '    prevPos = pos;',
        '    pos = [newX, newY];',
        '}',
        '',
        'var decayMult = 1;',
        'if (decayStart > 0 && time > decayStart) {',
        '    var elapsed = time - decayStart;',
        '    decayMult = Math.max(0, 1 - elapsed / Math.max(0.001, decayDur));',
        '}',
        '',
        'var finalX = restPos[0] + (pos[0] - restPos[0]) * decayMult;',
        'var finalY = restPos[1] + (pos[1] - restPos[1]) * decayMult;',
        '',
        '[finalX, finalY];',
        '}'
    ];
    return expr.join('\n');
}

function generateHybridExpression(controlLayerName, chainIndex, restPos, parentPinPath, restLength) {
    var expr = [
        '// OpenSway Hybrid Mode',
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
        'var stiffness = ctrl.effect("Stiffness")(1) / 100;',
        'var damping = ctrl.effect("Damping")(1) / 100;',
        'var gravity = ctrl.effect("Gravity")(1);',
        'var blend = ctrl.effect("Physics Blend")(1) / 100;',
        'var decayStart = ctrl.effect("Decay Start")(1);',
        'var decayDur = ctrl.effect("Decay Duration")(1);',
        '',
        'var chainIndex = ' + chainIndex + ';',
        'var restPos = ' + JSON.stringify(restPos) + ';',
        'var restLength = ' + restLength + ';',
        'var t = time - chainIndex * chainDelay;',
        '',
        '// Procedural',
        'var sineX = Math.sin(t * freq * Math.PI * 2 + phase);',
        'var sineY = Math.sin(t * freq * Math.PI * 2 + phase + Math.PI / 4) * 0.3;',
        'var seed = chainIndex * 1000;',
        'var noiseX = noise([t * noiseScale, seed]) * 2 - 1;',
        'var noiseY = noise([t * noiseScale + 100, seed]) * 2 - 1;',
        'var motionX = sineX * (1 - noiseAmt) + noiseX * noiseAmt;',
        'var motionY = sineY * (1 - noiseAmt) + noiseY * noiseAmt * 0.5;',
        'var chainMult = 1 + chainIndex * 0.3;',
        'var procX = value[0] + motionX * amp * chainMult;',
        'var procY = value[1] + motionY * amp * chainMult;',
        '',
        '// Physics',
        'var dt = thisComp.frameDuration;',
        'var k = stiffness * 0.5;',
        'var d = 1 - damping * 0.05;',
        parentPinPath ? 'var parentPos = ' + parentPinPath + ';' : 'var parentPos = restPos;',
        '',
        'var pos = restPos;',
        'var prevPos = restPos;',
        'var currentFrame = Math.floor(time / dt);',
        'var maxIter = Math.min(currentFrame, ' + CONFIG.maxPhysicsFrames + ');',
        '',
        'for (var i = 0; i < maxIter; i++) {',
        '    var springForce = [(parentPos[0] - pos[0]) * k, (parentPos[1] - pos[1]) * k];',
        '    var velX = (pos[0] - prevPos[0]) * d;',
        '    var velY = (pos[1] - prevPos[1]) * d;',
        '    var newX = pos[0] + velX + springForce[0] * dt * dt + gravity * 0.01 * dt * dt;',
        '    var newY = pos[1] + velY + springForce[1] * dt * dt;',
        '    prevPos = pos;',
        '    pos = [newX, newY];',
        '}',
        'var physX = pos[0];',
        'var physY = pos[1];',
        '',
        '// Blend',
        'var finalX = procX * (1 - blend) + physX * blend;',
        'var finalY = procY * (1 - blend) + physY * blend;',
        '',
        'var decayMult = 1;',
        'if (decayStart > 0 && time > decayStart) {',
        '    var elapsed = time - decayStart;',
        '    decayMult = Math.max(0, 1 - elapsed / Math.max(0.001, decayDur));',
        '}',
        '',
        'var outX = value[0] + (finalX - value[0]) * decayMult;',
        'var outY = value[1] + (finalY - value[1]) * decayMult;',
        '[outX, outY];',
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
    var mode = params.mode || "procedural";

    app.beginUndoGroup("OpenSway: Apply Sway");

    try {
        var ctrlName = createUniqueName(data.comp, CONFIG.controlPrefix + "Control");
        var ctrlLayer = createControlLayer(data.comp, ctrlName, params);

        for (var i = 0; i < chain.length; i++) {
            var pin = chain[i];
            var restPos = pin.position;
            var restLength = 50;
            var parentPinPath = null;

            if (i > 0) {
                var parentPin = chain[i - 1];
                restLength = distance2D(restPos, parentPin.position);
                parentPinPath = 'thisProperty.propertyGroup(2).property("' + parentPin.name + '").property("Position")';
            }

            var expr;
            if (mode === "physics") {
                expr = generatePhysicsExpression(ctrlName, i, restPos, parentPinPath, restLength);
            } else if (mode === "hybrid") {
                expr = generateHybridExpression(ctrlName, i, restPos, parentPinPath, restLength);
            } else {
                expr = generateProceduralExpression(ctrlName, i, restPos);
            }

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
