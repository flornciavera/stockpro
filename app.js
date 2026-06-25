// ============================================================
//  STOCKPRO — Frontend conectado al servidor Flask
// ============================================================

const API = '/api';

let productos = [];
let ventas    = [];

function fmt(n)  { return '$' + Number(n).toFixed(2); }
function fmtFecha(str) {
  const d = new Date(str);
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function getProd(id) { return productos.find(p => p.id === id); }

async function apiGet(ruta) {
  const res = await fetch(API + ruta);
  return res.json();
}
async function apiPost(ruta, datos) {
  const res = await fetch(API + ruta, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(datos) });
  return res.json();
}
async function apiPut(ruta, datos) {
  const res = await fetch(API + ruta, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(datos) });
  return res.json();
}
async function apiDelete(ruta) {
  const res = await fetch(API + ruta, { method:'DELETE' });
  return res.json();
}

function navTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  if (page === 'dashboard') renderDashboard();
  if (page === 'productos') renderProductos();
  if (page === 'ventas')    renderVentas();
  if (page === 'reportes')    renderReportes();
  if (page === 'proveedores') renderProveedores();
}

let chartVentasInst = null;

async function renderDashboard() {
  [productos, ventas] = await Promise.all([apiGet('/productos'), apiGet('/ventas')]);

  const dias  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const hoy   = new Date();
  document.getElementById('dash-date').textContent =
    `${dias[hoy.getDay()]} ${hoy.getDate()} de ${meses[hoy.getMonth()]}`.toUpperCase();

  const mesActual  = hoy.getMonth();
  const ventasMes  = ventas.filter(v => new Date(v.fecha).getMonth() === mesActual);
  const totalMes   = ventasMes.reduce((s,v) => s + v.cantidad * v.precio, 0);
  const totalAll   = ventas.reduce((s,v) => s + v.cantidad * v.precio, 0);
  const gananciaTot = ventas.reduce((s,v) => {
    const p = getProd(v.prod_id);
    return s + (p ? (v.precio - p.costo) * v.cantidad : 0);
  }, 0);
  const bajos = productos.filter(p => p.stock <= p.stock_min);

  document.getElementById('dash-ventas-mes').textContent = fmt(totalMes);
  document.getElementById('dash-trans-mes').textContent  = `${ventasMes.length} transacciones`;
  document.getElementById('dash-pct').textContent        = '+57%';
  document.getElementById('dash-ingresos').textContent   = fmt(totalAll);
  document.getElementById('dash-ganancia').textContent   = fmt(gananciaTot);
  document.getElementById('dash-stock-bajo').textContent = bajos.length;
  document.getElementById('dash-stock-sub').textContent  = `de ${productos.length} productos`;
  document.getElementById('dash-alert-count').textContent = `${bajos.length} alertas activas`;

  const valorStock = productos.reduce((s,p) => s + p.stock * p.precio, 0);
  const costoStock = productos.reduce((s,p) => s + p.stock * p.costo, 0);
  const margen     = valorStock > 0 ? Math.round(((valorStock - costoStock) / valorStock) * 100) : 0;

  document.getElementById('res-activos').textContent = productos.length;
  document.getElementById('res-valor').textContent   = fmt(valorStock);
  document.getElementById('res-costo').textContent   = fmt(costoStock);
  document.getElementById('res-margen').textContent  = margen + '%';

  const listaV    = document.getElementById('dash-ventas-list');
  const recientes = [...ventas].sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).slice(0,5);
  listaV.innerHTML = recientes.map(v => `
    <div class="mini-item">
      <div>
        <div class="mini-item-name">${v.prod_nombre || 'Desconocido'}</div>
        <div class="mini-item-sub">${v.cantidad} × ${fmt(v.precio)} · ${fmtFecha(v.fecha)}</div>
      </div>
      <div class="mini-item-val">${fmt(v.cantidad * v.precio)}</div>
    </div>`).join('') || '<div class="empty-state">Sin ventas registradas.</div>';

  const listaA = document.getElementById('dash-alertas-list');
  listaA.innerHTML = bajos.map(p => `
    <div class="mini-item">
      <div>
        <div class="mini-item-name">${p.nombre}</div>
        <div class="mini-item-sub">${p.categoria}</div>
      </div>
      <div class="mini-item-stock">${p.stock} ${(p.unidad||'unidad').toLowerCase()}s</div>
    </div>`).join('') || '<div class="empty-state" style="padding:16px;font-size:12px;">¡Sin alertas! Todo en orden.</div>';

  const labels = [], data7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    labels.push(['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()]);
    const total = ventas.filter(v => new Date(v.fecha).toDateString() === d.toDateString()).reduce((s,v) => s + v.cantidad * v.precio, 0);
    data7.push(parseFloat(total.toFixed(2)));
  }

  if (chartVentasInst) chartVentasInst.destroy();
  chartVentasInst = new Chart(document.getElementById('chartVentas').getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label:'Ventas', data:data7, backgroundColor:'#e53935', borderRadius:6, borderSkipped:false }] },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip:{ callbacks:{ title:i=>i[0].label, label:i=>` Ventas: ${fmt(i.raw)}` }, backgroundColor:'#1c1c1c', borderColor:'#2a2a2a', borderWidth:1, titleColor:'#f0f0f0', bodyColor:'#e53935', padding:10 } },
      scales: { x:{ grid:{color:'#1e1e1e'}, ticks:{color:'#555'} }, y:{ grid:{color:'#1e1e1e'}, ticks:{color:'#555', callback:v=>'$'+v} } }
    }
  });
}

