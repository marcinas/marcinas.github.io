/**
 * Emergence Simulation System
 * @author Marceline Peters / https://github.com/marcinas
 * see readme for additional credits
 */



/**************************************************************/
/**************************************************************/
/*******************  WINDOW,KEYBOARD,MOUSE *******************/
/**************************************************************/
/**************************************************************/

/** stores non-camera keys that user can use to interact with simulation */
var keys = { PERIOD: 46, COMMA: 44, SEMICOLON: 59, QUOTE: 39, LEFT_BRACE: 91, RIGHT_BRACE: 93, BACKSLASH: 92 };
var actions = { PAUSE: keys.LEFT_BRACE, STEP: keys.RIGHT_BRACE, SCREENSHOT: keys.BACKSLASH }

/**
 * Reloads the simulation after setting the hash, which adds numbers to the url so that some
 * simulation wide reload settings can be carried over into a clean simulation.
 *
 * @return {boolean} false to show there was no error
 */
function reloadSimulation()
{   //memory reference
    var constant = emergence.controls.constant;

    //sets hash information for reload; decoded with getHashInformation()
    location.hash = constant.maximum + "#" +
                    (constant.modes | "0") +
                    (constant.debugInit ? "1" : "0");
    location.reload(); //F5
    return false;
}

/**
 * When the simulation is reloaded, the hash URL gets reloaded with information on how to
 * set up the simulation post-reload. For now, this includes the maximum number of particles
 * able to be displayed (which is used in all setup information for the simulation), whether
 * to show debug information during startup, and whether to put the simulation through a
 * stress test (see controls for more info, but should be about 30fps).
 *
 * @return {int[]}  a list containing extracted hash values
 */
function getHashInformation()
{   //local variables
    var hash = document.location.hash.substr(1);
    var settings = [0]; //needs default 0 for particle count
    var h = 0;

    do settings.push(parseInt(hash.substr(hash.length-++h,1), 0));
    while (!isNaN(settings[settings.length-1])); //append single-digit numbers until NaN encountered

    settings.splice(settings.length-1);
    hash = hash.substring(0, hash.length - h); //string hash of already processed numbers
    if (hash) settings[0] = parseInt(hash, 0);
    return settings;
}

/**
 * For the given camera, returns the camera constant, which is the height of the window
 * divided by the relationship of the field of view to the zoom level.
 *
 * @param {PerspectiveCamera} camera    the camera to check the constant of
 *
 * @return {float} a real number representing the camera constant at the calling time of function
 */
function getCameraConstant(camera)
{
    return window.innerHeight /
            (Math.tan(THREE.Math.DEG2RAD * 0.5 * camera.fov) / camera.zoom);
}

/**
 * Associates functions for simulation-window interaction.
 */
function setupWindow()
{
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keypress', onKeyPress, false);
    window.addEventListener('mousedown', onMouseDown, false);
    window.onbeforeunload = onWindowClose; //don't close yet!
}

/**
 * Activates when the user requests window closure to confirm their choice using the default
 * browser confirmation dialogue.
 *
 * @param {Event} [event] is the window closing event.
 *
 * @return {boolean} whether the user selected to close the window or not
 */
function onWindowClose(event)
{
    event = event || window.event;
    if (event) event.returnValue = '?'; //just needs a string
    return event.returnValue || confirm(); //get answer from user
}

/**
 * Whenever the window is resized or the perspective changed (see controls->visual->camera), the
 * camera and renderer are adjusted according to the new parameters.
 */
function onWindowResize()
{   //memory reference
    var camera = emergence.controls.visual.camera;

    //local variables
    var height = camera.customWindowRender ? camera.height : window.innerHeight;
    var width = camera.customWindowRender ? camera.width : window.innerWidth;

    if (camera.allowWindowRender) {
        emergence.camera.aspect = width / height;
        emergence.camera.updateProjectionMatrix();
        emergence.renderer.setSize(width, height);
    //    emergence.renderer.setPixelRatio(window.devicePixelRatio);
    }
}

/**
 * Detects what key has been pressed by the user and performs the appropriate action.
 *
 * @param {Event} event    the key press event
 */
function onKeyPress(event)
{
    if (DEBUG) debug(["system","interaction"],["key:",event.keyCode]);

    switch (event.keyCode) {

        case actions.PAUSE: //pause simulation
            emergence.controls.animate = !emergence.controls.animate;
            break;

        case actions.STEP: //step 1 tick forward in simulation
            emergence.controls.animate = false;
            emergence.controls.step = true;
            break;

        case actions.SCREENSHOT:
            takeScreenshot();
            break;

        default: break;
    }
}


