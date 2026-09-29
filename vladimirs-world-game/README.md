# 🌍 Vladimir's World Game

Un joc de geografie pentru copii (de la ~6 ani): caută țările pe harta lumii și învață capitalele lor.

## Cum se joacă

Deschide `index.html` în browser (dublu-click merge, nu e nevoie de server). Merge pe calculator, tabletă și telefon.

- **🔍 Găsește țara** – jocul spune numele unei țări (și arată steagul); copilul o caută și o atinge pe hartă.
  Dacă greșește, află ce țară a atins. După 3 încercări (sau cu butonul 💡) țara căutată începe să clipească.
- **🏰 Capitale** – o țară se colorează pe hartă, iar copilul alege capitala ei din 3 variante.
- **🧭 Explorează** – atinge orice țară ca să afli cum se numește și care e capitala ei.

Pentru primele două moduri se alege regiunea (toată lumea sau un continent) și nivelul:
⭐ Ușor (țări mari și cunoscute), ⭐⭐ Mediu, ⭐⭐⭐ Greu (toate cele ~170 de țări).

Fiecare rundă are 10 întrebări. Răspunsurile corecte fără ajutor aduc câte o stea ⭐, iar stelele se adună de la o rundă la alta.

Textele de pe ecran sunt în română, iar vocea jocului citește întrebările și răspunsurile în **engleză**
(„Find France!”, „The capital is Paris.”), așa că Vladimir exersează și engleza. 🗣️ repetă ultima frază, 🔊 oprește sunetul.

Harta se poate mări cu două degete (sau rotița mouse-ului) și muta prin tragere.

## Detalii tehnice

- HTML/CSS/JavaScript simplu, fără pas de build.
- Harta: [Natural Earth](https://www.naturalearthdata.com/) 1:110m, prin [world-atlas](https://github.com/topojson/world-atlas) (inclusă în `data/`).
- Biblioteci incluse în `vendor/`: [d3](https://d3js.org/) și [topojson-client](https://github.com/topojson/topojson-client) (licență ISC).
- Țările, capitalele și nivelurile de dificultate sunt în `data/countries.js` – ușor de modificat.
- Steagurile se încarcă de pe [flagcdn.com](https://flagcdn.com); fără internet se folosesc emoji-uri.