async function renderProductos() {
  productos = await apiGet('/productos');
  document.getElementById('prod-sub').textContent = `${productos.length} productos registrados`;
  const q     = (document.getElementById('prod-search')?.value || '').toLowerCase();
  const lista = productos.filter(p => p.nombre.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q));
  const tbody = document.getElementById('prod-tbody');
  if (lista.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No se encontraron productos.</td></tr>`; return; }
  tbody.innerHTML = lista.map(p => {
    let stockHtml;
    if (p.stock === 0) stockHtml = `<span class="stock-out">0 · Sin stock ⚠</span>`;
    else if (p.stock <= p.stock_min) stockHtml = `<span class="stock-low">${p.stock} ${(p.unidad||'unidad').toLowerCase()} ⚠</span>`;
    else stockHtml = `<span class="stock-ok">${p.stock} ${(p.unidad||'unidad').toLowerCase()}</span>`;
    return `<tr>
      <td><div class="prod-name">${p.nombre}</div><div class="prod-sku">SKU: ${p.sku||'—'}</div></td>
      <td><span class="cat-badge">${p.categoria}</span></td>
      <td>${fmt(p.precio)}</td>
      <td>${stockHtml}</td>
      <td><div class="table-actions">
        <button class="btn-icon" onclick="editarProducto(${p.id})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn-icon del" onclick="confirmarEliminar(${p.id})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
      </div></td></tr>`;
  }).join('');
}

function abrirModalProducto() {
  document.getElementById('modal-prod-title').textContent = 'Nuevo Producto';
  ['prod-edit-id','prod-nombre','prod-sku','prod-precio','prod-costo','prod-stock','prod-desc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('prod-stock-min').value = '5';
  document.getElementById('modal-producto').style.display = 'flex';
}

function editarProducto(id) {
  const p = getProd(id); if (!p) return;
  document.getElementById('modal-prod-title').textContent = 'Editar Producto';
  document.getElementById('prod-edit-id').value   = p.id;
  document.getElementById('prod-nombre').value    = p.nombre;
  document.getElementById('prod-sku').value       = p.sku||'';
  document.getElementById('prod-cat').value       = p.categoria;
  document.getElementById('prod-precio').value    = p.precio;
  document.getElementById('prod-costo').value     = p.costo;
  document.getElementById('prod-stock').value     = p.stock;
  document.getElementById('prod-stock-min').value = p.stock_min;
  document.getElementById('prod-unidad').value    = p.unidad;
  document.getElementById('prod-desc').value      = p.descripcion||'';
  document.getElementById('modal-producto').style.display = 'flex';
}

async function guardarProducto() {
  const nombre = document.getElementById('prod-nombre').value.trim();
  const precio = parseFloat(document.getElementById('prod-precio').value);
  const stock  = parseInt(document.getElementById('prod-stock').value);
  if (!nombre || isNaN(precio) || isNaN(stock)) { alert('Completá los campos obligatorios (*)'); return; }
  const datos = { nombre, sku:document.getElementById('prod-sku').value.trim(), categoria:document.getElementById('prod-cat').value, precio, costo:parseFloat(document.getElementById('prod-costo').value)||0, stock, stock_min:parseInt(document.getElementById('prod-stock-min').value)||5, unidad:document.getElementById('prod-unidad').value, descripcion:document.getElementById('prod-desc').value.trim() };
  const editId = parseInt(document.getElementById('prod-edit-id').value);
  if (editId) await apiPut(`/productos/${editId}`, datos);
  else await apiPost('/productos', datos);
  cerrarModal('modal-producto');
  renderProductos();
}

function confirmarEliminar(id) {
  const p = getProd(id);
  document.getElementById('confirm-text').textContent = `¿Estás seguro de eliminar "${p?.nombre}"? Esta acción no se puede deshacer.`;
  document.getElementById('confirm-btn').onclick = async () => { await apiDelete(`/productos/${id}`); cerrarModal('modal-confirm'); renderProductos(); };
  document.getElementById('modal-confirm').style.display = 'flex';
}

async function renderVentas() {
  [productos, ventas] = await Promise.all([apiGet('/productos'), apiGet('/ventas')]);
  const totalAll = ventas.reduce((s,v) => s + v.cantidad * v.precio, 0);
  document.getElementById('venta-sub').textContent = `${ventas.length} ventas · Total: ${fmt(totalAll)}`;
  const tbody = document.getElementById('venta-tbody');
  if (ventas.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Sin ventas registradas.</td></tr>`; return; }
  tbody.innerHTML = ventas.map(v => `<tr>
    <td><div class="prod-name">${v.prod_nombre||'Producto eliminado'}</div></td>
    <td>${v.cantidad}</td>
    <td>${fmt(v.precio)}</td>
    <td style="color:#e53935;font-weight:600;font-family:var(--mono)">${fmt(v.cantidad*v.precio)}</td>
    <td style="color:#666;font-size:12px;">${fmtFecha(v.fecha)}</td>
    <td><div class="table-actions">
      <button class="btn-icon del" onclick="confirmarEliminarVenta(${v.id})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
    </div></td></tr>`).join('');
}