/**
 * Detects clicking and double clicking; when the user double-clicks anywhere on the simulation
 * screen, a ray is cast from the user camera origin towards and through the area in space
 * represented by the clicked pixel. Raycasting collision is used (via intersectObject(...)) to
 * gather intersected particles--the closest one whose physical boundary overlaps is the
 * clicked particle. (Physical, not visual boundary, as the user can change the visual appearance
 * of monad boundary irrespective of its physical boundary, which is an equation to
 * find the radius from deriving the monad's mass/density relation to spherical volume.)
 * The clicked particle (if any) now has their object information and the raycaster's intersections
 * printed to console, gets surrounded by a transparent box that follows the monad around, and
 * becomes the focused debug particle (these settings are by default and can be changed by the
 * user via controls).
 *
 * @param {Event}  event     the action event detailing when, where, and how the mouse clicked
 */
function onMouseDown(event)
{   //no pre-loading memory references as this is a non-constantly evoked function
    if (DEBUG) debug(["system","interaction"],["mouse:",event.which]);

    if (event.which === 1 && !emergence.click) { //check for left button click counted as single-click
        emergence.click = Math.ceil(emergence.stats.time.fps/3); //user has 1/3 second to click a second time and have it count as a double-click
        return;
    } else if (event.which != 2 && !(event.which === 1 && emergence.click)) //check for middle button click or left button double-click
        return;

    emergence.click = 0; //reset future clicks to single-clicks (i.e., no triple clicks or double-double-clicks)

    var visual = emergence.controls.visual;
    var monads = emergence.monads;
    var scene = emergence.scene;
    var particle = emergence.controls.debug.particle;
    var wireframe = emergence.wireframe;
    var raycaster = new THREE.Raycaster();

    raycaster.setFromCamera(new THREE.Vector2(( event.clientX / emergence.renderer.domElement.width ) * 2    - 1,
                                            - ( event.clientY / emergence.renderer.domElement.height ) * 2   + 1),
                            emergence.camera); //point ray from camera origin to clicked pixel and onward
    raycaster.params.Points.threshold = 100;

    var intersects = raycaster.intersectObject(emergence.cloud); //nice library function to test for intersects
    var closest = Infinity;
    var clicked = -1;
    var intersection = index = radius = -1;
    var monad = null;
    var color = null;

    for (var i = 0;    i < intersects.length;    i++) { //check all intercepted particles
        index = intersects[i].index;
        radius = Math.pow(monads[index].quanta.radius,visual.cloud.sizeExp); //because it's the user's perception, not actual size
        if (intersects[i].distanceToRay < radius    &&    intersects[i].distance - radius < closest) { //check for physical boundary overlap and closest to camera
            closest = intersects[i].distance - radius;
            clicked = index;
            intersection = i;
        }
    }

    if (clicked >= 0) { //a particle whose physical boundary overlaps with the ray was found
        color = wireframe[0].material.color;
        monad = monads[clicked];
        monad.setColor(color.r,color.g,color.b); //change color of monad to wireframe
        monad.quanta.countdown = 16;
        if (visual.display.clickBox) { //create position box
            emergence.initializeCube(monad.quanta.radius*2,
                                     monad.position,
                                     clicked);
            for (var w = wireframe.length-4; w < wireframe.length; w++) //add wireframes
                scene.add(wireframe[w]);
        }
        particle.index = clicked;
        if (visual.display.clickInfo) debug("always", [intersects[intersection],monads[clicked]]);
    }

    var length = clicked >= 0 ? intersects[intersection].distance * 2 : emergence.zones.size * 3; //so midpoint is on particle if clicked
    var startpoint = new THREE.Vector3(raycaster.ray.origin.x,
                                       raycaster.ray.origin.y,
                                       raycaster.ray.origin.z);
    var endpoint = new THREE.Vector3(raycaster.ray.direction.x * length,
                                     raycaster.ray.direction.y * length,
                                     raycaster.ray.direction.z * length);

    endpoint.add(startpoint);

    if (visual.display.clickRay) { //display visuals for raycaster
        var ray = new THREE.Geometry(); //the ray itself at time of click
        ray.vertices.push(startpoint);
        ray.vertices.push(endpoint);
        ray.colors.push(clicked >= 0 ? new THREE.Color(0.0, 1.0, 1.0) : new THREE.Color(0.5, 0.5, 0.5));
        ray.colors.push(new THREE.Color(visual.backgroundColor));
        scene.add(new THREE.Line(ray,
            new THREE.LineBasicMaterial({
                vertexColors: THREE.VertexColors,
            })
        ));

        var pointTexture = new THREE.Texture(point);
        pointTexture.needsUpdate = true;

        var origin = new THREE.Geometry(); //a ball end-point representing user camera at time of click
        origin.vertices.push(startpoint);
        origin.colors.push(new THREE.Color(0.5,0.5,0.5));
        scene.add(new THREE.Points(origin,
                new THREE.PointsMaterial({
                vertexColors: THREE.VertexColors,
                size: Math.max(1, emergence.zones.size * (1/25)),
                map: pointTexture,
                alphaTest: 0.5
            })
        ));
    }
}

