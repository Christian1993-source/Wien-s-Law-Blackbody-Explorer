const MAX_OBJECTS = 6;
const WIEN_CONSTANT = 0.0029;
const GRAPH_MIN_NM = 100;
const GRAPH_MAX_NM = 3000;
const GRAPH_STEP_NM = 4;
const PLANCK_CONSTANT = 6.62607015e-34;
const LIGHT_SPEED = 2.99792458e8;
const BOLTZMANN_CONSTANT = 1.380649e-23;

const CURVE_COLORS = ["#3a86ff", "#70e000", "#ff595e", "#ff9f1c", "#3cf2ff", "#a855f7"];
const GRAPH_CONFIG = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["lasso2d", "select2d"],
};

const elements = {
  addObjectButton: document.getElementById("addObjectButton"),
  loadExamplesButton: document.getElementById("loadExamplesButton"),
  resetObjectsButton: document.getElementById("resetObjectsButton"),
  generatePdfButton: document.getElementById("generatePdfButton"),
  objectCards: document.getElementById("objectCards"),
  objectLimitHint: document.getElementById("objectLimitHint"),
  resultsTableBody: document.getElementById("resultsTableBody"),
  statusMessage: document.getElementById("statusMessage"),
  graph: document.getElementById("graph"),
  objectCardTemplate: document.getElementById("objectCardTemplate"),
};

const state = {
  objects: [],
  nextId: 1,
  resizeFrame: 0,
};

const exampleObjects = [
  {
    name: "Sun",
    description: "A G-type main-sequence star that behaves approximately like a blackbody.",
    temperature: "5778",
  },
  {
    name: "Tungsten Filament",
    description: "An incandescent filament that emits a thermal spectrum close to a blackbody curve.",
    temperature: "2800",
  },
  {
    name: "Earth",
    description: "The planet emits mainly thermal infrared radiation approximated by blackbody behavior.",
    temperature: "288",
  },
];

function createObject() {
  return {
    id: state.nextId++,
    name: "",
    description: "",
    temperature: "",
    imageDataUrl: "",
    imageMimeType: "",
    generated: false,
    peakMeters: null,
    peakNm: null,
    radiationType: "",
    color: CURVE_COLORS[0],
  };
}

function resetStateToSingleObject() {
  state.nextId = 1;
  state.objects = [createObject()];
  syncPalette();
}

function syncPalette() {
  var index;
  for (index = 0; index < state.objects.length; index += 1) {
    state.objects[index].color = CURVE_COLORS[index % CURVE_COLORS.length];
  }
}

function setStatus(message, type) {
  elements.statusMessage.textContent = message || "";
  elements.statusMessage.className = type === "error" ? "status-message error" : "status-message";
}

function clearStatus() {
  setStatus("");
}

function getObjectLabel(object, index) {
  var name = object.name.replace(/^\s+|\s+$/g, "");
  return name ? "Object " + (index + 1) + ": " + name : "Object " + (index + 1);
}

function formatTemperature(value) {
  return Number(value).toLocaleString() + " K";
}

function formatPeakNm(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  if (value >= 100) {
    return Math.round(value) + " nm";
  }

  if (value >= 10) {
    return value.toFixed(1) + " nm";
  }

  return value.toFixed(2) + " nm";
}

function hexToRgba(hex, alpha) {
  var normalized = hex.replace("#", "");
  var red = parseInt(normalized.substring(0, 2), 16);
  var green = parseInt(normalized.substring(2, 4), 16);
  var blue = parseInt(normalized.substring(4, 6), 16);
  return "rgba(" + red + ", " + green + ", " + blue + ", " + alpha + ")";
}

function classifyRadiation(peakNm) {
  if (peakNm < 10) {
    return "Gamma Rays";
  }

  if (peakNm >= 380 && peakNm <= 750) {
    return "Visible Light";
  }

  if (peakNm >= 10 && peakNm < 400) {
    return "Ultraviolet";
  }

  if (peakNm > 750 && peakNm <= 1e6) {
    return "Infrared";
  }

  return "Infrared";
}

function computeObjectResults(object) {
  var temperature = Number(object.temperature);
  object.peakMeters = WIEN_CONSTANT / temperature;
  object.peakNm = object.peakMeters * 1e9;
  object.radiationType = classifyRadiation(object.peakNm);
  object.generated = true;
}

