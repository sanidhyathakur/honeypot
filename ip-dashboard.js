// Global state
let currentIP = null;
let map = null;
let markers = {};
let markerCluster = null;
let isClusteringEnabled = true;
let ipCache = new Map();
let attemptCounts = new Map();

// Configuration
const CONFIG = {
  refreshInterval: 10000, // 10 seconds
  ipInfoEndpoint: "https://ipinfo.io/json",
  defaultMapCenter: [20, 0],
  defaultZoom: 2,
  clusterOptions: {
    maxClusterRadius: 50,
    disableClusteringAtZoom: 8,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
  },
};

// Initialize the dashboard
document.addEventListener("DOMContentLoaded", function () {
  initializeMap();
  setupEventListeners();
  loadInitialData();
  startRealTimeUpdates();
});

// Initialize Leaflet map
function initializeMap() {
  try {
    map = L.map("ipMap", {
      minZoom: 2,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: true,
    }).setView(CONFIG.defaultMapCenter, CONFIG.defaultZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    markerCluster = L.markerClusterGroup(CONFIG.clusterOptions);
    map.addLayer(markerCluster);
  } catch (error) {
    console.error("Error initializing map:", error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Refresh button
  document
    .getElementById("refreshData")
    .addEventListener("click", loadInitialData);

  // Center map button
  document.getElementById("centerMap").addEventListener("click", function () {
    if (map) map.setView(CONFIG.defaultMapCenter, CONFIG.defaultZoom);
  });

  // Toggle clustering button
  document
    .getElementById("toggleCluster")
    .addEventListener("click", toggleClustering);

  // Close modal button
  document.querySelector(".modal-close").addEventListener("click", function () {
    document.getElementById("imageModal").style.display = "none";
  });

  // Close modal when clicking outside
  document.getElementById("imageModal").addEventListener("click", function (e) {
    if (e.target === this) {
      this.style.display = "none";
    }
  });
}

// Toggle clustering
function toggleClustering() {
  if (!map || !markerCluster) return;

  isClusteringEnabled = !isClusteringEnabled;
  const button = document.getElementById("toggleCluster");

  if (isClusteringEnabled) {
    button.textContent = "Disable Clustering";
    Object.values(markers).forEach((marker) => {
      map.removeLayer(marker);
      markerCluster.addLayer(marker);
    });
  } else {
    button.textContent = "Enable Clustering";
    markerCluster.eachLayer((marker) => {
      markerCluster.removeLayer(marker);
      map.addLayer(marker);
    });
  }
}

// Load initial data
async function loadInitialData() {
  try {
    // Load current IP data
    const ipData = await fetchIPData();
    updateIPDetails(ipData);
    addIPToMap(ipData);

    // Load intruder data
    const intruders = await fetchIntruders();
    updateIntruderMarkers(intruders);
    updateImageGallery(intruders);
    updateDashboardStats();

    // Load attempt counts
    updateAttemptCounts();
  } catch (error) {
    console.error("Error loading initial data:", error);
  }
}

// Fetch IP data
async function fetchIPData() {
  try {
    // Check cache first
    if (ipCache.has("self")) {
      const cachedData = ipCache.get("self");
      return cachedData;
    }

    const response = await fetch(CONFIG.ipInfoEndpoint);
    if (!response.ok)
      throw new Error(`Server responded with ${response.status}`);

    const data = await response.json();
    data.timestamp = new Date().toISOString();

    // Cache the result
    ipCache.set("self", data);

    return data;
  } catch (error) {
    console.error("Error fetching IP information:", error);
    throw error;
  }
}

// Fetch intruder data from localStorage
async function fetchIntruders() {
  try {
    const intruders = JSON.parse(localStorage.getItem("intruders") || "[]");
    return intruders;
  } catch (error) {
    console.error("Error fetching intruders:", error);
    return [];
  }
}

// Update IP details in the panel
function updateIPDetails(data) {
  document.getElementById("ipAddress").textContent = data.ip || "-";
  document.getElementById("ipLocation").textContent = data.loc || "-";
  document.getElementById("ipCountry").textContent = data.country || "-";
  document.getElementById("ipOrg").textContent = data.org || "-";
  document.getElementById("ipRegion").textContent = data.region || "-";
  document.getElementById("ipCity").textContent = data.city || "-";
  document.getElementById("ipPostal").textContent = data.postal || "-";

  currentIP = data.ip;
}

// Add IP marker to map
function addIPToMap(data) {
  if (!map) return;

  try {
    const locationStr = data.loc || "0,0";
    let [lat, lon] = locationStr.split(",").map(Number);

    if (isNaN(lat) || isNaN(lon)) {
      lat = 0;
      lon = 0;
    }

    // Remove existing marker if present
    if (markers[data.ip]) {
      if (isClusteringEnabled) {
        markerCluster.removeLayer(markers[data.ip]);
      } else {
        map.removeLayer(markers[data.ip]);
      }
    }

    const marker = L.marker([lat, lon], {
      icon: createMarkerIcon(0),
      data: data,
    });

    marker.bindPopup(createPopupContent(data, 0));

    if (isClusteringEnabled) {
      markerCluster.addLayer(marker);
    } else {
      marker.addTo(map);
    }

    markers[data.ip] = marker;

    // Center map on first load
    if (Object.keys(markers).length === 1) {
      map.setView([lat, lon], 6);
    }
  } catch (error) {
    console.error("Error adding IP to map:", error);
  }
}

// Update all intruder markers on the map
function updateIntruderMarkers(intruders) {
  if (!map) return;

  // First update attempt counts
  updateAttemptCounts();

  intruders.forEach((intruder) => {
    const attempts = attemptCounts.get(intruder.ip) || 0;
    const [lat, lon] = intruder.location?.split(",").map(Number) || [0, 0];

    if (markers[intruder.ip]) {
      // Update existing marker
      markers[intruder.ip].setLatLng([lat, lon]);
      markers[intruder.ip].setIcon(createMarkerIcon(attempts));
      markers[intruder.ip].setPopupContent(
        createPopupContent(intruder, attempts)
      );
    } else {
      // Create new marker
      const marker = L.marker([lat, lon], {
        icon: createMarkerIcon(attempts),
        data: intruder,
      });

      marker.bindPopup(createPopupContent(intruder, attempts));

      if (isClusteringEnabled) {
        markerCluster.addLayer(marker);
      } else {
        marker.addTo(map);
      }

      markers[intruder.ip] = marker;
    }
  });
}

// Create custom marker icon based on attempt count
function createMarkerIcon(attempts) {
  let color = "#2ecc71"; // Green - safe
  if (attempts > 0 && attempts < 3) {
    color = "#f39c12"; // Orange - warning
  } else if (attempts >= 3) {
    color = "#e74c3c"; // Red - danger
  }

  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color:${color}">${
      attempts > 0 ? attempts : ""
    }</div>`,
    iconSize: [24, 24],
  });
}

// Create popup content for markers
function createPopupContent(data, attempts) {
  return `
    <div class="map-popup">
      <strong>${data.ip}</strong><br>
      ${data.city ? data.city + ", " : ""}${data.country || "Unknown"}<br>
      ${data.org || "Unknown Organization"}<br>
      <small>${new Date(data.timestamp).toLocaleString()}</small>
      ${attempts > 0 ? `<div class="attempts">Attempts: ${attempts}</div>` : ""}
      ${
        data.imageData || data.imagePath
          ? '<div class="has-image">Photo Available</div>'
          : ""
      }
    </div>
  `;
}

// Update attempt counts from localStorage
function updateAttemptCounts() {
  try {
    const attemptsData = JSON.parse(
      localStorage.getItem("loginAttempts") || "{}"
    );
    attemptCounts = new Map();

    for (const [ip, data] of Object.entries(attemptsData)) {
      attemptCounts.set(ip, data.count || 0);
    }
  } catch (error) {
    console.error("Error updating attempt counts:", error);
  }
}

// Update dashboard statistics
function updateDashboardStats() {
  const intruders = Object.values(markers).map((marker) => marker.options.data);

  // Total unique IPs
  const totalIPs = intruders.length;
  document.getElementById("totalIPs").textContent = totalIPs;

  // Suspicious IPs (with 1+ attempts)
  const suspiciousIPs = intruders.filter((i) => {
    const attempts = attemptCounts.get(i.ip) || 0;
    return attempts > 0;
  }).length;
  document.getElementById("suspiciousIPs").textContent = suspiciousIPs;

  // Blocked IPs
  const blockedIPs = intruders.filter((i) => i.blocked).length;
  document.getElementById("blockedIPs").textContent = blockedIPs;

  // Captured images count
  const capturedImages = intruders.filter(
    (i) => i.imageData || i.imagePath
  ).length;
  document.getElementById("capturedImages").textContent = capturedImages;
}

// Update image gallery with captured images
function updateImageGallery(intruders) {
  const gallery = document.getElementById("imageGallery");
  gallery.innerHTML = "";

  const images = intruders.filter((i) => i.imageData || i.imagePath);

  if (images.length === 0) {
    document.getElementById("noImagesMessage").style.display = "flex";
    return;
  }

  document.getElementById("noImagesMessage").style.display = "none";
  images.forEach((intruder) =>
    gallery.appendChild(createGalleryItem(intruder))
  );
}

function createGalleryItem(intruder) {
  const item = document.createElement("div");
  item.className = "gallery-item";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.alt = `Intruder at ${intruder.ip}`;

  // Handle both server-stored and base64 images
  if (intruder.imagePath) {
    img.src = `/uploads/${intruder.imagePath.split("/").pop()}`;
  } else if (intruder.imageData) {
    img.src = intruder.imageData;
  }

  const info = document.createElement("div");
  info.className = "image-info";
  info.innerHTML = `
    <div class="image-ip">${intruder.ip}</div>
    <div class="image-time">${new Date(
      intruder.timestamp
    ).toLocaleString()}</div>
    <div class="image-location">${intruder.city || ""}${
    intruder.city && intruder.country ? ", " : ""
  }${intruder.country || ""}</div>
  `;

  item.appendChild(img);
  item.appendChild(info);

  item.addEventListener("click", () => showImageModal(intruder));
  return item;
}

function showImageModal(intruder) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  const modalCaption = document.getElementById("modalCaption");

  if (intruder.imagePath) {
    modalImg.src = `/uploads/${intruder.imagePath.split("/").pop()}`;
  } else {
    modalImg.src = intruder.imageData;
  }

  modalCaption.innerHTML = `
    <strong>${intruder.ip}</strong>
    <div>${intruder.city || ""}${
    intruder.city && intruder.country ? ", " : ""
  }${intruder.country || ""}</div>
    <small>${new Date(intruder.timestamp).toLocaleString()}</small>
  `;

  modal.style.display = "flex";
}

// Handle real-time updates
function startRealTimeUpdates() {
  // Check for updates every 5 seconds
  setInterval(async () => {
    const intruders = await fetchIntruders();
    updateIntruderMarkers(intruders);
    updateDashboardStats();
    updateImageGallery(intruders);
  }, 5000);

  // Listen for storage events
  window.addEventListener("storage", (event) => {
    if (event.key === "intruders" || event.key === "loginAttempts") {
      loadInitialData();
    }
  });

  // Listen for messages from login page
  window.addEventListener("message", (event) => {
    if (event.data.type === "newIntruder") {
      addOrUpdateIntruder(event.data.data);
    } else if (event.data.type === "failedAttempt") {
      updateAttemptCounts();
      updateDashboardStatsWithAnimation();
    }
  });
}

function addOrUpdateIntruder(intruderData) {
  const [lat, lon] = intruderData.location?.split(",").map(Number) || [0, 0];
  const attempts = attemptCounts.get(intruderData.ip) || 0;

  // Update or create marker
  if (markers[intruderData.ip]) {
    markers[intruderData.ip].setLatLng([lat, lon]);
    markers[intruderData.ip].setIcon(createMarkerIcon(attempts));
    markers[intruderData.ip].setPopupContent(
      createPopupContent(intruderData, attempts)
    );
  } else {
    const marker = L.marker([lat, lon], {
      icon: createMarkerIcon(attempts),
      data: intruderData,
    });

    marker.bindPopup(createPopupContent(intruderData, attempts));
    markerCluster.addLayer(marker);
    markers[intruderData.ip] = marker;
  }

  // Update stats with animation
  updateDashboardStatsWithAnimation();

  // Update image gallery if this intruder has an image
  if (intruderData.imageData || intruderData.imagePath) {
    const intruders = Object.values(markers).map((m) => m.options.data);
    updateImageGallery(intruders);
  }
}

function updateDashboardStatsWithAnimation() {
  const stats = ["totalIPs", "suspiciousIPs", "blockedIPs", "capturedImages"];

  stats.forEach((stat) => {
    const element = document.getElementById(stat);
    element.classList.add("updated");

    setTimeout(() => {
      element.classList.remove("updated");
    }, 500);
  });

  // Highlight high-risk stats
  const suspiciousCount = parseInt(
    document.getElementById("suspiciousIPs").textContent
  );
  if (suspiciousCount > 0) {
    document.getElementById("suspiciousIPs").classList.add("high-risk-stat");
  } else {
    document.getElementById("suspiciousIPs").classList.remove("high-risk-stat");
  }
}
