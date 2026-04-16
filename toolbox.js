// Hilfsfunktionen für die Zeitberechnung (hh:mm -> Minuten und zurück)
function timeToMins(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  if (parts.length !== 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function minsToTime(mins) {
  if (isNaN(mins) || mins < 0) return "0:00";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

// Rechner aktualisieren
function updateTimeCalc() {
  const val1 = timeToMins(document.getElementById("time-val1").value);
  const val2 = timeToMins(document.getElementById("time-val2").value);
  document.getElementById("time-result").value = minsToTime(val1 + val2);
}

function updateLandCalc() {
  const val1 = parseInt(document.getElementById("land-val1").value, 10) || 0;
  const val2 = parseInt(document.getElementById("land-val2").value, 10) || 0;
  document.getElementById("land-result").value = val1 + val2;
}

// Event-Listener für manuelle Änderungen
document.getElementById("time-val1").addEventListener("input", updateTimeCalc);
document.getElementById("time-val2").addEventListener("input", updateTimeCalc);
document.getElementById("land-val1").addEventListener("input", updateLandCalc);
document.getElementById("land-val2").addEventListener("input", updateLandCalc);

function showError(msg) {
  const status = document.getElementById("status");
  status.innerText = msg;
  status.style.display = "block";
}

// Datenextraktion
function getSelectedRowData() {
  try {
    // 1. Header finden und Indizes mappen
    const headerCells = document.querySelectorAll("thead th");
    if (!headerCells.length)
      return { error: "Tabellen-Header nicht gefunden." };

    let colMap = {
      landungen: -1,
      flugzeit: -1,
      gesamtLandungen: -1,
      gesamtBetriebszeit: -1,
    };

    headerCells.forEach((th, index) => {
      const text = th.innerText.replace(/\s+/g, " ").trim();

      if (text === "Landungen") colMap.landungen = index;
      if (text === "Flugzeit in hh:mm") colMap.flugzeit = index;
      if (text === "Gesamt Landungen") colMap.gesamtLandungen = index;
      if (text === "Gesamt Betriebszeit") colMap.gesamtBetriebszeit = index;
    });

    // alle benötigten Spalten da?
    if (Object.values(colMap).some((idx) => idx === -1)) {
      return { error: "Spalten im Header nicht eindeutig erkannt." };
    }

    // 2. Markierte Zeile finden
    const selectedRow = document.querySelector("tr.selected");
    if (!selectedRow)
      return { error: "Keine Zeile ausgewählt. Bitte klicke eine Zeile an." };

    const cells = selectedRow.querySelectorAll("td");

    return {
      currentLandings:
        parseInt(cells[colMap.landungen].innerText.trim(), 10) || 0,
      currentFlightTime: cells[colMap.flugzeit].innerText.trim(),
      totalLandings:
        parseInt(cells[colMap.gesamtLandungen].innerText.trim(), 10) || 0,
      totalFlightTime: cells[colMap.gesamtBetriebszeit].innerText.trim(),
    };
  } catch (e) {
    return { error: "Fehler beim Lesen der Daten: " + e.toString() };
  }
}

// Beim Öffnen des Popups das Skript im Tab ausführen
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (
      !tab ||
      !tab.url ||
      !tab.url.includes("vereinsflieger.de/member/community/logbook")
    ) {
      showError("Bitte auf der Vereinsflieger.de Bordbuch-Seite nutzen.");
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: getSelectedRowData,
      },
      (injectionResults) => {
        if (chrome.runtime.lastError) {
          showError("Zugriffsfehler: " + chrome.runtime.lastError.message);
          return;
        }

        const data = injectionResults[0].result;
        if (!data) return;
        if (data.error) {
          showError(data.error);
          return;
        }

        // Zeiten eintragen
        const currentMins = timeToMins(data.currentFlightTime);
        const totalMins = timeToMins(data.totalFlightTime);
        const baseMins = totalMins - currentMins;

        document.getElementById("time-val1").value = minsToTime(baseMins);
        document.getElementById("time-val2").value = data.currentFlightTime;
        updateTimeCalc();

        // Landungen eintragen
        const baseLandings = data.totalLandings - data.currentLandings;
        document.getElementById("land-val1").value = baseLandings;
        document.getElementById("land-val2").value = data.currentLandings;
        updateLandCalc();

        // Status ausblenden wenn erfolgreich
        document.getElementById("status").style.display = "none";
      },
    );
  } catch (error) {
    showError("Ein unerwarteter Fehler ist aufgetreten.");
    console.error(error);
  }
});
