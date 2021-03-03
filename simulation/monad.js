/**
 * Emergence Simulation System
 * @author Marceline Peters / https://github.com/marcinas
 * see readme for additional credits
 */



/**************************************************************/
/**************************************************************/
/*******************     INITIALIZATION     *******************/
/**************************************************************/
/**************************************************************/

/**
 * The monad object, which is any particle in the system. Each monad is comprised of several
 * aspects that determine its physical (simulation) traits and interactions as well as its
 * appearance visually to the user and finally back-end information that theoretically affects
 * neither physical aspects nor visual appearance but improves performance.
 *
 *      Physical traits
 *          parentIndex     the monad array index of this particle's emission parent, which will
 *                          affect particles physically if reabsorption is enabled (true by default)
 *          quanta: att,rep the number of attractons/repulsons, the basis of interaction rules
 *          quanta: rad     the radius and thus physical boundary of the particle
 *          quanta: e,c<0   the number of unemitted quanta that must emit and emitted quanta wait time
 *          quanta: cha,imp impact effect information including velocity and a+/r- composition
 *          position        contains a 3d vector of the xyz location of the particle's center
 *          velocity        contains a 3d vector of the xyz direction and speed the particle is going
 *
 *      Visual traits
 *          (phys based) quanta: p,n,r, position, & velocity     although manipulable by controls,
 *                                                               these determine base visual appearance
 *          quanta: m,c>=0  indicates coloring options on particles
 *          color           a color vector that stores the rgb color scheme of the particle
 *
 *      Access traits
 *          controls, stats, & zones    are reference-saving addresses
 *          index           indicates a particle's place in monad array; note that because particles
 *                          are processed in ascending numerical order, index will have a very minor
 *                          effect on the physics of the simulation
 *          slot            used to mark placement in timeslots queue so upon non-reabsorption
 *                          nullification the timeslots queue slot for this particle can be reset
 *          check & oob     stores partially or fully completed out of bounds or bonding information
 *                          while technically used for physical trait calculation, these are simply
 *                          time saving references to avoid creating new three.js vectors
 *          zone            contains positional information for reducing collision processing to
 *                          exclude particles well beyond the radius of the colliding particle
 *
 * @param {Geometry} geometry       the three.geometry object that will link vertices and colors
 * @param {Controls} controls       the Controls object the simulation uses
 * @param {Statistics} statistics   the Statistics object the simulation uses
 * @param {Zones} zones             the Zones object the simulation uses
 * @param {int[]} maximum           index 0: repulsons remaining
 *                                  index 1: attractons remaining
 *                                  index 2: mass remaining
 */
function Monad(geometry,controls,statistics,zones,maximum)
{
    /** Controls memory reference */
    this.controls = controls;
    /** Statistics memory reference */
    this.stats = statistics;
    /** Zones memory reference */
    this.zones = zones;
    /** Index of array monad will soon be contained in */
    this.index = geometry.vertices.length;
    /** Active bonds with other monads */
    this.bonds = [];
    /** The monad that originated this particle, -1 if present since genesis */
    this.parentIndex = -1;
    /** Timeslot array slot value index */
    this.slot = -1;
    /** Counting one-tick absorptions */
    this.absorptions = 0;
    /** Spare vector, used for communicating positional and velocity checks in and between functions */
    this.check = new THREE.Vector3();
    /** Out of bounds vector, used for storing out of bounds coordinates */
    this.oob = new THREE.Vector3();
    /** Quanta inner object storing attractons, repulsons, radius, impact information, etc. */
    this.quanta = {
        /** Number of attractons currently in monad */
        attractons: 0,
        /** Number of repulsons currently in monad */
        repulsons: 0,
        /** Radius of the monad at last calculation */
        radius: 0,
        /** Countdown until monad recolor; if negative, also prevents monad from colliding until >=0 */
        countdown: 0,
        /** Over-color countdown, which overrides regular quanta.countdown color parameters */
        mountdown: 0,
        /** The number of quanta that must be emitted by the monad this tick */
        emit: 0,
        /** The charge in range [-1,1] of the last impact emission */
        charge: 0,
        /** Impact vector in x-y-z of where the monad attempts to emit from */
        impact: new THREE.Vector3() };
    /** Position vector; note that position is just pointers to the actual rendering geometry coordinates */
    this.position = geometry.vertices[geometry.vertices.push(new THREE.Vector3(this.controls.NONRENDER_DISTANCE, this.controls.NONRENDER_DISTANCE, this.controls.NONRENDER_DISTANCE))-1];//x,y,z
    /** Velocity vector containing information on how far the particle is to move each tick */
    this.velocity = new THREE.Vector3();
    /** Zone information simply containing the particle's zone coordinates and index */
    this.zone = { x: -1, y: -1, z: -1, /** Index of particle within zone x-y-z */ i: -1 };
    /** Color vector; note that color is just pointers to the actual rendering geometry colors */
    this.color = geometry.colors[geometry.colors.push(new THREE.Color())-1];//r,g,b

    if (maximum[2]) {//this particle has remaining mass to use for initialization
        this.initializeMass(maximum);
        this.initializePosition();
        this.initializeVelocity();
        this.updateColor();
    }
}

/**
 * Called for every particle in the simulation at restart, uses generation control settings to
 * construct every monad that requires mass. Once this function is done, a monad is guaranteed
 * to have some number of attractons and repulsons and a correct radius.
 *
 * @param {int[]} max               index 0: repulsons remaining
 *                                  index 1: attractons remaining
 *                                  index 2: mass remaining
 */