function clearObjectResults(object) {
  object.generated = false;
  object.peakMeters = null;
  object.peakNm = null;
  object.radiationType = "";
}

function getGeneratedObjects() {
  return state.objects.filter(function (object) {
    return object.generated;
  });
}

function updateLimitState() {
  var atLimit = state.objects.length >= MAX_OBJECTS;
  elements.addObjectButton.disabled = atLimit;
  elements.objectLimitHint.textContent = atLimit
    ? "Maximum reached: 6 objects."
    : "Active objects: " + state.objects.length + " of " + MAX_OBJECTS + ".";
}

function renderCards() {
  var index;
  syncPalette();
  elements.objectCards.innerHTML = "";

  for (index = 0; index < state.objects.length; index += 1) {
    renderSingleCard(state.objects[index], index);
  }

  updateLimitState();
}

function renderSingleCard(object, index) {
  var fragment = elements.objectCardTemplate.content.cloneNode(true);
  var title = fragment.querySelector(".card-title");
  var indicator = fragment.querySelector(".color-indicator");
  var nameInput = fragment.querySelector(".object-name");
  var descriptionInput = fragment.querySelector(".object-description");
  var temperatureInput = fragment.querySelector(".object-temperature");
  var imageInput = fragment.querySelector(".object-image");
  var imagePreview = fragment.querySelector(".image-preview");
  var imageEmpty = fragment.querySelector(".image-preview-empty");
  var resultStrip = fragment.querySelector(".result-strip");
  var peakValue = fragment.querySelector(".peak-value");
  var radiationValue = fragment.querySelector(".radiation-value");
  var generateButton = fragment.querySelector(".generate-button");
  var removeButton = fragment.querySelector(".remove-button");

  title.textContent = getObjectLabel(object, index);
  indicator.style.background = object.color;
  indicator.style.color = object.color;

  nameInput.value = object.name;
  descriptionInput.value = object.description;
  temperatureInput.value = object.temperature;

  if (object.imageDataUrl) {
    imagePreview.src = object.imageDataUrl;
    imagePreview.hidden = false;
    imageEmpty.hidden = true;
  } else {
    imagePreview.hidden = true;
    imageEmpty.hidden = false;
  }

  if (object.generated) {
    resultStrip.hidden = false;
    peakValue.textContent = formatPeakNm(object.peakNm);
    radiationValue.textContent = object.radiationType;
  } else {
    resultStrip.hidden = true;
  }

  removeButton.disabled = state.objects.length === 1;
  removeButton.title =
    state.objects.length === 1
      ? "Add another object to enable removal."
      : "Remove this object from the investigation.";

  nameInput.addEventListener("input", function (event) {
    object.name = event.target.value;
    title.textContent = getObjectLabel(object, index);
    if (object.generated) {
      renderResultsTable();
      renderGraph();
    }
  });

  descriptionInput.addEventListener("input", function (event) {
    object.description = event.target.value;
    if (object.generated) {
      renderResultsTable();
    }
  });

  temperatureInput.addEventListener("input", function (event) {
    object.temperature = event.target.value;
    if (object.generated) {
      if (!Number.isFinite(Number(object.temperature)) || Number(object.temperature) <= 0) {
        clearObjectResults(object);
        resultStrip.hidden = true;
        renderResultsTable();
        renderGraph();
        return;
      }

      computeObjectResults(object);
      resultStrip.hidden = false;
      peakValue.textContent = formatPeakNm(object.peakNm);
      radiationValue.textContent = object.radiationType;
      renderResultsTable();
      renderGraph();
    }
  });

  imageInput.addEventListener("change", function (event) {
    var input = event.target;
    var file = input.files && input.files[0];

    if (!file) {
      return;
    }

    if (["image/jpeg", "image/png"].indexOf(file.type) === -1) {
      setStatus("Please upload a JPG, JPEG, or PNG image.", "error");
      input.value = "";
      return;
    }

    readFileAsDataUrl(file)
      .then(function (dataUrl) {
        object.imageDataUrl = dataUrl;
        object.imageMimeType = file.type;
        if (!object.generated) {
          setStatus("Image uploaded. Generate the radiation graph to include it in the visualization.");
        }
        renderCards();
        renderResultsTable();
        renderGraph();
      })
      .catch(function () {
        setStatus("The selected image could not be loaded.", "error");
      });
  });

  generateButton.addEventListener("click", function () {
    generateObjectGraph(object.id);
  });

  removeButton.addEventListener("click", function () {
    removeObject(object.id);
  });

  elements.objectCards.appendChild(fragment);
}

