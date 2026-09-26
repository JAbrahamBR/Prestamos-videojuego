from pathlib import Path
import sqlite3
from datetime import date

from flask import Flask, jsonify, render_template, request


app = Flask(__name__)
BASE_DATOS = Path(__file__).resolve().parent / "videojuegos.db"


def conectar():
    conexion = sqlite3.connect(BASE_DATOS)
    conexion.row_factory = sqlite3.Row
    conexion.execute("PRAGMA foreign_keys = ON")
    return conexion


def crear_tablas():
    conexion = conectar()

    try:
        conexion.executescript("""
            CREATE TABLE IF NOT EXISTS juegos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo TEXT NOT NULL,
                plataforma TEXT NOT NULL,
                genero TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS personas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS prestamos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                juego_id INTEGER NOT NULL,
                persona_id INTEGER NOT NULL,
                fecha TEXT NOT NULL,
                fecha_devolucion TEXT,
                FOREIGN KEY (juego_id) REFERENCES juegos(id),
                FOREIGN KEY (persona_id) REFERENCES personas(id)
            );

            CREATE UNIQUE INDEX IF NOT EXISTS juego_prestado
            ON prestamos(juego_id)
            WHERE fecha_devolucion IS NULL;
        """)

        conexion.commit()
    finally:
        conexion.close()


def obtener_texto(datos, campo):
    valor = datos.get(campo, "")
    return valor.strip() if isinstance(valor, str) else ""


@app.route("/")
def inicio():
    return render_template("index.html")


@app.get("/api/datos")
def consultar_datos():
    conexion = conectar()

    try:
        juegos = conexion.execute("""
            SELECT juegos.*,
                CASE WHEN EXISTS (
                    SELECT 1
                    FROM prestamos
                    WHERE prestamos.juego_id = juegos.id
                      AND prestamos.fecha_devolucion IS NULL
                )
                THEN 'Prestado'
                ELSE 'Disponible'
                END AS estado
            FROM juegos
            ORDER BY juegos.id DESC
        """).fetchall()

        personas = conexion.execute("""
            SELECT * FROM personas ORDER BY nombre
        """).fetchall()

        prestamos = conexion.execute("""
            SELECT
                prestamos.id,
                juegos.titulo AS juego,
                personas.nombre AS persona,
                prestamos.fecha,
                prestamos.fecha_devolucion
            FROM prestamos
            JOIN juegos ON juegos.id = prestamos.juego_id
            JOIN personas ON personas.id = prestamos.persona_id
            ORDER BY prestamos.id DESC
        """).fetchall()

        return jsonify({
            "juegos": [dict(fila) for fila in juegos],
            "personas": [dict(fila) for fila in personas],
            "prestamos": [dict(fila) for fila in prestamos]
        })
    finally:
        conexion.close()


@app.post("/api/juegos")
def registrar_juego():
    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify(error="Datos inválidos."), 400

    titulo = obtener_texto(datos, "titulo")
    plataforma = obtener_texto(datos, "plataforma")
    genero = obtener_texto(datos, "genero")

    if not titulo or not plataforma or not genero:
        return jsonify(error="Complete todos los datos del juego."), 400

    if len(titulo) > 100 or len(plataforma) > 50 or len(genero) > 50:
        return jsonify(error="Los datos del juego son demasiado largos."), 400

    conexion = conectar()

    try:
        conexion.execute("""
            INSERT INTO juegos (titulo, plataforma, genero)
            VALUES (?, ?, ?)
        """, (titulo, plataforma, genero))

        conexion.commit()
        return jsonify(mensaje="Juego registrado."), 201
    finally:
        conexion.close()


@app.post("/api/personas")
def registrar_persona():
    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify(error="Datos inválidos."), 400

    nombre = obtener_texto(datos, "nombre")

    if not nombre or len(nombre) > 100:
        return jsonify(error="Escriba un nombre de hasta 100 caracteres."), 400

    conexion = conectar()

    try:
        conexion.execute(
            "INSERT INTO personas (nombre) VALUES (?)",
            (nombre,)
        )

        conexion.commit()
        return jsonify(mensaje="Persona registrada."), 201
    finally:
        conexion.close()


@app.post("/api/prestamos")
def registrar_prestamo():
    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify(error="Datos inválidos."), 400

    try:
        juego_id = int(datos.get("juego_id", ""))
        persona_id = int(datos.get("persona_id", ""))
        fecha = date.fromisoformat(obtener_texto(datos, "fecha"))
    except (ValueError, TypeError):
        return jsonify(error="Seleccione juego, persona y fecha válidos."), 400

    if fecha > date.today():
        return jsonify(error="La fecha no puede ser futura."), 400

    conexion = conectar()

    try:
        # Evita que dos solicitudes presten el mismo juego a la vez.
        conexion.execute("BEGIN IMMEDIATE")

        juego = conexion.execute(
            "SELECT id FROM juegos WHERE id = ?",
            (juego_id,)
        ).fetchone()

        persona = conexion.execute(
            "SELECT id FROM personas WHERE id = ?",
            (persona_id,)
        ).fetchone()

        if juego is None or persona is None:
            return jsonify(error="El juego o la persona no existe."), 400

        activo = conexion.execute("""
            SELECT id FROM prestamos
            WHERE juego_id = ? AND fecha_devolucion IS NULL
        """, (juego_id,)).fetchone()

        if activo:
            return jsonify(error="El juego ya está prestado."), 409

        conexion.execute("""
            INSERT INTO prestamos (juego_id, persona_id, fecha)
            VALUES (?, ?, ?)
        """, (juego_id, persona_id, fecha.isoformat()))

        conexion.commit()
        return jsonify(mensaje="Préstamo registrado."), 201
    finally:
        conexion.close()


@app.post("/api/prestamos/<int:prestamo_id>/devolver")
def devolver_juego(prestamo_id):
    conexion = conectar()

    try:
        conexion.execute("BEGIN IMMEDIATE")

        prestamo = conexion.execute(
            "SELECT * FROM prestamos WHERE id = ?",
            (prestamo_id,)
        ).fetchone()

        if prestamo is None:
            return jsonify(error="El préstamo no existe."), 404

        if prestamo["fecha_devolucion"] is not None:
            return jsonify(error="Este juego ya fue devuelto."), 409

        conexion.execute("""
            UPDATE prestamos
            SET fecha_devolucion = ?
            WHERE id = ?
        """, (date.today().isoformat(), prestamo_id))

        conexion.commit()
        return jsonify(mensaje="Devolución registrada.")
    finally:
        conexion.close()


crear_tablas()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)