// Ortega PBL diagram generator for 2x2.
// Renders a 2x2 face with surrounding side strips matching the original table layout.
function ortegaSvg(pattern, mode, size) {
  var Y = "#f6c719", GRAY = "#4b515c";
  var C = { U: Y, F: "#179e4f", R: "#ff7a1a", B: "#2c6fe6", L: "#d12d28", D: "#eef2f3" };
  function color(ch) { return mode === "oll" ? (ch === "U" ? Y : GRAY) : (C[ch] || GRAY); }
  
  // 2x2 grid layout (Compact blocks with spacing matching the 3x3 style)
  var S = 24, G = 2, W = 8, o = W + G, T = o + 2 * (S + G) + W;
  var r = [];
  
  // 4 corners of the 2x2 face
  for (var i = 0; i < 4; i++) {
    var col = i % 2;
    var row = Math.floor(i / 2);
    r.push([o + col * (S + G), o + row * (S + G), S, S, 2, pattern[i]]);
  }
  
  // 4 surrounding side strips (Front, Right, Back, Left)
  r.push([o, o + 2 * (S + G), 2 * S + G, W, 1, pattern[4]]); // Front
  r.push([o + 2 * (S + G), o, W, 2 * S + G, 1, pattern[5]]); // Right
  r.push([o, 0, 2 * S + G, W, 1, pattern[6]]);             // Back
  r.push([0, o, W, 2 * S + G, 1, pattern[7]]);             // Left

  return '<svg viewBox="0 0 ' + T + ' ' + T + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    r.map(function (a) {
      return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] +
        '" rx="' + a[4] + '" fill="' + color(a[5]) + '" stroke="#14171c" stroke-width="0.9"/>';
    }).join("") + "</svg>";
}