function renderResultsTable() {
  var generatedObjects = getGeneratedObjects();
  var index;

  elements.resultsTableBody.innerHTML = "";

  if (generatedObjects.length === 0) {
    renderEmptyTableRow();
    return;
  }

  for (index = 0; index < generatedObjects.length; index += 1) {
    renderTableRow(generatedObjects[index]);
  }
}

function renderEmptyTableRow() {
  var row = document.createElement("tr");
  var cell = document.createElement("td");
  cell.colSpan = 6;
  cell.className = "empty-state";
  cell.textContent = "Generate at least one radiation graph to populate the investigation table.";
  row.appendChild(cell);
  elements.resultsTableBody.appendChild(row);
}

function renderTableRow(object) {
  var row = document.createElement("tr");
  var nameCell = document.createElement("td");
  var descriptionCell = document.createElement("td");
  var temperatureCell = document.createElement("td");
  var peakCell = document.createElement("td");
  var typeCell = document.createElement("td");
  var imageCell = document.createElement("td");
  var tag = document.createElement("span");

  nameCell.textContent = object.name.replace(/^\s+|\s+$/g, "") || "Unnamed Object";
  descriptionCell.textContent = object.description.replace(/^\s+|\s+$/g, "") || "No description provided.";
  temperatureCell.textContent = formatTemperature(object.temperature);
  peakCell.textContent = formatPeakNm(object.peakNm);

  tag.className = "radiation-tag";
  tag.textContent = object.radiationType;
  tag.style.color = object.color;
  tag.style.background = hexToRgba(object.color, 0.12);
  tag.style.borderColor = hexToRgba(object.color, 0.34);
  typeCell.appendChild(tag);

  if (object.imageDataUrl) {
    var thumb = document.createElement("img");
    thumb.className = "table-thumb";
    thumb.src = object.imageDataUrl;
    thumb.alt = (object.name || "Object") + " thumbnail";
    imageCell.appendChild(thumb);
  } else {
    imageCell.textContent = "No image";
  }

  row.appendChild(nameCell);
  row.appendChild(descriptionCell);
  row.appendChild(temperatureCell);
  row.appendChild(peakCell);
  row.appendChild(typeCell);
  row.appendChild(imageCell);
  elements.resultsTableBody.appendChild(row);
}

function addObject() {
  if (state.objects.length >= MAX_OBJECTS) {
    setStatus("You can investigate a maximum of 6 objects.", "error");
    return;
  }

  state.objects.push(createObject());
  clearStatus();
  renderCards();
  renderGraph();
}

function removeObject(id) {
  if (state.objects.length === 1) {
    return;
  }

  state.objects = state.objects.filter(function (object) {
    return object.id !== id;
  });

  clearStatus();
  renderCards();
  renderResultsTable();
  renderGraph();
}

function resetObjects() {
  resetStateToSingleObject();
  clearStatus();
  renderCards();
  renderResultsTable();
  renderGraph();
}

function loadExampleData() {
  var index;
  state.nextId = 1;
  state.objects = [];

  for (index = 0; index < exampleObjects.length; index += 1) {
    var example = exampleObjects[index];
    var object = createObject();
    object.name = example.name;
    object.description = example.description;
    object.temperature = example.temperature;
    computeObjectResults(object);
    state.objects.push(object);
  }

  syncPalette();
  setStatus("Example investigation data loaded.");
  renderCards();
  renderResultsTable();
  renderGraph();
}

function generateObjectGraph(id) {
  var object = state.objects.find(function (entry) {
    return entry.id === id;
  });
  var name;
  var description;
  var temperature;

  if (!object) {
    return;
  }

  name = object.name.replace(/^\s+|\s+$/g, "");
  description = object.description.replace(/^\s+|\s+$/g, "");
  temperature = Number(object.temperature);

  if (!name) {
    setStatus("Please enter an object name before generating the radiation graph.", "error");
    return;
  }

  if (!description) {
    setStatus("Please add a description for the selected object.", "error");
    return;
  }

  if (!Number.isFinite(temperature) || temperature <= 0) {
    setStatus("Temperature must be a positive number in Kelvin.", "error");
    return;
  }

  object.name = name;
  object.description = description;
  object.temperature = String(temperature);
  computeObjectResults(object);

  setStatus(name + " analyzed: " + formatPeakNm(object.peakNm) + " (" + object.radiationType + ").");
  renderCards();
  renderResultsTable();
  renderGraph();
}

