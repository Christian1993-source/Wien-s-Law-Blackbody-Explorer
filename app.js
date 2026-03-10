const MAX_OBJECTS = 6;
const WIEN_CONSTANT = 0.0029;
const GRAPH_MIN_NM = 100;
const GRAPH_MAX_NM = 3000;
const GRAPH_STEP_NM = 4;
const PLANCK_CONSTANT = 6.62607015e-34;
const LIGHT_SPEED = 2.99792458e8;
const BOLTZMANN_CONSTANT = 1.380649e-23;

const CURVE_COLORS = ["#22d3ee", "#fb923c", "#e879f9", "#4ade80", "#facc15", "#60a5fa"];
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
  studentNameInput: document.getElementById("studentNameInput"),
  objectCards: document.getElementById("objectCards"),
  objectList: document.getElementById("objectList"),
  objectLimitHint: document.getElementById("objectLimitHint"),
  statusMessage: document.getElementById("statusMessage"),
  graph: document.getElementById("graph"),
  graphLegend: document.getElementById("graphLegend"),
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
  var numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "—";
  }

  return numericValue.toLocaleString() + " K";
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
    renderObjectList();
    if (object.generated) {
      renderGraph();
    }
  });

  descriptionInput.addEventListener("input", function (event) {
    object.description = event.target.value;
    if (object.generated) {
      renderObjectList();
    }
  });

  temperatureInput.addEventListener("input", function (event) {
    object.temperature = event.target.value;
    renderObjectList();
    if (object.generated) {
      if (!Number.isFinite(Number(object.temperature)) || Number(object.temperature) <= 0) {
        clearObjectResults(object);
        resultStrip.hidden = true;
        renderObjectList();
        renderGraph();
        return;
      }

      computeObjectResults(object);
      resultStrip.hidden = false;
      peakValue.textContent = formatPeakNm(object.peakNm);
      radiationValue.textContent = object.radiationType;
      renderObjectList();
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
        renderObjectList();
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

function formatObjectListTemperature(object) {
  var numericValue = Number(object.temperature);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "Temperature pending";
  }

  return numericValue.toLocaleString() + " K";
}

function formatObjectListPeak(object) {
  if (!object.generated || !Number.isFinite(object.peakNm)) {
    return "Peak pending";
  }

  return formatPeakNm(object.peakNm);
}

function renderObjectList() {
  var index;

  if (!elements.objectList) {
    return;
  }

  elements.objectList.innerHTML = "";

  if (state.objects.length === 0) {
    renderEmptyObjectList();
    return;
  }

  for (index = 0; index < state.objects.length; index += 1) {
    renderObjectListItem(state.objects[index], index);
  }
}

function renderEmptyObjectList() {
  if (!elements.objectList) {
    return;
  }

  var emptyState = document.createElement("div");
  emptyState.className = "object-empty";
  emptyState.textContent = "Add an investigation object to start tracking temperatures, peaks, and images.";
  elements.objectList.appendChild(emptyState);
}

function renderObjectListItem(object, index) {
  if (!elements.objectList) {
    return;
  }

  var item = document.createElement("article");
  var thumb;
  var main = document.createElement("div");
  var titleRow = document.createElement("div");
  var name = document.createElement("strong");
  var chip = document.createElement("span");
  var stats = document.createElement("div");
  var temperatureStat = document.createElement("span");
  var peakStat = document.createElement("span");

  item.className = "object-list-item";

  if (object.imageDataUrl) {
    thumb = document.createElement("img");
    thumb.className = "object-list-thumb";
    thumb.src = object.imageDataUrl;
    thumb.alt = getObjectLabel(object, index) + " thumbnail";
  } else {
    thumb = document.createElement("div");
    thumb.className = "object-list-thumb placeholder";
    thumb.textContent = "No Image";
  }

  main.className = "object-list-main";
  titleRow.className = "object-list-title";
  stats.className = "object-list-stats";
  name.textContent = object.name.replace(/^\s+|\s+$/g, "") || getObjectLabel(object, index);

  chip.className = "object-chip";
  chip.textContent = object.generated ? object.radiationType : "Awaiting Graph";
  chip.style.color = object.generated ? object.color : "#cbd5e1";
  chip.style.borderColor = object.generated
    ? hexToRgba(object.color, 0.28)
    : "rgba(148, 163, 184, 0.12)";
  chip.style.background = object.generated ? hexToRgba(object.color, 0.12) : "rgba(15, 23, 42, 0.9)";

  temperatureStat.className = "object-stat";
  temperatureStat.textContent = formatObjectListTemperature(object);

  peakStat.className = "object-stat";
  peakStat.textContent = formatObjectListPeak(object);

  titleRow.appendChild(name);
  titleRow.appendChild(chip);
  stats.appendChild(temperatureStat);
  stats.appendChild(peakStat);
  main.appendChild(titleRow);
  main.appendChild(stats);
  item.appendChild(thumb);
  item.appendChild(main);
  elements.objectList.appendChild(item);
}

function addObject() {
  if (state.objects.length >= MAX_OBJECTS) {
    setStatus("You can investigate a maximum of 6 objects.", "error");
    return;
  }

  state.objects.push(createObject());
  clearStatus();
  renderCards();
  renderObjectList();
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
  renderObjectList();
  renderGraph();
}

function resetObjects() {
  resetStateToSingleObject();
  clearStatus();
  renderCards();
  renderObjectList();
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
  renderObjectList();
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
  renderObjectList();
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

function buildSpectrumRegionAnnotations(series) {
  var presentRegions = {};
  var regionDefinitions = [
    {
      type: "Gamma Rays",
      x: GRAPH_MIN_NM + 70,
      text: "Gamma Rays",
      color: "#fda4af",
    },
    {
      type: "Ultraviolet",
      x: (GRAPH_MIN_NM + 400) / 2,
      text: "Ultraviolet",
      color: "#93c5fd",
    },
    {
      type: "Visible Light",
      x: (380 + 750) / 2,
      text: "Visible Light",
      color: "#f8fafc",
    },
    {
      type: "Infrared",
      x: (750 + GRAPH_MAX_NM) / 2,
      text: "Infrared",
      color: "#fdba74",
    },
  ];

  series.forEach(function (entry) {
    if (entry.object.radiationType) {
      presentRegions[entry.object.radiationType] = true;
    }
  });

  return regionDefinitions
    .filter(function (region) {
      return presentRegions[region.type];
    })
    .map(function (region) {
      return {
        x: region.x,
        y: 0.92,
        xref: "x",
        yref: "paper",
        text: region.text,
        showarrow: false,
        xanchor: "center",
        font: {
          family: "IBM Plex Mono, monospace",
          size: 11,
          color: region.color,
        },
        bgcolor: "rgba(9, 17, 33, 0.68)",
        bordercolor: hexToRgba(region.color, 0.3),
        borderpad: 4,
      };
    });
}

function buildPeakDecorations(series) {
  var shapes = [];
  var annotations = buildSpectrumRegionAnnotations(series);

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
        "Radiation Type: " +
        escapeHtml(entry.object.radiationType) +
        "<br>" +
        "Wavelength: %{x:.0f} nm<br>" +
        "Relative Intensity: %{y:.3f}<extra></extra>",
    });
  });

  return traces;
}

