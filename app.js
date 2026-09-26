
const clave = "prestamosVideojuegos";

let datos = {
    juegos: [],
    personas: [],
    prestamos: []
};

try {
    const guardados = localStorage.getItem(clave);

    if (guardados) {
        datos = JSON.parse(guardados);
    }
} catch (error) {
    alert("No se pudieron cargar los datos guardados.");
}


const formJuego = document.getElementById("form-juego");
const formPersona = document.getElementById("form-persona");
const formPrestamo = document.getElementById("form-prestamo");

const tablaJuegos = document.getElementById("tabla-juegos");
const tablaPrestamos = document.getElementById("tabla-prestamos");
const listaPersonas = document.getElementById("lista-personas");

const selectorJuego = document.getElementById("juego-prestamo");
const selectorPersona = document.getElementById("persona-prestamo");
const campoFecha = document.getElementById("fecha-prestamo");
const mensaje = document.getElementById("mensaje");


function fechaActual() {
    const fecha = new Date();
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}

function mostrarFecha(fecha) {
    const partes = fecha.split("-");
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function crearId() {
    return crypto.randomUUID();
}

function mostrarMensaje(texto) {
    mensaje.textContent = texto;
}

function guardarDatos() {
    try {
        localStorage.setItem(clave, JSON.stringify(datos));
        return true;
    } catch (error) {
        mostrarMensaje(
            "No se pudieron guardar los datos. Revise el almacenamiento del navegador."
        );
        return false;
    }
}

function estaPrestado(idJuego) {
    return datos.prestamos.some(function (prestamo) {
        return prestamo.juegoId === idJuego &&
               prestamo.fechaDevolucion === null;
    });
}

function agregarCelda(fila, texto) {
    const celda = document.createElement("td");
    celda.textContent = texto;
    fila.appendChild(celda);
    return celda;
}

function mostrarTablaVacia(tabla, texto, columnas) {
    const fila = document.createElement("tr");
    const celda = agregarCelda(fila, texto);
    celda.colSpan = columnas;
    tabla.appendChild(fila);
}


function mostrarJuegos() {
    tablaJuegos.replaceChildren();
    selectorJuego.replaceChildren(
        new Option("Seleccione un juego", "")
    );

    if (datos.juegos.length === 0) {
        mostrarTablaVacia(
            tablaJuegos,
            "No hay videojuegos registrados.",
            4
        );
    }

    datos.juegos.forEach(function (juego) {
        const prestado = estaPrestado(juego.id);
        const fila = document.createElement("tr");

        agregarCelda(fila, juego.titulo);
        agregarCelda(fila, juego.plataforma);
        agregarCelda(fila, juego.genero);

        const celdaEstado = document.createElement("td");
        const estado = document.createElement("span");

        estado.textContent = prestado ? "Prestado" : "Disponible";
        estado.className = prestado ? "prestado" : "disponible";

        celdaEstado.appendChild(estado);
        fila.appendChild(celdaEstado);
        tablaJuegos.appendChild(fila);

        if (!prestado) {
            const opcion = new Option(
                `${juego.titulo} (${juego.plataforma})`,
                juego.id
            );

            selectorJuego.add(opcion);
        }
    });
}


function mostrarPersonas() {
    listaPersonas.replaceChildren();
    selectorPersona.replaceChildren(
        new Option("Seleccione una persona", "")
    );

    if (datos.personas.length === 0) {
        const elemento = document.createElement("li");
        elemento.textContent = "No hay personas registradas.";
        listaPersonas.appendChild(elemento);
    }

    datos.personas.forEach(function (persona) {
        const elemento = document.createElement("li");
        elemento.textContent = persona.nombre;
        listaPersonas.appendChild(elemento);

        selectorPersona.add(
            new Option(persona.nombre, persona.id)
        );
    });
}


function mostrarPrestamos() {
    tablaPrestamos.replaceChildren();

    if (datos.prestamos.length === 0) {
        mostrarTablaVacia(
            tablaPrestamos,
            "No hay préstamos registrados.",
            5
        );
    }

    
    datos.prestamos.slice().reverse().forEach(function (prestamo) {
        const juego = datos.juegos.find(function (juego) {
            return juego.id === prestamo.juegoId;
        });

        const persona = datos.personas.find(function (persona) {
            return persona.id === prestamo.personaId;
        });

        const fila = document.createElement("tr");

        agregarCelda(fila, juego.titulo);
        agregarCelda(fila, persona.nombre);
        agregarCelda(fila, mostrarFecha(prestamo.fecha));

        agregarCelda(
            fila,
            prestamo.fechaDevolucion
                ? mostrarFecha(prestamo.fechaDevolucion)
                : "Pendiente"
        );

        const celdaAccion = document.createElement("td");

        if (prestamo.fechaDevolucion === null) {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.textContent = "Devolver";

            boton.addEventListener("click", function () {
                devolverJuego(prestamo.id);
            });

            celdaAccion.appendChild(boton);
        } else {
            celdaAccion.textContent = "Devuelto";
        }

        fila.appendChild(celdaAccion);
        tablaPrestamos.appendChild(fila);
    });
}

function actualizarPantalla() {
    mostrarJuegos();
    mostrarPersonas();
    mostrarPrestamos();
}


formJuego.addEventListener("submit", function (evento) {
    evento.preventDefault();

    const titulo = document.getElementById("titulo").value.trim();
    const plataforma = document.getElementById("plataforma").value.trim();
    const genero = document.getElementById("genero").value.trim();

    if (!titulo || !plataforma || !genero) {
        mostrarMensaje("Complete todos los datos del videojuego.");
        return;
    }

    datos.juegos.push({
        id: crearId(),
        titulo: titulo,
        plataforma: plataforma,
        genero: genero
    });

    if (!guardarDatos()) {
        datos.juegos.pop();
        return;
    }

    formJuego.reset();
    actualizarPantalla();
    mostrarMensaje("Videojuego registrado.");
});


formPersona.addEventListener("submit", function (evento) {
    evento.preventDefault();

    const nombre = document.getElementById("nombre").value.trim();

    if (!nombre) {
        mostrarMensaje("Escriba el nombre de la persona.");
        return;
    }

    datos.personas.push({
        id: crearId(),
        nombre: nombre
    });

    if (!guardarDatos()) {
        datos.personas.pop();
        return;
    }

    formPersona.reset();
    actualizarPantalla();
    mostrarMensaje("Persona registrada.");
});


formPrestamo.addEventListener("submit", function (evento) {
    evento.preventDefault();

    const juegoId = selectorJuego.value;
    const personaId = selectorPersona.value;
    const fecha = campoFecha.value;

    if (!juegoId || !personaId || !fecha) {
        mostrarMensaje("Seleccione un juego, una persona y una fecha.");
        return;
    }

    if (fecha > fechaActual()) {
        mostrarMensaje("La fecha del préstamo no puede ser futura.");
        return;
    }

    if (estaPrestado(juegoId)) {
        mostrarMensaje("Este videojuego ya está prestado.");
        return;
    }

    datos.prestamos.push({
        id: crearId(),
        juegoId: juegoId,
        personaId: personaId,
        fecha: fecha,
        fechaDevolucion: null
    });

    if (!guardarDatos()) {
        datos.prestamos.pop();
        return;
    }

    formPrestamo.reset();
    campoFecha.value = fechaActual();

    actualizarPantalla();
    mostrarMensaje("Préstamo registrado.");
});


function devolverJuego(idPrestamo) {
    const prestamo = datos.prestamos.find(function (prestamo) {
        return prestamo.id === idPrestamo;
    });

    if (!prestamo || prestamo.fechaDevolucion !== null) {
        return;
    }

    prestamo.fechaDevolucion = fechaActual();

    if (!guardarDatos()) {
        prestamo.fechaDevolucion = null;
        return;
    }

    actualizarPantalla();
    mostrarMensaje("Devolución registrada. El juego está disponible.");
}


campoFecha.value = fechaActual();
campoFecha.max = fechaActual();
actualizarPantalla();