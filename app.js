const WIEN_CONSTANT = 2.898e-3;
const PLANCK_H = 6.62607015e-34;
const LIGHT_C = 2.99792458e8;
const BOLTZMANN_K = 1.380649e-23;
const MIN_WAVELENGTH_NM = 100;
const MAX_WAVELENGTH_NM = 3000;
const POINT_COUNT = 520;
const PLACEHOLDER = "\u2014";
const MIN_OBJECTS_FOR_PDF = 5;
const REPORT_TITLE = "Wien's Law Blackbody Investigation";
const SUN_EXAMPLE = {
  name: "Sun",
  temperature: 5778,
  info: "The Sun is a G-type main-sequence star and behaves approximately like a blackbody photosphere."
};

const elements = {
  objectName: document.getElementById("object-name"),
  temperatureInput: document.getElementById("temperature-input"),
  objectInfo: document.getElementById("object-info"),
  calculateBtn: document.getElementById("calculate-btn"),
  newEntryBtn: document.getElementById("new-entry-btn"),
  sunExampleBtn: document.getElementById("sun-example-btn"),
  resetBtn: document.getElementById("reset-btn"),
  addResultBtn: document.getElementById("add-result-btn"),
  downloadPdfBtn: document.getElementById("download-pdf-btn"),
  statusMessage: document.getElementById("status-message"),
  resultObject: document.getElementById("result-object"),
  resultTemperature: document.getElementById("result-temperature"),
  resultLambda: document.getElementById("result-lambda"),
  resultRegion: document.getElementById("result-region"),
  resultInfo: document.getElementById("result-info"),
  graphCaption: document.getElementById("graph-caption"),
  plot: document.getElementById("blackbody-plot"),
  tableBody: document.getElementById("results-table-body"),
  tableCount: document.getElementById("table-count"),
  progressNote: document.getElementById("progress-note"),
  exportPlot: document.getElementById("pdf-export-plot")
};

