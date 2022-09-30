/**
 * Emergence Simulation System
 * @author Marceline Peters / https://github.com/marcinas
 * see readme for additional credits
 */



/**************************************************************/
/**************************************************************/
/*******************        CONTROLS      	*******************/
/**************************************************************/
/**************************************************************/

/**
 * Creates a controls object, which is comprised of several internal objects storing controls
 * settings and several dat.gui objects to provide user interface for the controls. The controls
 * are organized into categories representing the scope of their function:
 *      Constant controls only affect the simulation upon page reload
 *      Generation controls take effect upon simulation restart
 *      Dynamic controls take effect instantly and will tag the simulation as altered post-genesis
 *      Visual controls only affect visuals and do not change anything in the simulation proper
 *      Debug controls determine what debugging information is printed out to console
 *
 * @param {Object} simulation    the simulation the controls are to affect
 */
function Controls(simulation)
{
    /** not necessary, but if used should be an array of initial conditions
     * hash[0] is an integer that is default maximum particles
     * hash[1] is an int bool (0 or 1) whether to display startup debug
     * hash[2] is an integer representing mode (see below)*/
		this.hash = getHashInformation();

    //local constants based on hash
    var TOTAL = this.hash[0] || Math.pow(2, MOBILE ? 13 : 16);
    var STARTUP = DEBUG = this.hash[1] || false;
    var STRESS = (this.hash[2] || 0) === 1;
    var TEST = (this.hash[2] || 0) === 2;
    var CLUMP = (this.hash[2] || 0) === 3;
    if (this.hash.length <= 1) CLUMP = true;//only on first load will clump be set if no options selected

    //local constants derived from hash or simply starting defaults
    var MAXIMUM = STRESS ? Math.pow(2, 16) : TOTAL;
    var RADIUS = Math.ceil(Math.pow(log(2, MAXIMUM), 3) / 3);//new formula for 0.7: but also update based on data.txt = Math.ceil(Math.pow(MAXIMUM/2 * log(2,MAXIMUM/2) * 75, 1/3));
    var DENSITY = 0.238;//this very important number means a particle's mass will also roughly be its volume!
    var MAXVEL = radiusSphere(1.0,DENSITY) * 2;//no particle can displace itself beyond the diameter of the smallest particle
    var HEIGHT = screen.height || window.innerHeight || 1080;

    //system-wide controls
    /** Simulation memory reference */
    this.simulation = simulation;
    /** If false, the simulation will not render; if true, the simulation will render until set to false or an error occurs */
    this.animate = true;
    /** When true, will render the simulation for one tick, then sets itself to false */
    this.step = false;
    /** The maximum distance factor the camera will recognize */
    this.MAX_FACTOR = Math.pow(2,15)-1;
    /** The maximum cubic radius from 0,0,0 that will be rendered (controls will limit distance operations to this) */
    this.RENDER = 50000;
    /** The absolute maximum brightness for any color in a [0,1] scale (must be <1 for some functions to work) */
    this.MAX_BRIGHTNESS = 0.999;
    /** Where empty particles will be dumped */
    this.NONRENDER_DISTANCE = this.RENDER * 2;

    /** Constant (reload) controls; to change these, the simulation must be reloaded (all data lost) */
    this.constant = {
        /** Whether to debug the startup of the simulation */
        debugInit: false,
        /** Different pre-loaded modes */
        modes: {
            //default: 0, //do not re-enable as it gets set to false
            /** 65536 single mass quanta field with quantaCollide enabled */
            stress: 1,
            /** Tracked experiment small amount multi-monad mode */
            research: 2,
            /** Large field with several medium size particles */
            clump: 3
        },
        /** The smallest amount in controls and otherwise (except vector calculations) the simulation handles */
        granularity: 0.001,
        /** The exponent (power of 2) that the next simulation will limit itself on */
        power: log(2, MAXIMUM),
        /** 2 ^ power, or the maximum total particles the simulation can simultaneously render, as well as the weight limit per generated monad */
        maximum: MAXIMUM
    };

    /** Generation (restart) controls; to change these, the simulation must be restart (current monad data lost) */
    this.generation = {
        /** How long to run the simulation (0 is infinite) */
        runtime: TEST ? 3000 : 0,
        /** The number of particles to attempt to generate */
        particles: TEST ? 2 : (STRESS ? MAXIMUM : Math.pow(2, Math.max(0, log(2, MAXIMUM)-(CLUMP ? 8 : 6)))),
        /** Whether to enforce maximum mass as the absolute limit (all quanta in simulation cannot exceed particles max) */
        enforceMass: false,
        /** Whether to enforce neutrality simulation wide (simulation will always have overall perfect neutrality) */
        enforceNeutral: false,
        /** Settings affecting starting particle mass sizing */
        mass: {
            /** The smallest mass a generated particle can have */
            minimum: 1,
            /** The approximate median of all generated particles */
            median: TEST ? MAXIMUM / 2 : (STRESS ? 1 : Math.pow(2, Math.max(0, log(2, MAXIMUM)-5))),
            /** The largest mass a generated particle can have */
            maximum: MAXIMUM,
            /** The standard deviation of mass, where with 0.0 inversion, 1.0 variance, 68.2% of monads will be within 1 deviation of median */
            deviation: (TEST || STRESS) ? 0 : Math.pow(2, Math.max(0, log(2, MAXIMUM)-7)),
            /** How much to split the median into two separate bell curves */
            inversion: 0.0,
            /** How wide or narrow the bell curve of mass should be */
            variance: 1.0,
            /** On average, the split between large and small particles, with numbers > 0.5 meaning more large particles */
            balance: 0.5,
            /** How much to randomize the final mass of a monad (uniformly based off gaussian mass) */
            randomize: 0.0
        },
        /** Settings affecting starting particle quanta distribution/polarity */
        monad: {
            /** Overall, on average, how neutral the simulation is (where -1 or 1 is 100% negative or positive respectively) */
            neutrality: 0.0,
            /** The least polar a monad can be randomly */
            polarityMin: 0.0,
            /** The most polar a monad can be randomly */
            polarityMax: TEST ? 0.0 : 1.0,
            /** Initial velocity of all particles */
            velocity: STRESS ? MAXVEL : 0.0,
            /** How much randomization to place on initial velocity (up to the max of velocity) */
            randomizeVelocity: 1.0
        },
        /** Settings affecting world (environment) and starting particle placement */
        world: {
            /** Whether to strictly place all particles equidistantly */
            /*hidden*/strict: TEST ? true : false,
            /** How far to spread the particles from the center of the toroid (0 or a # > radius means to spread equally) */
            spread: 0,
            /** The cuboid radius of the environment, where the maximum x,y,z values are +/- radius */
            radius: TEST ? Math.ceil(RADIUS / 3) : RADIUS,
            /** How large each zone should be of the environment (see Zones) */
            zoning: Math.floor(Math.max(RADIUS / 40, STRESS ? 1 : radiusSphere((Math.max(1, MAXIMUM / 16) + Math.max(1, MAXIMUM / 64))*2, DENSITY)*2))
        }
    };

    /** Dynamic (realtime) controls that affect the simulation instantly and mark the simulation as affected during runtime of the current simulation */
    this.dynamic = {
        /** The density for all particles */
        density: DENSITY,
        /** The fastest any single particle can go */
        maxSpeed: MAXVEL,
        /** How much single quanta being emitted or absorbed affect the monad it interacts with */
        quantaWeight: CLUMP ? 100 : 1.0,
        /** On-off dynamic switches */
        toggle: {
            /** Whether emission and collision are affected by monad composition (attractons and repulsons) */
            attractRepulse: true,
            /** Whether monads of mass > 1 can emit quanta given the proper conditions (if off, impactEmit, displacement, and reabsorption have no effect) */
            emission: true,
            /** Whether monads remember the last place(s) they were hit and attempt to emit in a similar direction and charge */
            impactEmit: true,
            /** Whether once the maximum rendering is reached, old quanta can be removed to make room for newer particles */
            displacement: true,
            /** If displacement is enabled, this is whether removed old quanta should be 're-absorbed' into their parent monad upon displacement */
            reabsorption: true,
            /** Whether particles are allowed to check for collision (if off, freeze, bonding, merging, quantaCollide, and quantaRandCollide have no effect) */
            collision: true,
            /** Whether monads will freeze on contact (overrides bonding, merging, bouncing) */
            freeze: false,
            /** Whether monads of mass > 1 bond on contact (overrides merging except under mergeRatio if enabled) */
            bonding: true,
            /** Whether monads will merge on contact (absorption, collapsing bond, merging will ) */
            merging: true,
            /** Whether to absorb quanta even if monad-monad merging is turned off */
            quantaAbsorption: true,
            /** Whether to check for quanta on quanta collision (by default, only monads mass > 1 check for collision) */
            quantaCollide: STRESS ? true : false,
            /** If enabled when quantaCollide is false, each quanta has a 1/8 chance of checking for collision; when checking for quanta-quanta collision, all quanta have double radius */
            quantaRandCollide: false
        },
        /** Settings for quanta emission */
        emission: {
            /** The mass at which at or below particles will no longer emit at all */
            stability: 1,
            /** The mass at which the maximum emission rate is reached */
            radiation: Math.round(Math.max(2, MAXIMUM / (CLUMP ? 512 : 16))),
            /** The maximum possible quanta a monad can emit through natural mass-based diffusion */
            maximum: TEST ? Math.round(Math.max(2, MAXIMUM / 2048)) : Math.round(Math.max(1, MAXIMUM / (CLUMP ? 65536 : 32768))),
            /** The higher the uniformity, the fewer and more consistent emitted quanta are */
            uniformity: 2.0,
            /** How rapidly monads decay (the higher, the more often on a tick basis they will emit); note that decay is also based on monad instability */
            decayRate: 0.5,
            /** Factor to which monad should randomly attempt to match emitted quanta charge with the last impact; at 0.0, emission is randomly mass composition based */
            prevMatch: 0.9,
            /** Standard deviation to which monad should randomly attempt to match emitted quanta velocity (direction) with the last impact (this is a gaussian variable, so at high numbers it is effectively uniformly random)  */
            prevRange: 0.5,
            /** How many impacts a monad will 'remember'; each new impact influence strength is inverse to this number */
            prevWeight: 1,
            /** Velocity at which quanta are emitted (for every emission) */
            velocity: MAXVEL
        },
        /** Settings for monad-monad bonding */
        bonding: {
            /** Whether monads bounce when they bond, like standard collision */
            bounce: true,
            /** Whether monads can attempt to pull in a separating monad */
            pullIn: false,
            /** Whether monads can attempt to push out an intersecting monad */
            pushOut: true,
            /** Whether bonds can be broken if monads separate enough */
            allowBreak: true,
            /** The ratio (in combined radius distance) a monad can flee before the bond breaks (1.0 is perfect contact) */
            breakRatio: 1 + this.constant.granularity,
            /** The ratio (in combined radius distance) a monad can intersect before they collapse-merge (0.0 means they will never collapse-merge) */
            mergeRatio: 0
        }
    };

    /** Accessibility (no physics effects) controls */
    this.access = {
      /** If enabled, switches to a three color mode (black, white, purple) instead of standard red-blue-white */
      colorNeutral: false,
      /** Toggles all colors to be inverted */
      invertColors: false
    };

    /** Visual (no physics effects) controls */
    this.visual = {
        /** Background color of the simulation environment */
        backgroundColor: "#FFFFFF",
        /** Color of all wireframes (including world boundaries) of simulation */
        wireframeColor: "#000000",
        /** Visuals affecting instant reactions */
        display: {
            /** Whether to temporarily color monads white upon bonding (and brown upon unbonding) */
            bonding: true,
            /** Whether to temporarily color monads yellow upon quanta-monad collision and orange upon monad-monad collision */
            collision: false,
            /** Whether to temporarily color monads green upon emission (and lime-green upon simultaneous collision-emission) */
            radiation: false,
            /** Whether to log to console information on a clicked particles */
            clickInfo: true,
            /** Whether to display a box wireframe around any clicked particle */
            clickBox: true,
            /** Whether to display a ray from camera origin to clicked pixel */
            clickRay: false
        },
        /** Settings affecting the camera dimensions */
        camera: {
            /** Allows rendering resizing on window change (may lead to artifacts) */
            allowWindowRender: true,
            /** Forces the rendering to the below dimensions (may lead to artifacts) */
            customWindowRender: false,
            /** Artificial render height for custom render */
            height: HEIGHT,
            /** Artificial render width for custom render */
            width: Math.round(HEIGHT * (16/9))
        },
        /** Affects how particles regularly appear (without display effects) */
        cloud: {
            /** Whether to reverse the color spectrum on small-large monads or large-small monads */
            reverseSpectrum: false,
            /** A monad at or below this radius will have their spectrum reversed and limited */
            whiteoutRadius: MAXVEL - 1 + 0.1,
            /** How much distance affects particle brightness */
            distanceFactor: Math.min(RADIUS, this.MAX_FACTOR),
            /** The brightest a monad can be in range [0,1] */
            lightBrightest: 1.0,
            /** The darkest a monad can be in range [0,1] */
            lightDarkest: 0.33,
            /** How large monads should appear (at default render settings, 7.8 appears to simulate physical boundaries) */
            sizeRatio: 7.8,   //note! emissions being green for one frame outside is expected
            /** Whether sizing should increase or decrease exponentially (1 is linear) */
            sizeExp: 1
        }
    };

    /** Debug settings! If enabled, simulation will run MUCH slower due to lots of checking */
    this.debug = {
        /** If disabled, no debugging will display at all */
        allow: false,
        /** Any debug sent with variable always will always goes through if by default debug is allowed */
        /*hidden*/always: true,
        /** Special debug boolean just for startup debug initialization */
        /*hidden*/startup: STARTUP,
        /** Debug controls for single chosen particle (index) */
        particle: {
            /** Index of the particle that should be debugged */
            index: 0,
            /** Whether to display the particle's color */
            color: false,
            /** Whether to display the particle's composition information */
            quanta: false,
            /** Whether to display the particle's central physical coordinates */
            position: false,
            /** Whether to display the particle's velocity */
            velocity: false,
            /** Whether to display the particle's zoning information */
            zone: false
        },
        /** Debug controls for specific aspects of the simulation */
        system: {
            /** Whether to display debug on initialization (restart) */
            initialization: false,
            /** Whether to display debug on monads */
            monads: false,
            /** Whether to display debug on reabsorption */
            reabsorption: false,
            /** Whether to display debug on the 3D scene */
            scene: false,
            /** Whether to display debug on crossover during collision checking */
            crossover: false,
            /** Whether to display debug on collision */
            collision: false,
            /** Whether to display debug on emission */
            emission: false,
            /** Whether to display debug on bonding over potential toroid wraps */
            toroidbond: false,
            /** Whether to display debug on particle specific wireframes */
            wireframe: false,
            /** Whether to display debug on user interaction such as keyboard and mouse */
            interaction: false
        }
    };

    /** Controls and main options (right pane) gui */
    this.gui = new dat.GUI({ width: 350 });

    /** Buttons and system info (bottom left pane) gui */
    this.gui2 = new dat.GUI({ autoPlace: false, width: 206 });
    this.gui2.domElement.id = 'gui2';
    document.body.appendChild(this.gui2.domElement);
    document.getElementById('gui2').style.cssText = "position:fixed;bottom:0;left:0";

    /** Charts display button (bottom pane) gui */
    this.gui3 = new dat.GUI({autoPlace: false, width: 1349 });
    this.gui3.domElement.id = 'gui3';
    document.body.appendChild(this.gui3.domElement);
    document.getElementById('gui3').style.cssText = "position:fixed;bottom:0;left:206px";
    this.listen = [];
    this.setup();
}

