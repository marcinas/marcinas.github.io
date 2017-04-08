/**
 * Emergence Simulation
 * @author Marceline Peters / https://github.com/marcinas
 * January - April 2017
 * University of Washington, Tacoma
 * see readme for additional credits
 */



/**************************************************************/
/**************************************************************/
/*******************        ZONES       	*******************/
/**************************************************************/
/**************************************************************/

/**
 * The purpose of the zones object is to be an intermediary between emergence-monad and monad-monad
 * relationships for anything involving positioning or collision detection. Zones splits the
 * cubic environment of the simulation into an n x n x n grid of zones, each zone having identical
 * s x s x s size and perfectly positioned against adjacent zones. These zones allow individual 
 * particles to have not only their simulation-wide coordinates, but also be a member of only one
 * zone at a time. Zone membership allow particles to perform collision or distance checks on
 * a much reduced arena size and still have 100% detected particle interactions.
 * 
 * @param {Statistics} statistics   a statistics object that the zones will use for data
 * @param {Controls} controls       the controls object
 * @param {Monad[]} monads     monads array from Simulation
 */
function Zones(statistics,controls,monads)
{
    /** Statistics object memory reference */
    this.stats = statistics;
    /** Controls object memory reference */
    this.controls = controls;
    /** Array of monads in simulation */
    this.monads = monads;
    /** The radius the simulation will be */
    this.size = this.controls.generation.world.radius;
    /** The size that each zone will be (s value in s x s x s) */
    this.zoning = this.controls.generation.world.zoning;
    /** The maximum amount of monads possible */
    this.max = this.monads.length;
    /** Contains index numbers of monads that are currently free */
    this.freeslots = new Array(this.max).fill(-1);
    /** Contains index numbers of emitted quanta in order from timeOld to timeNew */
    this.timeslots = new Array(this.max).fill(-1);
    /** How many slots are free in freeslots */
    this.free = 0;
    /** Starting index (oldest quanta) in timeslots */
    this.timeOld = 0;
    /** Ending index (newest quanta+1) in timeslots */
    this.timeNew = 0;
    /** How many zones per side */
    this.length = Math.ceil((this.size * 2) / this.zoning);
    /** Crossover -1,0,1 array for collision detection */
    this.crossover = { x: [0, 0], y: [0, 0], z: [0, 0] };
    /** Spare vector array for collision detection */
    this.holdover = new THREE.Vector3();
    /** The array of zones itself (because zones itself is basically a specialized array)*/
    this.array = [];
    /** The maximum distance possible between two 0-mass particles, or set maxdist to half of the distance between two opposite (1,1,1 vs -1,-1,-1) corners of the world cube */
    this.maxdist = this.size * Math.pow(3,1/2);

    var length = this.length;//memory reference
    this.stats.maximum.zoning = Math.pow(length,3); //number of zones in this environment
    this.stats.maximum.distance = this.maxdist;
    var inilen = length <= 50 ? 32 : (length <= 100 ? 16 : 8); //how big to preset zones arrays (helps with memory management)

    //set up the zones 
    for (var x = 0; x < length; x++) {
        this.array.push([]);
        for (var y = 0; y < length; y++) {
            this.array[x].push([]);
            for (var z = 0; z < length; z++) {
                this.array[x][y].push(new Array(inilen).fill(-1));
                this.array[x][y][z][0] = 0; //slot 0 is the fill length of the following array[1..n]
            }
        }
    }
}

/**
 * Checks the parameter particle's position to see whether it has changed zones. If it has, change
 * the particle's zone and update the zone itself as well.
 * 
 * @param {Monad} monad the monad whose position to check
 */
Zones.prototype.updateZone = function(monad)
{   //memory references
    var floor = Math.floor;
    var pos = monad.position;
    var zone = monad.zone;
    var size = this.size;
    var zoning = this.zoning;

    //recalculate zones
    var x = floor((pos.x + size) / zoning);
    var y = floor((pos.y + size) / zoning);
    var z = floor((pos.z + size) / zoning);
    
    if (x != zone.x || y != zone.y || z != zone.z) {//at least one coordinate different
        if (zone.i > 0) //particle had previous zone
            this.clearFromZone(monad);
        zone.x = x;//set new zone
        zone.y = y;
        zone.z = z;
        this.addToZone(monad);
    }
}