function abrirModalVenta() {
  document.getElementById('modal-venta-title').textContent = 'Nueva Venta';
  document.getElementById('venta-edit-id').value = '';
  document.getElementById('venta-cant').value    = '';
  document.getElementById('venta-precio').value  = '';
  document.getElementById('venta-total-preview').textContent = 'Total: $0.00';
  const sel = document.getElementById('venta-prod');
  sel.innerHTML = productos.map(p => `<option value="${p.id}" data-precio="${p.precio}">${p.nombre} — ${fmt(p.precio)}</option>`).join('');
  sel.onchange = () => { document.getElementById('venta-precio').value = sel.options[sel.selectedIndex].dataset.precio; actualizarTotalVenta(); };
  sel.dispatchEvent(new Event('change'));
  document.getElementById('modal-venta').style.display = 'flex';
}

function actualizarTotalVenta() {
  const cant = parseFloat(document.getElementById('venta-cant').value)||0;
  const precio = parseFloat(document.getElementById('venta-precio').value)||0;
  document.getElementById('venta-total-preview').textContent = `Total: ${fmt(cant*precio)}`;
}

async function guardarVenta() {
  const prod_id  = parseInt(document.getElementById('venta-prod').value);
  const cantidad = parseInt(document.getElementById('venta-cant').value);
  const precio   = parseFloat(document.getElementById('venta-precio').value);
  if (!prod_id || isNaN(cantidad) || cantidad < 1 || isNaN(precio)) { alert('Completá todos los campos.'); return; }
  await apiPost('/ventas', { prod_id, cantidad, precio });
  cerrarModal('modal-venta');
  renderVentas();
}

