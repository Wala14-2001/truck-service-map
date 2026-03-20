import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SERVICE_MARKER_ICONS, USE_MY_LOCATION_ICON } from "./assets/icons/map-icons.js";

const SUPABASE_URL = "https://jpuyuvbqeuhkebqtjubj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwdXl1dmJxZXVoa2VicXRqdWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMzM4MTcsImV4cCI6MjA4ODYwOTgxN30.fCf6ZJeOfEsiScA_p65G97yOfJdQrIixjzvp8G9KzP8";
const EMPTY_VALUE = "-";
const NEARBY_RADIUS_MILES = 100;
const MAX_NEAREST_SERVICES = 5;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const map = L.map("map").setView([33.749, -84.388], 9);
map.attributionControl.setPrefix("");

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);

const serviceCard = document.getElementById("serviceCard");
const mapOverlayBadge = document.getElementById("mapOverlayBadge");

const checkinModal = document.getElementById("checkinModal");
const closeModal = document.getElementById("closeModal");
const checkinForm = document.getElementById("checkinForm");
const selectedServiceName = document.getElementById("selectedServiceName");
const formMessage = document.getElementById("formMessage");
const submitCheckinBtn = document.getElementById("submitCheckinBtn");

const addServiceModal = document.getElementById("addServiceModal");
const openAddServiceBtn = document.getElementById("openAddServiceBtn");
const closeAddServiceModal = document.getElementById("closeAddServiceModal");
const addServiceForm = document.getElementById("addServiceForm");
const addServiceMessage = document.getElementById("addServiceMessage");
const submitAddServiceBtn = document.getElementById("submitAddServiceBtn");

const filterChips = document.querySelectorAll(".filter-chip[data-filter]");
const openNowFilterBtn = document.getElementById("openNowFilterBtn");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const toggleFiltersBtn = document.getElementById("toggleFiltersBtn");
const filtersContent = document.getElementById("filtersContent");
const shopSearchInput = document.getElementById("shopSearch");
const shopSearchClearBtn = document.getElementById("shopSearchClearBtn");
const searchInput = document.getElementById("locationSearch");
const searchBtn = document.getElementById("searchBtn");
const searchStatus = document.getElementById("searchStatus");
const useMyLocationBtn = document.getElementById("useMyLocationBtn");
const searchAreaBtn = document.getElementById("searchAreaBtn");
const nearestServicesContent = document.getElementById("nearestServicesContent");
const nearestServicesHint = document.getElementById("nearestServicesHint");
const nearestServicesList = document.getElementById("nearestServicesList");
const toggleNearestBtn = document.getElementById("toggleNearestBtn");

let selectedShop = null;
let allServices = [];
let activeFilters = new Set();
let shopSearchQuery = "";
let nearbyMode = false;
let nearbyCenter = null;
let userLocation = null;
let openNowOnly = false;
let nearestCollapsed = true;
let visibleServices = [];
let isProgrammaticMapMove = false;
let mapAreaFilterBounds = null;
let pendingFocusServiceId = null;
let hasInitializedViewport = false;
let filtersCollapsed = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[char];
  });
}

function formatValue(value) {
  if (value === null || value === undefined) return EMPTY_VALUE;

  const trimmedValue = String(value).trim();
  return trimmedValue ? escapeHtml(trimmedValue) : EMPTY_VALUE;
}

function cleanPhoneForTel(phone = "") {
  return phone.replace(/[^+\d]/g, "");
}

function isValidPhone(phone) {
  if (!phone) return false;
  return phone.replace(/\D/g, "").length >= 10;
}

function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function validateCheckinForm() {
  const driverName = document.getElementById("driverName").value.trim();
  const driverPhone = document.getElementById("driverPhone").value.trim();

  if (!driverName) return "Driver name is required.";
  if (!isValidPhone(driverPhone)) return "Enter a valid phone number with at least 10 digits.";

  return "";
}

function validateAddServiceForm() {
  const shopName = document.getElementById("shopName").value.trim();
  const shopAddress = document.getElementById("shopAddress").value.trim();
  const shopPhone = document.getElementById("shopPhone").value.trim();
  const lat = Number(document.getElementById("shopLat").value);
  const lng = Number(document.getElementById("shopLng").value);

  if (!shopName) return "Shop name is required.";
  if (!shopAddress) return "Address is required.";
  if (shopPhone && !isValidPhone(shopPhone)) {
    return "Enter a valid shop phone number with at least 10 digits, or leave it blank.";
  }
  if (!isValidLatitude(lat)) return "Latitude must be between -90 and 90.";
  if (!isValidLongitude(lng)) return "Longitude must be between -180 and 180.";

  return "";
}

