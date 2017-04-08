/**
 * Emergence Simulation
 * @author Marceline Peters / https://github.com/marcinas
 * January - April 2017
 * University of Washington, Tacoma
 * 
 * original: stats.js - http://github.com/mrdoob/stats.js
 * @author mr.doob / http://mrdoob.com/
 * modifications by Marceline Peters
 * see readme for additional credits
 */



/**************************************************************/
/**************************************************************/
/*******************		STATISTICS		*******************/
/**************************************************************/
/**************************************************************/

/**
 * Shell function for creating the statistics object and monitor. Most of the statistics object
 * is created in the .reset() function, since all data gathering must be cleanly purged upon
 * simulation restart; the monitor is consistent across the working reload of the simulation and
 * contains the visuals of the simulation.
 */
function Statistics()
{
    this.reset(); //called to set all traits for first run
    this.monitor = new Monitor(this); //the visuals
    this.time.fps = 30;//default value in case FPS not set yet
}

/**
 * Because statistics must be totally reset confidentially at the start/restart of the simulation,
 * all of its traits (except monitor) are set/reset within one function. Statistics contains 
 * several types of data:
 * 
 *      uncategorized       administrative variables that categorical variables use for reference,
 *                          and other than 'tick' are not visible to the user or modifiable by them
 *                          directly
 *      log                 timelapse information about the system, collected at varying time
 *                          intervals, where each slot in each array represents one data point
 *                          at a specific tick in the simulation
 *      current             large array statistics that are true for one tick of the simulation
 *                          and are collected at varying time intervals; each array represents
 *                          parallel data attributes taken at a single point in time
 *      instant             single variables that each represent one datum taken every tick of 
 *                          the simulation; these are always up-to-date
 *      maximum             used to gather the maximum data point captured for varying statistics
 *                          used by the other categories; may be instantly updated or updated
 *                          periodically, dependent on the statistic
 *      updatediffs         used with diffs to store non-chart based stats update cycle numbers
 */