/**
 * Performs operations to clear a particle from a zone on the Zones side of the equation.
 * Sets particle's and zone's indexes accordingly.
 * 
 * @param {Monad} monad the monad whose zone to clear
 */
Zones.prototype.clearFromZone = function(monad)
{   //memory reference
    var mzone = monad.zone;

    if (mzone.x >= 0 && mzone.y >= 0 && mzone.z >= 0) { //particle zones
        var zone = this.array[mzone.x][mzone.y][mzone.z];
        var i = mzone.i;
        zone[i] = zone[zone[0]--]; //switch last particle index with this one and 'delete' it by reducing length of zone list
        if (zone[0]) //if zone not empty now
            this.monads[zone[i]].zone.i = i; //update the swapped monad's index as well to match new one
    }
    //mzone.x = mzone.y = mzone.z = -1; //now only check zone.i for accuracy
    mzone.i = -1; //parameter monad is zoneless
    this.stats.instant.occupancy++;
}

/**
 * Performs operations to add a particle to a zone on the Zones side of the equation.
 * Sets particle's and zone's indexes accordingly.
 * 
 * @param {Monad} monad the monad whose zone to clear
 */
Zones.prototype.addToZone = function(monad)
{   //memory references
    var mzone = monad.zone;
    var zone = this.array[mzone.x][mzone.y][mzone.z];

    mzone.i = ++zone[0]; //set index of monad's zone to the next open zone slot (done by incremented the length and returning length)
    zone[mzone.i] = monad.index; //set zone at index monad.zone.i to the monad's simulation.monads array index
}

/**
 * Performs operations to add an index to the freeslots array. Additionally, removes parameter
 * monad's index from timeslots if it is in there (meaning it is an emitted quanta)
 * 
 * @param {Monad} monad the monad whose slot to add to freeslots
 */
Zones.prototype.addFreeSlot = function(monad) 
{   //memory reference
    var timeslots = this.timeslots;

    if (monad.slot > -1) //monad was in timeslots
        monad.slot = timeslots[monad.slot] = -1;
    this.freeslots[this.free++] = monad.index;//set freeslots at index length to monad index, then increment length
    this.stats.instant.particles--;
}

/**
 * Returns the index of the next available particle (one that isn't being rendered). 
 * As of now, assumes that next free slot will be filled with a quanta (mass = 1) because there is
 * no way in the simulation that a monad will be spontaneously created (as opposed to two quanta
 * merging).
 * 
 * @param {float} buffer  the amount of particles that shouldn't be displaced
 * 
 * @return {int} the slot (index) of the next free particle or -1 if all particles allowable are being rendered
 */
Zones.prototype.nextFreeSlot = function(buffer)
{   //memory references
    var min = Math.min;
    var timeslots = this.timeslots;
    var freeslots = this.freeslots;
    var instant = this.stats.instant;
    var maximum = this.stats.maximum;
    var monads = this.monads;
    var toggle = this.controls.dynamic.toggle;

    //local variables
    var parent = null;
    var slot = -1;
    var count = 0;
    var monad = null;

    if (this.free <= buffer) {//we do not have enough free particles
        if (!toggle.displacement) return -1;//displacement off, we cannot remove old quanta
        if (DEBUG) debug(['system','reabsorption'],['free',this.free,'times',this.timeOld,this.timeNew,'timeslots\n',this.timeslots.toString()]);

        do { slot = timeslots[this.timeOld]; //find first valid timeslot
             if (DEBUG) debug(['system','reabsorption'],['slot',slot]);
             if (++count >= min(timeslots.length, 1024)) return -1; //we have searched through too many particles; retreat
             if (slot > -1) monad = monads[slot]; //fetch monad
             timeslots[this.timeOld++] = -1; //clear old index slot
             if (this.timeOld >= timeslots.length) this.timeOld = 0; //reset timeOld so it loops around array
        } while (slot === -1 || monad.quanta.radius === 0 || monad.getMass() > 1); //until valid monad found

        if (toggle.reabsorption && monad.parentIndex >= 0) { //reabsorption is enabled and this quanta has a parent
            parent = monads[monad.parentIndex]; //fetch parent
            if (parent.getMass() > 1) {//return quanta unless parent is also quanta
                if (monad.quanta.attractons > 0)
                    parent.quanta.attractons++;
                else parent.quanta.repulsons++;
            }
        }
        monad.nullify();
    }

    slot = freeslots[--this.free]; //get next free slot and 'delete' by reducing list length
    freeslots[this.free] = -1; //clear list end
    instant.particles++;
    maximum.particles = Math.max(maximum.particles, instant.particles);

    while (timeslots[this.timeNew] != -1) //timeslots end pointer points to valid quanta
        if (++this.timeNew >= timeslots.length) //increment timeNew until empty timeslot found
            this.timeNew = 0; //set to 0 so it loops around array

    timeslots[this.timeNew] = slot; //store index
    this.monads[slot].slot = this.timeNew++; //store timeslot slot in monad
    if (this.timeNew >= timeslots.length) this.timeNew = 0; //reset timenew so it loops around array

    return slot;
}