function confirmarEliminarVenta(id) {
  const v = ventas.find(x => x.id === id);
  document.getElementById('confirm-venta-text').textContent = `¿Eliminás la venta de "${v?.prod_nombre||'este producto'}"? Esta acción no se puede deshacer.`;
  document.getElementById('confirm-venta-btn').onclick = async () => { await apiDelete(`/ventas/${id}`); cerrarModal('modal-confirm-venta'); renderVentas(); };
  document.getElementById('modal-confirm-venta').style.display = 'flex';
}

let chartTopInst = null, chartCatInst = null;

async function renderReportes() {
  [productos, ventas] = await Promise.all([apiGet('/productos'), apiGet('/ventas')]);
  const mes     = parseInt(document.getElementById('rep-mes').value);
  const mesReal = mes - 1;
  const ventasMes = ventas.filter(v => new Date(v.fecha).getMonth() === mesReal);
  const ingresos  = ventasMes.reduce((s,v) => s + v.cantidad * v.precio, 0);
  const costos    = ventasMes.reduce((s,v) => { const p = getProd(v.prod_id); return s + (p ? p.costo*v.cantidad : 0); }, 0);
  document.getElementById('rep-ingresos').textContent = fmt(ingresos);
  document.getElementById('rep-costos').textContent   = fmt(costos);
  document.getElementById('rep-ganancia').textContent = fmt(ingresos - costos);
  document.getElementById('rep-trans').textContent    = ventasMes.length;

  const porProd = {};
  ventasMes.forEach(v => { const n = v.prod_nombre||'Desconocido'; porProd[n] = (porProd[n]||0) + v.cantidad*v.precio; });
  const topLabels = Object.keys(porProd).sort((a,b)=>porProd[b]-porProd[a]).slice(0,5);
  const topData   = topLabels.map(k => parseFloat(porProd[k].toFixed(2)));

  if (chartTopInst) chartTopInst.destroy();
  chartTopInst = new Chart(document.getElementById('chartTop').getContext('2d'), {
    type:'bar', data:{ labels:topLabels, datasets:[{ data:topData, backgroundColor:'#e53935', borderRadius:5, borderSkipped:false }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{ callbacks:{label:i=>` Total: ${fmt(i.raw)}`}, backgroundColor:'#1c1c1c', borderColor:'#2a2a2a', borderWidth:1, titleColor:'#f0f0f0', bodyColor:'#e53935', padding:10 } }, scales:{ x:{grid:{color:'#1e1e1e'}, ticks:{color:'#555', callback:v=>'$'+v}}, y:{grid:{display:false}, ticks:{color:'#999', font:{size:11}}} } }
  });

  const porCat = {};
  ventasMes.forEach(v => { const p = getProd(v.prod_id); const cat = p?p.categoria:'Otros'; porCat[cat] = (porCat[cat]||0) + v.cantidad*v.precio; });
  const catLabels = Object.keys(porCat);
  const catData   = catLabels.map(k => parseFloat(porCat[k].toFixed(2)));
  const catColors = ['#e53935','#1e88e5','#43a047','#ff9800','#ab47bc','#00acc1','#f06292'];

  if (chartCatInst) chartCatInst.destroy();
  chartCatInst = new Chart(document.getElementById('chartCat').getContext('2d'), {
    type:'doughnut', data:{ labels:catLabels, datasets:[{ data:catData, backgroundColor:catColors.slice(0,catLabels.length), borderWidth:2, borderColor:'#111' }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'right', labels:{color:'#999', font:{size:11}, boxWidth:12}}, tooltip:{ callbacks:{label:i=>` Total: ${fmt(i.raw)}`}, backgroundColor:'#1c1c1c', borderColor:'#2a2a2a', borderWidth:1, titleColor:'#f0f0f0', bodyColor:'#ccc', padding:10 } } }
  });
}