Statistics.prototype.reset = function()
{
    /** How many frames or quantum time steps the simulation has progressed */
    this.tick = 0; 
    /** How many ticks until updating computationally heavy stats */
    this.cycle = 50;//faster than 50 seems to produce slowdown at times
    /** For storing tick frequency difference values */
   	this.diffs = new Array(this.cycle).fill(0);
    /** Whether to render statistics */
    this.render = false;
    /** Whether the simulation has remained uncorrupted (no dynamic changes during runtime) */
    this.purity = true;
    /** Whether to clear (reset) the panels and their current/high/low values  */
    this.clear = false;
    /** Whether to force all panels to draw at this exact tick */
    this.redraw = false;
    /** Whether to use black and white color neutral mode */
    this.twoTone = false;
    /** Default opacity of panels and charts when visible */
    this.opacity = 0.9;
    
    /** Handles factors related to runtime specific to statistics (tick and cycle are for the simulation proper, which runs asynchronously with statistics) */
    this.time = {
        /** True only when statistics has been reset and hasn't yet run the update gamut yet */
        first: true,
        /** True once statistics has run its update gamut at least once (forced to happen on tick 1 of simulation, the only synchronous event) */
        subsequent: false,
        /** The last recorded fps of the simulation */
        fps: 0,
        /** Clock for counting number of times statistics update gamut has run   */
        clock: 0,
        /** The time metric at the current iteration */
        now: 0,
        /** The time metric the last time fps was updated */
        then: 0,
        /** The time metric the last time the statistics update gamut has run */
        last: 0,
        /** A whole damn human second in clock-speak */
        second: 1E3
    }

    /** Claimed spots for cycle tick stats whose collection is requested by the simulation */
    this.updatediffs = {
        /** Exclusive frequency difference for occupation */
        occupied: this.getDiff(this.cycle),
        /** Exclusive frequency difference for monad size distribution */
        monads: this.getDiff(this.cycle),
    };

    /** Timed interval recordings (almost all of these are every tick, but some are not) */
    this.log = {
        /** The number of monads (mass > 1) at every tick in the simulation */
        monads: [],
        /** The total mass of all monads (mass > 1) */
        mmass: [],
        /** Records the net speed of all monads (mass > 1) */
        temperature: [],
        /** Computationally heavy measure of how many zones are occupied by a single quanta or more */
        occupancy: [],
        /** Records the distance in units from monad index 0 to monad index 1 */
        distance: [],
        /** The mass-weighted polarity [0,100] of all monads (mass > 1), where 0 means all monads are split 50-50, and 100 means all monads are split 100-0 or 0-100 */
        polarity: [],

        /** The net charge [0,1] of all quanta (mass = 1), where 0 is negative and 1 is positive */
        charge: [],
        /** Similar to polarity, but a [0,1] scale that is monad (mass > 1) mass weighted but only counts positive charge */
        acharge: [],
        /** A [0,1] scale that is mass and polarity weighted, where the heavier and more polar a monad (mass > 1) contribute more */
        pcharge: [],
        /** Mass-independent monad polarity [0,1] tracker (mass > 1) where all monads contribute equally to final value */
        mcharge: [],
        /** Records the combined weight-based polarity [0,1] for monad index 0 and monad index 1 */
        distcharge: [],
        /** Speed-weighted [0,1] polarity scale for all monads (mass > 1) */
        tempcharge: [],
        /** Computationally heavy measure of the polarity [0,1] of all zones where all zones contribute equally regardless of net mass */
        moccupancy: []
    };

    /** Instant one-tick evaluations of an entire system event */
    this.current = {
        /** Sorted list of the masses of all monads at a single tick */
        monads: []
    };

    /** Single value evaluations of one measure; most of these are reset every tick or every statistics clock, some are cycled */
    this.instant = {
        /** The total number of bonds made (may exceed particle count upon unbonding and re-bonding) */
        bonds: 0,
        /** Total amount of emitted quanta */
        radiation: 0,
        /** Total amount of collisions */
        collisions: 0,
        /** Total number of particles in the simulation */
        particles: 0,

        /** Total amount of unstable quanta (quanta above the stability threshold in all monads) */
        decaying: 0,//UNUSED currently (code exists to keep track)
        /** Total amount of particles that have switched zones */
        occupancy: 0,//UNUSED currently (code exists to keep track)

        /** Tracker for log.acharge */
        acharge: 0,
        /** Tracker for log.pcharge */
        pcharge: 0,
        /** Tracker for log.monads */
        monads: 0,
        /** Tracker for log.temperature */
        velocity: 0,
        /** Tracker for positive values of log.tempcharge */
        velplus: 0,
        /** Tracker for negative values of log.tempcharge */
        velneg: 0,
        /** Tracker for log.charge */
        cloud: 0,
        /** Tracker for log.polarity */
        polarity: 0,
        /** Tracker for log.mcharge */
        mcharge: 0,
        /** Tracker for log.mass */
        mass: 0
    };

    /** The maximum value for any one statistic */
    this.maximum = {
        /** The number of zones in the simulation (static) */
        zoning: 0,
        /** The maximum distance possible between any two particle's centers */
        distance: 0,
        /** The heaviest monad encountered for any one tick in the simulation */
        heaviest: 0,

        /** Tracker for instant.bonds */
        bonds: 0,
        /** Tracker for instant.monads */
        monads: 0,
        /** Tracker for instant.velocity */
        velocity: 0,
        /** Tracker for instant.decaying */
        decaying: 0,
        /** Tracker for instant.radiation */
        radiation: 0,
        /** Tracker for instant.collisions */
        collisions: 0,
        /** Tracker for instant.mass */
        mass: 0,
        /** Tracker for instant.cloud */
        cloud: 0,
        /** Tracker for instant.polarity */
        polarity: 0,

        /** Tracker for instant.particles */
        particles: 0,//UNUSED currently (code exists to keep track)
    };
}

/**
 * At the end of every unpaused update cycle, the simulation gathers uses the current particle
 * data to update the appropriate statistics. Note that while individual particle data is collected
 * by the simulation in statistics, this call is expected following every tick because the data
 * gets aggregated. In addition, all of the logs are updated. 
 *
 * @param {Object} simulation        the simulation from which to read data from
 */