/**
 * Called immediately after instantiation, sets up all of the guis with their respective link to
 * controls with labels, sliders, buttons, etc. in the appropriate menus.
 */
Controls.prototype.setup = function()
{   //memory references
    var simulation = this.simulation;
    var constant = this.constant;
    var generation = this.generation;
    var mass = generation.mass;
    var monad = generation.monad;
    var world = generation.world;
    var dynamic = this.dynamic;
    var toggle = dynamic.toggle;
    var emission = dynamic.emission;
    var bonding = dynamic.bonding;
    var access = this.access;
    var visual = this.visual;
    var display = visual.display;
    var camera = visual.camera;
    var cloud = visual.cloud;
    var debug = this.debug;
    var particle = debug.particle;
    var system = debug.system;

    //universal settings
    var MAX_PARTICLES = constant.maximum;
    var MIN_DIFF = constant.granularity;
    var MAX_VEL = emission.velocity;
    var MAX_RENDER_DISTANCE = this.RENDER;

    //preset values
    var messageConstant = { text: "   if slow, lower Maximum Mass" };
    var messageDebug = { text: "        press F12 to see output" };
		var folderPrefix = "";
		var folderSuffix = "";
		var subfolderPrefix = ">>> ";
		var subfolderDivider = " > ";

    //button functions
    var buttonRefresh = { refreshSimulation: function () {
        SIM_scene(); } };

    var buttonStep = { stepSimulation: function () {
        simulation.controls.animate = false;
        simulation.controls.step = true; } };

    var buttonPause = { pauseSimulation: function () {
        simulation.controls.animate = !simulation.controls.animate; } };

    var buttonClear = { clearQuanta: function () {
        emergence.clearQuanta();
        SIM_m_c_c(); } };

    var buttonReload = { reloadSimulation: function () {
        reloadSimulation(); } };

    var buttonRestart = { restartSimulation: function () {
        SIM_restart(); } };

    var buttonDisplay = { displayStatistics: function () {
        SIM_charts(); } };

    //gui3 setup
    this.gui3.add(buttonDisplay, 'displayStatistics').name('Display Statistics');

    //gui2 setup
    this.gui2.add(VERSION, 'CURRENT_VERSION').listen().name('Version');
    this.gui2.add(simulation, 'id').listen().name('Simulation');
    this.gui2.add(simulation.stats, 'tick').listen().name('Tick');
    this.gui2.add(buttonStep, 'stepSimulation').name('Step');
    this.gui2.add(buttonPause, 'pauseSimulation').name('Pause');

    //gui setup
    var controlsHeader = this.gui.addFolder(folderPrefix + 'CONTROLS' + folderSuffix).open();
    /* CONSTANTS */
    var controlsConstant = this.gui.addFolder(folderPrefix + 'Constants (must reload to take effect)' + folderSuffix);
    controlsConstant.add(buttonReload, 'reloadSimulation').name('Reload Simulation');
    controlsConstant.add(constant, "debugInit", constant.debugInit).name('Debug Reload');
    controlsConstant.add(constant, "modes", constant.modes).name('Mode');
    controlsConstant.add(constant, "granularity", 0.000001,1.0,0.000001).name('Controls Granularity');
    controlsConstant.add(constant, "power", 0.0, 20.0, 1.0).onChange(SIM_controls).name('Maximum Mass: 2 ^');
    controlsConstant.add(constant, 'maximum').listen().name('Maximum Particles');
    controlsConstant.add(messageConstant, 'text').name("Runtime FPS Notice");

    /* GENERATION */
    var controlsGeneration = this.gui.addFolder(folderPrefix + 'Generation (must restart to take effect)' + folderSuffix);
    controlsGeneration.add(buttonRestart, 'restartSimulation').name('Restart Simulation');
    controlsGeneration.add(generation, "runtime", 0, Number.MAX_SAFE_INTEGER, 1);
    controlsGeneration.add(generation, "particles", 1.0, MAX_PARTICLES, 1.0);
    controlsGeneration.add(generation, "enforceMass", generation.enforceMass);
    controlsGeneration.add(generation, "enforceNeutral", generation.enforceNeutral);
    var controlsGenMass = controlsGeneration.addFolder(subfolderPrefix + 'Generation' + subfolderDivider + 'Mass');
    controlsGenMass.add(mass, "minimum", 1, MAX_PARTICLES, 1);
    controlsGenMass.add(mass, "median", 1, MAX_PARTICLES, 1);
    controlsGenMass.add(mass, "maximum", 1, MAX_PARTICLES, 1);
    controlsGenMass.add(mass, "deviation", 0, Math.max(1, Math.round(MAX_PARTICLES / 4)), 1);
    controlsGenMass.add(mass, "variance", 0, Math.round(log(2,MAX_PARTICLES)), 1);
    controlsGenMass.add(mass, "inversion", 0, Math.round(log(2,MAX_PARTICLES)), 1);
    controlsGenMass.add(mass, "balance", 0.0, 1.0, MIN_DIFF);
    controlsGenMass.add(mass, "randomize", 0.0, 1.0, MIN_DIFF);
    var controlsGenMonad = controlsGeneration.addFolder(subfolderPrefix + 'Generation' + subfolderDivider + 'Monads');
    controlsGenMonad.add(monad, "neutrality", -1.0, 1.0, MIN_DIFF);
    controlsGenMonad.add(monad, "polarityMin", 0.0, 1.0, MIN_DIFF);
    controlsGenMonad.add(monad, "polarityMax", 0.0, 1.0, MIN_DIFF);
    controlsGenMonad.add(monad, "velocity", 0.0, MAX_VEL, MIN_DIFF);
    controlsGenMonad.add(monad, "randomizeVelocity", 0.0, 1.0, MIN_DIFF);
    var controlsGenWorld = controlsGeneration.addFolder(subfolderPrefix + 'Generation' + subfolderDivider + 'World');
    controlsGenWorld.add(world, "spread", 1, MAX_RENDER_DISTANCE, 1);
    this.listen.push(controlsGenWorld);
    this.listen.push(controlsGenWorld.add(world, "radius", 2, MAX_RENDER_DISTANCE, 1));
    this.listen.push(controlsGenWorld.add(world, "zoning", 1, MAX_RENDER_DISTANCE, 1));

    /* DYNAMIC PARAMETERS */
    var controlsDynamic = this.gui.addFolder(folderPrefix + 'Dynamic (effects happen in real time)' + folderSuffix);
    controlsDynamic.add(buttonClear, "clearQuanta").name("Clear Quanta");
    controlsDynamic.add(dynamic, "density", MIN_DIFF, 10.0, MIN_DIFF).onChange(SIM_m_c_c);
    controlsDynamic.add(dynamic, "maxSpeed", MIN_DIFF, 10.0, MIN_DIFF).onChange(SIM_m_c_c);
    controlsDynamic.add(dynamic, "quantaWeight", MIN_DIFF, MAX_PARTICLES, MIN_DIFF).onChange(SIM_m_c_c);
    var controlsDynToggle = controlsDynamic.addFolder(subfolderPrefix + 'Dynamic' + subfolderDivider + 'Toggle');
    controlsDynToggle.add(toggle, "attractRepulse", toggle.attractRepulse).onChange(SIM_corrupt);
    controlsDynToggle.add(toggle, "emission", toggle.emission).onChange(SIM_corrupt);
    controlsDynToggle.add(toggle, "impactEmit", toggle.impactEmit).onChange(SIM_corrupt);
    controlsDynToggle.add(toggle, "displacement", toggle.displacement).onChange(SIM_corrupt);
    controlsDynToggle.add(toggle, "reabsorption", toggle.reabsorption).onChange(SIM_corrupt);
    controlsDynToggle.add(toggle, "collision", toggle.collision).onChange(SIM_corrupt);
    controlsDynToggle.add(toggle, "freeze", toggle.freeze).onChange(SIM_corrupt);
    controlsDynToggle.add(toggle, "bonding", toggle.bonding).onChange(SIM_corrupt);
    controlsDynToggle.add(toggle, "merging", toggle.merging).onChange(SIM_corrupt);
    controlsDynToggle.add(toggle, "quantaAbsorption", toggle.quantaAbsorption).onChange(SIM_corrupt);
    controlsDynToggle.add(toggle, "quantaCollide", toggle.quantaCollide).onChange(SIM_corrupt);
    controlsDynToggle.add(toggle, "quantaRandCollide", toggle.quantaRandCollide).onChange(SIM_corrupt);
    var controlsDynEmit = controlsDynamic.addFolder(subfolderPrefix + 'Dynamic' + subfolderDivider + 'Emission');
    controlsDynEmit.add(emission, "stability", 1, MAX_PARTICLES, 1).onChange(SIM_corrupt);
    controlsDynEmit.add(emission, "radiation", 1, MAX_PARTICLES, 1).onChange(SIM_corrupt);
    controlsDynEmit.add(emission, "maximum", 1, MAX_PARTICLES, 1).onChange(SIM_corrupt);
    controlsDynEmit.add(emission, "uniformity", 1.0, 100.0, MIN_DIFF).onChange(SIM_corrupt);
    controlsDynEmit.add(emission, "decayRate", 0.0, 1.0, MIN_DIFF).onChange(SIM_corrupt);
    controlsDynEmit.add(emission, "prevMatch", 0.0, 1.0, MIN_DIFF).onChange(SIM_corrupt);
    controlsDynEmit.add(emission, "prevRange", 0.0, 10.0, MIN_DIFF).onChange(SIM_corrupt);
    controlsDynEmit.add(emission, "prevWeight", 1, MAX_PARTICLES, 1).onChange(SIM_corrupt);
    controlsDynEmit.add(emission, "velocity", 0.0, MAX_VEL, MIN_DIFF).onChange(SIM_corrupt);
    var controlsDynBond = controlsDynamic.addFolder(subfolderPrefix + 'Dynamic' + subfolderDivider + 'Bonding');
    controlsDynBond.add(bonding, "bounce", bonding.bounce).onChange(SIM_corrupt);
    controlsDynBond.add(bonding, "pullIn", bonding.pullIn).onChange(SIM_corrupt);
    controlsDynBond.add(bonding, "pushOut", bonding.pushOut).onChange(SIM_corrupt);
    controlsDynBond.add(bonding, "allowBreak", bonding.allowBreak).onChange(SIM_corrupt);
    controlsDynBond.add(bonding, "breakRatio", 1.0, 2.0, MIN_DIFF).onChange(SIM_corrupt);
    controlsDynBond.add(bonding, "mergeRatio", 0.0, 1.0, MIN_DIFF).onChange(SIM_corrupt);

    /* ACCESS PARAMETERS */
    var controlsAccess = this.gui.addFolder(folderPrefix + 'Accessibility' + folderSuffix);
    controlsAccess.add(access, "colorNeutral", access.colorNeutral).onChange(SIM_colorNeutral);
    controlsAccess.add(access, "invertColors", access.invertColors).onChange(SIM_invertColors);

    /* VISUAL PARAMETERS */
    var controlsVisual = this.gui.addFolder(folderPrefix + 'Visualization' + folderSuffix);
    controlsVisual.add(buttonRefresh, 'refreshSimulation').name('Refresh Simulation');
    controlsVisual.addColor(visual, "backgroundColor").onChange(SIM_colors);
    controlsVisual.addColor(visual, "wireframeColor").onChange(SIM_colors);
    var controlsVisDisplay = controlsVisual.addFolder(subfolderPrefix + 'Visualization' + subfolderDivider + 'Display');
    controlsVisDisplay.add(display, "bonding", display.bonding).onChange(SIM_monads);
    controlsVisDisplay.add(display, "collision", display.collision).onChange(SIM_monads);
    controlsVisDisplay.add(display, "radiation", display.radiation).onChange(SIM_monads);
    controlsVisDisplay.add(display, "clickInfo", display.clickInfo);
    controlsVisDisplay.add(display, "clickBox", display.clickBox);
    controlsVisDisplay.add(display, "clickRay", display.clickRay);
    var controlsVisCamera = controlsVisual.addFolder(subfolderPrefix + 'Visualization' + subfolderDivider + 'Camera');
    controlsVisCamera.add(camera, "allowWindowRender", camera.allowWindowRender).onChange(SIM_cam_m);
    controlsVisCamera.add(camera, "customWindowRender", camera.customWindowRender).onChange(SIM_cam_m);
    controlsVisCamera.add(camera, "height", camera.height).onChange(SIM_cam_m);
    controlsVisCamera.add(camera, "width", camera.width).onChange(SIM_cam_m);
    var controlsVisMonad = controlsVisual.addFolder(subfolderPrefix + 'Visualization' + subfolderDivider + 'Cloud');
    controlsVisMonad.add(cloud, "reverseSpectrum", cloud.reverseSpectrum).onChange(SIM_monads);
    controlsVisMonad.add(cloud, "whiteoutRadius", 1, 100, MIN_DIFF).onChange(SIM_monads);
    controlsVisMonad.add(cloud, "distanceFactor", 1, this.MAX_FACTOR, 1).onChange(SIM_monads);
    controlsVisMonad.add(cloud, "lightBrightest", 0.0, 1.0, MIN_DIFF).onChange(SIM_monads);
    controlsVisMonad.add(cloud, "lightDarkest", 0.0, 1.0, MIN_DIFF).onChange(SIM_monads);
    controlsVisMonad.add(cloud, "sizeRatio", MIN_DIFF, 100.0, MIN_DIFF).onChange(SIM_monads);
    controlsVisMonad.add(cloud, "sizeExp", MIN_DIFF, 2.0, MIN_DIFF).onChange(SIM_monads);

    /* DEBUG PARAMETERS */
    var controlsDebug = this.gui.addFolder(folderPrefix + 'Debug' + folderSuffix);
    controlsDebug.add(messageDebug, 'text').name("Debugging Notice");
    controlsDebug.add(debug, "allow", debug.allow).onChange(SIM_controls);
    var controlsDebParticle = controlsDebug.addFolder(subfolderPrefix + 'Debug' + subfolderDivider + 'Particle');
    controlsDebParticle.add(particle, "index", -1, MAX_PARTICLES, 1).onChange(SIM_controls);
    controlsDebParticle.add(particle, "color", particle.color);
    controlsDebParticle.add(particle, "quanta", particle.quanta);
    controlsDebParticle.add(particle, "position", particle.position);
    controlsDebParticle.add(particle, "velocity", particle.velocity);
    controlsDebParticle.add(particle, "zone", particle.zone);
    var controlsDebSystem = controlsDebug.addFolder(subfolderPrefix + 'Debug' + subfolderDivider + 'System');
    controlsDebSystem.add(system, "initialization", system.initialization);
    controlsDebSystem.add(system, "monads", system.scene);
    controlsDebSystem.add(system, "reabsorption", system.reabsorption);
    controlsDebSystem.add(system, "scene", system.scene);
    controlsDebSystem.add(system, "crossover", system.crossover);
    controlsDebSystem.add(system, "collision", system.collision);
    controlsDebSystem.add(system, "emission", system.emission);
    controlsDebSystem.add(system, "toroidbond", system.toroidbond);
    controlsDebSystem.add(system, "wireframe", system.wireframe);
    controlsDebSystem.add(system, "interaction", system.interaction);
}

