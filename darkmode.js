// Karanlık mod tercihini kontrol et
const darkMode = localStorage.getItem("darkMode");

if (darkMode === "enabled") {
    document.documentElement.classList.add("dark-mode");
}

// Karanlık modu aç/kapat
function toggleDarkMode() {
    document.documentElement.classList.toggle("dark-mode");

    if (document.documentElement.classList.contains("dark-mode")) {
        localStorage.setItem("darkMode", "enabled");
    } else {
        localStorage.setItem("darkMode", "disabled");
    }
}