function readFileAsDataUrl(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      resolve(reader.result);
    };
    reader.onerror = function () {
      reject(reader.error);
    };
    reader.readAsDataURL(file);
  });
}

function getWavelengthAxis() {
  var axis = [];
  var wavelength;

  for (wavelength = GRAPH_MIN_NM; wavelength <= GRAPH_MAX_NM; wavelength += GRAPH_STEP_NM) {
    axis.push(wavelength);
  }

  return axis;
}

function planckRadiance(wavelengthNm, temperature) {
  var wavelengthMeters = wavelengthNm * 1e-9;
  var exponent =
    (PLANCK_CONSTANT * LIGHT_SPEED) / (wavelengthMeters * BOLTZMANN_CONSTANT * temperature);
  var numerator;
  var denominator;

  if (exponent > 700) {
    return 0;
  }

  numerator = (2 * PLANCK_CONSTANT * Math.pow(LIGHT_SPEED, 2)) / Math.pow(wavelengthMeters, 5);
  denominator = Math.exp(exponent) - 1;
  return denominator === 0 ? 0 : numerator / denominator;
}

function buildGraphSeries(objects) {
  var wavelengths = getWavelengthAxis();

  return objects.map(function (object) {
    var rawY = [];
    var maxValue = 0;
    var index;

    for (index = 0; index < wavelengths.length; index += 1) {
      var value = planckRadiance(wavelengths[index], Number(object.temperature));
      rawY.push(value);
      if (value > maxValue) {
        maxValue = value;
      }
    }

    return {
      object: object,
      x: wavelengths,
      y: rawY.map(function (value) {
        return maxValue ? value / maxValue : 0;
      }),
    };
  });
}

function interpolateVisibleColor(wavelength) {
  var stops = [
    { nm: 380, rgb: [148, 0, 211] },
    { nm: 445, rgb: [65, 105, 225] },
    { nm: 490, rgb: [0, 191, 255] },
    { nm: 530, rgb: [0, 200, 83] },
    { nm: 580, rgb: [255, 214, 10] },
    { nm: 620, rgb: [255, 140, 0] },
    { nm: 750, rgb: [220, 20, 60] },
  ];
  var index;

  for (index = 0; index < stops.length - 1; index += 1) {
    var current = stops[index];
    var next = stops[index + 1];

    if (wavelength >= current.nm && wavelength <= next.nm) {
      var ratio = (wavelength - current.nm) / (next.nm - current.nm);
      return current.rgb.map(function (channel, channelIndex) {
        return Math.round(channel + (next.rgb[channelIndex] - channel) * ratio);
      });
    }
  }

  return stops[stops.length - 1].rgb;
}

function buildVisibleSpectrumShapes() {
  var shapes = [];
  var wavelength;

  for (wavelength = 380; wavelength < 750; wavelength += 6) {
    var next = Math.min(wavelength + 6, 750);
    var color = interpolateVisibleColor(wavelength);
    shapes.push({
      type: "rect",
      xref: "x",
      yref: "paper",
      x0: wavelength,
      x1: next,
      y0: 0,
      y1: 1,
      fillcolor: "rgba(" + color[0] + ", " + color[1] + ", " + color[2] + ", 0.16)",
      line: { width: 0 },
      layer: "below",
    });
  }

  return shapes;
}

