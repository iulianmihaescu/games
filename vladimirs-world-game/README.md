# 🌍 Vladimir's World Game

Un joc de geografie pentru copii (de la ~6 ani): caută țările pe harta lumii și învață capitalele lor.

## Cum se joacă

Deschide `index.html` în browser (dublu-click merge, nu e nevoie de server). Merge pe calculator, tabletă și telefon.

- **🔍 Find the country** (Găsește țara) – jocul spune numele unei țări (și arată steagul); copilul o caută și o atinge pe hartă.
  Dacă greșește, află ce țară a atins. După 3 încercări (sau cu butonul 💡) țara căutată începe să clipească.
- **🏰 Capitals** (Capitale) – o țară se colorează pe hartă, iar copilul alege capitala ei din 3 variante.
- **🧭 Explore** (Explorează) – atinge orice țară ca să afli cum se numește și care e capitala ei.

Pentru primele două moduri se alege regiunea (toată lumea sau un continent) și nivelul:
⭐ Easy (țări mari și cunoscute), ⭐⭐ Medium, ⭐⭐⭐ Hard (toate cele ~170 de țări).

Fiecare rundă are 10 întrebări. Răspunsurile corecte fără ajutor aduc câte o stea ⭐, iar stelele se adună de la o rundă la alta.

Jocul este în întregime în **engleză** (texte pe ecran și voce: „Find France!”, „The capital is Paris.”),
așa că Vladimir învață geografie și exersează engleza în același timp. Vocea citește totul cu voce tare,
deci poate fi jucat și de copiii care încă învață să citească. 🗣️ repetă ultima frază, 🔊 oprește sunetul.

Harta se poate mări cu două degete (sau rotița mouse-ului) și muta prin tragere.

## Detalii tehnice

- HTML/CSS/JavaScript simplu, fără pas de build.
- Harta: [Natural Earth](https://www.naturalearthdata.com/) 1:110m, prin [world-atlas](https://github.com/topojson/world-atlas) (inclusă în `data/`).
- Biblioteci incluse în `vendor/`: [d3](https://d3js.org/) și [topojson-client](https://github.com/topojson/topojson-client) (licență ISC).
- Țările, capitalele și nivelurile de dificultate sunt în `data/countries.js` – ușor de modificat.
- Steagurile se încarcă de pe [flagcdn.com](https://flagcdn.com); fără internet se folosesc emoji-uri.
