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
    document.getElementById("area-captura-oculta").innerHTML = ""; // Limpiar zona oculta
    return;
  }

  const columnas = [
    "FePrefEnt.",
    "Solic.",
    "Solicitante",
    "Material",
    "Número de material",
    "Ctd pedido UMV"
  ];

  // --- 1. Generar el HTML de la tabla ---
  let htmlTabla = `
    <table class="tabla-pedido">
      <thead>
        <tr>
          ${columnas.map(col => `<th>${col}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${filas.map(fila => `
          <tr>
            ${columnas.map(col => `<td>${fila[col] ?? ""}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // --- 2. Renderizar en la pantalla (con scroll) ---
  let htmlPantalla = `
    <div class="tabla-wrapper" id="tarjeta">
      ${htmlTabla}
    </div>
    <button class="exportar" onclick="compartirImagen()">📲 Compartir imagen completa</button>
  `;
  document.getElementById("resultado").innerHTML = htmlPantalla;

  // --- 3. Renderizar en la zona oculta (sin restricciones de tamaño) ---
  // Añadimos un padding extra alrededor de la tabla para la imagen
  document.getElementById("area-captura-oculta").innerHTML = `
    <div style="padding: 20px; background: white;">
      ${htmlTabla}
    </div>
  `;
}




/*
function exportar() {
  html2canvas(document.getElementById("tarjeta")).then((canvas) => {
    const link = document.createElement("a");
    link.download = "pedido.png";
    link.href = canvas.toDataURL();
    link.click();
  });
}
*/
/*
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
*/

/* Nuevo intento para tratar de capturar toda la tabla en una imagen. 
Dibujar tabla en CANVAS */
/* Nueva función robusta para capturar la tabla completa en móvil */
async function compartirImagen() {
  const elementoACapturar = document.getElementById("area-captura-oculta");
  
  // Verificación de seguridad
  if (!elementoACapturar || elementoACapturar.innerHTML.trim() === "") {
    alert("Primero genera un pedido.");
    return;
  }

  // Configuración de html2canvas optimizada para capturar el área oculta completa
  const opciones = {
    scale: 2, // Alta calidad
    useCORS: true,
    logging: false, 
    backgroundColor: "#ffffff",
    // IMPORTANTE: No limitamos width ni height, html2canvas capturará todo el contenido del div oculto
  };

  try {
    // Capturar el área oculta que contiene la tabla a tamaño completo
    const canvas = await html2canvas(elementoACapturar, opciones);
    
    // Compartir o descargar
    canvas.toBlob(async (blob) => {
      if (!blob) {
        alert("Error al generar la imagen.");
        return;
      }
      const file = new File([blob], "pedido-completo.png", { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Pedido Completo",
            text: "Aquí está el resumen del pedido completo (imagen generada)."
          });
        } catch (shareErr) {
          console.log("Compartir cancelado o fallido:", shareErr);
        }
      } else {
        // Fallback: descarga directa si navigator.share no está disponible
        const link = document.createElement("a");
        link.download = "pedido-completo.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      }
    }, "image/png");

  } catch (err) {
    console.error("Error crítico al capturar la imagen:", err);
    alert("No se pudo generar la imagen completa. Inténtalo de nuevo.");
  }
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
