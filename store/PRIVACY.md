# Privacy policy – SplitScreen Browser Sync

Last updated: 12 November 2026 · Version 1.1.0

[English](#english) · [Nederlands](#nederlands)

---

## English

SplitScreen Browser Sync is a Chrome extension made by BijBijker (https://bijbijker.nl). It keeps the two tabs (panes) of a Chrome Split View scrolled to the same position and can mirror navigation, hover effects, your mouse cursor and, if you turn them on, clicks and typing between them. It can also lay an image of one pane over the other, compare the CSS of matching elements, keep a page checklist and remember pairs of sites.

### Summary

- **Nothing leaves your browser to the developer.** The extension has no server, no analytics, no tracking, no advertising and no remote code. BijBijker receives no data.
- To do its job, the extension **does pass some data from one pane to the other**, so from one website to the other website in your Split View. What is passed is listed below.
- This only happens **between the two sites you started sync for**. When you press Start sync, the extension records the site (origin, for example `https://example.com` and `https://staging.example.com`) of both panes. If either pane opens a different site, sync pauses until you press Start sync again.

### What passes between the two panes

The two sites in a synced pair can learn the following about your activity on the other site, because the extension reproduces it there:

| Data | When | What the other site sees |
|---|---|---|
| Scroll position (in pixels) | While sync is on | It is scrolled to the same position |
| The path, query string and `#` part of the address you navigate to (for example `/contact/?x=1#form`) | While sync is on and "Sync navigation" is on (default on) | It opens that same path on its own domain. Anything in the address, such as a search term or a token in the query string, therefore reaches the other site's server |
| A description of the element you hover: tag name, id, `data-*` attributes, `aria-label`/`name`, link path, a short piece of visible text, and the pointer position | While sync is on and "Mirror hover effects" is on (default on) | The matching element gets hover events, so the other page's scripts can notice what you point at |
| The position of your mouse pointer in the pane (viewport coordinates and the pane size, no element or page content) and the moment you click | While sync is on and "Show mouse cursor" is on (default on) | The extension draws a cursor arrow (and a short ripple on a click) in the other pane. It is drawn in a sealed layer the page cannot read; it never clicks anything |
| The same kind of description of the element you click or focus | While sync is on and "Mirror clicks" is on (default **off**) | The matching element is clicked or focused, so the other page's scripts can notice it |
| A description of the top visible element (same kind as for hover) and how far you scrolled into it | While sync is on and "Alignment" is set to "On element/content" (default pixel-exact) | It scrolls the matching element to the same spot |
| A description of a scroll area you scroll (modal, side panel, list) and its scroll position | While sync is on and "Sync scroll areas" is on (default on) | The matching scroll area is scrolled |
| The zoom level of the pane | While sync is on and "Sync zoom" is on (default on) | The other pane gets the same zoom (Chrome stores zoom per site, so other tabs of that site follow) |
| **What you type** into a text field, text area or editable area, and checkbox, radio and select choices, with a description of the field | While sync is on and "Sync typing" is on (default **off**) | The matching field gets the same value, so **the other site receives that text** and its scripts can read it. Never password, one-time-code, PIN or payment card fields, hidden or file fields, or fields whose name or label looks sensitive. Nothing is submitted |
| An image (screenshot) of the visible part of one pane | Only while you have turned on "Overlay" | The image is drawn on top of the other pane in a sealed layer the page cannot read |
| Computed CSS values (such as font, size, colours, spacing) and the box size of the element under your mouse, with a description of that element | Only while "Inspect differences" is on | The matching element is outlined and its own CSS values are sent back to compare |

The extension never reads what you type into form fields unless you turn on "Sync typing", never reads the contents of password, one-time-code, PIN or payment card fields, and never mirrors clicks or focus on them. It never replays a click on a submit button, inside a form that posts data, or on delete/pay/confirm/buy/order/log-out actions.

### What the extension stores, and where

| Data | Why | Where it stays | How long |
|---|---|---|---|
| Your settings (for example "Mirror clicks" on/off, "Show the button in every Split View") | To remember your preferences | `chrome.storage.local` on your device | Until you change them or remove the extension |
| Tab IDs, the origin of each pane (current and the pinned one from Start sync), scroll position, offset and ruler lines of each Split View pair | To keep a pair in sync, also after a reload | `chrome.storage.session` (in memory) | Cleared when the browser closes |
| The address a pane is being sent to by "Sync navigation" or the checklist | To prevent navigation loops | `chrome.storage.session` | About 1.5–3 seconds |
| Page checklists: the paths you add, the result (Good/Wrong/N/A) and your notes, per pair of sites | So you can continue checking later | `chrome.storage.local` on your device | Until you clear the list or remove the extension (max 50 lists) |
| Recent pairs: the site and path (no query string or `#` part) of both panes of pairs you started sync for, an optional name you give them | To reopen a pair with one click | `chrome.storage.local` on your device | Until you remove them, clear the history or turn off "Remember pairs" (max 20 recent and 30 favourites) |
| Overlay settings and the size of each pane | To show the overlay and the pane sizes | `chrome.storage.session` | Cleared when the browser closes |
| Pairs of sites you chose "Don't suggest for this pair again" for: the two origins (for example `https://example.com` and `https://staging.example.com`), no paths | So the sync suggestion stays away for that pair | `chrome.storage.local` on your device | Until you click "Suggest dismissed pairs again" or remove the extension (max 200 pairs) |

The status badge on the toolbar icon and the sync suggestion ("Start sync? example.com ↔ staging.example.com") are worked out inside your browser from the addresses of the two tabs; nothing about them leaves the browser and nothing is sent to either website.

Element descriptions, typed text, the mouse pointer position, overlay images and CSS values are passed directly between your two tabs inside the extension and are not stored. CSV exports of a checklist are only created when you click "Export CSV" and are saved where you choose.

### Permissions

- **Access to http and https sites**: needed because the panes of a Split View can show any website you choose. The extension only acts when a tab is part of a Split View pair.
- **scripting**: to start the sync script in tabs that were already open before the extension was installed or updated.
- **storage**: to save your settings, checklists, recent pairs and the state of each Split View pair, locally.
- **Access to all sites (optional, `<all_urls>`)**: only requested when you first turn on the overlay. Chrome only allows an extension to capture an image of a tab (`chrome.tabs.captureVisibleTab`) with this permission. You can withdraw it at any time in `chrome://extensions`; the overlay then switches off.

### Third parties

No data is sent to BijBijker or any other third party. Data only moves between the two websites you chose to sync, as described above. The only external link is the "Made by BijBijker" credit, which opens https://bijbijker.nl in a new tab when you click it.

### Contact

Questions about this policy: janwillem@bijbijker.nl or via https://bijbijker.nl.

---

## Nederlands

SplitScreen Browser Sync is een Chrome-extensie van BijBijker (https://bijbijker.nl). De extensie houdt de twee tabbladen (helften) van een Chrome Split View op dezelfde scrollpositie en kan navigatie, hover-effecten, je muiscursor en, als je dat aanzet, klikken en typen tussen beide spiegelen. Ze kan ook een afbeelding van de ene helft over de andere leggen, de CSS van overeenkomende elementen vergelijken, een checklist van pagina's bijhouden en paren van sites onthouden.

### Samenvatting

- **Er gaat niets vanuit je browser naar de ontwikkelaar.** Er is geen server, geen analytics, geen tracking, geen advertenties en geen externe code. BijBijker ontvangt geen gegevens.
- Om zijn werk te doen **geeft de extensie wel gegevens door van de ene helft naar de andere**, dus van de ene website naar de andere website in je Split View. Wat er wordt doorgegeven staat hieronder.
- Dat gebeurt **alleen tussen de twee sites waarvoor je de sync hebt gestart**. Bij Sync starten legt de extensie de site (origin, bijvoorbeeld `https://example.com` en `https://staging.example.com`) van beide helften vast. Opent een van de helften een andere site, dan pauzeert de sync tot je opnieuw op Sync starten klikt.

### Wat er tussen de twee helften wordt doorgegeven

De twee sites in een gesynchroniseerd paar kunnen het volgende te weten komen over wat je op de andere site doet, omdat de extensie het daar nabootst:

| Gegevens | Wanneer | Wat de andere site ziet |
|---|---|---|
| Scrollpositie (in pixels) | Zolang de sync aan staat | Ze scrolt naar dezelfde positie |
| Het pad, de querystring en het `#`-deel van het adres waar je naartoe navigeert (bijvoorbeeld `/contact/?x=1#form`) | Zolang de sync aan staat en "Navigatie synchroniseren" aan staat (standaard aan) | Ze opent hetzelfde pad op het eigen domein. Alles in het adres, zoals een zoekterm of een token in de querystring, komt dus bij de server van de andere site terecht |
| Een beschrijving van het element waar je overheen beweegt: tagnaam, id, `data-*`-attributen, `aria-label`/`name`, linkpad, een kort stukje zichtbare tekst en de positie van de muis | Zolang de sync aan staat en "Hover-effecten spiegelen" aan staat (standaard aan) | Het overeenkomende element krijgt hover-events, dus scripts op de andere pagina kunnen merken waar je naar wijst |
| De positie van je muisaanwijzer in de helft (viewport-coördinaten en de grootte van de helft, geen element of pagina-inhoud) en het moment waarop je klikt | Zolang de sync aan staat en "Muiscursor tonen" aan staat (standaard aan) | De extensie tekent een cursorpijl (en bij een klik een korte rimpeling) in de andere helft. Die staat in een afgeschermde laag die de pagina niet kan uitlezen; er wordt nooit iets mee aangeklikt |
| Dezelfde soort beschrijving van het element waarop je klikt of dat focus krijgt | Zolang de sync aan staat en "Klikken spiegelen" aan staat (standaard **uit**) | Op het overeenkomende element wordt geklikt of het krijgt focus, dus scripts op de andere pagina kunnen dat merken |
| Een beschrijving van het bovenste zichtbare element (zelfde soort als bij hover) en hoe ver je erin gescrold bent | Zolang de sync aan staat en "Uitlijning" op "Op element/inhoud" staat (standaard pixel-exact) | Ze scrolt het overeenkomende element naar dezelfde plek |
| Een beschrijving van een scrollgebied waarin je scrolt (modal, zijpaneel, lijst) en de scrollpositie | Zolang de sync aan staat en "Scrollgebieden synchroniseren" aan staat (standaard aan) | Het overeenkomende scrollgebied wordt gescrold |
| Het zoomniveau van de helft | Zolang de sync aan staat en "Zoom synchroniseren" aan staat (standaard aan) | De andere helft krijgt hetzelfde zoomniveau (Chrome bewaart zoom per site, dus andere tabbladen van die site volgen mee) |
| **Wat je typt** in een tekstveld, tekstvak of bewerkbaar gebied, en keuzes in selectievakjes, keuzerondjes en keuzelijsten, met een beschrijving van het veld | Zolang de sync aan staat en "Typen synchroniseren" aan staat (standaard **uit**) | Het overeenkomende veld krijgt dezelfde waarde, dus **de andere site ontvangt die tekst** en scripts daar kunnen hem lezen. Nooit wachtwoord-, eenmalige-code-, pincode- of betaalkaartvelden, verborgen velden of bestandsvelden, of velden waarvan de naam of het label gevoelig lijkt. Er wordt niets verstuurd |
| Een afbeelding (schermafbeelding) van het zichtbare deel van een helft | Alleen zolang je "Overlay" hebt aangezet | De afbeelding wordt over de andere helft getekend, in een afgeschermde laag die de pagina niet kan uitlezen |
| Berekende CSS-waarden (zoals lettertype, grootte, kleuren, ruimte) en de afmeting van het element onder je muis, met een beschrijving van dat element | Alleen zolang "Verschillen inspecteren" aan staat | Het overeenkomende element wordt omlijnd en de eigen CSS-waarden worden teruggestuurd om te vergelijken |

De extensie leest nooit wat je in formuliervelden typt, tenzij je "Typen synchroniseren" aanzet, leest nooit de inhoud van wachtwoord-, eenmalige-code-, pincode- of betaalkaartvelden en spiegelt daar nooit klikken of focus op. Een klik op een verzendknop, in een formulier dat gegevens verstuurt, of op acties als verwijderen, betalen, bevestigen, kopen, bestellen of uitloggen wordt nooit herhaald.

### Wat de extensie opslaat, en waar

| Gegevens | Waarom | Waar | Hoe lang |
|---|---|---|---|
| Je instellingen (bijvoorbeeld "Klikken spiegelen" aan/uit, "Tonen in elke Split View") | Om je voorkeuren te onthouden | `chrome.storage.local` op je apparaat | Tot je ze wijzigt of de extensie verwijdert |
| Tabblad-ID's, de origin van elke helft (de huidige en de bij Sync starten vastgelegde), scrollpositie, offset en linialen van elk Split View-paar | Om een paar gesynchroniseerd te houden, ook na herladen | `chrome.storage.session` (in het geheugen) | Gewist zodra de browser sluit |
| Het adres waar "Navigatie synchroniseren" of de checklist een helft naartoe stuurt | Om navigatielussen te voorkomen | `chrome.storage.session` | Ongeveer 1,5–3 seconden |
| Checklists: de paden die je toevoegt, het resultaat (Goed/Fout/N.v.t.) en je notities, per paar sites | Zodat je later verder kunt controleren | `chrome.storage.local` op je apparaat | Tot je de lijst wist of de extensie verwijdert (max. 50 lijsten) |
| Recente paren: de site en het pad (zonder querystring of `#`-deel) van beide helften van paren waarvoor je de sync startte, en een eventuele naam die je ze geeft | Om een paar met één klik opnieuw te openen | `chrome.storage.local` op je apparaat | Tot je ze verwijdert, de geschiedenis wist of "Paren onthouden" uitzet (max. 20 recente en 30 favorieten) |
| Overlay-instellingen en de afmeting van elke helft | Om de overlay en de afmetingen te tonen | `chrome.storage.session` | Gewist zodra de browser sluit |
| Paren van sites waarvoor je "Niet meer voorstellen voor dit paar" koos: de twee origins (bijvoorbeeld `https://example.com` en `https://staging.example.com`), geen paden | Zodat het sync-voorstel voor dat paar wegblijft | `chrome.storage.local` op je apparaat | Tot je op "Weggeklikte paren weer voorstellen" klikt of de extensie verwijdert (max. 200 paren) |

De status op het extensie-icoon in de werkbalk en het sync-voorstel ("Sync starten? example.com ↔ staging.example.com") worden in je browser bepaald aan de hand van de adressen van de twee tabbladen; daarover verlaat niets de browser en er gaat niets naar een van de websites.

Elementbeschrijvingen, getypte tekst, de positie van de muisaanwijzer, overlay-afbeeldingen en CSS-waarden worden binnen de extensie rechtstreeks tussen je twee tabbladen doorgegeven en niet opgeslagen. Een CSV-export van een checklist ontstaat alleen als je op "CSV exporteren" klikt en wordt opgeslagen waar jij kiest.

### Machtigingen

- **Toegang tot http- en https-sites**: nodig omdat de helften van een Split View elke website kunnen tonen die je kiest. De extensie doet alleen iets als een tabblad deel uitmaakt van een Split View-paar.
- **scripting**: om het sync-script te starten in tabbladen die al open waren voordat de extensie werd geïnstalleerd of bijgewerkt.
- **storage**: om je instellingen, checklists, recente paren en de status van elk Split View-paar lokaal op te slaan.
- **Toegang tot alle sites (optioneel, `<all_urls>`)**: wordt pas gevraagd als je de overlay voor het eerst aanzet. Chrome staat een extensie alleen met deze toestemming toe een afbeelding van een tabblad te maken (`chrome.tabs.captureVisibleTab`). Je kunt hem altijd intrekken via `chrome://extensions`; de overlay gaat dan uit.

### Derden

Er worden geen gegevens naar BijBijker of andere derden gestuurd. Gegevens gaan alleen tussen de twee websites die je zelf hebt gekoppeld, zoals hierboven beschreven. De enige externe link is de vermelding "Gemaakt door BijBijker", die https://bijbijker.nl in een nieuw tabblad opent als je erop klikt.

### Contact

Vragen over dit beleid: janwillem@bijbijker.nl of via https://bijbijker.nl.