function getGraphHeight() {
  return Math.max(elements.graph.clientHeight || 620, 520);
}

function renderGraphLegend(objects) {
  var index;

  elements.graphLegend.innerHTML = "";

  if (!objects.length) {
    var emptyState = document.createElement("div");
    emptyState.className = "legend-empty";
    emptyState.textContent = "Generate a radiation graph to list the active curves here.";
    elements.graphLegend.appendChild(emptyState);
    return;
  }

  for (index = 0; index < objects.length; index += 1) {
    renderGraphLegendItem(objects[index], index);
  }
}

function renderGraphLegendItem(object, index) {
  var item = document.createElement("article");
  var top = document.createElement("div");
  var swatch = document.createElement("span");
  var name = document.createElement("strong");
  var stats = document.createElement("div");
  var temp = document.createElement("span");
  var peak = document.createElement("span");
  var type = document.createElement("span");

  item.className = "legend-item";
  top.className = "legend-item-top";
  swatch.className = "legend-swatch";
  name.className = "legend-name";
  stats.className = "legend-stats";
  temp.className = "legend-stat";
  peak.className = "legend-stat";
  type.className = "legend-stat";

  swatch.style.background = object.color;
  swatch.style.color = object.color;
  name.textContent = object.name || getObjectLabel(object, index);
  temp.textContent = formatTemperature(object.temperature);
  peak.textContent = formatPeakNm(object.peakNm);
  type.textContent = object.radiationType || "Awaiting Graph";
  type.style.borderColor = object.radiationType ? hexToRgba(object.color, 0.26) : "";
  type.style.background = object.radiationType ? hexToRgba(object.color, 0.12) : "";
  type.style.color = object.radiationType ? object.color : "";

  top.appendChild(swatch);
  top.appendChild(name);
  stats.appendChild(temp);
  stats.appendChild(peak);
  stats.appendChild(type);
  item.appendChild(top);
  item.appendChild(stats);
  elements.graphLegend.appendChild(item);
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
    showlegend: false,
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

  renderGraphLegend(generatedObjects);

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

function getStudentName() {
  var value = elements.studentNameInput.value.replace(/^\s+|\s+$/g, "");
  return value || "Not provided";
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

function drawPdfTitlePage(doc, pageWidth, pageHeight, reportDate, studentName) {
  var titleLines;
  var summaryLines;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 118, "F");
  doc.setFillColor(56, 189, 248);
  doc.rect(0, 118, pageWidth, 5, "F");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  titleLines = doc.splitTextToSize("Wien's Law Blackbody Radiation Investigation", 400);
  doc.text(titleLines, pageWidth / 2, 220, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Mr. Mercado Astrophysics Lab", pageWidth / 2, 284, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text("Scientific Analysis of Blackbody Radiation", pageWidth / 2, 320, {
    align: "center",
  });
  doc.text("Date: " + reportDate, pageWidth / 2, 342, { align: "center" });
  doc.text("Prepared by: " + studentName, pageWidth / 2, 364, { align: "center" });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1);
  doc.line(110, 392, pageWidth - 110, 392);

  doc.setFontSize(11);
  summaryLines = doc.splitTextToSize(
    "This report summarizes the investigated objects, uploaded reference images, and the final blackbody radiation spectrum exported from the simulator.",
    340,
  );
  doc.text(summaryLines, pageWidth / 2, 424, { align: "center" });
}

