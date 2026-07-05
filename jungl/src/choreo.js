(function () {
  "use strict";

  /* ============================================================
     KONSTANTEN
  ============================================================ */

  var PALETTE = {
    creme: "#F6EEDC",
    jade: "#8FBFAA",
    petrol: "#2E6E5E",
    terracotta: "#D9906F",
    gold: "#E2B75C",
    pink: "#D97C93",
    tusche: "#2B2723"
  };

  var SPLAT_FAMILY_ORDER = ["jade", "terra", "gold", "pink"];

  // Kollage-Szenen-Stationen: "Daumenkino auf demselben Papier". Jede Szene
  // ist ein Alpha-PNG oder animiertes Alpha-WebM mit dem Motiv baked-in
  // (Jaguar/Tier bereits Teil des Gemaeldes -- keine separaten Geister-Posen
  // mehr). Placement bestimmt wo/wie gross das Element auf dem Papier
  // verankert wird (siehe drawSceneCollage): { side, vAlign, widthVw }.
  // Da die Motive dank Alpha meist auf einer Bildseite sitzen (Rest
  // transparent), ergaenzen sich aktive Station + Vorstation nahtlos ohne
  // Motiv-Kollision -- das ist der Kern der Kollage (siehe sceneChain).
  //
  // p: Scroll-Progress-Schwelle, ab der die Station aktiv ist.
  // scene: Szenen-Key (Bild ODER Video, siehe manifest.scenes).
  // placement: { side: "left"|"right"|"center", vAlign: "top"|"center"|"bottom", widthVw }.
  // letter: Buchstabe, der beim ERSTEN Vorwaertserreichen gestempelt wird.
  // finale: true triggert Subline/Nav-Deko.
  // Pascal-Regie 04.07.: Panther 1 + Sprung gespiegelt (Reise laeuft nach
  // links, der Ast haengt an einem ungesehenen Baum rechts), Tukan nach
  // rechts, Schlange nach links oben, walkaway raus (ueberfluessig),
  // G wandert zum Kolibri.
  // Splash-Positionen (Pascal 04./05.07., "filmreif"): seit der Papier-Maske
  // (drawSplashes stanzt Szenen-Silhouetten aus) liegen die Kleckse UNTER
  // bzw. NEBEN den Tieren auf freiem Papier, nicht mehr auf ihnen. Farbe
  // passt zum Tier (schwarzer Panther -> sumi, gruene Schlange/Kolibri ->
  // jade, Toucan-Schnabel -> terra), Position direkt unter der aufbluehenden
  // Flaeche, mit Kontakt zur Silhouette (Klecks ueberlappt leicht, Stanzung
  // erzeugt die Beruehrungskante -- kein frei schwebender Klecks daneben).
  // u/v sind relativ zum Szenen-Rect der Station (siehe triggerSplash /
  // sceneCollageRect), NICHT zum Viewport -- Pascal 05.07.: auf seinem
  // breiten Screen drifteten viewport-relative Kleckse von den Tieren weg.
  //   walk/leap: sumi-Becken unterm Panther-Koerper ("aus der Tinte")
  //   toucan: terra-Glut im Spalt direkt unterm Vogel (Walk-Szene stanzt mit)
  //   crouch: sumi-Pool an der Ast-Spitze, der Panther schleicht darauf zu
  //   snake: jade2-Kreis dicht unterm Schlangenkopf, ihre Tropfen laufen rein
  //   hummingbird: jade direkt unterm Vogel, Schwanzfedern tauchen ein
  //   family: terra-Wash hinterm JUNGL-Titel (Pascal: "untermalt das Logo",
  //           NICHT verschieben; Szene reicht bis zum Boden, deshalb oben)
  var STATIONS = [
    { p: 0.07, scene: "jaguar_walk",      placement: { side: "right",  vAlign: "center", widthVw: 0.66, flipX: true }, letter: "J", splash: { key: "sumi",   u: 0.482, v: 0.598, sizeVw: 0.34 } },
    { p: 0.21, scene: "toucan",           placement: { side: "right",  vAlign: "top",    widthVw: 0.42 }, letter: null, splash: { key: "terra",  u: 0.43, v: 1.034, sizeVw: 0.31 } },
    { p: 0.35, scene: "jag_crouch",       placement: { side: "left",   vAlign: "bottom", widthVw: 0.62 }, letter: "U", splash: { key: "sumi",   u: 0.598, v: 0.52, sizeVw: 0.30 } },
    { p: 0.49, scene: "snake",            placement: { side: "left",   vAlign: "top",    widthVw: 0.46 }, letter: null, splash: { key: "jade2",  u: 0.33, v: 0.646, sizeVw: 0.26 } },
    { p: 0.63, scene: "jag_leap",         placement: { side: "right",  vAlign: "center", widthVw: 0.66, flipX: true }, letter: "N", splash: { key: "sumi",   u: 0.45, v: 0.530, sizeVw: 0.34 } },
    // freeze=true (Kolibri + Finale): beide sollen im Finale-Bild dauerhaft
    // sichtbar bleiben (Pascal 05.07., Referenz-Screenshot "blau UND orange
    // in der Mitte"), nicht nach 2.8s wegfaden -- siehe splashAlphaAt/
    // updateSplashes. Position/Groesse NICHT anfassen (Pascal-Freigabe).
    { p: 0.77, scene: "hummingbird_live", placement: { side: "left",   vAlign: "center", widthVw: 0.50 }, letter: "G", splash: { key: "jade",   u: 0.50, v: 0.700, sizeVw: 0.28, freeze: true } },
    { p: 0.88, scene: "jag_family",       placement: { side: "center", vAlign: "bottom", widthVw: 0.95 }, letter: "L", finale: true, splash: { key: "terra",  u: 0.50, v: 0.07, sizeVw: 0.36, freeze: true } }
  ];

  // pano_temple ist derzeit keiner STATIONS-Eintrag (Szene existiert im
  // Manifest, wird aber aktuell nicht in der Stations-Kette referenziert) --
  // Splash-Konfiguration hier als Reserve gehalten, falls die Station
  // reaktiviert wird: { key: "terra2", nx: 0.50, ny: 0.45, sizeVw: 0.34 }.

  // Szene der Intro-Sequenz (siehe buildIntro weiter unten) -- auch das
  // Rueckwaerts-Ziel unter Station 0 (VIRTUAL_STATION_PRE, Punkt 4a). Glied
  // -1 der Kollage-Kette: liegt links, bleibt bis Station 1 aufblueht.
  var INTRO_SCENE = "treeL";
  var INTRO_PLACEMENT = { side: "left", vAlign: "center", widthVw: 0.62 };
  // Unterm Torbogen des Intro-Baums, oben an Moos/Wurzeln gestanzt --
  // die Tinte pool-t wie eine Quelle unter dem Tor (Papier-Maske s.o.).
  // u/v relativ zum treeL-Szenen-Rect, wie bei den STATIONS.
  var INTRO_SPLASH = { key: "jade2", u: 0.53, v: 0.702, sizeVw: 0.30 };

  // Virtuelle "Station -1": Rueckwaerts-Ziel unter Station 0 (siehe
  // updateJaguar/Punkt 4a, stationAt/desiredSceneSet weiter unten). Keine
  // echte STATIONS-Eintrag, nur scene+placement, keine Pose -- lebt hier
  // statt in STATIONS, damit die Buchstaben-/Finale-Oneshot-Logik (die ueber
  // STATIONS iteriert) unberuehrt bleibt.
  var VIRTUAL_STATION_PRE = { scene: INTRO_SCENE, placement: INTRO_PLACEMENT };

  var SCENE_REVEAL_DURATION = 3.0;
  var SCENE_STAMP_COUNT = 7;
  var SCENE_OPACITY = 0.92;

  function activeStationIndex(progress) {
    var idx = -1;
    for (var i = 0; i < STATIONS.length; i++) {
      if (progress >= STATIONS[i].p) idx = i;
    }
    return idx;
  }

  function buildSnapPoints() {
    var points = [0];
    STATIONS.forEach(function (s) { points.push(s.p); });
    points.push(1);
    return points;
  }

  var TITLE_LETTERS = ["J", "U", "N", "G", "L"];
  var TITLE_LETTER_ROT = [-2, 1.4, -1, 2, -1.6];
  var LEAF_COUNT = 6;

  /* ============================================================
     STATE / SHARED HOOKS (aus main.js)
  ============================================================ */

  var J = window.JUNGL;
  var scene2d = J.scene2d;
  var sceneCanvas = J.sceneCanvas;

  var viewport = { w: window.innerWidth, h: window.innerHeight };
  var mouse = { nx: 0.5, ny: 0.5 };

  var choreo = {
    scrollProgress: 0,
    introActive: true,
    introDone: false,
    currentSegment: "intro",
    currentStationIndex: -1,
    firedOneShots: {}
  };

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function px(nx, ny) {
    return { x: nx * viewport.w, y: ny * viewport.h };
  }

  function seededRandom(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  /* ============================================================
     ASSETS (befuellt nach Preload, siehe onAssetsReady unten)
  ============================================================ */

  var manifest = null;
  var A = null; // window.JUNGL.assets Kurzform

  /* ============================================================
     OFFSCREEN LAYER + INK-BLEED REVEAL SYSTEM
     Jede Ebene (mist, foliage_left, foliage_right, branch top/mid/bottom)
     bekommt einen Content-Offscreen (das fertig positionierte Bild,
     multiply-vorkomponiert) + einen Masken-Offscreen. Die Maske waechst
     durch Splat-Stempel (destination-in), damit die Ebene organisch
     "einblutet" statt linear zu faden.
  ============================================================ */

  function makeCanvas() {
    var c = document.createElement("canvas");
    return c;
  }

  var revealLayers = {}; // key -> { content: canvas, mask: canvas, maskCtx, ready }

  function ensureRevealLayer(key) {
    if (!revealLayers[key]) {
      var content = makeCanvas();
      var mask = makeCanvas();
      revealLayers[key] = {
        content: content,
        contentCtx: content.getContext("2d"),
        mask: mask,
        maskCtx: mask.getContext("2d"),
        stamps: [], // { nx, ny, scale, targetScale, img, rot, startTime, duration }
        dirty: true,
        fullyRevealed: false,
        // Generation-Zaehler: jeder neue Reveal-Start (siehe startLayerReveal)
        // erhoeht ihn. Ein verzoegerter fullRevealMask-Callback aus einem
        // ABGEBROCHENEN aelteren Reveal (z.B. wenn dieselbe Ebene waehrend
        // eines laufenden Reveals erneut angestossen wird) prueft seine
        // eigene Generation gegen den aktuellen Stand und wird sonst
        // verworfen -- sonst markiert er die Maske faelschlich als fertig,
        // obwohl die NEUEN Stempel gerade erst gestartet sind.
        revealGen: 0,
        // "reveal" (Standard): Maske waechst von leer zu voll, redrawMask
        // loescht+zeichnet alle Stamps mit source-over neu.
        // "erode": Maske startet voll und wird per destination-in-Loch
        // (inverses Stamp-Alpha) von innen nach aussen durchsichtig --
        // siehe redrawMask/addMaskStamp op-Parameter.
        mode: "reveal"
      };
    }
    return revealLayers[key];
  }

  // Startet/erneuert einen zeitgesteuerten Abschluss fuer layerKey, robust
  // gegen mehrfaches erneutes Anstossen derselben Ebene (siehe revealGen-
  // Kommentar oben). onDone (Default fullRevealMask) laeuft nur, wenn diese
  // Generation zum Ablaufzeitpunkt noch die aktuelle ist -- ein durch einen
  // neueren Reveal/Erosion-Start ueberholter (abgebrochener) Callback wird
  // verworfen.
  function startLayerReveal(layerKey, duration, onDone) {
    var layer = ensureRevealLayer(layerKey);
    layer.revealGen += 1;
    var gen = layer.revealGen;
    gsap.to({}, {
      duration: duration,
      onComplete: function () {
        if (layer.revealGen === gen) (onDone || fullRevealMask)(layerKey);
      }
    });
  }

  function sizeCanvasToViewport(c) {
    var dpr = J.state.dpr || 1;
    var w = Math.round(viewport.w * dpr);
    var h = Math.round(viewport.h * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
  }

  function pickSplatImg(family, seedRng) {
    var arr = A.img["splat_" + family];
    if (!arr || !arr.length) return null;
    var idx = Math.floor(seedRng() * arr.length) % arr.length;
    return arr[idx];
  }

  // Fuer Reveal-Masken: gleicher Index-Zug wie pickSplatImg, aber die
  // Alpha-Maskenversion (weiss->transparent) statt des sichtbaren Bildes.
  function pickSplatMaskImg(family, seedRng) {
    var arr = A.img["splat_" + family];
    var maskArr = A.img.splatMask && A.img.splatMask[family];
    if (!arr || !arr.length) return null;
    var idx = Math.floor(seedRng() * arr.length) % arr.length;
    return (maskArr && maskArr[idx]) || arr[idx];
  }

  // Easing-Funktionen fuers manuelle Stamp-Wachstum (kein GSAP-Tween, siehe
  // updateMaskStamps). "quad.out" (Default, bisheriges Verhalten) fuer Pose-
  // Blooms; "power3.out" fuer Szenen-Reveal/Erosion -- schnelle Anfangs-
  // ausbreitung, langes langsames Auslaufen am Ende (Kapillarfluss-Optik,
  // MoXi/Lattice-Boltzmann-Referenz).
  var EASE_FNS = {
    "quad.out": function (t) { return 1 - Math.pow(1 - t, 2); },
    "power3.out": function (t) { return 1 - Math.pow(1 - t, 3); }
  };

  // Fuellt/erweitert die Maske einer Ebene mit wachsenden Splat-Stempeln.
  // op: "reveal" (Default, additiv sichtbar machen) oder "erode" (Loch in
  // eine volle Maske stempeln, siehe redrawMask). ease: Key aus EASE_FNS,
  // Default "quad.out".
  function addMaskStamp(layerKey, nx, ny, family, duration, delay, scaleTarget, op, ease) {
    var layer = ensureRevealLayer(layerKey);
    var rng = seededRandom(Math.floor(nx * 9973 + ny * 7919 + layerKey.length * 131 + layer.stamps.length * 17));
    var img = pickSplatMaskImg(family, rng);
    layer.stamps.push({
      nx: nx, ny: ny,
      img: img,
      rot: rng() * Math.PI * 2,
      scale: 0.2,
      targetScale: scaleTarget || 2.5,
      elapsed: -(delay || 0),
      duration: duration || 1.0,
      done: false,
      op: op || "reveal",
      ease: ease || "quad.out"
    });
    layer.dirty = true;
  }

  function updateMaskStamps(layer, dt) {
    if (layer.fullyRevealed) return false;
    var anyActive = false;
    for (var i = 0; i < layer.stamps.length; i++) {
      var s = layer.stamps[i];
      if (s.done) continue;
      s.elapsed += dt;
      if (s.elapsed < 0) { anyActive = true; continue; }
      var t = clamp01(s.elapsed / s.duration);
      var easeFn = EASE_FNS[s.ease] || EASE_FNS["quad.out"];
      var eased = easeFn(t);
      s.scale = lerp(0.2, s.targetScale, eased);
      if (t >= 1) s.done = true;
      layer.dirty = true;
      anyActive = true;
    }
    return anyActive;
  }

  function redrawMask(layerKey) {
    var layer = revealLayers[layerKey];
    if (!layer || layer.fullyRevealed) return;
    sizeCanvasToViewport(layer.mask);
    var ctx = layer.maskCtx;
    var dpr = J.state.dpr || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, layer.mask.width, layer.mask.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (layer.mode === "erode") {
      // Erosion startet von einer voll deckenden Maske, jeder Stamp frisst
      // per destination-out ein Loch hinein (umgekehrt zu "reveal", das von
      // leer aus additiv aufbaut).
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, layer.mask.width, layer.mask.height);
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
    }
    for (var i = 0; i < layer.stamps.length; i++) {
      var s = layer.stamps[i];
      if (!s.img || s.scale <= 0) continue;
      var cx = s.nx * viewport.w;
      var cy = s.ny * viewport.h;
      var size = Math.max(viewport.w, viewport.h) * 0.6 * s.scale;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(s.rot);
      ctx.drawImage(s.img, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    layer.dirty = false;
  }

  // Kompositiert das Ebenenbild (multiply-vorbereitet) einmalig in content,
  // wird nur bei resize/erstem Reveal neu gezeichnet.
  function buildLayerContent(layerKey, drawFn) {
    var layer = ensureRevealLayer(layerKey);
    sizeCanvasToViewport(layer.content);
    var ctx = layer.contentCtx;
    var dpr = J.state.dpr || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, layer.content.width, layer.content.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFn(ctx);
  }

  // Zeichnet content maskiert mit mask (destination-in) auf den Hauptscene-Ctx.
  // offsetPx: optionaler {x,y} Parallax-Versatz in CSS-Pixeln.
  function drawMaskedLayer(layerKey, opacity, offsetPx, compositeOp) {
    var layer = revealLayers[layerKey];
    if (!layer) return;
    if (layer.dirty) redrawMask(layerKey);

    // Compose content x mask in einem eigenen Scratch-Canvas (destination-in),
    // dann mit multiply auf die Szene.
    var scratch = ensureScratch(layerKey);
    sizeCanvasToViewport(scratch.canvas);
    var sctx = scratch.ctx;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, scratch.canvas.width, scratch.canvas.height);
    sctx.globalCompositeOperation = "source-over";
    sctx.drawImage(layer.content, 0, 0);
    sctx.globalCompositeOperation = "destination-in";
    sctx.drawImage(layer.mask, 0, 0);
    sctx.globalCompositeOperation = "source-over";

    var dpr = J.state.dpr || 1;
    var ox = offsetPx ? offsetPx.x * dpr : 0;
    var oy = offsetPx ? offsetPx.y * dpr : 0;

    scene2d.save();
    scene2d.globalAlpha = opacity !== undefined ? opacity : 1;
    // Szenen/Nebel verschmelzen per multiply mit dem Papier. Die Creature-
    // Ebene braucht source-over: eine helle Pose auf dunklem Szenengrund
    // kann per multiply nie sichtbar werden (multiply dunkelt nur ab).
    scene2d.globalCompositeOperation = compositeOp || "multiply";
    scene2d.setTransform(1, 0, 0, 1, 0, 0);
    scene2d.drawImage(scratch.canvas, ox, oy);
    scene2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    scene2d.globalCompositeOperation = "source-over";
    scene2d.globalAlpha = 1;
    scene2d.restore();
  }

  var scratchCanvases = {};
  function ensureScratch(key) {
    if (!scratchCanvases[key]) {
      var c = makeCanvas();
      scratchCanvases[key] = { canvas: c, ctx: c.getContext("2d") };
    }
    return scratchCanvases[key];
  }

  /* ============================================================
     PARALLAX-EBENEN (mist, foliage_left, foliage_right)
  ============================================================ */

  function drawParallaxLayerContent(key, ctx) {
    var img = A.img["layer_" + key];
    if (!img) return;

    if (key === "mist") {
      // vollflaechig, deckt Viewport exakt ab (cover), Rand liegt ausserhalb
      // des Viewports -- keine Kante sichtbar, daher kein Fade noetig.
      drawCover(ctx, img, 0, 0, viewport.w, viewport.h);
    } else if (key === "foliage_left") {
      // Bildinhalt ist links dicht bewachsen, rechts (Bildmitte) hell/licht.
      // Das Bild wird links im Viewport verankert (Bild-Ursprung nahe x=0),
      // so dass der dichte linke Bildteil sichtbar bleibt und die helle
      // Bildmitte weit rechts ausserhalb des Viewports landet. Ober- und
      // Unterkante liegen dank Ueberdimensionierung ausserhalb, die rechte
      // (innere) Kante wird stark gefadet.
      var h = viewport.h * 1.6;
      var w = h * (img.width / img.height);
      var x = -(w * 0.06);
      var y = viewport.h - h * 0.75;
      ctx.drawImage(img, x, y, w, h);
      fadeAllEdges(ctx, x, y, w, h, 0.22);
      maskToViewportSliver(ctx, "left");
    } else if (key === "foliage_right") {
      // Horizontal gespiegelt, damit auch hier der dicht bewachsene
      // Bildrand zur sichtbaren (rechten) Viewport-Kante zeigt statt der
      // hellen Bildmitte.
      var h2 = viewport.h * 1.7;
      var w2 = h2 * (img.width / img.height);
      var x2 = viewport.w - w2 * 0.94;
      var y2 = -(h2 * 0.55);
      ctx.save();
      ctx.translate(x2 + w2, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, y2, w2, h2);
      ctx.restore();
      fadeAllEdges(ctx, x2, y2, w2, h2, 0.22);
      maskToViewportSliver(ctx, "right");
    }
  }

  // Begrenzt eine Foliage-Ebene auf einen Randstreifen des Viewports:
  // die Bilder sind nach dem Hoehen-Fit fast dreimal so breit wie der
  // Viewport und wuerden sonst die Bildmitte zuwachsen. Das Papier (Ma)
  // in der Mitte ist Konzept-Regel, kein Geschmack.
  function maskToViewportSliver(ctx, side) {
    var solid = viewport.w * 0.16;
    var fadeEnd = viewport.w * 0.38;
    var grad;
    if (side === "left") {
      grad = ctx.createLinearGradient(solid, 0, fadeEnd, 0);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      grad = ctx.createLinearGradient(viewport.w - fadeEnd, 0, viewport.w - solid, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, "rgba(255,255,255,1)");
    }
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewport.w, viewport.h);
    ctx.restore();
  }

  // Legt eine destination-in Gradient-Maske ueber alle vier Kanten eines
  // Bildausschnitts, damit keine harte Rechteckkante im Bild steht --
  // unabhaengig davon ob die Kante im Viewport liegt oder nicht.
  function fadeAllEdges(ctx, x, y, w, h, fadeFrac) {
    var fadeW = w * fadeFrac;
    var fadeH = h * fadeFrac;
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    // Wichtig: jeder fillRect deckt das GESAMTE (x,y,w,h)-Rechteck ab, nicht
    // nur den jeweiligen Randstreifen -- destination-in setzt ausserhalb der
    // gezeichneten Flaeche Alpha auf 0. Ausserhalb des Gradient-Bereichs haelt
    // der Gradient automatisch den letzten Farbstop (voll deckend).

    var gradL = ctx.createLinearGradient(x, 0, x + fadeW, 0);
    gradL.addColorStop(0, "rgba(255,255,255,0)");
    gradL.addColorStop(1, "rgba(255,255,255,1)");
    ctx.fillStyle = gradL;
    ctx.fillRect(x, y, w, h);

    var gradR = ctx.createLinearGradient(x + w - fadeW, 0, x + w, 0);
    gradR.addColorStop(0, "rgba(255,255,255,1)");
    gradR.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradR;
    ctx.fillRect(x, y, w, h);

    var gradT = ctx.createLinearGradient(0, y, 0, y + fadeH);
    gradT.addColorStop(0, "rgba(255,255,255,0)");
    gradT.addColorStop(1, "rgba(255,255,255,1)");
    ctx.fillStyle = gradT;
    ctx.fillRect(x, y, w, h);

    var gradB = ctx.createLinearGradient(0, y + h - fadeH, 0, y + h);
    gradB.addColorStop(0, "rgba(255,255,255,1)");
    gradB.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradB;
    ctx.fillRect(x, y, w, h);

    ctx.restore();
  }

  function drawCover(ctx, img, x, y, w, h) {
    // img.width/height sind bei HTMLVideoElement immer 0/undefined -- die
    // tatsaechliche Quellgroesse eines Videos steht in videoWidth/videoHeight.
    var srcW = img.videoWidth || img.width;
    var srcH = img.videoHeight || img.height;
    var imgRatio = srcW / srcH;
    var boxRatio = w / h;
    var sx, sy, sw, sh;
    if (imgRatio > boxRatio) {
      sh = srcH;
      sw = sh * boxRatio;
      sx = (srcW - sw) / 2;
      sy = 0;
    } else {
      sw = srcW;
      sh = sw / boxRatio;
      sx = 0;
      sy = (srcH - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  // Kollage-Placement: die Szenen sind Alpha-PNGs/Alpha-WebMs -- cremefarbener
  // Bereich transparent, Motiv opak, laeuft an eigenen Aquarell-Raendern aus.
  // Das Bild wird deshalb als GANZES gezeichnet (CONTAIN: Seitenverhaeltnis
  // erhalten, kein Crop durchs Motiv), auf widthVw*viewport.w Breite skaliert,
  // dann per side (horizontal) und vAlign (vertikal) im Viewport verankert.
  // source-over: das PNG/WebM-Alpha erledigt die Verschmelzung mit dem Papier
  // -- kein harter Kanten-Fade mehr noetig. Weil die Motive dank Prompt meist
  // auf einer Bildseite sitzen (Rest transparent), ergaenzen sich zwei
  // gegenueberliegende Kollage-Elemente (aktive + Vorstation) nahtlos ohne
  // Motiv-Kollision.
  //
  // Ein sehr sanfter Sicherheits-Vignette-Fade an den Bildkanten selbst
  // (>15% Zone, siehe COLLAGE_EDGE_VIGNETTE_FRAC) faengt eventuelle
  // Kompressions-/Anti-Aliasing-Reste am PNG-Rand ab -- die Hauptarbeit
  // macht das Alpha des Bildes.
  var COLLAGE_EDGE_VIGNETTE_FRAC = 0.15;

  // Referenz-Seitenverhaeltnis, an dem die ganze Choreografie visuell
  // abgenommen wurde (~1000x700 etc.). widthVw*viewport.w skaliert die
  // Bildhoehe proportional zum SEITENVERHAELTNIS des Viewports, nicht zu
  // seiner absoluten Groesse: auf einem breiteren Bildschirm (16:9 = 1.78,
  // WQHD, Ultrawide) wird dieselbe widthVw-Zahl viel HOEHER relativ zur
  // Fensterhoehe, dadurch ueberlappen sich Elemente ("alle Tiere
  // uebereinander und riesig", Pascal 04.07. auf WQHD). Deshalb: effektive
  // Breite ist die widthVw-Fraktion von min(echte Breite, Breite die dem
  // Referenz-Seitenverhaeltnis bei aktueller Hoehe entspraeche) -- greift
  // NUR auf breiteren Screens als die Referenz, aendert auf den getesteten
  // (schmaleren) Seitenverhaeltnissen nichts.
  var COLLAGE_REFERENCE_ASPECT = 1.45;

  // Gemeinsame Platzierungs-Geometrie fuer Kollage-Szenen: Pixel-Rect
  // (x/y/w/h in CSS-Pixeln) aus placement + Quell-Seitenverhaeltnis.
  // Wird von drawSceneCollage UND triggerSplash benutzt -- die Splashes
  // ankern relativ zu diesem Rect (nicht am rohen Viewport), damit sie
  // auf breiten Screens (WQHD-Bremse, s.o.) mit der Szene mitwandern.
  function sceneCollageRect(el, placement) {
    var srcW = el.videoWidth || el.width;
    var srcH = el.videoHeight || el.height;
    if (!srcW || !srcH) return null;
    var side = placement.side || "left";
    var vAlign = placement.vAlign || "center";
    var effectiveViewportW = Math.min(viewport.w, viewport.h * COLLAGE_REFERENCE_ASPECT);
    var w = placement.widthVw * effectiveViewportW;
    var h = w * (srcH / srcW);
    var x = side === "left" ? 0 : side === "right" ? viewport.w - w : (viewport.w - w) / 2;
    var y;
    if (vAlign === "top") y = 0;
    else if (vAlign === "bottom") y = viewport.h - h;
    else y = (viewport.h - h) / 2;
    return { x: x, y: y, w: w, h: h };
  }

  function drawSceneCollage(ctx, img, placement) {
    var rect = sceneCollageRect(img, placement);
    if (!rect) return;
    var srcW = img.videoWidth || img.width;
    var srcH = img.videoHeight || img.height;
    var x = rect.x, y = rect.y, w = rect.w, h = rect.h;

    // flipX: horizontal gespiegelt zeichnen (Blick-/Laufrichtung drehen),
    // ohne die Asset-Datei zu duplizieren.
    if (placement.flipX) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, srcW, srcH, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, 0, 0, srcW, srcH, x, y, w, h);
    }

    // Sicherheits-Vignette: destination-in Gradient nur in der aeusseren
    // Randzone jeder der vier Bildkanten, Innenbereich bleibt voll deckend
    // (Farbstop haelt danach automatisch 1 = keine Wirkung dort).
    var fadeW = w * COLLAGE_EDGE_VIGNETTE_FRAC;
    var fadeH = h * COLLAGE_EDGE_VIGNETTE_FRAC;
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";

    var gradL = ctx.createLinearGradient(x, 0, x + fadeW, 0);
    gradL.addColorStop(0, "rgba(255,255,255,0)");
    gradL.addColorStop(1, "rgba(255,255,255,1)");
    ctx.fillStyle = gradL;
    ctx.fillRect(x, y, w, h);

    var gradR = ctx.createLinearGradient(x + w - fadeW, 0, x + w, 0);
    gradR.addColorStop(0, "rgba(255,255,255,1)");
    gradR.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradR;
    ctx.fillRect(x, y, w, h);

    var gradT = ctx.createLinearGradient(0, y, 0, y + fadeH);
    gradT.addColorStop(0, "rgba(255,255,255,0)");
    gradT.addColorStop(1, "rgba(255,255,255,1)");
    ctx.fillStyle = gradT;
    ctx.fillRect(x, y, w, h);

    var gradB = ctx.createLinearGradient(0, y + h - fadeH, 0, y + h);
    gradB.addColorStop(0, "rgba(255,255,255,1)");
    gradB.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradB;
    ctx.fillRect(x, y, w, h);

    ctx.restore();
  }

  // foliage_left/right werden nicht mehr gezeichnet (Ganzbild-Szenen ersetzen
  // die komponierten Einzel-Ebenen); die statische mist-Ebene (manifest.layers.mist)
  // ist durch die animierte Video-Szene "mist_live" ersetzt (siehe drawMistLayer
  // weiter unten) -- drawParallaxLayerContent/fadeAllEdges/maskToViewportSliver
  // bleiben unangetastet im Code (fuer foliage), werden aber nicht mehr aufgerufen.
  function rebuildParallaxContent() {}

  function fullRevealMask(layerKey) {
    // Intro-Ende: Maske komplett deckend setzen (kein Stempel-Rand mehr sichtbar)
    // und fixieren -- danach ueberschreiben keine Stamp-Updates die Maske mehr.
    var layer = ensureRevealLayer(layerKey);
    sizeCanvasToViewport(layer.mask);
    var ctx = layer.maskCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, layer.mask.width, layer.mask.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, layer.mask.width, layer.mask.height);
    layer.mode = "reveal";
    layer.dirty = false;
    layer.fullyRevealed = true;
  }

  // Gegenstueck zu fullRevealMask fuer den Erosion-Abschluss: Maske komplett
  // leeren (Layer unsichtbar) UND den Layer fuer einen kuenftigen Reveal
  // zuruecksetzen (Stamps weg, Modus zurueck auf "reveal", nicht als
  // "fullyRevealed" markiert -- ein spaeterer bloomScene-Aufruf baut
  // ganz normal von leer auf).
  function emptyMaskAndReset(layerKey) {
    var layer = ensureRevealLayer(layerKey);
    sizeCanvasToViewport(layer.mask);
    var ctx = layer.maskCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, layer.mask.width, layer.mask.height);
    layer.stamps = [];
    layer.mode = "reveal";
    layer.dirty = false;
    layer.fullyRevealed = false;
  }

  // Lebende Nebel-Grundschicht: die Video-Szene "mist_live" (transparentes
  // Alpha-WebM) laeuft DURCHGEHEND unter allen Stationen -- immer sichtbar,
  // kein Reveal/keine Erosion, vollflaechig cover, sehr subtile Opacity.
  // Jeden Frame direkt aus dem <video> gezeichnet (live, kein Caching),
  // multiply mit dem Papier, leichter Mausparallax wie zuvor.
  var MIST_LIVE_OPACITY = 0.16;

  function drawMistLayer() {
    var video = A.videos && A.videos.mist_live;
    if (!video || !video.videoWidth) return;

    var mouseDx = (mouse.nx - 0.5) * viewport.w * 0.01;
    var mouseDy = (mouse.ny - 0.5) * viewport.h * 0.01;

    scene2d.save();
    scene2d.globalAlpha = MIST_LIVE_OPACITY;
    scene2d.globalCompositeOperation = "multiply";
    drawCover(scene2d, video, mouseDx, mouseDy, viewport.w, viewport.h);
    scene2d.globalAlpha = 1;
    scene2d.globalCompositeOperation = "source-over";
    scene2d.restore();
  }

  /* ============================================================
     LANDUNGS-SPLASH: transparenter Tinten-Klecks (Alpha-WebM), der bei
     jedem VORWAERTS-Stationswechsel an einer konfigurierten Stelle aufs
     Papier klatscht, radial waechst, kurz haelt und wieder verschmilzt.
     Der Klecks IST der Wurf, der die neue Szene bringt -- subtil, ein
     fluechtiges Ereignis, darf die Bild-Harmonie nicht stoeren. Mehrere
     Splashes koennen gleichzeitig aktiv sein (schnelles Scrollen durch
     mehrere Stationen).
  ============================================================ */

  var SPLASH_GROW_DURATION = 1.1;     // 0.12 -> 1.0 Scale, power3.out
  var SPLASH_FADE_IN = 0.15;          // 0 -> 0.65 Alpha
  var SPLASH_HOLD_UNTIL = 1.6;        // Alpha haelt bis hier (elapsed-Zeitpunkt)
  var SPLASH_FADE_OUT_DURATION = 1.2; // 1.6 -> 2.8 Alpha -> 0
  var SPLASH_ALPHA_PEAK = 0.65;
  var SPLASH_LIFETIME = 2.8;          // danach entfernen

  var activeSplashes = []; // { video, px, py, sizeBase, rot, elapsed }

  // splashCfg.u/v: Position relativ zum Szenen-Rect der Station (0..1 =
  // innerhalb, >1 = unterhalb/rechts davon) -- ankert den Klecks an der
  // aufbluehenden Flaeche, damit er auf breiten Screens (WQHD-Bremse in
  // sceneCollageRect) mit der Szene mitwandert statt am Viewport zu kleben.
  // Fallback splashCfg.nx/ny: roh viewport-relativ (Debug/manuelle Tests).
  // Groesse skaliert in beiden Faellen mit der effektiven Viewport-Breite
  // (wie die Szenen selbst), nicht mit der rohen.
  function triggerSplash(splashCfg, sceneKey, placement) {
    if (!splashCfg) return;
    var video = A.splashVideos && A.splashVideos[splashCfg.key];
    if (!video) return;
    var px, py;
    if (splashCfg.u !== undefined && sceneKey && placement) {
      var el = sceneSourceEl(sceneKey);
      var rect = el && sceneCollageRect(el, placement);
      if (!rect) return;
      px = rect.x + splashCfg.u * rect.w;
      py = rect.y + splashCfg.v * rect.h;
    } else {
      px = splashCfg.nx * viewport.w;
      py = splashCfg.ny * viewport.h;
    }
    var effW = Math.min(viewport.w, viewport.h * COLLAGE_REFERENCE_ASPECT);
    var rng = seededRandom(Math.floor(px * 31 + py * 17 + activeSplashes.length * 271));
    try { video.currentTime = 0; } catch (e) {}
    var vp = video.play();
    if (vp && vp.catch) vp.catch(function () {});
    activeSplashes.push({
      video: video,
      px: px,
      py: py,
      sizeBase: splashCfg.sizeVw * effW,
      rot: (rng() - 0.5) * 0.5,
      elapsed: 0,
      // freeze (Pascal 05.07., Finale-Splash): haelt Alpha dauerhaft auf
      // SPLASH_ALPHA_PEAK statt auszufaden, wird nie aus activeSplashes
      // entfernt -- der Klecks soll stehenbleiben, wenn die Szene fertig
      // gespielt hat, nicht nach SPLASH_LIFETIME verschwinden (siehe
      // splashAlphaAt/updateSplashes).
      freeze: !!splashCfg.freeze
    });
  }

  // Debug-Zugriff (window.JUNGL.debug): Splash manuell ausloesen ohne
  // Scroll-Tanz, z.B. JUNGL.debug.triggerSplash({key:'terra',nx:.5,ny:.5,sizeVw:.3})
  // -- fuer Sichtpruefungen im Browser; fliegt mit dem HUD in Phase 6 raus.
  choreo.triggerSplash = triggerSplash;
  choreo.activeSplashes = activeSplashes;

  function splashScaleAt(elapsed) {
    var t = clamp01(elapsed / SPLASH_GROW_DURATION);
    var eased = EASE_FNS["power3.out"](t);
    return lerp(0.12, 1.0, eased);
  }

  function splashAlphaAt(s) {
    var elapsed = s.elapsed;
    if (elapsed < SPLASH_FADE_IN) {
      return lerp(0, SPLASH_ALPHA_PEAK, clamp01(elapsed / SPLASH_FADE_IN));
    }
    if (s.freeze) return SPLASH_ALPHA_PEAK;
    if (elapsed < SPLASH_HOLD_UNTIL) {
      return SPLASH_ALPHA_PEAK;
    }
    var t = clamp01((elapsed - SPLASH_HOLD_UNTIL) / SPLASH_FADE_OUT_DURATION);
    return lerp(SPLASH_ALPHA_PEAK, 0, t);
  }

  function updateSplashes(dt) {
    for (var i = activeSplashes.length - 1; i >= 0; i--) {
      var s = activeSplashes[i];
      s.elapsed += dt;
      if (!s.freeze && s.elapsed > SPLASH_LIFETIME) {
        s.video.pause();
        activeSplashes.splice(i, 1);
      }
    }
  }

  // Papier-Maske (Pascal 04.07.): die Tier-Silhouette liegt zwischen Klecks
  // und Betrachter -- das Alpha jeder in diesem Frame gezeichneten Szene
  // (scratch-Canvas aus drawMaskedLayer: content x reveal-Maske, laeuft im
  // Frame-Loop VOR drawSplashes) wird per destination-out aus dem Klecks
  // gestanzt. Tinte trifft nur UM das Tier herum aufs Papier, nie durchs
  // Tier durch. Waehrend die Szene noch aufblueht waechst die Stanzung mit:
  // der Klecks landet, das Tier "verdraengt" ihn Stueck fuer Stueck.
  var splashScratch = null;

  function ensureSplashScratch() {
    if (!splashScratch) {
      var c = makeCanvas();
      splashScratch = { canvas: c, ctx: c.getContext("2d") };
    }
    sizeCanvasToViewport(splashScratch.canvas);
    return splashScratch;
  }

  function drawSplashes() {
    if (!activeSplashes.length) return;
    var dpr = J.state.dpr || 1;
    var scratch = ensureSplashScratch();
    var sctx = scratch.ctx;
    for (var i = 0; i < activeSplashes.length; i++) {
      var s = activeSplashes[i];
      var video = s.video;
      if (!video || !video.videoWidth) continue;
      var scale = splashScaleAt(s.elapsed);
      var alpha = splashAlphaAt(s);
      if (alpha <= 0) continue;
      var w = s.sizeBase * scale;
      var h = w * (video.videoHeight / video.videoWidth);

      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalCompositeOperation = "source-over";
      sctx.clearRect(0, 0, scratch.canvas.width, scratch.canvas.height);
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.translate(s.px, s.py);
      sctx.rotate(s.rot);
      sctx.drawImage(video, -w / 2, -h / 2, w, h);

      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalCompositeOperation = "destination-out";
      for (var k = 0; k < drawnSceneLayerKeys.length; k++) {
        var sceneScratch = scratchCanvases[drawnSceneLayerKeys[k]];
        if (sceneScratch) sctx.drawImage(sceneScratch.canvas, 0, 0);
      }
      sctx.globalCompositeOperation = "source-over";

      scene2d.save();
      scene2d.globalAlpha = alpha;
      scene2d.globalCompositeOperation = "multiply";
      scene2d.setTransform(1, 0, 0, 1, 0, 0);
      scene2d.drawImage(scratch.canvas, 0, 0);
      scene2d.restore();
    }
  }

  /* ============================================================
     SCHLUSS-BORDUERE: fertiges Inca-Rahmenstueck (echtes Alpha-PNG,
     eigenes Zentrum mit Masken-Ornament, kein Kacheln noetig) erscheint
     EINMAL wenn das Finale-Video (jag_family) zu Ende gespielt hat.
     Platzierung wiederverwendet drawSceneCollage (dieselbe Contain-Logik
     + weicher Kanten-Vignette wie jede andere Szene), Reveal von BEIDEN
     Raendern DES BILDES (nicht des Viewports) gleichzeitig Richtung
     Mitte -- die Masken-Ornament-Mitte blueht als letztes auf, wie eine
     Signatur, die zuletzt gesetzt wird.
  ============================================================ */

  // Pascal 04.07.: sah "doof" aus (verschwommene Ueberlagerung mit der Szene
  // dahinter), Aufloesung "muss klar abtrennen", Alpha wenn ueberhaupt max 5%,
  // deutlich kleiner (nicht ueber Jaguar+Jungtier). Deshalb: kleiner, fast
  // deckend, ohne den Kanten-Vignette-Fade von drawSceneCollage (das Bild hat
  // schon sauberes Alpha, ein zweiter Fade macht es nur unscharf), wieder VOR
  // der Szene gezeichnet.
  var BORDER_PLACEMENT = { side: "center", vAlign: "bottom", widthVw: 0.75 };
  // Zusaetzlicher, NUR horizontaler Streckfaktor obendrauf (Pascal 04.07.:
  // "um 50% vergroessern und weitere 25% stretchen zur Seite" -- die 50%
  // stecken schon in widthVw 0.5->0.75, die 25% sind reine Breitendehnung,
  // die Hoehe bleibt unangetastet).
  var BORDER_HORIZONTAL_STRETCH = 1.25;
  // Ein positiver Offset hier schiebt die Bordüre ueber die Canvas-Unterkante
  // hinaus -- das Canvas selbst (nicht CSS) schneidet das dann ab (siehe
  // Pascal 04.07. Screenshot). Deshalb 0: die Bordüre bleibt IMMER buendig
  // und vollstaendig sichtbar. Die gewuenschte Trennung von der Nebel-Ebene
  // kommt stattdessen ueber shiftStageForBorder() (Szene wandert nach oben,
  // Bordüre bleibt stehen) -- siehe dort.
  var BORDER_Y_OFFSET_PX = 0;
  var BORDER_OPACITY = 0.97;
  var BORDER_REVEAL_DURATION = 3.2;
  var BORDER_STAMP_COUNT_PER_SIDE = 6;
  // Siehe Postmortem vom ersten Versuch: addMaskStamp startet Stempel fix
  // bei scale=0.2, das Ziel muss deutlich darueber liegen (sonst kein
  // sichtbares Wachstum), aber auch nicht so riesig wie bei Szenen-Reveals
  // (5-6.5), sonst ist die schmale Bordüre sofort "durch".
  var BORDER_STAMP_SCALE_MIN = 1.5;
  var BORDER_STAMP_SCALE_MAX = 2.1;

  var borderContentBuilt = false;
  var borderTriggered = false;

  // Tatsaechliche Bildposition/-groesse im Viewport (dieselbe Contain-Mathe
  // wie drawSceneCollage) -- damit die Reveal-Ursprünge an den ECHTEN
  // Bildkanten sitzen, nicht an den Viewport-Kanten (das Bild ist nur
  // widthVw breit, nicht vollflaechig).
  function borderRect() {
    var img = A.img.borderTile;
    if (!img || !img.width) return null;
    // Gleiche Seitenverhaeltnis-Bremse wie drawSceneCollage (siehe
    // COLLAGE_REFERENCE_ASPECT) -- sonst wird die Bordüre auf breiten
    // Screens ueberproportional hoch.
    var effectiveViewportW = Math.min(viewport.w, viewport.h * COLLAGE_REFERENCE_ASPECT);
    // Hoehe aus der UNGESTRECKTEN Breite ableiten (Seitenverhaeltnis bleibt
    // fuer die Hoehe massgeblich), dann erst die Breite horizontal dehnen --
    // nur die Breite wird groesser, die Hoehe bleibt unangetastet.
    var wBase = BORDER_PLACEMENT.widthVw * effectiveViewportW;
    var h = wBase * (img.height / img.width);
    var w = wBase * BORDER_HORIZONTAL_STRETCH;
    var x = (viewport.w - w) / 2;
    var y = viewport.h - h + BORDER_Y_OFFSET_PX;
    return { x: x, y: y, w: w, h: h };
  }

  function rebuildBorderContent() {
    var img = A.img.borderTile;
    if (!img || !img.width) return;
    var rect = borderRect();
    if (!rect) return;
    buildLayerContent("border", function (ctx) {
      // Bewusst OHNE drawSceneCollage: das Bild hat schon sauberes,
      // scharfes Alpha um die Motive -- ein zusaetzlicher synthetischer
      // Kanten-Fade macht es nur unscharf/"doof" (Pascal). Reines Contain,
      // kein Fade, klare Kante.
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    });
    borderContentBuilt = true;
  }

  // Reveal von zwei Ursprüngen (linke/rechte Bildkante) gleichzeitig Richtung
  // Bildmitte -- Pascal: "von aussen nach innen von beiden Seiten".
  function paintBorderReveal(duration) {
    var layerKey = "border";
    var layer = ensureRevealLayer(layerKey);
    layer.stamps = [];
    layer.mode = "reveal";
    layer.fullyRevealed = false;
    layer.dirty = true;

    var rect = borderRect();
    if (!rect) return;
    var ny = clamp01((rect.y + rect.h / 2) / viewport.h);
    var nxL0 = clamp01(rect.x / viewport.w);
    var nxR0 = clamp01((rect.x + rect.w) / viewport.w);
    var nxMid = (nxL0 + nxR0) / 2;
    var count = BORDER_STAMP_COUNT_PER_SIDE;

    for (var i = 0; i < count; i++) {
      var t = i / (count - 1);
      var delay = t * duration * 0.5;

      var nxLeft = lerp(nxL0 + 0.01, nxMid, t);
      addMaskStamp(layerKey, nxLeft, ny, SPLAT_FAMILY_ORDER[i % SPLAT_FAMILY_ORDER.length],
        duration * 0.55, delay, rand(BORDER_STAMP_SCALE_MIN, BORDER_STAMP_SCALE_MAX), "reveal", "power3.out");

      var nxRight = lerp(nxR0 - 0.01, nxMid, t);
      addMaskStamp(layerKey, nxRight, ny, SPLAT_FAMILY_ORDER[(i + 2) % SPLAT_FAMILY_ORDER.length],
        duration * 0.55, delay, rand(BORDER_STAMP_SCALE_MIN, BORDER_STAMP_SCALE_MAX), "reveal", "power3.out");

      // Finger-Stempel: kleiner, leicht versetzt, ausgefranste Kapillarfront.
      var frngL = seededRandom(i * 331 + 11);
      addMaskStamp(layerKey, clamp01(nxLeft + (frngL() - 0.5) * 0.05), ny,
        SPLAT_FAMILY_ORDER[(i + 1) % SPLAT_FAMILY_ORDER.length],
        duration * 0.35, delay + rand(0.05, 0.3), rand(BORDER_STAMP_SCALE_MIN, BORDER_STAMP_SCALE_MAX) * rand(0.35, 0.5), "reveal", "power3.out");
      var frngR = seededRandom(i * 587 + 23);
      addMaskStamp(layerKey, clamp01(nxRight + (frngR() - 0.5) * 0.05), ny,
        SPLAT_FAMILY_ORDER[(i + 3) % SPLAT_FAMILY_ORDER.length],
        duration * 0.35, delay + rand(0.05, 0.3), rand(BORDER_STAMP_SCALE_MIN, BORDER_STAMP_SCALE_MAX) * rand(0.35, 0.5), "reveal", "power3.out");
    }
    startLayerReveal(layerKey, duration + 0.4);
  }

  function drawBorder() {
    if (!borderContentBuilt) return;
    // source-over statt multiply: soll sich klar von der Szene abheben
    // (Signatur-Charakter), nicht mit dem Papier verschmelzen wie der Rest.
    drawMaskedLayer("border", BORDER_OPACITY, null, "source-over");
  }

  /* ============================================================
     BORDÜRE-ADLERAUGEN-HOVER: die Augen des Adlerkopfs in der Mitte der
     Schluss-Bordüre leuchten sanft auf, wenn die Maus darueber schwebt
     (Pascal 05.07., "fuer einen Freund" -- ein kleines Geheimnis wie das
     Tocapu-Siegel, aber per Hover statt Klick).
     Augen-Positionen als Bildanteile (nx/ny relativ zur GESAMTEN
     border_tile.png, 1800x295px) per Pixel-Sampling im Canvas ermittelt
     (Pupillen-Zentren) -- nicht viewport-relativ, folgen dem Bild bei
     jeder Groesse/Seitenverhaeltnis wie die Splash-u/v-Koordinaten.
  ============================================================ */
  var BORDER_EYE_L = { nx: 822 / 1800, ny: 98 / 295 };
  var BORDER_EYE_R = { nx: 912 / 1800, ny: 97 / 295 };
  var BORDER_EYE_HOVER_RADIUS_FRAC = 0.09; // Hover-Trefferzone um die Kopfmitte, Anteil der Bordüre-Breite
  var BORDER_EYE_GLOW_RADIUS_FRAC = 0.020; // Glow-Radius je Auge, Anteil der Bordüre-Breite
  var borderEyeGlow = 0; // geglaettet 0..1, schneller an- als ausleuchtend

  function updateBorderEyeGlow(dt) {
    // Erst hoverbar, wenn die Bordüre fertig eingebluteht ist (nicht schon
    // waehrend ihres eigenen ~3.2s-Reveals) -- sonst koennten die Augen
    // aufleuchten, bevor das Bild selbst sichtbar ist.
    var borderLayer = revealLayers.border;
    var rect = borderContentBuilt && borderLayer && borderLayer.fullyRevealed && borderRect();
    var target = 0;
    if (rect) {
      var midX = rect.x + (BORDER_EYE_L.nx + BORDER_EYE_R.nx) / 2 * rect.w;
      var midY = rect.y + (BORDER_EYE_L.ny + BORDER_EYE_R.ny) / 2 * rect.h;
      var mx = mouse.nx * viewport.w, my = mouse.ny * viewport.h;
      var dist = Math.sqrt((mx - midX) * (mx - midX) + (my - midY) * (my - midY));
      if (dist < rect.w * BORDER_EYE_HOVER_RADIUS_FRAC) target = 1;
    }
    var rate = target > borderEyeGlow ? 7 : 3.5;
    borderEyeGlow = lerp(borderEyeGlow, target, clamp01(dt * rate));
    if (borderEyeGlow < 0.002) borderEyeGlow = 0;
  }

  // Debug-Zugriff (window.JUNGL.debug), analog zu triggerSplash/activeSplashes.
  choreo.borderRect = borderRect;
  choreo.getBorderEyeGlow = function () { return borderEyeGlow; };
  choreo.mouse = mouse;

  function drawBorderEyeGlow() {
    if (borderEyeGlow <= 0) return;
    var rect = borderRect();
    if (!rect) return;
    var r = rect.w * BORDER_EYE_GLOW_RADIUS_FRAC;
    scene2d.save();
    scene2d.globalCompositeOperation = "lighter";
    [BORDER_EYE_L, BORDER_EYE_R].forEach(function (eye) {
      var cx = rect.x + eye.nx * rect.w;
      var cy = rect.y + eye.ny * rect.h;
      var grad = scene2d.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, "rgba(255,190,90," + (0.9 * borderEyeGlow) + ")");
      grad.addColorStop(0.5, "rgba(255,130,40," + (0.5 * borderEyeGlow) + ")");
      grad.addColorStop(1, "rgba(255,80,20,0)");
      scene2d.fillStyle = grad;
      scene2d.beginPath();
      scene2d.arc(cx, cy, r, 0, Math.PI * 2);
      scene2d.fill();
    });
    scene2d.restore();
  }

  // Pascal 04.07. (2. Anlauf): CSS-Verschieben des Canvas-ELEMENTS bringt
  // nichts -- die Bordüre wurde schon beim ZEICHNEN von der Canvas-eigenen
  // Kante abgeschnitten (Backing-Store-Groesse = viewport.h), nicht vom
  // Browser-Viewport. Ein CSS-Transform kann nie Pixel zurueckholen, die nie
  // gezeichnet wurden. Deshalb umgekehrter Ansatz: die Bordüre bleibt IMMER
  // buendig am Canvas-Boden (nie ausserhalb, siehe BORDER_Y_OFFSET_PX=0),
  // stattdessen wandert die SZENE (Nebel, Baeume, Jaguar+Jungtier, Splats,
  // Blaetter) per Canvas-Translation nach oben -- dieselbe Trennwirkung von
  // der Nebel-Kante, aber ohne dass irgendwas den Canvas-Rand verlaesst.
  // Titel-DOM wandert per CSS im Gleichschritt mit.
  var stageShift = { y: 0 };
  var STAGE_SHIFT_PX = 64;

  function shiftStageForBorder() {
    gsap.to(stageShift, { y: STAGE_SHIFT_PX, duration: 1.8, ease: "power2.inOut" });
    gsap.to("#title-wrap", { y: -STAGE_SHIFT_PX, duration: 1.8, ease: "power2.inOut" });
  }

  function initBorderTrigger() {
    var video = A.videos && A.videos.jag_family;
    if (!video) return;
    video.addEventListener("ended", function () {
      if (borderTriggered) return;
      borderTriggered = true;
      rebuildBorderContent();
      paintBorderReveal(BORDER_REVEAL_DURATION);
      shiftStageForBorder();
    }, { once: true });
  }

  /* ============================================================
     SZENEN: Ganzbild-Gemaelde statt komponierter Einzel-Assets.
     Jede Szene wird per drawCover vollflaechig in einen eigenen
     Content-Offscreen gelegt und mit MULTIPLY ueber das Papier
     komposit (Opacity SCENE_OPACITY, Papierkorn scheint durch).
     Reveal per Ink-Flut: Stempel-Welle die als Ganzes ueber die
     Szene laeuft (Richtung abwechselnd, siehe transitionToStation).
  ============================================================ */

  var sceneContentBuilt = {}; // sceneKey -> placement, mit dem der Content zuletzt gebaut wurde
  var sceneRevealDir = 1;     // 1 = links->rechts, -1 = rechts->links, wechselt pro Szenenwechsel

  // Kollage-Kette: die aktuell sichtbaren (aufgebluehten oder erodierenden)
  // Szenen-Elemente, AELTESTE ZUERST. Normalerweise 1-2 Eintraege lang
  // (aktuelle Station + Vorstation, siehe desiredSceneSet/syncSceneChain);
  // waehrend eine Erosion laeuft kann kurzzeitig ein drittes (erodierendes)
  // Element existieren, bis dessen emptyMaskAndReset feuert.
  var sceneChain = []; // { key, placement }

  function sceneLayerKey(key) {
    return "scene_" + key;
  }

  // Eine Szene ist entweder ein Alpha-PNG (manifest.scenes[key].file) oder
  // ein animiertes Alpha-WebM (manifest.scenes[key].video). isVideoScene
  // steuert die Content-Cache-Strategie: Bild-Content wird einmalig gebaut
  // und gecacht (wie bisher), Video-Content ist LIVE und muss JEDEN Frame
  // neu aus dem <video> gezeichnet werden (siehe refreshVideoSceneContent),
  // sonst friert das Video ein, sobald die Szene voll aufgeblueht ist und
  // rebuildSceneContent nicht mehr erneut aufgerufen wird.
  function isVideoScene(sceneKey) {
    var entry = manifest.scenes[sceneKey];
    return !!(entry && entry.video);
  }

  function sceneSourceEl(sceneKey) {
    if (isVideoScene(sceneKey)) return A.videos && A.videos[sceneKey];
    return A.img["scene_" + sceneKey];
  }

  function rebuildSceneContent(sceneKey, placement) {
    var el = sceneSourceEl(sceneKey);
    if (!el) return;
    buildLayerContent(sceneLayerKey(sceneKey), function (ctx) {
      drawSceneCollage(ctx, el, placement);
    });
    sceneContentBuilt[sceneKey] = placement;
  }

  // Fuer Video-Szenen: Content-Offscreen jeden Frame neu aus dem <video>
  // zeichnen (drawImage(video) holt den aktuellen Decode-Frame), bevor die
  // (unabhaengige) Reveal-/Erosions-Maske darueber angewendet wird -- die
  // Maske selbst bleibt unangetastet, nur der Bildinhalt aktualisiert sich.
  function refreshVideoSceneContent(sceneKey) {
    if (!isVideoScene(sceneKey)) return;
    var placement = sceneContentBuilt[sceneKey];
    if (!placement) return;
    var video = A.videos && A.videos[sceneKey];
    if (!video || video.readyState < 2) return;
    buildLayerContent(sceneLayerKey(sceneKey), function (ctx) {
      drawSceneCollage(ctx, video, placement);
    });
  }

  // Bei Resize muss jede aktuell in der Kette (oder gerade erodierende)
  // Szene mit IHREM eigenen placement neu gebaut werden, nicht mit einem
  // Vollbild-Default -- deshalb hier ueber sceneContentBuilt (haelt das
  // zuletzt verwendete placement je Szene) statt ueber manifest.scenes.
  function rebuildAllSceneContent() {
    Object.keys(sceneContentBuilt).forEach(function (key) {
      rebuildSceneContent(key, sceneContentBuilt[key]);
    });
  }

  // Ink-Flut-Reveal: stampCount Stempel als Welle ueber den Kollage-Streifen
  // der Szene, Richtung per `dir` (1 = links->rechts, -1 = rechts->links).
  // Streuung in y ueber die ganze Bildhoehe. Zusaetzlich zur Hauptwelle ein
  // paar kleine "Finger"-Stempel an der Ausbreitungsfront (boundary
  // roughening, siehe FINGER_STAMP_COUNT), damit der Rand nicht als glatte
  // Welle sondern unregelmaessig verzweigt auslaeuft (Kapillarfluss-Optik).
  var FINGER_STAMP_COUNT = 6;

  function paintSceneReveal(sceneKey, dir, duration, placement) {
    var layerKey = sceneLayerKey(sceneKey);
    var side = placement.side || "left";
    var w = placement.widthVw * viewport.w;
    var x0 = side === "left" ? 0 : side === "right" ? viewport.w - w : (viewport.w - w) / 2;
    var xT0 = x0 / viewport.w;
    var xT1 = (x0 + w) / viewport.w;

    var count = SCENE_STAMP_COUNT;
    for (var i = 0; i < count; i++) {
      var t = i / (count - 1);
      var xT = dir >= 0 ? t : 1 - t;
      var rng = seededRandom(sceneKey.length * 401 + i * 67 + 13);
      var nx = clamp01(lerp(xT0 - 0.04, xT1 + 0.04, xT) + (rng() - 0.5) * 0.06);
      var ny = clamp01(rng() * 0.9 + 0.05);
      var family = SPLAT_FAMILY_ORDER[i % SPLAT_FAMILY_ORDER.length];
      var delay = t * duration * 0.7;
      addMaskStamp(layerKey, nx, ny, family, duration * 0.5, delay, rand(4.5, 6.0), "reveal", "power3.out");

      // Finger-Stempel: kleiner (0.25-0.4x), leicht versetzt zur Hauptwelle,
      // etwas verzoegert -- lassen den Rand ausfransen statt glatt zu laufen.
      var fingerCount = Math.round(FINGER_STAMP_COUNT / count) || (i < FINGER_STAMP_COUNT ? 1 : 0);
      for (var f = 0; f < fingerCount; f++) {
        var frng = seededRandom(sceneKey.length * 613 + i * 89 + f * 331 + 7);
        var fnx = clamp01(nx + (frng() - 0.5) * 0.10);
        var fny = clamp01(ny + (frng() - 0.5) * 0.18);
        var ffamily = SPLAT_FAMILY_ORDER[(i + f + 1) % SPLAT_FAMILY_ORDER.length];
        var fdelay = delay + rand(0.05, 0.35);
        addMaskStamp(layerKey, fnx, fny, ffamily, duration * 0.35, fdelay, rand(4.5, 6.0) * rand(0.25, 0.4), "reveal", "power3.out");
      }
    }
    startLayerReveal(layerKey, duration + 0.4);
  }

  function bloomScene(sceneKey, dir, duration, placement) {
    if (!sceneContentBuilt[sceneKey] || sceneContentBuilt[sceneKey] !== placement) {
      rebuildSceneContent(sceneKey, placement);
    }
    // Video-Szenen starten bei jedem Aufbluehen von vorn, spielen einmal
    // durch und frieren auf dem letzten Frame ein (loop=false in main.js) --
    // die Tinte trocknet, das Bild bleibt stehen.
    if (isVideoScene(sceneKey)) {
      var video = A.videos && A.videos[sceneKey];
      if (video) {
        try { video.currentTime = 0; } catch (e) {}
        var vp = video.play();
        if (vp && vp.catch) vp.catch(function () {});
      }
    }
    var layer = ensureRevealLayer(sceneLayerKey(sceneKey));
    layer.stamps = [];
    layer.mode = "reveal";
    layer.fullyRevealed = false;
    layer.dirty = true;
    paintSceneReveal(sceneKey, dir, duration || SCENE_REVEAL_DURATION, placement);
    spawnLeafBurst(3 + Math.floor(rand(0, 3)));
  }

  // Erosion: die Maske der auslaufenden Szene wird von IHRER Streifen-Mitte
  // (nicht der Viewport-Mitte -- die Szene ist ein Kollage-Element, siehe
  // placement) nach aussen mit destination-out-Stempeln durchloechert ("die
  // Tinte trocknet aus der Mitte heraus weg"), bis der Layer komplett
  // unsichtbar ist. ERODE_STAMP_COUNT Stempel, nach Distanz zum Zentrum
  // sortiert (innerste zuerst), jeder waechst ueber ~duration/stampcount-
  // Overlap-Fenster mit demselben traegen power3.out-Easing wie das Reveal.
  var ERODE_STAMP_COUNT = 7;

  function paintSceneErosion(sceneKey, duration, placement) {
    var layerKey = sceneLayerKey(sceneKey);
    var layer = ensureRevealLayer(layerKey);
    layer.stamps = [];
    layer.mode = "erode";
    layer.fullyRevealed = false;
    layer.dirty = true;

    var side = placement.side || "left";
    var w = placement.widthVw * viewport.w;
    var x0 = side === "left" ? 0 : side === "right" ? viewport.w - w : (viewport.w - w) / 2;
    var centerNx = (x0 + w / 2) / viewport.w;
    var halfSpanX = (w / 2) / viewport.w;

    var count = ERODE_STAMP_COUNT;
    var points = [];
    for (var i = 0; i < count; i++) {
      var rng = seededRandom(sceneKey.length * 733 + i * 91 + 5);
      var ang = rng() * Math.PI * 2;
      // Distanz zum Zentrum waechst mit i (grob), plus Streuung, damit die
      // Reihenfolge "innerste zuerst" ist aber nicht mechanisch aussieht.
      var distBase = (i / Math.max(1, count - 1));
      var dist = clamp01(distBase * 0.62 + rng() * 0.18);
      points.push({
        nx: clamp01(centerNx + Math.cos(ang) * dist * halfSpanX * 1.1),
        ny: clamp01(0.5 + Math.sin(ang) * dist * 0.55 * (viewport.h > 0 ? viewport.w / viewport.h : 1) * 0.6),
        dist: dist
      });
    }
    // Innerste zuerst: nach Distanz zum Zentrum sortieren.
    points.sort(function (a, b) { return a.dist - b.dist; });

    var stampDuration = 0.5;
    var span = Math.max(0.01, duration - stampDuration);
    for (var j = 0; j < points.length; j++) {
      var t = count > 1 ? j / (count - 1) : 0;
      var delay = t * span;
      var family = SPLAT_FAMILY_ORDER[j % SPLAT_FAMILY_ORDER.length];
      addMaskStamp(layerKey, points[j].nx, points[j].ny, family, stampDuration, delay, rand(5.5, 7.0), "erode", "power3.out");
    }
    startLayerReveal(layerKey, duration + 0.15, emptyMaskAndReset);
  }

  // Zeiten fuer Reveal/Erosion (MoXi/Lattice-Boltzmann-Referenz: traeger,
  // physikalischer wirkendes Ausbreiten -- siehe power3.out-Easing oben).
  // KEIN Gap mehr (Kollage-Modell): Erosion des rausfallenden Elements und
  // Bloom des neuen Elements laufen PARALLEL, nie leeres Papier dazwischen.
  // Pascal 04.07.: Aufloesen wirkte "nur ein Scroll, geht schnell" --
  // deutlich traeger, damit das Von-innen-nach-aussen lesbar wird.
  var SCENE_ERODE_DURATION = 2.8;
  var SCENE_BLOOM_DURATION = 3.0;

  // Liefert die Menge der Szenen, die fuer stationIndex sichtbar sein
  // sollen: die Szene der Station selbst PLUS die Szene der Vorstation
  // (falls verschieden) -- versetzte Lebenszyklen, siehe Spec "Kollage".
  // Reihenfolge: AELTESTE (Vorstation) zuerst, dann die aktuelle. Bei
  // stationIndex === -1 (virtuelle Vorstation, siehe Punkt 4a) gibt es
  // keine Vorstation davor -- nur INTRO_SCENE.
  function stationAt(idx) {
    if (idx === -1) return VIRTUAL_STATION_PRE;
    return STATIONS[idx];
  }

  function desiredSceneSet(stationIndex) {
    var cur = stationAt(stationIndex);
    if (!cur) return [];
    var prev = stationIndex > -1 ? stationAt(stationIndex - 1) : null;
    var out = [];
    if (prev && prev.scene !== cur.scene) {
      out.push({ key: prev.scene, placement: prev.placement });
    }
    out.push({ key: cur.scene, placement: cur.placement });
    return out;
  }

  // Sequenz-Generation: jeder syncSceneChain-Aufruf erhoeht ihn. Verzoegerte
  // Schritte pruefen ihre eigene Generation gegen den aktuellen Stand --
  // bricht der User waehrend einer laufenden Animation erneut um (schnelles
  // Hin-und-Her-Scrollen), verwerfen ueberholte Callbacks sich selbst statt
  // eine neuere Sequenz zu stoeren.
  var sceneSeqGen = 0;

  // Gleicht die sichtbare Kollage-Kette (sceneChain) mit der fuer
  // stationIndex gewuenschten Menge ab (siehe desiredSceneSet): Elemente die
  // rausfallen erodieren (von ihrer eigenen Streifen-Mitte aus), neue
  // Elemente bloomen per Ink-Flut auf -- BEIDES PARALLEL, kein Gap. Bereits
  // vorhandene, weiterhin gewuenschte Elemente bleiben unangetastet stehen
  // (kein Re-Reveal). Robust in beide Richtungen (vorwaerts/rueckwaerts) und
  // bei Sprüngen ueber mehrere Stationen, da rein mengenbasiert verglichen
  // wird statt einer starren Vorwaerts-Sequenz.
  function syncSceneChain(stationIndex) {
    sceneSeqGen += 1;
    var gen = sceneSeqGen;

    var target = desiredSceneSet(stationIndex);
    var targetKeys = target.map(function (t) { return t.key; });
    var currentKeys = sceneChain.map(function (c) { return c.key; });

    // Rausfallende Elemente: in der Kette, aber nicht mehr gewuenscht ->
    // erodieren und aus der Kette entfernen (die Erosion-Animation selbst
    // laeuft unabhaengig weiter, siehe paintSceneErosion/emptyMaskAndReset).
    sceneChain = sceneChain.filter(function (c) {
      if (targetKeys.indexOf(c.key) === -1) {
        paintSceneErosion(c.key, SCENE_ERODE_DURATION, c.placement);
        return false;
      }
      return true;
    });

    // Neue Elemente: gewuenscht, aber noch nicht in der Kette -> aufbluehen
    // und anhaengen. Richtung folgt der Seite (von rechts kommend = Flut
    // rechts->links, sonst links->rechts) statt eines simplen Alternierens,
    // damit sie inhaltlich zur Kollage-Seite passt.
    target.forEach(function (t) {
      if (currentKeys.indexOf(t.key) === -1) {
        var dir = t.placement && t.placement.side === "right" ? -1 : 1;
        sceneRevealDir = dir;
        bloomScene(t.key, dir, SCENE_BLOOM_DURATION, t.placement);
        sceneChain.push({ key: t.key, placement: t.placement });
      }
    });

    return gen;
  }

  // Layer-Keys aller in DIESEM Frame gezeichneten Szenen -- deren scratch-
  // Canvases (content x reveal-Maske, siehe drawMaskedLayer) sind nach
  // drawScenes() noch gueltig und dienen drawSplashes() als Stanz-Maske
  // (Pascal: Kleckse nur UM das Tier herum, nicht durchs Tier durch).
  var drawnSceneLayerKeys = [];

  function drawScenes() {
    // Alle Elemente der Kette zeichnen (aeltestes zuerst, damit ein neueres
    // Element bei ueberlappendem Rand ueber dem aelteren liegt). Erodierende
    // (bereits aus der Kette entfernte) Elemente werden separat weiter
    // gezeichnet, solange ihr Layer noch nicht leer+zurueckgesetzt ist --
    // siehe erodingLayerKeys/drawErodingScenes.
    drawnSceneLayerKeys.length = 0;
    sceneChain.forEach(function (c) {
      refreshVideoSceneContent(c.key);
      drawMaskedLayer(sceneLayerKey(c.key), SCENE_OPACITY);
      drawnSceneLayerKeys.push(sceneLayerKey(c.key));
    });
    drawErodingScenes();
  }

  // Erodierende Elemente sind bereits aus sceneChain entfernt (logisch nicht
  // mehr "aktiv"), muessen aber weiter gezeichnet werden bis ihre Maske leer
  // ist -- sonst verschwindet das Bild schlagartig statt zu erodieren. Jeder
  // scene_*-Layer mit mode:"erode" und !fullyRevealed (und nicht Teil der
  // aktuellen Kette) gilt als "noch erodierend".
  function drawErodingScenes() {
    var activeKeys = sceneChain.map(function (c) { return c.key; });
    Object.keys(manifest.scenes).forEach(function (key) {
      if (activeKeys.indexOf(key) !== -1) return;
      var layer = revealLayers[sceneLayerKey(key)];
      if (layer && layer.mode === "erode" && layer.stamps.length) {
        refreshVideoSceneContent(key);
        drawMaskedLayer(sceneLayerKey(key), SCENE_OPACITY);
        drawnSceneLayerKeys.push(sceneLayerKey(key));
      }
    });
  }

  /* ============================================================
     SPLATS (echte PNGs statt Polygone)
  ============================================================ */

  // Persistenter Painting-Offscreen: Footstep-Minis werden PERMANENT
  // hier reingestempelt (multiply). Jeder Stempel wird zusaetzlich als
  // Record (relative Position/Groesse/Rotation) gehalten, damit der Layer
  // bei Resize verlustfrei aus den Records neu aufgebaut werden kann --
  // ein einfaches Hochskalieren der Rasterdaten wuerde verzerren/verwaschen.
  var paintLayer = document.createElement("canvas");
  var paintCtx = paintLayer.getContext("2d");
  var paintRecords = []; // { nx, ny, family, index, sizeVw, rot }

  function resizePaintLayer() {
    var dpr = J.state.dpr || 1;
    paintLayer.width = Math.round(viewport.w * dpr);
    paintLayer.height = Math.round(viewport.h * dpr);
    replayPaintRecords();
  }

  function replayPaintRecords() {
    paintCtx.setTransform(1, 0, 0, 1, 0, 0);
    paintCtx.clearRect(0, 0, paintLayer.width, paintLayer.height);
    for (var i = 0; i < paintRecords.length; i++) {
      var r = paintRecords[i];
      var arr = A && A.img["splat_" + r.family];
      var img = arr && arr[r.index];
      if (img) stampToPaintLayer(r.nx, r.ny, img, r.sizeVw, r.rot, true);
    }
  }

  function stampToPaintLayer(nx, ny, img, sizeVw, rot, skipRecord) {
    if (!img) return;
    var dpr = J.state.dpr || 1;
    var cx = nx * viewport.w;
    var cy = ny * viewport.h;
    var size = sizeVw * viewport.w;
    paintCtx.save();
    paintCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintCtx.globalCompositeOperation = "multiply";
    paintCtx.translate(cx, cy);
    paintCtx.rotate(rot);
    paintCtx.drawImage(img, -size / 2, -size / 2, size, size);
    paintCtx.restore();
    if (!skipRecord) {
      paintRecords.push({
        nx: nx, ny: ny,
        family: img._splatFamily, index: img._splatIndex,
        sizeVw: sizeVw, rot: rot
      });
    }
  }

  // Wachsende (animierte) Splats bevor sie in den Painting-Layer gestempelt werden.
  var growingSplats = [];

  function spawnBurstSplat(nx, ny, family, sizeVw, duration, delay) {
    var rng = seededRandom(Math.floor(nx * 54321 + ny * 12345 + sizeVw * 999));
    var img = pickSplatImg(family, rng);
    growingSplats.push({
      nx: nx, ny: ny, img: img, sizeVw: sizeVw, rot: rng() * Math.PI * 2,
      scale: 0.15, targetScale: 1.0, elapsed: -(delay || 0), duration: duration || 0.8,
      permanent: true
    });
  }

  function updateGrowingSplats(dt) {
    for (var i = growingSplats.length - 1; i >= 0; i--) {
      var s = growingSplats[i];
      s.elapsed += dt;
      if (s.elapsed < 0) continue;
      var t = clamp01(s.elapsed / s.duration);
      var eased = 1 - Math.pow(1 - t, 3);
      s.scale = lerp(0.2, s.targetScale, eased);
      if (t >= 1) {
        stampToPaintLayer(s.nx, s.ny, s.img, s.sizeVw, s.rot);
        growingSplats.splice(i, 1);
      }
    }
  }

  function drawGrowingSplats() {
    for (var i = 0; i < growingSplats.length; i++) {
      var s = growingSplats[i];
      if (s.elapsed < 0 || !s.img) continue;
      var cx = s.nx * viewport.w;
      var cy = s.ny * viewport.h;
      var size = s.sizeVw * viewport.w * s.scale;
      scene2d.save();
      scene2d.globalCompositeOperation = "multiply";
      scene2d.translate(cx, cy);
      scene2d.rotate(s.rot);
      scene2d.drawImage(s.img, -size / 2, -size / 2, size, size);
      scene2d.restore();
    }
  }

  function drawPaintLayer() {
    if (paintLayer.width <= 0) return;
    scene2d.save();
    scene2d.setTransform(1, 0, 0, 1, 0, 0);
    scene2d.globalCompositeOperation = "multiply";
    scene2d.drawImage(paintLayer, 0, 0, paintLayer.width, paintLayer.height, 0, 0, viewport.w, viewport.h);
    var dpr = J.state.dpr || 1;
    scene2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    scene2d.globalCompositeOperation = "source-over";
    scene2d.restore();
  }

  /* ============================================================
     STATIONSWECHSEL
     Jede Station ist ein fertiges Gemaelde/Video mit dem Motiv baked-in --
     keine separaten Geister-Posen mehr. Ein Wechsel synchronisiert nur
     noch die Kollage-Kette (syncSceneChain): rausfallende Elemente
     erodieren, neue bloomen auf, beides parallel.
  ============================================================ */

  function transitionToStation(stationIndex) {
    var station = stationAt(stationIndex);
    if (!station) return;
    syncSceneChain(stationIndex);
  }

  /* ============================================================
     JAGUAR-CHOREOGRAFIE (Progress -> aktive Station)
  ============================================================ */

  function updateJaguar(progress, dt) {
    if (progress < STATIONS[0].p) {
      // Rueckwaerts unter Station 0: die Intro-Szene (treeL) kommt zurueck --
      // behandelt wie eine Station mit Index -1, gleiche Kollage-Ketten-
      // logik (syncSceneChain) wie jeder andere Wechsel.
      if (choreo.currentStationIndex !== -1) {
        choreo.currentStationIndex = -1;
        transitionToStation(-1);
      }
      return;
    }

    var idx = activeStationIndex(progress);
    if (idx !== choreo.currentStationIndex) {
      choreo.currentStationIndex = idx;
      transitionToStation(idx);
    }
  }

  function inRange(p, range) {
    return p >= range[0] && p < range[1];
  }

  /* ============================================================
     BLAETTER-PARTIKEL (echte PNGs statt Ellipsen)
  ============================================================ */

  // Blaetter sind EREIGNISSE, keine Dauerschleife: bei jedem Szenenwechsel
  // loest sich ein kleiner Schub, segelt herab und verschwindet -- danach
  // Stille, bis die naechste Station kommt ("alles kommt zum Stillstand").
  var leaves = [];

  function initLeaves() {
    leaves = [];
  }

  function spawnLeafBurst(count) {
    for (var i = 0; i < count; i++) leaves.push(makeLeaf(false));
  }

  function makeLeaf(randomY) {
    var imgs = A ? A.img.leaves : null;
    return {
      x: rand(0, 1),
      y: randomY ? rand(-0.2, 1) : -0.05 - rand(0, 0.2),
      speed: rand(0.05, 0.10),
      driftAmp: rand(0.01, 0.03),
      driftFreq: rand(0.3, 0.8),
      driftPhase: rand(0, Math.PI * 2),
      rot: rand(0, Math.PI * 2),
      rotSpeed: rand(-1, 1),
      sizeVw: rand(0.015, 0.03),
      img: imgs && imgs.length ? imgs[Math.floor(rand(0, imgs.length))] : null
    };
  }

  function updateLeaves(dt) {
    for (var i = leaves.length - 1; i >= 0; i--) {
      var l = leaves[i];
      l.y += l.speed * dt;
      l.driftPhase += l.driftFreq * dt;
      l.rot += l.rotSpeed * dt;
      if (l.y > 1.05) leaves.splice(i, 1);
    }
    choreo.leafCount = leaves.length;
  }

  function drawLeaves() {
    scene2d.save();
    scene2d.globalCompositeOperation = "multiply";
    scene2d.globalAlpha = 0.6;
    for (var i = 0; i < leaves.length; i++) {
      var l = leaves[i];
      if (!l.img) continue;
      var x = (l.x + Math.sin(l.driftPhase) * l.driftAmp) * viewport.w;
      var y = l.y * viewport.h;
      var size = l.sizeVw * viewport.w;
      scene2d.save();
      scene2d.translate(x, y);
      scene2d.rotate(l.rot);
      scene2d.drawImage(l.img, -size / 2, -size / 2, size, size);
      scene2d.restore();
    }
    scene2d.globalAlpha = 1;
    scene2d.globalCompositeOperation = "source-over";
    scene2d.restore();
  }

  /* ============================================================
     STATIONEN-EVENTS (feuern vorwaerts, nicht rueckgaengig)
     - letter: Buchstabe wird beim ERSTEN Vorwaertserreichen gestempelt
       (bleibt danach stehen, auch beim Zurueckscrollen).
     - finale: true triggert Subline/Nav-Deko.
  ============================================================ */

  function checkOneShots(progress) {
    for (var i = 0; i < STATIONS.length; i++) {
      var station = STATIONS[i];
      var key = "station" + i;
      if (progress < station.p || choreo.firedOneShots[key]) continue;
      choreo.firedOneShots[key] = true;

      if (station.letter) stampLetters([station.letter]);
      if (station.splash) triggerSplash(station.splash, station.scene, station.placement);
      if (station.finale) gsap.delayedCall(0.3, showFinaleDecor);
    }
  }

  function stampLetters(letters) {
    var families = ["jade", "terra", "gold", "pink"];
    var color = PALETTE[({ jade: "jade", terra: "terracotta", gold: "gold", pink: "pink" })[families[Math.floor(rand(0, families.length))]]];
    for (var i = 0; i < letters.length; i++) {
      var idx = letterIndex(letters[i]);
      var el = document.getElementById("letter-" + letters[i] + "-" + idx);
      if (!el) continue;
      var stampColor = PALETTE[["jade", "terracotta", "gold", "pink"][idx % 4]];
      gsap.timeline()
        .set(el, { color: stampColor })
        .to(el, { opacity: 1, scale: 1, rotate: TITLE_LETTER_ROT[idx] || 0, duration: 0.5, ease: "back.out(2)" }, 0)
        .to(el, { color: PALETTE.tusche, duration: 1 }, 0.3);
    }
  }

  function letterIndex(letter) {
    return TITLE_LETTERS.indexOf(letter);
  }

  // Tocapu-Siegel + Subline: einmaliger Reveal beim ersten Erreichen des
  // Finales, bleiben danach stehen (wie die Titel-Buchstaben, siehe
  // stampLetters). Pascal 05.07.: das vermeintliche "chinesische/japanische
  // Zeichen" war NICHT das Tocapu-Siegel (Missverstaendnis, Siegel bleibt),
  // sondern etwas anderes, versteckt im springenden-Panther-Bild -- noch zu
  // finden (siehe STATUS_003, offener Punkt).
  var finaleDecorShown = false;
  function showFinaleDecor() {
    if (finaleDecorShown) return;
    finaleDecorShown = true;
    var tocapu = document.getElementById("title-tocapu");
    var subline = document.getElementById("title-subline");
    gsap.timeline()
      .to(tocapu, { opacity: 1, scale: 1, rotate: 6, duration: 0.7, ease: "back.out(1.7)" }, 0)
      .to(subline, { opacity: 0.55, duration: 0.9 }, 0.2);
  }

  /* ============================================================
     SNAP
  ============================================================ */

  function setupSnap() {
    var st = ScrollTrigger.getAll().filter(function (s) { return s.trigger === document.querySelector(".hero"); })[0];
    if (!st) return;
    st.vars.snap = {
      snapTo: buildSnapPoints(),
      duration: { min: 0.2, max: 0.6 },
      delay: 0.1
    };
    ScrollTrigger.refresh();
  }

  /* ============================================================
     DOM: TITEL-LETTERS BAUEN
  ============================================================ */

  function buildTitleDOM() {
    var titleEl = document.getElementById("title");
    titleEl.innerHTML = "";
    for (var i = 0; i < TITLE_LETTERS.length; i++) {
      var span = document.createElement("span");
      span.textContent = TITLE_LETTERS[i];
      span.id = "letter-" + TITLE_LETTERS[i] + "-" + i;
      gsap.set(span, { scale: 1.5, rotate: TITLE_LETTER_ROT[i] || 0 });
      titleEl.appendChild(span);
    }
  }

  /* ============================================================
     INTRO-TIMELINE
  ============================================================ */

  var introTimeline;

  // Tuschetropfen faellt auf einen beliebigen Viewport-Punkt (nx, ny) --
  // generische Version des frueheren dropTuscheAnimation, das an eine feste
  // branchLayout-Position gebunden war.
  function dropTuscheAt(nx, ny, onLanded) {
    var targetPx = { x: nx * viewport.w, y: ny * viewport.h };
    var drop = { y: targetPx.y - viewport.h * 0.15, r: 3 };
    gsap.timeline()
      .to(drop, {
        y: targetPx.y,
        duration: 0.5,
        ease: "power2.in",
        onUpdate: function () {
          scene2d.save();
          scene2d.setTransform(J.state.dpr || 1, 0, 0, J.state.dpr || 1, 0, 0);
          scene2d.fillStyle = PALETTE.tusche;
          scene2d.beginPath();
          scene2d.ellipse(targetPx.x, drop.y, drop.r, drop.r * 1.6, 0, 0, Math.PI * 2);
          scene2d.fill();
          scene2d.restore();
        }
      })
      .add(function () { if (onLanded) onLanded(); });
  }

  function buildIntro() {
    introTimeline = gsap.timeline({
      onComplete: function () {
        choreo.introActive = false;
        choreo.introDone = true;
      }
    });

    introTimeline.addLabel("start", 0);

    // mist_live ist eine durchgehende Grundschicht ohne Reveal (siehe
    // drawMistLayer) -- kein Wash-Aufbau mehr noetig, laeuft von Anfang an.

    // Tuschetropfen faellt links auf das Papier -> scene_treeL bluoeht per
    // Ink-Flut von links auf (das "Hingeworfen"-Gefuehl). treeL ist Glied -1
    // der Kollage-Kette (siehe VIRTUAL_STATION_PRE/sceneChain) -- direkt in
    // die Kette aufnehmen, damit der erste echte syncSceneChain-Aufruf
    // (Station 0) sie als bereits vorhanden erkennt statt neu aufzubluehen.
    introTimeline.call(function () {
      dropTuscheAt(0.06, 0.5, function () {
        sceneRevealDir = 1;
        bloomScene(INTRO_SCENE, 1, 2.0, INTRO_PLACEMENT);
        sceneChain.push({ key: INTRO_SCENE, placement: INTRO_PLACEMENT });
        triggerSplash(INTRO_SPLASH, INTRO_SCENE, INTRO_PLACEMENT);
      });
    }, null, 1.2);

    introTimeline.call(function () {
      var hint = document.getElementById("scroll-hint");
      gsap.to(hint, { opacity: 1, duration: 0.6 });
      gsap.to(hint, {
        y: 8,
        duration: 1.1,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true
      });
    }, null, 3.8);

    introTimeline.to({}, { duration: 0.4 }, 4.6);
  }

  var hintDismissed = false;

  function skipIntro() {
    if (choreo.introActive) {
      introTimeline.progress(1);
      choreo.introActive = false;
      choreo.introDone = true;
      sceneChain.forEach(function (c) { fullRevealMask(sceneLayerKey(c.key)); });
    }
    if (!hintDismissed) {
      hintDismissed = true;
      var hint = document.getElementById("scroll-hint");
      gsap.killTweensOf(hint);
      gsap.to(hint, { opacity: 0, duration: 0.3 });
    }
  }

  ["wheel", "touchstart", "scroll"].forEach(function (evt) {
    window.addEventListener(evt, skipIntro, { passive: true });
  });

  window.addEventListener("mousemove", function (e) {
    mouse.nx = e.clientX / viewport.w;
    mouse.ny = e.clientY / viewport.h;
  }, { passive: true });

  /* ============================================================
     SEGMENT-BESTIMMUNG (fuer HUD)
  ============================================================ */

  function currentSegmentName(progress) {
    if (progress < STATIONS[0].p) return "intro";
    var idx = activeStationIndex(progress);
    if (idx < 0) return "intro";
    var station = STATIONS[idx];
    return idx + ":" + station.scene;
  }

  /* ============================================================
     FINALE: NAV EINBLENDEN (einmalig)
  ============================================================ */

  var finaleStation = STATIONS.filter(function (s) { return s.finale; })[0];
  var finaleThreshold = finaleStation ? finaleStation.p : 1;

  var navShown = false;
  function checkFinaleNav(progress) {
    if (progress >= finaleThreshold && !navShown) {
      navShown = true;
      gsap.to("#site-nav", { opacity: 1, duration: 1 });
    } else if (progress < finaleThreshold && navShown) {
      navShown = false;
      gsap.to("#site-nav", { opacity: 0, duration: 0.5 });
    }
  }

  /* ============================================================
     RESIZE
  ============================================================ */

  // Kompletter Layout-Rebuild bei Resize. Stage-Groesse, alle Offscreens
  // (Ebenen-Content, Masken, Paint-Layer) und deren statischer Inhalt werden
  // neu berechnet/gezeichnet. Reveal-Zustaende bleiben erhalten: fertige
  // Ebenen werden einfach wieder voll gezeichnet, laufende Reveals behalten
  // ihre Stamp-Records (in relativen nx/ny) und werden auf die neue
  // Viewport-Groesse neu gerendert.
  function onResize(w, h) {
    viewport.w = w;
    viewport.h = h;

    resizePaintLayer(); // baut paintLayer aus paintRecords neu auf (siehe oben)

    if (!manifest) return;

    rebuildParallaxContent();
    rebuildAllSceneContent();
    if (borderContentBuilt) rebuildBorderContent();

    // Masken neu aufbauen: fertige Ebenen wieder komplett fuellen, laufende
    // Reveals aus ihren (relativen) Stamps neu zeichnen -- sizeCanvasToViewport
    // greift dabei automatisch die neue Stage-Groesse.
    Object.keys(revealLayers).forEach(function (key) {
      var layer = revealLayers[key];
      if (layer.fullyRevealed) {
        fullRevealMask(key);
      } else {
        layer.dirty = true;
        redrawMask(key);
      }
    });

    updateDebugLayout();

    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  function updateDebugLayout() {
    window.JUNGL.debug = window.JUNGL.debug || {};
    window.JUNGL.debug.layout = { stageW: viewport.w, stageH: viewport.h };
  }

  /* ============================================================
     MAIN FRAME LOOP
  ============================================================ */

  function frame(dt) {
    var progress = J.state.scroll;
    choreo.scrollProgress = progress;
    choreo.currentSegment = currentSegmentName(progress);

    checkOneShots(progress);
    checkFinaleNav(progress);
    updateJaguar(progress, dt);
    updateLeaves(dt);
    updateGrowingSplats(dt);
    updateSplashes(dt);
    updateBorderEyeGlow(dt);

    var maskKeys = ["mist", "border"];
    Object.keys(manifest.scenes).forEach(function (key) { maskKeys.push(sceneLayerKey(key)); });
    maskKeys.forEach(function (key) {
      var layer = revealLayers[key];
      if (layer) updateMaskStamps(layer, dt);
    });

    scene2d.clearRect(0, 0, viewport.w, viewport.h);
    scene2d.setTransform(J.state.dpr || 1, 0, 0, J.state.dpr || 1, 0, 0);

    // Szene wird um stageShift.y nach oben versetzt gezeichnet (siehe
    // shiftStageForBorder) -- die Bordüre bleibt aussehalb dieses
    // save/restore-Blocks, damit sie IMMER an ihrer buendigen, unverschobenen
    // Position bleibt (nie ausserhalb der Canvas-Kante).
    scene2d.save();
    if (stageShift.y) scene2d.translate(0, -stageShift.y);
    drawMistLayer();
    drawScenes();
    drawSplashes();
    drawPaintLayer();
    drawGrowingSplats();
    drawLeaves();
    scene2d.restore();

    drawBorder();
    drawBorderEyeGlow();

    var segEl = document.getElementById("hud-segment");
    var hudStation = stationAt(choreo.currentStationIndex);
    if (segEl) segEl.textContent = choreo.currentStationIndex + ":" + (hudStation ? hudStation.scene : "-");
  }

  /* ============================================================
     INIT
  ============================================================ */

  function startChoreo() {
    manifest = window.JUNGL.manifest;
    A = window.JUNGL.assets;

    // Viewport auf die JETZT aktuellen Fenstermasse setzen -- zwischen
    // Script-Parse (Zeile ~86) und Asset-Ready kann sich die Fenstergroesse
    // veraendert haben, und main.js kann in der Zwischenzeit bereits
    // resize-Events gefeuert haben, die hier noch nicht registriert waren.
    viewport.w = window.innerWidth;
    viewport.h = window.innerHeight;

    resizePaintLayer();
    rebuildParallaxContent();
    rebuildAllSceneContent();
    initLeaves();
    buildTitleDOM();
    buildIntro();
    // Reaktiviert (Pascal 04.07.): echtes Alpha-PNG (inca2.png) statt
    // gekachelter Navy-Grafik, kein Weissrand mehr, Palette passt.
    initBorderTrigger();

    window.JUNGL.onResize.push(onResize);
    window.JUNGL.onFrame.push(frame);

    setTimeout(setupSnap, 50);

    window.JUNGL.debug = choreo;
    updateDebugLayout();
  }

  if (window.JUNGL.state.ready) {
    startChoreo();
  } else {
    window.JUNGL.onAssetsReady = startChoreo;
  }
})();
