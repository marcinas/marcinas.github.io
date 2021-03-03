/**
 * Emergence Simulation System
 * @author Marceline Peters / https://github.com/marcinas
 * see readme for additional credits
 */



/**************************************************************/
/**************************************************************/
/************************		EMERGENCE		***********************/
/**************************************************************/
/**************************************************************/

/**
 * Emergence system constructor that contains all of the information necessary to run and visualize
 * simulation. The emergence object is responsible for instantiating and delegating tasks to most
 * other objects. It consists of and most directly interfaces with statistics, controls, zones,
 * and monad. Specifically, it is responsible for setting up each new simulation, creating monads
 * matching control parameters, passing on the correct values to statistics, calling zones functions
 * for collision, handling wireframes, rendering and camera information, and cycling through all of
 * the monads for processing each tick. It is set up in a such a way that an external program need
 * only create and pass a statistics object to emergence for it to work. The initialization function
 * specifically automatically appends to html document, declares rendering objects (see ../js), and
 * sets up the control scheme. Setup() must still be called for the emergence object to begin.
 *
 * Each simulation has an id for tracking--the first 8 digits represent a randomized number that
 * increments by 1 every simulation reset, and the second 8 digits which start a counter at 0
 * and increment every time the simulation is altered dynamically during runtime.
 *
 * @param {Statistics} statistics    a fully instantiated statistics.js object for use of reporting data
 */
function Emergence(statistics)
{
    /** The container object for the html page */
    this.container = document.createElement('div');
    this.container.style.cssText = "position:fixed;top:0;left:0";
    document.body.appendChild(this.container);

    /** Statistics memory reference */
    this.stats = statistics;
    this.stats.simulation = this;//must be set externally
    /** Indicator for whether to switch at the beginning of each run to alternative color scheme */
    this.colorChange = false;
    /** Placeholder for the camera object, which allows you to see all the pretty monads I made */
    this.camera = null;
    /** Placeholder for renderer, which displays the screen and everything in the simulation */
    this.renderer = null;
    /** Placeholder for the orbit controls object, which allows the camera to be moved by the user */
    this.director = null;
    /** Placeholder for the collection of three dimensional objects including monads and wireframes */
    this.scene = null;
    /** Placeholder for points object which holds the graphical information for all monads */
    this.cloud = null;
    /** Placeholder for the zones object which act as time-saving containers for monad collision */
    this.zones = null;
    /** Placeholder for the controls object, which parametrizes the system and controls behaviors */
    this.controls = null;

    /** Placeholder for the monads array, which holds memory references to all the monads */
    this.monads = [];
    /** Array to hold the world boundary wireframe as well as any user-generated particle boxes */
    this.wireframe = [];
    /** Parallel array to the wireframe array to contain the indexes */
    this.focus = [];
    /** The maximum amount of particles that can be displayed (will be set permanently later) */
    this.MAX = 0;
    /** How long to run the simulation before restarting (0 means forever) */
    this.runtime = 0;
    /** The amount of time left for a user to double-click (set externally--see basic.js) */
    this.click = 0;
    /** The number of particles the simulation should start with */
    this.initial = 0;
    /** Whether the simulation should worry about particle rendering limits from emission (see controls.js) */
    this.enforce = false;

    /** The range of ids possible (actually just the first half) */
    this.idRange = 100000000;//arbitrary--for spacing with current font settings
    /** The id itself, a 16-digit number comprised of the randomized simulation id (the first 8 digits) and
     * the settings id (the second 8 digits) which start at 00000000 and increment one for every dynamic change */
    this.id = Math.floor(Math.random()*this.idRange)*this.idRange;
}

/**
 * Initializes the system visuals (camera, webgl, etc.) and starts the simulation using the
 * restart function. Debugging info also run just once for startup if enabled. This function
 * only needs to be called once after the emergence object is instantiated; after that, only
 * restart must be called.
 */
