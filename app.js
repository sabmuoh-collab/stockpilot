const DB_NAME = "stockpilot-db";
const DB_VERSION = 1;
let db;
let currentFilter = "all";

const openDB = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains("products")) {
      const store = database.createObjectStore("products", { keyPath: "id", autoIncrement: true });
      store.createIndex("name", "name", { unique: false });
      store.createIndex("sku", "sku", { unique: true });
    }
    if (!database.objectStoreNames.contains("customers")) {
      const store = database.createObjectStore("customers", { keyPath: "id", autoIncrement: true });
      store.createIndex("name", "name", { unique: false });
      store.createIndex("phone", "phone", { unique: false });
    }
    if (!database.objectStoreNames.contains("settings")) {
      database.createObjectStore("settings", { keyPath: "key" });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

function readAll(storeName) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function showInfo(title, message) {
  document.getElementById("dialogTitle").textContent = title;
  document.getElementById("dialogMessage").textContent = message;
  document.getElementById("infoDialog").showModal();
}

function navigate(page) {
  document.querySelectorAll(".page").forEach(el => el.classList.toggle("active", el.id === `page-${page}`));
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  document.getElementById("mainContent").focus({preventScroll:true});
  window.scrollTo({top:0, behavior:"smooth"});
  if (page === "dashboard") refreshDashboard();
  if (page === "stock") renderProducts();
  if (page === "customers") renderCustomers();
}

async function refreshDashboard() {
  const products = await readAll("products");
  const customers = await readAll("customers");
  document.getElementById("productCount").textContent = products.length;
  document.getElementById("stockUnits").textContent = products.reduce((sum,p) => sum + (Number(p.quantity)||0), 0).toLocaleString();
  document.getElementById("lowStockCount").textContent = products.filter(p => Number(p.quantity) <= Number(p.minimumQuantity || 0)).length;
  document.getElementById("customerCount").textContent = customers.length;
}

async function renderProducts() {
  const products = await readAll("products");
  const search = document.getElementById("productSearch").value.trim().toLowerCase();
  const filtered = products.filter(p => {
    const matches = `${p.name} ${p.sku || ""}`.toLowerCase().includes(search);
    const low = Number(p.quantity) <= Number(p.minimumQuantity || 0);
    return matches && (currentFilter === "all" || low);
  });
  const target = document.getElementById("productList");
  if (!filtered.length) {
    target.innerHTML = `<div class="empty-list">${products.length ? "No products match your search or filter." : "Your product catalog is empty.<br>We'll add the product form in the next build stage."}</div>`;
    return;
  }
  target.innerHTML = filtered.map(p => {
    const low = Number(p.quantity) <= Number(p.minimumQuantity || 0);
    return `<article class="setting-row" style="background:#fff;border:1px solid var(--line);border-radius:13px">
      <span class="setting-icon">▣</span><span style="min-width:0;flex:1"><b>${escapeHTML(p.name)}</b><small>${escapeHTML(p.sku || "No SKU")} · ${escapeHTML(p.unit || "units")}</small></span>
      <span style="text-align:right"><b>${Number(p.quantity).toLocaleString()}</b><small style="color:${low ? "#b87916" : "#168267"}">${low ? "Low stock" : "In stock"}</small></span>
    </article>`;
  }).join("");
}

async function renderCustomers() {
  const customers = await readAll("customers");
  const search = document.getElementById("customerSearch").value.trim().toLowerCase();
  const filtered = customers.filter(c => `${c.name} ${c.phone || ""}`.toLowerCase().includes(search));
  const target = document.getElementById("customerList");
  if (!filtered.length) {
    target.innerHTML = `<div class="empty-list">${customers.length ? "No customers match your search." : "Your customer book is empty.<br>Customer profiles will be enabled in Stage 3."}</div>`;
    return;
  }
  target.innerHTML = filtered.map(c => `<article class="setting-row" style="background:#fff;border:1px solid var(--line);border-radius:13px">
    <span class="setting-icon">♙</span><span style="min-width:0;flex:1"><b>${escapeHTML(c.name)}</b><small>${escapeHTML(c.phone || "No phone number")}</small></span>
  </article>`).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}

document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", event => {
  event.preventDefault();
  navigate(button.dataset.page);
}));
document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.go)));
document.getElementById("productSearch").addEventListener("input", renderProducts);
document.getElementById("customerSearch").addEventListener("input", renderCustomers);
document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
  currentFilter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("selected", b === button));
  renderProducts();
}));
document.getElementById("addProductBtn").addEventListener("click", () => showInfo("Product setup", "The product form is the next development step. We'll add product name, SKU, category, purchase price, selling price, quantity, unit and low-stock threshold."));
document.getElementById("addCustomerBtn").addEventListener("click", () => showInfo("Customer book", "Customer profiles are scheduled for Stage 3. We'll include name, phone number, address and notes."));
document.getElementById("backupButton").addEventListener("click", () => showInfo("Protect your data", "Backup and restore will be added in the final development stage. Until then, avoid clearing Safari website data for StockPilot."));
document.getElementById("closeDialog").addEventListener("click", () => document.getElementById("infoDialog").close());
document.getElementById("dialogOk").addEventListener("click", () => document.getElementById("infoDialog").close());

(async function init() {
  try {
    db = await openDB();
    document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat("en", {day:"numeric", month:"short"}).format(new Date());
    await refreshDashboard();
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  } catch (error) {
    showInfo("Storage unavailable", "StockPilot could not open its local database in this browser. Please open it in Safari using the published website.");
  }
})();