function drawPdfSectionHeader(doc, title, subtitle, y, pageWidth) {
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 40, y);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    doc.text(subtitle, 40, y + 18);
  }

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.8);
  doc.line(40, y + 30, pageWidth - 40, y + 30);

  return y + 48;
}

function drawPdfFooter(doc, pageWidth, pageHeight, pageNumber, totalPages) {
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.8);
  doc.line(40, pageHeight - 40, pageWidth - 40, pageHeight - 40);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Generated with the Mr. Mercado Astrophysics Lab", 40, pageHeight - 22);
  doc.text("Page " + pageNumber + " of " + totalPages, pageWidth - 40, pageHeight - 22, {
    align: "right",
  });
}

function finalizePdfFooters(doc, pageWidth, pageHeight) {
  var totalPages = doc.getNumberOfPages();
  var pageNumber;

  for (pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    drawPdfFooter(doc, pageWidth, pageHeight, pageNumber, totalPages);
  }
}

function drawPdfTableHeader(doc, columns, y) {
  var index;

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(40, y, 515, 26, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);

  for (index = 0; index < columns.length; index += 1) {
    doc.text(columns[index].label, columns[index].x + 6, y + 17);
  }
}

function drawObjectsTableSection(doc, objects, pageWidth, pageHeight) {
  var columns = [
    { label: "Object", x: 40, width: 170 },
    { label: "Temperature (K)", x: 210, width: 110 },
    { label: "Peak Wavelength (nm)", x: 320, width: 140 },
    { label: "Radiation Type", x: 460, width: 95 },
  ];
  var y = 56;
  var rowIndex;

  doc.addPage();
  y = drawPdfSectionHeader(
    doc,
    "Section 1  Objects Investigated",
    "Summary of the generated objects, temperatures, and Wien peak wavelengths.",
    y,
    pageWidth,
  );
  drawPdfTableHeader(doc, columns, y);
  y += 34;

  for (rowIndex = 0; rowIndex < objects.length; rowIndex += 1) {
    var row = [
      objects[rowIndex].name || "Unnamed Object",
      formatTemperature(objects[rowIndex].temperature),
      formatPeakNm(objects[rowIndex].peakNm),
      objects[rowIndex].radiationType,
    ];
    var wrappedRow = row.map(function (value, index) {
      return doc.splitTextToSize(String(value), columns[index].width - 12);
    });
    var maxLines = Math.max.apply(
      null,
      wrappedRow.map(function (value) {
        return value.length;
      }),
    );
    var rowHeight = Math.max(28, maxLines * 12 + 10);
    var columnIndex;

    if (y + rowHeight > pageHeight - 72) {
      doc.addPage();
      y = drawPdfSectionHeader(
        doc,
        "Section 1  Objects Investigated (cont.)",
        "",
        56,
        pageWidth,
      );
      drawPdfTableHeader(doc, columns, y);
      y += 34;
    }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(40, y - 8, 515, rowHeight, "F");
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.6);
    doc.line(40, y + rowHeight - 8, pageWidth - 40, y + rowHeight - 8);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    for (columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      doc.text(wrappedRow[columnIndex], columns[columnIndex].x + 6, y + 8);
    }

    y += rowHeight;
  }
}