Emergence.prototype.startup = function()
{   //fill in placeholder values
    this.controls = new Controls(this);//debugInit activates here
    this.MAX = this.controls.constant.maximum;//must be set after controls are instantiated
    this.monads = new Array(this.MAX).fill(null);//must also be set after controls; null because monads must be instantiated each with different parameters

    debug("always","Emergence Simulation System System\n\tversion " + VERSION.CURRENT_VERSION + " at " + date() + "\nby Marceline Peters (https://github.com/marcinas)");
    debug("startup",['THREE.WebGLRenderer 84',emergence.controls.hash,emergence]);//only try if debugInit set

    var debugging = this.controls.debug;
    if (debugging.startup) debugging.system.initialization = true; //set debug in controls as well

    this.restartSimulation();//start 'er up
    this.initializeVisuals();

    if (debugging.startup) {//set to false afterwards so same startup scripts don't repeat
        debugging.startup = false;
        debugging.system.initialization = false;
        this.controls.update();
    }
}



/**************************************************************/
/**************************************************************/
/*******************	INITIALIZATION		*******************/
/**************************************************************/
/**************************************************************/

/**
 * Sets up Perspective Camera, WebGLRenderer, and OrbitControls. The camera is set to control
 * default specifications (default aspect 1.77 ratio 16:9) with positioning so the entire toroid
 * is viewed at the same relative distance at the start of the simulation.
 */
Emergence.prototype.initializeVisuals = function()
{   //memory references
    camera = this.controls.visual.camera;
    var height = camera.customWindowRender ? camera.height : window.innerHeight;
    var width = camera.customWindowRender ? camera.width : window.innerWidth;

    //camera setup
    this.camera = new THREE.PerspectiveCamera(60, width / height, 1, Math.pow(this.controls.RENDER,2));
    this.camera.position.x = 0;
    this.camera.position.y = this.zones.size * -1/4;
    this.camera.position.z = this.zones.size * (7/2);

    //renderer setup
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.sortObjects = false;
    this.renderer.setClearColor(0xFFFFFF);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width,height);
    this.container.appendChild(this.renderer.domElement);

    //director setup
    this.director = new THREE.OrbitControls(this.camera,this.renderer.domElement);
    this.director.maxZoom = 10000000;
    this.director.minZoom = -10000000;
    this.camera.rotation.set(-6.558856028509335e-17,0,0,"XYZ");//must be set after director instantiation
}

/**
 * Initializes a cube centered on the given vector with sides of length 2 * radius. The cube
 * can follow a particle if given an index. The cube is set up to use no redundant lines using
 * a grid of corners and adjacent lines to construct four corners with three lines (any two at 90*
 * from the other one) and put them in one cube geometry within a wireframe array index. This means
 * the wireframe array will have one cube for every 4 indices. Colors will follow the
 * controls-selected wireframe colors and change accordingly.
 *
 * The below number schemes indicate how the coords/corner for loop array decides on corners
 *      (see descriptions in code itself for more details)
 * 0 -> 1 3 2           0	-	-	-       4	-	-	+
 * 1 -> 5 7 3           1	+	-	-       5   +   -   +
 * 5 -> 4 6 7           2	-	+	-       6   -   +   +
 * 4 -> 0 2 6           3	+	+	-       7	+	+	+
 *
 * @param {float} radius    the cuboid radius (cube side = radius * 2) or size desired of the cube
 * @param {Vector3} vector  where the center of the cube is to be located
 * @param {int} index       the index of the monads array to follow, or -1 for static
 */