/**
 * For taking screenshots (not currently utilized).
 */
function takeScreenshot()
{
    /* Method One */
    ////var dom = statistics.monitor.domElement;
    // var dom = emergence.renderer.domElement;
    // var x = dom.toDataURL("image/png");
    // var link = document.createElement("a"); //leave as a! otherwise it won't download
    // link.download = "name" + new Date().getTime() + ".png";
    // link.href = x;
    // document.body.appendChild(link);
    // link.click();
    // document.body.removeChild(link);

    /* Method Two */
    // var gl = emergence.renderer.context;
    // console.log(emergence.renderer);
    // var width = gl.drawingBufferWidth;
    // var height = gl.drawingBufferHeight;
    // var buffer = new ArrayBuffer(width * height * 4);
    // var pixels = new Uint8Array(buffer);
    // gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    //
    // var blob = new Blob([buffer], {type: 'data:image'});
    // console.log(blob);
    // var image = new Image();
    // image.src = URL.createObjectURL(blob);
    // var url = image.src.replace(/^data:image\/[^;]/, 'data:application/octet-stream');
    // console.log(url);
    // statistics.animate = false;
    // location.href = image.src;
    // window.open(url);
    //
    // location.href = image;
    //
    // console.log(gl);
    // var i = [];
    // for (var ii = 0; ii < 256; ii++) i[ii] = 0;
    // for (var p = 0; p < pixels.length; p++) {
    // 	i[pixels[p]]++;
    // }
    // console.log(pixels);
    // console.log(i);
}

/**
 * Ultimate debug function that takes in two arguments that can be strings or lists of strings--
 * the first must detail where in emergence.controls.debug the permission is to be found; the
 * second is the arg(s) that are to be printed should the appropriate permission be true.
 *
 * @param {string|string[]} allow     the permission parameters to check before printing
 * @param {string|Object|Object[]} args      what to print if the parameters allow it
 */
function debug(allow,args)
{   //local variables
    var spacing = new Array(16).join(' ');
    var allowed = false;

    if (allow.constructor.name === "Array") { //get boolean: allowed or not
        allowed = emergence.controls.debug[allow[0]][allow[1]];
    } else allowed = emergence.controls.debug[allow];

    if (allowed) {
        try {
            if (args.constructor.name === "String") console.log(args);
            else throw new Error(); //this is not a string, try printing it otherwise
        } catch(e) {
            for (var a = 0; a < (args.length || 1); a++) { //assume array of some sort
                var arg = args[a] != 0 ? (args[a] || (args.length ? undefined : args)) : 0;
                var name = arg || arg === 0 ? arg.constructor.name : 'NO VALUE';
                console.log( //attempt to print appropriate output based on type
                    (name === "String" ?
                        ''
                        : ('\t' + name + (name === "Array" ?
                            (': ' +
                                (arg.length ?
                                    arg[0].constructor.name
                                    : "EMPTY"))
                            : '') + spacing).slice(0, spacing.length)
                    ),
                    arg
                );
            }
        }
        console.log('\n\n');
    }
};



/**************************************************************/
/**************************************************************/
/*******************  CODE SAVING FUNCTIONS	*******************/
/**************************************************************/
/**************************************************************/

/**
 * Returns true or false with uniform randomness.
 *
 * @return {boolean} true or false
 */
function randBool()
{
    return Math.random() < 0.5;
}

/**
 * Returns the minimum value of two numbers after both's absolute (non-negative) value is compared.
 *
 * @param {float} a the first number to compare
 * @param {float} b the second number to compare
 *
 * @return {float} returns a or b (non absolute value), whichever's absolute value is smallest
 */