const state = {
  tableEntries: [],
  currentResult: null,
  plotReady: false,
  exportInProgress: false
};

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeFileName(value) {
  return String(value || "wien-report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "wien-report";
}

function waitForNextFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function truncatePdfLines(doc, text, width, maxLines) {
  const lines = doc.splitTextToSize(text, width);
  if (lines.length <= maxLines) {
    return lines;
  }

  const trimmed = lines.slice(0, maxLines);
  trimmed[maxLines - 1] = `${String(trimmed[maxLines - 1]).replace(/\s+$/, "")}...`;
  return trimmed;
}

function drawMissingGraphPlaceholder(doc) {
  doc.setDrawColor(84, 215, 255);
  doc.setFillColor(9, 21, 38);
  doc.roundedRect(16, 102, 178, 100, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(237, 245, 255);
  doc.text("Graph could not be rendered", 105, 146, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(167, 189, 217);
  doc.text("The object data was exported without the graph image.", 105, 155, { align: "center" });
}

function plotlyAvailable() {
  return typeof window.Plotly !== "undefined";
}

function pdfAvailable() {
  return Boolean(window.jspdf?.jsPDF);
}

function canvasAvailable() {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext && canvas.getContext("2d"));
}

function getTodayIsoDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

function formatDisplayDate(isoDate) {
  if (!isoDate) {
    return PLACEHOLDER;
  }

  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function parseTemperature(inputValue) {
  const parsed = Number.parseFloat(String(inputValue).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function classifyRadiation(lambdaNm) {
  if (lambdaNm < 380) {
    return "Ultraviolet";
  }
  if (lambdaNm <= 750) {
    return "Visible Light";
  }
  return "Infrared";
}

function wavelengthToRgb(wavelengthNm, alpha = 0.18) {
  let red = 0;
  let green = 0;
  let blue = 0;

  if (wavelengthNm >= 380 && wavelengthNm < 440) {
    red = -(wavelengthNm - 440) / (440 - 380);
    blue = 1;
  } else if (wavelengthNm < 490) {
    green = (wavelengthNm - 440) / (490 - 440);
    blue = 1;
  } else if (wavelengthNm < 510) {
    green = 1;
    blue = -(wavelengthNm - 510) / (510 - 490);
  } else if (wavelengthNm < 580) {
    red = (wavelengthNm - 510) / (580 - 510);
    green = 1;
  } else if (wavelengthNm < 645) {
    red = 1;
    green = -(wavelengthNm - 645) / (645 - 580);
  } else if (wavelengthNm <= 780) {
    red = 1;
  }

  let factor = 0;
  if (wavelengthNm >= 380 && wavelengthNm < 420) {
    factor = 0.3 + (0.7 * (wavelengthNm - 380)) / 40;
  } else if (wavelengthNm <= 700) {
    factor = 1;
  } else if (wavelengthNm <= 780) {
    factor = 0.3 + (0.7 * (780 - wavelengthNm)) / 80;
  }

  const applyGamma = (channel) => Math.round(255 * Math.pow(Math.max(channel * factor, 0), 0.8));
  return `rgba(${applyGamma(red)}, ${applyGamma(green)}, ${applyGamma(blue)}, ${alpha})`;
}

function buildVisibleBandShapes() {
  const shapes = [];

  for (let nm = 380; nm < 750; nm += 10) {
    shapes.push({
      type: "rect",
      xref: "x",
      yref: "paper",
      x0: nm,
      x1: Math.min(nm + 10, 750),
      y0: 0,
      y1: 1,
      fillcolor: wavelengthToRgb(nm + 5, 0.16),
      line: { width: 0 },
      layer: "below"
    });
  }

  return shapes;
}

function planckRadiance(wavelengthMeters, temperatureK) {
  const exponent = (PLANCK_H * LIGHT_C) / (wavelengthMeters * BOLTZMANN_K * temperatureK);
  if (exponent > 700) {
    return 0;
  }

  const numerator = 2 * PLANCK_H * Math.pow(LIGHT_C, 2);
  const denominator = Math.pow(wavelengthMeters, 5) * (Math.exp(exponent) - 1);
  return numerator / denominator;
}

function createSpectrumData(temperatureK) {
  const wavelengthsNm = [];
  const rawIntensities = [];
  const step = (MAX_WAVELENGTH_NM - MIN_WAVELENGTH_NM) / (POINT_COUNT - 1);

  for (let index = 0; index < POINT_COUNT; index += 1) {
    const wavelengthNm = MIN_WAVELENGTH_NM + step * index;
    const wavelengthM = wavelengthNm * 1e-9;
    wavelengthsNm.push(wavelengthNm);
    rawIntensities.push(planckRadiance(wavelengthM, temperatureK));
  }

  const peak = Math.max(...rawIntensities);
  const normalized = rawIntensities.map((value) => value / peak);

  return {
    wavelengthsNm,
    intensities: normalized
  };
}

function wavelengthToCanvasX(value, min, max, width, paddingLeft, paddingRight) {
  return paddingLeft + ((value - min) / (max - min)) * (width - paddingLeft - paddingRight);
}

function intensityToCanvasY(value, height, paddingTop, paddingBottom) {
  return height - paddingBottom - value * (height - paddingTop - paddingBottom);
}

function createBaseLayout(options = {}) {
  const forExport = options.forExport === true;

  return {
    paper_bgcolor: "rgba(0, 0, 0, 0)",
    plot_bgcolor: "rgba(4, 11, 21, 0.86)",
    margin: {
      l: forExport ? 90 : 72,
      r: forExport ? 52 : 26,
      t: forExport ? 70 : 38,
      b: forExport ? 70 : 60
    },
    xaxis: {
      title: { text: "Wavelength (nm)" },
      range: [MIN_WAVELENGTH_NM, MAX_WAVELENGTH_NM],
      tick0: 0,
      dtick: 250,
      gridcolor: "rgba(155, 202, 255, 0.10)",
      zeroline: false,
      color: "#d8e7f9",
      fixedrange: true
    },
    yaxis: {
      title: { text: "Relative Intensity" },
      range: [0, 1.08],
      dtick: 0.2,
      gridcolor: "rgba(155, 202, 255, 0.10)",
      zeroline: false,
      color: "#d8e7f9",
      fixedrange: true
    },
    showlegend: false,
    hovermode: "x unified",
    annotations: [],
    shapes: buildVisibleBandShapes(),
    width: forExport ? 1200 : undefined,
    height: forExport ? 760 : undefined
  };
}

function createEmptyTraces() {
  return [
    {
      x: [],
      y: [],
      mode: "lines",
      line: {
        color: "rgba(84, 215, 255, 0.18)",
        width: 12
      },
      hoverinfo: "skip"
    },
    {
      x: [],
      y: [],
      mode: "lines",
      line: {
        color: "#54d7ff",
        width: 3.5
      },
      hoverinfo: "skip"
    },
    {
      x: [],
      y: [],
      mode: "markers+text",
      marker: {
        size: 10,
        color: "#ff9b4d",
        line: {
          width: 2,
          color: "rgba(255, 255, 255, 0.65)"
        }
      },
      text: [],
      textposition: "top center",
      textfont: {
        color: "#ffd4b1",
        size: 12
      },
      hoverinfo: "skip"
    }
  ];
}

function renderPlotFallback(message) {
  elements.plot.classList.add("plot-fallback");
  elements.plot.textContent = message;
}

function getPlotPayload(result, options = {}) {
  const layout = createBaseLayout(options);
  const data = createEmptyTraces();

  if (!result) {
    layout.annotations = [
      {
        x: 1550,
        y: 0.55,
        xref: "x",
        yref: "y",
        text: "Blank graph state<br>Calculate a temperature to begin.",
        showarrow: false,
        font: {
          color: "#a7bdd9",
          size: 16
        },
        align: "center"
      }
    ];

    return { data, layout };
  }

  const spectrum = createSpectrumData(result.temperature);
  const peakY = 1;

  data[0].x = spectrum.wavelengthsNm;
  data[0].y = spectrum.intensities;

  data[1].x = spectrum.wavelengthsNm;
  data[1].y = spectrum.intensities;
  data[1].hovertemplate = "Wavelength: %{x:.0f} nm<br>Relative intensity: %{y:.3f}<extra></extra>";

  if (result.lambdaOnChart) {
    data[2].x = [result.lambdaNm];
    data[2].y = [peakY];
    data[2].text = [`&lambda;<sub>max</sub> = ${formatNumber(result.lambdaNm, 0)} nm`];

    layout.shapes.push({
      type: "line",
      xref: "x",
      yref: "y",
      x0: result.lambdaNm,
      x1: result.lambdaNm,
      y0: 0,
      y1: peakY,
      line: {
        color: "#ff9b4d",
        width: 2.5,
        dash: "dash"
      }
    });
  } else {
    const edgeX = result.lambdaNm < MIN_WAVELENGTH_NM ? MIN_WAVELENGTH_NM + 60 : MAX_WAVELENGTH_NM - 180;
    layout.annotations.push({
      x: edgeX,
      y: 0.96,
      xref: "x",
      yref: "y",
      text: `&lambda;<sub>max</sub> = ${formatNumber(result.lambdaNm, 0)} nm<br>outside chart range`,
      showarrow: false,
      align: "center",
      font: {
        color: "#ffd4b1",
        size: 13
      },
      bgcolor: "rgba(255, 155, 77, 0.10)",
      bordercolor: "rgba(255, 155, 77, 0.24)",
      borderwidth: 1,
      borderpad: 8
    });
  }

  layout.annotations.push({
    x: 0.01,
    y: 1.11,
    xref: "paper",
    yref: "paper",
    text: `${result.objectName} | T = ${formatNumber(result.temperature, result.temperature % 1 === 0 ? 0 : 2)} K`,
    showarrow: false,
    xanchor: "left",
    font: {
      color: "#edf5ff",
      size: 14
    }
  });

  return { data, layout };
}

function renderInitialPlot() {
  if (!plotlyAvailable()) {
    renderPlotFallback("Plotly could not be loaded. Check the internet connection and reload the page.");
    updateStatus("Graph library unavailable. The calculations still work, but the plot cannot be rendered.", "error");
    return;
  }

  elements.plot.classList.remove("plot-fallback");
  elements.plot.textContent = "";
  const { data, layout } = getPlotPayload(null);

  Plotly.newPlot(elements.plot, data, layout, {
    responsive: true,
    displayModeBar: false
  }).then(() => {
    state.plotReady = true;
    if (state.currentResult) {
      updatePlot(state.currentResult);
    }
  });
}

function updateStatus(message, tone = "neutral") {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.remove("error", "success");
  if (tone === "error" || tone === "success") {
    elements.statusMessage.classList.add(tone);
  }
}

function updateResultTiles(result) {
  if (!result) {
    elements.resultObject.textContent = PLACEHOLDER;
    elements.resultTemperature.textContent = PLACEHOLDER;
    elements.resultLambda.textContent = PLACEHOLDER;
    elements.resultRegion.textContent = PLACEHOLDER;
    elements.resultInfo.textContent = PLACEHOLDER;
    elements.addResultBtn.disabled = true;
    return;
  }

  elements.resultObject.textContent = result.objectName;
  elements.resultTemperature.textContent = `${formatNumber(result.temperature, result.temperature % 1 === 0 ? 0 : 2)} K`;
  elements.resultLambda.textContent = `${formatNumber(result.lambdaNm, 0)} nm`;
  elements.resultRegion.textContent = result.radiationType;
  elements.resultInfo.textContent = result.objectInfo || PLACEHOLDER;
  elements.addResultBtn.disabled = false;
}

function setGraphCaption(result) {
  if (!result) {
    elements.graphCaption.textContent = "Enter an object and its temperature to draw the Planck distribution.";
    return;
  }

  if (result.lambdaOnChart) {
    elements.graphCaption.textContent = `${result.objectName}: peak emission at ${formatNumber(result.lambdaNm, 0)} nm in the ${result.radiationType.toLowerCase()} range.`;
    return;
  }

  elements.graphCaption.textContent = `${result.objectName}: the peak wavelength is ${formatNumber(result.lambdaNm, 0)} nm, which lies outside the plotted 100-3000 nm window.`;
}

function updatePlot(result) {
  if (!plotlyAvailable() || !state.plotReady) {
    return;
  }

  const { data, layout } = getPlotPayload(result);
  Plotly.animate(
    elements.plot,
    { data, layout },
    {
      transition: {
        duration: 550,
        easing: "cubic-in-out"
      },
      frame: {
        duration: 550,
        redraw: true
      },
      mode: "immediate"
    }
  );
}

function calculateResult() {
  const objectName = elements.objectName.value.trim();
  const temperature = parseTemperature(elements.temperatureInput.value);
  const objectInfo = elements.objectInfo.value.trim();

  if (!objectName) {
    state.currentResult = null;
    updateResultTiles(null);
    updatePlot(null);
    setGraphCaption(null);
    updateStatus("Enter an object name before calculating.", "error");
    return;
  }

  if (!temperature) {
    state.currentResult = null;
    updateResultTiles(null);
    updatePlot(null);
    setGraphCaption(null);
    updateStatus("Enter a temperature greater than 0 Kelvin.", "error");
    return;
  }

  const lambdaNm = (WIEN_CONSTANT / temperature) * 1e9;
  const result = {
    objectName,
    temperature,
    objectInfo,
    lambdaNm,
    radiationType: classifyRadiation(lambdaNm),
    lambdaOnChart: lambdaNm >= MIN_WAVELENGTH_NM && lambdaNm <= MAX_WAVELENGTH_NM
  };

  state.currentResult = result;
  updateResultTiles(result);
  updatePlot(result);
  setGraphCaption(result);
  updateStatus("Calculation complete. Review the graph and save the object to the table.", "success");
}

function loadExample(example) {
  elements.objectName.value = example.name;
  elements.temperatureInput.value = example.temperature;
  elements.objectInfo.value = example.info || "";
  calculateResult();
}

function renderTable() {
  if (state.tableEntries.length === 0) {
    elements.tableBody.innerHTML = '<tr class="empty-row"><td colspan="5">No investigation entries yet.</td></tr>';
    elements.tableCount.textContent = "0 recorded";
    elements.progressNote.textContent = "Add at least 5 objects to unlock PDF export.";
    elements.downloadPdfBtn.disabled = true;
    elements.downloadPdfBtn.textContent = "Add 5 objects to enable PDF";
    return;
  }

  elements.tableBody.innerHTML = state.tableEntries
    .map((entry) => {
      return `
        <tr>
          <td>${escapeHtml(entry.objectName)}</td>
          <td>${formatNumber(entry.temperature, entry.temperature % 1 === 0 ? 0 : 2)}</td>
          <td>${escapeHtml(entry.objectInfo || PLACEHOLDER)}</td>
          <td>${formatNumber(entry.lambdaNm, 0)}</td>
          <td>${escapeHtml(entry.radiationType)}</td>
        </tr>
      `;
    })
    .join("");

  elements.tableCount.textContent = `${state.tableEntries.length} recorded`;

  const remaining = Math.max(0, MIN_OBJECTS_FOR_PDF - state.tableEntries.length);
  elements.progressNote.textContent =
    remaining === 0
      ? "Minimum complete. The PDF report is ready to download."
      : `Add ${remaining} more object${remaining === 1 ? "" : "s"} to unlock PDF export.`;

  elements.downloadPdfBtn.disabled = remaining !== 0 || state.exportInProgress;
  elements.downloadPdfBtn.textContent =
    state.exportInProgress
      ? "Building PDF..."
      : remaining === 0
        ? "Download PDF Report"
        : `Add ${remaining} more object${remaining === 1 ? "" : "s"}`;
}

function clearCurrentEntry() {
  elements.objectName.value = "";
  elements.temperatureInput.value = "";
  elements.objectInfo.value = "";
  state.currentResult = null;
  updateResultTiles(null);
  updatePlot(null);
  setGraphCaption(null);
  elements.objectName.focus();
}

function addCurrentResult() {
  if (!state.currentResult) {
    updateStatus("Calculate a result before adding it to the investigation table.", "error");
    return;
  }

  const duplicateIndex = state.tableEntries.findIndex((entry) => {
    return entry.objectName.toLowerCase() === state.currentResult.objectName.toLowerCase();
  });

  if (duplicateIndex >= 0) {
    state.tableEntries.splice(duplicateIndex, 1);
  }

  state.tableEntries.push({ ...state.currentResult });
  renderTable();
  clearCurrentEntry();
  updateStatus("Result saved. A new object space is ready for the next entry.", "success");
}

function resetSimulation() {
  clearCurrentEntry();
  state.currentResult = null;
  state.tableEntries = [];
  renderTable();
  updateStatus("Simulation cleared. The explorer is back in its blank state.");
}

async function createGraphImage(result) {
  if (!canvasAvailable()) {
    throw new Error("Canvas rendering is not available in this browser.");
  }

  const width = 1000;
  const height = 620;
  const paddingLeft = 88;
  const paddingRight = 36;
  const paddingTop = 56;
  const paddingBottom = 72;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas context could not be created.");
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#07111f");
  gradient.addColorStop(1, "#030914");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(155, 202, 255, 0.10)";
  ctx.lineWidth = 1;
  for (let x = MIN_WAVELENGTH_NM; x <= MAX_WAVELENGTH_NM; x += 250) {
    const canvasX = wavelengthToCanvasX(x, MIN_WAVELENGTH_NM, MAX_WAVELENGTH_NM, width, paddingLeft, paddingRight);
    ctx.beginPath();
    ctx.moveTo(canvasX, paddingTop);
    ctx.lineTo(canvasX, height - paddingBottom);
    ctx.stroke();
  }
  for (let y = 0; y <= 1.0; y += 0.2) {
    const canvasY = intensityToCanvasY(y, height, paddingTop, paddingBottom);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, canvasY);
    ctx.lineTo(width - paddingRight, canvasY);
    ctx.stroke();
  }

  for (let nm = 380; nm < 750; nm += 10) {
    const x0 = wavelengthToCanvasX(nm, MIN_WAVELENGTH_NM, MAX_WAVELENGTH_NM, width, paddingLeft, paddingRight);
    const x1 = wavelengthToCanvasX(Math.min(nm + 10, 750), MIN_WAVELENGTH_NM, MAX_WAVELENGTH_NM, width, paddingLeft, paddingRight);
    ctx.fillStyle = wavelengthToRgb(nm + 5, 0.18);
    ctx.fillRect(x0, paddingTop, x1 - x0, height - paddingTop - paddingBottom);
  }

  const spectrum = createSpectrumData(result.temperature);
  const glowPath = new Path2D();
  const linePath = new Path2D();
  spectrum.wavelengthsNm.forEach((wavelength, index) => {
    const x = wavelengthToCanvasX(wavelength, MIN_WAVELENGTH_NM, MAX_WAVELENGTH_NM, width, paddingLeft, paddingRight);
    const y = intensityToCanvasY(spectrum.intensities[index], height, paddingTop, paddingBottom);
    if (index === 0) {
      glowPath.moveTo(x, y);
      linePath.moveTo(x, y);
    } else {
      glowPath.lineTo(x, y);
      linePath.lineTo(x, y);
    }
  });

  ctx.save();
  ctx.strokeStyle = "rgba(84, 215, 255, 0.24)";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(glowPath);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "#54d7ff";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(linePath);
  ctx.restore();

  if (result.lambdaOnChart) {
    const peakX = wavelengthToCanvasX(result.lambdaNm, MIN_WAVELENGTH_NM, MAX_WAVELENGTH_NM, width, paddingLeft, paddingRight);
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = "#ff9b4d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(peakX, paddingTop);
    ctx.lineTo(peakX, height - paddingBottom);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#ffd4b1";
    ctx.font = "bold 20px IBM Plex Sans";
    ctx.textAlign = "center";
    ctx.fillText(`lambda max = ${formatNumber(result.lambdaNm, 0)} nm`, peakX, paddingTop - 18);
  }

  ctx.fillStyle = "#edf5ff";
  ctx.font = "bold 24px IBM Plex Sans";
  ctx.textAlign = "left";
  ctx.fillText(`${result.objectName} | T = ${formatNumber(result.temperature, result.temperature % 1 === 0 ? 0 : 2)} K`, paddingLeft, 30);

  ctx.fillStyle = "#d8e7f9";
  ctx.font = "18px IBM Plex Sans";
  ctx.fillText("Relative Intensity", 18, paddingTop - 10);
  ctx.fillText("Wavelength (nm)", width / 2 - 70, height - 22);

  ctx.font = "16px IBM Plex Sans";
  for (let x = MIN_WAVELENGTH_NM; x <= MAX_WAVELENGTH_NM; x += 250) {
    const canvasX = wavelengthToCanvasX(x, MIN_WAVELENGTH_NM, MAX_WAVELENGTH_NM, width, paddingLeft, paddingRight);
    ctx.textAlign = "center";
    ctx.fillText(String(x), canvasX, height - paddingBottom + 28);
  }
  for (let y = 0; y <= 1.0; y += 0.2) {
    const canvasY = intensityToCanvasY(y, height, paddingTop, paddingBottom);
    ctx.textAlign = "right";
    ctx.fillText(y.toFixed(1), paddingLeft - 12, canvasY + 5);
  }

  return canvas.toDataURL("image/png");
}

function drawPdfHeader(doc, reportTitle, pageLabel) {
  doc.setFillColor(6, 18, 34);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(17, 52, 87);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(237, 245, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(reportTitle, 16, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(167, 189, 217);
  doc.text(pageLabel, 194, 18, { align: "right" });
}

async function openPrintFallbackReport() {
  const sections = [];

  for (let index = 0; index < state.tableEntries.length; index += 1) {
    const entry = state.tableEntries[index];
    let imageMarkup = "<div class=\"missing-graph\">Graph unavailable for this object.</div>";

    try {
      const image = await createGraphImage(entry);
      imageMarkup = `<img src="${image}" alt="Graph for ${escapeHtml(entry.objectName)}" />`;
    } catch (error) {
      imageMarkup = "<div class=\"missing-graph\">Graph unavailable for this object.</div>";
    }

    sections.push(`
      <section class="report-page">
        <header class="report-header">
          <h2>${escapeHtml(entry.objectName)}</h2>
          <p>Temperature: ${formatNumber(entry.temperature, entry.temperature % 1 === 0 ? 0 : 2)} K</p>
          <p>Peak Wavelength: ${formatNumber(entry.lambdaNm, 0)} nm</p>
          <p>Radiation Type: ${escapeHtml(entry.radiationType)}</p>
          <p>Information: ${escapeHtml(entry.objectInfo || "No notes provided.")}</p>
        </header>
        <div class="report-graph">${imageMarkup}</div>
      </section>
    `);
  }

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${REPORT_TITLE}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; background: #07111f; color: #edf5ff; }
          .cover, .report-page { page-break-after: always; padding: 28px; }
          .cover h1 { margin: 0 0 12px; font-size: 28px; }
          .cover p, .report-header p { margin: 6px 0; line-height: 1.5; color: #d6e6f7; }
          .report-page h2 { margin: 0 0 10px; }
          .report-graph { margin-top: 18px; }
          .report-graph img { width: 100%; max-width: 1000px; border: 1px solid #1a4f78; border-radius: 12px; display: block; }
          .missing-graph { padding: 36px; border: 1px dashed #54d7ff; border-radius: 12px; color: #c7dcef; }
        </style>
      </head>
      <body>
        <section class="cover">
          <h1>${REPORT_TITLE}</h1>
          <p>Date: ${formatDisplayDate(getTodayIsoDate())}</p>
          <p>Objects Included: ${state.tableEntries.length}</p>
          <p>This print-ready report was generated because the direct PDF library was unavailable.</p>
        </section>
        ${sections.join("")}
        <script>
          window.addEventListener("load", () => {
            setTimeout(() => window.print(), 400);
          });
        </script>
      </body>
    </html>
  `;

  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    throw new Error("Popup blocked while opening the print fallback.");
  }

  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
}

async function downloadPdfReport() {
  if (state.exportInProgress) {
    return;
  }

  if (state.tableEntries.length < MIN_OBJECTS_FOR_PDF) {
    updateStatus("Add at least 5 objects before downloading the PDF report.", "error");
    return;
  }

  if (!pdfAvailable()) {
    try {
      await openPrintFallbackReport();
      updateStatus("Direct PDF export was unavailable. A print-ready report opened so you can save it as PDF.", "success");
    } catch (fallbackError) {
      updateStatus("The PDF library did not load and the print fallback could not be opened.", "error");
    }
    return;
  }

  state.exportInProgress = true;
  elements.downloadPdfBtn.disabled = true;
  elements.downloadPdfBtn.textContent = "Building PDF...";
  updateStatus("Generating the PDF report. This can take a few seconds.", "success");

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      unit: "mm",
      format: "a4",
      compress: true
    });

    drawPdfHeader(doc, REPORT_TITLE, "Cover");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(237, 245, 255);
    doc.text(REPORT_TITLE, 16, 52);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(167, 189, 217);
    doc.text("Student object investigation report", 16, 64);

    doc.setDrawColor(84, 215, 255);
    doc.setLineWidth(0.6);
    doc.line(16, 72, 194, 72);

    doc.setFillColor(10, 24, 44);
    doc.roundedRect(16, 84, 178, 38, 5, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(237, 245, 255);
    doc.text("Report Summary", 22, 96);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(214, 230, 247);
    doc.text(`Date: ${formatDisplayDate(getTodayIsoDate())}`, 22, 108);
    doc.text(`Objects Included: ${state.tableEntries.length}`, 22, 118);

    doc.setFillColor(10, 24, 44);
    doc.roundedRect(16, 134, 178, 126, 5, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(237, 245, 255);
    doc.text("Objects Included", 22, 146);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(214, 230, 247);
    state.tableEntries.forEach((entry, index) => {
      if (index < 14) {
        doc.text(
          `${index + 1}. ${entry.objectName} | ${formatNumber(entry.temperature, entry.temperature % 1 === 0 ? 0 : 2)} K | ${formatNumber(entry.lambdaNm, 0)} nm`,
          22,
          158 + index * 7
        );
      }
    });
    if (state.tableEntries.length > 14) {
      doc.text(`+ ${state.tableEntries.length - 14} more objects`, 22, 158 + 14 * 7);
    }

    for (let index = 0; index < state.tableEntries.length; index += 1) {
      const entry = state.tableEntries[index];
      const infoLines = truncatePdfLines(doc, `Information: ${entry.objectInfo || "No notes provided."}`, 168, 3);

      doc.addPage();
      drawPdfHeader(doc, REPORT_TITLE, `Object ${index + 1}`);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(237, 245, 255);
      doc.text(entry.objectName, 16, 42);

      doc.setFillColor(10, 24, 44);
      doc.roundedRect(16, 50, 178, 46, 4, 4, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(214, 230, 247);
      doc.text(`Temperature: ${formatNumber(entry.temperature, entry.temperature % 1 === 0 ? 0 : 2)} K`, 22, 62);
      doc.text(`Peak Wavelength: ${formatNumber(entry.lambdaNm, 0)} nm`, 22, 70);
      doc.text(`Radiation Type: ${entry.radiationType}`, 108, 62);
      doc.text(`Equation: lambda max = b / T`, 108, 70);
      doc.text(infoLines, 22, 80);

      try {
        const image = await createGraphImage(entry);
        doc.addImage(image, "PNG", 16, 102, 178, 100, undefined, "FAST");
      } catch (graphError) {
        drawMissingGraphPlaceholder(doc);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(167, 189, 217);
      doc.text("Planck blackbody curve with visible spectrum band and peak wavelength marker.", 16, 214);
    }

    doc.save(`${sanitizeFileName(REPORT_TITLE)}.pdf`);
    updateStatus("PDF report downloaded successfully.", "success");
  } catch (error) {
    try {
      await openPrintFallbackReport();
      updateStatus("The direct PDF export failed, but a print-ready report opened so you can save it as PDF.", "success");
    } catch (fallbackError) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      updateStatus(`The PDF could not be generated. ${detail}`, "error");
    }
  } finally {
    state.exportInProgress = false;
    renderTable();
  }
}

function attachEvents() {
  elements.calculateBtn.addEventListener("click", calculateResult);
  elements.newEntryBtn.addEventListener("click", () => {
    clearCurrentEntry();
    updateStatus("New object space opened.", "success");
  });
  elements.sunExampleBtn.addEventListener("click", () => loadExample(SUN_EXAMPLE));
  elements.resetBtn.addEventListener("click", resetSimulation);
  elements.addResultBtn.addEventListener("click", addCurrentResult);
  elements.downloadPdfBtn.addEventListener("click", downloadPdfReport);

  const submitOnEnter = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      calculateResult();
    }
  };

  elements.objectName.addEventListener("keydown", submitOnEnter);
  elements.temperatureInput.addEventListener("keydown", submitOnEnter);
}

function init() {
  renderInitialPlot();
  updateResultTiles(null);
  renderTable();
  attachEvents();
}

window.addEventListener("DOMContentLoaded", init);
