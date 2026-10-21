/* Küp çözücü web worker'ı: cubejs (MIT, Kociemba iki aşamalı algoritma). Tablolar ilk istekte bir kez hazırlanır. */
importScripts("/js/vendor/cubejs/cube.js?v=20261175", "/js/vendor/cubejs/solve.js?v=20261175");
var ready = false;
self.onmessage = function (e) {
    var d = e.data || {};
    try {
        if (!ready) { Cube.initSolver(); ready = true; }
        if (d.cmd === "init") { self.postMessage({ cmd: "init", ok: true }); return; }
        if (d.cmd === "solve") {
            var sol = Cube.fromString(d.facelets).solve();
            self.postMessage({ cmd: "solve", id: d.id, ok: true, solution: sol });
        }
    } catch (err) {
        self.postMessage({ cmd: d.cmd, id: d.id, ok: false, error: String(err && err.message || err) });
    }
};