Monad.prototype.initializeMass = function(max)
{   //memory references
    var random = Math.random;
    var mass = this.controls.generation.mass;
    var monad = this.controls.generation.monad;

    //local variables
    var big = random() < mass.balance; //chance a particle with have positive standard deviations
    var neutrality = 0.5 * monad.neutrality + 0.5; //change [-1,1] neutrality to a [0,1] range
    var np = [0,0], bias = 0, count = 0, dif = [0,0];//bias = 0 means negative bias
    var polarity = monad.polarityMin + (random() * Math.max(0,monad.polarityMax - monad.polarityMin));//random polarity between min and max

    //determine total mass
    do count = randGauss(mass.minimum,mass.median,mass.maximum,mass.deviation,mass.variance,mass.inversion, big ? 1 : -1);
    while (big ? (count < mass.median) : (count > mass.median)); //get a gaussian random number that matches big/small balance
    count += mass.randomize * count * random() * (randBool() ? -1 : 1); //up to a factor of 1, randomizes the mass
    count = Math.min(max[2], Math.max(1, Math.round(count)));//make sure count is an int that doesn't exceed max remaining quanta

    //determine neg/pos bias
    if (random() < neutrality)
        bias = 1;//bias of 1 is positive bias

    //determine polarity
    if (neutrality < 0.5) { //flip bias for negative emphasis
        bias = bias ? 0 : 1;
        neutrality *= 1 - polarity; //combine with polarity to get somewhat randomized distribution
    } else neutrality = neutrality + (1 - neutrality) * polarity;

    if (random() >= monad.polarity) //flip bias again randomly based on polarity
        bias = 1;

    //determine +/- of mass
    while (count--) { //notice that every single quanta within every monad has their polarity determined individually
        if (random() < neutrality) //final neutrality customized for this particle
            np[bias]++;
        else np[bias?0:1]++;//0 for neg, 1 for pos
    }

    //ensures that a+/r- stay equal overall if enabled
    if (this.controls.generation.enforceNeutral) {
        dif[0] = np[0] - max[0];
        dif[1] = np[1] - max[1];
        if (dif[0] > 0) np[0] -= dif[0];
        if (dif[1] > 0) np[1] -= dif[1];
    }

    //actually set attracton and repulson values as well as radius
    this.quanta.attractons = np[1];
    this.quanta.repulsons = np[0];
    this.updateRadius();
    if (this.getMass() > 1) this.stats.instant.monads++;
}

/**
 * Initializes a monad's starting position in 3d environment coordinates. Gives each particle
 * randomized coordinates limited by spread until appropriate conditions are found.
 */
Monad.prototype.initializePosition = function()
{   //memory references
    var pos = this.position;
    var spread = this.controls.generation.world.spread;
    var range = spread;
    var center = new THREE.Vector3();

    if (!spread) spread = this.zones.size;

    do {
        pos.x = Math.random() * spread * (randBool() ? 1 : -1);
        pos.y = Math.random() * spread * (randBool() ? 1 : -1);
        pos.z = Math.random() * spread * (randBool() ? 1 : -1);
    } while (range && pos.distanceTo(center) > range);

    this.zones.updateZone(this);
}

/**
 * Initializes a monad's starting velocity as well as its impact velocity and charge if it has
 * a mass > 1. Velocities will follow settings in controls including max speed and previous weight,
 * meaning that monads will be initialized as if they had already been in existence (all velocity
 * directions for impact and charge valid within previous weight constraints can be generated);
 * note however that if monads have an initial velocity, it may not match their impact velocity.
 */
Monad.prototype.initializeVelocity = function()
{   //memory references
    var controls = this.controls;
    var monad = controls.generation.monad;
    var q = this.quanta.impact;
    var v = this.velocity;

    //local variable
    var w = Math.min(this.getMass(), this.controls.dynamic.emission.prevWeight);//previous weight memory with max of monad mass

    if (this.getMass() > 1) { //set up impact charge and velocity
        this.checkVelocity(controls.dynamic.maxSpeed,false);//will randomize velocity as starting velocity is 0
        q.x = v.x;//apply checked randomized velocity to impact velocity memory
        q.y = v.y;
        q.z = v.z;
        this.quanta.charge = (Math.random()*(w-1) * (randBool() ? 1 : -1) + (randBool() ? 1 : -1)) / w;//if w val > 1, then initial charge will be in [-1,1] range; otherwise it's just +/-1
    }

    this.randomizeVelocity(monad.velocity);//re-randomize velocity so it's different than impact
    this.checkVelocity(monad.velocity,false);//check velocity
    v.x *= 1 + Math.random() * v.x * monad.randomizeVelocity;//randomize velocity
    v.y *= 1 + Math.random() * v.y * monad.randomizeVelocity;
    v.z *= 1 + Math.random() * v.z * monad.randomizeVelocity;
    this.checkVelocity(-1,false);//check after randomization again.
}



/**************************************************************/
/**************************************************************/
/*******************       COLLISION        *******************/
/**************************************************************/
/**************************************************************/

/**
 * The calling monad will absorb the parameter particle's impact information, affecting where
 * the calling monad will emit future quanta. Note that this function does not merge or nullify
 * the quanta--it only modifies the calling monad's impact charge and velocity. If the previous
 * weight control is set above 1, the monad will remember multiple impacts and weight each new
 * one accordingly. In addition, for multiple collisions in the same tick, all collisions are
 * averaged out even above the 'memory' limit to ensure no information is disregarded.
 *
 * @param {Monad} quanta    the quanta whose impact to absorb
 */
Monad.prototype.absorb = function(quanta)
{   //memory references
    var v = this.quanta.impact;
    var q = quanta.velocity;
    var u = quanta.quanta;

    //local variables
    var w = Math.min(this.getMass(), Math.max(this.controls.dynamic.emission.prevWeight, ++this.absorptions));//absorptions allow one-tick concurrent collisions to be balanced
    var qw = w-1;

    //affects impact velocity
    v.x = ((v.x * qw) - q.x) / w;
    v.y = ((v.y * qw) - q.y) / w;
    v.z = ((v.z * qw) - q.z) / w;

    //affect impact charge
    this.quanta.charge = ((this.quanta.charge * qw) + (u.attractons ? 1 : (u.repulsons ? -1 : 0))) / w;
}

/**
 * Bonds the calling monad and parameter monad. Depending on settings, the bonding may or may
 * not actually affect the simulation, as the bond isn't a real bond, but just a memory reference
 * for two monads to each other. This function simply adds the monads to each others' bond lists
 * and recolors if appropriate.
 *
 * @param {Monad} other the monad to bond with
 *
 * @return {boolean} false if no errors occurred (will always be false as of current version)
 */
Monad.prototype.bond = function(other)
{   //add bonds
    this.bonds.push(other.index);
    other.bonds.push(this.index);
    if (this.controls.dynamic.bonding.bounce) this.bounce(other, true);
    var col = 0.0;

    //coloring
    if (this.controls.visual.display.bonding) {
        col = 0.75+Math.random()*0.25;
        this.setColor(col,col,col);
        other.setColor(col,col,col);
        this.quanta.countdown = this.quanta.mountdown = 64;
        other.quanta.countdown = other.quanta.mountdown = 64;
    }

    this.stats.instant.bonds++;

    return false; //no error
}

/**
 * Unbonds two monads, regardless of their status to each other. Since bonding is just
 * memory references, the memory references are removed from each monad. Additionally,
 * if the second argument is true, the monads are also merged upon separation (this is used to
 * simulation mass density collapse when two monads overlap too much).
 *
 * @param {Monad} other the monad to unbond with
 * @param {boolean} [collapse]    whether to collapse the two monads into one
 *
 * @return {boolean} true if monad compromised or merged into, false otherwise
 */