Emergence.prototype.initializeCube = function(radius, vector, index)
{
    var cube = null;
    /** Each of these numbers should be regarded in binary (i.e., 000...111) where their Bitwise
     * and with a binary value of 1,10, or 100 will determine both which corner to pick and
     * what side of the cube that corner is on (e.g., 6 is 110, so dimensions 100/4 and 10/2 will
     * return positive coordinates, and dimension 1/1 will return a negative coordinate). */
    var coords = [ [0, 2], [1, 3], [5, 7], [4, 6] ];

    /** Bitwise and-ing will give either a positive coordinate or negative one; the cube to be
     * designed is thought of having each corner as some combination of (1||-1,1||-1,1||-1)
     * where positives and negatives assume every corner is |1| length in each axis away from
     * cube center, (0,0,0). */
    function corner(coord, dim) {
        return coord & dim ? 1 : -1;
    }

    for (var s = 0; s < 4; s++) { //for each of the four corners
        cube = new THREE.Geometry();
        cube.angle = [];

        for (var p = 0; p < 4; p++) { //for each vertex (center, and then three at right angles along axis)
            //formula: [corner of cube (s) + (0 for p = 1,2; 1 for p = 0,3)] mod 4 for first coords index,
            //          and (0 for p = 0,1; 1 for p = 2,3) for second coords index
            var coord = coords[(s + (p > 0 && p < 3)) % 4][0 + (p > 1)];//select appropriate coord from list
            cube.angle.push({x: corner(coord, 1), y: corner(coord, 2), z: corner(coord, 4)});//combination of 1 and -1
            cube.vertices.push(new THREE.Vector3(radius * cube.angle[p].x, radius * cube.angle[p].y, radius * cube.angle[p].z));//store coordinates for updating box
            cube.vertices[p].add(vector);//shift from center
            cube.colors.push(new THREE.Color(this.controls.visual.wireframeColor));
            if (DEBUG) debug(["system","wirefame"],[((s + (p > 0 && p < 3)) % 4) + "    " + (0 + (p > 1)) + "       " + coord, cube.vertices]);
        }

        //create line object
        this.wireframe.push(new THREE.Line(cube,
            new THREE.LineBasicMaterial({
                vertexColors: THREE.VertexColors
            })
        ));

        this.focus.push(index); //for identifying parent particle

        if (DEBUG) debug(["system","wirefame"],wireframe);
    }
}

/**
 * Initializes all of the particles at the beginning of the simulation. Uses controls set by user
 * to monitor the particles as they are being created and cutoff production as generation settings
 * are met. Connects each particle to its zone and places it into the rendering system via the
 * three.js Points. Calling this function will effectively overwrite all previous monad and rendering
 * data, which allows for an easy restart. Because this function takes time to develop each monad
 * individually as well as each quanta within each monad (via monad's instantiation function),
 * it can take a long time to set up if the mass of the entire system is very large.
 */
Emergence.prototype.initializeParticles = function()
{   //limited pre-loading memory references as this is a non-constantly evoked function
    //memory references
    var monads = this.monads;
    var size = this.zones.size;
    var dist = this.zones.maxdist;
    var generation = this.controls.generation;

    //local variables
    var particles = new THREE.Geometry();
    var monad = null;
    var currentMass = 0;
    var currentParticles = 0;
    var attractons = Math.ceil((generation.particles * generation.mass.median)/2);
    var repulsons = attractons;
    var check = 0;
    var spacing = generation.world.strict ? generation.world.spread : 0;

    //setup consistent emergence values from controls and set initial stats values
    this.enforce = generation.enforceMass;
    this.initial = generation.particles;
    this.stats.maximum.particles = this.MAX;
    this.stats.instant.particles = this.MAX; //this will decrease as monads are generated
    var enforce = this.enforce;

    for (var p = 0; p < this.MAX; p++) { //for each potential particle
        monads[p] = new Monad(particles, this.controls,
                                this.stats, this.zones,
                                [repulsons,attractons,
                                currentParticles === this.initial ? 0 : this.MAX - currentMass]);
        monad = monads[p];

        if (currentParticles < this.initial && currentMass < this.MAX) { //particles and mass can still be placed into system
            currentParticles++;

            if (this.enforce) currentMass += monad.getMass();
            attractons -= monad.quanta.attractons;
            repulsons -= monad.quanta.repulsons;

            if (attractons === 0 && repulsons === 0) { //there are no more enforced quanta to distribute
                if (this.enforce) currentMass = this.MAX;
                else { //reset if not enforced;
                    attractons = Math.ceil((this.initial * generation.mass.median)/2);
                    repulsons = attractons;
                }
            }

            if (spacing) {//space monads equidistantly (up to 2 currently)
                if (p) monad.spaceDistanceTo(monads[0],spacing); //print out console log info
                else debug("always","\n\n\n\n\n\n***************************************************************************\n" +
                                    "***************************************************************************\n" +
                                    "***************************************************************************\n" +
                                    "Simulation " + this.id + "\nRadius: " + size + "    Distance Range: (0, " + (dist/2) + ", " + dist + ")");
                debug("always",monad.toString(monads[0]));
            }
        } else this.zones.addFreeSlot(monad); //monad was generated with no mass, so it is not going to be rendered
    }

    if (currentParticles === 1)//for a single particle, place in center of toroid
        monads[0].position.x = monads[0].position.y = monads[0].position.z = 0.0;

    //get texture
    var loader = new THREE.TextureLoader();
    loader.crossOrigin = '';
    var particleTexture = new THREE.Texture(ball);
    particleTexture.needsUpdate = true;

    //all the monads will be in a points object to speed things up
    this.cloud = new THREE.Points(particles, //rendering material that represents the monads
        new THREE.ShaderMaterial( {
            uniforms: {
                texture: { value: particleTexture }
            },
            shading: THREE.FlatShading,
            vertexColors: THREE.VertexColors,
            fog: false,
            transparent: true,
            vertexShader: document.getElementById( 'vertexShader' ).textContent,//see emergence_simulation.html
            fragmentShader: document.getElementById( 'fragmentShader' ).textContent//see emergence.simulation.html
        })
    );
}