/**
 * When called, will check the user or system defined parameters for world sizing generation.
 * It will force the radius of the world to be divisible perfectly by a power of 10; then, zoning
 * will be altered until it is a perfect factor of world diameter (radius * 2), first by decreasing
 * the zoning size, and if no numbers perfectly divide into world diameter, the zoning is
 * incremented until the worst case scenario where zoning = radius, which would result in
 * just 8 zones for particles to segregate into. Controls are then adjusted to reflect these
 * acceptable values.
 */
Controls.prototype.checkDimensions = function()
{
    var size = this.generation.world.radius;
    var cut = Math.pow(10, Math.max(0, Math.floor(log(10, size)) - 1));//determines power of 10 so that radius with have roughly 2 significant figures
    size = Math.round(size / cut) * cut;//resets size to have roughly 2 sig figs
    var unit = Math.ceil(Math.max(size / 80, Math.min(size, this.generation.world.zoning)));//on the computer being tested, zoning regions beyond 80x80x80
    var units = [unit,unit];                                                                //(array size beyond 1/2 million) seem to cause memory issues
    while ((size*2) % units[0] && units[0] > size / 80) units[0]--;//set first unit as large as possible that works within constraints
    while ((size*2) % units[1] && units[1] < size) units[1]++;//set second unit as small as possible that works within constraints
    unit = (!((size*2) % units[0]) && Math.abs(unit-units[0]) <= Math.abs(unit-units[1])) ? units[0] : units[1];//smaller unit is preferred

    this.generation.world.radius = size;//size is the radius of the world
    this.generation.world.zoning = unit;//unit is the zoning unit

    //as of this writing, dat.gui's listen function is broken for manipulable values (esp. sliders)
    //the below code rectifies that by popping off the incorrect radius and zoning and then
    //popping back on the sliders with correct,acceptable defaults
    this.listen[0].remove(this.listen[1]);
    this.listen[0].remove(this.listen[2]);
    this.listen.pop(); this.listen.pop();
    this.listen.push(this.listen[0].add(this.generation.world, "radius", 2.0, this.RENDER, 1.0));
    this.listen.push(this.listen[0].add(this.generation.world, "zoning", 1.0, this.RENDER, 1.0));
}