Monad.prototype.unbond = function(other,collapse)
{   //remove bonds
    this.bonds.splice(this.bonds.indexOf(other.index),1);
    other.bonds.splice(other.bonds.indexOf(this.index),1);

    if (collapse) return this.merge(other);//collapse if indicated

    //coloring
    else if (this.controls.visual.display.bonding && other.quanta.radius) {
        col = 0.35+Math.random()*0.1;
        this.setColor(col,col*0.5,0);
        other.setColor(col,col*0.5,0);
        this.quanta.countdown = this.quanta.mountdown = 64;
        other.quanta.countdown = other.quanta.mountdown = 64;
    }

    return false;//no compromise
}

/**
 * Freezes two monads in place, resetting their velocities. Supersedes all other forms of
 * interaction, meaning no bonding, merging, bouncing, etc. will occur. Additionally,
 * emission and virtually all other properties vanish upon freezing.
 *
 * @param {Monad} other the monad to freeze with
 *
 * @return {boolean} true because freezing should stop all other monad behavior
 */
Monad.prototype.freeze = function(other)
{   //memory references
    var q1 = this.quanta;
    var q2 = other.quanta;
    var v1 = this.velocity;
    var v2 = other.velocity;

    //set velocities to 0
    v1.x = v1.y = v1.z = 0;
    v2.x = v2.y = v2.z = 0;

    //coloring
    if (this.controls.visual.display.collision) {
        this.setColor(0.5,1.0,1.0);
        q1.countdown = Infinity;
        other.setColor(0.5,1.0,1.0);
        q2.countdown = Infinity;
    }

    return true;//monad also compromised if frozen
}

/**
 * Merges two monads, combining their properties a single monad. The larger monad is technically
 * the monad that becomes both monads merged, and the smaller monad is nullified. Upon merging,
 * all attractons and repulsons of both monads are combined, the velocity is set as the bounce
 * between both monads, and the new merged monad is placed at the weighted midpoint between the
 * two monads.
 *
 * @param {Monad} other the monad to merge into the calling monad
 *
 * @return {boolean} true if the calling monad was merged into the parameter;
 *                  false if the parameter monad was merged into the calling
 */
Monad.prototype.merge = function(other)
{   //memory references
    var instant = this.stats.instant;
    var monad1 = this;
    var monad2 = other;
    var m1 = this.getMass();
    var m2 = other.getMass();
    var q1 = monad1.quanta;
    var q2 = monad2.quanta;

    //local variables
    var col = 0.0;
    var self = false;
    var mdif = m1 - m2;

    //make bigger monad the primary monad (if weights equal, check index)
    if (mdif < 0 || (!mdif && monad1.index > monad2.index)) {
        [monad1,monad2] = [monad2,monad1];
        [m1,m2] = [m2,m1];
        [q1,q2] = [q2,q1];
        self = true;
    }

    //velocity, positioning, and composition changes
    monad1.bounce(monad2, false);
    monad1.midpoint(monad2, false);
    q1.attractons += q2.attractons;
    q1.repulsons += q2.repulsons;
    monad1.updateRadius();

    if (m2 === 1) monad1.absorb(monad2); //absorb quanta
    monad2.nullify();

    //coloring
    if (this.controls.visual.display.collision) {
        q1.countdown = Math.max(q1.countdown, 16);
        col = 0.75+Math.random()*0.25;
        if (!q1.mountdown || m2 > 1) {
            if (m2 === 1) {
                monad1.setColor(col,col,0.0);
                q1.mountdown = -1;
            } else {
                monad1.setColor(col,col*0.33,0);
                q1.mountdown = 64;
                q1.countdown = 64;
            }
        }
    }

    if (m1 === 1) instant.monads++;
    instant.collisions++;

    return self; //return true if calling monad nullified
}

/**
 * Performs weight-based 'bouncing' where the calling monad has their velocity adjusted as if
 * they cleanly collided with the parameter particle. If the second argument is true, the
 * other particle bounces off the first as well. The bounce is velocity adjustment based
 * on original pre-collision velocity and the composition of the particles. As of this writing,
 * the more positive particle will add the vector of the more negative particle; the more
 * negative particle subtracts the vector of the more positive one. This means that very slightly,
 * a particle flees from more negative particles and is attracted to more positive ones.
 *
 * Of important note, if bonding is enabled in standard fashion (bounce off, pullIn and pushOut on),
 * bounce effectively only controls quanta-monad interactions during emission or collision, with
 * bounce-merging of monad-monads only occurring during mergeRatio collapse.
 *
 * @param {Monad} other the monad to bounce off of
 * @param {boolean} [both] whether to bounce both particles; if false, only the first bounces
 */
