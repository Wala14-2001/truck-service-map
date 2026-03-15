import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://jpuyuvbqeuhkebqtjubj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwdXl1dmJxZXVoa2VicXRqdWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMzM4MTcsImV4cCI6MjA4ODYwOTgxN30.fCf6ZJeOfEsiScA_p65G97yOfJdQrIixjzvp8G9KzP8";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const map = L.map("map").setView([33.7490, -84.3880], 9);
map.attributionControl.setPrefix("");

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);

const serviceCard = document.getElementById("serviceCard");

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

const filterChips = document.querySelectorAll(".filter-chip");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const shopSearchInput = document.getElementById("shopSearch");
const shopSearchClearBtn = document.getElementById("shopSearchClearBtn");


let selectedShop = null;
let allServices = [];
let activeFilters = new Set();
let shopSearchQuery = "";

function cleanPhoneForTel(phone = "") {
  return phone.replace(/[^+\d]/g, "");
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

  if (shop.services && shop.services.trim()) {
    categories.push(shop.services.trim());
  }

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
  if (!items.length) return "—";

  return `
    <div class="tag-list">
      ${items.map((item) => `<span class="tag">${item}</span>`).join("")}
    </div>
  `;
}

function resetServiceCard() {
  serviceCard.innerHTML = `
    <div class="service-name">No service selected</div>
    <div class="verified-badge-placeholder">—</div>
    <div class="service-row"><span>Address:</span> —</div>
    <div class="service-row"><span>Phone:</span> —</div>
    <div class="service-row"><span>Services:</span> —</div>
    <div class="service-row"><span>Service Types:</span> —</div>
    <div class="service-row"><span>Availability:</span> —</div>
    <div class="service-row"><span>Hourly Rate:</span> —</div>
    <div class="service-row"><span>Diagnostic Price:</span> —</div>
    <div class="service-row"><span>Hours:</span> —</div>

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

  serviceCard.innerHTML = `
    <div class="service-name">${shop.name}</div>
    ${verifiedBadge}
    <div class="service-row"><span>Address:</span> ${shop.address ?? "—"}</div>
    <div class="service-row"><span>Phone:</span> ${shop.phone ?? "—"}</div>
    <div class="service-row"><span>Services:</span> ${renderTags(repairCategories)}</div>
    <div class="service-row"><span>Service Types:</span> ${renderTags(serviceTypes)}</div>
    <div class="service-row"><span>Availability:</span> ${renderTags(availability)}</div>
    <div class="service-row"><span>Hourly Rate:</span> ${shop.hourly_rate ?? "—"}</div>
    <div class="service-row"><span>Diagnostic Price:</span> ${shop.diagnostic_price ?? "—"}</div>
    <div class="service-row"><span>Hours:</span> ${shop.hours ?? "—"}</div>

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

  const searchableText = [
    shop.name || "",
    shop.address || "",
    shop.phone || "",
    shop.services || "",
    repairCategories,
    serviceTypes,
    shop.hours || ""
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(shopSearchQuery);
}

function getFilteredServices() {
  return allServices
    .filter(serviceMatchesFilters)
    .filter(serviceMatchesShopSearch);
}

function renderMarkers(shops) {
  markersLayer.clearLayers();

  const bounds = [];

  if (!shops.length) {
    selectedShop = null;
    selectedServiceName.textContent = "No service selected";
    resetServiceCard();
    return;
  }

  shops.forEach((shop) => {
    const repairCategories = getRepairCategories(shop);
    const serviceTypes = getServiceTypes(shop);

    const popupHtml = `
      <div>
        <div class="popup-title">${shop.name}</div>
        <div class="popup-row"><span class="popup-label">Address:</span> ${shop.address ?? "—"}</div>
        <div class="popup-row"><span class="popup-label">Phone:</span> ${shop.phone ?? "—"}</div>
        <div class="popup-row"><span class="popup-label">Services:</span> ${repairCategories.length ? repairCategories.join(", ") : "—"}</div>
        <div class="popup-row"><span class="popup-label">Type:</span> ${serviceTypes.length ? serviceTypes.join(", ") : "—"}</div>
      </div>
    `;

    const marker = L.marker([shop.lat, shop.lng], {
         title: shop.verified ? `${shop.name} (Verified)` : shop.name
        });
    marker.bindPopup(popupHtml);

    marker.on("click", () => {
      updateServiceCard(shop);
    });

    marker.addTo(markersLayer);
    bounds.push([shop.lat, shop.lng]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

function applyFilters() {
  applyAllFilters();
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
  applyFilters();
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

    applyFilters();
  });
});

clearFiltersBtn.addEventListener("click", () => {
  activeFilters.clear();
  filterChips.forEach((chip) => chip.classList.remove("active"));

  nearbyMode = false;
  nearbyCenter = null;
  searchInput.value = "";
  searchStatus.textContent = "";

  applyFilters();
});

shopSearchInput.addEventListener("input", () => {
  shopSearchQuery = shopSearchInput.value.trim().toLowerCase();
  applyFilters();
});

shopSearchClearBtn.addEventListener("click", () => {
  shopSearchQuery = "";
  shopSearchInput.value = "";
  applyFilters();
});

closeModal.addEventListener("click", () => {
  closeCheckinModal();
});

checkinModal.addEventListener("click", (e) => {
  if (e.target === checkinModal) {
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

addServiceModal.addEventListener("click", (e) => {
  if (e.target === addServiceModal) {
    closeServiceModal();
  }
});

checkinForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  if (!selectedShop) {
    showCheckinMessage("Please select a service first.", true);
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

  const { error } = await supabase
    .from("checkins")
    .insert([payload]);

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

addServiceForm.addEventListener("submit", async function (e) {
  e.preventDefault();

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

  const { data, error } = await supabase
    .from("services")
    .insert([payload])
    .select();

  submitAddServiceBtn.disabled = false;
  submitAddServiceBtn.textContent = "Save Service";

  if (error) {
    console.error("Error saving service:", error);
    showAddServiceMessage("Could not save service.", true);
    return;
  }

  showAddServiceMessage("Service added successfully");
  addServiceForm.reset();

  await loadServices();

  if (data && data[0]) {
    const newShop = data[0];
    map.setView([newShop.lat, newShop.lng], 11);
    updateServiceCard(newShop);
  }

  setTimeout(() => {
    closeServiceModal();
    showAddServiceMessage("");
  }, 900);
});

resetServiceCard();
loadServices();

const searchInput = document.getElementById("locationSearch");
const searchBtn = document.getElementById("searchBtn");
const searchStatus = document.getElementById("searchStatus");

let nearbyMode = false;
let nearbyCenter = null;
const NEARBY_RADIUS_MILES = 100;

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

function applyAllFilters() {
  let filteredServices = getFilteredServices();

  if (nearbyMode && nearbyCenter) {
    filteredServices = filteredServices.filter((shop) => {
      const distance = getDistanceMiles(
        nearbyCenter.lat,
        nearbyCenter.lng,
        Number(shop.lat),
        Number(shop.lng)
      );

      return distance <= NEARBY_RADIUS_MILES;
    });
  }

  renderMarkers(filteredServices);

  if (nearbyMode && nearbyCenter) {
    searchStatus.textContent = `Showing ${filteredServices.length} services within ${NEARBY_RADIUS_MILES} miles`;
  } else {
    searchStatus.textContent = "";
  }
}

searchBtn.addEventListener("click", async () => {
  const query = searchInput.value.trim();

  if (!query) return;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.length === 0) {
    alert("Location not found");
    return;
  }

  const lat = Number(data[0].lat);
  const lon = Number(data[0].lon);

  nearbyMode = true;
  nearbyCenter = { lat, lng: lon };

  map.setView([lat, lon], 9);
  applyAllFilters();
});