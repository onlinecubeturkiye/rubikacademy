// CLL diagram generator for 2x2 (Fixed flawless 4-corner layout).
function cllSvg(pattern, mode, size) {
var Y = "#f6c719", GRAY = "#4b515c";
var C = { U: Y, F: "#179e4f", R: "#d12d28", B: "#2c6fe6", L: "#ff7a1a", D: "#eef2f3" };
function color(ch) { return mode === "oll" ? (ch === "U" ? Y : GRAY) : (C[ch] || GRAY); }
var S = 28, o = 4, T = 2 * S + 2 * o;
var r = [];

// 4 corners ordered strictly: 0: Top-Left, 1: Top-Right, 2: Bottom-Left, 3: Bottom-Right
for (var i = 0; i < 4; i++) {
var col = i % 2;
var row = Math.floor(i / 2);
r.push([o + col * S, o + row * S, S, S, 2, pattern[i]]);
}

return '<svg viewBox="0 0 ' + T + ' ' + T + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
r.map(function (a) {
return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '" rx="' + a[4] + '" fill="' + color(a[5]) + '" stroke="#14171c" stroke-width="1.2"/>';
}).join("") + "</svg>";
}