function openCheckinModal() {
  checkinModal.classList.add("show");
}

function closeCheckinModal() {
  checkinModal.classList.remove("show");
}

function openServiceModal() {
  addServiceModal.classList.add("show");
}

function closeServiceModal() {
  addServiceModal.classList.remove("show");
}

function showCheckinMessage(text, isError = false) {
  formMessage.textContent = text;
  formMessage.style.color = isError ? "#b91c1c" : "#065f46";
}

function showAddServiceMessage(text, isError = false) {
  addServiceMessage.textContent = text;
  addServiceMessage.style.color = isError ? "#b91c1c" : "#065f46";
}

function getRepairCategories(shop) {
  const categories = [];

  if (shop.engine_repair) categories.push("Engine repair");
  if (shop.transmission) categories.push("Transmission");
  if (shop.electrical) categories.push("Electrical");
  if (shop.brakes) categories.push("Brakes");
  if (shop.tires) categories.push("Tires");
  if (shop.trailer_repair) categories.push("Trailer repair");
  if (shop.diagnostics) categories.push("Diagnostics");
  if (shop.services && shop.services.trim()) categories.push(shop.services.trim());

  return categories;
}

function getServiceTypes(shop) {
  const types = [];

  if (shop.roadside_service) types.push("Roadside service");
  if (shop.mobile_mechanic) types.push("Mobile mechanic");
  if (shop.towing_service) types.push("Towing");

  return types;
}

function getAvailability(shop) {
  const availability = [];

  if (shop.open_24_7) {
    availability.push("Open 24/7");
  } else if (shop.hours) {
    availability.push(shop.hours);
  }

  return availability;
}

