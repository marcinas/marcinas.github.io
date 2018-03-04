***************************************************************************************************
Emergence Simulation System
***************************************************************************************************

	by Marceline Peters

	A particle collider designed to test out and research emergence in multi-agent systems.

	This system was designed and coded (except where noted below) by Marceline Peters for two independent
	study courses taken in the Winter 2017 quarter at University of Washington, Tacoma. The theories
	that are the basis for the simulation come from a combination of the ideas of the two University
	professors Marceline worked under, Profs. Chris Marriott and George Mobus, various readings both peer-
	reviewed and informal, and Marceline's own interpretations and emergent discoveries. After graduation,
	the simulation was further developed to explore the emergent phenomena within the system as the
	basis for a research paper. It was also published on github to allow others to experience emergence.

	The simulation is still undergoing research and development.



***************************************************************************************************
Relevant Courses
***************************************************************************************************

Emergence System Simulation Design
	with Professor Chris Marriott

	Course objectives include designing an elementary particle simulator to study the possibility
	of emergence of electromagnetism or other elementary forces. The simulation will involve a
	three-dimensional environment, simple agents capable of emitting positive and negative particles
	or energy and capable of moving according to forces of attraction and repulsion. The goal of the
	project is to find evidence of the development of unplanned traits reflecting some real world
	physical phenomena such as subatomic orbits, gravity, strong or weak force, quantum structure,
	or other notable behavior arising from simple rules. The end products of the class will be a
	working simulation and a research report on the design and results of the simulation.

	Course resources include study in HTML 5 game engine graphics, JavaScript development and
	design practices, WebGL and Three.js graphics processing, and aspects of physics simulation
	including three-torus and vectors.

Computational Theory of Emergence
	with Professor George Mobus

	Course objectives are the study of prepatory and theory work that will consist of varied,
	in-depth readings regarding the principles of the emergence of complexity in cosmological,
	biological, and computational evolution. These readings will focus on understanding the
	fundamentals of how simple rules can lead towards complex behaviors and the development
	of systems. Primarily, these concepts will be explored through what can be implemented using
	modern programming techniques and languages, with the goal of finding foundational principles
	that allow a simple system to develop unplanned traits. This work has technological merits on
	its own, and it can also be complementary to a directed research course dealing with
	computational simulations of emergence.

	Course resources include readings from The Emergence of Everything (2002) by H. J. Morowitz,
	Emergence: From Chaos to Order (1998) by J. H. Holland, and selected readings and papers on
	emergence and computing principles, including excerpts from several peer-reviewed journals and
	Principles of System Science (2014) by G. E. Mobus (course instructor).



***************************************************************************************************
Other Credits/Contributions
***************************************************************************************************

alpha 0.1-0.4
	@author Marceline Peters / https://github.com/marcinas
	@author Chris Marriott (for Zombies game, based on Bad Aliens)
	@author Seth Ladd (for Bad Aliens game engine and his Google IO talk in 2011)

beta 0.1-2.9
	@author Marceline Peters / https://github.com/marcinas
	consists of the coding, some visuals and physics simulator from alpha 0.1-0.4
		ported into a complete redesign based on protoplanets
		https://threejs.org/examples/webgl_gpgpu_protoplanet.html
	@author mrdoob
		https://github.com/mrdoob/three.js/blob/master/examples/webgl_gpgpu_protoplanet.html