function getFittedPdfImageBox(doc, dataUrl, x, y, maxWidth, maxHeight) {
  var imageProperties = doc.getImageProperties(dataUrl);
  var aspectRatio = imageProperties.width / imageProperties.height;
  var width = maxWidth;
  var height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return {
    x: x + (maxWidth - width) / 2,
    y: y + (maxHeight - height) / 2,
    width: width,
    height: height,
  };
}

function drawObjectImageCard(doc, object, x, y, width, height) {
  var infoY = y + 18;
  var imageY = y + 62;
  var imageWidth = width - 24;
  var imageHeight = height - 76;
  var nameLines = doc.splitTextToSize(object.name || "Unnamed Object", width - 24);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.8);
  doc.roundedRect(x, y, width, height, 10, 10, "S");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(nameLines, x + 12, infoY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("T: " + formatTemperature(object.temperature), x + 12, y + 36);
  doc.text("Peak: " + formatPeakNm(object.peakNm), x + 12, y + 49);

  if (object.imageDataUrl) {
    var placement = getFittedPdfImageBox(doc, object.imageDataUrl, x + 12, imageY, imageWidth, imageHeight);
    doc.addImage(
      object.imageDataUrl,
      getImageFormat(object.imageDataUrl),
      placement.x,
      placement.y,
      placement.width,
      placement.height,
    );
  } else {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x + 12, imageY, imageWidth, imageHeight, 8, 8, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x + 12, imageY, imageWidth, imageHeight, 8, 8, "S");
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "italic");
    doc.text("No uploaded image", x + width / 2, imageY + imageHeight / 2, {
      align: "center",
    });
  }
}

function drawObjectImagesSection(doc, objects, pageWidth) {
  var cardWidth = 248;
  var cardHeight = 178;
  var gap = 19;
  var sectionY;
  var index;

  doc.addPage();
  sectionY = drawPdfSectionHeader(
    doc,
    "Section 2  Images of Objects",
    "Uploaded object images used as references in the investigation.",
    56,
    pageWidth,
  );

  for (index = 0; index < objects.length; index += 1) {
    var slot = index % 4;
    var column = slot % 2;
    var row = Math.floor(slot / 2);
    var x;
    var y;

    if (slot === 0 && index !== 0) {
      doc.addPage();
      sectionY = drawPdfSectionHeader(
        doc,
        "Section 2  Images of Objects (cont.)",
        "",
        56,
        pageWidth,
      );
    }

    x = 40 + column * (cardWidth + gap);
    y = sectionY + row * (cardHeight + 18);
    drawObjectImageCard(doc, objects[index], x, y, cardWidth, cardHeight);
  }
}

function drawGraphSection(doc, graphImage, pageWidth) {
  var sectionY;
  var graphWidth = pageWidth - 80;
  var graphHeight = Math.round((graphWidth * 800) / 1400);

  doc.addPage();
  sectionY = drawPdfSectionHeader(
    doc,
    "Section 3  Blackbody Radiation Graph",
    "Combined spectrum graph exported from the live Plotly visualization.",
    56,
    pageWidth,
  );
  doc.addImage(graphImage, "PNG", 40, sectionY, graphWidth, graphHeight);

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    "Blackbody Radiation Spectrum showing all generated curves and peak wavelength markers.",
    40,
    sectionY + graphHeight + 22,
  );
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
    var graphImage;
    var reportDate = formatReportDate(new Date());
    var studentName = getStudentName();

    drawPdfTitlePage(doc, pageWidth, pageHeight, reportDate, studentName);
    drawObjectsTableSection(doc, generatedObjects, pageWidth, pageHeight);
    drawObjectImagesSection(doc, generatedObjects, pageWidth);
    graphImage = await createCurrentGraphImage();
    drawGraphSection(doc, graphImage, pageWidth);
    finalizePdfFooters(doc, pageWidth, pageHeight);

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
  renderObjectList();
  renderGraph();

  elements.addObjectButton.addEventListener("click", addObject);
  elements.loadExamplesButton.addEventListener("click", loadExampleData);
  elements.resetObjectsButton.addEventListener("click", resetObjects);
  elements.generatePdfButton.addEventListener("click", generatePdfReport);
  window.addEventListener("resize", handleWindowResize);
}

initialize();