/**
 * Checks for any illogical values in world generation (e.g., mass maximum below mass minimum)
 * and corrects them.
 */
Controls.prototype.checkGeneration = function()
{
    var mass = this.generation.mass;
    var world = this.generation.world;
    if (mass.maximum < mass.minimum) mass.minimum = mass.maximum;
    if (mass.median > mass.maximum) mass.median = mass.maximum;
    if (mass.median < mass.minimum) mass.median = mass.minimum;
    if (world.strict) world.spread = (world.radius * Math.pow(3,1/2)) / 2; //if strict, spread actually becomes distance between particles
    if (world.spread > world.radius) world.spread = 0;
}

/**
 * Called whenever controls are updated that need to be instantly checked and corrected. Then,
 * the gui is refreshed to account for any change in appearances.
 */
Controls.prototype.update = function()
{
    DEBUG = this.debug.allow;
    this.constant.maximum = Math.pow(2,this.constant.power);
    if (this.debug.particle.index < 0)
        this.debug.particle.index = Math.floor(Math.random() * this.stats.instant.monads);
    refreshGui(this.gui);
    //refreshGui(this.gui2);//refreshGui(this.gui3);//nothing to refresh for gui2 and 3
}



/**************************************************************/
/**************************************************************/
/*******************  REDUNDANT FUNCTIONS	*******************/
/**************************************************************/
/**************************************************************/