Monad.prototype.bounce = function(other, both)
{   //memory references
    var min = Math.min;
    var abs = Math.abs;
    var dynamic = this.controls.dynamic;
    var attractRepulse = dynamic.toggle.attractRepulse
    var weight = dynamic.quantaWeight;
    var v1 = this.velocity;
    var u1 = this.oob;
    var u2 = other.oob;
    var v2 = other.velocity;
    var t1 = this.getMass();
    var t2 = other.getMass();
    var m1 = this.check;
    var m2 = other.check;

    //local variables
    var s = 1; //sign for flipping and such

    /** Notice that if the two monads aren't in an unescaped parent-child relationship, we know
     * they are colliding, not performing emission. This scale then acts as an indicator of
     * NEGATIVITY; that is, a negative composition indicates that the opposite's vector should be
     * added, since for collision, adding a colliding particle's velocity will in effect move away
     * from it. If the incoming monad is more positive than negative, the velocity vector must be
     * subtracted, since for collision, subtracting a colliding particle's velocity will in effect
     * move towards it. */
    var add1 = ((other.quanta.repulsons / t2) - 0.5) * 2;//[-1,1] range of how negative the other is
    var add2 = ((this.quanta.repulsons / t1) - 0.5) * 2;//[-1,1] range of how negative the other is

    /** If, on the other hand, one of the particles is the parent of the other AND their child
     * hasn't escaped their volume, then this is emission-based bouncing. Because of that, we flip
     * the scale so that the child's vector is subtracted when negative and added when positive;
     * this means that an emitted attracton will pull its parent in its direction, and an emitted
     * repulson will repel their parent away from their direction. */
    if (both || (this.index === other.parentIndex && other.quanta.countdown < 0)) add1 *= -1;//flip [1,-1] range (now measures positivity)
    if (both || (other.index === this.parentIndex && this.quanta.countdown < 0)) add2 *= -1;//flip [1,-1] range (now measures positivity)

    //check for quanta-collision/emission and weight multiplier
    if (weight != 1.0 && (t1 === 1 || t2 === 1) && (t1 + t2 > 2)) {
        weight = min(1, weight * min(t1,t2) / Math.max(t1,t2));
        if (t1 > t2) t2 = t1 * weight;
        else t1 = t2 * weight;
    }

    //copy velocity vectors
    u2.x = v2.x; u2.y = v2.y; u2.z = v2.z;
    if (both) { u1.x = v1.x; u1.y = v1.y; u1.z = v1.z; }

    if (add1) {
        //make mass vectors
        m1.x = m1.y = m1.z = t1;
        m2.x = m2.y = m2.z = t2 * abs(add1);//the more polar, the more effect

        //multiply velocity by mass
        v1.multiply(m1);
        u2.multiply(m2);

        if (this.getSpeed() > 0) {//affect velocity based on other particle
            if (attractRepulse && add1 > 0)
                v1.add(u2);
            else v1.sub(u2);
        } else {//particle was still--give it some movement
            if (!attractRepulse || add1 < 0) s *= -1;
            v1.x = s * u2.x;
            v1.y = s * u2.y;
            v1.z = s * u2.z;
        }

        //set velocities to correct (speed accounted) values
        v1.divide(m1.add(m2));
        this.checkVelocity(-1,false);
    }

    if (both && add2) {//bounce other particle, too
        s = 1;

        //make mass vectors
        m2.x = m2.y = m2.z = t2;
        m1.x = m1.y = m1.z = t1 * abs(add2);//the more polar, the more effect

        //multiply velocity by mass
        v2.multiply(m2);
        u1.multiply(m1);

        if (other.getSpeed() > 0) {//affect velocity based on other particle
            if (attractRepulse && add2 > 0)
                v2.add(u1);
            else v2.sub(u1);
        } else {//particle was still--give it some movement
            if (!attractRepulse || add2 < 0) s *= -1;
            v2.x = s * u1.x;
            v2.y = s * u1.y;
            v2.z = s * u1.z;
        }

        //set velocities to correct (speed accounted) values
        v2.divide(m2.add(m1));
        other.checkVelocity(-1,false);
    }

}



/**************************************************************/
/**************************************************************/
/*******************NON-COLLISION INTERACTION******************/
/**************************************************************/
/**************************************************************/

/**
 * Nullifies a monad, de-rendering it and removing it from the actively processed monads.
 * All stats relating to physical interaction with other particles are reset (incidental
 * stats such as slots or parent indexes are left as is since they will be set upon monad
 * reintegration). Once nullified, a monad remains in the monad array (no deletions or
 * object creations past initialization are done for performance reasons) and is available
 * to be used by a newly emitted quanta or other particle.
 */
Monad.prototype.nullify = function()
{   //memory references
    var p = this.position;
    var v = this.velocity;
    var q = this.quanta;
    var c = this.color;
    var z = this.zone;

    if (this.getMass() > 1) this.stats.instant.monads--;

    this.zones.clearFromZone(this);
    this.stats.instant.occupancy--;

    //reset all physical stats and color
    if (this.bonds.length) this.bonds = [];
    p.x = p.y = p.z = this.controls.NONRENDER_DISTANCE;
    z.x = z.y = z.z = z.i = -1;
    q.attractons = q.repulsons = q.radius = q.countdown = q.mountdown = q.emit = 0;
    v.x = v.y = v.z = 0;
    c.r = c.g = c.b = 0;

    this.zones.addFreeSlot(this);//this monad slot now available for another
}

/**
 * The function for handling emission. When called, the calling monad will set new properties for
 * and emit the parameter particle and then emit it as a 1-mass quanta from the calling monad's
 * center.
 *
 * @param {Monad} other is the monad to be emitted from the calling monad;
 *                      it is assumed only nullified, non-simulated monads will be passed in
 *                      if passed in a non-eligible monad, no emission will occur
 *
 * @return {boolean}    true if the emission is compromised in some way and false otherwise
 */
Monad.prototype.emit = function(other)
{
    if (other === undefined) return true;//you gave me a bad particle, now prepare to die
    //memory references
    var q1 = this.quanta;
    var q2 = other.quanta;
    var c1 = this.color;
    var p2 = other.position;
    var dynamic = this.controls.dynamic;
    var toggle = dynamic.toggle;
    var emission = dynamic.emission;
    var ms = dynamic.maxSpeed;
    var prevMatch = emission.prevMatch;
    var instant = this.stats.instant;

    //local variables
    var polar = q1.attractons === 0 || q1.repulsons === 0;
    var m1p = q1.attractons / this.getMass(); //[0,1] range of positivity for calling monad
    var pchance = m1p;
    var col = 0.0;

    if (toggle.impactEmit) //reset pchance to also reflect impact charge
        pchance = m1p * (1-prevMatch) + ((q1.charge+1)/2) * prevMatch;

    if (q1.attractons > 0 && (polar ? true : (Math.random() < pchance ))) {//emit an attracton
        q1.attractons--;
        q2.attractons++;
    } else {//emit a repulson
        q1.repulsons--;
        q2.repulsons++;
    }

    //new quanta physical and parent traits
    other.updateRadius();
    other.parentIndex = this.index;

    //new quanta position in center of parent monad
    p2.x = p2.y = p2.z = 0;
    p2.add(this.position);
    this.zones.updateZone(other);

    //new quanta velocity options
    if (toggle.impactEmit)
        other.gaussianVelocity(q1.impact,ms*emission.prevRange);
    else other.randomizeVelocity(ms);
    other.checkVelocity(ms,false);

    //new quanta color settings
    other.setColor(0.0,0.25+Math.random()*0.5,0.0);
    q2.countdown = -(this.index+1);

    //emitting monad physical traits
    q1.emit--;
    this.updateRadius();
    this.bounce(other, false);//other.quanta.countdown MUST be negative and have parent index applied

    //emitting monad color settings
    if (this.controls.visual.display.radiation) {
        col = 0.35+Math.random()*0.35;
        if (!q1.mountdown) this.setColor(0.0,col,0.0);
        else if (q1.mountdown === -1) this.setColor(col*1.25,1.0,0.5);
        else if (q1.mountdown > 1) toggle.bonding ? this.setColor(col+0.3,col+0.3,col+0.3) : this.setColor(col+0.3,col*0.5,0);
        q1.countdown = 8;
    }

    //debug/stats
    if (DEBUG) debug(["system","emission"],['emission',this,other]);
    instant.radiation++;
    if (this.getMass() === 1) instant.monads--;

    return false; //no error encountered
}