/**************************************************************/
/**************************************************************/
/*******************	   RENDERING    	*******************/
/**************************************************************/
/**************************************************************/

/**
 * Checks every box that is attached to a particle and updates its coordinates so that the box
 * always surrounds its particle.
 */
Emergence.prototype.updateWireframe = function()
{   //memory references
    var monads = this.monads;
    var focus = this.focus;
    var wireframe = this.wireframe;

    //local variables
    var w=0,v=0,foci=0;
    var box = null;
    var pos = null;
    var monad = null;

    for (var w = 4; w < wireframe.length; w++) {//starts at 4 so first (giant) wireframe is not continually unnecessarily updated
        monad = monads[focus[w]];
        pos = monad.position;
        diam = monad.quanta.radius * 2;//particle may have shrunk or grown since last updated
        box = wireframe[w].geometry;
        for (var v = 0; v < box.vertices.length; v++) {//every vertex is reassigned to be positioned relative to center of particle11
            box.vertices[v].x = pos.x + (diam * box.angle[v].x);
            box.vertices[v].y = pos.y + (diam * box.angle[v].y);
            box.vertices[v].z = pos.z + (diam * box.angle[v].z);
            box.verticesNeedUpdate = true;
        }
    }
}

/**
 * The most important function of the simulation--this function runs through, for every particle,
 * all of its updates within a single frame/tick. The process first sets various values based on
 * controls; then, the system checks whether animation (simultaneous with physics calculations)
 * is allowed. If allowed, some statistical data is primed and the loop over all monads begin.
 * Any monads that are non-existent (have blanked out stats, most indicative by a radius of 0)
 * will not be processed and therefore not be rendered. Monads that exist within the system at
 * the current tick will then have their properties pre-processing analyzed^ and stored in data.
 * Then, the monad will check several things, each of which may preclude and prevent processing of
 * the next thing should certain conditions arise.
 *
 * First, monads analyze their countdown variables. For most monads, this is related only to
 * coloring in a way to communicate information to the user about the state of the monad but
 * that has no effect on the simulation proper; however, some countdowns do affect system
 * physics--this is where newly emitted quanta will disable collision on themselves until they
 * have escaped their parent's volume to ensure radiation is consistent with boundary conditions.
 *
 * Next, if applicable, collision is checked for the monad. The zones object handles collision
 * detection is a time-efficient manner. All collisions (considered where the monad has an
 * overlapping boundary with any other monad) will be processed according to the controls set.
 * If a monad is absorbed into a larger monad during collision or otherwise compromised, that
 * monad processes no more information this tick. This is the stage where bonding, bouncing,
 * merging, among other behaviors, will occur initially.
 *
 * Next, if applicable, the system checks the monad for emission based on various controlled and
 * random factors. If a monad is determined to be unstable enough, it will then emit some random
 * number of particles from itself, ejecting their mass into new quanta. This part will continue
 * until the monad has emitted all of its required radiation for that tick.
 *
 * Next, if applicable, the monad checks all particles it is bonded with (or simply adjacent to).
 * Depending on the controls, the monad may do as little as simply monitor its neighbors to as much
 * as attempt to adjust their position, either to prevent volume overlap or to maintain distances,
 * to facilitate interactions, or to merge or break with its neighbors^^. Adjustments to other
 * monads may be penalized with quanta that are to be emitted next tick.
 *
 * The last state that affects the monad physically is its position being updated by simply
 * added its velocity (which may have been changed by the above checks) to its position. The
 * monad is considered done with its own self-check this loop.
 *
 * Finally, debug information is processed for the monad. After all monads are processed,
 * wireframes are processed simply to properly encase their monads (no physical effects--
 * simply visual) and some debugging and statistical information is gathered. The system
 * passes control onto statistics to analyze the data collected during this loop. The system
 * emergence loop update is considered finished and terminates. It is up to an external
 * source to call the update loop whenever an update is desired.
 *
 *      ^   because as each particle is processed it can change other particle's properties (such as
 *          through collision or other methods) and because particles do not store two sets of info
 *          (no before and after for position, composition, etc.) to save memory and speed up the
 *          loop, there is no true way except for the first tick to analyze all of the particles
 *          in the same quantum step without interference.
 *
 *      ^^  By default settings, the bonding stage simply prevents volume overlap between monads and
 *          disassociates monads from checking monads that are too far to worry about boundary overlap.
 *          In this way, the collision check acts to identify neighbors and the bonding check simply
 *          ensures monads do not overlap.
 */
