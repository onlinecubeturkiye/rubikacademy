// Ortega PBL diagram generator for 2x2.
// Renders a clean 2x2 face with dual-colored side stickers attached correctly to corners.
function ortegaSvg(pattern, mode, size) {
  var Y = "#f6c719", GRAY = "#4b515c";
  var C = { U: Y, F: "#179e4f", R: "#ff7a1a", B: "#2c6fe6", L: "#d12d28", D: "#eef2f3" };
  function color(ch) { return mode === "oll" ? (ch === "U" ? Y : GRAY) : (C[ch] || GRAY); }
  
  // 2x2 grid without internal gaps
  var S = 28, W = 7, o = W, T = 2 * S + 2 * W;
  var halfS = S / 2;
  var r = [];
  
  // 1. 4 main face corners (2x2 grid)
  for (var i = 0; i < 4; i++) {
    var col = i % 2;
    var row = Math.floor(i / 2);
    r.push([o + col * S, o + row * S, S, S, 1.5, pattern[i]]);
  }
  
  // 2. Side strips split into two precise halves per side, attached to the outer edges
  // Front strip (bottom) - split into left and right halves
  r.push([o, o + 2 * S, halfS, W, 1, pattern[4]]);
  r.push([o + halfS, o + 2 * S, halfS, W, 1, pattern[5]]);
  
  // Right strip - split into top and bottom halves
  r.push([o + 2 * S, o, W, halfS, 1, pattern[6]]);
  r.push([o + 2 * S, o + halfS, W, halfS, 1, pattern[7]]);
  
  // Back strip (top) - split into left and right halves
  r.push([o, 0, halfS, W, 1, pattern[8]]);
  r.push([o + halfS, 0, halfS, W, 1, pattern[9]]);
  
  // Left strip - split into top and bottom halves
  r.push([0, o, W, halfS, 1, pattern[10]]);
  r.push([0, o + halfS, W, halfS, 1, pattern[11]]);

  return '<svg viewBox="0 0 ' + T + ' ' + T + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    r.map(function (a) {
      return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] +
        '" rx="' + a[4] + '" fill="' + color(a[5]) + '" stroke="#14171c" stroke-width="0.8"/>';
    }).join("") + "</svg>";
}