/**
 * Sets the calling monad (and if the second argument is true, also the parameter monad)
 * to have a new position exactly halfway in between the center points of both monads.
 *
 * @param {Monad} other the monad whose midpoint with the calling monad to calculate
 * @param {boolean} [both] whether to also set the other monad at the midpoint
 */
Monad.prototype.midpoint = function(other, both)
{   //memory references
    var size = this.zones.size;
    var p1 = this.position;
    var p2 = other.position;
    var t1 = this.getMass();
    var t2 = other.getMass();
    var m1 = this.check;
    var m2 = other.check;

    //make mass vectors
    m1.x = m1.y = m1.z = t1;
    m2.x = m2.y = m2.z = t2;

    //set position(s) to midpoint
    p1.multiply(m1);
    p2.multiply(m2);
    p1.add(p2);
    if (both) p2.add(p1);
    p1.divide(m1.add(m2));
    p2.divide(both ? m1 : m2);
    this.checkBounds(size);
    other.checkBounds(size);
}

/**
 * Spaces the calling monad a specific distance from the parameter monad by continually
 * moving it in a straight line along its velocity vector; if no appropriate distance is
 * found, the calling monad's velocity is randomly changed and the process repeated.
 * At the end, the calling monad's velocity is reset to what it was originally.
 *
 * @param {Monad} other the monad to space a specific to the calling monad
 * @param {Monad} distance  how far apart to space the calling monad
 */
Monad.prototype.spaceDistanceTo = function(other, distance)
{   //memory references
    var maxvel = this.controls.dynamic.maxSpeed;
    var zones = this.zones;
    var size = zones.size;
    var zoning = zones.zoning;

    //local variables
    var check = 0;
    var newvel = Math.ceil((zones.maxdist*2)/maxvel);
    var x = this.velocity.x; var y = this.velocity.y; var z = this.velocity.z;

    //update until appropriate distance found
    while (Math.abs(distance - this.getToroidDistanceTo(other, size, 0 /*size - Math.max(zoning,this.quanta.r+other.quanta.r)*/)) > maxvel) {
        if (++check === newvel) {
            this.randomizeVelocity(maxvel/2);
            check = 0;
        }
        this.updatePosition();
    }

    this.velocity.x = x; this.velocity.y = y; this.velocity.z = z;//reset velocity to what it was before
}



/**************************************************************/
/**************************************************************/
/*******************         CHECKS         *******************/
/**************************************************************/
/**************************************************************/

/**
 * Uses current controls settings and calling particle's mass information to determine how many
 * (if any) quanta should be emitted from the calling particle this frame. This is determined by
 * first checking whether the particle's mass exceeds the stability threshold and is at least 2
 * (so it has something to emit). If these requirements have been met, the monad's unstable quanta
 * (any quanta above the stability threshold) are counted and converted to a ratio representing the
 * amount of unstable quanta compared to the maximum amount of unstable quanta (the radiation
 * threshold), a real number >= 0, where 1.0 means the monad has reached the radiation threshold
 * (thus always guaranteeing emission if otherwise allowed). Next, a random number in range [0,1)
 * is generated and if it is less than the ratio, the random number is used to determine how many
 * quanta the monad can emit when multiplied by the maximum possible emittable particles.
 *
 * @return {int} integer >=0 of how many quanta should be emitted from the calling particle this frame
 */
Monad.prototype.checkEmission = function()
{   //memory references
    var max = Math.max;
    var zones = this.zones;
    var mass = this.getMass();
    var controls = this.controls.dynamic.emission;
    var stability = controls.stability;
    var quanta = this.quanta;

    //local variables
    var unstable = 0.0;
    var ran = 0.0;

    if (mass <= stability || mass < 2) return false; //particle's mass is unstable

    //check instability
    unstable = max(0, mass - stability);
    this.stats.instant.decaying += unstable;
    unstable = max(0, unstable / (controls.radiation - stability));

    //randomly determine how many quanta to emit based on instability and controls
	ran = Math.random();
    quanta.emit += ran < Math.pow(unstable, 1.0/controls.decayRate) ? Math.ceil(Math.pow(ran,controls.uniformity)*controls.maximum) : 0;//see research for extended explanation
    quanta.emit = Math.min(quanta.emit, this.getMass()-1);

    return quanta.emit;//how many quanta to emit
}

/**
 * Checks whether the calling monad is overlapping (their spherical volumes overlap) with the
 * parameter monad and returns false if they are. Used to check whether emitted quanta have
 * left the volume of their parent monad so they won't collide with them pre-escape.
 *
 * @param {Monad} other is the (parent) monad to check overlap with
 *
 * @return {boolean}    true if calling monad does not overlap with parameter monad
 */
Monad.prototype.checkEscape = function(other)
{   //memory references
    var quanta = this.quanta;
    var oquanta = other.quanta;
    var zone = this.zone;
    var ozone = other.zone;
    var zones = this.zones;
    var size = zones.size;
    var zoning = zones.zoning;

    var radi = quanta.radius + oquanta.radius;

    if (this.position.distanceTo(other.position) > radi) { //euclidean distance is non-overlapping
        if (zone.x != ozone.x || zone.y != ozone.y || zone.z != ozone.z) //check if zones are different, then check toroid distance
            if (this.getToroidDistanceTo(other, size, size - Math.max(zoning,radi)) <= radi)
                return false;//toroid wrap indicates these are actually overlapping
        quanta.countdown = 1;
        return true;
    } else return false;
}

/**
 * Checks the calling monad's bond with the parameter monad's. Depending on settings, monads
 * will attempt to pull in or push out the monad to achieve an ideal (surface kiss) distance.
 * Additionally, monads may collapse (merge) into a single monad or may break apart and desist
 * checking distance with the other monad.
 *
 * Note that if pullIn and bounce are disabled in controls.dynamic.bonding, bonds function simply
 * to prevent overlap and use energy that would have gone into overlapping to emit quanta instead.
 *
 * @param {Monad} other the other monad whose bond with the calling monad to check
 *
 * @return {boolean} whether or not the calling monad was compromised (can happen through collapse)
 */