function absMin(a,b)
{
    if (Math.abs(a) < Math.abs(b)) return a; else return b;
}

/**
 * Returns real number representing log base b of a. Currently no error checking for silly values
 * to save commands.
 *
 * @param {float} a      the argument of the logarithm
 * @param {float} b      the base of the logarithm
 *
 * @return {float} log base b of a
 */
function log(b, a)
{
    return Math.log(a) /
            Math.log(b);
}

/**
 * Gives the radius of a perfect sphere given the sphere's mass and density.
 *
 * With default density (0.238), here are the approximate quanta within one monad for a given radius:
 * Mass     Radius(a bit >)
 * 1        1
 * 8        2
 * 32       3
 * 64       4
 * 125      5
 * 1000     10
 * 3400     15
 * 8000     20
 * 27000    30
 * 64000    40
 * 125000   50
 * 420000   75
 * 1000000  100
 *
 * @param {float} mass      f>=0    number representing the mass of the sphere
 * @param {float} density   f>0     density of the sphere
 *
 * @return {float} the radius of a sphere as determined by mass and density
 */
function radiusSphere(mass, density)
{
    return  Math.pow(
                (3.0 /
                    (4.0 * Math.PI)
                ) * (mass /
                    density
                ),
            1.0 /
            3.0);
}

/**
 * Simple version of the gauss function. Returns a random gaussian value for a standard bell curve.
 *
 * @param {float} med   the median value, 0 standard deviations
 * @param {float} std   the standard deviation value for 1 standard deviation (68.2%)
 *
 * @return {float}      a gaussian-distributed random number restricted by given parameters
 */
function randGaussSimple(med,std)
{
    var ran = Math.sqrt(-2.0 * Math.log(1 - Math.random()))    *    Math.cos(2.0 * Math.PI * (1 - Math.random()));// formula: Box–Muller_transform
    return med + std * ran;
}

/**
 * A gaussian random number function that uses Box-Muller transform to generate a numbers given
 * a parameter list. The gaussian number function can act as a regular standard deviation calculator
 * with the following arguments: (-Infinity,Infinity,0,1,1,0); this will result in ~68.2% of values
 * in the range [-1,1], ~95.4% of values in the range [-2,2] and ~99.7% of values in the range [-3,3].
 * The additional parameters of exp and inv allow narrowing or widening exponentially the range of
 * values (or drasticness of the drop-off of the bell curve) and splitting of the bell curve into
 * two separate ranges respectively.
 *
 * @param {float} min   the minimum value allowable--numbers below this range will be set to min
 * @param {float} med   the median value, 0 standard deviations
 * @param {float} max   the maximum value allowable--numbers above this range will be set to max
 * @param {float} std   the standard deviation value for 1 standard deviation (68.2%)
 * @param {float} exp   exponent which can narrow or widen the bell curve or average range of values
 * @param {float} [inv]   [0,1] range value of uniform chance to invert random value
 *                      (makes a right-tailed and left-tailed curve at high values)
 * @param {int}   [sign]  if defined, the standard deviation will have the same +/- as sign
 *
 * @return {float}      a gaussian-distributed random number restricted by given parameters
 */
function randGauss(min, med, max, std, exp, inv, sign)
{   //local variables
    var random = Math.random;
    var ran = (sign ? sign/Math.abs(sign) : (randBool() ? -1 : 1)) * //positive or negative randomly unless sign is defined
                Math.pow(
                    Math.sqrt(
                        -2.0 * Math.log(1 - random())
                    ) * Math.cos(
                        2.0 * Math.PI * (1 - random())
                    ),
                exp); // formula: Box–Muller transform

    var val = med       +      std * (random() < inv ? 1/ran : ran ); // median plus (1 standard deviation times random number)
    return Math.min(max, Math.max(min, val)); //don't exceed max or min
}

/**
 * Returns the current date in "UNIX_epoch (yyyy/mm/dd hh:mm.ms)" format.
 *
 * @return {string} of the date in milliseconds since 1970/1/1 and regular Julian form.
 */
function date()
{   //setup Date
	var date = new Date();
	return date.getTime() + " (" +
                date.getFullYear() + "/" + date.getMonth() + "/" + date.getDate() + " " +
                date.getHours() + ":" + date.getMinutes() + "." + date.getMilliseconds() +
            ")";
}
