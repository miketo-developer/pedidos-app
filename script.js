// script.js
let datos = [];
const TIPOS_VALIDOS = ["HVO", "PER", "COC"];

// Columnas que queremos mostrar y capturar
const COLUMNAS_A_MOSTRAR = [
  "FePrefEnt.",
  "Solic.",
  "Solicitante",
  "Material",
  "Número de material",
  "Ctd pedido UMV"
];

// --- Inicialización y Carga de Archivo ---

document.getElementById("archivo").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  procesarArchivo(file);
});

function procesarArchivo(file) {
  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      datos = XLSX.utils.sheet_to_json(sheet);

      if (datos.length === 0) {
        alert("El archivo está vacío o no tiene el formato correcto.");
        return;
      }

      detectarFechas();
      detectarTipos();
      alert(`Archivo cargado correctamente. ${datos.length} filas detectadas.`);
    } catch (error) {
      console.error("Error al procesar el Excel:", error);
      alert("Error al leer el archivo Excel. Asegúrate de que es un archivo válido.");
    }
  };
  reader.readAsArrayBuffer(file);
}

// --- Filtros e Interfaz ---

function detectarFechas() {
  const fechas = new Set();
  datos.forEach((r) => {
    if (r["FePrefEnt."]) fechas.add(r["FePrefEnt."]);
  });

  const cont = document.getElementById("listaFechas");
  cont.innerHTML = "";

  if (fechas.size === 0) {
    cont.innerHTML = "<p>No hay fechas disponibles.</p>";
    return;
  }

  fechas.forEach((f) => {
    cont.innerHTML += `
      <label class="opcion">
        <input type="radio" name="fecha" value="${f}">
        <span>${f}</span>
      </label>
    `;
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

function setTienda(t) {
  document.getElementById("busquedaTienda").value = t;
}

// --- Generación de Pedido (Vista Usuario) ---

function generarPedido() {
  const tienda = document.getElementById("busquedaTienda").value.trim();
  const fechaSel = document.querySelector('input[name="fecha"]:checked');
  const tiposSeleccionados = [
    ...document.querySelectorAll('input[name="tipo"]:checked'),
  ].map((e) => e.value);

  if (!tienda) { alert("Ingresa una tienda"); return; }
  if (!fechaSel) { alert("Selecciona una fecha"); return; }
  if (tiposSeleccionados.length === 0) { alert("Selecciona al menos un tipo de producto"); return; }

  const fecha = fechaSel.value;

  // Filtrado de datos
  const filasFiltradas = datos.filter((r) => {
    if (!r["Solicitante"] || !r["FePrefEnt."]) return false;
    const partes = r["Solicitante"].split(" ");
    const tipo = partes[partes.length - 1];

    return (
      r["Solicitante"].includes(tienda) &&
      r["FePrefEnt."] == fecha &&
      tiposSeleccionados.includes(tipo)
    );
  });

  const contenedorResultado = document.getElementById("resultado");

  if (filasFiltradas.length === 0) {
    contenedorResultado.innerHTML = '<div class="card">Sin resultados para la búsqueda.</div>';
    return;
  }

  // Renderizado de la tabla para el usuario
  let html = `
    <div class="tabla-wrapper" id="tablaParaUsuario">
      <table class="tabla-pedido">
        <thead>
          <tr>
            ${COLUMNAS_A_MOSTRAR.map(col => `<th>${col}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${filasFiltradas.map(fila => `
            <tr>
              ${COLUMNAS_A_MOSTRAR.map(col => `<td>${fila[col] ?? ""}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <button class="exportar" onclick="compartirImagen()">📲 Compartir imagen completa en WhatsApp</button>
  `;

  contenedorResultado.innerHTML = html;
}

// --- Captura y Compartición Definitiva (Técnica del iframe) ---

async function compartirImagen() {
  // 1. Obtener la tabla visible para extraer los datos
  const tablaVisible = document.querySelector("#tablaParaUsuario table");
  if (!tablaVisible) { alert("Primero genera un pedido."); return; }

  // Mostrar indicador de carga (opcional pero recomendado)
  const botonExportar = document.querySelector(".exportar");
  const textoOriginal = botonExportar.innerText;
  botonExportar.innerText = "⏳ Generando imagen completa...";
  botonExportar.disabled = true;

  try {
    // 2. Generar el HTML de la tabla para la captura (con estilos incrustados y NUEVO COLOR)
    const filasHtml = Array.from(tablaVisible.querySelectorAll("tbody tr")).map(tr => tr.innerHTML).join('</tr><tr>');
    const encabezadosHtml = Array.from(tablaVisible.querySelectorAll("thead th")).map(th => th.innerHTML).join('</th><th>');

    const htmlContenido = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: system-ui, sans-serif; background: white; margin: 0; padding: 20px; }
          table { border-collapse: collapse; width: auto; min-width: 800px; font-size: 16px; table-layout: auto; }
          th { background: #26303a; color: white; padding: 12px; text-align: left; border: 1px solid #26303a; }
          td { border: 1px solid #eee; padding: 10px; white-space: nowrap; }
          tr:nth-child(even) { background: #f8f9fa; }
          /* Asegurar que el contenedor del iframe no corte nada */
          html, body { height: auto; overflow: visible; }
        </style>
      </head>
      <body>
        <table>
          <thead><tr><th>${encabezadosHtml}</th></tr></thead>
          <tbody><tr>${filasHtml}</tr></tbody>
        </table>
      </body>
      </html>
    `;

    // 3. Crear un iframe invisible
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    // 4. Inyectar el HTML en el iframe
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContenido);
    doc.close();

    // 5. Esperar a que el contenido del iframe se renderice
    await new Promise(resolve => iframe.onload = resolve);

    // 6. Capturar el cuerpo del iframe (que contiene la tabla completa)
    const bodyIframe = iframe.contentWindow.document.body;
    
    const canvas = await html2canvas(bodyIframe, {
      scale: 2, // Alta calidad
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      // Al capturar el body del iframe, html2canvas toma el tamaño real del contenido
    });

    // 7. Limpiar el DOM borrando el iframe
    document.body.removeChild(iframe);

    // 8. Convertir a Blob y Compartir
    canvas.toBlob(async (blob) => {
      if (!blob) { throw new Error("No se pudo generar el Blob de la imagen."); }
      
      const file = new File([blob], "pedido-completo.png", { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Pedido Completo",
            text: "Aquí está el resumen del pedido generado desde la app."
          });
        } catch (shareError) {
          console.log("Compartir cancelado o fallido:", shareError);
          // Si falla el share nativo, intentamos descarga
          descargarCanvas(canvas);
        }
      } else {
        alert("Tu navegador no soporta la función nativa de compartir archivos. Se descargará la imagen.");
        descargarCanvas(canvas);
      }
    }, "image/png");

  } catch (error) {
    console.error("Error crítico durante la captura:", error);
    alert("Hubo un error al generar la imagen completa. Por favor, inténtalo de nuevo.");
  } finally {
    // Restaurar estado del botón
    botonExportar.innerText = textoOriginal;
    botonExportar.disabled = false;
  }
}

// Función auxiliar para descargar la imagen si navigator.share falla
function descargarCanvas(canvas) {
  const link = document.createElement("a");
  link.download = "pedido-completo.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// --- PWA y Carga desde Compartir (Sin cambios significativos) ---

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((reg) => console.log("Service Worker registrado"))
      .catch((err) => console.log("Error registrando SW", err));
  });
}

// Funciones para manejar archivos compartidos (launchQueue, etc.) se mantienen igual...
async function cargarArchivoCompartido() {
  const cache = await caches.open("shared-file");
  const response = await cache.match("ultimo-archivo");
  if (!response) return;
  const blob = await response.blob();
  procesarArchivo(blob);
}
window.addEventListener("load", cargarArchivoCompartido);

if ("launchQueue" in window) {
  launchQueue.setConsumer(async (launchParams) => {
    if (!launchParams.files.length) return;
    const fileHandle = launchParams.files[0];
    const file = await fileHandle.getFile();
    procesarArchivo(file);
  });
}