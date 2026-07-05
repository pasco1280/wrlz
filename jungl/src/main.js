(function () {
  "use strict";

  var paintCanvas = document.getElementById("paint");
  var sceneCanvas = document.getElementById("scene");
  var hudScroll = document.getElementById("hud-scroll");
  var hudFps = document.getElementById("hud-fps");

  var scene2d = sceneCanvas.getContext("2d");

  var state = {
    scroll: 0,
    startTime: performance.now(),
    dpr: 1,
    ready: false
  };

  window.JUNGL = window.JUNGL || {};
  window.JUNGL.state = state;
  window.JUNGL.sceneCanvas = sceneCanvas;
  window.JUNGL.scene2d = scene2d;
  window.JUNGL.hud = { scroll: hudScroll, fps: hudFps };
  window.JUNGL.onFrame = [];
  window.JUNGL.onResize = [];

  // Papier-Shader stillgelegt: #paint bleibt display:none (siehe styles.css),
  // paper.jpg laeuft als CSS-Background auf .hero/.content. Der WebGL-Canvas
  // wird nicht mehr initialisiert oder gezeichnet -- Loop/Hooks/HUD unberuehrt.
  paintCanvas.style.display = "none";

  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.dpr = dpr;
    var w = window.innerWidth;
    var h = window.innerHeight;

    sceneCanvas.width = w * dpr;
    sceneCanvas.height = h * dpr;
    scene2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (var i = 0; i < window.JUNGL.onResize.length; i++) {
      window.JUNGL.onResize[i](w, h);
    }
  }

  window.addEventListener("resize", resize);
  resize();

  gsap.registerPlugin(ScrollTrigger);

  ScrollTrigger.create({
    trigger: ".hero",
    start: "top top",
    end: "+=560%",
    pin: true,
    scrub: 1,
    onUpdate: function (self) {
      state.scroll = self.progress;
      hudScroll.textContent = self.progress.toFixed(3);
    }
  });

  var fps = 0;
  var frameCount = 0;
  var fpsAccum = 0;
  var lastFrameTime = performance.now();

  function render(now) {
    if (document.hidden && !window.JUNGL.forceRun) {
      lastFrameTime = now;
      requestAnimationFrame(render);
      return;
    }

    var delta = now - lastFrameTime;
    lastFrameTime = now;
    var dt = Math.min(delta, 100) / 1000;

    if (delta > 0) {
      var instantFps = 1000 / delta;
      frameCount++;
      fpsAccum += instantFps;
      if (frameCount >= 10) {
        fps = fpsAccum / frameCount;
        hudFps.textContent = Math.round(fps);
        frameCount = 0;
        fpsAccum = 0;
      }
    }

    var elapsed = (now - state.startTime) / 1000;

    // WebGL-Rendering des Papier-Shaders uebersprungen (Canvas ist display:none).
    // Loop, onFrame-Hooks und HUD laufen unveraendert weiter.

    if (state.ready) {
      var frameCallbacks = window.JUNGL.onFrame;
      for (var i = 0; i < frameCallbacks.length; i++) {
        frameCallbacks[i](dt, elapsed);
      }
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  /* ============================================================
     ASSET-PRELOADER
     Laedt alle Bilder + Sprite-Sheets aus manifest.json bevor das
     Intro startet. Waehrend des Ladens ist nur das Papier sichtbar
     (CSS ist sofort da, kein JS noetig). window.JUNGL.assets haelt
     die geladenen Image-Objekte, window.JUNGL.manifest die Rohdaten.
  ============================================================ */

  // Die Splat-PNGs (branch/splat/leaf/tocapu) haben keinen Alpha-Kanal --
  // heller/weisser Hintergrund, bunte Tusche-Form. Fuer die Ink-Bleed-Reveal-
  // Masken wird eine echte RGBA-Version gebraucht: Alpha = Abstand zu Weiss,
  // damit nur die Blob-Form (nicht das Bild-Rechteck) die Maske aufdeckt.
  function makeAlphaMask(img) {
    var c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    var ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    var data = ctx.getImageData(0, 0, c.width, c.height);
    var px = data.data;
    for (var i = 0; i < px.length; i += 4) {
      var r = px[i], g = px[i + 1], b = px[i + 2];
      var whiteness = (r + g + b) / 3;
      var alpha = 255 - whiteness;
      alpha = Math.max(0, Math.min(255, alpha * 1.6));
      px[i] = 20; px[i + 1] = 20; px[i + 2] = 20;
      px[i + 3] = alpha;
    }
    ctx.putImageData(data, 0, 0);
    return c;
  }

  // Alle Splat-/Blatt-/Tocapu-/Ast-PNGs haben einen weissen bzw. cremefarbenen
  // Hintergrund ohne Alpha-Kanal. Fuer das SICHTBARE Zeichnen (nicht die
  // Reveal-Maske oben) wird hier eine farbtreue Version mit echtem Alpha
  // erzeugt: Alpha = 0 ab whiteness > 245, weicher Verlauf 215..245, darunter
  // voll deckend. Ein harter Cutoff liesse (durch Anti-Aliasing/JPEG-Rauschen
  // am Rand) einen sichtbaren, fast-transparenten weisslichen Rest-Rahmen
  // stehen -- der weiche Verlauf vermeidet das.
  function makeCleanColorVersion(img) {
    var c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    var ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    var data = ctx.getImageData(0, 0, c.width, c.height);
    var px = data.data;
    var WHITE_LO = 215, WHITE_HI = 245;
    for (var i = 0; i < px.length; i += 4) {
      var r = px[i], g = px[i + 1], b = px[i + 2];
      var whiteness = (r + g + b) / 3;
      var alpha;
      if (whiteness >= WHITE_HI) {
        alpha = 0;
      } else if (whiteness <= WHITE_LO) {
        alpha = 255;
      } else {
        alpha = 255 * (1 - (whiteness - WHITE_LO) / (WHITE_HI - WHITE_LO));
      }
      px[i + 3] = Math.min(px[i + 3], alpha);
    }
    ctx.putImageData(data, 0, 0);
    return c;
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        // img.decode() garantiert dass die Bitmap tatsaechlich dekodiert ist,
        // bevor irgendein Code drawImage/getImageData darauf aufruft --
        // onload allein kann (v.a. bei vielen parallelen Preloads grosser
        // Bilder) bereits vor vollstaendiger Dekodierung feuern, was bei
        // synchronen Canvas-Auslese-Operationen (z.B. Alpha-Masken-Erzeugung)
        // sonst zu einem leeren Ergebnis fuehren kann.
        if (img.decode) {
          img.decode().then(function () { resolve(img); }).catch(function () { resolve(img); });
        } else {
          resolve(img);
        }
      };
      img.onerror = function () {
        console.warn("[JUNGL] Bild konnte nicht geladen werden:", src);
        resolve(null);
      };
      img.src = src;
    });
  }

  function loadManifest() {
    return fetch("assets/manifest.json").then(function (res) { return res.json(); });
  }

  // Laedt ein Video als HTMLVideoElement (muted/playsInline, preload="auto").
  // KEIN loop, KEIN autoplay: jedes Video spielt genau einmal und friert dann
  // auf dem letzten Frame ein ("die Tinte trocknet"). Gestartet wird es von
  // der Choreografie, wenn seine Szene aufblueht (mist_live direkt nach dem
  // Preload). Aufgeloest ueber "canplaythrough" ODER "loadeddata", mit
  // Timeout-Fallback (3.5s), damit ein haengendes Video den Preload nicht
  // blockiert.
  function loadVideo(src) {
    return new Promise(function (resolve) {
      var video = document.createElement("video");
      video.muted = true;
      video.loop = false;
      video.playsInline = true;
      video.preload = "auto";
      var settled = false;
      var timeoutId = setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve(video);
      }, 3500);
      function onReady() {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(video);
      }
      video.addEventListener("canplaythrough", onReady, { once: true });
      video.addEventListener("loadeddata", onReady, { once: true });
      video.addEventListener("error", function () {
        console.warn("[JUNGL] Video konnte nicht geladen werden:", src);
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(video);
      }, { once: true });
      video.src = src;
      video.load();
    });
  }

  window.JUNGL.assets = { img: {}, sprites: {}, videos: {}, splashVideos: {} };

  loadManifest().then(function (manifest) {
    window.JUNGL.manifest = manifest;

    var jobs = [];
    var assets = window.JUNGL.assets;

    function reg(key, file) {
      jobs.push(loadImage(file).then(function (img) { assets.img[key] = img; }));
    }

    reg("paper", manifest.paper.file);
    if (manifest.borderTile) reg("borderTile", manifest.borderTile.file);
    Object.keys(manifest.layers).forEach(function (key) {
      reg("layer_" + key, manifest.layers[key].file);
    });
    // scenes: entweder Alpha-PNG (manifest.scenes[key].file) oder animiertes
    // transparentes VP8-Alpha-WebM (manifest.scenes[key].video). Bild-Szenen
    // sind bereits echte RGBA-PNGs (cremefarbener Hintergrund transparent
    // gemacht) -- KEIN makeCleanColorVersion noetig, direkt als Image laden.
    // Video-Szenen landen in assets.videos[key], nicht assets.img.
    Object.keys(manifest.scenes).forEach(function (key) {
      var entry = manifest.scenes[key];
      if (entry.video) {
        jobs.push(loadVideo(entry.video).then(function (video) { assets.videos[key] = video; }));
      } else if (entry.file) {
        reg("scene_" + key, entry.file);
      }
    });
    // branch_*.png haben einen cremefarbenen Hintergrund ohne Alpha-Kanal --
    // hier durch eine farbtreue, alpha-bereinigte Version ersetzen (siehe
    // makeCleanColorVersion), damit spaeteres Zeichnen keinen sichtbaren
    // Bild-Hintergrund/Rest-Rahmen mitschleppt.
    Object.keys(manifest.branches).forEach(function (key) {
      jobs.push(loadImage(manifest.branches[key].file).then(function (img) {
        assets.img["branch_" + key] = img && img.width ? makeCleanColorVersion(img) : img;
      }));
    });
    Object.keys(manifest.sprites).forEach(function (key) {
      if (key === "frameW" || key === "frameH" || key === "cols") return;
      jobs.push(loadImage(manifest.sprites[key].file).then(function (img) {
        assets.sprites[key] = img;
      }));
    });
    assets.img.splatMask = {};
    Object.keys(manifest.splats).forEach(function (family) {
      assets.img["splat_" + family] = [];
      assets.img.splatMask[family] = [];
      manifest.splats[family].forEach(function (file, i) {
        jobs.push(loadImage(file).then(function (img) {
          if (!img) return;
          assets.img.splatMask[family][i] = makeAlphaMask(img);
          // Sichtbare Splat-Stempel selbst ebenfalls alpha-bereinigen (siehe
          // makeCleanColorVersion) -- sonst bleibt ein weisslicher Rest-Rand
          // um jeden Kleks sichtbar, besonders ueber dunklen Bildbereichen.
          var clean = makeCleanColorVersion(img);
          clean._splatFamily = family; clean._splatIndex = i;
          assets.img["splat_" + family][i] = clean;
        }));
      });
    });
    // Splash-Videos (Landungs-Klecks bei Stationswechseln): eigener
    // Namensraum getrennt von assets.videos (das sind Szenen) -- gleiche
    // Lade-Strategie (muted, kein loop, kein autoplay), gestartet wird jedes
    // Splash-Video von der Choreografie beim Triggern (siehe choreo.js).
    if (manifest.splashes) {
      Object.keys(manifest.splashes).forEach(function (key) {
        var entry = manifest.splashes[key];
        if (entry.video) {
          jobs.push(loadVideo(entry.video).then(function (video) { assets.splashVideos[key] = video; }));
        }
      });
    }
    assets.img.leaves = [];
    manifest.leaves.forEach(function (file, i) {
      jobs.push(loadImage(file).then(function (img) {
        assets.img.leaves[i] = img && img.width ? makeCleanColorVersion(img) : img;
      }));
    });

    return Promise.all(jobs);
  }).then(function () {
    // Easter Egg am Titel-Siegel: das geometrische Siegel (tocapu-seal)
    // pulsiert endlos im Loop. Klickt jemand darauf, blendet EINMAL der
    // sich drehende Jaguar-Kopf (tocapu-head) an derselben Stelle ein,
    // danach geht es zurueck zum Siegel -- ein Geheimnis, das entdeckt
    // werden muss, kein Zufallstimer.
    (function () {
      var wrap = document.getElementById("title-tocapu");
      var seal = document.getElementById("tocapu-seal");
      var head = document.getElementById("tocapu-head");
      if (!wrap || !seal || !head) return;
      var revealing = false;
      function playSafe(v) {
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      }
      wrap.style.pointerEvents = "auto";
      wrap.style.cursor = "pointer";
      wrap.addEventListener("click", function () {
        if (revealing) return;
        revealing = true;
        head.currentTime = 0;
        head.style.opacity = "1";
        seal.style.opacity = "0";
        playSafe(head);
      });
      head.addEventListener("ended", function () {
        head.style.opacity = "0";
        seal.style.opacity = "1";
        revealing = false;
      });
    })();
    // Zweites Easter Egg (Pascal 05.07.): ein subtiler Zettel LINKS vom
    // Logo (CSS: #tocapu-joke), der zusammen mit dem Jaguarkopf erscheint.
    // Erst der Rahmen (sofort), dann nach 1s tippt sich die
    // Frage Buchstabe fuer Buchstabe, nach 3s Pause die Antwort, haelt
    // danach 3s und verschwindet wieder. Eigene Timeline (kein GSAP-
    // TextPlugin noetig): ein Zaehler-Objekt wird getweent, onUpdate
    // schneidet den sichtbaren Text-Teilstring daraus.
    (function () {
      var wrap = document.getElementById("title-tocapu");
      var jokeWrap = document.getElementById("tocapu-joke");
      var jokeQ = document.getElementById("tocapu-joke-q");
      var jokeA = document.getElementById("tocapu-joke-a");
      if (!wrap || !jokeWrap || !jokeQ || !jokeA) return;

      // "jungle" bewusst als "jungl" geschrieben (Pascal 05.07.) -- kleiner
      // Insider, spielt mit dem Marken-/Site-Namen JUNGL ohne "e". Auf 4
      // Zeilen umgebrochen (Pascal 05.07.), damit der Text in die schmalere
      // Hochform der blauen Jade-Flaeche passt -- \n funktioniert dank
      // white-space:pre-wrap auf #tocapu-joke-q/-a direkt als Zeilenumbruch.
      var JOKE_Q = "Why do lions get lost\nin the jungl?";
      var JOKE_A = "Cause JUNGL\nis MASSIVE";
      var QUESTION_START = 1.0;
      var QUESTION_DUR = 2.6;
      var PAUSE_AFTER_Q = 3.0;
      var ANSWER_DUR = 1.8;
      var HOLD_AFTER_A = 3.0;
      var jokeTimeline = null;

      function typewrite(el, text, duration) {
        var counter = { n: 0 };
        return gsap.to(counter, {
          n: text.length,
          duration: duration,
          ease: "none",
          onUpdate: function () { el.textContent = text.slice(0, Math.round(counter.n)); }
        });
      }

      wrap.addEventListener("click", function () {
        if (jokeTimeline) jokeTimeline.kill();
        jokeQ.textContent = "";
        jokeA.textContent = "";
        jokeWrap.classList.add("is-visible");

        var answerStart = QUESTION_START + QUESTION_DUR + PAUSE_AFTER_Q;
        var hideAt = answerStart + ANSWER_DUR + HOLD_AFTER_A;
        jokeTimeline = gsap.timeline({ onComplete: function () { jokeTimeline = null; } });
        jokeTimeline.add(typewrite(jokeQ, JOKE_Q, QUESTION_DUR), QUESTION_START);
        jokeTimeline.add(typewrite(jokeA, JOKE_A, ANSWER_DUR), answerStart);
        jokeTimeline.call(function () { jokeWrap.classList.remove("is-visible"); }, null, hideAt);
      });

      // Minimale Maus-Parallax (Pascal 05.07., "wie das Hintergrundbild im
      // Intro"): --px/--py auf #tocapu-joke selbst (nicht #tocapu-joke-inner,
      // das hat seine eigene Fade/Scale-Transition, siehe CSS-Kommentar).
      // Eigener rAF-Loop mit Lerp-Glaettung statt direktem 1:1-Folgen --
      // wirkt dadurch traege/organisch statt ruckartig, laeuft dauerhaft
      // (auch wenn der Zettel unsichtbar ist, kostet quasi nichts).
      var PARALLAX_RANGE_PX = 9;
      var PARALLAX_EASE = 0.05;
      var targetPX = 0, targetPY = 0, curPX = 0, curPY = 0;
      window.addEventListener("mousemove", function (e) {
        targetPX = (e.clientX / window.innerWidth - 0.5) * PARALLAX_RANGE_PX;
        targetPY = (e.clientY / window.innerHeight - 0.5) * PARALLAX_RANGE_PX;
      }, { passive: true });

      function tickParallax() {
        curPX += (targetPX - curPX) * PARALLAX_EASE;
        curPY += (targetPY - curPY) * PARALLAX_EASE;
        jokeWrap.style.setProperty("--px", curPX.toFixed(2) + "px");
        jokeWrap.style.setProperty("--py", curPY.toFixed(2) + "px");
        requestAnimationFrame(tickParallax);
      }
      requestAnimationFrame(tickParallax);
    })();
    // Nebel-Grundschicht startet sofort (spielt einmal, friert dann ein).
    // Die Stations-Videos startet die Choreografie bei ihrem Aufbluehen.
    var mistVideo = window.JUNGL.assets.videos && window.JUNGL.assets.videos.mist_live;
    if (mistVideo) {
      var mp = mistVideo.play();
      if (mp && mp.catch) mp.catch(function () {});
    }
    state.ready = true;
    if (typeof window.JUNGL.onAssetsReady === "function") {
      window.JUNGL.onAssetsReady();
    }
  }).catch(function (err) {
    console.warn("[JUNGL] Manifest/Asset-Load fehlgeschlagen:", err);
    state.ready = true;
  });
})();
