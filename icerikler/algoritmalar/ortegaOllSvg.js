// Ortega OLL diagram generator for 2x2.
// Draws a single U-layer view: 4 top corners + 8 surrounding side stickers,
// colored yellow ("U" in the pattern string) or unsolved/gray (anything else).
function ortegaOllSvg(pattern, size) {
  var Y = "#f6c719", GRAY = "#4b515c";
  function color(ch) { return ch === "U" ? Y : GRAY; }

  var S = 28, W = 7, o = W, T = 2 * S + 2 * W;
  var r = [];

  // 1. 4 corners of the 2x2 face (Compact 2x2 grid, no gaps)
  for (var i = 0; i < 4; i++) {
    var col = i % 2;
    var row = Math.floor(i / 2);
    r.push([o + col * S, o + row * S, S, S, 1.5, pattern[i]]);
  }

  // 2. 4 surrounding side strips (Front, Right, Back, Left)
  r.push([o, o + 2 * S, S, W, 1, pattern[4]]);     // Front-Left
  r.push([o + S, o + 2 * S, S, W, 1, pattern[5]]); // Front-Right
  r.push([o + 2 * S, o, W, S, 1, pattern[6]]);     // Right-Top
  r.push([o + 2 * S, o + S, W, S, 1, pattern[7]]); // Right-Bottom
  r.push([o, 0, S, W, 1, pattern[8]]);             // Back-Left
  r.push([o + S, 0, S, W, 1, pattern[9]]);         // Back-Right
  r.push([0, o, W, S, 1, pattern[10]]);            // Left-Top
  r.push([0, o + S, W, S, 1, pattern[11]]);          // Left-Bottom

  return '<svg viewBox="0 0 ' + T + ' ' + T + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    r.map(function (a) {
      return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] +
        '" rx="' + a[4] + '" fill="' + color(a[5]) + '" stroke="#14171c" stroke-width="0.9"/>';
    }).join("") + "</svg>";
}