function descargarPDF() {
  const mes = parseInt(document.getElementById('rep-mes').value);
  const anio = 2026;
  window.open(`${API}/reporte/pdf?mes=${mes}&anio=${anio}`, '_blank');
}

function cerrarModal(id) { document.getElementById(id).style.display = 'none'; }
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
});

renderDashboard();

// ===== PROVEEDORES =====
let proveedores = [];

async function renderProveedores() {
  proveedores = await apiGet('/proveedores');
  document.getElementById('prov-sub').textContent = `${proveedores.length} proveedores registrados`;
  const q     = (document.getElementById('prov-search')?.value || '').toLowerCase();
  const lista = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(q) || (p.categoria||'').toLowerCase().includes(q)
  );
  const tbody = document.getElementById('prov-tbody');
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No se encontraron proveedores.</td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map(p => `<tr>
    <td>
      <div class="prod-name">${p.nombre}</div>
      ${p.notas ? `<div class="prod-sku">${p.notas}</div>` : ''}
    </td>
    <td>${p.contacto || '—'}</td>
    <td>${p.telefono || '—'}</td>
    <td style="font-size:12px;color:#888;">${p.email || '—'}</td>
    <td><span class="cat-badge">${p.categoria || '—'}</span></td>
    <td><div class="table-actions">
      <button class="btn-icon" onclick="editarProveedor(${p.id})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn-icon del" onclick="confirmarEliminarProveedor(${p.id})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div></td>
  </tr>`).join('');
}

function abrirModalProveedor() {
  document.getElementById('modal-prov-title').textContent = 'Nuevo Proveedor';
  ['prov-edit-id','prov-nombre','prov-contacto','prov-telefono','prov-email','prov-notas'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('modal-proveedor').style.display = 'flex';
}

function editarProveedor(id) {
  const p = proveedores.find(x => x.id === id); if (!p) return;
  document.getElementById('modal-prov-title').textContent = 'Editar Proveedor';
  document.getElementById('prov-edit-id').value   = p.id;
  document.getElementById('prov-nombre').value    = p.nombre;
  document.getElementById('prov-contacto').value  = p.contacto || '';
  document.getElementById('prov-telefono').value  = p.telefono || '';
  document.getElementById('prov-email').value     = p.email || '';
  document.getElementById('prov-categoria').value = p.categoria || 'Otros';
  document.getElementById('prov-notas').value     = p.notas || '';
  document.getElementById('modal-proveedor').style.display = 'flex';
}

async function guardarProveedor() {
  const nombre = document.getElementById('prov-nombre').value.trim();
  if (!nombre) { alert('El nombre es obligatorio.'); return; }
  const datos = {
    nombre,
    contacto:  document.getElementById('prov-contacto').value.trim(),
    telefono:  document.getElementById('prov-telefono').value.trim(),
    email:     document.getElementById('prov-email').value.trim(),
    categoria: document.getElementById('prov-categoria').value,
    notas:     document.getElementById('prov-notas').value.trim(),
  };
  const editId = parseInt(document.getElementById('prov-edit-id').value);
  if (editId) await apiPut(`/proveedores/${editId}`, datos);
  else await apiPost('/proveedores', datos);
  cerrarModal('modal-proveedor');
  renderProveedores();
}

function confirmarEliminarProveedor(id) {
  const p = proveedores.find(x => x.id === id);
  document.getElementById('confirm-prov-text').textContent =
    `¿Estás seguro de eliminar a "${p?.nombre}"? Esta acción no se puede deshacer.`;
  document.getElementById('confirm-prov-btn').onclick = async () => {
    await apiDelete(`/proveedores/${id}`);
    cerrarModal('modal-confirm-prov');
    renderProveedores();
  };
  document.getElementById('modal-confirm-prov').style.display = 'flex';
}