function buildPeakDecorations(series) {
  var shapes = [];
  var annotations = [
    {
      x: 565,
      y: 1.08,
      xref: "x",
      yref: "y",
      text: "Visible Light",
      showarrow: false,
      font: {
        family: "IBM Plex Mono, monospace",
        size: 12,
        color: "#eff6ff",
      },
      bgcolor: "rgba(9, 17, 33, 0.62)",
      bordercolor: "rgba(255,255,255,0.08)",
      borderpad: 4,
    },
  ];

  series.forEach(function (entry) {
    var peakNm = entry.object.peakNm;

    if (!Number.isFinite(peakNm)) {
      return;
    }

    shapes.push({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: peakNm,
      x1: peakNm,
      y0: 0,
      y1: 1,
      line: {
        color: entry.object.color,
        width: 1.6,
        dash: "dash",
      },
    });

    if (peakNm >= GRAPH_MIN_NM && peakNm <= GRAPH_MAX_NM) {
      var pointIndex = Math.round((peakNm - GRAPH_MIN_NM) / GRAPH_STEP_NM);
      var clampedIndex = Math.max(0, Math.min(pointIndex, entry.y.length - 1));
      annotations.push({
        x: peakNm,
        y: Math.min(entry.y[clampedIndex] + 0.08, 1.08),
        xref: "x",
        yref: "y",
        text: "Peak: " + Math.round(peakNm) + " nm",
        showarrow: true,
        arrowhead: 2,
        ax: 0,
        ay: -26,
        arrowwidth: 1.2,
        arrowcolor: entry.object.color,
        font: {
          family: "IBM Plex Mono, monospace",
          size: 11,
          color: entry.object.color,
        },
        bgcolor: "rgba(8, 13, 25, 0.76)",
        bordercolor: hexToRgba(entry.object.color, 0.34),
        borderpad: 4,
      });
    }
  });

  return {
    shapes: shapes,
    annotations: annotations,
  };
}

function buildPlotData(series) {
  var traces = [];

  series.forEach(function (entry) {
    traces.push({
      x: entry.x,
      y: entry.y,
      type: "scatter",
      mode: "lines",
      line: {
        color: entry.object.color,
        width: 14,
        shape: "spline",
        smoothing: 1.15,
      },
      opacity: 0.12,
      hoverinfo: "skip",
      showlegend: false,
    });

    traces.push({
      x: entry.x,
      y: entry.y,
      type: "scatter",
      mode: "lines",
      name: escapeHtml(entry.object.name || "Unnamed Object"),
      line: {
        color: entry.object.color,
        width: 3,
        shape: "spline",
        smoothing: 1.15,
      },
      hovertemplate:
        "<b>" +
        escapeHtml(entry.object.name || "Unnamed Object") +
        "</b><br>" +
        "Temperature: " +
        Number(entry.object.temperature).toLocaleString() +
        " K<br>" +
        "Wavelength: %{x:.0f} nm<br>" +
        "Relative Intensity: %{y:.3f}<extra></extra>",
    });
  });

  return traces;
}

function getGraphHeight() {
  return Math.max(elements.graph.clientHeight || 620, 520);
}

function buildPlotLayout(series, emptyMessage, titleText) {
  var visibleShapes = buildVisibleSpectrumShapes();
  var peakDecorations = buildPeakDecorations(series);
  var annotations = peakDecorations.annotations.slice();

  if (emptyMessage) {
    annotations.push({
      x: 1550,
      y: 0.55,
      xref: "x",
      yref: "y",
      text: emptyMessage,
      showarrow: false,
      font: {
        family: "Space Grotesk, sans-serif",
        size: 15,
        color: "#dbe8fb",
      },
      bgcolor: "rgba(8, 13, 25, 0.76)",
      bordercolor: "rgba(91,192,235,0.16)",
      borderpad: 10,
    });
  }

  return {
    title: titleText
      ? {
          text: titleText,
          x: 0.02,
          font: {
            family: "Orbitron, sans-serif",
            size: 17,
            color: "#eff6ff",
          },
        }
      : undefined,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(8, 14, 26, 0.94)",
    margin: { l: 74, r: 24, t: titleText ? 52 : 28, b: 62 },
    height: getGraphHeight(),
    font: {
      family: "Space Grotesk, sans-serif",
      color: "#dbe8fb",
    },
    uirevision: "wien-blackbody-simulator",
    xaxis: {
      title: {
        text: "Wavelength (nm)",
        font: {
          family: "IBM Plex Mono, monospace",
          size: 13,
          color: "#eff6ff",
        },
      },
      range: [GRAPH_MIN_NM, GRAPH_MAX_NM],
      showgrid: true,
      gridcolor: "rgba(131, 160, 206, 0.12)",
      zeroline: false,
      tickfont: { color: "#d2e0f8" },
      ticks: "outside",
      linecolor: "rgba(160, 184, 222, 0.2)",
    },
    yaxis: {
      title: {
        text: "Relative Intensity",
        font: {
          family: "IBM Plex Mono, monospace",
          size: 13,
          color: "#eff6ff",
        },
      },
      range: [0, 1.12],
      showgrid: true,
      gridcolor: "rgba(131, 160, 206, 0.12)",
      zeroline: false,
      tickfont: { color: "#d2e0f8" },
      ticks: "outside",
      linecolor: "rgba(160, 184, 222, 0.2)",
    },
    legend: {
      orientation: "h",
      yanchor: "top",
      y: 0.99,
      xanchor: "left",
      x: 0.01,
      bgcolor: "rgba(8, 13, 25, 0.58)",
      bordercolor: "rgba(255,255,255,0.06)",
      borderwidth: 1,
      font: { color: "#eff6ff" },
    },
    hovermode: "closest",
    shapes: visibleShapes.concat(peakDecorations.shapes),
    annotations: annotations,
  };
}