Statistics.prototype.update = function(simulation)
{   //memory references
    var log = this.log;
    var time = this.time;
    var maximum = this.maximum;
    var current = this.current;
    var instant = this.instant;
    var updatediffs = this.updatediffs;
    var qmerge = simulation.controls.dynamic.toggle.quantaMerge;
    var monads = simulation.monads;
    var zones = simulation.zones;

    //local variables
    var particle = null;
    var index = 0;
    var quanta = instant.particles-instant.monads;
    var mass = 0;
    var display = this.clear || time.first || !time.subsequent;

    //distance tracking
    var monadA = monads[0];
    var monadB = monads[1];
    var massA = monadA.getMass();
    var massB = monadB.getMass();

    //update instant and maximum values
    instant.acharge = instant.acharge / instant.monads;
    instant.mcharge = instant.mcharge / instant.mass;
    instant.polarity = ((instant.polarity/instant.monads) - 0.5) * 2;
    instant.pcharge = (instant.pcharge + (instant.monads * 0.5)) / instant.monads;
    instant.cloud = quanta ? instant.cloud/quanta : NaN;
    maximum.mass = Math.max(maximum.mass, instant.mass);
    maximum.monads = Math.max(maximum.monads, instant.monads);
    maximum.velocity = (qmerge ? simulation.MAX : instant.monads) * simulation.controls.dynamic.maxSpeed;

    //update logs
    log.charge.push(instant.cloud || 0);
    log.mcharge.push(instant.mcharge);
    log.distance.push(massA > 0 && massB > 0 ? monadA.getToroidDistanceTo(monadB,simulation.zones.size,0) : 0);
    log.distcharge.push((monadA.quanta.attractons + monadB.quanta.attractons) / (massA+massB));
    log.mmass.push(instant.mass);
    log.temperature.push(instant.velocity);
    log.tempcharge.push(instant.velplus / (instant.velplus + instant.velneg));
    log.monads.push(instant.monads);
    log.polarity.push(instant.polarity*100 || -1);
    log.pcharge.push(instant.pcharge);
    log.acharge.push(instant.acharge);

    //update computationally heavy statistics: occupation checking
    if (display || this.checkTick(updatediffs.occupied)) {
        //memory references
        var monads = simulation.monads;
        var cmonads = current.monads;
        var zones = simulation.zones.array;
        var length = simulation.zones.length;

        //local variables
        var monad = null;
        var occupied = 0;
        var localmass = 0;
        var localcharge = 0;
        var totalcharge = 0;
        var monadOccupied = 0;
        var zone = [];
        var len = 0;
        var index = 0;
        
        for (var x = 0; x < length; x++)  for (var y = 0; y < length; y++)   for (var z = 0; z < length; z++) {
            zone = zones[x][y][z];
            len = zone[0];
            if (len > 0) {
                occupied++; 
                localcharge = localmass = 0;
                for (var p = 1; p <= len; p++) {//because the first index of any zone is the occupancy length
                    monad = monads[zone[p]];
                    mass = monad.getMass();
                    localmass += mass;
                    localcharge += (monad.quanta.attractons/mass) * mass;
                    // if (monads[zone[p]].getMass() > 1) {
                    //     monadOccupied++;
                    //     break;
                    // }
                }
                totalcharge += localcharge / localmass;
            }
        }
        log.occupancy.push(occupied);
        log.moccupancy.push(totalcharge/occupied);
    }

    //update computationally heavy statistics: monad sizing and sorting
    if (display || this.checkTick(updatediffs.monads)) {
        current.monads = [];
        cmonads = current.monads;

        for (p = 0; p < simulation.MAX; p++) {
            particle = monads[p];
            mass = particle.getMass();
            if (mass > 1 || (qmerge && mass))
                cmonads.push({mass: mass, charge: particle.quanta.attractons / mass, index: particle.index});
        }

        cmonads.sort(function(a,b) {return a.mass-b.mass || a.index-b.index}); //sort by weight then index
    }

    this.tick++;
    this.render = true;//prevents stats render until at least one update gamut has commenced
}

/**
 * Checks whether a given frequency difference should allow an update or not.
 * 
 * @param {int} diff the frequency: -1 for running every cycle
 *                                  0  for running every tick
 *                                  Infinity for running only once
 *                                  [0,Infinity) for running every cycle but offset
 * 
 * @return {boolean} whether the given frequency difference validates an updated
 */
Statistics.prototype.checkTick = function(diff)
{
    switch(diff) {
        case -1: return !(this.tick%this.cycle);
        case 0: return true;
        case Infinity: return false;
        default: return !((diff+this.tick)%this.cycle);
    }
}

/**
 * If possible, returns a unique offset value from the statistics cycle. This allows certain charts
 * to update once a cycle but without any competing updates to improve simulation smoothness.
 * The diffs array is used to store already picked random offsets; once the array is full 
 * (every tick has an operation heavy data gathering), simply random offsets are returned.
 * 
 * @param {int} freq  0<=Z  the frequency limit, where a random diff at or below the frequency
 *                          will be returned
 * 
 * @return {int} a random frequency offset that is unique if stats.diffs isn't full
 */
Statistics.prototype.getDiff = function(freq) 
{
    var count = 0;
    var diff = 0;
    var diffs = this.diffs;
    var index = diffs.indexOf(diff);

    do diff = Math.ceil(Math.random() * (freq-1));
    while (diffs.indexOf(diff) > -1 || ++count < freq);

    if (index > -1) diffs[index] = diff;
    return diff; //no slots found, just give a random one
}

/**
 * Simply switches whether all panels/charts are visible or not. If not given an opacity argument,
 * sets opacity to default (0.9).
 * 
 * @param {float} [opacity]   [0,1]   opacity the panels should be
 */
