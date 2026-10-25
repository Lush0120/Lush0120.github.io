/* =========================================================
   CV virtual · comportamiento
   - Idioma ES/EN (textos en i18n/*.json)
   - Modo claro/oscuro
   - Galería de certificados con filtros (data/certificados.json)
   - Formulario de contacto (Formspree o, mientras no hay ID, mailto:)
   ========================================================= */

// ID del formulario de Formspree (p. ej. "xyzabcd"). Vacío = usar mailto:.
const FORMSPREE_ID = "";
const CORREO = "yoesel52@gmail.com";
const IDIOMAS = ["es", "en"];
const CATEGORIAS = ["todos", "qa", "python-datos", "agil", "ingles", "herramientas", "titulos"];

const estado = {
  idioma: "es",
  textos: {},          // diccionario del idioma activo
  certificados: [],
  verTodos: false,
  filtro: "todos",
};

/* ---------- Almacenamiento seguro ----------
   localStorage puede fallar (modo privado, cookies bloqueadas). Si falla,
   el sitio funciona igual; solo no recuerda la preferencia. */
const guardado = {
  leer(clave) { try { return localStorage.getItem(clave); } catch { return null; } },
  escribir(clave, valor) { try { localStorage.setItem(clave, valor); } catch { /* sin persistencia */ } },
};

/* ---------- Idioma ---------- */

// Devuelve el texto de una ruta "seccion.clave.subclave" o null si no existe.
function t(ruta) {
  return ruta.split(".").reduce((obj, k) => (obj && k in obj ? obj[k] : null), estado.textos);
}

const cacheIdiomas = {};
async function cargarIdioma(idioma) {
  if (!cacheIdiomas[idioma]) {
    const resp = await fetch(`i18n/${idioma}.json`);
    if (!resp.ok) throw new Error(`No se pudo cargar i18n/${idioma}.json`);
    cacheIdiomas[idioma] = await resp.json();
  }
  return cacheIdiomas[idioma];
}

async function aplicarIdioma(idioma) {
  try {
    estado.textos = await cargarIdioma(idioma);
  } catch (err) {
    console.warn(err);
    return; // se queda el texto en español que ya trae el HTML
  }
  estado.idioma = idioma;
  document.documentElement.lang = idioma;
  document.title = t("meta.title");
  document.querySelector('meta[name="description"]').content = t("meta.description");

  // Texto de los elementos: data-i18n="ruta"
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const texto = t(el.dataset.i18n);
    if (texto != null) el.textContent = texto;
  });
  // Atributos: data-i18n-attr="atributo:ruta;otro:ruta"
  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    el.dataset.i18nAttr.split(";").forEach((par) => {
      const [attr, ruta] = par.split(":");
      const texto = t(ruta);
      if (texto != null) el.setAttribute(attr, texto);
    });
  });
  document.querySelectorAll("#btn-idioma [data-lang]").forEach((s) => {
    s.classList.toggle("activo", s.dataset.lang === idioma);
  });

  renderFiltros();
  renderCertificados();
}

function iniciarIdioma() {
  const preferido = guardado.leer("idioma");
  const idioma = IDIOMAS.includes(preferido) ? preferido : "es";
  document.getElementById("btn-idioma").addEventListener("click", () => {
    const nuevo = estado.idioma === "es" ? "en" : "es";
    guardado.escribir("idioma", nuevo);
    aplicarIdioma(nuevo);
  });
  return aplicarIdioma(idioma);
}

/* ---------- Tema ---------- */
function temaActual() {
  const forzado = document.documentElement.dataset.theme;
  if (forzado) return forzado;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function iniciarTema() {
  document.getElementById("btn-tema").addEventListener("click", () => {
    const nuevo = temaActual() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nuevo;
    guardado.escribir("tema", nuevo);
  });
}

/* ---------- Menú móvil ---------- */
function iniciarMenu() {
  const boton = document.querySelector(".nav__toggle");
  const menu = document.getElementById("menu");
  const cerrar = () => { menu.classList.remove("abierto"); boton.setAttribute("aria-expanded", "false"); };

  boton.addEventListener("click", () => {
    const abierto = menu.classList.toggle("abierto");
    boton.setAttribute("aria-expanded", String(abierto));
  });
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) cerrar(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });
}

/* ---------- Detalle de proyectos ---------- */
function iniciarDialogos() {
  document.querySelectorAll("[data-dialogo]").forEach((boton) => {
    const dialogo = document.getElementById(boton.dataset.dialogo);
    boton.addEventListener("click", () => dialogo.showModal());
    // Clic en el fondo oscuro (fuera del cuadro) también cierra.
    dialogo.addEventListener("click", (e) => { if (e.target === dialogo) dialogo.close(); });
  });
}

/* ---------- Certificados ---------- */
function formatearFecha(aaaaMm) {
  const [anio, mes] = aaaaMm.split("-").map(Number);
  const locale = estado.idioma === "es" ? "es-CO" : "en-US";
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" })
    .format(new Date(anio, mes - 1, 1));
}

function crearEnlace(texto, archivo, clase) {
  const a = document.createElement("a");
  a.className = `btn btn--small ${clase}`;
  a.href = `assets/certificados/pdf/${archivo}.pdf`;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = texto;
  return a;
}

