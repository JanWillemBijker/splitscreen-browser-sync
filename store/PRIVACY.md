# Privacy policy – SplitScreen Browser Sync

Last updated: 12 November 2026 · Version 1.1.0

[English](#english) · [Nederlands](#nederlands)

---

## English

SplitScreen Browser Sync is a Chrome extension made by BijBijker (https://bijbijker.nl). It keeps the two tabs of a Chrome Split View scrolled to the same position and can optionally mirror clicks, hover effects and navigation between them.

### Summary

- The extension does **not collect, sell, share or transmit** any personal data or browsing data.
- It has **no server**, no analytics, no tracking, no advertising and no remote code.
- Everything it does happens locally in your browser.

### What the extension handles, and where it stays

| Data | Why | Where it stays | How long |
|---|---|---|---|
| Your settings (for example "Mirror clicks" on/off, "Show the button in every Split View") | To remember your preferences | `chrome.storage.local` on your device | Until you change them or remove the extension |
| Tab IDs, the domain (origin) of each pane, scroll position, offset and ruler lines of each Split View pair | To keep a pair in sync, also after a reload | `chrome.storage.session` (in memory) | Cleared when the browser closes |
| The address of a page you navigate to, when "Sync navigation" is on | To open the same path in the other pane | Passed to the other pane; briefly kept in session memory to prevent loops | About 1.5 seconds |
| A description of the element you click or hover (tag name, id, visible label or link path) when "Mirror clicks" or "Mirror hover effects" is on | To find the matching element in the other pane | Passed directly between your two tabs inside the extension | Not stored |

The extension never reads the contents of password fields, one-time codes or payment card fields, and never mirrors clicks or focus on them. It never reads what you type into any form field.

### Permissions

- **Access to http and https sites**: needed because the panes of a Split View can show any website you choose. The extension only acts when a tab is part of a Split View pair.
- **scripting**: to start the sync script in tabs that were already open before the extension was installed or updated.
- **storage**: to save your settings and the state of each Split View pair, locally.

### Third parties

No data is shared with BijBijker or anyone else. The only external link is the "Made by BijBijker" credit, which opens https://bijbijker.nl in a new tab when you click it.

### Contact

Questions about this policy: via https://bijbijker.nl.

---

## Nederlands

SplitScreen Browser Sync is een Chrome-extensie van BijBijker (https://bijbijker.nl). De extensie houdt de twee tabbladen van een Chrome Split View op dezelfde scrollpositie en kan desgewenst klikken, hover-effecten en navigatie tussen beide spiegelen.

### Samenvatting

- De extensie **verzamelt, verkoopt, deelt en verstuurt geen** persoonsgegevens of surfgegevens.
- Er is **geen server**, geen analytics, geen tracking, geen advertenties en geen externe code.
- Alles gebeurt lokaal in je browser.

### Welke gegevens de extensie gebruikt, en waar ze blijven

| Gegevens | Waarom | Waar | Hoe lang |
|---|---|---|---|
| Je instellingen (bijvoorbeeld "Klikken spiegelen" aan/uit, "Tonen in elke Split View") | Om je voorkeuren te onthouden | `chrome.storage.local` op je apparaat | Tot je ze wijzigt of de extensie verwijdert |
| Tabblad-ID's, het domein (origin) van elke helft, scrollpositie, offset en linialen van elk Split View-paar | Om een paar gesynchroniseerd te houden, ook na herladen | `chrome.storage.session` (in het geheugen) | Gewist zodra de browser sluit |
| Het adres van een pagina waar je naartoe navigeert, als "Navigatie synchroniseren" aan staat | Om hetzelfde pad in de andere helft te openen | Doorgegeven aan de andere helft; kort in het sessiegeheugen bewaard om lussen te voorkomen | Ongeveer 1,5 seconde |
| Een beschrijving van het element waarop je klikt of hovert (tagnaam, id, zichtbaar label of linkpad) als "Klikken spiegelen" of "Hover-effecten spiegelen" aan staat | Om het overeenkomende element in de andere helft te vinden | Rechtstreeks tussen je twee tabbladen doorgegeven, binnen de extensie | Niet opgeslagen |

De extensie leest nooit de inhoud van wachtwoordvelden, eenmalige codes of betaalkaartvelden, en spiegelt daar nooit klikken of focus op. De extensie leest nooit wat je in een formulierveld typt.

### Machtigingen

- **Toegang tot http- en https-sites**: nodig omdat de helften van een Split View elke website kunnen tonen die je kiest. De extensie doet alleen iets als een tabblad deel uitmaakt van een Split View-paar.
- **scripting**: om het sync-script te starten in tabbladen die al open waren voordat de extensie werd geïnstalleerd of bijgewerkt.
- **storage**: om je instellingen en de status van elk Split View-paar lokaal op te slaan.

### Derden

Er worden geen gegevens gedeeld met BijBijker of wie dan ook. De enige externe link is de vermelding "Gemaakt door BijBijker", die https://bijbijker.nl in een nieuw tabblad opent als je erop klikt.

### Contact

Vragen over dit beleid: via https://bijbijker.nl.