Emergence.prototype.update = function()
{   //memory references
    var max = Math.max;
    var random = Math.random;
    var controls = this.controls;
    var ms = controls.dynamic.maxSpeed;
    var debugParticle = controls.debug.particle.index;
    var toggle = controls.dynamic.toggle;
    var displacement = toggle.displacement;
    var collision = toggle.collision;
    var emission = toggle.emission;
    var bonding = toggle.bonding;
    var qcollide = toggle.quantaCollide;
    var rqcollide = toggle.quantaRandCollide;
    var monads = this.monads;
    var zones = this.zones;
    var stats = this.stats;
    var time = stats.time;
    var strict = controls.generation.world.strict;
    var instant = stats.instant;
    var maximum = stats.maximum;
    var cloud = this.cloud.geometry;
    var wireframe = this.wireframe;

    //local variables
    var allowInteract = !time.first;
    var interact = allowInteract;
    var run = time.first ? false : (time.subsequent ? true : false);
    var buffer = this.enforce ? 0 : Math.ceil(Math.min(this.MAX / 8, controls.dynamic.emission.maximum));
    var monad = null, quanta = null, pos = null, vel = null, zone = null, bonds = null;
    var balance = 0.0;
    var speed = 0;
    var mass = 0;
    var p = 0, b = 0;

    if (emergence.click) emergence.click--; //if clicked, countdown time until double-click invalid

    if (!(controls.step || controls.animate)) return; //do not update physics or other information if simulation paused

    //reset instant calculations that need to be counted from 0 every iteration of update
    instant.render = false;
    instant.velocity = instant.velplus = instant.velneg = instant.mass = instant.polarity = instant.cloud = instant.mcharge = instant.pcharge = instant.acharge = 0;

    //for every particle
    loop: for (p = 0; p < this.MAX; p++) {
        monad = monads[p];
        quanta = monad.quanta;
        if (quanta.radius === 0) continue;//do not update if nonexistent
        else interact = allowInteract;
        pos = monad.position;
        vel = monad.velocity;
        zone = monad.zone;
        bonds = monad.bonds;

        //statistics
        mass = monad.getMass();
        monad.absorptions = 0;
        if (mass > 1 || qcollide) { //record temperature information for only colliding particles
            speed = monad.getSpeed();
            instant.velocity += speed;
            instant.velplus += (speed / ms) * (quanta.attractons / mass);
            instant.velneg += (speed / ms) * (quanta.repulsons / mass);
            maximum.heaviest = max(maximum.heaviest, mass);
        }
        if (mass === 1) { //record quanta information
            instant.cloud += quanta.attractons ? 1 : 0;
        } else { //record monad information
            instant.mass += mass;
            instant.polarity += max(quanta.attractons,quanta.repulsons) / mass;
            instant.pcharge += ((max(quanta.attractons,quanta.repulsons)/mass)-0.5) * (quanta.attractons > quanta.repulsons ? 1 : -1);
            instant.acharge += quanta.attractons / mass;
            instant.mcharge += (quanta.attractons / mass) * mass;
        }

        //physics information update (countdowns, collisions, emissions, bonding)
        if (run) {
            if (quanta.countdown < 0) //quanta has recenetly been emitted
                interact = monad.checkEscape(monads[monad.parentIndex]) && allowInteract; //only allow interact if quanta has left the container volume of its parent

            if (interact) { //particle must be allowed to interact
                if (quanta.mountdown > 0)//medium term colors
                    if (--quanta.mountdown === 0 && quanta.countdown === 0)
                        monad.updateColor();

                if (quanta.countdown > 0)//short term colors
                    if (--quanta.countdown === 0)
                        monad.updateColor();

                if (qcollide || monad.getMass() > 1 || (rqcollide && random() < 0.125)) {//collision, emission, and bonding

                    if (collision) //collision is enabled
                        if (zones.checkCollisions(monad)) //returns true if particle disintegrated or merged into another in a collision
                            continue;

                    if (emission && (displacement || zones.free > buffer)) //displacement is enabled and there is room for more new particles
                        if (monad.checkEmission())
                            while (quanta.emit) //there are quanta remaining that should be emitted
                                if (monad.emit(monads[zones.nextFreeSlot(buffer)])) //returns true if passed an unemittable particle
                                    break;

                    if (bonding && bonds.length) //bonding is enabled and this particle has bonds
                        for (b = 0; b < bonds.length; b++)
                            if (monad.checkBond(monads[bonds[b]])) //returns true if particle gets absorbed into bonded particle
                                continue loop;
                }
            }

            //countdowns and positional update based on velocity
            if (quanta.mountdown < 0) quanta.mountdown = 0;//check for negative quanta.m
            if (quanta.countdown === 0 && monad.getMass() > 1) quanta.countdown++;
            monad.updatePosition();
        }

        //debug specific particle every tick
        if (DEBUG && p === debugParticle) {
            debug(["particle","color"],monad.color);
            debug(["particle","quanta"],monad.quanta);
            debug(["particle","position"],[monad.position]);
            debug(["particle","velocity"],[monad.velocity]);
            debug(["particle","zone"],monad.zone);
        }
    } //end particle loop

    if (wireframe.length > 4) this.updateWireframe(); //only update if user has added particle boxes

    controls.step = false;//signal to controls that one tick has passed in case of user step-pausing

    //let renderer know particles need visual update
    cloud.colorsNeedUpdate = true;
    cloud.verticesNeedUpdate = true;

    //once all monads have been processed, update system wide single-tick data gathering
    stats.update(this);
    if (time.first) stats.monitor.update();
    time.first = false;

    if (DEBUG) debug(["system","monads"],[this.monads]);
}