gamma 0.0-current
	@author Marceline Peters / https://github.com/marcinas

	images/
		all images made using GIMP
		@author Marceline Peters / https://github.com/marcinas
		all dataurl files made from images and converted using dataurlmaker
		@author Marceline Peters / https://github.com/marcinas (original images)
		@author Sveinbjorn Thordarson http://dataurl.net/ (conversion to Data URL)

	js/
		dat.gui.min.js
			@author Data Arts Team, Google Creative Lab
		Detector.js
			@author alteredq / http://alteredqualia.com
			@author mr.doob / http://mrdoob.com
		GPUComputationRenderer.js
			@author yomboprime / https://github.com/yomboprime
			@author zz85 / https://github.com/zz85
		OrbitControls.js
			@author qiao / https://github.com/qiao
			@author mrdoob / http://mrdoob.com
			@author alteredq / http://alteredqualia.com
			@author WestLangley / http://github.com/WestLangley
			@author erich666 / http://erichaines.com
		three.js
			@author Abe Pazos / https://hamoid.com
			@author abelnation / http://github.com/abelnation
			@author alteredq / http://alteredqualia.com
			@author arose / http://github.com/arose
			@author astrodud / http://astrodud.isgreat.org
			@author atix / arthursilber.de
			@author Ben Houston / http://clara.io
			@author benaadams / https://twitter.com/ben_a_adams
			@author bhouston / http://clara.io
			@author clockworkgeek / https://github.com/clockworkgeek
			@author D1plo1d / http://github.com/D1plo1d
			@author David Sarno / http://lighthaus.us
			@author egraether / http://egraether.com
			@author elephantatwork / www.elephantatwork.ch
			@author fordacious / fordacious.github.io
			@author greggman / http://games.greggman.com
			@author Hectate / http://www.github.com/Hectate
			@author hughes
			@author ikerr / http://verold.com
			@author jonobr1 / http://jonobr1.com
			@author jordi_ros / http://plattsoft.com
			@author Kaleb Murphy
			@author kile / http://kile.stravaganza.org/
			@author Marius Kintel / https://github.com/kintel
			@author Matt DesLauriers / @mattdesl
			@author michael guerrero / http://realitymeltdown.com
			@author mikael emtinger / http://gomo.se/
			@author miningold / https://github.com/miningold
			@author mrdoob / http://mrdoob.com/
			@author Mugen87 / http://github.com/Mugen87
			@author Nikos M. / https://github.com/foo123/
			@author oosmoxiecode / https://github.com/oosmoxiecode
			@author philogb / http://blog.thejit.org/
			@author Reece Aaron Lecrivain / http://reecenotes.com/
			@author Sean Griffin / http://twitter.com/sgrif
			@author sroucheray / http://sroucheray.org/
			@author stephomi / http://stephaneginier.com/
			@author supereggbert / http://www.paulbrunt.co.uk/
			@author szimek / https://github.com/szimek/
			@author takahirox / http://github.com/takahirox
			@author timknip / http://www.floorplanner.com/
			@author timothypratley / https://github.com/timothypratley
			@author tschw
			@author WestLangley / http://github.com/WestLangley
			@author zz85 / http://github.com/zz85
	simulation/
		basic.js
			@author Marceline Peters / https://github.com/marcinas
		controls.js
			@author Marceline Peters / https://github.com/marcinas
		emergence.js
			@author Marceline Peters / https://github.com/marcinas
		monad.js
			@author Marceline Peters / https://github.com/marcinas
		statistics.js
			@author Marceline Peters / https://github.com/marcinas
				(rewriting, adding custom metrics, changing function and appearance)
			@author mrdoob / http://mrdoob.com/ (original, stats.min.js)
		zones.js
			@author Marceline Peters / https://github.com/marcinas
		emergence_simulation.html
		@author Marceline Peters / https://github.com/marcinas
		@author mrdoob / http://mrdoob.com/ (for original layout and design on protoplanets)

****************************************************************************************************
How to Do This Simulation Better
****************************************************************************************************

	The bottleneck, algorithmic complexity speaking, as far as I know, is position/velocity
	changes, internal data updates, and collision detection. Ideally, all of the data on the
	particles would be stored in the GPU: position, velocity, color, size, geometry, etc. are
	natively stored in the GPU, and additional data, such as mass, monad composition, etc., can
	be stored using unrendered buffers and pixels. Other optimizations exist, such as more compact
	ways to store the particle data and more efficient ways to write the mathematicals the GPU
	would perform in parallel. This is ideal because many groupings of the particles can be
	processed simultaneously, a huge time saving measure.

	The difficulties this introduces, however, is that all of the important data for the
	simulation, that is, particle information, position, velocity, composition, etc. is stored
	and updated within the GPU, traditionally a one-way pipeline. Debugging graphics--getting
	information from the GPU back to the CPU to be analyzed or otherwise observed--typically
	employs a process known as transform feedback, which is obtaining and translating raw GPU data
	into familiar data forms such as vertices and floating point arrays with meaningful indices.
	This process is very complicated and prone to pipeline slowdown--as such, it needs very
	granularly programmed shaders and graphics processing to minimize or eliminate frame rate
	loss. This requires hardware and software that communicate very precisely about specific
	memory locations and scheduling procedures within the GPU and CPU and allow the programmer to
	access and manipulate that data with the type of programmatic flexibility and API to come up
	with innovative algorithms to retrieve the data without adverse effects on the processing.
	Many older graphics cards cannot perform transform feedback, and much modern processing
	software, such as WebGL--which is what this simulation relies on--is almost incapable of it to
	the degree a simulation like this demands.

	If this simulation were to be emulated in the future with increased processing ability in mind,
	the author of this program suggests the following:

	The more ideal simulation should be written in C or C++ utilizing OpenGL 3.0+, using
	hand-written shaders and graphics code to take advantage of the newer and more robust transform
	feedback supplied with newer and non-web based graphics software (WebGL is still mostly based
	and supported by OpenGL 1 and 2) so that all of the particle information can be stored and
	parallel processed in the GPU. In addition, the use of C/C++ over JavaScript will allow much
	tighter and more efficient computations and memory management. All of these suggestions should
	allow a future designer to simulate a much higher particle count with increased accuracy of
	the simulation proper.