/**************************************************************/
/**************************************************************/
/*******************       COLLISION    	*******************/
/**************************************************************/
/**************************************************************/

/**
 * For a given particle, checks collision among all possible colliding particles. Does so by
 * checking the particle's zone as well as many adjacent (and further) zones that fall within
 * a calculation done to the particle's radius; this ensures nothing the particle intersects with
 * (should collide with) is missed. Note that the way this is written, larger particles will be
 * the ones responsible for checking collision on smaller particles (because no particle searches
 * beyond its own radius doubled--e.g., searches as far as assuming the biggest particle it will
 * collide with is another of identical size).
 * 
 * @param {Monad} monad the particle whose collision to check 
 * 
 * @return {boolean} true if particle was absorbed or compromised in collision,
 *                    false otherwise (collisions where parameter monad stays intact)                                                   
 */
Zones.prototype.checkCollisions = function(monad)
{   //memory references
    var abs = Math.abs;
    var size = this.size;
    var zoning = this.zoning;
    var length = this.length;
    var crossover = this.crossover;
    var pos = monad.position;    
    var radius = monad.quanta.radius;
    var zone = monad.zone;
    var x = zone.x, y = zone.y, z = zone.z;

    //local variables
    var x2=0, y2=0, z2=0;
    var xi=0, yi=0, zi=0;
    var xcross = false, ycross=false, zcross=false;
    var difs = null;
    var shift = 0;
    var crosses = 0;
    var oob = 0;
    crossover.x[0] = crossover.x[1] = crossover.y[0] = crossover.y[1] = crossover.z[0] = crossover.z[1] = 0;

    /**
     * Crossover checks how many zones must be searched to ensure all collisions are found.
     * Currently, only checks for zones when a particle's radius is less than half the zone's size,
     * ensuring that all particles whose maximum intersection is 8 zones search only zones they
     * intersect with. An ideal algorithm would scale this up to an infinite amount of zones.
     * For now, if a particle's radius is at least half of the zone's size, the algorithm
     * will set crosses negative for however many zoning size halves its radius envelops.
     */
    if (radius >= (zoning/2)) crosses = -Math.floor(radius / (zoning/2)); //particle is larger than current algorithm can subdivide
    else { //radius indicates 8 zones or fewer can be searched
        if (pos.x - radius <= x * zoning - size) { crossover.x[0] = -1; crosses++; }
        else crossover.x[0] = 0;
        if (pos.x + radius >= (x + 1) * zoning - size) { crossover.x[1] = 1; crosses++; }
        else crossover.x[1] = 0;
        if (pos.y - radius <= y * zoning - size) { crossover.y[0] = -1; crosses++; }
        else crossover.y[0] = 0;
        if (pos.y + radius >= (y + 1) * zoning - size) { crossover.y[1] = 1; crosses++; }
        else crossover.y[1] = 0;
        if (pos.z - radius <= z * zoning - size) { crossover.z[0] = -1; crosses++; }
        else crossover.z[0] = 0;
        if (pos.z + radius >= (z + 1) * zoning - size) { crossover.z[1] = 1; crosses++; }
        else crossover.z[1] = 0;
    }

    //particle is larger than crossover algorithm can neatly divide
    if (crosses < 0) {
        crosses *= -1;
        side = 3 + (crosses * 2);
        if (side >= length || Math.pow(side,3) >= this.max) { //particle is so big it may overlap all zones
            if (DEBUG) debug(["system","crossover"],["MONAD",monad.index,monad,crosses*-1,crossover]);
            if (this.collideInZone(monad,[this.max],size)) return true;//check collision with every particle in simulation
            return false;
        } else crosses++; //particle isn't huge enough to overlap everything, so simply increase its range
    } else if (crosses > 0) crosses = 1; //particle is small enough that crossover algorithm can neatly divide

    if (DEBUG) debug(["system","crossover"],["MONAD",monad.index,monad,crosses,crossover]);
    oob = zoning * crosses * (crosses <= 1 ? 1 : 2);
    /**
     * As long as particle wasn't big enough to check every other particle's collision (see above),
     * it gets filtered here. Note that this is the most processor hungry function in the simulation
     * (because almost every particle runs this). xi, yi, and zi represent how many zones to move
     * over for an axis (e.g., xi,yi,zi = 1,0,-1 means to check the zone to the lower-right of current).
     * This function also neatly handles no-zone overlap particles, partial-zone overlap particles,
     * and large particles that overlap many zones (once a particle goes beyond 8 zones, it will check
     * the lowest amount of zones that make sense, starting with a 5x5x5 cube, then a 7x7x7 cube,
     * and onwards until the maximum size is reached; note that there is no 3x3x3 cube, as the
     * algorithm will double the size searched beyond the optimal 8-cube within a 27-cube layout--
     * this means that optimal simulations will run so that most or all particles have a radius less
     * than half of the zoning size).
     */
    for (xi = x - crosses; xi <= x + crosses; xi++) for (yi = y - crosses; yi <= y + crosses; yi++) for (zi = z - crosses; zi <= z + crosses; zi++) {
        if (crosses === 1) { //only check crossover zone reduction for particles that cross <= 8 zones based on radius estimate
            difs = { x: xi - x, y: yi - y, z: zi - z }; //find which axises are not origin axis (zone.x/y/z = 0)
            shift = abs(difs.x) + abs(difs.y) + abs(difs.z); //find out how many axis are not origin
            //determine whether the crosses match crossover determined by radius
            xcross = difs.x && (crossover.x[0] == difs.x || crossover.x[1] == difs.x);
            ycross = difs.y && (crossover.y[0] == difs.y || crossover.y[1] == difs.y);
            zcross = difs.z && (crossover.z[0] == difs.z || crossover.z[1] == difs.z);

            if (shift != xcross + ycross + zcross) continue;//this zone should not be checked because the radius doesn't overlap
        }
        //check whether this zone wraps around toroid (on the other size)
        x2 = xi < 0 ? length + xi : (xi >= length ? xi - length : xi);
        y2 = yi < 0 ? length + yi : (yi >= length ? yi - length : yi);
        z2 = zi < 0 ? length + zi : (zi >= length ? zi - length : zi);

        if (DEBUG) debug(["system","crossover"],[crossover,'xyz',[x,y,z],'xiyizi',[xi,yi,zi],'x2y2z2',[x2,y2,z2]]);
        if (xi != x2 || yi != y2 || zi != z2) { //zone is wrapped around toroid, check multiple distance measures
            if (this.collideInZone(monad, this.array[x2][y2][z2],oob)) return true;
        } else if (this.collideInZone(monad, this.array[x2][y2][z2],0)) return true; //zone within regular Euclidean geometry space
    }

    return false; //no collisions where this particle got 'merged into' or compromised was found
}