function crearTarjeta(cert) {
  const nombre = cert.nombre[estado.idioma] || cert.nombre.es;
  const li = document.createElement("li");
  li.innerHTML = `
    <article class="card cert">
      <img class="cert__thumb" loading="lazy" width="480" height="340" alt="">
      <div class="cert__cuerpo">
        <h3 class="cert__nombre"></h3>
        <p class="cert__meta cert__institucion"></p>
        <p class="cert__meta cert__detalle"></p>
        <div class="cert__acciones"></div>
      </div>
    </article>`;
  // Los datos se asignan con textContent/atributos, nunca como HTML.
  const img = li.querySelector("img");
  img.src = `assets/certificados/thumbs/${cert.archivo}.webp`;
  img.alt = `${t("certificados.miniatura")}: ${nombre}`;
  li.querySelector(".cert__nombre").textContent = nombre;
  li.querySelector(".cert__institucion").textContent = cert.institucion;
  const partes = [];
  if (cert.horas) partes.push(`${cert.horas.toLocaleString(estado.idioma)} ${t("certificados.horas")}`);
  partes.push(formatearFecha(cert.fecha));
  li.querySelector(".cert__detalle").textContent = partes.join(" · ");

  const acciones = li.querySelector(".cert__acciones");
  acciones.append(crearEnlace(t("certificados.ver_pdf"), cert.archivo, "btn--primary"));
  (cert.extras || []).forEach((extra) => {
    acciones.append(crearEnlace(t(`certificados.${extra.etiqueta}`), extra.archivo, "btn--outline"));
  });
  return li;
}

function renderCertificados() {
  const galeria = document.getElementById("galeria");
  if (!estado.certificados.length) return;

  let lista = estado.certificados;
  if (!estado.verTodos) {
    lista = lista.filter((c) => c.destacado);
  } else if (estado.filtro !== "todos") {
    lista = lista.filter((c) => c.categoria === estado.filtro);
  }
  // Más recientes primero.
  lista = [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha));

  galeria.replaceChildren(...lista.map(crearTarjeta));

  const boton = document.getElementById("btn-ver-todos");
  boton.textContent = t(estado.verTodos ? "certificados.ver_menos" : "certificados.ver_todos");
  boton.setAttribute("aria-expanded", String(estado.verTodos));
  document.getElementById("filtros").hidden = !estado.verTodos;
}

function renderFiltros() {
  const cont = document.getElementById("filtros");
  cont.replaceChildren(...CATEGORIAS.map((cat) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "filtro";
    b.dataset.categoria = cat;
    b.textContent = t(`certificados.filtros.${cat}`);
    b.setAttribute("aria-pressed", String(cat === estado.filtro));
    return b;
  }));
}

async function iniciarCertificados() {
  document.getElementById("filtros").addEventListener("click", (e) => {
    const b = e.target.closest(".filtro");
    if (!b) return;
    estado.filtro = b.dataset.categoria;
    // Solo se actualiza aria-pressed (no se reconstruyen los botones) para
    // que quien navega con teclado no pierda el foco en el filtro pulsado.
    document.querySelectorAll(".filtro").forEach((f) => {
      f.setAttribute("aria-pressed", String(f === b));
    });
    renderCertificados();
  });
  document.getElementById("btn-ver-todos").addEventListener("click", () => {
    estado.verTodos = !estado.verTodos;
    if (!estado.verTodos) estado.filtro = "todos";
    renderFiltros();
    renderCertificados();
  });

  try {
    const resp = await fetch("data/certificados.json");
    if (!resp.ok) throw new Error(resp.statusText);
    estado.certificados = await resp.json();
    renderCertificados();
  } catch (err) {
    console.warn("Certificados:", err);
    const aviso = document.createElement("li");
    aviso.textContent = t("certificados.error") || "No se pudieron cargar los certificados.";
    document.getElementById("galeria").replaceChildren(aviso);
  }
}

/* ---------- Formulario de contacto ---------- */
function iniciarFormulario() {
  const form = document.getElementById("form-contacto");
  const estadoForm = document.getElementById("form-estado");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validación nativa del navegador, mostrada de forma accesible.
    let valido = true;
    form.querySelectorAll("input, textarea").forEach((campo) => {
      const ok = campo.checkValidity() && campo.value.trim() !== "";
      campo.setAttribute("aria-invalid", String(!ok));
      if (!ok && valido) { campo.focus(); valido = false; }
    });
    if (!valido) return;

    const datos = Object.fromEntries(new FormData(form));

    if (!FORMSPREE_ID) {
      // Respaldo: abre el cliente de correo con el mensaje ya escrito.
      const asunto = `${t("contacto.asunto")} – ${datos.nombre}`;
      const cuerpo = `${datos.mensaje}\n\n${datos.nombre} <${datos.email}>`;
      estadoForm.textContent = t("contacto.mailto");
      window.location.href =
        `mailto:${CORREO}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      return;
    }

    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    estadoForm.textContent = t("contacto.enviando");
    try {
      const resp = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      if (!resp.ok) throw new Error(resp.status);
      form.reset();
      estadoForm.textContent = t("contacto.ok");
    } catch (err) {
      console.warn("Formulario:", err);
      estadoForm.textContent = t("contacto.error");
    } finally {
      boton.disabled = false;
    }
  });
}

/* ---------- Arranque ---------- */
document.getElementById("anio").textContent = new Date().getFullYear();
iniciarTema();
iniciarMenu();
iniciarDialogos();
iniciarFormulario();
iniciarIdioma().then(iniciarCertificados);