Statistics.prototype.changeVisibility = function(opacity)
{
    var dom = this.monitor.dom;
    for (var d = 0; d < dom.length; d++)
        dom[d].style.opacity = dom[d].style.opacity > 0 ? 0 : (opacity || this.opacity);
}



/**************************************************************/
/**************************************************************/
/*******************		MONITOR 		*******************/
/**************************************************************/
/**************************************************************/

/**
 * The original stats.min.js visual object, now modified to be prototypal and work with the simulation.
 * Creates the layout elements to hold all visual panels, then creates all of the panels and charts
 * to be used in the simulation. Once everything has been instantiated, the monitor object is only
 * responsible for updating the panels when appropriate.
 * 
 * @param {Statistics} stats the statistics object
 */
function Monitor(stats)
{
    /** Adds a panel to a specified group and if the panel has a function defined, places it in update queue. */
    function addPanel(group,panel) {
        if (panel.process != undefined) check.push(panel); //only add to checklist if there's a function to run
        group.appendChild(panel.dom);
    }

    //elements and update list/queue
    var check = [];
    var c = document.createElement("div");
    var c2 = document.createElement("div");
    var c3 = document.createElement("div");
    var c4 = document.createElement("div");
    var c5 = document.createElement("div");
    
    //positions and styles of panels/charts groups
    c.style.cssText = "position:relative;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000;float:left";
    c2.style.cssText = "position:fixed;bottom:3px;left:206px;margin-bottom:25px;cursor:pointer;opacity:0.9;z-index:10000";
    c3.style.cssText = "position:fixed;bottom:3px;left:386px;margin-bottom:25px;cursor:pointer;opacity:0.9;z-index:10000";
    c4.style.cssText = "position:fixed;bottom:0;left:566px;margin-bottom:25px;cursor:pointer;opacity:0.9;z-index:10000";
    c5.style.cssText = "position:relative;top:0;right:0;cursor:pointer;opacity:1.0;z-index:10000;float:right";

    //only properties of Monitor
    this.REVISION = 17;
    this.dom = [c,c2,c3,c4,c5];
    this.check = check;
    this.stats = stats;
    this.domElement = c;

    //start off times
    stats.time.last = (performance || Date).now();
    stats.time.then = stats.time.last;

    //variables just for adding panels
    var freq = stats.cycle;
    var sHeight = 39;
    var sWidth = 180;
    var lHeight = 68;
    var lWidth = 206;

    /** Calculates how many frames are rendered per second (also how many ticks are processed) */
    addPanel(c2,new Panel(stats,0,
        "FPS", "#0ff", "#002", sHeight+1,sWidth,0,null,
            function() { var time = this.stats.time;
                if (time.now <= time.then + time.second) return;
                var fps = time.fps = time.second * time.clock / (time.now - time.then);
                this.update(fps, 120); time.then = time.now; time.clock = 0;
            }));

    /** Calculates the number of milliseconds that have passed since the last update */
    addPanel(c2,new Panel(stats,0,
        "MS", "#0f0", "#020", sHeight,sWidth,0,null,
            function() { var time = this.stats.time;
                this.update(time.now - time.last, 200);
            }));
            
    /** If allowed by browser settings, displays memory usage by the simulation. To allow memory
     * tracking in chrome, start with flag --enable-precise-memory-info */
    addPanel(c2,new Panel(stats,0,
        "MB", "#f08", "#201", sHeight,sWidth,0,null,
            function() { var sperf = self.performance; var time = this.stats.time;
                if (!sperf || !sperf.memory || time.clock) return;
                var mem = performance.memory;
                this.update(mem.usedJSHeapSize / 1048576, mem.jsHeapSizeLimit / 1048576);
            }));
        
    /** Tracks the number of zones occupied by at least one monad as well as the polarity of all
     * zones with every occupied zone weighted equally */
    addPanel(c,new Panel(stats,stats.getDiff(freq),
        "Space Occupancy", "#7ff", "#122", lHeight,lWidth, 0,new ColorHex(-1,'00',1),
            function() { var stats = this.stats; var width = this.screen.offset; var round = Math.round;
                var pixel = 0; var log = stats.log; var occ = log.occupancy;
                var mocc = log.moccupancy; var max = stats.maximum.zoning;
                for (var i = 1; i < width; i++) {
                    pixel = i/width;
                    this.update(occ[round(pixel*(occ.length-1))],
                                max,
                                mocc[round(pixel*(mocc.length-1))] );
                } }));
    
    /** Tracks the total number of quanta as well as their net charge */
    addPanel(c,new Panel(stats,stats.getDiff(freq),
        "Quanta Mass", "#707", "#202", lHeight,lWidth,0,new ColorHex(-1,'00',1),
            function() { var stats = this.stats; var width = this.screen.offset; var round = Math.round;
                var pixel = 0; var instant = stats.instant; var log = stats.log;
                var mass = instant.mass + instant.particles - instant.monads; 
                var mmass = log.mmass; var charge = log.charge; 
                for (var i = 1; i < width; i++) {
                    pixel = i/width;
                    this.update(mass-mmass[round(pixel*(mmass.length-1))],
                                mass,
                                charge[round(pixel*(charge.length-1))] );
                } }));

    /** Tracks the total number of mass contained within all monads (mass > 1) as well as their
     * net weight-based charge */
    addPanel(c,new Panel(stats,stats.getDiff(freq),
        "Monad Mass", "#707", "#202", lHeight, lWidth, 0,new ColorHex(-1,'00',1),
            function() { var stats = this.stats; var width = this.screen.offset; var round = Math.round;
                var pixel = 0; var instant = stats.instant; var log = stats.log;
                var mass = instant.mass + instant.particles - instant.monads; 
                var mmass = log.mmass; var mcharge = log.mcharge; 
                for (var i = 1; i < width; i++) {
                    pixel = i/width;
                    this.update(mmass[round(pixel*(mmass.length-1))],
                                mass,
                                mcharge[round(pixel*(mcharge.length-1))]);
                } }));

    /** Tracks the total number of monads (mass > 1) as well as their net weight-blind charge */
    addPanel(c,new Panel(stats,stats.getDiff(freq),
        "Monad Count", "#f6f", "#212", lHeight, lWidth, 0,new ColorHex(-1,'00',1),
            function() { var stats = this.stats; var width = this.screen.offset; var round = Math.round;
                var pixel = 0; var maximum = stats.maximum.monads; var log = stats.log;
                var monads = log.monads; var acharge = log.acharge; 
                for (var i = 1; i < width; i++) {
                    pixel = i/width;
                    this.update(monads[round(pixel*(monads.length-1))],
                                maximum,
                                acharge[round(pixel*(acharge.length-1))]);
                } }));

    /** Tracks the polarity of all monads (mass > 1) as well as the weight-and-polarity based
     * net charge */
    addPanel(c,new Panel(stats,stats.getDiff(freq),
        "Monad Polarity %", "#7fb", "#231", lHeight,lWidth,0,new ColorHex(-1,'00',1),
            function() { var stats = this.stats; var width = this.screen.offset; var round = Math.round;
                var pixel = 0; var log = stats.log; var polarity = log.polarity; var pcharge = log.pcharge;
                for (var i = 1; i < width; i++) {
                    pixel = i/width;
                    this.update(polarity[round(pixel*(polarity.length-1))],
                                100,
                                pcharge[round(pixel*(pcharge.length-1))]);
                } }));

    /** Tracks the net speed of all monads (mass > 1) as well as the weight-and-speed based
     * net charge */
    addPanel(c,new Panel(stats,stats.getDiff(freq),
        "Temperature", "#f70", "#210", lHeight,lWidth,0,new ColorHex(-1,'00',1),
            function() { var stats = this.stats; var width = this.screen.offset; var round = Math.round;
                var pixel = 0; var maxvel = stats.maximum.velocity; var log = stats.log;
                var temp = log.temperature; var tempcharge = log.tempcharge;
                for (var i = 1; i < width; i++) {
                    pixel = i/width;
                    this.update(temp[round( pixel * (temp.length-1) ) ],
                                maxvel,
                                tempcharge[round( pixel * (tempcharge.length-1) ) ]);
                } }));

    /** Tracks the distance between monad index 0 and 1 as well as their weight-based charge */
    addPanel(c,new Panel(stats,stats.getDiff(freq),
        "Distance m[0] <-> m[1]", "#f0f", "#772", lHeight,lWidth,.5,new ColorHex(-1,'00',1),
            function() { if (!emergence.controls.generation.world.strict) {
                    this.title.text = "Reload in research mode for distance";
                    this.update(0,0,0);
                    return;
                } else this.title.text = "Distance m[0] <-> m[1]";
                var stats = this.stats; var width = this.screen.offset; var round = Math.round;
                var pixel = 0; var log = stats.log; var distance = log.distance;
                var maxdist = stats.maximum.distance; var distcharge = log.distcharge;
                for (var i = 1; i < width; i++) {
                    pixel = i/width;
                    this.update(distance[round(pixel*(distance.length-1))],
                                maxdist,
                                distcharge[round(pixel * (distcharge.length-1))]);
                } }));

    /** Displays the number of bondings that occurred since the last statistics clock tick */
    addPanel(c3,new Panel(stats,0,
        "Bondings/Tick", "#f7f", "#212", sHeight+1,sWidth,0,null,
            function() { var stats = this.stats; var instant = stats.instant; var maximum = stats.maximum;
                maximum.bonds = Math.max(maximum.bonds, instant.bonds);
                this.update(instant.bonds, maximum.bonds || 1);
                instant.bonds = 0;
            }));

    /** Displays the number of emissions that occurred since the last statistics clock tick */
    addPanel(c3,new Panel(stats,0,
        "Emissions/Tick", "#7f7", "#121", sHeight,sWidth,0,null,
            function() { var stats = this.stats; var instant = stats.instant; var maximum = stats.maximum;
                maximum.radiation = Math.max(maximum.radiation, instant.radiation);
                this.update(instant.radiation, maximum.radiation || 1);
                instant.radiation = 0;
            }));

    /** Displays the number of collisions that occurred since the last statistics clock tick */
    addPanel(c3,new Panel(stats,0,
        "Collisions/Tick", "#ff7", "#221", sHeight, sWidth, 0,null,
            function() { var stats = this.stats; var instant = stats.instant; var maximum = stats.maximum;
                maximum.collisions = Math.max(maximum.collisions, instant.collisions || 1);
                this.update(instant.collisions, maximum.collisions || 1);
                instant.collisions = 0;
            }));

    /** Static panel simply displaying color gradients in relation to their charge */
    addPanel(c4,new Panel(stats,Infinity,
        "+  Charge Colors  - 1  ", "#707", "#000", lHeight+50,107,.5,new ColorHex(-1,'00',1),
            function() { for (var i = 100; i >= 0; i--) this.update(i,100,i/100);
                this.update(1,100,-1);
            }));
                
    /** Displays approximation of monads ordered by weight and colored by charge */
    addPanel(c4,new Panel(stats,stats.getDiff(freq),
        "Monad Size Distribution", "#378", "#123", lHeight+50, lWidth+200, 0,new ColorHex(-1,'00',1),
            function() { var stats = this.stats; var width = this.screen.width; var max = stats.maximum.heaviest;
                var pixel = null; var monads = stats.current.monads; var instant = stats.instant; var floor = Math.floor;
                for (var i = 0; i < width; i++) {
                    pixel = monads[floor((i/width)*monads.length)];
                    if (pixel) this.update(pixel.mass,
                                           max,
                                           pixel.charge);
                } this.update(instant.mass / instant.monads,max,-1); }));

    /** Blank right side panel so when controls are fully opened it looks flush with the side */
    addPanel(c5,new Panel(stats,Infinity," ", "#ff0", "#000", 1080,15));

    // Stack 'em the right way
    for (var d = 0; d < c.children.length; d++) c.children[d].style.display = "block";
    for (var d = 0; d < c2.children.length; d++) c2.children[d].style.display = "block"
    for (var d = 0; d < c3.children.length; d++) c3.children[d].style.display = "block";
    for (var d = 0; d < c4.children.length; d++) c4.children[d].style.display = "inline";
}