Monad.prototype.checkBond = function(other)
{
    if (other.quanta.radius === 0) return this.unbond(other,false);
    //memory references
    var absMinPos = absMin;
    var sqrt = Math.sqrt;
    var zones = this.zones;
    var dynamic = this.controls.dynamic;
    var ms = dynamic.maxSpeed;
    var bonding = dynamic.bonding;
    var opos = other.position;
    var pos = this.position;
    var toofar = bonding.breakRatio;
    var tooclose = bonding.mergeRatio;
    var size = zones.size;
    var zoning = zones.zoning;
    var mass = this.getMass();

    //local variables
    var weight = mass / (mass + other.getMass());
    var excess = 0.0;
    var speed = 0.0;
    var raw = 0.0;
    var oob = null;
    var check = other.check;
    var dist = pos.distanceTo(opos);
    var radi = this.quanta.radius + other.quanta.radius;
    var ratio = dist / radi;

    if (ratio > toofar) {//this particle looks very far away, checking again with toroid distance
        dist = this.getToroidDistanceTo(other, size, size - Math.max(zoning,radi*toofar*ms));
        ratio = dist / radi;
    }
    check.x = check.y = check.z = 1;
    oob = other.getOutOfBounds(size, size - zoning);

    //check what category distance ratio falls under
    if (ratio < tooclose) { //particles are too close and must collapse
        return this.unbond(other, dynamic.toggle.merging);
    } else if (bonding.allowBreak && ratio > toofar) { //particles are too far and must break their bond
        return this.unbond(other, false);
    } else if (bonding.pushOut && ratio < 1) { //particles are overlapping and should be nudged farther apart
        check.x = absMinPos(opos.x - pos.x, oob.x - pos.x) * (1/ratio);
        check.y = absMinPos(opos.y - pos.y, oob.y - pos.y) * (1/ratio);
        check.z = absMinPos(opos.z - pos.z, oob.z - pos.z) * (1/ratio);
    } else if (bonding.pullIn && ratio > 1) { //particles are distance and should be nudged closer together
        check.x = absMinPos(pos.x - opos.x, pos.x - oob.x) * (ratio-1);
        check.y = absMinPos(pos.y - opos.y, pos.y - oob.y) * (ratio-1);
        check.z = absMinPos(pos.z - opos.z, pos.z - oob.z) * (ratio-1);
    } else return false;

    //get raw distance and weighted speed
    raw = sqrt(check.x * check.x + check.y * check.y + check.z * check.z);
    speed = (other.getSpeed()*(1-weight) + this.getSpeed()*weight) / raw;
    if (speed < 1) {
        check.x *= speed;
        check.y *= speed;
        check.z *= speed;
    }
    other.position.add(check);
    other.checkBounds(zones.size);

    //check for excess speed and move energy to emission
    speed = sqrt(check.x * check.x + check.y * check.y + check.z * check.z);
    excess += speed - raw;
    if (excess > 0) this.quanta.emit += 1 + Math.round(sqrt(ms + speed * excess));

    return false;//calling monad uncompromised
}

/**
 * Simply checks the bounds of a monad against the given size. If the monad has exceeded the
 * boundary, it will be 'warped' to the opposite of the toroid with a distance in from the
 * boundary equal to how much it extruded from the opposite boundary. If called whenever
 * position changes, this function ensures no monad will leave the environment proper and will
 * wrap around the toroid edges as expected.
 *
 * @param {float} size  the radius or size of the world environment (boundary)
 */
Monad.prototype.checkBounds = function(size)
{
    var pos = this.position;

    if (pos.x >= size) pos.x = -(pos.x - 2 * (pos.x - size)); //check and correct x boundary violation
    else if (pos.x < -size) pos.x = -(pos.x + 2 * (-pos.x - size));

    if (pos.y >= size) pos.y = -(pos.y - 2 * (pos.y - size)); //check and correct y boundary violation
    else if (pos.y < -size) pos.y = -(pos.y + 2 * (-pos.y - size));

    if (pos.z >= size) pos.z = -(pos.z - 2 * (pos.z - size)); //check and correct z boundary violation
    else if (pos.z < -size) pos.z = -(pos.z + 2 * (-pos.z - size));

    this.zones.updateZone(this);//update the zone the particle is in
}

/**
 * Checks the velocity of the calling monad against the parameters; if appropriate, will adjust
 * the velocity of the monad and translate excess energy into quanta.
 *
 * Note: calling monad.checkVelocity(-1,true) would be a standard check that only changes a monad's
 *       speed if it exceeds the maximum and translates the extra speed into emissions
 *
 * @param {float} enforce   if < 0, does nothing; if >=0, will force the particle's speed to be
 *                                                whatever enforce is, up to maximum speed
 * @param {boolean} [emit]    whether to emit excess energy as quanta
 */
Monad.prototype.checkVelocity = function(enforce,emit)
{   //memory references
    var v = this.velocity;
    var ms = this.controls.dynamic.maxSpeed;
    var max = ms;
    var speed = this.getSpeed();

    //local variables
    var ratio = 0.0;
    var excess = 0.0;

    if (enforce >= 0) ms = Math.min(enforce, ms); //check enforcement and set max speed locally to it

    if (speed > ms || enforce >= 0) { //speed either exceeds max or particle must be forced to go a certain speed
        if (speed <= 0) { //there is no speed, randomize speed
            this.randomizeVelocity(ms);
            speed = this.getSpeed();
            if (speed === 0) return; //settings do not enable velocity changes in these conditions
        }
        ratio = ms / speed; //force particles to either max speed if above or to the enforced speed regardless
        v.x *= ratio;
        v.y *= ratio;
        v.z *= ratio;
        excess = speed - ms;
        if (emit && excess > 0) //there is excess energy that must be put to emission
            this.quanta.emit += 1 + Math.round(Math.sqrt(max + ms * excess));
    }
}



/**************************************************************/
/**************************************************************/
/*******************         GETTERS        *******************/
/**************************************************************/
/**************************************************************/

/**
 * Returns the mass of the calling monad, which is the summation of a monad's composition
 * (its attractons plus its repulsons equals mass).
 *
 * @return {int} the mass of the calling monad
 */
Monad.prototype.getMass = function()
{
    var quanta = this.quanta;
    return quanta.attractons + quanta.repulsons;
}

/**
 * Returns the speed of the calling monad, which is the square root of the summation of each
 * velocity vector squared.
 *
 * @return {float} the speed of the calling monad
 */
