
// Dependencies:
// - THREE (Three.js)
// - THREE.RingGeometryV2.js - custom ring geometry to get texture right
var SolarLib = SolarLib || {};
( (SolarLib, THREE) => {
  SolarLib.Planet = Planet;
  SolarLib.PlanetWithRings = PlanetWithRings;

  function Planet(params) {
      this.name         = params.name || "Obj" + Date.now() + (Math.random() * 1000);
      this.texture      = params.texture || "";
      this.orbit        = !Number.isNaN(params.orbit) ? params.orbit : 0;
      this.speed        = !Number.isNaN(params.speed) ? params.speed : 0;
      this.radius       = !Number.isNaN(params.radius) ? params.radius : 0;
      this.color        = params.color || 0xffffff;
      this.rotateSpeed  = !Number.isNaN(params.rotateSpeed) ? params.rotateSpeed : 0;
      this.rotateDir    = (["Up", "Clockwise", "CounterClockwise"]).includes(params.rotateDir) ?
        params.rotateDir : "CounterClockwise";
      this.x            = !Number.isNaN(params.x) ? params.x : 0;
      this.y            = !Number.isNaN(params.y) ? params.y : 0;
      this.z            = !Number.isNaN(params.z) ? params.z : 0;
      this.object       = null;
  }

  Planet.prototype.create = function(targetScene) {
    if(!targetScene) { return; }

    var mesh      = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius, 32, 32),
      new THREE.MeshLambertMaterial( { map: this.texture, color: this.color })
    );
    mesh.name     = this.name + "Mesh";
    var planet    = new THREE.Group();

//    mesh.castShadow = false;
//    mesh.receiveShadow = true;

    planet.add(mesh);
    targetScene.add(planet);

    planet.position.set(this.x, this.y, this.z);

    this.object = planet;

    return this.object;
  } // end Planet.create

  Planet.prototype.update = function(targetScene, curTime) {
    if(!targetScene) { return; }

    if(this.object != undefined) {
      var orbitSize = this.orbit;

      var planetMesh = this.object.getObjectByName(this.name + "Mesh");

      var rotationRadians = this.rotateSpeed * Math.PI/180;
      var xRadians = curTime/this.speed * Math.PI/180;
      var zRadians = (curTime/this.speed + 90) * Math.PI/180;

      // rotation needs to be fixed, it's a little off
      var rotation;
      if(this.rotationDir == "Up") {
        rotation = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), rotationRadians);
      }
      else if(this.rotationDir == "Clockwise") {
        rotation = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), -rotationRadians);
      }
      else {
        rotation = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), rotationRadians);
      }

      var x = (Math.sin(xRadians) * orbitSize);
      var y = 0;
      var z = (Math.sin(zRadians) * orbitSize);

      this.object.matrixAutoUpdate = false;
      this.object.matrix.makeTranslation( x, y, z );

      if(planetMesh != undefined) {
        planetMesh.matrixAutoUpdate = false;
        planetMesh.applyMatrix(rotation);
      }
    }
  } // end Planet.update

  function PlanetWithRings(params) {
    Planet.call(this, params);

    this.ringsTexture = params.ringsTexture || "";
    this.ringAngle    = !Number.isInteger(params.ringAngle) ? params.ringAngle : 90;
    this.ringDistance = !Number.isNaN(params.ringDistance) ? params.ringDistance : 50;
    this.ringSize     = !Number.isNaN(params.ringSize) ? params.ringSize : 50;
  } // end PlanetWithRings

  PlanetWithRings.prototype = Object.create( Planet.prototype );
  PlanetWithRings.prototype.constructor = PlanetWithRings;

  PlanetWithRings.prototype.create = function(targetScene) {
    if(!targetScene) { return; }

    Planet.prototype.create.call(this, targetScene);

    var phiSegments = 64;
    var thetaSegments = 64;
    var innerRadius = this.radius + this.ringDistance;
    var outerRadius = this.radius + this.ringDistance + this.ringSize;

    var geometry = new THREE.RingGeometryV2(innerRadius, outerRadius, thetaSegments, phiSegments);

    // add rings here
    var ringMesh  = new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial( { map: this.ringsTexture, color: this.color, side: THREE.DoubleSide })
//      new THREE.MeshBasicMaterial( { map: this.ringsTexture, color: this.color, side: THREE.DoubleSide })
    );
    ringMesh.name     = this.name + "RingMesh";

    // rotate the ring over to the proper angle
    var rotationRadians = this.ringAngle * Math.PI/180;
    var rotation = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), rotationRadians);
    ringMesh.matrixAutoUpdate = false;
    ringMesh.applyMatrix(rotation);