/**
 * Updates the simulation constantly and asynchronously (except for certain ticks; see statistics
 * for more details). Updates internal statistics-only time values and then cycles through all
 * panels and charts that have defined functions--any chart whose check tick operation returns
 * valid will be updated this statistics clock tick (this can be anywhere from constant/every
 * clock tick to occasionally to once or never). Most of the original monitor workload has been
 * ported into individual panels and charts and the contained statistics object.
 */
Monitor.prototype.update = function()
{   //memory references
    var stats = this.stats;
    var time = stats.time;
    var check = this.check;
    
    var display = false;

    //advance clock and set time
    time.clock++;
    time.now = (performance || Date).now();

    if (stats.render) {//allowed to render
        //if any of these are true, all panels should be forced to render
        display = stats.clear || time.first || !time.subsequent || stats.redraw;

        for (var panel = 0; panel < check.length; panel++) //cycle through all panels
            if (display || stats.checkTick(check[panel].freq))//check whether to process update
                check[panel].process();//update if necessary

        if (DEBUG) debug("stats",stats);

        //change time values and some stat rendering values
        stats.clear = stats.redraw = false;
        if (!time.first) time.subsequent = true;
        time.last = time.now;
    }
}



/**************************************************************/
/**************************************************************/
/*******************		PANEL    		*******************/
/**************************************************************/
/**************************************************************/