/**************************************************************/
/**************************************************************/
/********************       RESETTING       *******************/
/**************************************************************/
/**************************************************************/

/**
 * Starts or restarts the simulation, erasing all data from the currently running simulation and
 * using the generation settings to begin a new simulation.
 */
Emergence.prototype.restartSimulation = function()
{   //set simulation runtime, id factors
    this.runtime = this.controls.generation.runtime || Infinity;//must be set after controls are instantiated
    this.id = this.idRange * (Math.floor(this.id/this.idRange)+1);

    //check control settings for validity and update them
    this.controls.checkDimensions();
    this.controls.checkGeneration();
    this.controls.update();

    //reset emergence wireframe, stats, and zones
    this.wireframe = [];
    this.focus = [];
    this.stats.reset();
    this.stats.clear = true;
    this.zones = new Zones(this.stats,this.controls,this.monads);

    //setup colors, wireframe, particles, and rendering
    if (this.colorChange) this.colorNeutral();//check for color-neutral settings
    this.initializeCube(this.zones.size,new THREE.Vector3(),-1);//create world boundaries
    this.initializeParticles();//make all the particles
    this.resetScene();
    this.controls.step = true;//ensures that one tick will be processed to sync stats

    if (DEBUG) debug(["system","initialization"],["RESTART",this.monads]);
}

