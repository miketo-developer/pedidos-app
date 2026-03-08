let datos = [];
const TIPOS_VALIDOS = ["HVO", "PER", "COC"];

document.getElementById("archivo").addEventListener("change", function (e) {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = function (evt) {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    datos = XLSX.utils.sheet_to_json(sheet);

    detectarFechas();
    detectarTipos();

    alert("Archivo cargado correctamente");
  };

  reader.readAsArrayBuffer(file);
});

function detectarFechas() {
  const fechas = new Set();
  datos.forEach((r) => {
    if (r["FePrefEnt."]) fechas.add(r["FePrefEnt."]);
  });

  const cont = document.getElementById("listaFechas");
  cont.innerHTML = "";

  fechas.forEach((f) => {
    cont.innerHTML += `
      <label class="opcion">
        <input type="radio" name="fecha" value="${f}">
        <span>${f}</span>
      </label>
    `;
  });
}

function setTienda(t) {
  document.getElementById("busquedaTienda").value = t;
}

function generarPedido() {
  const tienda = document.getElementById("busquedaTienda").value;
  const fechaSel = document.querySelector('input[name="fecha"]:checked');
  const tiposSeleccionados = [
    ...document.querySelectorAll('input[name="tipo"]:checked'),
  ].map((e) => e.value);

  if (!tienda) {
    alert("Ingresa una tienda");
    return;
  }

  if (!fechaSel) {
    alert("Selecciona una fecha");
    return;
  }

  const fecha = fechaSel.value;

  const filas = datos.filter((r) => {
    if (!r["Solicitante"]) return false;
    const partes = r["Solicitante"].split(" ");
    const tipo = partes[partes.length - 1];

    return (
      r["Solicitante"].includes(tienda) &&
      r["FePrefEnt."] == fecha &&
      TIPOS_VALIDOS.includes(tipo) &&
      tiposSeleccionados.includes(tipo)
    );
  });

  if (filas.length == 0) {
    document.getElementById("resultado").innerHTML = "Sin resultados";
    return;
  }

  const head = filas[0];
  let totalPiezas = 0;

  filas.forEach((f) => {
    totalPiezas += Number(f["Ctd pedido UMV"] || 0);
  });

  /*
  let html = `
    <div class="card" id="tarjeta">
      <div class="header">
        <div class="titulo">${head["Solicitante"]}</div>
        <div>📅 Entrega: ${head["FePrefEnt."]}</div>
        <div>📄 Solicitud: ${head["Solic."]}</div>
        <div class="stats">
          📦 Productos: ${filas.length} | 📊 Piezas: ${totalPiezas}
        </div>
      </div>
  `;
*/

const columnas = [
"FePrefEnt.",
"Solic.",
"Solicitante",
"Material",
"Número de material",
"Ctd pedido UMV"
];

  //let columnas = Object.keys(filas[0]);

  let html = `
<div class="tabla-wrapper" id="tarjeta">

<table class="tabla-pedido">
<thead>
<tr>
`;

columnas.forEach(col => {
  html += `<th>${col}</th>`;
});

html += `
</tr>
</thead>
<tbody>
`;

  filas.forEach(fila => {

  html += "<tr>";

  columnas.forEach(col => {
    html += `<td>${fila[col] ?? ""}</td>`;
  });

  html += "</tr>";

});

  /*
  filas.forEach((r) => {
    html += `
      <div class="producto">
        <div class="material">${r["Material"]}</div>
        <div class="codigo">${r["Número de material"]}</div>
        <div class="cantidad">Cantidad: ${r["Ctd pedido UMV"]}</div>
      </div>
    `;
  });
*/

  // <button class="exportar" onclick="exportar()">📸 Exportar imagen</button>
  // <button class="exportar" onclick="exportarYWhatsApp()">📸 Exportar y abrir WhatsApp</button>
  
  html += `
</tbody>
</table>
</div>

<button class="exportar" onclick="compartirImagen()">📲 Compartir imagen</button>
`;

  /*
  html += `</div>
    <button class="exportar" onclick="compartirImagen()">📲 Compartir imagen</button>
  `;
*/
  document.getElementById("resultado").innerHTML = html;
  
}

function exportar() {
  html2canvas(document.getElementById("tarjeta")).then((canvas) => {
    const link = document.createElement("a");
    link.download = "pedido.png";
    link.href = canvas.toDataURL();
    link.click();
  });
}

function exportarYWhatsApp() {
  html2canvas(document.getElementById("tarjeta")).then((canvas) => {
    const link = document.createElement("a");

    link.download = "pedido.png";

    link.href = canvas.toDataURL();

    link.click();

    setTimeout(() => {
      window.open("https://wa.me/", "_blank");
    }, 800);
  });
}

/* Nuevo intento para tratar de capturar toda la tabla en una imagen. 
Poner la tabla fuera del viewport */
async function compartirImagen() {

  const tablaOriginal = document.querySelector("#tarjeta table");

  const clon = tablaOriginal.cloneNode(true);

  const contenedor = document.createElement("div");

  contenedor.style.position = "fixed";
  contenedor.style.left = "-10000px";
  contenedor.style.top = "0";
  contenedor.style.background = "white";
  contenedor.style.padding = "20px";

  contenedor.appendChild(clon);

  document.body.appendChild(contenedor);

  const canvas = await html2canvas(clon, {
    scale: 2,
    backgroundColor: "#ffffff"
  });

  document.body.removeChild(contenedor);

  canvas.toBlob(async (blob) => {

    const file = new File([blob], "pedido.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {

      await navigator.share({
        files: [file],
        title: "Pedido",
        text: "Pedido generado desde la app"
      });

    } else {

      const link = document.createElement("a");
      link.download = "pedido.png";
      link.href = canvas.toDataURL();
      link.click();

    }

  });

}

function detectarTipos() {
  const tipos = new Set();
  datos.forEach((r) => {
    if (!r["Solicitante"]) return;
    const partes = r["Solicitante"].split(" ");
    const tipo = partes[partes.length - 1];

    if (TIPOS_VALIDOS.includes(tipo)) {
      tipos.add(tipo);
    }
  });

  const cont = document.getElementById("listaTipos");
  cont.innerHTML = "";

  tipos.forEach((t) => {
    cont.innerHTML += `
      <label class="opcion">
        <input type="checkbox" name="tipo" value="${t}" checked>
        <span>${t}</span>
      </label>
    `;
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((reg) => console.log("Service Worker registrado", reg))
      .catch((err) => console.log("Error registrando SW", err));
  });
}

async function cargarArchivoCompartido() {
  const cache = await caches.open("shared-file");

  const response = await cache.match("ultimo-archivo");

  if (!response) return;

  const blob = await response.blob();

  procesarArchivo(blob);
}

window.addEventListener("load", cargarArchivoCompartido);

function procesarArchivo(file) {
  const reader = new FileReader();

  reader.onload = function (evt) {
    const data = new Uint8Array(evt.target.result);

    const workbook = XLSX.read(data, { type: "array" });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    datos = XLSX.utils.sheet_to_json(sheet);

    detectarFechas();
    detectarTipos();

    alert("Archivo cargado desde compartir");
  };

  reader.readAsArrayBuffer(file);
}


async function abrirArchivoDelSistema() {

  if (!("launchQueue" in window)) return;

  launchQueue.setConsumer(async (launchParams) => {

    if (!launchParams.files.length) return;

    const fileHandle = launchParams.files[0];

    const file = await fileHandle.getFile();

    procesarArchivo(file);

  });

}

window.addEventListener("load", abrirArchivoDelSistema);