/**
 * Based off of the original panel object from stats.min.js, this prototypal panel handles all of
 * the data rendering needs for statistics. A panel can be of any arbitrary height and width with
 * any possible 6-hex color values for different aspects of the panel. The panel doesn't store
 * any data other than what it is immediately processing--it must be updated every time a new data
 * point is desired to be rendered. Once enough data is in the panel screen such that it is filled
 * up, the panel cycles again, either shifting all elements to the left to make room for one new
 * one, or if updated entirely in one tick, replaces all actively rendered data with new data.
 * The panel can hold a bit less than width data and display a bit less than height difference between
 * data.
 * 
 * @param {Statistics} stats        the statistics object, which most panels will use to read data
 * @param {int} freq                how frequent to run:    -1 for running every cycle
 *                                                          0  for running every tick
 *                                                          Infinity for running only once
 *                                                          [0,Infinity) for running every cycle but offset
 * @param {String} title            what text should appear to mark the panel
 * @param {fillStyle} foreground    foreground color--the title, current,high,low (and data if rgb isn't specified)
 * @param {fillStyle} background    background color--used for back pane, edges, and shading over panel
 * @param {int} height              the unadjusted height for the panel--roughly the difference between data
 *                                  points that can be displayed
 * @param {int} width               the unadjusted width for the panel--roughly the amount of data bars that
 *                                  can be displayed
 * @param {int} [midline]           a (0,1] value indicating where to put a white line through data
 * @param {ColorHex} [rgb]          instructions for how to color different data values
 * @param {function} [method]       function on how to calculate data--lack of this will mean a static panel;
 *                                  note that the function is expected to call this.update(...)
 */
