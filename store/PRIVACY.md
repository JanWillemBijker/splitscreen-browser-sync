# Privacy policy – SplitScreen Browser Sync

Last updated: 12 November 2026 · Version 1.1.0

[English](#english) · [Nederlands](#nederlands)

---

## English

SplitScreen Browser Sync is a Chrome extension made by BijBijker (https://bijbijker.nl). It keeps the two tabs (panes) of a Chrome Split View scrolled to the same position and can mirror navigation, hover effects and, if you turn it on, clicks between them.

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
| The same kind of description of the element you click or focus | While sync is on and "Mirror clicks" is on (default **off**) | The matching element is clicked or focused, so the other page's scripts can notice it |

The extension never reads what you type into form fields, never reads the contents of password, one-time-code, PIN or payment card fields, and never mirrors clicks or focus on them. It never replays a click on a submit button, inside a form that posts data, or on delete/pay/confirm/buy/order/log-out actions.

### What the extension stores, and where

| Data | Why | Where it stays | How long |
|---|---|---|---|
| Your settings (for example "Mirror clicks" on/off, "Show the button in every Split View") | To remember your preferences | `chrome.storage.local` on your device | Until you change them or remove the extension |
| Tab IDs, the origin of each pane (current and the pinned one from Start sync), scroll position, offset and ruler lines of each Split View pair | To keep a pair in sync, also after a reload | `chrome.storage.session` (in memory) | Cleared when the browser closes |
| The address a pane is being sent to by "Sync navigation" | To prevent navigation loops | `chrome.storage.session` | About 1.5 seconds |

Element descriptions for clicks and hover are passed directly between your two tabs inside the extension and are not stored.

### Permissions

- **Access to http and https sites**: needed because the panes of a Split View can show any website you choose. The extension only acts when a tab is part of a Split View pair.
- **scripting**: to start the sync script in tabs that were already open before the extension was installed or updated.
- **storage**: to save your settings and the state of each Split View pair, locally.

### Third parties

No data is sent to BijBijker or any other third party. Data only moves between the two websites you chose to sync, as described above. The only external link is the "Made by BijBijker" credit, which opens https://bijbijker.nl in a new tab when you click it.

### Contact

Questions about this policy: via https://bijbijker.nl.

---

## Nederlands

SplitScreen Browser Sync is een Chrome-extensie van BijBijker (https://bijbijker.nl). De extensie houdt de twee tabbladen (helften) van een Chrome Split View op dezelfde scrollpositie en kan navigatie, hover-effecten en, als je dat aanzet, klikken tussen beide spiegelen.

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
| Dezelfde soort beschrijving van het element waarop je klikt of dat focus krijgt | Zolang de sync aan staat en "Klikken spiegelen" aan staat (standaard **uit**) | Op het overeenkomende element wordt geklikt of het krijgt focus, dus scripts op de andere pagina kunnen dat merken |

De extensie leest nooit wat je in formuliervelden typt, leest nooit de inhoud van wachtwoord-, eenmalige-code-, pincode- of betaalkaartvelden en spiegelt daar nooit klikken of focus op. Een klik op een verzendknop, in een formulier dat gegevens verstuurt, of op acties als verwijderen, betalen, bevestigen, kopen, bestellen of uitloggen wordt nooit herhaald.

### Wat de extensie opslaat, en waar

| Gegevens | Waarom | Waar | Hoe lang |
|---|---|---|---|
| Je instellingen (bijvoorbeeld "Klikken spiegelen" aan/uit, "Tonen in elke Split View") | Om je voorkeuren te onthouden | `chrome.storage.local` op je apparaat | Tot je ze wijzigt of de extensie verwijdert |
| Tabblad-ID's, de origin van elke helft (de huidige en de bij Sync starten vastgelegde), scrollpositie, offset en linialen van elk Split View-paar | Om een paar gesynchroniseerd te houden, ook na herladen | `chrome.storage.session` (in het geheugen) | Gewist zodra de browser sluit |
| Het adres waar "Navigatie synchroniseren" een helft naartoe stuurt | Om navigatielussen te voorkomen | `chrome.storage.session` | Ongeveer 1,5 seconde |

Elementbeschrijvingen voor klikken en hover worden binnen de extensie rechtstreeks tussen je twee tabbladen doorgegeven en niet opgeslagen.

### Machtigingen

- **Toegang tot http- en https-sites**: nodig omdat de helften van een Split View elke website kunnen tonen die je kiest. De extensie doet alleen iets als een tabblad deel uitmaakt van een Split View-paar.
- **scripting**: om het sync-script te starten in tabbladen die al open waren voordat de extensie werd geïnstalleerd of bijgewerkt.
- **storage**: om je instellingen en de status van elk Split View-paar lokaal op te slaan.

### Derden

Er worden geen gegevens naar BijBijker of andere derden gestuurd. Gegevens gaan alleen tussen de twee websites die je zelf hebt gekoppeld, zoals hierboven beschreven. De enige externe link is de vermelding "Gemaakt door BijBijker", die https://bijbijker.nl in een nieuw tabblad opent als je erop klikt.

### Contact

Vragen over dit beleid: via https://bijbijker.nl.