Monad.prototype.getSpeed = function() {
    var v = this.velocity;
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Sets and returns a monad's out of bounds vector to match the monad's check. This means that
 * for any check.x/y/z values that are true, the out of bounds vector will translate that axis
 * to its opposite side if it falls within a certain distance. Out of bounds vectors may violate
 * natural boundary laws and are not restricted to certain coordinates; this enables the out of
 * bounds vector to be used to measure true distance. A monad at any given point has 1 natural
 * (Euclidean) vector and up to 26 adjacent out of bounds vectors. Note that having the first
 * parameter be the world environment radius will have any out of bound vectors placed beyond
 * that boundary.
 *
 * Note: calling monad.getOutOfBounds(zones.size,0) with check of 1,1,1 will flip the monad to its
 *          polar opposite position, which may or may not be out of bounds
 *       calling getOutOfBounds with not all check.x/y/z true will only flip the true axis
 *       a limit over 0 will only flip a monad's out of bounds coordinates if the monad's coordinate
 *          on that specific axis is beyond the limit
 *
 * @param {float} size  the radius to be considered the boundary (flipped particles will have their
 *                      coordinates set beyond this boundary)
 * @param {float} limit how far a monad can be along a true check.x/y/z axis before it is will get
 *                      flipped to its out of bound vector
 *
 * @return {Vector3}    the out of bounds vector, passed for quick access
 */
Monad.prototype.getOutOfBounds = function(size,limit)
{   //memory references
    var pos = this.position;
    var check = this.check;
    var oob = this.oob;

    //local variables
    var x = pos.x + 0.0;
    var y = pos.y + 0.0;
    var z = pos.z + 0.0;

    limit = Math.max(0,limit);

    if (check.x) { //flip x if applicable
        if (x < -limit) x = size + (size + x);
        else if (x >= limit) x = -size - (size - x);
    }

    if (check.y) { //flip y if applicable
        if (y < -limit) y = size + (size + y);
        else if (y >= limit) y = -size - (size - y);
    }

    if (check.z) { //flip z if applicable
        if (z < -limit) z = size + (size + z);
        else if (z >= limit) z = -size - (size - z);
    }

    if (DEBUG) debug(["system","collision"],['outOfBounds','limit,bound',size,limit,'x',pos.x,x,'y',pos.y,y,'z',pos.z,z]);

    //set and return oob
    oob.x = x;
    oob.y = y;
    oob.z = z;
    return oob;
}

/**
 * Returns the absolute shortest distance between the calling and the parameter monad assuming
 * cubic three-torus space (where the world environment wraps at 26 points of contact). The
 * shortest distance will be a factor of size and limit, where the simulation measures the boundary
 * as the size and how far from 0 a monad can be until it should be considered in multiple locations
 * along that axis as the limit. This function essentially uses several layered loops to cycle through
 * all potential locations within the parameter restrictions--the loops consist of repeated calling
 * of getOutOfBounds to accomplish this. See getOutOfBounds for more details.
 *
 * Note: calling monad.getToroidDistanceTo(other, zones.size, 0) will give the true shortest distance
 *          this will be resource intensive as all 8 potential positions for each particle will be
 *          checked against each other, meaning the distance checking happens 64 times
 *       calling monad.getToroidDistanceTo(other, zones.size, zones.size - *), where * is the maximum of the
 *          monad's combined radius or zones.zoning will ensure a speedy distance function that only
 *          checks necessary arrangements of particles
 *
 * @param {Monad} other is the monad whose distance to check from calling monad
 * @param {float} size  the radius to be considered the boundary (particles will be set beyond this
 *                      boundary if they satisfy the limit condition
 * @param {float} limit how far a monad can be along a true check.x/y/z axis before it will have all
 *                      potential coordinates for that axis checked (default and flipped)
 *
 * @return {float} the theoretical shortest distance between the calling and parameter monad
 *                  when accounting for all 64 or fewer relational distances set by parameters
 */
Monad.prototype.getToroidDistanceTo = function(other, size, limit)
{   //memory references
    var min = Math.min;
    var p1 = this.position;
    var p2 = other.position;
    var c1 = this.check;
    var c2 = other.check;
    var o1 = this.oob;
    var o2 = other.oob;

    //local variables
    var x1 = 0; var y1 = 0; var z1 = 0;
    var x2 = 0; var y2 = 0; var z2 = 0;
    var distance = p1.distanceTo(p2);
    limit = Math.max(0,limit);

    //get out of bounds information for calling monad
    c1.x = c1.y = c1.z = 1;
    this.getOutOfBounds(size,limit);
    x1 = p1.x === o1.x ? 0 : 1;
    y1 = p1.y === o1.y ? 0 : 1;
    z1 = p1.z === o1.z ? 0 : 1;

    //get out of bounds information for parameter monad
    c2.x = c2.y = c2.z = 1;
    other.getOutOfBounds(size,limit);
    x2 = p2.x === o2.x ? 0 : 1;
    y2 = p2.y === o2.y ? 0 : 1;
    z2 = p2.z === o2.z ? 0 : 1;

    if (DEBUG) debug(["system","collision"],['lim',limit,'cross',x1,y1,z1,x2,y2,z2,'\nTHIS:  x',p1.x,'y',p1.y,'z',p1.z,'\n\tox',o1.x,'oy',o1.y,'oz',o1.z,'\nOTHER: x',p2.x,'y',p2.y,'z',p2.z,'\n\tox',o2.x,'oy',o2.y,'oz',o2.z]);

    /**If any checks were flagged (meaning some coordinate of either particle was beyond the limit),
     * the multiple loop cycle will begin. Note that given the structure, only flagged coordinates
     * will be checked. */
    if (x1 || y1 || z1 || x2 || y2 || z2)
        for (c1.x = 0; c1.x <= x1; c1.x++) for (c1.y = 0; c1.y <= y1; c1.y++) for (c1.z = 0; c1.z <= z1; c1.z++) { //calling monad coordinates
            this.getOutOfBounds(size,limit);
            for (c2.x = 0; c2.x <= x2; c2.x++) for (c2.y = 0; c2.y <= y2; c2.y++) for (c2.z = 0; c2.z <= z2; c2.z++) { //parameter monad coordinates
                if (DEBUG) debug(["system","collision"],['step',c1.x,c1.y,c1.z,c2.x,c2.y,c2.z]);
                distance = min(distance, o1.distanceTo(other.getOutOfBounds(size,limit)));
                if (DEBUG) debug(["system","collision"],['x1',o1.x,'y1',o1.y,'z1',o1.z,'x2',o2.x,'y2',o2.y,'z2',o2.z, o1.distanceTo(o2)]);
            }
        }

    return distance;
}



/**************************************************************/
/**************************************************************/
/*******************         UPDATE         *******************/
/**************************************************************/
/**************************************************************/

/**
 * Updates the 3d physical coordinates of the monad by adding its velocity to its position vector
 * and checking for any boundary overlap. Function chains ensure that particles will not overlap
 * world boundary and will be in the proper zone once the function terminates.
 */
Monad.prototype.updatePosition = function()
{
    this.position.add(this.velocity);//particle moves based on velocity
    this.checkBounds(this.zones.size);//check if particle has left world boundaries and perform appropriate action if it has
}

/**
 * Updates the calling monad's radius based on its mass and simulation density.
 */
Monad.prototype.updateRadius = function()
{
    this.quanta.radius = radiusSphere(this.getMass(), this.controls.dynamic.density);
}

/**
 * Updates the monad's color to standard red-purple-blue scheme (or black-gray-white if in
 * color-neutral mode). Note that the end color result may be very different depending on
 * visual controls settings. Particles which fall below or above (depending on spectrum)
 * a specific radius will have a limited lightened color scheme. Other monads will have
 * their color split between red/blue or black/white based directly on the ratio of
 * attractons and repulsons within the monad, where purest red/black is fully negative,
 * and purest blue/white is fully positive.
 */
Monad.prototype.updateColor = function()
{
    if (this.controls.access.colorNeutral) {
        this.setColor(0,0,0);
        return;
    }
    //memory references
    var mass = this.getMass();
    var cloud = this.controls.visual.cloud;
    var color = cloud.lightBrightest;
    var whiteout = cloud.whiteoutRadius;
    var quanta = this.quanta;
    var radius = quanta.radius;

    //local variables
    var range = Math.max(0.0, color - cloud.lightDarkest);
    var r = cloud.reverseSpectrum ? 1 : -1;
    var ratio = 0.0;

    if (r > 0 ? (radius > whiteout) : (radius < whiteout)) {//check whether particle is in whiteout radius
        range *= (r > 0 ? 0 : -r) + (r * (radius-1) / whiteout);
        if (quanta.attractons / mass >= 2/3)//color positive
            this.setColor(color*range,color*range,color);
        else if (quanta.repulsons / mass >= 2/3)//color negative
            this.setColor(color,color*range,color*range);
        else this.setColor(color,color*range,color);//color neutral
    } else this.setColor((quanta.repulsons / mass) * color, 0.0, (quanta.attractons / mass) * color);//color particle normally

    if (quanta.countdown >= 0) quanta.countdown = quanta.mountdown = 0;//reset color counters if quanta.countdown not used for checking escape
}

/**
 * Sets the monad's color to the given rgb values. Additionally, uses monad's color vector to pass
 * in distance, lighting, and size information to the shaders. When called, a monad's visual
 * size, distance, brightness, and color will be set for the next tick. There are no color
 * restrictions to this function, so it should be called independently of updateColor for an
 * immediate effect color (e.g. bonding, collision, emission, etc.); otherwise, updateColor
 * should be called for standard red-purple-blue (black-gray-white in color-neutral) color
 * schemes.
 *
 * @param {float} r     red value in range [0,1]
 * @param {float} g     green value in range [0,1]
 * @param {float} b     blue value in range [0,1]
 */
Monad.prototype.setColor = function(r,g,b)
{   //memory references
    var min = Math.min;
    var floor = Math.floor;
    var color = this.color;
    var access = this.controls.access;
    var visual = this.controls.visual;
    var cloud = visual.cloud;
    var max = this.controls.MAX_BRIGHTNESS;

    if (access.colorNeutral) //set all colors to positive--thus the lighter, the more attractons
        r = g = b = this.quanta.attractons / this.getMass();

    /** Colors comprise a float and integer value combined: the float value represents the classic
     * rgb color scheme; the integer represents something different for each color: red's integer
     * determines distance factor, green's integer determines the darkest possible lighting, and
     * blue's integer determines visual size appearance. */
    color.r = min(max, r) + floor(cloud.distanceFactor);
    color.g = min(max, g) + floor(cloud.lightDarkest * 1000);
    color.b = min(max, b) + floor(Math.pow(this.quanta.radius, cloud.sizeExp) * cloud.sizeRatio);
}

/**
 * Randomizes a monad's velocity so each vector is within the given speed. Note that this can
 * exceed controls set max speed.
 *
 * @param {float} ms    the max value a velocity vector can be randomized to
 */
Monad.prototype.randomizeVelocity = function(ms)
{
    var random = Math.random;
    var v = this.velocity;
    v.x = random() * 2 * ms - ms;
    v.y = random() * 2 * ms - ms;
    v.z = random() * 2 * ms - ms;
}

/**
 * Changes a monad's velocity to be a normally distributed random vector based off of the
 * parameters.
 *
 * @param {Vector3} vector  the vector whose x,y, and z values should be considered 0 stds
 * @param {float} std       the standard deviation from which the x/y/z values will spread from
 */
Monad.prototype.gaussianVelocity = function(vector,std)
{
    var v = this.velocity;
    v.x = randGaussSimple(vector.x,std);
    v.y = randGaussSimple(vector.y,std);
    v.z = randGaussSimple(vector.z,std);
}



/**************************************************************/
/**************************************************************/
/*******************      MISCELLANEOUS     *******************/
/**************************************************************/
/**************************************************************/

/**
 * Only used for monad console-log research purposes. Will return a string comprising all relevant
 * information about the calling monad.
 *
 * @param {Monad} other if given, the string will also contain the distance from the calling monad
 *                      to this parameter monad
 * @return {String}     string containing monad's information
 */
Monad.prototype.toString = function(other)
{
    var spacing = new Array(31).join(' ');
    var quanta = this.quanta;
    var imp = quanta.impact;
    var pos = this.position;
    var vel = this.velocity;
    var stats = this.stats;
    var tick = stats.tick;
    var zones = this.zones;
    var size = zones.size;
    var zoning = zones.zoning;
    var monad = (this.index || !tick) ? "" : "\n\nTick: " + tick + "    Cloud: " + (stats.instant.particles - stats.instant.monads) + "\n";
    var traits = ["Monad",  "Attractons", "Repulsons", "xPos", "yPos", "zPos", "xVel", "yVel", "zVel", "xImp", "yImp", "zImp",  "chargeImpact",  "Radius", "Bonds"  ];
    var values = [this.index,quanta.attractons,     quanta.repulsons,    pos.x,  pos.y,  pos.z, vel.x,  vel.y,  vel.z,  imp.x,  imp.y,  imp.z,   quanta.charge,         quanta.radius, this.bonds.length];
    for (var i = 0; i < traits.length; i++)
        monad += (!i || i%3 ? "" : "\n" + spacing) + (traits[i] + ": " + values[i] + spacing).slice(0, spacing.length);
    if (this.index && other) monad += "\nDistance: " + this.getToroidDistanceTo(other,size,size - Math.max(zoning,quanta.radius+other.quanta.radius));
    return monad;
}
