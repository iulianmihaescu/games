# ✈️ Vladimir & Leo World Explorers

Un joc de călătorie pentru copii de 7–8 ani: Vladimir și Leo pleacă cu avionul de pe **aeroportul din Madeira**
și zboară spre capitalele și marile orașe ale Europei și ale lumii. Textele și vocea sunt în engleză.

## Cum se joacă

Deschide `index.html` în browser (merge și fără server).

- **Alegi orașul următor** în trei feluri:
  - din **listă** (sortată după cel mai apropiat, A–Z, doar capitale sau doar orașe nevizitate), filtrată pe continente: Europa, Africa, Asia, America, Oceania;
  - **scriind numele** în căutare (merge și fără diacritice: „timisoara”, „chisinau”); săgețile ↑ ↓ mută selecția, iar Enter pornește zborul;
  - **de pe hartă**: o atingere alege orașul, a doua atingere (sau butonul roșu) pornește zborul.
- **Zborul:** avionul zboară pe hartă pe ruta cea mai scurtă, iar biletul de îmbarcare arată distanța, timpul de zbor și câți kilometri au rămas.
- **La aterizare:** un card cu emoji-ul orașului, steagul, „cum se spune salut” în limba locală, 3 lucruri interesante și o mâncare tipică, citite cu voce tare.
  Țările fără aeroport (Vatican, Monaco, San Marino, Liechtenstein, Andorra) explică unde a aterizat de fapt avionul.
- **Pașaportul** 📒 adună ștampile, numărul de orașe, țări și kilometri zburați, plus 14 insigne (5 orașe, Island hopper, Romania tour, Around the world, Long-haul pilot, World expert…).
- Progresul se păstrează în browser; din ecranul de start se poate porni o călătorie nouă din Madeira.

## Date

- 127 de orașe: 72 în Europa (`data/cities.js`) și 55 în restul lumii (`data/world-cities.js`), capitale și orașe mari, ușor de completat.
- Harta întregii lumi: [Natural Earth](https://www.naturalearthdata.com/) 1:50m prin [world-atlas](https://github.com/topojson/world-atlas); biblioteci [d3](https://d3js.org/) și [topojson-client](https://github.com/topojson/topojson-client) (ISC), incluse în `vendor/`.
- Steagurile vin de pe flagcdn.com; fără internet se folosesc emoji-uri.