// basic functions that access the Emergence Simulation System.
// perhaps its my understanding of dat.gui, but I can't get
// prototype functions to get called .onChange(...)
// so these are workarounds

/** Refreshes the display gui controllers (controls). */
function refreshGui(gui) { for (var c in gui.__controllers) gui.__controllers[c].updateDisplay(); };

/** Restarts the Emergence Simulation System. */
function SIM_restart() { emergence.restartSimulation(); };

/** Recalculates the monads and resets the scene. */
function SIM_scene() { SIM_monads(); emergence.resetScene(); };

/** Updates the controls of the simulation. */
function SIM_controls() { emergence.controls.update(); };

/** Marks the simulation as altered and changes the simulation id. */
function SIM_corrupt() { emergence.stats.purity = false; emergence.id++; };

/** Recolors the background and wireframes. */
function SIM_colors() { emergence.recolorEnvironment(); };

/** Recalculates all derived monad attributes (radius, color, velocity). */
function SIM_monads() { emergence.recalcMonads(); };

/** Flips the visibility of the statistics panels/charts. */
function SIM_charts() { emergence.stats.changeVisibility(); };

/** Updates the controls, corrupts the simulation, and recalculates the monads. */
function SIM_m_c_c() { SIM_controls(); SIM_corrupt(); SIM_monads(); };

/** Resets the camera, rendering, and monad calculations. */
function SIM_cam_m() { var camera = emergence.controls.visual.camera;
                        camera.allowWindowRender = camera.customWindowRender;
                        SIM_monads();
                        camera.allowWindowRender = !camera.customWindowRender; };

/** Changes simulation to black and white with purple background. */
function SIM_colorNeutral() { emergence.colorNeutral();
                              SIM_controls(); SIM_colors(); SIM_monads();  };

/** Inverts the colors of the background and wireframe. */
function SIM_invertColors() { emergence.invertColors();
                              SIM_controls(); SIM_colors();  };