function Panel(stats,freq, title, foreground, background, height,width,midline,rgb,method)
{
    /** Memory reference to stats */
    this.stats = stats;
    /** Frequency difference update: -1 for cycle, 0 for constant, Infinity for never, and other numbers for % random cycle */
    this.freq = freq;
    /** Pixel measurement per monitor */
    this.pixel = Math.round(window.devicePixelRatio || 1);
    /** Where to place a line across the data panel */
    this.midline = midline || 0;
    /** The method to update data values on the panel */
    this.process = method; 
    /** The lowest value passed into the update function */
    this.low = Infinity;
    /** The highest value passed into the update function */
    this.high = -Infinity;
    /** Arbitrary value for use by each chart/panel */
    this.mode = 0;

    var pixel = this.pixel;
    width *= pixel;
    height *= pixel;
    
    /** Dimensions of the entire panel, including edges, data, and title */
    this.dimensions = {
        /** Width of the panel */
        width: width,
        /** Height of the panel */
        height: height
    };

    /** Title information for displaying the title */
    this.title = {
        /** Text or the name to put on the panel */
        text: title,
        /** Width border around the title */
        width: 3 * pixel,
        /** Height border of the title */
        height: 2 * pixel
    };

    /** Sizes for the edges of the panel */
    this.edges = {
        /** Bottom and both sides width */
        width: 3 * pixel,
        /** Top of panel width */
        height: 15 * pixel
    };

    /** Dimensions for the data screen itself */
    this.screen = {
        /** Width of the screen */
        width: width - (2 * this.edges.width),
        /** Height of the  */
        height: height - (this.edges.width + this.edges.height),
        /** How many data points to assume in rendering */
        offset: width - (2 * this.edges.width) + 1
    };

    /** Color information for panel and screen */
    this.colors = {
        /** Background color for edges, backpane, and coverup */
        background: background,
        /** Foreground color for the title, tracking numbers, and data if no rgb indicated */
        foreground: foreground,
        /** ColorHex values for coloring data bars*/
        rgb: rgb,
        /** Negative value for hex coloring */
        hexn: 0,
        /** Positive value for hex coloring */
        hexp: 0,
        /** Hexadecimal values for quick array access */
        hex: ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'],//for color schemes
        /** Length of hexadecimal array */
        len: 16,
        /** Squared length of hexadecimal array */
        len2: Math.pow(16,2)
    };

    /** The canvas element that makes up the panel */
    this.panel = document.createElement("canvas");
    var panel = this.panel;
    panel.width = width;
    panel.height = height;
    panel.style.cssText = "width:" + width + "px;height:" + height + "px";

    /** Context for drawing on the panel */
    this.context = panel.getContext("2d");
    var context = this.context;
    context.font = "bold " + 9 * pixel + "px Helvetica,Arial,sans-serif";
    context.textBaseline = "top";
    context.fillStyle =  stats.twoTone ? "#808" : background;
    context.fillRect(0, 0, width, height);//background for entire panel done just once

    /** Dom for panel */
    this.dom = panel;
};

/**
 * Performs the calculations for an individual channel (red, green, or blue) based on the already
 * stored positive and negative hex values. Time saving function that simply works with the 
 * ColorHex's stored values to produce either the positive value, negative value, or 
 * pre-determined color value for a channel. Note that the channel need not be known.
 * 
 * @param {int|String} color    either -1 for negative displaying color value
 *                                      1 for positive displaying color value
 *                                      or a 2-character string value containing hex characters
 *                                          for displaying a static color value
 * 
 * @return {String} a 2-character string of hex values representing the color value to display
 */