/**
 * Nullifies all quanta (only particles of mass >= 2 will remain). Never called internally--only
 * the user can select this option.
 */
Emergence.prototype.clearQuanta = function()
{
    var monads = this.monads;
    for (p = 0; p < this.MAX; p++)
        if (monads[p].getMass() === 1)
            monads[p].nullify();
}

/**
 * Recalculates the sizing, speed, and color information for all particles in the simulation.
 * This is only needed when anything changes (like dynamic or visual settings) that would require
 * instant reanalysis of every particle's physical data or appearance. Calling of this function
 * does not indicate system corruption, as sizing information is passed through color vertices,
 * meaning the two must update simultaneously if either is changed externally.
 */
Emergence.prototype.recalcMonads = function()
{   //memory references
    var monads = this.monads;
    var cloud = this.cloud;

    //update each color/velocity/radius
    for (var p = 0; p < this.MAX; p++) {
        monads[p].updateRadius();
        monads[p].checkVelocity(-1,false);
        monads[p].updateColor();
    }

    //mark all particles for rendering update
    cloud.colorsNeedUpdate = true;
    cloud.verticesNeedUpdate = true;
}

/**
 * Clears all user added data (currently only particle boxes) as well as all scene (rendering)
 * information and then reloads all particles into renderer. Theoretically, this can be done
 * during simulation runtime and should have no effect on the system. Should other user-added
 * effects be added, this is where they could be reset.
 */
Emergence.prototype.resetScene = function()
{
    this.scene = new THREE.Scene();
    this.focus = this.focus.slice(0,4);
    this.wireframe = this.wireframe.slice(0,4);
    for (var w = 0; w < this.wireframe.length; w++) this.scene.add(this.wireframe[w]);
    this.scene.add(this.cloud);
}

/**
 * Changes the color of the background and all the wireframes in the simulation. Currently,
 * there are no more environmental factors and these are all simply visual effects.
 */
Emergence.prototype.recolorEnvironment = function()
{
    this.renderer.setClearColor(this.controls.visual.backgroundColor);//change background
    for (var w = 0; w < this.wireframe.length; w++) {//change all wireframe colors
        this.wireframe[w].material.color = new THREE.Color(this.controls.visual.wireframeColor);
        this.wireframe[w].colorsNeedUpdate = true;
    }
}

/**
 * Handles switching back and forth from color-neutral mode to red-blue-purple. This function
 * only needs to be called when color neutral mode is enable/disabled and at the beginning
 * of every simulation restart if color neutral mode is enabled.
 */
Emergence.prototype.colorNeutral = function()
{   //memory references
    var visual = this.controls.visual;
    var access = this.controls.access;
    var bw = access.colorNeutral;

    //change settings to/from color neutral mode
    visual.cloud.distanceFactor = bw ? this.controls.MAX_FACTOR : this.zones.size;//as of now, distance determined by particle darkness, so color neutral mode has no distance factor difference
    visual.backgroundColor = bw ? "#800080" : "#FFFFFF";//white background for normal mode; purple for neutral mode
    this.colorChange = bw;
    this.stats.twoTone = bw;
    this.stats.redraw = true;
}

/**
 * Toggles inversion of the background and wireframe colors. This function only needs
 * to be called when color inversion mode is enable/disabled and at the beginning
 * of every simulation restart if color inversion mode is enabled.
 */
Emergence.prototype.invertColors = function()
{   //memory references
    var visual = this.controls.visual;
    var access = this.controls.access;
    var ic = access.invertColors
    var bc = visual.backgroundColor;
    var wc = visual.wireframeColor;

    //change settings to/from color inversion mode
    visual.backgroundColor = ic ? "#000000" : "#FFFFFF";
    visual.wireframeColor = ic ? "#FFFFFF" : "#000000";
    this.stats.redraw = true;
}