function renderTags(items) {
  if (!items.length) return EMPTY_VALUE;

  return `
    <div class="tag-list">
      ${items.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function formatDistanceMiles(distanceMiles) {
  if (!Number.isFinite(distanceMiles)) return EMPTY_VALUE;
  return `${distanceMiles.toFixed(1)} mi`;
}

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function getDistanceMiles(lat1, lon1, lat2, lon2) {
  const earthRadiusMiles = 3958.8;
  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function toMinutesSinceMidnight(hours, minutes) {
  return hours * 60 + minutes;
}

function parseTimeString(rawValue) {
  const trimmed = rawValue.trim().toLowerCase();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);

  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  const period = match[3];

  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;

  return toMinutesSinceMidnight(hours, minutes);
}

function getTodayScheduleRange(hoursText) {
  if (!hoursText) return null;

  const normalized = hoursText.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("24/7")) {
    return { openMinutes: 0, closeMinutes: 1440, alwaysOpen: true };
  }

  const match = normalized.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/);
  if (!match) return null;

  const openMinutes = parseTimeString(match[1]);
  const closeMinutes = parseTimeString(match[2]);

  if (openMinutes === null || closeMinutes === null) return null;

  return { openMinutes, closeMinutes, alwaysOpen: false };
}

function getServiceOpenStatus(shop) {
  if (shop.open_24_7) {
    return { label: "Open now", className: "status-open", isOpen: true };
  }

  const range = getTodayScheduleRange(shop.hours || "");
  if (!range) {
    return { label: "Hours unavailable", className: "status-unknown", isOpen: false };
  }

  if (range.alwaysOpen) {
    return { label: "Open now", className: "status-open", isOpen: true };
  }

  const now = new Date();
  const currentMinutes = toMinutesSinceMidnight(now.getHours(), now.getMinutes());
  const isOpen =
    range.openMinutes <= range.closeMinutes
      ? currentMinutes >= range.openMinutes && currentMinutes <= range.closeMinutes
      : currentMinutes >= range.openMinutes || currentMinutes <= range.closeMinutes;

  return {
    label: isOpen ? "Open now" : "Closed now",
    className: isOpen ? "status-open" : "status-closed",
    isOpen
  };
}

function getServiceDistance(shop) {
  if (!userLocation) return null;

  return getDistanceMiles(
    userLocation.lat,
    userLocation.lng,
    Number(shop.lat),
    Number(shop.lng)
  );
}

function getMarkerVariant(shop) {
  if (shop.towing_service) return "towing";
  if (shop.roadside_service || shop.mobile_mechanic) return "roadside";
  if (shop.verified) return "verified";
  return "regular";
}

function createMarkerIcon(shop) {
  const variant = getMarkerVariant(shop);

  return L.icon({
    iconUrl: SERVICE_MARKER_ICONS[variant],
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -34]
  });
}

function applyUseMyLocationIcon() {
  useMyLocationBtn.style.setProperty("--location-icon", `url("${USE_MY_LOCATION_ICON}")`);
}

function setProgrammaticMapView(callback) {
  isProgrammaticMapMove = true;
  callback();
  window.setTimeout(() => {
    isProgrammaticMapMove = false;
  }, 250);
}

function updateMapOverlay() {
  if (mapAreaFilterBounds) {
    mapOverlayBadge.textContent = "Showing services in this map area";
    mapOverlayBadge.classList.remove("hidden");
    return;
  }

  if (userLocation) {
    mapOverlayBadge.textContent = "Using your current location";
    mapOverlayBadge.classList.remove("hidden");
    return;
  }

  mapOverlayBadge.classList.add("hidden");
}

function getNearestBadges(shop) {
  const badges = [];

  if (shop.verified) badges.push("Verified");
  if (shop.roadside_service || shop.mobile_mechanic) badges.push("Mobile");
  if (shop.towing_service) badges.push("Towing");

  return badges;
}

function renderNearestServices(services) {
  if (nearestCollapsed) {
    nearestServicesContent.classList.add("hidden");
    toggleNearestBtn.textContent = "Show";
    return;
  }

  nearestServicesContent.classList.remove("hidden");
  toggleNearestBtn.textContent = "Hide";

  if (!userLocation) {
    nearestServicesHint.textContent = "Use your location to see the closest services.";
    nearestServicesHint.classList.remove("hidden");
    nearestServicesList.innerHTML = "";
    return;
  }

  const nearest = services
    .map((shop) => ({ shop, distance: getServiceDistance(shop) }))
    .filter((item) => Number.isFinite(item.distance))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, MAX_NEAREST_SERVICES);

  if (!nearest.length) {
    nearestServicesHint.textContent = "No nearby services match the current filters.";
    nearestServicesHint.classList.remove("hidden");
    nearestServicesList.innerHTML = "";
    return;
  }

  nearestServicesHint.classList.add("hidden");
  nearestServicesList.innerHTML = nearest
    .map(({ shop, distance }) => {
      const badges = getNearestBadges(shop);
      const openStatus = getServiceOpenStatus(shop);

      return `
        <button class="nearest-service-item" type="button" data-service-id="${shop.id}">
          <div class="nearest-service-top">
            <div class="nearest-service-name">${formatValue(shop.name)}</div>
            <div class="nearest-service-distance">${formatDistanceMiles(distance)}</div>
          </div>
          <div class="nearest-service-meta">${escapeHtml(openStatus.label)} - ${formatValue(shop.address)}</div>
          <div class="nearest-badges">
            ${badges.map((badge) => `<span class="nearest-badge">${escapeHtml(badge)}</span>`).join("")}
          </div>
        </button>
      `;
    })
    .join("");

  nearestServicesList.querySelectorAll("[data-service-id]").forEach((element) => {
    element.addEventListener("click", () => {
      const serviceId = element.dataset.serviceId;
      const shop = visibleServices.find((item) => String(item.id) === String(serviceId));

      if (!shop) return;

      setProgrammaticMapView(() => {
        map.setView([shop.lat, shop.lng], 11);
      });
      updateServiceCard(shop);
    });
  });
}

function resetServiceCard() {
  serviceCard.innerHTML = `
    <div class="service-name">No service selected</div>
    <div class="verified-badge-placeholder">-</div>
    <div class="service-row"><span>Address:</span> -</div>
    <div class="service-row"><span>Phone:</span> -</div>
    <div class="service-row"><span>Services:</span> -</div>
    <div class="service-row"><span>Service Types:</span> -</div>
    <div class="service-row"><span>Availability:</span> -</div>
    <div class="service-row"><span>Status:</span> Hours unavailable</div>
    <div class="service-row"><span>Distance:</span> -</div>
    <div class="service-row"><span>Hourly Rate:</span> -</div>
    <div class="service-row"><span>Diagnostic Price:</span> -</div>
    <div class="service-row"><span>Hours:</span> -</div>

    <div class="button-group">
      <a class="action-btn disabled" href="#">Call</a>
      <a class="action-btn disabled" href="#">Navigate</a>
      <button class="action-btn disabled" type="button">Check-In</button>
    </div>
  `;
}

function updateServiceCard(shop) {
  selectedShop = shop;
  selectedServiceName.textContent = shop.name;

  const repairCategories = getRepairCategories(shop);
  const serviceTypes = getServiceTypes(shop);
  const availability = getAvailability(shop);
  const verifiedBadge = shop.verified
    ? `<div class="verified-badge">Verified Shop</div>`
    : `<div class="verified-badge-placeholder">Standard listing</div>`;
  const openStatus = getServiceOpenStatus(shop);
  const distance = getServiceDistance(shop);

  serviceCard.innerHTML = `
    <div class="service-name">${formatValue(shop.name)}</div>
    ${verifiedBadge}
    <div class="service-row"><span>Address:</span> ${formatValue(shop.address)}</div>
    <div class="service-row"><span>Phone:</span> ${formatValue(shop.phone)}</div>
    <div class="service-row"><span>Services:</span> ${renderTags(repairCategories)}</div>
    <div class="service-row"><span>Service Types:</span> ${renderTags(serviceTypes)}</div>
    <div class="service-row"><span>Availability:</span> ${renderTags(availability)}</div>
    <div class="service-row"><span>Status:</span> <span class="${openStatus.className}">${escapeHtml(openStatus.label)}</span></div>
    <div class="service-row"><span>Distance:</span> ${distance === null ? EMPTY_VALUE : formatDistanceMiles(distance)}</div>
    <div class="service-row"><span>Hourly Rate:</span> ${formatValue(shop.hourly_rate)}</div>
    <div class="service-row"><span>Diagnostic Price:</span> ${formatValue(shop.diagnostic_price)}</div>
    <div class="service-row"><span>Hours:</span> ${formatValue(shop.hours)}</div>

    <div class="button-group">
      <a class="action-btn" href="tel:${cleanPhoneForTel(shop.phone || "")}">Call</a>
      <a class="action-btn" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shop.address || "")}" target="_blank">Navigate</a>
      <button class="action-btn" id="checkInBtn" type="button">Check-In</button>
    </div>
  `;

  const checkInBtn = document.getElementById("checkInBtn");
  checkInBtn.addEventListener("click", () => {
    showCheckinMessage("");
    openCheckinModal();
  });
}

function serviceMatchesFilters(shop) {
  if (activeFilters.size === 0) return true;
  return [...activeFilters].every((filterKey) => Boolean(shop[filterKey]));
}

function serviceMatchesShopSearch(shop) {
  if (!shopSearchQuery) return true;

  const repairCategories = getRepairCategories(shop).join(" ").toLowerCase();
  const serviceTypes = getServiceTypes(shop).join(" ").toLowerCase();

  return [
    shop.name || "",
    shop.address || "",
    shop.phone || "",
    shop.services || "",
    repairCategories,
    serviceTypes,
    shop.hours || ""
  ]
    .join(" ")
    .toLowerCase()
    .includes(shopSearchQuery);
}

function serviceMatchesOpenNow(shop) {
  if (!openNowOnly) return true;
  return getServiceOpenStatus(shop).isOpen;
}

function serviceMatchesNearby(shop) {
  if (!nearbyMode || !nearbyCenter) return true;

  const distance = getDistanceMiles(
    nearbyCenter.lat,
    nearbyCenter.lng,
    Number(shop.lat),
    Number(shop.lng)
  );

  return distance <= NEARBY_RADIUS_MILES;
}

function serviceMatchesMapArea(shop) {
  if (!mapAreaFilterBounds) return true;
  return mapAreaFilterBounds.contains([Number(shop.lat), Number(shop.lng)]);
}

function getFilteredServices() {
  return allServices
    .filter(serviceMatchesFilters)
    .filter(serviceMatchesShopSearch)
    .filter(serviceMatchesOpenNow)
    .filter(serviceMatchesNearby)
    .filter(serviceMatchesMapArea);
}

function renderMarkers(shops) {
  markersLayer.clearLayers();

  const bounds = [];

  if (!shops.length) {
    if (!selectedShop || !visibleServices.some((item) => item.id === selectedShop.id)) {
      selectedShop = null;
      selectedServiceName.textContent = "No service selected";
      resetServiceCard();
    }
    return;
  }

  shops.forEach((shop) => {
    const repairCategories = getRepairCategories(shop);
    const serviceTypes = getServiceTypes(shop);
    const openStatus = getServiceOpenStatus(shop);
    const distance = getServiceDistance(shop);

    const popupHtml = `
      <div>
        <div class="popup-title">${formatValue(shop.name)}</div>
        <div class="popup-row"><span class="popup-label">Address:</span> ${formatValue(shop.address)}</div>
        <div class="popup-row"><span class="popup-label">Phone:</span> ${formatValue(shop.phone)}</div>
        <div class="popup-row"><span class="popup-label">Services:</span> ${repairCategories.length ? escapeHtml(repairCategories.join(", ")) : EMPTY_VALUE}</div>
        <div class="popup-row"><span class="popup-label">Type:</span> ${serviceTypes.length ? escapeHtml(serviceTypes.join(", ")) : EMPTY_VALUE}</div>
        <div class="popup-row"><span class="popup-label">Status:</span> ${escapeHtml(openStatus.label)}</div>
        <div class="popup-row"><span class="popup-label">Distance:</span> ${distance === null ? EMPTY_VALUE : formatDistanceMiles(distance)}</div>
      </div>
    `;

    const marker = L.marker([shop.lat, shop.lng], {
      title: shop.verified ? `${shop.name} (Verified)` : shop.name,
      icon: createMarkerIcon(shop)
    });

    marker.bindPopup(popupHtml);
    marker.on("click", () => {
      updateServiceCard(shop);
    });

    marker.addTo(markersLayer);
    bounds.push([shop.lat, shop.lng]);
  });

  if (pendingFocusServiceId) {
    const focusShop = shops.find((shop) => String(shop.id) === String(pendingFocusServiceId));
    if (focusShop) {
      pendingFocusServiceId = null;
      setProgrammaticMapView(() => {
        map.setView([focusShop.lat, focusShop.lng], 11);
      });
      updateServiceCard(focusShop);
      return;
    }
  }

  if (selectedShop) {
    const stillVisible = shops.find((shop) => String(shop.id) === String(selectedShop.id));
    if (stillVisible) {
      updateServiceCard(stillVisible);
    }
  }

  const shouldAutoFitBounds =
    bounds.length > 0 &&
    !mapAreaFilterBounds &&
    !nearbyMode &&
    !userLocation &&
    !hasInitializedViewport;

  if (shouldAutoFitBounds) {
    setProgrammaticMapView(() => {
      map.fitBounds(bounds, { padding: [50, 50] });
    });
    hasInitializedViewport = true;
  }
}

function updateSearchStatus(count) {
  if (count === 0) {
    if (mapAreaFilterBounds) {
      searchStatus.textContent = "No services found in the current map area.";
      return;
    }

    if (nearbyMode && nearbyCenter) {
      searchStatus.textContent = `No services found within ${NEARBY_RADIUS_MILES} miles.`;
      return;
    }

    searchStatus.textContent = "No services found.";
    return;
  }

  const statusParts = [nearbyMode && nearbyCenter
    ? `Showing ${count} services within ${NEARBY_RADIUS_MILES} miles`
    : `Showing ${count} services`];

  if (openNowOnly) statusParts.push("Open Now only");
  if (mapAreaFilterBounds) statusParts.push("current map area");

  searchStatus.textContent = statusParts.join(" - ");
}

function applyAllFilters() {
  visibleServices = getFilteredServices();
  renderMarkers(visibleServices);
  renderNearestServices(visibleServices);
  updateMapOverlay();
  updateSearchStatus(visibleServices.length);
}

function focusOnUserLocation() {
  if (!userLocation) return;
  setProgrammaticMapView(() => {
    map.setView([userLocation.lat, userLocation.lng], 11);
  });
}

async function loadServices() {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("verified", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading services:", error);
    alert("Could not load services from Supabase. Check your URL, key, and RLS policies.");
    return;
  }

  allServices = data || [];
  applyAllFilters();
}

async function searchLocation(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

  searchBtn.disabled = true;
  searchBtn.textContent = "Searching...";
  searchStatus.textContent = "Looking up location...";

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Location lookup failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      searchStatus.textContent = "Location not found.";
      return;
    }

    const lat = Number(data[0].lat);
    const lon = Number(data[0].lon);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      throw new Error("Location lookup returned invalid coordinates.");
    }

    nearbyMode = true;
    nearbyCenter = { lat, lng: lon };
    mapAreaFilterBounds = null;
    searchAreaBtn.classList.add("hidden");
    hasInitializedViewport = true;

    setProgrammaticMapView(() => {
      map.setView([lat, lon], 10);
    });
    applyAllFilters();
  } catch (error) {
    console.error("Error looking up location:", error);
    searchStatus.textContent = "Could not search for that location right now.";
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = "Search";
  }
}

function applyCurrentMapArea() {
  nearbyMode = false;
  nearbyCenter = null;
  mapAreaFilterBounds = map.getBounds();
  searchAreaBtn.classList.add("hidden");
  hasInitializedViewport = true;
  applyAllFilters();
}

function updateFiltersPanel() {
  filtersContent.classList.toggle("hidden", filtersCollapsed);
  toggleFiltersBtn.textContent = filtersCollapsed ? "Show" : "Hide";
}

function resetFiltersAndArea() {
  activeFilters.clear();
  filterChips.forEach((chip) => chip.classList.remove("active"));
  openNowOnly = false;
  openNowFilterBtn.classList.remove("active");
  nearbyMode = false;
  nearbyCenter = null;
  mapAreaFilterBounds = null;
  searchAreaBtn.classList.add("hidden");
  searchInput.value = "";
  hasInitializedViewport = false;
  applyAllFilters();
}

function requestUserLocation() {
  if (!navigator.geolocation) {
    searchStatus.textContent = "Geolocation is not supported in this browser.";
    return;
  }

  useMyLocationBtn.disabled = true;
  useMyLocationBtn.textContent = "Locating...";
  searchStatus.textContent = "Requesting your location...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      nearbyMode = true;
      nearbyCenter = { ...userLocation };
      mapAreaFilterBounds = null;
      searchAreaBtn.classList.add("hidden");
      hasInitializedViewport = true;

      focusOnUserLocation();
      applyAllFilters();

      useMyLocationBtn.disabled = false;
      useMyLocationBtn.textContent = "Use My Location";
    },
    (error) => {
      console.error("Error getting user location:", error);
      searchStatus.textContent = "Could not access your location. Check browser permissions.";
      useMyLocationBtn.disabled = false;
      useMyLocationBtn.textContent = "Use My Location";
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const filterKey = chip.dataset.filter;

    if (activeFilters.has(filterKey)) {
      activeFilters.delete(filterKey);
      chip.classList.remove("active");
    } else {
      activeFilters.add(filterKey);
      chip.classList.add("active");
    }

    applyAllFilters();
  });
});

openNowFilterBtn.addEventListener("click", () => {
  openNowOnly = !openNowOnly;
  openNowFilterBtn.classList.toggle("active", openNowOnly);
  applyAllFilters();
});

clearFiltersBtn.addEventListener("click", () => {
  resetFiltersAndArea();
});

shopSearchInput.addEventListener("input", () => {
  shopSearchQuery = shopSearchInput.value.trim().toLowerCase();
  applyAllFilters();
});

shopSearchClearBtn.addEventListener("click", () => {
  shopSearchQuery = "";
  shopSearchInput.value = "";
  applyAllFilters();
});

searchBtn.addEventListener("click", async () => {
  const query = searchInput.value.trim();
  if (!query) return;
  await searchLocation(query);
});

useMyLocationBtn.addEventListener("click", () => {
  requestUserLocation();
});

searchAreaBtn.addEventListener("click", () => {
  applyCurrentMapArea();
});

toggleFiltersBtn.addEventListener("click", () => {
  filtersCollapsed = !filtersCollapsed;
  updateFiltersPanel();
});

toggleNearestBtn.addEventListener("click", () => {
  nearestCollapsed = !nearestCollapsed;
  renderNearestServices(visibleServices);
});

closeModal.addEventListener("click", () => {
  closeCheckinModal();
});

checkinModal.addEventListener("click", (event) => {
  if (event.target === checkinModal) {
    closeCheckinModal();
  }
});

openAddServiceBtn.addEventListener("click", () => {
  showAddServiceMessage("");
  openServiceModal();
});

closeAddServiceModal.addEventListener("click", () => {
  closeServiceModal();
});

addServiceModal.addEventListener("click", (event) => {
  if (event.target === addServiceModal) {
    closeServiceModal();
  }
});

checkinForm.addEventListener("input", () => {
  if (formMessage.textContent) showCheckinMessage("");
});

addServiceForm.addEventListener("input", () => {
  if (addServiceMessage.textContent) showAddServiceMessage("");
});

checkinForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedShop) {
    showCheckinMessage("Please select a service first.", true);
    return;
  }

  const validationMessage = validateCheckinForm();
  if (validationMessage) {
    showCheckinMessage(validationMessage, true);
    return;
  }

  submitCheckinBtn.disabled = true;
  submitCheckinBtn.textContent = "Sending...";
  showCheckinMessage("");

  const payload = {
    service_id: selectedShop.id,
    driver_name: document.getElementById("driverName").value.trim(),
    phone: document.getElementById("driverPhone").value.trim(),
    truck: document.getElementById("truckField").value.trim(),
    trailer: document.getElementById("trailerField").value.trim(),
    problem: document.getElementById("problemField").value.trim(),
    eta: document.getElementById("etaField").value.trim()
  };

  const { error } = await supabase.from("checkins").insert([payload]);

  submitCheckinBtn.disabled = false;
  submitCheckinBtn.textContent = "Send Check-In";

  if (error) {
    console.error("Error saving check-in:", error);
    showCheckinMessage("Could not send check-in.", true);
    return;
  }

  showCheckinMessage("Check-in sent successfully");
  checkinForm.reset();

  setTimeout(() => {
    closeCheckinModal();
    showCheckinMessage("");
  }, 900);
});

addServiceForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const validationMessage = validateAddServiceForm();
  if (validationMessage) {
    showAddServiceMessage(validationMessage, true);
    return;
  }

  submitAddServiceBtn.disabled = true;
  submitAddServiceBtn.textContent = "Saving...";
  showAddServiceMessage("");

  const payload = {
    name: document.getElementById("shopName").value.trim(),
    address: document.getElementById("shopAddress").value.trim(),
    phone: document.getElementById("shopPhone").value.trim(),
    services: document.getElementById("shopServices").value.trim(),
    hourly_rate: document.getElementById("shopHourlyRate").value.trim(),
    diagnostic_price: document.getElementById("shopDiagnosticPrice").value.trim(),
    hours: document.getElementById("shopHours").value.trim(),
    lat: Number(document.getElementById("shopLat").value),
    lng: Number(document.getElementById("shopLng").value),
    engine_repair: document.getElementById("engineRepair").checked,
    transmission: document.getElementById("transmissionField").checked,
    electrical: document.getElementById("electricalField").checked,
    brakes: document.getElementById("brakesField").checked,
    tires: document.getElementById("tiresField").checked,
    trailer_repair: document.getElementById("trailerRepairField").checked,
    diagnostics: document.getElementById("diagnosticsField").checked,
    roadside_service: document.getElementById("roadsideServiceField").checked,
    mobile_mechanic: document.getElementById("mobileMechanicField").checked,
    towing_service: document.getElementById("towingServiceField").checked,
    open_24_7: document.getElementById("open247Field").checked,
    verified: document.getElementById("verifiedField").checked
  };

  const { data, error } = await supabase.from("services").insert([payload]).select();

  submitAddServiceBtn.disabled = false;
  submitAddServiceBtn.textContent = "Save Service";

  if (error) {
    console.error("Error saving service:", error);
    showAddServiceMessage("Could not save service.", true);
    return;
  }

  showAddServiceMessage("Service added successfully");
  addServiceForm.reset();

  if (data && data[0]) {
    pendingFocusServiceId = data[0].id;
  }

  await loadServices();

  setTimeout(() => {
    closeServiceModal();
    showAddServiceMessage("");
  }, 900);
});

map.on("moveend", () => {
  if (isProgrammaticMapMove) return;
  searchAreaBtn.classList.remove("hidden");
  if (mapAreaFilterBounds) {
    mapOverlayBadge.textContent = "Map moved - press Search This Area";
    mapOverlayBadge.classList.remove("hidden");
  }
});

resetServiceCard();
applyUseMyLocationIcon();
updateFiltersPanel();
renderNearestServices([]);
loadServices();