function renderGraph() {
  var generatedObjects = getGeneratedObjects();
  var layout;
  var data;
  var series;

  if (typeof Plotly === "undefined") {
    elements.graph.innerHTML =
      '<div class="graph-fallback"><div><strong>Graph unavailable</strong>Plotly.js did not load, so the blackbody spectrum cannot be drawn right now.</div></div>';
    return;
  }

  elements.graph.innerHTML = "";

  if (generatedObjects.length === 0) {
    layout = buildPlotLayout([], "Generate an object's radiation graph to begin the spectrum visualization.");
    Plotly.newPlot("graph", [], layout, GRAPH_CONFIG);
    return;
  }

  series = buildGraphSeries(generatedObjects);
  data = buildPlotData(series);
  layout = buildPlotLayout(series, "");
  Plotly.newPlot("graph", data, layout, GRAPH_CONFIG);
}

function handleWindowResize() {
  if (state.resizeFrame) {
    cancelAnimationFrame(state.resizeFrame);
  }

  state.resizeFrame = requestAnimationFrame(function () {
    state.resizeFrame = 0;
    renderGraph();
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getImageFormat(dataUrl) {
  return dataUrl.indexOf("data:image/png") === 0 ? "PNG" : "JPEG";
}

function formatReportDate(date) {
  var months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return months[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
}

function createCurrentGraphImage() {
  if (typeof Plotly === "undefined") {
    return Promise.reject(new Error("Plotly is unavailable."));
  }

  return Plotly.toImage(elements.graph, {
    format: "png",
    height: 800,
    width: 1400,
  });
}

function drawPdfPageHeader(doc, pageWidth) {
  doc.setFillColor(11, 19, 43);
  doc.rect(0, 0, pageWidth, 66, "F");
  doc.setTextColor(247, 251, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Wien's Law Blackbody Radiation Investigation", 34, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Mr. Mercado Simulator", 34, 45);
}

function drawPdfTitlePage(doc, pageWidth, pageHeight, reportDate) {
  doc.setFillColor(11, 19, 43);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setTextColor(247, 251, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Wien's Law Blackbody Radiation Investigation", pageWidth / 2, 220, {
    align: "center",
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Mr. Mercado Simulator", pageWidth / 2, 255, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text("Scientific Analysis of Blackbody Radiation", pageWidth / 2, 300, {
    align: "center",
  });
  doc.setFontSize(11);
  doc.setTextColor(198, 214, 242);
  doc.text("Date: " + reportDate, pageWidth / 2, 336, {
    align: "center",
  });
}

function drawSectionDivider(doc, y, pageWidth) {
  doc.setDrawColor(190, 203, 226);
  doc.setLineWidth(0.8);
  doc.line(34, y, pageWidth - 34, y);
}

function addWrappedText(doc, text, x, y, maxWidth, lineHeight) {
  var lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * (lineHeight || 15);
}

function drawObjectSection(doc, object, index, pageWidth, pageHeight) {
  var textY = 106;
  var bodyWidth = object.imageDataUrl ? 310 : pageWidth - 68;

  drawPdfPageHeader(doc, pageWidth);
  doc.setTextColor(18, 31, 52);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Object " + (index + 1), 34, textY);
  drawSectionDivider(doc, textY + 10, pageWidth);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Object Name", 34, textY + 34);
  doc.setFont("helvetica", "normal");
  doc.text(object.name || "Unnamed Object", 34, textY + 50);

  doc.setFont("helvetica", "bold");
  doc.text("Description", 34, textY + 78);
  doc.setFont("helvetica", "normal");
  textY = addWrappedText(
    doc,
    object.description || "No description provided.",
    34,
    textY + 94,
    bodyWidth,
    15,
  );

  doc.setFont("helvetica", "bold");
  doc.text("Temperature", 34, textY + 14);
  doc.setFont("helvetica", "normal");
  doc.text(formatTemperature(object.temperature), 34, textY + 30);

  doc.setFont("helvetica", "bold");
  doc.text("Peak Wavelength", 34, textY + 58);
  doc.setFont("helvetica", "normal");
  doc.text(formatPeakNm(object.peakNm), 34, textY + 74);

  doc.setFont("helvetica", "bold");
  doc.text("Radiation Type", 34, textY + 102);
  doc.setFont("helvetica", "normal");
  doc.text(object.radiationType, 34, textY + 118);

  if (object.imageDataUrl) {
    doc.setFont("helvetica", "bold");
    doc.text("Object Image", 376, 140);
    doc.addImage(object.imageDataUrl, getImageFormat(object.imageDataUrl), 376, 154, 150, 110);
  }

  drawSectionDivider(doc, pageHeight - 52, pageWidth);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(94, 111, 140);
  doc.text("Generated by Wien's Law Blackbody Radiation - Mr. Mercado Simulator", 34, pageHeight - 32);
}

function generatePdfReport() {
  var generatedObjects = getGeneratedObjects();
  var originalLabel = elements.generatePdfButton.textContent;

  if (generatedObjects.length === 0) {
    setStatus("Generate at least one radiation graph before exporting the PDF report.", "error");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    setStatus("jsPDF is not available in this browser session.", "error");
    return;
  }

  if (typeof Plotly === "undefined") {
    setStatus("Plotly.js is required to embed graph images in the PDF report.", "error");
    return;
  }

  elements.generatePdfButton.disabled = true;
  elements.generatePdfButton.textContent = "Generating PDF...";

  (async function () {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: "pt", format: "a4" });
    var pageWidth = doc.internal.pageSize.getWidth();
    var pageHeight = doc.internal.pageSize.getHeight();
    var index;
    var graphImage;
    var reportDate = formatReportDate(new Date());

    drawPdfTitlePage(doc, pageWidth, pageHeight, reportDate);

    for (index = 0; index < generatedObjects.length; index += 1) {
      doc.addPage();
      drawObjectSection(doc, generatedObjects[index], index, pageWidth, pageHeight);
    }

    graphImage = await createCurrentGraphImage();
    doc.addPage();
    drawPdfPageHeader(doc, pageWidth);
    doc.setTextColor(18, 31, 52);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Blackbody Radiation Spectrum", 34, 108);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Final combined Plotly visualization showing all generated blackbody curves.", 34, 128);
    drawSectionDivider(doc, 144, pageWidth);
    doc.addImage(graphImage, "PNG", 34, 164, pageWidth - 68, 372);
    drawSectionDivider(doc, pageHeight - 52, pageWidth);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(94, 111, 140);
    doc.text("Generated by Wien's Law Blackbody Radiation - Mr. Mercado Simulator", 34, pageHeight - 32);

    doc.save("wiens-law-blackbody-radiation-mr-mercado-simulator-report.pdf");
    setStatus("The investigation PDF has been generated.");
    elements.generatePdfButton.disabled = false;
    elements.generatePdfButton.textContent = originalLabel;
  })()
    .catch(function (error) {
      console.error(error);
      setStatus("The PDF report could not be generated.", "error");
      elements.generatePdfButton.disabled = false;
      elements.generatePdfButton.textContent = originalLabel;
    });
}

function initialize() {
  resetStateToSingleObject();
  renderCards();
  renderResultsTable();
  renderGraph();

  elements.addObjectButton.addEventListener("click", addObject);
  elements.loadExamplesButton.addEventListener("click", loadExampleData);
  elements.resetObjectsButton.addEventListener("click", resetObjects);
  elements.generatePdfButton.addEventListener("click", generatePdfReport);
  window.addEventListener("resize", handleWindowResize);
}

initialize();