/**
 * Checks whether the given monad collides with any particles in the given zone. Checks all
 * particles within a zone, checks at least one set of coordinates (more if zone wraps around
 * toroid) to determine collision. If collision is detected, this function also calls the
 * appropriate function for the parameter monad so it may collide with the other monad.
 * Note that the out-of-bounds argument (oob) is expected for any zone-wrap-arounds or
 * toroid geometry distance to work.
 * 
 * @param {Monad} monad to check for collision with
 * @param {int[]} zone  the actual int array x-y-z zone to check (from this.array)
 *                          this means zone[0] is the actual length to check
 *                          note that zone can simply be an array of the number of
 *                          monads to check in the simulation unordered monads array
 *                          if it is in the form zone =  [number_of_monads_to_check] (no other array slots)
 * @param {float} oob   how far out of bounds to check for particle overlap toroid wrapping
 *                      if negative, the oob is considered flagged,  which means both Euclidean
 *                      and toroidal distance must be checked
 * 
 * @return {boolean} true if particle was absorbed or compromised in collision,
 *                    false otherwise (there were no collisions or there was
 *                                      a collision where parameter monad stays intact)   
 */
Zones.prototype.collideInZone = function(monad, zone, oob)
{   //memory references
    var random = Math.random;
    var size = this.size;
    var holdover = this.holdover;
    var maximum = this.stats.maximum;
    var oqua = monad.quanta;
    var position = monad.position;
    var index = monad.index;
    var controls = this.controls;
    var toggle = controls.dynamic.toggle;
    var freeze = toggle.freeze;
    var bonding = toggle.bonding;
    var merge = toggle.merging;
    var absorb = toggle.quantaAbsorption;
    var monads = this.monads;
    var ms = controls.dynamic.maxSpeed;
    var collision = controls.visual.display.collision;
    var strict = controls.generation.world.strict;

    //local variables
    var quantaRandPlus = !toggle.quantaCollide && toggle.quantaRandCollide;
    var mass = monad.getMass();
    var radius = monad.quanta.radius * ((quantaRandPlus && mass === 1) ? 2 : 1); //radius is doubled if quantaCollide is turned off but quantaRandCollide is on
    var other = null;
    var radi = 0.0;
    var bound = 0.0;
    var cont = 0;
    var dist = 0.0;
    var col = 0.0;
    var opposition = null;
    var omass = 0;

    /**
     * Check every single particle within a zone and performs the appropriate operations on it to
     * determine whether it should collide with the parameter monad this tick.
     */
    for (v = 1; v <= zone[0]; v++) {
        other = monads[zone[v]] || monads[v-1];//if zone length exceeds particles checkable in zone, check monads
        if (DEBUG) debug(["system","crossover"],['checking: zone,monad,other',zone,monad,other]);
        quanta = other.quanta;
        opposition = other.position;
        if (index === other.index || quanta.countdown < 0 || quanta.radius === 0) continue; //same particle, emitted but unescaped particle, or nonexistant particle
        cont = 0; //once cont reaches 2, this particle is considered to have not been collided with parameter particle
        omass = other.getMass();
        radi = radius + (quanta.radius * ((quantaRandPlus && mass === 1 && omass === 1) ? 2 : 1));

        //check Euclidean distance
        if (oob === 0) { //there is no oob to check so we can spend time coloring pretty things
            dist = position.distanceTo(opposition);
            if ( dist > radi) cont++; //particle is not close enough to collide THIS tick
            //this code checks whether the simulation thinks these two particles will collide NEXT tick
            if ( dist - radi < 2 * ms && (collision || omass === 1)) {
                holdover.x = opposition.x;
                holdover.y = opposition.y;
                holdover.z = opposition.z;
                holdover.add(other.velocity);
                //paints a particle collision colors one frame before if particle assumed to collide next tick
                if ((!bonding || omass === 1) && position.distanceTo(holdover) < radi) {
                    col = 0.5+random()*0.5;
                    other.setColor(col,col,0.0);
                    quanta.countdown = 3;
                }
            }
        } else cont++; //non-flagged oob to check, so don't check regular distance independently for coloring
        
        //check Toroidal distance
        if (oob) {
            if (monad.getToroidDistanceTo(other,size,size - oob) > radi) cont++; //closest toroid distance overlaps
        } else cont++; //no toroidal distance to check, so assume regular distance checked

        if (DEBUG) debug(["system","crossover"],[radi,position.distanceTo(other.position), oob ? monad.getToroidDistanceTo(other,size,size - oob) : 'no oob']);

        if (cont === 2) continue;//no collision detection method found overlapping distances

        if (bonding && monad.bonds.indexOf(other.index) > -1) continue; //in bond group, don't collide

        if (DEBUG) debug(["system","crossover"],"successful collision");
        if (strict && !maximum.bonds && (monad.index === 0 || other.index === 0) && (monad.index === 1 || other.index === 1))
            debug("always","0 <-> 1 Collision: " + this.stats.tick);

        //perform collision appropriate to controls
        if (freeze) {
            if (monad.freeze(other)) return true;
        } else if (bonding && omass > 1) {
            if (monad.bond(other)) return true;
        } else if (merge || (absorb && (mass === 1 ^ omass === 1))) {
            if (monad.merge(other)) return true;
        } else { //if nothing else, just bounce
            if (monad.bounce(other, true)) return true;
        }
        mass = monad.getMass();
        radius = monad.quanta.radius;
    }

    return false; //no collision absorbed this monad or compromised it
}