//    ringMesh.castShadow = true;
//    ringMesh.receiveShadow = true;

    this.object.add(ringMesh);

    return this.object;
  } // end PlanetWithRings.update

})(SolarLib, THREE);


( (SolarLib, THREE, dat, exports) => {
  "use strict";

// textures courtesy of James Hastings-Trew via website links below
// http://planetpixelemporium.com/index.php
// http://planetpixelemporium.com/planets.html
// Purely for educational, non-commercial use in this instance

window.addEventListener("load", init, false);

var scene, camera, renderer, controls; // global vars needed throughout the program
var cube, sphere;
var sun, sunGlow, earth;
var planets = new Map();
//var planets = [];
var orbits = new Map();
var width = window.innerWidth;
var height = window.innerHeight;
var aspectRatio = width / height;

var clock;
var sunUniforms, glowUniforms, sunDisplacement, sunNoise;
var guiControls;

function init() {
  clock = new THREE.Clock();

  // TEXTURES
  var textureLoader       = new THREE.TextureLoader();
  var textureFlare0       = textureLoader.load( "assets/lensflare0.png");
  var textureFlare2       = textureLoader.load( "assets/lensflare2.png");
  var textureSun          = textureLoader.load( "assets/sunmap.jpg" );
  var textureSun2         = textureLoader.load( "assets/sunTexture.jpg" );
  var textureEarth        = textureLoader.load( "assets/earthmap1k.jpg" );
  var textureMercury      = textureLoader.load( "assets/mercurymap.jpg" );
  var textureVenus        = textureLoader.load( "assets/venusmap.jpg" );
  var textureMars         = textureLoader.load( "assets/mars_1k_color.jpg" );
  var textureJupiter      = textureLoader.load( "assets/jupitermap.jpg" );
  var textureSaturn       = textureLoader.load( "assets/saturnmap.jpg" );
  var textureUranus       = textureLoader.load( "assets/uranusmap.jpg" );
  var textureNeptune      = textureLoader.load( "assets/neptunemap.jpg" );
  var texturePluto        = textureLoader.load( "assets/plutomap1k.jpg" );

  var textureSaturnRings  = textureLoader.load( "assets/saturnringcolor.jpg" );
//  var textureUranusRings  = textureLoader.load( "assets/uranusringcolour.jpg" );
  var textureUranusRings  = textureLoader.load( "assets/uranusringtrans.gif" );

  // SCENE
  scene = new THREE.Scene();
  scene.background = new THREE.Color().setHSL( 0.51, 0.4, 0.02 );

  // RENDERER
  renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize( width, height );
  document.body.appendChild( renderer.domElement );

  // CAMERA
  camera = new THREE.PerspectiveCamera(45, aspectRatio, 5, 500000);
  camera.position.y = 735;
  camera.position.z = 2935;

//  var helper = new THREE.CameraHelper( camera );
//  scene.add( helper );

  // LIGHTS
  var hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x999999, 0.2);
  scene.add(hemisphereLight);

  var pointLight = new THREE.PointLight(0xffffff, 1.0, 0, 1);
  pointLight.position.set(0, 0, 0);
//  pointLight.castShadow = true;

  scene.add(pointLight);

//  var helper = new THREE.CameraHelper( pointLight.shadow.camera );
//  scene.add( helper );

  window.addEventListener( 'resize', onWindowResize, false );

  // create our solar objects as the textures get loaded
  // size the system in relation to earth and the sun
  var sunSize   = 300;
  var earthSize = 20; // 2.29
  var earthOrbit = 4 * sunSize;
  var earthSpeed = 1; // lower number = faster, higher number = slower
  var earthRotateSpeed = 1;
  var lineSegments = 360;

  glowUniforms = {
    glowFactor: { value: 0.3 },
    glowPower: { value: 1.25 },
    vNormMultiplier: { value: 1.0 },
    viewVector: { type: "v3", value: camera.position },
    iTime: { value: 0.1 },
    bumpTexture: { value: textureSun2 },
    bumpScale: { value: 40.0 },
    bumpSpeed: { value: 1.5 },
    iResolution: { value: new THREE.Vector2(width, height) }
  }

  var glowMaterial = new THREE.ShaderMaterial({
    uniforms: glowUniforms,
    vertexShader:   exports.shaderGlow.vertex,
    fragmentShader: exports.shaderGlow.fragment,
    side: THREE.BackSide,
		blending: THREE.AdditiveBlending,
		transparent: true
  });

  sunUniforms = {
    amplitude: { value: 1.0 },
//    texture: { value: textureSun },
    texture: { value: textureSun2 },
    sphereTexture: { value: textureSun2 },
    iTime: { value: 0.1 },
    brightnessMultiplier: { value: 7.0 },
    iResolution: { value: new THREE.Vector2(width, height) }
  }
  sunUniforms.texture.value.wrapS = sunUniforms.texture.value.wrapT = THREE.RepeatWrapping;

  var shaderMaterial = new THREE.ShaderMaterial({
    uniforms: sunUniforms,
    vertexShader: exports.shader.vertex,
    fragmentShader: exports.shader.fragment
  });

  var sunGeometry = new THREE.SphereBufferGeometry(sunSize, 64, 64),

  sunDisplacement = new Float32Array( sunGeometry.attributes.position.count );
  sunNoise        = new Float32Array( sunGeometry.attributes.position.count );

  for( let i=0; i < sunDisplacement.length; i++) {
    sunNoise[i] = Math.random() * 5;
  }
  sunGeometry.addAttribute('displacement', new THREE.BufferAttribute(sunDisplacement, 1) );

  sun = new THREE.Mesh(
          sunGeometry,
          shaderMaterial
  );
  sun.name = "Sun";
  pointLight.add(sun);

  var ballGeometry = new THREE.SphereGeometry( sunSize + 250, 32, 16 );
	sunGlow = new THREE.Mesh( ballGeometry, glowMaterial );
  sunGlow.name = "SunGlow";
  pointLight.add(sunGlow);

  // create orbit sizes
  orbits.set("Mercury", earthOrbit * .57);
  orbits.set("Venus", earthOrbit * .72);
  orbits.set("Earth", earthOrbit);
  orbits.set("Mars", earthOrbit * 1.52);

  // Farther orbits shorter to bring the planets a bit closer together
  orbits.set("Jupiter", earthOrbit * 3.5);
  orbits.set("Saturn", earthOrbit * 6.5);
  orbits.set("Uranus", earthOrbit * 13.0);
  orbits.set("Neptune", earthOrbit * 20.0);
  orbits.set("Pluto", earthOrbit * 25.0);

/*
  orbits.set("Mercury", earthOrbit * .38);
  orbits.set("Venus", earthOrbit * .72);
  orbits.set("Earth", earthOrbit);
  orbits.set("Mars", earthOrbit * 1.52);

  orbits.set("Jupiter", earthOrbit * 5.20);
  orbits.set("Saturn", earthOrbit * 9.53);
  orbits.set("Uranus", earthOrbit * 19.18);
  orbits.set("Neptune", earthOrbit * 30.04);
  orbits.set("Pluto", earthOrbit * 39.51);
*/

  drawOrbit(orbits.get("Mercury"), lineSegments);
  drawOrbit(orbits.get("Venus"), lineSegments);
  drawOrbit(orbits.get("Earth"), lineSegments);
  drawOrbit(orbits.get("Mars"), lineSegments);
  drawOrbit(orbits.get("Jupiter"), lineSegments);
  drawOrbit(orbits.get("Saturn"), lineSegments);
  drawOrbit(orbits.get("Uranus"), lineSegments);
  drawOrbit(orbits.get("Neptune"), lineSegments);
  drawOrbit(orbits.get("Pluto"), lineSegments);

  planets.set("Mercury", new SolarLib.Planet({
    name: "Mercury", texture: textureMercury,
    orbit: orbits.get("Mercury"), speed: earthSpeed * .4,
    radius: earthSize * .38, rotateSpeed: earthRotateSpeed * 0.1,
    color: 0xffffff,
    x: 0, y:0, z:0
  }));

  planets.set("Venus", new SolarLib.Planet({
    name: "Venus", texture: textureVenus,
    orbit: orbits.get("Venus"), speed: earthSpeed * .6,
    radius: earthSize * .95,
    color: 0xffffff, rotateSpeed: earthRotateSpeed * 0.2,
    x: 0, y:0, z:0
  }));

  planets.set("Venus", new SolarLib.Planet({
    name: "Venus", texture: textureVenus,
    orbit: orbits.get("Venus"), speed: earthSpeed * .6,
    radius: earthSize * .95,
    color: 0xffffff, rotateSpeed: earthRotateSpeed * 0.2,
    x: 0, y:0, z:0
  }));

  planets.set("Earth", new SolarLib.Planet({
    name: "Earth", texture: textureEarth,
    orbit: orbits.get("Earth"), speed: earthSpeed,
    radius: earthSize, rotateSpeed: earthRotateSpeed,
    color: 0x2194ce,
    x: 0, y:0, z:0
  }));

  planets.set("Mars", new SolarLib.Planet({
    name: "Mars", texture: textureMars,
    orbit: orbits.get("Mars"), speed: earthSpeed * 1.2,
    radius: earthSize * .53, rotateSpeed: earthRotateSpeed * 0.975,
    color: 0xffffff,
    x: 0, y:0, z:0
  }));

  planets.set("Jupiter", new SolarLib.Planet({
    name: "Jupiter", texture: textureJupiter,
    orbit: orbits.get("Jupiter"), speed: earthSpeed * 1.4,
    radius: earthSize * 11.20,
    color: 0xffffff, rotateSpeed: earthRotateSpeed * 2.43,
    x: 0, y:0, z:0
  }));

  planets.set("Saturn", new SolarLib.PlanetWithRings({
    name: "Saturn", texture: textureSaturn,
    ringsTexture: textureSaturnRings, ringAngle: 90,
    ringDistance: earthSize * 2.0, ringSize: earthSize * 6.00,
    orbit: orbits.get("Saturn"), speed: earthSpeed * 1.5,
    radius: earthSize * 9.45, rotateSpeed: earthRotateSpeed * 2.35,
    color: 0xffffff,
    x: 0, y:0, z:0
  }) );

  planets.set("Uranus", new SolarLib.PlanetWithRings({
    name: "Uranus", texture: textureUranus,
    ringsTexture: textureUranusRings, ringAngle: 0,
    ringDistance: earthSize * 1.5, ringSize: earthSize * 2.00,
    orbit: orbits.get("Uranus"), speed: earthSpeed * 2.0,
    radius: earthSize * 4.00, rotateSpeed: earthRotateSpeed * 1.34,
    color: 0xffffff,
    x: 0, y:0, z:0
  }) );

  planets.set("Neptune", new SolarLib.Planet({
    name: "Neptune", texture: textureNeptune,
    orbit: orbits.get("Neptune"), speed: earthSpeed * 2.5,
    radius: earthSize * 3.88, rotateSpeed: earthRotateSpeed * 1.25,
    color: 0xffffff,
    x: 0, y:0, z:0
  }));

  planets.set("Pluto", new SolarLib.Planet({
    name: "Pluto", texture: texturePluto,
    orbit: orbits.get("Pluto"), speed: earthSpeed * 3.0,
    radius: earthSize * 0.19, rotateSpeed: earthRotateSpeed * 0.3,
    color: 0xffffff,
    x: 0, y:0, z:0
  }));

  planets.forEach( (planet, key, map) => {
    planet.create(scene);
  });

  createStars();

/*
  // Fly Controls, currently not working
	controls = new THREE.FlyControls( camera );
	controls.movementSpeed = 1000;
	controls.domElement = renderer.domElement;
	controls.rollSpeed = Math.PI / 24;
	controls.autoForward = false;
	controls.dragToLook = false;
*/

  controls = new THREE.OrbitControls(camera, renderer.domElement);

  setupGui();

  animate();


// START FUNCTION DEFINITIONS ------------------------------------------------------

  function drawOrbit(radius = 200, segments = 360) {
    var material = new THREE.LineBasicMaterial({ color:0xffffff });
    var geometry = new THREE.Geometry();

    for(let i=0; i <= segments; i++) {
      var theta = i/segments * Math.PI * 2;
      geometry.vertices.push(
        new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius)
      );
    }

    scene.add( new THREE.Line(geometry, material) );
  }

  function createStars() {
    var stars1 = 50; // 250
    var stars2 = 375; // 1500

    var i, r = 2000, starsGeometry = [ new THREE.Geometry(), new THREE.Geometry() ];
    for ( i = 0; i < stars1; i ++ ) {
      var vertex = new THREE.Vector3();
      vertex.x = Math.random() * 2 - 1;
      vertex.y = Math.random() * 2 - 1;
      vertex.z = Math.random() * 2 - 1;
      vertex.multiplyScalar( r );
      starsGeometry[ 0 ].vertices.push( vertex );
    }
    for ( i = 0; i < stars2; i ++ ) {
      var vertex = new THREE.Vector3();
      vertex.x = Math.random() * 2 - 1;
      vertex.y = Math.random() * 2 - 1;
      vertex.z = Math.random() * 2 - 1;
      vertex.multiplyScalar( r );
      starsGeometry[ 1 ].vertices.push( vertex );
    }
    var stars;
    var starsMaterials = [
      new THREE.PointsMaterial( { color: 0xdddddd, size: 2, sizeAttenuation: false } ),
      new THREE.PointsMaterial( { color: 0xdddddd, size: 1, sizeAttenuation: false } ),
      new THREE.PointsMaterial( { color: 0xaaaaaa, size: 2, sizeAttenuation: false } ),
      new THREE.PointsMaterial( { color: 0x7a7a7a, size: 1, sizeAttenuation: false } ),
      new THREE.PointsMaterial( { color: 0x5a5a5a, size: 2, sizeAttenuation: false } ),
      new THREE.PointsMaterial( { color: 0x5a5a5a, size: 1, sizeAttenuation: false } )
    ];
    for ( i = 10; i < 30; i ++ ) {
      stars = new THREE.Points( starsGeometry[ i % 2 ], starsMaterials[ i % 6 ] );
      stars.rotation.x = Math.random() * 6;
      stars.rotation.y = Math.random() * 6;
      stars.rotation.z = Math.random() * 6;
      stars.scale.setScalar( i * 10 );
      stars.matrixAutoUpdate = false;
      stars.updateMatrix();
      scene.add( stars );
    }
  }

  function setupGui() {
    // initialize the guiControls
    guiControls = {
      amplitude: 8.0,
      displacement: 0,
      noise: 1.0,
      timeFactor: -0.15,
      brightness: 8.0,

      glowFactor: 0.28,
      glowPower: 7.33,
      glowTimeFactor: 1.5,
      vNormMultiplier: 1.0,
      size: 1,
      bumpScale: 61.0,
      bumpSpeed: 0.60
    }

    var gui = new dat.GUI();
    var folder = gui.addFolder("Sun Controls");

    folder.add(guiControls, "amplitude", 0.0, 100.0, 0.1).name("Amplitude").listen();
    folder.add(guiControls, "displacement", 0.0, 360.0, 1.0).name("Displacement").listen();
    folder.add(guiControls, "noise", -15.0, 15.0, 0.1).name("Noise").listen();
    folder.add(guiControls, "timeFactor", -5.0, 5.0, 0.05).name("Rotation");
    folder.add(guiControls, "brightness", -20.0, 20.0, 0.1).name("Brightness");

    var folder = gui.addFolder("Sun Glow Controls");

    folder.add(guiControls, "glowFactor", 0.0, 3.0, 0.01).name("Spread");
    folder.add(guiControls, "glowPower", 0.01, 10.0, 0.01).name("Intensity");
    folder.add(guiControls, "vNormMultiplier", 0.01, 5.0, 0.01).name("V Norm Multiplier");
    folder.add(guiControls, "glowTimeFactor", -5.0, 25.0, 0.5).name("Time Factor");
    folder.add(guiControls, "size", 0.5, 5, 0.01).name("Size");
    folder.add(guiControls, "bumpScale", -5.0, 100.0, 0.5).name("Corona Size");
    folder.add(guiControls, "bumpSpeed", 0.01, 20.0, 0.01).name("Corona Speed");
  }

  function animate() {
    requestAnimationFrame( animate );

    controls.update();

    var time = Date.now() * .01;

    _animateSun(time);

    planets.forEach( (planet, key, map) => {
      planet.update(scene, time);
    });

    renderer.render( scene, camera );

    // HELPERS ----------------------------------------------------------

    function _animateSun(curTime) {
      if(sun != undefined) {
        var rotationRadians = curTime * Math.PI/180;
        var timeRadians = curTime*5 * Math.PI/180

        sunUniforms.iTime.value += clock.getDelta() * guiControls.timeFactor;
        sunUniforms.brightnessMultiplier.value = guiControls.brightness;

        glowUniforms.glowFactor.value = guiControls.glowFactor;
        glowUniforms.glowPower.value = guiControls.glowPower;
        glowUniforms.vNormMultiplier.value = guiControls.vNormMultiplier;

        glowUniforms.bumpScale.value = guiControls.bumpScale;
        glowUniforms.bumpSpeed.value = guiControls.bumpSpeed;

        // Amplitude controls the amount of fuzziness in the border, as well as
        // rotation within the vertex
        sunUniforms.amplitude.value = guiControls.amplitude * Math.sin( timeRadians * 0.125 );

        var displacementRadians = guiControls.displacement * Math.PI/180;

        for ( var i = 0; i < sunDisplacement.length; i ++ ) {

//    				sunDisplacement[ i ] = (Math.sin(5.0 * i + Date.now() * Math.PI/180 ) + 5.5) / 2;
//    				sunDisplacement[ i ] = Math.sin( 5.0 * i + curTime );
/*
            // -0.25 to 0.25
   				  sunNoise[ i ] += 0.5 * ( 0.5 - Math.random() );
    				sunNoise[ i ] = THREE.Math.clamp( sunNoise[ i ], -2, 15 );

    				sunDisplacement[ i ] += sunNoise[ i ];
*/
//            sunDisplacement[ i ] = Math.sin( displacementRadians * i );


//            sunNoise[ i ] += 0.02 * ( 0.5 - Math.random() );
//            sunDisplacement[ i ] += sunNoise[ i ];
//            sunDisplacement[ i ] += guiControls.noise * Math.max( (Math.random() / 2 + 0.5), 0.2);
  			}

  			sun.geometry.attributes.displacement.needsUpdate = true;

        sun.matrixAutoUpdate = false;
//        sun.matrix.makeRotationY(rotationRadians);

      }

      if(sunGlow != undefined) {
        sunGlow.scale.set(guiControls.size, guiControls.size, guiControls.size);

        var subVector = new THREE.Vector3().subVectors( camera.position, sunGlow.position );

        glowUniforms.viewVector.value = subVector;
        glowUniforms.iTime.value += clock.getDelta() * guiControls.glowTimeFactor;
      }

    } // end _sunAnimate()

  } // end animate()


  function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    glowUniforms.iResolution.value = new THREE.Vector2(width, height);
    sunUniforms.iResolution.value = new THREE.Vector2(width, height);

    renderer.setSize( window.innerWidth, window.innerHeight );

  } // onWindowResize

} // end init



} )(SolarLib, THREE, dat, window.exports);