Panel.prototype.hexval = function(color) {
    var colors = this.colors; var hex = colors.hex; var hexn = colors.hexn; var hexp = colors.hexp; var len = colors.len; 
    switch(color) {
        case -1: return hex[Math.floor(hexn/len)] + hex[hexn%len];
        case 1:  return hex[Math.floor(hexp/len)] + hex[hexp%len];
        default: return color;
    }
}

/**
 * Updates the calling panel immediately with one new color bar, shifting previous values if
 * necessary. The update must consist of the current value for the next bar, the maximum
 * possible value, and the shade (optional) to paint the new data bar.
 * 
 * Whenever stats.clear is set to true, the panel's screen, highs, and lows are reset
 * 
 * @param {int} curr    current value of the next data bar to display--the shows as the bar's height
 * @param {int} maxPossible for the current bar, what should be considered the max value attainable
 * @param {float} [shade] [0,1] value representing the degree of negativity of positivity to display
 *                      numbers below 0.5 will emphasize the negative colors, numbers above 0.5
 *                      will emphasize the positive colors
 */
Panel.prototype.update = function(curr, maxPossible, shade)
{
    if (isNaN(curr) || isNaN(maxPossible) || curr < 0 || maxPossible < 0) return;
    //memory references
    var round = Math.round;
    var floor = Math.floor;
    var min = Math.min;
    var max = Math.max;
    var title = this.title;
    var colors = this.colors;
    var rgb = colors.rgb;
    var len2 = colors.len2;
    var background = colors.background;
    var edges = this.edges;
    var side = edges.width;
    var top = edges.height;
    var screen = this.screen;
    var width = screen.width;
    var height = screen.height;
    var pixel = this.pixel;
    var context = this.context;
    var stats = this.stats;
    var clear = stats.clear;
    var bw = stats.twoTone;

    //set current value var, low, and high
    var bar = round((1 - curr / maxPossible) * height);
    this.low = clear ? Infinity : min(this.low, curr);
    this.high = clear ? -Infinity : max(this.high, curr);

    //title draw and background
    context.globalAlpha = 1;
    context.fillStyle =  bw ? "#808" : background;
    context.fillRect(0, 0, this.dimensions.width, top); //cover up old title
    context.fillStyle = bw ? "#fff" : colors.foreground;
    context.fillText(round(curr) + " " + title.text + " (" + round(this.low) + "-" + round(this.high) + ")", title.width, title.height); //new title bar
    context.drawImage(this.panel, side + pixel, top, width - pixel, height, side, top, width - pixel, height);

    //color whole bar
    if (shade != undefined) {//shade present so let's color that; otherwise, foreground color used
        if (shade >= 0) shade = max(0.001, min(shade, 0.999));//limit shade to acceptable values
        colors.hexp = floor(len2 * shade);
        colors.hexn = floor(len2 * (1-shade));
        context.fillStyle = (clear === -1 || shade === -1) ? (bw ? "#800080" : "#000000") : //get colors to fill
            "#" + (bw ? (this.hexval(1) + this.hexval(1) + this.hexval(1)) :
                        (this.hexval(rgb.r) + this.hexval(rgb.g) + this.hexval(rgb.b)));
    }
    context.fillRect(side + width - pixel, top + bar, pixel, height - bar);

    //midline if applicable
    if (this.midline) {
        context.fillStyle = bw ? "#f00" : "#fff";
        context.fillRect(3*pixel,height/2+15*pixel,width,1);
    }

    //color over top of bar to show height
    context.fillStyle = bw ? "#808" : background;
    context.fillRect(side + width - pixel, top, pixel, bar);
    context.fillStyle = "#000";
    context.globalAlpha = .2;//transparent sheet to distinguish screen from panel
    context.fillRect(side + width - pixel, top, pixel, bar);
};

/**
 * Color object (differentiated from three.js color because this is meant to only have three
 * data pieces which can be string or int but are not meant to be converted). This is used
 * exclusively for giving any panel or chart a unique linear color scheme with almost
 * any color shift possible given the parameters, which will change the color based on
 * input data values (see Panel.hexval). A -1 value will be increased with reduced
 * data values; a 1 value will be increased with increased data values; a 2-hex string will
 * stay constant regardless of data values.
 * 
 * @param {int|string} r    red value, either -1,1, or a 2-hex value
 * @param {int|string} g    green value, either -1,1, or a 2-hex value
 * @param {int|string} b    blue value, either -1,1, or a 2-hex value
 */
function ColorHex(r,g,b) {
    this.r = r;
    this.g = g;
    this.b = b;
}