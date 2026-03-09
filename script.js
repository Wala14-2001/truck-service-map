import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://jpuyuvbqeuhkebqtjubj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwdXl1dmJxZXVoa2VicXRqdWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMzM4MTcsImV4cCI6MjA4ODYwOTgxN30.fCf6ZJeOfEsiScA_p65G97yOfJdQrIixjzvp8G9KzP8";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const map = L.map("map").setView([33.7490, -84.3880], 9);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
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

let selectedShop = null;

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

function updateServiceCard(shop) {
  selectedShop = shop;
  selectedServiceName.textContent = shop.name;

  serviceCard.innerHTML = `
    <div class="service-name">${shop.name}</div>
    <div class="service-row"><span>Address:</span> ${shop.address ?? "—"}</div>
    <div class="service-row"><span>Phone:</span> ${shop.phone ?? "—"}</div>
    <div class="service-row"><span>Services:</span> ${shop.services ?? "—"}</div>
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

function renderMarkers(shops) {
  markersLayer.clearLayers();

  const bounds = [];

  shops.forEach((shop) => {
    const popupHtml = `
      <div>
        <div class="popup-title">${shop.name}</div>
        <div class="popup-row"><span class="popup-label">Address:</span> ${shop.address ?? "—"}</div>
        <div class="popup-row"><span class="popup-label">Phone:</span> ${shop.phone ?? "—"}</div>
        <div class="popup-row"><span class="popup-label">Services:</span> ${shop.services ?? "—"}</div>
      </div>
    `;

    const marker = L.marker([shop.lat, shop.lng]);
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

async function loadServices() {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading services:", error);
    alert("Could not load services from Supabase. Check your URL, key, and RLS policies.");
    return;
  }

  renderMarkers(data || []);
}

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
    lng: Number(document.getElementById("shopLng").value)
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

loadServices();